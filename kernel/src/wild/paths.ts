/**
 * Paths for the wild (HUNTING 2, FLEE and WANDER): bounded breadth-first maps over a box round the
 * animal, the flee map that keeps out of dead ends, the home map a burrower runs, and ring tiles.
 * Integer only, every loop bounded by the box, neighbours always in the order N E S W.
 */
import { idiv } from '../num';
import { d2 } from './senses';
import type { Tile } from './types';

/** A rectangle of tiles: x0..x0+w-1, y0..y0+h-1. */
export interface Box {
  x0: number;
  y0: number;
  w: number;
  h: number;
}

/** A map over a box: one value a tile, `none` where the map does not reach. */
export interface Field {
  box: Box;
  v: Int32Array;
  none: number;
}

export type Open = (x: number, y: number) => boolean;

/** N E S W, the one order every choice breaks ties by. */
export const NEIGHBOURS: readonly Tile[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** The widest box any map takes: a radius of 24, 49 by 49 tiles. */
export const MAX_RADIUS = 24;

/** The flee map's mark for a tile it does not reach (the largest Int32). */
export const FAR = 0x7fff_ffff;

export function boxAround(center: Tile, radius: number): Box {
  const r = Math.max(0, Math.min(radius, MAX_RADIUS));
  return { x0: center[0] - r, y0: center[1] - r, w: 2 * r + 1, h: 2 * r + 1 };
}

export function inBox(box: Box, x: number, y: number): boolean {
  return x >= box.x0 && y >= box.y0 && x < box.x0 + box.w && y < box.y0 + box.h;
}

function cell(box: Box, x: number, y: number): number {
  return (y - box.y0) * box.w + (x - box.x0);
}

/**
 * Steps from the nearest seed to every open tile of the box, at most `maxSteps`; -1 where it does not
 * reach. A seed counts as 0 whether or not it is open itself (a threat may stand where the animal cannot).
 */
export function bfs(open: Open, from: readonly Tile[], box: Box, maxSteps: number): Int32Array {
  const n = box.w * box.h;
  const dist = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (const [x, y] of from) {
    if (!inBox(box, x, y)) continue;
    const i = cell(box, x, y);
    if (dist[i] !== -1) continue;
    dist[i] = 0;
    queue[tail++] = i;
  }
  while (head < tail) {
    const i = queue[head++]!;
    const d = dist[i]!;
    if (d >= maxSteps) continue;
    const x = box.x0 + (i % box.w);
    const y = box.y0 + idiv(i, box.w);
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBox(box, nx, ny) || !open(nx, ny)) continue;
      const j = cell(box, nx, ny);
      if (dist[j] !== -1) continue;
      dist[j] = d + 1;
      queue[tail++] = j;
    }
  }
  return dist;
}

/**
 * The flee map (the integer form of the well-known safety map): each tile scores -6 times its steps
 * from the threat, then repeated passes lower a tile to a neighbour's score plus 5. Lowest is safest.
 * The passes let the open ground far away pull its neighbours down, so the far end of a corridor, a
 * dead end, scores worse than open ground at the same distance. Passes are bounded by 4 * radius.
 */
export function fleeMap(open: Open, threat: Tile, around: Tile, radius: number): Field {
  const box = boxAround(around, radius);
  const r = (box.w - 1) >> 1;
  const dist = bfs(open, [threat], box, box.w * box.h);
  const v = new Int32Array(dist.length);
  for (let i = 0; i < dist.length; i++) v[i] = dist[i]! < 0 ? FAR : -6 * dist[i]!;
  for (let pass = 0; pass < 4 * r + 4; pass++) {
    let changed = false;
    for (let y = box.y0; y < box.y0 + box.h; y++) {
      for (let x = box.x0; x < box.x0 + box.w; x++) {
        const i = cell(box, x, y);
        if (v[i] === FAR) continue;
        for (const [dx, dy] of NEIGHBOURS) {
          if (!inBox(box, x + dx, y + dy)) continue;
          const u = v[cell(box, x + dx, y + dy)]!;
          if (u !== FAR && u + 5 < v[i]!) {
            v[i] = u + 5;
            changed = true;
          }
        }
      }
    }
    if (!changed) break;
  }
  return { box, v, none: FAR };
}

/** Steps to the den over the box round the animal (flight B runs home on it). */
export function homeMap(open: Open, den: Tile, around: Tile, radius: number): Field {
  const box = boxAround(around, radius);
  return { box, v: bfs(open, [den], box, box.w * box.h), none: -1 };
}

/** A field's value at a tile, or its `none` outside the box. */
export function valueAt(field: Field, x: number, y: number): number {
  return inBox(field.box, x, y) ? field.v[cell(field.box, x, y)]! : field.none;
}

/** The open neighbour with the lowest value below the tile's own, ties by N E S W; none at a low point. */
export function nextTile(field: Field, at: Tile, open: Open): Tile | undefined {
  let best: Tile | undefined;
  let bestV = valueAt(field, at[0], at[1]);
  for (const [dx, dy] of NEIGHBOURS) {
    const x = at[0] + dx;
    const y = at[1] + dy;
    if (!open(x, y)) continue;
    const u = valueAt(field, x, y);
    if (u === field.none) continue;
    if (bestV === field.none || u < bestV) {
      best = [x, y];
      bestV = u;
    }
  }
  return best;
}

/**
 * One step of a burrower's run home (BEHAVIOUR 1, flight B). When the threat stands between it and
 * home (the threat is nearer the den by the home map), undefined: the caller flees in the open on the
 * flee map, so the run never turns back past the threat. Otherwise an open neighbour closer to the den
 * that does not brush the threat's side (d2 to the threat over 2): the closest to home first, then the
 * farthest from the threat, then N E S W.
 */
export function homeStep(home: Field, at: Tile, threat: Tile, open: Open): Tile | undefined {
  const here = valueAt(home, at[0], at[1]);
  if (here === home.none) return undefined;
  const there = valueAt(home, threat[0], threat[1]);
  if (there !== home.none && there < here) return undefined;
  let best: Tile | undefined;
  let bestH = 0;
  let bestT = 0;
  for (const [dx, dy] of NEIGHBOURS) {
    const nb: Tile = [at[0] + dx, at[1] + dy];
    if (!open(nb[0], nb[1])) continue;
    const h = valueAt(home, nb[0], nb[1]);
    if (h === home.none || h >= here) continue;
    const t = d2(nb, threat);
    if (t <= 2) continue;
    if (!best || h < bestH || (h === bestH && t > bestT)) {
      best = nb;
      bestH = h;
      bestT = t;
    }
  }
  return best;
}

/** Every tile at a Chebyshev distance from rMin to rMax of a centre, in order of y, then x. */
export function ringTiles(center: Tile, rMin: number, rMax: number): Tile[] {
  const out: Tile[] = [];
  for (let dy = -rMax; dy <= rMax; dy++) {
    for (let dx = -rMax; dx <= rMax; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < rMin) continue;
      out.push([center[0] + dx, center[1] + dy]);
    }
  }
  return out;
}

/** One step toward a target: down its breadth-first map when it is reachable inside the box, else undefined. */
export function stepToward(open: Open, at: Tile, target: Tile): Tile | undefined {
  if (at[0] === target[0] && at[1] === target[1]) return undefined;
  const reach = Math.max(Math.abs(target[0] - at[0]), Math.abs(target[1] - at[1])) + 2;
  const box = boxAround(at, reach);
  const field: Field = { box, v: bfs(open, [target], box, box.w * box.h), none: -1 };
  return nextTile(field, at, open);
}
