/** Unit coverage for the pure foraging rules. */
import { describe, expect, it } from 'vitest';
import { pickGrade, pickSequence, pickWindow } from '../../src/ui/games/shared';

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe('pickSequence', () => {
  it.each([1, 42, 2026])('makes four ripe and two unripe items for seed %d', (seed) => {
    const sequence = pickSequence(seeded(seed));
    expect(sequence).toHaveLength(6);
    expect(sequence.filter(Boolean)).toHaveLength(4);
    expect(sequence[0]).toBe(true);
  });

  it('varies the order between seeds', () => {
    expect(pickSequence(seeded(1))).not.toEqual(pickSequence(seeded(42)));
  });
});

describe('pickWindow', () => {
  it('widens from the base duration', () => {
    expect(pickWindow(0, 0)).toBe(900);
    expect(pickWindow(10, 0)).toBe(1260);
  });

  it('caps at 1500 ms', () => {
    expect(pickWindow(10, 100)).toBe(1500);
  });
});

describe('pickGrade', () => {
  it.each([
    [0, 0],
    [1, 0],
    [2, 1],
    [3, 2],
    [4, 3],
  ] as const)('maps score %d to grade %d', (score, grade) => {
    expect(pickGrade(score, 0)).toBe(grade);
  });

  it('subtracts mistakes without going below zero', () => {
    expect(pickGrade(4, 1)).toBe(2);
    expect(pickGrade(1, 3)).toBe(0);
  });
});
