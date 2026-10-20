/**
 * Air over the valley: the cloud shade that crosses the ground by day (STYLE section 7 cue 3) and the fog banks
 * that lie in the low ground at dawn and at night. Pure, so a test reads the very pixels the scene bakes:
 * whole pixels, the palette's own colours, and the ordered 4x4 dither wherever a density has to thin out.
 */
import { T } from './config';

/** Side of the cloud shade patch, in art pixels. It wraps, so one tile covers the view at any scroll. */
export const CLOUD_TILE = 128;
/** The ink over the ground: `#1b1a2e` at 12%, the number STYLE section 7 gives. */
export const CLOUD_ALPHA = Math.round(0.15 * 255);
/** How the patch drifts, art pixels a second: a slow cross-wind, the same one the fire leans with. */
export const CLOUD_DRIFT = { x: 1.7, y: 0.55 } as const;

const INK = [0x1b, 0x1a, 0x2e] as const;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

/** The three tones of a bank: its rim, its body and its crest, all from the grey ramp. */
export const BANK_RGB = { rim: [0x8f, 0x94, 0xa8], body: [0xc6, 0xca, 0xd6], crest: [0xf5, 0xf4, 0xef] } as const;

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
 * One patch of cloud shade as RGBA bytes: the ink at `CLOUD_ALPHA` inside a cloud, nothing outside, and a rim
 * thinned in dots so the shape has no straight edge. A patch tiles with itself on all four sides.
 */
export function cloudPixels(size = CLOUD_TILE): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(new ArrayBuffer(size * size * 4));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const f = cloudField(x, y, size);
      const rim = (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;
      if (f <= 0.56 + 0.06 * rim) continue;
      const i = 4 * (y * size + x);
      out[i] = INK[0];
      out[i + 1] = INK[1];
      out[i + 2] = INK[2];
      out[i + 3] = CLOUD_ALPHA;
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
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // the band's own centre line rises and falls along its length, so neither edge is a straight line
      const centre = 0.5 + 0.09 * Math.sin(x / 113 + seed) + 0.05 * Math.sin(x / 47 + seed * 2.3);
      // a window at each edge, so a band whose middle wanders up still leaves the rows above it clear
      const edge = Math.min(1, (y + 0.5) / (h * 0.1), (h - y - 0.5) / (h * 0.1));
      const fy = Math.max(0, 1 - Math.abs((y + 0.5) / h - centre) * 2) * Math.max(0, edge);
      const wob = 0.66 + 0.34 * Math.sin(x / 71 + seed) * Math.cos(x / 149 + seed * 1.7);
      const v = Math.pow(fy, 0.5) * wob;
      const step = (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;
      if (v <= step) continue;
      const c = crest && v > 0.62 ? BANK_RGB.crest : v > 0.3 ? BANK_RGB.body : BANK_RGB.rim;
      const i = 4 * (y * w + x);
      out[i] = c[0];
      out[i + 1] = c[1];
      out[i + 2] = c[2];
      out[i + 3] = 255;
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
export const BANK_TILE = { high: 5 * T, thin: 2 * T, low: 3 * T } as const;
