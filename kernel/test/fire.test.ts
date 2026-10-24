/**
 * Tending (NEXT 13a): wood is fed by hand, a burn is uninterrupted, and a vigil lasts dusk to dawn,
 * is met only once that dawn has come, and stays met until the next dusk, relit or not
 * (DECISIONS.md, 2026-10-16).
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Action,
  type Bundle,
  type GameEvent,
  type State,
  type Tile,
  burnsAsWood,
  fireBurns,
  makeWalkable,
  near,
  newState,
  nextLogAt,
  npcTile,
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
  state.player.attrs.might = 100;
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

describe('the vigil closes at dawn', () => {
  /** 19:00, 21:00, 23:00 and 04:00 of the first night, and 06:00 the morning after. */
  const H19 = 350_000;
  const H21 = 450_000;
  const H23 = 550_000;
  const H04 = 800_000;
  const H06 = 900_000;
  /** Lit at 19:00 with three logs (to 01:00) and topped up at 23:00 with two: wood to dawn from 23:00 on. */
  const NIGHT: readonly number[] = [H19, H19, H19, H23, H23];
  /** The night the journal lays out: three logs at 19:00, the next at 21:00 and the last at 23:00, wood to exactly 05:00. */
  const JOURNAL: readonly number[] = [H19, H19, H19, H21, H23];
  const nextDusk = (b: Bundle) => DUSK + b.params.day_length_ms;

  /** The vigil open and the player beside its giver (Maru, from the copied quest), ready to hand it in. */
  function atGiver(b: Bundle, state: State): { s: State; at: Tile } {
    const s = structuredClone(state);
    s.player.quests[QUEST] = 'active';
    const giver = b.quests[QUEST]!.giver!;
    const tile = npcTile(b, giver)!;
    const walkable = makeWalkable(b);
    for (let y = tile[1] - 1; y <= tile[1] + 1; y++) {
      for (let x = tile[0] - 1; x <= tile[0] + 1; x++) {
        if ((x !== tile[0] || y !== tile[1]) && walkable(x, y, s.player) && near([x, y], { x: tile[0], y: tile[1], w: 1, h: 1 })) {
          s.player.at = [x, y];
          return { s, at: [x, y] };
        }
      }
    }
    throw new Error(`nowhere to stand beside ${giver}`);
  }

  test('is not met before dawn, however much wood the fire holds', () => {
    const b = world();
    const state = fedAt(b, NIGHT);
    expect(state.player.fires[FIRE]).toEqual({ lit: H19, until: DAWN });
    for (const tick of [H23, H23 + 1, H04, DAWN - 1]) {
      expect(tendHolds(b, state, FIRE, tick)).toBe(false);
      expect(questSatisfied(b, { ...state, tick }, QUEST)).toBe(false);
    }
    // two more logs at 04:00 carry it to 09:00, and the night is still not over
    const wood = structuredClone(state);
    wood.player.bag[WOOD] = 2;
    const fuller = feed(b, feed(b, wood, H04).state, H04).state;
    expect(fuller.player.fires[FIRE]).toEqual({ lit: H19, until: DAWN + 2 * b.params.fire.log_ms });
    expect(tendHolds(b, fuller, FIRE, DAWN - 1)).toBe(false);
    expect(tendHolds(b, fuller, FIRE, DAWN)).toBe(true);
  });

  test('is met at dawn, 05:00, and the giver takes it only from then', () => {
    const b = world();
    const state = fedAt(b, NIGHT);
    expect(tendHolds(b, state, FIRE, DAWN)).toBe(true);
    expect(questSatisfied(b, { ...state, tick: DAWN }, QUEST)).toBe(true);

    const { s, at } = atGiver(b, state);
    const turnin: Action = { t: 'turnin', quest: QUEST, at };
    for (const tick of [H23, DAWN - 1]) expect(step(b, s, turnin, tick)).toEqual({ ok: false, error: 'That task is not finished yet.' });
    const r = step(b, s, turnin, DAWN);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.player.quests[QUEST]).toBe('done');
    expect(r.events).toContainEqual({ e: 'quest', quest: QUEST, state: 'done' });
    expect(r.events.filter((e) => e.e === 'fire_out')).toEqual([]);
  });

  test("the journal's night runs out at dawn untold, and the giver takes it from then", () => {
    const b = world();
    const state = fedAt(b, JOURNAL);
    expect(state.player.fires[FIRE]).toEqual({ lit: H19, until: DAWN });
    const { s, at } = atGiver(b, state);
    const turnin: Action = { t: 'turnin', quest: QUEST, at };
    expect(step(b, s, turnin, DAWN - 1)).toEqual({ ok: false, error: 'That task is not finished yet.' });
    // the wood runs out on the very step that hands it in: a night kept, so no fire_out
    const handed = step(b, s, turnin, DAWN);
    if (!handed.ok) throw new Error(handed.error);
    expect(handed.state.player.quests[QUEST]).toBe('done');
    expect(handed.events.filter((e) => e.e === 'fire_out')).toEqual([]);
    // or a step at dawn tells nothing, and the hand-in an hour later tells no out either
    const dawn = step(b, s, { t: 'move', at }, DAWN);
    if (!dawn.ok) throw new Error(dawn.error);
    expect(dawn.events.filter((e) => e.e === 'fire_out')).toEqual([]);
    const later = step(b, dawn.state, turnin, DAWN + 50_000);
    if (!later.ok) throw new Error(later.error);
    expect(later.state.player.quests[QUEST]).toBe('done');
    expect(later.events.filter((e) => e.e === 'fire_out')).toEqual([]);
  });

  test('a gap at 04:00 fails it, relit or not', () => {
    const b = world();
    // lit at dusk with three logs (to 02:00) and one more at 23:00: out at 04:00
    const out = fedAt(b, [DUSK, DUSK, DUSK, H23]);
    expect(out.player.fires[FIRE]).toEqual({ lit: DUSK, until: H04 });
    const wood = structuredClone(out);
    wood.player.bag[WOOD] = 2;
    const relit = feed(b, feed(b, wood, H04).state, H04).state;
    expect(relit.player.fires[FIRE]).toEqual({ lit: H04, until: H04 + 2 * b.params.fire.log_ms });
    for (const tick of [DAWN, DAWN + 1, nextDusk(b) - 1]) {
      expect(tendHolds(b, out, FIRE, tick)).toBe(false);
      expect(tendHolds(b, relit, FIRE, tick)).toBe(false);
    }
  });

  test('stays met through the day until the next dusk, with the fire long out', () => {
    const b = world();
    const state = fedAt(b, NIGHT);
    expect(fireBurns(state, FIRE, DAWN)).toBe(false);
    // tick 0 is noon, so a day later is noon again
    for (const tick of [DAWN, DAWN + 1, b.params.day_length_ms, nextDusk(b) - 1]) {
      expect(tendHolds(b, state, FIRE, tick)).toBe(true);
      expect(questSatisfied(b, { ...state, tick }, QUEST)).toBe(true);
    }
    // the next night asks for a vigil of its own
    for (const tick of [nextDusk(b), nextDusk(b) + 1, DAWN + b.params.day_length_ms]) {
      expect(tendHolds(b, state, FIRE, tick)).toBe(false);
    }
  });

  test('a log fed by day after the night it kept lights a new burn, and the night stays kept until the next dusk', () => {
    const b = world();
    const { log_ms } = b.params.fire;
    const wood = fedAt(b, JOURNAL);
    wood.player.bag[WOOD] = 3;
    // out at 05:00 on the dot with the Feed beside it: a log at dawn, a tick after or at 06:00 starts a new burn that carries the night
    for (const tick of [DAWN, DAWN + 1, H06]) {
      const relit = feed(b, wood, tick).state;
      expect(relit.player.fires[FIRE]).toEqual({ lit: tick, until: tick + log_ms, kept: DAWN });
      for (const t of [tick, b.params.day_length_ms, nextDusk(b) - 1]) expect(tendHolds(b, relit, FIRE, t)).toBe(true);
      for (const t of [nextDusk(b), DAWN + b.params.day_length_ms]) expect(tendHolds(b, relit, FIRE, t)).toBe(false);
    }
    // relit at 06:00, the giver takes it at 06:00
    const six = atGiver(b, feed(b, wood, H06).state);
    const sixHanded = step(b, six.s, { t: 'turnin', quest: QUEST, at: six.at }, H06);
    if (!sixHanded.ok) throw new Error(sixHanded.error);
    expect(sixHanded.state.player.quests[QUEST]).toBe('done');
    // a top-up keeps it, a second burn the same day carries it again, and the giver takes the vigil at noon
    const topped = feed(b, feed(b, wood, DAWN).state, DAWN + 10).state;
    expect(topped.player.fires[FIRE]).toEqual({ lit: DAWN, until: DAWN + 2 * log_ms, kept: DAWN });
    const again = feed(b, topped, DAWN + 2 * log_ms + 5).state;
    expect(again.player.fires[FIRE]).toEqual({ lit: DAWN + 2 * log_ms + 5, until: DAWN + 3 * log_ms + 5, kept: DAWN });
    const { s, at } = atGiver(b, again);
    const handed = step(b, s, { t: 'turnin', quest: QUEST, at }, b.params.day_length_ms);
    if (!handed.ok) throw new Error(handed.error);
    expect(handed.state.player.quests[QUEST]).toBe('done');

    // a replay agrees, and a save cut at any step carries the kept night on
    const start = begin(b, { [WOOD]: JOURNAL.length + 1 });
    const fed = (tick: number) => ({ a: { t: 'feed', fire: FIRE, item: WOOD, at: AT } as Action, tick });
    const log = [...JOURNAL.map(fed), fed(DAWN + 1), { a: { t: 'move', at: AT } as Action, tick: b.params.day_length_ms }];
    const one = replay(b, start, log);
    expect(one.error).toBeUndefined();
    expect(one.state.player.fires[FIRE]).toEqual({ lit: DAWN + 1, until: DAWN + 1 + log_ms, kept: DAWN });
    for (let cut = 1; cut < log.length; cut++) {
      const head = replay(b, start, log.slice(0, cut));
      const tail = replay(b, JSON.parse(serialize(head.state)) as State, log.slice(cut));
      expect(tail.error).toBeUndefined();
      expect(serialize(tail.state)).toBe(serialize(one.state));
    }
  });

  test('a fire lit again after the next dusk, or after a night it did not keep, carries no night', () => {
    const b = world();
    const { log_ms } = b.params.fire;
    const wood = fedAt(b, JOURNAL);
    wood.player.bag[WOOD] = 1;
    const late = feed(b, wood, nextDusk(b) + 10).state;
    expect(late.player.fires[FIRE]).toEqual({ lit: nextDusk(b) + 10, until: nextDusk(b) + 10 + log_ms });
    for (const t of [nextDusk(b) + 10, DAWN + b.params.day_length_ms]) expect(tendHolds(b, late, FIRE, t)).toBe(false);
    // out at 04:00, before dawn: a log by day lights a burn with no night to carry
    const lost = fedAt(b, [DUSK, DUSK, DUSK, H23]);
    lost.player.bag[WOOD] = 1;
    const relit = feed(b, lost, DAWN + 1).state;
    expect(relit.player.fires[FIRE]).toEqual({ lit: DAWN + 1, until: DAWN + 1 + log_ms });
    expect(tendHolds(b, relit, FIRE, DAWN + 1)).toBe(false);
  });

  test('a replay agrees: a vigil nobody gave finishes itself at the first step from dawn, and a save cut anywhere plays on the same', () => {
    const b = world();
    b.quests[QUEST] = { ...b.quests[QUEST]!, giver: undefined };
    const start = begin(b, { [WOOD]: NIGHT.length });
    start.player.quests[QUEST] = 'active';
    const report = (tick: number) => ({ a: { t: 'move', at: AT } as Action, tick });
    const log = [
      ...NIGHT.map((tick) => ({ a: { t: 'feed', fire: FIRE, item: WOOD, at: AT } as Action, tick })),
      report(H23 + 1),
      report(H04),
      report(DAWN - 1),
      report(DAWN),
      report(DAWN + 1),
    ];
    const one = replay(b, start, log);
    const two = replay(b, start, log);
    expect(one.error).toBeUndefined();
    expect(serialize(one.state)).toBe(serialize(two.state));
    expect(one.events).toEqual(two.events);
    expect(one.state.player.quests[QUEST]).toBe('done');

    // still open at 04:59, done at the step of 05:00
    const dawnAt = log.findIndex((entry) => entry.tick === DAWN);
    const before = replay(b, start, log.slice(0, dawnAt));
    expect(before.state.player.quests[QUEST]).toBe('active');
    expect(before.events.filter((e) => e.e === 'quest' && e.quest === QUEST)).toEqual([]);
    const atDawn = step(b, before.state, log[dawnAt]!.a, DAWN);
    if (!atDawn.ok) throw new Error(atDawn.error);
    expect(atDawn.events).toContainEqual({ e: 'quest', quest: QUEST, state: 'done' });

    for (let cut = 1; cut < log.length; cut++) {
      const head = replay(b, start, log.slice(0, cut));
      const tail = replay(b, JSON.parse(serialize(head.state)) as State, log.slice(cut));
      expect(tail.error).toBeUndefined();
      expect([...head.events, ...tail.events]).toEqual(one.events);
      expect(serialize(tail.state)).toBe(serialize(one.state));
    }
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
    const fires = [
      undefined,
      { lit: DUSK - 1, until: DAWN },
      { lit: DUSK, until: DAWN + 1 },
      { lit: DUSK + 1, until: DAWN },
      { lit: DUSK - 1, until: DAWN - 1 },
      // lit again by day: carrying this night's dawn, and one a day older
      { lit: DAWN + 1, until: DAWN + 2, kept: DAWN },
      { lit: DAWN + 1, until: DAWN + 2, kept: DAWN - 1_200_000 },
    ];
    for (const fire of fires) {
      state.player.fires = fire === undefined ? {} : { [FIRE]: fire };
      for (const tick of [DUSK - 1, DUSK, DUSK + 1, DAWN - 1, DAWN, DAWN + 1]) {
        expect(tendHolds(b, state, FIRE, tick)).toBe(questSatisfied(b, { ...state, tick }, QUEST));
      }
    }
  });
});
