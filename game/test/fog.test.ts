/**
 * A slot's fog (src/fog.ts): the pixels the game bakes, read one by one. The pale squares of v0.1.4
 * were the fog tile drawn as a straight-edged rectangle, so the edge must thin out and the corners go.
 */
import { describe, expect, test } from 'vitest';

import { FOG_FEATHER, FOG_TILE, fogPixels } from '../src/fog';

/** A fog tile of one opaque pale colour, so a kept pixel and a cut pixel tell apart by alpha alone. */
const TILE = new Uint8ClampedArray(4 * FOG_TILE * FOG_TILE).fill(255);

const COLS = 64;
const ROWS = 48;
const px = fogPixels(TILE, COLS, ROWS, 0);
const W = COLS + 2 * FOG_FEATHER;
const H = ROWS + 2 * FOG_FEATHER;
const kept = (x: number, y: number): boolean => px[4 * (y * W + x) + 3] !== 0;

/** The share of kept pixels in a column of the slot, over the slot's own rows. */
function density(x: number): number {
  let n = 0;
  for (let y = FOG_FEATHER; y < FOG_FEATHER + ROWS; y++) if (kept(x, y)) n++;
  return n / ROWS;
}

describe('fogPixels', () => {
  test('covers the slot and the feather past it', () => {
    expect(px.length).toBe(4 * W * H);
  });

  test('keeps the centre whole', () => {
    for (let y = H / 2 - 4; y < H / 2 + 4; y++) for (let x = W / 2 - 4; x < W / 2 + 4; x++) expect(kept(x, y)).toBe(true);
  });

  test('cuts the corners, so no pixel of the box is a straight corner', () => {
    for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1], [FOG_FEATHER, FOG_FEATHER], [W - 1 - FOG_FEATHER, H - 1 - FOG_FEATHER]]) {
      expect(kept(x!, y!)).toBe(false);
    }
  });

  test('thins the edge in steps: the density falls from the centre to the outer edge, never a straight cut', () => {
    const mid = W / 2;
    const ladder = [mid, FOG_FEATHER + 4, FOG_FEATHER, FOG_FEATHER - 3, 0].map(density);
    expect(ladder[0]).toBeGreaterThan(0.8);
    for (let i = 1; i < ladder.length; i++) expect(ladder[i]!).toBeLessThanOrEqual(ladder[i - 1]!);
    // a column on the slot's own edge is partly kept: thinned, neither solid nor cut
    expect(density(FOG_FEATHER)).toBeGreaterThan(0.1);
    expect(density(FOG_FEATHER)).toBeLessThan(0.9);
    expect(density(0)).toBe(0);
  });

  test('a pixel is the tile\'s own or clear, never a blend', () => {
    for (let i = 3; i < px.length; i += 4) expect([0, 255]).toContain(px[i]);
  });

  test('the offset shifts the tile under the same shape', () => {
    const striped = new Uint8ClampedArray(4 * FOG_TILE * FOG_TILE);
    for (let y = 0; y < FOG_TILE; y++) for (let x = 0; x < FOG_TILE; x++) striped.set([x, 0, 0, 255], 4 * (y * FOG_TILE + x));
    const a = fogPixels(striped, COLS, ROWS, 0);
    const b = fogPixels(striped, COLS, ROWS, 16);
    const at = 4 * ((H / 2) * W + W / 2);
    expect(a[at]).toBe(((W / 2) % FOG_TILE));
    expect(b[at]).toBe(((W / 2 + 16) % FOG_TILE));
    for (let i = 3; i < a.length; i += 4) expect(a[i] === 0).toBe(b[i] === 0);
  });
});
