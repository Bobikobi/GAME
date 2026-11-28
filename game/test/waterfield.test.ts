import { describe, expect, test } from 'vitest';

import { baseLumaPixels, distanceTo, fillEdge, fieldPixels, labelComponents, rampOfRadius, rampPixels, waterFieldOf, type Footprint } from '../src/waterfield.js';

const ART = 4;

/** a scene-pixel mask of `sw` x `sh` art pixels' worth of water, with land boxes [x0, y0, x1, y1] (art pixels, inclusive) cut out of it */
function lake(aw: number, ah: number, land: number[][]): { mask: Uint8Array; sw: number; sh: number } {
  const sw = aw * ART;
  const sh = ah * ART;
  const mask = new Uint8Array(sw * sh).fill(1);
  for (const [x0, y0, x1, y1] of land as [number, number, number, number][]) {
    for (let y = y0 * ART; y < (y1 + 1) * ART; y++) for (let x = x0 * ART; x < (x1 + 1) * ART; x++) mask[y * sw + x] = 0;
  }
  return { mask, sw, sh };
}

describe('the distance field', () => {
  test('is the exact Euclidean distance to the nearest set pixel', () => {
    const w = 9;
    const h = 7;
    const from = new Uint8Array(w * h);
    from[3 * w + 2] = 1;
    const d = distanceTo(from, w, h);
    expect(d[3 * w + 2]).toBe(0);
    expect(d[3 * w + 5]).toBeCloseTo(3, 5);
    expect(d[6 * w + 5]).toBeCloseTo(Math.hypot(3, 3), 5);
    expect(d[0]).toBeCloseTo(Math.hypot(2, 3), 5);
  });

  test('with nothing to measure from, every pixel is far', () => {
    expect(distanceTo(new Uint8Array(12), 4, 3)[5]).toBeGreaterThan(1000);
  });

  test('components are 8-connected', () => {
    const m = new Uint8Array(16);
    m[0] = 1;
    m[5] = 1; // diagonal neighbour of 0 in a 4-wide grid
    m[15] = 1;
    const { label, count } = labelComponents(m, 4, 4);
    expect(count).toBe(2);
    expect(label[0]).toBe(label[5]);
    expect(label[15]).not.toBe(label[0]);
  });
});

describe('the water field of a pond', () => {
  // a 40 x 30 art pixel frame: a bank along the left (x 0-9), a bank along the bottom (y 26-29), an island (x 22-25, y 12-15), water elsewhere, open to the top and right
  const { mask, sw, sh } = lake(40, 30, [[0, 0, 9, 29], [0, 26, 39, 29], [22, 12, 25, 15]]);
  const f = waterFieldOf(mask, sw, sh, ART, []);
  const at = (a: Float32Array, x: number, y: number): number => a[y * f.w + x]!;

  test('the art grid is the scene over the art size and water is where half the block is water', () => {
    expect([f.w, f.h]).toEqual([40, 30]);
    expect(f.water[5 * f.w + 20]).toBe(1);
    expect(f.water[5 * f.w + 3]).toBe(0);
  });

  test('the bank is the land that touches the frame border, the island is a thing', () => {
    expect(at(f.dShore, 10, 5)).toBeCloseTo(1, 5); // one pixel right of the left bank
    expect(at(f.dThing, 21, 13)).toBeCloseTo(1, 5);
    expect(at(f.dThing, 10, 5)).toBeGreaterThan(10); // the island is far from the left bank's edge
    expect(at(f.dShore, 21, 13)).toBeGreaterThan(5); // and the bank is not what the island is
  });

  test('any is the nearer of the two', () => {
    for (const [x, y] of [[12, 5], [21, 13], [18, 20], [30, 24]] as const) {
      expect(at(f.dAny, x, y)).toBeCloseTo(Math.min(at(f.dShore, x, y), at(f.dThing, x, y)), 5);
    }
  });

  test('toward a side that is water to the frame edge there is no bank: the distance only counts land inside the frame', () => {
    expect(at(f.dShore, 39, 2)).toBeGreaterThan(15); // the right edge, far from the left bank and the bottom bank
    expect(at(f.dShore, 30, 0)).toBeGreaterThan(15); // the top edge
  });

  test('a rock standing in the water is a thing by its footprint, not a bank, even where the water mask is whole under it', () => {
    const m2 = lake(40, 30, [[0, 0, 4, 29]]);
    const opaque = new Uint8Array(8 * 8).fill(1);
    const rock: Footprint = { x0: 80, y0: 48, w: 8, h: 8, opaque }; // art pixels (20..21, 12..13)
    const g = waterFieldOf(m2.mask, m2.sw, m2.sh, ART, [rock]);
    expect(g.dThing[13 * g.w + 23]).toBeCloseTo(2, 5);
    expect(g.dShore[13 * g.w + 23]).toBeGreaterThan(10);
    expect(g.dThing[5 * g.w + 30]).toBeGreaterThan(7);
    // the field's pixels for the shader: quarter art pixels, 255 alpha on water
    const px = fieldPixels(g);
    expect(px[(13 * g.w + 23) * 4 + 1]).toBe(8);
    expect(px[(13 * g.w + 23) * 4 + 3]).toBe(255);
    expect(px[(5 * g.w + 1) * 4 + 3]).toBe(0);
  });
});

describe('the base brightness of the painting', () => {
  test('is the mean encoded luma of each art pixel\'s block', () => {
    // 8 x 4 scene px, art 4: left block black, right block white with one black column
    const sw = 8;
    const sh = 4;
    const plate = new Uint8ClampedArray(sw * sh * 4);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const v = x < 4 ? 0 : x === 4 ? 0 : 255;
        plate.set([v, v, v, 255], (y * sw + x) * 4);
      }
    }
    const px = baseLumaPixels(plate, sw, sh, ART, 2, 1);
    expect(px[0]).toBe(0);
    expect(px[4]).toBe(Math.round((3 * 255 * (0.2126 + 0.7152 + 0.0722)) / 4));
    expect(px[3]).toBe(255);
  });
});

describe('the frame margin of the water bed', () => {
  test('is filled from the nearest pixel inside, so no bank runs round the picture', () => {
    const w = 20;
    const h = 14;
    const m = new Uint8Array(w * h);
    for (let y = 3; y < h - 3; y++) for (let x = 3; x < w - 3; x++) m[y * w + x] = x > 12 ? 0 : 1; // water inside on the left, land on the right
    fillEdge(m, w, h, 3);
    expect(m[0]).toBe(1); // the corner copies water
    expect(m[5 * w + 0]).toBe(1);
    expect(m[0 * w + 18]).toBe(0); // above the land stays land
    expect(m[(h - 1) * w + 5]).toBe(1);
  });
});

describe('the depth ramp by geometry (order v11)', () => {
  test('a marsh channel is shallower than a pond and a pond than a bay: the reach and the strength grow with the body\'s radius', () => {
    const marsh = rampOfRadius(4);
    const pond = rampOfRadius(13);
    const bay = rampOfRadius(50);
    expect(marsh.amp).toBeLessThan(pond.amp);
    expect(pond.amp).toBeLessThan(bay.amp);
    expect(pond.reach).toBeLessThan(bay.reach);
    expect(bay.reach).toBeLessThanOrEqual(48);
    expect(marsh.reach).toBeGreaterThanOrEqual(10);
  });
  test('the depth is near 0 at the bank, rises monotone with the distance to the body\'s reach, and each body keeps its own strength (G)', () => {
    // a small pond (radius about 8) and a wide bay (radius about 40) side by side, a land wall between them
    const aw = 200;
    const ah = 90;
    const { mask, sw, sh } = lake(aw, ah, [[0, 0, 199, 4], [0, 85, 199, 89], [0, 0, 4, 89], [195, 0, 199, 89], [60, 0, 64, 89], [0, 0, 59, 35], [0, 55, 59, 89]]);
    const f = waterFieldOf(mask, sw, sh, ART, []);
    const px = rampPixels(f);
    const at = (x: number, y: number): number => (y * f.w + x) * 4;
    // along the pond's middle row (y 45): from the wall at x 5 outward
    const row = [5, 8, 12, 20, 30, 40].map((x) => px[at(x, 45)]!);
    for (let i = 1; i < row.length; i++) expect(row[i]!).toBeGreaterThanOrEqual(row[i - 1]!);
    expect(px[at(5, 45)]!).toBeLessThan(40); // the blur lets a little of the open water reach the bank's first pixel
    // the bay (x 66 to 194, 80 rows tall) is a bigger body than the pond-like channel (x 5 to 59, y 36 to 54): stronger
    expect(px[at(130, 45) + 1]!).toBeGreaterThan(px[at(30, 45) + 1]!);
    // a land's own factor scales the strength
    expect(rampPixels(f, 0.5)[at(130, 45) + 1]!).toBeLessThan(px[at(130, 45) + 1]!);
    expect(px[at(130, 45) + 3]).toBe(255);
  });
});
