/**
 * Proves the touch controls' side and size in a real browser (issue #562, Settings > Controls). A phone upright
 * (390 by 844 CSS px) and on its side (844 by 390), touch emulation on, the same page turned between the two. At each
 * view and for every side and size it reads the computed boxes of the stick (the pad upright, the stick zone and its
 * ring on its side), A, B, Sneak, the Bag / Journal / Menu column, and the HUD, and holds them to the bars:
 *
 * - K1 with nothing stored every box equals develop's (DEVELOP below, read from develop's own build);
 * - K2 with the stick on the right every control's box is its default box reflected about the vertical centre line
 *   (x' = width - x - w, same y, w, h), nothing overlaps another control or the HUD, the stick zone is the other half;
 * - K3 small, medium and large measure 0.85, 1 and 1.2 of medium (a 44 px floor), no touch target is under 44 px, and at
 *   large nothing leaves the screen or overlaps, on either side;
 * - K5 the Controls section's words read 16 px or more, and a choice made in the open Settings window moves the boxes
 *   at once with no reload and is kept.
 *
 * Every check waits on a condition, never on a fixed time. Not a still: the screenshots go to the out-dir (default
 * .scratch/e2e). `E2E_DUMP=<file>` measures only the default boxes and writes them as JSON: how DEVELOP was read.
 */
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
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

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
type Boxes = Record<string, Box>;
type Side = 'left' | 'right';
type Size = 'small' | 'medium' | 'large';
type ViewName = 'portrait' | 'landscape';

const VIEWS: { name: ViewName; width: number; height: number }[] = [
  { name: 'portrait', width: 390, height: 844 },
  { name: 'landscape', width: 844, height: 390 },
];
const SIDES: Side[] = ['left', 'right'];
const SCALE: Record<Size, number> = { small: 0.85, medium: 1, large: 1.2 };
const SIZES = Object.keys(SCALE) as Size[];
const SETTINGS_KEY = 'openfold.settings.1';
const FLOOR = 44;

/**
 * Develop's own boxes with nothing stored (K1), in CSS px, read from a build of develop's `game/src` (the branch's
 * source change reversed) by `E2E_DUMP=<file> tsx game/e2e/controls.ts` on 2026-11-14, at 390 x 844 and 844 x 390.
 * The stick's ring (landscape) is read for its size only (its place is wherever a thumb raises it, so x and y are 0 here).
 */
const DEVELOP: Record<ViewName, Boxes> = {
  portrait: {
    pad: { x: 14, y: 682, w: 148, h: 148 },
    a: { x: 308, y: 762, w: 68, h: 68 },
    b: { x: 238, y: 744, w: 56, h: 56 },
    sneak: { x: 315.03, y: 690, w: 60.97, h: 44 },
  },
  landscape: {
    zone: { x: 0, y: 0, w: 422, h: 390 },
    ring: { x: 0, y: 0, w: 101, h: 101 },
    a: { x: 733, y: 279, w: 74, h: 74 },
    b: { x: 671.5, y: 290.5, w: 51, h: 51 },
    sneak: { x: 697.5, y: 234.5, w: 51, h: 51 },
    bag: { x: 795, y: 182, w: 44, h: 44 },
    journal: { x: 795, y: 129, w: 44, h: 44 },
    menu: { x: 795, y: 77, w: 44, h: 44 },
  },
};

/** In the page: the controls' boxes, as many as this view shows, and the HUD's. Bag and Journal start hidden at wake: shown first. */
const MEASURE = `(() => {
  for (const sel of ['.hud-bag', '.hud-journal']) { const el = document.querySelector(sel); if (el) el.hidden = false; }
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  // a button just pressed sits 3 px low for 120 ms (.down): never measured in that moment
  if (document.querySelector('.tbtn.down')) return null;
  const landscape = document.body.classList.contains('landscape');
  const want = landscape
    ? { zone: '.stick-zone', ring: '.stick', a: '.tbtn.a', b: '.tbtn.b', sneak: '.tbtn.sneak', bag: '.tbtn.bag', journal: '.tbtn.journal', menu: '.tbtn.menu' }
    : { pad: '.pad', a: '.tbtn.a', b: '.tbtn.b', sneak: '.tbtn.sneak' };
  const boxes = {};
  for (const [name, sel] of Object.entries(want)) {
    const el = document.querySelector('.touch ' + sel) || document.querySelector(sel);
    if (!el) return null;
    boxes[name] = box(el);
    if (!(boxes[name].w > 0 && boxes[name].h > 0)) return null;
  }
  const hud = [];
  for (const el of document.querySelectorAll('.top > .tracker, .hud .btn, .hud .chip, .hud .meter')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) hud.push({ name: el.className, ...box(el) });
  }
  const scale = document.querySelector('.touch').style.getPropertyValue('--btn-scale');
  return { landscape, boxes, hud, scale, side: document.documentElement.dataset.stickSide || '', size: document.documentElement.dataset.buttonSize || '', width: innerWidth, height: innerHeight };
})()`;

interface Seen {
  landscape: boolean;
  boxes: Boxes;
  hud: (Box & { name: string })[];
  scale: string;
  side: string;
  size: string;
  width: number;
  height: number;
}

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

/** Turns the same page to a view and waits for the layout to follow (the body wears `landscape` only on its side). */
async function turn(page: Page, view: (typeof VIEWS)[number]): Promise<void> {
  await page.send('Emulation.setDeviceMetricsOverride', { width: view.width, height: view.height, deviceScaleFactor: 1, mobile: true });
  await page.waitFor(
    `innerWidth === ${view.width} && innerHeight === ${view.height} && document.body.classList.contains('landscape') === ${view.name === 'landscape'}`,
    `the page to turn ${view.name}`,
  );
}

/** Asks for a side and a size the way applyDisplay does (the two attributes on the page root) and waits for the layout to follow. */
async function choose(page: Page, side: Side, size: Size): Promise<void> {
  await page.eval(`(document.documentElement.dataset.stickSide = '${side}', document.documentElement.dataset.buttonSize = '${size}')`);
  await settled(page, side, size);
}

async function settled(page: Page, side: Side, size: Size): Promise<Seen> {
  return page.waitFor<Seen>(
    `(() => { const m = ${MEASURE}; return m && m.side === '${side}' && m.size === '${size}' && m.scale === '${SCALE[size]}' ? m : null; })()`,
    `the touch controls to follow ${side} / ${size}`,
  );
}

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const fail = (msg: string): never => {
  throw new Error(msg);
};
const fmt = (b: Box) => `${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.w.toFixed(1)}x${b.h.toFixed(1)}`;

/** Two controls overlap: the round ones when their centres are nearer than their radii, the rest as boxes. */
function overlap(a: Box, b: Box, round: boolean): boolean {
  if (round) return Math.hypot(a.x + a.w / 2 - (b.x + b.w / 2), a.y + a.h / 2 - (b.y + b.h / 2)) < (a.w + b.w) / 2 - 0.01;
  return a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;
}

/** What stands on the screen to be touched: every box but the stick zone (under everything) and the ring (only while raised). */
const controls = (seen: Seen) => Object.entries(seen.boxes).filter(([n]) => n !== 'zone' && n !== 'ring');

function checkNoOverlap(seen: Seen, label: string): void {
  const list = controls(seen);
  for (const [i, [an, a]] of list.entries()) {
    // upright, only A and B are round; on its side, every button is
    for (const [bn, b] of list.slice(i + 1)) {
      const round = seen.landscape || (an !== 'pad' && an !== 'sneak' && bn !== 'pad' && bn !== 'sneak');
      if (overlap(a, b, round)) fail(`${label}: ${an} (${fmt(a)}) overlaps ${bn} (${fmt(b)})`);
    }
    for (const part of seen.hud) {
      if (overlap(a, part, false)) fail(`${label}: ${an} (${fmt(a)}) overlaps the HUD's ${part.name} (${fmt(part)})`);
    }
  }
}

function checkOnScreen(seen: Seen, label: string): void {
  for (const [n, b] of controls(seen)) {
    if (b.x < -0.01 || b.y < -0.01 || b.x + b.w > seen.width + 0.01 || b.y + b.h > seen.height + 0.01) fail(`${label}: ${n} (${fmt(b)}) leaves the ${seen.width}x${seen.height} screen`);
  }
}

/** K2: every box of the right-hand state is its left-hand box reflected about the vertical centre line. */
function checkMirror(left: Seen, right: Seen, label: string): string {
  let worst = 0;
  for (const [n, d] of Object.entries(left.boxes)) {
    if (n === 'ring') {
      const r = right.boxes[n]!;
      if (!near(r.w, d.w, 0.5) || !near(r.h, d.h, 0.5)) fail(`${label}: the ring is ${fmt(r)} on the right, ${fmt(d)} on the left`);
      continue;
    }
    const r = right.boxes[n]!;
    const want = { x: left.width - d.x - d.w, y: d.y, w: d.w, h: d.h };
    const off = Math.max(Math.abs(r.x - want.x), Math.abs(r.y - want.y), Math.abs(r.w - want.w), Math.abs(r.h - want.h));
    worst = Math.max(worst, off);
    if (off > 0.5) fail(`${label}: ${n} is ${fmt(r)} on the right, the reflection of ${fmt(d)} is ${fmt(want as Box)} (off by ${off.toFixed(2)})`);
  }
  return `worst reflection error ${worst.toFixed(2)} px`;
}

/**
 * The HUD stays where it is when the side changes. Measured inside one script run, left then right then left again, so the
 * clock and the chips (which change as the game runs) cannot move between the two reads. Upright nothing may move; on its
 * side the tracker makes room for the column that stands on the left (a ruling, see the pull request) and is named, not held.
 */
const HUD_HOLDS = `(() => {
  const read = () => [...document.querySelectorAll('.top > .tracker, .hud .btn, .hud .chip, .hud .meter')].map((el) => { const r = el.getBoundingClientRect(); return { name: el.className, x: r.left, y: r.top, w: r.width, h: r.height }; }).filter((b) => b.w > 0 && b.h > 0);
  const root = document.documentElement;
  const was = root.dataset.stickSide;
  root.dataset.stickSide = 'left';
  const left = read();
  root.dataset.stickSide = 'right';
  const right = read();
  root.dataset.stickSide = was;
  return { left, right };
})()`;

async function checkHud(page: Page, landscape: boolean, label: string): Promise<string> {
  const { left, right } = await page.eval<{ left: (Box & { name: string })[]; right: (Box & { name: string })[] }>(HUD_HOLDS);
  if (left.length !== right.length) fail(`${label}: the HUD has ${right.length} parts on the right, ${left.length} on the left`);
  const moved: string[] = [];
  for (const [i, l] of left.entries()) {
    const r = right[i]!;
    if (r.name !== l.name) fail(`${label}: the HUD's parts changed with the side (${l.name} -> ${r.name})`);
    if (near(r.x, l.x, 0.01) && near(r.y, l.y, 0.01) && near(r.w, l.w, 0.01) && near(r.h, l.h, 0.01)) continue;
    if (landscape && l.name.includes('tracker')) {
      moved.push(`${l.name} ${fmt(l)} -> ${fmt(r)}`);
      continue;
    }
    fail(`${label}: the HUD's ${l.name} moved from ${fmt(l)} to ${fmt(r)}`);
  }
  return `${left.length} HUD parts held${moved.length ? `, but ${moved.join('; ')} (room for the column)` : ''}`;
}

/** The same boxes, within a tolerance. */
function sameBoxes(got: Boxes, want: Boxes, label: string, tol: number): void {
  for (const [n, w] of Object.entries(want)) {
    const g = got[n];
    if (!g) fail(`${label}: no ${n}`);
    const ring = n === 'ring';
    const off = ring ? Math.max(Math.abs(g!.w - w.w), Math.abs(g!.h - w.h)) : Math.max(Math.abs(g!.x - w.x), Math.abs(g!.y - w.y), Math.abs(g!.w - w.w), Math.abs(g!.h - w.h));
    if (off > tol) fail(`${label}: ${n} is ${fmt(g!)}, develop's is ${fmt(w)}`);
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

async function main(): Promise<void> {
  const remote = process.env.E2E_URL;
  if (!remote && !existsSync(join(DIST, 'index.html'))) throw new Error('no game/dist: run "pnpm build" first');
  mkdirSync(OUT, { recursive: true });
  const local = remote ? null : await serve();
  const browser = await Browser.launch();
  const page = await browser.newPage({ width: VIEWS[0]!.width, height: VIEWS[0]!.height, mobile: true });
  try {
    await page.goto(`${remote ?? local?.url ?? ''}?debug&rich=none${seedQuery('core/west-bank')}`);
    await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
    await start(page);
    if (await page.eval<boolean>(`localStorage.getItem('${SETTINGS_KEY}') !== null`)) throw new Error('settings are stored before the test chose any: K1 needs a clean profile');

    const dump = process.env.E2E_DUMP;
    const defaults: Record<string, Boxes> = {};
    // seen[view][side][size]
    const seen: Record<string, Seen> = {};
    for (const view of VIEWS) {
      await turn(page, view);
      if (dump) {
        const s = await page.waitFor<Seen>(MEASURE, 'the controls');
        defaults[view.name] = Object.fromEntries(Object.entries(s.boxes).map(([n, b]) => [n, { x: round2(b.x), y: round2(b.y), w: round2(b.w), h: round2(b.h) }]));
        continue;
      }
      const start0 = await page.waitFor<Seen>(MEASURE, 'the controls');
      if (start0.side !== 'left' || start0.size !== 'medium') throw new Error(`with nothing stored the page asks for ${start0.side} / ${start0.size}, not left / medium`);
      seen[`${view.name}/default`] = start0;
      for (const side of SIDES) {
        for (const size of SIZES) {
          await choose(page, side, size);
          const s = await settled(page, side, size);
          seen[`${view.name}/${side}/${size}`] = s;
          if (size === 'medium' || size === 'large') {
            const still = side === 'left' && size === 'medium' ? 'default' : side === 'right' && size === 'large' ? 'right-large' : '';
            if (still) await page.screenshot(join(OUT, `${view.name}-${still}.png`));
          }
        }
      }
      await choose(page, 'left', 'medium');
    }
    if (dump) {
      writeFileSync(dump, `${JSON.stringify(defaults, null, 2)}\n`);
      console.log(`controls: develop's default boxes written to ${dump}`);
      return;
    }

    const get = (v: ViewName, side: Side, size: Size) => seen[`${v}/${side}/${size}`] ?? fail(`no measure for ${v}/${side}/${size}`);

    for (const view of VIEWS) {
      const v = view.name;
      const names = Object.keys(get(v, 'left', 'medium').boxes);
      const want = v === 'landscape' ? ['zone', 'ring', 'a', 'b', 'sneak', 'bag', 'journal', 'menu'] : ['pad', 'a', 'b', 'sneak'];
      if (names.join() !== want.join()) fail(`${v}: the measure holds ${names.join()}, not ${want.join()}`);

      // K1: nothing stored, develop's boxes
      sameBoxes((seen[`${v}/default`] ?? fail(`no default measure for ${v}`)).boxes, DEVELOP[v], `K1 ${v}`, 0.5);
      console.log(`K1 ${v}: the default boxes equal develop's: ${names.filter((n) => n !== 'zone').map((n) => `${n} ${fmt(seen[`${v}/default`]!.boxes[n]!)}`).join('; ')}`);

      // K2: the mirror, at every size
      const worst: string[] = [];
      for (const size of SIZES) {
        const l = get(v, 'left', size);
        const r = get(v, 'right', size);
        worst.push(`${size}: ${checkMirror(l, r, `K2 ${v} ${size}`)}`);
        const half = view.width / 2;
        if (v === 'landscape') {
          const zl = l.boxes.zone!;
          const zr = r.boxes.zone!;
          if (!near(zl.x, 0, 0.5) || !near(zl.w, half, 0.5)) fail(`K2 ${v}: the default stick zone is ${fmt(zl)}, not the left half`);
          if (!near(zr.x, half, 0.5) || !near(zr.w, half, 0.5)) fail(`K2 ${v}: the stick zone on the right is ${fmt(zr)}, not the right half`);
          // the buttons stand on the other side of the zone
          for (const n of ['a', 'b', 'sneak', 'bag', 'journal', 'menu']) {
            const bl = l.boxes[n]!;
            const br = r.boxes[n]!;
            if (bl.x + bl.w / 2 < half) fail(`K2 ${v}: ${n} stands in the left half by default`);
            if (br.x + br.w / 2 > half) fail(`K2 ${v}: ${n} stands in the right half beside the stick on the right`);
          }
        } else {
          const pl = l.boxes.pad!;
          const pr = r.boxes.pad!;
          if (pl.x + pl.w / 2 > half || pr.x + pr.w / 2 < half) fail(`K2 ${v}: the pad is ${fmt(pl)} by default and ${fmt(pr)} on the right: not left then right`);
          const al = l.boxes.a!;
          const ar = r.boxes.a!;
          if (al.x + al.w / 2 < half || ar.x + ar.w / 2 > half) fail(`K2 ${v}: A is ${fmt(al)} by default and ${fmt(ar)} on the right: not right then left`);
        }
        for (const side of SIDES) {
          checkNoOverlap(get(v, side, size), `K2 ${v} ${side} ${size}`);
          checkOnScreen(get(v, side, size), `K2 ${v} ${side} ${size}`);
        }
      }
      await turn(page, view);
      const hud = await checkHud(page, v === 'landscape', `K2 ${v}`);
      console.log(`K2 ${v}: every box mirrored (${worst.join('; ')}); ${hud}; no overlap and nothing off the screen at any size, either side`);

      // K3: sizes
      for (const side of SIDES) {
        const med = get(v, side, 'medium');
        const rows: string[] = [];
        for (const size of SIZES) {
          const s = get(v, side, size);
          const k = SCALE[size];
          for (const n of ['a', 'b', 'sneak']) {
            const m = med.boxes[n]!;
            const got = s.boxes[n]!;
            // upright Sneak is a word in a frame: its height scales, its width is the word's
            const wide = !(v === 'portrait' && n === 'sneak');
            const wantW = wide ? Math.max(FLOOR, m.w * k) : m.w;
            const wantH = Math.max(FLOOR, m.h * k);
            if (!near(got.w, wantW, 1) || !near(got.h, wantH, 1)) fail(`K3 ${v} ${side} ${size}: ${n} is ${got.w.toFixed(1)}x${got.h.toFixed(1)}, ${k} of medium's ${m.w.toFixed(1)}x${m.h.toFixed(1)} (floor ${FLOOR}) is ${wantW.toFixed(1)}x${wantH.toFixed(1)}`);
          }
          if (v === 'landscape') {
            const ring = s.boxes.ring!;
            const mr = med.boxes.ring!;
            if (!near(ring.w, mr.w * k, 1) || !near(ring.h, mr.h * k, 1)) fail(`K3 ${v} ${side} ${size}: the ring is ${ring.w.toFixed(1)}x${ring.h.toFixed(1)}, ${k} of ${mr.w.toFixed(1)} is ${(mr.w * k).toFixed(1)}`);
            for (const n of ['bag', 'journal', 'menu']) {
              if (!near(s.boxes[n]!.w, med.boxes[n]!.w, 0.5) || !near(s.boxes[n]!.h, med.boxes[n]!.h, 0.5)) fail(`K3 ${v} ${side} ${size}: ${n} changed size (${fmt(s.boxes[n]!)}), the column keeps its size`);
            }
            rows.push(`${size} A ${s.boxes.a!.w.toFixed(1)} B ${s.boxes.b!.w.toFixed(1)} Sneak ${s.boxes.sneak!.w.toFixed(1)} ring ${ring.w.toFixed(1)}`);
          } else {
            if (!near(s.boxes.pad!.w, med.boxes.pad!.w, 0.5)) fail(`K3 ${v} ${side} ${size}: the pad changed size`);
            rows.push(`${size} A ${s.boxes.a!.w.toFixed(1)} B ${s.boxes.b!.w.toFixed(1)} Sneak ${s.boxes.sneak!.w.toFixed(1)}x${s.boxes.sneak!.h.toFixed(1)} pad ${s.boxes.pad!.w.toFixed(1)}`);
          }
          for (const [n, b] of controls(s)) if (b.w < FLOOR - 0.01 || b.h < FLOOR - 0.01) fail(`K3 ${v} ${side} ${size}: ${n} is ${b.w.toFixed(1)}x${b.h.toFixed(1)}, under ${FLOOR} px`);
        }
        console.log(`K3 ${v} ${side}: ${rows.join(' | ')}`);
      }
    }

    // the stick on its side: the touch lands in the half the setting names, and only there
    await turn(page, VIEWS[1]!);
    const band = await page.eval<number>(`(() => { let b = 0; for (const el of document.querySelectorAll('.top > .hud, .top > .tracker')) { const r = el.getBoundingClientRect(); if (r.height > 0) b = Math.max(b, r.bottom); } return b; })()`);
    const y = Math.round((band + VIEWS[1]!.height) / 2) + 20;
    for (const side of SIDES) {
      await choose(page, side, 'medium');
      for (const [half, x] of [['left', 170], ['right', 674]] as const) {
        await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await page.eval(`new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(true))))`);
        const rose = await page.eval<boolean>(`document.querySelector('.stick').classList.contains('on')`);
        await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitFor(`!document.querySelector('.stick').classList.contains('on')`, 'the stick to let go', 5000);
        if (rose !== (half === side)) fail(`the stick is on the ${side} but a thumb in the ${half} half ${rose ? 'raised it' : 'did not raise it'}`);
      }
    }
    console.log('K2 landscape: with the stick on the left a thumb raises it in the left half only, on the right in the right half only');
    await choose(page, 'left', 'medium');

    // K5 and the live case: the real Settings window, upright, a side and a size chosen with a tap
    await turn(page, VIEWS[0]!);
    await page.tap('.hud-menu', 'Menu');
    await page.tap('.menu-list button', 'Settings');
    await page.waitFor(`!![...document.querySelectorAll('.set-body h3')].find((h) => h.textContent === 'Controls')`, 'the Controls section');
    const words = await page.eval<{ text: string; px: number }[]>(`(() => {
      const h3 = [...document.querySelectorAll('.set-body h3')].find((h) => h.textContent === 'Controls');
      const rows = [h3.nextElementSibling, h3.nextElementSibling.nextElementSibling];
      const out = [{ text: h3.textContent, px: parseFloat(getComputedStyle(h3).fontSize) }];
      for (const row of rows) {
        for (const el of row.querySelectorAll('.set-label b, .set-opt, .set-note')) out.push({ text: el.textContent, px: parseFloat(getComputedStyle(el).fontSize) });
      }
      return out;
    })()`);
    const texts = words.map((w) => w.text).join('|');
    if (texts !== 'Controls|Stick side|Left|Right|Button size|Small|Medium|Large') fail(`the Controls section holds ${texts}`);
    const under = words.filter((w) => w.px < 16);
    if (under.length > 0) fail(`K5: ${under.map((w) => `${w.text} ${w.px}px`).join(', ')} under 16 px`);
    console.log(`K5: the Controls section's ${words.length} words read ${Math.min(...words.map((w) => w.px))}-${Math.max(...words.map((w) => w.px))} px (none under 16)`);

    const before = (await settled(page, 'left', 'medium')).boxes;
    await page.eval(`[...document.querySelectorAll('.set-body h3')].find((h) => h.textContent === 'Controls').scrollIntoView({ block: 'start' })`);
    await page.screenshot(join(OUT, 'settings-controls-portrait.png'));
    const pick = (label: string, name: string) => `[...document.querySelectorAll('[aria-label="${label}"] button')].find((b) => b.textContent === '${name}') || null`;
    await page.tapWhere(pick('Stick side', 'Right'), 'the Right option');
    await page.tapWhere(pick('Button size', 'Large'), 'the Large option');
    const live = await settled(page, 'right', 'large');
    const stored = await page.eval<string | null>(`localStorage.getItem('${SETTINGS_KEY}')`);
    const record = JSON.parse(stored ?? '{}') as Record<string, unknown>;
    if (record.stickSide !== 'right' || record.buttonSize !== 'large') fail(`the choices are not kept: ${stored}`);
    const a0 = before.a!;
    const a1 = live.boxes.a!;
    if (!near(a1.w, a0.w * 1.2, 1) || a1.x + a1.w / 2 > VIEWS[0]!.width / 2) fail(`the live choice left A at ${fmt(a1)}, from ${fmt(a0)}`);
    const wasOn = await page.eval<number>(`document.querySelectorAll('[aria-label="Stick side"] .on, [aria-label="Button size"] .on').length`);
    if (wasOn !== 2) fail(`the window shows ${wasOn} chosen options in the two rows, not 2`);
    console.log(`K5: a tap on Right and Large in the open window moved A from ${fmt(a0)} to ${fmt(a1)} at once, no reload, and kept ${stored}`);
    // the window closes on B and the page is back at the default for whatever runs after
    await page.eval(`__game.controls.press('b')`);
    await page.waitFor(`!document.querySelector('#ui > .layer')`, 'the Settings window to close', 5000);
    await choose(page, 'left', 'medium');

    if (page.errors.length > 0) throw new Error(`page errors:\n${page.errors.join('\n')}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    await page.screenshot(join(OUT, 'controls-failed.png')).catch(() => undefined);
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
