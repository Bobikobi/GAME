/**
 * Where things are. The kernel and the client share these functions, so the
 * tile a player can stand on and the tile the kernel accepts are the same.
 */
import type { Bundle, Instance, MapDef, ResourceDef, TreasureDef } from './bundle';
import { idiv, mulDiv } from './num';

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
  const sources: { id: string; kind: Instance['kind']; slot: string; count: number; scattered?: boolean }[] = [
    ...Object.keys(resources)
      .sort()
      .flatMap((id) => [
        { id, kind: 'resource' as const, slot: resources[id]!.place.slot, count: resources[id]!.count },
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
        if ((source.scattered || (x + y) % 2 === 0) && !solid[i] && !used.has(i) && tagAt(map, x, y) !== 'path') candidates.push([x, y]);
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

/** The tile an NPC calls home: the centre of its slot. */
export function npcHome(bundle: Bundle, npcId: string): [number, number] | undefined {
  const npc = bundle.npcs[npcId];
  const slot = npc && findSlot(bundle.map, npc.place.slot);
  return slot ? centerOf(slot) : undefined;
}

/**
 * Tile an NPC stands on at a game tick: at home, or on the leg of its round whose hours hold the tick
 * (decision 27 of 22.10: a ranger who walks the edges by day), from the first dawn on: the waking day's
 * first meeting finds the keeper at home. Without a tick, home: the tile a map
 * check or a placement reads.
 */
export function npcTile(bundle: Bundle, npcId: string, tick?: number): [number, number] | undefined {
  const home = npcHome(bundle, npcId);
  if (home === undefined || tick === undefined) return home;
  const leg = roundLeg(bundle, npcId, tick);
  if (leg === undefined) return home;
  const walk = roundWalk(bundle, npcId, leg.index);
  const steps = walk.length - 1;
  if (steps <= 0) return home;
  const at = walk[Math.min(steps, mulDiv(leg.into, steps, leg.span))]!;
  return [at[0], at[1]];
}

/** Whether an NPC stands at home at a game tick: it has no round, or no leg of the round holds the tick. */
export function npcAtHome(bundle: Bundle, npcId: string, tick: number): boolean {
  return roundLeg(bundle, npcId, tick) === undefined;
}

/** The leg of an NPC's round that holds this tick: its index, how far into the leg the tick is and how long the leg runs, in game ms. */
function roundLeg(bundle: Bundle, npcId: string, tick: number): { index: number; into: number; span: number } | undefined {
  const round = bundle.npcs[npcId]?.round;
  if (round === undefined || !Number.isSafeInteger(tick)) return undefined;
  const day = bundle.params.day_length_ms;
  // the day the player wakes he keeps to his post: the rounds begin with the first dawn (tick 0 is noon)
  if (tick < idiv(day, 2) + mulDiv(5, day, 24)) return undefined;
  // the ms since midnight (state.ts, hourOf)
  const phase = (((tick + idiv(day, 2)) % day) + day) % day;
  for (let index = 0; index < round.length; index++) {
    const [from, to] = round[index]!.hours;
    const start = mulDiv(from, day, 24);
    const end = mulDiv(to, day, 24);
    if (end > start && phase >= start && phase < end) return { index, into: phase - start, span: end - start };
  }
  return undefined;
}

const walkCache = new WeakMap<Bundle, Map<string, readonly (readonly [number, number])[]>>();

/**
 * The tiles of one leg of a round, home to home: a four-way walk from home through each via tile in order,
 * then back the same way. Walked on the ground and the props that never change, with every mend that opens
 * a way made: the keeper of the valley knows the ford. A via tile no walk reaches is stepped to straight.
 */
export function roundWalk(bundle: Bundle, npcId: string, leg: number): readonly (readonly [number, number])[] {
  let byNpc = walkCache.get(bundle);
  if (byNpc === undefined) walkCache.set(bundle, (byNpc = new Map()));
  const key = `${npcId}#${leg}`;
  const cached = byNpc.get(key);
  if (cached !== undefined) return cached;
  const home = npcHome(bundle, npcId);
  const via = bundle.npcs[npcId]?.round?.[leg]?.via ?? [];
  if (home === undefined) return [];
  const open = openGround(bundle);
  const out: [number, number][] = [home];
  for (const target of via) {
    const from = out[out.length - 1]!;
    out.push(...pathBetween(bundle.map, open, from, [target[0], target[1]]));
  }
  const back = out.slice(0, -1).reverse();
  const walk = [...out, ...back];
  byNpc.set(key, walk);
  return walk;
}

/** The ground a walker crosses: not solid, or inside a passable mend (a bridge). */
function openGround(bundle: Bundle): Uint8Array {
  const map = bundle.map;
  const solid = staticSolid(map);
  const open = new Uint8Array(solid.length);
  for (let i = 0; i < solid.length; i++) open[i] = solid[i] ? 0 : 1;
  for (const r of Object.values(bundle.restores)) {
    if (!r.passable) continue;
    const slot = findSlot(map, r.place.slot);
    if (!slot) continue;
    for (let y = slot.y; y < slot.y + slot.h; y++) for (let x = slot.x; x < slot.x + slot.w; x++) open[y * map.width + x] = 1;
  }
  return open;
}

/** The tiles after `from` up to and including `to`: a shortest four-way walk over open ground, else straight steps. */
function pathBetween(map: MapDef, open: Uint8Array, from: readonly [number, number], to: readonly [number, number]): [number, number][] {
  if (from[0] === to[0] && from[1] === to[1]) return [];
  const w = map.width;
  const size = w * map.height;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < map.height;
  const goal = to[1] * w + to[0];
  const start = from[1] * w + from[0];
  if (inside(to[0], to[1]) && inside(from[0], from[1])) {
    const prev = new Int32Array(size).fill(-1);
    prev[start] = start;
    const queue = [start];
    for (let head = 0; head < queue.length && prev[goal] === -1; head++) {
      const i = queue[head]!;
      const x = i % w;
      const y = idiv(i, w);
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inside(nx, ny)) continue;
        const n = ny * w + nx;
        if (prev[n] !== -1 || (!open[n] && n !== goal)) continue;
        prev[n] = i;
        queue.push(n);
      }
    }
    if (prev[goal] !== -1) {
      const path: [number, number][] = [];
      for (let i = goal; i !== start; i = prev[i]!) path.push([i % w, idiv(i, w)]);
      return path.reverse();
    }
  }
  const path: [number, number][] = [];
  let [x, y] = from;
  while (x !== to[0]) path.push([(x += Math.sign(to[0] - x)), y]);
  while (y !== to[1]) path.push([x, (y += Math.sign(to[1] - y))]);
  return path;
}

/**
 * Whether a fire a character keeps burns at this tick (the owner, 23.10: Maru's hearth): from its hour while
 * the keeper is home, through the night, until the keeper leaves on the round. Not the player's fire: its
 * wood, its vigil and its safety stay the player's own (G48).
 */
export function keptFireLit(bundle: Bundle, propId: string, tick: number): boolean {
  const kept = bundle.map.props.find((p) => p.id === propId)?.kept;
  if (kept === undefined || bundle.npcs[kept.by] === undefined) return false;
  const day = bundle.params.day_length_ms;
  const phase = (((tick + idiv(day, 2)) % day) + day) % day;
  // lit from its hour to midnight, and on from midnight until the keeper leaves home
  const evening = phase >= mulDiv(kept.from, day, 24);
  const morning = phase < idiv(day, 2);
  return (evening || morning) && npcAtHome(bundle, kept.by, tick);
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
