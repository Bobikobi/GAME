import { describe, expect, test } from 'vitest';

import { KernelError, clamp, idiv, idivUp, mulDiv, mulDivUp } from '@game/kernel';

describe('integer arithmetic', () => {
  test.each([
    [7, 3, 2, 3],
    [6, 3, 2, 2],
    [1, 3, 0, 1],
    [0, 3, 0, 0],
    [-1, 3, -1, 0],
    [-6, 3, -2, -2],
    [-7, 3, -3, -2],
  ])('divides %i by %i with named rounding', (a, b, floor, ceil) => {
    expect(idiv(a, b)).toBe(floor);
    expect(idivUp(a, b)).toBe(ceil);
  });

  test('multiplies before division exactly near MAX_SAFE_INTEGER', () => {
    const cases = [
      [Number.MAX_SAFE_INTEGER - 2, Number.MAX_SAFE_INTEGER - 4, Number.MAX_SAFE_INTEGER],
      [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
      [Number.MAX_SAFE_INTEGER - 10, 9_999_991, Number.MAX_SAFE_INTEGER - 8],
    ] as const;
    for (const [a, b, c] of cases) {
      const product = BigInt(a) * BigInt(b);
      const divisor = BigInt(c);
      expect(mulDiv(a, b, c)).toBe(Number(product / divisor));
      expect(mulDivUp(a, b, c)).toBe(Number(product / divisor + (product % divisor === 0n ? 0n : 1n)));
    }
  });

  test('clamps at both bounds and preserves values inside them', () => {
    expect(clamp(-4, 0, 10)).toBe(0);
    expect(clamp(4, 0, 10)).toBe(4);
    expect(clamp(14, 0, 10)).toBe(10);
  });

  test.each([
    () => idiv(1.5, 2),
    () => idivUp(1, 2.5),
    () => mulDiv(1.5, 2, 3),
    () => mulDiv(1, 2.5, 3),
    () => mulDivUp(1, 2, 3.5),
    () => mulDiv(Number.MAX_SAFE_INTEGER + 1, 1, 1),
  ])('rejects non-integer arithmetic', (operation) => {
    expect(operation).toThrow(KernelError);
  });
});
