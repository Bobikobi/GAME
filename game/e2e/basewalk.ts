/**
 * The engine station of the valley as the painted land (V5, private #44): `base=1` makes the content's own map the scene's ground at tile (1, 1).
 *
 *   tsx game/e2e/basewalk.ts SCENE_DIR DIST_DIR OUT_DIR [shots]
 *
 * It serves DIST_DIR and the scene folder at /painted/<id>/, opens `?debug&seed=7&painted=<id>&base=1&zoom=auto` at the phone's landscape size (844 x 390), starts a new game and prints one JSON line per
 * station: where the session woke (tile and the scene cell under it), the camera, and the console errors. Stills go to OUT_DIR. The browser is closed by its handle in `finally`.
 */
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync, mkdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { Browser, type Page, sleep } from './cdp';

const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const say = (o: object): void => console.log(JSON.stringify(o));

function serve(dist: string, id: string, sceneDir: string): Promise<{ server: Server; url: string }> {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const path = decodeURIComponent((req.url ?? '/').split('?')[0] as string);
      const pre = `/painted/${id}/`;
      const file = path.startsWith(pre) ? join(sceneDir, path.slice(pre.length)) : join(dist, path === '/' ? 'index.html' : path);
      if (!existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => ok({ server, url: `http://127.0.0.1:${(server.address() as { port: number }).port}/` }));
  });
}

async function toTheWorld(page: Page, url: string, id: string, extra: string): Promise<void> {
  await page.goto(`${url}?debug&seed=7&frame=off&painted=${id}&base=1&zoom=auto${extra}`);
  await page.waitFor(`!!document.querySelector('.title-screen button') || !!window.__fail`, 'the title screen', 60_000);
  await page.tap('.title-screen button', 'New game');
  await page.waitFor(`!!document.querySelector('.card.race')`, 'the race cards', 20_000);
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor(`!!window.__game?.session && !!window.__painted`, 'the session and the painted mount', 30_000);
}

async function main(): Promise<number> {
  const [sceneDir, dist, out] = process.argv.slice(2).map((p) => resolve(p)) as [string, string, string];
  mkdirSync(out, { recursive: true });
  const scene = JSON.parse(readFileSync(join(sceneDir, 'scene.json'), 'utf8')) as { id: string; cols: number; rows: number };
  const { server, url } = await serve(dist, scene.id, sceneDir);
  const browser = await Browser.launch();
  try {
    const page = await browser.newPage({ width: 844, height: 390, mobile: false });
    await toTheWorld(page, url, scene.id, process.env.BASE_EXTRA ?? '');
    await sleep(2500);
    const at = await page.eval<string>(`(() => { const s = __game.session, p = __painted, c = __game.world.cameras.main; return JSON.stringify({ pos: s.pos, cell: [s.pos[0] - p.x0, s.pos[1] - p.y0], zoom: c.zoom, base: p.baseMode, map: [__game.bundle?.map?.width] }); })()`);
    say({ station: 'woke', at: JSON.parse(at), errors: page.errors.filter((e) => !/favicon/.test(e)).slice(0, 5) });
    await page.screenshot(join(out, 'woke.png'));
    if (process.env.FRAMES) {
      const fr = await page.eval<{ mean: number; p95: number; n: number; fps: number | null }>(`new Promise((resolve) => { const t = []; let last = performance.now(); const end = last + ${Number(process.env.FRAMES)}; const f = (now) => { t.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else { t.shift(); t.sort((a, b) => a - b); resolve({ mean: t.reduce((a, b) => a + b, 0) / Math.max(t.length, 1), p95: t[Math.floor(t.length * 0.95)] ?? 0, n: t.length, fps: window.__game.loop ? window.__game.loop.actualFps : null }); } }; requestAnimationFrame(f); })`);
      say({ station: 'frames', mean_ms: Number(fr.mean.toFixed(2)), p95_ms: Number(fr.p95.toFixed(2)), n: fr.n, fps: fr.fps });
    }
    if (process.env.PROBE) {
      const r = await page.eval<string>(`(() => { const g = __game, s = g.session, w = g.world; const out = []; for (const [x, y] of ${process.env.PROBE}) { const row = []; for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) row.push(w.canWalk(s, x, y, [x - dx, y - dy]) ? 1 : 0); out.push([x, y, row.join('')]); } return JSON.stringify(out); })()`);
      say({ station: 'probe', r: JSON.parse(r) });
    }
  } finally {
    await browser.close();
    server.close();
  }
  return 0;
}

main().then((c) => process.exit(c), (e) => {
  say({ ok: false, detail: `the engine rig did not run: ${String(e)}` });
  process.exit(1);
});
