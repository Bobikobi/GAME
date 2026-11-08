/**
 * The generator (the owner, 8.11): a story in, a land out. Relief from one noise field cut into terraces, lakes
 * and streams from a second, wood from a third with glades cut out of it, roads that wind in from the story's
 * sides to a clearing, small ruins off the roads, and cave mouths hidden where the wood is deepest. Every tile a
 * foot can stand on is reached from the roads (a pocket nothing leads into is filled, a larger one is joined by
 * a carved way with a crossing where the level changes, G68). The hidden doors come last, each a different form
 * with its own hint, and lead down to the land below (below.ts). Integers only; every draw is keyed by its tile, so
 * the same story and seed give the same land on every machine.
 *
 * Which picture stands where, and how much ground it takes, is the looks table (looks.ts, tools/gen/looks.json):
 * a burnt tree is the dead tree until one is drawn, bones are stones, a cave mouth is a ruin arch. The story says
 * which world; the world says which set. A piece stands only where its whole footprint fits, inside one chunk.
 */
import type { Seed } from '@game/kernel';
import { CHUNK_SIZE } from '../chunks';
import { G, Land, SOLID, STEPS4, type Tile } from './grid';
import { DOOR_FORMS, type DoorForm, type Looks, fits, footprint, looksOf, oneChunk, piece, pieceOf } from './looks';
import { fbm, valueNoise } from './noise';
import { longestRuns, repair, route, wind } from './paths';
import { at, chance, choose, pick, storySeed } from './rand';
import { type Below, type Door, carveBelow } from './below';
import type { Side, StoryDef } from './story';


export interface Measure {
  tiles: Record<string, number>;
  walkable: number;
  unreachable: number;
  roads: number;
  longestRun: number;
  longestBridgeRun: number;
  cavesAsked: number;
  caves: number;
  /** The form of every door placed, in order. */
  doorForms: string[];
  /** The share of wood (forest and grove) per 16 by 16 block, in percent: the least and the most. */
  woodSpread: [number, number];
  farthestSteps: number;
  treeKinds: number;
  crossings: number;
}

export interface Generated {
  story: StoryDef;
  seed: Seed;
  land: Land;
  entries: Tile[];
  /** The hidden doors, in order; each a portal down when the story names a land below. */
  doors: Door[];
  below?: Below;
  measure: Measure;
}

const name = (story: StoryDef) => story.id.split('/')[1]!;

export function generate(story: StoryDef, looks: Looks = looksOf()): Generated {
  const seed = storySeed(story.seed);
  const land = new Land(story.origin.cx * CHUNK_SIZE, story.origin.cy * CHUNK_SIZE, story.size.w * CHUNK_SIZE, story.size.h * CHUNK_SIZE);
  const entries = entryTiles(seed, land, story.entries);
  relief(seed, land, story, entries);
  water(seed, land, story, entries);
  wood(seed, land, story, entries);
  const hub = clearing(seed, land, entries, looks);
  roads(seed, land, entries, hub, looks);
  ruins(seed, land, story, entries, looks);
  trees(seed, land, story, looks);
  const placed = doors(seed, land, story, entries, looks);
  connect(land, entries, looks);
  const below = carveBelow(seed, story, placed, looks);
  if (below) {
    placed.forEach((d, i) => {
      const door = land.props.find((q) => q.id === doorId(story, d.n));
      const [sx, sy] = below.steps[i]!;
      if (door) door.portal = { x: sx, y: sy };
    });
  }
  return { story, seed, land, entries, doors: placed, below, measure: measure(land, story, entries, looks) };
}

// ---------------------------------------------------------------- the frame

function entryTiles(seed: Seed, land: Land, sides: readonly Side[]): Tile[] {
  return sides.map((side, i) => {
    const jitter = pick(seed, `entry:${side}`, i, Math.floor(land.w / 2)) - Math.floor(land.w / 4);
    switch (side) {
      case 'n':
        return [land.x0 + Math.floor(land.w / 2) + jitter, land.y0];
      case 's':
        return [land.x0 + Math.floor(land.w / 2) + jitter, land.y0 + land.h - 1];
      case 'w':
        return [land.x0, land.y0 + Math.floor(land.h / 2) + jitter];
      default:
        return [land.x0 + land.w - 1, land.y0 + Math.floor(land.h / 2) + jitter];
    }
  });
}

const near = (tiles: readonly Tile[], x: number, y: number, r: number) => tiles.some(([tx, ty]) => Math.max(Math.abs(tx - x), Math.abs(ty - y)) <= r);

// ---------------------------------------------------------------- relief

function relief(seed: Seed, land: Land, story: StoryDef, entries: readonly Tile[]): void {
  // the story's relief is a share of the land: how much of it rises to the first terrace, the second, the rock
  const r = story.relief;
  const heights = new Uint16Array(land.w * land.h);
  for (let y = land.y0; y < land.y0 + land.h; y++) {
    for (let x = land.x0; x < land.x0 + land.w; x++) heights[land.key(x, y)] = fbm(seed, 'height', x, y, [32, 16, 8], [4, 2, 1]);
  }
  const cut1 = quantile(heights, 1000 - r * 6);
  const cut2 = quantile(heights, 1000 - Math.floor(r * 3.5));
  const cut3 = quantile(heights, 1000 - Math.floor(r * 1.2));
  for (let y = land.y0; y < land.y0 + land.h; y++) {
    for (let x = land.x0; x < land.x0 + land.w; x++) {
      const h = heights[land.key(x, y)]!;
      let lv = r === 0 || h < cut1 ? 0 : h < cut2 ? 1 : h < cut3 ? 2 : 3 + Math.floor(((h - cut3) * 5) / Math.max(1, 65536 - cut3));
      if (near(entries, x, y, 6)) lv = 0;
      land.setLevel(x, y, Math.min(7, lv));
    }
  }
  // a majority of the nine round each tile, twice: no one-tile steps
  for (let pass = 0; pass < 2; pass++) {
    const next = new Uint8Array(land.levels);
    for (let y = land.y0; y < land.y0 + land.h; y++) {
      for (let x = land.x0; x < land.x0 + land.w; x++) {
        const count = new Map<number, number>();
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!land.inside(x + dx, y + dy)) continue;
            const l = Math.min(3, land.level(x + dx, y + dy));
            count.set(l, (count.get(l) ?? 0) + 1);
          }
        }
        const own = Math.min(3, land.level(x, y));
        let best = own;
        let n = count.get(own) ?? 0;
        for (const [l, c] of count) if (c > n) [best, n] = [l, c];
        if (best !== own) next[land.key(x, y)] = best;
      }
    }
    land.levels.set(next);
  }
  // islands of one level under 16 tiles join the level most of their rim stands on
  const seen = new Uint8Array(land.w * land.h);
  for (let y = land.y0; y < land.y0 + land.h; y++) {
    for (let x = land.x0; x < land.x0 + land.w; x++) {
      if (seen[land.key(x, y)]) continue;
      const lv = Math.min(3, land.level(x, y));
      const comp: Tile[] = [[x, y]];
      seen[land.key(x, y)] = 1;
      const rim = new Map<number, number>();
      for (let i = 0; i < comp.length; i++) {
        const [cx, cy] = comp[i]!;
        for (const [dx, dy] of STEPS4) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (!land.inside(nx, ny)) continue;
          const nl = Math.min(3, land.level(nx, ny));
          if (nl !== lv) rim.set(nl, (rim.get(nl) ?? 0) + 1);
          else if (!seen[land.key(nx, ny)]) {
            seen[land.key(nx, ny)] = 1;
            comp.push([nx, ny]);
          }
        }
      }
      if (comp.length < 16 && rim.size > 0) {
        let best = lv;
        let n = -1;
        for (const [l, c] of rim) if (c > n) [best, n] = [l, c];
        for (const [cx, cy] of comp) land.setLevel(cx, cy, best);
      }
    }
  }
  // rock where the ground rises past the terraces
  for (let y = land.y0; y < land.y0 + land.h; y++) {
    for (let x = land.x0; x < land.x0 + land.w; x++) {
      if (land.level(x, y) >= 3) land.set(x, y, G.mountain);
    }
  }
}

// ---------------------------------------------------------------- water

function water(seed: Seed, land: Land, story: StoryDef, entries: readonly Tile[]): void {
  const w = story.water;
  if (w === 0) return;
  // lakes take a share of the flat ground: the story's water, in permille of the level-0 tiles, tenth by tenth
  const moist: number[] = [];
  for (let y = land.y0; y < land.y0 + land.h; y++) {
    for (let x = land.x0; x < land.x0 + land.w; x++) if (land.level(x, y) === 0) moist.push(fbm(seed, 'moist', x, y, [24, 12], [3, 1]));
  }
  const lakeCut = quantile(Uint16Array.from(moist), 1000 - Math.floor(w * 0.9));
  for (let y = land.y0; y < land.y0 + land.h; y++) {
    for (let x = land.x0; x < land.x0 + land.w; x++) {
      if (land.level(x, y) !== 0 || near(entries, x, y, 7)) continue;
      if (fbm(seed, 'moist', x, y, [24, 12], [3, 1]) > lakeCut) land.set(x, y, G.water);
    }
  }
  // puddles under 8 tiles dry up
  for (const comp of components(land, (x, y) => land.get(x, y) === G.water)) {
    if (comp.length < 8) for (const [x, y] of comp) land.set(x, y, G.meadow);
    else {
      const [cx, cy] = comp[Math.floor(comp.length / 2)]!;
      land.marks.push({ kind: 'lake', x: cx, y: cy, label: 'lake' });
    }
  }
  // streams: from a high place down to a lake or the edge
  const streams = w >= 30 ? 1 + Math.floor(w / 50) : 0;
  for (let s = 0; s < streams; s++) {
    let source: Tile | undefined;
    let best = -1;
    for (let y = land.y0 + 4; y < land.y0 + land.h - 4; y += 3) {
      for (let x = land.x0 + 4; x < land.x0 + land.w - 4; x += 3) {
        if (land.level(x, y) < 2 || near(entries, x, y, 12)) continue;
        const h = fbm(seed, 'height', x, y, [32, 16, 8], [4, 2, 1]) + pick(seed, `spring:${s}`, at(x, y), 20000);
        if (h > best) [best, source] = [h, [x, y]];
      }
    }
    if (!source) break;
    land.marks.push({ kind: 'spring', x: source[0], y: source[1], label: 'spring' });
    const visited = new Set<number>([land.key(source[0], source[1])]);
    let [x, y] = source;
    const stream: Tile[] = [[x, y]];
    for (let step = 0; step < 400; step++) {
      let next: Tile | undefined;
      let low = 0x7fffffff;
      for (const [dx, dy] of STEPS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (!land.inside(nx, ny) || visited.has(land.key(nx, ny))) continue;
        const h = fbm(seed, 'height', nx, ny, [32, 16, 8], [4, 2, 1]) + land.level(nx, ny) * 20000 + pick(seed, `stream:${s}`, at(nx, ny), 6000);
        if (h < low) [low, next] = [h, [nx, ny]];
      }
      if (!next) break;
      [x, y] = next;
      visited.add(land.key(x, y));
      if (land.get(x, y) === G.water) break;
      stream.push([x, y]);
      if (x === land.x0 || y === land.y0 || x === land.x0 + land.w - 1 || y === land.y0 + land.h - 1) break;
    }
    if (stream.length < 20) {
      land.marks.pop();
      continue;
    }
    for (const [sx, sy] of stream) land.set(sx, sy, G.water);
  }
  // a bank of sand along the water on the flat
  for (let y = land.y0; y < land.y0 + land.h; y++) {
    for (let x = land.x0; x < land.x0 + land.w; x++) {
      if (land.get(x, y) !== G.meadow || land.level(x, y) !== 0) continue;
      let wet = false;
      for (let dy = -1; dy <= 1 && !wet; dy++) for (let dx = -1; dx <= 1 && !wet; dx++) wet = land.inside(x + dx, y + dy) && land.get(x + dx, y + dy) === G.water;
      if (wet) land.set(x, y, G.bank);
    }
  }
}

/** The value below which the given permille of the values lie (the share's cut), integer, by a sort of a copy. */
function quantile(values: Uint16Array, permille: number): number {
  if (values.length === 0) return 65535;
  const sorted = Uint16Array.from(values).sort();
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length * Math.min(1000, Math.max(0, permille))) / 1000)));
  return sorted[i]!;
}

/** The four-way components of the tiles a test picks out, in scan order. */
function components(land: Land, test: (x: number, y: number) => boolean): Tile[][] {
  const seen = new Uint8Array(land.w * land.h);
  const out: Tile[][] = [];
  for (let y = land.y0; y < land.y0 + land.h; y++) {
    for (let x = land.x0; x < land.x0 + land.w; x++) {
      if (seen[land.key(x, y)] || !test(x, y)) continue;
      const comp: Tile[] = [[x, y]];
      seen[land.key(x, y)] = 1;
      for (let i = 0; i < comp.length; i++) {
        const [cx, cy] = comp[i]!;
        for (const [dx, dy] of STEPS4) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (!land.inside(nx, ny) || seen[land.key(nx, ny)] || !test(nx, ny)) continue;
          seen[land.key(nx, ny)] = 1;
          comp.push([nx, ny]);
        }
      }
      out.push(comp);
    }
  }
  return out;
}

// ---------------------------------------------------------------- wood

function wood(seed: Seed, land: Land, story: StoryDef, entries: readonly Tile[]): void {
  const f = story.forest;
  if (f === 0) return;
  // the story's forest is a share of the open ground: the densest part a wall of trees, the next a grove
  const density = (x: number, y: number) => {
    const glade = valueNoise(seed, 'glade', x, y, 48);
    return fbm(seed, 'wood', x, y, [20, 10, 5], [3, 2, 1]) - (glade > 40000 ? Math.floor((glade - 40000) / 2) : 0);
  };
  const all: number[] = [];
  for (let y = land.y0; y < land.y0 + land.h; y++) {
    for (let x = land.x0; x < land.x0 + land.w; x++) if (land.get(x, y) === G.meadow) all.push(Math.max(0, density(x, y)));
  }
  const hiCut = quantile(Uint16Array.from(all), 1000 - Math.floor(f * 4.5));
  const midCut = quantile(Uint16Array.from(all), 1000 - Math.floor(f * 8.5));
  for (let y = land.y0; y < land.y0 + land.h; y++) {
    for (let x = land.x0; x < land.x0 + land.w; x++) {
      if (land.get(x, y) !== G.meadow || near(entries, x, y, 3)) continue;
      const d = density(x, y);
      if (d > hiCut) land.set(x, y, G.forest);
      else if (d > midCut) land.set(x, y, G.grove);
      else if (valueNoise(seed, 'flowers', x, y, 5) > 52000) land.set(x, y, G.flowers);
    }
  }
}

// ---------------------------------------------------------------- the clearing and the roads

function clearing(seed: Seed, land: Land, entries: readonly Tile[], looks: Looks): Tile {
  const cx = land.x0 + Math.floor(land.w / 2) + pick(seed, 'hub', 0, Math.floor(land.w / 4)) - Math.floor(land.w / 8);
  const cy = land.y0 + Math.floor(land.h / 2) + pick(seed, 'hub', 1, Math.floor(land.h / 4)) - Math.floor(land.h / 8);
  const lv = Math.min(2, land.level(cx, cy));
  for (let y = cy - 4; y <= cy + 4; y++) {
    for (let x = cx - 4; x <= cx + 4; x++) {
      if (!land.inside(x, y)) continue;
      land.setLevel(x, y, lv);
      land.set(x, y, Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= 3 ? G.meadow : land.get(x, y) === G.mountain || land.get(x, y) === G.water ? G.grove : land.get(x, y));
    }
  }
  land.addProp(piece(looks, looks.places.hub.centre, cx, cy));
  for (const [s, dx, dy] of looks.places.hub.around) {
    if (fits(looks, land, s, cx + dx, cy + dy, (x, y) => land.walkable(x, y))) land.addProp(piece(looks, s, cx + dx, cy + dy));
  }
  land.marks.push({ kind: 'clearing', x: cx, y: cy, label: 'clearing' });
  void entries;
  return [cx, cy];
}

/** The price of a road entering a tile: water is a bridge, wood is felled, a level change is steps, rock is never. */
function roadCost(seed: Seed, land: Land): (x: number, y: number, fx: number, fy: number) => number {
  return (x, y, fx, fy) => {
    const ch = land.get(x, y);
    if (ch === G.mountain) return -1;
    let c = ch === G.water ? 60 : ch === G.forest ? 7 : ch === G.grove ? 3 : ch === G.path || ch === G.bridge ? 1 : ch === G.bank ? 3 : 2;
    c += pick(seed, 'road-noise', at(x, y), 4);
    const dl = Math.abs(land.level(x, y) - land.level(fx, fy));
    if (dl > 3) return -1;
    if (dl > 0 && !land.crossings.has(land.key(x, y)) && !land.crossings.has(land.key(fx, fy))) c += 25;
    return c;
  };
}

function roads(seed: Seed, land: Land, entries: readonly Tile[], hub: Tile, looks: Looks): void {
  const cost = roadCost(seed, land);
  const onLand = ([x, y]: Tile) => land.inside(x, y) && land.get(x, y) !== G.water && land.get(x, y) !== G.mountain;
  const onRoad = (x: number, y: number) => land.get(x, y) === G.path || land.get(x, y) === G.bridge;
  for (const entry of entries) {
    const found = route(land, entry, hub, cost, land.roads.length > 0 ? onRoad : undefined);
    if (!found) continue;
    const road = repair(found, onLand);
    lay(land, road, looks);
    land.roads.push(road);
    land.marks.push({ kind: 'entry', x: entry[0], y: entry[1], label: 'road in' });
  }
  // the map check's own reading of G69: every row and column of path letters short
  for (const [x, y] of wind(land)) {
    for (const [dx, dy] of STEPS4) {
      if (land.inside(x + dx, y + dy) && land.get(x + dx, y + dy) === G.forest) land.set(x + dx, y + dy, G.grove);
    }
  }
}

/** Writes a road: path letters, a bridge over water, a crossing where the level changes, air at the sides. */
function lay(land: Land, road: readonly Tile[], looks: Looks): void {
  for (let i = 0; i < road.length; i++) {
    const [x, y] = road[i]!;
    const ch = land.get(x, y);
    land.clearProps(x, y);
    if (ch === G.water) land.set(x, y, G.bridge);
    else if (ch !== G.bridge && ch !== G.path) land.set(x, y, G.path);
    if (i > 0) {
      const [px, py] = road[i - 1]!;
      if (land.level(px, py) !== land.level(x, y) && !land.crossings.has(land.key(x, y)) && !land.crossings.has(land.key(px, py))) {
        const lower = land.level(px, py) < land.level(x, y) ? road[i - 1]! : road[i]!;
        const on = land.get(lower[0], lower[1]) === G.bridge ? (lower === road[i] ? road[i - 1]! : road[i]!) : lower;
        land.addProp(piece(looks, looks.places.crossing, on[0], on[1], { solid: false, crossing: true }));
      }
    }
    for (const [dx, dy] of STEPS4) {
      if (land.inside(x + dx, y + dy) && land.get(x + dx, y + dy) === G.forest) land.set(x + dx, y + dy, G.grove);
    }
  }
}

// ---------------------------------------------------------------- places

export function roadDistance(land: Land): Int32Array {
  const sources: Tile[] = [];
  for (let y = land.y0; y < land.y0 + land.h; y++) {
    for (let x = land.x0; x < land.x0 + land.w; x++) {
      const ch = land.get(x, y);
      if (ch === G.path || ch === G.bridge) sources.push([x, y]);
    }
  }
  return plainDistance(land, sources);
}

/** Plain four-way steps over every tile, solid or not: how far each tile lies from the nearest source (-1: none). */
export function plainDistance(land: Land, sources: readonly Tile[]): Int32Array {
  const dist = new Int32Array(land.w * land.h).fill(-1);
  const queue: Tile[] = [];
  for (const [x, y] of sources) {
    dist[land.key(x, y)] = 0;
    queue.push([x, y]);
  }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    for (const [dx, dy] of STEPS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!land.inside(nx, ny) || dist[land.key(nx, ny)] !== -1) continue;
      dist[land.key(nx, ny)] = dist[land.key(x, y)]! + 1;
      queue.push([nx, ny]);
    }
  }
  return dist;
}

function ruins(seed: Seed, land: Land, story: StoryDef, entries: readonly Tile[], looks: Looks): void {
  const count = story.ruins ?? 1;
  if (count === 0) return;
  const fromRoad = roadDistance(land);
  const placed: Tile[] = [];
  for (let n = 0; n < count; n++) {
    let best: Tile | undefined;
    let score = -1;
    for (let y = land.y0 + 4; y < land.y0 + land.h - 4; y += 2) {
      for (let x = land.x0 + 4; x < land.x0 + land.w - 4; x += 2) {
        const ch = land.get(x, y);
        if ((ch !== G.meadow && ch !== G.grove && ch !== G.flowers) || land.level(x, y) > 2) continue;
        const d = fromRoad[land.key(x, y)]!;
        if (d < 6 || d > 30 || near(entries, x, y, 10) || near(placed, x, y, 16) || near(land.marks.filter((m) => m.kind === 'clearing').map((m) => [m.x, m.y] as Tile), x, y, 10)) continue;
        const s = pick(seed, `ruin:${n}`, at(x, y), 100000);
        if (s > score) [score, best] = [s, [x, y]];
      }
    }
    if (!best) return;
    const [cx, cy] = best;
    const lv = land.level(cx, cy);
    for (let y = cy - 2; y <= cy + 2; y++) {
      for (let x = cx - 2; x <= cx + 2; x++) {
        if (!land.inside(x, y) || land.get(x, y) === G.water || land.get(x, y) === G.mountain) continue;
        land.setLevel(x, y, lv);
        land.clearProps(x, y);
        const edge = Math.abs(x - cx) === 2 || Math.abs(y - cy) === 2;
        land.set(x, y, edge && chance(seed, `rubble:${n}`, at(x, y), 350) ? G.rubble : G.ruinFloor);
      }
    }
    land.set(cx, cy + 2, G.ruinFloor);
    land.set(cx, cy - 2, G.ruinFloor);
    const { wall, pillar, arch } = looks.places.ruin;
    const open = (x: number, y: number) => land.inside(x, y) && land.get(x, y) !== G.water && land.get(x, y) !== G.mountain;
    for (const [dx, dy, s] of [[-2, -2, wall], [2, -2, wall], [-2, 2, wall], [2, 2, wall], [1, 0, pillar], [-1, -1, pillar]] as const) {
      if (fits(looks, land, s, cx + dx, cy + dy, open)) land.addProp(piece(looks, s, cx + dx, cy + dy, { solid: true }));
    }
    if (fits(looks, land, arch, cx, cy + 2, open)) land.addProp(piece(looks, arch, cx, cy + 2, { solid: false }));
    land.marks.push({ kind: 'ruin', x: cx, y: cy, label: 'ruin' });
    placed.push(best);
  }
}

// ---------------------------------------------------------------- trees and small things

function trees(seed: Seed, land: Land, story: StoryDef, looks: Looks): void {
  const set = looks.worlds[story.world];
  const fromRoad = roadDistance(land);
  for (let y = land.y0; y < land.y0 + land.h; y++) {
    for (let x = land.x0; x < land.x0 + land.w; x++) {
      const ch = land.get(x, y);
      const k = land.key(x, y);
      if (land.blocked.has(k) || land.crossings.has(k) || fromRoad[k]! <= 1) continue;
      if (land.propAt(x, y)) continue;
      const grove = ch === G.grove;
      const meadow = ch === G.meadow || ch === G.flowers;
      if (!grove && !meadow) continue;
      const roll = pick(seed, 'tree', at(x, y), 1000);
      let sprite: string | undefined;
      if (grove && roll < 300) sprite = vary(seed, land, set.trees, x, y);
      else if (grove && roll < 420) sprite = choose(seed, 'small', at(x, y), set.small);
      else if (meadow && roll < 20) sprite = vary(seed, land, set.lone, x, y);
      else if (meadow && roll < 70) sprite = choose(seed, 'small', at(x, y), set.small);
      if (!sprite) continue;
      const solid = pieceOf(looks, sprite).solid;
      // a trunk never stands between two trunks on a row: a wall of wood is the forest letter's job
      if (solid && land.blocked.has(land.key(x - 1, y)) && land.inside(x - 2, y) && land.blocked.has(land.key(x - 2, y))) continue;
      // the whole footprint on the same kind of ground, off the roads and their crossings
      const same = (tx: number, ty: number) => (grove ? land.get(tx, ty) === G.grove : land.get(tx, ty) === G.meadow || land.get(tx, ty) === G.flowers) && !land.crossings.has(land.key(tx, ty)) && fromRoad[land.key(tx, ty)]! > 1;
      if (!fits(looks, land, sprite, x, y, same)) continue;
      land.addProp(piece(looks, sprite, x, y));
    }
  }
}

/** A tree sprite that differs from the one just left and the one just above: the wood is varied, never a stamp. */
function vary(seed: Seed, land: Land, list: readonly string[], x: number, y: number): string {
  const left = land.propAt(x - 1, y)?.sprite;
  const up = land.propAt(x, y - 1)?.sprite;
  const i = pick(seed, 'vary', at(x, y), list.length);
  for (let tries = 0; tries < list.length; tries++) {
    const s = list[(i + tries) % list.length]!;
    if (!left?.endsWith(`:${s}`) && !up?.endsWith(`:${s}`)) return s;
  }
  return list[i]!;
}

// ---------------------------------------------------------------- hidden doors

/**
 * The hidden doors (the owner, 8.11: a door everywhere, never the same twice, a hint at the entrance but not an
 * obvious one). Five forms, each with its own ground and its own hint: a cave in the rock with a worn trail that
 * ends at it; a hollow tree ringed by mushrooms; an old well in a glade where the grass stands odd; a cellar under
 * a ruin's floor, pebbles and old timber beside it; a way behind a fall, glowing mushrooms on the bank. A land never
 * repeats a form before it has used them all. Each door is a non-solid prop a player steps onto; its `portal`
 * leads to its chamber below (below.ts), and the way up there leads back to the tile before the door.
 */
export const doorId = (story: StoryDef, n: number) => `core/${name(story)}-door-${n}`;

/** What stands round a tile: of its eight neighbours how many are wood, rock (or the land's edge) and water; whether the ground drops beside it; whether a ruin is near. */
interface Site {
  wood: number;
  rock: number;
  water: number;
  drop: boolean;
  ruin: boolean;
}

function siteOf(land: Land, x: number, y: number, ruinsAt: readonly Tile[]): Site {
  let wood = 0;
  let rock = 0;
  let water = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const ch = land.inside(x + dx, y + dy) ? land.get(x + dx, y + dy) : G.mountain;
      if (ch === G.forest) wood++;
      else if (ch === G.mountain) rock++;
      else if (ch === G.water) water++;
    }
  }
  const drop = STEPS4.some(([dx, dy]) => land.inside(x + dx, y + dy) && land.level(x + dx, y + dy) !== land.level(x, y));
  return { wood, rock, water, drop, ruin: near(ruinsAt, x, y, 3) };
}

/** Whether a form may stand on the tile: its ground letter and what is round it. */
function fitsForm(form: DoorForm, ch: string, s: Site): boolean {
  switch (form) {
    case 'cave':
      return ch === G.forest && s.rock >= 2 && s.wood + s.rock >= 6;
    case 'hollow':
      return ch === G.forest && s.wood >= 6 && s.rock === 0;
    case 'well':
      return (ch === G.meadow || ch === G.flowers || ch === G.grove) && s.wood <= 4 && s.rock === 0 && s.water === 0 && !s.drop;
    case 'cellar':
      return ch === G.ruinFloor && s.ruin;
    case 'fall':
      return (ch === G.bank || ch === G.grove || ch === G.meadow) && s.water >= 2 && s.drop;
  }
}

/** The fewest road steps a form keeps: a cellar lies in a ruin, which stands near the roads; the rest hide deep. */
const DOOR_FROM_ROAD: Record<DoorForm, number> = { cave: 8, hollow: 8, well: 8, cellar: 3, fall: 6 };

function doors(seed: Seed, land: Land, story: StoryDef, entries: readonly Tile[], looks: Looks): Door[] {
  if (story.caves === 0) return [];
  const fromRoad = roadDistance(land);
  const sources = entries.map(([x, y]) => land.nearestWalkable(x, y) ?? ([x, y] as Tile));
  const ruinsAt = land.marks.filter((m) => m.kind === 'ruin').map((m) => [m.x, m.y] as Tile);
  const placed: Door[] = [];
  const used = new Set<DoorForm>();
  const first = pick(seed, 'door-form', 0, DOOR_FORMS.length);
  for (let n = 0; n < story.caves; n++) {
    let door: Door | undefined;
    for (let f = 0; f < DOOR_FORMS.length && !door; f++) {
      const form = DOOR_FORMS[(first + n + f) % DOOR_FORMS.length]!;
      if (used.has(form) && used.size < DOOR_FORMS.length) continue;
      door = placeDoor(seed, land, story, form, n, fromRoad, sources, entries, placed, ruinsAt, looks);
    }
    if (!door) break;
    used.add(door.form as DoorForm);
    placed.push(door);
  }
  return placed;
}

/** The best site of the form, deep and far from the roads, that a way can be carved to; the door, its hint and its step tile. */
function placeDoor(
  seed: Seed,
  land: Land,
  story: StoryDef,
  form: DoorForm,
  n: number,
  fromRoad: Int32Array,
  sources: readonly Tile[],
  entries: readonly Tile[],
  placed: readonly Door[],
  ruinsAt: readonly Tile[],
  looks: Looks,
): Door | undefined {
  const others = placed.map((d) => [d.x, d.y] as Tile);
  const found: { x: number; y: number; s: number }[] = [];
  for (let y = land.y0 + 6; y < land.y0 + land.h - 6; y++) {
    for (let x = land.x0 + 6; x < land.x0 + land.w - 6; x++) {
      if (land.level(x, y) > 2 || land.blocked.has(land.key(x, y)) || land.crossings.has(land.key(x, y))) continue;
      const d = fromRoad[land.key(x, y)]!;
      if (d < DOOR_FROM_ROAD[form] || near(others, x, y, 14) || near(entries, x, y, 16)) continue;
      const site = siteOf(land, x, y, ruinsAt);
      if (!fitsForm(form, land.get(x, y), site)) continue;
      found.push({ x, y, s: (site.wood * 2 + site.rock) * 100000 + Math.min(d, 60) * 1000 + pick(seed, `door:${n}`, at(x, y), 1000) });
    }
  }
  found.sort((a, b) => b.s - a.s);
  const failed: Tile[] = [];
  for (const { x, y } of found) {
    if (failed.length >= 12) break;
    if (near(failed, x, y, 8)) continue;
    // the whole door on ground a foot stands on or on wood that opens, off the roads, inside one chunk
    const sprite = looks.doors[form].sprite;
    const foot = footprint(looks, sprite, x, y);
    const open = (tx: number, ty: number) => land.inside(tx, ty) && (!SOLID.has(land.get(tx, ty)) || land.get(tx, ty) === G.forest) && !land.crossings.has(land.key(tx, ty)) && land.get(tx, ty) !== G.path && land.get(tx, ty) !== G.bridge;
    if (!oneChunk(foot) || !foot.every(([tx, ty]) => open(tx, ty))) {
      failed.push([x, y]);
      continue;
    }
    const was = foot.map(([tx, ty]) => land.get(tx, ty));
    const revert = () => foot.forEach(([tx, ty], i) => land.set(tx, ty, was[i]!));
    for (const [tx, ty] of foot) if (land.get(tx, ty) === G.forest) land.set(tx, ty, G.grove);
    let dist = land.distances(sources);
    // the way in is the secret path: a long winding corridor carved through the wood
    if (dist[land.key(x, y)] === -1) {
      if (!join(land, [[x, y]], dist, 48, looks)) {
        revert();
        failed.push([x, y]);
        continue;
      }
      dist = land.distances(sources);
    }
    // the step: the reached tile beside the footprint nearest the roads
    let step: Tile | undefined;
    const inFoot = (tx: number, ty: number) => foot.some(([fx, fy]) => fx === tx && fy === ty);
    for (const [fx, fy] of foot) {
      for (const [dx, dy] of STEPS4) {
        const [tx, ty] = [fx + dx, fy + dy];
        if (inFoot(tx, ty)) continue;
        const d = land.walkable(tx, ty) ? dist[land.key(tx, ty)]! : -1;
        if (d >= 0 && (!step || d < dist[land.key(step[0], step[1])]!)) step = [tx, ty];
      }
    }
    if (!step) {
      revert();
      failed.push([x, y]);
      continue;
    }
    for (const [tx, ty] of foot) land.clearProps(tx, ty);
    land.addProp(piece(looks, sprite, x, y, { solid: false, id: doorId(story, n) }));
    hint(seed, land, form, x, y, step, n, looks);
    land.marks.push({ kind: 'cave', x, y, label: `door ${n}: ${form}` });
    return { n, form, x, y, step };
  }
  return undefined;
}

/** The hint at a door, never the same for two forms: a trail that ends, a ring of mushrooms, odd grass, pebbles and timber, glow on the bank. */
function hint(seed: Seed, land: Land, form: DoorForm, x: number, y: number, step: Tile, n: number, looks: Looks): void {
  const h = looks.doors[form].hint;
  const free = (tx: number, ty: number) => land.walkable(tx, ty) && land.get(tx, ty) !== G.path && !land.propAt(tx, ty);
  const lay = (sprite: string, tx: number, ty: number) => {
    if (fits(looks, land, sprite, tx, ty, free)) land.addProp(piece(looks, sprite, tx, ty, { solid: false }));
  };
  switch (form) {
    case 'cave': {
      // a worn trail that ends at the mouth: three or four path tiles straight on from the step, where no path lies already
      const dx = step[0] - x;
      const dy = step[1] - y;
      for (let i = 0; i < 3 + pick(seed, `trail:${n}`, 0, 2); i++) {
        const tx = step[0] + dx * i;
        const ty = step[1] + dy * i;
        const ch = land.inside(tx, ty) ? land.get(tx, ty) : G.mountain;
        if (ch !== G.meadow && ch !== G.grove && ch !== G.flowers) break;
        if (STEPS4.some(([sx, sy]) => land.inside(tx + sx, ty + sy) && land.get(tx + sx, ty + sy) === G.path && !(tx + sx === step[0] + dx * (i - 1) && ty + sy === step[1] + dy * (i - 1)))) break;
        land.clearProps(tx, ty);
        land.set(tx, ty, G.path);
      }
      break;
    }
    case 'hollow':
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]] as const) {
        if (chance(seed, `ring:${n}`, at(x + dx, y + dy), 750)) lay(chance(seed, `ring-glow:${n}`, at(x + dx, y + dy), 400) ? h[1]! : h[0]!, x + dx, y + dy);
      }
      break;
    case 'well':
      for (const [dx, dy] of STEPS4) if (!(x + dx === step[0] && y + dy === step[1])) lay(h[0]!, x + dx, y + dy);
      lay(h[1]!, x - 1, y - 1);
      lay(h[1]!, x + 1, y + 1);
      break;
    case 'cellar':
      lay(h[0]!, x - 1, y);
      lay(h[0]!, x + 1, y);
      lay(h[1]!, x, y - 1);
      break;
    case 'fall': {
      let laid = 0;
      for (let dy = -2; dy <= 2 && laid < 3; dy++) {
        for (let dx = -2; dx <= 2 && laid < 3; dx++) {
          if ((dx === 0 && dy === 0) || !land.inside(x + dx, y + dy)) continue;
          const ch = land.get(x + dx, y + dy);
          if ((ch === G.bank || ch === G.grove) && chance(seed, `fall-glow:${n}`, at(x + dx, y + dy), 600) && free(x + dx, y + dy)) {
            lay(h[0]!, x + dx, y + dy);
            laid++;
          }
        }
      }
      break;
    }
  }
}

// ---------------------------------------------------------------- every tile reached

/** Joins what the roads do not reach: a small pocket fills with wood, a larger one gets a carved way, a stream a plank. */
function connect(land: Land, entries: readonly Tile[], looks: Looks): void {
  const sources = entries.map(([x, y]) => land.nearestWalkable(x, y) ?? ([x, y] as Tile));
  const keep = new Set(land.marks.filter((m) => m.kind === 'cave' || m.kind === 'ruin' || m.kind === 'clearing').map((m) => land.key(m.x, m.y)));
  for (let round = 0; round < 200; round++) {
    const dist = land.distances(sources);
    const lost = components(land, (x, y) => land.walkable(x, y) && dist[land.key(x, y)] === -1);
    if (lost.length === 0) return;
    // every small pocket fills at once; then the component with a kept mark, then the largest, gets its way
    const isKept = (c: Tile[]) => c.some(([x, y]) => keep.has(land.key(x, y)));
    const large = lost.filter((c) => c.length >= 30 || isKept(c));
    for (const c of lost) {
      if (c.length >= 30 || isKept(c)) continue;
      for (const [x, y] of c) {
        land.clearProps(x, y);
        land.set(x, y, land.level(x, y) >= 3 ? G.mountain : G.forest);
      }
    }
    if (large.length === 0) continue;
    large.sort((a, b) => Number(isKept(b)) - Number(isKept(a)) || b.length - a.length);
    const comp = large[0]!;
    if (join(land, comp, dist, 14, looks)) continue;
    // nothing leads in: the pocket is wood (a kept mark in it was already proven joinable when it was placed)
    for (const [x, y] of comp) {
      land.clearProps(x, y);
      land.set(x, y, land.level(x, y) >= 3 ? G.mountain : G.forest);
    }
  }
}

/**
 * Carves a way from a lost component to the nearest reached tile: wood to grove, water to a plank, a solid prop
 * cleared, a crossing where the level changes. False when no way exists within reach (rock all round, or a
 * drop past the step rule), and then the land is untouched.
 */
function join(land: Land, comp: readonly Tile[], dist: Int32Array, reach: number, looks: Looks): boolean {
  {
    // the pair of tiles, one lost and one reached, that lie closest; then a carved way between them
    let from: Tile | undefined;
    let to: Tile | undefined;
    let bestD = 0x7fffffff;
    for (const [x, y] of comp) {
      for (let r = 1; r <= reach && r < bestD; r++) {
        for (let yy = y - r; yy <= y + r && r < bestD; yy++) {
          for (let xx = x - r; xx <= x + r; xx++) {
            if (Math.abs(xx - x) + Math.abs(yy - y) !== r || !land.inside(xx, yy) || dist[land.key(xx, yy)] === -1) continue;
            bestD = r;
            from = [x, y];
            to = [xx, yy];
            break;
          }
        }
      }
    }
    if (!from || !to) return false;
    const way = route(land, from, to, (x, y, fx, fy) => {
      const ch = land.get(x, y);
      if (ch === G.mountain) return -1;
      const dl = Math.abs(land.level(x, y) - land.level(fx, fy));
      if (dl > 3) return -1;
      let c = ch === G.water ? 8 : ch === G.forest ? 3 : land.blocked.has(land.key(x, y)) ? 2 : 1;
      if (dl > 0 && !land.crossings.has(land.key(x, y)) && !land.crossings.has(land.key(fx, fy))) c += 20;
      return c;
    });
    if (!way) return false;
    for (let i = 0; i < way.length; i++) {
      const [x, y] = way[i]!;
      const ch = land.get(x, y);
      // the way is cleared of whatever stood on it, a trunk or a flower, before a crossing is laid
      land.clearProps(x, y);
      if (ch === G.water) land.set(x, y, G.bridge);
      else if (ch === G.forest) land.set(x, y, G.grove);
      if (i > 0) {
        const [px, py] = way[i - 1]!;
        if (land.level(px, py) !== land.level(x, y) && !land.crossings.has(land.key(x, y)) && !land.crossings.has(land.key(px, py))) {
          const lower = land.level(px, py) < land.level(x, y) ? way[i - 1]! : way[i]!;
          if (land.get(lower[0], lower[1]) !== G.bridge) land.addProp(piece(looks, looks.places.crossing, lower[0], lower[1], { solid: false, crossing: true }));
          else land.addProp(piece(looks, looks.places.crossing, x, y, { solid: false, crossing: true }));
        }
      }
    }
    return true;
  }
}

// ---------------------------------------------------------------- the measure

function measure(land: Land, story: StoryDef, entries: readonly Tile[], looks: Looks): Measure {
  const tiles: Record<string, number> = {};
  let walkable = 0;
  for (let y = land.y0; y < land.y0 + land.h; y++) {
    for (let x = land.x0; x < land.x0 + land.w; x++) {
      const ch = land.get(x, y);
      tiles[ch] = (tiles[ch] ?? 0) + 1;
      if (land.walkable(x, y)) walkable++;
    }
  }
  const sources = entries.map(([x, y]) => land.nearestWalkable(x, y) ?? ([x, y] as Tile));
  const dist = land.distances(sources);
  let unreachable = 0;
  let farthest = 0;
  for (let y = land.y0; y < land.y0 + land.h; y++) {
    for (let x = land.x0; x < land.x0 + land.w; x++) {
      if (!land.walkable(x, y)) continue;
      const d = dist[land.key(x, y)]!;
      if (d === -1) unreachable++;
      else farthest = Math.max(farthest, d);
    }
  }
  let longestRun = 0;
  let longestBridgeRun = 0;
  for (const road of land.roads) {
    const [a, b] = longestRuns(land, road);
    longestRun = Math.max(longestRun, a);
    longestBridgeRun = Math.max(longestBridgeRun, b);
  }
  // every path letter on the ground, by rows and columns (the map check's own scan)
  const scan = (x0: number, y0: number, dx: number, dy: number) => {
    let run = 0;
    for (let x = x0, y = y0; land.inside(x, y); x += dx, y += dy) {
      if (land.get(x, y) === G.path) run++;
      else {
        longestRun = Math.max(longestRun, run);
        run = 0;
      }
    }
    longestRun = Math.max(longestRun, run);
  };
  for (let y = land.y0; y < land.y0 + land.h; y++) scan(land.x0, y, 1, 0);
  for (let x = land.x0; x < land.x0 + land.w; x++) scan(x, land.y0, 0, 1);
  let least = 100;
  let most = 0;
  for (let by = land.y0; by < land.y0 + land.h; by += 16) {
    for (let bx = land.x0; bx < land.x0 + land.w; bx += 16) {
      let woodTiles = 0;
      for (let y = by; y < by + 16; y++) for (let x = bx; x < bx + 16; x++) if (land.get(x, y) === G.forest || land.get(x, y) === G.grove) woodTiles++;
      const share = Math.floor((woodTiles * 100) / 256);
      least = Math.min(least, share);
      most = Math.max(most, share);
    }
  }
  const treeKinds = new Set(land.props.filter((p) => pieceOf(looks, p.sprite.slice(looks.kit.length)).solid).map((p) => p.sprite)).size;
  return {
    tiles,
    walkable,
    unreachable,
    roads: land.roads.length,
    longestRun,
    longestBridgeRun,
    cavesAsked: story.caves,
    caves: land.marks.filter((m) => m.kind === 'cave').length,
    doorForms: land.marks.filter((m) => m.kind === 'cave').map((m) => m.label.split(': ')[1] ?? ''),
    woodSpread: [least, most],
    farthestSteps: farthest,
    treeKinds,
    crossings: land.crossings.size,
  };
}

export { SOLID, DOOR_FORMS };
export type { DoorForm };
