/** Misses, jackpots, luck and the character's look: the rules around the minigame grade. */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type Grade, type State, JACKPOT_XP, MISS_KEEP_BP, MISS_KEEP_MAX_BP, newState, step } from '@game/kernel';

import { bfsNear, loadBundle } from '../../tools/test/helpers/world.js';

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

/** A replayed format 1 start: the forager's old profile and tools at the west bank, so the gathers below read as they always did. */
function started(seed: number): State {
  const result = step(bundle, newState(bundle, seed), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function raced(seed: number, race: string, look?: number): State {
  const result = step(bundle, newState(bundle, seed), { t: 'start', race, name: 'Tester', look }, 0);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

/** Gather the first river stone with a grade; returns the new state. */
function gatherStone(state: State, grade: Grade): State {
  const [nodeId, instance] = Object.entries(bundle.instances).find(([, i]) => i.source === 'core/river-stones')!;
  const path = bfsNear(bundle, state.player, state.player.at, { x: instance.x, y: instance.y, w: 1, h: 1 });
  const result = step(bundle, state, { t: 'gather', node: nodeId, grade, at: path!.at(-1)! }, 0);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe('a missed gather', () => {
  test('brings one unit home about half the time, the same way for the same seed', () => {
    let kept = 0;
    for (let seed = 1; seed <= 400; seed += 1) kept += gatherStone(started(seed), 0).player.bag['core/stone'] ?? 0;
    expect(kept / 400).toBeGreaterThan(MISS_KEEP_BP / 10_000 - 0.08);
    expect(kept / 400).toBeLessThan(MISS_KEEP_BP / 10_000 + 0.08);
    const again = gatherStone(started(7), 0).player.bag['core/stone'];
    expect(gatherStone(started(7), 0).player.bag['core/stone']).toBe(again);
  });

  test('keeps more often with luck, but never always', () => {
    const rate = (luck: number): number => {
      let kept = 0;
      for (let seed = 1; seed <= 400; seed += 1) {
        const state = started(seed);
        state.player.attrs.luck = luck;
        kept += gatherStone(state, 0).player.bag['core/stone'] ?? 0;
      }
      return kept / 400;
    };
    const perPoint = bundle.params.per_point.luck_permille / 1000;
    expect(rate(2)).toBeGreaterThan(MISS_KEEP_BP / 10_000 + 2 * perPoint - 0.08);
    expect(rate(10)).toBeLessThan(MISS_KEEP_MAX_BP / 10_000 + 0.05);
  });
});

describe('a jackpot', () => {
  test('gives the goods of a perfect strike and three times the experience', () => {
    const perfect = gatherStone(started(3), 3);
    const jackpot = gatherStone(started(3), 4);
    expect(jackpot.player.bag).toEqual(perfect.player.bag);
    // the river stones are mined, which trains digging (DECISIONS.md, 2026-10-25)
    const profession = bundle.verbs.dig;
    expect(perfect.player.xp[profession]).toBeGreaterThan(0);
    expect(jackpot.player.xp[profession]).toBe(perfect.player.xp[profession]! * JACKPOT_XP);
  });

  test('refuses a grade above the jackpot', () => {
    const state = started(3);
    const [nodeId] = Object.entries(bundle.instances).find(([, i]) => i.source === 'core/river-stones')!;
    const result = step(bundle, state, { t: 'gather', node: nodeId, grade: 5 as Grade, at: [...state.player.at] }, 0);
    expect(result.ok).toBe(false);
  });
});

describe('the look', () => {
  test('defaults to the first look and keeps the second when the race has one', () => {
    expect(raced(1, 'core/elf').player.look).toBe(0);
    const withAlt = Object.values(bundle.races).find((r) => r.sprite_alt);
    if (withAlt) expect(raced(1, withAlt.id, 1).player.look).toBe(1);
  });

  test('refuses a look the race does not have', () => {
    const result = step(bundle, newState(bundle, 1), { t: 'start', race: 'core/elf', name: 'Tester', look: 2 }, 0);
    expect(result.ok).toBe(false);
    const plain = { ...bundle, races: Object.fromEntries(Object.entries(bundle.races).map(([id, r]) => [id, { ...r, sprite_alt: undefined }])) };
    const second = step(plain, newState(plain, 1), { t: 'start', race: 'core/elf', name: 'Tester', look: 1 }, 0);
    expect(second.ok).toBe(false);
  });
});
