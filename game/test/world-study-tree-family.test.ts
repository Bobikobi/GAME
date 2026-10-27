import { expect, test } from 'vitest';
import { worldStudyTreePlacement } from '../src/world-study-tree-family';
import { worldStudyCanStand } from '../src/world-study-collision';

test('family data preserves the approved display and rooted collision across seeded variations', () => {
  const facings = new Set<boolean>();
  const heights = new Set<number>();
  for (let i = 0; i < 1000; i++) {
    const seed = Math.imul(i + 23, 73856093) >>> 0;
    const p = worldStudyTreePlacement(seed, 400, 500);
    facings.add(p.flipX); heights.add(p.height);
    expect(p.id).toBe('oak');
    expect(p.height).toBe(320 + ((seed >>> 12) % 5) * 8);
    expect(p.width).toBe(Math.round(p.height * (192 / 320) * (1 + ((seed >>> 17) % 3) * .035)));
    expect(p.footprint.y).toBeCloseTo(500 - 14 * p.height / 320);
    expect(worldStudyCanStand(400, p.footprint.y, () => true, [p.footprint])).toBe(false);
    expect(worldStudyCanStand(400, 300, () => true, [p.footprint])).toBe(true);
  }
  expect(facings.size).toBe(2); expect(heights.size).toBe(5);
});
