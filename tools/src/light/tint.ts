/**
 * The tint comparison's measure (docs/design/LIGHTING.md section 5, question 1): the mean a* and b* and the
 * chroma of a picture's midtones in CIELAB, read in named regions, so the hour's tint is picked by numbers
 * set beside references and not by eye. Pure: it takes RGBA bytes and returns numbers.
 */

/** A region of a picture as shares of its width and height: [x0, y0, x1, y1], each 0 to 1. */
export type Box = readonly [number, number, number, number];

/** What one region of one picture measures. `n` is the count of midtone pixels the means are taken over. */
export interface Midtones {
  n: number;
  a: number;
  b: number;
  chroma: number;
}

/** The midtone band, in luma 0 to 1: shadows and highlights carry little hue and are left out. */
export const MIDTONES = { lo: 0.25, hi: 0.75 } as const;

/** The D65 white the sRGB space is defined against. */
const WHITE = [0.95047, 1, 1.08883] as const;

function linear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function f(t: number): number {
  return t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29;
}

/** One sRGB colour (0 to 255 a channel) in CIELAB, D65. */
export function lab(r: number, g: number, b: number): { L: number; a: number; b: number } {
  const R = linear(r);
  const G = linear(g);
  const B = linear(b);
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / WHITE[0];
  const y = (0.2126729 * R + 0.7151522 * G + 0.072175 * B) / WHITE[1];
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / WHITE[2];
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** The luma a picture's midtone band is read on: Rec. 709 weights on the encoded channels, 0 to 1. */
export function luma(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * The midtones of a picture's regions: every opaque pixel inside any of `boxes` whose luma is inside the band
 * counts once, and the result is the mean a*, the mean b* and the mean chroma (the length of a* and b*) over them.
 */
export function midtones(data: Uint8Array | Uint8ClampedArray, width: number, height: number, boxes: readonly Box[], band = MIDTONES): Midtones {
  const seen = new Uint8Array(width * height);
  let n = 0;
  let sa = 0;
  let sb = 0;
  let sc = 0;
  for (const [x0, y0, x1, y1] of boxes) {
    const ax = Math.max(0, Math.floor(x0 * width));
    const bx = Math.min(width, Math.ceil(x1 * width));
    const ay = Math.max(0, Math.floor(y0 * height));
    const by = Math.min(height, Math.ceil(y1 * height));
    for (let y = ay; y < by; y++) {
      for (let x = ax; x < bx; x++) {
        const p = y * width + x;
        if (seen[p]) continue;
        seen[p] = 1;
        const i = 4 * p;
        if (data[i + 3]! < 128) continue;
        const r = data[i]!;
        const g = data[i + 1]!;
        const bb = data[i + 2]!;
        const l = luma(r, g, bb);
        if (l < band.lo || l > band.hi) continue;
        const c = lab(r, g, bb);
        n += 1;
        sa += c.a;
        sb += c.b;
        sc += Math.hypot(c.a, c.b);
      }
    }
  }
  return n === 0 ? { n: 0, a: 0, b: 0, chroma: 0 } : { n, a: sa / n, b: sb / n, chroma: sc / n };
}

/** The median of a list, the mean of the middle two in an even one. */
export function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** The references' median as one point: the median a*, b* and chroma, each on its own. */
export function medianOf(ms: readonly Midtones[]): Midtones {
  return { n: ms.reduce((t, m) => t + m.n, 0), a: median(ms.map((m) => m.a)), b: median(ms.map((m) => m.b)), chroma: median(ms.map((m) => m.chroma)) };
}

/** How far a measure sits from a target, in CIELAB units: the straight distance over a*, b* and chroma. */
export function distance(m: Midtones, to: Midtones): number {
  return Math.hypot(m.a - to.a, m.b - to.b, m.chroma - to.chroma);
}

/** The candidate closest to the target; the first of equals wins, so a tie keeps the weaker tint. */
export function closest<T extends { m: Midtones }>(candidates: readonly T[], to: Midtones): T | undefined {
  let best: T | undefined;
  let d = Infinity;
  for (const c of candidates) {
    const e = distance(c.m, to);
    if (e < d) {
      d = e;
      best = c;
    }
  }
  return best;
}
