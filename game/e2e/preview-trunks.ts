/**
 * The trunk bars of the free walk (valley lane, tracker #44, step H1w; the owner of 24.11, W1 W2 W10: the figure passes between the trees and never through a trunk, and is never drawn over a crown it stands behind).
 *
 *   [TRUNKS_N=20] [TRUNKS_SEED=7] [PREVIEW_MINUTE=780] tsx game/e2e/preview-trunks.ts BASE_URL PASSWORD OUT_DIR
 *
 * On a preview build of a land with trunk discs (scene.json `feet`): signs in, starts in the valley, then
 *  (b) for TRUNKS_N trunks drawn by the seed among those with a clear straight approach from the south (the tile there open, no other disc on the line), puts the feet 1.5 tiles south of the trunk on its
 *      own column and holds the way north for 2.5 s: the feet's distance to the disc's centre, every poll, must never fall under the disc's radius, and the figure must come to rest within half its
 *      body box's height plus 2 px of the disc's rim (the box's front edge stops at the trunk: it walked up to the trunk and stopped there);
 *  (c) for 3 trunks inside a wood (4 other trunks within 120 px), puts the feet just behind the trunk (north of its disc, under its crown) and takes the whole frame: the crown must cover the figure
 *      (looked at by eye: `trunk-behind-<i>.png` as the preview shows it, see-through on, and `trunk-behind-<i>-solid.png` with see-through off, where only the sort decides); the line says how the figure's
      depth sorts against the tree's piece (`under` or `OVER`), for information.
 The discs stand where the body's point stands, FOOT_DRAWN over the drawn feet and the painted trunk's foot (walking.ts trunkDiscsOf): every distance here is the body's point to a disc.
 * Prints one JSON line {bar:'trunks', n, held, passed, worst, behind:[...]}; exit 0 when it ran to the end.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Browser, type Page, sleep } from './cdp';
import { FreeWalk } from './walk';

/** half the body box's height (walking.ts BODY_BOX.h = 16, not imported: the rig runs in node without the game's kernel): a walk from the south stops with the feet this far past the disc's rim */
const HALF_H = 8;
/** walking.ts FOOT_DRAWN (not imported, as HALF_H): the discs stand where the body's point stands, half a tile (32 art px) over the drawn feet and the painted trunk's foot */
const FOOT_DRAWN = 32;
const view = (process.env.TRUNKS_VIEW ?? '1920x1080').split('x').map(Number);
const viewport = { width: view[0]!, height: view[1]!, mobile: false, scale: 1 };

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

type Disc = { x: number; y: number; r: number };

/** Puts the feet at art px (x, y): the session's tile first (the body follows the session's tile every frame), then the body inside that tile. */
async function put(page: Page, x: number, y: number): Promise<void> {
  const tx = Math.floor(x / 64);
  const ty = Math.floor(y / 64);
  await page.eval(`(() => { const s = window.__game.session; s.pos = [${tx}, ${ty}]; const st = s.state ?? s.st; if (st && st.player && st.player.at) st.player.at = [${tx}, ${ty}]; const b = window.__game.world.body; b.place([${tx}, ${ty}]); b.x = ${x}; b.y = ${y}; return 1; })()`);
  await sleep(1200);
  // the session settles on the tile's centre once more after a move: the feet are set again inside the same tile, and must hold there
  // the sprite is drawn where the body stands only when the body moves (world.ts drawBody): a body set by hand is drawn by hand, or the figure and the camera stay where the last walk left them
  await page.eval(`(() => { const w = window.__game.world, b = w.body; b.x = ${x}; b.y = ${y}; w.drawBody(); return 1; })()`);
  await sleep(400);
  const [fx, fy, sx, sy] = await page.eval<[number, number, number, number]>('(() => { const w = window.__game.world; return [w.body.x, w.body.y, w.player.x, w.player.y]; })()');
  if (Math.hypot(fx - x, fy - y) > 2) throw new Error(`the feet did not hold at ${x},${y}: they stand at ${fx},${fy}`);
  // the sprite in world px (16 a tile) against the body in art px (64 a tile): drawBody puts its foot half a tile under the body's point
  if (Math.abs(sx - Math.round(fx) / 4) > 1 || Math.abs(sy - (Math.round(fy) / 4 + 8)) > 1) throw new Error(`the figure is drawn at ${sx},${sy}, not where the feet stand (${fx},${fy})`);
}

/** Where the figure's feet are on the screen, in CSS px. */
async function onScreen(page: Page): Promise<[number, number]> {
  return page.eval<[number, number]>(`(() => { const w = window.__game.world, c = w.cameras.main, p = w.player; return [(p.x - c.worldView.x) * c.zoom, (p.y - c.worldView.y) * c.zoom]; })()`);
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

async function main(): Promise<number> {
  const [base, password, outDir] = process.argv.slice(2) as [string, string, string];
  const n = Number(process.env.TRUNKS_N ?? 20);
  const minute = Number(process.env.PREVIEW_MINUTE ?? 780);
  mkdirSync(outDir, { recursive: true });
  const browser = await Browser.launch();
  try {
    const page = await browser.newPage(viewport);
    await signIn(page, base, password);
    await toTheValley(page, base);
    await page.waitFor('window.__painted.litMinute >= 0', 'the first light pass', 120_000);
    await page.eval(`window.__painted.setMinute(${minute})`);
    await sleep(1500);
    const walk = new FreeWalk(page, false);
    await (walk as unknown as { install(): Promise<void> }).install();
    const discs = await page.eval<Disc[]>('window.__painted.trunkDiscs.map((d) => ({ x: d.x, y: d.y, r: d.r }))');
    const open = async (tx: number, ty: number) => page.eval<boolean>(`(() => { try { return !!window.__walk.open(${tx}, ${ty}); } catch (e) { return false; } })()`);
    // (b) trunks with a clear straight approach from the south
    const clear: Disc[] = [];
    for (const d of discs) {
      const sy = d.y + 96;
      // every cell the body's box crosses from the start up to the disc's rim is open: a trunk whose own cell the walk refuses (a snag on a rock) stops the walk at the cell, not at the disc
      let free = true;
      for (let y = d.y + d.r; y <= sy + HALF_H && free; y += 16) for (const x of [d.x - 14, d.x + 14]) if (free && !(await open(Math.floor(x / 64), Math.floor(y / 64)))) free = false;
      if (!free) continue;
      if (discs.some((e) => e !== d && Math.abs(e.x - d.x) < e.r + 8 && e.y > d.y - 4 && e.y < sy + e.r + 8)) continue;
      clear.push(d);
    }
    const draw = rng(Number(process.env.TRUNKS_SEED ?? 7));
    const pool = [...clear];
    const picked: Disc[] = [];
    while (picked.length < n && pool.length) picked.push(pool.splice(Math.floor(draw() * pool.length), 1)[0]!);
    const steer = (walk as unknown as { steer(ax: number, ay: number): Promise<void>; release(): Promise<void> });
    const rows: { x: number; y: number; r: number; min: number; rest: number; ok: boolean }[] = [];
    for (const d of picked) {
      await put(page, d.x, d.y + 96);
      let min = Infinity;
      const end = Date.now() + 2500;
      await steer.steer(0, -1);
      while (Date.now() < end) {
        const [fx, fy] = await walk.feet();
        min = Math.min(min, Math.hypot(fx - d.x, fy - d.y));
        await sleep(40);
      }
      await steer.release();
      await sleep(200);
      const [fx, fy] = await walk.feet();
      const rest = Math.hypot(fx - d.x, fy - d.y);
      rows.push({ x: Math.round(d.x), y: Math.round(d.y), r: d.r, min: +min.toFixed(1), rest: +rest.toFixed(1), ok: min >= d.r && rest <= d.r + HALF_H + 2 });
      // the first three come to rest on a frame too: the drawn feet against the painted trunk, judged by eye
      if (rows.length <= 3) await page.screenshot(join(outDir, `trunk-front-${rows.length - 1}.png`));
    }
    // (c) behind a trunk inside a wood: the crown must be drawn over the figure
    const wood = discs.filter((d) => discs.filter((e) => e !== d && Math.hypot(e.x - d.x, e.y - d.y) < 120).length >= 4);
    const behind: { x: number; y: number; behind: boolean | string; shot: string; screen: [number, number] }[] = [];
    for (const d of wood) {
      if (behind.length >= 3) break;
      const by = d.y - d.r - 6;
      if (!(await open(Math.floor(d.x / 64), Math.floor(by / 64)))) continue;
      if (discs.some((e) => e !== d && Math.hypot(e.x - d.x, e.y - by) < e.r + 4)) continue;
      await put(page, d.x, by);
      // the figure's depth against the tree piece whose foot is this trunk (painted's own list of drawn pieces, see painted.ts debug lists)
      const sorted = await page.eval<boolean | string>(`(() => { try { const p = window.__painted; const fig = window.__game.world.player; const ox = p.x0 * 64, oy = p.y0 * 64; let best = null; p.sprites.forEach((spr, k) => { const o = p.spriteObj[k]; if (!o || o.fx == null) return; const dd = Math.hypot(ox + o.fx - ${d.x}, oy + o.fy - ${d.y + FOOT_DRAWN}); if (!best || dd < best[0]) best = [dd, spr, o]; }); if (!best) return 'none'; const what = best[2].kind + ' ' + best[2].i + ' (foot ' + best[0].toFixed(0) + ' px from the disc), figure depth ' + fig.depth.toFixed(2) + ', piece ' + best[1].depth.toFixed(2); return fig.depth < best[1].depth ? 'under ' + what : 'OVER ' + what; } catch (e) { return String(e); } })()`);
      const shot = join(outDir, `trunk-behind-${behind.length}.png`);
      await page.screenshot(shot);
      // the same place with see-through off (the engine's own default; the preview turns it on): only the sort decides what covers her
      await page.eval('(() => { window.__painted.seeThrough = false; return 1; })()');
      await sleep(700);
      await page.screenshot(join(outDir, `trunk-behind-${behind.length}-solid.png`));
      await page.eval('(() => { window.__painted.seeThrough = true; return 1; })()');
      behind.push({ x: Math.round(d.x), y: Math.round(d.y), behind: sorted, shot, screen: await onScreen(page) });
    }
    const out = { bar: 'trunks', discs: discs.length, clear: clear.length, n: rows.length, passed: rows.filter((r) => r.ok).length, worst: rows.filter((r) => !r.ok).concat(rows).slice(0, 5), behind, errors: page.errors.filter((e) => !/favicon/.test(e)).slice(0, 3) };
    writeFileSync(join(outDir, 'trunks.json'), JSON.stringify({ ...out, rows }, null, 1));
    console.log(JSON.stringify(out));
    return 0;
  } finally {
    browser.close();
  }
}

main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
