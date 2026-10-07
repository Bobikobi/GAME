/** Unit coverage for the pure quarrying rules. */
import { describe, expect, it } from 'vitest';
import { strikeGrade, strikeTotal, strikeWindows } from '../../src/ui/games/shared';

describe('strikeWindows', () => {
  it('returns the base windows at zero agility', () => {
    expect(strikeWindows(0, 0)).toEqual([70, 140, 230]);
  });

  it('widens with agility and applies each cap', () => {
    expect(strikeWindows(10, 0)).toEqual([112, 220, 320]);
    expect(strikeWindows(10, 100)).toEqual([120, 220, 320]);
  });
});

describe('strikeGrade', () => {
  const windows = strikeWindows(0, 0);

  it.each([
    [0, 3],
    [70, 3],
    [71, 2],
    [140, 2],
    [141, 1],
    [230, 1],
    [231, 0],
  ] as const)('grades an error of %d ms as %d', (error, grade) => {
    expect(strikeGrade(error, windows)).toBe(grade);
  });
});

describe('strikeTotal', () => {
  it.each([
    [[0, 0, 0], 0],
    [[1, 0, 0], 0],
    [[1, 1, 0], 1],
    [[2, 1, 1], 1],
    [[2, 2, 1], 2],
    [[3, 2, 2], 2],
    [[3, 3, 2], 3],
    [[3, 3, 3], 3],
  ] as const)('maps a total of %d to grade %d', (grades, grade) => {
    expect(strikeTotal(grades)).toBe(grade);
  });
});
