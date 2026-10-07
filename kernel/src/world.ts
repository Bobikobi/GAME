/**
 * Where things are. The kernel and the client share these functions, so the
 * tile a player can stand on and the tile the kernel accepts are the same.
 */
import type { Bundle, Instance, MapDef, ResourceDef, TreasureDef } from './bundle';
import { idiv } from './num';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Slot = MapDef['slots'][number];
export type CampSpot = 'fire' | 'storage' | 'workshop' | 'shelf';

/** Where each camp upgrade stands inside the camp slot. */
export const CAMP_SPOTS: Record<CampSpot, [number, number]> = {
  fire: [2, 2],
  storage: [0, 0],
  workshop: [4, 0],
  shelf: [4, 3],
};

export function findSlot(map: MapDef, id: string): Slot | undefined {
  return map.slots.find((s) => s.id === id);
}

export function inRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** True when tile (x, y) touches the rectangle or is inside it (8 neighbours). */
export function near(at: readonly [number, number], r: Rect): boolean {
  const [x, y] = at;
  return x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h;
}

export function centerOf(r: Rect): [number, number] {
  return [r.x + idiv(r.w, 2), r.y + idiv(r.h, 2)];
}

/** Ground and props only: what never changes during play. */
export function staticSolid(map: MapDef): Uint8Array {
  const solid = new Uint8Array(map.width * map.height);
  for (let y = 0; y < map.height; y++) {
    const row = map.ground[y] ?? '';
    for (let x = 0; x < map.width; x++) {
      const tile = map.legend[row[x] ?? ''];
      if (!tile || tile.solid) solid[y * map.width + x] = 1;
    }
  }
  for (const prop of map.props) {
    if (!prop.solid) continue;
    for (let y = prop.y; y < prop.y + prop.h; y++) {
      for (let x = prop.x; x < prop.x + prop.w; x++) {
        if (x < map.width && y < map.height) solid[y * map.width + x] = 1;
      }
    }
  }
  return solid;
}

/** Tile tag of the ground at (x, y). */
export function tagAt(map: MapDef, x: number, y: number): string | undefined {
  const row = map.ground[y];
  return row === undefined ? undefined : map.legend[row[x] ?? '']?.tag;
}

/**
 * Places every resource node and dig spot inside its slot. Deterministic:
 * candidates are open, non-path tiles on a checkerboard (so nodes never wall
 * each other in); the first is the one nearest the slot's center, and each
 * next one is the candidate farthest from those already placed.
 */
export function layoutInstances(
  map: MapDef,
  resources: Record<string, ResourceDef>,
  treasures: Record<string, TreasureDef>,
): Record<string, Instance> {
  const solid = staticSolid(map);
  const used = new Set<number>();
  const instances: Record<string, Instance> = {};
  const sources: { id: string; kind: Instance['kind']; slot: string; count: number }[] = [
    ...Object.keys(resources)
      .sort()
      .map((id) => ({ id, kind: 'resource' as const, slot: resources[id]!.place.slot, count: resources[id]!.count })),
    ...Object.keys(treasures)
      .sort()
      .map((id) => ({ id, kind: 'treasure' as const, slot: treasures[id]!.place.slot, count: treasures[id]!.count })),
  ];
  for (const source of sources) {
    const slot = findSlot(map, source.slot);
    if (!slot) continue;
    const candidates: [number, number][] = [];
    for (let y = slot.y; y < slot.y + slot.h; y++) {
      for (let x = slot.x; x < slot.x + slot.w; x++) {
        const i = y * map.width + x;
        if ((x + y) % 2 === 0 && !solid[i] && !used.has(i) && tagAt(map, x, y) !== 'path') candidates.push([x, y]);
      }
    }
    const [cx, cy] = [slot.x * 2 + slot.w - 1, slot.y * 2 + slot.h - 1]; // doubled center, stays integral
    const chosen: [number, number][] = [];
    const n = Math.min(source.count, candidates.length);
    for (let k = 0; k < n; k++) {
      let best = -1;
      let bestScore = -1;
      candidates.forEach(([x, y], ci) => {
        if (chosen.some(([a, b]) => a === x && b === y)) return;
        const score =
          chosen.length === 0
            ? 1_000_000 - ((2 * x - cx) ** 2 + (2 * y - cy) ** 2)
            : Math.min(...chosen.map(([a, b]) => (a - x) ** 2 + (b - y) ** 2));
        if (score > bestScore) {
          bestScore = score;
          best = ci;
        }
      });
      const [x, y] = candidates[best]!;
      chosen.push([x, y]);
      used.add(y * map.width + x);
      instances[`${source.id}#${k}`] = { source: source.id, kind: source.kind, x, y };
    }
  }
  return instances;
}

/** Tile an NPC stands on. */
export function npcTile(bundle: Bundle, npcId: string): [number, number] | undefined {
  const npc = bundle.npcs[npcId];
  const slot = npc && findSlot(bundle.map, npc.place.slot);
  return slot ? centerOf(slot) : undefined;
}

/** Tile a camp upgrade stands on, inside the first camp slot of the map. */
export function campTile(bundle: Bundle, spot: CampSpot): [number, number] | undefined {
  const slot = bundle.map.slots.find((s) => s.kind === 'camp');
  if (!slot) return undefined;
  const [dx, dy] = CAMP_SPOTS[spot];
  return [slot.x + dx, slot.y + dy];
}

export interface WorldView {
  restored: readonly string[];
  camp: readonly string[];
}

/**
 * Can a player stand on (x, y)? Ground and props, NPCs and built camp parts
 * block; a restored passable thing (a bridge) opens its tiles. Resource nodes
 * do not: a gathered rock opens the way, and one that grows back under the
 * player must never trap them. The game blocks a node only while it shows.
 */
export function makeWalkable(bundle: Bundle): (x: number, y: number, view: WorldView) => boolean {
  const map = bundle.map;
  const solid = staticSolid(map);
  const blockers = new Set<number>();
  for (const id of Object.keys(bundle.npcs)) {
    const t = npcTile(bundle, id);
    if (t) blockers.add(t[1] * map.width + t[0]);
  }
  const passable = Object.values(bundle.restores)
    .filter((r) => r.passable)
    .map((r) => ({ id: r.id, slot: findSlot(map, r.place.slot) }))
    .filter((r): r is { id: string; slot: Slot } => r.slot !== undefined);
  return (x, y, view) => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const i = y * map.width + x;
    if (blockers.has(i)) return false;
    for (const id of view.camp) {
      const camp = bundle.camps[id];
      const t = camp && campTile(bundle, camp.slot);
      if (t && t[0] === x && t[1] === y) return false;
    }
    if (solid[i]) {
      return passable.some((r) => view.restored.includes(r.id) && inRect(x, y, r.slot));
    }
    return true;
  };
}
