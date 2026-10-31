/**
 * The drawing parts the forest crowns and the trees share (rich wave 3c): a seeded hash and noise, a leaf mass made of
 * rounded lobes lit from the top left and broken into leaf clumps, tubes for trunks and limbs, the pocket fill and the ink
 * outline every kit sprite wears. Pure: the same inputs draw the same pixels.
 */
import { PNG } from 'pngjs';

import { hexToRgb } from '../kit/palette.js';

/** The silhouette's ink, the props' own. */
export const INK = hexToRgb('#1b1a2e');

/** A seeded hash of three integers, 0 up to 1. */
export function hash3(seed: number, a: number, b: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(a + 7, 0xc2b2ae35) ^ Math.imul(b + 13, 0x27d4eb2f);
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d);
  x = Math.imul(x ^ (x >>> 12), 0x297a2d39);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}

/** Smooth value noise, 0 up to 1, with lattice spacing `cell`. */
export function noise(seed: number, x: number, y: number, cell: number): number {
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

export interface Lobe {
  x: number;
  y: number;
  r: number;
}

const LIGHT = (() => {
  const v = [-0.55, -0.75, 0.55];
  const n = Math.hypot(v[0]!, v[1]!, v[2]!);
  return [v[0]! / n, v[1]! / n, v[2]! / n] as const;
})();

export type Rgb = readonly [number, number, number];

/** A drawing surface: RGBA pixels, transparent until something is put on it. */
export function surface(w: number, h: number): PNG {
  return new PNG({ width: w, height: h });
}

export function put(png: PNG, x: number, y: number, c: Rgb): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  png.data.set([c[0], c[1], c[2], 255], (y * png.width + x) * 4);
}

export const opaque = (png: PNG, x: number, y: number): boolean => x >= 0 && y >= 0 && x < png.width && y < png.height && png.data[(y * png.width + x) * 4 + 3] === 255;

export interface MassOptions {
  /** Where the mass's box sits on the surface, and its size. */
  ox: number;
  oy: number;
  w: number;
  h: number;
  seed: number;
  lobes: readonly Lobe[];
  /** The six steps of the ramp the leaves are drawn in, dark to light. */
  ramp: readonly Rgb[];
  /** Spacing of the leaf clumps, px. */
  clump: number;
  /** Moves the clump grid (a sway frame): the leaves shimmer without the silhouette moving. */
  shift?: readonly [number, number];
  /** The shade of the whole mass, in steps (a darker back crown is negative). */
  tone?: number;
  /** How bright the glints on lit clumps are, 0 none. */
  glints?: number;
}

/**
 * A leaf mass: the union of its lobes with a scalloped edge, every lobe a dome lit from the top left, the dome broken into
 * leaf clumps (a jittered cell grid, each clump lit on its upper left, a dark crevice between neighbours), a higher lobe
 * throwing its shadow on the one beside it, the lower right edge in the darkest step. Returns the mask it drew.
 */
export function drawMass(png: PNG, o: MassOptions): Uint8Array {
  const { w, h, seed, lobes } = o;
  const height = new Float32Array(w * h);
  const inside = new Uint8Array(w * h);
  const top = new Int16Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      // a scalloped edge: the distance to a lobe is nudged by noise, so the silhouette is leafy, not a circle
      const wob = (noise(seed + 5, x, y, 6) - 0.5) * 7;
      let best = -1;
      let owner = 0;
      for (const [n, l] of lobes.entries()) {
        const d = Math.hypot(x - l.x, y - l.y) + wob;
        if (d >= l.r) continue;
        const dome = Math.sqrt(1 - (d / l.r) ** 2) * (l.r / 30) + (l.y / h) * 0.35;
        if (dome > best) {
          best = dome;
          owner = n;
        }
      }
      if (best >= 0) {
        inside[y * w + x] = 1;
        height[y * w + x] = best;
        top[y * w + x] = owner;
      }
    }
  }
  const px = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && inside[y * w + x] === 1;
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? 0 : height[y * w + x]!);
  const lowerRight = (x: number, y: number): boolean => !px(x + 2, y + 1) || !px(x + 1, y + 2) || !px(x + 2, y + 2);
  const [sx, sy] = o.shift ?? [0, 0];
  const tone = o.tone ?? 0;
  const glints = o.glints ?? 1;
  const clumpSize = o.clump;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!inside[y * w + x]) continue;
      // the lobe on top here is a dome, lit from the top left: bright on its upper left, dark on its underside
      const lobe = lobes[top[y * w + x]!]!;
      const lx = (x - lobe.x) / lobe.r;
      const ly = (y - lobe.y) / lobe.r;
      const lz = Math.sqrt(Math.max(0, 1 - lx * lx - ly * ly));
      const dome = lx * LIGHT[0] + ly * LIGHT[1] + lz * LIGHT[2];
      // the leaf clumps: the nearest of a jittered grid of centres, and the second nearest for the crevice between
      const gx = Math.floor((x + sx) / clumpSize);
      const gy = Math.floor((y + sy) / clumpSize);
      let near = 1e9;
      let second = 1e9;
      let cx = 0;
      let cy = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const px0 = (gx + ox + 0.25 + hash3(seed + 7, gx + ox, gy + oy) * 0.5) * clumpSize - sx;
          const py0 = (gy + oy + 0.25 + hash3(seed + 8, gx + ox, gy + oy) * 0.5) * clumpSize - sy;
          const d = Math.hypot(x - px0, y - py0);
          if (d < near) {
            second = near;
            near = d;
            cx = px0;
            cy = py0;
          } else if (d < second) second = d;
        }
      }
      const clump = (-(x - cx) * 0.55 - (y - cy) * 0.8) / (clumpSize * 0.5);
      let v = 1.55 + tone + dome * 2.7 + clump * 1.0 - (y / h - 0.5) * 1.2 + (hash3(seed + 9, x, y) - 0.5) * 0.4;
      // a higher lobe up and to the left throws its shadow here
      const above = Math.max(at(x - 3, y - 3), at(x - 5, y - 2), at(x - 2, y - 5));
      if (above > height[y * w + x]! + 0.12) v -= 1.3;
      // the crevice between two clumps is a step darker
      if (second - near < 1.8 && hash3(seed + 12, Math.floor(cx), Math.floor(cy)) > 0.3) v -= 1.0;
      let step = Math.max(1, Math.min(5, Math.round(v)));
      // a pale leaf glint on a lit clump
      if (glints > 0 && step >= 4 && hash3(seed + 11, x, y) > 1 - 0.035 * glints) step = 5;
      // the lower right is the darkest green, one step in from the ink
      if (lowerRight(x, y)) step = Math.min(step, 1);
      else if (!px(x + 2, y + 2) && step > 1) step -= 1;
      put(png, o.ox + x, o.oy + y, o.ramp[step]!);
    }
  }
  return inside;
}

export interface Tube {
  x0: number;
  y0: number;
  r0: number;
  x1: number;
  y1: number;
  r1: number;
}

export interface TubeOptions {
  seed: number;
  /** Six steps, dark to light. */
  ramp: readonly Rgb[];
  /** The bark's ridges: how strongly the light breaks along the length, 0 smooth. */
  grain?: number;
  /** A step added to the whole (a limb in the crown's shade is darker). */
  tone?: number;
}

/**
 * Tubes (a trunk, its roots, limbs) drawn round: the nearest tube to a pixel decides its colour, the light from the left
 * (dark on the right side of the tube), ridges running along the tube.
 */
export function drawTubes(png: PNG, tubes: readonly Tube[], o: TubeOptions): void {
  let minX = 1e9;
  let minY = 1e9;
  let maxX = -1e9;
  let maxY = -1e9;
  for (const t of tubes) {
    const r = Math.max(t.r0, t.r1) + 2;
    minX = Math.min(minX, t.x0 - r, t.x1 - r);
    maxX = Math.max(maxX, t.x0 + r, t.x1 + r);
    minY = Math.min(minY, t.y0 - r, t.y1 - r);
    maxY = Math.max(maxY, t.y0 + r, t.y1 + r);
  }
  const grain = o.grain ?? 0.6;
  const tone = o.tone ?? 0;
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(png.height - 1, Math.ceil(maxY)); y += 1) {
    for (let x = Math.max(0, Math.floor(minX)); x <= Math.min(png.width - 1, Math.ceil(maxX)); x += 1) {
      let bestSide = 2;
      let bestAlong = 0;
      let bestIdx = -1;
      let bestR = 1;
      for (const [n, t] of tubes.entries()) {
        const dx = t.x1 - t.x0;
        const dy = t.y1 - t.y0;
        const len2 = dx * dx + dy * dy || 1;
        const u = Math.max(0, Math.min(1, ((x - t.x0) * dx + (y - t.y0) * dy) / len2));
        const cx = t.x0 + dx * u;
        const cy = t.y0 + dy * u;
        const r = t.r0 + (t.r1 - t.r0) * u;
        const side = Math.hypot(x - cx, y - cy) / r;
        if (side < bestSide) {
          // the signed side: negative on the left of the tube's axis, in screen terms
          const dist = Math.hypot(dx, dy) || 1;
          const nx = -dy / dist;
          const ny = dx / dist;
          const signed = ((x - cx) * nx + (y - cy) * ny) / r;
          bestSide = side;
          bestAlong = u * dist;
          bestIdx = n;
          bestR = signed * Math.sign(nx || 1);
        }
      }
      if (bestSide > 1 || bestIdx < 0) continue;
      // lit from the left: the left of the tube is the lightest, the right the darkest
      const across = Math.max(-1, Math.min(1, bestR));
      let v = 3.1 - across * 1.6 + tone;
      // ridges along the tube, and a speckle of lighter and darker bark
      v += (noise(o.seed + 3, x * 0.9 + bestAlong * 0.0, y * 0.12 + bestIdx * 7, 4) - 0.5) * 2 * grain;
      v += (hash3(o.seed + 4, x, y) - 0.5) * 0.5 * grain;
      // dark crevices between the ridges
      const ridge = noise(o.seed + 5, x * 0.55, y * 0.07 + bestIdx * 3, 3);
      if (ridge < 0.28 && grain > 0.5) v -= 1.2;
      const step = Math.max(1, Math.min(5, Math.round(v)));
      put(png, x, y, o.ramp[step]!);
    }
  }
}

/** Fills the see-through pockets a drawing encloses that are 24 px or smaller (the importer's rule: the ground may not show through a speck of an object). */
export function fillPockets(png: PNG, color: Rgb, limit = 24): void {
  const w = png.width;
  const h = png.height;
  const seen = new Uint8Array(w * h);
  for (let start = 0; start < w * h; start += 1) {
    if (seen[start] || png.data[start * 4 + 3] === 255) continue;
    const stack = [start];
    const cells: number[] = [];
    let open = false;
    seen[start] = 1;
    while (stack.length > 0) {
      const at = stack.pop()!;
      cells.push(at);
      const x = at % w;
      const y = Math.floor(at / w);
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) open = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (seen[n] || png.data[n * 4 + 3] === 255) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (!open && cells.length <= limit) for (const c of cells) put(png, c % w, Math.floor(c / w), color);
  }
}

/** The ink outline: every opaque pixel that touches nothing on one of its four sides is drawn in the sprites' ink. */
export function inkEdge(png: PNG): void {
  const w = png.width;
  const h = png.height;
  const edge: number[] = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!opaque(png, x, y)) continue;
      if (!opaque(png, x - 1, y) || !opaque(png, x + 1, y) || !opaque(png, x, y - 1) || !opaque(png, x, y + 1)) edge.push(y * w + x);
    }
  }
  for (const n of edge) put(png, n % w, Math.floor(n / w), INK);
}

/** The ramp's six steps as colours. */
export function rampOf(steps: readonly string[]): Rgb[] {
  return steps.map((hex) => hexToRgb(hex) as Rgb);
}

/** The opaque height of a surface in px. */
export function opaqueHeight(png: PNG): number {
  let first = -1;
  let last = -1;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (png.data[(y * png.width + x) * 4 + 3] === 255) {
        if (first < 0) first = y;
        last = y;
        break;
      }
    }
  }
  return first < 0 ? 0 : last - first + 1;
}
