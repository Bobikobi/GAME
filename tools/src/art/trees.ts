/**
 * The five trees at 64 px per tile (rich wave 3c), drawn to the heights the scale audit set: `props/tree_oak` (3 characters,
 * 192 x 320, two frames), `props/dead_tree` (2.5, 192 x 256, two frames), `props/young_tree` (2, 128 x 192),
 * `props/sapling` (1, 64 x 96) and the glade fig (3, 128 x 256, with and without its figs). A character is 73 art px.
 * Each is a trunk with roots drawn as tubes in the bark ramp, a crown of lit lobes and leaf clumps (foliage.ts) in the green
 * ramp over it, and the ink outline. A second frame sways the crown a pixel or two and shimmers its leaves; the silhouette's
 * base never moves. The sprite stands on its bottom centre, which is the trunk's foot.
 * `pnpm art:trees` writes the PNGs, their kit.json entries (with a declared `scale`) and one manifest line each.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { PNG } from 'pngjs';

import { type Lobe, type Rgb, type Tube, drawMass, drawTubes, fillPockets, hash3, inkEdge, opaqueHeight, put, rampOf, surface } from './foliage.js';
import { KIT_JSON, withSprite } from './pick.js';
import { ROOT } from './queue.js';

/** Art px of one character's opaque height (`chars/human_down`, NATURE section 1). */
export const CHARACTER_PX = 73;

const GREEN = rampOf(['#15301f', '#1f3d2b', '#2e6b3b', '#4c9a3f', '#84c450', '#c8e88a']);
const BARK = rampOf(['#1f1210', '#3f1e17', '#5e2e20', '#7f452a', '#a3633a', '#cc8e55']);
/** Dead wood: the ink, the purple greys, and one pale step for the bleached side. */
const DEAD = rampOf(['#1b1a2e', '#3a3554', '#3a3554', '#5d6177', '#5d6177', '#8f94a8']);
const PLUM = rampOf(['#241238', '#43204a', '#5b3373', '#7c4593', '#9a5bb0', '#c28bc9']);

export interface TreeDraw {
  /** The sprite's id in the core kit (or the fig's own kit). */
  id: string;
  /** The kit file the entry is written to, under content/kit. */
  kit: 'core' | 'ceosisrael';
  w: number;
  h: number;
  frames: number;
  ramps: readonly string[];
  what: string;
  /** False while the check still holds the sprite to a floor that is not its own (the sapling: the check calls it a young tree, 2 characters, until the scale audit lands its own row of 1). */
  declareScale?: boolean;
  draw: (frame: number) => PNG;
}

/** Lobes spread over an ellipse: a middle one, then rings, each clamped inside the box. */
function crownLobes(seed: number, w: number, h: number, cx: number, cy: number, rx: number, ry: number, rings: readonly (readonly [number, number, number])[], middle: number): Lobe[] {
  const lobes: Lobe[] = [{ x: cx, y: cy, r: middle }];
  for (const [ring, count, radius] of rings) {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + hash3(seed, 20 + Math.round(ring * 10), i) * 0.6;
      const r = radius * (0.88 + hash3(seed, 40 + Math.round(ring * 10), i) * 0.3);
      const x = Math.min(w - 3 - r, Math.max(3 + r, cx + Math.cos(angle) * rx * ring));
      const y = Math.min(h - 3 - r, Math.max(3 + r, cy + Math.sin(angle) * ry * ring));
      lobes.push({ x, y, r });
    }
  }
  return lobes;
}

/** The lobes swayed for a frame: the crown leans to the right at its top, not at its heart. */
function swayed(lobes: readonly Lobe[], h: number, frame: number, amount: number): Lobe[] {
  return lobes.map((l) => ({ ...l, x: l.x + frame * amount * (1 - l.y / h) }));
}

/** A trunk's tubes: a main line through the given points (x, y, r) and the roots spreading at its foot. */
function trunk(points: readonly (readonly [number, number, number])[], roots: readonly (readonly [number, number, number])[]): Tube[] {
  const tubes: Tube[] = [];
  for (let i = 0; i + 1 < points.length; i += 1) {
    const [x0, y0, r0] = points[i]!;
    const [x1, y1, r1] = points[i + 1]!;
    tubes.push({ x0, y0, r0, x1, y1, r1 });
  }
  const [fx, fy, fr] = points[0]!;
  for (const [x, y, r] of roots) {
    const side = Math.sign(x - fx) || 1;
    // a root leaves the trunk's side a little up from the foot, bows outward and goes into the ground
    tubes.push({ x0: fx + side * fr * 0.45, y0: fy - fr * 1.1, r0: fr * 0.42, x1: fx + (x - fx) * 0.6, y1: fy - fr * 0.1, r1: r * 1.5 });
    tubes.push({ x0: fx + (x - fx) * 0.6, y0: fy - fr * 0.1, r0: r * 1.5, x1: x, y1: y, r1: r * 0.7 });
  }
  return tubes;
}

function oak(frame: number): PNG {
  const W = 192;
  const H = 320;
  const png = surface(W, H);
  drawTubes(png, [
    ...trunk([[96, 316, 21], [96, 292, 18], [96, 250, 15], [97, 215, 13], [98, 190, 12]], [[62, 318, 4.5], [132, 318, 4.5]]),
    { x0: 98, y0: 214, r0: 9, x1: 62, y1: 168, r1: 6 },
    { x0: 98, y0: 210, r0: 9, x1: 136, y1: 170, r1: 6 },
  ], { seed: 301, ramp: BARK, tone: -0.35, grain: 1.0 });
  const box = { oy: 56, h: 188 };
  const lobes = swayed(crownLobes(31, W, box.h, 96, 94, 70, 62, [[0.55, 8, 33], [1, 15, 29]], 40), box.h, frame, 2.5);
  drawMass(png, { ox: 0, oy: box.oy, w: W, h: box.h, seed: 31, lobes, ramp: GREEN, clump: 20, shift: [frame * 3, frame * 2] });
  return finish(png);
}

function deadTree(frame: number): PNG {
  const W = 192;
  const H = 256;
  const png = surface(W, H);
  const tubes: Tube[] = [];
  const sway = (y: number): number => frame * 2.2 * Math.max(0, 1 - y / H) ** 1.5;
  // the trunk climbs with a twist, and from it limbs fork, thinner and shorter at each fork
  const add = (x: number, y: number, angle: number, len: number, r: number, depth: number, id: number): void => {
    const steps = 3;
    let px = x;
    let py = y;
    let pr = r;
    let a = angle;
    for (let i = 0; i < steps; i += 1) {
      a += (hash3(77, id, i) - 0.5) * 0.7;
      // limbs rise: no limb leans past 65 degrees, and none leaves the canvas
      a = Math.max(-1.15, Math.min(1.15, a));
      const nx = Math.max(10, Math.min(W - 10, px + Math.sin(a) * (len / steps)));
      const ny = Math.max(10, py - Math.cos(a) * (len / steps));
      const nr = Math.max(1.4, pr * (depth === 0 ? 0.86 : 0.8));
      tubes.push({ x0: px + sway(py), y0: py, r0: pr, x1: nx + sway(ny), y1: ny, r1: nr });
      px = nx;
      py = ny;
      pr = nr;
    }
    if (depth >= 5 || pr < 1.7) return;
    const forks = depth === 0 ? 3 : depth === 3 ? 3 : 2;
    for (let k = 0; k < forks; k += 1) {
      const spread = (k - (forks - 1) / 2) * (0.7 + hash3(78, id, k) * 0.35);
      add(px, py, a + spread, len * (0.7 + hash3(79, id, k) * 0.12), pr * 0.92, depth + 1, id * 7 + k + 1);
    }
  };
  add(96, 252, -0.04, 80, 21, 0, 1);
  // the roots grip the ground
  const roots: Tube[] = trunk([[96, 252, 21]], [[58, 254, 4], [134, 254, 4]]);
  drawTubes(png, [...tubes, ...roots], { seed: 401, ramp: DEAD, tone: -0.8, grain: 1.2 });
  return finish(png);
}

function youngTree(): PNG {
  const W = 128;
  const H = 192;
  const png = surface(W, H);
  drawTubes(png, trunk([[64, 190, 12], [64, 170, 10], [64, 140, 8], [65, 112, 7]], [[46, 191, 3.5], [82, 191, 3.5]]), { seed: 501, ramp: BARK, tone: -0.3, grain: 0.9 });
  const box = { oy: 20, h: 124 };
  const lobes = crownLobes(52, W, box.h, 64, 62, 38, 34, [[0.55, 6, 24], [1, 9, 20]], 28);
  drawMass(png, { ox: 0, oy: box.oy, w: W, h: box.h, seed: 52, lobes, ramp: GREEN, clump: 15 });
  return finish(png);
}

function sapling(): PNG {
  const W = 64;
  const H = 96;
  const png = surface(W, H);
  drawTubes(png, [
    { x0: 32, y0: 94, r0: 3.4, x1: 33, y1: 70, r1: 2.6 },
    { x0: 33, y0: 70, r0: 2.6, x1: 31, y1: 42, r1: 2 },
    { x0: 31, y0: 42, r0: 2, x1: 32, y1: 26, r1: 1.6 },
    { x0: 33, y0: 62, r0: 1.8, x1: 47, y1: 48, r1: 1.2 },
    { x0: 32, y0: 52, r0: 1.8, x1: 17, y1: 42, r1: 1.2 },
  ], { seed: 601, ramp: BARK, grain: 0.3 });
  const lobes: Lobe[] = [
    { x: 32, y: 24, r: 12 },
    { x: 20, y: 36, r: 9 },
    { x: 46, y: 40, r: 9 },
    { x: 41, y: 21, r: 8 },
    { x: 23, y: 20, r: 8 },
  ];
  drawMass(png, { ox: 0, oy: 4, w: W, h: 64, seed: 61, lobes: lobes.map((l) => ({ ...l, y: l.y - 4 + 4 })), ramp: GREEN, clump: 6 });
  return finish(png);
}

/** The glade fig: a slender trunk under a tall wide crown of big leaves, and plum figs hanging at its lower edge. */
function fig(frame: number, fruit: boolean): PNG {
  const W = 128;
  const H = 256;
  const png = surface(W, H);
  drawTubes(png, trunk([[63, 254, 10], [64, 232, 8], [66, 205, 6], [65, 180, 5]], [[42, 255, 3.5], [86, 255, 3.5]]), { seed: 701, ramp: BARK, tone: -0.2, grain: 0.9 });
  const box = { oy: 16, h: 190 };
  const lobes = swayed(crownLobes(71, W, box.h, 64, 100, 38, 76, [[0.5, 7, 27], [1, 11, 23]], 32), box.h, frame, 1.6);
  const mask = drawMass(png, { ox: 0, oy: box.oy, w: W, h: box.h, seed: 71, lobes, ramp: GREEN, clump: 22, tone: 0.15, glints: 0.6, shift: [frame * 3, frame * 2] });
  if (fruit) {
    // figs: small plum drops on the crown's face, each with a lit upper left and a dark under edge
    let placed = 0;
    for (let n = 0; n < 400 && placed < 12; n += 1) {
      const x = 16 + Math.floor(hash3(72, n, 1) * 96);
      const y = 50 + Math.floor(hash3(72, n, 2) * 130);
      const inCrown = (px: number, py: number): boolean => mask[py * W + px] === 1;
      if (!inCrown(x, y) || !inCrown(x - 9, y) || !inCrown(x + 9, y) || !inCrown(x, y + 11)) continue;
      drawFig(png, x, y + box.oy);
      placed += 1;
    }
  }
  return finish(png);
}

/** One fig, 8 x 10 px: a plum drop, lit from the upper left, in an ink outline. */
function drawFig(png: PNG, cx: number, cy: number): void {
  for (let dy = -9; dy <= 9; dy += 1) {
    for (let dx = -7; dx <= 7; dx += 1) {
      const rx = 6;
      const ry = dy < 0 ? 6.4 : 7.6;
      const d = (dx / rx) ** 2 + (dy / ry) ** 2;
      if (d > 1.15) continue;
      const edge = d > 0.78;
      const lit = (-dx * 0.6 - dy * 0.8) / 7;
      const step = edge ? 1 : Math.max(2, Math.min(5, Math.round(3 + lit * 2.2)));
      put(png, cx + dx, cy + dy, step === 1 ? ([0x1b, 0x1a, 0x2e] as Rgb) : PLUM[step]!);
    }
  }
}

/** The pocket fill, then the ink outline: what every kit sprite wears. */
function finish(png: PNG): PNG {
  fillPockets(png, GREEN[1]!);
  inkEdge(png);
  return png;
}

/** Frames side by side in one sheet. */
function sheet(frames: readonly PNG[]): PNG {
  const [first] = frames;
  const out = new PNG({ width: first!.width * frames.length, height: first!.height });
  frames.forEach((f, n) => PNG.bitblt(f, out, 0, 0, f.width, f.height, n * f.width, 0));
  return out;
}

export const TREES: readonly TreeDraw[] = [
  { id: 'props/tree_oak', kit: 'core', w: 192, h: 320, frames: 2, ramps: ['green', 'bark'], what: 'an oak at 64 px, three characters tall: a bark trunk with roots under a wide crown of lit lobes and leaf clumps, swaying a pixel in its second frame', draw: oak },
  { id: 'props/dead_tree', kit: 'core', w: 192, h: 256, frames: 2, ramps: ['grey', 'bark'], what: 'a dead tree at 64 px, two and a half characters tall: a twisting trunk forking into bare limbs, bark roots at its foot, the limbs swaying a pixel in its second frame', draw: deadTree },
  { id: 'props/young_tree', kit: 'core', w: 128, h: 192, frames: 1, ramps: ['green', 'bark'], what: 'a young tree at 64 px, two characters tall: a slim bark trunk under a rounded crown of lit lobes', draw: youngTree },
  { id: 'props/sapling', kit: 'core', w: 64, h: 96, frames: 1, ramps: ['green', 'bark'], what: 'a sapling at 64 px, a person tall: a thin curved stem with a few small leaf clusters', declareScale: false, draw: sapling },
  { id: 'props/fig_bush', kit: 'ceosisrael', w: 128, h: 256, frames: 2, ramps: ['green', 'plum', 'bark'], what: 'the glade fig held as a tree, three characters tall: a slender trunk under a tall crown of big leaves with plum figs', draw: (f) => fig(f, true) },
  { id: 'props/fig_bush_empty', kit: 'ceosisrael', w: 128, h: 256, frames: 2, ramps: ['green', 'bark'], what: 'the glade fig held as a tree, picked clean: the same crown without its figs', draw: (f) => fig(f, false) },
];

export function treeSheet(t: TreeDraw): PNG {
  return sheet(Array.from({ length: t.frames }, (_, f) => t.draw(f)));
}

const SPEC = 'tools/src/art/trees.ts';
const MANIFEST = 'tools/kit-gen/rich-wave.manifest.jsonl';

/** Writes the trees of the given ids (all by default), their kit.json entries and one manifest line each (kept on a rerun); returns the ids. */
export function writeTrees(only?: readonly string[], root = ROOT, today = new Date().toISOString().slice(0, 10)): string[] {
  const wrote: string[] = [];
  for (const t of TREES) {
    if (only && !only.includes(t.id)) continue;
    const sheetPng = treeSheet(t);
    const first = t.draw(0);
    const file = join(root, 'content/kit', t.kit, `${t.id}.png`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, PNG.sync.write(sheetPng));
    const scale = Math.round((opaqueHeight(first) / CHARACTER_PX) * 100) / 100;
    const kitPath = t.kit === 'core' ? join(root, KIT_JSON) : join(root, 'content/kit', t.kit, 'kit.json');
    const manifest = join(root, MANIFEST);
    const before = existsSync(manifest) ? readFileSync(manifest, 'utf8') : '';
    const lines = before.split('\n').filter((l) => l.trim() !== '');
    const own = lines.findIndex((l) => l.includes(`"sprite":"${t.id}"`) && l.includes(SPEC));
    let number = own + 1;
    if (own < 0) {
      const lead = before === '' || before.endsWith('\n') ? '' : '\n';
      number = lines.length + 1;
      const line = { sprite: t.id, name: t.id.split('/').pop(), spec: SPEC, drawer: 'script', ref: t.id, what: t.what, ramps: t.ramps, picked: `script, ${today}` };
      appendFileSync(manifest, `${lead}${JSON.stringify(line)}\n`);
    }
    const entry: Record<string, unknown> = { file: `${t.id}.png`, w: t.w, h: t.h, density: 4, ramps: t.ramps, ...(t.declareScale === false ? {} : { scale }), source: { spec: SPEC, manifest: `${MANIFEST}:${number}` } };
    if (t.frames > 1) entry.frames = t.frames;
    writeFileSync(kitPath, withSprite(readFileSync(kitPath, 'utf8'), t.id, entry));
    wrote.push(`${t.id} ${t.w}x${t.h} x${t.frames}, opaque ${opaqueHeight(first)} px = ${scale} characters`);
  }
  return wrote;
}
