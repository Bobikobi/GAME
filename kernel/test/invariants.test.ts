import { beforeAll, describe, expect, test } from 'vitest';

import { ATTRIBUTES as SCHEMA_ATTRIBUTES } from '@game/schema';
import {
  ATTRIBUTES as KERNEL_ATTRIBUTES,
  type Action,
  type Bundle,
  type GameEvent,
  type Grade,
  type Rect,
  type State,
  bagCapacity,
  bagUsed,
  campTile,
  findSlot,
  newState,
  npcTile,
  replay,
  satietyAt,
  satietyCap,
  serialize,
  step,
} from '@game/kernel';

import {
  type Tile,
  bfsInside,
  bfsNear,
  loadBundle,
  mulberry32,
} from '../../tools/test/helpers/world.js';

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

describe('kernel invariants', () => {
  test('keeps the schema and kernel attribute lists identical', () => {
    expect(KERNEL_ATTRIBUTES).toEqual(SCHEMA_ATTRIBUTES);
  });

  test('preserves every invariant through seeded accepted and refused actions', () => {
    for (const starter of ['core/forager', 'core/explorer']) {
      for (let run = 0; run < 20; run += 1) {
        const random = mulberry32(0x9e3779b9 ^ run ^ (starter === 'core/forager' ? 0x1357 : 0x2468));
        let state = newState(bundle, run + 1);
        state = checkedStep(state, { t: 'start', starter, name: 'Walker' }, 0);
        for (let actionIndex = 0; actionIndex < 300; actionIndex += 1) {
          const tick = Math.max(state.tick, state.player.busyUntil) + Math.floor(random() * 60_001);
          const action = random() < 0.2
            ? badAction(state, random)
            : plausibleAction(state, random);
          state = checkedStep(state, action, tick);
        }
      }
    }
  });
});

describe('determinism', () => {
  test('replays the same log to identical canonical state text', () => {
    const log = openingLog();
    const first = replay(bundle, newState(bundle, 42), log);
    const second = replay(bundle, newState(bundle, 42), log);

    expect(first.error).toBeUndefined();
    expect(second.error).toBeUndefined();
    expect(serialize(first.state)).toBe(serialize(second.state));
  });

  test('changes at least one find in 100 digs when the seed changes', () => {
    const startOne = digState(1);
    const log = digLog(startOne, 100);
    const one = replay(bundle, digState(1), log);
    const two = replay(bundle, digState(2), log);

    expect(one.error).toBeUndefined();
    expect(two.error).toBeUndefined();
    expect(findSignature(one.events)).not.toEqual(findSignature(two.events));
  });
});

describe('timing grade', () => {
  test('never lowers gather yield as grade increases', () => {
    const node = Object.entries(bundle.instances)
      .find(([, instance]) => instance.source === 'core/river-stones');
    expect(node).toBeDefined();
    const [nodeId, instance] = node!;
    const yields: number[] = [];
    for (const grade of [0, 1, 2, 3, 4] as const) {
      let state = newState(bundle, 77);
      const started = step(bundle, state, { t: 'start', starter: 'core/forager', name: 'Grade' }, 0);
      expect(started.ok).toBe(true);
      if (!started.ok) throw new Error(started.error);
      state = started.state;
      const path = bfsNear(bundle, state.player, state.player.at, {
        x: instance.x,
        y: instance.y,
        w: 1,
        h: 1,
      });
      expect(path).toBeDefined();
      const result = step(bundle, state, { t: 'gather', node: nodeId, grade, at: path!.at(-1)! }, 0);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);
      yields.push(result.state.player.bag['core/stone'] ?? 0);
    }

    // a miss is a gamble that brings home at most one unit
    expect(yields[0]).toBeLessThanOrEqual(1);
    expect(yields[1]!).toBeGreaterThanOrEqual(yields[0]!);
    expect(yields[2]!).toBeGreaterThanOrEqual(yields[1]!);
    expect(yields[3]!).toBeGreaterThanOrEqual(yields[2]!);
    // the jackpot pays in experience only
    expect(yields[4]).toBe(yields[3]);
  });
});

function checkedStep(state: State, action: Action, tick: number): State {
  const before = serialize(state);
  const previousQuests = { ...state.player.quests };
  const result = step(bundle, state, action, tick);
  invariant(serialize(state) === before, 'step mutated its input state');
  if (!result.ok) return state;

  serialize(result.state);
  invariant(
    result.state.player.gold === result.state.ledger.minted - result.state.ledger.burned,
    'gold does not balance against the ledger',
  );
  invariant(result.state.player.gold >= 0, 'gold is negative');
  for (const count of Object.values(result.state.player.bag)) {
    invariant(Number.isInteger(count) && count > 0, 'bag contains a non-positive or fractional stack');
  }
  invariant(bagUsed(result.state) <= bagCapacity(bundle, result.state), 'bag exceeds capacity');
  const satiety = satietyAt(bundle, result.state, result.state.tick);
  invariant(satiety >= 0 && satiety <= satietyCap(bundle, result.state), 'satiety is outside its bounds');
  invariant(result.state.tick === tick, 'accepted action did not store its tick');
  expectQuestProgress(previousQuests, result.state.player.quests);
  return result.state;
}

function expectQuestProgress(
  before: Readonly<Record<string, 'active' | 'done'>>,
  after: Readonly<Record<string, 'active' | 'done'>>,
): void {
  const rank = (value: 'active' | 'done' | undefined): number => value === undefined ? 0 : value === 'active' ? 1 : 2;
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
    invariant(rank(after[id]) >= rank(before[id]), `quest ${id} moved backwards`);
  }
}

function badAction(state: State, random: () => number): Action {
  const knownNode = Object.keys(bundle.instances).sort()[0] ?? 'core/missing#0';
  const choices: Action[] = [
    { t: 'gather', node: 'core/missing#0', grade: 3, at: [...state.player.at] },
    { t: 'gather', node: knownNode, grade: 3, at: [0, 0] },
    { t: 'buy', npc: 'core/trader', item: 'core/basket', qty: 0, at: [...state.player.at] },
    { t: 'gather', node: knownNode, grade: 7 as Grade, at: [...state.player.at] },
  ];
  return pick(choices, random);
}

function plausibleAction(state: State, random: () => number): Action {
  const fallback = (): Action => ({ t: 'spend', attr: pick([...KERNEL_ATTRIBUTES], random) });
  const choice = Math.floor(random() * 11);
  if (choice === 0) {
    const [id, instance] = pick(Object.entries(bundle.instances).sort(([a], [b]) => a.localeCompare(b)), random);
    const at = nearTile(state, { x: instance.x, y: instance.y, w: 1, h: 1 });
    if (!at) return fallback();
    return instance.kind === 'resource'
      ? { t: 'gather', node: id, grade: Math.floor(random() * 5) as Grade, at }
      : { t: 'dig', spot: id, grade: Math.floor(random() * 5) as Grade, at };
  }
  if (choice === 1) {
    const [id, restore] = pick(Object.entries(bundle.restores).sort(([a], [b]) => a.localeCompare(b)), random);
    const slot = findSlot(bundle.map, restore.place.slot);
    const at = slot && nearTile(state, slot);
    return at ? { t: 'restore', restore: id, at } : fallback();
  }
  if (choice === 2) {
    const [id, camp] = pick(Object.entries(bundle.camps).sort(([a], [b]) => a.localeCompare(b)), random);
    const tile = campTile(bundle, camp.slot);
    const at = tile && nearTile(state, { x: tile[0], y: tile[1], w: 1, h: 1 });
    return at ? { t: 'build', camp: id, at } : fallback();
  }
  if (choice === 3) {
    const [id, recipe] = pick(Object.entries(bundle.recipes).sort(([a], [b]) => a.localeCompare(b)), random);
    const station = Object.values(bundle.camps).find((camp) => camp.provides === recipe.station);
    const tile = station && campTile(bundle, station.slot);
    const at = tile && nearTile(state, { x: tile[0], y: tile[1], w: 1, h: 1 });
    return at ? { t: 'craft', recipe: id, at } : fallback();
  }
  if (choice === 4 || choice === 5) {
    const shops = Object.entries(bundle.npcs).filter(([, npc]) => npc.shop);
    const [id, npc] = pick(shops, random);
    const tile = npcTile(bundle, id);
    const at = tile && nearTile(state, { x: tile[0], y: tile[1], w: 1, h: 1 });
    if (!at || !npc.shop) return fallback();
    if (choice === 4) {
      const offer = pick(bundle.shops[npc.shop]!.sells, random);
      return { t: 'buy', npc: id, item: offer.item, qty: 1, at };
    }
    const item = Object.keys(state.player.bag).sort()[0] ?? Object.keys(bundle.items).sort()[0]!;
    return { t: 'sell', npc: id, item, qty: 1, at };
  }
  if (choice === 6) {
    const quests = Object.entries(bundle.quests).filter(([, quest]) => quest.giver);
    const [id, quest] = pick(quests, random);
    const tile = npcTile(bundle, quest.giver!);
    const at = tile && nearTile(state, { x: tile[0], y: tile[1], w: 1, h: 1 });
    if (!at) return fallback();
    return random() < 0.5 ? { t: 'accept', quest: id, at } : { t: 'turnin', quest: id, at };
  }
  if (choice === 7) {
    const slot = pick(bundle.map.slots, random);
    const at = bfsInside(bundle, state.player, state.player.at, slot)?.at(-1);
    return at ? { t: 'visit', slot: slot.id, at } : fallback();
  }
  if (choice === 8) return { t: 'eat', item: pick(Object.keys(bundle.items).sort(), random) };
  if (choice === 9) return { t: 'learn', item: pick(Object.keys(bundle.items).sort(), random) };
  return fallback();
}

function nearTile(state: State, rect: Rect): Tile | undefined {
  return bfsNear(bundle, state.player, state.player.at, rect)?.at(-1);
}

function pick<T>(values: readonly T[], random: () => number): T {
  const value = values[Math.floor(random() * values.length)];
  if (value === undefined) throw new Error('Cannot pick from an empty list.');
  return value;
}

function openingLog(): { a: Action; tick: number }[] {
  let state = newState(bundle, 42);
  const log: { a: Action; tick: number }[] = [];
  const append = (a: Action, tick: number): void => {
    log.push({ a, tick });
    const result = step(bundle, state, a, tick);
    if (!result.ok) throw new Error(result.error);
    state = result.state;
  };
  append({ t: 'start', starter: 'core/forager', name: 'Replay' }, 0);
  const stones = Object.entries(bundle.instances)
    .filter(([, instance]) => instance.source === 'core/river-stones')
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [node, instance] of stones) {
    const at = nearTile(state, { x: instance.x, y: instance.y, w: 1, h: 1 });
    if (!at) throw new Error(`No path to ${node}.`);
    append({ t: 'gather', node, grade: 3, at }, state.player.busyUntil);
  }
  const bridge = findSlot(bundle.map, bundle.restores['core/old-bridge']!.place.slot)!;
  const at = nearTile(state, bridge);
  if (!at) throw new Error('No path to the bridge.');
  append({ t: 'restore', restore: 'core/old-bridge', at }, state.player.busyUntil);
  return log;
}

function digState(seed: number): State {
  const result = step(bundle, newState(bundle, seed), { t: 'start', starter: 'core/explorer', name: 'Digger' }, 0);
  if (!result.ok) throw new Error(result.error);
  const state = result.state;
  state.player.bag['core/trowel'] = 3;
  state.player.attrs.carry = 100;
  state.player.restored = ['core/old-bridge'];
  return state;
}

function digLog(initial: State, count: number): { a: Action; tick: number }[] {
  let state = structuredClone(initial);
  const spots = Object.entries(bundle.instances)
    .filter(([, instance]) => instance.source === 'core/ruins-gate')
    .sort(([a], [b]) => a.localeCompare(b));
  const log: { a: Action; tick: number }[] = [];
  for (let index = 0; index < count; index += 1) {
    const [spot, instance] = spots[index % spots.length]!;
    const at = nearTile(state, { x: instance.x, y: instance.y, w: 1, h: 1 });
    if (!at) throw new Error(`No path to ${spot}.`);
    const tick = Math.max(state.player.busyUntil, state.nodes[spot]?.readyAt ?? 0);
    const action = { t: 'dig', spot, grade: 3, at } as const;
    log.push({ a: action, tick });
    const result = step(bundle, state, action, tick);
    if (!result.ok) throw new Error(result.error);
    state = result.state;
  }
  return log;
}

function findSignature(events: readonly GameEvent[]): string[] {
  return events
    .filter((event) => event.e === 'gain' || event.e === 'nothing')
    .map((event) => event.e === 'gain' ? event.item : 'nothing');
}

function invariant(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
