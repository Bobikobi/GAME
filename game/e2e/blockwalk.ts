/**
 * The engine stations of the private block builder (its stages `frames` and `engine`; private tracker #10, order 23). Run by that builder, not by `pnpm e2e`: it needs a scene folder the builder has just made.
 *
 *   tsx game/e2e/blockwalk.ts frames SCENE_DIR DIST_DIR OUT_DIR CONFIG.json
 *        CONFIG {frames: [{tag, minute}]}: the engine's own frame of the WHOLE scene at one device pixel per art pixel (viewport = the scene's size, camera zoom 4, the figure hidden) at each
 *        minute, written to OUT_DIR/full-<tag>.png (what the builder's seam scan reads).
 *   tsx game/e2e/blockwalk.ts walk SCENE_DIR DIST_DIR OUT_DIR CONFIG.json
 *        CONFIG {hours: [{tag, minute}], crossings: [{seam, route: [[cx, cy], ...], first, back}]}: a figure is put on the first cell of each route and walks it a tile at a time on the held arrow keys (the
 *        trunk's FreeWalk), at every hour. The route is a run of open cells that crosses one seam of the block (the builder's walk stage found it on the exported cells). A step is good when the feet
 *        stand on the cell asked for; a walk that stops short is a stuck cell. Stills at the phone's landscape size (844 x 390, the game's own zoom) with the figure on the seam, and the frames of
 *        one clip (the first crossing of each seam at 13:00) in OUT_DIR/clip/NNNN.png.
 *
 * One JSON line per walk (`{"ok":true,"seam":...,"hour":...,"detail":...}`), exit 0 when it ran to the end (the lines say pass or fail). The browser is closed by its handle in `finally`.
 */
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { Browser, type Page, sleep } from './cdp';
import { FreeWalk } from './walk';
import { type Crossing, walkCrossing } from './crossing';

const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const BASE_HOLD = 'clock,wind,water,grass,air,fog';

interface Scene { id: string; cell: number; cols: number; rows: number; width: number; height: number }
type Hour = { tag: string; minute: number };
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

async function toTheWorld(page: Page, url: string, id: string): Promise<void> {
  await page.goto(`${url}?debug&seed=7&frame=off&painted=${id}${process.env.BLOCK_BASE === '1' ? '&base=1' : ''}&hold=${BASE_HOLD}${process.env.BLOCK_EXTRA ?? ''}`);
  await page.waitFor(`!!document.querySelector('.title-screen button') || !!window.__fail`, 'the title screen', 60_000);
  await page.tap('.title-screen button', 'New game');
  await page.waitFor(`!!document.querySelector('.card.race')`, 'the race cards', 20_000);
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor(`!!window.__game?.session && !!window.__painted`, 'the session and the painted mount', 30_000);
  for (let k = 0; k < 40; k++) {
    const up = await page.eval<number>(`(() => { const o = document.querySelector('.dialog-options button'); if (o) { o.click(); return 1; } const d = document.querySelector('.dialog, .story-box'); if (d) { d.click(); return 2; } return 0; })()`);
    if (up === 0) break;
    await sleep(350);
  }
  await page.eval(`(() => { const u = document.getElementById('ui'); if (u) u.style.visibility = 'hidden'; return true; })()`);
}

const setMinute = async (page: Page, m: number): Promise<void> => {
  await page.eval(`window.__painted.setMinuteFirstDay(${m})`);
  await page.waitFor(`window.__painted.litMinute === ${m}`, `the engine's light at minute ${m}`, 30_000, false);
};

async function frames(sceneDir: string, dist: string, outDir: string, cfg: { frames: Hour[] }): Promise<void> {
  const scene = JSON.parse(readFileSync(join(sceneDir, 'scene.json'), 'utf8')) as Scene;
  const { server, url } = await serve(dist, scene.id, sceneDir);
  const browser = await Browser.launch();
  try {
    const page = await browser.newPage({ width: scene.width, height: scene.height, mobile: false });
    await toTheWorld(page, url, scene.id);
    await page.eval(`(() => { __painted.setHold('${BASE_HOLD}'); __painted.roeShown(false); const a = __painted.animal; if (a) a.setVisible(false); const w = __game.world; w.player.setVisible(false); return 1; })()`);
    for (const h of cfg.frames) {
      await setMinute(page, h.minute);
      await page.eval(`(() => { const p = __painted, w = __game.world, c = w.cameras.main; c.setZoom(4); c.stopFollow(); c.centerOn(p.x0 * 16 + p.scene.width / 8, p.y0 * 16 + p.scene.height / 8); return 1; })()`);
      await sleep(1500);
      await page.screenshot(join(outDir, `full-${h.tag}.png`));
      say({ frame: h.tag, minute: h.minute });
    }
  } finally {
    await browser.close();
    server.close();
  }
}

async function walk(sceneDir: string, dist: string, outDir: string, cfg: { hours: Hour[]; crossings: Crossing[] }): Promise<void> {
  const scene = JSON.parse(readFileSync(join(sceneDir, 'scene.json'), 'utf8')) as Scene;
  const { server, url } = await serve(dist, scene.id, sceneDir);
  const browser = await Browser.launch();
  const clipDir = join(outDir, 'clip');
  mkdirSync(clipDir, { recursive: true });
  let clipN = 0;
  const clipAt: number[] = [];
  const tClip = Date.now();
  try {
    const page = await browser.newPage({ width: 844, height: 390, mobile: false });
    await toTheWorld(page, url, scene.id);
    const x0 = await page.eval<number>('window.__painted.x0');
    const y0 = await page.eval<number>('window.__painted.y0');
    await page.eval(`(() => { const w = __game.world; w.player.setVisible(true); return 1; })()`);
    const w = new FreeWalk(page, false);
    for (const h of cfg.hours) {
      await setMinute(page, h.minute);
      for (const c of cfg.crossings) {
        const base = c.back === true ? { seam: c.seam, hour: h.tag, back: true } : { seam: c.seam, hour: h.tag };
        const stills = (c.first ?? false) || h.tag !== 'noon';
        let filming = c.first === true && h.tag === 'noon';
        const reel = (async (): Promise<void> => {
          while (filming) {
            const ok = await page.screenshot(join(clipDir, `${String(clipN).padStart(4, '0')}.png`)).then(() => true, () => false);
            if (ok) {
              clipAt.push(Date.now() - tClip);
              clipN += 1;
            }
          }
        })();
        const atMid = stills
          ? async (): Promise<string> => {
              await page.screenshot(join(outDir, `still-${c.seam}${c.back === true ? '-back' : ''}-${h.tag}.png`));
              return page.eval<string>(`(() => { const w = __game.world, cam = w.cameras.main, p = w.player; return JSON.stringify({ screen: [Math.round((p.x - cam.worldView.x) * cam.zoom), Math.round((p.y - cam.worldView.y) * cam.zoom)], visible: p.visible, alpha: p.alpha, zoom: cam.zoom }); })()`);
            }
          : undefined;
        const r = await walkCrossing(page, w, c, x0, y0, atMid);
        filming = false;
        await reel;
        let { ok, detail } = r;
        const seen = r.seen;
        const errs = page.errors.filter((e) => !/favicon/.test(e));
        if (errs.length) {
          ok = false;
          detail += ` page errors ${JSON.stringify(errs.slice(0, 2))}`;
        }
        say({ ok, ...base, detail, figure: seen });
      }
    }
    writeFileSync(join(outDir, 'clip.json'), JSON.stringify({ frames: clipN, at_ms: clipAt }));
  } finally {
    await browser.close();
    server.close();
  }
}

async function main(): Promise<number> {
  const [mode, sceneDir, dist, out, cfgPath] = process.argv.slice(2) as [string, string, string, string, string];
  const outDir = resolve(out);
  mkdirSync(outDir, { recursive: true });
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  if (mode === 'frames') await frames(resolve(sceneDir), resolve(dist), outDir, cfg);
  else if (mode === 'walk') await walk(resolve(sceneDir), resolve(dist), outDir, cfg);
  else throw new Error(`unknown mode ${mode}`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    say({ ok: false, seam: '', hour: '', detail: `the engine rig did not run: ${String(e)}` });
    process.exit(1);
  },
);
