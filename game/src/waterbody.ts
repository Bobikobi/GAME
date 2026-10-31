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

function read(): Layers {
  if (!layers) layers = { bed: decode(WATER_LAYERS.bed), body: decode(WATER_LAYERS.body), light: decode(WATER_LAYERS.light), foam: decode(WATER_LAYERS.foam) };
  return layers;
}

const wrap = (v: number): number => ((Math.floor(v) % SIZE) + SIZE) % SIZE;
/** A texel coordinate bounced back and forth over the layer (0..127, then 127..0), so a sample never meets an edge: the layers are not made to tile. */
const bounce = (v: number): number => {
  const t = ((Math.floor(v) % (2 * SIZE)) + 2 * SIZE) % (2 * SIZE);
  return t < SIZE ? t : 2 * SIZE - 1 - t;
};

/** The study's deep base, and its body layer's weights: `base * .65 + body * .2 + body * .15`, the body read at two scales. */
const BASE = [28, 74, 73] as const;
/** The weights of the base and of the body at its two scales (the study's .65, .2 and .15; the body leans harder here so the water is as lively as the cove's). */
const BASE_W = 0.3;
const WA = 0.42;
const WB = 0.28;
/** Texels of the body layer to an art pixel at the study's two scales. */
const SCALE_A = 0.65;
const SCALE_B = 0.39;
/** How far a slow noise leans the body's sampling, in texels: the two scales never settle into a lattice. */
const WARP = 26;
/** The grade that takes the study's composite to the cove as it stands in the world (measured on the approved frame: about 52, 92, 87). */
const GRADE = [16, 8, 7] as const;
/** The light layer's sparkle colour. */
const SPARKLE = [196, 232, 220] as const;

/** Where the water's drift has moved it by a frame: a gentle rock of a pixel or two that closes at the fourth frame. */
function drift(frame: number): [number, number] {
  const a = (frame / FRAMES) * Math.PI * 2;
  return [2 * Math.sin(a), 2 * Math.sin(a + 1.3)];
}

/** A layer's colour at a fractional texel, bilinear, bouncing at the edges: the smooth read the study's canvas gave. */
function sample(r: Raster, u: number, v: number, out: number[]): void {
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const fx = u - x0;
  const fy = v - y0;
  const xa = bounce(x0);
  const xb = bounce(x0 + 1);
  const ya = bounce(y0);
  const yb = bounce(y0 + 1);
  for (let c = 0; c < 3; c++) {
    const top = r.rgb[(ya * SIZE + xa) * 3 + c]! * (1 - fx) + r.rgb[(ya * SIZE + xb) * 3 + c]! * fx;
    const bottom = r.rgb[(yb * SIZE + xa) * 3 + c]! * (1 - fx) + r.rgb[(yb * SIZE + xb) * 3 + c]! * fx;
    out[c] = top * (1 - fy) + bottom * fy;
  }
}

const scratchA = [0, 0, 0];
const scratchB = [0, 0, 0];

/** The colour of the open water at an art pixel, in a frame (0 to 3): the study's composite of base and body, its light layer's sparkles on top. A packed 0xRRGGBB. */
export function deepAt(gx: number, gy: number, frame: number): number {
  const l = read();
  const [dx, dy] = drift(frame);
  // the body, read at the study's two scales, each leaned a little by slow noise so no lattice forms
  const wx = (valueNoise(gx, gy, 51, 90) - 0.5) * 2 * WARP;
  const wy = (valueNoise(gx, gy, 57, 90) - 0.5) * 2 * WARP;
  sample(l.body, gx * SCALE_A + wx + dx, gy * SCALE_A + wy + dy, scratchA);
  sample(l.body, gx * SCALE_B + 61 - wy * 0.7 - dy, gy * SCALE_B + 23 + wx * 0.7 + dx, scratchB);
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) out[c] = BASE[c]! * BASE_W + scratchA[c]! * WA + scratchB[c]! * WB + GRADE[c]!;
  // the light layer's sparkles, read from a window that differs, and is mirrored, in every 128 px chunk: where it is bright, in the frame whose turn it is
  const cell = hash(Math.floor(gx / SIZE) + 5, Math.floor(gy / SIZE) + 11);
  const lx = (cell & 1 ? SIZE - 1 - wrap(gx) : wrap(gx)) + ((cell >>> 1) & 127);
  const ly = (cell & 2 ? SIZE - 1 - wrap(gy * 1.4) : wrap(gy * 1.4)) + ((cell >>> 8) & 127);
  const li = (wrap(ly) * SIZE + wrap(lx)) * 3;
  const lv = (l.light.rgb[li]! + l.light.rgb[li + 1]! + l.light.rgb[li + 2]!) / 765;
  const pulse = 0.12 + 0.65 * Math.max(0, Math.sin((frame / FRAMES) * Math.PI * 2 + gx * 0.045 + gy * 0.018)) ** 6;
  const glint = Math.min(1, Math.max(0, (lv - 0.42) * 2.5)) * pulse;
  if (glint > SPARK) {
    const k = Math.min(1, (glint - SPARK) * 2.2);
    for (let c = 0; c < 3; c++) out[c] = out[c]! * (1 - k) + SPARKLE[c]! * k;
  }
  const clamp = (v: number): number => Math.min(255, Math.max(0, Math.round(v)));
  return (clamp(out[0]!) << 16) | (clamp(out[1]!) << 8) | clamp(out[2]!);
}

/** The glint level where a sparkle starts. */
const SPARK = 0.42;

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
