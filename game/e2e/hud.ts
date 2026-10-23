/**
 * Proves the HUD's toasts in a real browser, on a phone and on a desktop: the bridge's
 * story box holds the mend's toasts on a phone and lets them go when it closes, two at a
 * time and none dropped, while a desktop shows them beside the box; a bad line goes up
 * ahead of a pickup's calm lines; every toast goes up clear of the player and of the action
 * prompt (on a phone, below the player's feet); and on a phone the chips take the whole width
 * under the meter and the buttons. Every check waits on a condition, never on a fixed time.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep, type Page, type Viewport } from './cdp';
import { TAKE_GROUND, seedQuery } from './wakes';

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

const BITE = 'Bitten! Run for a safe place';

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

interface Seen {
  /** the toasts in the order they went up, by their text */
  shown: string[];
  /** the most toasts that stood at once, a fading one counted */
  most: number;
  /** the most that stood while a dialogue box was open */
  underBox: number;
  /** toasts that went up over the player (the feet's tile and the one above it) */
  onPlayer: number;
  /** toasts that went up over the action prompt */
  onPrompt: number;
  /** toasts that went up higher than the player's feet */
  above: number;
}

interface Clock {
  tick: number;
  wall: number;
  frames: number;
}

const IN_PAGE = `
window.__hud = (() => {
  const g = () => window.__game;
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const inRect = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
  const seen = { shown: [], most: 0, underBox: 0, onPlayer: 0, onPrompt: 0, above: 0 };
  const known = new Set();
  const cuts = (r, x0, y0, x1, y1) => r.right > x0 && r.left < x1 && r.bottom > y0 && r.top < y1;
  // a toast that goes up must leave the player and the action prompt in view
  const place = (t) => {
    const s = g().session, w = g().world;
    if (!s || !w) return;
    const r = t.getBoundingClientRect();
    const head = w.screenOf(s.pos[0], s.pos[1] - 1), feet = w.screenOf(s.pos[0], s.pos[1] + 1);
    const half = (feet.y - head.y) / 4;
    if (cuts(r, feet.x - half, head.y, feet.x + half, feet.y)) seen.onPlayer += 1;
    if (r.top < feet.y) seen.above += 1;
    const p = document.querySelector('.prompt');
    const pr = p && !p.hidden ? p.getBoundingClientRect() : null;
    if (pr && pr.height > 0 && cuts(r, pr.left, pr.top, pr.right, pr.bottom)) seen.onPrompt += 1;
  };
  new MutationObserver(() => {
    const toasts = [...document.querySelectorAll('.toast')];
    seen.most = Math.max(seen.most, toasts.length);
    if (document.querySelector('.dialog')) seen.underBox = Math.max(seen.underBox, toasts.length);
    for (const t of toasts) if (!known.has(t)) { known.add(t); seen.shown.push(t.textContent); place(t); }
  }).observe(document.body, { subtree: true, childList: true });
  return {
    seen() { return seen; },
    reset() { seen.shown = []; seen.most = 0; seen.underBox = 0; seen.onPlayer = 0; seen.onPrompt = 0; seen.above = 0; },
    toasts() { return document.querySelectorAll('.toast').length; },
    prompt() { const p = document.querySelector('.prompt'); return p && !p.hidden ? p.textContent : ''; },
    dialog() {
      const d = document.querySelector('.dialog');
      if (!d) return null;
      const o = d.querySelector('.dialog-options');
      return {
        text: d.querySelector('.dialog-text')?.textContent ?? '',
        typed: !d.querySelector('.dialog-arrow')?.hidden,
        options: o && !o.hidden ? [...o.querySelectorAll('button')].map((b) => b.textContent ?? '') : [],
      };
    },
    moveTo(x, y, facing) {
      const s = g().session;
      s.pos = [x, y];
      s.state.player.at = [x, y];
      if (facing) s.facing = facing;
      g().world.bind(s);
    },
    /** A tile the player can stand on with a tile of the slot in front, and the way to face it. */
    besideSlot(id) {
      const s = g().session, w = g().world, r = g().bundle.map.slots.find((x) => x.id === id);
      for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) {
        for (const [face, [dx, dy]] of Object.entries(DIRS)) {
          const at = [x - dx, y - dy];
          if (!inRect(at[0], at[1], r) && w.canWalk(s, at[0], at[1])) return { at, face };
        }
      }
      return null;
    },
    /** On a phone the chips take the HUD's whole width, under the meter and the buttons. */
    chipsRow() {
      const hud = document.querySelector('.hud').getBoundingClientRect();
      const row = document.querySelector('.hud-row').getBoundingClientRect();
      const buttons = document.querySelector('.hud-right').getBoundingClientRect();
      return { full: row.width >= hud.width - 1, under: row.top >= buttons.bottom };
    },
  };
})();
true`;

async function start(page: Page): Promise<void> {
  await page.tap('.title-screen button', 'New game');
  const choice = await page.waitFor<string>(
    `document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
    'the race cards',
  );
  if (choice === 'ask') await page.tap('.title-screen button', 'Start a new game');
  await page.tap('.card.race', 'Elf');
  await page.tap('input.name');
  await page.type('Tess');
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor('!!window.__game.session && window.__game.session.started', 'the character to wake', 10_000);
  // the west bank's basket and axe lie on the ground by the wake: this script tests what comes later, so they are handed over
  await page.eval(TAKE_GROUND);
}

/** Reads every box on screen to its end, a line at a time once it is typed, and any level-up after them. */
async function readThrough(page: Page, what: string): Promise<void> {
  const now = `(() => {
    const d = __hud.dialog();
    if (d) return d.options.length > 0 ? 'options' : d.typed ? 'typed' : '';
    return document.querySelector('.levelup-layer') ? 'level' : 'none';
  })()`;
  for (let presses = 0; presses < 40; presses++) {
    let open = await page.waitFor<string>(now, `${what}: a line to be typed`, 10_000);
    if (open === 'none') {
      // the next box of a beat can open a moment after the last one closed
      await sleep(300);
      open = await page.waitFor<string>(now, `${what}: a line to be typed`, 10_000);
      if (open === 'none') return;
    }
    if (open === 'options') throw new Error(`${what}: a box asks ${(await page.eval<{ options: string[] }>('__hud.dialog()')).options.join(' | ')}`);
    await page.press('Enter');
    await sleep(120);
  }
  throw new Error(`${what}: the boxes did not close`);
}

async function choose(page: Page, label: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const d = await page.eval<{ options: string[] } | null>('__hud.dialog()');
    if (d && d.options.some((o) => o.includes(label))) {
      await page.tap('.dialog-options button', label);
      return;
    }
    if (d && d.options.length > 0) throw new Error(`the box offers ${d.options.join(' | ')}, not "${label}"`);
    if (d) await page.press('Enter');
    await sleep(100);
  }
  throw new Error(`no box offered "${label}"`);
}

async function run(page: Page, url: string, phone: boolean): Promise<void> {
  await page.goto(`${url}?debug&rich=none${seedQuery('core/west-bank')}`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
  await page.eval(IN_PAGE);
  await start(page);
  await readThrough(page, 'the opening');

  if (phone) {
    const row = await page.eval<{ full: boolean; under: boolean }>('__hud.chipsRow()');
    if (!row.full || !row.under) throw new Error(`the chips do not take the width under the meter and the buttons: ${JSON.stringify(row)}`);
  }

  // the bridge mended: one action, its story box, and the toasts it brings
  await page.eval(`__game.session.state.player.bag['core/keystone'] = 1`);
  const spot = await page.eval<{ at: [number, number]; face: string } | null>(`__hud.besideSlot('core/old-bridge')`);
  if (!spot) throw new Error('no tile beside the broken bridge');
  await page.eval(`__hud.moveTo(${spot.at[0]}, ${spot.at[1]}, ${JSON.stringify(spot.face)})`);
  await page.waitFor(`__hud.prompt().includes('Mend')`, 'the Mend button by the bridge', 5000);
  await page.waitFor('__hud.toasts() === 0', 'the toasts of the opening to leave', 20_000);
  await page.eval('__hud.reset()');
  await page.press('Enter');
  // the mend's 4 s are game time: a wait that runs out says how far the game's clock moved against the wall's
  const clock = `({ tick: __game.session.tick, wall: performance.now(), frames: __game.world.game.loop.frame })`;
  const before = await page.eval<Clock>(clock);
  await choose(page, 'Mend it');
  await page
    .waitFor(`!!__hud.dialog() && __hud.dialog().text.includes('The bridge holds')`, 'the story of the mended bridge', 15_000)
    .catch(async (error: unknown) => {
      const after = await page.eval<Clock>(clock);
      const moved = `the game's clock moved ${after.tick - before.tick} ms in ${Math.round(after.wall - before.wall)} ms, ${after.frames - before.frames} frames`;
      throw new Error(`${error instanceof Error ? error.message : String(error)} (${moved})`);
    });
  // the box stays open while each of its lines is typed and read: long enough for the toasts to show if they would
  await readThrough(page, 'the story of the bridge');
  const box = await page.eval<Seen>('__hud.seen()');
  if (phone && box.underBox > 0) throw new Error(`a toast stood over the story box on a phone: ${box.shown.join(' | ')}`);
  if (!phone && box.underBox === 0) throw new Error('no toast went up beside the story box on a desktop');

  // once the box is closed the mend's toasts go up, two at a time, and every one of them is read
  await page.waitFor(`__hud.toasts() === 0 && __hud.seen().shown.length >= 3`, 'the mend toasts to go up and leave', 20_000);
  const mend = await page.eval<Seen>('__hud.seen()');
  if (mend.most > 2) throw new Error(`${mend.most} toasts stood at once: ${mend.shown.join(' | ')}`);
  if (mend.onPlayer > 0 || mend.onPrompt > 0) throw new Error(`a mend toast went up over the player (${mend.onPlayer}) or the prompt (${mend.onPrompt})`);
  if (phone && mend.above > 0) throw new Error(`${mend.above} mend toasts went up above the player's feet on a phone, where they sit low`);
  for (const line of ['Old bridge restored', '+30 gold']) {
    if (!mend.shown.includes(line)) throw new Error(`the mend never showed "${line}": ${mend.shown.join(' | ')}`);
  }
  const tasks = mend.shown.find((t) => t.includes('Task done: Mend the bridge'));
  if (!tasks?.includes('New task: A fire across the river')) throw new Error(`the closed and the new task do not share a toast: ${mend.shown.join(' | ')}`);

  // a bad line goes ahead: a bite 100 ms behind a pickup's four lines goes up before the calm ones still waiting
  await page.eval('__hud.reset()');
  await page.eval(`(() => {
    const ui = __game.ui;
    for (const line of ['+1 Moonreed', 'New in your journal: Moonreed', 'Carry is now 3', 'Jackpot! Three times the experience']) ui.toast(line, 'good');
    setTimeout(() => ui.toast(${JSON.stringify(BITE)}, 'bad'), 100);
  })()`);
  await page.waitFor(`__hud.seen().shown.includes(${JSON.stringify(BITE)})`, 'the bite to go up', 10_000);
  const pickup = await page.eval<Seen>('__hud.seen()');
  const ahead = pickup.shown.slice(0, pickup.shown.indexOf(BITE));
  if (ahead.length > 2) throw new Error(`the bite waited behind the calm lines: ${ahead.join(' | ')}`);
  await page.waitFor(`__hud.toasts() === 0 && __hud.seen().shown.length === 5`, 'the pickup lines to go up and leave', 20_000);
  const after = await page.eval<Seen>('__hud.seen()');
  if (after.most > 2) throw new Error(`${after.most} toasts stood at once: ${after.shown.join(' | ')}`);
  if (after.onPlayer > 0 || after.onPrompt > 0) throw new Error(`a pickup toast went up over the player (${after.onPlayer}) or the prompt (${after.onPrompt})`);
  if (phone && after.above > 0) throw new Error(`${after.above} pickup toasts went up above the player's feet on a phone, where they sit low`);
  if (page.errors.length > 0) throw new Error(`page errors:\n${page.errors.join('\n')}`);
}

async function main(): Promise<void> {
  const remote = process.env.E2E_URL;
  if (!remote && !existsSync(join(DIST, 'index.html'))) throw new Error('no game/dist: run "pnpm build" first');
  mkdirSync(OUT, { recursive: true });
  const local = remote ? null : await serve();
  const browser = await Browser.launch();
  try {
    for (const [name, viewport] of [
      ['phone', { width: 390, height: 844, mobile: true }],
      ['desktop', { width: 1440, height: 900, mobile: false }],
    ] as [string, Viewport][]) {
      const page = await browser.newPage(viewport);
      try {
        await run(page, remote ?? local?.url ?? '', viewport.mobile);
      } catch (error) {
        await page.screenshot(join(OUT, `hud-${name}-failed.png`)).catch(() => undefined);
        throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      } finally {
        page.close();
      }
      console.log(`hud: ${name} passed`);
    }
  } finally {
    await browser.close();
    local?.server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
