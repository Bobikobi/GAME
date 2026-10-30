/** The wild brain's senses (HUNTING 3): integer sight, hearing and the line between. */
import { describe, expect, test } from 'vitest';

import { d2, hearsNoise, lineClear, notices, seesPlayer, seesTile, sightRadius } from '../src/wild/senses';
import { HARE, NOISE, creature, field, grid, lcg, player, view } from './wild-fixtures';

const OPEN = grid(field(31));

describe('the senses', () => {
  test('d2 is integer and symmetric', () => {
    const r = lcg(7);
    for (let i = 0; i < 500; i++) {
      const a = [r(61) - 30, r(61) - 30] as const;
      const b = [r(61) - 30, r(61) - 30] as const;
      expect(Number.isSafeInteger(d2(a, b))).toBe(true);
      expect(d2(a, b)).toBe(d2(b, a));
      expect(d2(a, b)).toBeGreaterThanOrEqual(0);
    }
    expect(d2([0, 0], [3, 4])).toBe(25);
  });

  test('sight halves behind, cover takes 2, sleep a third', () => {
    const hare = creature({ at: [15, 15], face: [1, 0] });
    const v = view(OPEN);
    // front 6, rear ceil(6 / 2) = 3
    expect(seesTile(HARE, hare, v, [21, 15])).toEqual({ r: 6 });
    expect(seesTile(HARE, hare, v, [22, 15])).toBeUndefined();
    expect(seesTile(HARE, hare, v, [12, 15])).toEqual({ r: 3 });
    expect(seesTile(HARE, hare, v, [11, 15])).toBeUndefined();
    // a player in tall grass: 4 in front, 2 behind (cover first, then the halving: question 5 default)
    const grass = grid(field(31).map((row, y) => (y === 15 ? row.replace(/\./g, 'g') : row)));
    const g = view(grass);
    expect(sightRadius(HARE, hare, g, [19, 15])).toBe(4);
    expect(seesTile(HARE, hare, g, [19, 15])).toEqual({ r: 4 });
    expect(seesTile(HARE, hare, g, [20, 15])).toBeUndefined();
    expect(seesTile(HARE, hare, g, [13, 15])).toEqual({ r: 2 });
    // head down at GRAZE takes 2 as well; asleep, ceil(6 / 3) = 2 all round
    expect(sightRadius(HARE, { ...hare, state: 'GRAZE', up: 0 }, v, [19, 15])).toBe(4);
    expect(sightRadius(HARE, { ...hare, state: 'GRAZE', up: 2 }, v, [19, 15])).toBe(6);
    expect(sightRadius(HARE, { ...hare, state: 'SLEEP' }, v, [19, 15])).toBe(2);
    // never under 1
    expect(sightRadius({ ...HARE, sight: 2 }, { ...hare, state: 'GRAZE', up: 0 }, g, [16, 15])).toBe(1);
  });

  test('a wall stops sight, not hearing', () => {
    const rows = field(31).map((row, y) => (y === 15 ? `${row.slice(0, 18)}#${row.slice(19)}` : row));
    const v = view(grid(rows), { player: player([20, 15], NOISE.walk) });
    const hare = creature({ at: [15, 15], face: [1, 0] });
    expect(seesPlayer(HARE, hare, v)).toBeUndefined();
    // walk noise 5 + ear 2: heard at 7, not at 8
    expect(hearsNoise(HARE, hare, [22, 15], NOISE.walk)).toEqual({ r: 7 });
    expect(hearsNoise(HARE, hare, [23, 15], NOISE.walk)).toBeUndefined();
    expect(notices(HARE, hare, v)).toEqual({ at: [20, 15], r: 7, dd: 25 });
  });

  test('within two tiles always noticed', () => {
    const rows = field(31).map((row, y) => (y === 15 ? `${row.slice(0, 14)}#${row.slice(15)}` : row));
    const hare = creature({ at: [15, 15], face: [1, 0], state: 'SLEEP' });
    const v = view(grid(rows), { player: player([13, 15], 0) });
    expect(seesPlayer(HARE, hare, v)).toEqual({ r: 2 });
    expect(seesPlayer(HARE, { ...hare, at: [15, 15] }, view(grid(rows), { player: player([12, 15], 0) }))).toBeUndefined();
  });

  test('a sleeping player is not a player to an animal', () => {
    const hare = creature({ at: [15, 15], face: [1, 0] });
    const v = view(OPEN, { player: { at: [16, 15], face: [-1, 0], noise: NOISE.run, asleep: true } });
    expect(notices(HARE, hare, v)).toBeUndefined();
  });

  test('a hunter in sight is a threat like a player', () => {
    const hare = creature({ at: [15, 15], face: [1, 0] });
    expect(notices(HARE, hare, view(OPEN, { threats: [[19, 15]] }))).toEqual({ at: [19, 15], r: 6, dd: 16 });
    expect(notices(HARE, hare, view(OPEN, { threats: [[22, 15]] }))).toBeUndefined();
  });

  test('the line of sight is the same both ways and never passes a wall', () => {
    const r = lcg(11);
    const rows = field(31).map((row) => [...row].map((c, x) => (c === '.' && r(100) < 20 && x !== 15 ? '#' : c)).join(''));
    const map = grid(rows);
    for (let i = 0; i < 400; i++) {
      const a = [1 + r(29), 1 + r(29)] as const;
      const b = [1 + r(29), 1 + r(29)] as const;
      expect(lineClear(map, a, b)).toBe(lineClear(map, b, a));
    }
    // a straight row with a wall in the middle is blocked; ends are not counted
    expect(lineClear(grid(['#####', '#.#.#', '#####']), [1, 1], [3, 1])).toBe(false);
    expect(lineClear(grid(['#####', '#...#', '#####']), [1, 1], [3, 1])).toBe(true);
    expect(lineClear(OPEN, [5, 5], [5, 5])).toBe(true);
  });
});
