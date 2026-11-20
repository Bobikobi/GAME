/**
 * The sea crossing (docs/design/SEA_CROSSING.md; EXPERIENCE_AUDIT.md gap M1): one keyed draw at boarding picks the
 * crossing's event from a weighted table, the boat moves one segment per act, and a miss puts the player in at the
 * jetty they left, never overboard and never a loss from the bag (section 5, measurables 1 to 4).
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Bundle,
  type GameEvent,
  type PassageDef,
  type State,
  type StepResult,
  adaptState,
  exitRect,
  hourOf,
  isSafe,
  near,
  newState,
  seaEventIndex,
  seaPick,
  seaWindow,
  step,
} from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

const BAY = 'core/bay-crossing';
const GATE = 'core/a-coin-for-maru';
let b: Bundle;
let p: PassageDef;
let jetty: [number, number];

const ok = (r: StepResult): Extract<StepResult, { ok: true }> => {
  if (!r.ok) throw new Error(r.error);
  return r;
};
const fail = (r: StepResult): string => {
  if (r.ok) throw new Error('the step went through');
  return r.error;
};

/** A started human with the town beat behind, so the boat takes them; tick 0 is noon, inside the boat's hours. */
function started(seed = 7): State {
  const s = ok(step(b, newState(b, seed), { t: 'start', race: 'core/human', name: 'Sailor' }, 0)).state;
  s.player.quests[GATE] = 'done';
  return s;
}

beforeAll(() => {
  b = loadBundle();
  p = b.passages[BAY]!;
  // the first tile beside the ferry exit a started character can board from
  const r = exitRect(b, p.from)!;
  const s = started();
  for (let y = r.y - 1; y <= r.y + r.h && !jetty; y++) {
    for (let x = r.x - 1; x <= r.x + r.w && !jetty; x++) {
      if (near([x, y], r) && step(b, s, { t: 'board', passage: BAY, at: [x, y] }, 0).ok) jetty = [x, y];
    }
  }
});

/** A started character standing on the jetty whose next crossing draws the event `id`. */
function readyFor(id: string, seed = 7): State {
  const s = started(seed);
  const want = p.events.findIndex((e) => e.id === id);
  let n = 0;
  while (seaEventIndex(p, s.seed, n) !== want) n++;
  s.player.crossings = n;
  s.player.at = [jetty[0], jetty[1]];
  return s;
}

/** Board at tick 0, then sail `count` segments a segment apart; the last result is returned. */
function sailFrom(s: State, count: number, first = p.segment_ms): { s: State; tick: number; events: GameEvent[] } {
  let tick = first;
  const events: GameEvent[] = [];
  for (let i = 0; i < count; i++, tick += p.segment_ms) {
    const r = ok(step(b, s, { t: 'sail' }, tick));
    s = r.state;
    events.push(...r.events);
    if (!s.player.aboard) break;
  }
  return { s, tick, events };
}
const board = (s: State) => ok(step(b, s, { t: 'board', passage: BAY, at: jetty }, 0));

describe('the content', () => {
  test('the bay has one passage from the ferry exit with five events, each of a different type (G17)', () => {
    expect(Object.keys(b.passages)).toEqual([BAY]);
    expect(p.from).toBe('core/ferry');
    expect(p.events).toHaveLength(5);
    expect(new Set(p.events.map((e) => e.type)).size).toBe(5);
    expect(jetty).toBeDefined();
  });
});

describe('the roll', () => {
  test('the same seed and crossing count draw the same event, and boarding draws exactly that one (measurable 1)', () => {
    const s = started();
    for (let n = 0; n < 1000; n++) expect(seaEventIndex(p, s.seed, n)).toBe(seaEventIndex(p, structuredClone(s.seed), n));
    s.player.at = [jetty[0], jetty[1]];
    s.player.crossings = 41;
    const r = board(s);
    expect(r.events).toContainEqual({ e: 'board', passage: BAY, event: p.events[seaEventIndex(p, s.seed, 41)]!.id });
    expect(r.state.player.crossings).toBe(42);
    expect(r.state.player.aboard?.event).toBe(seaEventIndex(p, s.seed, 41));
  });

  test('every basis point picks by the running sums: each event takes its weight\'s share of the 10,000 exactly', () => {
    const counts = p.events.map(() => 0);
    for (let bp = 0; bp < 10_000; bp++) counts[seaPick(p, bp)]! += 1;
    const total = p.events.reduce((n, e) => n + e.weight, 0);
    p.events.forEach((e, i) => expect(Math.abs(counts[i]! - (10_000 * e.weight) / total)).toBeLessThanOrEqual(1));
  });

  test('over 10,000 crossings of each of five characters the shares are within a point of the weights (measurable 2)', () => {
    // one character's 10,000 alone sits within a point only at about two standard deviations for a 3-in-10 event
    const counts = p.events.map(() => 0);
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = started(seed);
      for (let n = 0; n < 10_000; n++) counts[seaEventIndex(p, s.seed, n)]! += 1;
    }
    const total = p.events.reduce((n, e) => n + e.weight, 0);
    p.events.forEach((e, i) => expect(Math.abs(counts[i]! / 500 - (100 * e.weight) / total)).toBeLessThan(1));
  });
});

describe('a crossing', () => {
  test('eight acts make a crossing: a missed "on" event lets it go on, and it lands at the jetty with the bag as it was (measurables 3, 4)', () => {
    const s = readyFor('core/drifting-crate');
    const bag = structuredClone(s.player.bag);
    const r = board(s);
    expect(r.state.player.aboard).toMatchObject({ passage: BAY, segment: 0, outcome: 'open' });
    expect(isSafe(b, r.state, r.state.player.at, 0)).toBe(true);
    const run = sailFrom(r.state, 99);
    const sails = run.events.filter((e) => e.e === 'sail');
    expect(sails).toHaveLength(p.segments);
    expect(run.events).toContainEqual({ e: 'sea', passage: BAY, event: 'core/drifting-crate', outcome: 'missed' });
    expect(run.events.at(-1)).toEqual({ e: 'land', passage: BAY, at: jetty, back: false });
    expect(run.s.player.aboard).toBeNull();
    expect(run.s.player.at).toEqual(jetty);
    expect(run.s.player.bag).toEqual(bag);
    const ms = p.segments * p.segment_ms;
    expect(ms).toBeGreaterThanOrEqual(60_000);
    expect(ms).toBeLessThanOrEqual(150_000);
  });

  test('the sign shows a segment before the window, and an answer is taken only inside it', () => {
    const e = p.events.find((x) => x.id === 'core/drifting-crate')!;
    const { first, last } = seaWindow(p, e);
    expect(first).toBeGreaterThanOrEqual(2);
    expect(last).toBeLessThan(p.segments);
    let s = board(readyFor(e.id)).state;
    expect(fail(step(b, s, { t: 'answer' }, 1))).toBe('Nothing to answer now.');
    s = sailFrom(s, first).s;
    expect(s.player.aboard?.segment).toBe(first);
    const r = ok(step(b, s, { t: 'answer' }, first * p.segment_ms + 1));
    expect(r.events).toContainEqual({ e: 'sea', passage: BAY, event: e.id, outcome: 'met' });
    expect(r.state.player.bag['core/reed-cord']).toBe((s.player.bag['core/reed-cord'] ?? 0) + 2);
    expect(fail(step(b, r.state, { t: 'answer' }, first * p.segment_ms + 2))).toBe('Nothing to answer now.');
  });

  test('a "back" miss turns the boat for the jetty it left, never overboard, the bag kept', () => {
    const e = p.events.find((x) => x.id === 'core/squall')!;
    expect(e.miss).toBe('back');
    const s = readyFor(e.id);
    const bag = structuredClone(s.player.bag);
    const run = sailFrom(board(s).state, 99);
    const { last } = seaWindow(p, e);
    expect(run.events.filter((x) => x.e === 'sail')).toHaveLength(last + 1);
    expect(run.events.at(-1)).toEqual({ e: 'land', passage: BAY, at: jetty, back: true });
    expect(run.s.player.aboard).toBeNull();
    expect(run.s.player.at).toEqual(jetty);
    expect(run.s.player.bag).toEqual(bag);
  });

  test('a tend is held once a segment until its count is met', () => {
    const e = p.events.find((x) => x.id === 'core/squall')!;
    const times = e.act.kind === 'tend' ? e.act.times : 0;
    const { first } = seaWindow(p, e);
    let { s, tick } = sailFrom(board(readyFor(e.id)).state, first);
    for (let i = 1; i <= times; i++) {
      const r = ok(step(b, s, { t: 'answer' }, tick));
      expect(r.events).toContainEqual({ e: 'sea', passage: BAY, event: e.id, outcome: i < times ? 'held' : 'met' });
      s = r.state;
      if (i < times) {
        expect(fail(step(b, s, { t: 'answer' }, tick + 1))).toBe('Once is enough for now.');
        s = ok(step(b, s, { t: 'sail' }, tick)).state;
        tick += p.segment_ms;
      }
    }
    expect(s.player.aboard?.outcome).toBe('met');
    expect(s.player.gold).toBe(e.reward.gold_mg);
  });

  test('a riddle answered wrongly is a miss, answered rightly it pays', () => {
    const e = p.events.find((x) => x.id === 'core/fog-bell')!;
    if (e.act.kind !== 'riddle') throw new Error('not a riddle');
    const { first } = seaWindow(p, e);
    const { s, tick } = sailFrom(board(readyFor(e.id)).state, first);
    const wrong = ok(step(b, s, { t: 'answer', choice: (e.act.answer + 1) % e.act.choices.length }, tick));
    expect(wrong.events).toContainEqual({ e: 'sea', passage: BAY, event: e.id, outcome: 'missed' });
    expect(wrong.events.at(-1)).toEqual({ e: 'land', passage: BAY, at: jetty, back: true });
    expect(fail(step(b, s, { t: 'answer' }, tick))).toBe('Which way?');
    const right = ok(step(b, s, { t: 'answer', choice: e.act.answer }, tick));
    expect(right.events).toContainEqual({ e: 'sea', passage: BAY, event: e.id, outcome: 'met' });
    expect(right.state.player.bag['core/moonreed']).toBe((s.player.bag['core/moonreed'] ?? 0) + 1);
  });

  test('a bring takes what it asks for, and without it there is no answer', () => {
    const e = p.events.find((x) => x.id === 'core/passenger')!;
    if (e.act.kind !== 'bring') throw new Error('not a bring');
    const { first } = seaWindow(p, e);
    const { s, tick } = sailFrom(board(readyFor(e.id)).state, first);
    const without = structuredClone(s);
    delete without.player.bag[e.act.item];
    expect(fail(step(b, without, { t: 'answer' }, tick))).toMatch(/^You have no /);
    const holding = structuredClone(s);
    holding.player.bag[e.act.item] = e.act.qty;
    const r = ok(step(b, holding, { t: 'answer' }, tick));
    expect(r.state.player.bag[e.act.item] ?? 0).toBe(0);
    expect(r.state.player.gold).toBe(holding.player.gold + e.reward.gold_mg!);
  });
});

describe('refusals', () => {
  test('no boat before the town beat of the opening: Maru\'s coin opens it, and nothing is drawn or counted before', () => {
    expect(p.requires).toEqual([GATE]);
    const s = readyFor('core/drifting-crate');
    const crossings = s.player.crossings;
    delete s.player.quests[GATE];
    expect(fail(step(b, s, { t: 'board', passage: BAY, at: jetty }, 0))).toBe('Not yet.');
    s.player.quests[GATE] = 'active';
    expect(fail(step(b, s, { t: 'board', passage: BAY, at: jetty }, 0))).toBe('Not yet.');
    expect(s.player.crossings).toBe(crossings);
    s.player.quests[GATE] = 'done';
    expect(ok(step(b, s, { t: 'board', passage: BAY, at: jetty }, 0)).state.player.aboard?.passage).toBe(BAY);
  });

  test('no boat away from the jetty, out of hours, or for a passage that does not exist', () => {
    const s = readyFor('core/drifting-crate');
    expect(fail(step(b, s, { t: 'board', passage: 'core/nowhere', at: jetty }, 0))).toBe('No boat goes from here.');
    expect(fail(step(b, s, { t: 'board', passage: BAY, at: b.map.spawn.x === jetty[0] && b.map.spawn.y === jetty[1] ? [0, 0] : [b.map.spawn.x, b.map.spawn.y] }, 0))).not.toBe('');
    let late = 0;
    while (hourOf(b, late) !== 20) late += Math.floor(b.params.day_length_ms / 24);
    expect(fail(step(b, s, { t: 'board', passage: BAY, at: jetty }, late))).toBe('No boat leaves at this hour.');
  });

  test('aboard, nothing but the crossing\'s own acts; ashore, no sail and no answer', () => {
    const ashore = readyFor('core/drifting-crate');
    expect(fail(step(b, ashore, { t: 'sail' }, 0))).toBe('You are not on a boat.');
    expect(fail(step(b, ashore, { t: 'answer' }, 0))).toBe('You are not on a boat.');
    const aboard = board(ashore).state;
    expect(fail(step(b, aboard, { t: 'move', at: jetty }, 1))).toBe('Not from the boat.');
    expect(fail(step(b, aboard, { t: 'board', passage: BAY, at: jetty }, 1))).toBe('Not from the boat.');
    const sailing = ok(step(b, aboard, { t: 'sail' }, 1)).state;
    expect(fail(step(b, sailing, { t: 'sail' }, 2))).toBe('You are still busy.');
  });
});

describe('a save', () => {
  test('a crossing whose passage left the content puts in at the jetty it left', () => {
    const s = board(readyFor('core/drifting-crate')).state;
    const gone = structuredClone(b);
    delete gone.passages[BAY];
    expect(adaptState(gone, s)!.player.aboard).toBeNull();
    expect(adaptState(b, s)!.player.aboard).toEqual(s.player.aboard);
  });
});
