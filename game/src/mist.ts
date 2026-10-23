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
import { type Bundle, type PublicState, findSlot } from '@game/kernel';

/** A place the mist leaves clear: a centre in tiles and a radius in tiles. */
export interface Clear {
  x: number;
  y: number;
  r: number;
  /** Tiles a second the drawn radius opens at; left out: MIST_TILES_PER_S. A mend opens faster than a pocket (NEXT 16 d). */
  rate?: number;
}

/** B2's numbers: clear for 5 tiles, then 6 tiles of thickening to solid. */
export const MIST = { clear: 5, ramp: 6, band: 1, edgeRamp: 3 } as const;

/** The three colours of B2, as RGB: the body, the lighter patches and the shade. */
export const MIST_RGB = { base: [0x3a, 0x35, 0x54], light: [0x5d, 0x61, 0x77], shade: [0x1b, 0x1a, 0x2e] } as const;

/** The ordered 4x4 dither: a pixel is mist where the density is above its cell's threshold. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

/** B2's defaults for what content leaves out (schema: pocket.pocket, pocket.pocket_grown). */
const POCKET = MIST.clear;
const POCKET_GROWN = 7;

/** Whether the character's own first task is done: a quest offered to their wake pocket alone, closed (NEXT 16 c). */
export function firstTaskDone(b: Bundle, s: PublicState): boolean {
  return Object.entries(b.quests).some(([id, q]) => q.pocket !== undefined && q.pocket === s.player.pocket && s.player.quests[id] === 'done');
}

/**
 * The mist's clear places for a save, a pure function of it (so a reload keeps them): the pocket's wake,
 * clear for `pocket` tiles and for `pocket_grown` once the first task is done.
 */
export function mistClears(b: Bundle, s: PublicState): Clear[] {
  const pocket = b.pockets[s.player.pocket];
  const wake = pocket?.wake ?? b.map.spawn;
  const r = firstTaskDone(b, s) ? (pocket?.pocket_grown ?? POCKET_GROWN) : (pocket?.pocket ?? POCKET);
  const clears: Clear[] = [{ x: wake.x, y: wake.y, r }];
  // a mended place draws the mist back around its middle tile (NEXT 16 d); the order of the save's list is the order here
  for (const id of s.player.restored) {
    const def = b.restores[id];
    const slot = def?.mist === undefined ? undefined : findSlot(b.map, def.place.slot);
    if (def?.mist !== undefined && slot) {
      clears.push({ x: slot.x + Math.floor(slot.w / 2), y: slot.y + Math.floor(slot.h / 2), r: def.mist, rate: MIST_MEND_PER_S });
    }
  }
  return clears;
}

/** How fast a clear place opens when the save changes it: 2 tiles a second, so the first task's 5 to 7 takes 1 s. */
export const MIST_TILES_PER_S = 2;
/** How fast a mend's clearing opens: 7 tiles a second, so the bridge's 14 tiles take 2 s, inside the 3 s of criterion 4. */
export const MIST_MEND_PER_S = 7;
/** The radius is rasterised in steps of this many tiles, so a growing pocket costs one raster per step. */
export const MIST_STEP = 0.25;

/** One frame of a clear place's radius moving from what is drawn toward what the save says. */
export function mistRadius(shown: number, target: number, dtMs: number, rate: number = MIST_TILES_PER_S): number {
  const move = (rate * dtMs) / 1000;
  if (Math.abs(target - shown) <= move) return target;
  return shown + Math.sign(target - shown) * move;
}

/** A radius as it is rasterised: rounded to `MIST_STEP`, so a frame that moves it less than a step draws nothing new. */
export function mistStep(r: number): number {
  return Math.round(r / MIST_STEP) * MIST_STEP;
}

/**
 * Where the explorer's mote of light stands (NEXT 16 c, the picked frame hook-1-explorer-cue): on the line from the
 * character to the find, `reach` tiles out (the pocket's edge when they stand at the wake), or on the find itself
 * once it is nearer than that. Tiles, a tile's centre at +0.5.
 */
export function moteAt(from: readonly [number, number], find: readonly [number, number], reach: number): { x: number; y: number } {
  const dx = find[0] - from[0];
  const dy = find[1] - from[1];
  const d = Math.hypot(dx, dy);
  if (d <= reach) return { x: find[0] + 0.5, y: find[1] + 0.5 };
  return { x: from[0] + 0.5 + (dx / d) * reach, y: from[1] + 0.5 + (dy / d) * reach };
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
