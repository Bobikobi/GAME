/**
 * The land below (the owner, 8.11): characters wander deep into the wood and find a hidden door that leads to a
 * map underground. Every door of a land opens into one cave system below it: a chamber per door, tunnels that
 * wind between the chambers (so a door is also a secret way across the land), side passages that end in a secret,
 * a pool in the widest chamber, and in every chamber the way back up. The caves are warps on the one world grid
 * (DECISIONS 2026-11-08): a door's `portal` names its arrival tile below, the way up names the tile before the
 * door. Rock is the mountain letter and the floor the ruin floor's until a cave set is drawn; the region below is
 * marked `underground`, so no sky is drawn over it. Integers only; every draw is keyed by its tile.
 */
import type { Seed } from '@game/kernel';
import { CHUNK_SIZE } from '../chunks';
import { G, Land, type Prop, SOLID, STEPS4, type Tile } from './grid';
import { fbm } from './noise';
import { route } from './paths';
import { at, chance, choose, pick } from './rand';
import type { StoryDef } from './story';
import { type DoorForm, type Looks, fits, piece } from './looks';


/** A hidden door on the surface, as the land placed it: its form, its tile, and the tile a player stands on coming back up. */
export interface Door {
  n: number;
  form: DoorForm;
  x: number;
  y: number;
  step: Tile;
}

export interface BelowMeasure {
  floor: number;
  unreachable: number;
  chambers: number;
  /** Floor tiles outside every chamber. */
  tunnels: number;
  secrets: number;
  pool: boolean;
  /** The longest side passage, in tiles. */
  deadEnd: number;
  /** Walking steps between the two farthest arrivals, so a door is a way across the land. */
  span: number;
}

export interface Below {
  land: Land;
  /** The way up of each door, in door order: the tile its arch stands on. */
  arrivals: Tile[];
  /** Where each door lands the player: the floor tile beside its way up, so no portal lands on another. */
  steps: Tile[];
  measure: BelowMeasure;
}

/** The frame of the land below: a strip one chunk high at the story's `below` chunk, a chunk wide per door up to the land's width. */
export function belowFrame(story: StoryDef, doors: number): { x0: number; y0: number; w: number; h: number } | undefined {
  if (!story.below || doors === 0) return undefined;
  const chunks = Math.max(1, Math.min(story.size.w, doors));
  return { x0: story.below.cx * CHUNK_SIZE, y0: story.below.cy * CHUNK_SIZE, w: chunks * CHUNK_SIZE, h: CHUNK_SIZE };
}

const name = (story: StoryDef) => story.id.split('/')[1]!;
const inMargin = (land: Land, x: number, y: number) => x > land.x0 && y > land.y0 && x < land.x0 + land.w - 1 && y < land.y0 + land.h - 1;

/** The caves under a land, or nothing when the story names no `below` or the land placed no door. */
export function carveBelow(seed: Seed, story: StoryDef, doors: readonly Door[], looks: Looks): Below | undefined {
  const frame = belowFrame(story, doors.length);
  if (!frame) return undefined;
  const land = new Land(frame.x0, frame.y0, frame.w, frame.h);
  for (let i = 0; i < land.h; i++) land.ground[i] = G.mountain.repeat(land.w);
  const rooms = chambers(seed, land, doors.length);
  tunnels(seed, land, rooms);
  const secrets = sidePassages(seed, land, rooms, looks);
  const { arrivals, steps } = waysUp(seed, land, story, doors, rooms, looks);
  const pool = poolIn(seed, land, rooms, arrivals);
  dress(seed, land, rooms, arrivals, looks);
  const unreachable = reachAll(land, arrivals);
  return { land, arrivals, steps, measure: measureBelow(land, rooms, secrets, pool, arrivals, unreachable) };
}

// ---------------------------------------------------------------- chambers

interface Room {
  centre: Tile;
  tiles: Set<number>;
}

/** One chamber per door, spaced along the strip, each an irregular blob of floor cut by noise around its centre. */
function chambers(seed: Seed, land: Land, count: number): Room[] {
  const rooms: Room[] = [];
  for (let i = 0; i < count; i++) {
    const cx = land.x0 + 12 + Math.floor(((land.w - 24) * (2 * i + 1)) / (2 * count)) + pick(seed, `room:${i}`, 0, 9) - 4;
    const cy = land.y0 + 14 + pick(seed, `room:${i}`, 1, 37);
    const r = 5 + pick(seed, `room:${i}`, 2, 5);
    const tiles = new Set<number>();
    for (let dy = -r - 2; dy <= r + 2; dy++) {
      for (let dx = -r - 2; dx <= r + 2; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (!inMargin(land, x, y)) continue;
        const d = Math.floor(((dx * dx + dy * dy) * 1000) / (r * r));
        const n = fbm(seed, 'cave', x, y, [6, 3], [2, 1]);
        if (d + Math.floor((n - 32768) / 50) < 1000) {
          land.set(x, y, G.ruinFloor);
          tiles.add(land.key(x, y));
        }
      }
    }
    land.set(cx, cy, G.ruinFloor);
    tiles.add(land.key(cx, cy));
    land.marks.push({ kind: 'chamber', x: cx, y: cy, label: `chamber ${i}` });
    rooms.push({ centre: [cx, cy], tiles });
  }
  return rooms;
}

/** The cost of a tunnel through the rock: cheap along floor, dearer through rock and dearest where the noise is high, so a tunnel winds. */
function tunnelCost(seed: Seed, land: Land, floorCost: number) {
  return (x: number, y: number): number => {
    if (!inMargin(land, x, y)) return -1;
    if (land.get(x, y) !== G.mountain) return floorCost;
    return 3 + Math.floor((fbm(seed, 'tunnel', x, y, [5, 2], [2, 1]) * 6) / 65536);
  };
}

/** A tile of rock becomes floor; the chamber sets stay as they are, so the measure can tell tunnels apart. */
function carve(land: Land, tiles: readonly Tile[]): void {
  for (const [x, y] of tiles) if (inMargin(land, x, y) && land.get(x, y) === G.mountain) land.set(x, y, G.ruinFloor);
}

/** Tunnels from each chamber to the next, widened here and there, and one loop where three or more chambers allow it. */
function tunnels(seed: Seed, land: Land, rooms: Room[]): void {
  const dig = (a: Tile, b: Tile, floorCost: number, tag: string) => {
    const way = route(land, a, b, tunnelCost(seed, land, floorCost));
    if (!way) return;
    carve(land, way);
    for (let i = 1; i < way.length - 1; i++) {
      const [x, y] = way[i]!;
      if (!chance(seed, tag, at(x, y), 300)) continue;
      const [px, py] = way[i - 1]!;
      const side: Tile = x === px ? [x + (chance(seed, `${tag}:side`, at(x, y), 500) ? 1 : -1), y] : [x, y + (chance(seed, `${tag}:side`, at(x, y), 500) ? 1 : -1)];
      void py;
      carve(land, [side]);
    }
  };
  for (let i = 1; i < rooms.length; i++) dig(rooms[i - 1]!.centre, rooms[i]!.centre, 1, `widen:${i}`);
  if (rooms.length >= 3) dig(rooms[0]!.centre, rooms[rooms.length - 1]!.centre, 4, 'widen:loop');
}

/** From every chamber one passage into the rock, away from the strip's middle, that ends in a secret (bones, old timber). */
function sidePassages(seed: Seed, land: Land, rooms: Room[], looks: Looks): Tile[] {
  const ends: Tile[] = [];
  const midY = land.y0 + (land.h >> 1);
  rooms.forEach((room, i) => {
    const up = room.centre[1] < midY;
    let start: Tile = room.centre;
    for (const k of room.tiles) {
      const t: Tile = [(k % land.w) + land.x0, Math.floor(k / land.w) + land.y0];
      if (up ? t[1] < start[1] : t[1] > start[1]) start = t;
    }
    const reach = 8 + pick(seed, `secret:${i}`, 0, 9);
    const tx = Math.max(land.x0 + 2, Math.min(land.x0 + land.w - 3, start[0] + pick(seed, `secret:${i}`, 1, 21) - 10));
    const ty = Math.max(land.y0 + 2, Math.min(land.y0 + land.h - 3, start[1] + (up ? -reach : reach)));
    const way = route(land, start, [tx, ty], tunnelCost(seed, land, 1));
    if (!way || way.length < 4) return;
    carve(land, way);
    const end = way[way.length - 1]!;
    land.addProp(piece(looks, choose(seed, `secret:${i}`, 2, [looks.below.bones, looks.below.timber]), end[0], end[1], { solid: false }));
    land.marks.push({ kind: 'secret', x: end[0], y: end[1], label: `secret ${i}` });
    ends.push(end);
  });
  return ends;
}

// ---------------------------------------------------------------- the ways up and the water

/** How many of the four neighbours a foot can stand on. */
function openAround(land: Land, x: number, y: number): number {
  let n = 0;
  for (const [dx, dy] of STEPS4) if (land.walkable(x + dx, y + dy)) n++;
  return n;
}

/**
 * In each chamber the way back up, on the open floor tile nearest its centre: an arch whose portal is the tile
 * before the door. The door's own portal is the floor tile beside the arch nearest the centre (the step), so a
 * player lands next to a way, never on one: the kernel takes one way per step and never chains them.
 */
function waysUp(seed: Seed, land: Land, story: StoryDef, doors: readonly Door[], rooms: Room[], looks: Looks): { arrivals: Tile[]; steps: Tile[] } {
  const arrivals: Tile[] = [];
  const steps: Tile[] = [];
  doors.forEach((door, i) => {
    const room = rooms[i]!;
    let best: Tile = room.centre;
    let score = -1;
    for (const k of room.tiles) {
      const t: Tile = [(k % land.w) + land.x0, Math.floor(k / land.w) + land.y0];
      if (land.get(t[0], t[1]) !== G.ruinFloor || openAround(land, t[0], t[1]) < 3) continue;
      const d = Math.abs(t[0] - room.centre[0]) + Math.abs(t[1] - room.centre[1]);
      const s = 1000 - d * 10 + pick(seed, `arrival:${i}`, at(t[0], t[1]), 10);
      if (s > score) [score, best] = [s, t];
    }
    land.addProp(piece(looks, looks.below.way_up, best[0], best[1], { solid: false, id: `core/${name(story)}-up-${door.n}`, portal: { x: door.step[0], y: door.step[1] } } as Partial<Prop>));
    land.marks.push({ kind: 'arrival', x: best[0], y: best[1], label: `up to door ${door.n} (${door.form})` });
    arrivals.push(best);
    let step: Tile = best;
    let near = Infinity;
    for (const [dx, dy] of STEPS4) {
      const t: Tile = [best[0] + dx, best[1] + dy];
      if (land.get(t[0], t[1]) !== G.ruinFloor) continue;
      const d = Math.abs(t[0] - room.centre[0]) + Math.abs(t[1] - room.centre[1]);
      if (d < near) [near, step] = [d, t];
    }
    steps.push(step);
  });
  return { arrivals, steps };
}

/** A pool in the widest chamber, off its arrival: water ringed with a wet bank. Reverted when it would cut the chamber. */
function poolIn(seed: Seed, land: Land, rooms: Room[], arrivals: readonly Tile[]): boolean {
  const room = rooms.reduce((a, b) => (b.tiles.size > a.tiles.size ? b : a));
  const i = rooms.indexOf(room);
  const [cx, cy] = room.centre;
  const px = cx + pick(seed, `pool:${i}`, 0, 7) - 3;
  const py = cy + pick(seed, `pool:${i}`, 1, 7) - 3;
  const r = 2 + pick(seed, `pool:${i}`, 2, 2);
  const before = new Map<number, string>();
  for (let dy = -r - 1; dy <= r + 1; dy++) {
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const x = px + dx;
      const y = py + dy;
      if (!inMargin(land, x, y) || land.get(x, y) !== G.ruinFloor || arrivals.some(([ax, ay]) => Math.abs(ax - x) <= 1 && Math.abs(ay - y) <= 1)) continue;
      const d = dx * dx + dy * dy;
      if (d > (r + 1) * (r + 1)) continue;
      before.set(land.key(x, y), land.get(x, y));
      land.clearProps(x, y);
      land.set(x, y, d <= r * r ? G.water : G.bank);
    }
  }
  if (before.size < 4 || lost(land, arrivals) > 0) {
    for (const [k, ch] of before) land.set((k % land.w) + land.x0, Math.floor(k / land.w) + land.y0, ch);
    return false;
  }
  land.marks.push({ kind: 'pool', x: px, y: py, label: 'pool' });
  return true;
}

// ---------------------------------------------------------------- dressing and reach

/** Stones along the walls, glowing mushrooms by the ways up and in the chambers, a pillar where a chamber is wide. */
function dress(seed: Seed, land: Land, rooms: Room[], arrivals: readonly Tile[], looks: Looks): void {
  const inRoom = new Set<number>();
  for (const room of rooms) for (const k of room.tiles) inRoom.add(k);
  for (let y = land.y0 + 1; y < land.y0 + land.h - 1; y++) {
    for (let x = land.x0 + 1; x < land.x0 + land.w - 1; x++) {
      if (land.get(x, y) !== G.ruinFloor || land.propAt(x, y)) continue;
      const floor = (tx: number, ty: number) => land.get(tx, ty) === G.ruinFloor;
      const put = (sprite: string, solid: boolean) => {
        if (fits(looks, land, sprite, x, y, floor)) land.addProp(piece(looks, sprite, x, y, { solid }));
      };
      const nearUp = arrivals.some(([ax, ay]) => Math.abs(ax - x) <= 3 && Math.abs(ay - y) <= 3);
      const onUp = arrivals.some(([ax, ay]) => Math.abs(ax - x) <= 1 && Math.abs(ay - y) <= 1);
      if (onUp) continue;
      const open = openAround(land, x, y);
      let rock = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (land.get(x + dx, y + dy) === G.mountain) rock++;
      if (nearUp && chance(seed, 'glow-up', at(x, y), 220)) put(looks.below.glow, false);
      else if (rock > 0 && chance(seed, 'stones', at(x, y), 110)) put(choose(seed, 'stones', at(x, y), looks.below.stones), false);
      else if (inRoom.has(land.key(x, y)) && rock === 0 && open === 4 && chance(seed, 'pillar', at(x, y), 35)) put(looks.below.pillar, true);
      else if (inRoom.has(land.key(x, y)) && chance(seed, 'glow', at(x, y), 45)) put(looks.below.glow, false);
    }
  }
}

/** Floor tiles a foot can stand on that no arrival reaches. */
function lost(land: Land, arrivals: readonly Tile[]): number {
  const dist = land.distances(arrivals);
  let n = 0;
  for (let y = land.y0; y < land.y0 + land.h; y++) for (let x = land.x0; x < land.x0 + land.w; x++) if (land.walkable(x, y) && dist[land.key(x, y)] === -1) n++;
  return n;
}

/** Every floor tile is reached from the arrivals: a pocket a pillar or the pool cut off gets a way carved to the nearest reached tile. */
function reachAll(land: Land, arrivals: readonly Tile[]): number {
  for (let round = 0; round < 40; round++) {
    const dist = land.distances(arrivals);
    let from: Tile | undefined;
    for (let y = land.y0; y < land.y0 + land.h && !from; y++) for (let x = land.x0; x < land.x0 + land.w; x++) if (land.walkable(x, y) && dist[land.key(x, y)] === -1) [from] = [[x, y] as Tile];
    if (!from) return 0;
    let to: Tile | undefined;
    let bestD = 1 << 30;
    for (let y = land.y0; y < land.y0 + land.h; y++) {
      for (let x = land.x0; x < land.x0 + land.w; x++) {
        if (dist[land.key(x, y)] === -1) continue;
        const d = Math.abs(x - from[0]) + Math.abs(y - from[1]);
        if (d < bestD) [bestD, to] = [d, [x, y]];
      }
    }
    if (!to) return lost(land, arrivals);
    const way = route(land, from, to, (x, y) => (inMargin(land, x, y) ? (land.get(x, y) === G.mountain ? 2 : SOLID.has(land.get(x, y)) ? 6 : 1) : -1));
    if (!way) return lost(land, arrivals);
    for (const [x, y] of way) {
      land.clearProps(x, y);
      if (land.get(x, y) !== G.ruinFloor) land.set(x, y, G.ruinFloor);
    }
  }
  return lost(land, arrivals);
}

function measureBelow(land: Land, rooms: Room[], secrets: readonly Tile[], pool: boolean, arrivals: readonly Tile[], unreachable: number): BelowMeasure {
  const inRoom = new Set<number>();
  for (const room of rooms) for (const k of room.tiles) inRoom.add(k);
  let floor = 0;
  let tunnelTiles = 0;
  for (let y = land.y0; y < land.y0 + land.h; y++) {
    for (let x = land.x0; x < land.x0 + land.w; x++) {
      if (land.get(x, y) !== G.ruinFloor) continue;
      floor++;
      if (!inRoom.has(land.key(x, y))) tunnelTiles++;
    }
  }
  let span = 0;
  for (const a of arrivals) {
    const dist = land.distances([a]);
    for (const b of arrivals) span = Math.max(span, dist[land.key(b[0], b[1])]!);
  }
  let deadEnd = 0;
  for (const s of secrets) {
    const dist = land.distances([s]);
    let nearest = 1 << 30;
    for (const room of rooms) for (const k of room.tiles) if (dist[k]! >= 0) nearest = Math.min(nearest, dist[k]!);
    if (nearest < 1 << 30) deadEnd = Math.max(deadEnd, nearest);
  }
  return { floor, unreachable, chambers: rooms.length, tunnels: tunnelTiles, secrets: secrets.length, pool, deadEnd, span };
}
