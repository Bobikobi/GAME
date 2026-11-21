import { describe, expect, test } from 'vitest';
import { deepTile } from '../src/waterbody';
import { EDGE_PX, PATH_EDGE, WATER_EDGE, blendEdgeTile, needsBlend, pathField, type PathAt } from '../src/pathedge';

const grid = (rows: string[]): PathAt => (x, y) => {
  const c = rows[y]?.[x];
  return c === ':' ? 1 : c === '.' ? 0 : undefined;
};
const solid = (r: number, g: number, b: number): Uint8ClampedArray => {
  const d = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
  for (let i = 0; i < d.length; i += 4) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
  return d;
};
const PLAIN = { ...PATH_EDGE, threshold: 0.5, sparse: false };
const PATH = [200, 154, 94] as const;
const GRASS = [76, 154, 63] as const;
const isPathPx = (d: Uint8ClampedArray, px: number, py: number) => d[(py * EDGE_PX + px) * 4] === PATH[0] || d[(py * EDGE_PX + px) * 4] === 0x9e;

describe('the path edge', () => {
  const at = grid(['.....', '..:..', '..:..', '..:..', '.....']);

  test('a tile far from any change is drawn as it is', () => {
    expect(needsBlend(0, 0, at, 0)).toBe(false);
    expect(needsBlend(2, 2, at, 1)).toBe(true);
    expect(needsBlend(1, 2, at, 0)).toBe(true);
  });

  test('the field is 1 inside a wide path, 0 in the meadow, and passes 0.5 between tiles', () => {
    const wide = grid(['..:::..', '..:::..', '..:::..']);
    expect(pathField(3, 1, 0.5, 0.5, wide, 1)).toBe(1);
    expect(pathField(0, 1, 0.5, 0.5, wide, 0)).toBe(0);
    expect(pathField(2, 1, 0, 0.5, wide, 1)).toBeCloseTo(0.5, 5);
  });

  test('a one-tile path is rounded: its corner pixel is grass, its middle is sand', () => {
    const out = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
    blendEdgeTile(2, 1, at, 1, solid(...PATH), solid(...GRASS), out, PLAIN);
    expect(isPathPx(out, 32, 32)).toBe(true);
    expect(isPathPx(out, 1, 1)).toBe(false);
    expect(isPathPx(out, 62, 62)).toBe(false);
  });

  test('a staircase of tiles runs as a diagonal: the share of sand falls along it, with no square step', () => {
    const stair = grid(['::...', ':::..', '.:::.', '..:::', '...::']);
    const out = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
    blendEdgeTile(3, 1, stair, 0, solid(...PATH), solid(...GRASS), out, PLAIN);
    let sand = 0;
    for (let py = 0; py < EDGE_PX; py++) for (let px = 0; px < EDGE_PX; px++) if (isPathPx(out, px, py)) sand += 1;
    const share = sand / (EDGE_PX * EDGE_PX);
    expect(share).toBeGreaterThan(0.05);
    expect(share).toBeLessThan(0.7);
  });

  test('it is fixed by the map, every pixel opaque', () => {
    const a = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
    const b = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
    blendEdgeTile(2, 1, at, 1, solid(...PATH), solid(...GRASS), a, PLAIN);
    blendEdgeTile(2, 1, at, 1, solid(...PATH), solid(...GRASS), b, PLAIN);
    expect(a).toEqual(b);
    for (let i = 3; i < a.length; i += 4) expect(a[i]).toBe(255);
  });
});

describe('the narrowed band', () => {
  test('a higher threshold draws less sand than the tiles\' own edge', () => {
    const at: PathAt = (x, y) => (['.....', '.:::.', '.:::.', '.:::.', '.....'][y]?.[x] === ':' ? 1 : 0);
    const share = (look: typeof PATH_EDGE) => {
      const o = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
      blendEdgeTile(1, 2, at, 1, solid(...PATH), solid(...GRASS), o, look);
      let n = 0;
      for (let py = 0; py < EDGE_PX; py++) for (let px = 0; px < EDGE_PX; px++) if (isPathPx(o, px, py)) n += 1;
      return n / (EDGE_PX * EDGE_PX);
    };
    expect(share(PATH_EDGE)).toBeLessThan(share(PLAIN) - 0.05);
  });
});

describe('where land meets water', () => {
  const at: PathAt = (x) => (x < 2 ? 1 : 0);
  const LAND = [200, 160, 100] as const;
  const WATER = [60, 140, 210] as const;
  test('the land side wets darker or carries stones, the water side shades, near the line only', () => {
    const o = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
    blendEdgeTile(1, 0, at, 1, solid(...LAND), solid(...WATER), o, WATER_EDGE);
    let wet = 0;
    let land = 0;
    for (let py = 0; py < EDGE_PX; py++) {
      for (let px = 0; px < EDGE_PX; px++) {
        const i = (py * EDGE_PX + px) * 4;
        if (o[i]! > 150 && o[i + 1]! < 170 && o[i + 2]! < 120) land += 1;
        else if (o[i]! < 190 && o[i + 2]! < 110 && o[i + 1]! < 120) wet += 1;
      }
    }
    expect(land).toBeGreaterThan(0);
    expect(wet).toBeGreaterThan(40);
  });
  test('the water lightens toward the shore, flat in the middle, with flecks of foam and runs of stones on the line', () => {
    const DEEP = [0x2a, 0x6c, 0x66] as const;
    // tile 2 is water with land to its left: its right edge is more than the shallows (24 px) away from the shore
    let farOther = 0;
    let lighter = 0;
    let foam = 0;
    let ink = 0;
    for (let ty = 0; ty < 8; ty++) {
      const o = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
      blendEdgeTile(2, ty, at, 0, solid(...LAND), solid(...DEEP), o, WATER_EDGE);
      const is = (i: number, c: readonly number[]): boolean => o[i] === c[0] && o[i + 1] === c[1] && o[i + 2] === c[2];
      for (let py = 0; py < EDGE_PX; py++) {
        for (let px = 0; px < EDGE_PX; px++) {
          const i = (py * EDGE_PX + px) * 4;
          if (px >= 56 && Math.max(Math.abs(o[i]! - DEEP[0]), Math.abs(o[i + 1]! - DEEP[1]), Math.abs(o[i + 2]! - DEEP[2])) > 4) farOther += 1;
          if (0.3 * o[i]! + 0.5 * o[i + 1]! + 0.2 * o[i + 2]! > 0.3 * DEEP[0] + 0.5 * DEEP[1] + 0.2 * DEEP[2] + 8) lighter += 1;
          if (is(i, [0xc6, 0xca, 0xd6]) || is(i, [0xf5, 0xf4, 0xef])) foam += 1;
          if (is(i, [0x1b, 0x1a, 0x2e])) ink += 1;
        }
      }
    }
    // the shallows fade out: at the far edge of the tile only a few pixels in a hundred differ from the open water by more than a hair
    expect(farOther).toBeLessThan(200);
    expect(lighter).toBeGreaterThan(500);
    // foam only in flecks, never a band
    expect(foam).toBeGreaterThan(0);
    expect(foam).toBeLessThan(EDGE_PX * 8 * 0.5);
    // the 1 px ink round the stones of the runs, but a stretch of bare shore too: not every row carries a stone
    expect(ink).toBeGreaterThan(100);
    expect(ink).toBeLessThan(EDGE_PX * 8 * 0.9);
  });
  test('the water is 6 to 10 luminance steps lighter within 24 px of the line than 60 px out', () => {
    const lum = (r: number, g: number, b: number): number => 0.3 * r + 0.5 * g + 0.2 * b;
    // water is the green-blue pixels: sand has red above green, stones and foam have none to spare
    const isWater = (r: number, g: number, b: number): boolean => g - r > 20 && b - r > 15;
    let near = 0;
    let nn = 0;
    let far = 0;
    let nf = 0;
    for (const [x0, y0] of [[20, 7], [0, 30], [41, 3]]) {
      for (let ty = 0; ty < 8; ty++) {
        for (let tx = 1; tx < 6; tx++) {
          const water = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
          deepTile(x0! + tx, y0! + ty, 0, water);
          const o = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
          blendEdgeTile(tx, ty, at, tx < 2 ? 1 : 0, solid(...LAND), water, o, WATER_EDGE);
          for (let py = 0; py < EDGE_PX; py++) {
            for (let px = 0; px < EDGE_PX; px++) {
              const i = (py * EDGE_PX + px) * 4;
              if (!isWater(o[i]!, o[i + 1]!, o[i + 2]!)) continue;
              const d = tx * EDGE_PX + px - 2 * EDGE_PX;
              const l = lum(o[i]!, o[i + 1]!, o[i + 2]!);
              if (d >= 1 && d <= 24) {
                near += l;
                nn += 1;
              } else if (d >= 60) {
                far += l;
                nf += 1;
              }
            }
          }
        }
      }
    }
    expect(near / nn - far / nf).toBeGreaterThanOrEqual(6);
    expect(near / nn - far / nf).toBeLessThanOrEqual(10);
  });
  test('it is fixed by the map', () => {
    const a = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
    const b = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
    blendEdgeTile(1, 0, at, 1, solid(...LAND), solid(...WATER), a, WATER_EDGE);
    blendEdgeTile(1, 0, at, 1, solid(...LAND), solid(...WATER), b, WATER_EDGE);
    expect(a).toEqual(b);
  });
});
