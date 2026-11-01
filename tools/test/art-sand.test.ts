import { PNG } from 'pngjs';
import { describe, expect, test } from 'vitest';

import { drySand } from '../src/art/sand.js';

function tile(...pixels: number[]): PNG {
  const png = new PNG({ width: pixels.length, height: 1 });
  pixels.forEach((c, i) => png.data.set([c >> 16, (c >> 8) & 255, c & 255, 255], i * 4));
  return png;
}
const rgb = (png: PNG, i: number): number => (png.data[i * 4]! << 16) | (png.data[i * 4 + 1]! << 8) | png.data[i * 4 + 2]!;

describe('the dry sand', () => {
  test('every brown step moves one up the sand ramp, the grey pebbles stay', () => {
    const dry = drySand(tile(0x9e6b3c, 0x9e6b3c, 0xc99a5e, 0x3d2618, 0x8f94a8));
    expect(dry).not.toBeNull();
    expect([0, 1, 2, 3, 4].map((i) => rgb(dry!, i))).toEqual([0xc99a5e, 0xc99a5e, 0xebd3a2, 0x6e4226, 0x8f94a8]);
  });
  test('a tile that is no longer brown is left alone, so a rerun moves nothing', () => {
    expect(drySand(tile(0xc99a5e, 0xc99a5e, 0xebd3a2))).toBeNull();
  });
});
