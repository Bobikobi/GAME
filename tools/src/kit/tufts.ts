/**
 * The grass tufts, Route D (manager, 31.10): a ground motif, not a prop. The owner's ink rule (PR #305) puts a dark ring on
 * every density 4 sprite outside `tiles/`; at tuft size the ring swallows the blade and a tuft reads darker than the grass,
 * where the reference's tufts are lighter than it (measured on the reference clip: a tuft's pale pixels carry 1.36 times the
 * luminance of the grass round them, mean of ten tufts). So the tufts are `tiles/` sprites (ground, never outlined), drawn
 * in the moss ramp: a dark root pixel, a lit body, the lightest step on the upper blade.
 *
 * Each is at most `MAX_H` native px tall (the ankle, 0.16 of the character) and four frames of a lean: the tips move 0, 0.5,
 * 1 and 0.5 art px (4 native px = 1 art px; two would lay a blade flat) to the right while the roots hold. The moss ramp is
 * used because its two lightest steps are not the ones the screen's gust moves (richground.ts `MOVES`).
 *
 * `pnpm exec tsx tools/src/kit/tufts.ts` writes `tiles/grass_tuft{,_b,_c}.png` and their kit.json entries.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';

import { hexToRgb } from './palette.js';

export const CANVAS = 64;
export const FRAMES = 4;
/** The most a tuft may stand, native px (density 4): the ankle, 0.16 of the character (31.10: 7 px, the sole-to-ankle foot, left only the ink edge; the manager set 10). */
export const MAX_H = 12;
/** How far the tips lean in each frame, native px (4 = one art px). */
export const LEAN = [0, 2, 4, 2] as const;

/** The moss ramp, then the pale yellow-green the reference's tufts wear on their tips (31.10: one shade lighter than the meadow). */
const MOSS = ['#2f4722', '#4a6a2c', '#6f8d36', '#9cb24c', '#cfd36e', '#fff3a8'].map(hexToRgb);

interface Blade {
  /** root column, px from the tuft's middle */
  at: number;
  /** blade height, px */
  h: number;
  /** where the tip would stand without wind, px right of the root */
  fan: number;
}

/** Three clumps of 5, 6 and 7 blades, 8 to 10 px wide and 10 to 12 tall, over a 3 px body. */
export const VARIANTS: Record<string, Blade[]> = {
  grass_tuft: [
    { at: -3, h: 10, fan: -1 }, { at: -1, h: 12, fan: 0 }, { at: 0, h: 11, fan: 0 }, { at: 2, h: 12, fan: 1 }, { at: 3, h: 10, fan: 1 },
  ],
  grass_tuft_b: [
    { at: -3, h: 10, fan: -2 }, { at: -2, h: 11, fan: -1 }, { at: -1, h: 12, fan: 0 }, { at: 1, h: 12, fan: 0 }, { at: 2, h: 11, fan: 1 }, { at: 3, h: 10, fan: 1 },
  ],
  grass_tuft_c: [
    { at: -3, h: 10, fan: -1 }, { at: -2, h: 11, fan: -1 }, { at: -1, h: 12, fan: 0 }, { at: 0, h: 11, fan: 0 }, { at: 1, h: 12, fan: 1 }, { at: 2, h: 11, fan: 1 }, { at: 3, h: 10, fan: 1 },
  ],
};

/** One frame's picture of a tuft: blades of 2 px (3 below their middle) ending in a point, over a 3 px body that the lean never touches. */
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
  const hi = Math.max(...blades.map((b) => b.at)) + 1;
  for (let r = 0; r < 3; r++) for (let x = lo; x <= hi; x++) put(mid + x, r, r === 0 ? 2 : 3);
  for (const b of blades) {
    for (let r = 3; r < b.h; r++) {
      const f = r / Math.max(1, b.h - 1);
      const cx = mid + b.at + Math.round(b.fan * f + lean * f);
      const step = f >= 0.7 ? 5 : f >= 0.3 ? 4 : 3;
      put(cx, r, step);
      if (r < b.h - 1) put(cx + 1, r, step);
      if (f < 0.6 && b.at !== lo) put(cx - 1, r, 3);
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
  return PNG.sync.write(png);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const kitDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/kit/core');
  const kitPath = join(kitDir, 'kit.json');
  const kit = JSON.parse(readFileSync(kitPath, 'utf8'));
  for (const name of Object.keys(VARIANTS)) {
    writeFileSync(join(kitDir, 'tiles', `${name}.png`), drawTuft(name));
    kit.kit.sprites[`tiles/${name}`] = { file: `tiles/${name}.png`, w: CANVAS, h: CANVAS, frames: FRAMES, density: 4, ramps: ['moss', 'fire'] };
  }
  writeFileSync(kitPath, `${JSON.stringify(kit, null, 2)}\n`);
  console.log('wrote', Object.keys(VARIANTS).join(', '));
}
