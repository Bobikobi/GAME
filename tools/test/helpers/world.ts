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

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { assemble } from '../../src/assemble.js';
import { readBoard } from '../../src/board.js';
import { runCheck } from '../../src/check.js';
import { loadAll } from '../../src/load.js';

export type Tile = [number, number];

const walkableCache = new WeakMap<Bundle, ReturnType<typeof makeWalkable>>();
const stepRuleCache = new WeakMap<Bundle, ReturnType<typeof makeStepRule>>();

export function loadBundle(): Bundle {
  const bundle = runCheck().assembled.bundle;
  if (!bundle) throw new Error('Content did not assemble into a bundle.');
  return bundle;
}

const PIXEL_VALLEY = new URL('../fixtures/pixel-valley/', import.meta.url);

function pixelWakes(): Record<string, { x: number; y: number }> {
  return JSON.parse(readFileSync(new URL('wakes.json', PIXEL_VALLEY), 'utf8')) as Record<string, { x: number; y: number }>;
}

/**
 * The first valley as it is drawn in pixels (the map and the three wake tiles of develop at ff32d25b, 28.11), frozen in
 * tools/test/fixtures/pixel-valley. A test of an ENGINE rule that borrows the valley as a world (a hazard's round, a
 * fire's reach, a cliff's steps, a den's ring, a walk to a named tile) stands on this one, so it keeps proving the rule
 * when the shipped map is redrawn (the painted valley, public #919). A test of the shipped content (the opening, the
 * mist on the wake pockets, the maze, the balance pages' minutes) uses `loadBundle` and the content as it stands.
 */
export function loadPixelBundle(): Bundle {
  const { files } = loadAll();
  const map = JSON.parse(readFileSync(new URL('map.json', PIXEL_VALLEY), 'utf8')) as unknown;
  const wakes = pixelWakes();
  for (const f of files) {
    const data = f.data as unknown as { type: string; id?: string; pocket?: { wake: { x: number; y: number } } };
    if (f.rel === 'core/map.json') f.data = map as typeof f.data;
    else if (data.type === 'pocket' && data.id && wakes[data.id] && data.pocket) data.pocket.wake = wakes[data.id]!;
  }
  // the board as `runCheck` reads it, so the frozen bundle differs from the shipped one by the map and the wake tiles alone
  const bundle = assemble(files, readBoard()).bundle;
  if (!bundle) throw new Error('The pixel valley did not assemble into a bundle.');
  return bundle;
}

/** The same freeze on a copy of the content (a temp root a test builds with `cpSync`): the pixel map and wake tiles are written over the copy's. */
export function pinPixelValley(root: string): void {
  writeFileSync(join(root, 'core', 'map.json'), readFileSync(new URL('map.json', PIXEL_VALLEY), 'utf8'));
  for (const [id, wake] of Object.entries(pixelWakes())) {
    const file = join(root, 'core', 'pockets', `${id.split('/')[1]}.json`);
    const data = JSON.parse(readFileSync(file, 'utf8')) as { pocket: { wake: { x: number; y: number } } };
    data.pocket.wake = wake;
    writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  }
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
