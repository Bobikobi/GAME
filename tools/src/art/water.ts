/**
 * The water at 64 px (rich wave 3, part two): four variants of a four-frame sheet, 256 x 64 each.
 *
 * Open water is the shared blue ramp: a calm mid blue with a few deeper patches (static, dithered edges) and short
 * light ripple strokes that rock a pixel or two from frame to frame and loop at the fourth. A few single sparks
 * flash in one frame each. Everything wraps, so the tile repeats without a seam; the variants differ by seed, so
 * a lake does not show one tile over and over. `pnpm art:water` writes the PNGs and their kit.json entries.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { PNG } from 'pngjs';

import { hexToRgb } from '../kit/palette.js';
import { LETTER_PALETTE, PALETTE_LEGEND } from '../kit/sketches.js';
import { KIT_JSON, withSprite } from './pick.js';
import { ROOT } from './queue.js';

const SIZE = 64;
const FRAMES = 4;

function h(seed: number, a: number, b: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(a + 7, 0xc2b2ae35) ^ Math.imul(b + 13, 0x27d4eb2f);
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d);
  x ^= x >>> 12;
  return (x >>> 0) / 4294967296;
}

/** Value noise that wraps over a `lat` x `lat` lattice across the tile. */
function wrapNoise(seed: number, lat: number, x: number, y: number): number {
  const fx = (x / SIZE) * lat;
  const fy = (y / SIZE) * lat;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const g = (i: number, j: number): number => h(seed, ((i % lat) + lat) % lat, ((j % lat) + lat) % lat);
  return (g(x0, y0) * (1 - sx) + g(x0 + 1, y0) * sx) * (1 - sy) + (g(x0, y0 + 1) * (1 - sx) + g(x0 + 1, y0 + 1) * sx) * sy;
}

/** One frame of one variant as rows of palette letters. */
export function waterRows(seed: number, frame: number): string[] {
  const rows = Array.from({ length: SIZE }, () => new Array<string>(SIZE).fill('s'));
  const set = (x: number, y: number, c: string): void => {
    const row = rows[((y % SIZE) + SIZE) % SIZE];
    if (row) row[((x % SIZE) + SIZE) % SIZE] = c;
  };
  // the deeper patches: static, with a dithered edge
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const n = wrapNoise(seed, 4, x, y) * 0.7 + wrapNoise(seed + 5, 8, x, y) * 0.3;
      if (n > 0.72 || (n > 0.64 && h(seed + 9, x, y) < (n - 0.64) / 0.08 * 0.5)) set(x, y, 'r');
    }
  }
  // the ripples: short wavy strokes, each rocking on its own phase
  for (let i = 0; i < 11; i += 1) {
    const x0 = Math.floor(h(seed + 20, i, 0) * SIZE);
    const y0 = Math.floor(h(seed + 21, i, 0) * SIZE);
    const len = 7 + Math.floor(h(seed + 22, i, 0) * 9);
    const phase = h(seed + 23, i, 0) * Math.PI * 2;
    const rock = Math.round(1.6 * Math.sin((frame / FRAMES) * Math.PI * 2 + phase));
    const bob = Math.round(0.7 * Math.sin((frame / FRAMES) * Math.PI * 2 + phase + 1.3));
    const shown = len - (((frame + i) % FRAMES) === 0 ? 2 : 0);
    for (let k = 0; k < shown; k += 1) {
      const wave = Math.round(Math.sin((k / len) * Math.PI * 2 + phase) * 0.8);
      const x = x0 + k + rock;
      const y = y0 + wave + bob;
      set(x, y, k > 0 && k < shown - 1 && k % 4 === 2 ? 'z' : 't');
      if (k % 2 === 0) set(x + 1, y + 1, 'r');
    }
  }
  // sparks: one pixel, one frame each
  for (let i = 0; i < 7; i += 1) {
    if ((i + seed) % FRAMES !== frame) continue;
    set(Math.floor(h(seed + 30, i, 0) * SIZE), Math.floor(h(seed + 31, i, 0) * SIZE), 'z');
  }
  return rows.map((r) => r.join(''));
}

/** The four-frame sheet of a variant, 256 x 64. */
export function waterSheet(seed: number): PNG {
  const png = new PNG({ width: SIZE * FRAMES, height: SIZE });
  for (let f = 0; f < FRAMES; f += 1) {
    waterRows(seed, f).forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const index = PALETTE_LEGEND[ch];
        const [r, g, b] = hexToRgb(LETTER_PALETTE[index ?? 18] ?? '#3f8fd1');
        png.data.set([r, g, b, 255], (y * SIZE * FRAMES + f * SIZE + x) * 4);
      });
    });
  }
  return png;
}

const NAMES = ['water', 'water_1', 'water_2', 'water_3'] as const;

/** Writes the four sheets, their kit.json entries and one manifest line each. */
export function writeWater(root = ROOT, today = new Date().toISOString().slice(0, 10)): string[] {
  const kitPath = join(root, KIT_JSON);
  const manifest = join(root, 'tools/kit-gen/rich-wave.manifest.jsonl');
  let kit = readFileSync(kitPath, 'utf8');
  const wrote: string[] = [];
  NAMES.forEach((name, i) => {
    const id = `tiles/${name}`;
    const file = join(root, 'content/kit/core', `${id}.png`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, PNG.sync.write(waterSheet(101 + i * 17)));
    const before = existsSync(manifest) ? readFileSync(manifest, 'utf8') : '';
    const lead = before === '' || before.endsWith('\n') ? '' : '\n';
    const number = (before + lead).split('\n').filter((l) => l.trim() !== '').length + 1;
    appendFileSync(manifest, `${lead}${JSON.stringify({ sprite: id, name, spec: 'tools/src/art/water.ts', drawer: 'script', ref: id, what: 'open water at 64 px, four frames of drifting ripples', ramps: ['water'], picked: `script, ${today}` })}\n`);
    kit = withSprite(kit, id, { file: `${id}.png`, w: SIZE, h: SIZE, frames: FRAMES, density: 4, ramps: ['water'], source: { spec: 'tools/src/art/water.ts', manifest: `tools/kit-gen/rich-wave.manifest.jsonl:${number}` } });
    wrote.push(id);
  });
  writeFileSync(kitPath, kit);
  return wrote;
}
