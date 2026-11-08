/**
 * The looks (the owner, 8.11: a new design will bring many pieces not drawn yet). What the generator decides is
 * where things stand; which picture stands there, and how much ground it takes, is this table: `tools/gen/looks.json`.
 * A new design is a new file, never a change to the placing. Every piece names its footprint in tiles (1x1 when it
 * says nothing) and whether a foot gets past it; every name must exist in the kit, and the check says which do not.
 *
 * - `worlds.<world>`: solid trees, small things on the ground, and the lone trees of a meadow, as weighted lists.
 * - `places`: the clearing's stone and what lies around it (with its offsets), a ruin's wall, pillar and arch, the crossing.
 * - `doors.<form>`: the door's own piece and the pieces its hint is laid with, in the order the hint uses them:
 *   cave none (its hint is a worn trail in the ground); hollow [the ring, the rarer glow in it]; well [the grass at
 *   its sides, the flowers at two corners]; cellar [the pebbles at its sides, the timber above]; fall [the glow by the water].
 * - `below`: the way up, the stones by the walls, the glow, the bones and old timber at a secret's tip, a pillar.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../load';
import type { Land, Prop, Tile } from './grid';
import type { World } from './story';

export const DOOR_FORMS = ['cave', 'hollow', 'well', 'cellar', 'fall'] as const;
export type DoorForm = (typeof DOOR_FORMS)[number];
/** How many pieces each form's hint is laid with. */
export const HINT_PIECES: Record<DoorForm, number> = { cave: 0, hollow: 2, well: 2, cellar: 2, fall: 1 };

export interface Piece {
  w: number;
  h: number;
  solid: boolean;
}

export interface WorldLook {
  trees: readonly string[];
  small: readonly string[];
  lone: readonly string[];
}

export interface Looks {
  /** The kit every name is read in, as a sprite prefix ("core/base-kit:"). */
  kit: string;
  pieces: Record<string, Partial<Piece>>;
  worlds: Record<World, WorldLook>;
  places: {
    hub: { centre: string; around: readonly (readonly [string, number, number])[] };
    ruin: { wall: string; pillar: string; arch: string };
    crossing: string;
  };
  doors: Record<DoorForm, { sprite: string; hint: readonly string[] }>;
  below: { way_up: string; stones: readonly string[]; glow: string; bones: string; timber: string; pillar: string };
}

const WORLDS: readonly World[] = ['human', 'elf', 'undead'];
const NAME = /^[a-z0-9_]+(?:\/[a-z0-9_]+)+$/;

/** Every fault of a looks table, as "field: what is wrong"; with the kit's sprite names, every name not drawn too. */
export function looksProblems(data: unknown, kitSprites?: ReadonlySet<string>): string[] {
  const out: string[] = [];
  if (typeof data !== 'object' || data === null) return ['looks: not an object'];
  const o = data as Record<string, unknown>;
  const names = new Set<string>();
  const name = (field: string, v: unknown): void => {
    if (typeof v !== 'string' || !NAME.test(v)) out.push(`${field}: a kit name like props/tree_oak`);
    else names.add(v);
  };
  const list = (field: string, v: unknown, min = 1): void => {
    if (!Array.isArray(v) || v.length < min) out.push(`${field}: a list of ${min} or more names`);
    else v.forEach((s, i) => name(`${field}[${i}]`, s));
  };
  if (typeof o.kit !== 'string' || !/^[a-z0-9_-]+\/[a-z0-9_-]+:$/.test(o.kit)) out.push('kit: "<creator>/<kit>:"');
  if (typeof o.pieces !== 'object' || o.pieces === null) out.push('pieces: an object of name -> {w, h, solid}');
  else {
    for (const [k, v] of Object.entries(o.pieces as Record<string, unknown>)) {
      name(`pieces.${k}`, k);
      if (typeof v !== 'object' || v === null) {
        out.push(`pieces.${k}: an object`);
        continue;
      }
      const p = v as Record<string, unknown>;
      for (const side of ['w', 'h']) {
        if (p[side] !== undefined && (!Number.isInteger(p[side]) || (p[side] as number) < 1 || (p[side] as number) > 8)) out.push(`pieces.${k}.${side}: 1 to 8 tiles`);
      }
      if (p.solid !== undefined && typeof p.solid !== 'boolean') out.push(`pieces.${k}.solid: true or false`);
    }
  }
  const worlds = (o.worlds ?? {}) as Record<string, Record<string, unknown>>;
  for (const w of WORLDS) {
    if (typeof worlds[w] !== 'object' || worlds[w] === null) {
      out.push(`worlds.${w}: missing`);
      continue;
    }
    for (const part of ['trees', 'small', 'lone']) list(`worlds.${w}.${part}`, worlds[w]![part]);
  }
  const places = (o.places ?? {}) as Record<string, unknown>;
  const hub = (places.hub ?? {}) as Record<string, unknown>;
  name('places.hub.centre', hub.centre);
  if (!Array.isArray(hub.around)) out.push('places.hub.around: a list of [name, dx, dy]');
  else {
    hub.around.forEach((a, i) => {
      if (!Array.isArray(a) || a.length !== 3 || !Number.isInteger(a[1]) || !Number.isInteger(a[2]) || Math.abs(a[1] as number) > 3 || Math.abs(a[2] as number) > 3) out.push(`places.hub.around[${i}]: [name, dx, dy] within 3 of the stone`);
      else name(`places.hub.around[${i}]`, a[0]);
    });
  }
  const ruin = (places.ruin ?? {}) as Record<string, unknown>;
  for (const part of ['wall', 'pillar', 'arch']) name(`places.ruin.${part}`, ruin[part]);
  name('places.crossing', places.crossing);
  const doors = (o.doors ?? {}) as Record<string, Record<string, unknown>>;
  for (const form of DOOR_FORMS) {
    if (typeof doors[form] !== 'object' || doors[form] === null) {
      out.push(`doors.${form}: missing`);
      continue;
    }
    name(`doors.${form}.sprite`, doors[form]!.sprite);
    const hint = doors[form]!.hint;
    if (!Array.isArray(hint) || hint.length !== HINT_PIECES[form]) out.push(`doors.${form}.hint: ${HINT_PIECES[form]} names`);
    else hint.forEach((s, i) => name(`doors.${form}.hint[${i}]`, s));
  }
  const below = (o.below ?? {}) as Record<string, unknown>;
  for (const part of ['way_up', 'glow', 'bones', 'timber', 'pillar']) name(`below.${part}`, below[part]);
  list('below.stones', below.stones);
  if (kitSprites) for (const n of [...names].sort()) if (!kitSprites.has(n)) out.push(`${n}: not drawn in the kit`);
  return out;
}

let table: Looks | undefined;

/** The kit's sprite names, read once from its manifest. */
export function kitSprites(): Set<string> {
  const kit = JSON.parse(readFileSync(join(REPO_ROOT, 'content', 'kit', 'core', 'kit.json'), 'utf8')) as { kit: { sprites: Record<string, unknown> } };
  return new Set(Object.keys(kit.kit.sprites));
}

/** The looks table of the repo, checked against the kit once. */
export function looksOf(): Looks {
  if (!table) {
    const data = JSON.parse(readFileSync(join(REPO_ROOT, 'tools', 'gen', 'looks.json'), 'utf8')) as unknown;
    const problems = looksProblems(data, kitSprites());
    if (problems.length > 0) throw new Error(`looks.json: ${problems.join('; ')}`);
    table = data as Looks;
  }
  return table;
}

/** The footprint and the solidity of a piece: one tile a foot gets past when the table says nothing. */
export function pieceOf(looks: Looks, sprite: string): Piece {
  const p = looks.pieces[sprite] ?? {};
  return { w: p.w ?? 1, h: p.h ?? 1, solid: p.solid ?? false };
}

/** A prop of the piece at (x, y), the footprint's top left tile; `extra` overrides (a door is never solid, an id, a portal). */
export function piece(looks: Looks, sprite: string, x: number, y: number, extra: Partial<Prop> = {}): Prop {
  const def = pieceOf(looks, sprite);
  return { sprite: looks.kit + sprite, x, y, w: def.w, h: def.h, solid: def.solid, ...extra } as Prop;
}

/** The tiles of a piece's footprint at (x, y). */
export function footprint(looks: Looks, sprite: string, x: number, y: number): Tile[] {
  const def = pieceOf(looks, sprite);
  const tiles: Tile[] = [];
  for (let dy = 0; dy < def.h; dy++) for (let dx = 0; dx < def.w; dx++) tiles.push([x + dx, y + dy]);
  return tiles;
}

/** Whether tiles lie inside one chunk (a chunk file holds a prop whole, cut.ts). */
export function oneChunk(tiles: readonly Tile[], chunk = 64): boolean {
  const [fx, fy] = tiles[0] ?? [0, 0];
  return tiles.every(([x, y]) => Math.floor(x / chunk) === Math.floor(fx / chunk) && Math.floor(y / chunk) === Math.floor(fy / chunk));
}

/**
 * Whether a piece stands at (x, y): every tile of its footprint inside the land, under no other prop, not blocked,
 * passing `ground`, and the whole footprint inside one chunk.
 */
export function fits(looks: Looks, land: Land, sprite: string, x: number, y: number, ground: (x: number, y: number) => boolean, chunk = 64): boolean {
  const tiles = footprint(looks, sprite, x, y);
  if (!oneChunk(tiles, chunk)) return false;
  for (const [tx, ty] of tiles) {
    if (!land.inside(tx, ty) || land.blocked.has(land.key(tx, ty)) || land.propAt(tx, ty) || !ground(tx, ty)) return false;
  }
  return true;
}
