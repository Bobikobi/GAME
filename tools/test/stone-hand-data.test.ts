/**
 * STONE HAND (public #793): where the middle of each stone picture is. The size of a carried stone against the world's is held by the check
 * of tools/src/kit/held.ts (#874, tools/test/held-scale.test.ts). The other hand tests (points per clip, the carry-to-push hand-over) are in game/test/stone-hand.test.ts.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, test } from 'vitest';
import { REPO_ROOT } from '../src/load';
import { STONE_CENTRE } from '../../game/src/stone-art';

const KIT = join(REPO_ROOT, 'content', 'kit', 'core');

describe('the stone is drawn about the middle of its drawn part', () => {
  for (const [size, file] of [['small', 'items/stone_small.png'], ['large', 'items/stone.png']] as const) {
    test(size, () => {
      const png = PNG.sync.read(readFileSync(join(KIT, file)));
      let x0 = png.width, y0 = png.height, x1 = -1, y1 = -1;
      for (let y = 0; y < png.height; y++) {
        for (let x = 0; x < png.width; x++) {
          if (png.data[(y * png.width + x) * 4 + 3]! < 128) continue;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
      }
      expect((x0 + x1 + 1) / 2 / png.width).toBeCloseTo(STONE_CENTRE[size][0], 1);
      expect((y0 + y1 + 1) / 2 / png.height).toBeCloseTo(STONE_CENTRE[size][1], 2);
    });
  }
});
