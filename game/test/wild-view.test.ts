import { describe, expect, test } from 'vitest';
import { THINK_MS } from '@game/kernel';
import { wildDrawnAt } from '../src/wild-view';

const animal = (over: object) => ({ from: [5, 5] as [number, number], path: [] as [number, number][], last: 1000, c: { at: [5, 5] as [number, number], face: [0, 1] as [number, number] }, ...over }) as Parameters<typeof wildDrawnAt>[0];

describe('the drawn place of a stepped animal', () => {
  test('stands on its tile facing its way when it did not move', () => {
    expect(wildDrawnAt(animal({}), 1400)).toEqual({ at: [5, 5], heading: [0, 1], tiles: 0 });
  });

  test('walks the tiles it entered, in order, over one think step, and never off them', () => {
    // an L round a corner: east two, then north one; a straight line from 5,5 to 7,4 would cut the corner
    const a = animal({ path: [[6, 5], [7, 5], [7, 4]], c: { at: [7, 4], face: [0, -1] } });
    expect(wildDrawnAt(a, 1000).at).toEqual([5, 5]);
    const third = wildDrawnAt(a, 1000 + THINK_MS / 3);
    expect(third.at[0]).toBeCloseTo(6);
    expect(third.at[1]).toBeCloseTo(5);
    expect(wildDrawnAt(a, 1000 + (THINK_MS * 5) / 6)).toMatchObject({ heading: [0, -1] });
    expect(wildDrawnAt(a, 1000 + (THINK_MS * 5) / 6).at[0]).toBeCloseTo(7);
    expect(wildDrawnAt(a, 1000 + THINK_MS * 2)).toEqual({ at: [7, 4], heading: [0, -1], tiles: 3 });
    for (let ms = 1000; ms <= 1000 + THINK_MS; ms += 20) {
      const { at } = wildDrawnAt(a, ms);
      // on a segment: one coordinate is whole
      expect(Math.abs(at[0] - Math.round(at[0])) < 1e-9 || Math.abs(at[1] - Math.round(at[1])) < 1e-9).toBe(true);
    }
  });
});
