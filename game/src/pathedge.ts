import { hash, valueNoise } from './richground';

/**
 * Where a path meets the meadow, worked out per pixel and not per tile, so no 64 px step shows: the tiles' own
 * "is this a path" values are blended smoothly between their centres (an outer corner rounds, a staircase
 * of tiles runs as one diagonal, a one-tile gap closes), the 0.5 line of that field is the path's edge, and a
 * slow value noise wanders it. Beyond the line a pixel is the grass tile's, on it the path tile's; along it the
 * sand wears darker and now and then a tuft of grass crosses into it. Pure, fixed by the map, no Phaser.
 */

/** The tile's side in art pixels. */
export const EDGE_PX = 64;

/** 1 for a path tile, 0 for a meadow tile, undefined for any other (cobble, sand, water, forest ...): the tile's own side. */
export type PathAt = (tx: number, ty: number) => 0 | 1 | undefined;

const WORN: readonly [number, number, number] = [0x9e, 0x6b, 0x3c];

/** How one kind of edge is drawn. */
export interface EdgeLook {
  /** where the sand's own side begins on the blended field: 0.5 is the tiles' own edge, above it narrows the drawn band */
  threshold: number;
  /** how far the line wanders (1 is the path's) */
  wander: number;
  /** the band between the tiles' edge and the threshold is worn grass with sparse flecks of the other side */
  sparse: boolean;
  /** tufts of grass crossing into the other side, and a darker worn rim on it */
  tufts: boolean;
  worn: boolean;
}
export const PATH_EDGE: EdgeLook = { threshold: 0.78, wander: 1, sparse: true, tufts: true, worn: true };
export const BANK_EDGE: EdgeLook = { threshold: 0.5, wander: 1.6, sparse: false, tufts: true, worn: false };
export const WOOD_EDGE: EdgeLook = { threshold: 0.5, wander: 1.3, sparse: false, tufts: false, worn: false };

/** The blended path field at a point of tile (tx, ty), u and v in 0..1 across it. */
export function pathField(tx: number, ty: number, u: number, v: number, at: PathAt, own: 0 | 1): number {
  const fx = tx + u - 0.5;
  const fy = ty + v - 0.5;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const ax = fx - ix;
  const ay = fy - iy;
  const s = (x: number, y: number): number => at(x, y) ?? own;
  return s(ix, iy) * (1 - ax) * (1 - ay) + s(ix + 1, iy) * ax * (1 - ay) + s(ix, iy + 1) * (1 - ax) * ay + s(ix + 1, iy + 1) * ax * ay;
}

/**
 * Whether a tile has both a path and a meadow within one tile of it (eight neighbours), so its pixels are blended;
 * every other tile is drawn as it is. `own` is 1 on a path tile and 0 on a meadow tile.
 */
export function needsBlend(tx: number, ty: number, at: PathAt, own: 0 | 1): boolean {
  let path = own === 1;
  let meadow = own === 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const a = at(tx + dx, ty + dy);
      if (a === 1) path = true;
      else if (a === 0) meadow = true;
    }
  }
  return path && meadow;
}

/**
 * Writes the blended tile into `out` (RGBA, EDGE_PX square) from the path tile's and the grass tile's pixels.
 * `own` is the side the tile itself is on.
 */
export function blendEdgeTile(tx: number, ty: number, at: PathAt, own: 0 | 1, pathPx: Uint8ClampedArray, grassPx: Uint8ClampedArray, out: Uint8ClampedArray, look: EdgeLook = PATH_EDGE): void {
  for (let py = 0; py < EDGE_PX; py++) {
    for (let px = 0; px < EDGE_PX; px++) {
      const gx = tx * EDGE_PX + px;
      const gy = ty * EDGE_PX + py;
      const field = pathField(tx, ty, (px + 0.5) / EDGE_PX, (py + 0.5) / EDGE_PX, at, own);
      const wander = ((valueNoise(gx, gy, 31, 14) - 0.5) * 0.3 + (valueNoise(gx, gy, 57, 5) - 0.5) * 0.14) * look.wander;
      const t = field + wander;
      const edge = look.threshold;
      const i = (py * EDGE_PX + px) * 4;
      let grass = t < edge;
      // the worn band: grass with sparse flecks of the path's sand
      if (look.sparse && grass && t > 0.42 && hash(gx, gy + 17) % 100 < (32 * (t - 0.42)) / (edge - 0.42)) grass = false;
      const near = Math.abs(t - edge);
      // the line itself is a dither, not a cut
      if (near < 0.03 && hash(gx, gy + 3) % 100 < 35) grass = !grass;
      // a tuft of grass crossing into the sand: a column that carries one, as far as its own length
      if (look.tufts && !grass && t < edge + 0.16 && hash(gx, 11) % 100 < 13 && t < edge + 0.16 * ((hash(gx, 13) % 100) / 100)) grass = true;
      const src = grass ? grassPx : pathPx;
      out[i] = src[i]!;
      out[i + 1] = src[i + 1]!;
      out[i + 2] = src[i + 2]!;
      out[i + 3] = 255;
      if (look.worn && !grass && ((t < edge + 0.06 && hash(gx, gy + 5) % 100 < 45) || (t < edge + 0.14 && hash(gx, gy + 9) % 100 < 16))) {
        out[i] = WORN[0];
        out[i + 1] = WORN[1];
        out[i + 2] = WORN[2];
      }
    }
  }
}
