/**
 * Which effects are heard, and how loud (docs/design/SOUND.md sections 1.3 and 1.4): the batch rule for the
 * cues of one step, the gap that keeps a repeated cause from stacking, and the level by the cause's distance
 * from the player's own character. Pure: no audio graph, so the rules are tested on their own.
 */
import type { SfxId } from './sfx';

export type JingleId = 'level' | 'quest' | 'found';

/** One cue of a batch: an effect (with its own gain and pitch) or a jingle. */
export type Cue = { sfx: SfxId; gain?: number; detune?: number; heard?: Heard } | { jingle: JingleId };

/** Whose cause an effect is: the player's own, the world's (a wolf, a far bell, birds), or another player's. */
export type Owner = 'self' | 'world' | 'other';

/** Where an effect's cause is, as the player's character hears it. */
export interface Heard {
  /** whose cause it is; left out, the player's own */
  owner?: Owner;
  /** tiles from the player's character to the cause (the larger of the two axes); left out, beside the player */
  tiles?: number;
  /** the cause is outside the camera's view */
  offscreen?: boolean;
}

/** A jingle carries its batch alone: the level first, then a rare find, then a task done or a place restored. */
const JINGLE_RANK: readonly JingleId[] = ['level', 'found', 'quest'];

/** Without a jingle, at most two small cues speak for the batch: danger first (seen, a fall, hurt), then the earned cues in this order; any other effect comes after. */
const SMALL_RANK: readonly SfxId[] = ['growl', 'bell', 'thud', 'journal', 'coin', 'ui', 'perfect', 'pickup'];
export const SMALL_PER_BATCH = 2;

const smallRank = (id: SfxId): number => {
  const i = SMALL_RANK.indexOf(id);
  return i < 0 ? SMALL_RANK.length : i;
};

/**
 * The cues a batch plays: a batch with a jingle plays that jingle alone; one without plays its two first small
 * cues by rank. The journal is the pickup of a first-of-kind item, so the two never play together.
 */
export function planBatch(cues: readonly Cue[]): Cue[] {
  const jingles = cues.filter((c): c is { jingle: JingleId } => 'jingle' in c);
  if (jingles.length > 0) {
    const best = jingles.reduce((a, b) => (JINGLE_RANK.indexOf(b.jingle) < JINGLE_RANK.indexOf(a.jingle) ? b : a));
    return [best];
  }
  let small = cues.filter((c): c is Exclude<Cue, { jingle: JingleId }> => 'sfx' in c);
  if (small.some((c) => c.sfx === 'journal')) small = small.filter((c) => c.sfx !== 'pickup');
  // a stable sort: two cues of the same rank keep the order the step made them
  return small
    .map((c, i) => ({ c, i }))
    .sort((a, b) => smallRank(a.c.sfx) - smallRank(b.c.sfx) || a.i - b.i)
    .slice(0, SMALL_PER_BATCH)
    .map((x) => x.c);
}

/** A blow of the work is quieter than the work's end: the tree's landing and the stone's split keep their whole level. */
export const BLOW_GAIN = { thud: 0.6, strike: 0.65, dig: 0.7 } as const;

/** The least time between two of the same effect, in ms: a cause that repeats inside it shares one sound. */
export const MIN_GAP_MS: Partial<Record<SfxId, number>> = { wings: 1_500 };

/** Whether an effect may sound now, given when it last sounded (ms on the same clock), or never. */
export function gapAllows(id: SfxId, nowMs: number, lastMs: number | undefined): boolean {
  const gap = MIN_GAP_MS[id];
  return gap === undefined || lastMs === undefined || nowMs - lastMs >= gap;
}

/**
 * Effects that belong to the one who caused them: a coin, a pickup, a page of the journal, a press. Another
 * player's are never heard (CR-113): their chop is in the world, their purse is not.
 */
export const OWN_ONLY: ReadonlySet<SfxId> = new Set<SfxId>(['coin', 'pickup', 'journal', 'ui', 'back', 'perfect', 'good', 'miss', 'click', 'safe']);

/** Inside this many tiles a cause is heard whole. */
export const NEAR_TILES = 4;
/** From this many tiles on a cause is not heard at all. */
export const FAR_TILES = 24;
/** A cause outside the view is heard through this low-pass, in Hz, and at this share of its level. */
export const OFFSCREEN_LOWPASS = 1_200;
export const OFFSCREEN_GAIN = 0.7;

/**
 * The level of a cause by its distance, 0 to 1: whole inside NEAR_TILES, then NEAR_TILES / tiles (the inverse
 * distance of a point source: half as loud, 6 dB down, for each doubling), silent from FAR_TILES on.
 */
export function distanceGain(tiles: number): number {
  if (!(tiles > NEAR_TILES)) return 1;
  if (tiles >= FAR_TILES) return 0;
  return NEAR_TILES / tiles;
}

/** How an effect is heard: null when it is silent by rule, else the share of its level and a low-pass if any. */
export function hearing(id: SfxId, heard: Heard = {}): { gain: number; lowpass?: number } | null {
  if (heard.owner === 'other' && OWN_ONLY.has(id)) return null;
  const gain = distanceGain(heard.tiles ?? 0) * (heard.offscreen ? OFFSCREEN_GAIN : 1);
  if (gain <= 0) return null;
  return heard.offscreen ? { gain, lowpass: OFFSCREEN_LOWPASS } : { gain };
}
