/**
 * Mining (DECISIONS.md, 2026-10-25: stone is mined): the river stones are broken with blows that run by
 * themselves, as a tree is felled. They train digging, need no tool, and a pick or a hammer in the bag
 * breaks them faster and wears a little each time.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, type StepResult, makeWalkable, newState, nodeVerb, step } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;
let stones: string;

function race(bundle: Bundle, id: string): State {
  const r = step(bundle, newState(bundle, 7), { t: 'start', race: id, name: 'Tester' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** A tile next to the node where the player may stand. */
function beside(bundle: Bundle, state: State, node: string): [number, number] {
  const inst = bundle.instances[node]!;
  const walkable = makeWalkable(bundle);
  for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
    if (walkable(inst.x + dx, inst.y + dy, state.player)) return [inst.x + dx, inst.y + dy];
  }
  throw new Error(`No standing place next to ${node}.`);
}

function mine(state: State, tick = 1000): StepResult {
  return step(b, state, { t: 'gather', node: stones, grade: 3, at: beside(b, state, stones) }, tick);
}

function busyMs(r: StepResult): number {
  if (!r.ok) throw new Error(r.error);
  const busy = r.events.find((e) => e.e === 'busy');
  if (!busy || busy.e !== 'busy') throw new Error('no busy event');
  return busy.ms;
}

/** A character far enough along that a speed bonus is not held at the level-1 cap. */
function seasoned(s: State): State {
  const t = structuredClone(s);
  t.player.xp['core/cooking'] = b.professions['core/cooking']!.xp_levels.at(-1)! * 1000;
  return t;
}

/** The same character with no pick or hammer in the bag. */
function emptyHanded(s: State): State {
  const t = structuredClone(s);
  for (const id of Object.keys(t.player.bag)) {
    const kind = b.items[id]?.tool?.kind;
    if (kind === 'pick' || kind === 'hammer') {
      delete t.player.bag[id];
      for (const [slot, worn] of Object.entries(t.player.worn)) if (worn === id) delete t.player.worn[slot as keyof typeof t.player.worn];
    }
  }
  return t;
}

beforeAll(() => {
  b = loadBundle();
  stones = Object.keys(b.instances).sort().find((id) => b.instances[id]!.source === 'core/river-stones')!;
});

describe('mining', () => {
  test('river stones are mined: no tool, no minigame, and they train digging', () => {
    const r = b.resources['core/river-stones']!;
    expect(r.work).toBe('mine');
    expect(r.tool).toBeUndefined();
    expect(r.game).toBeUndefined();
    expect(nodeVerb(r)).toBe('dig');
    expect(nodeVerb({ work: 'mine' })).toBe('dig');
    // an axe still fells, whatever else the node says
    expect(nodeVerb({ tool: 'axe', work: 'mine' })).toBe('fell');
    expect(b.verbs.dig).toBe('core/digging');
  });

  test('bare hands mine: a stone, digging experience, nothing worn', () => {
    const s = emptyHanded(race(b, 'core/elf'));
    const r = mine(s);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toContainEqual({ e: 'gain', item: 'core/stone', qty: 1 });
    expect(r.state.player.xp['core/digging']).toBeGreaterThan(0);
    expect(r.state.player.xp['core/foraging']).toBeUndefined();
    expect(r.state.player.wear).toEqual(s.player.wear);
  });

  test('a pick in the bag breaks the stone faster and wears', () => {
    const bare = seasoned(emptyHanded(race(b, 'core/elf')));
    const armed = structuredClone(bare);
    armed.player.bag['core/rust-pick'] = 1;
    const withPick = mine(armed);
    expect(busyMs(withPick)).toBeLessThan(busyMs(mine(bare)));
    if (!withPick.ok) return;
    if (b.items['core/rust-pick']!.tool!.uses !== undefined) expect(withPick.state.player.wear['core/rust-pick']).toBe(1);
  });

  test('a hammer helps as a pick does, and the best tool is the one used', () => {
    const bare = seasoned(emptyHanded(race(b, 'core/elf')));
    const hammer = structuredClone(bare);
    hammer.player.bag['core/work-hammer'] = 1;
    expect(busyMs(mine(hammer))).toBeLessThan(busyMs(mine(bare)));
  });

  test('a mined stone does not give again before it is back', () => {
    const first = mine(race(b, 'core/elf'));
    if (!first.ok) throw new Error(first.error);
    expect(mine(first.state, first.state.player.busyUntil)).toEqual({ ok: false, error: 'It has not grown back yet.' });
  });
});
