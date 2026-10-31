/**
 * The water at 64 px, from the owner's layered water of 25.10 (a Codex study, kept in tools/kit-gen/water-layers with its
 * provenance): four variants of a four-frame sheet. The study composed its water at run time from four generated layers; this
 * bakes the deep body the same way the study's compositor did, `base * .65 + body * .2 + body * .15`, with the body layer
 * sampled at two scales, and lays the light layer's glints over it a frame at a time. The result is quantised onto the teal
 * ramp so it stays inside the palette rule. The shallows, the bed showing through and the foam
 * at a shore are the world's (pathedge.ts), cut per pixel along the shore. Everything wraps at 64, so the tile repeats without a
 * seam; the variants differ by the part of the layers they read. `pnpm art:water` writes the PNGs and their kit.json entries.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PNG } from 'pngjs';

import { ROOT } from './queue.js';
import { TILE, hash3, writeScripted } from './scripted.js';

const FRAMES = 4;
/** Radius of the box blur that softens the body, in pixels. */
const BLUR = 5;
const LAYER_DIR = 'tools/kit-gen/water-layers';
/** The shares of a tile by the body's brightness, darkest first: deep patches, the body, lighter patches. The cove's deep water measures (50, 92, 87), between the ramp's second and third steps. */
const SHARES = { deep: 0.74, light: 0.025 };
/** 2x2 ordered dither, as a fraction of the body's spread: patches meet in a soft stipple, not a hard edge. */
const BAYER = [0, 2, 3, 1].map((n) => (n + 0.5) / 4 - 0.5);
const DITHER = 0.4;

const layers = new Map<string, PNG>();
function layer(name: string): PNG {
  let png = layers.get(name);
  if (!png) {
    png = PNG.sync.read(readFileSync(join(ROOT, LAYER_DIR, `${name}.png`)));
    layers.set(name, png);
  }
  return png;
}
const wrap = (v: number, n: number): number => ((Math.floor(v) % n) + n) % n;
const texel = (png: PNG, x: number, y: number, c: number): number => png.data[(wrap(y, png.height) * png.width + wrap(x, png.width)) * 4 + c]!;

/** One frame of one variant as rows of palette letters (the body's teal steps, the light's glints in the pale ones). */
export function waterRows(seed: number, frame: number): string[] {
  const body = layer('body');
  const light = layer('light');
  // the body is the same in every variant, so the tiles meet without a seam; the variants differ in where the light falls
  const ox = 12;
  const oy = 90;
  const gox = Math.floor(hash3(seed, 1, 0) * 128);
  const goy = Math.floor(hash3(seed, 2, 0) * 128);
  // a gentle rock from frame to frame (the study's refraction wobble), looping at the fourth frame
  const rockX = Math.round(2 * Math.sin((frame / FRAMES) * Math.PI * 2));
  const rockY = Math.round(2 * Math.sin((frame / FRAMES) * Math.PI * 2 + 1.3));
  // the study's body as a brightness, read every second texel so it repeats at 64 (the layer is 128)
  const field: number[] = [];
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const ax = (x + rockX) * 2 + ox;
      const ay = (y + rockY) * 2 + oy;
      const lum = (px: number, py: number): number => texel(body, px, py, 0) * 0.3 + texel(body, px, py, 1) * 0.5 + texel(body, px, py, 2) * 0.2;
      field.push(lum(ax, ay));
    }
  }
  // softened (a wrapped box blur), so the body reads as broad rounded patches, not the layer's fine net
  const soft = field.map((_, n) => {
    const x = n % TILE;
    const y = Math.floor(n / TILE);
    let sum = 0;
    for (let dy = -BLUR; dy <= BLUR; dy += 1) for (let dx = -BLUR; dx <= BLUR; dx += 1) sum += field[wrap(y + dy, TILE) * TILE + wrap(x + dx, TILE)]!;
    return sum / (2 * BLUR + 1) ** 2;
  });
  // the tile's own brightness decides which share a pixel falls in, so every variant and frame has the same balance of patches
  const sorted = [...soft].sort((p, q) => p - q);
  const lowCut = sorted[Math.floor(sorted.length * SHARES.deep)]!;
  const highCut = sorted[Math.floor(sorted.length * (1 - SHARES.light))]!;
  const spread = sorted[Math.floor(sorted.length * 0.9)]! - sorted[Math.floor(sorted.length * 0.1)]!;
  const rows: string[] = [];
  for (let y = 0; y < TILE; y += 1) {
    let row = '';
    for (let x = 0; x < TILE; x += 1) {
      const v = soft[y * TILE + x]! + BAYER[(x & 1) + 2 * (y & 1)]! * spread * DITHER;
      let ch = v < lowCut ? 'i' : v > highCut ? 'k' : 'j';
      // the light layer's glints: where it is bright, and in the frame whose turn it is
      const lx = x * 2 + gox + 17;
      const ly = y * 2 + goy + 29;
      const lv = (texel(light, lx, ly, 0) + texel(light, lx, ly, 1) + texel(light, lx, ly, 2)) / 765;
      const pulse = 0.12 + 0.65 * Math.max(0, Math.sin((frame / FRAMES) * Math.PI * 2 + lx * 0.045 + ly * 0.018)) ** 6;
      const glint = Math.min(1, Math.max(0, (lv - 0.42) * 2.5)) * pulse;
      if (glint > 0.4) ch = glint > 0.62 ? 'm' : 'l';
      row += ch;
    }
    rows.push(row);
  }
  return rows;
}

const NAMES = ['water', 'water_1', 'water_2', 'water_3'] as const;

/** Writes the four sheets, their kit.json entries and one manifest line each. */
export function writeWater(): string[] {
  return writeScripted(
    'tools/src/art/water.ts',
    'open water at 64 px from the layered water study of 25.10, four frames',
    ['teal', 'water'],
    NAMES.map((name, i) => ({ name, frames: Array.from({ length: FRAMES }, (_, f) => waterRows(101 + i * 17, f)) })),
  );
}

/** The four layers as a module the game reads (game/src/waterlayers.ts): each a palette of hex colours and 128 rows of palette indices in base 36. */
export function layersModule(): string {
  const out = [
    '// Generated by `pnpm art:water` from tools/kit-gen/water-layers (the owner\'s layered water of 25.10, with its provenance there). Do not edit by hand.',
    '/* eslint-disable */',
    'export interface WaterLayerData {',
    '  palette: readonly string[];',
    '  rows: readonly string[];',
    '}',
    '',
    'export const WATER_LAYERS: Readonly<Record<\'bed\' | \'body\' | \'foam\' | \'light\', WaterLayerData>> = {',
  ];
  for (const name of ['bed', 'body', 'foam', 'light']) {
    const png = layer(name);
    const palette: string[] = [];
    const rows: string[] = [];
    for (let y = 0; y < png.height; y += 1) {
      let row = '';
      for (let x = 0; x < png.width; x += 1) {
        const i = (y * png.width + x) * 4;
        const hex = [png.data[i]!, png.data[i + 1]!, png.data[i + 2]!].map((v) => v.toString(16).padStart(2, '0')).join('');
        let at = palette.indexOf(hex);
        if (at < 0) at = palette.push(hex) - 1;
        row += at.toString(36);
      }
      rows.push(row);
    }
    out.push(`  ${name}: {`, `    palette: ${JSON.stringify(palette)},`, '    rows: [', ...rows.map((r) => `      '${r}',`), '    ],', '  },');
  }
  out.push('};', '');
  return out.join('\n');
}

/** Writes the module. */
export function writeLayersModule(root = ROOT): string {
  const path = join(root, 'game/src/waterlayers.ts');
  writeFileSync(path, layersModule());
  return 'game/src/waterlayers.ts';
}
