import { describe, expect, test } from 'vitest';

import { DUSK, HOLE, LIGHT_POOL, NIGHT, dappleAt, duskAt, frameAt, hourAt, nightAt, shadeAt, tableOf, washAt, warmth } from '../src/light.js';

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
  const KEYS = [
    { at: '05:00', tint: '#7cc4ec', pct: 20 },
    { at: '08:00', tint: '#eda83a', pct: 0 },
    { at: '12:00', tint: '#eda83a', pct: 0 },
    { at: '16:30', tint: '#eda83a', pct: 12 },
    { at: '19:00', tint: '#e2533f', pct: 28 },
    { at: '20:00', tint: '#172a52', pct: 0 },
  ];
  const table = tableOf(KEYS);

  test('the keys sort by the clock, whatever order the file lists them in', () => {
    expect(table.map((k) => k.at)).toEqual([300, 480, 720, 990, 1140, 1200]);
  });

  test('every hour of the day has a wash, and the afternoon stops being noon', () => {
    expect(washAt(table, 12 * 60).alpha).toBe(0);
    expect(washAt(table, 16 * 60 + 30)).toEqual({ tint: 0xeda83a, alpha: 0.12 });
    expect(washAt(table, 19 * 60)).toEqual({ tint: 0xe2533f, alpha: 0.28 });
    expect(washAt(table, 5 * 60)).toEqual({ tint: 0x7cc4ec, alpha: 0.2 });
  });

  test('between two keys the wash steps evenly, in whole percent', () => {
    const mid = washAt(table, 17 * 60 + 45);
    expect(mid.alpha).toBeCloseTo(0.2, 5);
    expect(washAt(table, 20 * 60).alpha).toBe(0);
  });

  test('before the first key and after the last, that key holds', () => {
    expect(washAt(table, 2 * 60).alpha).toBe(0.2);
    expect(washAt(table, 23 * 60).alpha).toBe(0);
  });
});
