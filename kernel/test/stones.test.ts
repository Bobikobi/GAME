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
  FULL_POWER,
  STONE_RANGE,
  adaptState,
  canonical,
  chargePower,
  gaitStepMs,
  loadBand,
  loadMax,
  loadWeight,
  looseInArea,
  migrateState,
  lyingAt,
  newState,
  replay,
  settled,
  step,
  throwFlight,
  throwHoldLimit,
  walkableFor,
  walkStepMs,
} from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

const base: Bundle = loadBundle();
const STONE_ITEM = 'core/stone';
const ARMS_STONE = 'core/large-stone';
const S = base.params.stones;
const hand = base.params.liftables[STONE_ITEM]!;
const arms = base.params.liftables[ARMS_STONE]!;

interface Layout {
  ground: string[];
  levels?: string[];
  spots?: NonNullable<Bundle['map']['stones']>['spots'];
  liftables?: Bundle['params']['liftables'];
  params?: Partial<Bundle['params']['stones']>;
}

/** A small world of the real content's rules: `.` is grass, `~` water, `T` forest (solid), with the given stone spots. */
function world({ ground, levels, spots = [], params = {}, liftables = {} }: Layout): Bundle {
  const map = { ...base.map, width: ground[0]!.length, height: ground.length, ground, props: [], slots: [], spawn: { x: 0, y: 0 }, stones: { spots } };
  const b = { ...base, map, instances: {}, npcs: {}, restores: {}, pockets: {}, params: { ...base.params, stones: { ...base.params.stones, ...params }, liftables: { ...base.params.liftables, ...liftables } } } as Bundle;
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
const lift = (kind: string, qty?: number) => (s: State): Action => ({ t: 'lift', kind, at: at(s), ...(qty !== undefined ? { qty } : {}) });
const setdown = (s: State): Action => ({ t: 'setdown', at: at(s) });
const throwTo = (aim: Tile, power?: number) => (s: State): Action => ({ t: 'throw', at: at(s), aim, ...(power !== undefined ? { power } : {}) });
const drop = (qty: number) => (s: State): Action => ({ t: 'drop', item: STONE_ITEM, qty, at: at(s) });
const pickup = (qty?: number) => (s: State): Action => ({ t: 'pickup', item: STONE_ITEM, at: at(s), ...(qty !== undefined ? { qty } : {}) });
const bagStones = (s: State): number => s.player.bag[STONE_ITEM] ?? 0;

const FIELD = ['..............', '..............', '..............'];

describe('the numbers the stones share with the hunt', () => {
  test('the one small stone is the thrown stone of small game, and its reach is the one #819 shipped', () => {
    expect(STONE_ITEM).toBe(base.params.hunt.throw_item);
    expect(hand.throw_range).toBe(STONE_RANGE);
  });
});

describe('lifting', () => {
  test('a small stone goes in the bag, from its spot, and the spot is empty after', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, kind: STONE_ITEM }] });
    const { state, events } = run(b, standing(b, [3, 1]), lift(STONE_ITEM));
    expect(bagStones(state)).toBe(1);
    expect(events.find((e) => e.e === 'lift')).toMatchObject({ kind: STONE_ITEM, qty: 1, at: [3, 1] });
    expect(lyingAt(b, state, [3, 1]).count).toBe(0);
    expect(state.player.stones?.taken).toEqual({ '0': true });
    expect(refused(b, state, lift(STONE_ITEM)(state))).toBe('There is no small stone here.');
  });

  test('a large stone is held over the head, not put in the bag, and weighs in the load', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, kind: ARMS_STONE }] });
    const before = standing(b, [3, 1]);
    const { state } = run(b, before, lift(ARMS_STONE));
    expect(state.player.stones?.carry).toBe(ARMS_STONE);
    expect(bagStones(state)).toBe(0);
    expect(loadWeight(b, state)).toBe(loadWeight(b, before) + arms.weight);
    expect(lyingAt(b, state, [3, 1]).count).toBe(0);
  });

  test('the size must match what lies there', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, kind: ARMS_STONE }] });
    expect(refused(b, standing(b, [3, 1]), lift(STONE_ITEM)(standing(b, [3, 1])))).toBe('There is no small stone here.');
    expect(refused(b, standing(b, [4, 1]), lift(ARMS_STONE)(standing(b, [4, 1])))).toBe('There is no large stone here.');
  });

  test('strength: a figure with no might cannot lift a large stone, one with a point of might can', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, kind: ARMS_STONE }] });
    const elf = standing(b, [3, 1], 'core/elf');
    expect(elf.player.attrs.might).toBe(0);
    expect(refused(b, elf, lift(ARMS_STONE)(elf))).toBe('That stone is too heavy for you.');
    const human = standing(b, [3, 1], 'core/human');
    expect(human.player.attrs.might).toBe(1);
    expect(run(b, human, lift(ARMS_STONE)).state.player.stones?.carry).toBe(ARMS_STONE);
    // the same elf with a point of might spent can
    const trained = { ...elf, player: { ...elf.player, attrs: { ...elf.player.attrs, might: 1 } } };
    expect(run(b, trained, lift(ARMS_STONE)).state.player.stones?.carry).toBe(ARMS_STONE);
  });

  test('a load already carried counts: a full bag leaves no room for a large stone', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, kind: ARMS_STONE }] });
    const human = standing(b, [3, 1]);
    const loaded = { ...human, player: { ...human.player, bag: { 'core/stone': 5 } } };
    expect(loadWeight(b, loaded) + arms.weight).toBeGreaterThan(loadMax(b, loaded));
    expect(refused(b, loaded, lift(ARMS_STONE)(loaded))).toBe('That stone is too heavy for you.');
  });

  test('a stone cannot be lifted while both hands hold one, nor during a fight', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, kind: ARMS_STONE }] });
    const held = run(b, standing(b, [3, 1]), lift(ARMS_STONE)).state;
    expect(refused(b, held, lift(ARMS_STONE)(held))).toBe('Both hands hold the stone. Set it down first.');
    const fighting = { ...standing(b, [3, 1]), player: { ...standing(b, [3, 1]).player, fight: { since: 0 } } };
    expect(refused(b, fighting, lift(ARMS_STONE)(fighting))).toBe('Not during a fight.');
  });
});

describe('carrying', () => {
  test('a large stone slows the walk: the load decides the pace, as for any carried weight', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, kind: ARMS_STONE }] });
    const free = standing(b, [3, 1]);
    const held = run(b, free, lift(ARMS_STONE)).state;
    expect(walkStepMs(b, held)).toBeGreaterThan(walkStepMs(b, free));
    expect(loadBand(b, held)).not.toBe('light');
    // the walking pace the position reports are checked against follows
    expect(gaitStepMs(b, held, 'walk')).toBe(walkStepMs(b, held));
  });

  test('hands are full: the only things done are walking, setting down and throwing', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, kind: ARMS_STONE }] });
    const held = run(b, standing(b, [3, 1]), lift(ARMS_STONE)).state;
    expect(refused(b, held, { t: 'eat', item: 'core/bread' })).toBe('Both hands hold the stone. Set it down first.');
    expect(refused(b, held, { t: 'jump', at: [4, 1] })).toBe('Both hands hold the stone. Set it down first.');
    expect(refused(b, held, { t: 'drop', item: STONE_ITEM, qty: 1, at: [3, 1] })).toBe('Both hands hold the stone. Set it down first.');
    expect(refused(b, held, { t: 'move', at: [4, 1], gait: 'run' })).toBe('You cannot run with a stone over your head.');
    const walked = step(b, held, { t: 'move', at: [4, 1] }, Math.max(held.tick, 60_000) + 20_000);
    expect(walked.ok).toBe(true);
  });

  test('setting it down puts it on the tile, counted, and frees the hands', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, kind: ARMS_STONE }] });
    const held = run(b, standing(b, [3, 1]), lift(ARMS_STONE)).state;
    const { state, events } = run(b, { ...held, player: { ...held.player, at: [5, 1] } }, setdown);
    expect(state.player.stones?.carry).toBeUndefined();
    expect(lyingAt(b, state, [5, 1])).toMatchObject({ placed: { [ARMS_STONE]: 1 }, count: 1 });
    expect(events.find((e) => e.e === 'setdown')).toMatchObject({ at: [5, 1], count: 1 });
    expect(loadWeight(b, state)).toBe(0);
    expect(refused(b, state, setdown(state))).toBe('You are not holding a stone.');
  });
});

describe('the throw', () => {
  test('a small stone flies its range, touches, runs on, and lies where it stops', () => {
    const b = world({ ground: FIELD, spots: [{ x: 1, y: 1, kind: STONE_ITEM }] });
    const lifted = run(b, standing(b, [1, 1]), lift(STONE_ITEM)).state;
    const r = run(b, lifted, throwTo([12, 1]));
    const thrown = r.events.find((e) => e.e === 'stone_thrown');
    expect(thrown).toMatchObject({ kind: STONE_ITEM, from: [1, 1], touch: [1 + hand.throw_range, 1], at: [1 + hand.throw_range + hand.roll, 1], ms: S.throw_ms });
    expect(bagStones(r.state)).toBe(0);
    expect(lyingAt(b, r.state, [1 + hand.throw_range + hand.roll, 1]).placed[STONE_ITEM]).toBe(1);
  });

  test('a large stone flies shorter and runs on less', () => {
    const b = world({ ground: FIELD, spots: [{ x: 1, y: 1, kind: ARMS_STONE }] });
    const held = run(b, standing(b, [1, 1]), lift(ARMS_STONE)).state;
    const r = run(b, held, throwTo([12, 1]));
    expect(r.events.find((e) => e.e === 'stone_thrown')).toMatchObject({ kind: ARMS_STONE, touch: [1 + arms.throw_range, 1], at: [1 + arms.throw_range + arms.roll, 1] });
    expect(arms.throw_range).toBeLessThan(hand.throw_range);
    expect(r.state.player.stones?.carry).toBeUndefined();
    expect(lyingAt(b, r.state, [1 + arms.throw_range + arms.roll, 1]).placed[ARMS_STONE]).toBe(1);
  });

  test('the direction is the aim\'s, and a diagonal reaches by the straight-line distance', () => {
    const b = world({ ground: ['..........', '..........', '..........', '..........', '..........', '..........', '..........'], spots: [] });
    const s = standing(b, [1, 1]);
    const west = standing(b, [8, 3]);
    const f = (st: State, aim: Tile) => throwFlight(b, st, STONE_ITEM, aim) as Exclude<ReturnType<typeof throwFlight>, { error: string }>;
    expect(f(west, [0, 3]).touch).toEqual([8 - hand.throw_range, 3]);
    const diag = f(s, [6, 6]);
    expect(diag.air.length).toBeGreaterThan(0);
    for (const t of diag.air) expect((t[0] - 1) ** 2 + (t[1] - 1) ** 2).toBeLessThanOrEqual(hand.throw_range ** 2);
    // every tile of the air lies on the line toward the aim
    expect(diag.air.every((t) => t[0] - 1 === t[1] - 1)).toBe(true);
    expect(throwFlight(b, s, STONE_ITEM, [1, 1])).toEqual({ error: 'Aim away from your own feet.' });
  });

  test('a wall stops it short: it drops in front of the wall and does not run on', () => {
    const b = world({ ground: ['....T.....', '....T.....'], spots: [] });
    const s = standing(b, [1, 0]);
    const f = throwFlight(b, s, STONE_ITEM, [9, 0]);
    if ('error' in f) throw new Error(f.error);
    expect(f.blocked).toBe(true);
    expect(f.touch).toEqual([3, 0]);
    expect(f.rest).toEqual([3, 0]);
    expect(f.roll).toEqual([]);
  });

  test('a stone that comes down on water sinks, and one that runs to the bank stops there', () => {
    // water from x = 4: a throw of 3 from x = 1 touches the water
    const sink = world({ ground: ['....~~~~~~'], spots: [] });
    const f = throwFlight(sink, standing(sink, [0, 0]), STONE_ITEM, [9, 0]);
    if ('error' in f) throw new Error(f.error);
    expect(f.sank).toBe(false);
    // from x = 1 the touch is x = 4, in the water
    const g = throwFlight(sink, standing(sink, [1, 0]), STONE_ITEM, [9, 0]);
    if ('error' in g) throw new Error(g.error);
    expect(g.sank).toBe(true);
    expect(g.rest).toBeUndefined();
    // a roll stops at the bank
    const bank = world({ ground: ['......~~~~'], spots: [] });
    const h = throwFlight(bank, standing(bank, [2, 0]), STONE_ITEM, [9, 0]);
    if ('error' in h) throw new Error(h.error);
    expect(h.touch).toEqual([2 + hand.throw_range, 0]);
    expect(h.rest![0]).toBeLessThan(6);
  });

  test('a sunk stone leaves the world and goes home after the return time', () => {
    const b = world({ ground: ['....~~~~~~'], spots: [{ x: 2, y: 0, kind: STONE_ITEM }] });
    const lifted = run(b, standing(b, [2, 0]), lift(STONE_ITEM)).state;
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
    const f = throwFlight(up, standing(up, [1, 0]), STONE_ITEM, [8, 0]);
    if ('error' in f) throw new Error(f.error);
    expect(f.touch).toEqual([1 + hand.throw_range, 0]);
    // the step at x = 5 climbs: the roll ends on the tile before it
    expect(f.rest).toEqual([4, 0]);
    const down = world({ ground: ['.........'], levels: ['111110000'], spots: [] });
    const g = throwFlight(down, standing(down, [1, 0]), STONE_ITEM, [8, 0]);
    if ('error' in g) throw new Error(g.error);
    expect(g.rest).toEqual([1 + hand.throw_range + hand.roll, 0]);
  });

  test('the power rides the throw: a full throw is the default, a half throw flies half as far', () => {
    const b = world({ ground: ['..................'], spots: [], liftables: { [STONE_ITEM]: { ...hand, throw_range: 6, roll: 2 } } });
    const s = standing(b, [1, 0]);
    const full = throwFlight(b, s, STONE_ITEM, [17, 0]);
    const half = throwFlight(b, s, STONE_ITEM, [17, 0], 500);
    const dflt = throwFlight(b, s, STONE_ITEM, [17, 0], 1000);
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
    const rest: Tile = [1 + hand.throw_range + hand.roll, 1];
    expect(lyingAt(b, r.state, rest).placed[STONE_ITEM]).toBe(1);
    expect(lyingAt(b, settled(b, r.state, r.state.tick + S.return_ms), rest).count).toBe(0);
  });
});

describe('the charged throw (DECISIONS 2026-11-22)', () => {
  test('the charge curve: a tap gives the minimum, holding charges evenly to full, and the hold limit stays at full', () => {
    const b = base;
    // a tap is the minimum; it never goes below it, and it never passes full
    expect(chargePower(b, 0)).toBe(S.throw_min_power);
    const mid = chargePower(b, Math.floor(S.throw_charge_ms / 2));
    expect(mid).toBeGreaterThan(S.throw_min_power);
    expect(mid).toBeLessThan(FULL_POWER);
    expect(chargePower(b, S.throw_charge_ms)).toBe(FULL_POWER);
    // past full the power stays full, and the hold limit releases at full: a charge cannot be held for ever
    expect(throwHoldLimit(b)).toBe(S.throw_charge_ms + S.throw_hold_ms);
    expect(chargePower(b, throwHoldLimit(b))).toBe(FULL_POWER);
    expect(chargePower(b, throwHoldLimit(b) + 1000)).toBe(FULL_POWER);
    // monotone and bounded across the whole hold
    let last = S.throw_min_power - 1;
    for (let t = 0; t <= throwHoldLimit(b); t += 11) {
      const p = chargePower(b, t);
      expect(p).toBeGreaterThanOrEqual(S.throw_min_power);
      expect(p).toBeLessThanOrEqual(FULL_POWER);
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
  });

  test('the range grows with the power and is capped at full', () => {
    const b = world({ ground: ['..................'], spots: [] });
    const touchAt = (power: number) => {
      const f = throwFlight(b, standing(b, [1, 0]), STONE_ITEM, [17, 0], power);
      if ('error' in f) throw new Error(f.error);
      return f.touch[0] - f.from[0];
    };
    const min = touchAt(S.throw_min_power);
    const full = touchAt(FULL_POWER);
    expect(min).toBeGreaterThan(0);
    expect(min).toBeLessThan(full);
    expect(full).toBe(hand.throw_range);
    // the cap: a power over full is not a flight (the action refuses it), so full is the longest range
    expect(full).toBeGreaterThanOrEqual(min);
  });

  test('a power out of bounds is refused: below the minimum and above full', () => {
    const b = world({ ground: FIELD });
    const s = standing(b, [1, 1]);
    expect(refused(b, s, { t: 'throw', at: [1, 1], aim: [5, 1], power: S.throw_min_power - 1 })).toBe('That is not a throw.');
    expect(refused(b, s, { t: 'throw', at: [1, 1], aim: [5, 1], power: 0 })).toBe('That is not a throw.');
    expect(refused(b, s, { t: 'throw', at: [1, 1], aim: [5, 1], power: FULL_POWER + 1 })).toBe('That is not a throw.');
  });

  test('the minimum itself throws: a tap is a throw, not a refusal', () => {
    const b = world({ ground: FIELD });
    const withStone = { ...standing(b, [1, 1]), player: { ...standing(b, [1, 1]).player, bag: { [STONE_ITEM]: 1 } } };
    const r = run(b, withStone, throwTo([9, 1], S.throw_min_power));
    expect(r.events.find((e) => e.e === 'stone_thrown')).toMatchObject({ kind: STONE_ITEM });
  });

  test('the same charge and power give the same flight, every time (determinism)', () => {
    const b = world({ ground: ['..................'], spots: [] });
    const held = Math.floor(S.throw_charge_ms / 3);
    const power = chargePower(b, held);
    const a = throwFlight(b, standing(b, [1, 0]), STONE_ITEM, [17, 0], power);
    const c = throwFlight(b, standing(b, [1, 0]), STONE_ITEM, [17, 0], chargePower(b, held));
    expect(a).toEqual(c);
  });
});

describe('the return', () => {
  const spotWorld = () => world({ ground: FIELD, spots: [{ x: 1, y: 1, kind: STONE_ITEM }] });

  test('a thrown stone lies where it landed until the return time, then it is back at its own spot', () => {
    const b = spotWorld();
    const lifted = run(b, standing(b, [1, 1]), lift(STONE_ITEM)).state;
    const thrown = run(b, lifted, throwTo([12, 1])).state;
    const rest: Tile = [1 + hand.throw_range + hand.roll, 1];
    const t0 = thrown.tick;
    // just before: still lying where it landed, the spot still empty
    const early = settled(b, thrown, t0 + S.return_ms - 1);
    expect(lyingAt(b, early, rest).placed[STONE_ITEM]).toBe(1);
    expect(lyingAt(b, early, [1, 1]).count).toBe(0);
    // at the time: gone from the tile, back at the spot
    const late = settled(b, thrown, t0 + S.return_ms);
    expect(lyingAt(b, late, rest).count).toBe(0);
    expect(lyingAt(b, late, [1, 1])).toMatchObject({ spot: STONE_ITEM, count: 1 });
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
      s = run(b, s, lift(STONE_ITEM)).state;
      expect(bagStones(s)).toBe(1);
      s = run(b, s, throwTo([12, 1])).state;
      const home = settled(b, s, s.tick + S.return_ms);
      expect(bagStones(home) + lyingAt(b, home, [1, 1]).count).toBe(1);
      s = { ...home, player: { ...home.player, at: [1, 1] }, tick: s.tick + S.return_ms };
    }
  });

  test('a stone picked up again before its time no longer goes home on its own', () => {
    const b = spotWorld();
    const lifted = run(b, standing(b, [1, 1]), lift(STONE_ITEM)).state;
    const thrown = run(b, lifted, throwTo([12, 1])).state;
    const rest: Tile = [1 + hand.throw_range + hand.roll, 1];
    const back = run(b, { ...thrown, player: { ...thrown.player, at: rest } }, lift(STONE_ITEM)).state;
    expect(bagStones(back)).toBe(1);
    expect(back.player.stones?.returns).toEqual([]);
    const later = settled(b, back, back.tick + 10 * S.return_ms);
    expect(bagStones(later)).toBe(1);
    expect(lyingAt(b, later, [1, 1]).count).toBe(0);
  });

  test('a large stone goes home the same way', () => {
    const b = world({ ground: FIELD, spots: [{ x: 1, y: 1, kind: ARMS_STONE }] });
    const held = run(b, standing(b, [1, 1]), lift(ARMS_STONE)).state;
    const thrown = run(b, held, throwTo([12, 1])).state;
    const rest: Tile = [1 + arms.throw_range + arms.roll, 1];
    expect(lyingAt(b, thrown, rest).placed[ARMS_STONE]).toBe(1);
    const late = settled(b, thrown, thrown.tick + S.return_ms);
    expect(lyingAt(b, late, rest).count).toBe(0);
    expect(lyingAt(b, late, [1, 1])).toMatchObject({ spot: ARMS_STONE, count: 1 });
  });

  test('a stone goes to a spot of its own size', () => {
    const b = world({ ground: FIELD, spots: [{ x: 1, y: 1, kind: ARMS_STONE }, { x: 2, y: 2, kind: STONE_ITEM }] });
    const s1 = run(b, standing(b, [2, 2]), lift(STONE_ITEM)).state;
    const s2 = run(b, { ...s1, player: { ...s1.player, at: [1, 1] } }, lift(ARMS_STONE)).state;
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
    expect(lyingAt(b, piled, [2, 1])).toMatchObject({ placed: { [STONE_ITEM]: 4 }, count: 4 });
    expect(bagStones(piled)).toBe(1);
    // one taken, then two: the pile shrinks by the number taken
    const apart = run(b, piled, pickup(1), pickup(2)).state;
    expect(lyingAt(b, apart, [2, 1]).placed[STONE_ITEM]).toBe(1);
    expect(bagStones(apart)).toBe(4);
    // `lift` takes from a pile the same way
    const lifted = run(b, piled, lift(STONE_ITEM, 3)).state;
    expect(lyingAt(b, lifted, [2, 1]).placed[STONE_ITEM]).toBe(1);
    expect(bagStones(lifted)).toBe(4);
  });

  test('a pile is rearranged: stones taken from one tile are set down on another', () => {
    const b = world({ ground: FIELD, spots: [] });
    const s = { ...standing(b, [2, 1]), player: { ...standing(b, [2, 1]).player, bag: { [STONE_ITEM]: 3 } } };
    const piled = run(b, s, drop(3)).state;
    const moved = run(b, piled, pickup(2), () => ({ t: 'move', at: [3, 1] }) as Action, drop(2)).state;
    expect(lyingAt(b, moved, [2, 1]).placed[STONE_ITEM]).toBe(1);
    expect(lyingAt(b, moved, [3, 1]).placed[STONE_ITEM]).toBe(2);
  });

  test('a pile never blocks: the walk map is the same with it, a figure walks across it, and a stone is no prop', () => {
    const b = world({ ground: FIELD, spots: [{ x: 3, y: 1, kind: STONE_ITEM }] });
    const walkable = walkableFor(b);
    const view = standing(b, [0, 1]).player;
    const before = FIELD.flatMap((row, y) => [...row].map((_, x) => walkable(x, y, view)));
    const s = { ...standing(b, [2, 1]), player: { ...standing(b, [2, 1]).player, bag: { [STONE_ITEM]: 4 } } };
    const piled = run(b, s, drop(4)).state;
    expect(lyingAt(b, piled, [2, 1]).count).toBe(4);
    const after = FIELD.flatMap((row, y) => [...row].map((_, x) => walkable(x, y, piled.player)));
    expect(after).toEqual(before);
    // walk over the pile and the spot
    const r = run(b, { ...piled, player: { ...piled.player, at: [1, 1] } }, () => ({ t: 'move', at: [2, 1] }) as Action, () => ({ t: 'move', at: [3, 1] }) as Action, () => ({ t: 'move', at: [4, 1] }) as Action);
    expect(r.state.player.at).toEqual([4, 1]);
  });

  test('a pile holds at most pile_max, checked on adding', () => {
    const b = world({ ground: FIELD, spots: [], params: { pile_max: 3, area_cap: 8 }, liftables: { [STONE_ITEM]: { ...hand, throw_range: 2, roll: 0 } } });
    const s = { ...standing(b, [2, 1]), player: { ...standing(b, [2, 1]).player, bag: { [STONE_ITEM]: 6 } } };
    const three = run(b, s, drop(3)).state;
    expect(refused(b, three, drop(1)(three))).toBe('The stones are piled as high as they stay.');
    // a thrown stone that would land on a full pile is refused, not lost: from two tiles west it lands on the pile
    const west = { ...three, player: { ...three.player, at: [0, 1] as Tile } };
    expect(refused(b, west, throwTo([9, 1])(west))).toBe('The stones are piled as high as they stay.');
    expect(bagStones(west)).toBe(3);
  });

  test('an area holds at most area_cap loose stones: spots, set-down stones and thrown ones count together', () => {
    const b = world({ ground: ['.......', '.......'], spots: [{ x: 5, y: 0, kind: STONE_ITEM }, { x: 6, y: 0, kind: STONE_ITEM }], params: { area_tiles: 16, area_cap: 4, pile_max: 4 } });
    const s = { ...standing(b, [1, 1]), player: { ...standing(b, [1, 1]).player, bag: { [STONE_ITEM]: 5 } } };
    expect(looseInArea(b, s, '0,0')).toBe(2);
    const two = run(b, s, drop(2)).state;
    expect(looseInArea(b, two, '0,0')).toBe(4);
    expect(refused(b, two, drop(1)(two))).toBe('Enough stones lie around here already.');
    expect(refused(b, two, throwTo([5, 1])(two))).toBe('Enough stones lie around here already.');
    // taking one from its spot makes room again where it lies: the count moves, it does not grow
    const moved = run(b, { ...two, player: { ...two.player, at: [5, 0] } }, lift(STONE_ITEM)).state;
    expect(looseInArea(b, moved, '0,0')).toBe(3);
  });

  test('the cap is checked on adding only: a state already over it still loads and can be emptied', () => {
    const b = world({ ground: FIELD, spots: [], params: { area_cap: 4, pile_max: 4 } });
    const s = standing(b, [2, 1]);
    const over: State = { ...s, player: { ...s.player, ground: { '2,1': { [STONE_ITEM]: 4 }, '3,1': { [STONE_ITEM]: 4 } } } };
    expect(looseInArea(b, over, '0,0')).toBe(8);
    const emptied = run(b, over, pickup(3)).state;
    expect(lyingAt(b, emptied, [2, 1]).placed[STONE_ITEM]).toBe(1);
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
    const b = pitWorld([{ x: 1, y: 1, kind: ARMS_STONE }]);
    const held = run(b, standing(b, [1, 1]), lift(ARMS_STONE)).state;
    expect(held.player.stones?.carry).toBe(ARMS_STONE);
    const r = step(b, { ...held, tick: NIGHT, player: { ...held.player, movedAt: NIGHT, busyUntil: 0 } }, { t: 'move', at: [2, 1] }, NIGHT + 1000);
    if (!r.ok) throw new Error(r.error);
    expect(r.events.some((e) => e.e === 'fall')).toBe(true);
    expect(r.state.player.stones?.carry).toBeUndefined();
    expect(lyingAt(b, r.state, [1, 1]).count).toBe(0);
    expect(lyingAt(b, settled(b, r.state, r.state.tick + S.return_ms), [1, 1])).toMatchObject({ spot: ARMS_STONE, count: 1 });
  });

  test('the stones an outing gave lie in the pack, and go back to their spots when the pack is gone', () => {
    const b = pitWorld([{ x: 1, y: 1, kind: STONE_ITEM }]);
    const start = standing(b, [1, 1]);
    // out on the ground that is not safe, so the outing keeps an account of what it gave
    const lifted = run(b, { ...start, player: { ...start.player, outing: { gained: {}, solved: [], visited: [] } as State['player']['outing'] } }, lift(STONE_ITEM)).state;
    expect(bagStones(lifted)).toBe(1);
    const r = step(b, { ...lifted, tick: NIGHT, player: { ...lifted.player, movedAt: NIGHT, busyUntil: 0 } }, { t: 'move', at: [2, 1] }, NIGHT + 1000);
    if (!r.ok) throw new Error(r.error);
    expect(r.events.some((e) => e.e === 'fall')).toBe(true);
    expect(bagStones(r.state)).toBe(0);
    // the stone lies in the pack where the body fell (G81), so its spot stays empty while the pack lies
    expect(r.state.player.packs).toMatchObject([{ items: { [STONE_ITEM]: 1 }, at: [2, 1] }]);
    const until = r.state.player.packs![0]!.until;
    expect(lyingAt(b, settled(b, r.state, until - 1), [1, 1]).count).toBe(0);
    // the day over, the next step sends it home from that tick, to the spot it was lifted from
    const later = step(b, r.state, { t: 'move', at: [0, 1] }, until + 10);
    if (!later.ok) throw new Error(later.error);
    expect(later.state.player.packs).toBeUndefined();
    expect(lyingAt(b, settled(b, later.state, until + S.return_ms), [1, 1]).count).toBe(1);
  });
});

describe('replay', () => {
  test('a log of lifts, throws and set-downs replays to the same state, byte for byte', () => {
    const b = world({ ground: FIELD, spots: [{ x: 1, y: 1, kind: STONE_ITEM }, { x: 2, y: 1, kind: ARMS_STONE }, { x: 3, y: 1, kind: STONE_ITEM }] });
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
    go(lift(STONE_ITEM));
    go(throwTo([12, 1]));
    go(() => ({ t: 'move', at: [2, 1] }) as Action);
    go(lift(ARMS_STONE));
    go(() => ({ t: 'move', at: [3, 1] }) as Action);
    go(setdown);
    go(lift(STONE_ITEM));
    go(drop(1));
    go(pickup(1));
    const again = replay(b, start, log);
    expect(again.error).toBeUndefined();
    expect(canonical(again.state)).toBe(canonical(state));
    // and a third time, from a structured copy of the start
    expect(canonical(replay(b, structuredClone(start), log).state)).toBe(canonical(state));
  });
});

describe('liftable entries', () => {
  const log = 'test/log';
  const sled = 'test/sled';
  const post = 'test/post';
  const b = world({
    ground: FIELD,
    spots: [{ x: 1, y: 1, kind: log }, { x: 6, y: 1, kind: sled }, { x: 9, y: 1, kind: post }],
    liftables: {
      [log]: { ...arms, name: 'log', weight: 40, throw_range: 1, roll: 0 },
      [sled]: { ...arms, name: 'sled', class: 'push', throw_range: 0, roll: 0 },
      [post]: { ...arms, name: 'post', class: 'fixed', throw_range: 0, roll: 0 },
    },
  });

  test('a new arms entry lifts, walks at its load pace, uses its own range and can be set down', () => {
    const start = standing(b, [1, 1]);
    start.player.bag[STONE_ITEM] = 1;
    const held = run(b, start, lift(log)).state;
    expect(held.player.stones?.carry).toBe(log);
    expect(loadWeight(b, held) - loadWeight(b, start)).toBe(40);
    expect(loadBand(b, start)).toBe('light');
    expect(loadBand(b, held)).toBe('heavy');
    expect(walkStepMs(b, held)).toBe(b.params.load.heavy_step_ms);
    const moved = run(b, held, () => ({ t: 'move', at: [2, 1] })).state;
    expect(moved.player.at).toEqual([2, 1]);
    const thrown = run(b, moved, throwTo([12, 1]));
    expect(thrown.events).toContainEqual({ e: 'stone_thrown', kind: log, from: [2, 1], touch: [3, 1], at: [3, 1], ms: S.throw_ms });
    expect(thrown.state.player.stones?.carry).toBeUndefined();
    const down = run(b, thrown.state, () => ({ t: 'move', at: [3, 1] }), lift(log), () => ({ t: 'move', at: [4, 1] }), setdown);
    expect(down.state.player.stones?.carry).toBeUndefined();
    expect(lyingAt(b, down.state, [4, 1]).placed[log]).toBe(1);
    expect(lyingAt(b, down.state, [3, 1]).count).toBe(0);
    expect(down.state.player.stones?.returns).toEqual([]);
  });

  test('push moves along the ground, but cannot be lifted or thrown', () => {
    const beside = standing(b, [5, 1]);
    const onSpot = standing(b, [6, 1]);
    expect(refused(b, onSpot, lift(sled)(onSpot))).toBe('That cannot be lifted.');
    expect(throwFlight(b, onSpot, sled, [12, 1])).toEqual({ error: 'That cannot be thrown.' });
    const pushed = run(b, beside, (s) => ({ t: 'push', kind: sled, at: at(s), target: [6, 1] }));
    expect(pushed.state.player.at).toEqual([5, 1]);
    expect(lyingAt(b, pushed.state, [6, 1]).count).toBe(0);
    expect(lyingAt(b, pushed.state, [7, 1]).placed[sled]).toBe(1);
  });

  test('fixed refuses lift, throw, set-down, and push', () => {
    const onSpot = standing(b, [9, 1]);
    const beside = standing(b, [8, 1]);
    expect(refused(b, onSpot, lift(post)(onSpot))).toBe('That cannot be lifted.');
    expect(refused(b, onSpot, { t: 'throw', kind: post, at: at(onSpot), aim: [12, 1] })).toBe('You have no stone to throw.');
    expect(throwFlight(b, onSpot, post, [12, 1])).toEqual({ error: 'That cannot be thrown.' });
    expect(refused(b, onSpot, setdown(onSpot))).toBe('You are not holding a stone.');
    expect(refused(b, beside, { t: 'push', kind: post, at: at(beside), target: [9, 1] })).toBe('That cannot be pushed.');
    expect(lyingAt(b, onSpot, [9, 1]).spot).toBe(post);
  });
});

test('a 0.36 save with drops, both return sizes, and both hands occupied plays like the new shape', () => {
  const b = world({
    ground: FIELD,
    spots: [
      { x: 1, y: 1, kind: STONE_ITEM },
      { x: 2, y: 1, kind: ARMS_STONE },
      { x: 3, y: 1, kind: ARMS_STONE },
      { x: 4, y: 1, kind: ARMS_STONE },
    ],
  });
  const start = adaptState(b, standing(b, [4, 1]))!;
  const taken = { 0: true, 1: true, 2: true, 3: true } as const;
  start.player.ground = { '7,1': { [STONE_ITEM]: 2 } };
  start.player.stones = {
    taken,
    placed: { '6,1': { [ARMS_STONE]: 1 }, '8,1': { [ARMS_STONE]: 2 } },
    returns: [
      { key: '7,1', kind: STONE_ITEM, at: 61_000 },
      { key: '6,1', kind: ARMS_STONE, at: 62_000 },
      { key: '', kind: ARMS_STONE, at: 90_000 },
    ],
    carry: ARMS_STONE,
  };
  const old = JSON.parse(JSON.stringify({
    ...start,
    kernel: '0.36.0',
    content: 'before-liftables',
    player: {
      ...start.player,
      stones: {
        taken,
        large: { '6,1': 1, '8,1': 2 },
        returns: [
          { key: '7,1', size: 'small', at: 61_000 },
          { key: '6,1', size: 'large', at: 62_000 },
          { key: '', size: 'large', at: 90_000 },
        ],
        carry: 'large',
      },
    },
  })) as State;
  const loaded = adaptState(b, old)!;
  const actual = run(b, loaded, setdown).state;
  expect(actual).toEqual(run(b, start, setdown).state);
  expect(migrateState(old).player.stones).toEqual(start.player.stones);
  expect(lyingAt(b, actual, [1, 1]).spot).toBe(STONE_ITEM);
  expect(lyingAt(b, actual, [2, 1]).spot).toBe(ARMS_STONE);
  expect(lyingAt(b, actual, [4, 1]).placed[ARMS_STONE]).toBe(1);
  expect(lyingAt(b, actual, [7, 1]).placed[STONE_ITEM]).toBe(1);
  expect(lyingAt(b, actual, [8, 1]).placed[ARMS_STONE]).toBe(2);
});


test('a recorded lift from before entry ids replays as the same action', () => {
  const b = world({ ground: FIELD, spots: [{ x: 1, y: 1, kind: ARMS_STONE }] });
  const start = standing(b, [1, 1]);
  const recorded = JSON.parse('{"t":"lift","size":"large","at":[1,1]}') as Action;
  expect(step(b, start, recorded, 70_000)).toEqual(step(b, start, lift(ARMS_STONE)(start), 70_000));
});
