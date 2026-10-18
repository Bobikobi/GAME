/**
 * The mist (NEXT 16 a, DECISIONS 2026-10-10 "B2"): near-black, made of dots, clear around the places
 * the player has opened and thickening to solid beyond them. Pure: the raster of the whole map comes
 * from the clear discs and the map's size alone, so the client draws only what it is told and a
 * test can read the very pixels the game puts on screen.
 *
 * The style law allows only fully clear or fully solid pixels, so a density is shown as an ordered
 * 4x4 dither on game pixels (the world's own grid, not the screen's), and the lighter patches and the
 * shade are a second, coarser pattern in the same three colours.
 */
import { type Bundle, type State } from '@game/kernel';

/** A place the mist leaves clear: a centre in tiles and a radius in tiles. */
export interface Clear {
  x: number;
  y: number;
  r: number;
}

/** B2's numbers: clear for 5 tiles, then 6 tiles of thickening to solid. */
export const MIST = { clear: 5, ramp: 6, band: 1, edgeRamp: 3 } as const;

/** The three colours of B2, as RGB: the body, the lighter patches and the shade. */
export const MIST_RGB = { base: [0x3a, 0x35, 0x54], light: [0x5d, 0x61, 0x77], shade: [0x1b, 0x1a, 0x2e] } as const;

/** The ordered 4x4 dither: a pixel is mist where the density is above its cell's threshold. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

/** The mist's clear places for a save: the starter's wake, clear for 5 tiles. */
export function mistClears(b: Bundle, s: State): Clear[] {
  const wake = b.starters[s.player.starter]?.wake ?? b.map.spawn;
  return [{ x: wake.x, y: wake.y, r: MIST.clear }];
}

/** The mist's density at a point (tiles, a tile's own corner at its whole number): 0 clear to 1 solid. */
export function mistDensity(clears: readonly Clear[], width: number, height: number, tx: number, ty: number): number {
  const toBorder = Math.min(tx, ty, width - tx, height - ty);
  if (toBorder <= MIST.band) return 1;
  let near = Infinity;
  for (const c of clears) near = Math.min(near, Math.hypot(tx - (c.x + 0.5), ty - (c.y + 0.5)) - c.r);
  if (near <= 0) return 0;
  const ring = Math.min(1, near / MIST.ramp);
  // a border's mist thickens over its own few tiles, and stays out of the clear places
  const edge = Math.max(0, 1 - (toBorder - MIST.band) / MIST.edgeRamp);
  return Math.max(ring, edge);
}

/** A cheap hash of a cell to 0..1, so the patches are the same on every machine and every frame. */
function cellNoise(cx: number, cy: number): number {
  let h = Math.imul(cx, 0x27d4eb2d) ^ Math.imul(cy, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 0x100000000;
}

/**
 * The mist of the whole map as RGBA bytes, one game pixel each (`tile` pixels a tile): alpha 255 where
 * a pixel is mist and 0 where it is clear, never in between.
 */
export function mistPixels(clears: readonly Clear[], width: number, height: number, tile: number): Uint8ClampedArray<ArrayBuffer> {
  const w = width * tile;
  const h = height * tile;
  const out = new Uint8ClampedArray(new ArrayBuffer(w * h * 4));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = mistDensity(clears, width, height, (x + 0.5) / tile, (y + 0.5) / tile);
      if (d <= (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16) continue;
      const n = cellNoise(x >> 3, y >> 3);
      const rgb = n < 0.16 ? MIST_RGB.light : n > 0.84 ? MIST_RGB.shade : MIST_RGB.base;
      const i = 4 * (y * w + x);
      out[i] = rgb[0];
      out[i + 1] = rgb[1];
      out[i + 2] = rgb[2];
      out[i + 3] = 255;
    }
  }
  return out;
}
