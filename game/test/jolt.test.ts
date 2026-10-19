/** What the camera does for an event: danger jolts, a success never does (DECISIONS.md, 2026-10-18). */
import { describe, expect, test } from 'vitest';

import type { GameEvent } from '@game/kernel';
import { SUCCESS_LIGHT_MS, joltOf } from '../src/jolt';

const ev = (e: object): GameEvent => e as GameEvent;

describe('joltOf', () => {
  test('a wound flashes red and shakes, with or without motion', () => {
    for (const motion of [true, false]) {
      const j = joltOf(ev({ e: 'hurt' }), motion);
      expect(j?.flash).toBeDefined();
      expect(j?.shake).toBeDefined();
    }
  });

  test('being seen jolts, and is left out under reduced motion', () => {
    expect(joltOf(ev({ e: 'seen' }), true)?.shake).toBeDefined();
    expect(joltOf(ev({ e: 'seen' }), false)).toBeUndefined();
  });

  test('no success moves the camera or flashes the screen', () => {
    const successes = [{ e: 'restore' }, { e: 'build' }, { e: 'quest', state: 'done' }, { e: 'level' }, { e: 'gain' }, { e: 'discover' }, { e: 'jackpot' }];
    for (const s of successes) for (const motion of [true, false]) expect(joltOf(ev(s), motion)).toBeUndefined();
  });

  test('the light on a made thing lasts at most a second', () => {
    expect(SUCCESS_LIGHT_MS).toBeLessThanOrEqual(1000);
  });
});
