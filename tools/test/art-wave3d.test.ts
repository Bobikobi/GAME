import { describe, expect, test } from 'vitest';

import { INK, opaqueHeight } from '../src/art/foliage.js';
import { CHARACTER_PX } from '../src/art/ruins.js';
import { WAVE3D, propScale, propSheet } from '../src/art/wave3d.js';

describe('the last props at 64 px (wave 3d)', () => {
  test.each(WAVE3D.map((p) => [p.id, p] as const))('%s has its canvas, its frames and its audit height', (_id, p) => {
    const sheet = propSheet(p);
    expect(sheet.width).toBe(p.w * p.frames);
    expect(sheet.height).toBe(p.h);
    const tallest = Math.max(...Array.from({ length: p.frames }, (_, f) => opaqueHeight(p.draw(f))));
    expect(tallest / CHARACTER_PX).toBeGreaterThanOrEqual(p.floor);
    expect(propScale(p)).toBe(Math.round((tallest / CHARACTER_PX) * 100) / 100);
    // nothing touches the top border, and the piece stands on the bottom row
    for (let f = 0; f < p.frames; f++) {
      const png = p.draw(f);
      for (let x = 0; x < p.w; x++) expect(png.data[x * 4 + 3]).toBe(0);
      const foot = [...Array(p.w).keys()].filter((x) => png.data[((p.h - 1) * p.w + x) * 4 + 3] === 255);
      expect(foot.length).toBeGreaterThan(0);
    }
  });

  test.each(WAVE3D.map((p) => [p.id, p] as const))('%s is inked on every edge pixel and is the same every time', (_id, p) => {
    for (let f = 0; f < p.frames; f++) {
      const png = p.draw(f);
      let edges = 0;
      let ink = 0;
      const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < p.w && y < p.h && png.data[(y * p.w + x) * 4 + 3] === 255;
      for (let y = 0; y < p.h; y++) {
        for (let x = 0; x < p.w; x++) {
          if (!solid(x, y) || (solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1))) continue;
          edges += 1;
          const i = (y * p.w + x) * 4;
          if (png.data[i] === INK[0] && png.data[i + 1] === INK[1] && png.data[i + 2] === INK[2]) ink += 1;
        }
      }
      expect(ink / edges).toBeGreaterThan(0.95);
      expect(Buffer.compare(png.data, p.draw(f).data)).toBe(0);
    }
  });

  test('a prop with two frames moves between them', () => {
    for (const p of WAVE3D.filter((x) => x.frames === 2)) expect(Buffer.compare(p.draw(0).data, p.draw(1).data)).not.toBe(0);
  });
});
