/** Tending (NEXT 13a): wood is fed by hand, a burn is uninterrupted, and a vigil lasts dusk to dawn. */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Action,
  type Bundle,
  type GameEvent,
  type State,
  type Tile,
  burnsAsWood,
  fireBurns,
  newState,
  nextLogAt,
  questSatisfied,
  replay,
  serialize,
  step,
  tendHolds,
} from '@game/kernel';
import { loadBundle } from '../../tools/test/helpers/world.js';

type Prop = Bundle['map']['props'][number];

const FIRE = 'test/hearth';
const QUEST = 'test/vigil';
const WOOD = 'core/log';
const STONE = 'core/stone';
const KINDLING = 'test/kindling';
const AT: Tile = [7, 8];
const DUSK = 400_000;
const DAWN = 850_000;

let base: Bundle;

beforeAll(() => {
  base = loadBundle();
});

function world(): Bundle {
  const b = structuredClone(base);
  const fire: Prop = {
    id: FIRE,
    sprite: 'core/base-kit:props/standing_stone',
    x: 8,
    y: 8,
    w: 1,
    h: 1,
    solid: true,
    fire: true,
  };
  b.map.props = [...b.map.props, fire];
  b.classes[KINDLING] = { id: KINDLING, name: 'Kindling', base: 'wood', creator: 'test', file: 'test' };
  b.items[KINDLING] = { ...b.items[WOOD]!, id: KINDLING, class: KINDLING };
  b.quests[QUEST] = {
    ...b.quests['core/a-coin-for-maru']!,
    id: QUEST,
    steps: [{ kind: 'tend', fire: FIRE }],
  };
  return b;
}

function begin(b: Bundle, bag: Record<string, number> = {}): State {
  const result = step(b, newState(b, 7), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
  if (!result.ok) throw new Error(result.error);
  const state = structuredClone(result.state);
  state.player.at = [...AT];
  state.player.movedAt = 0;
  state.player.attrs.carry = 100;
  Object.assign(state.player.bag, bag);
  return state;
}

function feed(b: Bundle, state: State, tick: number, item = WOOD): { state: State; events: GameEvent[] } {
  const result = step(b, state, { t: 'feed', fire: FIRE, item, at: AT }, tick);
  if (!result.ok) throw new Error(result.error);
  return result;
}

function fedAt(b: Bundle, ticks: readonly number[]): State {
  let state = begin(b, { [WOOD]: ticks.length });
  for (const tick of ticks) state = feed(b, state, tick).state;
  return state;
}

describe('feeding a fire', () => {
  test('the first log lights it and leaves the bag; a second tops it up', () => {
    const b = world();
    const first = feed(b, begin(b, { [WOOD]: 2 }), 10);
    expect(first.state.player.fires[FIRE]).toEqual({ lit: 10, until: 10 + b.params.fire.log_ms });
    expect(first.state.player.bag[WOOD]).toBe(1);
    expect(first.events).toEqual([
      { e: 'spend', item: WOOD, qty: 1 },
      { e: 'fire', id: FIRE, until: 10 + b.params.fire.log_ms },
    ]);

    const second = feed(b, first.state, 20);
    expect(second.state.player.fires[FIRE]).toEqual({ lit: 10, until: 10 + 2 * b.params.fire.log_ms });
    expect(second.state.player.bag[WOOD]).toBeUndefined();
  });

  test('a fire at the cap refuses another log and leaves it in the bag', () => {
    const b = world();
    let state = begin(b, { [WOOD]: b.params.fire.cap + 1 });
    for (let i = 0; i < b.params.fire.cap; i++) state = feed(b, state, 0).state;
    expect(state.player.fires[FIRE]?.until).toBe(b.params.fire.cap * b.params.fire.log_ms);

    const full = step(b, state, { t: 'feed', fire: FIRE, item: WOOD, at: AT }, 0);
    expect(full).toEqual({ ok: false, error: 'The fire is already full.' });
    expect(state.player.bag[WOOD]).toBe(1);
  });

  test('a log that would not burn whole is refused, and goes in once a log has burned down', () => {
    const b = world();
    const { cap, log_ms } = b.params.fire;
    let state = begin(b, { [WOOD]: cap + 1 });
    for (let i = 0; i < cap; i++) state = feed(b, state, 0).state;
    // a tick, or all but a tick of a log, after the cap: less than a log's room, so the log stays
    for (const tick of [1, log_ms - 1]) {
      expect(nextLogAt(b, state, FIRE, tick)).toBe(log_ms);
      const early = step(b, state, { t: 'feed', fire: FIRE, item: WOOD, at: AT }, tick);
      expect(early).toEqual({ ok: false, error: 'The fire is already full.' });
    }
    expect(state.player.bag[WOOD]).toBe(1);
    expect(state.player.fires[FIRE]).toEqual({ lit: 0, until: cap * log_ms });

    const fed = feed(b, state, log_ms);
    expect(fed.state.player.fires[FIRE]).toEqual({ lit: 0, until: (cap + 1) * log_ms });
    expect(fed.state.player.bag[WOOD]).toBeUndefined();
  });

  test('the next log fits at once while the fire is out or has room, never before the tick asked', () => {
    const b = world();
    const { cap, log_ms } = b.params.fire;
    const cold = begin(b, { [WOOD]: cap });
    expect(nextLogAt(b, cold, FIRE, 123)).toBe(123);
    let state = feed(b, cold, 0).state;
    expect(nextLogAt(b, state, FIRE, 0)).toBe(0);
    for (let i = 1; i < cap; i++) state = feed(b, state, 0).state;
    expect(nextLogAt(b, state, FIRE, 0)).toBe(log_ms);
    // burnt out, a new burn takes its first log at once
    expect(nextLogAt(b, state, FIRE, cap * log_ms + 5)).toBe(cap * log_ms + 5);
  });

  test('the fire goes out exactly at until and a later feed begins a new burn', () => {
    const b = world();
    const lit = feed(b, begin(b, { [WOOD]: 2 }), 100).state;
    const until = lit.player.fires[FIRE]!.until;
    expect(fireBurns(lit, FIRE, until - 1)).toBe(true);
    expect(fireBurns(lit, FIRE, until)).toBe(false);

    const relit = feed(b, lit, until).state;
    expect(relit.player.fires[FIRE]).toEqual({ lit: until, until: until + b.params.fire.log_ms });
  });

  test('an item of a class declared under wood feeds the fire', () => {
    const b = world();
    const fed = feed(b, begin(b, { [KINDLING]: 1 }), 5, KINDLING);
    expect(fed.state.player.fires[FIRE]).toEqual({ lit: 5, until: 5 + b.params.fire.log_ms });
    expect(fed.state.player.bag[KINDLING]).toBeUndefined();
  });

  test('a non-wood item is refused and stays in the bag', () => {
    const b = world();
    const state = begin(b, { [STONE]: 1 });
    const result = step(b, state, { t: 'feed', fire: FIRE, item: STONE, at: AT }, 0);
    expect(result).toEqual({ ok: false, error: 'That is not wood.' });
    expect(state.player.bag[STONE]).toBe(1);
    expect(state.player.fires).toEqual({});
  });

  test('an unknown fire, a distant player and missing wood each get a plain refusal', () => {
    const b = world();
    const ready = begin(b, { [WOOD]: 1 });
    expect(step(b, ready, { t: 'feed', fire: 'test/missing', item: WOOD, at: AT }, 0)).toEqual({
      ok: false,
      error: 'There is no fire there.',
    });

    const far = structuredClone(ready);
    far.player.at = [5, 8];
    expect(step(b, far, { t: 'feed', fire: FIRE, item: WOOD, at: [5, 8] }, 0)).toEqual({
      ok: false,
      error: 'That is too far away.',
    });

    const empty = begin(b);
    expect(step(b, empty, { t: 'feed', fire: FIRE, item: WOOD, at: AT }, 0)).toEqual({
      ok: false,
      error: 'You do not have any.',
    });
  });

  test('two replays produce the same serialized fire and bag state', () => {
    const b = world();
    const start = begin(b, { [WOOD]: 2 });
    const log: readonly { a: Action; tick: number }[] = [
      { a: { t: 'feed', fire: FIRE, item: WOOD, at: AT }, tick: 10 },
      { a: { t: 'feed', fire: FIRE, item: WOOD, at: AT }, tick: 20 },
    ];
    const one = replay(b, start, log);
    const two = replay(b, start, log);
    expect(one.error).toBeUndefined();
    expect(serialize(one.state)).toBe(serialize(two.state));
  });
});

describe('a dusk-to-dawn vigil', () => {
  test('a fire lit before dusk and fed without a gap through dawn satisfies tend', () => {
    const b = world();
    const state = fedAt(b, [350_000, DUSK, 500_000, 600_000, 700_000]);
    state.tick = DAWN;
    expect(state.player.fires[FIRE]).toEqual({ lit: 350_000, until: DAWN });
    expect(questSatisfied(b, state, QUEST)).toBe(true);
  });

  test('a gap of one tick inside the night fails tend', () => {
    const b = world();
    const state = fedAt(b, [350_000, DUSK, 500_000, 600_000, 750_001]);
    state.tick = DAWN;
    expect(state.player.fires[FIRE]?.lit).toBe(750_001);
    expect(questSatisfied(b, state, QUEST)).toBe(false);
  });

  test('a fire first lit after dusk fails tend even when it lasts past dawn', () => {
    const b = world();
    const state = fedAt(b, [DUSK + 1, 500_000, 600_000, 700_000, 800_000]);
    state.tick = DAWN;
    expect(state.player.fires[FIRE]!.until).toBeGreaterThanOrEqual(DAWN);
    expect(questSatisfied(b, state, QUEST)).toBe(false);
  });
});

describe('the tests the client shares', () => {
  test('burnsAsWood answers as feed does', () => {
    const b = world();
    expect([WOOD, KINDLING, STONE, 'test/nothing'].map((id) => burnsAsWood(b, id))).toEqual([true, true, false, false]);
  });

  test('tendHolds answers as the tend step of questSatisfied, at every tick around a night', () => {
    const b = world();
    const state = begin(b);
    const fires = [undefined, { lit: DUSK - 1, until: DAWN }, { lit: DUSK, until: DAWN + 1 }, { lit: DUSK + 1, until: DAWN }, { lit: DUSK - 1, until: DAWN - 1 }];
    for (const fire of fires) {
      state.player.fires = fire === undefined ? {} : { [FIRE]: fire };
      for (const tick of [DUSK - 1, DUSK, DUSK + 1, DAWN - 1, DAWN, DAWN + 1]) {
        expect(tendHolds(b, state, FIRE, tick)).toBe(questSatisfied(b, { ...state, tick }, QUEST));
      }
    }
  });
});
