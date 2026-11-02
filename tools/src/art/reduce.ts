/**
 * The clean reduction of a draft to game size (docs/art/DRAWERS.md, "Reducing a draft"). A port of the trial's
 * `cut` and `small` (.scratch/trial/codex-scene.py, 2.11) that every Codex and PixelLab draft goes through before it is
 * set beside the game's own pictures:
 *
 * 1. the magenta key (R>150, G<110, B>150) becomes transparent, and one pass of erosion takes the fringe off (the image
 *    border counts as outside); a picture with no key pixel is left whole;
 * 2. the picture is cropped to what is opaque;
 * 3. it is scaled with a box filter on premultiplied alpha, so a colour never bleeds out of a transparent edge;
 * 4. alpha is hard: opaque above 127, clear below, so no half-covered pixel survives;
 * 5. the opaque pixels are cut down to at most `colours` colours by a median cut, no dither and no snap to the core
 *    palette (a palette snap is a decision for the owner, not a side effect of a reduction).
 *
 * Everything is deterministic: the same input gives the same bytes.
 */
import { PNG } from 'pngjs';

export interface ReduceOptions {
  /** Target height; with `width` too the picture is stretched to both. One of the two is required. */
  height?: number;
  width?: number;
  /** At most this many colours among the opaque pixels; 0 keeps every colour. Default 48. */
  colours?: number;
  /** Put the result bottom-centred on a transparent square of this side. */
  frame?: number;
  /** Treat the magenta key as background (default true). */
  key?: boolean;
}

export const MAGENTA = { r: 150, g: 110, b: 150 } as const;
export const DEFAULT_COLOURS = 48;

const isMagenta = (r: number, g: number, b: number): boolean => r > MAGENTA.r && g < MAGENTA.g && b > MAGENTA.b;

/** Clears the magenta key and one pixel of fringe. Returns the picture and whether any key was found. */
export function keyOut(src: PNG): { png: PNG; found: boolean } {
  const { width: w, height: h } = src;
  const png = new PNG({ width: w, height: h });
  src.data.copy(png.data);
  let found = false;
  for (let i = 0; i < w * h * 4; i += 4) {
    if (isMagenta(png.data[i] as number, png.data[i + 1] as number, png.data[i + 2] as number)) {
      png.data[i + 3] = 0;
      found = true;
    }
  }
  if (!found) return { png, found };
  const opaque = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && (png.data[(y * w + x) * 4 + 3] as number) > 0;
  const keep = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      keep[y * w + x] = opaque(x, y) && opaque(x - 1, y) && opaque(x + 1, y) && opaque(x, y - 1) && opaque(x, y + 1) ? 1 : 0;
    }
  }
  for (let p = 0; p < w * h; p += 1) if (keep[p] === 0) png.data[p * 4 + 3] = 0;
  return { png, found };
}

/** The picture cut to the box of its non-clear pixels; null when nothing is left. */
export function cropToAlpha(src: PNG): PNG | null {
  const { width: w, height: h } = src;
  let top = h;
  let left = w;
  let bottom = -1;
  let right = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if ((src.data[(y * w + x) * 4 + 3] as number) === 0) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (bottom < 0) return null;
  const out = new PNG({ width: right - left + 1, height: bottom - top + 1 });
  PNG.bitblt(src, out, left, top, out.width, out.height, 0, 0);
  return out;
}

/** Box filter (every source pixel counts by the share of it inside the target pixel) on premultiplied colour, then hard alpha. */
export function boxScale(src: PNG, width: number, height: number): PNG {
  const { width: sw, height: sh } = src;
  const out = new PNG({ width, height });
  const fx = sw / width;
  const fy = sh / height;
  for (let dy = 0; dy < height; dy += 1) {
    const y0 = dy * fy;
    const y1 = y0 + fy;
    for (let dx = 0; dx < width; dx += 1) {
      const x0 = dx * fx;
      const x1 = x0 + fx;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let weight = 0;
      for (let y = Math.floor(y0); y < Math.min(sh, Math.ceil(y1)); y += 1) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0);
        for (let x = Math.floor(x0); x < Math.min(sw, Math.ceil(x1)); x += 1) {
          const wgt = wy * (Math.min(x + 1, x1) - Math.max(x, x0));
          const i = (y * sw + x) * 4;
          const alpha = (src.data[i + 3] as number) / 255;
          r += (src.data[i] as number) * alpha * wgt;
          g += (src.data[i + 1] as number) * alpha * wgt;
          b += (src.data[i + 2] as number) * alpha * wgt;
          a += alpha * wgt;
          weight += wgt;
        }
      }
      const o = (dy * width + dx) * 4;
      const coverage = weight === 0 ? 0 : a / weight;
      if (coverage * 255 > 127 && a > 0) {
        out.data[o] = Math.min(255, Math.round(r / a));
        out.data[o + 1] = Math.min(255, Math.round(g / a));
        out.data[o + 2] = Math.min(255, Math.round(b / a));
        out.data[o + 3] = 255;
      }
    }
  }
  return out;
}

interface Bucket {
  /** Packed colours (r<<16|g<<8|b) with how many pixels have each. */
  colours: { key: number; count: number }[];
}

const channel = (key: number, axis: 0 | 1 | 2): number => (key >> (16 - 8 * axis)) & 255;

/** Median cut over the opaque pixels, recolouring them in place. Deterministic: ties break on the packed colour. */
export function quantize(png: PNG, colours: number): number {
  if (colours <= 0) return distinct(png);
  const histogram = new Map<number, number>();
  for (let i = 0; i < png.data.length; i += 4) {
    if ((png.data[i + 3] as number) === 0) continue;
    const key = ((png.data[i] as number) << 16) | ((png.data[i + 1] as number) << 8) | (png.data[i + 2] as number);
    histogram.set(key, (histogram.get(key) ?? 0) + 1);
  }
  if (histogram.size <= colours) return histogram.size;
  const all = [...histogram].map(([key, count]) => ({ key, count })).sort((a, b) => a.key - b.key);
  const buckets: Bucket[] = [{ colours: all }];
  const spread = (bucket: Bucket): { axis: 0 | 1 | 2; range: number } => {
    let best: { axis: 0 | 1 | 2; range: number } = { axis: 0, range: -1 };
    for (const axis of [0, 1, 2] as const) {
      let lo = 255;
      let hi = 0;
      for (const c of bucket.colours) {
        const v = channel(c.key, axis);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      if (hi - lo > best.range) best = { axis, range: hi - lo };
    }
    return best;
  };
  while (buckets.length < colours) {
    // split the bucket that holds the most pixels among those that can still be split (more than one colour)
    let pick = -1;
    let most = -1;
    for (const [n, b] of buckets.entries()) {
      if (b.colours.length < 2) continue;
      const pixels = b.colours.reduce((s, c) => s + c.count, 0);
      const score = pixels * (spread(b).range + 1);
      if (score > most) {
        most = score;
        pick = n;
      }
    }
    if (pick < 0) break;
    const bucket = buckets[pick] as Bucket;
    const { axis } = spread(bucket);
    const sorted = [...bucket.colours].sort((a, b) => channel(a.key, axis) - channel(b.key, axis) || a.key - b.key);
    const half = sorted.reduce((s, c) => s + c.count, 0) / 2;
    let run = 0;
    let cut = 1;
    for (const [n, c] of sorted.entries()) {
      run += c.count;
      if (run >= half) {
        cut = Math.min(Math.max(n + 1, 1), sorted.length - 1);
        break;
      }
    }
    buckets.splice(pick, 1, { colours: sorted.slice(0, cut) }, { colours: sorted.slice(cut) });
  }
  const palette = buckets.map((b) => {
    let r = 0;
    let g = 0;
    let bl = 0;
    let n = 0;
    for (const c of b.colours) {
      r += channel(c.key, 0) * c.count;
      g += channel(c.key, 1) * c.count;
      bl += channel(c.key, 2) * c.count;
      n += c.count;
    }
    return [Math.round(r / n), Math.round(g / n), Math.round(bl / n)] as const;
  });
  const lookup = new Map<number, number>();
  for (const { key } of all) {
    const r = channel(key, 0);
    const g = channel(key, 1);
    const b = channel(key, 2);
    let best = 0;
    let bestD = Infinity;
    for (const [n, p] of palette.entries()) {
      const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    lookup.set(key, best);
  }
  for (let i = 0; i < png.data.length; i += 4) {
    if ((png.data[i + 3] as number) === 0) continue;
    const key = ((png.data[i] as number) << 16) | ((png.data[i + 1] as number) << 8) | (png.data[i + 2] as number);
    const p = palette[lookup.get(key) as number] as readonly [number, number, number];
    png.data[i] = p[0];
    png.data[i + 1] = p[1];
    png.data[i + 2] = p[2];
  }
  return palette.length;
}

/** How many distinct colours the opaque pixels have. */
export function distinct(png: PNG): number {
  const seen = new Set<number>();
  for (let i = 0; i < png.data.length; i += 4) {
    if ((png.data[i + 3] as number) === 0) continue;
    seen.add(((png.data[i] as number) << 16) | ((png.data[i + 1] as number) << 8) | (png.data[i + 2] as number));
  }
  return seen.size;
}

export function frameBottomCentre(png: PNG, side: number): PNG {
  if (png.width > side || png.height > side) throw new Error(`the reduced picture is ${png.width}x${png.height}, larger than the ${side} px frame`);
  const out = new PNG({ width: side, height: side });
  PNG.bitblt(png, out, 0, 0, png.width, png.height, Math.floor((side - png.width) / 2), side - png.height);
  return out;
}

export function reduce(src: PNG, options: ReduceOptions): PNG {
  const { height, width, colours = DEFAULT_COLOURS, frame, key = true } = options;
  if (height === undefined && width === undefined) throw new Error('give a target height or width');
  for (const [name, v] of [['height', height], ['width', width], ['frame', frame]] as const) {
    if (v !== undefined && (!Number.isInteger(v) || v < 1)) throw new Error(`${name} must be a whole number of 1 or more`);
  }
  const keyed = key ? keyOut(src).png : src;
  const cropped = cropToAlpha(keyed);
  if (cropped === null) throw new Error('nothing is left of the picture after the key was cleared');
  const h = height ?? Math.max(1, Math.round((cropped.height * (width as number)) / cropped.width));
  const w = width ?? Math.max(1, Math.round((cropped.width * h) / cropped.height));
  const small = boxScale(cropped, w, h);
  quantize(small, colours);
  return frame === undefined ? small : frameBottomCentre(small, frame);
}
