/**
 * The grass tufts (owner, 31.10: "the blades should be a whole cell, then scattered at random like the picture so that
 * they move ... really the height of a foot and no more"): three low clumps of blades, each four frames of a lean.
 *
 * Drawn in code, in the moss ramp, then given the ink edge (ink.ts). A tuft is at most `MAX_H` native px tall, the height
 * of the human's foot from sole to ankle (measured on `chars/human_w_down` frame 0: rows 100 to 106, 7 px at density 4),
 * root on the canvas' bottom row, tips leaning 0, 0.5, 1 and 0.5 art px (4 native px = 1 art px; two would lay a 7 px blade flat) to the right over the four
 * frames while the root holds: the wind's lean, not a wobble. The moss ramp is used because its two lightest steps are
 * not the ones the screen's gust moves (richground.ts `MOVES`), so a tuft moves by its frames only.
 *
 * `pnpm exec tsx tools/src/kit/tufts.ts` writes `props/grass_tuft{,_b,_c}.png` and their kit.json entries.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';

import { applyInk } from './ink.js';
import { hexToRgb } from './palette.js';

export const CANVAS = 64;
export const FRAMES = 4;
/** The human's foot, sole to ankle, in native px (density 4): the most a tuft may stand. */
export const MAX_H = 7;
/** How far the tips lean in each frame, native px (4 = one art px). */
export const LEAN = [0, 2, 4, 2] as const;

const MOSS = ['#2f4722', '#4a6a2c', '#6f8d36', '#9cb24c'].map(hexToRgb);

interface Blade {
  /** root column, px from the tuft's middle */
  at: number;
  /** blade height, px */
  h: number;
  /** where the tip would stand without wind, px right of the root */
  fan: number;
}

/** Three clumps, root narrow and tips spread. */
export const VARIANTS: Record<string, Blade[]> = {
  grass_tuft: [
    { at: -3, h: 5, fan: -3 }, { at: -1, h: 7, fan: -1 }, { at: 0, h: 6, fan: 1 }, { at: 2, h: 7, fan: 2 }, { at: 3, h: 5, fan: 3 },
  ],
  grass_tuft_b: [
    { at: -4, h: 4, fan: -3 }, { at: -2, h: 6, fan: -2 }, { at: -1, h: 7, fan: 0 }, { at: 1, h: 6, fan: 1 }, { at: 3, h: 7, fan: 3 }, { at: 4, h: 4, fan: 3 },
  ],
  grass_tuft_c: [
    { at: -2, h: 6, fan: -3 }, { at: -1, h: 5, fan: -1 }, { at: 1, h: 7, fan: 0 }, { at: 2, h: 5, fan: 2 },
  ],
};

/** One frame's picture of a tuft: blades of a 3 px body that taper to a point, over a solid root three rows deep. */
function drawFrame(blades: Blade[], lean: number, rgba: Uint8Array, x0: number): void {
  const mid = x0 + CANVAS / 2;
  const put = (x: number, r: number, step: number): void => {
    const [R, G, B] = MOSS[step]!;
    const p = ((CANVAS - 1 - r) * CANVAS * FRAMES + x) * 4;
    rgba[p] = R;
    rgba[p + 1] = G;
    rgba[p + 2] = B;
    rgba[p + 3] = 255;
  };
  const lo = Math.min(...blades.map((b) => b.at));
  const hi = Math.max(...blades.map((b) => b.at));
  // the root: one solid mass, the lean never touches it
  for (let r = 0; r < 2; r++) for (let x = lo - 1; x <= hi + 1; x++) put(mid + x, r, r === 0 ? 0 : 1);
  for (const b of blades) {
    for (let r = 2; r < b.h; r++) {
      const f = r / Math.max(1, b.h - 1);
      const cx = mid + b.at + Math.round(b.fan * f + lean * f);
      // 3 px wide while the blade is young, 2 above its middle, a point at the top
      const half = r >= b.h - 1 ? 0 : f < 0.8 ? 1 : 0;
      const step = Math.min(3, 1 + Math.floor(f * 3));
      for (let dx = -half; dx <= half; dx++) put(cx + dx, r, step);
      if (half === 0 && r < b.h - 1) put(cx + 1, r, step);
    }
  }
}

export function drawTuft(name: string): Buffer {
  const blades = VARIANTS[name]!;
  const png = new PNG({ width: CANVAS * FRAMES, height: CANVAS });
  for (let k = 0; k < FRAMES; k++) drawFrame(blades, LEAN[k]!, png.data as unknown as Uint8Array, k * CANVAS);
  return applyInk(PNG.sync.write(png), CANVAS);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const kitDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/kit/core');
  const kitPath = join(kitDir, 'kit.json');
  const kit = JSON.parse(readFileSync(kitPath, 'utf8'));
  for (const name of Object.keys(VARIANTS)) {
    writeFileSync(join(kitDir, 'props', `${name}.png`), drawTuft(name));
    kit.kit.sprites[`props/${name}`] = { file: `props/${name}.png`, w: CANVAS, h: CANVAS, frames: FRAMES, density: 4, ramps: ['moss'] };
  }
  writeFileSync(kitPath, `${JSON.stringify(kit, null, 2)}\n`);
  console.log('wrote', Object.keys(VARIANTS).join(', '));
}
