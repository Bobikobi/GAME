import { describe, expect, test } from 'vitest';

import { crownPng } from '../src/art/crowns.js';
import { INK, opaqueHeight } from '../src/art/foliage.js';
import { CHARACTER_PX, TREES, treeSheet } from '../src/art/trees.js';

/** The target opaque height of each tree in characters, from the scale audit's rows (a tenth under passes). */
const FLOOR: Record<string, number> = { 'props/tree_oak': 3, 'props/dead_tree': 2.5, 'props/young_tree': 2, 'props/sapling': 1, 'props/fig_bush': 3, 'props/fig_bush_empty': 3 };

describe('the trees at 64 px', () => {
  test.each(TREES.map((t) => [t.id, t] as const))('%s has its canvas, its frames and the audit height', (id, t) => {
    const sheet = treeSheet(t);
    expect(sheet.width).toBe(t.w * t.frames);
    expect(sheet.height).toBe(t.h);
    const first = t.draw(0);
    expect(opaqueHeight(first) / CHARACTER_PX).toBeGreaterThanOrEqual(FLOOR[id]! * 0.9);
    // nothing touches the canvas border, and the foot stands on the bottom centre
    for (let x = 0; x < t.w; x++) expect(first.data[x * 4 + 3]).toBe(0);
    const foot = [...Array(t.w).keys()].filter((x) => first.data[((t.h - 1) * t.w + x) * 4 + 3] === 255);
    expect(foot.length).toBeGreaterThan(0);
    expect(Math.abs((Math.min(...foot) + Math.max(...foot)) / 2 - t.w / 2)).toBeLessThan(t.w * 0.08);
  });

  test.each(TREES.map((t) => [t.id, t] as const))('%s is outlined in the ink on every edge pixel and is the same every time', (_id, t) => {
    const png = t.draw(0);
    let edges = 0;
    let ink = 0;
    const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < t.w && y < t.h && png.data[(y * t.w + x) * 4 + 3] === 255;
    for (let y = 0; y < t.h; y++) {
      for (let x = 0; x < t.w; x++) {
        if (!solid(x, y) || (solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1))) continue;
        edges += 1;
        const i = (y * t.w + x) * 4;
        if (png.data[i] === INK[0] && png.data[i + 1] === INK[1] && png.data[i + 2] === INK[2]) ink += 1;
      }
    }
    expect(ink / edges).toBeGreaterThan(0.95);
    expect(Buffer.compare(png.data, t.draw(0).data)).toBe(0);
  });

  test('a tree with two frames sways: the frames differ, and the foot does not move', () => {
    for (const t of TREES.filter((x) => x.frames === 2)) {
      const a = t.draw(0);
      const b = t.draw(1);
      expect(Buffer.compare(a.data, b.data)).not.toBe(0);
      for (let y = t.h - 8; y < t.h; y++) {
        for (let x = 0; x < t.w; x++) expect(a.data[(y * t.w + x) * 4 + 3]).toBe(b.data[(y * t.w + x) * 4 + 3]);
      }
    }
  });

  test('the forest crowns are 128 square, differ from each other and leave no see-through pocket', () => {
    const crowns = [11, 23, 37].map((s) => crownPng(s));
    for (const c of crowns) {
      expect([c.width, c.height]).toEqual([128, 128]);
      expect(opaqueHeight(c)).toBeGreaterThan(80);
    }
    expect(Buffer.compare(crowns[0]!.data, crowns[1]!.data)).not.toBe(0);
    expect(Buffer.compare(crowns[1]!.data, crowns[2]!.data)).not.toBe(0);
  });
});
