/**
 * The text-grid route of `pnpm kit:gen` for ground tiles (DECISIONS 2026-10-18, the retry of
 * "Ground tiles from the image model come out on a finer grid than asked").
 *
 * Codex writes the tile as rows of palette letters, the way `sketches.ts` holds the kit's own
 * tiles, so the grid is exact by construction and no vote can lose a detail. What a letter grid
 * cannot promise is a seam, so the importer measures one.
 */
import { PNG } from 'pngjs';

import { nearestPaletteIndex } from './import.js';
import { CORE_PALETTE, hexToRgb } from './palette.js';
import { LETTER_PALETTE, PALETTE_LEGEND } from './sketches.js';

export type Grid = readonly string[];

const LETTERS = Object.keys(PALETTE_LEGEND);

/** The legend as the prompt spells it: one line per colour, `letter #hex`. */
export function legendText(): string {
  return LETTERS.map((letter) => `${letter} ${LETTER_PALETTE[PALETTE_LEGEND[letter] ?? 0]}`).join(', ');
}

/** The rows of a tile written as letters, ignoring fences and prose around them. */
export function parseGrid(text: string, width: number, height: number): Grid {
  const rows = text
    .split('\n')
    .map((l) => l.trim().replace(/^['"`]+|['",`]+$/g, ''))
    .filter((l) => /^[A-Za-z]{8,}$/.test(l));
  if (rows.length !== height) throw new Error(`the grid has ${rows.length} rows, not ${height}`);
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`row ${y} has ${row.length} letters, not ${width}`);
    for (const letter of row) if (PALETTE_LEGEND[letter] === undefined) throw new Error(`row ${y}: "${letter}" is not a palette letter`);
  });
  return rows;
}

/** A kit tile read back as letters: the style reference of a grid prompt. */
export function pngToGrid(image: { width: number; height: number; data: Uint8Array | Buffer }): Grid {
  const palette = CORE_PALETTE.map(hexToRgb);
  const letterOf = new Map(Object.entries(PALETTE_LEGEND).filter(([, index]) => index < CORE_PALETTE.length).map(([letter, index]) => [index, letter]));
  const rows: string[] = [];
  for (let y = 0; y < image.height; y += 1) {
    let row = '';
    for (let x = 0; x < image.width; x += 1) {
      const at = (y * image.width + x) * 4;
      row += letterOf.get(nearestPaletteIndex(image.data[at] ?? 0, image.data[at + 1] ?? 0, image.data[at + 2] ?? 0, palette)) ?? 'o';
    }
    rows.push(row);
  }
  return rows;
}

export function renderGrid(grid: Grid): PNG {
  const png = new PNG({ width: grid[0]?.length ?? 0, height: grid.length });
  grid.forEach((row, y) => {
    [...row].forEach((letter, x) => {
      const [r, g, b] = hexToRgb(LETTER_PALETTE[PALETTE_LEGEND[letter] ?? 0] ?? '#000000');
      const at = (y * png.width + x) * 4;
      png.data[at] = r;
      png.data[at + 1] = g;
      png.data[at + 2] = b;
      png.data[at + 3] = 255;
    });
  });
  return png;
}

/** How often two neighbouring pixels differ across the wrap, and inside the tile, along each axis. */
export function seamStats(grid: Grid): { wrapX: number; wrapY: number; insideX: number; insideY: number } {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const at = (x: number, y: number) => grid[y]?.[x];
  let wrapX = 0;
  let wrapY = 0;
  let insideX = 0;
  let insideY = 0;
  for (let y = 0; y < h; y += 1) {
    if (at(w - 1, y) !== at(0, y)) wrapX += 1;
    for (let x = 0; x < w - 1; x += 1) if (at(x, y) !== at(x + 1, y)) insideX += 1;
  }
  for (let x = 0; x < w; x += 1) {
    if (at(x, h - 1) !== at(x, 0)) wrapY += 1;
    for (let y = 0; y < h - 1; y += 1) if (at(x, y) !== at(x, y + 1)) insideY += 1;
  }
  return { wrapX: wrapX / h, wrapY: wrapY / w, insideX: insideX / (h * (w - 1)), insideY: insideY / (w * (h - 1)) };
}

/** A seam shows when the wrap differs far more often than the tile does inside. */
export function seamWarnings(grid: Grid): string[] {
  const s = seamStats(grid);
  const out: string[] = [];
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  if (s.wrapX > s.insideX + 0.15) out.push(`a seam across the left and right edges: ${pct(s.wrapX)} of the rows differ there, ${pct(s.insideX)} inside`);
  if (s.wrapY > s.insideY + 0.15) out.push(`a seam across the top and bottom edges: ${pct(s.wrapY)} of the columns differ there, ${pct(s.insideY)} inside`);
  return out;
}

/** Colours a tile uses beyond its own ramp are a warning: the table in STYLE.md section 3 gives a ground its ramp and two accents. */
export function colourCount(grid: Grid): number {
  return new Set(grid.join('')).size;
}

export function gridPrompt(opts: {
  what: string; width: number; height: number; detail?: string; reference: Grid | null; file: string;
}): string {
  const { what, width, height, reference, file } = opts;
  const detail = opts.detail === undefined || opts.detail.trim() === '' ? '' : ` It has ${opts.detail.trim()}.`;
  return [
    `Do not generate an image. Write a text file named ${file} in the current directory that holds a ${what}, a pixel-art ground tile for a top-down game, as exactly ${height} lines of exactly ${width} letters each, one letter per pixel, and nothing else in the file.`,
    `The letters are palette colours: ${legendText()}.`,
    `Use only the letters of one ramp plus at most two accent colours.${detail}`,
    `The tile repeats in all directions: its left column continues its right column and its top row continues its bottom row, so shapes that run off one edge come back in on the other and no seam shows.`,
    reference === null ? '' : `For the style, here is the game's present ${reference.length}x${reference[0]?.length ?? 0} tile of the same ground, written the same way (yours is finer, with more detail):\n${reference.join('\n')}`,
    `Count the lines and the letters before you save. Do not run any other program.`,
  ].filter((p) => p !== '').join(' ');
}
