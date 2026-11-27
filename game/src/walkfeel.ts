/**
 * The feel of the walk on a phone (public #641, the owner's word of 27.11: "do the walk feel by the standards of similar
 * games"). Three rules, all client input and presentation; the kernel's gaits, paces and the walk map are untouched:
 *
 *  1. The gait follows how far the thumb is pushed, never a timer: a gentle push walks (the share of the walk pace grows
 *     with the push), a firm push runs. Today's rule held the stick for 400 ms and then snapped from a walk to a run at
 *     twice the speed, whatever the push (`RUN_HOLD_MS`).
 *  2. The speed ramps: a short rise to the pace the thumb asks for, and a stop within a frame or two.
 *  3. A wall slides the body along it (Walker.frame already does: the x and y of each piece are resolved apart); a head-on push
 *     stops it. Nothing to build for that; game/test/walkfeel.test.ts pins it.
 *
 * `?walk=old` keeps today's rule (the 400 ms hold, no ramp) so both can be felt. Pure: no page, no Phaser.
 */
import type { Gait } from '@game/kernel';

export type WalkMode = 'standard' | 'old';

/** `?walk=old` asks for the walk as it was before #641; anything else is the standard. */
export function walkMode(query: string): WalkMode {
  return new URLSearchParams(query).get('walk') === 'old' ? 'old' : 'standard';
}

/**
 * The stick's length (0 to 1, `stickFrom`) at which the walk becomes a run, and the length it drops back to a walk at: a
 * little lower, so a thumb resting on the boundary does not chatter between the two. On the phone's ring of 101 px (0.26 of
 * a 390 px screen) the stick reads from 12 px to 40 px of push: a run from 35 px up, a walk back below 32 px.
 */
export const RUN_ENTER = 0.8;
export const RUN_LEAVE = 0.7;

/** Milliseconds the body takes to rise from rest to the walk pace (a run takes twice that), and to fall from the walk pace to rest. */
export const RAMP_UP_MS = 100;
export const RAMP_DOWN_MS = 25;

/** What the hands ask of one frame: a unit direction (or none), the share of the gait's pace, and the gait. */
export interface Ask {
  /** the unit direction pushed; [0, 0] while nothing is */
  dir: readonly [number, number];
  /** the share of the gait's own pace asked for, 0 to 1 */
  share: number;
  gait: Gait;
}

/**
 * The gait and the share of its pace for a stick `length` pushed (0 to 1), `running` being whether the last frame ran (the
 * hysteresis). A sneak toggle keeps the sneak and the length is the share; Shift (or the keyboard's run) is a run at its
 * full pace; otherwise a push below `RUN_ENTER` walks at the share `length / RUN_ENTER` of the walk pace, and a firmer
 * push runs at the full run pace.
 */
export function stickGait(length: number, running: boolean, sneaking: boolean, shift = false): { gait: Gait; share: number } {
  const l = Math.max(0, Math.min(1, length));
  if (sneaking) return { gait: 'sneak', share: l };
  if (shift) return { gait: 'run', share: 1 };
  if (running ? l >= RUN_LEAVE : l >= RUN_ENTER) return { gait: 'run', share: 1 };
  return { gait: 'walk', share: Math.min(1, l / RUN_ENTER) };
}

/**
 * The body's speed on its way to what the hands ask: it rises to the target in `RAMP_UP_MS` of the walk pace and falls in
 * `RAMP_DOWN_MS` of it, in px a second. The direction is the last one pushed, so a body that is letting go keeps its way
 * for the frame or two the fall takes.
 */
export class SpeedRamp {
  /** px a second */
  speed = 0;
  /** the last direction pushed */
  dir: [number, number] = [0, 0];

  /** One frame of `ms`. `dir` is the unit direction pushed ([0, 0] when none), `target` px a second, `unit` the walk pace in px a second. Returns the speed to walk at. */
  step(dir: readonly [number, number], target: number, ms: number, unit: number): number {
    if (dir[0] !== 0 || dir[1] !== 0) this.dir = [dir[0], dir[1]];
    const rate = (unit / (target > this.speed ? RAMP_UP_MS : RAMP_DOWN_MS)) * ms;
    this.speed = target > this.speed ? Math.min(target, this.speed + rate) : Math.max(target, this.speed - rate);
    if (this.speed === 0) this.dir = [0, 0];
    return this.speed;
  }

  /** The body stops at once (a window opens, the player is put elsewhere). */
  reset(): void {
    this.speed = 0;
    this.dir = [0, 0];
  }
}

/**
 * The gait to tell the kernel for the speed the body walks at: a run while it is faster than the walk pace (`unit`, px a second,
 * with a hair of room), whatever the thumb now asks, so a step is never reported as a walk above the walk's pace on the way down
 * from a run. Below it, the gait the thumb asks for (a run still rising is reported as a run: it is slower than one).
 */
export function reportedGait(asked: Gait, speed: number, unit: number): Gait {
  return asked === 'sneak' ? asked : speed > unit * 1.001 ? 'run' : asked;
}
