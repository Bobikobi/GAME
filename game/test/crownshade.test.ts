import { describe, expect, test } from 'vitest';

import { SHADE_DEPTH, shadeBox, shadePixels, shadeShare } from '../src/crownshade';

describe('the shade under a crown', () => {
  test('trees give one, stumps, saplings and the dead tree do not', () => {
    for (const key of ['core/base-kit:props/tree_oak', 'props/young_tree', 'ceosisrael/kit:props/fig_bush', 'props/fig_bush_empty']) expect(shadeShare(key)).toBeGreaterThan(0);
    for (const key of ['props/stump', 'props/sapling', 'props/dead_tree', 'chars/elder']) expect(shadeShare(key)).toBe(0);
  });

  test('is a flat ellipse, narrower than the crown, its heart a little below the foot row', () => {
    const box = shadeBox(192, shadeShare('props/tree_oak'));
    expect(box.w).toBeLessThan(192);
    expect(box.w / box.h).toBeGreaterThan(3);
    expect(box.lift).toBeLessThan(0);
  });

  test('falls from the heart to the rim in whole steps and is clear outside the ellipse', () => {
    const w = 96;
    const h = 20;
    const px = shadePixels(w, h);
    const alpha = (x: number, y: number): number => px[(y * w + x) * 4 + 3]!;
    expect(alpha(w / 2, h / 2)).toBe(255);
    expect(alpha(0, 0)).toBe(0);
    expect(alpha(w - 1, h - 1)).toBe(0);
    expect(alpha(w / 2, h / 2)).toBeGreaterThan(alpha(w / 2 - 30, h / 2));
    const levels = new Set<number>();
    for (let i = 3; i < px.length; i += 4) if (px[i]! > 0) levels.add(px[i]!);
    expect(levels.size).toBeLessThanOrEqual(5);
  });

  test('lies under the standing layers and over the ground', () => {
    expect(SHADE_DEPTH).toBeGreaterThan(2);
    expect(SHADE_DEPTH).toBeLessThan(2.5);
  });
});
