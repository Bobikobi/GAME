/**
 * The soft joins of the ground at 64 px (the owner's "no" on rich wave 1 of 30.10: the path was cut off too sharply).
 *
 * Two overlays per side, drawn by the world over a tile that touches another ground (world.ts `drawEdges`):
 * - `fringe_<side>`: grass creeping over the edge of a path (or a cobble, a sand, a ruin floor) tile: tufts of
 *   olive and a few dry blades overlap the dirt by a few pixels, the edge wandering from column to column;
 * - `worn_<side>`: the meadow's own tile worn to dirt next to a path: a few pebbles and dithered earth pixels
 *   reach into the grass, fading out over a quarter of the tile.
 * Both are built for the north side from a seeded hash and turned for the others, so the output is the same every
 * run. Colours are the shared moss and wood ramps. `pnpm art:edges` writes the PNGs and their kit.json entries.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { PNG } from 'pngjs';

import { LETTER_PALETTE, PALETTE_LEGEND } from '../kit/sketches.js';
import { hexToRgb } from '../kit/palette.js';
import { ROOT } from './queue.js';
import { KIT_JSON, withSprite } from './pick.js';

export const SIDES = ['n', 'e', 's', 'w'] as const;
export type Side = (typeof SIDES)[number];
export type EdgeKind = 'fringe' | 'worn';

const SIZE = 64;

function h(seed: number, a: number, b: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(a + 7, 0xc2b2ae35) ^ Math.imul(b + 13, 0x27d4eb2f);
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d);
  x ^= x >>> 12;
  return (x >>> 0) / 4294967296;
}

/** A smooth 1-D wander along the edge: value noise over `period` pixels. */
function wander(seed: number, x: number, period: number): number {
  const i = Math.floor(x / period);
  const t = (x / period) - i;
  const s = t * t * (3 - 2 * t);
  const a = h(seed, i, 0);
  const b = h(seed, i + 1, 0);
  return a + (b - a) * s;
}

const pick = (letters: string, seed: number, x: number, y: number): string => letters[Math.floor(h(seed, x, y) * letters.length)] ?? letters[0] ?? 'o';

/** The north-side overlay as rows of letters ('.' is clear). */
export function edgeRows(kind: EdgeKind, seed = 1): string[] {
  const rows = Array.from({ length: SIZE }, () => new Array<string>(SIZE).fill('.'));
  const grass = kind === 'fringe';
  for (let x = 0; x < SIZE; x += 1) {
    // how far the overlay reaches down this column, and how far its dithered fringe goes beyond that
    const reach = grass ? 3 + wander(seed, x, 15) * 15 + wander(seed + 1, x, 5) * 6 : 0 + wander(seed, x, 14) * 5 + wander(seed + 1, x, 5) * 3;
    const fade = grass ? 9 : 7;
    for (let y = 0; y < reach + fade && y < SIZE; y += 1) {
      const row = rows[y];
      if (row === undefined) continue;
      if (y < reach) {
        if (grass) row[x] = y === 0 || h(seed, x, y) < 0.78 ? pick('3332244', seed + 2, x, y) : pick('34', seed + 3, x, y);
        else if (h(seed + 4, x, y) < 0.4) row[x] = pick('wwvx', seed + 5, x, y);
      } else {
        const left = (y - reach) / fade;
        // dithered: a checker that thins out, then single stray pixels
        const keep = (grass ? 1 : 0.55) * ((x + y) % 2 === 0 ? 0.85 - left * 0.85 : 0.35 - left * 0.35);
        if (h(seed + 6, x, y) < keep) row[x] = grass ? pick('3344', seed + 7, x, y) : pick('wvxw', seed + 8, x, y);
      }
    }
  }
  if (grass) {
    // blades: a few thin tips (light green, dry tan) standing out of the edge
    for (let x = 1; x < SIZE - 1; x += 1) {
      if (h(seed + 9, x, 0) > 0.22) continue;
      const base = Math.floor(3 + wander(seed, x, 15) * 15 + wander(seed + 1, x, 5) * 6);
      const len = 2 + Math.floor(h(seed + 10, x, 1) * 6);
      const tip = h(seed + 11, x, 2) < 0.4 ? 'y' : h(seed + 12, x, 2) < 0.5 ? 'e' : '4';
      for (let k = 0; k < len; k += 1) {
        const y = base + k;
        const row = rows[y];
        if (row !== undefined && y < SIZE) row[x] = k === len - 1 ? tip : pick('34', seed + 13, x, k);
      }
    }
  } else {
    // pebbles worn out of the earth
    for (let x = 2; x < SIZE - 3; x += 1) {
      if (h(seed + 14, x, 0) > 0.05) continue;
      const y = 2 + Math.floor(h(seed + 15, x, 1) * 8);
      const row = rows[y];
      const below = rows[y + 1];
      if (row !== undefined && below !== undefined) {
        row[x] = 'G';
        row[x + 1] = 'g';
        below[x] = 'g';
        below[x + 1] = 'd';
      }
    }
  }
  // no see-through pocket inside the overlay (the kit's hole check): fill what the outside cannot reach
  const seen = Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(false));
  const stack: [number, number][] = [];
  const visit = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || seen[y]?.[x] === true || rows[y]?.[x] !== '.') return;
    (seen[y] as boolean[])[x] = true;
    stack.push([x, y]);
  };
  for (let i = 0; i < SIZE; i += 1) [[i, 0], [i, SIZE - 1], [0, i], [SIZE - 1, i]].forEach(([x, y]) => visit(x as number, y as number));
  while (stack.length > 0) {
    const [x, y] = stack.pop() as [number, number];
    visit(x + 1, y); visit(x - 1, y); visit(x, y + 1); visit(x, y - 1);
  }
  for (let y = 0; y < SIZE; y += 1) for (let x = 0; x < SIZE; x += 1) if (rows[y]?.[x] === '.' && seen[y]?.[x] !== true) (rows[y] as string[])[x] = grass ? '3' : 'w';
  return rows.map((r) => r.join(''));
}

/** The overlay turned to a side: n as drawn, s flipped down, w and e the same shapes on their own edge. */
export function turn(rows: readonly string[], side: Side): string[] {
  const at = (x: number, y: number): string => rows[y]?.[x] ?? '.';
  const out: string[] = [];
  for (let y = 0; y < SIZE; y += 1) {
    let line = '';
    for (let x = 0; x < SIZE; x += 1) {
      line += side === 'n' ? at(x, y) : side === 's' ? at(x, SIZE - 1 - y) : side === 'w' ? at(y, x) : at(SIZE - 1 - y, x);
    }
    out.push(line);
  }
  return out;
}

export function edgePng(kind: EdgeKind, side: Side): PNG {
  const rows = turn(edgeRows(kind, kind === 'fringe' ? 101 : 202), side);
  const png = new PNG({ width: SIZE, height: SIZE });
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const index = PALETTE_LEGEND[ch];
      if (index === undefined) return;
      const [r, g, b] = hexToRgb(LETTER_PALETTE[index] ?? '#000000');
      png.data.set([r, g, b, 255], (y * SIZE + x) * 4);
    });
  });
  return png;
}

/** Writes the eight PNGs, their kit.json entries and one manifest line each. */
export function writeEdges(root = ROOT, today = new Date().toISOString().slice(0, 10)): string[] {
  const kitPath = join(root, KIT_JSON);
  const manifest = join(root, 'tools/kit-gen/rich-wave.manifest.jsonl');
  let kit = readFileSync(kitPath, 'utf8');
  const wrote: string[] = [];
  for (const kind of ['fringe', 'worn'] as const) {
    for (const side of SIDES) {
      const id = `tiles/${kind}_${side}`;
      const file = join(root, 'content/kit/core', `${id}.png`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, PNG.sync.write(edgePng(kind, side)));
      const before = existsSync(manifest) ? readFileSync(manifest, 'utf8') : '';
      const lead = before === '' || before.endsWith('\n') ? '' : '\n';
      const number = (before + lead).split('\n').filter((l) => l.trim() !== '').length + 1;
      appendFileSync(manifest, `${lead}${JSON.stringify({ sprite: id, name: `${kind}_${side}`, spec: 'tools/src/art/edges.ts', drawer: 'script', ref: id, what: kind === 'fringe' ? 'grass creeping over the edge of a path' : 'worn earth reaching into the meadow', ramps: kind === 'fringe' ? ['moss', 'green', 'wood'] : ['wood', 'grey'], picked: `script, ${today}` })}\n`);
      kit = withSprite(kit, id, { file: `${id}.png`, w: SIZE, h: SIZE, density: 4, ramps: kind === 'fringe' ? ['moss', 'green', 'wood'] : ['wood', 'grey'], source: { spec: 'tools/src/art/edges.ts', manifest: `tools/kit-gen/rich-wave.manifest.jsonl:${number}` } });
      wrote.push(id);
    }
  }
  writeFileSync(kitPath, kit);
  return wrote;
}
