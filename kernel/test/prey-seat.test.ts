/**
 * An animal that was taken comes back at another spot of its kind (the owner, 28.11.2026: "not from the same place";
 * public #930). The animal keeps its spot index as its name; `player.preySeats` says which spot it lives at now, drawn
 * once at the take from the world's secret key, never the seat it was taken from. The return time is unchanged.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Action,
  type State,
  type Tile,
  type WildSense,
  adaptState,
  newState,
  preyKey,
  seatOf,
  step,
  stonePrey,
  walkableFor,
  wildAnimal,
  wildReach,
  wildKindOf,
  wildStep,
  wildWorld,
} from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

const STONE = 'core/stone';
const STILL: WildSense = { face: [0, 1], gait: 'still', asleep: false };
let bundle: ReturnType<typeof loadBundle>;
beforeAll(() => { bundle = loadBundle(); });

function started(b = bundle, seed = 930): State {
  const r = step(b, newState(b, seed), { t: 'start', race: 'core/human', name: 'Seat' }, 0);
  if (!r.ok) throw new Error(r.error);
  r.state.player.bag = { [STONE]: 9 };
  return r.state;
}

const hares = (b = bundle) => b.map.creatures!.spots.map((sp, i) => ({ sp, i })).filter(({ sp }) => sp.kind === 'core/hare');

/** A walkable tile beside `tile`, for the figure to stand on. */
function beside(b: typeof bundle, s: State, tile: Tile): Tile {
  const walk = walkableFor(b);
  const at = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([dx, dy]) => [tile[0] + dx, tile[1] + dy] as Tile).find(([x, y]) => walk(x, y, s.player));
  if (!at) throw new Error(`no standing tile beside ${tile}`);
  return at;
}

/** The sure throw of a short charge at the spot's own tile (no `stands`: the animal stands at its seat). */
function take(b: typeof bundle, s: State, index: number, tick: number): State {
  const sp = seatOfSpot(b, s, index);
  s.player.at = beside(b, s, [sp.x, sp.y]);
  const act: Action = { t: 'throw', at: s.player.at, aim: [sp.x, sp.y], kind: STONE, power: b.params.stones.throw_min_power, prey: index };
  const r = step(b, s, act, tick);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** Where the animal lives now, read by hand from the save, so the helper does not lean on the code under test. */
function seatOfSpot(b: typeof bundle, s: State, index: number) {
  const spots = b.map.creatures!.spots;
  const home = spots[index]!;
  const seatKey = (s.player as { preySeats?: Record<string, string> }).preySeats?.[preyKey(home)];
  return (seatKey && spots.find((x) => preyKey(x) === seatKey)) || home;
}

describe('an animal taken at one spot returns at another of its kind', () => {
  test('taken at A, its seat is a different spot B of the same kind, and the return time is the one it had', () => {
    const { i, sp } = { i: hares()[0]!.i, sp: hares()[0]!.sp };
    const s = take(bundle, started(), i, 0);
    const seats = (s.player as { preySeats?: Record<string, string> }).preySeats;
    const seat = seats?.[preyKey(sp)];
    expect(seat, 'a seat is recorded for the taken animal').toBeDefined();
    expect(seat).not.toBe(preyKey(sp));
    const b = bundle.map.creatures!.spots.find((x) => preyKey(x) === seat)!;
    expect(b.kind).toBe(sp.kind);
    // the return time is today's refill, untouched
    expect(s.player.preyReturns![preyKey(sp)]).toBe(bundle.params.hunt ? (bundle.map.creatures!.kinds[sp.kind]!.hunt!.spawn!.refill_d * bundle.params.day_length_ms) : 0);
  });

  test('the world puts the animal at B when it is back, and nothing stands at A on its account', () => {
    const { i, sp } = { i: hares()[0]!.i, sp: hares()[0]!.sp };
    const s = take(bundle, started(), i, 0);
    const to = seatOfSpot(bundle, s, i);
    expect(preyKey(to)).not.toBe(preyKey(sp));
    const back = bundle.map.creatures!.kinds[sp.kind]!.hunt!.spawn!.refill_d * bundle.params.day_length_ms;
    const w = wildWorld(bundle);
    // the figure stands by B so that animal is stepped; a day of hours is chosen where hares are awake
    s.player.at = beside(bundle, s, [to.x, to.y]);
    const day = bundle.params.day_length_ms;
    const noon = back + day / 2 - (back % day);
    for (let ms = noon; ms <= noon + 3_000; ms += 100) wildStep(bundle, w, s, STILL, ms);
    const a = wildAnimal(w, i)!;
    expect(a.stepped).toBe(true);
    expect(a.c.anchor).toBe(preyKey(to));
    const reach = wildReach(wildKindOf(bundle, sp.kind)!);
    expect((a.c.at[0] - to.x) ** 2 + (a.c.at[1] - to.y) ** 2).toBeLessThanOrEqual(reach * reach);
    expect((a.c.at[0] - sp.x) ** 2 + (a.c.at[1] - sp.y) ** 2).toBeGreaterThan(0);
  });

  test('a take of the returned animal is held to B: the stone names where it stands now', () => {
    const { i, sp } = { i: hares()[0]!.i, sp: hares()[0]!.sp };
    const s = take(bundle, started(), i, 0);
    const to = seatOfSpot(bundle, s, i);
    const back = bundle.map.creatures!.kinds[sp.kind]!.hunt!.spawn!.refill_d * bundle.params.day_length_ms;
    s.player.at = beside(bundle, s, [to.x, to.y]);
    s.player.bag[bundle.params.hunt.throw_item] = 1;
    // B, not A, is where it can be taken now; at A there is nothing of it
    expect(stonePrey(bundle, s, back, i, s.player.at, [to.x, to.y])).toBeDefined();
    s.player.at = beside(bundle, s, [sp.x, sp.y]);
    expect(stonePrey(bundle, s, back, i, s.player.at, [sp.x, sp.y])).toBeUndefined();
  });

  test('the seat is deterministic for a seed, and different seeds do not all choose alike', () => {
    const { i, sp } = { i: hares()[0]!.i, sp: hares()[0]!.sp };
    const seatFor = (seed: number) => (take(bundle, started(bundle, seed), i, 0).player as { preySeats?: Record<string, string> }).preySeats![preyKey(sp)];
    expect(seatFor(930)).toBe(seatFor(930));
    const seen = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(seatFor));
    expect(seen.size).toBeGreaterThan(1);
    expect(seen.has(preyKey(sp))).toBe(false);
  });

  test('the next take of another animal fills the empty seat first (least occupied), never the seat it came from', () => {
    const [h0, h1] = [hares()[0]!, hares()[1]!];
    let s = take(bundle, started(), h0.i, 0);
    const seatA = preyKey(h0.sp);
    const second = take(bundle, s, h1.i, s.player.busyUntil);
    const seats = (second.player as { preySeats?: Record<string, string> }).preySeats!;
    expect(seats[preyKey(h1.sp)]).toBe(seatA);
    s = second;
    // a third animal's seat is never the seat it stands at
    const h2 = hares()[2]!;
    const third = take(bundle, s, h2.i, s.player.busyUntil);
    expect((third.player as { preySeats?: Record<string, string> }).preySeats![preyKey(h2.sp)]).not.toBe(preyKey(h2.sp));
  });

  test('a kind with one spot keeps it: no seat is recorded and it is taken there again', () => {
    const b = structuredClone(bundle);
    const keep = hares(b)[0]!;
    b.map.creatures!.spots = b.map.creatures!.spots.filter((x) => x.kind !== 'core/hare' || x === keep.sp);
    const i = b.map.creatures!.spots.indexOf(keep.sp);
    const s = take(b, started(b), i, 0);
    expect((s.player as { preySeats?: Record<string, string> }).preySeats ?? {}).toEqual({});
    expect(preyKey(seatOfSpot(b, s, i))).toBe(preyKey(keep.sp));
    const back = b.map.creatures!.kinds['core/hare']!.hunt!.spawn!.refill_d * b.params.day_length_ms;
    s.player.bag[b.params.hunt.throw_item] = 1;
    s.player.at = beside(b, s, [keep.sp.x, keep.sp.y]);
    expect(stonePrey(b, s, back, i, s.player.at)).toBeDefined();
  });

  test('an old save with no seats reads every animal at its own spot', () => {
    const s = started();
    expect((s.player as { preySeats?: unknown }).preySeats).toBeUndefined();
    for (const { sp, i } of hares()) expect(seatOf(bundle, s, i)).toEqual(sp);
    const saved = JSON.parse(JSON.stringify(s)) as State;
    expect(adaptState(bundle, saved)!.player).not.toHaveProperty('preySeats');
  });

  test('a seat whose spot left the map is dropped on load: the animal goes home', () => {
    const { i, sp } = { i: hares()[0]!.i, sp: hares()[0]!.sp };
    const s = take(bundle, started(), i, 0);
    const p = s.player as { preySeats?: Record<string, string> };
    p.preySeats![preyKey(sp)] = 'core/hare@999,999';
    const a = adaptState(bundle, JSON.parse(JSON.stringify(s)) as State)!.player as { preySeats?: Record<string, string> };
    expect(a.preySeats ?? {}).toEqual({});
  });
});
