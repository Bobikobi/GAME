import { WATER_LAYERS, type WaterLayerData } from './waterlayers';

/**
 * The open water, drawn from the world's pixel and not from a tile, so no tile repeats: the owner's layered water of
 * 25.10 (a Codex study, tools/kit-gen/water-layers), baked into one still per frame. The study composed four generated layers at run
 * time; this reads the same ones the same way, `base * .65 + body * .2 + body * .15` with the body sampled at two scales
 * (.65 and .39 texels to an art pixel), the light layer's glints, the bed showing through toward a shore, and the foam's
 * holes, then puts every pixel on the teal ramp. Pure, fixed by the pixel's place.
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

/** A wrapped box blur of a luminance layer, so the body reads as broad patches and not as the layer's fine net. */
function soften(lum: Float32Array, radius: number): Float32Array {
  const out = new Float32Array(lum.length);
  const w = (v: number): number => ((v % SIZE) + SIZE) % SIZE;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let sum = 0;
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) sum += lum[w(y + dy) * SIZE + w(x + dx)]!;
      out[y * SIZE + x] = sum / (2 * radius + 1) ** 2;
    }
  }
  return out;
}

interface Layers {
  bed: Raster;
  body: Raster;
  light: Raster;
  foam: Raster;
  soft: Float32Array;
}
let layers: Layers | undefined;
let cuts: { deep: number; light: number } | undefined;

/** Radius, in texels, of the box blur that softens the body. */
const BLUR = 1;
/** The share of the open water that falls in a deeper patch, and in a lighter one. */
const SHARE_DEEP = 0.2;
const SHARE_LIGHT = 0.08;
/** Texels of the body layer to an art pixel, at the study's two scales. */
const SCALE_A = 0.65;
const SCALE_B = 0.39;

function read(): Layers {
  if (!layers) {
    const body = decode(WATER_LAYERS.body);
    layers = { bed: decode(WATER_LAYERS.bed), body, light: decode(WATER_LAYERS.light), foam: decode(WATER_LAYERS.foam), soft: soften(body.lum, BLUR) };
  }
  return layers;
}

const wrap = (v: number): number => ((Math.floor(v) % SIZE) + SIZE) % SIZE;

/** The body's brightness at an art pixel in a frame: its two scales, mixed as the study mixed them, and rocked a texel between frames. */
function bodyAt(l: Layers, gx: number, gy: number, frame: number): number {
  const a = (frame / FRAMES) * Math.PI * 2;
  const rx = Math.round(Math.sin(a));
  const ry = Math.round(Math.sin(a + 1.3));
  const first = l.soft[wrap(gy * SCALE_A + ry) * SIZE + wrap(gx * SCALE_A + rx)]!;
  const second = l.soft[wrap(gy * SCALE_B - rx + 73) * SIZE + wrap(gx * SCALE_B + ry + 41)]!;
  return first * 0.57 + second * 0.43;
}

/** The brightness that cuts the deeper patches off, and the one that cuts the lighter ones, from a sweep of the open world. */
function cutsOf(l: Layers): { deep: number; light: number } {
  if (!cuts) {
    const seen: number[] = [];
    for (let y = 0; y < 640; y += 5) for (let x = 0; x < 640; x += 5) seen.push(bodyAt(l, x, y, 0));
    seen.sort((p, q) => p - q);
    cuts = { deep: seen[Math.floor(seen.length * SHARE_DEEP)]!, light: seen[Math.floor(seen.length * (1 - SHARE_LIGHT))]! };
  }
  return cuts;
}

/** The colour of the open water at an art pixel, in a frame (0 to 3): the teal body, with the light layer's glints. */
export function deepAt(gx: number, gy: number, frame: number): number {
  const l = read();
  const c = cutsOf(l);
  const v = bodyAt(l, gx, gy, frame);
  // the light layer's glints: where it is bright, and in the frame whose turn it is
  const li = (wrap(gy * 1.4) * SIZE + wrap(gx)) * 3;
  const lv = (l.light.rgb[li]! + l.light.rgb[li + 1]! + l.light.rgb[li + 2]!) / 765;
  const pulse = 0.12 + 0.65 * Math.max(0, Math.sin((frame / FRAMES) * Math.PI * 2 + gx * 0.045 + gy * 0.018)) ** 6;
  const glint = Math.min(1, Math.max(0, (lv - 0.42) * 2.5)) * pulse;
  if (glint > 0.62) return TEAL.m;
  if (glint > 0.4) return TEAL.l;
  return v < c.deep ? TEAL.i : v > c.light ? TEAL.k : TEAL.j;
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
