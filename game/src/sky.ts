/**
 * Air over the valley: the cloud shade that crosses the ground by day (STYLE section 7 cue 3) and the fog banks
 * that lie in the low ground at dawn and at night. Pure, so a test reads the very pixels the scene bakes:
 * whole pixels, the palette's own colours, and the ordered 4x4 dither wherever a density has to thin out.
 */
import { T } from './config';

/** Side of the cloud shade patch, in art pixels. It wraps, so one tile covers the view at any scroll. */
export const CLOUD_TILE = 192;
/** The ink over the ground: `#1b1a2e` at 12% at a cloud's rim and 28% through its heart, so the shape reads. */
export const CLOUD_ALPHA = Math.round(0.34 * 255);
/** The rim's share of `CLOUD_ALPHA`, at the very edge of a cloud. */
export const CLOUD_RIM = 0.43;
/** Art pixels a screen pixel: the world camera runs at four, so a texture is baked at this density to stay sharp. */
export const AIR_DENSITY = 4;
/** How the patch drifts, art pixels a second: a slow cross-wind, the same one the fire leans with. */
export const CLOUD_DRIFT = { x: 1.7, y: 0.55 } as const;

const INK = [0x17, 0x2a, 0x52] as const;

/** The three tones of a bank, at the pale end of the grey ramp: a light rim and a near-white body. */
export const BANK_RGB = { rim: [0xc6, 0xca, 0xd6], body: [0xf5, 0xf4, 0xef], crest: [0xf5, 0xf4, 0xef] } as const;
/** How solid a bank's heart is: a veil, not a wall, so the ground still reads under it. */
export const BANK_ALPHA = 0.8;

/** The cloud shade's field at an art pixel of the patch: three wrapped harmonics, so the patch tiles seamlessly. */
export function cloudField(x: number, y: number, size = CLOUD_TILE): number {
  const u = (2 * Math.PI * x) / size;
  const v = (2 * Math.PI * y) / size;
  return (
    0.5 +
    0.5 *
      (0.55 * Math.sin(2 * u + 0.7) * Math.cos(v) +
        0.3 * Math.sin(3 * u + 1.9) * Math.cos(2 * v + 0.4) +
        0.15 * Math.sin(5 * u + 2.7) * Math.cos(4 * v + 1.1))
  );
}

/**
 * One patch of cloud shade as RGBA bytes: the ink at `CLOUD_ALPHA` through the middle of a cloud, thinning over
 * the last fifth of its edge so the shape has no cut line. A patch tiles with itself on all four sides.
 */
export function cloudPixels(size = CLOUD_TILE * AIR_DENSITY): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(new ArrayBuffer(size * size * 4));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const f = cloudField(x, y, size);
      // a wider sky under cloud than the field's own half, so a cloud is met often and its edge is a ramp
      // a shade has an edge, not a fog: one step in, and a rim of two hundredths of the field to soften it
      const edge = Math.min(1, Math.max(0, (f - 0.5) / 0.02));
      if (edge <= 0) continue;
      const heart = 1;
      const i = 4 * (y * size + x);
      out[i] = INK[0];
      out[i + 1] = INK[1];
      out[i + 2] = INK[2];
      out[i + 3] = Math.round(CLOUD_ALPHA * edge * (CLOUD_RIM + (1 - CLOUD_RIM) * heart));
    }
  }
  return out;
}

/** Where the cloud patch stands after `tick` game ms: art pixels of tile offset, drifting on one slow wind. */
export function cloudOffset(tick: number): { x: number; y: number } {
  const s = tick / 1000;
  return { x: CLOUD_DRIFT.x * s, y: CLOUD_DRIFT.y * s };
}

/**
 * One fog bank as RGBA bytes, a band `w` x `h` art pixels: dense through its middle, thinning to nothing at its
 * top and bottom in dots, with a slow wobble along its length so no two stretches match. `crest` gives the band
 * its pale top, the way a bank catches the last light.
 */
export function bankPixels(w: number, h: number, seed: number, crest = true): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(new ArrayBuffer(w * h * 4));
  const s = seed * 97;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // the band's own centre line rises and falls along its length, so neither edge is a straight line
      const centre = 0.5 + 0.09 * Math.sin(x / (w / 7) + s) + 0.05 * Math.sin(x / (w / 17) + s * 2.3);
      const fy = Math.max(0, 1 - Math.abs((y + 0.5) / h - centre) * 2);
      const wob = 0.72 + 0.28 * Math.sin(x / (w / 11) + s) * Math.cos(x / (w / 5.2) + s * 1.7);
      // a window at each edge, so a band whose middle wanders up still leaves the rows above it clear
      const win = Math.min(1, (y + 0.5) / (h * 0.12), (h - y - 0.5) / (h * 0.12));
      const v = Math.pow(fy, 0.55) * wob * Math.max(0, win);
      // a soft veil: the band's own colour at a low alpha, brightest at its heart, gone at its rim
      const a = Math.min(1, Math.max(0, (v - 0.08) / 0.55));
      if (a <= 0) continue;
      const c = crest && v > 0.6 ? BANK_RGB.crest : v > 0.3 ? BANK_RGB.body : BANK_RGB.rim;
      const i = 4 * (y * w + x);
      out[i] = c[0];
      out[i + 1] = c[1];
      out[i + 2] = c[2];
      out[i + 3] = Math.round(255 * a * BANK_ALPHA);
    }
  }
  return out;
}

/**
 * How thick the banks lie at a given minute of the day, 0 to 1: they gather before dawn, thin through the
 * morning, and come back with the dark. Nothing at midday, so the valley stays readable.
 */
export function fogStrength(minute: number): number {
  const m = ((minute % 1440) + 1440) % 1440;
  const near = (at: number, width: number) => Math.max(0, 1 - Math.abs(m - at) / width);
  return Math.min(1, Math.max(near(5.5 * 60, 150), 0.7 * near(21.5 * 60, 210), 0.45 * near(0, 240)));
}

/** A bank's drift in art pixels a second, the valley's wind again: the low banks run faster than the high ones. */
export const BANK_DRIFT = { high: 2.2, thin: 3.1, low: 3.6 } as const;

/** A tile of a bank's own height: the high bank hung over the valley, the low one on the ground. */
export const BANK_TILE = { high: 6 * T, thin: 2 * T, low: 4 * T } as const;
