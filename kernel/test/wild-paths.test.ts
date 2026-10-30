/** Paths for the wild: bounded maps, the flee map and its dead ends, the run home, ties broken N E S W. */
import { describe, expect, test } from 'vitest';

import { think } from '../src/wild/brain';
import { type Field, bfs, boxAround, fleeMap, homeMap, homeStep, nextTile, ringTiles, valueAt } from '../src/wild/paths';
import { d2 } from '../src/wild/senses';
import type { Tile } from '../src/wild/types';
import { HARE, NOISE, creature, field, grid, lcg, player, view } from './wild-fixtures';

const RUNNER = { ...HARE, flight: 'ground' as const };

// T the threat, H the animal; a dead-end corridor north of H, open ground east
const DEAD_END = [
  '###################',
  '#####.#############',
  '#####.#############',
  '#####.######......#',
  '#T...H............#',
  '############......#',
  '############......#',
  '###################',
];

describe('the flee map', () => {
  test('flee map avoids a dead end', () => {
    const map = grid(DEAD_END);
    const [t] = map.find('T');
    const [h] = map.find('H');
    // plain distance ties north and east, and N E S W would take the corridor
    const box = boxAround(h!, 12);
    const plain: Field = { box, v: bfs(map.open, [t!], box, 999).map((d) => (d < 0 ? 0x7fff_ffff : -d)), none: 0x7fff_ffff };
    expect(nextTile(plain, h!, map.open)).toEqual([5, 3]);
    // the flee map's passes pull the open side down: east
    expect(nextTile(fleeMap(map.open, t!, h!, 12), h!, map.open)).toEqual([6, 4]);
    // and a hare put up there runs east and never into the corridor
    const c = creature({ at: [h![0], h![1]], left: 100 });
    const v = view(map, { anchorAt: h!, player: player(t!, NOISE.run) });
    expect(think(RUNNER, c, v).events.map((e) => e.e)).toEqual(['flee']);
    expect(c.at[0]).toBeGreaterThanOrEqual(12);
    for (let i = 0; i < 6; i++) {
      think(RUNNER, c, v);
      expect(c.at[1] === 4 || c.at[0] >= 12).toBe(true);
    }
  });

  test('flee map never routes through blocked tiles, and every run ends', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const r = lcg(seed);
      const rows = field(31).map((row, y) => [...row].map((ch, x) => (ch === '.' && !(x === 15 && y === 15) && r(100) < 25 ? '#' : ch)).join(''));
      const map = grid(rows);
      const threat: Tile = [1 + r(29), 1 + r(29)];
      const flee = fleeMap(map.open, threat, [15, 15], 12);
      let at: Tile = [15, 15];
      let steps = 0;
      for (;;) {
        const next = nextTile(flee, at, map.open);
        if (!next) break;
        expect(map.open(next[0], next[1])).toBe(true);
        expect(Math.abs(next[0] - at[0]) + Math.abs(next[1] - at[1])).toBe(1);
        expect(valueAt(flee, next[0], next[1])).toBeLessThan(valueAt(flee, at[0], at[1]));
        at = next;
        steps++;
        expect(steps).toBeLessThanOrEqual(25 * 25);
      }
    }
  });
});

describe('the run home', () => {
  const OPEN = grid(field(41));
  const DEN: Tile = [20, 10];

  function path(threat: Tile, from: Tile): Tile[] {
    const home = homeMap(OPEN.open, DEN, from, HARE.roam + 4);
    const out: Tile[] = [from];
    let at = from;
    for (let i = 0; i < 40; i++) {
      const next = homeStep(home, at, threat, OPEN.open);
      if (!next) break;
      out.push(next);
      at = next;
    }
    return out;
  }

  test('the hare runs home around the player', () => {
    const threat: Tile = [22, 16];
    const run = path(threat, [20, 18]);
    expect(run[run.length - 1]).toEqual(DEN);
    for (const t of run) expect(d2(t, threat)).toBeGreaterThan(2);
    // the whole run in think: home in one think at the run (8 tiles), then under
    const c = creature({ at: [20, 18], anchor: 'core/hare@20,10', left: 100 });
    const out = think(HARE, c, view(OPEN, { anchorAt: DEN, player: player(threat, NOISE.run) }));
    expect(out.events.map((e) => e.e)).toEqual(['flee', 'home']);
    expect(c).toMatchObject({ at: DEN, under: true, left: 8 });
  });

  test('threat between it and home: it flees in the open', () => {
    const threat: Tile = [20, 15];
    expect(path(threat, [20, 18])).toEqual([[20, 18]]);
    const c = creature({ at: [20, 18], anchor: 'core/hare@20,10', left: 100 });
    const v = view(OPEN, { anchorAt: DEN, player: player(threat, NOISE.run) });
    let last = d2(c.at, threat);
    for (let i = 0; i < 3; i++) {
      think(HARE, c, v);
      expect(c.at[1]).toBeGreaterThan(15);
      expect(d2(c.at, threat)).toBeGreaterThanOrEqual(last);
      last = d2(c.at, threat);
      if (c.state !== 'FLEE') break;
    }
    expect(c.under).toBeFalsy();
  });
});

describe('bounded maps', () => {
  test('bfs is bounded', () => {
    const box = boxAround([15, 15], 14);
    expect(box).toEqual({ x0: 1, y0: 1, w: 29, h: 29 });
    expect(boxAround([15, 15], 100).w).toBe(49);
    // a walled pocket is never reached
    const rows = field(31).map((row, y) => (y >= 4 && y <= 6 ? `${row.slice(0, 4)}###${row.slice(7)}` : row)).map((row, y) => (y === 5 ? `${row.slice(0, 5)}.${row.slice(6)}` : row));
    const map = grid(rows);
    const dist = bfs(map.open, [[15, 15]], box, 999);
    expect(dist.length).toBe(29 * 29);
    expect(dist[(5 - 1) * 29 + (5 - 1)]).toBe(-1);
    expect(Math.max(...dist)).toBeLessThanOrEqual(28 * 2);
    // a step cap stops the search
    const capped = bfs(map.open, [[15, 15]], box, 3);
    expect(Math.max(...capped)).toBe(3);
    expect(capped[(15 - 1) * 29 + (20 - 1)]).toBe(-1);
  });

  test('ties break N E S W', () => {
    const map = grid(field(21));
    const toward = (target: Tile) => {
      const box = boxAround([10, 10], 5);
      return nextTile({ box, v: bfs(map.open, [target], box, 99), none: -1 }, [10, 10], map.open);
    };
    expect(toward([11, 9])).toEqual([10, 9]);
    expect(toward([11, 11])).toEqual([11, 10]);
    expect(toward([9, 11])).toEqual([10, 11]);
    expect(ringTiles([0, 0], 1, 1)).toEqual([
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ]);
    expect(ringTiles([0, 0], 3, 8)).toHaveLength(17 * 17 - 5 * 5);
  });
});
