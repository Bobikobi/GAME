/** The feel of a blow (animation trial 2): the brief's ranges, the switch, and reduced motion (G29). */
import { describe, expect, test } from 'vitest';

import { HIT, chipsOf, hitFeel, knockAt, parseJuice } from '../src/hitfeel';
import { SWING_MS, WIND_UP } from '../src/work';

const KINDS = ['fell', 'dig', 'mine'] as const;

describe('HIT', () => {
  test('every kind stays inside the trial brief: a 60-90 ms hold, 1-2 white frames, a knock of at most 2 px for at most 120 ms', () => {
    for (const k of KINDS) {
      const h = HIT[k];
      expect(h.stopMs).toBeGreaterThanOrEqual(60);
      expect(h.stopMs).toBeLessThanOrEqual(90);
      expect(h.flashFrames).toBeGreaterThanOrEqual(1);
      expect(h.flashFrames).toBeLessThanOrEqual(2);
      expect(h.shakePx).toBeLessThanOrEqual(2);
      expect(h.shakeMs).toBeLessThanOrEqual(120);
    }
  });

  test('the hold ends well before the arm goes up again in a swing of the usual length', () => {
    for (const k of KINDS) expect(HIT[k].stopMs).toBeLessThan(SWING_MS * (1 - WIND_UP) * 0.5);
  });
});

describe('hitFeel', () => {
  test('?juice=0 gives the game as it was', () => {
    for (const k of KINDS) expect(hitFeel(k, false, true)).toBeUndefined();
  });

  test('with motion, the full feel', () => {
    for (const k of KINDS) expect(hitFeel(k, true, true)).toEqual(HIT[k]);
  });

  test('under reduced motion: no knock and no flash, the hold and the chips at half', () => {
    for (const k of KINDS) {
      const h = hitFeel(k, true, false)!;
      expect(h.shakePx).toBe(0);
      expect(h.flashFrames).toBe(0);
      expect(h.stopMs).toBe(Math.round(HIT[k].stopMs / 2));
      expect(h.chips).toBe(0.5);
    }
  });
});

describe('parseJuice', () => {
  test('absent or anything else keeps it; 0, off, false and none turn it off', () => {
    expect(parseJuice(null)).toBe(true);
    expect(parseJuice('1')).toBe(true);
    for (const q of ['0', 'off', 'FALSE', ' none ']) expect(parseJuice(q)).toBe(false);
  });
});

describe('chipsOf', () => {
  test('a share of the chips, never none while some flew before', () => {
    expect(chipsOf(6, 1)).toBe(6);
    expect(chipsOf(6, 0.5)).toBe(3);
    expect(chipsOf(1, 0.5)).toBe(1);
    expect(chipsOf(0, 0.5)).toBe(0);
  });
});

describe('knockAt', () => {
  test('whole art pixels within the bound, both ends reached', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const r = i / 100;
      const at = knockAt(2, () => r);
      for (const v of [at.x, at.y]) {
        expect(Number.isInteger(v)).toBe(true);
        expect(Math.abs(v)).toBeLessThanOrEqual(2);
        seen.add(v);
      }
    }
    expect([...seen].sort()).toEqual([-1, -2, 0, 1, 2]);
    expect(knockAt(0, Math.random)).toEqual({ x: 0, y: 0 });
  });
});
