import { hash } from './richground';

/**
 * How one tuft of tall grass stands, fixed by its tile: a random flip, a few pixels off the tile's middle, and a lean that
 * is the wind's - one dominant way with a small spread, not a spray. The bank's tufts were one sprite on one tile in a row
 * (the owner, 31.10: "too orderly, in a row, and lacking direction"). Pure; the sprites keep their art.
 */
export interface PlantLook {
  flip: boolean;
  /** degrees, clockwise: a positive angle leans the top to the right (east, the way the river's wind blows) */
  angle: number;
  /** art pixels from the tile's middle and from its foot */
  dx: number;
  dy: number;
}

/** The names that stand as tufts. */
export const TUFTS: readonly string[] = ['grass_tall', 'grass_tall_b', 'grass_tall_c'];
/** The dominant lean, in degrees, and how far a tuft strays from it. */
export const LEAN = 8;
export const LEAN_SPREAD = 4;

export function plantLook(x: number, y: number): PlantLook {
  const h = hash(x * 7 + 3, y * 13 + 5);
  const spread = ((h >>> 3) % 7) - 3; // -3..3
  return {
    flip: (h & 1) === 1,
    angle: LEAN + (spread * LEAN_SPREAD) / 3,
    dx: ((h >>> 8) % 25) - 12,
    dy: ((h >>> 14) % 7) - 3,
  };
}
