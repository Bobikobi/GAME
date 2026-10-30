/**
 * Proves the phone's landscape layout in a real browser (the owner, 30.10: landscape play with a floating stick and
 * buttons in the Wild Rift grammar). A phone on its side, 800 by 360 CSS px: the body wears `landscape`, the portrait
 * pad is gone, the HUD stands in one band along the top and clear of every button, every button keeps its floor
 * (A 60 px, B and Sneak 48, the column 44: Wild Rift's size and density, the owner through the manager, 30.10)
 * and in the right half, no two overlap, nothing reads under 12 px; a thumb landing in the left half raises the
 * stick at that point (a ring of 96 px or more), its push walks the player, its lift lets the stick fade and the
 * walk stop; the column's Menu opens the menu (a window covers the buttons, as in portrait, so B arrives as the controls' press). Every check waits on a condition, never on a fixed time.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, type Page } from './cdp';
import { TAKE_GROUND, carveIn, seedQuery } from './wakes';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(GAME_DIR, 'dist');
const OUT = resolve(process.argv[2] ?? join(GAME_DIR, '..', '.scratch', 'e2e'));
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

const W = 800;
const H = 360;

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
      const address = server.address();
      ok({ server, url: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/` });
    });
  });
}

/** The layout as the page draws it: every shown button's box, the band's bottom, and the smallest text. */
const LAYOUT = `(() => {
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const buttons = [...document.querySelectorAll('.touch .tbtn')].filter((b) => b.getBoundingClientRect().width > 0)
    .map((b) => ({ name: b.className.replace(' down', ''), ...box(b) }));
  let band = 0;
  const hud = [];
  for (const el of document.querySelectorAll('.top > .hud, .top > .tracker, .hud .btn, .hud .chip, .hud .meter')) { const r = el.getBoundingClientRect(); if (r.height > 0 && !el.matches('.top > .hud')) hud.push({ name: el.className, ...box(el) }); if (r.height > 0 && el.matches('.top > .hud, .top > .tracker')) band = Math.max(band, r.bottom); }
  let smallest = 99, where = '';
  for (const el of document.querySelectorAll('.top *, .touch *')) {
    if (!el.getBoundingClientRect().width || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < smallest) { smallest = size; where = el.className || el.tagName; }
  }
  return { landscape: document.body.classList.contains('landscape'), pad: box(document.querySelector('.pad')), buttons, hud, band, smallest, where };
})()`;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The buttons are round: two overlap when their centers are nearer than their two radii. */
const overlap = (a: Box, b: Box) => Math.hypot(a.x + a.w / 2 - (b.x + b.w / 2), a.y + a.h / 2 - (b.y + b.h / 2)) < (a.w + b.w) / 2;

async function start(page: Page): Promise<void> {
  await page.tap('.title-screen button', 'New game');
  const choice = await page.waitFor<string>(
    `document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
    'the race cards',
  );
  if (choice === 'ask') await page.tap('.title-screen button', 'Start a new game');
  await page.tap('.card.race', 'Elf');
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor('!!window.__game.session && window.__game.session.started', 'the character to wake', 10_000);
  await page.eval(carveIn('Tess'));
  await page.eval(TAKE_GROUND);
  // the waking lines: A reads them to their end
  for (let i = 0; i < 12; i++) {
    if (!(await page.eval<boolean>(`!!document.querySelector('#ui > .layer')`))) break;
    await page.tap('.tbtn.a');
    await page.waitFor(`true`, 'a frame');
  }
  await page.waitFor(`!document.querySelector('#ui > .layer')`, 'the waking lines to close', 15_000);
}

async function main(): Promise<void> {
  const remote = process.env.E2E_URL;
  if (!remote && !existsSync(join(DIST, 'index.html'))) throw new Error('no game/dist: run "pnpm build" first');
  mkdirSync(OUT, { recursive: true });
  const local = remote ? null : await serve();
  const browser = await Browser.launch();
  const page = await browser.newPage({ width: W, height: H, mobile: true });
  try {
    await page.goto(`${remote ?? local?.url ?? ''}?debug&rich=none${seedQuery('core/west-bank')}`);
    await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
    await start(page);

    const seen = await page.eval<{ landscape: boolean; pad: Box; buttons: (Box & { name: string })[]; hud: (Box & { name: string })[]; band: number; smallest: number; where: string }>(LAYOUT);
    if (!seen.landscape) throw new Error('the body does not wear "landscape" on a phone on its side');
    if (seen.pad.w !== 0) throw new Error('the portrait pad still shows in landscape');
    const names = seen.buttons.map((b) => b.name);
    for (const want of ['tbtn a', 'tbtn b', 'tbtn sneak', 'tbtn nav menu']) if (!names.includes(want)) throw new Error(`no ${want} in landscape: ${names.join(', ')}`);
    for (const b of seen.buttons) {
      const floor = b.name.includes('tbtn a') ? 60 : b.name.includes('nav') ? 44 : 48;
      if (b.w < floor || b.h < floor) throw new Error(`${b.name} is ${b.w}x${b.h}, under ${floor} px`);
      if (b.x < W / 2 || b.x + b.w > W || b.y + b.h > H) throw new Error(`${b.name} stands outside the right half of the screen`);
      // the column climbs beside the tracker's row, so the band is held to the boxes the HUD draws, not its row's bottom
      for (const part of seen.hud) {
        const hit = b.x < part.x + part.w && part.x < b.x + b.w && b.y < part.y + part.h && part.y < b.y + b.h;
        if (hit) throw new Error(`${b.name} overlaps the HUD's ${part.name}`);
      }
    }
    for (const [i, a] of seen.buttons.entries()) for (const b of seen.buttons.slice(i + 1)) if (overlap(a, b)) throw new Error(`${a.name} overlaps ${b.name}`);
    if (seen.smallest < 12) throw new Error(`${seen.where} reads at ${seen.smallest} px, under 12`);
    console.log(`landscape: ${seen.buttons.length} buttons, the band to ${Math.round(seen.band)} px, the smallest text ${seen.smallest} px`);

    // a thumb lands in the left half, below the band: the stick rises there and its push walks
    const at = { x: 170, y: Math.round((seen.band + H) / 2) + 20 };
    const from = await page.eval<number[]>(`[...__game.session.pos]`);
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...at, id: 1 }] });
    const ring = await page.waitFor<Box>(
      `(() => { const s = document.querySelector('.stick'); if (!s.classList.contains('on')) return null; const r = s.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`,
      'the stick to rise under the thumb',
      5000,
    );
    if (ring.w < 96) throw new Error(`the stick's ring is ${ring.w} px, under 96`);
    if (Math.abs(ring.x + ring.w / 2 - at.x) > 1 || Math.abs(ring.y + ring.h / 2 - at.y) > 1) throw new Error(`the stick rose at ${ring.x + ring.w / 2},${ring.y + ring.h / 2}, not under the thumb at ${at.x},${at.y}`);
    const still = await page.eval<[number, number]>(`__game.controls.vector()`);
    if (still[0] !== 0 || still[1] !== 0) throw new Error(`the stick walks where the thumb landed: ${still.join(',')}`);
    // the push: try the four ways until one is open from the wake
    let walked = '';
    for (const [dx, dy, way] of [[1, 0, 'right'], [0, 1, 'down'], [-1, 0, 'left'], [0, -1, 'up']] as const) {
      await page.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: at.x + dx * 60, y: at.y + dy * 60, id: 1 }] });
      const v = await page.eval<[number, number]>(`__game.controls.vector()`);
      if (Math.abs(v[0] - dx) > 1e-9 || Math.abs(v[1] - dy) > 1e-9) throw new Error(`a push ${way} of 60 px reads ${v.join(',')}, not full speed ${way}`);
      const moved = await page
        .waitFor<boolean>(`(() => { const p = __game.session.pos; return p[0] !== ${from[0]} || p[1] !== ${from[1]}; })()`, `a walk ${way}`, 2500)
        .catch(() => false);
      if (moved) {
        walked = way;
        break;
      }
    }
    if (!walked) throw new Error('a push of the floating stick walked nowhere');
    await page.screenshot(join(OUT, 'landscape-walk.png'));
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitFor(`!document.querySelector('.stick').classList.contains('on') && __game.controls.vector()[0] === 0 && __game.controls.vector()[1] === 0`, 'the stick to let go', 5000);
    console.log(`landscape: the stick rose under the thumb (${ring.w} px), walked ${walked} and let go`);

    // the column's Menu opens the menu, B closes it
    await page.tap('.tbtn.menu');
    await page.waitFor(`!!document.querySelector('#ui > .layer')`, 'the menu to open', 5000);
    // a window covers the buttons (as in portrait), so B arrives as the controls' press
    await page.eval(`__game.controls.press('b')`);
    await page.waitFor(`!document.querySelector('#ui > .layer')`, 'B to close the menu', 5000);
    console.log("landscape: the column's Menu opens the menu, B closes it");

    if (page.errors.length > 0) throw new Error(`page errors:\n${page.errors.join('\n')}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    await page.screenshot(join(OUT, 'landscape-failed.png')).catch(() => undefined);
    throw err;
  } finally {
    page.close();
    await browser.close();
    local?.server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
