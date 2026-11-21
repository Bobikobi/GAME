/**
 * The still of the camera check (issue #664): reduced pictures standing on the kit's grass beside the adult human at the
 * game's own size, so the angle, the size and the ground contact can be judged by eye in the scene they will live in
 * (DECISIONS 2026-10-26, the 50 degree camera; 2026-11-02, figures too). One art pixel is one pixel before the zoom: the
 * human, the grass and a density-4 sprite share a grid (64 art pixels a tile).
 *
 * Each row is the human, then the candidates, standing on a common ground line (bottom-centred on their cells, as the
 * kit's own sprites are). A candidate is numbered in its corner so a verdict can name it. The zoom is the largest whole
 * number that keeps the still within `maxWidth`, nearest-neighbour, so no pixel is invented.
 *
 * Pure: pictures in, one picture out.
 */
import { PNG } from 'pngjs';

import { cropToAlpha } from './reduce.js';

export interface SceneInput {
  /** The kit's grass tiles (64 px), picked by position. */
  grass: readonly PNG[];
  /** The adult human's standing frame, any canvas; it is cut to its opaque box. */
  human: PNG;
  /** Reduced pictures, in the order they are numbered from 1. */
  items: readonly PNG[];
  /** Candidates per row (the human is one more cell). Default 5. */
  perRow?: number;
  /** The widest still in pixels after the zoom. Default 800 (phone size, the owner's screenshot rule). */
  maxWidth?: number;
}

const TILE = 64;
const MARGIN = 8;

/* a 3 by 5 digit font, one string a row, '#' is ink */
const DIGITS: Record<string, readonly string[]> = {
  '0': ['###', '# #', '# #', '# #', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'],
  '4': ['# #', '# #', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '# #', '###'],
  '7': ['###', '..#', '..#', '..#', '..#'],
  '8': ['###', '# #', '###', '# #', '###'],
  '9': ['###', '# #', '###', '..#', '###'],
};

function set(png: PNG, x: number, y: number, rgb: readonly [number, number, number]): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const i = (y * png.width + x) * 4;
  png.data[i] = rgb[0];
  png.data[i + 1] = rgb[1];
  png.data[i + 2] = rgb[2];
  png.data[i + 3] = 255;
}

/** A number in white with a dark edge, 3 by 5 pixels a digit, its top left at (x, y). */
export function drawNumber(png: PNG, n: number, x: number, y: number): void {
  const text = String(n);
  for (let d = 0; d < text.length; d += 1) {
    const glyph = DIGITS[text[d] as string] as readonly string[];
    for (let gy = 0; gy < 5; gy += 1) {
      for (let gx = 0; gx < 3; gx += 1) {
        if ((glyph[gy] as string)[gx] !== '#') continue;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) set(png, x + d * 4 + gx + dx, y + gy + dy, [27, 26, 46]);
      }
    }
  }
  for (let d = 0; d < text.length; d += 1) {
    const glyph = DIGITS[text[d] as string] as readonly string[];
    for (let gy = 0; gy < 5; gy += 1) for (let gx = 0; gx < 3; gx += 1) if ((glyph[gy] as string)[gx] === '#') set(png, x + d * 4 + gx, y + gy, [245, 244, 239]);
  }
}

function blit(dst: PNG, src: PNG, ox: number, oy: number): void {
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const s = (y * src.width + x) * 4;
      if ((src.data[s + 3] as number) < 128) continue;
      set(dst, ox + x, oy + y, [src.data[s] as number, src.data[s + 1] as number, src.data[s + 2] as number]);
    }
  }
}

export function zoomNearest(src: PNG, z: number): PNG {
  if (z === 1) return src;
  const out = new PNG({ width: src.width * z, height: src.height * z });
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      const s = ((Math.floor(y / z)) * src.width + Math.floor(x / z)) * 4;
      const o = (y * out.width + x) * 4;
      out.data[o] = src.data[s] as number;
      out.data[o + 1] = src.data[s + 1] as number;
      out.data[o + 2] = src.data[s + 2] as number;
      out.data[o + 3] = 255;
    }
  }
  return out;
}

export interface Scene { png: PNG; zoom: number; rows: number; width: number; height: number }

export function composeScene(input: SceneInput): Scene {
  const { grass, items } = input;
  if (grass.length === 0) throw new Error('the scene needs at least one grass tile');
  if (items.length === 0) throw new Error('the scene needs at least one picture');
  const perRow = input.perRow ?? 5;
  const maxWidth = input.maxWidth ?? 800;
  const human = cropToAlpha(input.human);
  if (human === null) throw new Error('the human frame is empty');
  const itemW = Math.max(...items.map((p) => p.width));
  const itemH = Math.max(...items.map((p) => p.height), human.height);
  const cellW = Math.max(TILE, itemW + MARGIN);
  const cellH = itemH + 2 * MARGIN;
  const rows = Math.ceil(items.length / perRow);
  const cols = Math.min(perRow, items.length) + 1;
  const width = Math.ceil((cols * cellW) / TILE) * TILE;
  const height = Math.ceil((rows * cellH) / TILE) * TILE;
  const scene = new PNG({ width, height });
  for (let ty = 0; ty * TILE < height; ty += 1) {
    for (let tx = 0; tx * TILE < width; tx += 1) blit(scene, grass[(tx * 7 + ty * 13) % grass.length] as PNG, tx * TILE, ty * TILE);
  }
  const rowTop = (r: number): number => Math.floor((height - rows * cellH) / 2) + r * cellH;
  for (let r = 0; r < rows; r += 1) {
    const ground = rowTop(r) + cellH - MARGIN;
    blit(scene, human, Math.floor((cellW - human.width) / 2), ground - human.height);
  }
  items.forEach((p, n) => {
    const r = Math.floor(n / perRow);
    const c = (n % perRow) + 1;
    const ground = rowTop(r) + cellH - MARGIN;
    const x = c * cellW + Math.floor((cellW - p.width) / 2);
    blit(scene, p, x, ground - p.height);
    drawNumber(scene, n + 1, c * cellW + 2, rowTop(r) + 2);
  });
  const zoom = Math.max(1, Math.min(4, Math.floor(maxWidth / width)));
  return { png: zoomNearest(scene, zoom), zoom, rows, width, height };
}
