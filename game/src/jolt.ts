/**
 * What the camera does for an event, and how a success is marked instead (DECISIONS.md, 2026-10-18 "A success never
 * shakes the screen"). The jolt and the red flash belong to danger: a wound flashes and shakes, being seen jolts (left
 * out under reduced motion). A quest done, a mend, a build or a level moves no camera and flashes nothing; the jingle
 * and a soft light on the thing made carry it. A tree landing is an impact, not a success, and keeps its own small shake.
 */
import type { GameEvent } from '@game/kernel';

export interface Jolt {
  shake?: { ms: number; intensity: number };
  flash?: { ms: number; rgb: readonly [number, number, number] };
}

const HURT: Jolt = { flash: { ms: 180, rgb: [168, 48, 47] }, shake: { ms: 140, intensity: 0.005 } };
const SEEN: Jolt = { shake: { ms: 180, intensity: 0.004 } };

/** The camera's answer to one event, or nothing; `motion` is false when the player asked for reduced motion. */
export function joltOf(e: GameEvent, motion: boolean): Jolt | undefined {
  if (e.e === 'hurt') return HURT;
  if (e.e === 'seen' && motion) return SEEN;
  return undefined;
}

/** The soft light on a thing just made: it rises, holds and fades within this many ms, and is gone after. */
export const SUCCESS_LIGHT = { rise: 250, hold: 200, fade: 450, alpha: 0.85 } as const;

/** The whole life of the success light, in ms. */
export const SUCCESS_LIGHT_MS = SUCCESS_LIGHT.rise + SUCCESS_LIGHT.hold + SUCCESS_LIGHT.fade;
