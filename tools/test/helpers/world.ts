import {
  type Bundle,
  type Rect,
  type WorldView,
  hourOf,
  makeStepRule,
  makeWalkable,
  near,
  wakePocket,
  widenSeed,
} from '@game/kernel';

import { runCheck } from '../../src/check.js';

export type Tile = [number, number];

const walkableCache = new WeakMap<Bundle, ReturnType<typeof makeWalkable>>();
const stepRuleCache = new WeakMap<Bundle, ReturnType<typeof makeStepRule>>();

export function loadBundle(): Bundle {
  const bundle = runCheck().assembled.bundle;
  if (!bundle) throw new Error('Content did not assemble into a bundle.');
  return bundle;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function bfs(
  bundle: Bundle,
  view: WorldView,
  start: readonly [number, number],
  goal: (x: number, y: number) => boolean,
): Tile[] | undefined {
  let walkable = walkableCache.get(bundle);
  if (!walkable) {
    walkable = makeWalkable(bundle);
    walkableCache.set(bundle, walkable);
  }
  // a route a player can walk: the kernel's height rule (G68) as well as the walkable tiles
  let stepOpen = stepRuleCache.get(bundle);
  if (!stepOpen) {
    stepOpen = makeStepRule(bundle);
    stepRuleCache.set(bundle, stepOpen);
  }
  const queue: Tile[] = [[start[0], start[1]]];
  const previous = new Map<string, string | undefined>([[key(start[0], start[1]), undefined]]);
  for (let index = 0; index < queue.length; index += 1) {
    const tile = queue[index]!;
    if (walkable(tile[0], tile[1], view) && goal(tile[0], tile[1])) {
      return buildPath(previous, tile);
    }
    const neighbours: Tile[] = [
      [tile[0], tile[1] - 1],
      [tile[0] + 1, tile[1]],
      [tile[0], tile[1] + 1],
      [tile[0] - 1, tile[1]],
    ];
    for (const next of neighbours) {
      const nextKey = key(next[0], next[1]);
      if (previous.has(nextKey) || !walkable(next[0], next[1], view) || !stepOpen(tile[0], tile[1], next[0], next[1])) continue;
      previous.set(nextKey, key(tile[0], tile[1]));
      queue.push(next);
    }
  }
  return undefined;
}

export function bfsToTile(
  bundle: Bundle,
  view: WorldView,
  start: readonly [number, number],
  target: readonly [number, number],
): Tile[] | undefined {
  return bfs(bundle, view, start, (x, y) => x === target[0] && y === target[1]);
}

export function bfsNear(
  bundle: Bundle,
  view: WorldView,
  start: readonly [number, number],
  target: Rect,
): Tile[] | undefined {
  return bfs(bundle, view, start, (x, y) => near([x, y], target));
}

export function bfsInside(
  bundle: Bundle,
  view: WorldView,
  start: readonly [number, number],
  target: Rect,
): Tile[] | undefined {
  return bfs(bundle, view, start, (x, y) =>
    x >= target.x && x < target.x + target.w && y >= target.y && y < target.y + target.h,
  );
}

export function firstOpenTick(
  bundle: Bundle,
  minimum: number,
  hours: readonly [number, number] | undefined,
): number {
  if (!hours) return minimum;
  const open = (hour: number): boolean => hours[0] < hours[1]
    ? hour >= hours[0] && hour < hours[1]
    : hour >= hours[0] || hour < hours[1];
  if (open(hourOf(bundle, minimum))) return minimum;
  const hourLength = bundle.params.day_length_ms / 24;
  for (let offset = 1; offset <= 24; offset += 1) {
    const tick = minimum + Math.ceil(offset * hourLength);
    if (open(hourOf(bundle, tick))) return tick;
  }
  throw new Error('Could not find an open hour in one in-game day.');
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function buildPath(previous: Map<string, string | undefined>, end: Tile): Tile[] {
  const path: Tile[] = [];
  let cursor: string | undefined = key(end[0], end[1]);
  while (cursor !== undefined) {
    const [x, y] = cursor.split(',').map(Number);
    if (x === undefined || y === undefined) throw new Error('Invalid BFS tile.');
    path.push([x, y]);
    cursor = previous.get(cursor);
  }
  return path.reverse();
}

/** The first world seed from `from` whose wake draw lands in a pocket (kernel wakePocket): a test wakes where it means to. */
export function seedFor(bundle: Bundle, pocket: string, from = 1): number {
  for (let seed = from; seed < from + 10_000; seed++) if (wakePocket(bundle, widenSeed(seed)) === pocket) return seed;
  throw new Error(`No seed draws ${pocket}.`);
}
