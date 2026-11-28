/**
 * The charged throw at small game (public #923): a stone thrown at a hare takes it when the flight comes down within
 * `hunt.hit_tiles` of where it stands, so the charge has to suit the distance; a stone that misses lands, can be lifted again
 * and startles the hare. The three wake pockets each have a hare within reach of the wake tile or one step from it.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Action,
  type State,
  type Tile,
  type WildSense,
  FULL_POWER,
  hourOf,
  huntReach,
  newState,
  step,
  walkableFor,
  wildAnimal,
  wildNoise,
  wildStep,
  wildWorld,
} from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

const STONE = 'core/stone';
let bundle: ReturnType<typeof loadBundle>;
beforeAll(() => { bundle = loadBundle(); });

function started(b = bundle): State {
  const r = step(b, newState(b, 923), { t: 'start', race: 'core/human', name: 'Hand' }, 0);
  if (!r.ok) throw new Error(r.error);
  const s = r.state;
  s.player.bag = { [STONE]: 3 };
  return s;
}

const hareSpots = (b = bundle) => b.map.creatures!.spots.map((sp, i) => ({ sp, i })).filter(({ sp }) => sp.kind === 'core/hare');
const throwAt = (s: State, hare: number, aim: Tile, power: number, stands?: Tile): Action => ({ t: 'throw', at: s.player.at, aim, kind: STONE, power, prey: hare, ...(stands ? { stands } : {}) });

/**
 * A bundle whose first hare stands where a row of tiles runs clear six one way and nine the other (so a flight that runs past
 * the hare is not stopped by a wall behind it), and a function for the tile `d` tiles along that row from the hare.
 */
function straight(): { b: ReturnType<typeof loadBundle>; i: number; hare: Tile; from: (d: number) => Tile } {
  const b = structuredClone(bundle);
  const walk = walkableFor(b);
  const s = started(b);
  const { i } = hareSpots(b)[0]!;
  for (let y = 0; y < b.map.height; y++) {
    for (let x = 6; x < b.map.width - 9; x++) {
      if (Array.from({ length: 16 }, (_, k) => walk(x + k - 6, y, s.player)).every(Boolean)) {
        b.map.creatures!.spots[i] = { kind: 'core/hare', x, y };
        return { b, i, hare: [x, y], from: (d) => [x + d, y] };
      }
    }
  }
  throw new Error('no clear row on the map');
}

describe('the charge must suit the distance', () => {
  // the throw's range is `throw_range * power / 1000` and it rolls on `roll * power / 1000`: the stone first touches the ground at
  // the range and comes to rest a roll further; it takes the hare within `hit_tiles` of either
  const bands: [number, number, number][] = [
    // power, nearest distance that is hit, farthest
    [500, 1, 3],
    [667, 1, 4],
    [999, 1, 4],
    [FULL_POWER, 2, 6],
  ];

  test('each power takes a hare at the distances its flight comes down within a tile of', () => {
    const { b, i, hare, from } = straight();
    for (const [power, near, far] of bands) {
      for (let d = 1; d <= 7; d++) {
        const s = started(b);
        s.player.at = from(d);
        const r = step(b, s, throwAt(s, i, hare, power), 0);
        const hit = r.ok && (r.state.player.carcasses ?? []).length === 1;
        expect({ power, d, hit }).toEqual({ power, d, hit: d >= near && d <= far });
      }
    }
  });

  test('the farthest a stone strikes is the reach the hunt target uses', () => {
    const { b, i, hare, from } = straight();
    expect(huntReach(b)).toBe(6);
    const s = started(b);
    s.player.at = from(7);
    const far = step(b, s, throwAt(s, i, hare, FULL_POWER), 0);
    expect(far).toEqual({ ok: false, error: 'No small game in reach.' });
  });

  test('the width of a hit is the one number hit_tiles', () => {
    const { b: base, i, hare, from } = straight();
    // power 667 touches at 2 and rests at 3: width 0 takes a hare 2 or 3 tiles off, width 1 one to four, width 2 up to five
    for (const [width, taken] of [[0, [2, 3]], [1, [1, 2, 3, 4]], [2, [1, 2, 3, 4, 5]]] as const) {
      const b = structuredClone(base);
      b.params.hunt.hit_tiles = width;
      const out = [1, 2, 3, 4, 5, 6].filter((d) => {
        const s = started(b);
        s.player.at = from(d);
        const r = step(b, s, throwAt(s, i, hare, 667), 0);
        return r.ok && (r.state.player.carcasses ?? []).length === 1;
      });
      expect(out, `width ${width}`).toEqual(taken);
    }
  });
});

describe('a hit and a miss', () => {
  test('a hit spends one stone from the bag, leaves the carcass where the hare stood and brings the hare back by its day', () => {
    const { b, i, hare, from } = straight();
    const s = started(b);
    s.player.at = from(3);
    const r = step(b, s, throwAt(s, i, hare, FULL_POWER), 0);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.player.bag[STONE]).toBe(2);
    expect(r.state.player.carcasses![0]).toMatchObject({ kind: 'core/hare', at: hare });
    expect(r.events.map((e) => e.e)).toEqual(expect.arrayContaining(['stone_thrown', 'take_prey']));
    // the stone that struck is not left on the ground
    expect(JSON.stringify(r.state.player.stones?.placed ?? {})).not.toContain(STONE);
  });

  test('a miss spends the stone to the ground where it comes to rest, to be lifted again, and takes nothing', () => {
    const { b, i, hare, from } = straight();
    const s = started(b);
    s.player.at = from(5);
    const miss = step(b, s, throwAt(s, i, hare, 500), 0);
    if (!miss.ok) throw new Error(miss.error);
    expect(miss.state.player.carcasses ?? []).toHaveLength(0);
    expect(miss.state.player.bag[STONE]).toBe(2);
    const e = miss.events.find((x) => x.e === 'stone_thrown');
    if (e?.e !== 'stone_thrown' || !e.at) throw new Error('the stone did not land');
    // the figure walks to where it lies and lifts it again
    const there = structuredClone(miss.state);
    there.player.at = [e.at[0], e.at[1]];
    const lifted = step(b, there, { t: 'lift', kind: STONE, at: e.at }, miss.state.player.busyUntil + b.params.stones.throw_ms);
    if (!lifted.ok) throw new Error(lifted.error);
    expect(lifted.state.player.bag[STONE]).toBe(3);
  });

  test('a stone carried over the head does not take game, and a throw with no stone is refused', () => {
    const { b, i, hare, from } = straight();
    const s = started(b);
    s.player.at = from(3);
    s.player.bag = {};
    expect(step(b, s, throwAt(s, i, hare, FULL_POWER), 0)).toEqual({ ok: false, error: 'You have no stone to throw.' });
    const big = Object.keys(b.params.liftables).find((k) => b.params.liftables[k]!.class === 'arms')!;
    s.player.stones = { taken: {}, placed: {}, returns: [], carry: big };
    const r = step(b, s, { t: 'throw', at: s.player.at, aim: hare, kind: big, power: FULL_POWER, prey: i }, 0);
    expect(r).toEqual({ ok: false, error: 'That is too heavy to take small game.' });
  });

  test('the same hare is not taken twice before its day is out', () => {
    const { b, i, hare, from } = straight();
    const s = started(b);
    s.player.at = from(3);
    const first = step(b, s, throwAt(s, i, hare, FULL_POWER), 0);
    if (!first.ok) throw new Error(first.error);
    const again = step(b, first.state, throwAt(first.state, i, hare, FULL_POWER), first.state.player.busyUntil);
    expect(again).toEqual({ ok: false, error: 'No small game in reach.' });
  });
});

describe('the moment can happen from every wake pocket', () => {
  // each wake tile as the shipped content places it, so the moment follows the valley when its map is redrawn
  const pockets: [string, string][] = [['north meadow', 'core/north-meadow'], ['west bank', 'core/west-bank'], ['slid bank', 'core/slid-bank']];
  const STILL = (): WildSense => ({ face: [0, 1], gait: 'still', asleep: false });
  const calm = new Set(['IDLE', 'GRAZE', 'WANDER']);

  test.each(pockets)('%s: a full charge started at the wake tile (or one step on) takes the hare before it has noticed the figure', (_name, pocket) => {
    const b = bundle;
    const wake: Tile = [b.pockets[pocket]!.wake.x, b.pockets[pocket]!.wake.y];
    const spots = b.map.creatures!.spots;
    const s = started();
    const walk = walkableFor(b);
    // the figure stands where it woke, or one step on (a step toward its nearest hare, or out from among the trees): the first of
    // those tiles from which a full charge at a hare standing on its spot takes it (within the reach, nothing between, and not so
    // near that the stone flies past)
    const reach = huntReach(b);
    const takes = (at: Tile, i: number): boolean => {
      const here = { ...s, player: { ...s.player, at } };
      const r = step(b, here, throwAt(here, i, [spots[i]!.x, spots[i]!.y], FULL_POWER), 0);
      return r.ok && (r.state.player.carcasses ?? []).length === 1;
    };
    const from = ([[0, 0], [0, -1], [1, 0], [-1, 0], [0, 1]] as const)
      .map(([dx, dy]) => [wake[0] + dx, wake[1] + dy] as Tile)
      .filter(([x, y]) => walk(x, y, s.player))
      .map((at) => {
        const near = hareSpots(b)
          .map(({ sp, i }) => ({ i, d: Math.hypot(sp.x - at[0], sp.y - at[1]) }))
          .filter(({ i, d }) => d <= reach && takes(at, i))
          .sort((x, y) => x.d - y.d)[0];
        return near && { at, i: near.i };
      })
      .find(Boolean);
    expect(from, `no hare a full charge takes from ${wake.join(',')} or one step on`).toBeDefined();
    const { i } = from!;
    s.player.at = [wake[0], wake[1]];
    const w = wildWorld(b);
    expect(hourOf(b, 0)).toBe(12);
    const charge = b.params.stones.throw_charge_ms;
    let ms = 0;
    for (; ms < 400; ms += 100) wildStep(b, w, s, STILL(), ms);
    if (from!.at[0] !== wake[0] || from!.at[1] !== wake[1]) {
      s.player.at = [from!.at[0], from!.at[1]];
      ms += b.params.walk_step_ms;
    }
    const readyAt = ms + charge;
    for (; ms <= readyAt; ms += 100) wildStep(b, w, s, STILL(), ms);
    const a = wildAnimal(w, i)!;
    // it has not noticed the figure yet: the throw leaves while it grazes or idles where it stands
    expect(calm.has(a.c.state), `${a.c.state} at ${readyAt} ms`).toBe(true);
    const stands: Tile = [a.c.at[0], a.c.at[1]];
    const r = step(b, s, { t: 'throw', at: s.player.at, aim: stands, kind: STONE, power: FULL_POWER, prey: i, stands }, readyAt);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.player.carcasses ?? []).toHaveLength(1);
  });

  test('a stone coming down is heard: the hare goes to ground within a second', () => {
    const { b, i, hare, from } = straight();
    const s = started(b);
    s.player.at = from(5);
    const w = wildWorld(b);
    let ms = 0;
    // the first step only settles an animal; it thinks, and hears, from the next
    for (; ms < 2000; ms += 100) wildStep(b, w, s, { face: [0, 1], gait: 'still', asleep: false }, ms);
    const before = wildAnimal(w, i)!.c.state;
    wildNoise(w, [hare[0] + 1, hare[1]], ms);
    for (let k = 0; k < 8; k++, ms += 100) wildStep(b, w, s, { face: [0, 1], gait: 'still', asleep: false }, ms);
    // a stone cracking down beside it sends it to ground (a hare burrows), and it comes back after a while
    const after = wildAnimal(w, i)!;
    expect(before).toBe('IDLE');
    expect(after.c.state).not.toBe('IDLE');
    expect(after.c.under || after.c.state === 'FLEE').toBe(true);
  });
});
