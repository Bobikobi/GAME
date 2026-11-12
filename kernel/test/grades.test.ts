/** Misses, jackpots, luck and the character's look: the rules around the minigame grade, and work that plays none. */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type Grade, type State, type StepResult, MISS_KEEP_BP, MISS_KEEP_MAX_BP, makeWalkable, newState, step } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

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

/** The first node of a source, worked with a grade from a tile beside it (the kernel checks the tile, not the walk). */
function work(state: State, source: string, grade: Grade, t: 'gather' | 'dig' = 'gather'): StepResult {
  const [nodeId, instance] = Object.entries(bundle.instances).find(([, i]) => i.source === source)!;
  const walkable = makeWalkable(bundle);
  const at = ([[0, 1], [1, 0], [0, -1], [-1, 0]] as const)
    .map(([dx, dy]): [number, number] => [instance.x + dx, instance.y + dy])
    .find(([x, y]) => walkable(x, y, state.player))!;
  return step(bundle, state, t === 'gather' ? { t, node: nodeId, grade, at } : { t, spot: nodeId, grade, at }, 0);
}

function ok(result: StepResult): Extract<StepResult, { ok: true }> {
  if (!result.ok) throw new Error(result.error);
  return result;
}

/** Pull the first reeds with a grade: a node with a minigame (QUARRYING 10), so a miss and a jackpot are still told. */
function gatherReeds(state: State, grade: Grade): State {
  return ok(work(state, 'core/reed-bank', grade)).state;
}

describe('a missed gather', () => {
  test('brings one unit home about half the time, the same way for the same seed', () => {
    let kept = 0;
    for (let seed = 1; seed <= 400; seed += 1) kept += gatherReeds(started(seed), 0).player.bag['core/reed'] ?? 0;
    expect(kept / 400).toBeGreaterThan(MISS_KEEP_BP / 10_000 - 0.08);
    expect(kept / 400).toBeLessThan(MISS_KEEP_BP / 10_000 + 0.08);
    const again = gatherReeds(started(7), 0).player.bag['core/reed'];
    expect(gatherReeds(started(7), 0).player.bag['core/reed']).toBe(again);
  });

  test('keeps more often with luck, but never always', () => {
    const rate = (luck: number): number => {
      let kept = 0;
      for (let seed = 1; seed <= 400; seed += 1) {
        const state = started(seed);
        state.player.attrs.luck = luck;
        kept += gatherReeds(state, 0).player.bag['core/reed'] ?? 0;
      }
      return kept / 400;
    };
    const perPoint = bundle.params.per_point.luck_permille / 1000;
    expect(rate(2)).toBeGreaterThan(MISS_KEEP_BP / 10_000 + 2 * perPoint - 0.08);
    expect(rate(10)).toBeLessThan(MISS_KEEP_MAX_BP / 10_000 + 0.05);
  });
});

describe('a jackpot', () => {
  test('gives the goods and the experience of a perfect strike: luck pays no experience (PROGRESSION 4.7 b)', () => {
    const perfect = gatherReeds(started(3), 3);
    const jackpot = gatherReeds(started(3), 4);
    expect(jackpot.player.bag).toEqual(perfect.player.bag);
    // reeds are pulled by hand, which trains foraging
    const profession = bundle.verbs.gather;
    expect(perfect.player.xp[profession]).toBeGreaterThan(0);
    expect(jackpot.player.xp).toEqual(perfect.player.xp);
  });

  // the range is checked before anything else, on the river stones too, whose work runs by itself
  test('refuses a grade above the jackpot', () => {
    const state = started(3);
    const [nodeId] = Object.entries(bundle.instances).find(([, i]) => i.source === 'core/river-stones')!;
    const result = step(bundle, state, { t: 'gather', node: nodeId, grade: 5 as Grade, at: [...state.player.at] }, 0);
    expect(result.ok).toBe(false);
  });
});

describe('work that runs by itself (QUARRYING 10)', () => {
  test('a grade 4 sent to the river stones is read as 3: the same stone, the same experience, no jackpot', () => {
    const perfect = ok(work(started(3), 'core/river-stones', 3));
    const claimed = ok(work(started(3), 'core/river-stones', 4));
    expect(claimed.state).toEqual(perfect.state);
    expect(claimed.events).toEqual(perfect.events);
    expect(claimed.events.some((e) => e.e === 'jackpot')).toBe(false);
  });

  test('a grade 0 sent to the river stones never misses and draws nothing', () => {
    const [nodeId] = Object.entries(bundle.instances).find(([, i]) => i.source === 'core/river-stones')!;
    for (let seed = 1; seed <= 40; seed += 1) {
      const careless = ok(work(started(seed), 'core/river-stones', 0)).state;
      expect(careless.player.bag['core/stone']).toBe(1);
      expect(careless.nodes[nodeId]!.draws).toBe(0);
    }
  });

  test('a grade 4 on the reeds still writes the jackpot', () => {
    expect(ok(work(started(3), 'core/reed-bank', 4)).events).toContainEqual({ e: 'jackpot', verb: 'gather' });
  });

  test('a dig spot dug by itself reads grade 3 too', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const state = started(seed);
      state.player.bag['core/trowel'] = 1;
      const perfect = ok(work(structuredClone(state), 'core/ruins-hall', 3, 'dig'));
      expect(ok(work(structuredClone(state), 'core/ruins-hall', 0, 'dig')).state).toEqual(perfect.state);
      const claimed = ok(work(structuredClone(state), 'core/ruins-hall', 4, 'dig'));
      expect(claimed.state).toEqual(perfect.state);
      expect(claimed.events.some((e) => e.e === 'jackpot')).toBe(false);
    }
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
