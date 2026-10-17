import { describe, expect, test } from 'vitest';

import { type Bundle, findSlot, makeWalkable, newState } from '@game/kernel';
import { MOMENT_MS, PEEK_MS, fitFrame, peekOnStep } from '../src/peek';
import { loadBundle } from '../../tools/test/helpers/world';

const base = loadBundle();
const QUEST = 'core/the-tangle';
const walkFor = (b: Bundle) => {
  const w = makeWalkable(b);
  const p = newState(b, 1).player;
  p.restored.push('core/old-bridge');
  return (x: number, y: number) => w(x, y, p);
};
const withTier = (tier: number): Bundle => {
  const b = structuredClone(base);
  b.quests[QUEST]!.maze!.tier = tier;
  return b;
};
const never = () => false;

describe('the maze peek', () => {
  test('opens on a step into the frame from outside, once, and never when the quest is done', () => {
    const walk = walkFor(base);
    expect(peekOnStep(base, never, walk, [39, 33], [39, 34])?.quest).toBe(QUEST);
    expect(peekOnStep(base, never, walk, [39, 34], [39, 35])).toBeUndefined();
    expect(peekOnStep(base, never, walk, [38, 33], [39, 33])).toBeUndefined();
    expect(peekOnStep(base, (q) => q === QUEST, walk, [39, 33], [39, 34])).toBeUndefined();
  });

  test('the line shows at tier 1 only, the landmarks at tiers 1 and 2, tier 4 has no peek', () => {
    const seen = (tier: number) => {
      const b = withTier(tier);
      return peekOnStep(b, never, walkFor(b), [39, 33], [39, 34]);
    };
    expect(seen(1)!.route.length).toBeGreaterThan(60);
    expect(seen(1)!.landmarks.length).toBeGreaterThanOrEqual(5);
    expect(seen(1)!.glowMs).toBe(PEEK_MS);
    expect(seen(2)!.route).toEqual([]);
    expect(seen(2)!.landmarks.length).toBeGreaterThanOrEqual(5);
    expect(seen(2)!.glowMs).toBe(MOMENT_MS);
    expect(seen(3)!.route).toEqual([]);
    expect(seen(3)!.landmarks).toEqual([]);
    expect(seen(4)).toBeUndefined();
  });

  test('the line runs from the mouth to the heart over walkable tiles inside the frame', () => {
    const walk = walkFor(base);
    const peek = peekOnStep(base, never, walk, [39, 33], [39, 34])!;
    const heart = findSlot(base.map, 'core/tangle-heart')!;
    expect(peek.route[0]).toEqual([39, 34]);
    const last = peek.route.at(-1)!;
    expect(last[0] >= heart.x && last[0] < heart.x + heart.w && last[1] >= heart.y && last[1] < heart.y + heart.h).toBe(true);
    for (let i = 0; i < peek.route.length; i++) {
      expect(walk(peek.route[i]![0], peek.route[i]![1])).toBe(true);
      if (i > 0) expect(Math.abs(peek.route[i]![0] - peek.route[i - 1]![0]) + Math.abs(peek.route[i]![1] - peek.route[i - 1]![1])).toBe(1);
    }
  });

  test('the frame fits the free band of a phone and of a desktop', () => {
    const frame = { x: 20, y: 34, w: 25, h: 15 };
    for (const [w, h] of [[390, 844], [1440, 900]] as const) {
      const keep = { top: 120, bottom: 200, side: 8 };
      const fit = fitFrame(frame, 16, { w, h }, keep);
      expect(frame.w * 16 * fit.zoom).toBeLessThanOrEqual(w - 16 + 0.001);
      expect(frame.h * 16 * fit.zoom).toBeLessThanOrEqual(h - keep.top - keep.bottom + 0.001);
    }
  });
});
