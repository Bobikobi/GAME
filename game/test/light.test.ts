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
});
