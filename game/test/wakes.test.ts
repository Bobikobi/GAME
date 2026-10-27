/** The e2e runs wake where they mean to: every fixed seed draws its pocket with the kernel's draw (game/e2e/wakes.ts). */
import { describe, expect, test } from 'vitest';

import { GRADE_PCT, drawBasisPoints, wakePocket, widenSeed } from '@game/kernel';

import { debugSeed } from '../src/session';
import { LUCKY_BOWL, WAKE_SEEDS } from '../e2e/wakes';
import { loadBundle } from '../../tools/test/helpers/world';

const bundle = loadBundle();

describe('the e2e wake seeds', () => {
  test.each(Object.entries(WAKE_SEEDS))('seed for %s draws that pocket', (pocket, seed) => {
    expect(wakePocket(bundle, widenSeed(seed))).toBe(pocket);
  });

  test('every pocket of the content has a seed, so every pocket has an opening run', () => {
    expect(Object.keys(WAKE_SEEDS).sort()).toEqual(Object.keys(bundle.pockets).sort());
  });

  test('the lucky-bowl seed wakes in its pocket, and its first dig on the spot gives the bowl at any timing', () => {
    expect(wakePocket(bundle, widenSeed(LUCKY_BOWL.seed))).toBe(LUCKY_BOWL.pocket);
    const spot = bundle.instances[LUCKY_BOWL.spot]!;
    const bowl = bundle.treasures[spot.source]!.finds[0]!;
    expect(bowl.item).toBe('core/whole-bowl');
    // the worst timing grade, and half again for a luck below the base
    expect(drawBasisPoints(widenSeed(LUCKY_BOWL.seed), LUCKY_BOWL.spot, 0)).toBeLessThan((bowl.chance_pct * GRADE_PCT[0]) / 2);
  });

  test('a seed in the address counts only under ?debug, and only as a whole number below 2^32', () => {
    expect(debugSeed('?debug&seed=3')).toBe(3);
    expect(debugSeed('?seed=3')).toBeUndefined();
    expect(debugSeed('?debug')).toBeUndefined();
    expect(debugSeed('?debug&seed=-1')).toBeUndefined();
    expect(debugSeed('?debug&seed=4294967296')).toBeUndefined();
    expect(debugSeed('?debug&seed=1e3')).toBeUndefined();
  });
});
