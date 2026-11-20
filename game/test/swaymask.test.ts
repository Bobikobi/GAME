import { describe, expect, test } from 'vitest';
import { HOLD, MAX_LEAN, opaqueRows, rowShift, rowWeight, shear } from '../src/swaymask';
import { gustAt, leanAt } from '../src/richground';

/** A tree-shaped picture: a trunk column 2 wide from row 9 to 19 and a crown 8 wide from row 2 to 8, 12 px wide, 20 tall. */
function tree(): { data: Uint8ClampedArray; w: number; h: number } {
  const w = 12;
  const h = 20;
  const data = new Uint8ClampedArray(w * h * 4);
  const dot = (x: number, y: number, v: number) => data.set([v, 100, 50, 255], 4 * (y * w + x));
  for (let y = 2; y <= 8; y++) for (let x = 2; x < 10; x++) dot(x, y, 10 + y);
  for (let y = 9; y <= 19; y++) for (let x = 5; x < 7; x++) dot(x, y, 200);
  return { data, w, h };
}
const row = (data: ArrayLike<number>, w: number, y: number) => Array.from({ length: w }, (_, x) => data[4 * (y * w + x) + 3] ?? 0).map((a) => (a > 0 ? 1 : 0)).join('');

describe('wind by a mask of height', () => {
  test('the mask is the picture\'s own opaque rows: nothing at the foot, all of it at the top, nothing in the held band', () => {
    const { data, w, h } = tree();
    const rows = opaqueRows(data, w, h)!;
    expect(rows).toEqual({ top: 2, foot: 19 });
    expect(rowWeight(19, rows)).toBe(0);
    expect(rowWeight(2, rows)).toBe(1);
    for (let y = rows.foot; y >= rows.foot - Math.floor(HOLD * (rows.foot - rows.top)); y--) expect(rowWeight(y, rows)).toBe(0);
    for (let y = rows.foot; y > rows.top; y--) expect(rowWeight(y - 1, rows)).toBeGreaterThanOrEqual(rowWeight(y, rows));
    // an empty picture has no mask
    expect(opaqueRows(new Uint8ClampedArray(16), 2, 2)).toBeUndefined();
  });

  test('the top leans the whole gust, whole art pixels, the foot row never moves', () => {
    const { data, w, h } = tree();
    const rows = opaqueRows(data, w, h)!;
    for (let lean = 0; lean <= MAX_LEAN; lean++) {
      expect(rowShift(rows.top, rows, lean)).toBe(lean);
      expect(rowShift(rows.foot, rows, lean)).toBe(0);
      const out = shear(data, w, h, lean, MAX_LEAN);
      // the foot row and the trunk's rows are the plain picture's, byte for byte
      for (let y = 15; y <= rows.foot; y++) expect(row(out, w + MAX_LEAN, y)).toBe(`${row(data, w, y)}${'0'.repeat(MAX_LEAN)}`);
      // the top row moved by exactly the lean
      expect(row(out, w + MAX_LEAN, rows.top)).toBe(`${'0'.repeat(lean)}${row(data, w, rows.top)}${'0'.repeat(MAX_LEAN - lean)}`);
      // nothing was lost: the same number of opaque pixels
      let before = 0;
      let after = 0;
      for (let i = 3; i < data.length; i += 4) before += data[i]! > 0 ? 1 : 0;
      for (let i = 3; i < out.length; i += 4) after += out[i]! > 0 ? 1 : 0;
      expect(after).toBe(before);
    }
  });

  test('a mirrored sprite leans with the wind too: the left-sheared frame, mirrored, is the mirrored picture sheared right, byte for byte', () => {
    const { data, w, h } = tree();
    const mirror = (src: ArrayLike<number>, width: number) => {
      const out = new Uint8ClampedArray(src.length);
      for (let y = 0; y < src.length / 4 / width; y++) for (let x = 0; x < width; x++) for (let c = 0; c < 4; c++) out[4 * (y * width + x) + c] = src[4 * (y * width + (width - 1 - x)) + c] ?? 0;
      return out;
    };
    for (let lean = 0; lean <= MAX_LEAN; lean++) {
      const shownMirrored = mirror(shear(data, w, h, lean, MAX_LEAN, true), w + MAX_LEAN);
      const want = shear(mirror(data, w), w, h, lean, MAX_LEAN);
      expect(Array.from(shownMirrored)).toEqual(Array.from(want));
      // the left lean moves the top row left by the lean, the foot row not at all
      const left = shear(data, w, h, lean, MAX_LEAN, true);
      expect(row(left, w + MAX_LEAN, 19)).toBe(`${'0'.repeat(MAX_LEAN)}${row(data, w, 19)}`);
      expect(row(left, w + MAX_LEAN, 2)).toBe(`${'0'.repeat(MAX_LEAN - lean)}${row(data, w, 2)}${'0'.repeat(lean)}`);
    }
  });

  test('lean 0 is the picture itself, so a calm moment shows the plain sprite', () => {
    const { data, w, h } = tree();
    const out = shear(data, w, h, 0, MAX_LEAN);
    for (let y = 0; y < h; y++) expect(row(out, w + MAX_LEAN, y)).toBe(`${row(data, w, y)}${'0'.repeat(MAX_LEAN)}`);
  });

  test('a tree leans by the grass\'s own gust: the same sum before the row band, never less than the grass beside it', () => {
    const seen = new Set<number>();
    for (let x = 0; x < 400; x++) {
      const g = gustAt(x, 7, 0);
      seen.add(g);
      expect(leanAt(x, 7, 0)).toBeLessThanOrEqual(g);
      expect(leanAt(x, 7, 0)).toBeGreaterThanOrEqual(Math.max(0, g - 1));
    }
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });
});
