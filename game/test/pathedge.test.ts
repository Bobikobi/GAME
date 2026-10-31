import { describe, expect, test } from 'vitest';
import { EDGE_PX, blendEdgeTile, needsBlend, pathField, type PathAt } from '../src/pathedge';

const grid = (rows: string[]): PathAt => (x, y) => {
  const c = rows[y]?.[x];
  return c === ':' ? 1 : c === '.' ? 0 : undefined;
};
const solid = (r: number, g: number, b: number): Uint8ClampedArray => {
  const d = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
  for (let i = 0; i < d.length; i += 4) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
  return d;
};
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
    blendEdgeTile(2, 1, at, 1, solid(...PATH), solid(...GRASS), out);
    expect(isPathPx(out, 32, 32)).toBe(true);
    expect(isPathPx(out, 1, 1)).toBe(false);
    expect(isPathPx(out, 62, 62)).toBe(false);
  });

  test('a staircase of tiles runs as a diagonal: the share of sand falls along it, with no square step', () => {
    const stair = grid(['::...', ':::..', '.:::.', '..:::', '...::']);
    const out = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
    blendEdgeTile(3, 1, stair, 0, solid(...PATH), solid(...GRASS), out);
    let sand = 0;
    for (let py = 0; py < EDGE_PX; py++) for (let px = 0; px < EDGE_PX; px++) if (isPathPx(out, px, py)) sand += 1;
    const share = sand / (EDGE_PX * EDGE_PX);
    expect(share).toBeGreaterThan(0.05);
    expect(share).toBeLessThan(0.7);
  });

  test('it is fixed by the map, every pixel opaque', () => {
    const a = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
    const b = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
    blendEdgeTile(2, 1, at, 1, solid(...PATH), solid(...GRASS), a);
    blendEdgeTile(2, 1, at, 1, solid(...PATH), solid(...GRASS), b);
    expect(a).toEqual(b);
    for (let i = 3; i < a.length; i += 4) expect(a[i]).toBe(255);
  });
});
