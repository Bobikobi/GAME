/**
 * Health and hazards (DECISIONS.md, 2026-10-10; GAME_RULES G30-G35): a position report, the night's
 * hazards, the outing and the fall. The shipped map has no hazard yet, so every world here is a copy of
 * the bundle with a few synthetic props added, and the hunger drain switched off the way the content will.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { HAZARD_KINDS as SCHEMA_HAZARD_KINDS } from '@game/schema';
import {
  type Action,
  type Bundle,
  type GameEvent,
  HAZARD_KINDS,
  type State,
  bitesAfter,
  hazardsOf,
  isNight,
  isSafe,
  makeWalkable,
  newState,
  nightEnds,
  nightFalls,
  replay,
  satietyAt,
  satietyCap,
  serialize,
  step,
} from '@game/kernel';

import { loadBundle, mulberry32 } from '../../tools/test/helpers/world.js';

type Tile = [number, number];
type Prop = Bundle['map']['props'][number];

/** 21:20, a third of the way into the night (night runs 700000 to 1150000 of a 1200000 day). */
const NIGHT = 800_000;
const DAWN = 1_150_000;
const NOON = 300_000;

let base: Bundle;

beforeAll(() => {
  base = loadBundle();
});

function prop(id: string, x: number, y: number, hazard: Prop['hazard'], solid = false): Prop {
  return { id, sprite: 'core/base-kit:props/standing_stone', x, y, w: 1, h: 1, solid, hazard };
}

const wolf = (x: number, y: number, reach = 3): Prop => prop('test/wolf', x, y, { kind: 'predator', window: ['night'], reach });
const pit = (x: number, y: number): Prop => prop('test/pit', x, y, { kind: 'pit', window: ['night'] });

/** The bundle with hazards added and no hunger drain, so the numbers under test are the hazards'. */
function world(props: Prop[], tweak?: (b: Bundle) => void): Bundle {
  const b = structuredClone(base);
  b.map.props = [...b.map.props, ...props];
  b.params.satiety_drain_per_min = 0;
  tweak?.(b);
  return b;
}

function begin(b: Bundle, starter = 'core/forager'): State {
  const r = step(b, newState(b, 7), { t: 'start', starter, name: 'Tester' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** The player is put on a tile at a tick, as if they had walked there. */
function place(s: State, at: Tile, tick: number): State {
  const out = structuredClone(s);
  out.player.at = [...at];
  out.player.movedAt = tick;
  out.player.satietyAt = tick;
  out.player.busyUntil = Math.min(out.player.busyUntil, tick);
  out.tick = tick;
  return out;
}

/** The kinds of the events that matter here: the quests move on their own as the player is put about. */
const kinds = (events: GameEvent[]): string[] => events.map((e) => e.e).filter((k) => k !== 'quest');

function ok(b: Bundle, s: State, a: Action, tick: number): { state: State; events: GameEvent[] } {
  const r = step(b, s, a, tick);
  if (!r.ok) throw new Error(`${a.t} refused: ${r.error}`);
  return { state: r.state, events: r.events };
}

const move = (b: Bundle, s: State, at: Tile, tick: number) => ok(b, s, { t: 'move', at }, tick);

describe('the night', () => {
  test('nightFalls and nightEnds agree with isNight, tick by tick around both edges', () => {
    const b = base;
    const day = b.params.day_length_ms;
    for (let t = 0; t < 3 * day; t += 997) {
      const end = nightEnds(b, t);
      const falls = nightFalls(b, t);
      expect(end).toBeGreaterThanOrEqual(t);
      expect(falls).toBeGreaterThanOrEqual(t);
      expect(isNight(b, end)).toBe(false);
      expect(isNight(b, falls)).toBe(true);
      if (isNight(b, t)) {
        expect(end).toBeGreaterThan(t);
        expect(isNight(b, end - 1)).toBe(true);
        expect(falls).toBe(t);
      } else {
        expect(end).toBe(t);
        expect(isNight(b, falls - 1)).toBe(falls === t ? isNight(b, t - 1) : false);
      }
    }
    expect(nightFalls(b, NOON)).toBe(700_000);
    expect(nightEnds(b, NIGHT)).toBe(DAWN);
  });
});

describe('what the vocabularies and the shipped content say', () => {
  test('the kernel and the schema name the same hazards', () => {
    expect([...HAZARD_KINDS]).toEqual([...SCHEMA_HAZARD_KINDS]);
  });

  test('the shipped valley has no hazard yet, so nothing in it can hurt', () => {
    expect(hazardsOf(base)).toEqual([]);
    expect(base.map.slots.some((s) => s.safe === true)).toBe(false);
  });

  test('play is unchanged: health is the old satiety, it empties by the clock, and empty is not a fall', () => {
    const b = structuredClone(base);
    const s = begin(b);
    const cap = satietyCap(b, s);
    expect(s.player.satiety).toBe(cap);
    const tenMin = 600_000;
    const r = move(b, s, [6, 18], tenMin);
    expect(kinds(r.events)).toEqual([]);
    expect(r.state.player.satiety).toBe(cap - Math.floor((tenMin * b.params.satiety_drain_per_min) / 60_000));
    // an hour later it is empty: the work is slower, and nobody falls from hunger
    const hour = 3_600_000;
    const later = move(b, r.state, [6, 19], hour);
    expect(kinds(later.events)).toEqual([]);
    expect(later.state.player.satiety).toBe(0);
    expect(later.state.player.falls).toBe(0);
    expect(satietyAt(b, later.state, hour)).toBe(0);
  });
});

describe('a position report', () => {
  test('is refused before the character is chosen', () => {
    const b = world([]);
    expect(step(b, newState(b, 7), { t: 'move', at: [6, 17] }, 0)).toEqual({ ok: false, error: 'Pick a character first.' });
  });

  test('moves the player a tile, and the walk is timed: a jump across the map is refused, a step is not', () => {
    const b = world([]);
    const s = begin(b);
    expect(move(b, s, [6, 18], 190).state.player.at).toEqual([6, 18]);
    expect(step(b, s, { t: 'move', at: [6, 25] }, 190)).toEqual({ ok: false, error: 'That is further than a walk goes in that time.' });
    // forty tiles of walking is 7600 ms: given that long, the same report is fine
    const far = move(b, s, [6, 25], 7 * 190 + 2 * 190);
    expect(far.state.player.at).toEqual([6, 25]);
    expect(step(b, s, { t: 'move', at: [0, 0] }, 400)).toEqual({ ok: false, error: 'You cannot stand there.' });
    expect(step(b, s, { t: 'move', at: [1.5, 3] as unknown as Tile }, 400)).toEqual({ ok: false, error: 'Where are you?' });
  });

  test('goes through while the player is busy, and every other action is still refused', () => {
    const b = world([]);
    let s = begin(b);
    const stone = 'core/river-stones#0';
    const inst = b.instances[stone]!;
    const standing: Tile = [inst.x, inst.y + 1];
    s = ok(b, place(s, standing, 100), { t: 'gather', node: stone, grade: 3, at: standing }, 100).state;
    expect(s.player.busyUntil).toBeGreaterThan(200);
    expect(step(b, s, { t: 'gather', node: stone, grade: 3, at: standing }, 200).ok).toBe(false);
    expect(move(b, s, [standing[0], standing[1] + 1], 200).state.player.at).toEqual([standing[0], standing[1] + 1]);
  });

  test('a walk out begins an outing, and standing somewhere safe ends it and names the town', () => {
    const b = world([]);
    let s = begin(b);
    expect(s.player.outing).toBeNull();
    s = move(b, s, [6, 18], 190).state;
    expect(s.player.outing).toEqual({ gained: {}, solved: [], visited: [] });
    expect(s.player.town).toBe('');
    // the cobbles are safe: the outing is over, and this is the town to wake in
    s = move(b, place(s, [21, 7], 10_000), [22, 7], 10_190).state;
    expect(isSafe(b, s, [22, 7])).toBe(true);
    expect(s.player.outing).toBeNull();
    expect(s.player.town).toBe('core/town-square');
  });

  test('a slot marked safe is safe, and so is the camp once a part of it stands', () => {
    const camp = base.map.slots.find((x) => x.kind === 'camp')!;
    const inside: Tile = [camp.x + 1, camp.y + 1];
    const b = world([], (w) => {
      w.map.slots = w.map.slots.map((x) => (x.id === 'core/west-glade' ? { ...x, safe: true } : x));
    });
    const s = begin(b);
    expect(isSafe(b, s, inside)).toBe(false);
    expect(isSafe(b, { ...s, player: { ...s.player, camp: ['core/campfire'] } }, inside)).toBe(true);
    expect(isSafe(b, s, [4, 22])).toBe(true);
    expect(isSafe(b, s, [4, 27])).toBe(false);
  });
});

describe('a predator', () => {
  const at: Tile = [5, 22];

  test('does not bite on a bare report, wakes at dusk, and bites by the clock, not by the reports', () => {
    const b = world([wolf(8, 22)]);
    let s = place(begin(b), at, NIGHT);
    s = move(b, s, at, NIGHT).state;
    expect(s.player.chase).toEqual({ hazard: 'test/wolf', since: NIGHT, bites: 0 });
    expect(bitesAfter(b, 2499)).toBe(0);
    expect(bitesAfter(b, 2500)).toBe(1);
    expect(bitesAfter(b, 4499)).toBe(1);
    expect(bitesAfter(b, 4500)).toBe(2);
    const cap = satietyCap(b, s);
    const bite = cap / 4;

    // reports every few hundred ms ...
    let often = s;
    for (let t = NIGHT + 250; t <= NIGHT + 4500; t += 250) often = move(b, often, at, t).state;
    // ... one report at the end ...
    const once = move(b, s, at, NIGHT + 4500).state;
    // ... and one in between give the same health and the same hunt
    const twice = move(b, move(b, s, at, NIGHT + 3000).state, at, NIGHT + 4500).state;
    for (const x of [often, once, twice]) {
      expect(x.player.satiety).toBe(cap - 2 * bite);
      expect(x.player.chase).toEqual({ hazard: 'test/wolf', since: NIGHT, bites: 2 });
    }
    expect(move(b, s, at, NIGHT + 2499).state.player.satiety).toBe(cap);
    const first = move(b, s, at, NIGHT + 2500);
    expect(first.state.player.satiety).toBe(cap - bite);
    expect(first.events).toEqual([{ e: 'hurt', by: 'predator', id: 'test/wolf', hp: cap - bite }]);
  });

  test('is asleep by day, and out of reach it does nothing at night', () => {
    const b = world([wolf(8, 22)]);
    const day = move(b, place(begin(b), at, NOON), at, NOON).state;
    expect(day.player.chase).toBeNull();
    expect(move(b, day, at, NOON + 600_000).state.player.satiety).toBe(satietyCap(b, day));
    const far = move(b, place(begin(b), [3, 27], NIGHT), [3, 27], NIGHT).state;
    expect(far.player.chase).toBeNull();
  });

  test('is outrun at a safe place: the hunt ends there, and the bites it had made before stay', () => {
    const b = world([wolf(19, 7, 4)]);
    const cap = satietyCap(b, begin(b));
    let s = place(begin(b), [21, 7], NIGHT);
    s = move(b, s, [21, 7], NIGHT).state;
    expect(s.player.chase).not.toBeNull();
    // inside the catch time: no bite, the hunt is simply over
    const quick = move(b, s, [22, 7], NIGHT + 1000).state;
    expect(quick.player.chase).toBeNull();
    expect(quick.player.satiety).toBe(cap);
    // one bite came due before the report from the cobbles
    const late = move(b, s, [22, 7], NIGHT + 2600);
    expect(late.state.player.chase).toBeNull();
    expect(late.state.player.satiety).toBe(cap - cap / 4);
    // and in the town nothing bites, however long the player stays
    expect(move(b, late.state, [23, 7], NIGHT + 60_000).state.player.satiety).toBe(cap - cap / 4);
  });

  test('stops at dawn: only the night counts, and a hunt that began just before it never bites', () => {
    const b = world([wolf(8, 22)]);
    const cap = satietyCap(b, begin(b));
    const s = move(b, place(begin(b), at, DAWN - 1000), at, DAWN - 1000).state;
    expect(s.player.chase).not.toBeNull();
    const morning = move(b, s, at, DAWN + 60_000).state;
    expect(morning.player.chase).toBeNull();
    expect(morning.player.satiety).toBe(cap);
    // a hunt that had the whole night to bite: only the bites before dawn count
    const early = move(b, place(begin(b), at, DAWN - 5000), at, DAWN - 5000).state;
    const after = move(b, early, at, DAWN + 60_000).state;
    expect(after.player.satiety).toBe(cap - (cap / 4) * bitesAfter(b, 5000));
    expect(after.player.chase).toBeNull();
  });

  test('forgets a predator the world no longer has', () => {
    const b = world([]);
    let s = move(b, place(begin(b), at, NIGHT), at, NIGHT).state;
    s = { ...s, player: { ...s.player, chase: { hazard: 'test/gone', since: NIGHT, bites: 0 } } };
    const r = move(b, s, at, NIGHT + 9000);
    expect(r.state.player.chase).toBeNull();
    expect(r.state.player.satiety).toBe(satietyCap(b, s));
  });
});

describe('a pit', () => {
  test('hurts once each time the player steps in at night, and not by day', () => {
    const b = world([pit(7, 22)]);
    const cap = satietyCap(b, begin(b));
    let s = move(b, place(begin(b), [6, 22], NIGHT), [6, 22], NIGHT).state;
    expect(s.player.satiety).toBe(cap);
    const step1 = move(b, s, [7, 22], NIGHT + 190);
    expect(step1.events).toEqual([{ e: 'hurt', by: 'pit', id: 'test/pit', hp: cap - (cap * 30) / 100 }]);
    s = step1.state;
    // standing in it is not stepping in again
    s = move(b, s, [7, 22], NIGHT + 380).state;
    expect(s.player.satiety).toBe(cap - (cap * 30) / 100);
    s = move(b, move(b, s, [8, 22], NIGHT + 570).state, [7, 22], NIGHT + 760).state;
    expect(s.player.satiety).toBe(cap - (cap * 60) / 100);
    const noon = move(b, move(b, place(begin(b), [6, 22], NOON), [6, 22], NOON).state, [7, 22], NOON + 190).state;
    expect(noon.player.satiety).toBe(cap);
  });

  test('is harmless where it is safe: a pit on the cobbles does nothing', () => {
    const b = world([pit(23, 7)]);
    const cap = satietyCap(b, begin(b));
    const s = move(b, place(begin(b), [22, 7], NIGHT), [23, 7], NIGHT + 190).state;
    expect(s.player.satiety).toBe(cap);
  });
});

describe('a fall', () => {
  /** Every pit takes the whole bar. */
  const deadly = (b: Bundle) => {
    b.params.hazard.pit.harm_pct = 100;
  };
  const stone = 'core/river-stones#0';

  /** The forager has gathered a stone on the west bank and stands by the pit. */
  function outing(b: Bundle): State {
    const inst = b.instances[stone]!;
    const standing: Tile = [inst.x, inst.y + 1];
    return ok(b, place(begin(b), standing, 100), { t: 'gather', node: stone, grade: 3, at: standing }, 100).state;
  }

  test('takes back what the outing brought, and only that, and wakes the player where they started', () => {
    const b = world([pit(7, 22)], deadly);
    const s = outing(b);
    expect(s.player.bag['core/stone']).toBe(1);
    expect(s.player.outing?.gained).toEqual({ 'core/stone': 1 });
    const r = move(b, place(s, [6, 22], NIGHT), [7, 22], NIGHT + 190);
    expect(kinds(r.events)).toEqual(['hurt', 'fall']);
    expect(r.events[1]).toEqual({ e: 'fall', from: [7, 22], at: [6, 17], lost: [{ item: 'core/stone', qty: 1 }] });
    const after = r.state.player;
    expect(after.bag['core/stone']).toBeUndefined();
    expect(after.bag['core/axe']).toBe(1);
    expect(after.at).toEqual([6, 17]);
    expect(after.satiety).toBe(satietyCap(b, r.state));
    expect(after.outing).toBeNull();
    expect(after.chase).toBeNull();
    expect(after.falls).toBe(1);
    expect(after.busyUntil).toBeLessThanOrEqual(NIGHT + 190);
    // what the outing earned that is not a thing in the bag stays: the experience, and what the gather did to the node
    expect(after.xp[b.verbs.gather]).toBeGreaterThan(0);
    expect(r.state.nodes[stone]).toBeDefined();
  });

  test('wakes the player inside the town they were last in, on a tile that is theirs to stand on', () => {
    const b = world([pit(20, 7)], deadly);
    let s = place(begin(b), [21, 7], NIGHT - 100_000);
    s = move(b, s, [22, 7], NIGHT - 99_810).state;
    expect(s.player.town).toBe('core/town-square');
    s = move(b, s, [21, 7], NIGHT).state;
    const r = move(b, s, [20, 7], NIGHT + 190);
    const fell = r.events.find((e) => e.e === 'fall');
    expect(fell).toBeDefined();
    const woke = r.state.player.at;
    const square = b.map.slots.find((x) => x.id === 'core/town-square')!;
    expect(woke[0]).toBeGreaterThanOrEqual(square.x);
    expect(woke[0]).toBeLessThan(square.x + square.w);
    expect(woke[1]).toBeGreaterThanOrEqual(square.y);
    expect(woke[1]).toBeLessThan(square.y + square.h);
    expect(makeWalkable(b)(woke[0], woke[1], r.state.player)).toBe(true);
    expect(r.state.player.outing).toBeNull();
  });

  test('does not refund what was spent: a fragment learned on the outing stays learned and gone', () => {
    const b = world([pit(7, 22)], deadly);
    const fragment = 'core/stew-scrap';
    const recipe = b.items[fragment]!.fragment!.unlocks;
    let s = begin(b);
    s.player.bag[fragment] = 1;
    s = move(b, place(s, [6, 20], 1000), [6, 21], 1190).state;
    expect(s.player.outing).not.toBeNull();
    s = ok(b, s, { t: 'learn', item: fragment }, 2000).state;
    expect(s.player.recipes).toContain(recipe);
    expect(s.player.bag[fragment]).toBeUndefined();
    const r = move(b, place(s, [6, 22], NIGHT), [7, 22], NIGHT + 190);
    expect(r.events.some((e) => e.e === 'fall')).toBe(true);
    expect(r.state.player.bag[fragment]).toBeUndefined();
    expect(r.state.player.recipes).toContain(recipe);
  });

  test('spends the outing\'s finds first, so eating does not cost the bag from before twice', () => {
    const b = world([pit(7, 22)], deadly);
    let s = begin(b);
    s.player.bag['core/berry'] = 9;
    s = move(b, place(s, [6, 20], 1000), [6, 21], 1190).state;
    s.player.outing!.gained['core/berry'] = 5; // five of the nine came from this walk
    s.player.satiety = 10_000;
    s = ok(b, s, { t: 'eat', item: 'core/berry' }, 2000).state;
    s = ok(b, s, { t: 'eat', item: 'core/berry' }, 3000).state;
    s = ok(b, s, { t: 'eat', item: 'core/berry' }, 4000).state;
    expect(s.player.bag['core/berry']).toBe(6);
    expect(s.player.outing!.gained['core/berry']).toBe(2);
    const r = move(b, place(s, [6, 22], NIGHT), [7, 22], NIGHT + 190);
    expect(r.state.player.bag['core/berry']).toBe(4);
    expect(r.events.find((e) => e.e === 'fall')).toMatchObject({ lost: [{ item: 'core/berry', qty: 2 }] });
  });

  test('undoes the riddles and the first visits of the outing and nothing before it', () => {
    const b = world([pit(7, 22)], deadly);
    let s = begin(b);
    s.player.solved = ['q/old#0', 'q/new#1'];
    s.player.visited = ['core/ruins-gate', 'core/river-stones'];
    s = move(b, place(s, [6, 20], 1000), [6, 21], 1190).state;
    s.player.outing!.solved.push('q/new#1');
    s.player.outing!.visited.push('core/river-stones');
    const r = move(b, place(s, [6, 22], NIGHT), [7, 22], NIGHT + 190);
    expect(r.state.player.solved).toEqual(['q/old#0']);
    expect(r.state.player.visited).toEqual(['core/ruins-gate']);
  });

  test('records a first visit on the outing when one is made', () => {
    const b = world([]);
    let s = begin(b);
    s = move(b, place(s, [10, 14], 1000), [10, 15], 1190).state;
    s = ok(b, s, { t: 'visit', slot: 'core/river-stones', at: [10, 15] }, 2000).state;
    expect(s.player.visited).toContain('core/river-stones');
    expect(s.player.outing!.visited).toEqual(['core/river-stones']);
  });

  test('is replayed to the same place: the tile they wake on comes from the world\'s own stream', () => {
    const b = world([pit(20, 7)], deadly);
    const log: { a: Action; tick: number }[] = [
      { a: { t: 'start', starter: 'core/forager', name: 'Tester' }, tick: 0 },
    ];
    const start = replay(b, newState(b, 7), log).state;
    const placed = place(start, [22, 7], NIGHT);
    const walk: { a: Action; tick: number }[] = [
      { a: { t: 'move', at: [21, 7] }, tick: NIGHT + 190 },
      { a: { t: 'move', at: [20, 7] }, tick: NIGHT + 380 },
    ];
    const one = replay(b, placed, walk);
    const two = replay(b, placed, walk);
    expect(one.error).toBeUndefined();
    expect(serialize(one.state)).toBe(serialize(two.state));
    expect(one.events.some((e) => e.e === 'fall')).toBe(true);
    // the next fall draws the next number of the same stream
    expect(one.state.player.falls).toBe(1);
  });
});

describe('food that hurts', () => {
  const bad = (b: Bundle) => {
    b.items['test/bad-fruit'] = { ...b.items['core/berry']!, id: 'test/bad-fruit', name: 'Bad fruit', food: { satiety: 0, hurt: 40 } };
  };

  test('takes health at noon, full or not, and a full player can still eat it', () => {
    const b = world([], bad);
    let s = begin(b);
    s.player.bag['test/bad-fruit'] = 2;
    s = place(s, [6, 17], NOON);
    const cap = satietyCap(b, s);
    const r = ok(b, s, { t: 'eat', item: 'test/bad-fruit' }, NOON);
    expect(r.state.player.satiety).toBe(cap - 40_000);
    expect(kinds(r.events)).toEqual(['spend', 'eat', 'hurt']);
    expect(r.events[2]).toEqual({ e: 'hurt', by: 'food', hp: cap - 40_000 });
    // a plain food at full health is still refused
    expect(step(b, place(begin(b), [6, 17], NOON), { t: 'eat', item: 'core/berry' }, NOON).ok).toBe(false);
  });

  test('can be a fall at noon, and the basket goes with it', () => {
    const b = world([], bad);
    let s = begin(b);
    s.player.bag['test/bad-fruit'] = 1;
    s = move(b, place(s, [6, 17], NOON - 1000), [6, 18], NOON - 810).state;
    s.player.outing!.gained['core/berry'] = 3;
    s.player.bag['core/berry'] = 3;
    s.player.satiety = 30_000;
    const r = ok(b, s, { t: 'eat', item: 'test/bad-fruit' }, NOON);
    expect(kinds(r.events)).toEqual(['spend', 'eat', 'hurt', 'fall']);
    expect(r.events[3]).toMatchObject({ e: 'fall', lost: [{ item: 'core/berry', qty: 3 }] });
    expect(r.state.player.bag['core/berry']).toBeUndefined();
    expect(r.state.player.satiety).toBe(satietyCap(b, r.state));
  });
});

describe('low health', () => {
  const busyMs = (b: Bundle, hp: number): number => {
    const inst = b.instances['core/river-stones#0']!;
    const standing: Tile = [inst.x, inst.y + 1];
    const s = place(begin(b), standing, 100);
    s.player.satiety = hp;
    const r = ok(b, s, { t: 'gather', node: 'core/river-stones#0', grade: 3, at: standing }, 100);
    const e = r.events.find((x) => x.e === 'busy');
    return e && e.e === 'busy' ? e.ms : 0;
  };

  test('slows work by half at or below hp_low_pct of the bar, and 0 means only when empty', () => {
    const plain = world([]);
    const cap = satietyCap(plain, begin(plain));
    const normal = busyMs(plain, cap);
    expect(busyMs(plain, 1)).toBe(normal);
    expect(busyMs(plain, 0)).toBe(Math.ceil((normal * 3) / 2));
    const careful = world([], (b) => {
      b.params.hp_low_pct = 25;
    });
    const line = (cap * 25) / 100;
    expect(busyMs(careful, line + 1)).toBe(normal);
    expect(busyMs(careful, line)).toBe(Math.ceil((normal * 3) / 2));
    expect(busyMs(careful, 5)).toBe(Math.ceil((normal * 3) / 2));
  });
});

describe('a long night of wandering', () => {
  const bad = (b: Bundle) => {
    b.items['test/bad-fruit'] = { ...b.items['core/berry']!, id: 'test/bad-fruit', name: 'Bad fruit', food: { satiety: 0, hurt: 15 } };
  };

  for (const [name, start] of [
    ['on the west bank', [6, 22]],
    ['at the edge of the town', [21, 7]],
    ['on the cobbles', [22, 7]],
  ] as const) {
    test(`keeps its promises ${name}, whatever the walk`, () => {
      const b = world([wolf(19, 7, 4), pit(7, 22), pit(9, 24), prop('test/trap', 20, 7, { kind: 'trap', window: ['night'] })], bad);
      const random = mulberry32(start[0] * 31 + start[1]);
      const walkable = makeWalkable(b);
      let s = begin(b);
      s.player.bag['test/bad-fruit'] = 3;
      s.player.bag['core/berry'] = 6;
      let tick = NIGHT - 150_000;
      s = place(s, [...start], tick);
      const init = structuredClone(s);
      const log: { a: Action; tick: number }[] = [];
      let falls = 0;
      let nights = 0;
      for (let i = 0; i < 4000; i++) {
        tick += random() < 0.02 ? 20_000 + Math.floor(random() * 60_000) : 150 + Math.floor(random() * 120);
        const roll = random();
        let a: Action;
        if (roll < 0.9) {
          const dx = Math.floor(random() * 3) - 1;
          const dy = Math.floor(random() * 3) - 1;
          const to: Tile = [s.player.at[0] + dx, s.player.at[1] + dy];
          if (!walkable(to[0], to[1], s.player)) continue;
          a = { t: 'move', at: to };
        } else if (roll < 0.95) {
          a = { t: 'eat', item: random() < 0.5 ? 'test/bad-fruit' : 'core/berry' };
        } else {
          a = { t: 'gather', node: 'core/river-stones#0', grade: 3, at: s.player.at };
        }
        const r = step(b, s, a, tick);
        if (!r.ok) continue;
        log.push({ a, tick });
        s = r.state;
        const p = s.player;
        const cap = satietyCap(b, s);
        expect(p.satiety).toBeGreaterThanOrEqual(0);
        expect(p.satiety).toBeLessThanOrEqual(cap);
        for (const [item, n] of Object.entries(p.outing?.gained ?? {})) {
          expect(n).toBeGreaterThan(0);
          expect(n).toBeLessThanOrEqual(p.bag[item] ?? 0);
        }
        if (isSafe(b, s, p.at)) {
          expect(p.outing).toBeNull();
          expect(p.chase).toBeNull();
        }
        if (isNight(b, tick)) nights++;
        const fall = r.events.find((e) => e.e === 'fall');
        if (fall) {
          falls++;
          expect(p.satiety).toBe(cap);
          expect(p.chase).toBeNull();
          expect(p.outing).toBeNull();
          expect(walkable(p.at[0], p.at[1], p)).toBe(true);
          expect(r.events.filter((e) => e.e === 'gain' || e.e === 'quest')).toEqual(r.events.filter((e) => e.e === 'quest'));
        }
        for (const n of Object.values(p.bag)) expect(Number.isInteger(n) && n > 0).toBe(true);
      }
      expect(nights).toBeGreaterThan(100);
      // the walk is a log: replayed from the same start it comes out the same
      const again = replay(b, init, log);
      expect(again.error).toBeUndefined();
      expect(serialize(again.state)).toBe(serialize(s));
      expect(falls).toBeGreaterThan(0);
    });
  }
});
