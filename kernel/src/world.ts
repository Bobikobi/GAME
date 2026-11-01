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

/** The world a map belongs to when it names none: the valley, neutral to every race (DECISIONS.md, 2026-10-22). */
export const HOME_WORLD = 'valley';

/** The map region that holds tile (x, y): the first of `map.regions` whose rectangle holds it, else none. */
export function regionAt(map: MapDef, x: number, y: number): NonNullable<MapDef['regions']>[number] | undefined {
  return map.regions?.find((r) => inRect(x, y, r));
}

/** The world under tile (x, y): its region's, else the map's, else the valley. A race's grade reads it. */
export function worldAt(map: MapDef, x: number, y: number): string {
  return regionAt(map, x, y)?.world ?? map.world ?? HOME_WORLD;
}

/**
 * The places tile (x, y) lies in (G63, G66): its map region, under the id `regionOf` gives it, then every
 * area slot with a label that holds it. A place is found by id, never by tile; ground in no region and in
 * no named area is no place.
 */
export function placesAt(map: MapDef, x: number, y: number): string[] {
  const region = regionAt(map, x, y);
  const out = region === undefined ? [] : [`${map.id}/${region.id}`];
  for (const slot of map.slots) if (slot.kind === 'area' && slot.label !== undefined && inRect(x, y, slot)) out.push(slot.id);
  return out;
}

/** The name a place shows on its first entry: an area's label, a region's title, else the region's id made readable. */
export function placeName(map: MapDef, id: string): string | undefined {
  const slot = findSlot(map, id);
  if (slot) return slot.kind === 'area' ? slot.label : undefined;
  const region = map.regions?.find((r) => `${map.id}/${r.id}` === id);
  if (!region) return undefined;
  if (region.title !== undefined) return region.title;
  const words = region.id.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
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
  const sources: { id: string; kind: Instance['kind']; slot: string; count: number; scattered?: boolean; water?: boolean }[] = [
    ...Object.keys(resources)
      .sort()
      .flatMap((id) => [
        { id, kind: 'resource' as const, slot: resources[id]!.place.slot, count: resources[id]!.count, water: resources[id]!.place.water === true },
        ...(resources[id]!.place.scatter ?? []).map((slot) => ({ id, kind: 'resource' as const, slot, count: 1, scattered: true })),
      ]),
    ...Object.keys(treasures)
      .sort()
      .map((id) => ({ id, kind: 'treasure' as const, slot: treasures[id]!.place.slot, count: treasures[id]!.count })),
  ];
  const made: Record<string, number> = {};
  for (const source of sources) {
    const slot = findSlot(map, source.slot);
    if (!slot) continue;
    const candidates: [number, number][] = [];
    for (let y = slot.y; y < slot.y + slot.h; y++) {
      for (let x = slot.x; x < slot.x + slot.w; x++) {
        const i = y * map.width + x;
        if (used.has(i)) continue;
        // a fishing spot lies on the water, beside land the player can stand on (DECISIONS.md, 2026-10-25: fishing)
        if (source.water) {
          if (tagAt(map, x, y) === 'water' && besideLand(map, solid, x, y)) candidates.push([x, y]);
        } else if ((source.scattered || (x + y) % 2 === 0) && !solid[i] && tagAt(map, x, y) !== 'path') candidates.push([x, y]);
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
      const n2 = (made[source.id] = (made[source.id] ?? 0) + 1) - 1;
      instances[`${source.id}#${n2}`] = { source: source.id, kind: source.kind, x, y };
    }
  }
  return instances;
}

/** Whether a tile has a land tile beside it, side by side, that is not solid. */
function besideLand(map: MapDef, solid: Uint8Array, x: number, y: number): boolean {
  return ([[0, -1], [1, 0], [0, 1], [-1, 0]] as const).some(([dx, dy]) => {
    const [nx, ny] = [x + dx, y + dy];
    return nx >= 0 && ny >= 0 && nx < map.width && ny < map.height && !solid[ny * map.width + nx] && tagAt(map, nx, ny) !== 'water';
  });
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
 * The exception is a solid node, a tree: it blocks grown or felled, so nobody
 * ever stands where it grows back.
 */
export function makeWalkable(bundle: Bundle): (x: number, y: number, view: WorldView) => boolean {
  const map = bundle.map;
  const solid = staticSolid(map);
  const blockers = new Set<number>();
  for (const id of Object.keys(bundle.npcs)) {
    const t = npcTile(bundle, id);
    if (t) blockers.add(t[1] * map.width + t[0]);
  }
  // a solid node (a tree) stays in the way, grown or a stump: the player never stands on its tile
  for (const inst of Object.values(bundle.instances)) {
    if (inst.kind === 'resource' && bundle.resources[inst.source]?.solid === true) blockers.add(inst.y * map.width + inst.x);
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

// ------------------------------------------------------------------ height (G68)

/** The most levels one step may climb or drop, crossing or not: more than this is a mountain band, never walked (STYLE section 6, G68). */
export const MAX_LEVEL_STEP = 3;

/** The level of tile (x, y): the digit of `map.levels` there, and 0 where the map has no height layer or no digit (STYLE section 6). */
export function levelAt(map: MapDef, x: number, y: number): number {
  const digit = map.levels?.[y]?.charCodeAt(x) ?? NaN;
  return digit >= 48 && digit <= 57 ? digit - 48 : 0;
}

/** Whether the map has a height layer at all. A map without one is flat and every step rule below is open. */
export function hasHeight(map: MapDef): boolean {
  return map.levels !== undefined;
}

/**
 * The one rule for a step between two four-adjacent tiles (G68), read by `step`, by `walkDistance` (the BFS of
 * G56) and by every tool that walks the map, so that reach, the difficulty reckoning and walking cannot disagree.
 * It judges height only; whether a tile can be stood on is `makeWalkable`'s.
 *
 * A step between tiles of the same level is open. A rock face blocks both ways: a step between levels is
 * refused unless one of its two ends is a crossing (a prop with `crossing: true`: stairs, a ramp, a lift). The
 * schema puts the crossing on the lower tile, facing the face, so walking up the crossing is the tile left and
 * walking down it is the tile entered: either end counts, or one direction would be shut. A change of more than
 * `MAX_LEVEL_STEP` levels is a mountain band and is never walked, crossing or not. A map with no height layer
 * answers true for every pair.
 */
export function makeStepRule(bundle: Bundle): (x1: number, y1: number, x2: number, y2: number) => boolean {
  const map = bundle.map;
  if (!hasHeight(map)) return () => true;
  const { width, height } = map;
  const crossing = new Uint8Array(width * height);
  for (const prop of map.props) {
    if (prop.crossing !== true) continue;
    for (let y = prop.y; y < prop.y + prop.h; y++) {
      for (let x = prop.x; x < prop.x + prop.w; x++) {
        if (x >= 0 && y >= 0 && x < width && y < height) crossing[y * width + x] = 1;
      }
    }
  }
  return (x1, y1, x2, y2) => {
    if (x1 < 0 || y1 < 0 || x2 < 0 || y2 < 0 || x1 >= width || x2 >= width || y1 >= height || y2 >= height) return true;
    const drop = Math.abs(levelAt(map, x1, y1) - levelAt(map, x2, y2));
    if (drop === 0) return true;
    if (drop > MAX_LEVEL_STEP) return false;
    return crossing[y1 * width + x1] === 1 || crossing[y2 * width + x2] === 1;
  };
}
