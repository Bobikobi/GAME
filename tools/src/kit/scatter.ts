/**
 * The motif-scatter route of `pnpm kit:gen` for ground (DECISIONS 2026-10-18, the retry of "Ground
 * tiles as a text grid": a tile written whole repeats in rows).
 *
 * The model draws only small motifs (a tuft, a flower, a pebble, a ripple dash, a leaf) as exact grids
 * of palette letters. The layout is the script's: the ground is a seeded hash over art-pixel positions,
 * so a motif lands anywhere, across the edge of a tile, and never in rows. Two renderings of the same
 * field:
 * - `period` set: one tile that wraps on both axes (a kit fill tile, seamless by construction);
 * - `period` null: any rectangle of the endless field, where no two 64 px tiles are alike (the measure
 *   of STYLE.md section 3 on a phone frame).
 */
import { PNG } from 'pngjs';

import { type Grid, colourCount, legendText } from './gengrid.js';
import { hexToRgb } from './palette.js';
import { LETTER_PALETTE, PALETTE_LEGEND } from './sketches.js';

/** A clear pixel of a motif: the ground shows through it. */
export const CLEAR = '.';

/** STYLE.md section 3: a 64 px fill tile uses at least five colours. */
export const MIN_TILE_COLOURS = 5;

export interface MotifSpec {
  name: string;
  what: string;
  width: number;
  height: number;
  /** How often this motif is picked among the others (default 1). */
  weight?: number;
  detail?: string;
}

export interface Motif {
  name: string;
  weight: number;
  grid: Grid;
}

export interface Speckle {
  letter: string;
  /** Single pixels of this colour per tile-sized area. */
  per_tile: number;
}

/** The spec fields of an entry with `"route": "scatter"`. */
export interface ScatterEntry {
  width: number;
  height: number;
  /** The ground's own letter. */
  base?: string;
  /** Tiles to bake, each from its own seed (default 4, STYLE.md: at least four variants). */
  variants?: number;
  /** The name each baked variant takes, in order (the pool entry it becomes); a variant past the list is `<entry>_<n>`. */
  names?: string[];
  /** The entry whose authored motif files this one reads (tools/kit-gen/motifs/<entry>_<motif>.txt), when not its own. */
  motifs_from?: string;
  /** One motif at most per cell of this many art pixels, anywhere inside its cell's reach (default 16). */
  cell?: number;
  /** The share of cells that hold a motif (default 0.85). */
  chance?: number;
  speckles?: Speckle[];
  motifs?: MotifSpec[];
}

export interface Scatter {
  base: string;
  cell: number;
  chance: number;
  speckles: readonly Speckle[];
  /** Art pixels in one side of a tile: `per_tile` is counted over a tile's area. */
  tile: number;
  motifs: readonly Motif[];
  seed: string;
}

export interface Placed {
  /** Top-left in art pixels of the field; negative or past the period when it crosses an edge. */
  x: number;
  y: number;
  motif: Motif;
  flip: boolean;
}

const isLetter = (letter: unknown): boolean => typeof letter === 'string' && PALETTE_LEGEND[letter] !== undefined;

/** Why a scatter entry is wrong, or null. Checked when the spec is read, before any Codex time is spent. */
export function scatterProblem(entry: ScatterEntry): string | null {
  const cell = entry.cell ?? 16;
  if (!Number.isInteger(cell) || cell < 4) return 'cell must be an integer from 4';
  if (entry.width !== entry.height) return 'a scatter tile is square';
  if (entry.width % cell !== 0) return `cell ${cell} must divide the tile's ${entry.width}`;
  if (!isLetter(entry.base)) return 'base must be a palette letter';
  const variants = entry.variants ?? 4;
  if (entry.names !== undefined && !(Array.isArray(entry.names) && entry.names.every((n) => typeof n === 'string' && /^[a-z][a-z0-9_]*$/u.test(n)))) return 'names must be a list of lowercase names';
  if (!Number.isInteger(variants) || variants < 1 || variants > 16) return 'variants must be an integer from 1 to 16';
  const chance = entry.chance ?? 0.85;
  if (typeof chance !== 'number' || !(chance > 0 && chance <= 1)) return 'chance must be above 0 and at most 1';
  const speckles: unknown = entry.speckles ?? [];
  if (!Array.isArray(speckles)) return 'speckles must be a list';
  for (const s of speckles as Speckle[]) {
    if (!isLetter(s?.letter)) return 'a speckle needs a palette letter';
    if (!Number.isInteger(s.per_tile) || s.per_tile < 0 || s.per_tile > (entry.width * entry.height) / 4) return 'a speckle per_tile must be a whole number, at most a quarter of the tile';
  }
  const motifs: unknown = entry.motifs;
  if (!Array.isArray(motifs) || motifs.length === 0) return 'motifs must be a non-empty list';
  const seen = new Set<string>();
  for (const m of motifs as MotifSpec[]) {
    if (typeof m?.name !== 'string' || !/^[a-z0-9]+$/.test(m.name)) return 'a motif name is lowercase letters and digits';
    if (seen.has(m.name)) return `motif "${m.name}" appears twice`;
    seen.add(m.name);
    if (typeof m.what !== 'string' || m.what.trim() === '') return `motif "${m.name}" must say what it is`;
    for (const side of [m.width, m.height]) {
      if (!Number.isInteger(side) || side < 1 || side > cell) return `motif "${m.name}" is at most the ${cell} px cell on a side`;
    }
    if (m.weight !== undefined && !(typeof m.weight === 'number' && m.weight > 0)) return `motif "${m.name}" weight must be above 0`;
  }
  return null;
}

/** What the prompt asks Codex to write for one motif. */
export function motifPrompt(opts: { what: string; width: number; height: number; detail?: string; base: string; file: string }): string {
  const { what, width, height, base, file } = opts;
  const baseHex = LETTER_PALETTE[PALETTE_LEGEND[base] ?? 0];
  const detail = opts.detail === undefined || opts.detail.trim() === '' ? '' : ` It has ${opts.detail.trim()}.`;
  return [
    `Do not generate an image. Write a text file named ${file} in the current directory that holds ${what}, a small pixel-art motif that a script scatters over a top-down ground, as exactly ${height} lines of exactly ${width} characters each, one character per pixel, and nothing else in the file.`,
    `A dot (${CLEAR}) is a clear pixel: the ground shows through it, and the motif does not fill its frame. The other characters are palette colours: ${legendText()}.`,
    `The ground under it is ${base} ${baseHex}: draw the motif in other colours so that it reads on it. Use at most four colours and no outline.${detail}`,
    `Count the lines and the characters before you save. Do not run any other program.`,
  ].join(' ');
}

/** A motif written as characters; fences and blank lines are skipped, anything else must be a row. */
export function parseMotif(text: string, width: number, height: number): Grid {
  const rows = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('```'));
  if (rows.length !== height) throw new Error(`the motif has ${rows.length} rows, not ${height}`);
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`row ${y} has ${row.length} characters, not ${width}`);
    for (const ch of row) {
      if (ch !== CLEAR && PALETTE_LEGEND[ch] === undefined) throw new Error(`row ${y}: "${ch}" is neither a palette letter nor ${CLEAR}`);
    }
  });
  if (!rows.some((row) => [...row].some((ch) => ch !== CLEAR))) throw new Error('the motif is empty');
  return rows;
}

export function motifWarnings(grid: Grid): string[] {
  const all = grid.join('');
  const solid = [...all].filter((ch) => ch !== CLEAR);
  const out: string[] = [];
  if (solid.length > all.length * 0.8) out.push(`a blob: ${solid.length} of ${all.length} pixels are solid, a motif is a shape with the ground around it`);
  if (new Set(solid).size < 2) out.push('one colour only: a motif has a light and a dark side');
  return out;
}

/** The motif on transparency, for the gallery. */
export function renderMotif(grid: Grid): PNG {
  const png = new PNG({ width: grid[0]?.length ?? 0, height: grid.length });
  grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const index = PALETTE_LEGEND[ch];
      if (index === undefined) return;
      const [r, g, b] = hexToRgb(LETTER_PALETTE[index] ?? '#000000');
      png.data.set([r, g, b, 255], (y * png.width + x) * 4);
    });
  });
  return png;
}

/** 32-bit FNV-1a of a seed's text. */
export function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

function mixIn(h: number, v: number): number {
  let x = Math.imul(h ^ (v | 0), 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return x ^ (x >>> 16);
}

/** A number in [0, 1) that depends on the seed and three integers only. */
export function hash(seed: number, a: number, b: number, c: number): number {
  return (mixIn(mixIn(mixIn(seed ^ 0x9e3779b9, a), b), c) >>> 0) / 4294967296;
}

const mod = (n: number, m: number): number => ((n % m) + m) % m;

/**
 * Where the motifs of a rectangle of the field go. A cell holds a motif with the set chance, picked by
 * weight, mirrored by chance, and placed anywhere that keeps its middle inside the cell, so it may hang
 * over the cell's edge and over a tile's. With a `period` the field wraps: the rectangle is one
 * period square, x0 and y0 only roll it, and cell `n` is cell 0 again.
 */
export function place(s: Scatter, x0: number, y0: number, w: number, h: number, period: number | null): Placed[] {
  const seed = seedOf(s.seed);
  const total = s.motifs.reduce((sum, m) => sum + m.weight, 0);
  const cells = period === null ? null : period / s.cell;
  const from = (v: number): number => (cells === null ? Math.floor(v / s.cell) - 1 : 0);
  const to = (v: number, n: number | null): number => (n === null ? Math.floor(v / s.cell) + 1 : n - 1);
  const placed: Placed[] = [];
  for (let cy = from(y0); cy <= to(y0 + h, cells); cy += 1) {
    for (let cx = from(x0); cx <= to(x0 + w, cells); cx += 1) {
      if (hash(seed, cx, cy, 1) >= s.chance) continue;
      let pick = hash(seed, cx, cy, 2) * total;
      const motif = s.motifs.find((m) => (pick -= m.weight) < 0) ?? s.motifs[s.motifs.length - 1];
      if (motif === undefined) continue;
      const mw = motif.grid[0]?.length ?? 0;
      const mh = motif.grid.length;
      placed.push({
        x: cx * s.cell + Math.floor(hash(seed, cx, cy, 4) * s.cell) - Math.floor(mw / 2),
        y: cy * s.cell + Math.floor(hash(seed, cx, cy, 5) * s.cell) - Math.floor(mh / 2),
        motif,
        flip: hash(seed, cx, cy, 3) < 0.5,
      });
    }
  }
  return placed;
}

/** The rectangle as rows of letters: the ground, its single pixels, then the motifs over them. */
export function render(s: Scatter, x0: number, y0: number, w: number, h: number, period: number | null): Grid {
  const rows = Array.from({ length: h }, () => new Array<string>(w).fill(s.base));
  const area = s.tile * s.tile;
  s.speckles.forEach((speckle, i) => {
    const seed = seedOf(`${s.seed}:speckle${i}`);
    const density = speckle.per_tile / area;
    const at = (n: number, size: number): number => (period === null ? n : mod(n, size));
    for (let y = 0; y < h; y += 1) {
      const row = rows[y];
      if (row === undefined) continue;
      for (let x = 0; x < w; x += 1) if (hash(seed, at(x0 + x, w), at(y0 + y, h), 7) < density) row[x] = speckle.letter;
    }
  });
  for (const p of place(s, x0, y0, w, h, period)) {
    const mw = p.motif.grid[0]?.length ?? 0;
    p.motif.grid.forEach((line, my) => {
      for (let mx = 0; mx < mw; mx += 1) {
        const ch = line[p.flip ? mw - 1 - mx : mx];
        if (ch === undefined || ch === CLEAR) continue;
        const gx = period === null ? p.x + mx - x0 : mod(p.x + mx - x0, period);
        const gy = period === null ? p.y + my - y0 : mod(p.y + my - y0, period);
        const row = rows[gy];
        if (row !== undefined && gx >= 0 && gx < w) row[gx] = ch;
      }
    });
  }
  return rows.map((r) => r.join(''));
}

/** One kit fill tile: it wraps, so it tiles with itself and with every other variant of the ground. */
export function scatterTile(s: Scatter): Grid {
  return render(s, 0, 0, s.tile, s.tile, s.tile);
}

/** The seeds of a ground's variants: the same motifs and layout rules, another throw of the hash. */
export function variantsOf(s: Scatter, count: number): Scatter[] {
  return Array.from({ length: count }, (_, i) => ({ ...s, seed: `${s.seed}:${i + 1}` }));
}

/** The seam, measured exactly: the tile rolled by half a side is the same field seen through a window moved by half a side. */
export function wrapsExactly(s: Scatter): boolean {
  const half = s.tile / 2;
  const tile = scatterTile(s);
  const rolled = render(s, half, half, s.tile, s.tile, s.tile);
  return tile.every((_, y) => {
    const source = tile[(y + half) % s.tile] ?? '';
    return rolled[y] === source.slice(half) + source.slice(0, half);
  });
}

/** The tiles of a rectangle of the endless field, row by row. */
export function fieldTiles(s: Scatter, tilesX: number, tilesY: number): Grid[] {
  const frame = render(s, 0, 0, tilesX * s.tile, tilesY * s.tile, null);
  const tiles: Grid[] = [];
  for (let ty = 0; ty < tilesY; ty += 1) {
    for (let tx = 0; tx < tilesX; tx += 1) {
      tiles.push(frame.slice(ty * s.tile, (ty + 1) * s.tile).map((row) => row.slice(tx * s.tile, (tx + 1) * s.tile)));
    }
  }
  return tiles;
}

/** How many tiles repeat an earlier one pixel for pixel. */
export function repeatedTiles(tiles: readonly Grid[]): number {
  return tiles.length - new Set(tiles.map((t) => t.join('\n'))).size;
}

/** The largest share of the points that fall in one band of `band` consecutive coordinates of a wrapping axis. */
export function bandShare(coords: readonly number[], period: number, band: number): number {
  if (coords.length === 0) return 0;
  let best = 0;
  for (let start = 0; start < period; start += 1) {
    const inside = coords.filter((c) => mod(c - start, period) < band).length;
    best = Math.max(best, inside);
  }
  return best / coords.length;
}

/** Motifs standing in rows or in columns: a third or more of them on two adjacent lines of pixels. */
export function rowWarnings(placed: readonly Placed[], period: number): string[] {
  if (placed.length < 6) return [];
  const ys = placed.map((p) => p.y + Math.floor(p.motif.grid.length / 2));
  const xs = placed.map((p) => p.x + Math.floor((p.motif.grid[0]?.length ?? 0) / 2));
  const out: string[] = [];
  const rows = bandShare(ys, period, 2);
  const columns = bandShare(xs, period, 2);
  if (rows >= 1 / 3) out.push(`motifs in rows: ${Math.round(rows * 100)}% of them stand on two adjacent lines`);
  if (columns >= 1 / 3) out.push(`motifs in columns: ${Math.round(columns * 100)}% of them stand on two adjacent lines`);
  return out;
}

/** Every measure of STYLE.md section 3 on a ground's variants: the seam, the colours, the rows, the repeats. */
export function tileWarnings(s: Scatter, variants: number, frame: { x: number; y: number } | null): string[] {
  const out: string[] = [];
  const throws = variantsOf(s, variants);
  const tiles = throws.map(scatterTile);
  throws.forEach((v, i) => {
    const label = tiles.length > 1 ? `variant ${i + 1}: ` : '';
    if (!wrapsExactly(v)) out.push(`${label}a seam: the tile does not continue across its edges`);
    const colours = colourCount(tiles[i] ?? []);
    if (colours < MIN_TILE_COLOURS) out.push(`${label}${colours} colours, STYLE.md section 3 asks for at least ${MIN_TILE_COLOURS}`);
    out.push(...rowWarnings(place(v, 0, 0, v.tile, v.tile, v.tile), v.tile).map((w) => label + w));
  });
  const same = repeatedTiles(tiles);
  if (same > 0) out.push(`${same} of the ${tiles.length} variants repeat another pixel for pixel`);
  if (frame !== null) {
    const repeats = repeatedTiles(fieldTiles(s, frame.x, frame.y));
    if (repeats > 0) out.push(`on a ${frame.x}x${frame.y} tile frame of the field, ${repeats} tiles repeat an earlier one`);
  }
  return out;
}
