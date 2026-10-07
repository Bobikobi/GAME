/** Unit coverage for the pure branch-snapping rules. */
import { describe, expect, it } from 'vitest';
import { snapGrade, snapLimits } from '../../src/ui/games/shared';

describe('snapLimits', () => {
  it('returns the base limits at the base scale', () => {
    expect(snapLimits(100)).toEqual([1900, 2600, 3500, 4500]);
  });

  it('widens all limits with the scale', () => {
    expect(snapLimits(150)).toEqual([2850, 3900, 5250, 6750]);
  });
});

describe('snapGrade', () => {
  const limits = snapLimits(100);

  it.each([
    [0, 4],
    [1330, 4],
    [1331, 3],
    [1900, 3],
    [1901, 2],
    [2600, 2],
    [2601, 1],
    [3500, 1],
    [3501, 0],
    [4600, 0],
  ] as const)('grades a completed time of %d ms as %d', (ms, grade) => {
    expect(snapGrade(ms, limits, true)).toBe(grade);
  });

  it('returns miss when the branch was not snapped', () => {
    expect(snapGrade(0, limits, false)).toBe(0);
  });
});
