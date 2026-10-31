import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const LOOKS = ['grass_tuft', 'grass_tuft_b', 'grass_tuft_c'];

describe('grass tufts: the art', () => {
  /** the human's foot, sole to ankle, native px at density 4: rows 100 to 106 of chars/human_w_down frame 0 */
  const FOOT = 7;
  for (const look of LOOKS) {
    it(`${look}: at most a foot tall, root still, four frames of 64 px`, () => {
      const png = PNG.sync.read(readFileSync(resolve(root, `content/kit/core/props/${look}.png`)));
      expect([png.width, png.height]).toEqual([256, 64]);
      const roots: string[] = [];
      for (let k = 0; k < 4; k++) {
        let top = 64;
        let root = '';
        for (let y = 0; y < 64; y++) {
          for (let x = k * 64; x < k * 64 + 64; x++) {
            if (png.data[(y * 256 + x) * 4 + 3] === 255) {
              top = Math.min(top, y);
              if (y === 63) root += `${x - k * 64},`;
            }
          }
        }
        expect(64 - top).toBeLessThanOrEqual(FOOT);
        roots.push(root);
      }
      expect(new Set(roots).size).toBe(1);
    });
  }
});
