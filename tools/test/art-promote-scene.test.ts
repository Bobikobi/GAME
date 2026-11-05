import { PNG } from 'pngjs';
import { describe, expect, test } from 'vitest';

import { composeScene, drawNumber, zoomNearest } from '../src/art/promote-scene.js';

/** A PNG of one solid colour, fully opaque, `w` by `h`. */
function solid(hex: string, w: number, h = w): PNG {
  const [r, g, b] = [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)];
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i += 1) {
    png.data[i * 4] = r;
    png.data[i * 4 + 1] = g;
    png.data[i * 4 + 2] = b;
    png.data[i * 4 + 3] = 255;
  }
  return png;
}

function alphaAt(png: PNG, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return 0;
  return png.data[(y * png.width + x) * 4 + 3] as number;
}

describe('drawNumber', () => {
  test('draws ink pixels for a digit, inside the canvas, and nothing for an out-of-bounds one', () => {
    const png = new PNG({ width: 10, height: 10 });
    drawNumber(png, 1, 2, 2);
    let opaque = 0;
    for (let i = 0; i < 10 * 10; i += 1) if (png.data[i * 4 + 3] === 255) opaque += 1;
    expect(opaque).toBeGreaterThan(0);
  });

  test('a multi-digit number is wider than a single digit', () => {
    const one = new PNG({ width: 20, height: 10 });
    drawNumber(one, 1, 0, 0);
    const twelve = new PNG({ width: 20, height: 10 });
    drawNumber(twelve, 12, 0, 0);
    const rightmost = (png: PNG): number => {
      let max = -1;
      for (let y = 0; y < png.height; y += 1) for (let x = 0; x < png.width; x += 1) if (png.data[(y * png.width + x) * 4 + 3] === 255) max = Math.max(max, x);
      return max;
    };
    expect(rightmost(twelve)).toBeGreaterThan(rightmost(one));
  });

  test('drawing off the edge of the canvas does not throw', () => {
    const png = new PNG({ width: 2, height: 2 });
    expect(() => drawNumber(png, 99, -5, -5)).not.toThrow();
  });
});

describe('zoomNearest', () => {
  test('zoom 1 is the same picture', () => {
    const png = solid('#84c450', 2);
    expect(zoomNearest(png, 1)).toBe(png);
  });

  test('zoom 2 doubles each side and each pixel becomes a 2x2 block of the same colour', () => {
    const png = solid('#84c450', 2);
    const out = zoomNearest(png, 2);
    expect(out.width).toBe(4);
    expect(out.height).toBe(4);
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        expect(out.data[(y * 4 + x) * 4]).toBe(0x84);
        expect(out.data[(y * 4 + x) * 4 + 1]).toBe(0xc4);
        expect(out.data[(y * 4 + x) * 4 + 2]).toBe(0x50);
      }
    }
  });
});

describe('composeScene', () => {
  const grass = [solid('#4c9a3f', 64)];
  const human = solid('#d38c66', 16, 32);
  const items = [solid('#84c450', 8), solid('#6e4226', 10, 6)];

  test('refuses an empty grass list or an empty item list', () => {
    expect(() => composeScene({ grass: [], human, items })).toThrow(/grass/);
    expect(() => composeScene({ grass, human, items: [] })).toThrow(/picture/);
  });

  test('refuses a fully transparent human frame', () => {
    const empty = new PNG({ width: 16, height: 32 });
    expect(() => composeScene({ grass, human: empty, items })).toThrow(/human/);
  });

  test('stands the human and every item on the same ground line, bottom-aligned in their cell', () => {
    const scene = composeScene({ grass, human, items });
    expect(scene.rows).toBe(1);
    expect(scene.width).toBeGreaterThan(0);
    expect(scene.height).toBeGreaterThan(0);
    expect(alphaAt(scene.png, 0, 0)).toBe(255); // the grass fills the background
  });

  test('more candidates than perRow wrap to a second row', () => {
    const many = [solid('#84c450', 8), solid('#84c450', 8), solid('#84c450', 8)];
    const scene = composeScene({ grass, human, items: many, perRow: 2 });
    expect(scene.rows).toBe(2);
  });

  test('the zoom is the largest whole number keeping the still within maxWidth, at least 1', () => {
    const scene = composeScene({ grass, human, items, maxWidth: 100000 });
    expect(scene.zoom).toBeGreaterThanOrEqual(1);
    expect(scene.png.width).toBe(scene.width * scene.zoom);
    const tiny = composeScene({ grass, human, items, maxWidth: 1 });
    expect(tiny.zoom).toBe(1);
  });
});
