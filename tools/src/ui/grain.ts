/**
 * Frame D's leather grain (DECISIONS 2026-10-28, "The windows' direction: black lacquer with antique
 * gold"): one small tile the windows repeat under their content, drawn here from a fixed seed so the
 * committed picture can always be made again. It is three colours of UI_PALETTE: the window's black
 * for the ground, the deeper black in its creases, and the core's
 * darkest ink for the raised grain. The noise wraps on a torus, so the tile repeats with no seam.
 *
 *   pnpm exec tsx tools/src/ui/grain.ts      writes game/public/ui/grain.png
 *
 * tools/test/ui-theme.test.ts checks the committed tile against grainTile().
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { REPO_ROOT } from '../load';
import { hexToRgb } from '../kit/palette';

export const GRAIN_SIZE = 64;
export const GRAIN_GROUND = '#131220';
export const GRAIN_CREASE = '#0c0b12';
export const GRAIN_RAISED = '#1b1a2e';
export const GRAIN_PATH = join(REPO_ROOT, 'game', 'public', 'ui', 'grain.png');

const SEED = 0x6c65_6174; // "leat"
const DEPTH = 0.4; // how far the mottle strays from the ground: the still's grain, a few shades either way

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth noise on a torus: a lattice of random values, `cells` per side, blended with a smoothstep. */
function torusNoise(rand: () => number, cells: number): (x: number, y: number) => number {
  const lattice = Array.from({ length: cells * cells }, () => rand() * 2 - 1);
  const at = (gx: number, gy: number) => lattice[((gy + cells) % cells) * cells + ((gx + cells) % cells)]!;
  const ease = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = (x / GRAIN_SIZE) * cells;
    const fy = (y / GRAIN_SIZE) * cells;
    const gx = Math.floor(fx);
    const gy = Math.floor(fy);
    const tx = ease(fx - gx);
    const ty = ease(fy - gy);
    const top = at(gx, gy) + (at(gx + 1, gy) - at(gx, gy)) * tx;
    const bottom = at(gx, gy + 1) + (at(gx + 1, gy + 1) - at(gx, gy + 1)) * tx;
    return top + (bottom - top) * ty;
  };
}

/**
 * The tile as rows of hex colours, GRAIN_SIZE square. The still's grain was a soft mottle a few
 * shades either side of the window's black; the palette has no shades that close, so each pixel is
 * the ground, a crease or a raised fleck, chosen with the odds that give the mottle's shade on
 * average (a random dither).
 */
export function grainTile(): string[][] {
  const rand = mulberry32(SEED);
  const broad = torusNoise(rand, 4);
  const fine = torusNoise(rand, 16);
  const rows: string[][] = [];
  for (let y = 0; y < GRAIN_SIZE; y++) {
    const row: string[] = [];
    for (let x = 0; x < GRAIN_SIZE; x++) {
      // the shade wanted, in steps of the ramp: -1 a crease, 0 the ground, +1 a fleck
      const shade = (0.6 * broad(x, y) + 0.4 * fine(x, y) + 0.5 * (rand() * 2 - 1)) * DEPTH;
      const r = rand();
      if (shade < 0 && r < -shade) row.push(GRAIN_CREASE);
      else if (shade > 0 && r < shade) row.push(GRAIN_RAISED);
      else row.push(GRAIN_GROUND);
    }
    rows.push(row);
  }
  return rows;
}

export function grainPng(): Buffer {
  const rows = grainTile();
  const png = new PNG({ width: GRAIN_SIZE, height: GRAIN_SIZE });
  rows.forEach((row, y) =>
    row.forEach((hex, x) => {
      const [r, g, b] = hexToRgb(hex);
      const i = (y * GRAIN_SIZE + x) * 4;
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = 255;
    }),
  );
  return PNG.sync.write(png);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(GRAIN_PATH, grainPng());
  console.log(`wrote ${GRAIN_PATH}`);
}
