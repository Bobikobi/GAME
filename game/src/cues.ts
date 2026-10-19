/**
 * The world's cues (docs/design/REACTIONS.md, section 5): birds lift over a find the player cannot
 * see yet, a fish rises at dusk. The kernel says which cues a step starts and where (cuesOnStep);
 * this says how each is drawn and heard. A cue is a shape and a sound, never colour alone, never a
 * number and never a word (G29, CR-17, STORY S1). With the motion group off it is a still shape.
 */
import type { CueName } from '@game/schema';
import type { SfxId } from './audio';

export interface CueLook {
  sfx: SfxId;
  /** how long the shape shows, in ms */
  ms: number;
  /** above the mist, so it reads over a find the mist still hides; or on the ground */
  over: boolean;
}

export const CUE_LOOK: Record<CueName, CueLook> = {
  birds_lift: { sfx: 'wings', ms: 1600, over: true },
  fish_rise: { sfx: 'plop', ms: 1200, over: false },
};

/** The birds that lift: three, each leaving a little later and a little to the side. */
export const BIRDS = [
  { dx: -3, delay: 0, rise: 34, drift: -10 },
  { dx: 2, delay: 120, rise: 30, drift: 8 },
  { dx: 0, delay: 240, rise: 38, drift: -2 },
] as const;

/** A cue is heard softer the farther it is: whole on the player's tile, never under a third. */
export function cueGain(d: number): number {
  return Math.max(0.35, 1 - d / 12);
}
