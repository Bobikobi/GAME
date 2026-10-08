/**
 * Plays the 3D trial of the valley (game/3d.html) in a headless Chrome and
 * takes screenshots: the wake, the bridge, the meadow, the town, and the
 * night. Same flags as opening.ts:
 *
 *   pnpm build && tsx game/e2e/valley3d.ts [out-dir]
 *   E2E_ONLY=phone|desktop    E2E_VIDEO=<dir>    E2E_URL=https://<deployment>
 *
 * The page runs a fixed step per frame under ?e2e, and window.__valley3d
 * drives the walk, so a run is the same on every machine.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, type Page, type Viewport } from './cdp';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(GAME_DIR, 'dist');
const OUT = resolve(process.argv[2] ?? join(GAME_DIR, '..', '.scratch', 'e2e'));

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
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
  if (process.env.E2E_VIDEO) await page.record(join(process.env.E2E_VIDEO, `valley3d-${name}`));
  let shot = 0;
  const snap = async (label: string) => {
    shot++;
    await page.screenshot(join(OUT, `valley3d-${name}-${String(shot).padStart(2, '0')}-${label}.png`));
  };
  const log = (msg: string) => console.log(`[${name}] ${msg}`);
  const walk = async (dx: number, dz: number, frames: number, what: string) => {
    await page.eval(`window.__valley3d.walk(${dx}, ${dz}, ${frames})`);
    log(`${what}: now at ${JSON.stringify(await page.eval('window.__valley3d.pos()'))}`);
  };
  try {
    await page.goto(`${url}3d.html?e2e`);
    await page.waitFor(`!!(window.__valley3d && window.__valley3d.ready)`, 'the valley to load', 90_000);
    await walk(0, 0, 10, 'woke by the river');
    await snap('wake');
    await walk(1, 0, 100, 'walked east onto the old bridge');
    await snap('bridge');
    await walk(1, 0, 70, 'crossed to the east bank');
    await walk(0, -1, 50, 'walked north into the berry bushes');
    await snap('meadow');
    await walk(1, 0, 120, 'walked east along the edge of the town');
    await walk(0, -1, 60, 'walked north to the well');
    await snap('town');
    await page.eval('window.__valley3d.night(true)');
    await walk(0, 0, 20, 'night fell');
    await snap('night');
    await walk(0, 1, 120, 'walked south in the dark');
    await snap('dark');
    if (page.errors.length) throw new Error(`page errors:\n${page.errors.join('\n')}`);
  } finally {
    page.close();
  }
}

async function main(): Promise<void> {
  const remote = process.env.E2E_URL;
  if (!remote && !existsSync(join(DIST, '3d.html'))) throw new Error('no game/dist/3d.html: run "pnpm build" first');
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
      console.log(`[${name}] valley finished in ${Math.round((Date.now() - t0) / 1000)} s`);
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
