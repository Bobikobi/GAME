/** Unit coverage for the fishing minigame's rules and the motion the world draws from them. */
import { describe, expect, it } from 'vitest';
import { FISH_REEL_MS, floatAt, linePoints, sagAt, silhouettes } from '../../src/fishing';
import { FISH_CAST_MS, FISH_TELL_MS, fishGrade, fishPlan, fishWindow } from '../../src/ui/games/shared';

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe('fishPlan', () => {
  it.each([1, 42, 2026])('nibbles one to three times and bites a fixed tell after the last, seed %d', (seed) => {
    const plan = fishPlan(seeded(seed));
    expect(plan.nibbles.length).toBeGreaterThanOrEqual(1);
    expect(plan.nibbles.length).toBeLessThanOrEqual(3);
    expect(plan.nibbles[0]).toBeGreaterThanOrEqual(900);
    for (let i = 1; i < plan.nibbles.length; i += 1) expect(plan.nibbles[i]! - plan.nibbles[i - 1]!).toBeGreaterThanOrEqual(450);
    expect(plan.bite - plan.nibbles[plan.nibbles.length - 1]!).toBe(FISH_TELL_MS);
  });

  it('varies between seeds', () => {
    expect(fishPlan(seeded(1))).not.toEqual(fishPlan(seeded(42)));
  });
});

describe('fishGrade', () => {
  const w = fishWindow(100);

  it('widens the window with the player, up to a cap', () => {
    expect(w).toBe(620);
    expect(fishWindow(150)).toBe(930);
    expect(fishWindow(400)).toBe(1200);
  });

  it('frightens the fish off before the bite and loses it after the window', () => {
    expect(fishGrade(-1, w)).toBe(0);
    expect(fishGrade(w + 1, w)).toBe(0);
  });

  it('pays a strike faster than a reaction as the jackpot, then falls off with time', () => {
    expect(fishGrade(0, w)).toBe(4);
    expect(fishGrade(124, w)).toBe(4);
    expect(fishGrade(200, w)).toBe(3);
    expect(fishGrade(400, w)).toBe(2);
    expect(fishGrade(600, w)).toBe(1);
  });

  it('keeps the jackpot strip the same however wide the window grows', () => {
    expect(fishGrade(150, fishWindow(300))).toBe(3);
  });
});

describe('the line and float', () => {
  const rod = { x: 0, y: 0 };
  const spot = { x: 40, y: 20 };

  it('flies the float out along an arc and lands it on the spot', () => {
    const start = floatAt('cast', 0, rod, spot);
    const mid = floatAt('cast', FISH_CAST_MS / 2, rod, spot);
    const end = floatAt('cast', FISH_CAST_MS, rod, spot);
    expect(start).toMatchObject({ x: 0, y: 0 });
    expect(mid.y).toBeLessThan((rod.y + spot.y) / 2);
    expect(end.x).toBeCloseTo(40);
    expect(end.y).toBeCloseTo(20);
  });

  it('pulls the float under on the bite and brings it back on the reel', () => {
    expect(floatAt('bite', 0, rod, spot).dip).toBe(1);
    expect(floatAt('wait', 0, rod, spot).dip).toBe(0);
    const back = floatAt('reel', FISH_REEL_MS, rod, spot);
    expect(back.x).toBeCloseTo(rod.x);
    expect(back.y).toBeCloseTo(rod.y);
  });

  it('hangs slack while waiting, springs as it lands, and goes taut on the bite', () => {
    expect(sagAt('wait', 0)).toBeGreaterThan(sagAt('wait', 3000) + 3);
    expect(sagAt('wait', 3000)).toBeCloseTo(5, 1);
    expect(Math.abs(sagAt('bite', 100))).toBeLessThanOrEqual(0.4);
    expect(sagAt('lost', 0)).toBeGreaterThan(sagAt('wait', 3000));
  });

  it('draws the line from the rod tip to the float, its middle sagging by the given amount', () => {
    const pts = linePoints(rod, { x: 40, y: 0 }, 5, 10);
    expect(pts[0]).toEqual(rod);
    expect(pts[10]).toEqual({ x: 40, y: 0 });
    expect(pts[5]!.y).toBeCloseTo(5);
    expect(linePoints(rod, { x: 40, y: 0 }, 0, 10)[5]!.y).toBeCloseTo(0);
  });

  it('circles the fish under the spot, and the hooked one holds under the float', () => {
    const free = silhouettes(1000, spot, 2, 3);
    expect(free).toHaveLength(2);
    for (const f of free) {
      expect(Math.abs(f.x - spot.x)).toBeLessThanOrEqual(6);
      expect(Math.abs(f.y - spot.y)).toBeLessThanOrEqual(3);
    }
    expect(silhouettes(1000, spot, 2, 3, { x: 41, y: 22 })[0]).toMatchObject({ x: 41, y: 24 });
  });
});
