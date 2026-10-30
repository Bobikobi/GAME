/**
 * Life between the states (HUNT_FAMILIES 7): which short fidget clip an animal plays while it stands in IDLE or
 * GRAZE, worked out without Phaser so it can be tested. The base loop always runs; after a delay drawn from its
 * class's range the animal plays one fidget picked by weight, then returns to the base loop and draws a new delay.
 * A fidget never follows itself, never plays inside its cooldown, and stops at its next pose when the animal's
 * awareness rises. Suspicion turns grooming and feeding off, makes the look, the ear and the kind's alarm fidget
 * three times as likely and halves the delay; at alert no fidget plays (the alert clip is the state's own). After a
 * flight the first fidget is a look.
 *
 * Nothing is rolled: every draw is the coat hash (coat.ts) of the creature's id and a public salt, keyed by the
 * episode's start and the fidget's index, so every client shows the same animal doing the same thing at the same
 * time, and no Math.random or clock is read. All times are integer milliseconds on one clock the caller owns (the
 * client's view time).
 *
 * The tables are data: tools/anim/anim.json, "fidgets" on a target (class, alarm clip, entries) and
 * "fidget_delay_ms" (the delay range of each class); each entry's pose times are its clip's `ms`. Not wired yet: the
 * client does not draw the hare or the crow today, so no scene calls this module.
 */
import { coatHash } from './coat';

export type Awareness = 'calm' | 'suspicion' | 'alert';

/** What a fidget does, which decides how awareness weighs it. */
export type FidgetKind = 'look' | 'ear' | 'call' | 'sit' | 'shake' | 'groom' | 'feed';
export const FIDGET_KINDS: readonly FidgetKind[] = ['look', 'ear', 'call', 'sit', 'shake', 'groom', 'feed'];

export type FidgetClass = 'prey' | 'hunter' | 'bird';

export interface FidgetEntry {
  /** the clip that plays (tools/anim/clips/<clip>.json) */
  clip: string;
  kind: FidgetKind;
  /** a positive integer: the entry's share of a pick among the entries allowed at that moment */
  weight: number;
  /** after it ends, this long before it may play again; 0 for none */
  cooldown_ms: number;
  /** times through the clip's poses in one play, [least, most]; once when left out */
  repeats?: readonly [number, number];
  /** the client may draw the down and up views mirrored, picked per play (a look to the other side) */
  mirror?: boolean;
  /** the clip's time per pose (its `ms`), integers */
  ms: readonly number[];
}

export interface FidgetTable {
  class: FidgetClass;
  /** the clip that is the kind's sign of suspicion (the hare sits up, the crow caws): three times as likely then */
  alarm?: string;
  entries: readonly FidgetEntry[];
}

/** A class's delay between two fidgets, [least, most] ms inclusive. */
export type DelayRanges = Readonly<Record<FidgetClass, readonly [number, number]>>;

/** Suspicion multiplies the look, ear and alarm weights by this. */
export const SUSPICION_BOOST = 3;

/**
 * A stretch of time at one awareness level, from `start`. `last` and `ready` carry over from the episode before
 * (episodeAfter), so a level change does not reset the rule against repeats or the cooldowns.
 */
export interface Episode {
  id: string | number;
  /** a public world number every client sees (never the kernel's rng seed) */
  salt: number;
  start: number;
  awareness: Awareness;
  /** the episode began as the animal settled after a flight: its first fidget is a look */
  afterFlight?: boolean;
  /** the clip of the last fidget played before this episode */
  last?: string;
  /** clip -> the time its cooldown ends */
  ready?: Readonly<Record<string, number>>;
}

/** One fidget in an episode's sequence. */
export interface FidgetPlay {
  /** its place in the episode, from 0 */
  index: number;
  clip: string;
  start: number;
  /** start + the clip's poses times the repeats */
  end: number;
  repeats: number;
  /** draw the down and up views mirrored (only for an entry marked `mirror`) */
  flip: boolean;
}

const PURPOSE_DELAY = 1;
const PURPOSE_PICK = 2;
const PURPOSE_REPEATS = 3;
const PURPOSE_FLIP = 4;

/** A 32-bit draw for one purpose of one fidget of one episode: the coat hash with the salt keyed by all three. */
export function fidgetHash(ep: Pick<Episode, 'id' | 'salt' | 'start'>, index: number, purpose: number): number {
  const key = (ep.salt ^ Math.imul(ep.start | 0, 0x27d4eb2d) ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(purpose, 0x85ebca6b)) | 0;
  return coatHash(ep.id, key);
}

/** The delay range at an awareness level: the class's, halved (rounded down) under suspicion. */
export function delayRange(cls: FidgetClass, awareness: Awareness, delays: DelayRanges): readonly [number, number] {
  const [lo, hi] = delays[cls];
  return awareness === 'suspicion' ? [Math.floor(lo / 2), Math.floor(hi / 2)] : [lo, hi];
}

/** An entry's weight at an awareness level: 0 when it may not play at all. */
export function weightAt(entry: FidgetEntry, table: FidgetTable, awareness: Awareness): number {
  if (awareness === 'alert') return 0;
  if (awareness === 'calm') return entry.weight;
  if (entry.kind === 'groom' || entry.kind === 'feed') return 0;
  const boosted = entry.kind === 'look' || entry.kind === 'ear' || entry.clip === table.alarm;
  return boosted ? entry.weight * SUSPICION_BOOST : entry.weight;
}

const poseTotal = (entry: FidgetEntry): number => entry.ms.reduce((a, b) => a + b, 0);

/** One slot of an episode: when a fidget was due, and what played (null: nothing was allowed then). */
interface Slot {
  due: number;
  play: FidgetPlay | null;
}

function* slots(table: FidgetTable, delays: DelayRanges, ep: Episode): Generator<Slot> {
  if (ep.awareness === 'alert') return;
  const [lo, hi] = delayRange(table.class, ep.awareness, delays);
  const ready: Record<string, number> = { ...(ep.ready ?? {}) };
  let last = ep.last;
  let t = ep.start;
  for (let slot = 0; ; slot += 1) {
    t += lo + (fidgetHash(ep, slot, PURPOSE_DELAY) % (hi - lo + 1));
    const now = t;
    let pick: FidgetEntry | undefined;
    if (slot === 0 && ep.afterFlight === true && ep.awareness === 'calm') {
      pick = table.entries.find((e) => e.kind === 'look');
    }
    if (pick === undefined) {
      const open = table.entries.filter((e) => e.clip !== last && (ready[e.clip] ?? -Infinity) <= now);
      const weights = open.map((e) => weightAt(e, table, ep.awareness));
      const total = weights.reduce((a, b) => a + b, 0);
      let x = total > 0 ? fidgetHash(ep, slot, PURPOSE_PICK) % total : 0;
      for (let i = 0; i < open.length && total > 0; i += 1) {
        x -= weights[i] ?? 0;
        if (x < 0) {
          pick = open[i];
          break;
        }
      }
    }
    if (pick === undefined) {
      yield { due: now, play: null };
      continue;
    }
    const [rLo, rHi] = pick.repeats ?? [1, 1];
    const repeats = rLo + (fidgetHash(ep, slot, PURPOSE_REPEATS) % (rHi - rLo + 1));
    const end = now + poseTotal(pick) * repeats;
    const flip = pick.mirror === true && (fidgetHash(ep, slot, PURPOSE_FLIP) & 1) === 1;
    yield { due: now, play: { index: slot, clip: pick.clip, start: now, end, repeats, flip } };
    last = pick.clip;
    ready[pick.clip] = end + pick.cooldown_ms;
    t = end;
  }
}

/**
 * The fidgets of an episode in order, without end: each starts a delay after the one before ends (the first a delay
 * after the episode starts). A slot where no entry may play (all cooling, or none allowed) plays nothing and the
 * next delay is drawn from it. Nothing at alert. Read it lazily: the sequence never ends, and a table where no entry
 * can ever play yields nothing more.
 */
export function* fidgetPlays(table: FidgetTable, delays: DelayRanges, ep: Episode, until = Number.MAX_SAFE_INTEGER): Generator<FidgetPlay> {
  for (const s of slots(table, delays, ep)) {
    if (s.due > until) return;
    if (s.play !== null) yield s.play;
  }
}

/** The fidget playing at time `t` of an episode, or null while the base loop plays (and before the episode). */
export function fidgetAt(table: FidgetTable, delays: DelayRanges, ep: Episode, t: number): FidgetPlay | null {
  if (t < ep.start) return null;
  for (const play of fidgetPlays(table, delays, ep, t)) {
    if (t < play.end) return play;
  }
  return null;
}

/**
 * The pose of a play showing at time `t` (an index into its clip's poses), or -1 outside it. The poses run in
 * order and start again for each repeat.
 */
export function poseAt(play: FidgetPlay, ms: readonly number[], t: number): number {
  if (t < play.start || t >= play.end) return -1;
  const total = ms.reduce((a, b) => a + b, 0);
  let x = (t - play.start) % total;
  for (let i = 0; i < ms.length; i += 1) {
    x -= ms[i] ?? 0;
    if (x < 0) return i;
  }
  return ms.length - 1;
}

/** When a play stops if the animal's awareness rises at time `t`: at the next pose boundary, never after its end. */
export function cutAt(play: FidgetPlay, ms: readonly number[], t: number): number {
  if (t <= play.start) return play.start;
  if (t >= play.end) return play.end;
  const total = ms.reduce((a, b) => a + b, 0);
  const into = (t - play.start) % total;
  let edge = t - into;
  for (const m of ms) {
    edge += m;
    if (edge >= t) break;
  }
  return Math.min(edge, play.end);
}

/**
 * The episode that starts at time `t` at a new awareness level, carrying the last fidget and the cooldowns of the
 * one before. A fidget playing at `t` is cut at its next pose (cutAt), and the new episode starts there.
 * `afterFlight` marks the animal settling after a flight.
 */
export function episodeAfter(table: FidgetTable, delays: DelayRanges, ep: Episode, t: number, awareness: Awareness, afterFlight = false): Episode {
  let last = ep.last;
  const ready: Record<string, number> = { ...(ep.ready ?? {}) };
  let start = t;
  if (t > ep.start) {
    for (const play of fidgetPlays(table, delays, ep, t)) {
      const ms = table.entries.find((e) => e.clip === play.clip)?.ms ?? [play.end - play.start];
      const cooldown = table.entries.find((e) => e.clip === play.clip)?.cooldown_ms ?? 0;
      const stop = t < play.end ? cutAt(play, ms, t) : play.end;
      last = play.clip;
      ready[play.clip] = stop + cooldown;
      if (t < play.end) {
        start = stop;
        break;
      }
    }
  }
  // a flight between the two breaks the chain: the look that follows it may repeat the last fidget before it
  return { id: ep.id, salt: ep.salt, start, awareness, afterFlight, last: afterFlight ? undefined : last, ready };
}
