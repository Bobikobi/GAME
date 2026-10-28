/**
 * The skill tree screen (frame S1 "a tree of wings", DECISIONS 2026-10-23 "The skill tree screen",
 * "The tree is data" and "Platform priority"). The race is the trunk in the middle, each school a wing
 * around it, and the tree can grow to hundreds of nodes: it is a map to pan and zoom, and only what is
 * on screen is drawn.
 *
 * Made for a computer first: the wheel zooms where the pointer is, a drag pans, a node shows a card
 * while the pointer rests on it, and the keys move between nodes (arrows), pan the map (Shift and an
 * arrow, Home back to the trunk), zoom (+ and -), show the
 * whole tree (0) or one wing (1 to 9), learn the chosen node (L) and show its number (V). A phone keeps
 * working: a drag pans, two fingers zoom, a tap chooses a node and a long press shows its number, and
 * at the starting zoom every node takes a tap 44 px wide. No number is written on the tree: a node says
 * its name and one sentence, and its number shows only when asked for.
 *
 * Every change goes through session.act(), and the reasons a node cannot be learned are the kernel's
 * own words (session.check()).
 */
import { ATTRIBUTES, attrAt, characterLevel, nodeCost, skillPoints, slotsOpen, treeNode, type Bundle } from '@game/kernel';
import { app } from '../app';
import type { GameSession } from '../session-surface';
import { ATTRIBUTE_MAX } from '../text';
import { TREE_GAP, TRUNK_RADIUS, layoutTree, type Box, type PlacedNode, type TreeLayout } from '../treelayout';
import { button, h, sprite } from './dom';
import type { UI } from './ui';

/** Pixels in one step of the layout at zoom 1. */
export const TREE_UNIT = 56;
export const TREE_ZOOM_MIN = 0.12;
export const TREE_ZOOM_MAX = 2.5;
/** A tap on a phone is at least this wide at the starting zoom. */
export const TREE_TAP = 44;
/** How long a press is held before it shows the node's number. */
const LONG_PRESS_MS = 450;
/** How far a press moves before it is a drag and no longer a tap. */
const DRAG_PX = 6;

/** What the screen keeps while the kit stays open: where it looks, the node chosen, whether its number shows. */
export interface TreeMemo {
  cam?: { x: number; y: number; zoom: number };
  touched?: string;
  reveal?: boolean;
  /** the last change came from the keys: the chosen node takes the focus back after the page is drawn again */
  keys?: boolean;
  cache?: { schools: Bundle['schools']; race: string; tree: TreeLayout };
}

/** The words for each effect a node can carry, for the number shown when asked for. */
const EFFECT_WORDS: Record<string, string> = {
  see_ripe: 'Ripe plants show after dark',
  timing_window_pct: 'Wider good zone in a timing game',
  second_hint: 'A second hint, further away',
  rare_find_pct: 'Rare finds',
  craft_speed_pct: 'Making speed',
  meal_fill_pct: 'Meals fill more',
  gather_speed_pct: 'Gathering speed',
  dig_speed_pct: 'Digging speed',
  craft_chance_pct: 'Making chance',
};

const SIZE_WORDS: Record<string, string> = { small: 'Small', major: 'Major', corner: 'Corner', keystone: 'Keystone' };

/** A node's number in words, shown only when asked for. */
export function nodeNumber(effect: string, value: number): string {
  const words = EFFECT_WORDS[effect] ?? effect.replaceAll('_', ' ');
  if (effect.endsWith('_pct')) return `${words} +${value}%`;
  return `${words} (${value})`;
}

const costWords = (n: number) => (n === 1 ? '1 point' : `${n} points`);

type NodeState = 'learned' | 'open' | 'locked';

/** The layout of this player's tree, made again only when the schools or the race change; a new tree drops the old camera. */
function layoutFor(memo: TreeMemo, b: Bundle, race: string): TreeLayout {
  if (memo.cache?.schools !== b.schools || memo.cache.race !== race) {
    memo.cache = { schools: b.schools, race, tree: layoutTree(b, race) };
    memo.cam = undefined;
  }
  return memo.cache.tree;
}

/** The skill tree page: the map of the tree, the chosen node's card, the build and the keys. */
export function treeScreen(ui: UI, memo: TreeMemo, after: () => void): HTMLElement {
  const s = app.session;
  const b = app.bundle;
  if (!s) return h('p', { class: 'kit-hint' }, 'No character yet.');
  const st = s.state;
  const race = st.player.race;
  const tree = layoutFor(memo, b, race);
  const learned = new Set(st.player.nodes ?? []);
  const build = st.player.build ?? [];
  const points = skillPoints(b, st);
  const wide = window.matchMedia('(min-width: 900px)').matches;
  // a phone: a finger on a narrow screen; the computer's wide window is the layout the tree is made for
  const coarse = window.matchMedia('(pointer: coarse)').matches || !wide;
  const stateOf = (p: PlacedNode): NodeState => (learned.has(p.key) ? 'learned' : p.needs.every((k) => learned.has(k)) ? 'open' : 'locked');
  const tintOf = (school: string) => tree.schools.find((sc) => sc.id === school)?.tint ?? 'wood';
  const firstRoot = tree.nodes.find((p) => p.key === tree.schools[0]?.roots[0]);
  const why = (p: PlacedNode): string | undefined => s.check({ t: 'learn_node', node: p.key, at: s.pos });

  const act = async (action: Parameters<GameSession['act']>[0], keys = false) => {
    memo.keys = keys;
    const r = await s.act(action);
    if (!r.ok) ui.toast(r.error, 'bad');
    after();
  };
  const learn = (key: string | undefined, keys = false) => {
    if (key) void act({ t: 'learn_node', node: key, at: s.pos }, keys);
  };

  // ------------------------------------------------------------ the camera
  const fresh = memo.cam === undefined;
  const cam = memo.cam ?? { x: 0, y: 0, zoom: 1 };
  memo.cam = cam;
  let vw = 0;
  let vh = 0;
  const px = () => TREE_UNIT * cam.zoom;
  const toScreen = (x: number, y: number) => ({ x: (x - cam.x) * px() + vw / 2, y: (y - cam.y) * px() + vh / 2 });
  const toWorld = (x: number, y: number) => ({ x: (x - vw / 2) / px() + cam.x, y: (y - vh / 2) / px() + cam.y });
  const clampZoom = (z: number) => Math.min(TREE_ZOOM_MAX, Math.max(TREE_ZOOM_MIN, z));

  // ------------------------------------------------------------ the map's parts
  const canvas = h('canvas', { class: 'tree-lines', 'aria-hidden': 'true' });
  const layer = h('div', { class: 'tree-layer' });
  const hover = h('div', { class: 'tree-hover kit-paper', hidden: true, role: 'tooltip' });
  const raceName = b.races[race]?.name ?? 'You';
  const trunk = h('div', { class: 'tree-trunk', 'aria-hidden': 'true' }, h('span', null, raceName));
  const labels = tree.schools.map((sc) => h('div', { class: `tree-label kit-plate tint-${sc.tint}`, 'aria-hidden': 'true' }, sc.name));
  layer.append(trunk, ...labels);
  const view = h(
    'div',
    {
      class: 'tree-view',
      tabindex: '0',
      role: 'group',
      'aria-label': 'The skill tree. Arrow keys move between nodes, Shift and an arrow pan, plus and minus zoom, 0 shows the whole tree, 1 to 9 a school, L learns the chosen node, V shows its number.',
    },
    canvas,
    layer,
    hover,
  );

  const pool = new Map<string, { el: HTMLButtonElement; icon: number }>();
  let queued = 0;
  let suppressClick = false;

  const nodeEl = (p: PlacedNode): HTMLButtonElement => {
    const el = h('button', { class: `tree-node kit-node size-${p.node.size} tint-${tintOf(p.school)}`, type: 'button', tabindex: '-1', 'data-node': p.key });
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!suppressClick) touch(p.key);
    });
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse' && !view.classList.contains('dragging')) showHover(p);
    });
    el.addEventListener('pointerleave', () => hideHover());
    return el;
  };

  const label = (p: PlacedNode, state: NodeState): string =>
    `${p.node.name}, ${(SIZE_WORDS[p.node.size] ?? p.node.size).toLowerCase()}, ${state === 'learned' ? 'learned' : state === 'open' ? 'can be learned' : 'locked'}`;

  /** Draws what is on screen: the lines on the canvas, a button for each node in view and no other, the trunk, the names. */
  const draw = () => {
    queued = 0;
    if (!view.isConnected) return;
    const t0 = performance.now();
    vw = view.clientWidth;
    vh = view.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(vw * dpr) || canvas.height !== Math.round(vh * dpr)) {
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
    }
    const margin = 1;
    const tl = toWorld(0, 0);
    const br = toWorld(vw, vh);
    const boxIn = (x0: number, y0: number, x1: number, y1: number) => x1 >= tl.x - margin && x0 <= br.x + margin && y1 >= tl.y - margin && y0 <= br.y + margin;
    // the lines, in the theme's colours: learned paths in ink, the rest quiet, a need across wings dashed in brass
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const css = getComputedStyle(view);
      const ink = css.getPropertyValue('--kit-ink').trim();
      const quiet = css.getPropertyValue('--kit-canvas-line').trim();
      const across = css.getPropertyValue('--kit-brass-dark').trim();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, vw, vh);
      const width = Math.max(2, Math.round(4 * Math.min(1, cam.zoom)));
      const line = (ax: number, ay: number, bx: number, by: number, colour: string, dashed: boolean) => {
        if (!boxIn(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by))) return;
        const a = toScreen(ax, ay);
        const c = toScreen(bx, by);
        ctx.strokeStyle = colour;
        ctx.lineWidth = width;
        ctx.setLineDash(dashed ? [width * 2, width * 2] : []);
        ctx.beginPath();
        ctx.moveTo(Math.round(a.x), Math.round(a.y));
        ctx.lineTo(Math.round(c.x), Math.round(c.y));
        ctx.stroke();
      };
      for (const sc of tree.schools) {
        for (const k of sc.roots) {
          const p = tree.byKey.get(k);
          if (p) line(0, 0, p.x, p.y, learned.has(k) ? ink : quiet, false);
        }
      }
      for (const p of tree.nodes) {
        for (const k of p.needs) {
          const q = tree.byKey.get(k);
          if (!q) continue;
          const crossing = q.school !== p.school;
          line(q.x, q.y, p.x, p.y, learned.has(k) && learned.has(p.key) ? ink : crossing ? across : quiet, crossing);
        }
      }
    }
    // the trunk and the schools' names
    const t = toScreen(0, 0);
    const tr = Math.max(16, TRUNK_RADIUS * px());
    trunk.style.width = trunk.style.height = `${Math.round(tr * 2)}px`;
    trunk.style.transform = `translate(${Math.round(t.x - tr)}px, ${Math.round(t.y - tr)}px)`;
    tree.schools.forEach((sc, i) => {
      const at = toScreen(sc.label.x, sc.label.y);
      // the plate's near edge sits on the wing's axis, so a long name grows away from the tree, never over it
      const rad = (sc.angle * Math.PI) / 180;
      const ax = Math.round(-50 + 50 * Math.cos(rad));
      const ay = Math.round(-50 + 50 * Math.sin(rad));
      labels[i]!.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px) translate(${ax}%, ${ay}%)`;
    });
    // the nodes in view, each a button; a phone's tap reaches a little past a small node, never into the next one
    const reach = coarse ? Math.min(TREE_TAP, TREE_GAP * px() * 0.9) : 0;
    const seen = new Set<string>();
    for (const p of tree.nodes) {
      if (!boxIn(p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r)) continue;
      seen.add(p.key);
      let entry = pool.get(p.key);
      if (!entry) {
        entry = { el: nodeEl(p), icon: -1 };
        pool.set(p.key, entry);
        layer.append(entry.el);
      }
      const size = Math.max(8, Math.round(p.r * 2 * px()));
      const at = toScreen(p.x, p.y);
      const el = entry.el;
      el.style.width = el.style.height = `${size}px`;
      el.style.transform = `translate(${Math.round(at.x - size / 2)}px, ${Math.round(at.y - size / 2)}px)`;
      el.style.setProperty('--tap', `${Math.max(0, Math.ceil((reach - size) / 2))}px`);
      const state = stateOf(p);
      el.classList.toggle('learned', state === 'learned');
      el.classList.toggle('open', state === 'open');
      el.classList.toggle('locked', state === 'locked');
      el.classList.toggle('touched', memo.touched === p.key);
      el.classList.toggle('in-build', build.includes(p.key));
      el.setAttribute('aria-label', label(p, state));
      // the item's picture inside, at the largest whole scale that fits
      const scale = size >= 40 ? 2 : size >= 22 ? 1 : 0;
      if (entry.icon !== scale) {
        entry.icon = scale;
        const item = p.node.icon ? b.items[p.node.icon] : undefined;
        el.replaceChildren(scale > 0 && item ? sprite(b, item.sprite, scale) : '');
      }
    }
    for (const [key, entry] of pool) {
      if (seen.has(key) || entry.el === document.activeElement) continue;
      entry.el.remove();
      pool.delete(key);
    }
    view.dataset.drawn = String(pool.size);
    view.dataset.zoom = cam.zoom.toFixed(3);
    view.dataset.cam = `${cam.x.toFixed(3)},${cam.y.toFixed(3)}`;
    // how long a draw takes, the last and the longest, for the tests that hold a big tree to a frame
    const ms = performance.now() - t0;
    view.dataset.drawMs = ms.toFixed(1);
    view.dataset.drawMax = Math.max(ms, Number(view.dataset.drawMax ?? 0)).toFixed(1);
  };
  const redraw = () => {
    if (!queued) queued = requestAnimationFrame(draw);
  };

  const zoomAt = (factor: number, sx = vw / 2, sy = vh / 2) => {
    const before = toWorld(sx, sy);
    cam.zoom = clampZoom(cam.zoom * factor);
    const now = toWorld(sx, sy);
    cam.x += before.x - now.x;
    cam.y += before.y - now.y;
    redraw();
  };
  const fit = (box: Box) => {
    vw = view.clientWidth || vw;
    vh = view.clientHeight || vh;
    const pad = 0.8;
    const w = (box.x1 - box.x0 + pad * 2) * TREE_UNIT;
    const hgt = (box.y1 - box.y0 + pad * 2) * TREE_UNIT;
    cam.zoom = clampZoom(Math.min(vw / Math.max(1, w), vh / Math.max(1, hgt)));
    cam.x = (box.x0 + box.x1) / 2;
    cam.y = (box.y0 + box.y1) / 2;
    redraw();
  };
  /** Brings a node into view when it is near an edge or past it. */
  const bringIn = (p: PlacedNode) => {
    const at = toScreen(p.x, p.y);
    const edge = 56;
    if (at.x < edge || at.x > vw - edge || at.y < edge || at.y > vh - edge) {
      cam.x = p.x;
      cam.y = p.y;
    }
  };

  // ------------------------------------------------------------ the hover card and the card
  const showHover = (p: PlacedNode) => {
    const state = stateOf(p);
    hover.replaceChildren(
      h('b', null, p.node.name),
      h('span', { class: 'tree-size' }, `${SIZE_WORDS[p.node.size]} - ${costWords(nodeCost(b, p.node))}`),
      h('p', null, p.node.text),
      state === 'learned' ? h('p', { class: 'tree-ok' }, build.includes(p.key) ? 'Learned, in your build.' : 'Learned.') : h('p', { class: 'tree-why' }, why(p) ?? 'You can learn this now.'),
    );
    hover.hidden = false;
    const at = toScreen(p.x, p.y);
    const r = p.r * px();
    const w = Math.min(300, vw - 16);
    const x = Math.max(8, Math.min(vw - w - 8, at.x + r + 12));
    const below = at.y < vh / 2;
    hover.style.width = `${w}px`;
    hover.style.transform = `translate(${Math.round(x)}px, ${Math.round(below ? at.y + r + 8 : at.y - r - 8)}px)${below ? '' : ' translateY(-100%)'}`;
  };
  const hideHover = () => {
    hover.hidden = true;
  };

  const card = (): HTMLElement => {
    const p = memo.touched ? tree.byKey.get(memo.touched) : undefined;
    if (!p) {
      return h(
        'section',
        { class: 'tree-card kit-paper empty' },
        h('p', null, coarse ? 'Tap a node to read it. Hold it to see its number.' : 'Rest the pointer on a node to read it, click it to choose it. V shows its number.'),
      );
    }
    const state = stateOf(p);
    const refusal = state === 'learned' ? undefined : why(p);
    const technique = p.node.slot === true;
    const inBuild = build.includes(p.key);
    const open = slotsOpen(b, st);
    const actions: HTMLElement[] = [];
    if (state !== 'learned') actions.push(button('Learn', () => learn(p.key), 'kit-btn tree-learn', refusal !== undefined));
    if (state === 'learned' && technique && !inBuild) {
      actions.push(button('Put in the build', () => void act({ t: 'equip', node: p.key, slot: Math.min(build.length, open), at: s.pos }), 'kit-btn tree-equip', build.length >= open));
    }
    if (inBuild) actions.push(button('Take it out', () => void act({ t: 'unequip', slot: build.indexOf(p.key), at: s.pos }), 'kit-btn tree-unequip'));
    const school = b.schools[p.school];
    const cluster = school?.clusters?.find((c) => c.id === p.node.cluster);
    return h(
      'section',
      { class: 'tree-card kit-paper', 'aria-live': 'polite', 'data-card': p.key },
      h('div', { class: 'tree-card-head' }, h('b', null, p.node.name), h('span', { class: 'tree-size' }, `${SIZE_WORDS[p.node.size]} - ${costWords(nodeCost(b, p.node))}`)),
      h('p', { class: 'tree-where' }, [school?.name, cluster?.name].filter(Boolean).join(' - ')),
      h('p', null, p.node.text),
      memo.reveal ? h('p', { class: 'tree-number' }, nodeNumber(p.node.effect, p.node.value)) : null,
      state === 'learned'
        ? h('p', { class: 'tree-ok' }, technique ? (inBuild ? 'Learned, and in your build.' : 'Learned. It works while it sits in the build.') : 'Learned. It always works.')
        : h('p', { class: refusal ? 'tree-why' : 'tree-ok' }, refusal ?? 'You can learn this now.'),
      actions.length ? h('div', { class: 'actions' }, actions) : null,
    );
  };

  // ------------------------------------------------------------ the build and the keys
  const buildStrip = (): HTMLElement => {
    const levels = b.params.growth?.slot_levels ?? [];
    const open = slotsOpen(b, st);
    return h(
      'section',
      { class: 'tree-build' },
      h('div', { class: 'tree-build-head' }, h('span', null, 'Your build'), h('span', { class: 'tree-build-note' }, 'changed at a fire, a camp or in town')),
      h(
        'div',
        { class: 'tree-slots' },
        levels.map((at, i) => {
          const key = build[i];
          const found = key ? treeNode(b, key) : undefined;
          if (found && key) {
            const item = found.node.icon ? b.items[found.node.icon] : undefined;
            return h(
              'button',
              { class: 'tree-slot filled', type: 'button', 'data-slot': String(i), title: found.node.name, onclick: () => touch(key) },
              item ? sprite(b, item.sprite, 2) : null,
              h('span', null, found.node.name),
            );
          }
          return h('div', { class: `tree-slot ${i < open ? 'empty' : 'closed'}`, 'data-slot': String(i) }, i < open ? 'empty' : `at level ${at}`);
        }),
      ),
    );
  };

  const keysBox = (): HTMLElement =>
    h(
      'details',
      { class: 'tree-keys kit-paper', open: wide || points > 0 },
      h('summary', null, points > 0 ? `Keys - ${points} point${points > 1 ? 's' : ''} to spend` : 'Keys'),
      h(
        'div',
        { class: 'tree-key-list' },
        ATTRIBUTES.map((attr) => {
          const value = attrAt(b, st, attr);
          const full = st.player.attrs[attr] >= ATTRIBUTE_MAX;
          return h(
            'div',
            { class: 'tree-key' },
            h('span', { class: 'tree-key-name' }, attr[0]!.toUpperCase() + attr.slice(1)),
            h('span', { class: 'tree-pips', role: 'img', 'aria-label': `${attr} ${value} of ${ATTRIBUTE_MAX}` }, Array.from({ length: ATTRIBUTE_MAX }, (_, i) => h('i', { class: i < value ? 'on' : '' }))),
            points > 0 && !full ? button('+', () => void act({ t: 'spend', attr }), 'kit-btn tree-plus') : null,
          );
        }),
      ),
    );

  const side = h('div', { class: 'tree-side' });
  const fillSide = () => side.replaceChildren(card(), keysBox());

  // ------------------------------------------------------------ choosing and moving
  const choose = (key: string) => {
    memo.touched = key;
    memo.reveal = false;
    hideHover();
    fillSide();
    redraw();
  };
  const touch = (key: string) => {
    memo.keys = false;
    choose(key);
  };

  /** The node nearest in a direction from the chosen one, for the arrow keys. */
  const nearest = (dx: number, dy: number): PlacedNode | undefined => {
    const from = memo.touched ? tree.byKey.get(memo.touched) : undefined;
    if (!from) return firstRoot;
    let best: PlacedNode | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const p of tree.nodes) {
      if (p === from) continue;
      const ox = p.x - from.x;
      const oy = p.y - from.y;
      const along = ox * dx + oy * dy;
      if (along <= 0.05) continue;
      const score = along + Math.abs(ox * dy - oy * dx) * 2;
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best;
  };

  const focusNode = (p: PlacedNode) => {
    bringIn(p);
    memo.keys = true;
    choose(p.key);
    draw();
    pool.get(p.key)?.el.focus({ preventScroll: true });
  };

  const DIRS: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  view.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    let handled = true;
    const dir = DIRS[k];
    if (dir && e.shiftKey) {
      // Shift and an arrow pan the map a quarter of the view, the keys' way across a tree too big for the screen
      cam.x += (dir[0] * vw) / 4 / px();
      cam.y += (dir[1] * vh) / 4 / px();
      redraw();
    } else if (dir) {
      const p = nearest(dir[0], dir[1]);
      if (p) focusNode(p);
    } else if (k === '+' || k === '=') zoomAt(1.25);
    else if (k === '-' || k === '_') zoomAt(0.8);
    else if (k === '0') fit(tree.bounds);
    else if (/^[1-9]$/.test(k) && tree.schools[Number(k) - 1]) fit(tree.schools[Number(k) - 1]!.bounds);
    else if (k === 'l' || k === 'L') learn(memo.touched, true);
    else if (k === 'v' || k === 'V') {
      memo.reveal = !memo.reveal;
      fillSide();
    } else if (k === 'Home') {
      cam.x = 0;
      cam.y = 0;
      redraw();
    } else handled = false;
    // the game's own keys (the arrows walk, X closes) stay out of the tree while it has them
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  view.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const r = view.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    },
    { passive: false },
  );
  view.addEventListener('contextmenu', (e) => e.preventDefault());

  // a drag pans, two fingers zoom, a held press shows the number
  const downs = new Map<number, { x: number; y: number }>();
  let moved = 0;
  let pinch: { d: number; zoom: number } | undefined;
  let held: number | undefined;
  const local = (e: PointerEvent) => {
    const r = view.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  view.addEventListener('pointerdown', (e) => {
    downs.set(e.pointerId, local(e));
    moved = 0;
    suppressClick = false;
    window.clearTimeout(held);
    if (downs.size === 2) {
      const [a, c] = [...downs.values()];
      pinch = { d: Math.hypot(a!.x - c!.x, a!.y - c!.y), zoom: cam.zoom };
      return;
    }
    const key = (e.target as Element).closest?.('[data-node]')?.getAttribute('data-node');
    if (key) {
      held = window.setTimeout(() => {
        if (moved > DRAG_PX || downs.size !== 1) return;
        suppressClick = true;
        memo.touched = key;
        memo.reveal = true;
        fillSide();
        redraw();
      }, LONG_PRESS_MS);
    }
  });
  view.addEventListener('pointermove', (e) => {
    const last = downs.get(e.pointerId);
    if (!last) return;
    const now = local(e);
    downs.set(e.pointerId, now);
    if (downs.size === 2 && pinch) {
      const [a, c] = [...downs.values()];
      const d = Math.hypot(a!.x - c!.x, a!.y - c!.y);
      zoomAt(clampZoom((pinch.zoom * d) / Math.max(1, pinch.d)) / cam.zoom, (a!.x + c!.x) / 2, (a!.y + c!.y) / 2);
      suppressClick = true;
      return;
    }
    moved += Math.hypot(now.x - last.x, now.y - last.y);
    if (moved <= DRAG_PX) return;
    if (!view.classList.contains('dragging')) {
      suppressClick = true;
      window.clearTimeout(held);
      view.setPointerCapture?.(e.pointerId);
      view.classList.add('dragging');
      hideHover();
    }
    cam.x -= (now.x - last.x) / px();
    cam.y -= (now.y - last.y) / px();
    redraw();
  });
  const up = (e: PointerEvent) => {
    downs.delete(e.pointerId);
    if (downs.size < 2) pinch = undefined;
    window.clearTimeout(held);
    view.classList.remove('dragging');
    // the click that ends a drag or a held press is not a choice; the next one is
    if (suppressClick) window.setTimeout(() => (suppressClick = false), 0);
  };
  view.addEventListener('pointerup', up);
  view.addEventListener('pointercancel', up);

  // ------------------------------------------------------------ the page
  const schoolButtons = tree.schools.map((sc, i) => {
    const el = button(sc.name, () => fit(sc.bounds), `kit-btn tree-school tint-${sc.tint}`);
    el.title = `Show ${sc.name} (${i + 1})`;
    return el;
  });
  const schoolsRow = h('nav', { class: 'tree-schools', 'aria-label': 'Show one school' }, schoolButtons, button('Whole tree', () => fit(tree.bounds), 'kit-btn tree-fit'));
  const zoomOut = button('-', () => zoomAt(0.8), 'kit-btn tree-zoom-out');
  const zoomIn = button('+', () => zoomAt(1.25), 'kit-btn tree-zoom-in');
  zoomOut.setAttribute('aria-label', 'Zoom out');
  zoomIn.setAttribute('aria-label', 'Zoom in');
  const head = h(
    'div',
    { class: 'tree-head' },
    h('span', { class: 'tree-who' }, `${st.player.name ? `${st.player.name}, ` : ''}${raceName.toLowerCase()}, level ${characterLevel(b, st)}`),
    h('span', { class: `tree-points ${points > 0 ? 'some' : ''}`.trim() }, points > 0 ? `${points} point${points > 1 ? 's' : ''} to spend` : 'No points to spend'),
  );
  fillSide();
  const page = h(
    'div',
    { class: 'tree-page' },
    h('div', { class: 'tree-main' }, head, schoolsRow, h('div', { class: 'tree-frame' }, view, h('div', { class: 'tree-tools' }, zoomOut, zoomIn)), buildStrip()),
    side,
  );

  // the first look: the whole tree on a computer; on a phone the trunk and the first nodes, at a size a finger can take
  const ro = new ResizeObserver(() => {
    if (!view.isConnected) {
      ro.disconnect();
      return;
    }
    const first = vw === 0;
    vw = view.clientWidth;
    vh = view.clientHeight;
    if (first && fresh) {
      if (!wide) {
        cam.zoom = 1;
        cam.x = 0;
        cam.y = 0;
      } else fit(tree.bounds);
    }
    draw();
    if (first && memo.keys && memo.touched) pool.get(memo.touched)?.el.focus({ preventScroll: true });
  });
  ro.observe(view);
  return page;
}
