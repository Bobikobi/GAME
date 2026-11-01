/**
 * The sea crossing (docs/design/SEA_CROSSING.md; EXPERIENCE_AUDIT.md gap M1): a passage leaves a jetty, the boat
 * moves one segment per act, and one event drawn at boarding strikes on the way. Pure: the draw is keyed by the
 * world's key, the passage and the player's own count of crossings (rule R4), so the phone and the server draw the
 * same event, and only the server holds the key once an account does.
 */
import type { Bundle, PassageDef, SeaEventDef } from './bundle';
import { idiv } from './num';
import { drawBasisPoints, type Seed } from './rng';
import type { Aboard } from './state';
import { findSlot, type Rect } from './world';

/** The event a crossing draws: its place in the passage's table, by running sums of the integer weights. */
export function seaEventIndex(passage: PassageDef, seed: Seed, crossings: number): number {
  const total = passage.events.reduce((n, e) => n + e.weight, 0);
  const r = idiv(drawBasisPoints(seed, `passage:${passage.id}`, crossings) * total, 10_000);
  let sum = 0;
  for (let i = 0; i < passage.events.length; i++) {
    sum += passage.events[i]!.weight;
    if (r < sum) return i;
  }
  return passage.events.length - 1;
}

/**
 * The segments an event is open on, counted as segments sailed: it strikes in the middle of the crossing and stays
 * open for its window. Its sign shows on the segment before `first` (warn, then strike).
 */
export function seaWindow(passage: PassageDef, event: SeaEventDef): { first: number; last: number } {
  const first = idiv(passage.segments - event.window, 2) + 1;
  return { first, last: first + event.window - 1 };
}

/** The event aboard and whether it can be answered now. */
export function seaNow(bundle: Bundle, aboard: Aboard): { passage: PassageDef; event: SeaEventDef; open: boolean; sign: boolean } | undefined {
  const passage = bundle.passages[aboard.passage];
  const event = passage?.events[aboard.event];
  if (!passage || !event) return undefined;
  const { first, last } = seaWindow(passage, event);
  const live = aboard.outcome === 'open';
  return { passage, event, open: live && aboard.segment >= first && aboard.segment <= last, sign: live && aboard.segment === first - 1 };
}

/** Where an exit of the map plan stands: its tile, or its slot. */
export function exitRect(bundle: Bundle, exitId: string): Rect | undefined {
  const exit = bundle.map.plan?.exits?.find((x) => x.id === exitId);
  if (!exit) return undefined;
  if (exit.at) return { x: exit.at[0], y: exit.at[1], w: 1, h: 1 };
  return exit.slot ? findSlot(bundle.map, exit.slot) : undefined;
}
