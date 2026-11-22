/**
 * The valley's day (GAME_RULES G16, G28; the ladder's session end and Day 2): the tally of a day counts what the
 * steps of that day changed and nothing else, a save keeps it, the day turns at each dawn of the valley's own
 * clock (never the calendar's, and not while the player is away), the dawn counts what the day worked out, a
 * line can wait for day 2, and the open door is picked from the quest state.
 */
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import {
  type Action,
  type Bundle,
  type GameEvent,
  type Rect,
  type State,
  type StepResult,
  holds,
  idiv,
  idivUp,
  lastDawn,
  newState,
  openDoor,
  pickRemark,
  searchDawn,
  serialize,
  step,
  tallyStep,
  valleyDay,
} from '@game/kernel';

import { bfsNear, loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;
beforeAll(() => {
  b = loadBundle();
});
afterEach(() => {
  vi.useRealTimers();
});

const ok = (r: StepResult): Extract<StepResult, { ok: true }> => {
  if (!r.ok) throw new Error(r.error);
  return r;
};

/** The tick of the n-th dawn (tick 0 is noon): 05:00 of the valley's day n + 1. */
const dawnTick = (n: number) => {
  const d = b.params.day_length_ms;
  return n * d - idiv(d, 2) + idivUp(5 * d, 24);
};
/** The tick of an hour on the valley's day n (day 1 is n = 0, which begins at noon of tick 0). */
const hourTick = (n: number, hour: number) => n * b.params.day_length_ms + Math.round((hour / 24) * b.params.day_length_ms) - idiv(b.params.day_length_ms, 2);

function started(seed = 11): State {
  return ok(step(b, newState(b, seed), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0)).state;
}

/** The keystone lies free once the pocket's first task is done (its `opens_after`). */
function withKeystoneOpen(s: State): State {
  for (const q of ['core/first-pickings', 'core/glint-by-the-bridge']) s.player.quests[q] = 'done';
  return s;
}

/** A tile beside a slot a character can stand on. */
function beside(s: State, slot: Rect): [number, number] {
  const view = { restored: Object.values(b.restores).filter((x) => x.passable).map((x) => x.id), camp: [] };
  const path = bfsNear(b, view, s.player.at, slot);
  if (!path) throw new Error('no tile beside the slot');
  return path.at(-1) as [number, number];
}
const nodeRect = (id: string): Rect => ({ x: b.instances[id]!.x, y: b.instances[id]!.y, w: 1, h: 1 });
const slot = (id: string): Rect => b.map.slots.find((x) => x.id === id)!;
const instanceOf = (source: string, n = 0): string => Object.keys(b.instances).filter((k) => b.instances[k]!.source === source).sort()[n]!;

/** The state with the player standing at `at`, idle since `tick`. */
function stand(s: State, at: [number, number], tick: number): State {
  return { ...s, tick, player: { ...s.player, at, movedAt: tick, busyUntil: 0 } };
}

function act(s: State, a: Action, tick: number): { s: State; events: GameEvent[] } {
  const r = ok(step(b, s, a, tick));
  return { s: r.state, events: r.events };
}

const dawns = (events: readonly GameEvent[]) => events.filter((e): e is Extract<GameEvent, { e: 'dawn' }> => e.e === 'dawn');

describe('the valley day', () => {
  test('is the count of the valley\'s own dawns: day 1 from the wake to the first dawn, then one more at each', () => {
    expect(valleyDay(b, 0)).toBe(1);
    expect(valleyDay(b, dawnTick(1) - 1)).toBe(1);
    expect(valleyDay(b, dawnTick(1))).toBe(2);
    expect(valleyDay(b, dawnTick(3))).toBe(4);
    expect(valleyDay(b, dawnTick(3)) - 1).toBe(searchDawn(b, dawnTick(3)));
    expect(lastDawn(b, 0)).toBe(-1);
    expect(lastDawn(b, dawnTick(2) + 5)).toBe(dawnTick(2));
  });
});

describe('D1: the tally of a day', () => {
  /** One scripted day at the bridge: a keystone struck free, the bridge mended with it, a recipe scrap read. */
  function scriptedDay(): { s: State; events: GameEvent[]; at: [number, number] } {
    let s = withKeystoneOpen(started());
    const events: GameEvent[] = [];
    const run = (a: Action, tick: number) => {
      const r = act(s, a, tick);
      s = r.s;
      events.push(...r.events);
    };
    const stone = instanceOf('core/keystone');
    const at = beside(s, nodeRect(stone));
    s = stand(s, at, 1000);
    run({ t: 'gather', node: stone, at }, 1000);
    // the bridge, from the tile beside its slot
    const bridge = beside(s, slot('core/old-bridge'));
    s = stand(s, bridge, 20_000);
    run({ t: 'restore', restore: 'core/old-bridge', at: bridge }, 20_000);
    // a scrap of a recipe found in the ruins: read once
    s = { ...s, player: { ...s.player, bag: { ...s.player.bag, 'core/stew-scrap': 1 }, busyUntil: 0 } };
    run({ t: 'learn', item: 'core/stew-scrap' }, 40_000);
    return { s, events, at };
  }

  test('counts a scripted day exactly: what it found, built and learned are the fixture\'s', () => {
    const { s } = scriptedDay();
    expect(s.player.day).toEqual({
      n: 1,
      found: ['core/keystone'],
      built: ['core/old-bridge'],
      learned: ['core/herb-stew'],
    });
    const { found, built, learned } = s.player.day!;
    expect([found.length, built.length, learned.length]).toEqual([1, 1, 1]);
  });

  test('counts nothing the wake gave, and nothing twice: the same ids on a later step add no more', () => {
    const r = ok(step(b, newState(b, 3), { t: 'start', race: 'core/human', name: 'Wake' }, 0));
    expect(r.state.player.day).toBeUndefined();
    const { s } = scriptedDay();
    const again = ok(step(b, s, { t: 'move', at: s.player.at }, 60_000));
    expect(again.state.player.day).toEqual(s.player.day);
  });

  test('keeps the places brought home, the camp and the nodes learned, each id once: a fold of a state against the one before', () => {
    const before = started();
    const after = structuredClone(before);
    after.player.explored = ['core/town-square', 'core/arch-mouth'];
    after.player.camp = ['core/campfire'];
    after.player.nodes = ['core/handcraft/weave'];
    after.player.recipes = [...after.player.recipes, 'core/test-recipe'].sort();
    tallyStep(b, before, after);
    expect(after.player.day).toEqual({
      n: 1,
      found: ['core/town-square', 'core/arch-mouth'],
      built: ['core/campfire'],
      learned: ['core/test-recipe', 'core/handcraft/weave'],
    });
    // folded again against itself, nothing is new
    const twice = structuredClone(after);
    tallyStep(b, after, twice);
    expect(twice.player.day).toEqual(after.player.day);
  });

  test('a save and a load keep it, and the next step goes on from it', () => {
    const { s } = scriptedDay();
    const loaded = JSON.parse(serialize(s)) as State;
    expect(loaded.player.day).toEqual(s.player.day);
    expect(serialize(loaded)).toBe(serialize(s));
    const next = ok(step(b, loaded, { t: 'move', at: loaded.player.at }, loaded.tick + 10));
    expect(next.state.player.day).toEqual(s.player.day);
  });

  test('holds integers and strings only', () => {
    const { s } = scriptedDay();
    const walk = (v: unknown): void => {
      if (typeof v === 'number') expect(Number.isInteger(v)).toBe(true);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
      else expect(['string', 'undefined']).toContain(typeof v);
    };
    walk(s.player.day);
  });

  test('closes at the dawn: the day that ended is in prev and an empty day opens', () => {
    const { s } = scriptedDay();
    const morning = ok(step(b, s, { t: 'move', at: s.player.at }, dawnTick(1)));
    expect(morning.state.player.day).toEqual({
      n: 2,
      found: [],
      built: [],
      learned: [],
      prev: { n: 1, found: ['core/keystone'], built: ['core/old-bridge'], learned: ['core/herb-stew'] },
    });
  });
});

describe('D2: the day changes once for each valley day, by the valley\'s clock', () => {
  test('the first step past each dawn tells it once, and a step at the same tick tells nothing more', () => {
    let s = started();
    const told: number[] = [];
    for (let n = 1; n <= 4; n++) {
      const before = ok(step(b, s, { t: 'move', at: s.player.at }, dawnTick(n) - 1));
      expect(dawns(before.events)).toEqual([]);
      const at = ok(step(b, before.state, { t: 'move', at: s.player.at }, dawnTick(n)));
      expect(dawns(at.events).map((e) => e.day)).toEqual([n + 1]);
      told.push(...dawns(at.events).map((e) => e.day));
      const same = ok(step(b, at.state, { t: 'move', at: s.player.at }, dawnTick(n)));
      expect(dawns(same.events)).toEqual([]);
      s = at.state;
    }
    expect(told).toEqual([2, 3, 4, 5]);
  });

  test('is never the calendar: days of wall clock pass between two steps at one tick and nothing is told', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-22T09:00:00Z'));
    const s = started();
    const at = ok(step(b, s, { t: 'move', at: s.player.at }, hourTick(0, 22)));
    // the player is away: the valley waits at the hour it was left (G28), the browser's clock runs three days on
    vi.setSystemTime(new Date('2026-11-25T09:00:00Z'));
    const back = ok(step(b, at.state, { t: 'move', at: s.player.at }, hourTick(0, 22)));
    expect(dawns(back.events)).toEqual([]);
    expect(valleyDay(b, back.state.tick)).toBe(1);
    // the next dawn of the valley's clock is the next day, and it comes once
    const morning = ok(step(b, back.state, { t: 'move', at: s.player.at }, dawnTick(1)));
    expect(dawns(morning.events).map((e) => e.day)).toEqual([2]);
  });

  test('three valley days skipped in one step tell all three, with the day that was played closed once', () => {
    const { s, events } = (() => {
      let st = withKeystoneOpen(started());
      const stone = instanceOf('core/keystone');
      const at = beside(st, nodeRect(stone));
      st = stand(st, at, 1000);
      const r = act(st, { t: 'gather', node: stone, at }, 1000);
      return { s: r.s, events: r.events };
    })();
    expect(events.some((e) => e.e === 'discover')).toBe(true);
    const away = ok(step(b, s, { t: 'move', at: s.player.at }, 3 * b.params.day_length_ms + 2000));
    expect(dawns(away.events).map((e) => e.day)).toEqual([2, 3, 4]);
    expect(away.state.player.day).toEqual({ n: 4, found: [], built: [], learned: [], prev: { n: 1, found: ['core/keystone'], built: [], learned: [] } });
  });

  test('a step that crosses more dawns than the cap tells the last ones, with the true day numbers', () => {
    const s = started();
    const far = ok(step(b, s, { t: 'move', at: s.player.at }, 30 * b.params.day_length_ms));
    const told = dawns(far.events).map((e) => e.day);
    expect(told.length).toBe(8);
    expect(told.at(-1)).toBe(valleyDay(b, 30 * b.params.day_length_ms));
  });

  test('is not told at the wake, even when the first step comes late: nobody had a day yet', () => {
    const r = ok(step(b, newState(b, 5), { t: 'start', race: 'core/human', name: 'Late' }, dawnTick(2)));
    expect(dawns(r.events)).toEqual([]);
    expect(r.state.player.day).toBeUndefined();
  });
});

describe('the dawn counts what the day worked out', () => {
  const LOGS = 'core/fallen-logs';

  /** A character with an axe at a log, at the hour of the valley's day 1. */
  function atLog(tick: number): { s: State; node: string; at: [number, number] } {
    let s = started();
    const node = instanceOf(LOGS);
    const at = beside(s, nodeRect(node));
    s = stand(s, at, tick);
    s.player.bag = { ...s.player.bag, 'core/axe': 1 };
    return { s, node, at };
  }

  test('the shipped respawn times stay: a log worked out at dusk is ready long before the dawn', () => {
    const dusk = hourTick(0, 19);
    const { s, node, at } = atLog(dusk);
    const worked = act(s, { t: 'gather', node, at }, dusk);
    const readyAt = worked.s.nodes[node]!.readyAt;
    expect(readyAt).toBeLessThan(dusk + b.resources[LOGS]!.respawn_ms * 2);
    expect(readyAt).toBeLessThan(dawnTick(1));
  });

  test('the first dawn tells how many nodes that day worked out are ready, and the dawn after tells none of them again', () => {
    const dusk = hourTick(0, 19);
    const { s, node, at } = atLog(dusk);
    const worked = act(s, { t: 'gather', node, at }, dusk);
    const first = ok(step(b, stand(worked.s, at, dawnTick(1) - 1), { t: 'move', at }, dawnTick(1)));
    expect(dawns(first.events)).toEqual([{ e: 'dawn', day: 2, renewed: 1 }]);
    const second = ok(step(b, stand(first.state, at, dawnTick(2) - 1), { t: 'move', at }, dawnTick(2)));
    expect(dawns(second.events)).toEqual([{ e: 'dawn', day: 3, renewed: 0 }]);
  });
});

describe('a line that waits for the morning', () => {
  test('day_min holds from the dawn of that day on, by the valley\'s clock', () => {
    const s = started();
    const when = { day_min: 2 };
    expect(holds(b, s, when, hourTick(0, 22))).toBe(false);
    expect(holds(b, s, when, dawnTick(1))).toBe(true);
    expect(holds(b, s, { day_min: 3 }, dawnTick(1))).toBe(false);
    expect(holds(b, s, { day_min: 3 }, dawnTick(2))).toBe(true);
  });

  test('Maru has a line only from day 2, said once', () => {
    const s = started();
    const day2 = pickRemark(b, s, 'core/elder', new Set(), dawnTick(1) + 1000);
    const day1 = pickRemark(b, s, 'core/elder', new Set(), hourTick(0, 22));
    expect(day1).toBeUndefined();
    expect(day2).toBeDefined();
    expect(pickRemark(b, s, 'core/elder', new Set([day2!.key]), dawnTick(1) + 1000)).toBeUndefined();
  });
});

describe('the open door', () => {
  const quests = (done: string[], active: string[] = []): State => {
    const s = started();
    for (const q of done) s.player.quests[q] = 'done';
    for (const q of active) s.player.quests[q] = 'active';
    return s;
  };

  test('is a task a character has for the player, once its requirements are done', () => {
    const s = quests(['core/fix-the-bridge', 'core/first-fire', 'core/into-town']);
    const door = openDoor(b, s);
    expect(door).toBeDefined();
    expect(door!.kind).toBe('quest');
    if (door!.kind === 'quest') {
      expect(door!.begun).toBe(false);
      expect(door!.giver).toBeDefined();
      expect(b.quests[door!.quest]!.requires!.every((r) => s.player.quests[r] === 'done')).toBe(true);
    }
  });

  test('is the same for the same state, and moves on when its task is taken', () => {
    const done = ['core/fix-the-bridge', 'core/first-fire', 'core/into-town'];
    const first = openDoor(b, quests(done));
    expect(openDoor(b, quests(done))).toEqual(first);
    const taken = quests(done, [first!.kind === 'quest' ? first!.quest : '']);
    const next = openDoor(b, taken);
    expect(next).not.toEqual(first);
  });

  test('falls back to a task begun, then to a named place not entered, and is none when nothing waits', () => {
    const all = Object.keys(b.quests);
    const onlyActive = quests(all.filter((q) => q !== 'core/the-long-night'), ['core/the-long-night']);
    expect(openDoor(b, onlyActive)).toEqual({ kind: 'quest', quest: 'core/the-long-night', giver: 'core/elder', begun: true });
    const placeOnly = quests(all);
    const door = openDoor(b, placeOnly);
    expect(door?.kind).toBe('place');
    const named = b.map.slots.filter((x) => x.kind === 'area' && x.label !== undefined).map((x) => x.id);
    placeOnly.player.seen = named;
    expect(openDoor(b, placeOnly)).toBeUndefined();
  });

  test('names a task by its title and its giver: the text is the content\'s own', () => {
    const s = quests(['core/fix-the-bridge', 'core/first-fire', 'core/into-town']);
    const door = openDoor(b, s)!;
    if (door.kind !== 'quest') throw new Error('not a task');
    expect(b.quests[door.quest]!.title.length).toBeGreaterThan(0);
    expect(b.npcs[door.giver!]!.name.length).toBeGreaterThan(0);
  });
});
