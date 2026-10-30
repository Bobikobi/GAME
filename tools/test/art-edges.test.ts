import { describe, expect, test } from 'vitest';

import { SIDES, edgePng, edgeRows, turn } from '../src/art/edges.js';

describe('the soft joins of the ground', () => {
  test('the north overlay is the same every run and reaches into the tile', () => {
    for (const kind of ['fringe', 'worn'] as const) {
      expect(edgeRows(kind, 7)).toEqual(edgeRows(kind, 7));
      const rows = edgeRows(kind, 7);
      expect(rows.slice(0, 12).join('').replace(/\./g, '').length).toBeGreaterThan(20);
      expect(rows.slice(40).join('').replace(/\./g, '')).toBe('');
    }
  });

  test('a side turns the overlay onto its own edge', () => {
    const rows = edgeRows('fringe', 3);
    const count = (r: readonly string[], from: number, to: number): number => r.slice(from, to).join('').replace(/\./g, '').length;
    expect(count(turn(rows, 's'), 52, 64)).toBe(count(rows, 0, 12));
    const west = turn(rows, 'w');
    expect(west.map((r) => r.slice(0, 12)).join('').replace(/\./g, '').length).toBe(count(rows, 0, 12));
  });

  test('no see-through pocket is left inside an overlay, in any side', () => {
    for (const kind of ['fringe', 'worn'] as const) {
      for (const side of SIDES) {
        const png = edgePng(kind, side);
        const clear = (x: number, y: number): boolean => x < 0 || y < 0 || x >= 64 || y >= 64 || png.data[(y * 64 + x) * 4 + 3] === 0;
        for (let y = 0; y < 64; y += 1) {
          for (let x = 0; x < 64; x += 1) {
            if (!clear(x, y)) continue;
            // a clear pixel with all four neighbours solid is a pocket
            const solid = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => !clear(x + (dx as number), y + (dy as number)));
            expect(solid).toBe(false);
          }
        }
      }
    }
  });
});
