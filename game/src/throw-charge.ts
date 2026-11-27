/**
 * The charged throw's client side (DECISIONS.md, 2026-11-22): the power a held press reaches, the aim line's tiles and
 * the tremble past full. Pure numbers, every one read from the kernel, so the line and the throw cannot disagree.
 */
import { type Bundle, type PublicState, type Tile, FULL_POWER, chargePower, throwFlight, throwHoldLimit } from '@game/kernel';

/** What a hold of `heldMs` whole game milliseconds has charged to. */
export interface Charge {
  /** the power reached, a thousandth part: `stones.throw_min_power` to `FULL_POWER` */
  power: number;
  /** the charge is full: the aim line wavers from here until it leaves */
  full: boolean;
  /** held past the hold limit: the throw leaves on its own at full power */
  over: boolean;
}

/** The charge a hold of `heldMs` has reached: the one curve the kernel's `chargePower` draws. */
export function chargeAt(bundle: Bundle, heldMs: number): Charge {
  const power = chargePower(bundle, heldMs);
  return { power, full: power >= FULL_POWER, over: heldMs >= throwHoldLimit(bundle) };
}

/**
 * The tiles the aim line covers: the kernel's own flight at `power`, the very tiles a throw at that power passes over
 * (`throwFlight`, the function the throw action runs). Never a second formula, so the line and the throw cannot disagree.
 */
export function aimLine(bundle: Bundle, state: PublicState, kind: string, aim: Tile, power: number): Tile[] {
  const flight = throwFlight(bundle, state, kind, aim, power);
  return 'error' in flight ? [] : flight.air;
}

/** The tremble of the aim line's far end once the charge is full: 0 until then, then a small shake of at most 2 art pixels (no clip). */
export function trembleAt(nowMs: number, full: boolean): number {
  if (!full) return 0;
  return Math.round(Math.sin(nowMs / 60) * 2);
}
