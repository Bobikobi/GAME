/**
 * The stills and the boot of the private preview (S1 of the smoothness steps, valley lane, tracker #44): the same frames of the painted world, taken from a build, to be compared with the same
 * frames from another build (0 changed pixels, or each difference named), and what the device pays to get there.
 *
 *   [PREVIEW_MINUTES=780,1050] [STILLS_CPU=1|4] [STILLS_FOG=1: the fog asked for on every hour (hold fogland), so the noise tile is in the frames] [E2E_GPU=1] tsx game/e2e/preview-stills.ts BASE_URL PASSWORD OUT_DIR
 *
 * Signs in, starts in the valley, walks out into the block and times the boot in the page's own clock: from the first frame the standing unit is lit (`lit`) to the end of everything the mount does after
 * first light (`done`, deferredDone()), with the main thread's task time over that stretch (CDP Performance TaskDuration, sampled every 100 ms). STILLS_CPU=4 slows the CPU 4x from before the page loads. Then, per minute, the moving
 * things are held (clock, wind, water, grass, air, fog; the water's and fog's own clock at 5 s) and the camera is set on fixed points of the scene (every unit's centre and each seam), waiting for
 * the mount's deferred work after each move; a PNG per still (844 x 390, scale 1) goes to OUT_DIR as m<minute>-p<k>.png. Prints one JSON line {bar:'stills', boot, shots}.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Browser, type Page, sleep } from './cdp';
import { FreeWalk } from './walk';

const viewport = { width: 844, height: 390, mobile: true, scale: 1 };

async function signIn(page: Page, base: string, password: string): Promise<void> {
  await page.goto(`${base}/`);
  await page.waitFor(`!!document.querySelector('form')`, 'the login page', 20_000);
  await page.eval(`(() => { const f = document.querySelector('form'); f.p.value = ${JSON.stringify(password)}; f.requestSubmit(); return true; })()`);
  await page.waitFor(`!document.querySelector('input[name=p]') && document.readyState === 'complete'`, 'the site after the password', 20_000);
}

async function toTheValley(page: Page, base: string): Promise<void> {
  await page.goto(`${base}/preview/?preview&debug&seed=7&hold=${process.env.STILLS_FOG === '1' ? 'clock,fogland' : 'clock'}`);
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

const MARKS = `(() => {
  const T = window.__boot = { base: performance.now() };
  const tick = () => {
    const p = window.__painted, n = performance.now();
    if (p) {
      T.mount ??= n;
      if (p.stream?.standingLit()) T.lit ??= n;
      if (T.lit !== undefined && p.deferredDone()) T.done ??= n;
    }
    if (T.done === undefined) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return 1;
})()`;

async function taskMs(page: Page): Promise<number> {
  const m = (await page.send('Performance.getMetrics')) as { metrics: { name: string; value: number }[] };
  return (m.metrics.find((x) => x.name === 'TaskDuration')?.value ?? 0) * 1000;
}

async function main(): Promise<number> {
  const [base, password, outDir, seamArg] = process.argv.slice(2) as [string, string, string, string];
  const [, c1] = (seamArg ?? '0,0').split(',').map(Number) as [number, number];
  const cpu = Number(process.env.STILLS_CPU ?? 1);
  const minutes = (process.env.PREVIEW_MINUTES ?? '780,1050').split(',').map(Number);
  mkdirSync(outDir, { recursive: true });
  const browser = await Browser.launch();
  try {
    const page = await browser.newPage(viewport);
    await page.send('Performance.enable');
    await signIn(page, base, password);
    if (cpu > 1) await page.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    // the page's marks are put in at the first moment the mount can be seen: the rig polls for the painted mount to appear, then reads the clock marks from the page
    await toTheValley(page, base);
    await page.waitFor('window.__painted.litMinute >= 0', 'the valley\'s light', 120_000);
    await sleep(2500);
    // the figure walks out of the valley into the block: the stream's standing unit is the first one lit there, and the boot's marks start with the walk's last step
    const walk = new FreeWalk(page, false);
    await (walk as unknown as { install(): Promise<void> }).install();
    const found = await page.eval<[number, number][] | { diag: string }>(ROUTE(c1 + 2));
    if (!Array.isArray(found)) throw new Error(String(found.diag));
    const stops: [number, number][] = [];
    for (let i = 1; i < found.length - 1; i++) {
      const [a, b, c] = [found[i - 1]!, found[i]!, found[i + 1]!];
      if (b[0] - a[0] !== c[0] - b[0] || b[1] - a[1] !== c[1] - b[1]) stops.push(b);
    }
    stops.push(found[found.length - 1]!);
    await page.eval(MARKS);
    // the main thread's task time is sampled every 100 ms beside the walk: it is read at the first frame the standing unit was seen lit and at the first frame the mount's work after it was done
    let tLit: number | undefined;
    let tDone: number | undefined;
    const sampler = setInterval(() => {
      void (async () => {
        try {
          const b = await page.eval<{ lit?: number; done?: number }>('window.__boot');
          const t = await taskMs(page);
          if (b.lit !== undefined && tLit === undefined) tLit = t;
          if (b.done !== undefined && tDone === undefined) tDone = t;
        } catch { /* a page busy with a step: the next sample */ }
      })();
    }, 100);
    for (const [tx, ty] of stops) await walk.holdTo([tx, ty], `tile ${tx},${ty}`, 30_000);
    try {
      await page.waitFor('window.__boot.done !== undefined', 'the mount\'s work after first light', 240_000);
    } catch (e) {
      console.log('DIAG', JSON.stringify(await page.eval(`(() => { const p = window.__painted, st = p.stream; return { litMinute: p.litMinute, body: [window.__game.world.body.x, window.__game.world.body.y], x0: p.x0, standingLit: st.standingLit(), settled: p.settled(), alphaQ: p.alphaQueue.length, shadeQ: p.shadeQueue.length, alphaJob: !!p.alphaJob, windJob: !!p.windJob, coverJob: !!p.coverJob, fogNoiseJob: !!p.fogNoiseJob, laterQ: p.laterQ.length, still: p.stillState, cover: p.coverState, fog: p.fogState, boot: window.__boot }; })()`)));
      throw e;
    }
    await sleep(400);
    clearInterval(sampler);
    const boot = await page.eval<{ lit: number; done: number }>('window.__boot');
    if (cpu > 1) await page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const x = (v: number): number => Math.round(v);
    const bootOut = { cpu, doneAfterLightMs: x(boot.done - boot.lit), taskLightToDoneMs: tLit !== undefined && tDone !== undefined ? x(tDone - tLit) : null };
    // the stills
    const scene = await page.eval<{ w: number; h: number; cols: number; rows: number; uw: number; uh: number }>('(() => { const t = window.__painted.tiles, s = window.__painted.scene; return { w: s.width, h: s.height, cols: t.grid.cols, rows: t.grid.rows, uw: t.unit.w, uh: t.unit.h }; })()');
    const points: [number, number][] = [];
    for (let r = 0; r < scene.rows; r++) for (let c = 0; c < scene.cols; c++) points.push([c * scene.uw + scene.uw / 2, r * scene.uh + scene.uh / 2]);
    for (let r = 0; r < scene.rows; r++) for (let c = 1; c < scene.cols; c++) points.push([c * scene.uw, r * scene.uh + scene.uh / 2]);
    for (let r = 1; r < scene.rows; r++) for (let c = 0; c < scene.cols; c++) points.push([c * scene.uw + scene.uw / 2, r * scene.uh]);
    await page.eval(`(window.__painted.setHold('clock,wind,water,grass,air,fog${process.env.STILLS_FOG === '1' ? ',fogland' : ''}'), window.__painted.seekLook(5), window.__game.world.player.setVisible(false), 1)`);
    // the valley's own hours have no fog (river table): with STILLS_FOG the table's rows are given the bone moor's thickness so the fog's noise tile is in the frames
    if (process.env.STILLS_FOG === '1') await page.eval(`(window.__painted.rows.forEach((r) => { r.fog = { bottom: 0.14, top: 0.46 }; }), 1)`);
    // the dialog's blinking arrow and the HUD are not the world: the page's own overlays are hidden for the stills
    await page.eval(`(() => { const st = document.createElement('style'); st.textContent = 'body > *:not(#game):not(canvas):not(script) { visibility: hidden !important; } .title-screen, .dialog, .story-box, .hud, #hud, #ui { visibility: hidden !important; }'; document.head.appendChild(st); return 1; })()`);
    let shots = 0;
    for (const m of minutes) {
      await page.eval(`window.__painted.setMinute(${m})`);
      await page.waitFor(`Math.abs(window.__painted.litMinute - ${m}) <= 3`, `the light at minute ${m}`, 120_000);
      for (const [k, [px, py]] of points.entries()) {
        await page.eval(`(window.__painted.lookAt(${px}, ${py}), window.__painted.seekLook(5), 1)`);
        await sleep(600);
        await page.waitFor('window.__painted.deferredDone()', 'the work after the move', 120_000);
        await page.eval('(window.__painted.seekLook(5), 1)');
        await sleep(500);
        await page.screenshot(join(outDir, `m${m}-p${k}.png`));
        shots += 1;
      }
    }
    const fogSeen = await page.eval<unknown>('(() => { const p = window.__painted; return { state: p.fogState, of: p.fogOf, quads: [...p.fogUnits.values()].filter((u) => u.quad).length }; })()');
    console.log(JSON.stringify({ bar: 'stills', boot: bootOut, fog: fogSeen, shots, points: points.length, minutes }));
    return 0;
  } finally {
    await browser.close();
  }
}
main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
