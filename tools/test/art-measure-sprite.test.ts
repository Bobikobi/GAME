import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

import { paletteWithRamps } from '../src/kit/palette.js';
import { measureSprite, pieces } from '../src/art/measure-sprite.js';

const GREENS = paletteWithRamps(['green', 'moss']).slice(-8);
const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

/** A 64 x 64 sprite: a drawn blob over a clear ground, `fn` says the colour of a solid pixel or null for clear. */
function sprite(fn: (x: number, y: number) => string | null, w = 64, h = 64): PNG {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hex = fn(x, y);
      const [r, g, b] = hex === null ? [0, 0, 0] : rgb(hex);
      png.data.set([r, g, b, hex === null ? 0 : 255], (y * w + x) * 4);
    }
  }
  return png;
}
const blob = (x: number, y: number): string | null => ((x - 32) ** 2 + (y - 40) ** 2 < 400 ? (GREENS[(x * 3 + y * 5) % GREENS.length] ?? '#000000') : null);

describe('art:measure for a sprite', () => {
  it('passes a clean blob that stands on the bottom rows', () => {
    const m = measureSprite(sprite((x, y) => (y > 60 ? null : y > 48 ? (blob(x, y - 4) ?? blob(x, y)) : blob(x, y))), ['green', 'moss'], { width: 64, height: 64 });
    expect(m.failures.filter((f) => !/foot|detail/u.test(f))).toEqual([]);
  });
  it('fails a wrong size, a flat picture, an object off the ramps and one that floats', () => {
    const want = { width: 64, height: 64 };
    expect(measureSprite(sprite(blob, 64, 32), ['green', 'moss'], want).failures.join()).toMatch(/size: 64x32/u);
    expect(measureSprite(sprite((x, y) => (blob(x, y) === null ? null : (GREENS[0] ?? '#000000'))), ['green', 'moss'], want).failures.join()).toMatch(/colours|detail/u);
    expect(measureSprite(sprite((x, y) => (blob(x, y) === null ? null : '#ff00ff')), ['green', 'moss'], want).failures.join()).toMatch(/palette/u);
    expect(measureSprite(sprite((x, y) => (y < 30 ? blob(x, y + 12) : null)), ['green', 'moss'], want).failures.join()).toMatch(/foot/u);
  });
  it('counts the pieces of a scene of specks', () => {
    const specks = sprite((x, y) => (x % 8 < 3 && y % 8 < 3 ? (GREENS[1] ?? '#000000') : null));
    expect(pieces(specks).count).toBeGreaterThan(6);
    expect(measureSprite(specks, ['green', 'moss'], { width: 64, height: 64 }).failures.join()).toMatch(/pieces/u);
  });
});
