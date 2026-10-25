/**
 * Weight and pace (DECISIONS.md, 2026-10-23: races, weight and bags). Two numbers, two jobs: places
 * say how many stacks the player holds (ten of a kind to a place) and come from what is on the back
 * (`bagCapacity`); weight
 * says how fast they walk, against a limit that comes from might. Every item weighs, worn ones too.
 * Pure and integer-only, like the rest of the kernel.
 */
import type { Bundle } from './bundle';
import { idiv, mulDiv } from './num';
import { attrAt, backBag, bodyValue, type PublicState } from './state';

/** The three walking paces, lightest first. */
export const LOAD_BANDS = ['light', 'steady', 'heavy'] as const;
export type LoadBand = (typeof LOAD_BANDS)[number];

/** How heavy one unit of an item is. Content always names it; an unknown id weighs 1. */
export function itemWeight(bundle: Bundle, itemId: string): number {
  return bundle.items[itemId]?.weight ?? 1;
}

/** What the whole bag weighs, worn things included: they are on the body, not off it. */
export function loadWeight(bundle: Bundle, state: PublicState): number {
  let n = 0;
  for (const [id, qty] of Object.entries(state.player.bag)) n += qty * itemWeight(bundle, id);
  return n;
}

/** The weight limit: `load.base` plus `per_point.might` for each point of might now (the grade counts), plus a frame bag's `load_bonus`. */
export function loadLimit(bundle: Bundle, state: PublicState): number {
  const { load, per_point } = bundle.params;
  return load.base + per_point.might * attrAt(bundle, state, 'might') + (backBag(bundle, state)?.load_bonus ?? 0);
}

/** The weight the pace reads: the load, scaled by the race's `pace_load_permille` (the elf's light frame counts four fifths), rounded down. */
export function paceWeight(bundle: Bundle, state: PublicState): number {
  return mulDiv(loadWeight(bundle, state), bodyValue(bundle, state, 'pace_load_permille', 1000), 1000);
}

/** Light up to `load.light_permille` of the limit, steady up to the limit, heavy above it. */
export function loadBand(bundle: Bundle, state: PublicState): LoadBand {
  const limit = loadLimit(bundle, state);
  const weight = paceWeight(bundle, state);
  if (weight * 1000 <= limit * bundle.params.load.light_permille) return 'light';
  return weight <= limit ? 'steady' : 'heavy';
}

/** Milliseconds a tile at the pace this load allows: what the client walks and what a position report is checked against. */
export function walkStepMs(bundle: Bundle, state: PublicState): number {
  const band = loadBand(bundle, state);
  const { load, walk_step_ms } = bundle.params;
  return band === 'light' ? load.light_step_ms : band === 'heavy' ? load.heavy_step_ms : walk_step_ms;
}

/** The most the player carries: beyond `load.max_permille` of the limit nothing more is picked up. */
export function loadMax(bundle: Bundle, state: PublicState): number {
  return mulDiv(loadLimit(bundle, state), bundle.params.load.max_permille, 1000);
}

/** How many more units of an item the weight lets the player pick up; a thing that weighs nothing always fits (`Number.MAX_SAFE_INTEGER`). */
export function weightRoom(bundle: Bundle, state: PublicState, itemId: string): number {
  const each = itemWeight(bundle, itemId);
  if (each <= 0) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, idiv(loadMax(bundle, state) - loadWeight(bundle, state), each));
}

/**
 * How fast breath (stamina) refills in a fight, against 1000: `load.heavy_breath_permille` while heavy,
 * else whole. No fight reads it yet; the combat wave does (COMBAT.md), so the rule is fixed here first.
 */
export function breathRefillPermille(bundle: Bundle, state: PublicState): number {
  return loadBand(bundle, state) === 'heavy' ? bundle.params.load.heavy_breath_permille : 1000;
}

/** What a rest by a fire mends against everyone's 1000: the skeleton's body mends double. The rest itself comes with sleep (G32). */
export function restMendPermille(bundle: Bundle, state: PublicState): number {
  return bodyValue(bundle, state, 'rest_mend_permille', 1000);
}

/** What food fills against everyone's 1000: the skeleton has nothing to digest and gets half. A bandage or a first-aid kit is not food. */
export function foodFillPermille(bundle: Bundle, state: PublicState): number {
  return bodyValue(bundle, state, 'food_fill_permille', 1000);
}
