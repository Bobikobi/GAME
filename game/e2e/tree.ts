/**
 * Proves the skill tree page of the kit in a real browser (DECISIONS 2026-10-23 "The skill tree
 * screen", "The tree is data", "Platform priority"). On a computer first: the tree fills the wide
 * window, a node's card shows while the pointer rests on it, a click chooses it with the kernel's own
 * reason when it cannot be learned, Learn works in town, the arrow keys move between nodes without
 * walking the player, L learns, a technique goes into the build, the wheel zooms, a drag pans, Shift and
 * an arrow pan, a number key shows one school and 0 the whole tree. Then a generated tree of about three hundred nodes (tests
 * only, never content) is drawn and panned within a frame's time, only what is on screen. On a phone,
 * once: every node takes a 44 px tap at the starting zoom, a tap chooses, a long press shows the
 * number, Learn works, a finger pans, two fingers pinch to zoom, and the big tree draws only what is on screen.
 * Every check waits on a condition, never a fixed time.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Bundle } from '@game/kernel';
import { bigTree } from '../../tools/test/helpers/bigtree';
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

function serve(): Promise<{ server: Server; url: string }> {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '')).replace(/^(\.\.[/\\])+/, '');
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

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a node's button is on the page, or null when it is not drawn. */
const nodeBox = (page: Page, key: string) =>
  page.eval<Box | null>(`(() => {
    const el = document.querySelector('[data-node=${JSON.stringify(key)}]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  })()`);

/** Where a node's button is once it is drawn: after an action the page is drawn again on the next frame. */
const drawnBox = (page: Page, key: string) =>
  page.waitFor<Box>(`(() => {
    const el = document.querySelector('[data-node=${JSON.stringify(key)}]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  })()`, `the node ${key} drawn`);

const viewBox = (page: Page) =>
  page.eval<Box>(`(() => { const r = document.querySelector('.tree-view').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);

const dataset = (page: Page) => page.eval<Record<string, string>>(`({ ...document.querySelector('.tree-view').dataset })`);

/** A key the harness has no table row for, sent to the focused element as the page would get it. */
const key = (page: Page, k: string, shift = false) =>
  page.eval(`(document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, shiftKey: ${shift}, bubbles: true, cancelable: true }))`);

/** Where the camera looks, in the layout's steps. */
const camAt = async (page: Page) => (await dataset(page)).cam!.split(',').map(Number) as [number, number];

async function mouse(page: Page, type: 'mouseMoved' | 'mousePressed' | 'mouseReleased', x: number, y: number): Promise<void> {
  await page.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', buttons: type === 'mouseReleased' ? 0 : type === 'mousePressed' ? 1 : 0, clickCount: 1 });
}

async function drag(page: Page, mobile: boolean, from: { x: number; y: number }, by: { x: number; y: number }, steps = 12): Promise<void> {
  if (mobile) {
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
    for (let i = 1; i <= steps; i++) await page.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (by.x * i) / steps, y: from.y + (by.y * i) / steps }] });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return;
  }
  await mouse(page, 'mouseMoved', from.x, from.y);
  await mouse(page, 'mousePressed', from.x, from.y);
  for (let i = 1; i <= steps; i++) {
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x + (by.x * i) / steps, y: from.y + (by.y * i) / steps, button: 'left', buttons: 1 });
  }
  await mouse(page, 'mouseReleased', from.x + by.x, from.y + by.y);
}

async function tapNode(page: Page, k: string): Promise<void> {
  const box = await page.waitFor<Box>(`(() => { const el = document.querySelector('[data-node=${JSON.stringify(k)}]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`, `the node ${k}`);
  await page.tapAt(box.x, box.y);
  await page.waitFor(`document.querySelector('.tree-card')?.dataset.card === ${JSON.stringify(k)}`, `the card of ${k}`);
}

async function openTree(page: Page): Promise<void> {
  await page.eval(`window.__game.ui.closeAll(); window.__game.ui.handle('bag')`);
  await page.waitFor(`!!document.querySelector('.panel .tabs')`, 'the kit');
  await page.tap('.panel .tabs button', 'Skills');
  await page.waitFor(`document.querySelector('.tree-view')?.dataset.drawn > 0`, 'the tree drawn');
}

async function continueGame(page: Page, url: string): Promise<void> {
  await page.goto(`${url}?debug`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
  await page.tap('.title-screen button', 'Continue');
  await page.waitFor(`!!window.__game?.session?.started`, 'the game', 30_000);
  await sleep(300);
}

/** A new game of a race, with four skill points from one profession's levels, saved. */
async function newGame(page: Page, url: string, viewport: Viewport, race: string): Promise<void> {
  await page.goto(`${url}?debug`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
  await page.eval(`localStorage.clear()`);
  await page.goto(`${url}?debug${seedQuery(viewport.mobile ? 'core/west-bank' : 'core/north-meadow')}`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
  await page.tap('.title-screen button', 'New game');
  const ask = await page.waitFor<string>(
    `document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
    'the race cards',
  );
  if (ask === 'ask') await page.tap('.title-screen button', 'Start a new game');
  await page.waitFor(`!!document.querySelector('.card.race')`, 'the race cards');
  await page.tap('.card.race', race);
  await page.tap('input.name');
  await page.type('Tree');
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor(`!!window.__game?.session?.started`, 'the game', 30_000);
  await page.eval(TAKE_GROUND);
  for (let i = 0; i < 40; i++) {
    if (!(await page.eval<boolean>(`!!document.querySelector('.dialog')`))) break;
    if (viewport.mobile) await page.tap('.tbtn.a');
    else await page.press('Enter');
    await sleep(220);
  }
  await page.eval(`(() => {
    const s = window.__game.session, b = window.__game.bundle;
    const prof = Object.keys(b.professions).sort()[0];
    s.state.player.xp[prof] = b.professions[prof].xp_levels[3] * 1000;
    s.save();
  })()`);
  await continueGame(page, url);
}

/** Moves the player to the town square, where a node can be learned, and saves. */
async function toTown(page: Page, url: string): Promise<void> {
  await page.eval(`(() => {
    const s = window.__game.session, b = window.__game.bundle;
    const sq = b.map.slots.find((x) => x.kind === 'area' && x.tag === 'town');
    // the session walks from its own pos, so both move (as hud.ts and map.ts do)
    s.pos = [sq.x + 1, sq.y + 1];
    s.state.player.at = [sq.x + 1, sq.y + 1];
    s.save();
  })()`);
  await continueGame(page, url);
}

/** The first school's root, a node that needs it, and how many nodes this player's tree has. */
const treeFacts = (page: Page) =>
  page.eval<{ root: string; rootName: string; child: string; total: number }>(`(() => {
    const b = window.__game.bundle, race = window.__game.session.state.player.race;
    const ids = Object.keys(b.schools).sort();
    const sc = b.schools[ids[0]];
    const root = sc.nodes.find((n) => !(n.needs ?? []).length);
    const child = sc.nodes.find((n) => (n.needs ?? []).includes(root.id) && n.size !== 'corner');
    const total = ids.flatMap((id) => b.schools[id].nodes).filter((n) => n.size !== 'corner' || n.race === race).length;
    return { root: ids[0] + '/' + root.id, rootName: root.name, child: ids[0] + '/' + child.id, total };
  })()`);

/** Swaps the content's tree for a generated one of about three hundred nodes, in the page only. */
async function growBigTree(page: Page): Promise<number> {
  const part = await page.eval<string>(`(() => {
    const b = window.__game.bundle;
    return JSON.stringify({ schools: b.schools, races: b.races, items: Object.fromEntries(Object.keys(b.items).map((k) => [k, {}])), params: { growth: b.params.growth } });
  })()`);
  const big = bigTree(JSON.parse(part) as Bundle);
  return page.eval<number>(`(() => {
    const b = window.__game.bundle, big = ${JSON.stringify({ schools: big.schools, growth: big.params.growth })};
    b.schools = big.schools;
    b.params.growth = big.growth;
    const race = window.__game.session.state.player.race;
    return Object.values(b.schools).flatMap((s) => s.nodes).filter((n) => n.size !== 'corner' || n.race === race).length;
  })()`);
}

const hadNoErrors = (page: Page) => {
  if (page.errors.length > 0) throw new Error(`the page threw: ${page.errors.join(' | ')}`);
};

async function desktop(page: Page, url: string): Promise<void> {
  const log = (msg: string) => console.log(`[desktop] ${msg}`);
  await newGame(page, url, { width: 1440, height: 900, mobile: false }, 'Human');
  const facts = await treeFacts(page);
  await openTree(page);

  // the wide window, the whole tree in it
  const width = await page.eval<number>(`document.querySelector('.panel.bag.tree-open')?.getBoundingClientRect().width ?? 0`);
  if (width < 1300) throw new Error(`the tree's window is ${width} px wide on a 1440 px screen`);
  let d = await dataset(page);
  if (Number(d.drawn) !== facts.total) throw new Error(`the first look draws ${d.drawn} of ${facts.total} nodes, not the whole tree`);
  log(`the window is ${Math.round(width)} px wide and shows all ${facts.total} nodes`);

  // a node's card while the pointer rests on it
  const root = await nodeBox(page, facts.root);
  if (!root) throw new Error('the first root is not drawn');
  await mouse(page, 'mouseMoved', root.x, root.y);
  await page.waitFor(`(() => { const h = document.querySelector('.tree-hover'); return h && !h.hidden && h.textContent.includes(${JSON.stringify(facts.rootName)}); })()`, 'the hover card');
  log('the hover card names the node');

  // a click chooses it; away from town the card gives the kernel's reason
  await tapNode(page, facts.root);
  const reason = await page.eval<string | null>(`window.__game.session.check({ t: 'learn_node', node: ${JSON.stringify(facts.root)}, at: window.__game.session.pos }) ?? null`);
  const shown = await page.eval<string>(`document.querySelector('.tree-card .tree-why, .tree-card .tree-ok')?.textContent ?? ''`);
  if (reason !== null && shown !== reason) throw new Error(`the card says "${shown}", the kernel "${reason}"`);
  log(`away from town the card says: ${shown}`);

  // in town: Learn
  await toTown(page, url);
  const left = await page.eval<string | null>(`window.__game.session.check({ t: 'learn_node', node: ${JSON.stringify(facts.root)}, at: window.__game.session.pos }) ?? null`);
  if (left !== null) throw new Error(`in town the root still cannot be learned: ${left}`);
  await openTree(page);
  await tapNode(page, facts.root);
  await page.tap('.tree-card .tree-learn', 'Learn');
  await page.waitFor(`document.querySelector('[data-node=${JSON.stringify(facts.root)}]')?.classList.contains('learned')`, 'the root learned');
  log('Learn works in town');

  // the arrow keys move between nodes and the player stays where they stand
  const at = await page.eval<number[]>(`[...window.__game.session.pos]`);
  await tapNode(page, facts.child);
  await page.press('ArrowLeft');
  await page.waitFor(`document.activeElement?.dataset?.node && document.querySelector('.tree-card')?.dataset.card === document.activeElement.dataset.node && document.activeElement.dataset.node !== ${JSON.stringify(facts.child)}`, 'the arrow to move the focus');
  const after = await page.eval<number[]>(`[...window.__game.session.pos]`);
  if (after.join() !== at.join()) throw new Error(`an arrow key walked the player from ${at} to ${after}`);
  log('an arrow key moves between nodes, not the player');

  // L learns the chosen node, and the focus stays on it
  await tapNode(page, facts.child);
  await key(page, 'l');
  await page.waitFor(`window.__game.session.state.player.nodes.includes(${JSON.stringify(facts.child)})`, 'L to learn');
  await page.waitFor(`document.activeElement?.dataset?.node === ${JSON.stringify(facts.child)}`, 'the focus back on the node');
  log('L learns it');

  // a technique into the build
  await page.tap('.tree-card .tree-equip', 'Put in the build');
  await page.waitFor(`window.__game.session.state.player.build?.[0] === ${JSON.stringify(facts.child)}`, 'the build');
  await page.waitFor(`!!document.querySelector('.tree-slot.filled[data-slot="0"]')`, 'the filled slot');
  log('the technique sits in the first slot');

  // the wheel zooms where the pointer is; a drag pans
  const view = await viewBox(page);
  const centre = { x: view.x + view.w / 2, y: view.y + view.h / 2 };
  // from the whole tree, where the wheel has room to zoom in (the keys above zoomed in on a node)
  await page.eval(`document.querySelector('.tree-view').focus()`);
  await key(page, '0');
  await page.waitFor(`Number(document.querySelector('.tree-view').dataset.zoom) * 1.5 < 2.5`, 'the key 0 to show the whole tree');
  const z0 = Number((await dataset(page)).zoom);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: centre.x, y: centre.y, deltaX: 0, deltaY: -400 });
  await page.waitFor(`Number(document.querySelector('.tree-view').dataset.zoom) > ${z0 * 1.2}`, `the wheel to zoom in from ${z0}`);
  const before = await nodeBox(page, facts.root);
  if (!before) throw new Error('the root left the view on a zoom at the middle');
  await drag(page, false, { x: view.x + 24, y: view.y + 24 }, { x: 160, y: 60 });
  await page.waitFor(`(() => { const el = document.querySelector('[data-node=${JSON.stringify(facts.root)}]'); if (!el) return false; const r = el.getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - ${before.x} - 160) < 3 && Math.abs(r.top + r.height / 2 - ${before.y} - 60) < 3; })()`, 'the drag to pan by 160, 60');
  log(`the wheel zooms ${z0} -> ${(await dataset(page)).zoom}, a drag pans`);

  // Shift and an arrow pan a quarter of the view; the chosen node stays chosen
  await page.eval(`document.querySelector('.tree-view').focus()`);
  const [cx0, cy0] = await camAt(page);
  // a quarter of the view in the layout steps (TREE_UNIT, 56 px at zoom 1)
  const step = view.w / 4 / (56 * Number((await dataset(page)).zoom));
  await key(page, 'ArrowRight', true);
  await page.waitFor(`(() => { const [x, y] = document.querySelector('.tree-view').dataset.cam.split(',').map(Number); return Math.abs(x - ${cx0} - ${step}) < ${step * 0.03} && Math.abs(y - ${cy0}) < 0.01; })()`, 'Shift and the right arrow to pan');
  await key(page, 'ArrowUp', true);
  await page.waitFor(`Number(document.querySelector('.tree-view').dataset.cam.split(',')[1]) < ${cy0} - 0.01`, 'Shift and the up arrow to pan');
  if ((await page.eval<string>(`document.querySelector('.tree-card')?.dataset.card ?? ''`)) !== facts.child) throw new Error('a pan by the keys changed the chosen node');
  log('Shift and an arrow pan the map');

  // a number key shows one school, 0 the whole tree
  await page.eval(`document.querySelector('.tree-view').focus()`);
  const z1 = (await dataset(page)).zoom;
  await key(page, '2');
  await page.waitFor(`document.querySelector('.tree-view').dataset.zoom !== ${JSON.stringify(z1)}`, 'the key 2 to show a school');
  await key(page, '0');
  await page.waitFor(`Number(document.querySelector('.tree-view').dataset.drawn) === ${facts.total}`, 'the key 0 to show the whole tree');
  log('2 shows one school, 0 the whole tree');
  hadNoErrors(page);

  // three hundred nodes: the first look within a moment, a full draw and every pan draw within a frame
  const total = await growBigTree(page);
  if (total < 290) throw new Error(`the generated tree has ${total} nodes`);
  await page.eval(`window.__game.ui.closeAll(); window.__game.ui.handle('bag')`);
  await page.waitFor(`!!document.querySelector('.panel .tabs')`, 'the kit');
  const t0 = Date.now();
  await page.tap('.panel .tabs button', 'Skills');
  await page.waitFor(`Number(document.querySelector('.tree-view')?.dataset.drawn) === ${total}`, 'the big tree drawn whole');
  const first = Date.now() - t0;
  d = await dataset(page);
  const full = Number(d.drawMs);
  if (first > 3000) throw new Error(`the big tree took ${first} ms to show`);
  if (full > 50) throw new Error(`a full draw of ${total} nodes took ${full} ms`);
  for (let i = 0; i < 4; i++) {
    await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: centre.x, y: centre.y, deltaX: 0, deltaY: -500 });
    await sleep(60);
  }
  await page.waitFor(`Number(document.querySelector('.tree-view').dataset.zoom) >= 0.9`, 'the wheel to zoom in on the big tree');
  await page.waitFor(`Number(document.querySelector('.tree-view').dataset.drawn) < ${total}`, 'only the nodes on screen drawn');
  await page.eval(`(() => {
    const v = document.querySelector('.tree-view');
    v.dataset.drawMax = '0';
    window.__frames = [];
    let last = performance.now();
    const tick = (t) => { window.__frames.push(t - last); last = t; if (!window.__stopFrames) requestAnimationFrame(tick); };
    window.__stopFrames = false;
    requestAnimationFrame(tick);
  })()`);
  // the page's own frame clock first, at rest: a headless Chrome on a busy or idle machine may tick far
  // slower than 60 a second, and the pan is held to that clock, not to a number the machine cannot keep
  await page.waitFor(`window.__frames.length > 8`, 'frames at rest');
  const rest = await page.eval<number[]>(`window.__frames.slice(1)`);
  await page.eval(`window.__frames = []`);
  await drag(page, false, { x: view.x + 30, y: view.y + 30 }, { x: 600, y: 300 }, 40);
  await sleep(100);
  const perf = await page.eval<{ frames: number[]; drawMax: number; drawn: number }>(`(() => {
    window.__stopFrames = true;
    const v = document.querySelector('.tree-view');
    return { frames: window.__frames.slice(1), drawMax: Number(v.dataset.drawMax), drawn: Number(v.dataset.drawn) };
  })()`);
  const medianOf = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  const median = medianOf(perf.frames);
  const atRest = medianOf(rest);
  // the draw itself is held to a frame; the frames while panning to half a frame over the clock at rest (50 ms at least)
  const budget = Math.max(50, atRest * 1.5);
  if (perf.drawMax > 30) throw new Error(`a pan draw of the big tree took ${perf.drawMax} ms`);
  if (median > budget) throw new Error(`the big tree pans at a median frame of ${median.toFixed(1)} ms, ${atRest.toFixed(1)} ms at rest`);
  log(`${total} nodes: shown in ${first} ms, a full draw ${full} ms; panning ${perf.drawn} on screen, longest draw ${perf.drawMax} ms, median frame ${median.toFixed(1)} ms (${atRest.toFixed(1)} ms at rest)`);
  hadNoErrors(page);
}

async function phone(page: Page, url: string): Promise<void> {
  const log = (msg: string) => console.log(`[phone] ${msg}`);
  await newGame(page, url, { width: 390, height: 844, mobile: true, scale: 3 }, 'Elf');
  await toTown(page, url);
  const facts = await treeFacts(page);
  await openTree(page);
  const d = await dataset(page);
  if (d.zoom !== '1.000') throw new Error(`the phone starts at zoom ${d.zoom}`);

  // the phone's column stacks without overlap: schools, map, build, then the card
  const stack = await page.eval<string>(`(() => {
    const r = (sel) => document.querySelector(sel).getBoundingClientRect();
    const schools = r('.tree-schools'), frame = r('.tree-frame'), build = r('.tree-build'), card = r('.tree-card');
    if (schools.height < 40) return 'the school row is ' + schools.height + ' px tall';
    if (frame.top < schools.bottom - 1) return 'the map rides over the school row';
    if (build.top < frame.bottom - 1) return 'the build rides over the map';
    if (card.top < build.bottom - 1) return 'the card rides over the build';
    return '';
  })()`);
  if (stack) throw new Error(stack);
  log('the column stacks: schools, map, build, card');

  // every node in view takes a 44 px tap: 21 px from its middle still lands on it
  const view = await viewBox(page);
  const misses = await page.eval<string[]>(`(() => {
    const v = document.querySelector('.tree-view').getBoundingClientRect();
    const tools = document.querySelector('.tree-tools').getBoundingClientRect();
    const out = [];
    let checked = 0;
    for (const el of document.querySelectorAll('.tree-node')) {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x < v.left + 30 || x > v.right - 30 || y < v.top + 30 || y > v.bottom - 30) continue;
      if (x + 30 > tools.left && y + 30 > tools.top) continue;
      checked++;
      for (const [dx, dy] of [[21, 0], [-21, 0], [0, 21], [0, -21]]) {
        const hit = document.elementFromPoint(x + dx, y + dy)?.closest('[data-node]');
        if (hit !== el) out.push(el.dataset.node + ' at ' + dx + ',' + dy + ' (' + Math.round(r.width) + ' px)');
      }
    }
    return checked >= 5 ? out : ['only ' + checked + ' nodes in view'];
  })()`);
  if (misses.length > 0) throw new Error(`taps miss: ${misses.join('; ')}`);
  log('every node in view takes a 44 px tap');

  // a tap chooses, a long press shows the number, Learn learns
  await tapNode(page, facts.root);
  const root = await nodeBox(page, facts.root);
  if (!root) throw new Error('the first root is not in view');
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: root.x, y: root.y }] });
  await page.waitFor(`!!document.querySelector('.tree-card[data-card=${JSON.stringify(facts.root)}] .tree-number')`, 'the long press to show the number', 3000);
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const number = await page.eval<string>(`document.querySelector('.tree-number').textContent`);
  log(`a long press shows: ${number}`);
  await page.tap('.tree-card .tree-learn', 'Learn');
  await page.waitFor(`window.__game.session.state.player.nodes.includes(${JSON.stringify(facts.root)})`, 'the root learned');
  log('a tap and Learn learn the root');

  // a finger pans; the zoom button zooms
  const before = await drawnBox(page, facts.root);
  await drag(page, true, { x: view.x + 20, y: view.y + 20 }, { x: 80, y: 50 });
  await page.waitFor(`(() => { const el = document.querySelector('[data-node=${JSON.stringify(facts.root)}]'); if (!el) return false; const r = el.getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - ${before.x} - 80) < 3 && Math.abs(r.top + r.height / 2 - ${before.y} - 50) < 3; })()`, 'a finger to pan');
  await page.tap('.tree-zoom-in');
  await page.waitFor(`Number(document.querySelector('.tree-view').dataset.zoom) > 1.2`, 'the zoom button');
  log('a finger pans, the button zooms');

  // two fingers pinch: closing them to half the distance halves the zoom
  const zp = Number((await dataset(page)).zoom);
  const mid = { x: view.x + view.w / 2, y: view.y + Math.min(view.h / 2, 160) };
  const fingers = (gap: number) => [
    { x: mid.x - gap / 2, y: mid.y, id: 0 },
    { x: mid.x + gap / 2, y: mid.y, id: 1 },
  ];
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(160) });
  for (let i = 1; i <= 12; i++) await page.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(160 - (80 * i) / 12) });
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitFor(`(() => { const z = Number(document.querySelector('.tree-view').dataset.zoom); return z < ${zp * 0.6} && z > ${zp * 0.4}; })()`, `a pinch to zoom out from ${zp}`);
  log(`a pinch zooms ${zp} -> ${(await dataset(page)).zoom}`);
  hadNoErrors(page);

  // the big tree on a phone: only what is on screen, and a tap still chooses
  const total = await growBigTree(page);
  await openTree(page);
  const drawn = Number((await dataset(page)).drawn);
  if (drawn >= total) throw new Error(`the phone draws ${drawn} of ${total} nodes at the start`);
  const some = await page.eval<string>(`(() => {
    const v = document.querySelector('.tree-view').getBoundingClientRect();
    const tools = document.querySelector('.tree-tools').getBoundingClientRect();
    for (const el of document.querySelectorAll('.tree-node')) {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x > v.left + 30 && x < v.right - 30 && y > v.top + 30 && y < tools.top - 10) return el.dataset.node;
    }
    return '';
  })()`);
  if (!some) throw new Error('no node of the big tree stands inside the view');
  await tapNode(page, some);
  log(`the big tree: ${drawn} of ${total} drawn, a tap chooses`);
  hadNoErrors(page);
}

async function main(): Promise<void> {
  const remote = process.env.E2E_URL;
  if (!remote && !existsSync(join(DIST, 'index.html'))) throw new Error('no game/dist: run "pnpm build" first');
  mkdirSync(OUT, { recursive: true });
  const local = remote ? null : await serve();
  const browser = await Browser.launch();
  try {
    for (const [name, viewport, run] of [
      ['desktop', { width: 1440, height: 900, mobile: false }, desktop],
      ['phone', { width: 390, height: 844, mobile: true, scale: 3 }, phone],
    ] as [string, Viewport, (page: Page, url: string) => Promise<void>][]) {
      const page = await browser.newPage(viewport);
      try {
        await run(page, remote ?? local?.url ?? '');
      } catch (error) {
        await page.screenshot(join(OUT, `tree-${name}-failed.png`)).catch(() => undefined);
        throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      } finally {
        page.close();
        await sleep(300);
      }
      console.log(`tree: ${name} passed`);
    }
  } finally {
    await browser.close().catch((error: unknown) => console.error(`tree: closing Chrome: ${error instanceof Error ? error.message : error}`));
    local?.server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
