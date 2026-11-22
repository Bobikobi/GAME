/**
 * Loose stones (DECISIONS.md, 2026-11-22; kernel 0.35.0): lifted at the map's spots, carried, thrown to a landing
 * that runs on, set down, piled and sent home. The world here is a few tiles of the real content's rules, with the
 * stone spots the test lays.
 */
import { describe, expect, test } from 'vitest';

import {
  type Action,
  type Bundle,
  type GameEvent,
  type State,
  type Tile,
  STONE_ITEM,
  STONE_RANGE,
  THROW_STONE,
  canonical,
  gaitStepMs,
  loadBand,
  loadMax,
  loadWeight,
  looseInArea,
  lyingAt,
  newState,
  replay,
  settled,
  step,
  throwFlight,
  walkableFor,
  walkStepMs,
} from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

const base: Bundle = loadBundle();
const S = base.params.stones;

interface Layout {
  ground: string[];
  levels?: string[];
  spots?: { x: number; y: number; size: 'small' | 'large' }[];
  params?: Partial<Bundle['params']['stones']>;
}

/** A small world of the real content's rules: `.` is grass, `~` water, `T` forest (solid), with the given stone spots. */
function world({ ground, levels, spots = [], params = {} }: Layout): Bundle {
  const map = { ...base.map, width: ground[0]!.length, height: ground.length, ground, props: [], slots: [], spawn: { x: 0, y: 0 }, stones: { spots } };
  const b = { ...base, map, instances: {}, npcs: {}, restores: {}, pockets: {}, params: { ...base.params, stones: { ...base.params.stones, ...params } } } as Bundle;
  if (levels) (b.map as { levels?: string[] }).levels = levels;
  else delete (b.map as { levels?: unknown }).levels;
  return b;
}

/** A started player of `race`, standing on `at`. */
function standing(b: Bundle, at: Tile, race = 'core/human'): State {
  const r = step(base, newState(base, 7), { t: 'start', race, name: 'Tess' }, 0);
  if (!r.ok) throw new Error(r.error);
  return { ...r.state, player: { ...r.state.player, at: [at[0], at[1]], movedAt: r.state.tick, bag: {} } };
}

/** Run `actions` one after another, 10 seconds apart, each from the tile the player stands on; every one must be allowed. */
function run(b: Bundle, s: State, ...actions: ((s: State) => Action)[]): { state: State; events: GameEvent[] } {
  let state = s;
  let tick = Math.max(s.tick, 60_000);
  const events: GameEvent[] = [];
  for (const make of actions) {
    tick += 10_000;
    const r = step(b, state, make(state), tick);
    if (!r.ok) throw new Error(r.error);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

/** One action, the error text when it is refused. */
function refused(b: Bundle, s: State, a: Action, tick = Math.max(s.tick, 60_000) + 10_000): string {
  const r = step(b, s, a, tick);
  if (r.ok) throw new Error(`expected a refusal, the action was allowed`);
  return r.error;
}

const at = (s: State): Tile => [s.player.at[0], s.player.at[1]];
const lift = (size: 'small' | 'large', qty?: number) => (s: State): Action => ({ t: 'lift', size, at: at(s), ...(qty !== undefined ? { qty } : {}) });
const setdown = (s: State): Action => ({ t: 'setdown', at: at(s) });
const throwTo = (aim: Tile, power?: number) => (s: State): Action => ({ t: 'throw', at: at(s), aim, ...(power !== undefined ? { power } : {}) });
const drop = (qty: number) => (s: State): Action => ({ t: 'drop', item: STONE_ITEM, qty, at: at(s) });
const pickup = (qty?: number) => (s: State): Action => ({ t: 'pickup', item: STONE_ITEM, at: at(s), ...(qty !== undefined ? { qty } : {}) });
const bagStones = (s: State): number => s.player.bag[STONE_ITEM] ?? 0;

const FIELD = ['..............', '..............', '..............'];

describe('the numbers the stones share with the hunt', () => {
  test('the one small stone is the thrown stone of small game, and its reach is the one #819 shipped', () => {
    expect(STONE_ITEM).toBe(THROW_STONE);
    expect(base.params.stones.small_range).toBe(STONE_RANGE);
  });
});

describe('lifting', () => {
  test('a small stone goes in the bag, from its spot, and the spot is empty after', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, size: 'small' }] });
    const { state, events } = run(b, standing(b, [3, 1]), lift('small'));
    expect(bagStones(state)).toBe(1);
    expect(events.find((e) => e.e === 'lift')).toMatchObject({ size: 'small', qty: 1, at: [3, 1] });
    expect(lyingAt(b, state, [3, 1]).count).toBe(0);
    expect(state.player.stones?.taken).toEqual({ '0': true });
    expect(refused(b, state, lift('small')(state))).toBe('There is no small stone here.');
  });

  test('a large stone is held over the head, not put in the bag, and weighs in the load', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, size: 'large' }] });
    const before = standing(b, [3, 1]);
    const { state } = run(b, before, lift('large'));
    expect(state.player.stones?.carry).toBe('large');
    expect(bagStones(state)).toBe(0);
    expect(loadWeight(b, state)).toBe(loadWeight(b, before) + S.large_weight);
    expect(lyingAt(b, state, [3, 1]).count).toBe(0);
  });

  test('the size must match what lies there', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, size: 'large' }] });
    expect(refused(b, standing(b, [3, 1]), lift('small')(standing(b, [3, 1])))).toBe('There is no small stone here.');
    expect(refused(b, standing(b, [4, 1]), lift('large')(standing(b, [4, 1])))).toBe('There is no large stone here.');
  });

  test('strength: a figure with no might cannot lift a large stone, one with a point of might can', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, size: 'large' }] });
    const elf = standing(b, [3, 1], 'core/elf');
    expect(elf.player.attrs.might).toBe(0);
    expect(refused(b, elf, lift('large')(elf))).toBe('That stone is too heavy for you.');
    const human = standing(b, [3, 1], 'core/human');
    expect(human.player.attrs.might).toBe(1);
    expect(run(b, human, lift('large')).state.player.stones?.carry).toBe('large');
    // the same elf with a point of might spent can
    const trained = { ...elf, player: { ...elf.player, attrs: { ...elf.player.attrs, might: 1 } } };
    expect(run(b, trained, lift('large')).state.player.stones?.carry).toBe('large');
  });

  test('a load already carried counts: a full bag leaves no room for a large stone', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, size: 'large' }] });
    const human = standing(b, [3, 1]);
    const loaded = { ...human, player: { ...human.player, bag: { 'core/stone': 5 } } };
    expect(loadWeight(b, loaded) + S.large_weight).toBeGreaterThan(loadMax(b, loaded));
    expect(refused(b, loaded, lift('large')(loaded))).toBe('That stone is too heavy for you.');
  });

  test('a stone cannot be lifted while both hands hold one, nor during a fight', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, size: 'large' }] });
    const held = run(b, standing(b, [3, 1]), lift('large')).state;
    expect(refused(b, held, lift('large')(held))).toBe('Both hands hold the stone. Set it down first.');
    const fighting = { ...standing(b, [3, 1]), player: { ...standing(b, [3, 1]).player, fight: { since: 0 } } };
    expect(refused(b, fighting, lift('large')(fighting))).toBe('Not during a fight.');
  });
});

describe('carrying', () => {
  test('a large stone slows the walk: the load decides the pace, as for any carried weight', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, size: 'large' }] });
    const free = standing(b, [3, 1]);
    const held = run(b, free, lift('large')).state;
    expect(walkStepMs(b, held)).toBeGreaterThan(walkStepMs(b, free));
    expect(loadBand(b, held)).not.toBe('light');
    // the walking pace the position reports are checked against follows
    expect(gaitStepMs(b, held, 'walk')).toBe(walkStepMs(b, held));
  });

  test('hands are full: the only things done are walking, setting down and throwing', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, size: 'large' }] });
    const held = run(b, standing(b, [3, 1]), lift('large')).state;
    expect(refused(b, held, { t: 'eat', item: 'core/bread' })).toBe('Both hands hold the stone. Set it down first.');
    expect(refused(b, held, { t: 'jump', at: [4, 1] })).toBe('Both hands hold the stone. Set it down first.');
    expect(refused(b, held, { t: 'drop', item: STONE_ITEM, qty: 1, at: [3, 1] })).toBe('Both hands hold the stone. Set it down first.');
    expect(refused(b, held, { t: 'move', at: [4, 1], gait: 'run' })).toBe('You cannot run with a stone over your head.');
    const walked = step(b, held, { t: 'move', at: [4, 1] }, Math.max(held.tick, 60_000) + 20_000);
    expect(walked.ok).toBe(true);
  });

  test('setting it down puts it on the tile, counted, and frees the hands', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, size: 'large' }] });
    const held = run(b, standing(b, [3, 1]), lift('large')).state;
    const { state, events } = run(b, { ...held, player: { ...held.player, at: [5, 1] } }, setdown);
    expect(state.player.stones?.carry).toBeUndefined();
    expect(lyingAt(b, state, [5, 1])).toMatchObject({ large: 1, count: 1 });
    expect(events.find((e) => e.e === 'setdown')).toMatchObject({ at: [5, 1], count: 1 });
    expect(loadWeight(b, state)).toBe(0);
    expect(refused(b, state, setdown(state))).toBe('You are not holding a stone.');
  });
});

describe('the throw', () => {
  test('a small stone flies its range, touches, runs on, and lies where it stops', () => {
    const b = world({ ground: FIELD, spots: [{ x: 1, y: 1, size: 'small' }] });
    const lifted = run(b, standing(b, [1, 1]), lift('small')).state;
    const r = run(b, lifted, throwTo([12, 1]));
    const thrown = r.events.find((e) => e.e === 'stone_thrown');
    expect(thrown).toMatchObject({ size: 'small', from: [1, 1], touch: [1 + S.small_range, 1], at: [1 + S.small_range + S.small_roll, 1], ms: S.throw_ms });
    expect(bagStones(r.state)).toBe(0);
    expect(lyingAt(b, r.state, [1 + S.small_range + S.small_roll, 1]).small).toBe(1);
  });

  test('a large stone flies shorter and runs on less', () => {
    const b = world({ ground: FIELD, spots: [{ x: 1, y: 1, size: 'large' }] });
    const held = run(b, standing(b, [1, 1]), lift('large')).state;
    const r = run(b, held, throwTo([12, 1]));
    expect(r.events.find((e) => e.e === 'stone_thrown')).toMatchObject({ size: 'large', touch: [1 + S.large_range, 1], at: [1 + S.large_range + S.large_roll, 1] });
    expect(S.large_range).toBeLessThan(S.small_range);
    expect(r.state.player.stones?.carry).toBeUndefined();
    expect(lyingAt(b, r.state, [1 + S.large_range + S.large_roll, 1]).large).toBe(1);
  });

  test('the direction is the aim\'s, and a diagonal reaches by the straight-line distance', () => {
    const b = world({ ground: ['..........', '..........', '..........', '..........', '..........', '..........', '..........'], spots: [] });
    const s = standing(b, [1, 1]);
    const west = standing(b, [8, 3]);
    const f = (st: State, aim: Tile) => throwFlight(b, st, 'small', aim) as Exclude<ReturnType<typeof throwFlight>, { error: string }>;
    expect(f(west, [0, 3]).touch).toEqual([8 - S.small_range, 3]);
    const diag = f(s, [6, 6]);
    expect(diag.air.length).toBeGreaterThan(0);
    for (const t of diag.air) expect((t[0] - 1) ** 2 + (t[1] - 1) ** 2).toBeLessThanOrEqual(S.small_range ** 2);
    // every tile of the air lies on the line toward the aim
    expect(diag.air.every((t) => t[0] - 1 === t[1] - 1)).toBe(true);
    expect(throwFlight(b, s, 'small', [1, 1])).toEqual({ error: 'Aim away from your own feet.' });
  });

  test('a wall stops it short: it drops in front of the wall and does not run on', () => {
    const b = world({ ground: ['....T.....', '....T.....'], spots: [] });
    const s = standing(b, [1, 0]);
    const f = throwFlight(b, s, 'small', [9, 0]);
    if ('error' in f) throw new Error(f.error);
    expect(f.blocked).toBe(true);
    expect(f.touch).toEqual([3, 0]);
    expect(f.rest).toEqual([3, 0]);
    expect(f.roll).toEqual([]);
  });

  test('a stone that comes down on water sinks, and one that runs to the bank stops there', () => {
    // water from x = 4: a throw of 3 from x = 1 touches the water
    const sink = world({ ground: ['....~~~~~~'], spots: [] });
    const f = throwFlight(sink, standing(sink, [0, 0]), 'small', [9, 0]);
    if ('error' in f) throw new Error(f.error);
    expect(f.sank).toBe(false);
    // from x = 1 the touch is x = 4, in the water
    const g = throwFlight(sink, standing(sink, [1, 0]), 'small', [9, 0]);
    if ('error' in g) throw new Error(g.error);
    expect(g.sank).toBe(true);
    expect(g.rest).toBeUndefined();
    // a roll stops at the bank
    const bank = world({ ground: ['......~~~~'], spots: [] });
    const h = throwFlight(bank, standing(bank, [2, 0]), 'small', [9, 0]);
    if ('error' in h) throw new Error(h.error);
    expect(h.touch).toEqual([2 + S.small_range, 0]);
    expect(h.rest![0]).toBeLessThan(6);
  });

  test('a sunk stone leaves the world and goes home after the return time', () => {
    const b = world({ ground: ['....~~~~~~'], spots: [{ x: 2, y: 0, size: 'small' }] });
    const lifted = run(b, standing(b, [2, 0]), lift('small')).state;
    const r = run(b, lifted, throwTo([9, 0]));
    expect(r.events.find((e) => e.e === 'stone_thrown')).toMatchObject({ at: null });
    expect(bagStones(r.state)).toBe(0);
    expect(r.state.player.ground).toBeUndefined();
    // gone from the spot until the return time passes
    expect(lyingAt(b, r.state, [2, 0]).count).toBe(0);
    expect(lyingAt(b, settled(b, r.state, r.state.tick + S.return_ms), [2, 0]).count).toBe(1);
  });

  test('a stone does not roll uphill, and rolls on down a slope', () => {
    const up = world({ ground: ['.........'], levels: ['000001111'], spots: [] });
    const f = throwFlight(up, standing(up, [1, 0]), 'small', [8, 0]);
    if ('error' in f) throw new Error(f.error);
    expect(f.touch).toEqual([1 + S.small_range, 0]);
    // the step at x = 5 climbs: the roll ends on the tile before it
    expect(f.rest).toEqual([4, 0]);
    const down = world({ ground: ['.........'], levels: ['111110000'], spots: [] });
    const g = throwFlight(down, standing(down, [1, 0]), 'small', [8, 0]);
    if ('error' in g) throw new Error(g.error);
    expect(g.rest).toEqual([1 + S.small_range + S.small_roll, 0]);
  });

  test('the power rides the throw: a full throw is the default, a half throw flies half as far', () => {
    const b = world({ ground: ['..................'], spots: [], params: { small_range: 6, small_roll: 2 } });
    const s = standing(b, [1, 0]);
    const full = throwFlight(b, s, 'small', [17, 0]);
    const half = throwFlight(b, s, 'small', [17, 0], 500);
    const dflt = throwFlight(b, s, 'small', [17, 0], 1000);
    if ('error' in full || 'error' in half || 'error' in dflt) throw new Error('a throw is made');
    expect(full).toEqual(dflt);
    expect(full.touch).toEqual([7, 0]);
    expect(half.touch).toEqual([4, 0]);
    expect(refused(b, standing(b, [1, 0]), { t: 'throw', at: [1, 0], aim: [5, 0], power: 0 })).toBe('That is not a throw.');
    expect(refused(b, standing(b, [1, 0]), { t: 'throw', at: [1, 0], aim: [5, 0], power: 1001 })).toBe('That is not a throw.');
  });

  test('with no stone in hand there is nothing to throw', () => {
    const b = world({ ground: FIELD });
    const s = standing(b, [1, 1]);
    expect(refused(b, s, throwTo([5, 1])(s))).toBe('You have no stone to throw.');
  });

  test('a stone from the bag that no spot gave (a mined one) just goes when its time is up', () => {
    const b = world({ ground: FIELD });
    const s = { ...standing(b, [1, 1]), player: { ...standing(b, [1, 1]).player, bag: { [STONE_ITEM]: 1 } } };
    const r = run(b, s, throwTo([9, 1]));
    const rest: Tile = [1 + S.small_range + S.small_roll, 1];
    expect(lyingAt(b, r.state, rest).small).toBe(1);
    expect(lyingAt(b, settled(b, r.state, r.state.tick + S.return_ms), rest).count).toBe(0);
  });
});

describe('the return', () => {
  const spotWorld = () => world({ ground: FIELD, spots: [{ x: 1, y: 1, size: 'small' }] });

  test('a thrown stone lies where it landed until the return time, then it is back at its own spot', () => {
    const b = spotWorld();
    const lifted = run(b, standing(b, [1, 1]), lift('small')).state;
    const thrown = run(b, lifted, throwTo([12, 1])).state;
    const rest: Tile = [1 + S.small_range + S.small_roll, 1];
    const t0 = thrown.tick;
    // just before: still lying where it landed, the spot still empty
    const early = settled(b, thrown, t0 + S.return_ms - 1);
    expect(lyingAt(b, early, rest).small).toBe(1);
    expect(lyingAt(b, early, [1, 1]).count).toBe(0);
    // at the time: gone from the tile, back at the spot
    const late = settled(b, thrown, t0 + S.return_ms);
    expect(lyingAt(b, late, rest).count).toBe(0);
    expect(lyingAt(b, late, [1, 1])).toMatchObject({ spot: 'small', count: 1 });
    // the kernel settles it itself at the next step, the same way
    const next = step(b, thrown, { t: 'move', at: [1, 1] }, t0 + S.return_ms);
    if (!next.ok) throw new Error(next.error);
    expect(lyingAt(b, next.state, [1, 1]).count).toBe(1);
    expect(lyingAt(b, next.state, rest).count).toBe(0);
  });

  test('lift, throw, return and lift again nets zero: the world never holds more stones than it began with', () => {
    const b = spotWorld();
    let s = standing(b, [1, 1]);
    for (let round = 0; round < 3; round++) {
      s = run(b, s, lift('small')).state;
      expect(bagStones(s)).toBe(1);
      s = run(b, s, throwTo([12, 1])).state;
      const home = settled(b, s, s.tick + S.return_ms);
      expect(bagStones(home) + lyingAt(b, home, [1, 1]).count).toBe(1);
      s = { ...home, player: { ...home.player, at: [1, 1] }, tick: s.tick + S.return_ms };
    }
  });

  test('a stone picked up again before its time no longer goes home on its own', () => {
    const b = spotWorld();
    const lifted = run(b, standing(b, [1, 1]), lift('small')).state;
    const thrown = run(b, lifted, throwTo([12, 1])).state;
    const rest: Tile = [1 + S.small_range + S.small_roll, 1];
    const back = run(b, { ...thrown, player: { ...thrown.player, at: rest } }, lift('small')).state;
    expect(bagStones(back)).toBe(1);
    expect(back.player.stones?.returns).toEqual([]);
    const later = settled(b, back, back.tick + 10 * S.return_ms);
    expect(bagStones(later)).toBe(1);
    expect(lyingAt(b, later, [1, 1]).count).toBe(0);
  });

  test('a large stone goes home the same way', () => {
    const b = world({ ground: FIELD, spots: [{ x: 1, y: 1, size: 'large' }] });
    const held = run(b, standing(b, [1, 1]), lift('large')).state;
    const thrown = run(b, held, throwTo([12, 1])).state;
    const rest: Tile = [1 + S.large_range + S.large_roll, 1];
    expect(lyingAt(b, thrown, rest).large).toBe(1);
    const late = settled(b, thrown, thrown.tick + S.return_ms);
    expect(lyingAt(b, late, rest).count).toBe(0);
    expect(lyingAt(b, late, [1, 1])).toMatchObject({ spot: 'large', count: 1 });
  });

  test('a stone goes to a spot of its own size', () => {
    const b = world({ ground: FIELD, spots: [{ x: 1, y: 1, size: 'large' }, { x: 2, y: 2, size: 'small' }] });
    const s1 = run(b, standing(b, [2, 2]), lift('small')).state;
    const s2 = run(b, { ...s1, player: { ...s1.player, at: [1, 1] } }, lift('large')).state;
    const thrown = run(b, s2, throwTo([12, 1])).state;
    const late = settled(b, thrown, thrown.tick + S.return_ms);
    expect(lyingAt(b, late, [1, 1]).count).toBe(1);
    expect(lyingAt(b, late, [2, 2]).count).toBe(0);
  });
});

describe('piles and the area', () => {
  test('stones set down on one tile are a pile counted by number, and it is taken apart a stone at a time', () => {
    const b = world({ ground: FIELD, spots: [] });
    const s = { ...standing(b, [2, 1]), player: { ...standing(b, [2, 1]).player, bag: { [STONE_ITEM]: 5 } } };
    const piled = run(b, s, drop(1), drop(1), drop(2)).state;
    expect(lyingAt(b, piled, [2, 1])).toMatchObject({ small: 4, count: 4 });
    expect(bagStones(piled)).toBe(1);
    // one taken, then two: the pile shrinks by the number taken
    const apart = run(b, piled, pickup(1), pickup(2)).state;
    expect(lyingAt(b, apart, [2, 1]).small).toBe(1);
    expect(bagStones(apart)).toBe(4);
    // `lift` takes from a pile the same way
    const lifted = run(b, piled, lift('small', 3)).state;
    expect(lyingAt(b, lifted, [2, 1]).small).toBe(1);
    expect(bagStones(lifted)).toBe(4);
  });

  test('a pile is rearranged: stones taken from one tile are set down on another', () => {
    const b = world({ ground: FIELD, spots: [] });
    const s = { ...standing(b, [2, 1]), player: { ...standing(b, [2, 1]).player, bag: { [STONE_ITEM]: 3 } } };
    const piled = run(b, s, drop(3)).state;
    const moved = run(b, piled, pickup(2), (st) => ({ t: 'move', at: [3, 1] }) as Action, drop(2)).state;
    expect(lyingAt(b, moved, [2, 1]).small).toBe(1);
    expect(lyingAt(b, moved, [3, 1]).small).toBe(2);
  });

  test('a pile never blocks: the walk map is the same with it, a figure walks across it, and a stone is no prop', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, size: 'small' }] });
    const walkable = walkableFor(b);
    const view = standing(b, [0, 1]).player;
    const before = FIELD.flatMap((row, y) => [...row].map((_, x) => walkable(x, y, view)));
    const s = { ...standing(b, [2, 1]), player: { ...standing(b, [2, 1]).player, bag: { [STONE_ITEM]: 4 } } };
    const piled = run(b, s, drop(4)).state;
    expect(lyingAt(b, piled, [2, 1]).count).toBe(4);
    const after = FIELD.flatMap((row, y) => [...row].map((_, x) => walkable(x, y, piled.player)));
    expect(after).toEqual(before);
    // walk over the pile and the spot
    const r = run(b, { ...piled, player: { ...piled.player, at: [1, 1] } }, (st) => ({ t: 'move', at: [2, 1] }) as Action, (st) => ({ t: 'move', at: [3, 1] }) as Action, (st) => ({ t: 'move', at: [4, 1] }) as Action);
    expect(r.state.player.at).toEqual([4, 1]);
  });

  test('a pile holds at most pile_max, checked on adding', () => {
    const b = world({ ground: FIELD, spots: [], params: { pile_max: 3, area_cap: 8, small_range: 2, small_roll: 0 } });
    const s = { ...standing(b, [2, 1]), player: { ...standing(b, [2, 1]).player, bag: { [STONE_ITEM]: 6 } } };
    const three = run(b, s, drop(3)).state;
    expect(refused(b, three, drop(1)(three))).toBe('The stones are piled as high as they stay.');
    // a thrown stone that would land on a full pile is refused, not lost: from two tiles west it lands on the pile
    const west = { ...three, player: { ...three.player, at: [0, 1] as Tile } };
    expect(refused(b, west, throwTo([9, 1])(west))).toBe('The stones are piled as high as they stay.');
    expect(bagStones(west)).toBe(3);
  });

  test('an area holds at most area_cap loose stones: spots, set-down stones and thrown ones count together', () => {
    const b = world({ ground: ['.......', '.......'], spots: [{ x: 5, y: 0, size: 'small' }, { x: 6, y: 0, size: 'small' }], params: { area_tiles: 16, area_cap: 4, pile_max: 4 } });
    const s = { ...standing(b, [1, 1]), player: { ...standing(b, [1, 1]).player, bag: { [STONE_ITEM]: 5 } } };
    expect(looseInArea(b, s, '0,0')).toBe(2);
    const two = run(b, s, drop(2)).state;
    expect(looseInArea(b, two, '0,0')).toBe(4);
    expect(refused(b, two, drop(1)(two))).toBe('Enough stones lie around here already.');
    expect(refused(b, two, throwTo([5, 1])(two))).toBe('Enough stones lie around here already.');
    // taking one from its spot makes room again where it lies: the count moves, it does not grow
    const moved = run(b, { ...two, player: { ...two.player, at: [5, 0] } }, lift('small')).state;
    expect(looseInArea(b, moved, '0,0')).toBe(3);
  });

  test('the cap is checked on adding only: a state already over it still loads and can be emptied', () => {
    const b = world({ ground: FIELD, spots: [], params: { area_cap: 4, pile_max: 4 } });
    const s = standing(b, [2, 1]);
    const over: State = { ...s, player: { ...s.player, ground: { '2,1': { [STONE_ITEM]: 4 }, '3,1': { [STONE_ITEM]: 4 } } } };
    expect(looseInArea(b, over, '0,0')).toBe(8);
    const emptied = run(b, over, pickup(3)).state;
    expect(lyingAt(b, emptied, [2, 1]).small).toBe(1);
  });

  test('stones in another area do not count', () => {
    const wide = world({ ground: [`${'.'.repeat(40)}`], spots: [], params: { area_tiles: 16, area_cap: 4, pile_max: 4 } });
    const s = { ...standing(wide, [20, 0]), player: { ...standing(wide, [20, 0]).player, bag: { [STONE_ITEM]: 6 }, ground: { '2,0': { [STONE_ITEM]: 4 } } } };
    expect(run(wide, s, drop(4)).state.player.ground?.['20,0']?.[STONE_ITEM]).toBe(4);
  });
});

describe('a fall lets go', () => {
  /** 21:20 of the first night: a pit that acts at night (G30), standing on the second tile of the row. */
  const NIGHT = 500_000;
  const pitWorld = (spots: Layout['spots']): Bundle => {
    const b = world({ ground: FIELD, spots });
    b.params = { ...b.params, hazard: { ...b.params.hazard, pit: { ...b.params.hazard.pit, harm_pct: 100 } } };
    b.map.props = [{ id: 'test/pit', sprite: 'core/base-kit:props/standing_stone', x: 2, y: 1, w: 1, h: 1, solid: false, hazard: { kind: 'pit', window: ['night'] } }] as Bundle['map']['props'];
    return b;
  };

  test('a large stone held when the body falls goes back to its spot, and the hands are free after', () => {
    const b = pitWorld([{ x: 1, y: 1, size: 'large' }]);
    const held = run(b, standing(b, [1, 1]), lift('large')).state;
    expect(held.player.stones?.carry).toBe('large');
    const r = step(b, { ...held, tick: NIGHT, player: { ...held.player, movedAt: NIGHT, busyUntil: 0 } }, { t: 'move', at: [2, 1] }, NIGHT + 1000);
    if (!r.ok) throw new Error(r.error);
    expect(r.events.some((e) => e.e === 'fall')).toBe(true);
    expect(r.state.player.stones?.carry).toBeUndefined();
    expect(lyingAt(b, r.state, [1, 1]).count).toBe(0);
    expect(lyingAt(b, settled(b, r.state, r.state.tick + S.return_ms), [1, 1])).toMatchObject({ spot: 'large', count: 1 });
  });

  test('the stones an outing gave are lost with it, and go back to their spots', () => {
    const b = pitWorld([{ x: 1, y: 1, size: 'small' }]);
    const start = standing(b, [1, 1]);
    // out on the ground that is not safe, so the outing keeps an account of what it gave
    const lifted = run(b, { ...start, player: { ...start.player, outing: { gained: {}, solved: [], visited: [] } as State['player']['outing'] } }, lift('small')).state;
    expect(bagStones(lifted)).toBe(1);
    const r = step(b, { ...lifted, tick: NIGHT, player: { ...lifted.player, movedAt: NIGHT, busyUntil: 0 } }, { t: 'move', at: [2, 1] }, NIGHT + 1000);
    if (!r.ok) throw new Error(r.error);
    expect(r.events.some((e) => e.e === 'fall')).toBe(true);
    expect(bagStones(r.state)).toBe(0);
    expect(lyingAt(b, settled(b, r.state, r.state.tick + S.return_ms), [1, 1]).count).toBe(1);
  });
});

describe('replay', () => {
  test('a log of lifts, throws and set-downs replays to the same state, byte for byte', () => {
    const b = world({ ground: FIELD, spots: [{ x: 1, y: 1, size: 'small' }, { x: 2, y: 1, size: 'large' }, { x: 3, y: 1, size: 'small' }] });
    const start = standing(b, [1, 1]);
    const log: { a: Action; tick: number }[] = [];
    let state = start;
    let tick = 60_000;
    const go = (make: (s: State) => Action) => {
      tick += 10_000;
      const a = make(state);
      const r = step(b, state, a, tick);
      if (!r.ok) throw new Error(r.error);
      log.push({ a, tick });
      state = r.state;
    };
    go(lift('small'));
    go(throwTo([12, 1]));
    go((s) => ({ t: 'move', at: [2, 1] }) as Action);
    go(lift('large'));
    go((s) => ({ t: 'move', at: [3, 1] }) as Action);
    go(setdown);
    go(lift('small'));
    go(drop(1));
    go(pickup(1));
    const again = replay(b, start, log);
    expect(again.error).toBeUndefined();
    expect(canonical(again.state)).toBe(canonical(state));
    // and a third time, from a structured copy of the start
    expect(canonical(replay(b, structuredClone(start), log).state)).toBe(canonical(state));
  });
});
