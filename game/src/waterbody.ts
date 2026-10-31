import { hash, valueNoise } from './richground';
import { WATER_LAYERS, type WaterLayerData } from './waterlayers';

/**
 * The open water, composed from the world's pixel and not drawn as a tile, so nothing in it repeats (a tile showed the same
 * pale patches once every 64 px, a diagonal lattice over a river). It is the owner's layered water of 25.10 (a Codex study,
 * tools/kit-gen/water-layers) the way the study composed it live: a deep teal base, broad soft patches of a lighter step
 * (noise, so they are irregular and never line up), the body layer roughening them, the light layer's glints, and below, the
 * bed and the foam the shore reads. Every pixel is put on the teal ramp. Pure, fixed by the pixel's place.
 */

/** The shared teal ramp, dark to light: what the water is drawn in. */
export const TEAL = { h: 0x122b2c, i: 0x1c4a49, j: 0x2a6c66, k: 0x3f8f84, l: 0x62b3a2, m: 0x93d6c2 } as const;

const SIZE = 128;
const FRAMES = 4;

interface Raster {
  rgb: Uint8Array;
  lum: Float32Array;
}

function decode(d: WaterLayerData): Raster {
  const colors = d.palette.map((hex) => [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)] as const);
  const rgb = new Uint8Array(SIZE * SIZE * 3);
  const lum = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    const row = d.rows[y] ?? '';
    for (let x = 0; x < SIZE; x++) {
      const c = colors[parseInt(row[x] ?? '0', 36)] ?? [0, 0, 0];
      const n = y * SIZE + x;
      rgb.set(c, n * 3);
      lum[n] = (c[0] * 0.3 + c[1] * 0.5 + c[2] * 0.2) / 255;
    }
  }
  return { rgb, lum };
}

interface Layers {
  bed: Raster;
  body: Raster;
  light: Raster;
  foam: Raster;
}
let layers: Layers | undefined;
let cuts: { low: number; high: number } | undefined;

/** The patches' two lattice spacings, in art pixels: a few broad soft drifts to a tile or two, and a finer wobble that roughens their edge. */
const PATCH_BIG = 32;
const PATCH_SMALL = 16;
const PATCH_SEED = 41;
/** The share of the open water that lies in a pale patch's core, and the feather round it, in the field's own units (a few pixels). */
const SHARE_PALE = 0.108;
const FEATHER = 0.075;
/** 4x4 ordered dither, 0 up to 1: a patch's feather steps from the base to the lighter step in sixteen densities, not one hard line. */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);
/** How far the study's body layer (at .65 texels to a pixel) roughens the field. */
const GRAIN = 0.05;
/** The glint levels that make a sparkle of the lighter steps: high, so only a handful show. */
const SPARK_L = 0.42;
const SPARK_M = 0.62;

function read(): Layers {
  if (!layers) layers = { bed: decode(WATER_LAYERS.bed), body: decode(WATER_LAYERS.body), light: decode(WATER_LAYERS.light), foam: decode(WATER_LAYERS.foam) };
  return layers;
}

const wrap = (v: number): number => ((Math.floor(v) % SIZE) + SIZE) % SIZE;

/** Where the water's drift has moved it by a frame: a gentle rock of a pixel or two that closes at the fourth frame. */
function drift(frame: number): [number, number] {
  const a = (frame / FRAMES) * Math.PI * 2;
  return [Math.round(2 * Math.sin(a)), Math.round(2 * Math.sin(a + 1.3))];
}

/** The water's brightness at an art pixel in a frame, 0 to about 1: soft drifts of noise at two scales, roughened by the study's body layer. Nothing in it repeats. */
function fieldAt(l: Layers, gx: number, gy: number, frame: number): number {
  const [dx, dy] = drift(frame);
  const x = gx + dx;
  const y = gy + dy;
  const big = valueNoise(x, y, PATCH_SEED, PATCH_BIG);
  const small = valueNoise(x, y, PATCH_SEED + 9, PATCH_SMALL);
  // the grain is read from a window of the layer that moves a different way in every 128 px cell, so it never lines up
  const cell = hash(Math.floor(gx / SIZE), Math.floor(gy / SIZE));
  const i = wrap(y * 0.65 + (cell & 127)) * SIZE + wrap(x * 0.65 + ((cell >>> 7) & 127));
  const grain = l.body.lum[i]! - 0.5;
  return big * 0.68 + small * 0.32 + grain * GRAIN;
}

/** The field's value above which a pixel is in a patch's core, and the one below which it is outside its feather, from a sweep of the world's water. */
function cutsOf(l: Layers): { low: number; high: number } {
  if (!cuts) {
    const seen: number[] = [];
    for (let y = 0; y < 1600; y += 6) for (let x = 0; x < 1600; x += 6) seen.push(fieldAt(l, x, y, 0));
    seen.sort((p, q) => p - q);
    const high = seen[Math.floor(seen.length * (1 - SHARE_PALE))]!;
    cuts = { low: high - FEATHER, high };
  }
  return cuts;
}

/** How far into a pale patch an art pixel is, 0 (outside) to 1 (its core), across a feather of a few pixels. */
function paleAt(l: Layers, gx: number, gy: number, frame: number): number {
  const c = cutsOf(l);
  return Math.min(1, Math.max(0, (fieldAt(l, gx, gy, frame) - c.low) / (c.high - c.low)));
}

/** True where the open water lies in a pale patch at an art pixel, its feather's half counted: what the patches are, for counting them. */
export function patchAt(gx: number, gy: number, frame = 0): boolean {
  return paleAt(read(), gx, gy, frame) > 0.5;
}

/** The colour of the open water at an art pixel, in a frame (0 to 3): the teal base, the next step in the pale patches (dithered across their feather), the light layer's sparkles. */
export function deepAt(gx: number, gy: number, frame: number): number {
  const l = read();
  // the light layer's sparkles: where it is bright, and in the frame whose turn it is
  const cell = hash(Math.floor(gx / SIZE) + 5, Math.floor(gy / SIZE) + 11);
  const li = (wrap(gy * 1.4 + (cell & 127)) * SIZE + wrap(gx + ((cell >>> 7) & 127))) * 3;
  const lv = (l.light.rgb[li]! + l.light.rgb[li + 1]! + l.light.rgb[li + 2]!) / 765;
  const pulse = 0.12 + 0.65 * Math.max(0, Math.sin((frame / FRAMES) * Math.PI * 2 + gx * 0.045 + gy * 0.018)) ** 6;
  const glint = Math.min(1, Math.max(0, (lv - 0.42) * 2.5)) * pulse;
  if (glint > SPARK_M) return TEAL.m;
  if (glint > SPARK_L) return TEAL.l;
  return paleAt(l, gx, gy, frame) > BAYER4[(gx & 3) + 4 * (gy & 3)]! ? TEAL.j : TEAL.i;
}

/** One tile of the open water, RGBA, `px` a side, for a frame: the tile's place in the world is what it draws. */
export function deepTile(tx: number, ty: number, frame: number, out: Uint8ClampedArray, px = 64): void {
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const c = deepAt(tx * px + x, ty * px + y, frame);
      const i = (y * px + x) * 4;
      out[i] = c >> 16;
      out[i + 1] = (c >> 8) & 255;
      out[i + 2] = c & 255;
      out[i + 3] = 255;
    }
  }
}

/** The bed under the shallows at an art pixel, as the study's bed layer gives it: [r, g, b]. */
export function bedAt(gx: number, gy: number): readonly [number, number, number] {
  const l = read();
  const i = (wrap(gy * 0.85) * SIZE + wrap(gx * 0.85)) * 3;
  return [l.bed.rgb[i]!, l.bed.rgb[i + 1]!, l.bed.rgb[i + 2]!];
}

/** How much foam the study's foam layer holds at an art pixel, 0 to 1: its islands and holes, as the compositor read them. */
export function foamAt(gx: number, gy: number): number {
  const l = read();
  const i = (wrap(gy * 1.2) * SIZE + wrap(gx * 1.2)) * 3;
  const level = (l.foam.rgb[i]! + l.foam.rgb[i + 1]! + l.foam.rgb[i + 2]!) / 765;
  return Math.min(1, Math.max(0, (level - 0.28) * 1.9));
}
