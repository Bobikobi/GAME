import { describe, expect, test } from 'vitest';

import { deepAt, deepTile, patchAt } from '../src/waterbody';

const TILE = 64;
const COLS = 6;
const ROWS = 8;
/** The smallest patch worth counting, in art pixels: below it is the stipple of an edge. */
const MIN_PATCH = 24;
/** Where the field of tiles starts: three places in the world. */
const PLACES: readonly (readonly [number, number])[] = [
  [20, 7],
  [0, 30],
  [41, 3],
];

/** The lighter patches of a COLS x ROWS field of water tiles at world tile (x0, y0), as one mask. */
function field(x0: number, y0: number, frame = 0): Uint8Array {
  const w = COLS * TILE;
  const mask = new Uint8Array(w * ROWS * TILE);
  for (let y = 0; y < ROWS * TILE; y++) for (let x = 0; x < w; x++) mask[y * w + x] = patchAt(x0 * TILE + x, y0 * TILE + y, frame) ? 1 : 0;
  return mask;
}

/** The patches of a mask, as the size of each (4-connected runs). */
function patches(mask: Uint8Array, w: number): number[] {
  const seen = new Uint8Array(mask.length);
  const sizes: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let size = 0;
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const at = stack.pop()!;
      size += 1;
      const x = at % w;
      for (const next of [x > 0 ? at - 1 : -1, x < w - 1 ? at + 1 : -1, at - w, at + w]) {
        if (next >= 0 && next < mask.length && mask[next] && !seen[next]) {
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    sizes.push(size);
  }
  return sizes;
}

/** Perceived luminance, 0 to 255. */
const lum = (c: number): number => 0.3 * (c >> 16) + 0.5 * ((c >> 8) & 255) + 0.2 * (c & 255);

describe('the open water', () => {
  // the approved cove measures about 13% pale pixels (the second teal step and up) and a luminance spread of about 13
  test.each(PLACES)('calm like the cove: 12-15.5% pale pixels, a luminance spread of 11.5-14.5, at tile %i,%i', (x0, y0) => {
    let sum = 0;
    let sq = 0;
    let pale = 0;
    const n = COLS * TILE * ROWS * TILE;
    for (let y = 0; y < ROWS * TILE; y++) {
      for (let x = 0; x < COLS * TILE; x++) {
        const l = lum(deepAt(x0 * TILE + x, y0 * TILE + y, 0));
        sum += l;
        sq += l * l;
        if (l >= 80) pale += 1;
      }
    }
    const mean = sum / n;
    expect(pale / n).toBeGreaterThanOrEqual(0.12);
    expect(pale / n).toBeLessThanOrEqual(0.155);
    expect(Math.sqrt(sq / n - mean * mean)).toBeGreaterThanOrEqual(11.5);
    expect(Math.sqrt(sq / n - mean * mean)).toBeLessThanOrEqual(14.5);
  });

  test.each(PLACES)('a few large pale patches, half to one and a half to a tile, at tile %i,%i', (x0, y0) => {
    const w = COLS * TILE;
    const sizes = patches(field(x0, y0), w).filter((n) => n >= MIN_PATCH);
    const perTile = sizes.length / (COLS * ROWS);
    expect(perTile).toBeGreaterThanOrEqual(0.5);
    expect(perTile).toBeLessThanOrEqual(1.5);
  });

  test.each(PLACES)('no pale patch recurs at the same place in any row or column of tiles, at tile %i,%i', (x0, y0) => {
    const w = COLS * TILE;
    const mask = field(x0, y0);
    const tile = (tx: number, ty: number): number[] => {
      const out: number[] = [];
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) out.push(mask[(ty * TILE + y) * w + tx * TILE + x]!);
      return out;
    };
    // two tiles repeat each other when both hold a patch and these cover (nearly) the same pixels: the overlap over the union; a patch running on across a seam is one patch, not a repeat
    const same = (a: number[], b: number[]): number => {
      let both = 0;
      let either = 0;
      for (let i = 0; i < a.length; i++) {
        if (a[i] || b[i]) either += 1;
        if (a[i] && b[i]) both += 1;
      }
      return either < 100 ? 0 : both / either;
    };
    let repeats = 0;
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        for (let uy = 0; uy < ROWS; uy++) {
          for (let ux = 0; ux < COLS; ux++) {
            if ((uy === ty && ux === tx) || (uy !== ty && ux !== tx)) continue;
            if (uy < ty || (uy === ty && ux < tx)) continue;
            if (same(tile(tx, ty), tile(ux, uy)) > 0.75) repeats += 1;
          }
        }
      }
    }
    expect(repeats).toBe(0);
  });

  test('it is fixed by the place, on the teal ramp, and rocks only a little between frames', () => {
    const TEAL = new Set([0x122b2c, 0x1c4a49, 0x2a6c66, 0x3f8f84, 0x62b3a2, 0x93d6c2]);
    let moved = 0;
    for (let n = 0; n < 2000; n++) {
      const x = (n * 37) % 640;
      const y = (n * 91) % 640;
      expect(deepAt(x, y, 0)).toBe(deepAt(x, y, 0));
      expect(TEAL.has(deepAt(x, y, 1))).toBe(true);
      if (deepAt(x, y, 0) !== deepAt(x, y, 2)) moved += 1;
    }
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThan(1000);
    const a = new Uint8ClampedArray(TILE * TILE * 4);
    const b = new Uint8ClampedArray(TILE * TILE * 4);
    deepTile(3, 4, 0, a);
    deepTile(3, 4, 0, b);
    expect(a).toEqual(b);
  });
});
