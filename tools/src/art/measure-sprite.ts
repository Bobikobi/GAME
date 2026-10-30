/**
 * The pick by measure for a sprite (a prop or an item: a drawn object on a clear ground), the counterpart of
 * `measureTile`. Numbers read off the pixels, so the builder can rank the drafts of one entry:
 * - size: the picture is the entry's size, or the kit would refuse the pick;
 * - ground: the corners are clear and the object does not fill the whole picture;
 * - pieces: at most six pieces of four pixels or more (a clump of pebbles is five), so no specks of a drawn scene;
 * - foot: the lowest solid row is within 8 rows of the bottom, so the sprite stands on its tile, and a quarter of the top row is not cut;
 * - ink is reported but does not fail a draft: `pnpm kit:ink` paints the edge after the pick (the 23.10 rule).
 * - palette and colours: the shared ramps, at least five colours;
 * - detail: the share of solid pixels that differ from the pixel beside them (flat is not rich, noise is not drawn).
 * `score` ranks the passing drafts: more colours, more detail, one clean piece. Whether a draft reads as the object
 * (a lamp, a well) is not a number: it is the owner's still, once per wave.
 */
import { PNG } from 'pngjs';

import type { Limits, TileMeasure } from './measure.js';
import { hexToRgb, paletteWithRamps } from '../kit/palette.js';

export const SPRITE_LIMITS = { minColours: 5, maxOffPalette: 0.02, minDetail: 0.12, maxDetail: 0.9, maxPieces: 6, footRows: 8, maxTopShare: 0.25, minClear: 0.05, maxClear: 0.95 } as const;

const key = (r: number, g: number, b: number): number => (r << 16) | (g << 8) | b;

/** The share of the solid pixels held by the largest 8-connected piece, and the number of pieces of 4 pixels or more. */
export function pieces(png: PNG): { largest: number; count: number } {
  const { width: w, height: h, data } = png;
  const solid = (i: number): boolean => (data[i * 4 + 3] ?? 0) >= 128;
  const seen = new Uint8Array(w * h);
  let total = 0;
  let largest = 0;
  let count = 0;
  for (let s = 0; s < w * h; s++) {
    if (!solid(s)) continue;
    total++;
    if (seen[s] === 1) continue;
    let size = 0;
    const stack = [s];
    seen[s] = 1;
    while (stack.length > 0) {
      const p = stack.pop() ?? 0;
      size++;
      const px = p % w;
      const py = (p - px) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (seen[q] === 1 || !solid(q)) continue;
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    if (size >= 4) count++;
    largest = Math.max(largest, size);
  }
  return { largest: total === 0 ? 0 : largest / total, count };
}

export function measureSprite(png: PNG, ramps: readonly string[], want: { width: number; height: number }, limits: Limits = {} as Limits): TileMeasure {
  void limits;
  const L = SPRITE_LIMITS;
  const { width, height, data } = png;
  const allowed = new Set(paletteWithRamps(ramps).map((hex) => key(...hexToRgb(hex))));
  const seen = new Set<number>();
  let solid = 0;
  let off = 0;
  let differs = 0;
  let lowest = -1;
  let topRow = 0;
  const alpha = (x: number, y: number): number => (x < 0 || y < 0 || x >= width || y >= height ? 0 : (data[(y * width + x) * 4 + 3] ?? 0));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if ((data[i + 3] ?? 0) < 128) continue;
      solid++;
      lowest = y;
      if (y === 0) topRow++;
      const k = key(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
      seen.add(k);
      if (!allowed.has(k)) off++;
      const r = (y * width + x + 1) * 4;
      const b = ((y + 1) * width + x) * 4;
      const nearer = (j: number, inside: boolean): boolean => inside && Math.abs((data[i] ?? 0) - (data[j] ?? 0)) + Math.abs((data[i + 1] ?? 0) - (data[j + 1] ?? 0)) + Math.abs((data[i + 2] ?? 0) - (data[j + 2] ?? 0)) > 0 && (data[j + 3] ?? 0) >= 128;
      if (nearer(r, x + 1 < width) || nearer(b, y + 1 < height)) differs++;
    }
  }
  const total = width * height;
  const clear = (total - solid) / total;
  const detail = solid === 0 ? 0 : differs / solid;
  const { largest, count } = pieces(png);
  const failures: string[] = [];
  if (width !== want.width || height !== want.height) failures.push(`size: ${width}x${height}, the entry is ${want.width}x${want.height}`);
  if (alpha(0, 0) >= 128 || alpha(width - 1, 0) >= 128) failures.push('ground: a top corner is solid');
  if (clear < L.minClear || clear > L.maxClear) failures.push(`ground: ${(100 * clear).toFixed(0)}% clear`);
  if (solid === 0) failures.push('empty: no solid pixel');
  if (count > L.maxPieces) failures.push(`pieces: ${count} pieces of 4 pixels or more, at most ${L.maxPieces}`);
  if (lowest < height - L.footRows) failures.push(`foot: the lowest solid row is ${lowest}, ${height - 1 - lowest} above the bottom`);
  if (topRow > L.maxTopShare * width) failures.push(`cut: ${topRow} solid pixels on the top row`);
  if (seen.size < L.minColours) failures.push(`colours: ${seen.size} < ${L.minColours}`);
  if (solid > 0 && off / solid > L.maxOffPalette) failures.push(`palette: ${(100 * off / solid).toFixed(1)}% outside the shared ramps`);
  if (detail < L.minDetail) failures.push(`detail: ${detail.toFixed(2)} < ${L.minDetail} (flat)`);
  if (detail > L.maxDetail) failures.push(`detail: ${detail.toFixed(2)} > ${L.maxDetail} (noise)`);
  // detail is best near 0.7, where the accepted rich sprites sit (0.42 to 0.87); colours count up to 32; each piece beyond the first costs 0.3: a stray speck is a defect
  const score = Math.min(seen.size, 32) / 32 + Math.max(0, 1 - Math.abs(detail - 0.7) / 0.7) + largest - 0.3 * Math.max(0, count - 1);
  return { width, height, clear, colours: seen.size, offPalette: solid === 0 ? 0 : off / solid, seam: 0, seamZ: 0, detail, echo: 0, failures, pass: failures.length === 0, score };
}
