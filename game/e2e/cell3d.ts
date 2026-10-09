/**
 * Plays the 3D cell trial (game/cell.html) in a headless Chrome and takes
 * screenshots: the wake by the fire, a close look at the character, the
 * fire, the stream, a run, and the night. Same flags as opening.ts:
 *
 *   pnpm build && tsx game/e2e/cell3d.ts [out-dir]
 *   E2E_ONLY=phone|desktop    E2E_VIDEO=<dir>    E2E_URL=https://<deployment>
 *   E2E_LOOK=wizard|matt|human|wolf-bright|wolf-grim   (the character, wizard by default)
 *
 * The page runs a fixed step per frame under ?e2e, and window.__cell3d
 * drives the walk, so a run is the same on every machine. The camp's
 * models must be fetched first: node game/tools/fetch-cell-assets.mjs.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, type Page, type Viewport } from './cdp';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(GAME_DIR, 'dist');
const OUT = resolve(process.argv[2] ?? join(GAME_DIR, '..', '.scratch', 'e2e'));
const LOOK = process.env.E2E_LOOK ?? 'wizard';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.hdr': 'application/octet-stream',
  '.json': 'application/json',
};

function serve(): Promise<{ server: Server; url: string }> {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/')).replace(/^(\.\.[/\\])+/, '');
      let file = join(DIST, path);
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (!file.startsWith(DIST) || !existsSync(file)) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      ok({ server, url: `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/` });
    });
  });
}

const RUNS: [string, Viewport][] = [
  ['phone', { width: 390, height: 844, mobile: true }],
  ['desktop', { width: 1280, height: 800, mobile: false }],
];

async function play(browser: Browser, url: string, viewport: Viewport, name: string): Promise<void> {
  const page: Page = await browser.newPage(viewport);
  if (process.env.E2E_VIDEO) await page.record(join(process.env.E2E_VIDEO, `cell3d-${name}`));
  let shot = 0;
  const snap = async (label: string) => {
    shot++;
    await page.screenshot(join(OUT, `cell3d-${LOOK}-${name}-${String(shot).padStart(2, '0')}-${label}.png`));
  };
  const log = (msg: string) => console.log(`[${name}] ${msg}`);
  const walk = async (dx: number, dz: number, frames: number, what: string, gait: 'walk' | 'run' = 'walk') => {
    await page.eval(`window.__cell3d.${gait}(${dx}, ${dz}, ${frames})`);
    log(`${what}: now at ${JSON.stringify(await page.eval('window.__cell3d.pos()'))}`);
  };
  try {
    await page.goto(`${url}cell.html?e2e&look=${LOOK}`);
    await page.waitFor(`!!(window.__cell3d && window.__cell3d.ready)`, 'the camp to load', 180_000);
    log(`scene: ${JSON.stringify(await page.eval('(() => { const d = window.__cell3d.debug(); return { look: d.look, clips: d.clips, triangles: d.triangles, models: d.models }; })()'))}`);
    await walk(0, 0, 8, 'woke by the fire');
    await snap('wake');
    await page.eval('window.__cell3d.zoom(3.4); window.__cell3d.face()');
    await walk(0, 0, 20, 'turned to the camera, close');
    await snap('close');
    await page.eval('window.__cell3d.zoom(7)');
    await walk(-1, -1, 30, 'walked to the fire');
    await snap('fire');
    await walk(-1, -0.5, 70, 'walked past the stump');
    await walk(-1, 0, 50, 'walked west to the stream');
    await snap('stream');
    await walk(1, 0.4, 24, 'ran back up the bank', 'run');
    await snap('run');
    await page.eval('window.__cell3d.night(true)');
    await walk(1, 0, 40, 'night fell, walked back to the fire');
    await snap('night');
    if (page.errors.length) throw new Error(`page errors:\n${page.errors.join('\n')}`);
  } finally {
    page.close();
  }
}

async function main(): Promise<void> {
  const remote = process.env.E2E_URL;
  if (!remote && !existsSync(join(DIST, 'cell.html'))) throw new Error('no game/dist/cell.html: run "pnpm build" first');
  if (!remote && !existsSync(join(DIST, '3d', 'cell', 'manifest.json'))) {
    throw new Error('no game/dist/3d/cell/manifest.json: run "node game/tools/fetch-cell-assets.mjs" and build again');
  }
  mkdirSync(OUT, { recursive: true });
  const local = remote ? null : await serve();
  const url = remote ?? local?.url ?? '';
  const browser = await Browser.launch();
  const only = process.env.E2E_ONLY;
  try {
    for (const [name, viewport] of RUNS) {
      if (only && only !== name) continue;
      const t0 = Date.now();
      await play(browser, url, viewport, name);
      console.log(`[${name}] camp finished in ${Math.round((Date.now() - t0) / 1000)} s`);
    }
  } finally {
    await browser.close();
    local?.server.close();
  }
  console.log(`screenshots in ${OUT}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
