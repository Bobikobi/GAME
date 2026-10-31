/**
 * The stone shading the ruin props share (rich wave 3d): a silhouette mask is lit from the top left through a bevel
 * taken from its own distance field (a lit upper-left rim, a dark lower-right rim), then broken by chisel grain, cracks,
 * moss on the upward faces and a wet dark foot, in the stone ramp. The look is the glade's standing stone and the shore
 * stones: grey-blue, one px of ink, a shaded underside. Pure: the same inputs draw the same pixels.
 */
import type { PNG } from 'pngjs';

import { type Rgb, hash3, noise, put } from './foliage.js';

/** A silhouette: one byte a pixel, 1 inside. */
export interface Mask {
  w: number;
  h: number;
  data: Uint8Array;
}

export function maskOf(w: number, h: number, inside: (x: number, y: number) => boolean): Mask {
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) data[y * w + x] = inside(x, y) ? 1 : 0;
  dropSpecks(w, h, data, 60);
  return { w, h, data };
}

/** Clears the pieces of a mask smaller than `min` px (a chipped edge throws specks off the silhouette). */
function dropSpecks(w: number, h: number, data: Uint8Array, min: number): void {
  const seen = new Uint8Array(w * h);
  for (let start = 0; start < w * h; start += 1) {
    if (!data[start] || seen[start]) continue;
    const cells: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const at = stack.pop()!;
      cells.push(at);
      const x = at % w;
      const y = Math.floor(at / w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (!data[n] || seen[n]) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (cells.length < min) for (const c of cells) data[c] = 0;
  }
}

/** Chips an edge: the point is nudged by smooth noise before the shape's test, so a straight edge is worn. */
export function chipped(seed: number, amount: number, cell = 5): (x: number, y: number) => readonly [number, number] {
  return (x, y) => [x + (noise(seed, x, y, cell) - 0.5) * 2 * amount, y + (noise(seed + 9, x, y, cell) - 0.5) * 2 * amount];
}

/** Euclidean-ish distance of every inside pixel to the nearest outside one (two chamfer passes, 3-4 weights), in px. */
export function distanceField(m: Mask): Float32Array {
  const { w, h, data } = m;
  const d = new Float32Array(w * h);
  const BIG = 1e6;
  for (let i = 0; i < w * h; i += 1) d[i] = data[i] ? BIG : 0;
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]!);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      if (!data[i]) continue;
      d[i] = Math.min(d[i]!, at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414);
    }
  }
  for (let y = h - 1; y >= 0; y -= 1) {
    for (let x = w - 1; x >= 0; x -= 1) {
      const i = y * w + x;
      if (!data[i]) continue;
      d[i] = Math.min(d[i]!, at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414);
    }
  }
  return d;
}

export interface StoneOptions {
  seed: number;
  /** Six steps of the stone ramp, dark to light. */
  stone: readonly Rgb[];
  /** Six steps of the moss ramp, dark to light. */
  moss: readonly Rgb[];
  /** The width of the lit/dark rim, px. */
  bevel?: number;
  /** A step added at a pixel by the piece's own form (a column's roundness, a block's joint, a carved line). */
  form?: (x: number, y: number) => number;
  /** How much of the upward faces moss takes, 0 none, 1 a lot. */
  moss_amount?: number;
  /** Rows at the foot that stand wet and dark. */
  foot?: number;
  /** How many cracks, 0 none. */
  cracks?: number;
  /** Where the piece's own ink is not wanted (a rubble pile's inner opening). */
  skip?: (x: number, y: number) => boolean;
}

/** Whether a pixel faces up: no stone in the few rows above it. */
function skyDistance(m: Mask, x: number, y: number, limit: number): number {
  for (let k = 1; k <= limit; k += 1) {
    const yy = y - k;
    if (yy < 0 || !m.data[yy * m.w + x]) return k;
  }
  return limit + 1;
}

/** Draws the mask as stone onto the surface (before the pocket fill and the ink edge). */
export function drawStone(png: PNG, m: Mask, o: StoneOptions): void {
  const { w, h } = m;
  const dist = distanceField(m);
  const B = o.bevel ?? 6;
  const mossAmount = o.moss_amount ?? 0.4;
  const foot = o.foot ?? 8;
  // the lowest stone pixel of each column, for the wet foot
  const bottom = new Int16Array(w).fill(-1);
  for (let x = 0; x < w; x += 1) for (let y = h - 1; y >= 0; y -= 1) if (m.data[y * w + x]) { bottom[x] = y; break; }
  const D = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? 0 : dist[y * w + x]!);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!m.data[y * w + x]) continue;
      if (o.skip?.(x, y)) continue;
      const d = D(x, y);
      // the outward normal from the field's slope, and how deep into the rim the pixel is
      const gx = D(x + 1, y) - D(x - 1, y);
      const gy = D(x, y + 1) - D(x, y - 1);
      const gl = Math.hypot(gx, gy) || 1;
      const nx = -gx / gl;
      const ny = -gy / gl;
      const rim = Math.max(0, 1 - d / B);
      const lit = nx * -0.62 + ny * -0.78;
      let v = 2.7 + lit * rim * 2.6;
      // large chisel patches, then a fine speckle
      v += (noise(o.seed + 1, x, y, 13) - 0.5) * 1.3;
      v += (noise(o.seed + 2, x, y, 4) - 0.5) * 0.9;
      v += (hash3(o.seed + 3, x, y) - 0.5) * 0.5;
      v += o.form?.(x, y) ?? 0;
      // cracks: thin ridged lines of the noise
      if (o.cracks) {
        const c = Math.abs(noise(o.seed + 4, x * 0.8, y * 1.1, 17) - 0.5);
        if (c < 0.012 * o.cracks) v -= 1.7;
        const c2 = Math.abs(noise(o.seed + 5, x * 1.2, y * 0.7, 23) - 0.5);
        if (c2 < 0.01 * o.cracks) v -= 1.5;
      }
      // the wet foot: darker over the last rows of the column, deepest on the bottom row
      const toBottom = bottom[x]! - y;
      if (toBottom < foot) v -= (1 - toBottom / foot) * 1.25;
      v = Math.max(0, Math.min(5, Math.round(v)));
      let colour: Rgb = o.stone[Math.max(1, v)]!;
      // moss: on faces that look up (a few rows of sky above) and low at the foot, in clumps
      const up = skyDistance(m, x, y, 6);
      const clump = noise(o.seed + 6, x, y, 7) * 0.7 + noise(o.seed + 7, x, y, 3) * 0.3;
      const onTop = up <= 5 ? (6 - up) / 6 : 0;
      const atFoot = toBottom < foot + 6 ? (1 - toBottom / (foot + 6)) * 0.7 : 0;
      if (clump + 0.0 > 1 - mossAmount * (onTop + atFoot) * 0.95 && mossAmount > 0) {
        const mv = Math.max(1, Math.min(4, Math.round(2.2 + (clump - 0.5) * 3 + lit * rim)));
        colour = o.moss[mv]!;
      }
      put(png, x, y, colour);
    }
  }
}
