/**
 * The forest crowns at 64 px per tile (rich wave 3c): `props/canopy_1..3`, each 128 x 128 (a block of 2 x 2 forest tiles).
 * The old crowns were 32 x 32 sprites at 16 px per tile, so a forest showed a grid of identical blocks. A crown is now a
 * union of rounded lobes with a scalloped edge, lit from the top left: every lobe is a dome whose slope sets one of the
 * green ramp's steps, broken into leaf clumps (a jittered cell grid, each clump lit on its upper left, a dark crevice
 * between neighbours) with a few pale leaf glints. The silhouette's lower right edge takes the ramp's darkest step. The
 * three variants differ in their lobes. `pnpm art:crowns` writes the PNGs, their kit.json entries and manifest lines.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { PNG } from 'pngjs';

import { hexToRgb } from '../kit/palette.js';
import { KIT_JSON, withSprite } from './pick.js';
import { ROOT } from './queue.js';

export const CROWN = 128;
/** The green ramp, dark to light (the shared `green` ramp's six steps). */
export const GREEN = ['#15301f', '#1f3d2b', '#2e6b3b', '#4c9a3f', '#84c450', '#c8e88a'] as const;

/** A seeded hash of three integers, 0 up to 1. */
function hash3(seed: number, a: number, b: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(a + 7, 0xc2b2ae35) ^ Math.imul(b + 13, 0x27d4eb2f);
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d);
  x = Math.imul(x ^ (x >>> 12), 0x297a2d39);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}

/** Smooth value noise, 0 up to 1, with lattice spacing `cell`. */
function noise(seed: number, x: number, y: number, cell: number): number {
  const ix = Math.floor(x / cell);
  const iy = Math.floor(y / cell);
  const fx = x / cell - ix;
  const fy = y / cell - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hash3(seed, ix, iy) * (1 - sx) + hash3(seed, ix + 1, iy) * sx;
  const bottom = hash3(seed, ix, iy + 1) * (1 - sx) + hash3(seed, ix + 1, iy + 1) * sx;
  return top * (1 - sy) + bottom * sy;
}

interface Lobe {
  x: number;
  y: number;
  r: number;
}

/** The lobes of a variant: a ring of big ones round a middle one, each wholly inside the 128 box. */
function lobesOf(seed: number): Lobe[] {
  const lobes: Lobe[] = [];
  const count = 11 + Math.floor(hash3(seed, 1, 1) * 4);
  for (let i = 0; i < count; i += 1) {
    const ring = i === 0 ? 0 : 1;
    const angle = (i / (count - 1)) * Math.PI * 2 + hash3(seed, 2, i) * 0.7;
    const spread = ring * (20 + hash3(seed, 3, i) * 22);
    const r = 17 + hash3(seed, 4, i) * 12 + (ring === 0 ? 8 : 0);
    const x = Math.min(CROWN - 2 - r, Math.max(2 + r, CROWN / 2 + Math.cos(angle) * spread));
    const y = Math.min(CROWN - 2 - r, Math.max(2 + r, CROWN / 2 + Math.sin(angle) * spread * 0.9));
    lobes.push({ x, y, r });
  }
  return lobes;
}

const LIGHT = (() => {
  const v = [-0.55, -0.75, 0.55];
  const n = Math.hypot(v[0]!, v[1]!, v[2]!);
  return [v[0]! / n, v[1]! / n, v[2]! / n] as const;
})();
const CLUMP = 12;
/** The silhouette's ink, the props' own. */
const INK = hexToRgb('#1b1a2e');

/** One crown as RGBA pixels. */
export function crownPng(seed: number): PNG {
  const lobes = lobesOf(seed);
  // the height of the crown at each pixel: the highest lobe dome there, a lobe lower on the page a little nearer the eye
  const height = new Float32Array(CROWN * CROWN);
  const inside = new Uint8Array(CROWN * CROWN);
  const top = new Int8Array(CROWN * CROWN);
  for (let y = 0; y < CROWN; y += 1) {
    for (let x = 0; x < CROWN; x += 1) {
      // a scalloped edge: the distance to a lobe is nudged by noise, so the silhouette is leafy, not a circle
      const wob = (noise(seed + 5, x, y, 6) - 0.5) * 7;
      let best = -1;
      let owner = 0;
      for (const [n, l] of lobes.entries()) {
        const d = Math.hypot(x - l.x, y - l.y) + wob;
        if (d >= l.r) continue;
        const dome = Math.sqrt(1 - (d / l.r) ** 2) * (l.r / 30) + (l.y / CROWN) * 0.35;
        if (dome > best) {
          best = dome;
          owner = n;
        }
      }
      if (best >= 0) {
        inside[y * CROWN + x] = 1;
        height[y * CROWN + x] = best;
        top[y * CROWN + x] = owner;
      }
    }
  }
  // no see-through pocket inside the crown (the ground may not show through an object): what the outside cannot reach is filled
  const outside = new Uint8Array(CROWN * CROWN);
  const stack: number[] = [];
  const reach = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= CROWN || y >= CROWN || inside[y * CROWN + x] || outside[y * CROWN + x]) return;
    outside[y * CROWN + x] = 1;
    stack.push(y * CROWN + x);
  };
  for (let n = 0; n < CROWN; n += 1) {
    reach(n, 0);
    reach(n, CROWN - 1);
    reach(0, n);
    reach(CROWN - 1, n);
  }
  while (stack.length > 0) {
    const at = stack.pop()!;
    const x = at % CROWN;
    const y = Math.floor(at / CROWN);
    reach(x - 1, y);
    reach(x + 1, y);
    reach(x, y - 1);
    reach(x, y + 1);
  }
  for (let n = 0; n < CROWN * CROWN; n += 1) {
    if (!inside[n] && !outside[n]) {
      inside[n] = 1;
      height[n] = 0.15;
    }
  }
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= CROWN || y >= CROWN ? 0 : height[y * CROWN + x]!);
  const png = new PNG({ width: CROWN, height: CROWN });
  const colors = GREEN.map((hex) => hexToRgb(hex));
  const px = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < CROWN && y < CROWN && inside[y * CROWN + x] === 1;
  const lowerRight2 = (x: number, y: number): boolean => !px(x + 2, y + 1) || !px(x + 1, y + 2) || !px(x + 2, y + 2);
  for (let y = 0; y < CROWN; y += 1) {
    for (let x = 0; x < CROWN; x += 1) {
      const i = (y * CROWN + x) * 4;
      if (!inside[y * CROWN + x]) continue;
      // the lobe on top here is a dome, lit from the top left: bright on its upper left, dark on its underside
      const lobe = lobes[top[y * CROWN + x]!]!;
      const lx = (x - lobe.x) / lobe.r;
      const ly = (y - lobe.y) / lobe.r;
      const lz = Math.sqrt(Math.max(0, 1 - lx * lx - ly * ly));
      const dome = lx * LIGHT[0] + ly * LIGHT[1] + lz * LIGHT[2];
      // the leaf clumps: the nearest of a jittered grid of centres, and the second nearest for the crevice between
      const gx = Math.floor(x / CLUMP);
      const gy = Math.floor(y / CLUMP);
      let near = 1e9;
      let second = 1e9;
      let cx = 0;
      let cy = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const px0 = (gx + ox + 0.25 + hash3(seed + 7, gx + ox, gy + oy) * 0.5) * CLUMP;
          const py0 = (gy + oy + 0.25 + hash3(seed + 8, gx + ox, gy + oy) * 0.5) * CLUMP;
          const d = Math.hypot(x - px0, y - py0);
          if (d < near) {
            second = near;
            near = d;
            cx = px0;
            cy = py0;
          } else if (d < second) second = d;
        }
      }
      const clump = (-(x - cx) * 0.55 - (y - cy) * 0.8) / (CLUMP * 0.5);
      let v = 1.55 + dome * 2.7 + clump * 0.75 - (y / CROWN - 0.5) * 1.2 + (hash3(seed + 9, x, y) - 0.5) * 0.4;
      // a higher lobe up and to the left throws its shadow here
      const above = Math.max(at(x - 3, y - 3), at(x - 5, y - 2), at(x - 2, y - 5));
      if (above > height[y * CROWN + x]! + 0.12) v -= 1.3;
      // the crevice between two clumps is a step darker
      if (second - near < 1.2 && hash3(seed + 12, cx | 0, cy | 0) > 0.45) v -= 0.6;
      let step = Math.max(1, Math.min(5, Math.round(v)));
      // a pale leaf glint on a lit clump
      if (step >= 4 && hash3(seed + 11, x, y) > 0.965) step = 5;
      // the silhouette: a dark edge, the darkest where it faces the lower right
      const edge = !px(x - 1, y) || !px(x, y - 1) || !px(x + 1, y) || !px(x, y + 1);
      // the silhouette is drawn in the sprites' ink; one step inside it, the lower right is the darkest green
      const inkEdge = edge;
      if (!inkEdge && lowerRight2(x, y)) step = Math.min(step, 1);
      else if (!inkEdge && !px(x + 2, y + 2) && step > 1) step -= 1;
      const [r, g, b] = inkEdge ? INK : colors[step]!;
      png.data.set([r, g, b, 255], i);
    }
  }
  return png;
}

const NAMES = ['canopy_1', 'canopy_2', 'canopy_3'] as const;
const SEEDS = [11, 23, 37] as const;
const SPEC = 'tools/src/art/crowns.ts';

/** Writes the three crowns, their kit.json entries and one manifest line each (kept on a rerun); returns the ids. */
export function writeCrowns(root = ROOT, today = new Date().toISOString().slice(0, 10)): string[] {
  const kitPath = join(root, KIT_JSON);
  const manifest = join(root, 'tools/kit-gen/rich-wave.manifest.jsonl');
  let kit = readFileSync(kitPath, 'utf8');
  const wrote: string[] = [];
  NAMES.forEach((name, n) => {
    const id = `props/${name}`;
    const file = join(root, 'content/kit/core', `${id}.png`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, PNG.sync.write(crownPng(SEEDS[n]!)));
    const before = existsSync(manifest) ? readFileSync(manifest, 'utf8') : '';
    const lines = before.split('\n').filter((l) => l.trim() !== '');
    const own = lines.findIndex((l) => l.includes(`"sprite":"${id}"`) && l.includes(SPEC));
    let number = own + 1;
    if (own < 0) {
      const lead = before === '' || before.endsWith('\n') ? '' : '\n';
      number = lines.length + 1;
      const line = { sprite: id, name, spec: SPEC, drawer: 'script', ref: id, what: 'a forest crown at 64 px: rounded lobes of leaf clumps, lit from the top left', ramps: ['green'], picked: `script, ${today}` };
      appendFileSync(manifest, `${lead}${JSON.stringify(line)}\n`);
    }
    kit = withSprite(kit, id, { file: `${id}.png`, w: CROWN, h: CROWN, density: 4, ramps: ['green'], source: { spec: SPEC, manifest: `tools/kit-gen/rich-wave.manifest.jsonl:${number}` } });
    wrote.push(id);
  });
  writeFileSync(kitPath, kit);
  return wrote;
}
