/**
 * STONE HAND (public #793): the carry sheets draw the large stone in the hands, and the hand points say where; the width of the stone at
 * the row of its point is what `CARRIED_STONE_PX` (game/src/stone-art.ts) is measured from, so the share a carried stone has of the one
 * that flies is read off the pictures, not guessed. The other hand tests (points per clip, the carry-to-push hand-over) are in game/test/stone-hand.test.ts.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, test } from 'vitest';
import { REPO_ROOT } from '../src/load';
import { CARRIED_STONE_PX, STONE_CENTRE } from '../../game/src/stone-art';

type Sprite = { file: string; w: number; h: number; frames: number; clip?: { hand?: [number, number][] } };
const KIT = join(REPO_ROOT, 'content', 'kit', 'core');
const sprites = (JSON.parse(readFileSync(join(KIT, 'kit.json'), 'utf8')) as { kit: { sprites: Record<string, Sprite> } }).kit.sprites;

describe('the carry sheets draw a stone about CARRIED_STONE_PX wide in the hands', () => {
  for (const race of ['human', 'elf', 'skeleton']) {
    for (const view of ['front', 'left', 'back']) {
      test(`${race} ${view}`, () => {
        const s = sprites[`chars/${race}_carry_${view}`]!;
        const png = PNG.sync.read(readFileSync(join(KIT, s.file)));
        const frame = s.frames - 1;
        const [, hy] = s.clip!.hand![frame]!;
        let first = -1;
        let last = -1;
        for (let x = 0; x < s.w; x++) {
          if (png.data[(hy * png.width + frame * s.w + x) * 4 + 3]! >= 128) {
            if (first < 0) first = x;
            last = x;
          }
        }
        const width = last - first + 1;
        expect(width).toBeGreaterThanOrEqual(CARRIED_STONE_PX - 5);
        expect(width).toBeLessThanOrEqual(CARRIED_STONE_PX + 12);
      });
    }
  }
});

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
