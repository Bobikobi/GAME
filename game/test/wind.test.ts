import { describe, expect, test } from 'vitest';

import lightTables from '../src/painted-light.json';
import { litAt, windOfWorld } from '../src/painted-table.js';
import { SWAY, gustAt, leanAt, swing } from '../src/richground.js';
import { gust } from '../src/look.js';
import { DEFAULT_WIND, TILE_PX, WIND_NONE, WIND_SEASON, frontArrival, leanNow, leanSignal, windBetween, type Wind } from '../src/wind.js';
import { GRASS_FS } from '../src/grass-shader.js';

/**
 * Private #44, step C (the owner's word of 13.11: "one engine wind field everything reads"). The wind is a field of the light table's rows, a column per season ('none' today), in tiles a second;
 * the painted door (leaning pieces, ground cover, the meadow's pass, water, fog) and the classic door (the sway of the meadow's greens and the leaning sprites) read the same numbers.
 */
const worlds = lightTables.worlds as unknown as Record<string, { rows: { minute: number; wind?: Record<string, number[]> }[] }>;
const turned: Wind = { x: 0.6, y: -0.8, speed: 1.5, k: 1.4 };

describe('the table carries the wind', () => {
  test('every row of every world names the none column, equal to the valley gust as it was drawn: direction (0.97, 0.24), 180 px a second at 64 px a tile, k 1', () => {
    for (const w of Object.values(worlds)) for (const r of w.rows) expect(r.wind?.[WIND_SEASON]).toEqual([...WIND_NONE]);
    expect(WIND_NONE).toEqual([0.97, 0.24, 2.8125, 1]);
    expect(WIND_NONE[2]! * TILE_PX).toBe(180);
  });

  test('at every minute of the day, in every world, both doors are given the same wind, and it is the one the gust had before', () => {
    for (const name of Object.keys(worlds)) for (let m = 0; m < 1440; m += 7) {
      expect(windOfWorld(name, m)).toEqual(DEFAULT_WIND);
      expect(litAt(worlds[name]!.rows as never, m).wind).toEqual(DEFAULT_WIND);
    }
  });

  test('a line between two rows is a line between their numbers, a season the table does not name takes the none column', () => {
    const a = { none: [1, 0, 2, 1], autumn: [0, 1, 4, 2] } as never;
    const b = { none: [0, 1, 4, 3], autumn: [0, 1, 4, 2] } as never;
    expect(windBetween(a, b, 0.5)).toEqual({ x: 0.5, y: 0.5, speed: 3, k: 2 });
    expect(windBetween(a, b, 0.5, 'autumn')).toEqual({ x: 0, y: 1, speed: 4, k: 2 });
    expect(windBetween(a, b, 0.5, 'winter')).toEqual(windBetween(a, b, 0.5));
    expect(windBetween(undefined, undefined, 0.3)).toEqual(DEFAULT_WIND);
  });
});

describe('both doors read the same numbers', () => {
  const places = [[0, 0], [100, 40], [640, 640], [2000, 1500], [37, 1800]] as const;

  test('the painted door lean is the gust at the front arrival, times k, and the classic door swing is a sine at the same arrival: one front, in either wind', () => {
    for (const w of [DEFAULT_WIND, turned]) for (const [x, y] of places) for (const t of [0, 1.7, 9.31, 40]) {
      const u = frontArrival(w, x, y);
      expect(u).toBeCloseTo((x * w.x + y * w.y) / (w.speed * TILE_PX), 12);
      expect(leanSignal({ fx: x, fy: y }, t, w)).toBeCloseTo((0.3 + 0.62 * gust(t - u)) * w.k, 12);
      expect(swing(x, y, t, w)).toBeCloseTo(Math.sin((2 * Math.PI * (u - t)) / SWAY.period) * w.k, 9);
    }
  });

  test('at the table values of today the painted door lean is exactly what it was before the field (the same number, to the last bit), so its stills cannot change', () => {
    const was = (fx: number, fy: number, t: number): number => 0.3 + 0.62 * gust(t - (fx * 0.97 + fy * 0.24) / 180);
    for (const [x, y] of places) for (const t of [0, 0.5, 3.3, 17.77, 123.4]) expect(leanSignal({ fx: x, fy: y }, t, DEFAULT_WIND)).toBe(was(x, y, t));
  });

  test('the front is one front: places on a line across the wind get it together, in both doors, and a place downwind gets it later by the distance over the speed', () => {
    for (const w of [DEFAULT_WIND, turned]) {
      const across = [-w.y, w.x];
      const ax = 500;
      const ay = 300;
      const bx = ax + across[0]! * 400;
      const by = ay + across[1]! * 400;
      expect(frontArrival(w, ax, ay)).toBeCloseTo(frontArrival(w, bx, by), 9);
      expect(leanSignal({ fx: ax, fy: ay }, 3, w)).toBeCloseTo(leanSignal({ fx: bx, fy: by }, 3, w), 9);
      expect(swing(ax, ay, 3, w)).toBeCloseTo(swing(bx, by, 3, w), 9);
      const dx = ax + w.x * 180;
      const dy = ay + w.y * 180;
      expect(frontArrival(w, dx, dy) - frontArrival(w, ax, ay)).toBeCloseTo((180 * (w.x * w.x + w.y * w.y)) / (w.speed * TILE_PX), 9);
    }
  });

  test('the wind strength leans both doors: k = 0 is calm in each, and a harder k never leans a piece less', () => {
    const calm: Wind = { ...DEFAULT_WIND, k: 0 };
    for (const [x, y] of places) for (let t = 0; t < 12; t += 0.25) {
      expect(gustAt(x, y, t, calm)).toBe(0);
      expect(leanSignal({ fx: x, fy: y }, t, calm)).toBeCloseTo(0, 12);
      expect(gustAt(x, y, t, { ...DEFAULT_WIND, k: 1.5 })).toBeGreaterThanOrEqual(gustAt(x, y, t, DEFAULT_WIND));
    }
    expect(leanNow({ i: 3, fx: 10, fy: 20 }, 2, 5, calm)).toBeLessThanOrEqual(1);
  });

  test('the meadow shader takes the wind as a uniform, none of its numbers is written in its text', () => {
    expect(GRASS_FS).toContain('uniform vec3 uWind;');
    expect(GRASS_FS).toContain('(sc.x * uWind.x + sc.y * uWind.y) / uWind.z');
    expect(GRASS_FS).not.toMatch(/0\.97|0\.24|\b180\b/);
  });
});

describe('the classic door does not flicker in the shared front', () => {
  test('over a 10 s run no tile of the grid changes lean more than twice in any second (the swing runs along the shared front, a period of 5.3 s)', () => {
    let worst = 0;
    const step = 0.02;
    for (const w of [DEFAULT_WIND, turned]) {
      for (let gx = 0; gx < 40; gx++) for (let gy = 0; gy < 24; gy++) {
        const x = gx * 64 + 11;
        const y = gy * 64 + 29;
        const changes: number[] = [];
        let last = leanAt(x, y, 0, w);
        for (let t = step; t <= 10; t += step) {
          const now = leanAt(x, y, t, w);
          if (now !== last) changes.push(t);
          last = now;
        }
        // the most changes inside any window of one second
        for (let i = 0; i < changes.length; i++) worst = Math.max(worst, changes.filter((c) => c >= changes[i]! && c < changes[i]! + 1).length);
      }
    }
    expect(worst).toBeLessThanOrEqual(2);
  });
});
