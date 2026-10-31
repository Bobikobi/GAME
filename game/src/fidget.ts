/**
 * Life between the states (HUNT_FAMILIES 7): which short fidget clip an animal plays while its idle loop runs, worked
 * out without Phaser so it can be tested. The base loop is the idle: in IDLE, and in GRAZE's head-up beat, which the
 * client draws as the idle. Never over GRAZE's head-down poses: the fidgets are keyed from the idle's first pose, and
 * HUNTING 2 shortens the animal's sight while its head is down, so a head-up fidget there would draw a sight the
 * kernel does not have. The caller runs an episode only while the idle is the base loop. On the kernel's lengths
 * (IDLE 2 to 6 thinks of 800 ms, GRAZE's head-up beat 2) a first fidget, no sooner than the class's least delay on
 * the idle's next pose boundary (2.8 s for a calm hare, 2.1 s for a calm crow), never fits a head-up beat, and comes
 * in about one calm IDLE in six for the hare and one in two for the crow (DECISIONS 2026-10-30, question 5).
 *
 * After a delay drawn from its class's range the animal plays one fidget picked by weight, starting on the next pose
 * boundary of the idle loop; when the fidget ends the client restarts the idle at its first pose (the hare's crouch,
 * the crow's stand: the pose every fidget is keyed from), then a new delay is drawn. A fidget never follows itself,
 * never plays inside its cooldown, and stops at its next pose when the animal's awareness rises. Suspicion (the
 * kernel's noticing count above 0, HUNTING 3) turns grooming off, makes the look, the ear and the kind's wary fidget
 * (the hare's sit-up) three times as likely and halves the delay; at alert no fidget plays (the alert clip is the
 * state's own). No fidget is a voice: a voice is a state's own sound (the crow's caw is its ALERT's alarm,
 * CREATURE_BEHAVIOUR 1, played when the kernel sends it; the ground fowl's call ends its FLEE). After a flight the
 * first fidget is a look, calm or suspicious, and a change between the two before it plays keeps it owed. Feeding is never a fidget: the graze and the peck are GRAZE's own clips, and a head-down pose over the idle would draw the
 * shorter sight while the kernel sees in full.
 *
 * Nothing is rolled: every draw is lookHash of the creature's id and a public salt, keyed by the episode's start and
 * the fidget's index, and no Math.random or clock is read. A fidget is look alone, so a hash of public numbers is
 * enough; a coat, which the hide carries, is the server's draw (coat.ts). All times are integer milliseconds on
 * one world clock that every client derives from the shared state (the kernel's tick of the awareness change, in
 * ms), never a client's own load-relative clock: the draws key on `start`, so two devices that disagree about it by
 * 1 ms play a different sequence, not the same one shifted. On that clock every client shows the same animal doing
 * the same thing at the same time. The kernel keeps no tick for suspicion yet, only the count: until the pull request
 * that steps animals records the think at which the count leaves 0, a suspicion episode starts on each client's own
 * reading, and its fidgets are not shared.
 *
 * The tables are data: tools/anim/anim.json, "fidgets" on a target (class, base clip, wary clip, entries) and
 * "fidget_delay_ms" (the delay range of each class); each entry's pose times are its clip's `ms`, and `base_ms` is the
 * base clip's. A scene keeps one fidgetCursor per visible animal and asks it every frame (fidgetAt and episodeAfter
 * replay the episode from its start, for tests and one-off lookups). Not wired yet: the client does not draw the hare
 * or the crow today, so no scene calls this module. A scene finds a table from the creature's kind id (core/hare to
 * the target hare, core/crow to crow), never from the kind's look, which the crow shares with the sparrow.
 */
export type Awareness = 'calm' | 'suspicion' | 'alert';

/** What a fidget does, which decides how awareness weighs it. Never a voice, which is a state's own sound. */
export type FidgetKind = 'look' | 'ear' | 'sit' | 'shake' | 'groom';
export const FIDGET_KINDS: readonly FidgetKind[] = ['look', 'ear', 'sit', 'shake', 'groom'];

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
  /** the base loop's time per pose (the idle clip's `ms`): a fidget starts only on one of its pose boundaries */
  base_ms: readonly number[];
  /**
   * the clip that is the kind's sign of suspicion (the hare's part sit-up): three times as likely then. Not its ALERT
   * tell (the hare's full sit-up, hare_alert) and never a voice (the crow's caw is its alarm), so the crow has none
   */
  wary?: string;
  entries: readonly FidgetEntry[];
}

/** A class's delay between two fidgets, [least, most] ms inclusive. */
export type DelayRanges = Readonly<Record<FidgetClass, readonly [number, number]>>;

/** Suspicion multiplies the look, ear and wary weights by this. */
export const SUSPICION_BOOST = 3;

/**
 * A stretch of time at one awareness level, from `start`. `last`, `ready` and `base` carry over from the episode
 * before (episodeAfter), so a level change does not reset the rule against repeats, the cooldowns or the idle's phase.
 */
export interface Episode {
  id: string | number;
  /** a public world number every client sees (never the kernel's rng seed) */
  salt: number;
  /** on the shared world clock (see the module doc) */
  start: number;
  awareness: Awareness;
  /**
   * the animal settled after a flight and has not fidgeted since: its first fidget is a look. episodeAfter passes it
   * on to a new level of calm or suspicion until the look has begun; an ALERT ends it
   */
  afterFlight?: boolean;
  /** the clip of the last fidget played before this episode */
  last?: string;
  /** clip -> the time its cooldown ends */
  ready?: Readonly<Record<string, number>>;
  /** when the base loop last started at its first pose (a state entry, or a fidget's end); `start` when left out */
  base?: number;
  /**
   * the creature is drawn on a one-sided body (a coat whose body sets "one_sided" in anim.json: the pied hare's
   * patches), so no play is mirrored: a flip would move the patches to the other side for the length of the fidget
   */
  oneSided?: boolean;
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
  /** draw the down and up views mirrored (only for an entry marked `mirror`, never on a one-sided body) */
  flip: boolean;
}

const PURPOSE_DELAY = 1;
const PURPOSE_PICK = 2;
const PURPOSE_REPEATS = 3;
const PURPOSE_FLIP = 4;

/**
 * A fixed 32-bit hash of a creature id and a 32-bit salt: FNV-1a over the id's UTF-16 code units (offset basis
 * 2166136261, prime 16777619, so a numeric id and its text hash alike), mixed with the salt and run through murmur3's
 * 32-bit finaliser, all in Math.imul (richground's tile hash multiplies in doubles and would drop an id's low bits).
 * coat.ts held it until the coat became the server's draw; a fidget is look alone and needs no seed.
 */
export function lookHash(id: string | number, salt: number): number {
  const text = String(id);
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h = (h ^ Math.imul(salt | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** A 32-bit draw for one purpose of one fidget of one episode: lookHash with the salt keyed by all three. */
export function fidgetHash(ep: Pick<Episode, 'id' | 'salt' | 'start'>, index: number, purpose: number): number {
  const key = (ep.salt ^ Math.imul(ep.start | 0, 0x27d4eb2d) ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(purpose, 0x85ebca6b)) | 0;
  return lookHash(ep.id, key);
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
  if (entry.kind === 'groom') return 0;
  const boosted = entry.kind === 'look' || entry.kind === 'ear' || entry.clip === table.wary;
  return boosted ? entry.weight * SUSPICION_BOOST : entry.weight;
}

const sum = (ms: readonly number[]): number => ms.reduce((a, b) => a + b, 0);

/**
 * The first pose boundary of the base loop at or after `t`, the loop having started at its first pose at `anchor`
 * and run since without a break: the anchor itself for a `t` at or before it, and `t` when there are no base poses.
 */
export function baseBoundary(baseMs: readonly number[], anchor: number, t: number): number {
  if (t <= anchor) return anchor;
  const cycle = sum(baseMs);
  if (!(cycle > 0)) return t;
  const into = (t - anchor) % cycle;
  let edge = t - into;
  for (const m of baseMs) {
    if (edge >= t) break;
    edge += m;
  }
  return edge;
}

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
  let anchor = ep.base ?? ep.start;
  let t = ep.start;
  for (let slot = 0; ; slot += 1) {
    const now = baseBoundary(table.base_ms, anchor, t + lo + (fidgetHash(ep, slot, PURPOSE_DELAY) % (hi - lo + 1)));
    let pick: FidgetEntry | undefined;
    if (slot === 0 && ep.afterFlight === true) {
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
      // nothing may play now; when no entry but the last has a weight at this level, nothing ever will (the last
      // stays the last while nothing plays), so the sequence ends instead of drawing empty slots for ever
      if (table.entries.every((e) => e.clip === last || weightAt(e, table, ep.awareness) === 0)) return;
      yield { due: now, play: null };
      t = now;
      continue;
    }
    const [rLo, rHi] = pick.repeats ?? [1, 1];
    const repeats = rLo + (fidgetHash(ep, slot, PURPOSE_REPEATS) % (rHi - rLo + 1));
    const end = now + sum(pick.ms) * repeats;
    const flip = ep.oneSided !== true && pick.mirror === true && (fidgetHash(ep, slot, PURPOSE_FLIP) & 1) === 1;
    yield { due: now, play: { index: slot, clip: pick.clip, start: now, end, repeats, flip } };
    last = pick.clip;
    ready[pick.clip] = end + pick.cooldown_ms;
    anchor = end;
    t = end;
  }
}

/**
 * The fidgets of an episode in order: each starts on the first base pose boundary a delay after the one before ends
 * (the first a delay after the episode starts). A slot where no entry may play (all cooling, or none allowed) plays
 * nothing and the next delay is drawn from it. Nothing at alert. Read it lazily: the sequence is endless while some
 * entry can still play, and ends once none ever can (a table whose only allowed entry is the last one played).
 */
export function* fidgetPlays(table: FidgetTable, delays: DelayRanges, ep: Episode, until = Number.MAX_SAFE_INTEGER): Generator<FidgetPlay> {
  for (const s of slots(table, delays, ep)) {
    if (s.due > until) return;
    if (s.play !== null) yield s.play;
  }
}

/** Where an episode stands for a scene that asks about it as time goes on. */
export interface FidgetCursor {
  /** The fidget playing at `t`, or null while the base loop plays (and before the episode). */
  at(t: number): FidgetPlay | null;
  /** The episode that starts at `t` at a new awareness level (episodeAfter). */
  after(t: number, awareness: Awareness, afterFlight?: boolean): Episode;
}

/**
 * A cursor over one episode: it keeps the sequence and moves forward only, so a call costs nothing more however
 * long the animal has been at one level (fidgetAt replays from the start every time). A `t` earlier than the last
 * asked starts the replay again; the answers are fidgetAt's and episodeAfter's at every `t`.
 */
export function fidgetCursor(table: FidgetTable, delays: DelayRanges, ep: Episode): FidgetCursor {
  const entryOf = (clip: string): FidgetEntry | undefined => table.entries.find((e) => e.clip === clip);
  let plays: Generator<FidgetPlay>;
  let next: FidgetPlay | null | undefined;
  let last: string | undefined;
  let ready: Record<string, number>;
  let base: number;
  let asked: number;
  /** some play of the episode has ended by the last `t` asked */
  let played: boolean;
  const reset = (): void => {
    plays = fidgetPlays(table, delays, ep);
    next = undefined;
    last = ep.last;
    ready = { ...(ep.ready ?? {}) };
    base = ep.base ?? ep.start;
    asked = -Infinity;
    played = false;
  };
  const peek = (): FidgetPlay | null => {
    if (next === undefined) {
      const r = plays.next();
      next = r.done === true ? null : r.value;
    }
    return next;
  };
  /** record every play that has ended by `t`; afterwards peek() is the first that has not */
  const advance = (t: number): void => {
    if (t < asked) reset();
    asked = t;
    for (let p = peek(); p !== null && p.end <= t; p = peek()) {
      last = p.clip;
      ready[p.clip] = p.end + (entryOf(p.clip)?.cooldown_ms ?? 0);
      base = p.end;
      next = undefined;
      played = true;
    }
  };
  reset();
  return {
    at(t) {
      if (t < ep.start) return null;
      advance(t);
      const p = peek();
      return p !== null && p.start <= t ? p : null;
    },
    after(t, awareness, afterFlight = false) {
      let start = t;
      let carryLast = ep.last;
      let carryReady: Record<string, number> = { ...(ep.ready ?? {}) };
      let carryBase = ep.base ?? ep.start;
      let begun = false;
      if (t > ep.start) {
        advance(t);
        begun = played;
        carryLast = last;
        carryReady = { ...ready };
        carryBase = base;
        const p = peek();
        // a fidget that has begun is cut at its next pose and the new episode starts there; one due exactly at `t`
        // has shown nothing, so it is neither the last nor cooling
        if (p !== null && p.start < t) {
          begun = true;
          const entry = entryOf(p.clip);
          start = cutAt(p, entry?.ms ?? [p.end - p.start], t);
          carryLast = p.clip;
          carryReady[p.clip] = start + (entry?.cooldown_ms ?? 0);
          carryBase = start;
        }
      }
      // the idle starts again at its first pose after the alert clip or a flight
      if (ep.awareness === 'alert' || afterFlight) carryBase = start;
      // the look owed after a flight stays owed at a new level of calm or suspicion until it has begun (the idle keeps
      // its phase, nothing has played); an ALERT ends the settling
      const owed = afterFlight || (ep.afterFlight === true && !begun && awareness !== 'alert');
      // a flight between the two breaks the chain: the look that follows it may repeat the last fidget before it
      const out: Episode = { id: ep.id, salt: ep.salt, start, awareness, afterFlight: owed, last: afterFlight ? undefined : carryLast, ready: carryReady, base: carryBase };
      if (ep.oneSided === true) out.oneSided = true;
      return out;
    },
  };
}

/** The fidget playing at time `t` of an episode, or null while the base loop plays (and before the episode). */
export function fidgetAt(table: FidgetTable, delays: DelayRanges, ep: Episode, t: number): FidgetPlay | null {
  return fidgetCursor(table, delays, ep).at(t);
}

/**
 * The pose of a play showing at time `t` (an index into its clip's poses), or -1 outside it. The poses run in
 * order and start again for each repeat.
 */
export function poseAt(play: FidgetPlay, ms: readonly number[], t: number): number {
  if (t < play.start || t >= play.end) return -1;
  let x = (t - play.start) % sum(ms);
  for (let i = 0; i < ms.length; i += 1) {
    x -= ms[i] ?? 0;
    if (x < 0) return i;
  }
  return ms.length - 1;
}

/**
 * When a play stops if the animal's awareness rises at time `t`: at the next pose boundary (`t` itself when it is
 * one, a repeat's start included), never after its end.
 */
export function cutAt(play: FidgetPlay, ms: readonly number[], t: number): number {
  if (t <= play.start) return play.start;
  if (t >= play.end) return play.end;
  let edge = t - ((t - play.start) % sum(ms));
  for (const m of ms) {
    if (edge >= t) break;
    edge += m;
  }
  return Math.min(edge, play.end);
}

/**
 * The episode that starts at time `t` at a new awareness level, carrying the last fidget, the cooldowns and the idle's
 * phase of the one before. A fidget that has begun by `t` is cut at its next pose (cutAt), and the new episode starts
 * there. `afterFlight` marks the animal settling after a flight; an episode after a flight whose look has not begun
 * passes the look on to a new level of calm or suspicion. Replays from the episode's start: a scene asks its cursor's
 * `after` instead.
 */
export function episodeAfter(table: FidgetTable, delays: DelayRanges, ep: Episode, t: number, awareness: Awareness, afterFlight = false): Episode {
  return fidgetCursor(table, delays, ep).after(t, awareness, afterFlight);
}
