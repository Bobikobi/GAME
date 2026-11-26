/**
 * The charged throw's client numbers (DECISIONS.md, 2026-11-22): the charge curve over time, the aim line read from
 * the kernel's own flight, and the tremble that only shows past full. Pure, in the manner of fightwords.test.ts.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, type Tile, FULL_POWER, newState, step, throwFlight } from '@game/kernel';
import { aimLine, chargeAt, trembleAt } from '../src/throw-charge';
import { loadBundle } from '../../tools/test/helpers/world';

let base: Bundle;
beforeAll(() => {
  base = loadBundle();
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
      const flight = throwFlight(base, state, 'small', aim, power);
      if ('error' in flight) throw new Error(flight.error);
      expect(aimLine(base, state, 'small', aim, power)).toEqual(flight.air);
    }
  });

  test('the line grows with the power: a tap reaches less than a full charge', () => {
    const state = standing([20, 20]);
    const aim: Tile = [28, 20];
    const tap = aimLine(base, state, 'small', aim, stones().throw_min_power).length;
    const full = aimLine(base, state, 'small', aim, FULL_POWER).length;
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
