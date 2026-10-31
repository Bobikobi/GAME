/**
 * The 16 px leftovers, measured (rich wave 3c): which sprites the world still draws from the old 16 px set, which are
 * 64 px native, and how much of the screen each one covers, so the next wave is chosen by what a player sees most.
 *
 * Three states, read from the files and not from the names:
 *   old16      the kit says density 1: the picture is 16 px per tile and the world scales it up.
 *   scaled16   the kit says density 4, but the PNG is made of uniform 4 x 4 blocks: a 16 px picture enlarged and relabelled.
 *   native64   density 4 and the PNG has detail inside its 4 x 4 blocks.
 *
 * Use is counted from the core map (content/core/map.json, the only ground in the repo): ground cells by legend sprite (a
 * variant `name_1..3` counts for its base), the edge strips of world.ts `drawEdges` (a quarter of a tile a side), the
 * crowns over the forest (one per 2 x 2 block, about), placed props (each by its footprint), restore slots (the before
 * and the after picture each cover the slot), items by the content that names them, and string references in the game's code.
 * "Cells per 100" is the footprint in tiles per 100 map tiles; a sprite with no footprint (an item, a code reference) ranks by
 * its reference count after those that have one.
 *
 * Reads only; `pnpm art:leftovers [--out FILE]` prints the table, or writes it to FILE.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { PNG } from 'pngjs';

import { ROOT } from './queue.js';

export type Kind = 'tile' | 'prop' | 'item' | 'char';
export type State = 'old16' | 'scaled16' | 'native64';

export interface SpriteInfo {
  /** The kit's id and the sprite's name in it: `core/base-kit` and `tiles/rubble`. */
  ref: string;
  kind: Kind;
  state: State;
  /** Share of aligned 4 x 4 blocks with one colour only, 0 to 1 (a density 1 sprite is not measured). */
  blocky?: number;
  w: number;
  h: number;
  frames: number;
}

export interface Use {
  /** Footprint in tiles over the whole map. */
  cells: number;
  /** Placements, references or sides, whichever the sprite is counted by. */
  count: number;
  /** Where the number comes from, for the table. */
  where: string[];
}

export interface Row extends SpriteInfo {
  use: Use;
  per100: number;
}

/** A PNG is "scaled" when at least this share of its aligned 4 x 4 blocks hold one colour. */
export const SCALED_AT = 0.97;

/** The share of aligned 4 x 4 blocks of a sheet that hold a single rgba value; transparent pixels all count as one. */
export function blockiness(png: PNG, block = 4): number {
  let uniform = 0;
  let total = 0;
  for (let by = 0; by + block <= png.height; by += block) {
    for (let bx = 0; bx + block <= png.width; bx += block) {
      total += 1;
      let first = -1;
      let same = true;
      for (let y = 0; y < block && same; y += 1) {
        for (let x = 0; x < block; x += 1) {
          const i = ((by + y) * png.width + bx + x) * 4;
          const a = png.data[i + 3]!;
          const v = a === 0 ? 0 : ((png.data[i]! << 24) | (png.data[i + 1]! << 16) | (png.data[i + 2]! << 8) | a) >>> 0 || 1;
          if (first < 0) first = v;
          else if (v !== first) {
            same = false;
            break;
          }
        }
      }
      if (same) uniform += 1;
    }
  }
  return total === 0 ? 1 : uniform / total;
}

/** The state of one sprite from its kit entry and picture. */
export function stateOf(density: number, blocky: number | undefined): State {
  if (density === 1) return 'old16';
  return blocky !== undefined && blocky >= SCALED_AT ? 'scaled16' : 'native64';
}

const kindOf = (name: string): Kind => (name.startsWith('tiles/') ? 'tile' : name.startsWith('items/') ? 'item' : name.startsWith('chars/') ? 'char' : 'prop');

interface KitFile {
  id?: string;
  kit: { sprites: Record<string, { file: string; w: number; h: number; frames?: number; density?: number }> };
}

/** Every sprite of every kit under content/kit, with its state. */
export function readSprites(root = ROOT): SpriteInfo[] {
  const out: SpriteInfo[] = [];
  const dir = join(root, 'content/kit');
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name, 'kit.json');
    if (!existsSync(path)) continue;
    const kit = JSON.parse(readFileSync(path, 'utf8')) as KitFile;
    const id = kit.id ?? `${name}/base-kit`;
    for (const [sprite, s] of Object.entries(kit.kit.sprites)) {
      const density = s.density ?? 1;
      const file = join(dir, name, s.file);
      const blocky = density === 4 && existsSync(file) ? blockiness(PNG.sync.read(readFileSync(file))) : undefined;
      out.push({ ref: `${id}:${sprite}`, kind: kindOf(sprite), state: stateOf(density, blocky), blocky, w: s.w, h: s.h, frames: s.frames ?? 1 });
    }
  }
  return out;
}

interface MapFile {
  map: {
    width: number;
    height: number;
    legend: Record<string, { sprite: string; tag: string }>;
    ground: string[];
    props: { sprite: string; w?: number; h?: number }[];
    slots?: { id: string; kind: string; w: number; h: number }[];
  };
}

const SIDES: readonly [string, number, number][] = [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]];

/** The pairs world.ts cuts per pixel, `a` first (so a strip is not drawn where they meet). */
const BLENDED: readonly [string, string][] = [['path', 'meadow'], ['sand', 'meadow'], ['grove', 'meadow'], ['path', 'sand'], ['path', 'grove'], ['sand', 'water'], ['meadow', 'water'], ['grove', 'water'], ['path', 'water']];

const baseOf = (sprite: string): string => sprite.replace(/_\d+$/, '');
const bare = (ref: string): string => ref.slice(ref.indexOf(':') + 1);
const kitOf = (ref: string): string => ref.slice(0, ref.indexOf(':'));

/** Walks every json under a folder, calling `visit` on each parsed file. */
function walkJson(dir: string, visit: (path: string, data: unknown) => void): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkJson(path, visit);
    else if (name.endsWith('.json')) visit(path, JSON.parse(readFileSync(path, 'utf8')));
  }
}

function strings(value: unknown, into: string[]): void {
  if (typeof value === 'string') into.push(value);
  else if (Array.isArray(value)) for (const v of value) strings(v, into);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, into);
}

/** Every `.ts` under a folder (not tests, not generated). */
function walkTs(dir: string, into: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== 'generated' && name !== 'node_modules' && name !== 'dist') walkTs(path, into);
    } else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) into.push(path);
  }
}

/** What the core map and the content and code around it use, per sprite ref (`kit:name`), the variants folded into their base. */
export function readUses(sprites: readonly SpriteInfo[], root = ROOT): { uses: Map<string, Use>; tiles: number } {
  const known = new Set(sprites.map((s) => s.ref));
  const uses = new Map<string, Use>();
  const add = (ref: string, cells: number, count: number, where: string): void => {
    // a variant is counted for the sprite it varies, when that exists
    const base = `${kitOf(ref)}:${baseOf(bare(ref))}`;
    const key = known.has(base) && base !== ref ? base : ref;
    const u = uses.get(key) ?? { cells: 0, count: 0, where: [] };
    u.cells += cells;
    u.count += count;
    if (!u.where.includes(where)) u.where.push(where);
    uses.set(key, u);
  };
  const sizeOf = (ref: string): { w: number; h: number } => sprites.find((s) => s.ref === ref) ?? { w: 16, h: 16 };
  const mapPath = join(root, 'content/core/map.json');
  const m = (JSON.parse(readFileSync(mapPath, 'utf8')) as MapFile).map;
  const tiles = m.width * m.height;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= m.width || y >= m.height ? undefined : m.legend[m.ground[y]?.[x] ?? '']);
  const kindAt = (x: number, y: number): string | undefined => {
    const t = at(x, y);
    return t === undefined ? undefined : baseOf(bare(t.sprite)) === 'tiles/sand' ? 'sand' : t.tag;
  };
  const blendedPair = (a: string | undefined, b: string | undefined): boolean => BLENDED.some(([p, q]) => (a === p && b === q) || (a === q && b === p));
  const isForest: boolean[] = [];
  for (let y = 0; y < m.height; y += 1) {
    for (let x = 0; x < m.width; x += 1) {
      const t = at(x, y);
      if (!t) continue;
      add(t.sprite, 1, 1, 'ground');
      const forestHere = t.sprite.endsWith('tiles/forest');
      isForest[y * m.width + x] = forestHere;
      // the edge strips of world.ts drawEdges: a strip is a side of a tile, a quarter of its area
      const kit = kitOf(t.sprite);
      const floor = t.tag === 'ruin' && baseOf(bare(t.sprite)) === 'tiles/ruin_floor';
      const kind = t.tag === 'water' ? 'bank' : t.tag === 'path' || t.tag === 'town' || t.tag === 'riverbank' || floor ? 'fringe' : t.tag === 'meadow' ? 'worn' : undefined;
      if (!kind) continue;
      for (const [side, dx, dy] of SIDES) {
        const near = at(x + dx, y + dy);
        if (!near) continue;
        const blended = blendedPair(kindAt(x, y), kindAt(x + dx, y + dy));
        if (blended && ((kind === 'fringe' && (t.tag === 'path' || t.tag === 'riverbank')) || (kind === 'worn' && near.tag === 'path') || (kind === 'bank' && ['meadow', 'riverbank', 'grove', 'path'].includes(near.tag)) || (t.tag === 'riverbank' && near.tag === 'water'))) continue;
        let ref: string | undefined;
        if (kind === 'bank' && near.tag !== 'water') ref = `${kit}:tiles/bank_${side}`;
        else if (kind === 'fringe' && (near.tag === 'meadow' || near.tag === 'grove')) ref = `${kit}:tiles/fringe_${side}`;
        else if (kind === 'worn' && near.tag === 'path') ref = `${kit}:tiles/worn_${side}`;
        else if (t.tag === 'riverbank' && near.tag === 'water') ref = `${kit}:tiles/shore_${side}`;
        if (ref) add(ref, 0.25, 1, 'edge strip');
      }
    }
  }
  // the crowns over the forest: a greedy scan for free 2 x 2 blocks, as world.ts does without its stagger pass
  const taken = new Set<number>();
  const free = (x: number, y: number): boolean => isForest[y * m.width + x] === true && !taken.has(y * m.width + x);
  let crowns = 0;
  for (let y = 0; y + 1 < m.height; y += 1) {
    for (let x = 0; x + 1 < m.width; ) {
      if (free(x, y) && free(x + 1, y) && free(x, y + 1) && free(x + 1, y + 1)) {
        for (const [px, py] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]] as const) taken.add(py * m.width + px);
        crowns += 1;
        x += 2;
      } else x += 1;
    }
  }
  const forestSprite = Object.values(m.legend).find((t) => t.sprite.endsWith('tiles/forest'))?.sprite;
  if (forestSprite && crowns > 0) {
    // the three crowns are drawn in turn; each covers 2 x 2 tiles
    for (const n of [1, 2, 3]) add(`${kitOf(forestSprite)}:props/canopy_${n}`, (crowns * 4) / 3, crowns / 3, 'forest crowns');
  }
  for (const p of m.props) {
    const own = sizeOf(p.sprite);
    add(p.sprite, (p.w ?? Math.ceil(own.w / 16)) * (p.h ?? Math.ceil(own.h / 16)), 1, 'map props');
  }
  // restores: the picture before and after each slot, over the slot's area (a slot is drawn with one of the two at a time)
  const slotArea = new Map((m.slots ?? []).map((s) => [s.id, s.w * s.h]));
  const content = join(root, 'content');
  walkJson(content, (path, data) => {
    const rel = relative(content, path);
    if (rel.startsWith('kit/') || rel === 'core/map.json' || rel === 'board.json' || rel === 'values.lock.json') return;
    const d = data as { type?: string; restore?: { place?: { slot?: string }; before?: string; after?: string } };
    if (d.type === 'restore' && d.restore?.place?.slot) {
      const area = slotArea.get(d.restore.place.slot) ?? 1;
      for (const ref of [d.restore.before, d.restore.after]) if (ref) add(ref, area / 2, 1, 'restore');
      return;
    }
    const found: string[] = [];
    strings(data, found);
    for (const s of found) if (/^[\w-]+\/[\w-]+:(tiles|props|items|chars)\/[\w-]+$/.test(s)) add(s, 0, 1, rel.startsWith('core/items') || rel.includes('/items/') ? 'item data' : 'content');
  });
  // the game's code names a sprite by string: counted as references, no footprint
  const files: string[] = [];
  walkTs(join(root, 'game/src'), files);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const mm of text.matchAll(/['"`]((?:tiles|props|items)\/[a-z_0-9]+)/g)) {
      const name = mm[1]!;
      for (const s of sprites) if (s.ref.endsWith(`:${name}`)) add(s.ref, 0, 1, 'code');
    }
  }
  return { uses, tiles };
}

/** The sprites that are one picture drawn in turn (`canopy_1..3`, no `canopy` beside them) rank as one row named `canopy_*`. */
const groupOf = (ref: string, known: ReadonlySet<string>): string => {
  const mm = /^(.*)_(\d+)$/.exec(ref);
  return mm && !known.has(mm[1]!) ? `${mm[1]}_*` : ref;
};

/** Every sprite with its use, the old and the scaled first, ranked by footprint per 100 map tiles, then by references. */
export function rank(sprites: readonly SpriteInfo[], uses: ReadonlyMap<string, Use>, tiles: number): Row[] {
  const known = new Set(sprites.map((s) => s.ref));
  const merged = new Map<string, Row>();
  for (const s of sprites) {
    if (s.kind === 'char') continue;
    const use = uses.get(s.ref) ?? { cells: 0, count: 0, where: [] };
    const key = groupOf(s.ref, known);
    const row = merged.get(key);
    if (!row) {
      merged.set(key, { ...s, ref: key, use: { ...use, where: [...use.where] }, per100: 0 });
      continue;
    }
    row.use.cells += use.cells;
    row.use.count += use.count;
    for (const w of use.where) if (!row.use.where.includes(w)) row.use.where.push(w);
    if (s.state === 'old16' || (s.state === 'scaled16' && row.state === 'native64')) row.state = s.state;
  }
  return [...merged.values()]
    .map((r) => ({ ...r, per100: (r.use.cells / tiles) * 100 }))
    .sort((a, b) => stateOrder(a.state) - stateOrder(b.state) || b.per100 - a.per100 || b.use.count - a.use.count || a.ref.localeCompare(b.ref));
}

const stateOrder = (s: State): number => (s === 'native64' ? 1 : 0);

const num = (n: number): string => (n === 0 ? '0' : n >= 10 ? n.toFixed(0) : n.toFixed(1));

/** The markdown report: the ranked leftovers, then the counts by state. */
export function report(rows: readonly Row[], tiles: number, charCount: { old16: number; native64: number }): string {
  const left = rows.filter((r) => r.state !== 'native64');
  const native = rows.filter((r) => r.state === 'native64');
  const lines = [
    '# 16 px leftovers',
    '',
    `Measured by \`pnpm art:leftovers\` on the core map (${tiles} tiles). State is read from the kit's density and from the PNG (a sprite is "scaled16" when ${Math.round(SCALED_AT * 100)}% or more of its 4 x 4 blocks hold one colour). "Cells per 100" is the footprint in tiles per 100 map tiles; "refs" counts placements, edge sides, content and code references.`,
    '',
    `Tiles, props and items: ${left.length} still 16 px (${left.filter((r) => r.state === 'old16').length} old16, ${left.filter((r) => r.state === 'scaled16').length} scaled16), ${native.length} native 64. Characters (${charCount.old16} old16, ${charCount.native64} native64) are the wave's own list and not ranked here.`,
    '',
    '| # | sprite | state | size | cells per 100 | refs | where |',
    '|---|---|---|---|---|---|---|',
    ...left.map((r, i) => `| ${i + 1} | ${bare(r.ref)} | ${r.state} | ${r.w}x${r.h}${r.frames > 1 ? ` x${r.frames}` : ''} | ${num(r.per100)} | ${Math.round(r.use.count)} | ${r.use.where.join(', ') || 'nothing draws it'} |`),
    '',
    '## Already native 64, for scale',
    '',
    '| sprite | cells per 100 | refs |',
    '|---|---|---|',
    ...native.filter((r) => r.use.cells > 0).sort((a, b) => b.per100 - a.per100).slice(0, 12).map((r) => `| ${bare(r.ref)} | ${num(r.per100)} | ${Math.round(r.use.count)} |`),
    '',
  ];
  return lines.join('\n');
}

/** The whole run: read, count, rank, write up. */
export function leftoversReport(root = ROOT): { text: string; rows: Row[] } {
  const sprites = readSprites(root);
  const { uses, tiles } = readUses(sprites, root);
  const rows = rank(sprites, uses, tiles);
  const chars = sprites.filter((s) => s.kind === 'char');
  const text = report(rows, tiles, { old16: chars.filter((c) => c.state === 'old16').length, native64: chars.filter((c) => c.state !== 'old16').length });
  return { text, rows };
}
