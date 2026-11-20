/**
 * A character clip is played by name (#742): the kit lists a sheet per verb, race and view, and the figure asks for it by
 * those three. Nothing here draws and nothing here is the kernel's: a clip is display only, so the kernel still decides when
 * a strike lands and how long an action takes, and a clip's length never changes an outcome, a duration or a reward. Pure,
 * so the lookup and the frame rule can be tested without a scene (game/test/clips.test.ts).
 *
 * One rule for every verb: a clip starts at its first frame, shows each frame for its own `frame_ms`, and
 *  - while an action that has a length (felling, quarrying, digging: the kernel's `busy` ms) is under way it loops, and the
 *    action's end cuts it, so a clip longer than its action is cut and a shorter one repeats, as a swing repeats;
 *  - an action with no length of its own (a fight outcome) plays the clip once.
 * With no clip for a verb, race and view the figure keeps today's walk sheet or code-drawn motion.
 */
import type { SpriteInfo, WorkKind } from '@game/kernel';
import type { ClipInfo } from '@game/schema';
import type { Dir } from './input';

export type ClipVerb = ClipInfo['verb'];
export type ClipView = ClipInfo['view'];

/** The kernel's sprite entry with the clip the assembler lets ride on it (tools/src/assemble.ts); the kernel's own type does not name it. */
export type ClipSprite = SpriteInfo & { clip?: ClipInfo };
export type ClipSprites = Readonly<Record<string, ClipSprite>>;

/** The view of a facing, and whether the sheet is drawn flipped: the right side is the left one flipped, as the walk's is. */
export function viewOf(dir: Dir): { view: ClipView; flip: boolean } {
  if (dir === 'left') return { view: 'left', flip: false };
  if (dir === 'right') return { view: 'left', flip: true };
  return { view: dir === 'down' ? 'front' : 'back', flip: false };
}

/** What the screen shows of a clip: the sheet, whether it is flipped, and the clip's own numbers. */
export interface Found {
  key: string;
  flip: boolean;
  frames: number;
  frame_ms: number;
  anchor: readonly [number, number];
}

const lookup = (verb: string, race: string, view: string): string => `${verb}|${race}|${view}`;

const indexes = new WeakMap<object, ReadonlyMap<string, string>>();

/** The kit's clips by verb + race + view, built once for a sprites table. */
function indexOf(sprites: ClipSprites): ReadonlyMap<string, string> {
  let index = indexes.get(sprites);
  if (!index) {
    const built = new Map<string, string>();
    for (const [key, info] of Object.entries(sprites)) {
      const c = info.clip;
      if (c) built.set(lookup(c.verb, c.race, c.view), key);
    }
    indexes.set(sprites, (index = built));
  }
  return index;
}

/** The clip for a verb, a race and a facing, or nothing: then the figure keeps today's walk sheet or code-drawn motion. */
export function clipFor(sprites: ClipSprites, verb: ClipVerb, race: string, dir: Dir): Found | undefined {
  const { view, flip } = viewOf(dir);
  const key = indexOf(sprites).get(lookup(verb, race, view));
  const info = key === undefined ? undefined : sprites[key];
  if (key === undefined || !info?.clip) return undefined;
  return { key, flip, frames: info.frames, frame_ms: info.clip.frame_ms, anchor: info.clip.anchor };
}

/**
 * The frame shown `elapsed` ms after the clip started, or nothing once it is over. With `lasts` (the action's own length in
 * ms) the clip loops until the action ends and is cut there; without it the clip plays once.
 */
export function clipFrame(elapsed: number, frames: number, frameMs: number, lasts?: number): number | undefined {
  if (!(frames > 0) || !(frameMs > 0) || elapsed < 0) return undefined;
  const n = Math.floor(elapsed / frameMs);
  if (lasts === undefined) return n < frames ? n : undefined;
  return elapsed < lasts ? n % frames : undefined;
}

/** The verb a work kind plays (kernel/src/work.ts `WorkKind`): a tree is felled, a stone quarried, a spot dug, a river fished, the rest picked up. */
export const VERB_OF_AUTO: Readonly<Record<WorkKind, ClipVerb>> = { fell: 'fell', mine: 'quarry', dig: 'dig', fish: 'fish', pick: 'pickup' };

/** The part of a fight outcome (kernel/src/events.ts) the figure reads. */
export interface OutcomeLike {
  kind: 'attack' | 'critical' | 'miss' | 'guard' | 'dodge';
  striker: { side: 'player' | 'foe' };
  struck: { side: 'player' | 'foe' };
}

/**
 * The verb the player's own figure plays for one outcome of the fight (#726), or nothing. The player strikes whatever the
 * outcome of his blow was; struck, he is hit by an attack or a critical, guards a guarded blow and dodges a dodged one, and a
 * blow that missed him (`miss`) asks nothing of him.
 */
export function verbOfOutcome(o: OutcomeLike): ClipVerb | undefined {
  if (o.striker.side === 'player') return 'strike';
  if (o.struck.side !== 'player') return undefined;
  if (o.kind === 'attack' || o.kind === 'critical') return 'hit';
  if (o.kind === 'guard') return 'guard';
  if (o.kind === 'dodge') return 'dodge';
  return undefined;
}

/** One clip under way on the figure: which sheet, when it began, and how long the action lasts when it has a length. */
export class ClipPlayer {
  private run: { found: Found; start: number; lasts?: number } | null = null;

  /** Whether a clip is under way (it may be over by now: `frameAt` says). */
  get active(): boolean {
    return this.run !== null;
  }

  /** Begins a clip at `now`; one already playing is replaced, so a new blow restarts the swing. */
  start(found: Found, now: number, lasts?: number): void {
    this.run = { found, start: now, ...(lasts === undefined ? {} : { lasts }) };
  }

  /** Ends the clip without a word: the caller puts the figure back. */
  stop(): void {
    this.run = null;
  }

  /** The sheet and frame to show at `now`; nothing (and the clip is over) once it has run its course. */
  frameAt(now: number): { found: Found; frame: number } | undefined {
    const r = this.run;
    if (!r) return undefined;
    const frame = clipFrame(now - r.start, r.found.frames, r.found.frame_ms, r.lasts);
    if (frame === undefined) {
      this.run = null;
      return undefined;
    }
    return { found: r.found, frame };
  }
}
