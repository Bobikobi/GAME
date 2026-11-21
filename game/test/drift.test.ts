/** The drift driver (drift.ts): one sheet and a behaviour, every piece a pure function of its seed and age. */
import { describe, expect, test } from 'vitest';

import { CHIMNEY_SMOKE, across, driftOn, spawn, stateAt, type DriftSpec } from '../src/drift';
import { seeded } from '../src/flicker';

const rise: DriftSpec = CHIMNEY_SMOKE.spec;
const fall: DriftSpec = {
  behaviour: 'fall',
  frames: [0, 1, 2],
  life: [3000, 3000],
  every: 500,
  max: 6,
  speed: [2, 2],
  sideways: [0, 0],
  pull: 6,
  alpha: [1, 1, 0],
  scale: [1, 1],
};

describe('the driver is off unless asked', () => {
  test('the flag is `?drift=sheet`, nothing else', () => {
    expect(driftOn('')).toBe(false);
    expect(driftOn('?debug')).toBe(false);
    expect(driftOn('?drift=off')).toBe(false);
    expect(driftOn('?drift=sheet')).toBe(true);
    expect(driftOn('?debug&drift=sheet')).toBe(true);
  });
});

describe('a piece is a pure function of its seed and its age', () => {
  test('the same seed gives the same piece', () => {
    const a = spawn(seeded(7), rise, 1000);
    const b = spawn(seeded(7), rise, 1000);
    expect(a).toEqual(b);
    expect(stateAt(rise, a, 2000)).toEqual(stateAt(rise, b, 2000));
    expect(spawn(seeded(8), rise, 1000)).not.toEqual(a);
  });

  test('a piece is gone once its life is over, and not there before it is born', () => {
    const p = spawn(seeded(1), rise, 1000);
    expect(stateAt(rise, p, 999)).toBeUndefined();
    expect(stateAt(rise, p, 1000 + p.life)).toBeUndefined();
    expect(stateAt(rise, p, 1000 + p.life - 1)).toBeDefined();
  });

  test('every position lies on the art-pixel grid, a quarter of a world px', () => {
    const p = spawn(seeded(3), rise, 0);
    for (let t = 0; t < p.life; t += 137) {
      const s = stateAt(rise, p, t)!;
      expect(s.dx * 4).toBeCloseTo(Math.round(s.dx * 4), 9);
      expect(s.dy * 4).toBeCloseTo(Math.round(s.dy * 4), 9);
    }
  });
});

describe('rise and fade', () => {
  test('a rising piece climbs, fades to nothing and steps through its frames in order', () => {
    const p = spawn(seeded(5), rise, 0);
    let top = 0;
    let last = rise.frames[0]!;
    let alpha = 1;
    for (let t = 0; t < p.life; t += 50) {
      const s = stateAt(rise, p, t)!;
      expect(s.dy).toBeLessThanOrEqual(top);
      top = s.dy;
      expect(rise.frames.indexOf(s.frame)).toBeGreaterThanOrEqual(rise.frames.indexOf(last));
      last = s.frame;
      expect(s.alpha).toBeLessThanOrEqual(Math.max(alpha, rise.alpha[0]!));
      alpha = s.alpha;
    }
    expect(top).toBeLessThan(-3);
    expect(alpha).toBeLessThan(0.1);
    expect(last).toBe(rise.frames[rise.frames.length - 1]);
  });
});

describe('fall and drift', () => {
  test('a falling piece goes down, quicker as it falls, and holds its opacity until the last stretch', () => {
    const p = spawn(seeded(9), fall, 0);
    const at = (ms: number) => stateAt(fall, p, ms)!;
    expect(at(1000).dy).toBeGreaterThan(0);
    expect(at(2000).dy - at(1000).dy).toBeGreaterThan(at(1000).dy - at(0).dy);
    expect(at(1000).alpha).toBe(1);
    expect(at(2900).alpha).toBeLessThan(0.2);
  });
});

describe('opacity across a life', () => {
  test('keys are spread evenly and clamped at the ends', () => {
    expect(across([1, 0.5, 0], 0)).toBe(1);
    expect(across([1, 0.5, 0], 0.5)).toBe(0.5);
    expect(across([1, 0.5, 0], 0.75)).toBe(0.25);
    expect(across([1, 0.5, 0], 2)).toBe(0);
    expect(across([0.4], 0.3)).toBe(0.4);
  });
});
