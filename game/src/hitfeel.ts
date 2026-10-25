/**
 * The feel of a blow (animation trial 2, 25.10): on the frame the tool comes down on a tree, a dig or a stone, the
 * swing holds still a moment (the hit-stop), the struck thing flashes white, the camera knocks once and the chips
 * fly when the swing lets go. No new frame is drawn: today's two work poses carry it. Client only; the kernel's clock
 * runs on through the hold, so the work lasts as long as before.
 *
 * `?juice=0` turns all of it off, for comparison with the game as it was. Under reduced motion (G29) there is no
 * knock and no flash, and the hold and the chips are halved.
 */
import type { AutoKind } from './work';

export interface HitFeel {
  /** how long the swing and the struck thing hold still on the blow, ms; the chips and the knock wait for its end */
  stopMs: number;
  /** how many drawn frames the struck thing shows white, 0 for none */
  flashFrames: number;
  /** the camera's knock: art pixels at most, and how long, ms; 0 px for none */
  shakePx: number;
  shakeMs: number;
  /** the share of today's chips that fly, 1 for all of them */
  chips: number;
}

/** The numbers per kind, so a "bit more" can be asked by number. Wood and stone are hard, earth is soft. */
export const HIT: Readonly<Record<AutoKind, HitFeel>> = {
  fell: { stopMs: 80, flashFrames: 2, shakePx: 2, shakeMs: 100, chips: 1 },
  mine: { stopMs: 90, flashFrames: 2, shakePx: 2, shakeMs: 100, chips: 1 },
  dig: { stopMs: 60, flashFrames: 1, shakePx: 1, shakeMs: 80, chips: 1 },
};

/** Reads `?juice=`: `0`, `off`, `false` or `none` turns the blow's feel off; anything else, or nothing, keeps it. */
export function parseJuice(query: string | null): boolean {
  if (query === null) return true;
  return !['0', 'off', 'false', 'none'].includes(query.trim().toLowerCase());
}

/** The blow's feel for a kind of work, or nothing when `?juice=0` asked for the game as it was; `motion` is false under reduced motion. */
export function hitFeel(kind: AutoKind, juice: boolean, motion: boolean): HitFeel | undefined {
  if (!juice) return undefined;
  const full = HIT[kind];
  if (motion) return full;
  return { stopMs: Math.round(full.stopMs / 2), flashFrames: 0, shakePx: 0, shakeMs: 0, chips: 0.5 };
}

/** How many of a burst of `n` chips fly at a share: at least one while any flew before. */
export function chipsOf(n: number, share: number): number {
  return n <= 0 ? 0 : Math.max(1, Math.round(n * share));
}

/** One frame of the knock: a whole number of art pixels on each axis, within `px`, from a random source in [0, 1). */
export function knockAt(px: number, random: () => number): { x: number; y: number } {
  const step = (): number => Math.min(px, Math.floor(random() * (2 * px + 1)) - px);
  return px <= 0 ? { x: 0, y: 0 } : { x: step(), y: step() };
}

/** Whether this page gives a blow its feel. Read once at load; `?juice=0` is the game as it was. */
export const JUICE: boolean = typeof window === 'undefined' ? true : parseJuice(new URLSearchParams(window.location.search).get('juice'));
