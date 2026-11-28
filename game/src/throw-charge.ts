/**
 * The charged throw's client side (DECISIONS.md, 2026-11-22): the power a held press reaches, the aim line's tiles and
 * the tremble past full. Pure numbers, every one read from the kernel, so the line and the throw cannot disagree.
 */
import { type Bundle, type PublicState, type Tile, FULL_POWER, chargePower, flightHits, stonePrey, throwFlight, throwHoldLimit } from '@game/kernel';

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

/** An animal the world shows, by its spot and the tile it stands on now (scenes/wildlife.ts `shown`). */
export interface Standing {
  spot: number;
  tile: Tile;
}

/** Whether `kind` is a stone of the hand, the one that takes small game: a large stone over the head never does. */
export function takesGame(bundle: Bundle, kind: string): boolean {
  return bundle.params.liftables[kind]?.class === 'hand';
}

/**
 * The aim a held B starts at (#923): when a small stone is in hand and a hare a stone could take stands in the half the figure
 * faces, the line points at the nearest one, so the player's skill is the charge, how long to hold, not the pointing. With none
 * it returns nothing and the aim is the way the figure faces. `dir` is the facing's step; the kernel decides what is takeable.
 */
export function assistAim(bundle: Bundle, state: PublicState, tick: number, kind: string, animals: readonly Standing[], dir: readonly [number, number]): { aim: Tile; spot: number } | undefined {
  if (!takesGame(bundle, kind)) return undefined;
  const at = state.player.at;
  let best: { aim: Tile; spot: number } | undefined;
  let nearest = Infinity;
  for (const { spot, tile } of animals) {
    const dx = tile[0] - at[0];
    const dy = tile[1] - at[1];
    const d = dx * dx + dy * dy;
    if (d === 0 || d >= nearest || dx * dir[0] + dy * dir[1] <= 0) continue;
    if (!stonePrey(bundle, state, tick, spot, at, tile)) continue;
    nearest = d;
    best = { aim: [tile[0], tile[1]], spot };
  }
  return best;
}

/**
 * The animal a throw of `kind` at `aim` and `power` would strike: the nearest one whose tile the flight's touch or rest lies within
 * the hit's width of (the kernel's own `flightHits` over its own `throwFlight`, so the client names what the kernel will accept).
 * The action then carries `prey` and `stands`; with none, the stone is only thrown.
 */
export function preyOf(bundle: Bundle, state: PublicState, tick: number, kind: string, aim: Tile, power: number, animals: readonly Standing[]): { prey: number; stands: Tile } | undefined {
  if (!takesGame(bundle, kind)) return undefined;
  const flight = throwFlight(bundle, state, kind, aim, power);
  if ('error' in flight) return undefined;
  const at = state.player.at;
  let best: { prey: number; stands: Tile } | undefined;
  let nearest = Infinity;
  for (const { spot, tile } of animals) {
    if (!flightHits(bundle, flight, tile) || !stonePrey(bundle, state, tick, spot, at, tile)) continue;
    const d = (flight.touch[0] - tile[0]) ** 2 + (flight.touch[1] - tile[1]) ** 2;
    if (d >= nearest) continue;
    nearest = d;
    best = { prey: spot, stands: [tile[0], tile[1]] };
  }
  return best;
}
