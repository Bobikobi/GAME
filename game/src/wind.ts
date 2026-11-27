/**
 * The one wind (private #44 step C, the owner's word of 13.11: "one engine wind field everything reads"). Pure: no Phaser, no browser.
 *
 * The wind is a field of the light table's rows, one column per season (`WIND_SEASON`, 'none' until the seasons come): [x, y, speed, k]. x and y are the way the gust travels across the screen
 * (a direction, y down), speed is how fast its front crosses the ground in TILES a second, and k is how hard it leans what it meets (1 is the valley's gust as it was drawn). Each door turns
 * tiles into its own pixels (`TILE_PX`, 64 art px or scene px a tile on both today), so the painted door and the classic door see the same wind on the ground.
 */
import { gust } from './look';

export const WIND_SEASON = 'none';

/** art px (the classic door) and scene px (the painted door) in one tile: the pixels a door's wind speed is counted in */
export const TILE_PX = 64;

/** [x, y, speed (tiles a second), k]: the valley's gust as it was before it was one field: direction (0.97, 0.24) and a front of 180 px a second at 64 px a tile */
export const WIND_NONE: readonly [number, number, number, number] = [0.97, 0.24, 180 / TILE_PX, 1];

export type WindColumn = Record<string, readonly [number, number, number, number] | undefined>;

export interface Wind {
  x: number;
  y: number;
  /** the front's speed across the ground, tiles a second */
  speed: number;
  /** how hard it leans, 1 as the valley's gust was drawn */
  k: number;
}

export const DEFAULT_WIND: Wind = { x: WIND_NONE[0], y: WIND_NONE[1], speed: WIND_NONE[2], k: WIND_NONE[3] };

/** The wind between two rows' columns (a row that names none takes the engine's own), a straight line like every field of the table. */
export function windBetween(a: WindColumn | undefined, b: WindColumn | undefined, t: number, season: string = WIND_SEASON): Wind {
  const pick = (c: WindColumn | undefined): readonly number[] => c?.[season] ?? c?.[WIND_SEASON] ?? WIND_NONE;
  const p = pick(a);
  const q = pick(b);
  const mix = (i: number): number => p[i]! + (q[i]! - p[i]!) * t;
  return { x: mix(0), y: mix(1), speed: mix(2), k: mix(3) };
}

/** Seconds the gust's front takes to reach a place (px from the picture's corner, in the door's own pixels): the lag of the swing there. */
export function frontArrival(w: Wind, x: number, y: number): number {
  return (x * w.x + y * w.y) / (w.speed * TILE_PX);
}

const hashOf = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** A piece's lean now, whole frames from -`lean` to `lean`: the passing gust at its place, a little sway of its own on top. */
export function leanNow(o: { i: number; fx: number; fy: number }, lean: number, t: number, wind: Wind = DEFAULT_WIND): number {
  const u = frontArrival(wind, o.fx, o.fy);
  const own = hashOf(o.i);
  const k = (0.3 + 0.62 * gust(t - u)) * wind.k + 0.2 * Math.sin((2.1 + own) * t + own * 6.283);
  return Math.max(-lean, Math.min(lean, Math.round(lean * k)));
}

/** The gust's swing at a piece's place before it is made a frame: the same front for every kind, so grass and trees move together. */
export function leanSignal(o: { fx: number; fy: number }, t: number, wind: Wind = DEFAULT_WIND): number {
  const u = frontArrival(wind, o.fx, o.fy);
  return (0.3 + 0.62 * gust(t - u)) * wind.k;
}
