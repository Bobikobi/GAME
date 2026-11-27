import { describe, expect, test } from 'vitest';

import { addMissedWater, MISSED, SEAM, seamPixels, toneAtScene } from '../src/waterseam.js';

/** a plate of `w` x `h` art pixels at art 1: the top `cut` rows `top`, the rest `bottom` (RGB) */
function plateOf(w: number, h: number, cut: number, top: number[], bottom: number[]): Uint8ClampedArray {
  const p = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = y < cut ? top : bottom;
      p.set([c[0]!, c[1]!, c[2]!, 255], (y * w + x) * 4);
    }
  }
  return p;
}

const W = 40;
const H = 220;
const water = new Uint8Array(W * H).fill(1);
const BLUE = [77, 136, 202];
const TEAL = [42, 72, 75];

describe('the seam band of a body painted in two tones', () => {
  test('a light blue over a deep teal on a hard cut: the blue meets the teal on one colour and fades back to itself over the band', () => {
    const r = seamPixels(plateOf(W, H, 110, BLUE, TEAL), W, H, 1, water, W, H);
    expect(r.seam).toBeGreaterThan(0);
    const at = (y: number, c: number): number => r.rgba[(y * W + 20) * 4 + c]!;
    // next to the cut the light water keeps well under three quarters of its colour in every channel (the full ratio is TEAL / BLUE, 0.37 to 0.55)
    for (let c = 0; c < 3; c++) expect(at(108, c)).toBeLessThan(0.75 * 255);
    // untouched a band away, and everywhere under the cut
    for (let c = 0; c < 3; c++) {
      expect(at(110 - SEAM.band - 2, c)).toBe(255);
      expect(at(180, c)).toBe(255);
    }
    // it only takes light off, and it fades in monotonely toward the cut
    for (let y = 110 - SEAM.band; y < 109; y++) for (let c = 0; c < 3; c++) expect(at(y + 1, c)).toBeLessThanOrEqual(at(y, c));
  });

  test('a smooth depth gradient is left alone: no hard cut, no change', () => {
    const p = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) p.set([Math.round(77 - (35 * y) / H), Math.round(136 - (64 * y) / H), Math.round(202 - (127 * y) / H), 255], (y * W + x) * 4);
    const r = seamPixels(p, W, H, 1, water, W, H);
    expect(r.seam).toBe(0);
    expect(r.rgba.every((v) => v === 255)).toBe(true);
  });

  test('a dark tone of the same hue is a depth, not a second painting: left alone', () => {
    const r = seamPixels(plateOf(W, H, 110, BLUE, [38, 68, 101]), W, H, 1, water, W, H);
    expect(r.seam).toBe(0);
  });

  test('one tone and no water give a multiplier of 1', () => {
    expect(seamPixels(plateOf(W, H, 0, BLUE, BLUE), W, H, 1, water, W, H).seam).toBe(0);
    expect(seamPixels(plateOf(W, H, 110, BLUE, TEAL), W, H, 1, new Uint8Array(W * H), W, H).rgba.every((v) => v === 255)).toBe(true);
  });
});

describe('a flat patch of painted water the bed missed', () => {
  const w = 120;
  const h = 80;
  /** a bed of water on the left half; the plate is water blue in a patch on its right edge and land green elsewhere */
  const scene = (): { mask: Uint8Array; plate: Uint8ClampedArray } => {
    const mask = new Uint8Array(w * h);
    const plate = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const water = x < 40;
        mask[y * w + x] = water ? 1 : 0;
        const patch = x >= 40 && x < 80 && y >= 20 && y < 60;
        plate.set(patch ? [77, 136, 202, 255] : water ? [60, 110, 150, 255] : [90, 120, 60, 255], (y * w + x) * 4);
      }
    }
    return { mask, plate };
  };

  test('a blue patch that touches the bed joins it, grown by its edge', () => {
    const { mask, plate } = scene();
    const added = addMissedWater(mask, plate, w, h);
    expect(added).toBeGreaterThanOrEqual(40 * 40);
    expect(mask[40 * w + 60]).toBe(1);
    expect(mask[40 * w + 100]).toBe(0); // the green land stays land
  });

  test('a blue patch away from the water, or a small one, is not water', () => {
    const far = scene();
    far.mask.fill(0);
    for (let y = 0; y < h; y++) far.mask[y * w + 2] = 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < 40; x++) far.plate.set([90, 120, 60, 255], (y * w + x) * 4);
    expect(addMissedWater(far.mask, far.plate, w, h)).toBe(0);
    const small = scene();
    for (let y = 0; y < h; y++) for (let x = 40; x < 80; x++) if (!(x < 40 + 10 && y >= 20 && y < 30)) small.plate.set([90, 120, 60, 255], (y * w + x) * 4);
    expect(10 * 10).toBeLessThan(MISSED.area);
    expect(addMissedWater(small.mask, small.plate, w, h)).toBe(0);
  });
});

describe('the seam multiplier at scene resolution', () => {
  test('a dark pixel of a cell on the cut keeps no share of the cell\'s multiplier, a light one all of it', () => {
    // 8 x 4 scene pixels, art 4: two cells; the left cell holds a light column and a dark column
    const sw = 8;
    const sh = 4;
    const plate = new Uint8ClampedArray(sw * sh * 4);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) plate.set(x % 4 < 2 ? [77, 136, 202, 255] : [42, 72, 75, 255], (y * sw + x) * 4);
    const art = new Uint8ClampedArray([100, 120, 140, 255, 255, 255, 255, 255]);
    const t = toneAtScene(art, new Uint8Array(2), 2, plate, sw, sh, 4, { x: 0, y: 0 });
    expect([t[0], t[1], t[2]]).toEqual([100, 120, 140]); // light pixel, in the multiplied cell
    expect([t[2 * 4], t[2 * 4 + 1], t[2 * 4 + 2]]).toEqual([255, 255, 255]); // dark pixel, same cell
  });

  test('a light pixel in a cell that has no multiplier takes the strongest of the cells around it', () => {
    const sw = 8;
    const sh = 4;
    const plate = new Uint8ClampedArray(sw * sh * 4);
    for (let i = 0; i < sw * sh; i++) plate.set([77, 136, 202, 255], i * 4);
    const art = new Uint8ClampedArray([255, 255, 255, 255, 100, 120, 140, 255]);
    const t = toneAtScene(art, new Uint8Array(2), 2, plate, sw, sh, 4, { x: 0, y: 0 });
    expect([t[0], t[1], t[2]]).toEqual([100, 120, 140]);
  });

  test('a middle tone of a cell whose outline was drawn down takes the multiplier, and not otherwise', () => {
    const sw = 4;
    const sh = 4;
    const plate = new Uint8ClampedArray(sw * sh * 4);
    for (let i = 0; i < sw * sh; i++) plate.set([51, 101, 159, 255], i * 4); // luma .38: between the dark and the light class
    const art = new Uint8ClampedArray([100, 120, 140, 255]);
    const plain = toneAtScene(art, new Uint8Array(1), 1, plate, sw, sh, 4, { x: 0, y: 0 });
    const fixed = toneAtScene(art, new Uint8Array([1]), 1, plate, sw, sh, 4, { x: 0, y: 0 });
    expect(plain[0]).toBeGreaterThan(240);
    expect(fixed[0]).toBeLessThan(110);
  });
});
