import { beforeAll, describe, expect, test } from 'vitest';

import type { Bundle } from '@game/kernel';
import { GREENS, canopyGroups, hash, remapTone, toneField, valueNoise } from '../src/richground';
import { loadBundle } from '../../tools/test/helpers/world';

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

describe('hash', () => {
  test('is fixed, unsigned and well mixed', () => {
    expect(hash(3, 4)).toBe(hash(3, 4));
    expect(hash(0, 0)).toBeGreaterThanOrEqual(0);
    expect(hash(47, 35)).toBeLessThan(2 ** 32);
    const seen = new Set<number>();
    for (let y = 0; y < 36; y++) for (let x = 0; x < 48; x++) seen.add(hash(x, y));
    expect(seen.size).toBe(48 * 36);
  });
});

describe('value noise', () => {
  test('stays in 0..1, repeats itself and changes slowly between neighbours', () => {
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 50; x++) {
        const n = valueNoise(x, y, 7);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
        expect(valueNoise(x, y, 7)).toBe(n);
        if (x > 0) expect(Math.abs(n - valueNoise(x - 1, y, 7))).toBeLessThan(0.5);
        if (y > 0) expect(Math.abs(n - valueNoise(x, y - 1, 7))).toBeLessThan(0.5);
      }
    }
    expect(valueNoise(5, 5, 7)).not.toBe(valueNoise(5, 5, 8));
  });
});

/** Sizes of the connected patches (four neighbours, same tone) over the meadow tiles. */
function patchSizes(field: Uint8Array, width: number, height: number, meadow: (x: number, y: number) => boolean): number[] {
  const seen = new Uint8Array(width * height);
  const sizes: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!meadow(x, y) || seen[y * width + x]) continue;
      const tone = field[y * width + x];
      const stack: [number, number][] = [[x, y]];
      seen[y * width + x] = 1;
      let size = 0;
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        size += 1;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (!meadow(nx, ny) || seen[ny * width + nx] || field[ny * width + nx] !== tone) continue;
          seen[ny * width + nx] = 1;
          stack.push([nx, ny]);
        }
      }
      sizes.push(size);
    }
  }
  return sizes;
}

describe('tone field', () => {
  test('groups the core meadow into patches of every tone, none dominant, mostly 3 to 8 tiles', () => {
    const m = bundle.map;
    const meadow = (x: number, y: number) => m.legend[m.ground[y]?.[x] ?? '']?.tag === 'meadow';
    const field = toneField(m.width, m.height, meadow);
    expect(toneField(m.width, m.height, meadow)).toEqual(field);
    const counts = [0, 0, 0];
    let total = 0;
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        const t = field[y * m.width + x]!;
        if (!meadow(x, y)) {
          expect(t).toBe(0);
          continue;
        }
        counts[t] += 1;
        total += 1;
      }
    }
    for (const c of counts) {
      expect(c).toBeGreaterThan(0);
      expect(c / total).toBeLessThan(0.6);
    }
    const sizes = patchSizes(field, m.width, m.height, meadow).sort((a, b) => a - b);
    const median = sizes[Math.floor(sizes.length / 2)]!;
    expect(median).toBeGreaterThanOrEqual(3);
    expect(median).toBeLessThanOrEqual(8);
  });
});

describe('canopy groups', () => {
  // a 2x2 island, a lone tile, a 3x3 block and a two-thick strip
  const rows = [
    'TT..T.....',
    'TT........',
    '....TTT...',
    '....TTT...',
    '....TTT...',
    '..........',
    'TTTTTTTTTT',
    'TTTTTTTTTT',
  ];
  const width = 10;
  const height = rows.length;
  const isForest = (x: number, y: number) => rows[y]?.[x] === 'T';

  test('covers 2x2 forest only, never twice, never a lone tile, and leaves no free square', () => {
    const groups = canopyGroups(width, height, isForest);
    expect(canopyGroups(width, height, isForest)).toEqual(groups);
    const covered = new Uint8Array(width * height);
    for (const g of groups) {
      expect(g.i).toBeGreaterThanOrEqual(0);
      expect(g.i).toBeLessThan(3);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
        expect(isForest(g.x + dx, g.y + dy)).toBe(true);
        expect(covered[(g.y + dy) * width + g.x + dx]).toBe(0);
        covered[(g.y + dy) * width + g.x + dx] = 1;
      }
    }
    expect(covered[4]).toBe(0);
    expect(groups.some((g) => g.x === 0 && g.y === 0)).toBe(true);
    const free = (x: number, y: number) => isForest(x, y) && covered[y * width + x] === 0;
    for (let y = 0; y + 1 < height; y++) {
      for (let x = 0; x + 1 < width; x++) {
        expect(free(x, y) && free(x + 1, y) && free(x, y + 1) && free(x + 1, y + 1)).toBe(false);
      }
    }
    // the strip takes ten of its twenty tiles in five blocks at least; the stagger may leave an edge column
    expect(groups.filter((g) => g.y === 6).length).toBeGreaterThanOrEqual(4);
  });
});

describe('tone remap', () => {
  const W = 32;
  const H = 16;
  const FRAME = 16;

  function sheet(): Uint8ClampedArray {
    const data = new Uint8ClampedArray(W * H * 4);
    for (let p = 0; p < W * H; p++) {
      const x = p % W;
      const y = Math.floor(p / W);
      const fx = x % FRAME;
      // the same picture in both frames: base grass, a few light specks, one red flower, one hole
      let rgb = GREENS[2]!;
      if ((fx + y) % 7 === 0) rgb = GREENS[3]!;
      if (fx === 3 && y === 3) rgb = 0xe2533f;
      const alpha = fx === 9 && y === 9 ? 0 : 255;
      data[p * 4] = (rgb >>> 16) & 255;
      data[p * 4 + 1] = (rgb >>> 8) & 255;
      data[p * 4 + 2] = rgb & 255;
      data[p * 4 + 3] = alpha;
    }
    return data;
  }

  const pixel = (data: Uint8ClampedArray, p: number) => ((data[p * 4]! << 16) | (data[p * 4 + 1]! << 8) | data[p * 4 + 2]!) >>> 0;

  test('writes palette greens only, leaves other colours and holes alone, and keeps both frames alike', () => {
    for (const tone of [1, 2] as const) {
      const before = sheet();
      const data = sheet();
      remapTone(data, W, tone, FRAME);
      let changed = 0;
      let base = 0;
      for (let p = 0; p < W * H; p++) {
        const was = pixel(before, p);
        const now = pixel(data, p);
        expect(data[p * 4 + 3]).toBe(before[p * 4 + 3]);
        if (before[p * 4 + 3] === 0 || was === 0xe2533f) {
          expect(now).toBe(was);
          continue;
        }
        expect(GREENS).toContain(now);
        if (was === GREENS[2]) {
          base += 1;
          if (now !== was) changed += 1;
        } else {
          expect(now).toBe(tone === 1 ? GREENS[2] : GREENS[4]);
        }
        if (p % W >= FRAME) expect(now).toBe(pixel(data, p - FRAME));
      }
      const share = changed / base;
      if (tone === 1) {
        expect(share).toBeGreaterThan(0.2);
        expect(share).toBeLessThan(0.5);
      } else {
        expect(share).toBeGreaterThan(0.15);
        expect(share).toBeLessThan(0.4);
      }
    }
  });

  test('tone 0 changes nothing', () => {
    const data = sheet();
    remapTone(data, W, 0, FRAME);
    expect(data).toEqual(sheet());
  });
});
