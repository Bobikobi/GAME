import { describe, expect, test } from 'vitest';
import { LEAN, LEAN_SPREAD, plantLook } from '../src/plantlook';

describe('how a tuft stands', () => {
  const looks = Array.from({ length: 400 }, (_, i) => plantLook(i % 20, Math.floor(i / 20)));

  test('the same tile always stands the same way', () => {
    expect(plantLook(16, 9)).toEqual(plantLook(16, 9));
  });

  test('about half are flipped, and neighbours differ', () => {
    const flipped = looks.filter((l) => l.flip).length / looks.length;
    expect(flipped).toBeGreaterThan(0.4);
    expect(flipped).toBeLessThan(0.6);
    expect(new Set(looks.map((l) => `${l.dx},${l.dy}`)).size).toBeGreaterThan(60);
  });

  test('one lean leads: every tuft leans the wind\'s way within the spread, and the mean is the lean', () => {
    for (const l of looks) {
      expect(l.angle).toBeGreaterThanOrEqual(LEAN - LEAN_SPREAD);
      expect(l.angle).toBeLessThanOrEqual(LEAN + LEAN_SPREAD);
    }
    const mean = looks.reduce((a, l) => a + l.angle, 0) / looks.length;
    expect(Math.abs(mean - LEAN)).toBeLessThan(0.6);
  });

  test('a tuft stays within its tile', () => {
    for (const l of looks) {
      expect(Math.abs(l.dx)).toBeLessThanOrEqual(12);
      expect(Math.abs(l.dy)).toBeLessThanOrEqual(3);
    }
  });
});
