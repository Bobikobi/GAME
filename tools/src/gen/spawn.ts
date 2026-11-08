/**
 * The creatures of a generated land (the owner, 8.11: many different creatures, sometimes small and weak in
 * packs, sometimes one strong one, sometimes a strong group, with logic). Five axes, not one list:
 *
 * - strength: the kind's tier, and a rank on the spot (regular, elite, rare, boss) that lifts it;
 * - group: the kind's class and bands, and a shape on the spot (lone, pack, camp with a leader, patrol on a road);
 * - family: the world's kinds (tools/gen/kinds.json, the bestiary's rows until the schema pull request);
 * - behaviour: the kind's danger (0 flees, 1 defends, 2 hunts), which also sets where it may stand (G64, HUNTING 8);
 * - hour: the kind's waking window;
 * plus affixes on an elite, a rare or a boss (tools/gen/affixes.json, an open list).
 *
 * Where a kind stands follows the wild check's rows so the output passes it once spots are content: on its
 * habitat, never within 12 tiles of the hub, never on a road, no hunter nearer than danger 2, water within roam
 * for a drinker, one anchor of a kind a tile, and its standing count capped at 12 / 8 / 5 per 1000 habitat
 * tiles by danger. Integers only, every draw keyed by the tile.
 */
import type { Seed } from '@game/kernel';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../load';
import { G, type Land, type Tile } from './grid';
import { type Generated, plainDistance, roadDistance } from './land';
import { at, pick } from './rand';
import type { World } from './story';

export const RANKS = ['regular', 'elite', 'rare', 'boss'] as const;
export type Rank = (typeof RANKS)[number];
export const SHAPES = ['lone', 'pack', 'camp', 'patrol'] as const;
export type Shape = (typeof SHAPES)[number];
export const GROUP_CLASSES = ['solitary', 'herd', 'flock', 'pack'] as const;
export const ARTS = ['moving', 'still', 'none'] as const;
export const NEARS = ['rock', 'cave'] as const;
/** The standing cap per 1000 habitat tiles by danger (HUNTING section 8). */
export const CAPS = [12, 8, 5] as const;
/** No wild kind this close to the hub, in tiles (HUNTING section 8, the wild check's TOWN_SQUARE_CLEAR). */
export const HUB_CLEAR = 12;
/** The group bands' sizes, as the schema has them, and each band's mean in hundredths. */
const BAND_SIZES: readonly (readonly [number, number])[] = [
  [1, 1],
  [2, 2],
  [3, 4],
  [5, 12],
];
const BAND_MEAN100 = [100, 200, 350, 850] as const;
const D_TILES = 64;

export interface KindDef {
  id: string;
  name: string;
  family: string;
  size: 'small' | 'medium' | 'large';
  danger: 0 | 1 | 2;
  tier: number;
  habitat: string[];
  hours: [number, number];
  group: { class: (typeof GROUP_CLASSES)[number]; bands: [number, number, number, number] };
  roam: number;
  art: (typeof ARTS)[number];
  near?: (typeof NEARS)[number];
  drinks?: boolean;
  cap_per_1000?: number;
  ambient?: boolean;
}

export interface AffixDef {
  id: string;
  worlds: World[];
  ranks: Rank[];
  note: string;
}

export interface Spawn {
  id: string;
  kind: string;
  x: number;
  y: number;
  /** Steps from the hub over 64 (G64). */
  danger: number;
  rank: Rank;
  shape: Shape;
  /** How many stand at the anchor, least to most. */
  count: [number, number];
  hours: [number, number];
  affixes: string[];
  /** A camp's leader: the same kind at elite, or a named kind. */
  leader?: string;
  /** A patrol's beat: road tiles walked end to end and back. */
  route?: Tile[];
}

export interface SpawnMeasure {
  spots: number;
  creatures: [number, number];
  byDanger: [number, number, number];
  byRank: Record<Rank, number>;
  byShape: Record<Shape, number>;
  kinds: number;
  skipped: string[];
  noArt: string[];
  /** Per kind: its standing cap on this land and the mean count placed. */
  load: Record<string, { standing: number; mean: number }>;
}

// ---------------------------------------------------------------- the tables

const int = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** Every fault of a kind row, as "field: what is wrong". */
export function kindProblems(k: unknown): string[] {
  if (typeof k !== 'object' || k === null) return ['a kind must be one object'];
  const o = k as Record<string, unknown>;
  const out: string[] = [];
  if (typeof o.id !== 'string' || !/^[a-z0-9_-]+\/[a-z0-9_-]+$/.test(o.id)) out.push('id: creator/name');
  if (typeof o.name !== 'string' || o.name.length === 0) out.push('name: missing');
  if (typeof o.family !== 'string') out.push('family: missing');
  if (!['small', 'medium', 'large'].includes(o.size as string)) out.push('size: small, medium or large');
  if (!int(o.danger, 0, 2)) out.push('danger: 0, 1 or 2');
  if (!int(o.tier, 1, 20)) out.push('tier: 1..20');
  if (!Array.isArray(o.habitat) || o.habitat.length === 0 || !o.habitat.every((t) => ['meadow', 'grove', 'water', 'riverbank', 'ruin'].includes(t as string))) out.push('habitat: tags from meadow, grove, water, riverbank, ruin');
  if (!Array.isArray(o.hours) || o.hours.length !== 2 || !int(o.hours[0], 0, 24) || !int(o.hours[1], 0, 24)) out.push('hours: [from, to] in 0..24');
  const g = o.group as Record<string, unknown> | undefined;
  if (!g || !GROUP_CLASSES.includes(g.class as never)) out.push('group.class: solitary, herd, flock or pack');
  const bands = g?.bands as unknown[] | undefined;
  if (!Array.isArray(bands) || bands.length !== 4 || !bands.every((b) => int(b, 0, 100)) || (bands as number[]).reduce((a, b) => a + b, 0) !== 100) out.push('group.bands: four weights that sum to 100');
  if (g && g.class === 'solitary' && bands && ((bands[2] as number) > 0 || (bands[3] as number) > 0)) out.push('group.bands: a solitary kind stands alone or as a pair');
  if (g && g.class === 'pack' && o.danger === 0) out.push('group.class: a pack is hunters or defenders, not danger 0');
  if (!int(o.roam, 1, 32)) out.push('roam: 1..32');
  if (!ARTS.includes(o.art as never)) out.push('art: moving, still or none');
  if (o.near !== undefined && !NEARS.includes(o.near as never)) out.push('near: rock or cave');
  if (o.cap_per_1000 !== undefined && !int(o.cap_per_1000, 1, 20)) out.push('cap_per_1000: 1..20');
  if (o.cap_per_1000 !== undefined && int(o.danger, 0, 2) && (o.cap_per_1000 as number) > CAPS[o.danger as 0 | 1 | 2]) out.push(`cap_per_1000: at most ${CAPS[o.danger as 0 | 1 | 2]} at danger ${String(o.danger)}`);
  if (o.danger === 2 && o.size === 'small') out.push('danger: a hunter is medium or large');
  return out;
}

export function affixProblems(a: unknown): string[] {
  if (typeof a !== 'object' || a === null) return ['an affix must be one object'];
  const o = a as Record<string, unknown>;
  const out: string[] = [];
  if (typeof o.id !== 'string' || !/^[a-z-]+$/.test(o.id)) out.push('id: lowercase letters');
  if (!Array.isArray(o.worlds) || o.worlds.length === 0 || !o.worlds.every((w) => ['human', 'elf', 'undead'].includes(w as string))) out.push('worlds: a list of worlds');
  if (!Array.isArray(o.ranks) || o.ranks.length === 0 || !o.ranks.every((r) => RANKS.includes(r as Rank) && r !== 'regular')) out.push('ranks: elite, rare or boss');
  if (typeof o.note !== 'string') out.push('note: missing');
  return out;
}

let kindTable: Record<World, KindDef[]> | undefined;
let affixTable: AffixDef[] | undefined;

export function kindsOf(world: World): KindDef[] {
  if (!kindTable) {
    const data = JSON.parse(readFileSync(join(REPO_ROOT, 'tools', 'gen', 'kinds.json'), 'utf8')) as Record<World, unknown[]>;
    for (const [w, list] of Object.entries(data)) {
      for (const k of list) {
        const problems = kindProblems(k);
        if (problems.length > 0) throw new Error(`kinds.json ${w} ${String((k as { id?: string }).id)}: ${problems.join('; ')}`);
      }
    }
    kindTable = data as Record<World, KindDef[]>;
  }
  return [...kindTable[world]].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function affixes(): AffixDef[] {
  if (!affixTable) {
    const data = JSON.parse(readFileSync(join(REPO_ROOT, 'tools', 'gen', 'affixes.json'), 'utf8')) as unknown[];
    for (const a of data) {
      const problems = affixProblems(a);
      if (problems.length > 0) throw new Error(`affixes.json ${String((a as { id?: string }).id)}: ${problems.join('; ')}`);
    }
    affixTable = data as AffixDef[];
  }
  return affixTable;
}

// ---------------------------------------------------------------- the land's fields

/** The tag a generated ground letter carries (content/core/map.json legend); undefined for rock. */
export function tagOf(ch: string): string | undefined {
  switch (ch) {
    case G.meadow:
    case G.flowers:
      return 'meadow';
    case G.grove:
    case G.forest:
      return 'grove';
    case G.water:
      return 'water';
    case G.bank:
    case G.bridge:
      return 'riverbank';
    case G.ruinFloor:
    case G.rubble:
      return 'ruin';
    case G.path:
      return 'path';
    default:
      return undefined;
  }
}

export interface Fields {
  hub: Tile;
  /** Walk steps from the hub under the step rule (-1 unreached). */
  hubSteps: Int32Array;
  /** Plain steps from the hub over every tile. */
  hubPlain: Int32Array;
  fromRoad: Int32Array;
  rock: Int32Array;
  cave: Int32Array;
  ruin: Int32Array;
  water: Int32Array;
}

export function fields(land: Land): Fields {
  const clearing = land.marks.find((m) => m.kind === 'clearing');
  const hub: Tile = clearing ? [clearing.x, clearing.y] : [land.x0 + (land.w >> 1), land.y0 + (land.h >> 1)];
  const rocks: Tile[] = [];
  const waters: Tile[] = [];
  for (let y = land.y0; y < land.y0 + land.h; y++) {
    for (let x = land.x0; x < land.x0 + land.w; x++) {
      const ch = land.get(x, y);
      if (ch === G.mountain) rocks.push([x, y]);
      if (ch === G.water || ch === G.bank) waters.push([x, y]);
    }
  }
  const marks = (kind: string): Tile[] => land.marks.filter((m) => m.kind === kind).map((m) => [m.x, m.y] as const);
  return {
    hub,
    hubSteps: land.distances([land.nearestWalkable(hub[0], hub[1]) ?? hub]),
    hubPlain: plainDistance(land, [hub]),
    fromRoad: roadDistance(land),
    rock: plainDistance(land, rocks),
    cave: plainDistance(land, marks('cave')),
    ruin: plainDistance(land, marks('ruin')),
    water: plainDistance(land, waters),
  };
}

/** The danger of a tile (G64): walk steps from the hub over 64; a water tile takes its plain steps. */
export function dangerOf(f: Fields, k: number, walkable: boolean): number {
  const steps = walkable ? f.hubSteps[k]! : f.hubPlain[k]!;
  return steps < 0 ? -1 : Math.floor(steps / D_TILES);
}

// ---------------------------------------------------------------- the placing

export function spawn(gen: Generated): { spawns: Spawn[]; measure: SpawnMeasure } {
  const { land, seed, story } = gen;
  const f = fields(land);
  const world = story.world;
  const name = story.id.split('/')[1]!;
  const kinds = kindsOf(world);
  const taken = new Set<number>();
  const spawns: Spawn[] = [];
  const skipped: string[] = [];
  const load: SpawnMeasure['load'] = {};
  const anchorsOf = new Map<string, Tile[]>();

  for (const kind of kinds) {
    const cap = kind.cap_per_1000 ?? CAPS[kind.danger];
    const cands: { x: number; y: number; k: number; s: number }[] = [];
    let habitat = 0;
    for (let y = land.y0; y < land.y0 + land.h; y++) {
      for (let x = land.x0; x < land.x0 + land.w; x++) {
        const ch = land.get(x, y);
        const tag = tagOf(ch);
        if (!tag || !kind.habitat.includes(tag)) continue;
        const k = land.key(x, y);
        const swims = tag === 'water';
        if (!swims && !land.walkable(x, y)) continue;
        habitat++;
        const d = dangerOf(f, k, !swims);
        if (d < kind.danger) continue;
        if (f.hubPlain[k]! <= HUB_CLEAR || f.fromRoad[k]! < 2) continue;
        if (kind.near === 'rock' && (f.rock[k]! < 0 || f.rock[k]! > 3)) continue;
        if (kind.near === 'cave' && (f.cave[k]! < 0 || f.cave[k]! > 8)) continue;
        if (kind.drinks && (f.water[k]! < 0 || f.water[k]! > kind.roam)) continue;
        if (taken.has(k)) continue;
        // a hunter prefers the deep; a pack kind gathers by a ruin or a cave mouth, where its camps will be
        const byPlace = Math.min(f.ruin[k]! < 0 ? 99 : f.ruin[k]!, f.cave[k]! < 0 ? 99 : f.cave[k]!);
        const s = pick(seed, `spot:${kind.id}`, at(x, y), 1_000_000) + (kind.danger === 2 ? f.fromRoad[k]! * 3000 : 0) + (kind.group.class === 'pack' && byPlace <= 8 ? 600_000 : 0);
        cands.push({ x, y, k, s });
      }
    }
    const standing = habitat === 0 ? 0 : Math.max(1, Math.floor((cap * habitat) / 1000));
    const bands = kind.group.bands;
    const mean100 = bands.reduce((sum, b, i) => sum + b * BAND_MEAN100[i]!, 0) / 100;
    // the story's life: how much of the cap is filled; a kind with any habitat keeps one anchor at least
    const life = story.life ?? 25;
    const wanted = Math.min(40, Math.max(1, Math.round((standing * life) / mean100)));
    if (cands.length === 0) {
      skipped.push(kind.id);
      continue;
    }
    cands.sort((a, b) => b.s - a.s || a.k - b.k);
    const spacing = Math.max(4, kind.roam);
    const mine: Tile[] = [];
    let mean = 0;
    for (const c of cands) {
      if (mine.length >= wanted) break;
      if (mine.some(([x, y]) => Math.max(Math.abs(x - c.x), Math.abs(y - c.y)) < spacing)) continue;
      let crowded = false;
      for (let dy = -2; dy <= 2 && !crowded; dy++) for (let dx = -2; dx <= 2 && !crowded; dx++) crowded = land.inside(c.x + dx, c.y + dy) && taken.has(land.key(c.x + dx, c.y + dy));
      if (crowded) continue;
      taken.add(c.k);
      mine.push([c.x, c.y]);
      const shape: Shape = kind.group.class === 'solitary' ? 'lone' : 'pack';
      const count = shape === 'lone' ? ([1, 1] as [number, number]) : bandCount(seed, kind, c.k);
      mean += (count[0] + count[1]) / 2;
      spawns.push({
        id: `core/${name}-spot-${spawns.length}`,
        kind: kind.id,
        x: c.x,
        y: c.y,
        danger: dangerOf(f, c.k, land.walkable(c.x, c.y)),
        rank: 'regular',
        shape,
        count,
        hours: kind.hours,
        affixes: [],
      });
    }
    anchorsOf.set(kind.id, mine);
    load[kind.id] = { standing, mean: Math.round(mean) };
  }

  ranks(gen, f, kinds, spawns);
  shapes(gen, f, kinds, spawns);
  dress(seed, world, spawns);
  return { spawns, measure: measureSpawns(kinds, spawns, skipped, load) };
}

/** A group's count at an anchor: one of the kind's bands, drawn by weight. */
function bandCount(seed: Seed, kind: KindDef, k: number): [number, number] {
  const roll = pick(seed, `band:${kind.id}`, k, 100);
  let acc = 0;
  for (let i = 0; i < 4; i++) {
    acc += kind.group.bands[i]!;
    if (roll < acc) return [BAND_SIZES[i]![0], BAND_SIZES[i]![1]];
  }
  return [1, 1];
}

const kindOf = (kinds: readonly KindDef[], id: string) => kinds.find((k) => k.id === id)!;

/** The ranks: one boss where the land's strongest hunter stands by a ruin or a cave, a few rares far out, elites by draw. */
function ranks(gen: Generated, f: Fields, kinds: readonly KindDef[], spawns: Spawn[]): void {
  const { land, seed, story } = gen;
  const key = (s: Spawn) => land.key(s.x, s.y);
  const hunters = spawns.filter((s) => kindOf(kinds, s.kind).danger === 2 && s.danger >= 2);
  if (hunters.length > 0) {
    const top = Math.max(...hunters.map((s) => kindOf(kinds, s.kind).tier));
    const ofTop = hunters.filter((s) => kindOf(kinds, s.kind).tier === top);
    const place = (s: Spawn) => {
      const r = f.ruin[key(s)]!;
      const c = f.cave[key(s)]!;
      const nearest = Math.min(r < 0 ? 9999 : r, c < 0 ? 9999 : c);
      return nearest * 1000 - f.hubPlain[key(s)]!;
    };
    ofTop.sort((a, b) => place(a) - place(b) || key(a) - key(b));
    ofTop[0]!.rank = 'boss';
  }
  const rares = 1 + Math.floor((story.size.w * story.size.h) / 4);
  const far = spawns.filter((s) => s.rank === 'regular' && kindOf(kinds, s.kind).tier >= 2 && s.danger >= 1).sort((a, b) => f.fromRoad[key(b)]! - f.fromRoad[key(a)]! || key(a) - key(b));
  const used = new Set<string>();
  for (const s of far) {
    if (used.size >= rares) break;
    if (used.has(s.kind)) continue;
    s.rank = 'rare';
    used.add(s.kind);
  }
  for (const s of spawns) {
    if (s.rank !== 'regular' || kindOf(kinds, s.kind).danger === 0) continue;
    if (pick(seed, 'elite', key(s), 6) === 0) s.rank = 'elite';
  }
}

/** The shapes: a pack kind by a ruin or a cave at danger 2 is a camp with a leader; a few packs walk a road at night. */
function shapes(gen: Generated, f: Fields, kinds: readonly KindDef[], spawns: Spawn[]): void {
  const { land, story } = gen;
  const key = (s: Spawn) => land.key(s.x, s.y);
  const packs = spawns.filter((s) => kindOf(kinds, s.kind).group.class === 'pack' && kindOf(kinds, s.kind).danger >= 1);
  for (const s of packs) {
    const r = f.ruin[key(s)]!;
    const c = f.cave[key(s)]!;
    if (s.danger >= 1 && ((r >= 0 && r <= 8) || (c >= 0 && c <= 8))) {
      s.shape = 'camp';
      s.count = [4, 10];
      s.leader = s.kind;
      if (s.rank === 'regular') s.rank = 'elite';
    }
  }
  // the patrols are placed apart: the lowest pack kind walks a beat of the road at its danger, from a tile beside it
  const beats = 1 + Math.floor((story.size.w * story.size.h) / 5);
  const sentries = kinds.filter((k) => k.group.class === 'pack' && k.danger >= 1).sort((a, b) => a.tier - b.tier || (a.id < b.id ? -1 : 1));
  const sentry = sentries[0];
  if (sentry) {
    const occupied = new Set(spawns.map(key));
    const roadTiles: Tile[] = land.roads.flat().filter(([x, y]) => (land.get(x, y) === G.path || land.get(x, y) === G.bridge) && dangerOf(f, land.key(x, y), true) >= sentry.danger);
    const starts = roadTiles.map((t, i) => ({ t, s: pick(gen.seed, 'patrol', i, 1_000_000) })).sort((a, b) => b.s - a.s);
    const placed: Tile[] = [];
    for (const { t } of starts) {
      if (placed.length >= beats) break;
      if (placed.some(([x, y]) => Math.abs(x - t[0]) + Math.abs(y - t[1]) < 40)) continue;
      const route = beat(land, t);
      if (!route) continue;
      // the anchor: a habitat tile two or three steps off the road, clear of every other anchor
      let anchor: Tile | undefined;
      for (let r = 2; r <= 3 && !anchor; r++) {
        for (let dy = -r; dy <= r && !anchor; dy++) {
          for (let dx = -r; dx <= r && !anchor; dx++) {
            const x = t[0] + dx;
            const y = t[1] + dy;
            if (!land.inside(x, y) || Math.abs(dx) + Math.abs(dy) !== r || !land.walkable(x, y)) continue;
            const k = land.key(x, y);
            // a patrol's anchor is any open ground off the road: it walks the road, it does not live here
            const tag = tagOf(land.get(x, y));
            if (!tag || tag === 'path' || tag === 'water' || occupied.has(k) || f.hubPlain[k]! <= HUB_CLEAR || f.fromRoad[k]! < 2) continue;
            if (dangerOf(f, k, true) < sentry.danger) continue;
            anchor = [x, y];
          }
        }
      }
      if (!anchor) continue;
      occupied.add(land.key(anchor[0], anchor[1]));
      placed.push(t);
      spawns.push({
        id: `core/${story.id.split('/')[1]}-spot-${spawns.length}`,
        kind: sentry.id,
        x: anchor[0],
        y: anchor[1],
        danger: dangerOf(f, land.key(anchor[0], anchor[1]), true),
        rank: 'regular',
        shape: 'patrol',
        count: [2, 4],
        hours: sentry.hours,
        affixes: [],
        route,
      });
    }
  }
  // a boss of a pack kind leads its camp; a boss of a lone kind stands alone
  for (const s of spawns) {
    if (s.rank !== 'boss') continue;
    if (kindOf(kinds, s.kind).group.class === 'pack') {
      s.shape = 'camp';
      s.count = [3, 6];
      s.leader = s.kind;
    } else {
      s.shape = 'lone';
      s.count = [1, 1];
    }
  }
}

/** A patrol's beat: the twenty road tiles round the road tile nearest the anchor. */
function beat(land: Land, from: Tile): Tile[] | undefined {
  let best: { road: Tile[]; i: number; d: number } | undefined;
  for (const road of land.roads) {
    road.forEach((t, i) => {
      const d = Math.abs(t[0] - from[0]) + Math.abs(t[1] - from[1]);
      if (!best || d < best.d) best = { road, i, d };
    });
  }
  if (!best) return undefined;
  const { road, i } = best;
  const lo = Math.max(0, i - 10);
  const hi = Math.min(road.length, lo + 20);
  const tiles = road.slice(lo, hi).filter(([x, y]) => land.get(x, y) === G.path || land.get(x, y) === G.bridge);
  return tiles.length >= 8 ? tiles : undefined;
}

/** The affixes: one on an elite, one or two on a rare, two on a boss, each from the world's list, never twice. */
function dress(seed: Seed, world: World, spawns: Spawn[]): void {
  const table = affixes();
  spawns.forEach((s, i) => {
    if (s.rank === 'regular') return;
    const fit = table.filter((a) => a.worlds.includes(world) && a.ranks.includes(s.rank));
    const want = s.rank === 'elite' ? 1 : s.rank === 'boss' ? 2 : 1 + pick(seed, 'affix-count', i, 2);
    for (let n = 0; n < want && fit.length > 0; n++) {
      const left = fit.filter((a) => !s.affixes.includes(a.id));
      if (left.length === 0) break;
      s.affixes.push(left[pick(seed, `affix:${s.id}`, n, left.length)]!.id);
    }
  });
}

function measureSpawns(kinds: readonly KindDef[], spawns: Spawn[], skipped: string[], load: SpawnMeasure['load']): SpawnMeasure {
  const byRank = { regular: 0, elite: 0, rare: 0, boss: 0 };
  const byShape = { lone: 0, pack: 0, camp: 0, patrol: 0 };
  const byDanger: [number, number, number] = [0, 0, 0];
  let lo = 0;
  let hi = 0;
  const placed = new Set<string>();
  for (const s of spawns) {
    byRank[s.rank]++;
    byShape[s.shape]++;
    byDanger[kindOf(kinds, s.kind).danger]++;
    lo += s.count[0];
    hi += s.count[1];
    placed.add(s.kind);
  }
  const noArt = [...placed].filter((id) => kindOf(kinds, id).art === 'none').sort();
  return { spots: spawns.length, creatures: [lo, hi], byDanger, byRank, byShape, kinds: placed.size, skipped, noArt, load };
}
