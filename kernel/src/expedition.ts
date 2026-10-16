/** The clock and bounds of an expedition (G36). Pure: step.ts owns changes. */
import type { Bundle, ExpeditionDef } from './bundle';
import { idiv } from './num';
import type { State } from './state';
import { lastDusk } from './state';
import { findSlot, inRect } from './world';

/** Bell ticks on the night whose dusk is the most recent dusk at `tick`. */
export function bellTicks(bundle: Bundle, x: ExpeditionDef, tick: number): number[] {
  const day = bundle.params.day_length_ms;
  const dusk = lastDusk(bundle, tick);
  return x.window.bells.map((hour) =>
    dusk + idiv((hour >= 20 ? hour - 20 : hour + 4) * day, 24),
  );
}

/** The first bell opens the expedition and the last bell closes it. */
export function windowOpen(bundle: Bundle, x: ExpeditionDef, tick: number): boolean {
  const bells = bellTicks(bundle, x, tick);
  return (bells[0] ?? tick + 1) <= tick && tick < (bells[bells.length - 1] ?? tick);
}

/** Bells on this night whose tick has arrived, including the last bell. */
export function bellsRung(bundle: Bundle, x: ExpeditionDef, tick: number): number {
  return bellTicks(bundle, x, tick).filter((bell) => bell <= tick).length;
}

/** Tick at which this night's last bell rings. */
export function lastBellAt(bundle: Bundle, x: ExpeditionDef, tick: number): number {
  const bells = bellTicks(bundle, x, tick);
  return bells[bells.length - 1]!;
}

/**
 * Dusk of the night whose bells a visit begun at `entered` counts: the night
 * of `entered` while its last bell is still to ring, else the coming night.
 */
export function visitNight(bundle: Bundle, x: ExpeditionDef, entered: number): number {
  const dusk = lastDusk(bundle, entered);
  return entered < lastBellAt(bundle, x, entered) ? dusk : dusk + bundle.params.day_length_ms;
}

/** Whether the player stands in the expedition's area slot. */
export function inside(bundle: Bundle, state: State, x: ExpeditionDef): boolean {
  const place = findSlot(bundle.map, x.place);
  return place !== undefined && inRect(state.player.at[0], state.player.at[1], place);
}
