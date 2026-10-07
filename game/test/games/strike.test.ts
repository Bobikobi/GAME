/** Unit coverage for the pure quarrying rules. */
import { describe, expect, it } from 'vitest';
import { strikeGrade, strikeTotal, strikeWindows } from '../../src/ui/games/shared';

describe('strikeWindows', () => {
  it('returns the base windows at the base scale', () => {
    expect(strikeWindows(100)).toEqual([55, 110, 170]);
  });

  it('widens with the scale and applies each cap', () => {
    expect(strikeWindows(200)).toEqual([110, 220, 320]);
    expect(strikeWindows(400)).toEqual([120, 220, 320]);
  });

  it('never narrows below the base', () => {
    expect(strikeWindows(50)).toEqual(strikeWindows(100));
  });
});

describe('strikeGrade', () => {
  const windows = strikeWindows(100);

  it.each([
    [0, 3],
    [55, 3],
    [56, 2],
    [110, 2],
    [111, 1],
    [170, 1],
    [171, 0],
  ] as const)('grades an error of %d ms as %d', (error, grade) => {
    expect(strikeGrade(error, windows)).toBe(grade);
  });
});

describe('strikeTotal', () => {
  it.each([
    [[0, 0, 0], 0],
    [[1, 1, 0], 0],
    [[1, 1, 1], 1],
    [[2, 2, 0], 1],
    [[2, 2, 1], 2],
    [[3, 2, 1], 2],
    [[3, 2, 2], 3],
    [[3, 3, 2], 3],
    [[3, 3, 3], 4],
  ] as const)('maps %j to grade %d', (grades, grade) => {
    expect(strikeTotal(grades)).toBe(grade);
  });
});
