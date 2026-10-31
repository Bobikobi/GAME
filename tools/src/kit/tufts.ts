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
/** The most a tuft may stand, native px (density 4): the ankle, 0.16 of the character (31.10: 7 px, the sole-to-ankle foot, left only the ink edge; the manager set 10). */
export const MAX_H = 10;
/** How far the tips lean in each frame, native px (4 = one art px). */
export const LEAN = [0, 2, 4, 2] as const;

/** The moss ramp, then the pale yellow-green the reference's tufts wear on their tips (31.10: one shade lighter than the meadow). */
const MOSS = ['#2f4722', '#4a6a2c', '#6f8d36', '#9cb24c', '#cfd36e'].map(hexToRgb);

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
    { at: -3, h: 7, fan: -3 }, { at: -1, h: 10, fan: -1 }, { at: 0, h: 8, fan: 1 }, { at: 2, h: 10, fan: 2 }, { at: 3, h: 7, fan: 3 },
  ],
  grass_tuft_b: [
    { at: -4, h: 6, fan: -3 }, { at: -2, h: 8, fan: -2 }, { at: -1, h: 10, fan: 0 }, { at: 1, h: 8, fan: 1 }, { at: 3, h: 10, fan: 3 }, { at: 4, h: 6, fan: 3 },
  ],
  grass_tuft_c: [
    { at: -2, h: 8, fan: -3 }, { at: -1, h: 7, fan: -1 }, { at: 1, h: 10, fan: 0 }, { at: 2, h: 7, fan: 2 },
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
  for (let r = 0; r < 2; r++) for (let x = lo - 1; x <= hi + 1; x++) put(mid + x, r, r === 0 ? 1 : 2);
  for (const b of blades) {
    for (let r = 2; r < b.h; r++) {
      const f = r / Math.max(1, b.h - 1);
      const cx = mid + b.at + Math.round(b.fan * f + lean * f);
      // 3 px wide while the blade is young, 2 above its middle, a point at the top
      const half = r >= b.h - 1 ? 0 : f < 0.8 ? 1 : 0;
      const step = f >= 0.6 ? 4 : f >= 0.3 ? 3 : 2;
      for (let dx = -half; dx <= half; dx++) put(cx + dx, r, step);
      if (half === 0 && r < b.h - 1) put(cx + 1, r, step);
    }
  }
}

export function drawTuft(name: string): Buffer {
  const blades = VARIANTS[name]!;
  const png = new PNG({ width: CANVAS * FRAMES, height: CANVAS });
  for (let k = 0; k < FRAMES; k++) drawFrame(blades, LEAN[k]!, png.data as unknown as Uint8Array, k * CANVAS);
  // a gap between blades that the blades close round would be a see-through pocket once inked: fill every clear pixel
  // the frame's outside cannot reach with a solid neighbour's colour
  const d = png.data;
  const W = CANVAS * FRAMES;
  for (let k = 0; k < FRAMES; k++) {
    const out = new Set<number>();
    const queue: [number, number][] = [];
    for (let x = 0; x < CANVAS; x++) for (const y of [0, CANVAS - 1]) queue.push([x, y]);
    for (let y = 0; y < CANVAS; y++) for (const x of [0, CANVAS - 1]) queue.push([x, y]);
    while (queue.length > 0) {
      const [x, y] = queue.pop()!;
      if (x < 0 || y < 0 || x >= CANVAS || y >= CANVAS || out.has(y * CANVAS + x) || d[(y * W + k * CANVAS + x) * 4 + 3] !== 0) continue;
      out.add(y * CANVAS + x);
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    for (let y = 0; y < CANVAS; y++) {
      for (let x = 0; x < CANVAS; x++) {
        const i = (y * W + k * CANVAS + x) * 4;
        if (d[i + 3] !== 0 || out.has(y * CANVAS + x)) continue;
        const from = [[x - 1, y], [x + 1, y], [x, y + 1], [x, y - 1]].find(([nx, ny]) => d[(ny! * W + k * CANVAS + nx!) * 4 + 3] === 255);
        if (!from) continue;
        const j = (from[1]! * W + k * CANVAS + from[0]!) * 4;
        for (let c = 0; c < 4; c++) d[i + c] = d[j + c]!;
      }
    }
  }
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
