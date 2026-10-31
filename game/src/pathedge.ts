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

const STONE_CELL = 12;
/** A stone's gap to the next: stones nearer than this share of their two radii give way to the stronger one. */
const STONE_TOUCH = 0.85;
const STONE_SHADE: readonly [number, number, number] = [0x5d, 0x61, 0x77];
/** One step lighter on the blue ramp: the shallows. */
const LIGHTER = new Map<number, number>([
  [0x172a52, 0x275a99],
  [0x275a99, 0x3f8fd1],
  [0x3f8fd1, 0x7cc4ec],
  [0x7cc4ec, 0xc4ecf8],
]);
const STONE: readonly [number, number, number] = [0x8f, 0x94, 0xa8];
const STONE_LIGHT: readonly [number, number, number] = [0xc6, 0xca, 0xd6];
const STONE_DARK: readonly [number, number, number] = [0x3a, 0x35, 0x54];
const WORN: readonly [number, number, number] = [0x9e, 0x6b, 0x3c];
/** One step darker on the sand ramp: the wet rim. */
const DARKER = new Map<number, number>([
  [0xebd3a2, 0xc99a5e],
  [0xc99a5e, 0x9e6b3c],
  [0x9e6b3c, 0x6e4226],
  [0x6e4226, 0x3d2618],
]);
/** The darkest water pixel below a stone or on the waterline. */
const WET_LINE: readonly [number, number, number] = [0x3d, 0x26, 0x18];
const LIGHT_WATER: readonly [number, number, number] = [0x7c, 0xc4, 0xec];
const SPARK_WATER: readonly [number, number, number] = [0xc4, 0xec, 0xf8];
/** The ink of a stone's outline, the props' own. */
const STONE_INK: readonly [number, number, number] = [0x1b, 0x1a, 0x2e];
/** Ordered 2x2 thresholds, so two bands meet on a regular dither and not on noise. */
const BAYER = [0.125, 0.625, 0.875, 0.375];
/** A highlight dash on the water's light band: a cell of this side takes one at a set chance, so about one to two tiles of shore. */
const DASH_CELL = 24;
interface Dash {
  x: number;
  y: number;
  tx: number;
  ty: number;
  half: number;
}

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
  /** a water's edge: the land side wets dark and carries stones, the water side steps from deep to mid to light toward the shore, `light` and `mid` the field distances where the bands end (the land is the field's 1 side) */
  rim?: { wet: number; light: number; mid: number };
}
export const PATH_EDGE: EdgeLook = { threshold: 0.78, wander: 1, sparse: true, tufts: true, worn: true };
export const BANK_EDGE: EdgeLook = { threshold: 0.5, wander: 1.6, sparse: false, tufts: true, worn: false };
/** Where land meets water: a wandering line, a wet dark rim, chunky stones breaking it, a shaded water side. */
export const WATER_EDGE: EdgeLook = { threshold: 0.5, wander: 2.1, sparse: false, tufts: false, worn: false, rim: { wet: 0.16, light: 0.05, mid: 0.17 } };
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
  // the stones of a water's rim: rounded, 8 to 15 px across, one to a 12 px cell along the line, with gaps; each is judged
  // from its own centre, so one stone is the same in every tile it crosses
  const rim = look.rim;
  const tAt = (gx: number, gy: number): number => {
    const f = pathField(tx, ty, (gx - tx * EDGE_PX + 0.5) / EDGE_PX, (gy - ty * EDGE_PX + 0.5) / EDGE_PX, at, own);
    return f + ((valueNoise(gx, gy, 31, 14) - 0.5) * 0.3 + (valueNoise(gx, gy, 57, 5) - 0.5) * 0.14) * look.wander;
  };
  interface Stone {
    x: number;
    y: number;
    rx: number;
    ry: number;
    rank: number;
  }
  // a stone is a cell's jittered point pulled onto the drawn line (a few Newton steps on the field), so the ring is as
  // continuous as the line is; of two stones that would overlap, the higher-ranked one stays
  const rawStones = new Map<number, Stone | null>();
  const rawOf = (cx: number, cy: number): Stone | null => {
    const key = cx * 100003 + cy;
    const hit = rawStones.get(key);
    if (hit !== undefined) return hit;
    let out: Stone | null = null;
    if (rim && hash(cx, cy + 61) % 100 < 92) {
      const x0 = (cx + 0.5 + ((hash(cx, cy + 62) % 100) / 100 - 0.5) * 0.6) * STONE_CELL;
      const y0 = (cy + 0.5 + ((hash(cx, cy + 63) % 100) / 100 - 0.5) * 0.6) * STONE_CELL;
      const target = look.threshold + 0.035;
      let x = x0;
      let y = y0;
      let ok = false;
      for (let k = 0; k < 5 && !ok; k++) {
        const e = target - tAt(Math.round(x), Math.round(y));
        if (Math.abs(e) < 0.012) {
          ok = true;
          break;
        }
        const gx = (tAt(Math.round(x) + 2, Math.round(y)) - tAt(Math.round(x) - 2, Math.round(y))) / 4;
        const gy = (tAt(Math.round(x), Math.round(y) + 2) - tAt(Math.round(x), Math.round(y) - 2)) / 4;
        const g2 = gx * gx + gy * gy;
        if (g2 < 1e-5) break;
        x += (gx * e) / g2;
        y += (gy * e) / g2;
        if (Math.hypot(x - x0, y - y0) > STONE_CELL * 1.2) break;
      }
      if (ok || Math.abs(target - tAt(Math.round(x), Math.round(y))) < 0.02) {
        const size = (hash(cx, cy + 64) % 100) / 100;
        // mostly 8 to 12 px across, now and then a big one of 16
        const rx = 3.6 + size * 3 + (size > 0.85 ? 1.6 : 0);
        out = { x, y, rx, ry: rx * (0.74 + ((hash(cx, cy + 65) % 100) / 100) * 0.24), rank: hash(cx, cy + 66) };
      }
    }
    rawStones.set(key, out);
    return out;
  };
  const cells = new Map<number, Stone | null>();
  const cellOf = (cx: number, cy: number): Stone | null => {
    const key = cx * 100003 + cy;
    const hit = cells.get(key);
    if (hit !== undefined) return hit;
    let out = rawOf(cx, cy);
    if (out) {
      for (let dy = -1; dy <= 1 && out; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nb = rawOf(cx + dx, cy + dy);
          if (nb && nb.rank > out.rank && Math.hypot(nb.x - out.x, nb.y - out.y) < STONE_TOUCH * (nb.rx + out.rx)) {
            out = null;
            break;
          }
        }
      }
    }
    cells.set(key, out);
    return out;
  };
  // the light band's highlights: a short dash on the shore line's water side, lying along the line, about one to two tiles apart
  const dashes = new Map<number, Dash | null>();
  const dashOf = (cx: number, cy: number): Dash | null => {
    const key = cx * 100003 + cy;
    const hit = dashes.get(key);
    if (hit !== undefined) return hit;
    let out: Dash | null = null;
    if (rim && hash(cx, cy + 81) % 100 < 22) {
      const x0 = (cx + 0.2 + ((hash(cx, cy + 82) % 100) / 100) * 0.6) * DASH_CELL;
      const y0 = (cy + 0.2 + ((hash(cx, cy + 83) % 100) / 100) * 0.6) * DASH_CELL;
      let x = x0;
      let y = y0;
      const target = look.threshold - rim.light * 0.5;
      for (let k = 0; k < 6; k++) {
        const e = target - tAt(Math.round(x), Math.round(y));
        const gx = (tAt(Math.round(x) + 2, Math.round(y)) - tAt(Math.round(x) - 2, Math.round(y))) / 4;
        const gy = (tAt(Math.round(x), Math.round(y) + 2) - tAt(Math.round(x), Math.round(y) - 2)) / 4;
        const g2 = gx * gx + gy * gy;
        if (g2 < 1e-5) break;
        if (Math.abs(e) < 0.01) {
          const g = Math.sqrt(g2);
          out = { x, y, tx: -gy / g, ty: gx / g, half: 3 + ((hash(cx, cy + 84) % 100) / 100) * 3 };
          break;
        }
        x += (gx * e) / g2;
        y += (gy * e) / g2;
        if (Math.hypot(x - x0, y - y0) > DASH_CELL * 1.3) break;
      }
    }
    dashes.set(key, out);
    return out;
  };
  const dashAt = (gx: number, gy: number): boolean => {
    const bx = Math.floor(gx / DASH_CELL);
    const by = Math.floor(gy / DASH_CELL);
    for (let cy = by - 1; cy <= by + 1; cy++) {
      for (let cx = bx - 1; cx <= bx + 1; cx++) {
        const c = dashOf(cx, cy);
        if (!c) continue;
        const dx = gx + 0.5 - c.x;
        const dy = gy + 0.5 - c.y;
        if (Math.abs(dx * -c.ty + dy * c.tx) < 0.8 && Math.abs(dx * c.tx + dy * c.ty) < c.half) return true;
      }
    }
    return false;
  };
  const stoneAt = (gx: number, gy: number): readonly [number, number, number] | undefined => {
    const bx = Math.floor(gx / STONE_CELL);
    const by = Math.floor(gy / STONE_CELL);
    let shadow = false;
    let outline = false;
    for (let cy = by - 2; cy <= by + 2; cy++) {
      for (let cx = bx - 2; cx <= bx + 2; cx++) {
        const c = cellOf(cx, cy);
        if (!c) continue;
        const u = (gx + 0.5 - c.x) / c.rx;
        const v = (gy + 0.5 - c.y) / c.ry;
        const d = u * u + v * v;
        // the wet line: a dark pixel or two under a stone's lower edge
        if (d > 1) {
          // a pixel of ink all round, and the wet line under the lower edge
          if (d < (1 + 1.1 / Math.min(c.rx, c.ry)) ** 2) outline = true;
          else if (d < 1.5 && v > 0.25) shadow = true;
          continue;
        }
        if (v > 0.5 && d > 0.58) return STONE_DARK;
        if (u + v > 0.4) return STONE_SHADE;
        if (u + v < -0.45 && hash(gx, gy + 71) % 100 < 80) return STONE_LIGHT;
        return hash(gx, gy + 73) % 100 < 14 ? STONE_SHADE : STONE;
      }
    }
    return outline ? STONE_INK : shadow ? WET_LINE : undefined;
  };
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
      if (look.rim) {
        const r = look.rim;
        if (grass) {
          // three bands toward the shore: deep (the tile's own), mid, light; two bands meet on an ordered 2x2 dither, no stipple
          // the light band hugs the shoreline itself; the mid band is measured from the smooth field, so it runs parallel
          // and does not break into the blobs the shoreline's small wiggles would make of it
          const ramp = (d: number, at: number): number => Math.min(1, Math.max(0, (d - (at - 0.012)) / 0.024));
          const lit1 = 1 - ramp(edge - t, r.light);
          const mid1 = 1 - ramp(edge - field - ((valueNoise(gx, gy, 31, 14) - 0.5) * 0.3) * look.wander, r.mid);
          const level = Math.floor(Math.max(mid1, lit1) + lit1 + BAYER[(gx & 1) + 2 * (gy & 1)]!);
          for (let n = 0; n < level; n++) {
            const lit = LIGHTER.get((out[i]! << 16) | (out[i + 1]! << 8) | out[i + 2]!);
            if (lit === undefined) break;
            out[i] = lit >> 16;
            out[i + 1] = (lit >> 8) & 255;
            out[i + 2] = lit & 255;
          }
          if (dashAt(gx, gy)) {
            const spark = hash(gx, gy + 31) % 100 < 45 ? SPARK_WATER : LIGHT_WATER;
            out[i] = spark[0];
            out[i + 1] = spark[1];
            out[i + 2] = spark[2];
          }
        } else if (t < edge + r.wet) {
          // the land's own pixels wet dark where no stone lies: a step darker, two right at the waterline
          const near = t < edge + r.wet * 0.45;
          for (let n = 0; n < (near ? 2 : 1); n++) {
            const dark = DARKER.get((out[i]! << 16) | (out[i + 1]! << 8) | out[i + 2]!);
            if (dark === undefined || hash(gx, gy + 41 + n) % 100 >= 90) break;
            out[i] = dark >> 16;
            out[i + 1] = (dark >> 8) & 255;
            out[i + 2] = dark & 255;
          }
        }
        const st = stoneAt(gx, gy);
        if (st) {
          out[i] = st[0];
          out[i + 1] = st[1];
          out[i + 2] = st[2];
        }
      }
      if (look.worn && !grass && ((t < edge + 0.06 && hash(gx, gy + 5) % 100 < 45) || (t < edge + 0.14 && hash(gx, gy + 9) % 100 < 16))) {
        out[i] = WORN[0];
        out[i + 1] = WORN[1];
        out[i + 2] = WORN[2];
      }
    }
  }
}
