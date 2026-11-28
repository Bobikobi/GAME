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
import type { ClipInfo, CreatureClipInfo } from '@game/schema';
import type { Dir } from './input';

export type ClipVerb = ClipInfo['verb'];
export type ClipView = ClipInfo['view'];

/** The kernel's sprite entry with the clip the assembler lets ride on it (tools/src/assemble.ts); the kernel's own type does not name it. */
export type ClipSprite = SpriteInfo & { clip?: ClipInfo };
export type ClipSprites = Readonly<Record<string, ClipSprite>>;

/**
 * A creature's drawn sheets (#847): the kit names a sheet per creature, verb and view in `creature_clip`, and the creature's fallback
 * still names the creature in `still_of`. The assembler lets both ride on the sprite entry; the kernel's own type does not name them.
 */
export type CreatureSprite = SpriteInfo & { creature_clip?: CreatureClipInfo; still_of?: string };
export type CreatureSprites = Readonly<Record<string, CreatureSprite>>;

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
  /** The clip's fit as a share (its `fit_permille` over 1000, 1 when it has none). */
  fit: number;
  /** Where the drawn hand is at the start of each frame, from the first (sheet pixels), when the clip says: what the figure holds is laid there. */
  hand?: readonly (readonly [number, number])[];
}

const lookup = (verb: string, race: string, view: string): string => `${verb}|${race}|${view}`;

const indexes = new WeakMap<object, ReadonlyMap<string, readonly string[]>>();

/** The kit's clips by verb + race + view, built once for a sprites table: each lookup holds its takes' sheet keys, the first take first (then take 2, 3 and so on). */
function indexOf(sprites: ClipSprites): ReadonlyMap<string, readonly string[]> {
  let index = indexes.get(sprites);
  if (!index) {
    const found = new Map<string, { key: string; take: number }[]>();
    for (const [key, info] of Object.entries(sprites)) {
      const c = info.clip;
      if (!c) continue;
      const at = lookup(c.verb, c.race, c.view);
      const list = found.get(at) ?? [];
      list.push({ key, take: c.take ?? 1 });
      found.set(at, list);
    }
    const built = new Map<string, readonly string[]>();
    for (const [at, list] of found) built.set(at, list.sort((a, b) => a.take - b.take || (a.key < b.key ? -1 : 1)).map((e) => e.key));
    indexes.set(sprites, (index = built));
  }
  return index;
}

/**
 * The sprites the game loads before it starts: every sheet but the clips'. A clip sheet is big (a 45-frame take is a 2048 x 384 picture,
 * the clips of one race about 1.1 to 2.1 MB) and only the player's own figure plays one, so the world loads the clips of the player's
 * race once it knows the race (`raceClips`), and the other races' are never fetched.
 */
export function bootSprites(sprites: ClipSprites): [string, ClipSprite][] {
  return Object.entries(sprites).filter(([, info]) => info.clip === undefined);
}

/** The clip sheets of one race, by key: what the world fetches when a character of that race wakes. */
export function raceClips(sprites: ClipSprites, race: string): [string, ClipSprite][] {
  return Object.entries(sprites).filter(([, info]) => info.clip?.race === race);
}

/**
 * The clip for a verb, a race and a facing, or nothing: then the figure keeps today's walk sheet or code-drawn motion. A clip may have
 * several takes (near-identical drawings kept for variety, `take` on the kit's clip); `roll`, a number from 0 up to 1 (not 1), picks
 * among them, so a caller that plays a clip once asks with `Math.random()` and a caller that draws a clip's frames every frame keeps the
 * default 0, the first take, and never flickers between takes.
 */
export function clipFor(sprites: ClipSprites, verb: ClipVerb, race: string, dir: Dir, roll = 0): Found | undefined {
  const { view, flip } = viewOf(dir);
  const keys = indexOf(sprites).get(lookup(verb, race, view));
  if (!keys || keys.length === 0) return undefined;
  const key = keys[Math.min(keys.length - 1, Math.max(0, Math.floor(roll * keys.length)))]!;
  const info = sprites[key];
  if (!info?.clip) return undefined;
  return { key, flip, frames: info.frames, frame_ms: info.clip.frame_ms, anchor: info.clip.anchor, fit: (info.clip.fit_permille ?? 1000) / 1000, ...(info.clip.hand ? { hand: info.clip.hand } : {}) };
}

/**
 * Where the drawn hand is `elapsed` ms into the clip, in sheet pixels: the point of the frame that shows, gliding in a straight line to
 * the next frame's point, so what the hand holds moves with it and not in steps. Past the last point it stays on it. Nothing when the
 * clip names no hand (or it is not begun).
 */
export function handAt(found: Pick<Found, 'hand' | 'frame_ms'>, elapsed: number): readonly [number, number] | undefined {
  const pts = found.hand;
  if (!pts || pts.length === 0 || !(found.frame_ms > 0) || !(elapsed >= 0)) return undefined;
  const at = elapsed / found.frame_ms;
  const i = Math.floor(at);
  if (i >= pts.length - 1) return pts[pts.length - 1]!;
  const a = pts[i]!;
  const b = pts[i + 1]!;
  const u = at - i;
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}

/** A figure's image as the world draws it: its place, origin and scale, the frame's size, and whether the sheet is drawn flipped. */
export interface DrawnFigure {
  x: number;
  y: number;
  originX: number;
  originY: number;
  scaleX: number;
  scaleY: number;
  /** the frame's size in sheet pixels */
  w: number;
  h: number;
  flip: boolean;
}

/**
 * Where a point of the drawn frame (sheet pixels) is in the world: Phaser puts a flipped frame's pixel `px` at the origin less its
 * distance from the origin, so a figure facing right has its hand the left sheet's mirrored about the body.
 */
export function handWorld(fig: DrawnFigure, point: readonly [number, number]): { x: number; y: number } {
  const dx = point[0] - fig.originX * fig.w;
  return { x: fig.x + (fig.flip ? -dx : dx) * Math.abs(fig.scaleX), y: fig.y + (point[1] - fig.originY * fig.h) * Math.abs(fig.scaleY) };
}

/**
 * The frame shown `elapsed` ms after the clip started, or nothing once it is over. With `lasts` (the action's own length in
 * ms) the clip loops until the action ends and is cut there; without it the clip plays once. With `stretch` too, the clip plays once
 * across `lasts`.
 */
export function clipFrame(elapsed: number, frames: number, frameMs: number, lasts?: number, stretch = false): number | undefined {
  if (!(frames > 0) || !(frameMs > 0) || elapsed < 0) return undefined;
  // a clip that is the whole of the action (the lift) is spread over `lasts`, its last frame ending with it, however long the kernel says
  if (stretch && lasts !== undefined && lasts > 0) return elapsed < lasts ? Math.min(frames - 1, Math.floor((elapsed * frames) / lasts)) : undefined;
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

/** What a clip's own record holds (a test reads it, e2e/stones.ts): a clip began, a frame was set, a clip ended, a stone left the hand. `at` is the scene clock, ms. */
export type ClipTrace =
  | { e: 'start'; key: string; at: number; frames: number; frameMs: number; lasts?: number; stretch?: boolean }
  | { e: 'frame'; frame: number; at: number }
  | { e: 'end'; at: number }
  | { e: 'release'; key: string | undefined; frame: number | undefined; due: number; at: number };

/** One clip under way on the figure: which sheet, when it began, and how long the action lasts when it has a length. */
export class ClipPlayer {
  private run: { found: Found; start: number; lasts?: number; stretch?: boolean } | null = null;
  /** Test-only: while set, every start, frame change and end is pushed here, so a test reads what the game set rather than sampling the screen. Off (undefined) in play. */
  trace: ClipTrace[] | undefined;
  private shown = -1;

  /** Whether a clip is under way (it may be over by now: `frameAt` says). */
  get active(): boolean {
    return this.run !== null;
  }

  /** The clip under way (the take that was picked), or nothing: what a caller that needs the clip's own numbers, the hand's points, reads, so it never asks the kit again and gets another take. */
  get current(): Found | undefined {
    return this.run?.found;
  }

  /** Begins a clip at `now`; one already playing is replaced, so a new blow restarts the swing. */
  start(found: Found, now: number, lasts?: number, stretch = false): void {
    this.run = { found, start: now, ...(lasts === undefined ? {} : { lasts }), ...(stretch ? { stretch } : {}) };
    this.shown = -1;
    this.trace?.push({ e: 'start', key: found.key, at: now, frames: found.frames, frameMs: found.frame_ms, ...(lasts === undefined ? {} : { lasts }), ...(stretch ? { stretch } : {}) });
  }

  /** Ends the clip without a word: the caller puts the figure back. */
  stop(): void {
    this.run = null;
  }

  /** The sheet and frame to show at `now`; nothing (and the clip is over) once it has run its course. */
  frameAt(now: number): { found: Found; frame: number } | undefined {
    const r = this.run;
    if (!r) return undefined;
    const frame = clipFrame(now - r.start, r.found.frames, r.found.frame_ms, r.lasts, r.stretch);
    if (frame === undefined) {
      this.run = null;
      this.trace?.push({ e: 'end', at: now });
      return undefined;
    }
    if (this.trace && frame !== this.shown) this.trace.push({ e: 'frame', frame, at: now });
    this.shown = frame;
    return { found: r.found, frame };
  }
}

const creatureIndexes = new WeakMap<object, ReadonlyMap<string, string>>();

/** The kit's creature sheets by creature + verb + view, built once for a sprites table. */
function creatureIndexOf(sprites: CreatureSprites): ReadonlyMap<string, string> {
  let index = creatureIndexes.get(sprites);
  if (!index) {
    const built = new Map<string, string>();
    for (const [key, info] of Object.entries(sprites)) {
      const c = info.creature_clip;
      if (c) built.set(lookup(c.verb, c.creature, c.view), key);
    }
    creatureIndexes.set(sprites, (index = built));
  }
  return index;
}

/** The keys of every sheet a creature has in the kit. */
export function creatureSheets(sprites: CreatureSprites, creature: string): string[] {
  return Object.entries(sprites).filter(([, info]) => info.creature_clip?.creature === creature).map(([key]) => key);
}

/** The creature a fallback still stands for (kit `still_of`), or nothing for a picture that stands for none. */
export function creatureOf(sprites: CreatureSprites, still: string): string | undefined {
  return sprites[still]?.still_of;
}

/** What the screen shows of a creature's sheet: the sheet, whether it is flipped, and its own numbers. */
export interface FoundCreature {
  key: string;
  view: ClipView;
  flip: boolean;
  frames: number;
  frame_ms: number;
  /** the sheet pixel the feet stand on, and the frame's size */
  anchor: readonly [number, number];
  w: number;
  h: number;
  /** the clip's fit as a share (`fit_permille` over 1000, 1 when it has none) */
  fit: number;
  /** the sheet pixel the eye (or the middle of the eyes) is at, where the view shows one; the middle top of the figure from behind */
  head?: readonly [number, number];
}

/** The view a creature shows facing a way, and whether the sheet is drawn flipped: right is the left sheet flipped (`viewOf`). */
export function viewOfHeading(heading: readonly [number, number], last?: Dir): { dir: Dir; view: ClipView; flip: boolean } | undefined {
  const [hx, hy] = heading;
  const dir: Dir | undefined = hx < 0 ? 'left' : hx > 0 ? 'right' : hy < 0 ? 'up' : hy > 0 ? 'down' : last;
  return dir === undefined ? undefined : { dir, ...viewOf(dir) };
}

/** The creature's sheet for a verb and a facing, or nothing: then the world keeps the fallback still. */
export function creatureClipFor(sprites: CreatureSprites, creature: string, verb: CreatureClipInfo['verb'], dir: Dir): FoundCreature | undefined {
  const { view, flip } = viewOf(dir);
  const key = creatureIndexOf(sprites).get(lookup(verb, creature, view));
  const info = key === undefined ? undefined : sprites[key];
  const c = info?.creature_clip;
  if (key === undefined || !info || !c) return undefined;
  return { key, view, flip, frames: info.frames, frame_ms: c.frame_ms, anchor: c.anchor, w: info.w, h: info.h, fit: (c.fit_permille ?? 1000) / 1000, ...(c.head ? { head: c.head } : {}) };
}

/**
 * Whether a creature walks or stands, from where it is drawn: it walks while its drawn place moves and for `hold` ms after, so the
 * hold of a step between two kernel tiles, or a pause at the "!" , does not flicker between the sheets. Display only.
 */
export class WalkWatch {
  private last: readonly [number, number] | undefined;
  private movedAt = -Infinity;

  constructor(private readonly hold = 250) {}

  /** Feeds the drawn place (tiles) at `now` (ms) and says whether the creature is walking. */
  walking(now: number, at: readonly [number, number]): boolean {
    if (this.last && (Math.abs(at[0] - this.last[0]) > 1e-6 || Math.abs(at[1] - this.last[1]) > 1e-6)) this.movedAt = now;
    this.last = [at[0], at[1]];
    return now - this.movedAt < this.hold;
  }
}

/**
 * Where a creature's image is placed so that its feet's column sits at `x`: the world puts the sprite's origin at the middle of its
 * frame (the shadow layer reads it so) and shifts the image by the anchor's distance from the middle, mirrored when the sheet is flipped.
 */
export function creatureX(x: number, found: Pick<FoundCreature, 'anchor' | 'w' | 'flip'>, scale: number): number {
  const d = (found.anchor[0] - found.w / 2) * scale;
  return found.flip ? x + d : x - d;
}

/** Where a sheet pixel (the head) is in the world for an image placed so: the same mirror about the feet's column (`handWorld`'s rule). */
export function creaturePoint(x: number, y: number, found: Pick<FoundCreature, 'anchor' | 'flip'>, point: readonly [number, number], scale: number): { x: number; y: number } {
  const dx = (point[0] - found.anchor[0]) * scale;
  return { x: x + (found.flip ? -dx : dx), y: y + (point[1] - found.anchor[1]) * scale };
}
