/** The expedition container (NEXT 14a): a night clock, a persistent chain, a soft walk-out and one climax. */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Action,
  type Bundle,
  type ExpeditionDef,
  type GameEvent,
  type State,
  bellTicks,
  bellsRung,
  harmOf,
  lastBellAt,
  newState,
  replay,
  riddleKey,
  satietyCap,
  serialize,
  step,
  visitNight,
  windowOpen,
} from '@game/kernel';
import { loadBundle } from '../../tools/test/helpers/world.js';

type Prop = Bundle['map']['props'][number];

const EXPEDITION = 'test/night-place';
const PLACE = 'test/place';
const CLIMAX = 'test/climax';
/** A spot inside the place: the first quest's riddle is answered by standing on it at night. */
const SPOT = 'test/spot';
const SPOT_TILE: [number, number] = [10, 10];
const EXIT = 'core/night-threshold';
const QUESTS = ['test/first', 'test/second', 'test/third'] as const;
const DUSK = 400_000;
const BELLS = [DUSK, DUSK + 150_000, DUSK + 300_000, DUSK + 400_000];
const LAST = BELLS[3]!;
const INSIDE: [number, number] = [8, 8];
const REWARD_ITEM = 'core/stone';
const OPENED = 'core/arch-way';
/** A predator of the shipped valley: a hunt it begins bites by the clock. */
const WOLF = 'core/ruins-wolf';

let base: Bundle;

beforeAll(() => {
  base = loadBundle();
});

function world(): Bundle {
  const b = structuredClone(base);
  b.map.slots = [
    ...b.map.slots,
    { id: PLACE, kind: 'area', x: 7, y: 7, w: 4, h: 4 },
    { id: CLIMAX, kind: 'ruin', x: 8, y: 8, w: 1, h: 1 },
    { id: SPOT, kind: 'ruin', x: SPOT_TILE[0], y: SPOT_TILE[1], w: 1, h: 1 },
  ];
  const source = b.quests['core/the-night-arch']!;
  b.quests[QUESTS[0]] = {
    ...source,
    id: QUESTS[0],
    giver: undefined,
    starter: undefined,
    type: 'investigation',
    requires: undefined,
    steps: source.steps.map((st) => (st.kind === 'riddle' ? { ...st, answer: { kind: 'visit', slot: SPOT, at: 'night' } } : st)),
    reward: { rep: 0 },
  };
  b.quests[QUESTS[1]] = {
    ...source,
    id: QUESTS[1],
    giver: undefined,
    starter: undefined,
    type: 'skill',
    requires: [QUESTS[0]],
    reward: { rep: 0 },
  };
  b.quests[QUESTS[2]] = {
    ...source,
    id: QUESTS[2],
    giver: undefined,
    starter: undefined,
    type: 'tending',
    requires: [QUESTS[1]],
    reward: { rep: 0 },
  };
  b.expeditions[EXPEDITION] = {
    id: EXPEDITION,
    creator: 'test',
    title: 'Night place',
    file: 'test',
    place: PLACE,
    window: { bells: [20, 23, 2, 4] },
    exit: EXIT,
    chain: [...QUESTS],
    climax: { slot: CLIMAX },
    reward: { items: [{ item: REWARD_ITEM, qty: 2 }], opens: [OPENED] },
    on_miss: 'wait',
  };
  return b;
}

function expedition(b: Bundle): ExpeditionDef {
  return b.expeditions[EXPEDITION]!;
}

function begin(b: Bundle): State {
  const r = step(b, newState(b, 7), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
  if (!r.ok) throw new Error(r.error);
  const s = structuredClone(r.state);
  s.player.attrs.carry = 100;
  return s;
}

function placed(s: State, at: [number, number], tick: number): State {
  const out = structuredClone(s);
  out.player.at = [...at];
  out.player.movedAt = tick;
  out.player.satietyAt = tick;
  out.player.busyUntil = Math.min(out.player.busyUntil, tick);
  out.tick = tick;
  return out;
}

function move(b: Bundle, s: State, tick: number, at: [number, number] = INSIDE): { state: State; events: GameEvent[] } {
  const r = step(b, s, { t: 'move', at }, tick);
  if (!r.ok) throw new Error(r.error);
  return r;
}

function events(events: GameEvent[], kind: GameEvent['e']): GameEvent[] {
  return events.filter((event) => event.e === kind);
}

describe('the bell window', () => {
  test('bell ticks follow the game clock from dusk through the next morning', () => {
    const b = world();
    const x = expedition(b);
    expect(bellTicks(b, x, DUSK)).toEqual(BELLS);
    expect(bellsRung(b, { ...x, window: { bells: [21, 23, 2, 4] } }, DUSK)).toBe(0);
    expect(bellsRung(b, x, BELLS[1]!)).toBe(2);
    expect(lastBellAt(b, x, BELLS[2]!)).toBe(BELLS[3]);
    expect(windowOpen(b, x, DUSK)).toBe(true);
    expect(windowOpen(b, x, BELLS[3]!)).toBe(false);
  });

  test('a bell rung before entry is not reported', () => {
    const b = world();
    const entered = move(b, placed(begin(b), INSIDE, BELLS[1]!), BELLS[1]!);
    expect(events(entered.events, 'bell')).toEqual([]);
    const last = move(b, entered.state, BELLS[2]!);
    expect(events(last.events, 'bell')).toEqual([{ e: 'bell', expedition: EXPEDITION, n: 3 }]);
  });

  test('the last bell walks out with the bag whole and ends the outing and a real hunt', () => {
    const b = world();
    let state = placed(begin(b), INSIDE, DUSK + 1);
    state.player.bag[REWARD_ITEM] = 3;
    state.player.outing = { gained: { [REWARD_ITEM]: 3 }, solved: [], visited: [] };
    state = move(b, state, DUSK + 1).state;
    state = move(b, state, LAST - 1000).state;
    // the wolf noticed the player at this report: late enough that no bite is due by the last bell
    const hunt = { hazard: WOLF, since: LAST - 1000, bites: 0 };
    state.player.chase = { ...hunt };
    const before = move(b, state, LAST - 1);
    expect(before.state.player.chase).toEqual(hunt);
    const out = move(b, before.state, LAST);
    const exit = b.map.slots.find((slot) => slot.id === EXIT)!;
    expect(out.state.player.at).toEqual([exit.x, exit.y]);
    expect(out.state.player.bag[REWARD_ITEM]).toBe(3);
    expect(out.state.player.outing).toBeNull();
    expect(out.state.player.chase).toBeNull();
    expect(events([...before.events, ...out.events], 'hurt')).toEqual([]);
    expect(events(out.events, 'walked_out')).toEqual([{ e: 'walked_out', expedition: EXPEDITION }]);
    expect(out.state.player.expeditions[EXPEDITION]).toMatchObject({ climax: false, rung: 0 });
    expect(out.state.player.expeditions[EXPEDITION]?.entered).toBeUndefined();
  });
});

describe('one visit, one night of bells', () => {
  const DAY = 1_200_000;
  const HOUR = 50_000;

  function bellsOf(events: GameEvent[]): number[] {
    return events.flatMap((event) => (event.e === 'bell' ? [event.n] : []));
  }

  test('a visit counts its own night until the last bell, then the coming one', () => {
    const b = world();
    const x = expedition(b);
    expect(visitNight(b, x, DUSK - HOUR)).toBe(DUSK);
    expect(visitNight(b, x, DUSK + 1)).toBe(DUSK);
    expect(visitNight(b, x, BELLS[3]! - 1)).toBe(DUSK);
    expect(visitNight(b, x, BELLS[3]!)).toBe(DUSK + DAY);
    expect(visitNight(b, x, DUSK + 13 * HOUR)).toBe(DUSK + DAY);
  });

  test('a visit begun before dusk hears every bell of that night and walks out at the last', () => {
    const b = world();
    let state = move(b, placed(begin(b), INSIDE, DUSK - HOUR), DUSK - HOUR).state;
    const heard: number[] = [];
    for (const tick of BELLS.slice(0, 3)) {
      const r = move(b, placed(state, INSIDE, tick), tick);
      heard.push(...bellsOf(r.events));
      expect(events(r.events, 'walked_out')).toEqual([]);
      state = r.state;
    }
    const last = move(b, placed(state, INSIDE, BELLS[3]!), BELLS[3]!);
    heard.push(...bellsOf(last.events));
    expect(heard).toEqual([1, 2, 3, 4]);
    expect(events(last.events, 'walked_out')).toEqual([{ e: 'walked_out', expedition: EXPEDITION }]);
  });

  test('a visit that outlives its last bell is walked out at the next action, even a night later', () => {
    const b = world();
    const exit = b.map.slots.find((slot) => slot.id === EXIT)!;
    let state = move(b, placed(begin(b), INSIDE, DUSK + 1), DUSK + 1).state;
    state = move(b, placed(state, INSIDE, BELLS[2]!), BELLS[2]!).state;
    const late = DUSK + DAY + HOUR;
    const r = move(b, placed(state, INSIDE, late), late);
    expect(bellsOf(r.events)).toEqual([4]);
    expect(events(r.events, 'walked_out')).toEqual([{ e: 'walked_out', expedition: EXPEDITION }]);
    expect(r.state.player.at).toEqual([exit.x, exit.y]);
  });

  test('a visit begun by day that sleeps through two dusks hears its night and walks out', () => {
    const b = world();
    const afternoon = 2 * HOUR;
    const state = move(b, placed(begin(b), INSIDE, afternoon), afternoon).state;
    const late = DUSK + DAY + HOUR;
    const r = move(b, placed(state, INSIDE, late), late);
    expect(bellsOf(r.events)).toEqual([1, 2, 3, 4]);
    expect(events(r.events, 'walked_out')).toEqual([{ e: 'walked_out', expedition: EXPEDITION }]);
  });

  test('a visit begun by day or after the last bell hears nothing until its night', () => {
    const b = world();
    const noon = move(b, placed(begin(b), INSIDE, 0), 0);
    expect(bellsOf(noon.events)).toEqual([]);
    const evening = move(b, placed(noon.state, INSIDE, DUSK - 1), DUSK - 1);
    expect(bellsOf(evening.events)).toEqual([]);
    expect(events(evening.events, 'walked_out')).toEqual([]);

    const dawn = move(b, placed(begin(b), INSIDE, BELLS[3]! + 1), BELLS[3]! + 1);
    const morning = move(b, placed(dawn.state, INSIDE, BELLS[3]! + 2 * HOUR), BELLS[3]! + 2 * HOUR);
    expect(bellsOf(morning.events)).toEqual([]);
    expect(events(morning.events, 'walked_out')).toEqual([]);
    expect(morning.state.player.at).toEqual(INSIDE);
  });
});

describe('the expedition chain and climax', () => {
  test('starts only inside at night and keeps its progress across two nights', () => {
    const b = world();
    const dayInside = move(b, placed(begin(b), INSIDE, 100_000), 100_000).state;
    expect(dayInside.player.quests[QUESTS[0]]).toBeUndefined();

    const nightOutside = move(b, placed(dayInside, [5, 5], DUSK + 1), DUSK + 1, [5, 5]).state;
    expect(nightOutside.player.quests[QUESTS[0]]).toBeUndefined();

    const firstNight = move(b, placed(nightOutside, INSIDE, DUSK + 2), DUSK + 2).state;
    expect(firstNight.player.quests[QUESTS[0]]).toBe('active');

    // progress the chain cannot rebuild by itself: the riddle answered on its spot inside the place, which starts the second quest
    const answered = step(b, firstNight, { t: 'visit', slot: SPOT, at: SPOT_TILE }, DUSK + 3);
    if (!answered.ok) throw new Error(answered.error);
    const kept = (state: State): void => {
      expect(state.player.quests[QUESTS[0]]).toBe('done');
      expect(state.player.solved).toContain(riddleKey(QUESTS[0], 0));
      expect(state.player.quests[QUESTS[1]]).toBe('active');
    };
    kept(answered.state);

    const out = move(b, answered.state, LAST, SPOT_TILE);
    expect(events(out.events, 'walked_out')).toEqual([{ e: 'walked_out', expedition: EXPEDITION }]);
    kept(out.state);

    const nextDusk = DUSK + b.params.day_length_ms;
    const secondNight = move(b, placed(out.state, INSIDE, nextDusk + 1), nextDusk + 1).state;
    kept(secondNight);
  });

  test('emits the climax once and applies its reward once', () => {
    const b = world();
    const state = placed(begin(b), INSIDE, DUSK + 1);
    for (const id of QUESTS) state.player.quests[id] = 'done';
    const first = move(b, state, DUSK + 1);
    expect(events(first.events, 'climax')).toEqual([{ e: 'climax', expedition: EXPEDITION }]);
    expect(first.state.player.bag[REWARD_ITEM]).toBe(2);
    expect(first.state.player.restored).toContain(OPENED);

    const again = move(b, first.state, DUSK + 2);
    expect(events(again.events, 'climax')).toEqual([]);
    expect(again.state.player.bag[REWARD_ITEM]).toBe(2);
    expect(again.state.player.restored.filter((id) => id === OPENED)).toHaveLength(1);
  });

  test('the climax waits for the player to stand on its slot', () => {
    const b = world();
    const aside: [number, number] = [9, 9];
    const state = placed(begin(b), aside, DUSK + 1);
    for (const id of QUESTS) state.player.quests[id] = 'done';
    const near = move(b, state, DUSK + 1, aside);
    expect(events(near.events, 'climax')).toEqual([]);
    expect(near.state.player.restored).not.toContain(OPENED);
    const on = move(b, placed(near.state, INSIDE, DUSK + 2), DUSK + 2);
    expect(events(on.events, 'climax')).toEqual([{ e: 'climax', expedition: EXPEDITION }]);
  });

  test('old states default expedition progress and two replays agree', () => {
    const b = world();
    const start = placed(begin(b), INSIDE, DUSK + 1);
    delete (start.player as Partial<State['player']>).expeditions;
    const log: readonly { a: Action; tick: number }[] = [
      { a: { t: 'move', at: INSIDE }, tick: DUSK + 1 },
      { a: { t: 'move', at: INSIDE }, tick: BELLS[1]! },
    ];
    const one = replay(b, start, log);
    const two = replay(b, start, log);
    expect(one.error).toBeUndefined();
    expect(serialize(one.state)).toBe(serialize(two.state));
    expect(one.events).toEqual(two.events);
  });
});

describe('a report after the last bell is read as the world stood at that bell', () => {
  /** The place's east edge, inside it, and the first tile beyond it. */
  const EDGE: [number, number] = [10, 8];
  const BEYOND: [number, number] = [11, 8];

  /** On `at` inside since `entered`, with a report there at `report`, health at one bite and three of the reward item gained on this outing. */
  function hunted(b: Bundle, entered: number, report: number, at: [number, number] = INSIDE): State {
    let state = move(b, placed(begin(b), at, entered), entered, at).state;
    if (report !== entered) state = move(b, state, report, at).state;
    state.player.satiety = harmOf(b, satietyCap(b, state), 'predator');
    state.player.bag[REWARD_ITEM] = 3;
    state.player.outing = { gained: { [REWARD_ITEM]: 3 }, solved: [], visited: [] };
    return state;
  }

  test('a hunt begun two seconds before the bell has no bite due by it: the walk-out takes the player out whole', () => {
    const b = world();
    const state = hunted(b, LAST - 3000, LAST - 2000);
    const health = state.player.satiety;
    // health is one bite (25% of the cap): a bite counted past the bell would be a fall
    expect(health * 4).toBe(satietyCap(b, state));
    state.player.chase = { hazard: WOLF, since: LAST - 2000, bites: 0 };
    const out = move(b, state, LAST + 1000);
    const exit = b.map.slots.find((slot) => slot.id === EXIT)!;
    expect(events(out.events, 'hurt')).toEqual([]);
    expect(events(out.events, 'fall')).toEqual([]);
    expect(events(out.events, 'walked_out')).toEqual([{ e: 'walked_out', expedition: EXPEDITION }]);
    expect(out.state.player.at).toEqual([exit.x, exit.y]);
    expect(out.state.player.satiety).toBe(health);
    expect(out.state.player.bag[REWARD_ITEM]).toBe(3);
    expect(out.state.player.chase).toBeNull();
    expect(out.state.player.outing).toBeNull();
  });

  test('a bite that fell due before the bell still lands, and the fall costs the outing (G33)', () => {
    const b = world();
    const state = hunted(b, LAST - 3000, LAST - 3000);
    state.player.chase = { hazard: WOLF, since: LAST - 3000, bites: 0 };
    const out = move(b, state, LAST + 1000);
    expect(events(out.events, 'hurt')).toEqual([{ e: 'hurt', by: 'predator', id: WOLF, hp: 0 }]);
    expect(events(out.events, 'fall')).toHaveLength(1);
    expect(events(out.events, 'walked_out')).toEqual([]);
    expect(out.state.player.bag[REWARD_ITEM] ?? 0).toBe(0);
  });

  test('a pit on the tile reported after the bell does not strike', () => {
    const b = world();
    const PIT: [number, number] = [9, 8];
    const pit: Prop = { id: 'test/pit', sprite: 'core/base-kit:props/standing_stone', x: PIT[0], y: PIT[1], w: 1, h: 1, solid: false, hazard: { kind: 'pit', window: ['night'] } };
    b.map.props = [...b.map.props, pit];
    const inside = move(b, placed(begin(b), INSIDE, LAST - 1000), LAST - 1000).state;
    const cap = satietyCap(b, inside);
    expect(inside.player.satiety).toBe(cap);

    // before the bell the pit is awake under the player's feet
    const early = move(b, inside, LAST - 500, PIT);
    expect(events(early.events, 'hurt')).toEqual([{ e: 'hurt', by: 'pit', id: 'test/pit', hp: cap - harmOf(b, cap, 'pit') }]);

    // the same step reported after the bell: the mist walks the player out, the night's pit does not strike (G49)
    const late = move(b, inside, LAST + 1000, PIT);
    expect(events(late.events, 'hurt')).toEqual([]);
    expect(events(late.events, 'walked_out')).toEqual([{ e: 'walked_out', expedition: EXPEDITION }]);
    expect(late.state.player.satiety).toBe(cap);
  });

  test('a report from the first tile beyond the place is a walk-out too: no bite past the bell, the bag whole', () => {
    const b = world();
    // on the edge when the last bell rang; the next report is one step out of the place
    const state = hunted(b, LAST - 3000, LAST - 2000, EDGE);
    const health = state.player.satiety;
    state.player.chase = { hazard: WOLF, since: LAST - 2000, bites: 0 };
    const out = move(b, state, LAST + 1000, BEYOND);
    const exit = b.map.slots.find((slot) => slot.id === EXIT)!;
    expect(events(out.events, 'hurt')).toEqual([]);
    expect(events(out.events, 'fall')).toEqual([]);
    expect(events(out.events, 'bell')).toEqual([{ e: 'bell', expedition: EXPEDITION, n: 4 }]);
    expect(events(out.events, 'walked_out')).toEqual([{ e: 'walked_out', expedition: EXPEDITION }]);
    expect(out.state.player.at).toEqual([exit.x, exit.y]);
    expect(out.state.player.satiety).toBe(health);
    expect(out.state.player.bag[REWARD_ITEM]).toBe(3);
    expect(out.state.player.chase).toBeNull();
    expect(out.state.player.outing).toBeNull();
    expect(out.state.player.expeditions[EXPEDITION]?.entered).toBeUndefined();
  });

  test('the first step out after the bell closes the outing at the exit, and a pit on that tile does not strike', () => {
    const b = world();
    const pit: Prop = { id: 'test/edge-pit', sprite: 'core/base-kit:props/standing_stone', x: BEYOND[0], y: BEYOND[1], w: 1, h: 1, solid: false, hazard: { kind: 'pit', window: ['night'] } };
    b.map.props = [...b.map.props, pit];
    const state = move(b, placed(begin(b), EDGE, LAST - 1000), LAST - 1000, EDGE).state;
    const cap = satietyCap(b, state);
    state.player.bag[REWARD_ITEM] = 3;
    state.player.outing = { gained: { [REWARD_ITEM]: 3 }, solved: [], visited: [] };
    const out = move(b, state, LAST + 1000, BEYOND);
    const exit = b.map.slots.find((slot) => slot.id === EXIT)!;
    expect(events(out.events, 'hurt')).toEqual([]);
    expect(events(out.events, 'walked_out')).toEqual([{ e: 'walked_out', expedition: EXPEDITION }]);
    expect(out.state.player.at).toEqual([exit.x, exit.y]);
    expect(out.state.player.satiety).toBe(cap);
    expect(out.state.player.bag[REWARD_ITEM]).toBe(3);
    expect(out.state.player.outing).toBeNull();
  });

  test('an action other than a move after the bell is not made: the walk-out comes first, the outing whole', () => {
    const b = world();
    const BERRY = 'test/bad-berry';
    const food = Object.values(b.items).find((item) => item.food && !item.food.hurt)!;
    // a food that only hurts: eaten at one bite of health, it would be a fall
    b.items[BERRY] = { ...structuredClone(food), id: BERRY, name: 'bad berry', food: { ...food.food!, satiety: 0, hurt: 40 } };
    const state = hunted(b, LAST - 3000, LAST - 2000);
    const health = state.player.satiety;
    state.player.bag[BERRY] = 1;

    // before the bell the berry is eaten, and it fells the player
    const early = step(b, state, { t: 'eat', item: BERRY }, LAST - 1000);
    if (!early.ok) throw new Error(early.error);
    expect(events(early.events, 'fall')).toHaveLength(1);

    // after the bell the mist walks the player out first, and the berry stays in the bag
    const late = step(b, state, { t: 'eat', item: BERRY }, LAST + 1000);
    if (!late.ok) throw new Error(late.error);
    const exit = b.map.slots.find((slot) => slot.id === EXIT)!;
    expect(events(late.events, 'fall')).toEqual([]);
    expect(events(late.events, 'walked_out')).toEqual([{ e: 'walked_out', expedition: EXPEDITION }]);
    expect(late.state.player.at).toEqual([exit.x, exit.y]);
    expect(late.state.player.satiety).toBe(health);
    expect(late.state.player.bag[BERRY]).toBe(1);
    expect(late.state.player.bag[REWARD_ITEM]).toBe(3);
    expect(late.state.player.outing).toBeNull();
  });

  test('a riddle answered after the bell is not solved: the player is walked out instead', () => {
    const b = world();
    let state = move(b, placed(begin(b), SPOT_TILE, DUSK + 1), DUSK + 1, SPOT_TILE).state;
    state = move(b, state, LAST - 1000, SPOT_TILE).state;
    const answer: Action = { t: 'visit', slot: SPOT, at: SPOT_TILE };

    const early = step(b, state, answer, LAST - 500);
    if (!early.ok) throw new Error(early.error);
    expect(early.state.player.solved).not.toEqual(state.player.solved);

    const late = step(b, state, answer, LAST + 1000);
    if (!late.ok) throw new Error(late.error);
    expect(events(late.events, 'walked_out')).toEqual([{ e: 'walked_out', expedition: EXPEDITION }]);
    expect(late.state.player.solved).toEqual(state.player.solved);
    expect(late.state.player.quests).toEqual(state.player.quests);
  });

  test('two visits over one place end at the earlier last bell, with one walk-out', () => {
    const b = world();
    const EARLY = 'test/early-place';
    b.expeditions[EARLY] = { ...structuredClone(expedition(b)), id: EARLY, window: { bells: [20, 22] } };
    const both = move(b, placed(begin(b), INSIDE, DUSK + 1), DUSK + 1).state;
    expect(both.player.expeditions[EXPEDITION]?.entered).toBe(DUSK + 1);
    expect(both.player.expeditions[EARLY]?.entered).toBe(DUSK + 1);
    // the 22:00 bell walked the player out, so the other visit hears none of its later bells
    const out = move(b, both, LAST + 1000);
    expect(events(out.events, 'bell')).toEqual([{ e: 'bell', expedition: EARLY, n: 2 }]);
    expect(events(out.events, 'walked_out')).toEqual([{ e: 'walked_out', expedition: EARLY }]);
    expect(out.state.player.expeditions[EXPEDITION]?.entered).toBeUndefined();
    expect(out.state.player.expeditions[EARLY]?.entered).toBeUndefined();
  });
});
