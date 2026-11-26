/**
 * The look of loose stones in code (DECISIONS 2026-11-22, loose stones, #831): where the pictures of a pile stand by its count,
 * and the motion of a thrown stone from the hand to where it rests. No picture is drawn here: a small stone is its own drawing
 * (`items/stone_small`), a large one is the item picture `core/base-kit:items/stone`, scaled, and a heap of four or more small ones
 * is the kit's rubble heap (`props/rock_stones`); this file is only numbers, so a test can play it with no renderer.
 * Units are tiles (a tile is 1, a pile's slot offsets and a stone's height are shares of it); the scene turns them into pixels.
 */
import type { Tile } from '@game/kernel';

export type StoneSize = 'small' | 'large';

/** The scale of the item picture `items/stone` (nearly tile-wide), as a share of its own size: a large stone on the ground (70 percent: the owner's rule of 26.11 is that an object keeps its size from the ground into the hands and back, and 70 is the size a figure's lift and carry clips can hold, #874), and a small one before it had its own drawing (46 percent, kept as the unit a large stone among small ones is sized by). */
export const STONE_SCALE: Readonly<Record<StoneSize, number>> = { small: 0.46, large: 0.7 };

/**
 * Where the middle of the drawn stone is in its picture, as a share of the picture (origin x, y): the middle of the opaque box, which for
 * the small stone is low in its 64 px frame (the box is rows 37 to 59) and for the large one is the frame's middle (rows 7 to 55). A stone in
 * the hand or in the air is drawn about this point, so the point laid at the hand is where the stone looks to be.
 */
export const STONE_CENTRE: Readonly<Record<StoneSize, readonly [number, number]>> = { small: [0.5, 48.5 / 64], large: [0.5, 31.5 / 64] };

/** Which picture a slot shows: the small stone's own drawing, the item picture (a large stone), or the rubble heap. */
export type StonePicture = 'small' | 'large' | 'heap';

/** The small stone's own drawing (about 28 x 24 art pixels) is drawn at its true size: a share of itself of 1. */
export const SMALL_STONE_SCALE = 1;

/** The rubble heap of four or more small stones, as a share of its picture (61 x 49 art pixels, nearly a tile): a little smaller than a large stone. */
export const HEAP_SCALE = 0.8;

/** One picture of a pile: its offset from the tile's bottom middle (up is positive), and the size it shows. */
export interface Slot {
  dx: number;
  dy: number;
  size: StoneSize;
  /** the picture's scale, a share of its own picture */
  scale: number;
  /** which picture it shows */
  picture: StonePicture;
}

/**
 * How many pictures a pile of `count` stones shows: the count itself up to three, and for four or more the one rubble heap, or five
 * pictures when a large stone lies among them ("1, 2-3, 4+" of the brief).
 */
export function drawnCount(count: number, large = 0): number {
  if (count <= 0) return 0;
  if (count < 4) return count;
  return large > 0 ? 5 : 1;
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
  // four or more small stones are one heap picture, the kit's own rubble
  if (look === 'heap' && large === 0) return [{ dx: 0, dy: 0, size: 'small', scale: HEAP_SCALE, picture: 'heap' }];
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
    // every stone of a pile is drawn at its own size times the slot's room k (1 for a lone stone), so a large one stays that much larger than a small one
    const scale = (size === 'large' ? STONE_SCALE.large : SMALL_STONE_SCALE) * k;
    return { dx, dy, size, scale, picture: size };
  });
}

/**
 * Where a thrown stone leaves from: the drawn hand (STONE HAND, #793), in tiles. `x` and `y` are the ground point under the hand,
 * `lift` its height above that, and `share` how big the stone is in it as a share of its flying size (1 for every stone since #874: an
 * object keeps its size; a share under 1 grows to its own size by the middle of the flight). Left out, the stone
 * leaves the middle of the tile at the height of a hand.
 */
export interface Grip {
  x: number;
  y: number;
  lift: number;
  share?: number;
}

/** A throw as the kernel tells it (the `stone_thrown` event). */
export interface Throw {
  size: StoneSize;
  /** where the hand was at the release, when the figure's clip names it */
  hand?: Grip;
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
  const { size, from, touch, at, ms, hand } = throwEv;
  const sx = hand?.x ?? from[0] + 0.5;
  const sy = hand?.y ?? from[1] + 0.5;
  const share = hand?.share ?? 1;
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
          x: sx + (touch[0] + 0.5 - sx) * u,
          y: sy + (touch[1] + 0.5 - sy) * u,
          lift: (hand?.lift ?? HAND) * (1 - u) + peak * arch(u),
          spin: 2 * Math.PI * turns.air * u,
          alpha: 1,
          shrink: share + (1 - share) * clamp01(u * 2),
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
