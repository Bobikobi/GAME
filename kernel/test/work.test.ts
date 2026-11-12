/**
 * The one work rule (QUARRYING 10): which work runs by itself after one press and which plays a minigame. The
 * kernel reads the timing grade by it and the client starts the work by it, so both read this one module.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, autoKind, playsMinigame, resourceKind, treasureKind } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;

beforeAll(() => {
  b = loadBundle();
});

describe('the one work predicate (QUARRYING 10)', () => {
  test('a mined node, a felled tree and a trowel spot run by themselves', () => {
    const stones = b.resources['core/river-stones']!;
    const oaks = b.resources['core/oak-trees']!;
    const hall = b.treasures['core/ruins-hall']!;
    expect(resourceKind(stones)).toBe('mine');
    // the oaks name a minigame, but the axe fells them by itself: the game field is not the rule
    expect(oaks.game).toBe('snap');
    expect(resourceKind(oaks)).toBe('fell');
    expect(treasureKind(hall)).toBe('dig');
    expect(playsMinigame('resource', stones)).toBe(false);
    expect(playsMinigame('resource', oaks)).toBe(false);
    expect(playsMinigame('treasure', hall)).toBe(false);
  });

  test('a find by hand has no kind and plays no minigame', () => {
    const glint = b.treasures['core/bridge-glint']!;
    expect(glint.tool).toBeUndefined();
    expect(treasureKind(glint)).toBeUndefined();
    expect(playsMinigame('treasure', glint)).toBe(false);
  });

  test('reeds, herbs, berries, fish and the keystone play their minigames', () => {
    for (const id of ['core/reed-bank', 'core/wild-herbs', 'core/berry-bushes', 'core/river-fish', 'core/keystone']) {
      const r = b.resources[id]!;
      expect(resourceKind(r), id).toBeUndefined();
      expect(playsMinigame('resource', r), id).toBe(true);
    }
  });

  test('a pick names mine, with work mine too; a hammer has no kind and plays', () => {
    expect(resourceKind({ tool: 'pick' })).toBe('mine');
    expect(resourceKind({ tool: 'pick', work: 'mine' })).toBe('mine');
    expect(resourceKind({ work: 'mine' })).toBe('mine');
    expect(resourceKind({ tool: 'hammer', work: 'mine' })).toBeUndefined();
    expect(playsMinigame('resource', { tool: 'hammer', work: 'mine' })).toBe(true);
    expect(resourceKind({})).toBeUndefined();
    expect(playsMinigame('resource', {})).toBe(true);
    expect(autoKind('axe')).toBe('fell');
    expect(autoKind(undefined)).toBeUndefined();
    // a dig spot that names a tool which does not run by itself plays the dig minigame
    expect(playsMinigame('treasure', { tool: 'basket' })).toBe(true);
  });
});
