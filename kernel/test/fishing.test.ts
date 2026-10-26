/**
 * Fishing (DECISIONS.md, 2026-10-25: fishing): spots lie on the river's water beside the bank, a rod is
 * needed, and a catch trains fishing, its own profession with its own school.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, type StepResult, makeWalkable, newState, nodeVerb, step, tagAt } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;
let spots: string[];

function race(id: string): State {
  const r = step(b, newState(b, 7), { t: 'start', race: id, name: 'Tester' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** A land tile next to the node where the player may stand. */
function bank(state: State, node: string): [number, number] {
  const inst = b.instances[node]!;
  const walkable = makeWalkable(b);
  for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
    if (walkable(inst.x + dx, inst.y + dy, state.player)) return [inst.x + dx, inst.y + dy];
  }
  throw new Error(`No standing place next to ${node}.`);
}

function fish(state: State, node: string, grade: 0 | 1 | 2 | 3 | 4 = 3, tick = 1000): StepResult {
  return step(b, state, { t: 'gather', node, grade, at: bank(state, node) }, tick);
}

function withRod(s: State): State {
  const t = structuredClone(s);
  t.player.bag['core/fishing-rod'] = 1;
  return t;
}

beforeAll(() => {
  b = loadBundle();
  spots = Object.keys(b.instances).sort().filter((id) => b.instances[id]!.source === 'core/river-fish');
});

describe('fishing', () => {
  test('a rod node trains fishing, its own profession', () => {
    expect(nodeVerb(b.resources['core/river-fish']!)).toBe('fish');
    expect(nodeVerb({ tool: 'rod' })).toBe('fish');
    expect(b.verbs.fish).toBe('core/fishing');
    expect(b.resources['core/river-fish']!.game).toBe('fish');
  });

  test('the spots lie on the water, each beside land the player can stand on', () => {
    expect(spots).toHaveLength(b.resources['core/river-fish']!.count);
    const s = race('core/human');
    for (const id of spots) {
      const inst = b.instances[id]!;
      expect(tagAt(b.map, inst.x, inst.y)).toBe('water');
      expect(() => bank(s, id)).not.toThrow();
    }
  });

  test('without a rod the fish is refused', () => {
    const s = race('core/elf');
    expect(s.player.bag['core/fishing-rod']).toBeUndefined();
    expect(fish(s, spots[0]!)).toEqual({ ok: false, error: 'You need a rod for this.' });
  });

  test('a catch gives a fish, trains fishing only and wears the rod', () => {
    const s = withRod(race('core/elf'));
    const r = fish(s, spots[0]!);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toContainEqual({ e: 'gain', item: 'core/river-fish', qty: 1 });
    expect(r.state.player.xp['core/fishing']).toBeGreaterThan(0);
    expect(r.state.player.xp['core/foraging']).toBeUndefined();
    expect(r.state.player.wear['core/fishing-rod']).toBe(1);
  });

  test('a fished spot is empty until the fish come back', () => {
    const first = fish(withRod(race('core/elf')), spots[0]!);
    if (!first.ok) throw new Error(first.error);
    expect(fish(first.state, spots[0]!, 3, first.state.player.busyUntil)).toEqual({ ok: false, error: 'It has not grown back yet.' });
    const back = fish(first.state, spots[0]!, 3, first.state.player.busyUntil + b.resources['core/river-fish']!.respawn_ms);
    expect(back.ok).toBe(true);
  });

  test('the rod is made at the workshop, and the fish is grilled at the fire', () => {
    expect(b.recipes['core/fishing-rod']!.station).toBe('workshop');
    expect(b.items['core/fishing-rod']!.tool).toEqual({ kind: 'rod', tier: 1, uses: 40 });
    expect(b.recipes['core/grilled-fish']!.station).toBe('fire');
    expect(b.recipes['core/grilled-fish']!.inputs).toContainEqual({ item: 'core/river-fish', qty: 1 });
  });
});
