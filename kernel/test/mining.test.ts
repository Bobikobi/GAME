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

describe('the tie rule: a lasting tool before a worn one (QUARRYING 6)', () => {
  test('a human with the work hammer and a hammerstone mines the river stones and wears nothing', () => {
    const s = race(b, 'core/human');
    expect(s.player.bag['core/work-hammer']).toBe(1);
    s.player.bag['core/hammerstone'] = 1;
    const r = mine(s);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.player.wear['core/hammerstone']).toBeUndefined();
    expect(r.state.player.bag['core/hammerstone']).toBe(1);
  });

  test('a skeleton with the rust pick and a knapped pick, at a node that requires a pick, uses the rust pick', () => {
    const picky = structuredClone(b);
    picky.resources['core/river-stones']!.tool = 'pick';
    const s = race(picky, 'core/skeleton');
    expect(s.player.bag['core/rust-pick']).toBe(1);
    s.player.bag['core/knapped-pick'] = 1;
    const r = step(picky, s, { t: 'gather', node: stones, grade: 3, at: beside(picky, s, stones) }, 1000);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.player.wear['core/knapped-pick']).toBeUndefined();
  });

  test('a higher tier still wins over a lasting tool', () => {
    const better = structuredClone(b);
    better.items['test/pick-2'] = { ...better.items['core/knapped-pick']!, id: 'test/pick-2', tier: 2, tool: { kind: 'pick', tier: 2, uses: 10 } };
    const s = race(better, 'core/skeleton');
    s.player.bag['test/pick-2'] = 1;
    const r = step(better, s, { t: 'gather', node: stones, grade: 3, at: beside(better, s, stones) }, 1000);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.player.wear['test/pick-2']).toBe(1);
  });
});

describe('the hammerstone and the knapped pick (QUARRYING 6)', () => {
  /** The character at level 1, 2 or 3, raised by cooking so the digging speed is untouched, and wearing nothing that speeds a gather. */
  function atLevel(s: State, level: 1 | 2 | 3): State {
    const t = structuredClone(s);
    t.player.worn = {};
    const levels = b.professions['core/cooking']!.xp_levels;
    if (level > 1) t.player.xp['core/cooking'] = levels[level - 2]! * 1000;
    return t;
  }

  for (const tool of ['core/hammerstone', 'core/knapped-pick']) {
    test(`${tool} gives nothing at character level 1, +100 at level 2 and +150 from level 3, and wears`, () => {
      const bare = emptyHanded(race(b, 'core/elf'));
      const armed = structuredClone(bare);
      armed.player.bag[tool] = 1;
      // 2500 ms at 1000, 1100 and 1150 permille: the power cap holds the bonus at 1000, then 1100, then 1200
      const busy = ([1, 2, 3] as const).map((level) => busyMs(mine(atLevel(armed, level))));
      expect(busy).toEqual([2500, 2273, 2174]);
      const r = mine(armed);
      if (!r.ok) throw new Error(r.error);
      expect(r.state.player.wear[tool]).toBe(1);
    });
  }

  test('both are known from the start and made at the work stone', () => {
    const s = race(b, 'core/elf');
    expect(s.player.recipes).toContain('core/hammerstone');
    expect(s.player.recipes).toContain('core/knapped-pick');
    expect(b.recipes['core/hammerstone']!.station).toBe('workshop');
    expect(b.recipes['core/knapped-pick']!.station).toBe('workshop');
    expect(b.stations.workshop).toBe('core/handcraft');
  });
});
