/**
 * Roads that wind (G69): a least-cost walk over the land with a drawn cost on every tile, so a road bends with the
 * ground instead of running straight, then a repair that breaks any straight run over RUN_MAX with a two-tile
 * sidestep (the first map's plan did the same by hand). Integers only; ties break by tile order, so the same land
 * gives the same road.
 */
import { type Land, G, STEPS4, type Tile } from './grid';

/** G69: the longest straight run a road may hold; a bridge may run to BRIDGE_RUN_MAX. */
export const RUN_MAX = 7;
export const BRIDGE_RUN_MAX = 12;

/** A binary heap of (cost, order, key) triples; the smallest cost first, the earliest pushed on a tie. */
class Heap {
  private readonly items: [number, number, number][] = [];
  private order = 0;
  get size(): number {
    return this.items.length;
  }
  push(cost: number, key: number): void {
    const it: [number, number, number] = [cost, this.order++, key];
    const a = this.items;
    a.push(it);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (less(a[p]!, it)) break;
      a[i] = a[p]!;
      i = p;
    }
    a[i] = it;
  }
  pop(): number {
    const a = this.items;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        let best = last;
        if (l < a.length && less(a[l]!, best)) {
          m = l;
          best = a[l]!;
        }
        if (r < a.length && less(a[r]!, best)) m = r;
        if (m === i) break;
        a[i] = a[m]!;
        i = m;
      }
      a[i] = last;
    }
    return top[2];
  }
}
const less = (a: [number, number, number], b: [number, number, number]) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

/** The cost of entering a tile, or -1 for never; `(x, y, fromX, fromY)` so a level change can be priced. */
export type Cost = (x: number, y: number, fx: number, fy: number) => number;

/**
 * The least-cost four-way walk from `from` to `to`, or undefined when none. With `stop`, the walk ends at the
 * first tile the predicate accepts (a road already laid), so a second road joins the first instead of running
 * beside it.
 */
export function route(land: Land, from: Tile, to: Tile, cost: Cost, stop?: (x: number, y: number) => boolean): Tile[] | undefined {
  const n = land.w * land.h;
  const best = new Int32Array(n).fill(0x7fffffff);
  const back = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const heap = new Heap();
  const start = land.key(from[0], from[1]);
  const goal = land.key(to[0], to[1]);
  best[start] = 0;
  heap.push(Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]), start);
  let end = goal;
  while (heap.size > 0) {
    const k = heap.pop();
    if (done[k]) continue;
    done[k] = 1;
    if (k === goal) break;
    const x = (k % land.w) + land.x0;
    const y = Math.floor(k / land.w) + land.y0;
    if (stop && k !== start && stop(x, y)) {
      end = k;
      break;
    }
    for (const [dx, dy] of STEPS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!land.inside(nx, ny)) continue;
      const nk = land.key(nx, ny);
      if (done[nk]) continue;
      const c = cost(nx, ny, x, y);
      if (c < 0) continue;
      const g = best[k]! + c;
      if (g < best[nk]!) {
        best[nk] = g;
        back[nk] = k;
        heap.push(g + Math.abs(nx - to[0]) + Math.abs(ny - to[1]), nk);
      }
    }
  }
  if (back[end] === -1 && end !== start) return undefined;
  const out: Tile[] = [];
  for (let k = end; k !== -1; k = back[k]!) out.unshift([(k % land.w) + land.x0, Math.floor(k / land.w) + land.y0]);
  return out;
}

/** The straight runs of a four-connected chain: each run's tiles. */
export function straightRuns(tiles: readonly Tile[]): Tile[][] {
  const runs: Tile[][] = [];
  if (tiles.length === 0) return runs;
  const step = (i: number) => `${tiles[i]![0] - tiles[i - 1]![0]},${tiles[i]![1] - tiles[i - 1]![1]}`;
  let start = 0;
  for (let i = 2; i < tiles.length; i++) {
    if (step(i) === step(i - 1)) continue;
    runs.push(tiles.slice(start, i));
    start = i - 1;
  }
  runs.push(tiles.slice(start));
  return runs;
}

/**
 * Breaks every straight run over `limit` with a sidestep in its middle: the three tiles t0 t1 t2 become t0, t0+q,
 * t1+q, t2+q, t2 where q is perpendicular. `fits` says whether a tile may carry the road (not water, not rock); a
 * run that cannot be broken on either side stays and is reported by the measure.
 */
export function repair(tiles: Tile[], fits: (t: Tile) => boolean, limit = RUN_MAX): Tile[] {
  let route = tiles.slice();
  for (let guard = 0; guard < 400; guard++) {
    let changed = false;
    const runs = straightRuns(route);
    let index = 0;
    for (const run of runs) {
      if (run.length > limit && !run.every((t) => !fits(t))) {
        const k = index + Math.floor(run.length / 2) - 1;
        const t0 = route[k]!;
        const t1 = route[k + 1]!;
        const t2 = route[k + 2]!;
        if (!t2) break;
        const d: Tile = [t1[0] - t0[0], t1[1] - t0[1]];
        for (const q of d[0] === 0 ? ([[1, 0], [-1, 0]] as Tile[]) : ([[0, 1], [0, -1]] as Tile[])) {
          const a: Tile = [t0[0] + q[0], t0[1] + q[1]];
          const b: Tile = [t1[0] + q[0], t1[1] + q[1]];
          const c: Tile = [t2[0] + q[0], t2[1] + q[1]];
          if (fits(a) && fits(b) && fits(c) && !route.some((t) => (t[0] === a[0] && t[1] === a[1]) || (t[0] === c[0] && t[1] === c[1]))) {
            route = [...route.slice(0, k + 1), a, b, c, ...route.slice(k + 2)];
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
      index += run.length - 1;
    }
    if (!changed) return route;
  }
  return route;
}

/** The longest straight run of the chain, bridges counted apart: [onLand, onBridge]. */
export function longestRuns(land: Land, tiles: readonly Tile[]): [number, number] {
  let onLand = 0;
  let onBridge = 0;
  for (const run of straightRuns(tiles)) {
    if (run.some(([x, y]) => land.get(x, y) === G.bridge)) onBridge = Math.max(onBridge, run.length);
    else onLand = Math.max(onLand, run.length);
  }
  return [onLand, onBridge];
}

/**
 * G69 on the ground itself, the way the map check reads it: no row or column holds more than `limit` path
 * letters in a row (a bridge letter breaks a run). Where two roads meet or run side by side the laid roads can
 * line up past the limit; this pass bends such a run at its middle, three tiles to one side on the same level,
 * and repeats until every run is short. Returns the tiles it changed, so the caller can clear their props.
 */
export function wind(land: Land, limit = RUN_MAX + 1): Tile[] {
  const changed: Tile[] = [];
  for (let pass = 0; pass < 60; pass++) {
    const run = longGroundRun(land, limit);
    if (!run) break;
    const bent = bend(land, run);
    if (!bent) break;
    changed.push(...bent);
  }
  return changed;
}

function longGroundRun(land: Land, limit: number): Tile[] | undefined {
  const scan = (x0: number, y0: number, dx: number, dy: number): Tile[] | undefined => {
    let run: Tile[] = [];
    for (let x = x0, y = y0; land.inside(x, y); x += dx, y += dy) {
      if (land.get(x, y) === G.path) run.push([x, y]);
      else {
        if (run.length > limit) return run;
        run = [];
      }
    }
    return run.length > limit ? run : undefined;
  };
  for (let y = land.y0; y < land.y0 + land.h; y++) {
    const r = scan(land.x0, y, 1, 0);
    if (r) return r;
  }
  for (let x = land.x0; x < land.x0 + land.w; x++) {
    const r = scan(x, land.y0, 0, 1);
    if (r) return r;
  }
  return undefined;
}

/** Bends a straight run of path tiles: the middle tile steps aside with its two neighbours, on one side or the other. */
function bend(land: Land, run: Tile[]): Tile[] | undefined {
  const along: Tile = run[1]![0] === run[0]![0] ? [0, 1] : [1, 0];
  const sides: Tile[] = along[0] === 0 ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
  const mid = run.length >> 1;
  const order = [mid, mid - 1, mid + 1, mid - 2, mid + 2, mid - 3, mid + 3].filter((i) => i >= 2 && i <= run.length - 3);
  for (const i of order) {
    const [mx, my] = run[i]!;
    if (land.crossings.has(land.key(mx, my))) continue;
    for (const [sx, sy] of sides) {
      const trio: Tile[] = [-1, 0, 1].map((d) => [mx + d * along[0] + sx, my + d * along[1] + sy] as const);
      const fits = trio.every(([x, y]) => {
        if (!land.inside(x, y)) return false;
        const ch = land.get(x, y);
        return ch !== G.water && ch !== G.mountain && ch !== G.bridge && land.level(x, y) === land.level(mx, my) && !land.crossings.has(land.key(x, y));
      });
      if (!fits) continue;
      // the far side of the trio must not already be path, or the bend would only move the run
      const beyond = trio.map(([x, y]) => [x + sx, y + sy] as const);
      if (beyond.some(([x, y]) => land.inside(x, y) && land.get(x, y) === G.path)) continue;
      land.set(mx, my, G.grove);
      for (const [x, y] of trio) {
        land.clearProps(x, y);
        land.set(x, y, G.path);
      }
      return [[mx, my], ...trio];
    }
  }
  return undefined;
}
