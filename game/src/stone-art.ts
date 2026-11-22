/**
 * The look of loose stones in code (DECISIONS 2026-11-22, loose stones, #831): where the pictures of a pile stand by its count,
 * and the motion of a thrown stone from the hand to where it rests. No picture is drawn here: every stone is the one item
 * picture `core/base-kit:items/stone`, scaled; this file is only numbers, so a test can play it with no renderer.
 * Units are tiles (a tile is 1, a pile's slot offsets and a stone's height are shares of it); the scene turns them into pixels.
 */
import type { Tile } from '@game/kernel';

export type StoneSize = 'small' | 'large';

/** The scale of the item picture, as a share of its own (nearly tile-wide) size: a small stone in the hand, a large one on the ground. */
export const STONE_SCALE: Readonly<Record<StoneSize, number>> = { small: 0.46, large: 0.95 };

/** One picture of a pile: its offset from the tile's bottom middle (up is positive), and the size it shows. */
export interface Slot {
  dx: number;
  dy: number;
  size: StoneSize;
  /** the picture's scale, a share of the item picture */
  scale: number;
}

/** How many pictures a pile of `count` stones shows: the count itself up to three, five for four or more ("1, 2-3, 4+" of the brief). */
export function drawnCount(count: number): number {
  if (count <= 0) return 0;
  return count >= 4 ? 5 : count;
}

/** Which of the three looks a pile has: a lone stone, a few (2-3), or a heap (4+). */
export function pileLook(count: number): 'none' | 'one' | 'few' | 'heap' {
  if (count <= 0) return 'none';
  if (count === 1) return 'one';
  return count <= 3 ? 'few' : 'heap';
}

/** The slots of a pile, back to front (the lower stones first). The first `large` of them are large stones, the rest small. */
export function pileLayout(count: number, large = 0): Slot[] {
  const look = pileLook(count);
  const spots: [number, number, number][] =
    look === 'one'
      ? [[0, 0, 1]]
      : look === 'few'
        ? count === 2
          ? [[-0.2, 0.02, 0.9], [0.2, 0, 0.9]]
          : [[-0.22, 0, 0.9], [0.22, 0, 0.9], [0, 0.22, 0.9]]
        : look === 'heap'
          ? [[-0.3, 0, 0.85], [0, 0.04, 0.85], [0.3, 0, 0.85], [-0.15, 0.24, 0.85], [0.15, 0.24, 0.85]]
          : [];
  return spots.map(([dx, dy, k], i) => {
    const size: StoneSize = i < large ? 'large' : 'small';
    // a large stone alone fills its tile; among others it keeps the slot's room
    const scale = size === 'large' ? (look === 'one' ? STONE_SCALE.large : STONE_SCALE.small * 1.5 * k) : STONE_SCALE.small * k;
    return { dx, dy, size, scale };
  });
}

/** A throw as the kernel tells it (the `stone_thrown` event). */
export interface Throw {
  size: StoneSize;
  from: Tile;
  touch: Tile;
  /** where it rests; null when it sank */
  at: Tile | null;
  /** the whole flight and landing, in ms */
  ms: number;
}

/** The stone at one moment of its flight. Positions are tile coordinates (the tile's middle is +0.5); `lift` is the height above the ground in tiles. */
export interface Pose {
  x: number;
  y: number;
  lift: number;
  /** radians turned so far */
  spin: number;
  alpha: number;
  /** the picture's scale factor on top of the stone's own (a sinking stone shrinks) */
  shrink: number;
  /** the stone has come down for the first time */
  touched: boolean;
  /** the stone has stopped: nothing moves any more */
  done: boolean;
  /** which bounce of the landing it is in (0 in the air, 1 and 2 the bounces, 3 the slide) */
  phase: 0 | 1 | 2 | 3;
}

export interface Motion {
  ms: number;
  /** the moment the stone first comes down, ms from the throw */
  touchMs: number;
  at(t: number): Pose;
}

/** The height of the hand a stone leaves from, in tiles. */
const HAND = 0.55;
/** The first and the second bounce, by size: a small stone hops, a large one thuds. */
const BOUNCE: Readonly<Record<StoneSize, readonly [number, number]>> = { small: [0.26, 0.1], large: [0.1, 0.035] };
/** How much the stone tumbles in the air and along the ground, in turns (a large stone turns less). */
const TURNS: Readonly<Record<StoneSize, { air: number; roll: number }>> = { small: { air: 1.5, roll: 1 }, large: { air: 0.5, roll: 0.5 } };
/** The share of the flight spent in the air; the rest is the landing: two bounces and a slide. */
const AIR = 0.5;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const arch = (v: number): number => 4 * v * (1 - v);

/**
 * The motion of a thrown stone: an arc from the hand to the first touch (a long throw rises higher), then two bounces that fade
 * and a slide or roll on to where it rests, turning as it goes. A stone that sinks drops into the water at the touch and goes under.
 * Never flat: even a stone that rests where it touched bounces in place. Pure and fixed by the throw, so every client draws the same.
 */
export function stoneMotion(throwEv: Throw): Motion {
  const { size, from, touch, at, ms } = throwEv;
  const airMs = ms * AIR;
  const landMs = ms - airMs;
  const rest = at ?? touch;
  const dist = Math.hypot(touch[0] - from[0], touch[1] - from[1]);
  const peak = 0.5 + 0.13 * dist;
  const turns = TURNS[size];
  const [h1, h2] = BOUNCE[size];
  const rolled = Math.hypot(rest[0] - touch[0], rest[1] - touch[1]);
  return {
    ms,
    touchMs: airMs,
    at(t: number): Pose {
      if (t < airMs) {
        const u = clamp01(t / airMs);
        return {
          x: from[0] + 0.5 + (touch[0] - from[0]) * u,
          y: from[1] + 0.5 + (touch[1] - from[1]) * u,
          lift: HAND * (1 - u) + peak * arch(u),
          spin: 2 * Math.PI * turns.air * u,
          alpha: 1,
          shrink: 1,
          touched: false,
          done: false,
          phase: 0,
        };
      }
      const w = clamp01((t - airMs) / landMs);
      // the slide runs on the whole landing and slows: the first touch is the fastest
      const e = 1 - (1 - w) * (1 - w);
      const x = touch[0] + 0.5 + (rest[0] - touch[0]) * e;
      const y = touch[1] + 0.5 + (rest[1] - touch[1]) * e;
      const spin = 2 * Math.PI * (turns.air + turns.roll * rolled * e);
      if (!at) {
        // it drops into the water: it goes under, smaller and fainter
        return { x, y, lift: 0, spin, alpha: 1 - w, shrink: 1 - 0.4 * w, touched: true, done: w >= 1, phase: 1 };
      }
      let lift = 0;
      let phase: Pose['phase'] = 3;
      if (w < 0.42) {
        lift = h1 * arch(w / 0.42);
        phase = 1;
      } else if (w < 0.72) {
        lift = h2 * arch((w - 0.42) / 0.3);
        phase = 2;
      }
      return { x, y, lift, spin, alpha: 1, shrink: 1, touched: true, done: w >= 1, phase };
    },
  };
}
