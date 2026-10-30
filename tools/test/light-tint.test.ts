/** The tint comparison's measure (LIGHTING.md section 5, question 1), pinned on one fixture of known colours. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, test } from 'vitest';

import { closest, distance, lab, luma, median, medianOf, midtones } from '../src/light/tint';

// 4 x 2: grey 808080, gold eda83a, black, white / green 4c9a3f, blue 3f8fd1, gold fully clear, deep blue 275a99
const png = PNG.sync.read(readFileSync(join(__dirname, 'fixtures', 'light', 'tint-fixture.png')));

describe('CIELAB', () => {
  test('a neutral grey has no hue and the L of the standard', () => {
    const g = lab(128, 128, 128);
    expect(g.L).toBeCloseTo(53.585, 2);
    expect(g.a).toBeCloseTo(0, 3);
    expect(g.b).toBeCloseTo(0, 3);
  });

  test('the fire ramp gold is warm: a* and b* both positive, b* the larger', () => {
    const c = lab(0xed, 0xa8, 0x3a);
    expect(c.L).toBeCloseTo(73.752, 2);
    expect(c.a).toBeCloseTo(15.941, 2);
    expect(c.b).toBeCloseTo(63.542, 2);
  });

  test('luma is Rec. 709 on the encoded channels', () => {
    expect(luma(255, 255, 255)).toBeCloseTo(1, 6);
    expect(luma(128, 128, 128)).toBeCloseTo(0.502, 3);
  });
});

describe('the midtones of the fixture', () => {
  test('black, white and the clear pixel are left out; the five midtones are averaged', () => {
    const m = midtones(png.data, png.width, png.height, [[0, 0, 1, 1]]);
    expect(m.n).toBe(5);
    // the hand-computed means of grey, gold, green, blue and deep blue
    expect(m.a).toBeCloseTo((0 + 15.941 - 42.229 - 2.977 + 5.513) / 5, 2);
    expect(m.b).toBeCloseTo((0 + 63.542 + 39.81 - 41.002 - 39.354) / 5, 2);
    expect(m.chroma).toBeCloseTo((0 + Math.hypot(15.941, 63.542) + Math.hypot(42.229, 39.81) + Math.hypot(2.977, 41.002) + Math.hypot(5.513, 39.354)) / 5, 2);
  });

  test('a box reads only its own pixels, and two boxes that overlap count a pixel once', () => {
    const top = midtones(png.data, png.width, png.height, [[0, 0, 1, 0.5]]);
    expect(top.n).toBe(2);
    const twice = midtones(png.data, png.width, png.height, [[0, 0, 1, 0.5], [0, 0, 0.5, 0.5]]);
    expect(twice).toEqual(top);
  });

  test('an empty region measures nothing, not NaN', () => {
    expect(midtones(png.data, png.width, png.height, [[0.5, 0, 1, 0.5]])).toEqual({ n: 0, a: 0, b: 0, chroma: 0 });
  });
});

describe('the pick', () => {
  test('the median of each number on its own, and the closest candidate by distance', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    const t = medianOf([{ n: 1, a: 1, b: 10, chroma: 10 }, { n: 1, a: 3, b: 30, chroma: 30 }, { n: 1, a: 2, b: 20, chroma: 20 }]);
    expect(t).toEqual({ n: 3, a: 2, b: 20, chroma: 20 });
    const row = [0, 12, 18].map((pct) => ({ pct, m: { n: 1, a: pct / 6, b: pct, chroma: pct } }));
    expect(closest(row, t)?.pct).toBe(18);
    expect(distance(row[0]!.m, row[0]!.m)).toBe(0);
  });
});
