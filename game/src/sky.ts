/**
 * Air over the valley: the cloud shade that crosses the ground by day (STYLE section 7 cue 3, in the owner's
 * pick of 20.10: `#172a52` at 34%) and the pale banks that lie over the valley before dawn and after dusk.
 * Pure, so a test reads the very pixels the scene bakes: the palette's own colours, whole pixels inside a cloud,
 * and a soft alpha veil for a bank, which is fog and not smoke.
 */
import { T } from './config';

/** Side of the cloud shade patch, in art pixels. It wraps, so one tile covers the view at any scroll. */
export const CLOUD_TILE = 192;
/** The shade's ink, `#172a52` at 34%, the value the owner kept over STYLE 7's 12%: below it, nothing showed. */
export const CLOUD_ALPHA = Math.round(0.34 * 255);
/** Art pixels a screen pixel: the world camera runs at four, so a texture is baked at this density to stay sharp. */
export const AIR_DENSITY = 4;
/** How the patch drifts, world units a second: a slow cross-wind, the same one the fire leans with. */
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
 * One patch of cloud shade as RGBA bytes: the ink at `CLOUD_ALPHA` through a cloud and nothing between clouds,
 * with a rim of a fiftieth of the field to soften the cut. A patch tiles with itself on all four sides.
 */
/** How much of the sky a day carries, at the four weights the scene bakes: clear, one cloud, a few, a heavy sky. */
export const CLOUD_BUCKETS = [0, 0.3, 0.55, 0.8] as const;

/**
 * The sky's own cover over the days, 0 to 1: slow weather the player can feel without a forecast. Some days
 * are clear, some carry one cloud, some are heavy. A pure function of the day number, so a reload keeps the sky.
 */
export function cloudCover(day: number): number {
  const v = 0.5 + 0.32 * Math.sin(day * 0.5 + 0.4) + 0.18 * Math.sin(day * 0.21 + 2.1) + 0.1 * Math.sin(day * 1.1 + 0.9);
  // leaning clear: a heavy sky is the rarer day, and half the valley's days carry no cloud at all
  return Math.min(1, Math.max(0, v * 1.05 - 0.16));
}

/** The bucket a day's cover falls in: the index into `CLOUD_BUCKETS`, and the baked patch that goes with it. */
export function cloudBucket(cover: number): number {
  let k = 0;
  for (let i = 1; i < CLOUD_BUCKETS.length; i++) if (cover >= CLOUD_BUCKETS[i]!) k = i;
  return k;
}

/** One patch of cloud shade at a given cover, 0 (clear sky) to 1 (a heavy sky). */
export function cloudPixels(size = CLOUD_TILE * AIR_DENSITY, cover = 0.6): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(new ArrayBuffer(size * size * 4));
  // more cover, a lower bar for the field: a thin sky keeps only the tops of the clouds
  const bar = 0.86 - 0.5 * Math.min(1, Math.max(0, cover));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const f = cloudField(x, y, size);
      // a shade has an edge, not a fog: one step in, and a rim of two hundredths of the field to soften it
      const edge = Math.min(1, Math.max(0, (f - bar) / 0.02));
      if (edge <= 0) continue;
      const i = 4 * (y * size + x);
      out[i] = INK[0];
      out[i + 1] = INK[1];
      out[i + 2] = INK[2];
      out[i + 3] = Math.round(CLOUD_ALPHA * edge);
    }
  }
  return out;
}

/** Where the cloud patch stands after `tick` game ms: world units of drift on one slow wind. */
export function cloudOffset(tick: number): { x: number; y: number } {
  const s = tick / 1000;
  return { x: CLOUD_DRIFT.x * s, y: CLOUD_DRIFT.y * s };
}

/** The patch's drift, or none: a reader who asked for reduced motion keeps the sky and loses its movement (G29). */
export function cloudDrift(tick: number, drifting = true): { x: number; y: number } {
  return drifting ? cloudOffset(tick) : { x: 0, y: 0 };
}

/**
 * One fog bank as RGBA bytes, a band `w` x `h` art pixels: dense through its middle, thinning to nothing at its
 * top and bottom in dots, with a slow wobble along its length so no two stretches match. `crest` gives the band
 * its pale top, the way a bank catches the last light.
 */
export function bankPixels(w: number, h: number, seed: number, crest = true, period = w): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(new ArrayBuffer(w * h * 4));
  const s = seed * 97;
  // the pattern is one period wide and repeats: its harmonics are whole numbers of that period, so a bank can be
  // as wide as any view and its ends meet without a seam
  const step = (2 * Math.PI) / Math.max(1, period);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = step * (x % period);
      // the band's own centre line rises and falls along its length, so neither edge is a straight line
      const centre = 0.5 + 0.09 * Math.sin(3 * u + s) + 0.05 * Math.sin(7 * u + s * 2.3);
      const fy = Math.max(0, 1 - Math.abs((y + 0.5) / h - centre) * 2);
      // soft shapes that vary down the band as well as along it, wider than tall: a pattern of x alone stands in columns
      const v2 = step * y;
      const wob = 0.6 + 0.2 * Math.sin(u + 2.1 * v2 + s) + 0.15 * Math.sin(2 * u - 3.1 * v2 + s * 1.7) + 0.1 * Math.sin(3 * u + 5.3 * v2 + s * 2.9);
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
  // a circular distance: 23:59 and 00:00 are a minute apart, not a day, so midnight has no step in it
  const near = (at: number, width: number) => {
    const d = Math.abs(m - at);
    return Math.max(0, 1 - Math.min(d, 1440 - d) / width);
  };
  return Math.min(1, Math.max(near(5.5 * 60, 150), 0.7 * near(21.5 * 60, 210), 0.45 * near(0, 240)));
}

/** How much of the fog curve each bank draws, high to low, and the cap the night's lift may reach. */
export const BANK_WEIGHT = [0.9, 0.7, 1] as const;
export const BANK_NIGHT_LIFT = { gain: 0.4, cap: 0.95 } as const;
/** Banks are hung at these shares of the view's height. */
export const BANK_AT = [0.22, 0.46, 0.64] as const;
/** One period of a bank along its own length, in world units: the pattern repeats every this much. */
export const BANK_PERIOD = 4 * T;

/** A bank's drift in world units a second, the valley's wind again: the low banks run faster than the high ones. */
export const BANK_DRIFT = { high: 2.2, thin: 3.1, low: 3.6 } as const;

/** A tile of a bank's own height: the high bank hung over the valley, the low one on the ground. */
export const BANK_TILE = { high: 6 * T, thin: 2 * T, low: 4 * T } as const;
