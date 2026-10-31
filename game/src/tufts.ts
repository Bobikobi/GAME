/**
 * The grass tufts (owner, 31.10: whole tufts of blades, scattered at random so they move, "really the height of a foot
 * and no more"): low clumps standing on the meadow, drawn in the prop pass over the ground.
 *
 * Where they stand is a sum of the map alone (no clock, no Math.random): the same tiles give the same tufts on every
 * machine. They stand on a meadow tile a foot can cross, never on a path or a road the plan walks, never within one tile of
 * a prop. They are not solid: no kernel rule reads them, so the first night (G71) and the winding paths (G69) are as they were.
 *
 * How they move is a wind wave over the map: each tuft's frame is a sum of the clock and its tile (x + y), so the lean runs
 * across the meadow and neighbours bend one after the other, not in step.
 */
import { T } from './config';
import { hash } from './richground';

export const TUFT_SEED = 31;
/** The three looks, kit sprites of four lean frames each (tools/src/kit/tufts.ts). */
export const LOOKS = ['grass_tuft', 'grass_tuft_b', 'grass_tuft_c'] as const;
/** How many tufts stand on every hundred meadow tiles. */
export const PER_100 = 20;
/** One lean cycle per look, ms: 1.2 to 1.8 s. */
export const PERIOD_MS = [1200, 1500, 1800] as const;
/** The wind wave's length in tiles: tufts this far apart on the (x + y) diagonal lean in step. */
export const WAVE_TILES = 12;
export const FRAMES = 4;

export interface Tuft {
  /** the tile the tuft stands in */
  tx: number;
  ty: number;
  /** its foot, world px */
  x: number;
  y: number;
  look: number;
}

export interface TuftMap {
  width: number;
  height: number;
  ground: string[];
  legend: Record<string, { tag: string; solid: boolean }>;
  props: { x: number; y: number; w: number; h: number }[];
  plan?: { paths?: { via: number[][] }[]; routes?: { via: number[][] }[] };
}

/** The tiles a polyline of waypoints crosses, one axis at a time. */
function along(via: number[][], into: Set<number>, width: number): void {
  let [x, y] = via[0] ?? [];
  if (x === undefined || y === undefined) return;
  into.add(y * width + x);
  for (const p of via.slice(1)) {
    const [px, py] = p as [number, number];
    while (x !== px || y !== py) {
      if (x !== px) x += Math.sign(px - x);
      else y += Math.sign(py - y);
      into.add(y * width + x);
    }
  }
}

/** The meadow tiles a tuft may stand in, in reading order: a foot can cross them, no road runs over them, no prop is within a tile. */
export function tuftTiles(map: TuftMap): [number, number][] {
  const kept = new Set<number>();
  for (const p of [...(map.plan?.paths ?? []), ...(map.plan?.routes ?? [])]) along(p.via, kept, map.width);
  const near = new Set<number>();
  for (const p of map.props) {
    for (let y = p.y - 1; y <= p.y + p.h; y++) for (let x = p.x - 1; x <= p.x + p.w; x++) near.add(y * map.width + x);
  }
  const out: [number, number][] = [];
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const tile = map.legend[map.ground[ty]?.[tx] ?? ''];
      if (!tile || tile.tag !== 'meadow' || tile.solid) continue;
      const at = ty * map.width + tx;
      if (!kept.has(at) && !near.has(at)) out.push([tx, ty]);
    }
  }
  return out;
}

/** Every tuft the map carries, in reading order. */
export function scatterTufts(map: TuftMap, per100 = PER_100): Tuft[] {
  const out: Tuft[] = [];
  for (const [tx, ty] of tuftTiles(map)) {
    {
      // the tile's share of a tuft, then a second chance for a thicker meadow
      const draw = hash(tx + TUFT_SEED, ty) % 10000;
      const count = Math.floor(per100 / 100) + (draw < (per100 % 100) * 100 ? 1 : 0);
      for (let k = 0; k < count; k++) {
        const h = hash(tx * 7 + k + TUFT_SEED, ty * 13 + 5);
        // a foot inside the tile with 3 px of room each side, so a tuft never spills over its neighbour's feet
        const x = tx * T + 3 + (h % (T - 6));
        const y = ty * T + 8 + ((h >>> 8) % (T - 8));
        out.push({ tx, ty, x, y, look: (h >>> 16) % LOOKS.length });
      }
    }
  }
  return out;
}

/** The frame a tuft shows at `ms`: the wave runs along x + y, one cycle in the look's own period. */
export function tuftFrame(t: Pick<Tuft, 'tx' | 'ty' | 'look'>, ms: number): number {
  const turns = ms / PERIOD_MS[t.look]! - (t.tx + t.ty) / WAVE_TILES;
  return Math.floor((((turns % 1) + 1) % 1) * FRAMES) % FRAMES;
}
