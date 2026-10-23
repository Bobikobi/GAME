/**
 * A tree stands in the way (DECISIONS.md, 2026-10-10: a solid node blocks its
 * tile grown or felled), so a grove must never wall the map: every place the
 * player can walk up to without the trees must still be reachable with them,
 * from wherever a character wakes, with every passable restoration mended.
 */
import { type Bundle, type Rect, makeWalkable, near } from '@game/kernel';
import type { Issue } from './load';

const STEPS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Where the characters wake: the map's spawn, and every wake pocket of the pool. */
function wakePlaces(b: Bundle): [number, number][] {
  const all: [number, number][] = [[b.map.spawn.x, b.map.spawn.y], ...Object.values(b.pockets).map((p) => [p.wake.x, p.wake.y] as [number, number])];
  return all.filter(([x, y], i) => all.findIndex(([u, v]) => u === x && v === y) === i);
}

/** The map's walkable tiles with every passable restoration mended, one build for any check that needs them (row-major, 1 = a foot can stand there). */
export function walkBitmap(b: Bundle): Uint8Array {
  const walkable = makeWalkable(b);
  const view = { restored: Object.values(b.restores).filter((r) => r.passable).map((r) => r.id), camp: [] as string[] };
  const { width, height } = b.map;
  const open = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) open[y * width + x] = walkable(x, y, view) ? 1 : 0;
  return open;
}

/** The slots the player can stand next to, walking four ways from where a character wakes. */
function reachable(b: Bundle, from: [number, number]): Set<string> {
  const walkable = makeWalkable(b);
  const view = { restored: Object.values(b.restores).filter((r) => r.passable).map((r) => r.id), camp: [] as string[] };
  const { width, height } = b.map;
  const seen = new Set<number>([from[1] * width + from[0]]);
  const queue: [number, number][] = [[from[0], from[1]]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || seen.has(ny * width + nx) || !walkable(nx, ny, view)) continue;
      seen.add(ny * width + nx);
      queue.push([nx, ny]);
    }
  }
  const tiles = queue as readonly [number, number][];
  const slots = new Set<string>();
  for (const slot of b.map.slots as readonly (Rect & { id: string })[]) {
    if (tiles.some((t) => near(t, slot))) slots.add(slot.id);
  }
  return slots;
}

export function checkReach(b: Bundle, origin: Record<string, string>): Issue[] {
  const solid = Object.values(b.resources).filter((r) => r.solid === true);
  if (solid.length === 0) return [];
  const without = (ids: readonly string[]): Bundle => ({
    ...b,
    resources: Object.fromEntries(Object.entries(b.resources).map(([id, r]) => [id, ids.includes(id) ? { ...r, solid: false } : r])),
  });
  const blamed = new Map<string, string[]>();
  for (const from of wakePlaces(b)) {
    const standing = reachable(b, from);
    const cut = [...reachable(without(solid.map((r) => r.id)), from)].filter((slot) => !standing.has(slot));
    if (cut.length === 0) continue;
    // name the trees whose removal frees each place; when only several groups together close it, name them all
    const freed = new Map(solid.map((r) => [r.id, reachable(without([r.id]), from)]));
    for (const slot of cut) {
      const alone = solid.filter((r) => freed.get(r.id)!.has(slot));
      for (const r of alone.length > 0 ? alone : solid) {
        const had = blamed.get(r.id) ?? [];
        if (!had.includes(slot)) blamed.set(r.id, [...had, slot]);
      }
    }
  }
  return [...blamed].map(([id, slots]) => ({
    file: origin[id] ?? 'content',
    where: 'node.solid',
    message: `${id} stands in the way and closes the road from where the player wakes to ${slots.slice(0, 4).map((s) => `"${s}"`).join(', ')}${slots.length > 4 ? ` and ${slots.length - 4} more` : ''}: fewer of them, or another place`,
    level: 'error' as const,
  }));
}
