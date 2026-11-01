/**
 * Work that runs by itself after one press (DECISIONS.md, 2026-10-11): felling with the axe,
 * digging with the trowel, mining with the pick. The kernel decides how long it lasts and
 * what it yields, and says which nodes work this way (kernel/src/work.ts, QUARRYING 10); this
 * file says how the time splits into swings. Pure, so the rhythm can be tested without a scene.
 */
import type { AutoKind } from '@game/kernel';
import { ART_PX } from './walking';

export { autoKind, resourceKind, treasureKind, type AutoKind } from '@game/kernel';

/** The pose sheets a work kind uses, in the order they are tried: the kind's own first, the axe swing last. */
export const POSES: Readonly<Record<AutoKind, readonly string[]>> = { fell: ['work'], mine: ['pick', 'work'], dig: ['dig', 'work'] };

/** One swing lasts about this long; the work is cut into a whole number of them. */
export const SWING_MS = 520;
/** The share of a swing spent with the arm raised; the blow lands at its end. */
export const WIND_UP = 0.55;

export interface Swings {
  count: number;
  period: number;
}

/** A whole number of equal swings (at least two) that fills `ms`, so the last blow lands as the work ends. */
export function swingsFor(ms: number): Swings {
  const count = Math.max(2, Math.round(ms / SWING_MS));
  return { count, period: Math.max(1, ms) / count };
}

export interface Beat {
  /** which swing, from 0 */
  index: number;
  /** the arm is down on the thing */
  down: boolean;
  /** 0 to 1 over the whole work */
  progress: number;
}

/** Where the work stands `elapsed` ms after it started. */
export function beatAt(elapsed: number, ms: number): Beat {
  const { count, period } = swingsFor(ms);
  const clamped = Math.max(0, Math.min(ms, elapsed));
  const index = Math.min(count - 1, Math.floor(clamped / period));
  const within = (clamped - index * period) / period;
  return { index, down: within >= WIND_UP, progress: ms > 0 ? clamped / ms : 1 };
}

/** How many blows have fallen by now: the arm coming down counts its own, and a beat the frames jumped over still does. */
export function blowsDue(beat: Beat): number {
  return beat.down ? beat.index + 1 : beat.index;
}

/** The share of a step spent on a leg frame; the rest of it, the feet are together. */
export const STRIDE = 0.7;

/**
 * The frame a walker shows `k` (0 to 1) of the way through a step: one leg, then the other on
 * the next step, with the feet together as the step lands. A sheet of fewer than three frames
 * shows its first frame.
 */
export function strideFrame(k: number, step: number, frames: number): number {
  if (frames < 3) return 0;
  if (k >= STRIDE) return 1;
  return step % 2 === 0 ? 0 : 2;
}

/** The part of a sprite entry the pose rule reads: a stride sheet names the art pixels one pose is walked for. */
export interface StrideInfo {
  frames: number;
  stride?: { travel_mpx: number; anchor: [number, number]; bob?: boolean };
}

/** The most poses a second a walk shows: each pose stays two 60 Hz frames (tools/anim/anim.json `poses_per_s_max`). */
export const POSES_PER_S_MAX = 30;

/**
 * Every how many poses a walk shows one at the pace of `stepMs` a tile (the kernel's step time for the gait and the
 * load, `gaitStepMs`): 1 while the cycle's poses come at most `POSES_PER_S_MAX` a second, 2 at a run on a walk sheet.
 * A shown pose is still the one for the distance walked; only the poses between are skipped.
 */
export function poseEvery(travel: number, stepMs: number | undefined): number {
  if (!(travel > 0) || !(stepMs !== undefined && stepMs > 0)) return 1;
  const speed = (ART_PX * 1000) / stepMs;
  return Math.max(1, Math.ceil(speed / (travel * POSES_PER_S_MAX)));
}

/**
 * The pose of a distance-locked walk (tools/anim): the sheet's frames are its poses in order and, last, the standing
 * pose, and the pose shown is the nearest to the distance walked, `round(walked / travel)` round the cycle (a pose is
 * exact when the body is at it and out by half a pose at most before the next one: the foot is never more than
 * half a pose from the ground). `walked` is the art pixels the feet have gone (Walker.walked). At a pace too fast for
 * every pose (`stepMs`, a run) the nearest of every `poseEvery` poses is shown, so the foot is out by up to that many halves.
 */
export function poseFrame(walked: number, travel: number, frames: number, stepMs?: number): number {
  const poses = frames - 1;
  if (poses < 1 || !(travel > 0)) return 0;
  const every = poseEvery(travel, stepMs);
  return (Math.floor(Math.max(0, walked) / (travel * every) + 0.5) * every) % poses;
}

/** The frame of a body at rest: the last of a stride sheet, `fallback` for a time-based one. */
export function standingFrame(info: StrideInfo | undefined, fallback: number): number {
  return info?.stride ? info.frames - 1 : fallback;
}
