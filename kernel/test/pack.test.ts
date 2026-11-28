/**
 * The pack a fall leaves (G33, G81; DECISIONS.md, 2026-11-27 "What the game is, and six rulings", ruling 2): what an
 * outing gathered lies where the body fell, whole, for a game day; the player can walk back and take it. Same world
 * as hazards.test.ts: a copy of the bundle with one deadly pit.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Action, type Bundle, type GameEvent, type State, newState, packsAt, serialize, step } from '@game/kernel';

import { loadPixelBundle } from '../../tools/test/helpers/world.js';

type Tile = [number, number];
type Prop = Bundle['map']['props'][number];

/** 21:20, a third of the way into the night (tick 0 is noon; night runs 400000 to 850000 of a 1200000 day). */
const NIGHT = 500_000;
/** Noon of the next day: no pit wakes. */
const NEXT_NOON = 1_300_000;

let base: Bundle;
beforeAll(() => {
  base = loadPixelBundle();
});

const pit = (x: number, y: number): Prop => ({
  id: 'test/pit',
  sprite: 'core/base-kit:props/standing_stone',
  x,
  y,
  w: 1,
  h: 1,
  solid: false,
  hazard: { kind: 'pit', window: ['night'] },
});

/** Every pit takes the whole bar. */
function world(): Bundle {
  const b = structuredClone(base);
  b.map.props = [...b.map.props.filter((p) => !p.hazard), pit(7, 22)];
  b.params.hazard.pit.harm_pct = 100;
  return b;
}

function begin(b: Bundle): State {
  const r = step(b, newState(b, 7), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

function place(s: State, at: Tile, tick: number): State {
  const out = structuredClone(s);
  out.player.at = [...at];
  out.player.movedAt = tick;
  out.player.busyUntil = Math.min(out.player.busyUntil, tick);
  out.tick = tick;
  return out;
}

function ok(b: Bundle, s: State, a: Action, tick: number): { state: State; events: GameEvent[] } {
  const r = step(b, s, a, tick);
  if (!r.ok) throw new Error(`${a.t} refused: ${r.error}`);
  return { state: r.state, events: r.events };
}

const refused = (b: Bundle, s: State, a: Action, tick: number): string => {
  const r = step(b, s, a, tick);
  if (r.ok) throw new Error(`${a.t} was not refused`);
  return r.error;
};

const move = (b: Bundle, s: State, at: Tile, tick: number) => ok(b, s, { t: 'move', at }, tick);
const stone = 'core/river-stones#0';

/** The forager gathers a stone on the west bank, walks to the pit and falls into it at night. */
function fallWithAStone(b: Bundle, from = begin(b)): { state: State; events: GameEvent[]; tick: number } {
  const inst = b.instances[stone]!;
  const standing: Tile = [inst.x, inst.y + 1];
  const gathered = ok(b, place(from, standing, 100), { t: 'gather', node: stone, grade: 3, at: standing }, 100).state;
  const tick = NIGHT + 190;
  const r = move(b, place(gathered, [6, 22], NIGHT), [7, 22], tick);
  return { ...r, tick };
}

describe('the pack a fall leaves', () => {
  test('a fall leaves what the outing gathered where the body fell, and nothing else', () => {
    const b = world();
    const { state, events, tick } = fallWithAStone(b);
    expect(state.player.bag['core/stone']).toBeUndefined();
    expect(state.player.packs).toEqual([{ id: 1, at: [7, 22], items: { 'core/stone': 1 }, until: tick + b.params.day_length_ms }]);
    expect(events.find((e) => e.e === 'pack')).toEqual({ e: 'pack', pack: 1, at: [7, 22], until: tick + b.params.day_length_ms });
    // what the outing did not bring stays in the bag
    expect(state.player.bag['core/axe']).toBe(1);
  });

  test('a fall that lost nothing leaves no pack', () => {
    const b = world();
    const s = move(b, place(begin(b), [6, 22], NIGHT), [7, 22], NIGHT + 190);
    expect(s.events.some((e) => e.e === 'fall')).toBe(true);
    expect(s.state.player.packs ?? []).toEqual([]);
    expect(s.events.some((e) => e.e === 'pack')).toBe(false);
  });

  test('the player walks back and takes it whole; it joins the new outing as a find', () => {
    const b = world();
    const fell = fallWithAStone(b);
    // the next noon the pit sleeps: the player is out again, next to the place
    let s = move(b, place(fell.state, [5, 22], NEXT_NOON - 1000), [6, 22], NEXT_NOON).state;
    expect(s.player.outing).not.toBeNull();
    expect(packsAt(s, NEXT_NOON)).toHaveLength(1);
    const r = ok(b, s, { t: 'takepack', pack: 1, at: [6, 22] }, NEXT_NOON + 100);
    s = r.state;
    expect(s.player.bag['core/stone']).toBe(1);
    expect(s.player.packs ?? []).toEqual([]);
    expect(r.events.find((e) => e.e === 'unpack')).toEqual({ e: 'unpack', pack: 1, items: [{ item: 'core/stone', qty: 1 }] });
    // taken on a walk, it is that walk's find: a second fall takes it again, into a pack of its own
    expect(s.player.outing!.gained['core/stone']).toBe(1);
    const again = move(b, place(s, [6, 22], NIGHT + 1_200_000), [7, 22], NIGHT + 1_200_190);
    expect(again.state.player.bag['core/stone']).toBeUndefined();
    expect(again.state.player.packs).toMatchObject([{ id: 2, at: [7, 22], items: { 'core/stone': 1 } }]);
  });

  test('a pack out of reach is refused, and so is one that is not there', () => {
    const b = world();
    const fell = fallWithAStone(b);
    const near = place(fell.state, [3, 22], NEXT_NOON);
    expect(refused(b, near, { t: 'takepack', pack: 1, at: [3, 22] }, NEXT_NOON)).toBe('That is too far away.');
    const by = place(fell.state, [6, 22], NEXT_NOON);
    expect(refused(b, by, { t: 'takepack', pack: 9, at: [6, 22] }, NEXT_NOON)).toBe('There is nothing like that here.');
  });

  test('it is gone a game day after the fall, to the tick', () => {
    const b = world();
    const fell = fallWithAStone(b);
    const until = fell.tick + b.params.day_length_ms;
    const by = (tick: number) => place(fell.state, [6, 22], tick);
    // the last tick it lies: takeable
    expect(packsAt(fell.state, until - 1)).toHaveLength(1);
    ok(b, by(until - 1), { t: 'takepack', pack: 1, at: [6, 22] }, until - 1);
    // the tick it is gone: not drawn, not takeable, and the next step sweeps it out of the save
    expect(packsAt(fell.state, until)).toHaveLength(0);
    expect(refused(b, by(until), { t: 'takepack', pack: 1, at: [6, 22] }, until)).toBe('There is nothing like that here.');
    const swept = ok(b, by(until), { t: 'move', at: [5, 22] }, until + 10).state;
    expect(swept.player.packs ?? []).toEqual([]);
  });

  test('a second fall before the first pack is taken leaves a second pack beside it, each with its own day', () => {
    const b = world();
    const first = fallWithAStone(b);
    // the player is out again at the second night and falls again on the same tile, with a new find
    const inst = b.instances['core/river-stones#1'] ?? b.instances[stone]!;
    const standing: Tile = [inst.x, inst.y + 1];
    const t2 = NIGHT + 60_000; // the same night: the first pack's day is not over
    let s = place(first.state, standing, t2 - 5000);
    s.player.bag['core/berry'] = 2;
    s = move(b, s, [standing[0] + 1, standing[1]], t2 - 4000).state;
    s.player.outing!.gained['core/berry'] = 2;
    const second = move(b, place(s, [6, 22], t2), [7, 22], t2 + 190);
    const packs = second.state.player.packs!;
    expect(packs.map((p) => p.id)).toEqual([1, 2]);
    expect(packs[0]).toMatchObject({ items: { 'core/stone': 1 }, until: first.tick + b.params.day_length_ms });
    expect(packs[1]).toMatchObject({ items: { 'core/berry': 2 }, until: t2 + 190 + b.params.day_length_ms });
  });

  test('a save with no pack field reads as no pack lying, and a pack survives a save and a load', () => {
    const b = world();
    const fell = fallWithAStone(b);
    const loaded = JSON.parse(serialize(fell.state)) as State;
    expect(loaded.player.packs).toEqual(fell.state.player.packs);
    const old = structuredClone(begin(b));
    delete old.player.packs;
    expect(packsAt(old, 0)).toEqual([]);
  });

  test('a bag with no room takes what fits and leaves the rest lying with its day; a full bag refuses', () => {
    const b = world();
    const fell = fallWithAStone(b);
    const s = place(fell.state, [6, 22], NEXT_NOON);
    // the pack held three berries; the bag takes one of them
    s.player.packs![0]!.items = { 'core/berry': 3 };
    b.params.place_stack = 1;
    const keep = Object.keys(s.player.bag).length;
    b.params.bag_base = keep + 1;
    const r = ok(b, s, { t: 'takepack', pack: 1, at: [6, 22] }, NEXT_NOON);
    expect(r.state.player.bag['core/berry']).toBe(1);
    expect(r.state.player.packs).toMatchObject([{ id: 1, items: { 'core/berry': 2 }, until: fell.tick + b.params.day_length_ms }]);
    expect(refused(b, place(r.state, [6, 22], NEXT_NOON + 10), { t: 'takepack', pack: 1, at: [6, 22] }, NEXT_NOON + 10)).toBe('Your bag is full.');
  });

  test('the spoilage of a hunt good runs on while it lies in the pack, and comes back with it', () => {
    const b = world();
    const fell = fallWithAStone(b);
    const s = place(fell.state, [6, 22], NEXT_NOON);
    const pack = s.player.packs![0]!;
    pack.items = { 'core/berry': 3 };
    pack.batches = { 'core/berry': [{ qty: 1, until: NEXT_NOON - 1 }, { qty: 2, until: NEXT_NOON + 500_000 }] };
    const r = ok(b, s, { t: 'takepack', pack: 1, at: [6, 22] }, NEXT_NOON);
    expect(r.state.player.bag['core/berry']).toBe(2);
    expect(r.state.player.huntStock?.bag['core/berry']).toEqual([{ qty: 2, until: NEXT_NOON + 500_000 }]);
    expect(r.state.player.packs ?? []).toEqual([]);
  });
});
