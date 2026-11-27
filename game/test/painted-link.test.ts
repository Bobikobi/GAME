import { describe, expect, test } from 'vitest';

import { BRIDGE_SLOT, LINK_FROM, linkOf, piecesOf, type CellsOf } from '../src/painted-link.js';

/** a scene of `rows` strings of cells ('.' walks) */
const scene = (rows: string[]): CellsOf => ({ cols: rows[0]!.length, rows: rows.length, cells: rows });

describe('the preview\'s way out of the valley', () => {
  test('the walkable pieces are the four-way pieces of "." cells, the largest first', () => {
    const pieces = piecesOf(scene(['..#.', '..#.', '##..', '#...']));
    expect(pieces.map((p) => p.length)).toEqual([7, 4]);
  });

  test('a scene with nothing to stand on has no way in', () => {
    expect(linkOf({ width: 64, slots: [] }, scene(['###', '###']))).toBeUndefined();
  });

  test('the cut runs from the lane\'s last open tile to the tile just west of the scene\'s arrival cell, without a gap', () => {
    const raw = { width: 64, slots: [] };
    const s = scene(['#######', '#.....#', '#.....#', '#######']);
    const way = linkOf(raw, s)!;
    const x0 = raw.width + 1;
    expect(way.to[0]).toBe(1); // the west end of the biggest piece
    const ty = 1 + way.to[1];
    const cut = new Set(way.cut.map(([x, y]) => `${x},${y}`));
    expect(cut.has(`${LINK_FROM[0] + 1},${LINK_FROM[1]}`)).toBe(true);
    // flood from the lane through the cut only: it must reach the tile west of the arrival cell
    const seen = new Set<string>([`${LINK_FROM[0] + 1},${LINK_FROM[1]}`]);
    const queue: [number, number][] = [[LINK_FROM[0] + 1, LINK_FROM[1]]];
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i]!;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (cut.has(`${nx},${ny}`) && !seen.has(`${nx},${ny}`)) {
          seen.add(`${nx},${ny}`);
          queue.push([nx, ny]);
        }
      }
    }
    expect(seen.size).toBe(cut.size);
    expect(seen.has(`${x0 + way.to[0] - 1},${ty}`)).toBe(true);
    // it leaves the valley only through its east edge and the ring: nothing of it lies inside the scene's own cells
    for (const [x] of way.cut) expect(x).toBeLessThan(x0 + way.to[0]);
  });

  test('the arrival is the west-most cell, the one nearest the lane\'s row when several share the column', () => {
    const s = scene(['.....', '#....', '.....']);
    // all of it is one piece; column 0 has cells in rows 0 and 2 (row 1 is wall); the lane's row sits far below, so the lower one is nearer
    const way = linkOf({ width: 64, slots: [] }, s)!;
    expect(way.to).toEqual([0, 2]);
  });

  test('the valley\'s old bridge is open path in the cut: the river wall that closes the start meadow', () => {
    const slots = [{ id: BRIDGE_SLOT, kind: 'restore', x: 13, y: 17, w: 3, h: 2 }] as never;
    const way = linkOf({ width: 64, slots }, scene(['#####', '#...#', '#####']))!;
    const cut = new Set(way.cut.map(([x, y]) => `${x},${y}`));
    for (let y = 17; y <= 18; y++) for (let x = 13; x <= 15; x++) expect(cut.has(`${x},${y}`)).toBe(true);
  });
});
