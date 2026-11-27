import { describe, expect, test } from 'vitest';

import { litAt, lightRowsOf, shadeTint } from '../src/painted-table.js';
import { groundLightOf, waterHoldTwilight } from '../src/look.js';

/**
 * Private #44, step B (owner's rule L3 of 10.11: "sunset is red in the lit ground and in the shadows"). The shadow's warmth is its own field of the light table (`warm`), read only by the shadow's
 * tint; the ambient and the sun are never touched, because the water's hue follows them (V5c: warming the 17:30 ambient moved the dusk water from 173 to 149).
 */
const river = lightRowsOf({ id: 'valley', hourset: 'river' });
const rows = river.map((r) => ({ ...r, warm: undefined }));

const luma = (c: readonly number[]): number => 255 * (0.3 * c[0]! + 0.59 * c[1]! + 0.11 * c[2]!);
const hue = (c: readonly number[]): number => ((Math.atan2(Math.sqrt(3) * (c[1]! - c[2]!), 2 * c[0]! - c[1]! - c[2]!) * 180) / Math.PI + 360) % 360;
const full = (m: number, rs = river) => {
  const l = litAt(rs, m);
  return { l, tint: shadeTint(l, 1 - l.al) };
};

describe('the shadow warmth of the river world', () => {
  test('a row that names none is [1, 1, 1], and a line between two rows is a line between their numbers', () => {
    expect(litAt(rows, 1110).warm).toEqual([1, 1, 1]);
    expect(litAt(river, 780).warm).toEqual([1, 1, 1]);
    const a = river.find((r) => r.minute === 1110)!.warm!;
    const b = river.find((r) => r.minute === 1170)!.warm!;
    const mid = litAt(river, 1140).warm;
    for (let c = 0; c < 3; c++) expect(mid[c]).toBeCloseTo((a[c]! + b[c]!) / 2, 9);
  });

  test('warmth never reaches the light the ground is lit by: the ambient, the sun and the ground light are the same with and without it', () => {
    for (let m = 0; m < 1440; m += 10) {
      const w = litAt(river, m);
      const n = litAt(rows, m);
      expect(w.amb).toEqual(n.amb);
      expect(w.sun).toEqual(n.sun);
      expect(groundLightOf(w)).toEqual(groundLightOf(n));
    }
  });

  test('a lit surface is not tinted at all (v = 1), and a shadow is redder than without the warmth at 17:30 and 18:30, and no cooler at 19:30', () => {
    for (const m of [1050, 1110, 1170]) {
      expect(shadeTint(litAt(river, m), 1)).toEqual(shadeTint(litAt(rows, m), 1));
      const t = full(m).tint;
      const t0 = full(m, rows as typeof river).tint;
      expect(t[0] / t[2]).toBeGreaterThanOrEqual((t0[0] / t0[2]) * (m === 1170 ? 1.05 : 1.15));
    }
  });

  test('the warmth adds less than 0.25 luma level and 2 degrees of hue a game minute to the shadow colour, round the clock (the bar of the whole frame is light/B, measured on frames)', () => {
    let prev = full(0).tint;
    let prev0 = full(0, rows as typeof river).tint;
    for (let m = 1; m <= 1440; m++) {
      const t = full(m % 1440).tint;
      const t0 = full(m % 1440, rows as typeof river).tint;
      expect(Math.abs(luma(t) - luma(prev) - (luma(t0) - luma(prev0)))).toBeLessThan(0.25);
      if (litAt(river, m % 1440).al > 0.3) {
        const d = (a: number, b: number): number => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
        expect(Math.abs(d(hue(t), hue(prev)) - d(hue(t0), hue(prev0)))).toBeLessThan(2);
      }
      prev = t;
      prev0 = t0;
    }
  });
});

describe('the water keeps its hue family through the twilights (L7 at every hour)', () => {
  test('nothing is taken off the water by noon, by the night, or by a pale dawn sun; it is taken off the red from 17:30', () => {
    for (const m of [0, 180, 780, 1230, 1380]) expect(waterHoldTwilight(litAt(river, m)).map((c) => Math.round(c * 100) / 100)).toEqual([1, 1, 1]);
    const h = waterHoldTwilight(litAt(river, 1170));
    expect(h[0]).toBeLessThan(0.8);
    expect(h[2]).toBeGreaterThan(1.2);
    for (const m of [1050, 1110, 1170]) {
      const [r, , b] = waterHoldTwilight(litAt(river, m));
      expect(r).toBeLessThan(b);
    }
    // the dawn's blue, where the night's own hold has let go (06:00: the ambient is between the night's and the day's)
    const d = waterHoldTwilight(litAt(river, 360));
    expect(d[2]).toBeLessThan(d[0]);
  });
  test('the hold moves smoothly: no channel changes by more than 4% a game minute (the smoothness of the whole frame is light/B, measured on frames)', () => {
    let p = waterHoldTwilight(litAt(river, 0));
    for (let m = 1; m <= 1440; m++) {
      const h = waterHoldTwilight(litAt(river, m % 1440));
      for (let c = 0; c < 3; c++) expect(Math.abs(h[c]! - p[c]!)).toBeLessThan(0.04 * p[c]!);
      p = h;
    }
  });
});
