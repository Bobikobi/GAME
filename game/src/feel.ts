/**
 * The feel layer (docs/design/ANIMATION.md section 4): small offsets that make a few frames read as alive,
 * worked out from the clock and what a body is doing. Pure: no Phaser, and no randomness beyond a seeded
 * hash of the thing's id, so the same id at the same time always feels the same.
 *
 * Every number is in art pixels at 64 px a tile and a whole number, because a half pixel breaks the grid;
 * the scene turns them into world units (T / ART_PX). Translation and size steps only: rotating a drawn
 * part breaks the pixel grid. Every effect is zero at rest, and with `motion` false (reduced motion, G29)
 * every effect is zero except the timings of `swingPhase`, which are rhythm and not movement.
 */

/** The starting numbers of ANIMATION.md section 4, one place so a preview can move them. */
export const FEEL = {
  /** a human step: peak-to-trough art px of the bob */
  bob: 4,
  /** the chest lifts this many px, for half of a period of this many ms (by id) */
  breath: { px: 1, minMs: 1000, maxMs: 1500 },
  /** eyes closed for `ms`, once in each slot, `from` ms into it at the earliest: gaps of 3 to 5 s */
  blink: { ms: 100, slotMs: 4000, from: 1500, spread: 1000 },
  /** a squash or stretch lasts this many ms a frame */
  squashFrameMs: 50,
  /** the lean eases in over three frames of this many ms */
  leanFrameMs: 50,
  /** a part that follows the body lags this many ms a segment */
  tailLagMs: 50,
  hit: { flashFrames: 2, lightStopMs: 50, heavyStopMs: 100 },
  shake: { px: 2, ms: 50 },
} as const;

export interface Offset {
  /** art px, right is positive */
  dx: number;
  /** art px, down is positive */
  dy: number;
}

export const REST: Readonly<Offset> = { dx: 0, dy: 0 };

/** A small stable hash of a string and a whole number, 0 to 0xffff. */
export function seed(id: string, n = 0): number {
  let h = 0x811c9dc5 ^ n;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) & 0xffff;
}

/**
 * The bob of a stride: a triangle wave, not a sine. Over one step the body is at its highest as the foot lands
 * (phase 0), sinks half the peak, sinks the rest, then rises the whole way in the last third, so the rise is
 * faster than the fall. It never goes below the sheet's own ground: the body lifts, it does not sink.
 * `walked` is the distance on foot in art px, `stride` the art px of one step; a body that does not move does not bob.
 */
export function bob(motion: boolean, moving: boolean, walked: number, stride: number, amp: number = FEEL.bob): number {
  if (!motion || !moving || stride <= 0 || amp <= 0) return 0;
  const phase = (((walked / stride) % 1) + 1) % 1;
  // art px below the peak: 0 at phase 0, amp / 2 at a third, amp at two thirds, back to 0 at the end
  const down = phase < 1 / 3 ? (amp / 2) * (phase * 3) : phase < 2 / 3 ? amp / 2 + (amp / 2) * ((phase - 1 / 3) * 3) : amp * (1 - (phase - 2 / 3) * 3);
  const lift = Math.round(amp - down);
  return lift === 0 ? 0 : -lift;
}

/**
 * The bob of a walker that takes one step a tile (the game's stride): the peak is where the walk sheet lands the foot,
 * `landedAt` of the way through the step (work.ts STRIDE), so the body is highest as the feet come together.
 * `walked` is the art px walked so far, `tile` the art px of a step.
 */
export function walkBob(motion: boolean, moving: boolean, walked: number, tile: number, landedAt: number): number {
  return bob(motion, moving, walked + Math.round(tile * (1 - landedAt)), tile);
}

/** The chest at rest: 0, or `FEEL.breath.px` for the second half of a period of 1.0 to 1.5 s (by id). Zero at time 0. */
export function breath(motion: boolean, id: string, time: number): number {
  if (!motion) return 0;
  const { minMs, maxMs, px } = FEEL.breath;
  const period = minMs + (seed(id) % (maxMs - minMs + 1));
  return time % period >= period / 2 ? px : 0;
}

/** Eyes closed: 100 ms once in every 4 s slot, at a point of the slot that comes from the id and the slot's number. */
export function blinking(motion: boolean, id: string, time: number): boolean {
  if (!motion || time < 0) return false;
  const { ms, slotMs, from, spread } = FEEL.blink;
  const slot = Math.floor(time / slotMs);
  const at = from + (seed(id, slot + 1) % spread);
  const into = time - slot * slotMs;
  return into >= at && into < at + ms;
}

export interface Squash {
  /** art px added to the width (negative narrows) */
  dw: number;
  /** art px added to the height */
  dh: number;
}

export const NO_SQUASH: Readonly<Squash> = { dw: 0, dh: 0 };

/**
 * Squash then stretch after a landing, a hop, a pounce or a hit, `age` ms after it. `strength` is 1 or 2 px.
 * Volume is kept: what the body gives in height it takes in width. Two frames, then rest.
 */
export function squash(motion: boolean, age: number, strength: 1 | 2): Squash {
  if (!motion || age < 0) return NO_SQUASH;
  const f = FEEL.squashFrameMs;
  if (age < f) return { dw: strength, dh: -strength };
  if (age < 2 * f && strength === 2) return { dw: -1, dh: 1 };
  return NO_SQUASH;
}

/**
 * The lean into a run: one art px along the motion, eased in over three frames after the motion starts
 * (`since` ms ago), and zero when the body is not running. `sign` is the horizontal direction, -1, 0 or 1.
 */
export function lean(motion: boolean, running: boolean, sign: number, since: number): number {
  if (!motion || !running || sign === 0 || since <= 0) return 0;
  const eased = Math.min(1, since / (3 * FEEL.leanFrameMs));
  return Math.round(Math.sign(sign) * eased);
}

/**
 * A part that follows the body (a tail, an ear, a cloak): `n` segments, each lagging the one before by
 * `FEEL.tailLagMs`. `trail` holds the body's recent offsets, newest first, one per frame of that lag.
 * Each segment shows where the body was, relative to where it is now, so a body at rest has every segment at 0.
 */
export function chain(motion: boolean, trail: readonly Offset[], n: number): Offset[] {
  const now = trail[0] ?? REST;
  const out: Offset[] = [];
  for (let i = 1; i <= n; i++) {
    const was = motion ? (trail[i] ?? trail[trail.length - 1] ?? REST) : now;
    out.push({ dx: was.dx - now.dx, dy: was.dy - now.dy });
  }
  return out;
}

export type SwingStage = 'anticipate' | 'strike' | 'follow' | 'recover' | 'done';

export interface Swing {
  /** ms of the held wind-up, 100 to 250 */
  anticipate: number;
  /** ms of the blow itself, 50 */
  strike: number;
  /** ms the body carries on after the blow, 100 to 300 */
  follow: number;
  /** ms to come back to rest, 50 to 100 */
  recover: number;
}

/** The light and the heavy swing of ANIMATION.md section 4. A heavy blow holds its ends longer. */
export const SWINGS: Readonly<Record<'light' | 'heavy', Swing>> = {
  light: { anticipate: 100, strike: 50, follow: 100, recover: 50 },
  heavy: { anticipate: 250, strike: 50, follow: 300, recover: 100 },
};

/** Which stage of a swing `age` ms after it started, and how far through that stage (0 to 1). Timing, not motion: it stays on under reduced motion. */
export function swingPhase(swing: Swing, age: number): { stage: SwingStage; progress: number } {
  const stages: [SwingStage, number][] = [
    ['anticipate', swing.anticipate],
    ['strike', swing.strike],
    ['follow', swing.follow],
    ['recover', swing.recover],
  ];
  let left = Math.max(0, age);
  for (const [stage, ms] of stages) {
    if (left < ms) return { stage, progress: ms === 0 ? 1 : left / ms };
    left -= ms;
  }
  return { stage: 'done', progress: 1 };
}

/** Frames of white on a struck creature. Off under reduced motion (G29). Fights only, never a gathered thing (DECISIONS 2026-10-26). */
export function flashFrames(motion: boolean): number {
  return motion ? FEEL.hit.flashFrames : 0;
}

/** How long the swing and the struck thing hold at the moment of impact: halved, not removed, under reduced motion. Fights only. */
export function hitstopMs(motion: boolean, heavy: boolean): number {
  const ms = heavy ? FEEL.hit.heavyStopMs : FEEL.hit.lightStopMs;
  return motion ? ms : Math.round(ms / 2);
}

/** The camera's knock after a blow: 2 px for 50 ms, to one side and back. Off under reduced motion. Fights only. */
export function shake(motion: boolean, age: number, side: 1 | -1 = 1): Offset {
  if (!motion || age < 0 || age >= FEEL.shake.ms) return REST;
  return { dx: age < FEEL.shake.ms / 2 ? side * FEEL.shake.px : -side * FEEL.shake.px, dy: 0 };
}

/** What a body is doing this frame. */
export interface FeelBody {
  id: string;
  /** ms on the clock of the scene */
  time: number;
  moving: boolean;
  /** art px walked so far, only ever growing while it walks */
  walked: number;
  /** art px of one step */
  stride: number;
  /** the body's height in art px, for the breath's size step */
  height: number;
}

export interface FeelOut {
  /** offset of the whole sprite, art px */
  dx: number;
  dy: number;
  /** art px the height grows by (the chest lifting) */
  dh: number;
  /** the eyes are closed this frame */
  blink: boolean;
}

export const AT_REST: Readonly<FeelOut> = { dx: 0, dy: 0, dh: 0, blink: false };

/**
 * The always-on layer for a body: a bob while it walks, a breath and a blink while it stands. Squash, lean,
 * chain and the hit effects are asked for by the scene at the moment they happen.
 */
export function feel(motion: boolean, b: FeelBody): FeelOut {
  if (!motion) return AT_REST;
  if (b.moving) return { dx: 0, dy: bob(motion, true, b.walked, b.stride), dh: 0, blink: false };
  return { dx: 0, dy: 0, dh: breath(motion, b.id, b.time), blink: blinking(motion, b.id, b.time) };
}
