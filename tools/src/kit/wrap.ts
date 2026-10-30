/**
 * Makes a ground fill wrap: the right edge continues the left and the bottom continues the top, with no new colour.
 *
 * A picture drawn by a model does not tile. Per axis, each pixel is taken either from the picture or from the same
 * picture shifted half its width (or height), by a seeded hash against a weight that is 0 at the edge and 1 in the
 * middle (`sin²`). At the edge every pixel comes from the shifted copy, whose edges are the picture's own middle
 * (columns W/2-1 and W/2, side by side in the picture), so the seam is continuous; in the middle the picture stays
 * itself. The choice is a pixel's own, never a blend, so the colours stay the palette's and the pixels stay square.
 * Both axes in turn. The hash makes the change over a band of pixels, not along a line (DECISIONS 2026-10-30).
 */
import { PNG } from 'pngjs';

import { hash } from './scatter.js';

const SEED = 0x51ed2701;

function pass(src: PNG, horizontal: boolean, seed: number): PNG {
  const { width: w, height: h } = src;
  const out = new PNG({ width: w, height: h });
  const span = horizontal ? w : h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = (horizontal ? x : y) / (span - 1);
      const keep = Math.sin(Math.PI * t) ** 2;
      const roll = hash(seed, x, y, horizontal ? 1 : 2);
      const fromShift = roll >= keep;
      const sx = fromShift && horizontal ? (x + (w >> 1)) % w : x;
      const sy = fromShift && !horizontal ? (y + (h >> 1)) % h : y;
      const from = (sy * w + sx) * 4;
      out.data.set(src.data.subarray(from, from + 4), (y * w + x) * 4);
    }
  }
  return out;
}

export function wrapTile(png: Buffer): Buffer {
  const image = PNG.sync.read(png);
  return PNG.sync.write(pass(pass(image, true, SEED), false, SEED + 1));
}
