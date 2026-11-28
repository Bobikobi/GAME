/**
 * The meadow's frames (private #44 step A): from a preview build, whole 1920 x 1080 frames of the meadow with everything but the wind held, to measure the grass pass (painted-grass.ts) against its bars.
 *
 *   [GR_MINUTE=780] [GR_SECS=6] tsx game/e2e/preview-grass.ts BASE_URL PASSWORD OUT_DIR SEAM_COL,ROW [SCENE_X,SCENE_Y]
 *
 * Signs in, walks out into the block, hides the figure and the page's overlays, sets the hour and looks at the scene point. Then, in OUT_DIR: map.png (hold=grassmap: the pass's mask, white on black),
 * nomeadow.png (hold=nomeadow: the pass taken off, the old picture), rest.png and rest2.png (the pass with wind and grass held: amp 0), and w00..wNN.png, a frame every ~0.5 s with the gust running.
 * The private meadow bars read them. Prints INFO (how many ground units hold the pass) and one JSON line {bar:'grassrig'}.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Browser, type Page, sleep } from './cdp';
import { FreeWalk } from './walk';

const viewport = { width: 1920, height: 1080, mobile: false, scale: 1 };

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

// the shadows are held off: a cast shadow lies over the ground unshifted, so it would darken the mask's white and break the shift-only reading of a frame
const HOLD = 'clock,water,air,fog,shadow';
async function main(): Promise<number> {
  const [base, password, outDir, seamArg, atArg] = process.argv.slice(2) as [string, string, string, string, string];
  const [, c1] = (seamArg ?? '0,0').split(',').map(Number) as [number, number];
  const [px, py] = (atArg ?? '1300,650').split(',').map(Number) as [number, number];
  const minute = Number(process.env.GR_MINUTE ?? 780);
  const secs = Number(process.env.GR_SECS ?? 6);
  mkdirSync(outDir, { recursive: true });
  const browser = await Browser.launch();
  try {
    const page = await browser.newPage(viewport);
    await signIn(page, base, password);
    await toTheValley(page, base);
    await page.waitFor('window.__painted.litMinute >= 0', 'the valley\'s light', 120_000);
    await sleep(2500);
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
    for (const [tx, ty] of stops) await walk.holdTo([tx, ty], `tile ${tx},${ty}`, 30_000);
    await page.eval(`(window.__painted.setHold('${HOLD},wind,covers,grass'), window.__game.world.player.setVisible(false), 1)`);
    await page.eval(`(() => { const st = document.createElement('style'); st.textContent = 'body > *:not(#game):not(canvas):not(script) { visibility: hidden !important; } .title-screen, .dialog, .story-box, .hud, #hud, #ui { visibility: hidden !important; }'; document.head.appendChild(st); return 1; })()`);
    await page.eval(`(window.__painted.setMinute(${minute}), 1)`);
    await page.waitFor(`Math.abs(window.__painted.litMinute - ${minute}) <= 3`, 'the light', 120_000);
    await page.eval(`(window.__painted.lookAt(${px}, ${py}), window.__painted.seekLook(5), 1)`);
    await sleep(800);
    await page.waitFor('window.__painted.deferredDone()', 'the work after the move', 120_000);
    await sleep(1200);
    const info = await page.eval<unknown>(`(() => { const p = window.__painted; return { units: p.grassUnits.size, withPass: [...p.grassUnits.values()].filter((g) => g.ctl).length, zoom: window.__game.world.cameras.main.zoom, scroll: [window.__game.world.cameras.main.scrollX, window.__game.world.cameras.main.scrollY] }; })()`);
    console.log('INFO', JSON.stringify(info));
    const shot = async (name: string, hold: string): Promise<void> => {
      await page.eval(`(window.__painted.setHold('${hold}'), 1)`);
      await sleep(350);
      await page.screenshot(join(outDir, name));
    };
    await shot('map.png', `${HOLD},wind,covers,grassamp0,grassmap`);
    await shot('nomeadow.png', `${HOLD},wind,covers,grass,nomeadow`);
    await shot('amp0.png', `${HOLD},wind,covers,grassamp0`);
    await shot('rest.png', `${HOLD},wind,covers,grass`);
    await shot('rest2.png', `${HOLD},wind,covers,grass`);
    // moving: the meadow's pass runs; the leaning pieces and the ground cover are held (wind, covers), so only the meadow can change; a frame every 500 ms
    await page.eval(`(window.__painted.setHold('${HOLD},wind,covers${process.env.GR_PASSOFF === '1' ? ',nomeadow' : ''}'), 1)`);
    // where the screen lies in the scene, and the game's clock at each moving frame: the private meadow bars replay the shader's shift from them (the meadow must lean with the table's wind)
    const geo = await page.eval<unknown>(`(() => { const c = window.__game.world.cameras.main; const p = window.__painted; const a = c.getWorldPoint(0, 0); const b = c.getWorldPoint(1920, 1080); return { x0: p.x0, y0: p.y0, a: [a.x, a.y], b: [b.x, b.y], zoom: c.zoom, units: [...p.grassUnits.entries()].map(([k, g]) => ({ key: k, x: g.im.x, y: g.im.y, w: g.im.displayWidth, h: g.im.displayHeight, at: g.ctl ? g.ctl.at : null, size: g.ctl ? g.ctl.size : null })) }; })()`);
    const times: number[] = [];
    const n = Math.round(secs * 2);
    for (let k = 0; k <= n; k++) {
      times.push(await page.eval<number>('performance.now()'));
      await page.screenshot(join(outDir, `w${String(k).padStart(2, '0')}.png`));
      await sleep(430);
    }
    writeFileSync(join(outDir, 'geo.json'), JSON.stringify({ geo, times }));
    if (process.env.GR_CLIP === '1') {
      // the clip: the meadow's clock is stepped by hand (a screenshot takes longer than a frame), everything else of the scene held, a frame per 1/fps of the gust
      const fps = Number(process.env.GR_CLIP_FPS ?? 20);
      const total = Math.round(Number(process.env.GR_CLIP_SECS ?? 13) * fps);
      const clipDir = join(outDir, 'clip');
      mkdirSync(clipDir, { recursive: true });
      await page.eval(`(window.__painted.setHold('clock,water,air,fog,wind,covers'), 1)`); // the shadows on, as the game shows them
      // the same view with the pass held off (the old picture, shadows on) to lay beside the clip's first frame
      await page.eval(`(window.__painted.setHold('clock,water,air,fog,wind,covers,grass'), 1)`);
      await sleep(400);
      await page.screenshot(join(outDir, 'clip-held.png'));
      await page.eval(`(window.__painted.setHold('clock,water,air,fog,wind,covers'), 1)`);
      for (let k = 0; k < total; k++) {
        await page.eval(`(window.__painted.grassClock = ${20 + k / fps}, 1)`);
        await sleep(90);
        await page.screenshot(join(clipDir, `c${String(k).padStart(4, '0')}.png`));
      }
      await page.eval('(window.__painted.grassClock = undefined, 1)');
      console.log(JSON.stringify({ bar: 'grassclip', frames: total, fps }));
    }
    console.log(JSON.stringify({ bar: 'grassrig', frames: n + 1, minute, at: [px, py] }));
    return 0;
  } finally {
    await browser.close();
  }
}
main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
