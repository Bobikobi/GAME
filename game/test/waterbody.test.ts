import { describe, expect, test } from 'vitest';

import { deepAt, deepTile } from '../src/waterbody';

const TILE = 64;
const COLS = 6;
const ROWS = 8;
/** Where a field of tiles starts: three places in the world. */
const PLACES: readonly (readonly [number, number])[] = [
  [20, 7],
  [0, 30],
  [41, 3],
];

/** Perceived luminance, 0 to 255. */
const lum = (c: number): number => 0.3 * (c >> 16) + 0.5 * ((c >> 8) & 255) + 0.2 * (c & 255);

function hsv(c: number): [number, number] {
  const r = c >> 16;
  const g = (c >> 8) & 255;
  const b = c & 255;
  const mx = Math.max(r, g, b);
  const d = mx - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx / 255];
}

describe('the open water', () => {
  // the whole river of the core map: three tiles wide, sixty-four tall; the cove's own measures are hue 175, value .35, 14% pale
  test('the whole river measures as the approved cove: hue 173-178, value .33-.37, 12-16% pale (above the water\'s mean and one spread)', () => {
    let n = 0;
    let hue = 0;
    let val = 0;
    let sum = 0;
    let sq = 0;
    const all: number[] = [];
    for (let ty = 0; ty < 64; ty++) {
      for (let tx = 13; tx < 16; tx++) {
        for (let y = 0; y < TILE; y += 2) {
          for (let x = 0; x < TILE; x += 2) {
            const c = deepAt(tx * TILE + x, ty * TILE + y, 0);
            const [h, v] = hsv(c);
            hue += h;
            val += v;
            const l = lum(c);
            sum += l;
            sq += l * l;
            all.push(l);
            n += 1;
          }
        }
      }
    }
    const mean = sum / n;
    const spread = Math.sqrt(sq / n - mean * mean);
    const pale = all.filter((l) => l > mean + spread).length / n;
    expect(hue / n).toBeGreaterThanOrEqual(173);
    expect(hue / n).toBeLessThanOrEqual(178);
    expect(val / n).toBeGreaterThanOrEqual(0.33);
    expect(val / n).toBeLessThanOrEqual(0.37);
    expect(pale).toBeGreaterThanOrEqual(0.12);
    expect(pale).toBeLessThanOrEqual(0.16);
  });

  test.each(PLACES)('no part of the water recurs in any row or column of tiles, at tile %i,%i', (x0, y0) => {
    const tile = (tx: number, ty: number): number[] => {
      const out: number[] = [];
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) out.push(lum(deepAt((x0 + tx) * TILE + x, (y0 + ty) * TILE + y, 0)));
      return out;
    };
    // two tiles repeat each other when their luminance correlates (a tiled sprite correlates at 1)
    const correlation = (a: number[], b: number[]): number => {
      const ma = a.reduce((p, q) => p + q, 0) / a.length;
      const mb = b.reduce((p, q) => p + q, 0) / b.length;
      let ab = 0;
      let aa = 0;
      let bb = 0;
      for (let i = 0; i < a.length; i++) {
        ab += (a[i]! - ma) * (b[i]! - mb);
        aa += (a[i]! - ma) ** 2;
        bb += (b[i]! - mb) ** 2;
      }
      return ab / Math.sqrt(aa * bb);
    };
    const tiles = new Map<string, number[]>();
    for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) tiles.set(`${tx},${ty}`, tile(tx, ty));
    let worst = 0;
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        for (let uy = 0; uy < ROWS; uy++) {
          for (let ux = 0; ux < COLS; ux++) {
            if ((uy === ty && ux === tx) || (uy !== ty && ux !== tx) || uy < ty || (uy === ty && ux < tx)) continue;
            worst = Math.max(worst, correlation(tiles.get(`${tx},${ty}`)!, tiles.get(`${ux},${uy}`)!));
          }
        }
      }
    }
    expect(worst).toBeLessThan(0.6);
  });

  test('it is fixed by the place, rocks only a little between frames, and sparkles are few', () => {
    let moved = 0;
    let sparkle = 0;
    for (let n = 0; n < 4000; n++) {
      const x = (n * 37) % 1280;
      const y = (n * 91) % 1280;
      expect(deepAt(x, y, 0)).toBe(deepAt(x, y, 0));
      if (lum(deepAt(x, y, 0)) > 130) sparkle += 1;
      if (Math.abs(lum(deepAt(x, y, 0)) - lum(deepAt(x, y, 2))) > 12) moved += 1;
    }
    expect(moved).toBeLessThan(2000);
    expect(sparkle).toBeLessThan(120);
    const a = new Uint8ClampedArray(TILE * TILE * 4);
    const b = new Uint8ClampedArray(TILE * TILE * 4);
    deepTile(3, 4, 0, a);
    deepTile(3, 4, 0, b);
    expect(a).toEqual(b);
  });
});
