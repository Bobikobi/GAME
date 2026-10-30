/**
 * Where a save of an older world is stood again when the height layer cuts it off (G68, DECISIONS.md,
 * 2026-10-28). A save is never a fall: only the tile changes, the bag, the health and the clock stay.
 */
import type { Bundle } from './bundle';
import type { State } from './state';
import type { Tile } from './step';
import { hasHeight, inRect, makeStepRule, makeWalkable } from './world';

const STEPS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Where the characters wake: the map's spawn and every wake pocket. A place is reachable when a foot can walk there from one of them. */
function wakePlaces(b: Bundle): Tile[] {
  return [[b.map.spawn.x, b.map.spawn.y], ...Object.values(b.pockets).map((p) => [p.wake.x, p.wake.y] as Tile)];
}

/**
 * The tile an old save must stand on now, or `undefined` when it stays where it is. Under the shared step
 * rule (`makeStepRule`) a tile the save stood on may be walled off by a rock face from every place a
 * character wakes. The answer is the nearest tile that is reachable on foot from a wake: inside the same
 * slot the old tile lay in when that slot has one, else anywhere; nearest by four-way distance, ties by
 * row then column, so every machine picks the same tile. A map with no height layer never moves anyone.
 */
export function relocationOf(bundle: Bundle, state: State): Tile | undefined {
  const map = bundle.map;
  if (!hasHeight(map)) return undefined;
  const walkable = makeWalkable(bundle);
  const stepOpen = makeStepRule(bundle);
  const view = state.player;
  const { width, height } = map;
  const reach = new Uint8Array(width * height);
  const queue: Tile[] = [];
  for (const [x, y] of wakePlaces(bundle)) {
    if (x >= 0 && y >= 0 && x < width && y < height && reach[y * width + x] === 0 && walkable(x, y, view)) {
      reach[y * width + x] = 1;
      queue.push([x, y]);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || reach[ny * width + nx] === 1) continue;
      if (!walkable(nx, ny, view) || !stepOpen(x, y, nx, ny)) continue;
      reach[ny * width + nx] = 1;
      queue.push([nx, ny]);
    }
  }
  const [px, py] = state.player.at;
  if (px >= 0 && py >= 0 && px < width && py < height && reach[py * width + px] === 1) return undefined;
  if (queue.length === 0) return undefined;
  const place = map.slots.find((slot) => inRect(px, py, slot));
  const pick = (inside: boolean): Tile | undefined => {
    let best: Tile | undefined;
    let bestDistance = Infinity;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (reach[y * width + x] !== 1 || (inside && !inRect(x, y, place!))) continue;
        const distance = Math.abs(x - px) + Math.abs(y - py);
        // scanning rows then columns, a tie keeps the first: the smaller row, then the smaller column
        if (distance < bestDistance) {
          bestDistance = distance;
          best = [x, y];
        }
      }
    }
    return best;
  };
  return (place ? pick(true) : undefined) ?? pick(false);
}
