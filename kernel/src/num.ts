/**
 * Integer helpers (rule R2). Every number in the kernel is a safe integer;
 * division rounds in a named direction, and products that could pass 2^53
 * go through BigInt instead of silently losing precision.
 */

export class KernelError extends Error {}

export function assertInt(n: number, what: string): number {
  if (!Number.isSafeInteger(n)) throw new KernelError(`${what} is not a safe integer: ${String(n)}`);
  return n;
}

/** floor(a / b) for b > 0, exact for every safe integer a. */
export function idiv(a: number, b: number): number {
  assertInt(a, 'dividend');
  assertInt(b, 'divisor');
  if (b <= 0) throw new KernelError(`divisor must be positive: ${b}`);
  let q = Math.floor(a / b);
  const r = a - q * b;
  if (r < 0) q -= 1;
  else if (r >= b) q += 1;
  return q;
}

/** ceil(a / b) for b > 0. */
export function idivUp(a: number, b: number): number {
  // `|| 0` turns -0 into 0, so a result never prints or compares differently
  return -idiv(-a, b) || 0;
}

/** floor(a * b / c) for non-negative a, b and positive c. */
export function mulDiv(a: number, b: number, c: number): number {
  assertInt(a, 'factor');
  assertInt(b, 'factor');
  if (a < 0 || b < 0) throw new KernelError('mulDiv takes non-negative factors');
  const product = a * b;
  if (Number.isSafeInteger(product)) return idiv(product, c);
  const q = (BigInt(a) * BigInt(b)) / BigInt(assertInt(c, 'divisor'));
  return assertInt(Number(q), 'mulDiv result');
}

/** ceil(a * b / c) for non-negative a, b and positive c. */
export function mulDivUp(a: number, b: number, c: number): number {
  assertInt(a, 'factor');
  assertInt(b, 'factor');
  if (a < 0 || b < 0) throw new KernelError('mulDivUp takes non-negative factors');
  const product = a * b;
  if (Number.isSafeInteger(product)) return idivUp(product, c);
  const big = BigInt(a) * BigInt(b);
  const div = BigInt(assertInt(c, 'divisor'));
  const q = big / div + (big % div === 0n ? 0n : 1n);
  return assertInt(Number(q), 'mulDivUp result');
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
