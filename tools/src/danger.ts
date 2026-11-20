/**
 * Danger read from the world (G64 in docs/design/OPEN_WORLD.md, CR-38, issue 578). Every area carries
 * its danger level d, and d rises with the walk from town: one 4-way pass from every town tile, every
 * crossing mended, and an area whose d is more than one level off floor(steps / DANGER_BAND_STEPS) is
 * named. The level-0 places (the town and a slot marked safe, the night ruins' doorstep) are exempt.
 * The screen never shows d, so each border where d rises carries a cue the eye catches: a cue prop
 * within CUE_TILES of the border, and of every road that crosses it. Warnings (`!` lines), like the
 * other draft rules.
 */
import { type Bundle, type Rect, type Tile, dangerAt, distanceTo, idiv, isTownTile, makeWalkable, tagAt } from '@game/kernel';
import type { Issue } from './load';

/** G64's band: one chunk, 64 steps of the walk from town per level (OPEN_WORLD.md 1.6, set with `fall_walk_steps`). */
export const DANGER_BAND_STEPS = 64;

/** How near a border a cue stands, in tiles, a diagonal step counting one. */
export const CUE_TILES = 3;

/**
 * The sprites that read as a cue of danger rising. The kit has no tracks or bones yet and its fog is the
 * empty slots' tile, so the dead tree stands for them; a tracks or bones sprite joins this list when drawn.
 */
export const CUE_SPRITES: readonly string[] = ['core/base-kit:props/dead_tree'];

const STEPS4: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

const RULE = 'G64 (docs/design/OPEN_WORLD.md), "Danger rises with distance from town"';

/** Steps from the nearest town tile to every walkable tile, four ways, every passable restoration mended. */
export function stepsFromTown(b: Bundle): Map<number, number> {
  const walkable = makeWalkable(b);
  const view = { restored: Object.values(b.restores).filter((r) => r.passable).map((r) => r.id), camp: [] as string[] };
  const { width, height } = b.map;
  const dist = new Map<number, number>();
  const queue: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isTownTile(b, [x, y]) || !walkable(x, y, view)) continue;
      dist.set(y * width + x, 0);
      queue.push([x, y]);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    const here = dist.get(y * width + x)!;
    for (const [dx, dy] of STEPS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || dist.has(ny * width + nx) || !walkable(nx, ny, view)) continue;
      dist.set(ny * width + nx, here + 1);
      queue.push([nx, ny]);
    }
  }
  return dist;
}

/** An area's distance from town: the fewest steps to a reached tile inside it, else in the nearest ring around it that has one. */
function areaSteps(b: Bundle, dist: Map<number, number>, r: Rect): number | undefined {
  const { width, height } = b.map;
  for (let ring = 0; ring < Math.max(width, height); ring++) {
    let best: number | undefined;
    for (let y = Math.max(0, r.y - ring); y < Math.min(height, r.y + r.h + ring); y++) {
      for (let x = Math.max(0, r.x - ring); x < Math.min(width, r.x + r.w + ring); x++) {
        if (distanceTo([x, y], r) !== ring) continue;
        const d = dist.get(y * width + x);
        if (d !== undefined && (best === undefined || d < best)) best = d;
      }
    }
    if (best !== undefined) return best;
  }
  return undefined;
}

/** Groups of tiles, each joined to the next by a step of eight ways. */
function groups(tiles: Tile[]): Tile[][] {
  const left = new Map<string, Tile>(tiles.map((t) => [`${t[0]},${t[1]}`, t]));
  const out: Tile[][] = [];
  for (const start of tiles) {
    if (!left.delete(`${start[0]},${start[1]}`)) continue;
    const group: Tile[] = [start];
    for (let i = 0; i < group.length; i++) {
      const [x, y] = group[i]!;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const key = `${x + dx},${y + dy}`;
          const next = left.get(key);
          if (!next) continue;
          left.delete(key);
          group.push(next);
        }
      }
    }
    out.push(group);
  }
  return out;
}

export function checkDanger(b: Bundle, origin: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const file = origin[b.map.id] ?? 'content';
  const warn = (where: string, message: string) => issues.push({ file, where, message, level: 'warning' });
  const { width, height } = b.map;
  const dist = stepsFromTown(b);

  // every area carries d, and d follows the walk from town
  b.map.slots.forEach((s, i) => {
    if (s.kind !== 'area') return;
    const where = `map.slots.${i}.danger`;
    if (s.danger === undefined) {
      warn(where, `${RULE}: the area "${s.id}" carries no danger level d; set it from the difficulty reckoning (pnpm map:difficulty)`);
      return;
    }
    let town = false;
    for (let y = s.y; y < s.y + s.h && !town; y++) for (let x = s.x; x < s.x + s.w && !town; x++) town = isTownTile(b, [x, y]);
    if (s.danger === 0 && (town || s.safe === true)) return;
    const steps = areaSteps(b, dist, s);
    if (steps === undefined) {
      warn(where, `${RULE}: no walk from a town tile reaches the area "${s.id}", so its d ${s.danger} cannot be read against the distance`);
      return;
    }
    const band = idiv(steps, DANGER_BAND_STEPS);
    if (Math.abs(s.danger - band) > 1) {
      warn(where, `${RULE}: the area "${s.id}" is ${steps} steps from town, band ${band}, and carries d ${s.danger}; keep d within one of the band`);
    }
  });

  // the borders where d rises, and the roads that cross them
  const walkable = makeWalkable(b);
  const view = { restored: Object.values(b.restores).filter((r) => r.passable).map((r) => r.id), camp: [] as string[] };
  const level = new Map<number, number>();
  const at = (x: number, y: number): number | undefined => {
    if (x < 0 || y < 0 || x >= width || y >= height || !walkable(x, y, view)) return undefined;
    const key = y * width + x;
    if (!level.has(key)) level.set(key, dangerAt(b, [x, y]));
    return level.get(key);
  };
  const edges = new Map<string, Tile[]>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = at(x, y);
      if (d === undefined) continue;
      const lows = new Set<number>();
      for (const [dx, dy] of STEPS4) {
        const n = at(x + dx, y + dy);
        if (n !== undefined && n < d) lows.add(n);
      }
      for (const low of lows) {
        const key = `${low}>${d}`;
        if (!edges.has(key)) edges.set(key, []);
        edges.get(key)!.push([x, y]);
      }
    }
  }
  const cues = b.map.props.filter((p) => CUE_SPRITES.includes(p.sprite));
  const cued = (tiles: Tile[]): boolean => cues.some((c) => tiles.some((t) => distanceTo(t, c) <= CUE_TILES));
  const name = (t: Tile): string => `(${t[0]}, ${t[1]})`;
  const kinds = 'a dead tree; tracks, bones and thicker mist have no sprite yet';
  for (const [key, tiles] of edges) {
    const [low, high] = key.split('>');
    for (const border of groups(tiles)) {
      if (!cued(border)) {
        warn('map.props', `${RULE}: the border from d${low} to d${high} at ${name(border[0]!)} has no cue within ${CUE_TILES} tiles (${kinds})`);
        continue;
      }
      const roads = border.filter((t) => tagAt(b.map, t[0], t[1]) === 'path');
      for (const road of groups(roads)) {
        if (!cued(road)) warn('map.props', `${RULE}: the road crossing from d${low} to d${high} at ${name(road[0]!)} has no cue within ${CUE_TILES} tiles (${kinds})`);
      }
    }
  }
  return issues;
}

