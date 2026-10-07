import { describe, expect, test } from 'vitest';

import { KernelError, canonical, draw, drawBasisPoints, hashText } from '@game/kernel';

describe('canonical data', () => {
  test('does not depend on object insertion order', () => {
    const left = { z: 3, nested: { b: 2, a: 1 }, a: ['x', { d: 4, c: 3 }] };
    const right = { a: ['x', { c: 3, d: 4 }], nested: { a: 1, b: 2 }, z: 3 };

    expect(canonical(left)).toBe(canonical(right));
    expect(canonical(left)).toBe('{"a":["x",{"c":3,"d":4}],"nested":{"a":1,"b":2},"z":3}');
  });

  test.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects the non-integer number %s',
    (value) => {
      expect(() => canonical({ value })).toThrow(KernelError);
    },
  );

  test('pins stable text hashes', () => {
    expect(hashText('')).toBe('488bdcb81aee8d83');
    expect(hashText('hello')).toBe('bfb06f3a63cd7226');
    expect(hashText('{"a":1,"b":2}')).toBe('1cda603954381c33');
  });
});

describe('deterministic random draws', () => {
  test('is a pure function of seed, entity, and counter', () => {
    const expected = draw(42, 'core/ruins-gate#0', 7);

    expect(draw(42, 'core/ruins-gate#0', 7)).toBe(expected);
    expect(draw(43, 'core/ruins-gate#0', 7)).not.toBe(expected);
    expect(draw(42, 'core/ruins-gate#1', 7)).not.toBe(expected);
    expect(draw(42, 'core/ruins-gate#0', 8)).not.toBe(expected);
  });

  test('produces bounded, roughly uniform basis points', () => {
    const deciles = Array.from({ length: 10 }, () => 0);
    for (let counter = 0; counter < 20_000; counter += 1) {
      const value = drawBasisPoints(0x12345678, 'uniformity', counter);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(10_000);
      const decile = Math.floor(value / 1_000);
      deciles[decile] = (deciles[decile] ?? 0) + 1;
    }
    for (const count of deciles) {
      expect(count).toBeGreaterThanOrEqual(1_600);
      expect(count).toBeLessThanOrEqual(2_400);
    }
  });
});
