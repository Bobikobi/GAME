/** Unit coverage for the pure branch-snapping rules. */
import { describe, expect, it } from 'vitest';
import { snapGrade, snapLimits } from '../../src/ui/games/shared';

describe('snapLimits', () => {
  it('returns the base limits at zero agility', () => {
    expect(snapLimits(0, 0)).toEqual([2200, 3000, 4200, 5000]);
  });

  it('widens all limits with agility and techniques', () => {
    expect(snapLimits(10, 0)).toEqual([3080, 4200, 5880, 7000]);
    expect(snapLimits(0, 50)).toEqual([3300, 4500, 6300, 7500]);
  });
});

describe('snapGrade', () => {
  const limits = snapLimits(0, 0);

  it.each([
    [0, 3],
    [2200, 3],
    [2201, 2],
    [3000, 2],
    [3001, 1],
    [4200, 1],
    [4201, 0],
    [5000, 0],
    [5001, 0],
  ] as const)('grades a completed time of %d ms as %d', (ms, grade) => {
    expect(snapGrade(ms, limits, true)).toBe(grade);
  });

  it('returns miss when the branch was not snapped', () => {
    expect(snapGrade(0, limits, false)).toBe(0);
  });
});
