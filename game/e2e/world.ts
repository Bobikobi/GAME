/**
 * The engine stations of the world line's end-to-end run (gate part `world-e2e`, tracker #22; the Python stations are tools/art/world_e2e/). Run by tools/art/world_e2e/engine.py, not by `pnpm e2e`
 * (it is in no group of run.ts: it needs a scene folder the gate has just made).
 *
 *   tsx game/e2e/world.ts SCENE_DIR DIST_DIR OUT_DIR SEAM_X0,SEAM_X1
 *
 * The scene folder is the exporter's (tools/art/scene/export.py) of the joined strip. One headless Chrome, one real load of the game's own mount (`mountPainted`, `?debug&painted=<id>`):
 *
 *   5  the engine loads the folder: the mount is up, every file it asks for was served (none a 404), the scene's size and pieces are the folder's, the page threw nothing
 *   6  a figure walks across the seam: from the walkable start by the mount's own route to a cell east of the seam, a tile at a time on the held arrow key (the trunk's FreeWalk), every tile of
 *      the way open, the feet standing on each cell of the seam's span
 *   7  the light at 07:00, 13:00 and 19:30: the engine's light (`lightNow`) is the world's table at each minute, and the drawn frame follows it (13:00 brighter than 19:30, 19:30 warmer than 13:00)
 *   8  the picture keeps drawing while the light changes under it (round 5, R1): night with the lantern lit, then 13:00 at another cell, then night, then day again, five times (K1), the
 *      same with the torch and with two standing lights (K2), and the clock swept through dusk and through dawn while she walks between two cells on the held key (K3): the engine's frame
 *      counter advances after every change and the page throws nothing
 *
 * It prints one JSON line per station (`{"n":5,"ok":true,"bar":"...","detail":"..."}`), screenshots of the three hours into OUT_DIR, and exits 0 when it ran to the end (the lines say pass or
 * fail). A station that fails stops the run after its own line. The browser it started is closed by its handle in `finally`.
 */
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { Browser, type Page, sleep } from './cdp';
import { FreeWalk, ART_PX } from './walk';
import lightTables from '../src/painted-light.json';

const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

interface Line {
  n: number;
  ok: boolean;
  bar: string;
  detail: string;
  ms: number;
}
const say = (l: Line): void => console.log(JSON.stringify(l));

interface Scene {
  id: string;
  cell: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
  hourset?: string;
  cells: string[];
  objects: { i: number }[];
  sheet: { w: number; h: number };
}

interface Row {
  minute: number;
  elev: number;
  amb: number[];
  sun: number[];
}

/** The static server of the mount's two roots: the built game and, under /painted/<id>/, the scene folder. Every answer is kept. */
function serve(dist: string, id: string, sceneDir: string, log: { path: string; status: number }[]): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const path = decodeURIComponent((req.url ?? '/').split('?')[0] as string);
      const pre = `/painted/${id}/`;
      const file = path.startsWith(pre) ? join(sceneDir, path.slice(pre.length)) : join(dist, path === '/' ? 'index.html' : path);
      const ok = existsSync(file) && statSync(file).isFile();
      log.push({ path, status: ok ? 200 : 404 });
      if (!ok) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${(server.address() as { port: number }).port}/` }));
  });
}

/** The world's light rows at a minute, by the same straight line the mount draws (painted.ts litAt): the table's own numbers, read from the json the mount reads. */
function tableAt(rows: Row[], minute: number): { elev: number; amb: number[]; sun: number[] } {
  const n = rows.length;
  let i = n - 1;
  for (let k = 0; k < n; k++) if (rows[k]!.minute <= minute) i = k;
  const a = rows[i]!;
  const b = rows[(i + 1) % n]!;
  const span = (b.minute - a.minute + 1440) % 1440 || 1440;
  const t = (((minute - a.minute) % 1440) + 1440) % 1440 / span;
  const mix = (x: number, y: number): number => x + (y - x) * t;
  return { elev: mix(a.elev, b.elev), amb: a.amb.map((v, c) => mix(v, b.amb[c]!)), sun: a.sun.map((v, c) => mix(v, b.sun[c]!)) };
}

/** BFS over the exported cells, four ways, '.' only: the route a person could walk; undefined when there is none. */
function openRoute(cells: string[], from: [number, number], to: [number, number]): [number, number][] | undefined {
  const key = (p: readonly number[]): string => `${p[0]},${p[1]}`;
  const prev = new Map<string, [number, number] | null>([[key(from), null]]);
  const queue: [number, number][] = [from];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    if (x === to[0] && y === to[1]) {
      const path: [number, number][] = [];
      for (let p: [number, number] | null = [x, y]; p; p = prev.get(key(p)) ?? null) path.unshift(p);
      return path;
    }
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (cells[ny]?.[nx] !== '.' || prev.has(key([nx, ny]))) continue;
      prev.set(key([nx, ny]), [x, y]);
      queue.push([nx, ny]);
    }
  }
  return undefined;
}

async function toTheWorld(page: Page, url: string, id: string): Promise<void> {
  await page.goto(`${url}?debug&seed=7&frame=off&painted=${id}&hold=clock`);
  await page.waitFor(`!!document.querySelector('.title-screen button') || !!window.__fail`, 'the title screen', 60_000);
  await page.tap('.title-screen button', 'New game');
  await page.waitFor(`!!document.querySelector('.card.race')`, 'the race cards', 20_000);
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor(`!!window.__game?.session && !!window.__painted`, 'the session and the painted mount', 30_000);
  for (let k = 0; k < 40; k++) {
    const up = await page.eval<number>(
      `(() => { const o = document.querySelector('.dialog-options button'); if (o) { o.click(); return 1; } const d = document.querySelector('.dialog, .story-box'); if (d) { d.click(); return 2; } return 0; })()`,
    );
    if (up === 0) break;
    await sleep(350);
  }
  await page.eval(`(() => { const u = document.getElementById('ui'); if (u) u.style.visibility = 'hidden'; return true; })()`);
}

/** Mean luma and mean red over blue of the screenshot's centre, read in the page from a PNG data URL. */
async function pixels(page: Page, path: string): Promise<{ luma: number; warm: number }> {
  await page.screenshot(path);
  const b64 = readFileSync(path).toString('base64');
  return page.eval<{ luma: number; warm: number }>(`(async () => {
    const im = new Image(); im.src = 'data:image/png;base64,${b64}'; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const x0 = Math.floor(im.width * 0.25), y0 = Math.floor(im.height * 0.25), w = Math.floor(im.width * 0.5), h = Math.floor(im.height * 0.5);
    const d = g.getImageData(x0, y0, w, h).data; let r = 0, gg = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4;
    return { luma: (0.3 * r + 0.59 * gg + 0.11 * b) / n, warm: r / Math.max(b, 1) };
  })()`);
}

async function main(): Promise<number> {
  const [sceneDir, dist, outDir, seamArg] = process.argv.slice(2) as [string, string, string, string];
  const [seamX0, seamX1] = (seamArg ?? '0,0').split(',').map(Number) as [number, number];
  mkdirSync(outDir, { recursive: true });
  const scene = JSON.parse(readFileSync(join(sceneDir, 'scene.json'), 'utf8')) as Scene;
  const log: { path: string; status: number }[] = [];
  const { server, url } = await serve(dist, scene.id, sceneDir, log);
  const browser = await Browser.launch();
  let n = 5;
  let t0 = Date.now();
  const done = (ok: boolean, bar: string, detail: string): boolean => {
    say({ n, ok, bar, detail, ms: Date.now() - t0 });
    t0 = Date.now();
    n += 1;
    return ok;
  };
  try {
    const page = await browser.newPage({ width: 960, height: 540, mobile: false });
    await toTheWorld(page, url, scene.id);

    // 5. the engine loads the folder
    const painted = await page.eval<{ w: number; h: number; objects: number; cols: number; rows: number; id: string; x0: number; y0: number }>(
      `(() => { const p = window.__painted, s = p.scene; return { w: s.width, h: s.height, objects: s.objects.length, cols: s.cols, rows: s.rows, id: s.id, x0: p.x0, y0: p.y0 }; })()`,
    );
    const missing = log.filter((l) => l.status !== 200 && l.path !== '/favicon.ico' && !l.path.startsWith('/_vercel/'));
    const asked = new Set(log.filter((l) => l.path.startsWith(`/painted/${scene.id}/`)).map((l) => l.path.slice(`/painted/${scene.id}/`.length)));
    // the river's layers only for a land with a river course: a still-water land reads the bed alone and not the five river layers (V5b, painted.ts RIVER_LAYERS)
    const river = (scene as { river?: { sLength?: number } }).river?.sLength ? ['water.png', 'water-lut.png'] : [];
    const need = ['scene.json', 'water.json', 'figures/lynx.json', 'ground.png', 'walls.png', 'objects.png', ...river, 'figures/slim_jog_down.png', 'figures/lynx-idle-down.png'];
    const unread = need.filter((f) => !asked.has(f));
    const same = painted.w === scene.width && painted.h === scene.height && painted.objects === scene.objects.length && painted.cols === scene.cols && painted.rows === scene.rows && painted.id === scene.id;
    const errs = page.errors.filter((e) => !/favicon/.test(e));
    const ok5 = missing.length === 0 && unread.length === 0 && same && errs.length === 0;
    if (!done(ok5, 'the mount loads the exporter\'s folder: every file served, the size, cells and pieces as written, no page error',
      ok5 ? `${scene.id}: ${scene.width}x${scene.height}, ${scene.objects.length} pieces, ${asked.size} files read, 0 not found, 0 page errors`
        : `not found ${JSON.stringify(missing.slice(0, 3))}; never read ${JSON.stringify(unread)}; scene as loaded ${JSON.stringify(painted)} against the folder's ${scene.width}x${scene.height}/${scene.objects.length}; page errors ${JSON.stringify(errs.slice(0, 2))}`)) return 0;

    // 6. a figure walks across the seam
    const feet = await page.eval<[number, number]>(`(() => { const b = window.__game.world.body; return [b.x, b.y]; })()`);
    const start: [number, number] = [Math.floor(feet[0] / ART_PX) - painted.x0, Math.floor(feet[1] / ART_PX) - painted.y0];
    const c0 = Math.floor(seamX0 / scene.cell);
    const c1 = Math.floor((seamX1 - 1) / scene.cell);
    const goal: [number, number] = [Math.min(scene.cols - 2, c1 + 2), start[1]];
    const route = openRoute(scene.cells, start, goal) ?? openRoute(scene.cells, start, [goal[0], Math.min(scene.rows - 1, goal[1] + 1)]);
    if (!route) return done(false, 'a route of open cells from the figure to a cell east of the seam', `none from cell ${start} to column ${goal[0]}: the walk map shuts the seam`) ? 1 : 0;
    const walk = new FreeWalk(page, false);
    const stood: number[] = [];
    for (const [cx, cy] of route.slice(1)) {
      await walk.holdTo([painted.x0 + cx, painted.y0 + cy], `cell ${cx},${cy}`);
      const f = await walk.feet();
      const col = Math.floor(f[0] / ART_PX) - painted.x0;
      if (col !== cx || Math.floor(f[1] / ART_PX) - painted.y0 !== cy) return done(false, 'the feet stand on each cell of the route', `at cell ${cx},${cy} the feet are at ${f.map((v) => v.toFixed(1))} (column ${col})`) ? 1 : 0;
      stood.push(cx);
    }
    const last = route[route.length - 1]!;
    const inSeam = [...new Set(stood.filter((c) => c >= c0 && c <= c1))];
    const crossed = start[0] < c0 && last[0] > c1 && inSeam.length === c1 - c0 + 1;
    if (!done(crossed, 'the figure starts west of the seam, stands on every cell of its span and ends east of it',
      crossed ? `cells ${start} to ${last} in ${route.length - 1} steps, the seam's columns ${c0}-${c1} all stood on` : `start column ${start[0]}, end column ${last[0]}, seam columns ${c0}-${c1}, stood on ${JSON.stringify(inSeam)}`)) return 0;

    // 7. the light at three hours
    const rows = ((lightTables.worlds as unknown as Record<string, { rows: Row[] }>)[(lightTables.aliases as Record<string, string>)[scene.hourset ?? 'river'] ?? scene.hourset ?? 'river'] ?? { rows: [] }).rows;
    const seen: { m: number; luma: number; warm: number; elev: number }[] = [];
    const bad: string[] = [];
    for (const m of [420, 780, 1170]) {
      await page.eval(`window.__painted.setMinuteFirstDay(${m})`);
      await page.waitFor(`window.__painted.litMinute === ${m}`, `the engine's light at minute ${m}`, 30_000, false);
      await sleep(200);
      const lit = await page.eval<{ elev: number; amb: number[]; sun: number[] } | undefined>(`(() => { const l = window.__painted.lightNow(); return l && { elev: l.elev, amb: l.amb, sun: l.sun }; })()`);
      const want = tableAt(rows, m);
      const near = (a: number[], b: number[]): boolean => a.every((v, i) => Math.abs(v - b[i]!) < 1e-6);
      if (!lit || Math.abs(lit.elev - want.elev) > 1e-6 || !near(lit.amb, want.amb) || !near(lit.sun, want.sun)) bad.push(`${m}: engine ${JSON.stringify(lit)} against table ${JSON.stringify(want)}`);
      const px = await pixels(page, join(outDir, `light-${m}.png`));
      seen.push({ m, luma: px.luma, warm: px.warm, elev: lit?.elev ?? NaN });
    }
    const [a, b, c] = seen as [(typeof seen)[0], (typeof seen)[0], (typeof seen)[0]];
    const follows = b.luma > c.luma && b.luma > a.luma && c.warm > b.warm;
    const ok7 = bad.length === 0 && follows && errs.length === 0 && page.errors.filter((e) => !/favicon/.test(e)).length === 0;
    if (!done(ok7, 'the engine\'s light is the world\'s table at 07:00, 13:00 and 19:30; 13:00 is the brightest drawn frame and 19:30 the warmest',
      ok7 ? `elevation ${a.elev.toFixed(3)} / ${b.elev.toFixed(3)} / ${c.elev.toFixed(3)}; mean luma ${a.luma.toFixed(1)} / ${b.luma.toFixed(1)} / ${c.luma.toFixed(1)}; red over blue ${a.warm.toFixed(2)} / ${b.warm.toFixed(2)} / ${c.warm.toFixed(2)}`
        : `${bad.join('; ')}${follows ? '' : `; drawn frames: luma ${seen.map((s) => s.luma.toFixed(1))}, red over blue ${seen.map((s) => s.warm.toFixed(2))}`}; page errors ${JSON.stringify(page.errors.slice(0, 2))}`)) return 0;

    // 8. the picture keeps drawing while the light changes under it
    const cellA: [number, number] = start;
    const cellB: [number, number] = [last[0], last[1]];
    const frame = (): Promise<number> => page.eval<number>('window.__game.game.loop.frame');
    // the e2e browser draws in software (a few frames a second), so "drawing" is: the counter moves by 3 within `ms`, polled; a stopped loop does not move at all
    const drew = async (ms = 10_000): Promise<[boolean, number]> => {
      const f0 = await frame();
      const t0 = Date.now();
      let f1 = f0;
      while (f1 - f0 < 3 && Date.now() - t0 < ms) {
        await sleep(100);
        f1 = await frame();
      }
      return [f1 - f0 >= 3, f1];
    };
    const put = (c: [number, number]): string => `(() => { const p = window.__painted, w = window.__game.world; const to = [p.x0 + ${c[0]}, p.y0 + ${c[1]}]; for (const s of [w.session, window.__game.session].filter(Boolean)) { s.pos = [to[0], to[1]]; if (s.state?.player) s.state.player.at = [to[0], to[1]]; } w.placePlayer(to[0], to[1]); return 1; })()`;
    const held = (kind: string): string => `(() => { const q = new URLSearchParams(window.location.search); q.set('held', '${kind}'); history.replaceState(null, '', window.location.pathname + '?' + q.toString()); return 1; })()`;
    // her idle frame is held still, so the same shadow texture is asked for again each time the same hour comes round (the case that broke the loop)
    await page.eval(`(() => { const w = window.__game.world; window.__painted.stepFigure = () => {}; w.player.setTexture('painted:figure_idle_down', 0).setFlipX(false); window.__clock = 5000; return 1; })()`);
    const errs0 = page.errors.filter((e) => !/favicon/.test(e)).length;
    const fails: string[] = [];
    const k = async (name: string, kind: string, lights: string, reps: number): Promise<void> => {
      await page.eval(held(kind));
      await page.eval(`window.__testlights = ${lights}`);
      for (let rep = 0; rep < reps; rep++) {
        for (const [night, cell] of [[true, cellA], [false, cellB], [true, cellA], [false, cellB]] as const) {
          await page.eval(`window.__painted.setMinuteFirstDay(${night ? 0 : 780})`);
          await page.eval(put(cell));
          if (night) await page.eval(`(() => { window.__game.world.lightLantern(); window.__game.ui?.closeAll?.(); return 1; })()`);
          await sleep(150);
          const [ok, f] = await drew();
          const bad = page.errors.filter((e) => !/favicon/.test(e)).length - errs0;
          if (!ok || bad > 0) {
            fails.push(`${name} repeat ${rep + 1}, ${night ? 'night' : '13:00'} at cell ${cell}: frame counter ${f}${ok ? '' : ' stopped'}, page errors ${bad}`);
            return;
          }
        }
      }
    };
    await k('K1 lantern', 'lantern', '[]', 5);
    await k('K2 torch', 'torch', '[]', 5);
    await k('K2 two lights', 'lantern', `[{ c: ${cellA[0] - 2}, r: ${cellA[1]}, kind: 'torch' }, { c: ${cellA[0] + 2}, r: ${cellA[1]}, kind: 'torch' }]`, 5);
    // K3: the clock goes through dusk and through dawn three minutes a frame, her lantern lit, while she walks between two cells on the held key
    await page.eval(held('lantern'));
    await page.eval(`window.__testlights = []`);
    await page.eval(`(() => { delete window.__painted.stepFigure; return 1; })()`);
    const sweeps: string[] = [];
    for (const [from, to, label] of [[960, 1320, 'dusk 16:00 to 22:00'], [180, 540, 'dawn 03:00 to 09:00']] as const) {
      await page.eval(`window.__painted.setMinuteFirstDay(${from})`);
      await page.eval(put(cellA));
      await page.eval(`(() => { const s = { m: ${from}, end: ${to}, done: false, frames: 0 }; window.__sweep = s; const tick = () => { if (s.done) return; s.m += 3; s.frames++; window.__painted.setMinuteFirstDay(s.m % 1440); if (s.frames % 20 === 0) window.__game.world.lightLantern(); if (s.m >= s.end) s.done = true; else requestAnimationFrame(tick); }; window.__game.world.lightLantern(); requestAnimationFrame(tick); return 1; })()`);
      const walk8 = new FreeWalk(page, false);
      let legs = 0;
      let lastF = await frame();
      const t1 = Date.now();
      while (!(await page.eval<boolean>('window.__sweep.done')) && Date.now() - t1 < 150_000) {
        await walk8.closeBox();
        await walk8.holdTo([painted.x0 + (legs % 2 === 0 ? cellB[0] : cellA[0]), painted.y0 + (legs % 2 === 0 ? cellB[1] : cellA[1])], `sweep leg ${legs}`, 8_000).catch(() => undefined);
        legs++;
        const f = await frame();
        if (f - lastF < 3) { fails.push(`K3 ${label}: the frame counter stopped at ${f} on leg ${legs}`); break; }
        lastF = f;
      }
      await walk8.release();
      if (!(await page.eval<boolean>('window.__sweep.done'))) fails.push(`K3 ${label}: the clock sweep did not reach its end in 150 s`);
      const [ok, f] = await drew();
      const bad = page.errors.filter((e) => !/favicon/.test(e)).length - errs0;
      if (!ok || bad > 0) fails.push(`K3 ${label}: frame counter ${f}${ok ? '' : ' stopped'}, page errors ${bad}`);
      sweeps.push(`${label} ${legs} legs`);
    }
    const ok8 = fails.length === 0;
    done(ok8, 'the frame counter advances after every change of the light (night/day at two cells, lantern, torch, two standing lights, five repeats each) and through a clock sweep (three minutes a frame) of dusk and dawn with her walking, and the page throws nothing',
      ok8 ? `K1 lantern 5 x 4 changes, K2 torch 5 x 4 and two lights 5 x 4, K3 sweeps ${sweeps.join(', ')}: the counter advanced every time, 0 page errors`
        : `${fails.join('; ')}; page errors ${JSON.stringify(page.errors.slice(0, 2))}`);
    return 0;
  } catch (e) {
    done(false, 'the station ran', `${(e as Error).message}`);
    return 0;
  } finally {
    await browser.close();
    server.close();
  }
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.log(JSON.stringify({ n: 0, ok: false, bar: 'the engine rig ran', detail: String(e), ms: 0 }));
    process.exit(0);
  },
);
