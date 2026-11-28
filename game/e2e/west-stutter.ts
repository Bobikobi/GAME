/**
 * The west walk's stutter measurement (#885): a phone-sized browser, the game woken on the west bank, the figure walked round
 * the west of the valley for a fixed time with the CPU slowed, every requestAnimationFrame interval kept (with the feet's tile)
 * and the long tasks. It measures; it never fails the run (the bar is read from the line it prints).
 *
 *   pnpm --filter game build && [WALK_SECS=60] [WALK_CPU=4] [WALK_PROFILE=1] [WALK_DIST=path] tsx game/e2e/west-stutter.ts [out-dir]
 *
 * Prints one JSON line: {cpu, secs, n, mean, p95, over50, over20, max, longtasks, worst:[{ms, at_s, tile}]}. WALK_PROFILE=1 writes a
 * CPU profile of the window beside it (west-stutter-cpuN.cpuprofile), WALK_FIRST="x,y" walks to that tile first.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep, type Page } from './cdp';
import { serve, START, wake } from './frame-probe';
import { PHONE } from './viewports';
import { FreeWalk } from './walk';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(process.env.WALK_DIST ?? join(GAME_DIR, 'dist'));
const OUT = resolve(process.argv[2] ?? join(GAME_DIR, '..', '.scratch', 'west-stutter'));

/** The lap: down the west bank beside the river, across the meadow and back up, by turning points (a route between two is found by the engine's own rule; the river keeps the east side out of reach). */
const LAP: [number, number][] = [[11, 8], [11, 26], [5, 26], [5, 8]];

/** The route from the feet's tile to `goal` over open tiles (four ways, the engine's own rule), as the tiles where it turns. */
const ROUTE = (goal: [number, number]): string => `(() => {
  const w = window.__walk, W = 64, H = 64;
  const b = window.__game.world.body, from = [Math.floor(b.x / 64), Math.floor(b.y / 64)];
  const key = (x, y) => y * W + x, prev = new Map([[key(from[0], from[1]), -1]]), q = [from];
  let hit = null;
  for (let i = 0; i < q.length && !hit; i++) {
    const [x, y] = q[i];
    if (x === ${goal[0]} && y === ${goal[1]}) { hit = [x, y]; break; }
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(key(nx, ny))) continue;
      let ok = false; try { ok = !!w.open(nx, ny); } catch (e) { ok = false; }
      if (!ok) continue;
      prev.set(key(nx, ny), key(x, y)); q.push([nx, ny]);
    }
  }
  if (!hit) return null;
  const path = []; for (let k = key(hit[0], hit[1]); k !== -1; k = prev.get(k)) path.unshift([k % W, Math.floor(k / W)]);
  const stops = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], c = path[i], n = path[i + 1];
    if (!n || n[0] - c[0] !== c[0] - a[0] || n[1] - c[1] !== c[1] - a[1]) stops.push(c);
  }
  return stops;
})()`;

/** Walks to `tile` over the engine's own route, stop by stop; false when the route is not found or a stop times out. */
async function go(page: Page, walk: FreeWalk, tile: [number, number]): Promise<boolean> {
  const stops = await page.eval<[number, number][] | null>(ROUTE(tile));
  if (!stops) {
    const at = await page.eval<string>(`(() => { const b = window.__game.world.body; return Math.floor(b.x / 64) + ',' + Math.floor(b.y / 64); })()`);
    console.error(`no route from ${at} to ${tile.join(',')}`);
    return false;
  }
  for (const stop of stops) {
    try {
      await walk.holdTo(stop, `stop ${stop.join(',')}`, 15_000);
    } catch (e) {
      console.error(`stop ${stop.join(',')} on the way to ${tile.join(',')}: ${String(e).slice(0, 90)}`);
      return false;
    }
  }
  return true;
}

async function main(): Promise<void> {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error(`no ${DIST}/index.html: run "pnpm --filter game build" first`);
  mkdirSync(OUT, { recursive: true });
  const secs = Number(process.env.WALK_SECS ?? 60);
  const cpu = Number(process.env.WALK_CPU ?? 4);
  const profile = process.env.WALK_PROFILE === '1';
  const local = await serve(DIST);
  const browser = await Browser.launch();
  try {
    const page = await browser.newPage(PHONE);
    await wake(page, local.url);
    await sleep(1500);
    const walk = new FreeWalk(page, false);
    await (walk as unknown as { install(): Promise<void> }).install();
    // the walk starts at the lap's first tile, as a player who has gone there
    if (!(await go(page, walk, LAP[0]!))) {
      const info = await page.eval<string>(`(() => { const w = window.__walk, b = window.__game.world.body; return JSON.stringify({ tile: [Math.floor(b.x / 64), Math.floor(b.y / 64)], open: [[11, 14], [11, 16], [10, 14], [12, 15]].map(([x, y]) => w.open(x, y)) }); })()`);
      throw new Error(`no route to the lap start: ${info}`);
    }
    const first = (process.env.WALK_FIRST ?? '').split(',').map(Number);
    if (first.length === 2 && first.every(Number.isFinite)) await go(page, walk, [first[0]!, first[1]!]);
    await sleep(1500);
    if (cpu > 1) await page.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    if (profile) {
      await page.send('Profiler.enable');
      await page.send('Profiler.setSamplingInterval', { interval: 250 });
      await page.send('Profiler.start');
    }
    await page.eval(START);
    const t0 = Date.now();
    let k = 1;
    let stuck = 0;
    while (Date.now() - t0 < secs * 1000) {
      if (!(await go(page, walk, LAP[k % LAP.length]!))) {
        stuck += 1;
        if (stuck > 10) break;
      }
      k += 1;
    }
    const r = await page.eval<{ t: number[]; at: number[]; tile: [number, number][]; long: [number, number][]; bake: [string, number, number][] }>(`(() => { window.__stutterStop = 1; const S = window.__stutter; return { t: S.t, at: S.at, tile: S.tile, long: S.long, bake: S.bake }; })()`);
    if (profile) {
      const pr = (await page.send('Profiler.stop')) as { profile: unknown };
      writeFileSync(join(OUT, `west-stutter-cpu${cpu}.cpuprofile`), JSON.stringify(pr.profile));
    }
    if (cpu > 1) await page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const t = r.t.slice(1);
    const sorted = [...t].sort((a, b) => a - b);
    const worst = t
      .map((v, i) => [v, i] as const)
      .sort((a, b) => b[0] - a[0])
      .slice(0, 12)
      .map(([v, i]) => ({ ms: Math.round(v), at_s: +(r.at[i + 1]! / 1000).toFixed(1), tile: r.tile[i + 1]! }));
    const strips = r.bake.filter((b) => b[0] === 'bakeUnit').map((b) => b[2]);
    const uploads = r.bake.filter((b) => b[0] === 'upload').map((b) => b[2]);
    const sum = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0));
    const out = {
      cpu,
      secs: +((r.at[r.at.length - 1] ?? 0) / 1000).toFixed(1),
      n: t.length,
      mean: +(t.reduce((a, b) => a + b, 0) / Math.max(t.length, 1)).toFixed(2),
      p95: +(sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(1),
      over50: t.filter((v) => v > 50).length,
      over20: t.filter((v) => v > 20).length,
      max: +(sorted[sorted.length - 1] ?? 0).toFixed(1),
      longtasks: r.long.length,
      strips: { n: strips.length, sum_ms: sum(strips), over20: strips.filter((v) => v > 20).length, over50: strips.filter((v) => v > 50).length, max: Math.max(0, ...strips) },
      uploads: { n: uploads.length, sum_ms: sum(uploads), over20: uploads.filter((v) => v > 20).length, max: Math.max(0, ...uploads) },
      stuck,
      worst,
      errors: page.errors.filter((e) => !/favicon/.test(e)).slice(0, 3),
    };
    const name = process.env.WALK_NAME ?? `cpu${cpu}`;
    writeFileSync(join(OUT, `west-stutter-${name}.json`), JSON.stringify({ ...out, frames: r.t.map((v) => +v.toFixed(1)), at: r.at.map((v) => Math.round(v)), tile: r.tile, long: r.long, bake: r.bake }));
    console.log(JSON.stringify(out));
  } finally {
    await browser.close();
    local.server.close();
  }
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
