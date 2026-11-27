/**
 * The stutter bars of the private preview (valley lane, tracker #44): a scripted walk of a fixed length through the seams, on the preview as the owner's phone gets it.
 *
 *   [PREVIEW_MINUTE=780] [STUTTER_SECS=60] [STUTTER_CPU=1|4] [STUTTER_PROFILE=1: a CPU profile of the window beside the json] [E2E_GPU=1] tsx game/e2e/preview-stutter.ts BASE_URL PASSWORD OUT_DIR SEAM_C0,SEAM_C1
 *
 * Signs in, starts in the valley, then (the clock of the walk starts here) the figure walks out by the east lane into the block and shuttles across the seam's span, a tile at a time by the
 * engine's own `canWalk`, until STUTTER_SECS have passed. Every requestAnimationFrame interval over the whole window is kept: the frame p95, the count over 50 ms, the longest frame, and the ten
 * worst with the second they fell at and where the feet stood (so a spike can be matched to the unit the figure entered). STUTTER_CPU=4 puts the CPU 4x slower for the window (the load is not slowed).
 * Prints one JSON line: {bar:'stutter', cpu, secs, n, mean, p95, over50, max, worst:[...], errors}. Exit 0 when it ran to the end.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Browser, type Page, sleep } from './cdp';
import { FreeWalk, middleOf } from './walk';

const viewport = { width: 844, height: 390, mobile: true, scale: 1 };

async function signIn(page: Page, base: string, password: string): Promise<void> {
  await page.goto(`${base}/`);
  await page.waitFor(`!!document.querySelector('form')`, 'the login page', 20_000);
  await page.eval(`(() => { const f = document.querySelector('form'); f.p.value = ${JSON.stringify(password)}; f.requestSubmit(); return true; })()`);
  await page.waitFor(`!document.querySelector('input[name=p]') && document.readyState === 'complete'`, 'the site after the password', 20_000);
}

async function toTheValley(page: Page, base: string): Promise<void> {
  await page.goto(`${base}/preview/?preview&debug&seed=7&hold=clock`);
  await page.waitFor(`!!document.querySelector('.title-screen button') || !!window.__fail`, 'the title screen', 120_000);
  await page.tap('.title-screen button', 'New game');
  await page.waitFor(`!!document.querySelector('.card.race')`, 'the race cards', 30_000);
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor(`!!window.__game?.session && !!window.__painted`, 'the session and the painted mount', 90_000);
  for (let k = 0; k < 40; k++) {
    const up = await page.eval<number>(`(() => { const o = document.querySelector('.dialog-options button'); if (o) { o.click(); return 1; } const d = document.querySelector('.dialog, .story-box'); if (d) { d.click(); return 2; } return 0; })()`);
    if (up === 0) break;
    await sleep(350);
  }
}

/** The route from the feet's tile to the first tile at scene column `col` or beyond (four ways, the engine's own `canWalk`). */
const ROUTE = (col: number): string => `(() => {
  const p = window.__painted, w = window.__walk;
  const W = p.x0 + p.scene.cols + 2, H = 64, goalX = p.x0 + ${col};
  const b = window.__game.world.body, from = [Math.floor(b.x / 64), Math.floor(b.y / 64)];
  const key = (x, y) => y * W + x, prev = new Map([[key(from[0], from[1]), -1]]), q = [from];
  let hit = null;
  for (let i = 0; i < q.length && !hit; i++) {
    const [x, y] = q[i];
    if (x >= goalX) { hit = [x, y]; break; }
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(key(nx, ny))) continue;
      let ok = false; try { ok = !!w.open(nx, ny); } catch (e) { ok = false; }
      if (!ok) continue;
      prev.set(key(nx, ny), key(x, y)); q.push([nx, ny]);
    }
  }
  if (!hit) return { diag: 'no route, reached ' + prev.size + ' tiles' };
  const path = []; for (let k = key(hit[0], hit[1]); k !== -1; k = prev.get(k)) path.unshift([k % W, Math.floor(k / W)]);
  return path;
})()`;

/** Starts keeping every frame interval (with the time since the start and the feet's tile) and the long tasks, in the page. */
const START = `(() => {
  const S = window.__stutter = { t: [], at: [], tile: [], long: [], t0: performance.now() };
  let last = performance.now();
  const f = (now) => { if (window.__stutterStop) return; S.t.push(now - last); S.at.push(now - S.t0); const b = window.__game.world.body; S.tile.push([Math.floor(b.x / 64), Math.floor(b.y / 64)]); last = now; requestAnimationFrame(f); };
  requestAnimationFrame(f);
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) S.long.push([e.startTime - S.t0, e.duration]); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
  return 1;
})()`;

/**
 * Walks to `tile` as FreeWalk.holdTo does, but a body held still on its way (the feet move under 1 px in 400 ms: a trunk disc dead on the straight line) steps aside, square to its push and the other way
 * each time, for 300 ms, and goes on. The route is tiles and knows no trunk: a disc on its line is the rig's stop, not the game's frame, and a figure standing still gets the idle budget's longer slices
 * (painted.ts stepStanding), which the bar would count against the walk. Returns the steps aside it took; throws when `timeoutMs` passes.
 */
async function go(page: Page, walk: FreeWalk, tile: [number, number], timeoutMs: number): Promise<number> {
  const w = walk as unknown as { install(): Promise<void>; steer(ax: number, ay: number): Promise<void>; release(): Promise<void> };
  await w.install();
  await page.eval(`window.__walk.until([${tile[0]}, ${tile[1]}], false)`);
  const [tx, ty] = middleOf(tile);
  const span = (v: number, k: number) => v >= k * 64 && v < (k + 1) * 64;
  const end = Date.now() + timeoutMs;
  let last: [number, number] = [NaN, NaN];
  let since = Date.now();
  let side = 1;
  let aside = 0;
  try {
    for (;;) {
      const now = await page.eval<{ feet: [number, number]; tile: [number, number]; stop: boolean }>('window.__walk.now()');
      const [fx, fy] = now.feet;
      if (now.tile[0] === tile[0] && now.tile[1] === tile[1] && (await page.eval<boolean>('window.__walk.done()'))) return aside;
      if (now.stop) return aside;
      if (Date.now() > end) throw new Error(`walking to ${tile.join(',')} timed out: the feet stand at ${fx.toFixed(1)},${fy.toFixed(1)}`);
      const ax = span(fx, tile[0]) ? 0 : Math.sign(tx - fx);
      const ay = span(fy, tile[1]) ? 0 : Math.sign(ty - fy);
      if (Math.hypot(fx - last[0], fy - last[1]) >= 1) {
        last = [fx, fy];
        since = Date.now();
      } else if (Date.now() - since > 400 && (ax !== 0 || ay !== 0)) {
        await w.steer(ax !== 0 ? 0 : side, ax !== 0 ? side : 0);
        await sleep(300);
        side = -side;
        aside += 1;
        since = Date.now();
        continue;
      }
      if (ax !== 0 || ay !== 0) await w.steer(ax, ay);
      await sleep(25);
    }
  } finally {
    await w.release();
  }
}

async function main(): Promise<number> {
  const [base, password, outDir, seamArg] = process.argv.slice(2) as [string, string, string, string];
  const [c0, c1] = (seamArg ?? '0,0').split(',').map(Number) as [number, number];
  const secs = Number(process.env.STUTTER_SECS ?? 60);
  const cpu = Number(process.env.STUTTER_CPU ?? 1);
  const minute = Number(process.env.PREVIEW_MINUTE ?? 780);
  mkdirSync(outDir, { recursive: true });
  const browser = await Browser.launch();
  try {
    const page = await browser.newPage(viewport);
    await signIn(page, base, password);
    await toTheValley(page, base);
    await page.waitFor('window.__painted.litMinute >= 0', 'the first light pass', 120_000);
    await page.eval(`window.__painted.setMinute(${minute})`);
    await page.waitFor(`Math.abs(window.__painted.litMinute - ${minute}) <= 3`, `the light at minute ${minute}`, 120_000);
    await sleep(1500);
    const walk = new FreeWalk(page, false);
    await (walk as unknown as { install(): Promise<void> }).install();
    const x0 = await page.eval<number>('window.__painted.x0');
    const found = await page.eval<[number, number][] | { diag: string }>(ROUTE(c1 + 2));
    if (!Array.isArray(found)) { console.log(JSON.stringify({ bar: 'stutter', ok: false, detail: found.diag })); return 0; }
    const route = found;
    const stops: [number, number][] = [route[0]!];
    for (let i = 1; i < route.length - 1; i++) {
      const [a, b, c] = [route[i - 1]!, route[i]!, route[i + 1]!];
      const turn = b[0] - a[0] !== c[0] - b[0] || b[1] - a[1] !== c[1] - b[1];
      const inSeam = b[0] - x0 >= c0 - 1 && b[0] - x0 <= c1 + 1;
      if (turn || inSeam) stops.push(b);
    }
    stops.push(route[route.length - 1]!);
    // the shuttle: forward over the whole route, then back from the end to the first tile inside the scene, again and again
    const inScene = Math.max(1, stops.findIndex((s) => s[0] >= x0));
    const lap = [...stops.slice(1), ...stops.slice(inScene - 1, -1).reverse()];
    if (cpu > 1) await page.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    const profile = process.env.STUTTER_PROFILE === '1';
    if (profile) { await page.send('Profiler.enable'); await page.send('Profiler.setSamplingInterval', { interval: 250 }); await page.send('Profiler.start'); }
    // a probe: walk first to this tile (scene columns, rows), STUTTER_FIRST="-7,22", so two builds can be compared on the same ground
    const first = (process.env.STUTTER_FIRST ?? '').split(',').map(Number);
    if (first.length === 2 && first.every((n) => Number.isFinite(n))) lap.unshift([x0 + first[0]!, first[1]!]);
    await page.eval(START);
    // STUTTER_POOL=1: every request the renderer's context pool gets while walking (the size, and whether it was served from the pool, took the oldest one resized, or made a new framebuffer), beside the json as `pool`
    if (process.env.STUTTER_POOL === '1') await page.eval(`(() => { const p = window.__game.world.sys.game.renderer.drawingContextPool, g = p.get, L = window.__poolLog = []; p.get = function (w, h) { const key = w + 'x' + h, hit = !!(this.sizePool[key] && this.sizePool[key].length), n = this.agePool.length; const c = g.call(this, w, h); L.push([Math.round(performance.now() - window.__stutter.t0), key, hit ? 'hit' : (this.agePool.length < n ? 'resize' : 'new')]); return c; }; return 1; })()`);
    // a probe: put the feet on this tile first (scene columns, rows), STUTTER_AT="-5,22", where one build's route never takes the figure
    const at0 = (process.env.STUTTER_AT ?? '').split(',').map(Number);
    if (at0.length === 2 && at0.every((n) => Number.isFinite(n))) {
      console.log('placed: ' + (await page.eval<string>(`(() => { const t = [${x0 + at0[0]!}, ${at0[1]!}]; const s = window.__game.session; s.pos = [t[0], t[1]]; const st = s.state ?? s.st; if (st && st.player && st.player.at) st.player.at = [t[0], t[1]]; window.__game.world.body.place(t); return JSON.stringify({ kind: s.constructor.name, state: !!(st && st.player) }); })()`)));
      await sleep(3000);
    }
    const t0 = Date.now();
    let k = 0;
    let stuck = 0;
    let aside = 0;
    while (Date.now() - t0 < secs * 1000) {
      const [tx, ty] = lap[k % lap.length]!;
      k += 1;
      try { aside += await go(page, walk, [tx, ty], Number(process.env.STUTTER_HOLD_MS ?? 20_000)); } catch {
        stuck += 1;
        // say where the figure stands and which trunk disc is nearest: a stop that a disc holds is the rig's route, not the game's frame
        const at = await page.eval<string>(`(() => { const b = window.__game.world.body, ds = window.__painted.trunkDiscs; let best = null; for (const d of ds) { const r = Math.hypot(d.x - b.x, d.y - b.y) - d.r; if (!best || r < best[0]) best = [Math.round(r), Math.round(d.x), Math.round(d.y), d.r]; } return JSON.stringify({ feet: [Math.round(b.x), Math.round(b.y)], tile: [Math.floor(b.x / 64) - window.__painted.x0, Math.floor(b.y / 64)], nearestDisc: best, open4: [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy]) => { try { return !!window.__walk.open(Math.floor(b.x / 64) + dx, Math.floor(b.y / 64) + dy); } catch (e) { return 'err'; } }), vel: [window.__game.world.body.vx, window.__game.world.body.vy], x0: window.__painted.x0 }); })()`);
        console.log(`stuck going to tile ${tx - x0},${ty}: ${at}`);
        if (stuck > 12) break;
      }
    }
    const r = await page.eval<{ t: number[]; at: number[]; tile: [number, number][]; long: [number, number][]; cost?: Record<string, { n: number; max: number; sum: number }>; spikes?: [number, string, number][]; pool?: [number, string, string][] }>(`(() => { window.__stutterStop = 1; const S = window.__stutter; return { t: S.t, at: S.at, tile: S.tile, long: S.long, cost: window.__cost, spikes: (window.__spikes || []).map((s) => [s[0] - S.t0, s[1], s[2]]), pool: window.__poolLog }; })()`);
    if (profile) { const pr = (await page.send('Profiler.stop')) as { profile: unknown }; writeFileSync(join(outDir, `stutter-cpu${cpu}.cpuprofile`), JSON.stringify(pr.profile)); }
    if (cpu > 1) await page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const t = r.t.slice(1);
    const sorted = [...t].sort((a, b) => a - b);
    const idx = t.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]).slice(0, 10);
    const worst = idx.map(([v, i]) => ({ ms: Math.round(v), at_s: +(r.at[i + 1]! / 1000).toFixed(1), tile: r.tile[i + 1]!.map((c, j) => (j === 0 ? c - x0 : c)) }));
    const out = {
      bar: 'stutter', cpu, secs: +((r.at[r.at.length - 1] ?? 0) / 1000).toFixed(1), n: t.length, mean: +(t.reduce((a, b) => a + b, 0) / Math.max(t.length, 1)).toFixed(2),
      p95: +(sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(1), p99: +(sorted[Math.floor(sorted.length * 0.99)] ?? 0).toFixed(1), over50: t.filter((v) => v > 50).length, over20: t.filter((v) => v > 20).length, over33: t.filter((v) => v > 33.4).length,
      max: +(sorted[sorted.length - 1] ?? 0).toFixed(1), longtasks: r.long.length, longestTask: Math.round(Math.max(0, ...r.long.map((l) => l[1]))), stuck, aside, worst, cost: Object.fromEntries(Object.entries(r.cost ?? {}).map(([k, c]) => [k, { n: c.n, max: Math.round(c.max), sum: Math.round(c.sum) }])), errors: page.errors.filter((e) => !/favicon/.test(e)).slice(0, 3),
    };
    writeFileSync(join(outDir, `stutter-cpu${cpu}.json`), JSON.stringify({ ...out, frames: r.t.map((v) => +v.toFixed(1)), at: r.at.map((v) => Math.round(v)), tile: r.tile.map(([c, w]) => [c - x0, w]), long: r.long, spikes: r.spikes, pool: r.pool }));
    await page.screenshot(join(outDir, `stutter-cpu${cpu}-end.png`));
    console.log(JSON.stringify(out));
    return 0;
  } finally {
    await browser.close();
  }
}
main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
