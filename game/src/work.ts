/**
 * Work that runs by itself after one press (DECISIONS.md, 2026-10-11): felling with the axe,
 * digging with the trowel, mining with the pick. The kernel decides how long it lasts and
 * what it yields; this file only says which nodes work this way and how the time splits
 * into swings. Pure, so the rhythm can be tested without a scene.
 */
import type { Bundle } from '@game/kernel';

export type AutoKind = 'fell' | 'dig' | 'mine';

/** The tool that makes a node work by itself, and what the work is called. A node marked `work: "mine"` works by itself with no tool; herbs and the keystone keep their minigames. */
const BY_TOOL: Readonly<Record<string, AutoKind>> = { axe: 'fell', trowel: 'dig', pick: 'mine' };

export function autoKind(tool: string | undefined): AutoKind | undefined {
  return tool === undefined ? undefined : BY_TOOL[tool];
}

/** What a resource node asks for: a tree, a mined stone, or whatever else is worked with a tool. */
export function resourceKind(r: Pick<Bundle['resources'][string], 'tool' | 'work'>): AutoKind | undefined {
  return r.work === 'mine' && r.tool === undefined ? 'mine' : autoKind(r.tool);
}

/** What a treasure asks for: a dig with a trowel; a find picked up by hand has no work. */
export function treasureKind(t: Pick<Bundle['treasures'][string], 'tool'>): AutoKind | undefined {
  return autoKind(t.tool);
}

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
