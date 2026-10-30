import { describe, expect, test } from 'vitest';

import {
  DUSK, HEAD_GLOW, HOLE, LIGHT_POOL, NIGHT, POOL_DITHER, POOL_RADIUS, POOL_STEPS, READ, bankAt, bodyLight, bodyStep, cloudAt, cutAt, cutKeep, dappleAt, duskAt, frameAt, hourAt,
  litSide, lumaOf, nightAt, poolAt, poolColour, poolDisc, poolStep, poolSun, readableAlpha, shadeAt, tableOf, washAt, warmth,
} from '../src/light.js';

/**
 * ART_SYSTEM section 2: one module holds the light, and its numbers are today's numbers. Every
 * value world.ts drew by hand on 20.10 is pinned here, so moving the light out of the scene could
 * not have changed what a player sees.
 */
describe('the hour', () => {
  test('night falls from 21:00 to 04:00 and fades over two hours on each side', () => {
    expect(nightAt(12 * 60)).toBe(0);
    expect(nightAt(19 * 60)).toBe(0);
    expect(nightAt(20 * 60)).toBeCloseTo(0.5, 5);
    expect(nightAt(21 * 60)).toBe(1);
    expect(nightAt(2 * 60)).toBe(1);
    expect(nightAt(4 * 60)).toBe(1);
    expect(nightAt(5 * 60)).toBeCloseTo(0.5, 5);
    expect(nightAt(6 * 60)).toBe(0);
  });

  test('the hour of a minute is the hour a clock shows', () => {
    expect(hourAt(0)).toBe(0);
    expect(hourAt(19 * 60 + 59)).toBe(19);
    expect(hourAt(23 * 60 + 30)).toBe(23);
  });

  test('the dusk peaks at 20:00 and again at 05:30, and nowhere at noon', () => {
    expect(duskAt(20 * 60)).toBeCloseTo(DUSK.peak, 5);
    expect(duskAt(5 * 60 + 30)).toBeCloseTo(DUSK.peak, 5);
    expect(duskAt(12 * 60)).toBe(0);
  });
});

describe('what the shade and the dapple are worth', () => {
  test('the shade is half the night and the dapple is its opposite', () => {
    expect(shadeAt(0)).toBe(0);
    expect(shadeAt(1)).toBe(0.5);
    expect(dappleAt(0)).toBe(0.08);
    expect(dappleAt(1)).toBe(0);
  });

  test('the frame tightens at night, and tighter still with the light layer on', () => {
    expect(frameAt(0, true)).toEqual({ strength: 0.3, radius: 0.8 });
    expect(frameAt(1, true)).toEqual({ strength: 0.3 + 0.45, radius: 0.8 - 0.15 });
    expect(frameAt(1, false)).toEqual({ strength: 0.3 + 0.3, radius: 0.8 - 0.15 });
  });

  test('warmth is flat within half an hour of its centre and gone past the shoulder', () => {
    expect(warmth(20, 20)).toBe(1);
    expect(warmth(20.5, 20)).toBe(1);
    expect(warmth(22, 20)).toBe(0);
  });
});

describe('the lantern pool', () => {
  test('the hole is the pool plus its edge, both sides', () => {
    expect(HOLE).toBe(2 * (LIGHT_POOL.r + LIGHT_POOL.edge + 1));
  });

  test('the pool keeps the numbers it was decided with', () => {
    expect(LIGHT_POOL).toEqual({ r: 34, edge: 2, dark: 0.7, tint: 0xf0dcc0 });
    expect(NIGHT).toEqual({ from: 21, to: 4, fade: 2 });
  });
});

describe('the hour table from params', () => {
  // today's curve, keyed: gold at 40% across the half hour either side of 20:00 and of 05:30
  const KEYS = [
    { at: '04:15', tint: '#eda83a', pct: 0 },
    { at: '05:00', tint: '#eda83a', pct: 40 },
    { at: '06:00', tint: '#eda83a', pct: 40 },
    { at: '06:45', tint: '#eda83a', pct: 0 },
    { at: '18:45', tint: '#eda83a', pct: 0 },
    { at: '19:30', tint: '#eda83a', pct: 40 },
    { at: '20:30', tint: '#eda83a', pct: 40 },
    { at: '21:15', tint: '#eda83a', pct: 0 },
  ];
  const table = tableOf(KEYS);

  test('the keys sort by the clock, whatever order the file lists them in', () => {
    expect(table.map((k) => k.at)).toEqual([255, 300, 360, 405, 1125, 1170, 1230, 1275]);
  });

  test('the table reproduces the two peaks the valley shows today', () => {
    expect(washAt(table, 20 * 60)).toEqual({ tint: 0xeda83a, alpha: 0.4 });
    expect(washAt(table, 5 * 60 + 30)).toEqual({ tint: 0xeda83a, alpha: 0.4 });
    expect(washAt(table, 12 * 60)).toEqual({ tint: 0xeda83a, alpha: 0 });
    expect(washAt(table, 16 * 60 + 30)).toEqual({ tint: 0xeda83a, alpha: 0 });
  });

  test('the shoulders ramp evenly and reach nothing at the edges', () => {
    expect(washAt(table, 6 * 60 + 45).alpha).toBe(0);
    expect(washAt(table, 18 * 60 + 45).alpha).toBe(0);
    expect(washAt(table, 21 * 60 + 15).alpha).toBe(0);
    expect(washAt(table, 19 * 60).alpha).toBe(0.13);
    expect(washAt(table, 20 * 60 + 45).alpha).toBe(0.27);
  });

  test('outside the keys the day is plain', () => {
    expect(washAt(table, 2 * 60).alpha).toBe(0);
    expect(washAt(table, 23 * 60).alpha).toBe(0);
    expect(washAt(table, 12 * 60).alpha).toBe(0);
  });

  test('a key that crosses midnight is read across it, not cut at the clock', () => {
    // the decided night key as it will read: strong at 22:00, nothing at 05:00
    const night = tableOf([
      { at: '05:00', tint: '#000000', pct: 0 },
      { at: '22:00', tint: '#ffffff', pct: 60 },
    ]);
    expect(washAt(night, 22 * 60).alpha).toBeCloseTo(0.6, 5);
    expect(washAt(night, 5 * 60).alpha).toBeCloseTo(0, 5);
    // the stretch is 22:00 to 05:00, seven hours: 01:00 is three of them in, so three sevenths are gone
    expect(washAt(night, 60).alpha).toBeCloseTo(0.34, 2);
    expect(washAt(night, 23 * 60 + 59).alpha).toBeCloseTo(0.43, 2);
    expect(washAt(night, 2 * 60).alpha).toBeCloseTo(0.26, 2);
    // and no minute steps the wash by more than a rounding of a percent
    for (let m = 0; m < 1440; m += 1) {
      // whole percents, so a minute is at most a percent: no step in the circle is bigger than that
      expect(Math.abs(washAt(night, (m + 1) % 1440).alpha - washAt(night, m).alpha)).toBeLessThanOrEqual(0.0101);
    }
  });
});

describe('the wash steps its colour', () => {
  const t = tableOf([
    { at: '16:30', tint: '#eda83a', pct: 12 },
    { at: '17:30', tint: '#eda83a', pct: 28 },
    { at: '19:00', tint: '#e2533f', pct: 40 },
  ]);

  test('on a key the key colour, past it the next key colour, never a mix of the two', () => {
    expect(washAt(t, 19 * 60)).toEqual({ tint: 0xe2533f, alpha: 0.4 });
    expect(washAt(t, 17 * 60 + 30).tint).toBe(0xeda83a);
    expect(washAt(t, 18 * 60).tint).toBe(0xe2533f);
    expect(washAt(t, 18 * 60 + 15).alpha).toBe(0.34);
  });
});

describe('the lighting ladder (LIGHTING.md, C)', () => {
  test('the pool keeps the four steps and the dither it was picked with', () => {
    expect(POOL_STEPS.map((s) => [s.edge, s.tint, s.pct])).toEqual([[0.25, 0xf8de62, 24], [0.5, 0xeda83a, 18], [0.75, 0xeda83a, 12], [1, 0xb8661f, 8]]);
    expect(POOL_DITHER).toBe(0.03);
    expect(POOL_RADIUS).toEqual({ lamp: [1.5, 1.5], fire: [2, 2], window: [1, 0.625] });
    expect(HEAD_GLOW.steps).toEqual([{ r: 6, pct: 50 }, { r: 12, pct: 25 }]);
  });

  test('lamps and windows paint from 17:00 at half, full by 19:00, none by day; a fire from 16:30', () => {
    expect(poolAt(12 * 60, 'lamp')).toBe(0);
    expect(poolAt(16 * 60 + 59, 'lamp')).toBe(0);
    expect(poolAt(17 * 60, 'lamp')).toBe(0.5);
    expect(poolAt(17 * 60 + 30, 'lamp')).toBe(0.625);
    expect(poolAt(19 * 60, 'window')).toBe(1);
    expect(poolAt(2 * 60, 'lamp')).toBe(1);
    expect(poolAt(6 * 60, 'lamp')).toBe(0.75);
    expect(poolAt(7 * 60, 'lamp')).toBe(0);
    expect(poolAt(16 * 60 + 29, 'fire')).toBe(0);
    expect(poolAt(16 * 60 + 30, 'fire')).toBe(0.5);
    expect(poolAt(18 * 60 + 30, 'fire')).toBe(1);
  });

  test('a step is whole pixels, checkered only within the dither of its edge', () => {
    expect(poolStep(0, false)).toBe(0);
    expect(poolStep(0.24, false)).toBe(0);
    expect(poolStep(0.24, true)).toBe(1);
    expect(poolStep(0.6, true)).toBe(2);
    expect(poolStep(1.02, false)).toBe(3);
    expect(poolStep(1.04, false)).toBe(-1);
    const d = poolDisc(4, 4, 3);
    expect([d.w, d.h]).toEqual([9, 9]);
    expect(d.mask[4 * 9 + 4]).toBe(1);
    expect(d.mask[0]).toBe(0);
  });

  test('a step stores its colour times its strength times the gate', () => {
    expect(poolColour(POOL_STEPS[0]!, 1)).toBe((Math.round(0xf8 * 0.24) << 16) | (Math.round(0xde * 0.24) << 8) | Math.round(0x62 * 0.24));
    expect(poolColour(POOL_STEPS[0]!, 0)).toBe(0);
  });

  test('a light cuts the shade clean inside half its radius and to half in the ring (STYLE 5)', () => {
    expect(cutAt(0.2, false)).toBe(0);
    expect(cutAt(0.8, false)).toBe(0.5);
    expect(cutAt(1.2, false)).toBe(1);
    expect(cutKeep(0, 0.5)).toBe(0.5);
    expect(cutKeep(0.5, 1)).toBe(0.5);
  });

  test('the readable shade keeps the meadow green at the floor under the night ink', () => {
    const ground = lumaOf(READ.ground);
    const ink = lumaOf(0x172a52);
    const a = readableAlpha(READ.floor / 100, ground, ink);
    expect(ground * (1 - a + a * ink)).toBeCloseTo(READ.floor / 100, 6);
    expect(a).toBeLessThan(0.92);
    expect(readableAlpha(0.6, 0.5, 0.1)).toBe(0);
  });

  test('cloud shade is gone by 20:00, and a fog bank cannot stack past its cap at night', () => {
    expect(cloudAt(nightAt(12 * 60))).toBe(1);
    expect(cloudAt(nightAt(19 * 60 + 30))).toBe(0.5);
    expect(cloudAt(nightAt(20 * 60))).toBe(0);
    expect(bankAt(1, 1, 1, 0.4)).toBe(0.4);
    expect(bankAt(0.3, 1, 0, 0.4)).toBeCloseTo(0.3, 6);
    expect(bankAt(1, 1, 0, 0.4)).toBe(0.95);
  });

  test('body light: the lit side a step up its ramp, the far side a step down, ink stays ink, none at noon', () => {
    expect(litSide(0.5)).toBe('left');
    expect(litSide(-0.5)).toBe('right');
    expect(litSide(0.05)).toBeUndefined();
    expect(bodyStep(0x4c9a3f, 1)).toBe(0x84c450);
    expect(bodyStep(0x4c9a3f, -1)).toBe(0x2e6b3b);
    expect(bodyStep(0x1b1a2e, 1)).toBe(0x1b1a2e);
    // a row of ten solid pixels, lit from the left: four lighter, four darker, the middle untouched
    const src = new Uint8ClampedArray(10 * 4);
    for (let x = 0; x < 10; x++) src.set([0x4c, 0x9a, 0x3f, 255], 4 * x);
    const out = new Uint8ClampedArray(10 * 4);
    bodyLight(src, 10, 1, 'left', out);
    expect([...out.slice(0, 4)]).toEqual([0x84, 0xc4, 0x50, 255]);
    expect([...out.slice(16, 20)]).toEqual([0, 0, 0, 0]);
    expect([...out.slice(36, 40)]).toEqual([0x2e, 0x6b, 0x3b, 255]);
  });

  test('by night a body in a pool casts away from the light; outside it nothing casts', () => {
    const s = poolSun(0, -10, 24, 0.3, 1)!;
    expect(s.sy).toBeLessThan(0);
    expect(s.sx).toBe(0);
    expect(s.alpha).toBe(0.3);
    expect(poolSun(0, 30, 24, 0.3, 1)).toBeUndefined();
    expect(poolSun(0, 5, 24, 0.3, 0)).toBeUndefined();
  });
});
