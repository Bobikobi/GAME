/** Unit coverage for the sweeping-marker rules, the jackpot strip included. */
import { describe, expect, it } from 'vitest';
import { JACKPOT_W, MARKER_W, timingGrade, timingZones } from '../../src/ui/games/shared';

describe('timingZones', () => {
  it('starts narrow and widens with the scale up to the caps', () => {
    expect(timingZones(100)).toEqual([0.06, 0.11, 0.17]);
    const wide = timingZones(1000);
    expect(wide).toEqual([0.14, 0.24, 0.36]);
  });
});

describe('timingGrade', () => {
  const z = timingZones(100);
  const c = 0.5;
  const edge = JACKPOT_W / 2 + MARKER_W / 2;

  it('gives the jackpot while the marker touches the two-marker strip', () => {
    expect(JACKPOT_W).toBeCloseTo(2 * MARKER_W);
    expect(timingGrade(c, c, z)).toBe(4);
    expect(timingGrade(c + edge, c, z)).toBe(4);
    expect(timingGrade(c - edge - 0.001, c, z)).toBe(3);
  });

  it('grades the zones from the centre outwards', () => {
    expect(timingGrade(c + 0.059, c, z)).toBe(3);
    expect(timingGrade(c + 0.1, c, z)).toBe(2);
    expect(timingGrade(c - 0.16, c, z)).toBe(1);
    expect(timingGrade(c + 0.2, c, z)).toBe(0);
  });

  it('keeps the jackpot strip the same width whatever the agility', () => {
    const wide = timingZones(1000);
    expect(timingGrade(c + edge + 0.001, c, wide)).toBe(3);
  });
});
