/**
 * The charged throw's client numbers (DECISIONS.md, 2026-11-22): the charge curve over time, the aim line read from
 * the kernel's own flight, and the tremble that only shows past full. Pure, in the manner of fightwords.test.ts.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, type Tile, FULL_POWER, newState, step, throwFlight, walkableFor } from '@game/kernel';
import { aimLine, assistAim, chargeAt, preyOf, trembleAt } from '../src/throw-charge';
import { loadPixelBundle } from '../../tools/test/helpers/world';

let base: Bundle;
beforeAll(() => {
  base = loadPixelBundle();
});
const stones = () => base.params.stones;

/** A started player standing on `at`. */
function standing(at: Tile): State {
  const r = step(base, newState(base, 7), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
  if (!r.ok) throw new Error(r.error);
  return { ...r.state, player: { ...r.state.player, at: [at[0], at[1]] } };
}

describe('the charge curve', () => {
  test('a tap is the minimum, it rises to full over the charge time, and the hold limit releases at full', () => {
    expect(chargeAt(base, 0)).toEqual({ power: stones().throw_min_power, full: false, over: false });
    const half = chargeAt(base, Math.floor(stones().throw_charge_ms / 2));
    expect(half.power).toBeGreaterThan(stones().throw_min_power);
    expect(half.power).toBeLessThan(FULL_POWER);
    expect(half.full).toBe(false);
    expect(chargeAt(base, stones().throw_charge_ms)).toEqual({ power: FULL_POWER, full: true, over: false });
    expect(chargeAt(base, stones().throw_charge_ms + stones().throw_hold_ms)).toEqual({ power: FULL_POWER, full: true, over: true });
    expect(chargeAt(base, stones().throw_charge_ms + stones().throw_hold_ms + 999).over).toBe(true);
  });

  test('the power never leaves its bounds over the whole hold', () => {
    for (let held = 0; held <= stones().throw_charge_ms + stones().throw_hold_ms; held += 13) {
      const { power } = chargeAt(base, held);
      expect(power).toBeGreaterThanOrEqual(stones().throw_min_power);
      expect(power).toBeLessThanOrEqual(FULL_POWER);
    }
  });
});

describe('the aim line', () => {
  test("its length is the kernel's range for that power: the very tiles `throwFlight` flies over", () => {
    const state = standing([20, 20]);
    const aim: Tile = [28, 20];
    for (const power of [stones().throw_min_power, FULL_POWER]) {
      const flight = throwFlight(base, state, 'core/stone', aim, power);
      if ('error' in flight) throw new Error(flight.error);
      expect(aimLine(base, state, 'core/stone', aim, power)).toEqual(flight.air);
    }
  });

  test('the line grows with the power: a tap reaches less than a full charge', () => {
    const state = standing([20, 20]);
    const aim: Tile = [28, 20];
    const tap = aimLine(base, state, 'core/stone', aim, stones().throw_min_power).length;
    const full = aimLine(base, state, 'core/stone', aim, FULL_POWER).length;
    expect(tap).toBeGreaterThan(0);
    expect(tap).toBeLessThan(full);
  });

  test('a tap throws: its power is the minimum, a legal throw', () => {
    const tap = chargeAt(base, 0).power;
    expect(tap).toBe(stones().throw_min_power);
    expect(tap).toBeGreaterThanOrEqual(stones().throw_min_power);
    expect(tap).toBeLessThanOrEqual(FULL_POWER);
  });
});

describe('the tremble', () => {
  test('waits for full: nothing before it, a small shake once full', () => {
    expect(trembleAt(12345, false)).toBe(0);
    for (let t = 0; t < 600; t += 7) expect(Math.abs(trembleAt(t, true))).toBeLessThanOrEqual(2);
    // it does move, at least somewhere in the cycle
    const moves = new Set(Array.from({ length: 120 }, (_, i) => trembleAt(i * 10, true)));
    expect(moves.size).toBeGreaterThan(1);
  });
});

describe('the throw at small game (#923)', () => {
  /** A hare of the map and a tile `d` tiles west of it on open ground, the figure standing there with a stone in the bag. */
  function hareAt(d: number) {
    const walk = walkableFor(base);
    for (const [spot, sp] of base.map.creatures!.spots.entries()) {
      if (sp.kind !== 'core/hare') continue;
      const from: Tile = [sp.x - d, sp.y];
      const state = standing(from);
      if (![...Array(d + 1).keys()].every((i) => walk(sp.x - i, sp.y, state.player))) continue;
      state.player.bag['core/stone'] = 2;
      return { spot, state, from, tile: [sp.x, sp.y] as Tile };
    }
    throw new Error('no hare with open ground to its west');
  }
  const west: [number, number] = [1, 0];

  test('B held with a hare in the half the figure faces points the line at it; one behind or a large stone does not', () => {
    const { spot, state, tile } = hareAt(3);
    const animals = [{ spot, tile }];
    expect(assistAim(base, state, 0, 'core/stone', animals, west)).toEqual({ aim: tile, spot });
    expect(assistAim(base, state, 0, 'core/stone', animals, [-1, 0])).toBeUndefined();
    expect(assistAim(base, state, 0, 'core/large-stone', animals, west)).toBeUndefined();
    expect(assistAim(base, state, 0, 'core/stone', [], west)).toBeUndefined();
  });

  test('the strike is named only where the flight at that power comes down within a tile of the hare', () => {
    const tapPower = stones().throw_min_power;
    // the bands the kernel's flight gives (hand-skill.test.ts): a tap strikes a hare 1 to 3 tiles off, a full charge 2 to 6
    const near = hareAt(3);
    expect(preyOf(base, near.state, 0, 'core/stone', near.tile, tapPower, [{ spot: near.spot, tile: near.tile }])).toEqual({ prey: near.spot, stands: near.tile });
    const far = hareAt(5);
    const animals = [{ spot: far.spot, tile: far.tile }];
    expect(preyOf(base, far.state, 0, 'core/stone', far.tile, tapPower, animals)).toBeUndefined();
    expect(preyOf(base, far.state, 0, 'core/stone', far.tile, FULL_POWER, animals)).toEqual({ prey: far.spot, stands: far.tile });
    expect(preyOf(base, far.state, 0, 'core/large-stone', far.tile, FULL_POWER, animals)).toBeUndefined();
  });
});
