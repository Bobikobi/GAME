/**
 * Shared by the ground tiles a script draws (water.ts, rubble.ts, bridge.ts): a tile is rows of palette letters, a sheet
 * is its frames side by side, and a rerun rewrites the PNG and keeps the manifest line and kit.json entry it already has.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { PNG } from 'pngjs';

import { hexToRgb } from '../kit/palette.js';
import { LETTER_PALETTE, PALETTE_LEGEND } from '../kit/sketches.js';
import { KIT_JSON, withSprite } from './pick.js';
import { ROOT } from './queue.js';

export const TILE = 64;

/** The shared teal ramp's six steps, dark to light, as letters the core legend lacks (the water's body and shallows). */
export const TEAL_LETTERS: Readonly<Record<string, string>> = { h: '#122b2c', i: '#1c4a49', j: '#2a6c66', k: '#3f8f84', l: '#62b3a2', m: '#93d6c2' };

/** A seeded hash of three integers, 0 up to 1. */
export function hash3(seed: number, a: number, b: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(a + 7, 0xc2b2ae35) ^ Math.imul(b + 13, 0x27d4eb2f);
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d);
  x ^= x >>> 12;
  return (x >>> 0) / 4294967296;
}

/** An empty tile of one letter. */
export function blank(letter: string): string[][] {
  return Array.from({ length: TILE }, () => new Array<string>(TILE).fill(letter));
}

/** The sheet of frames, side by side, 64 px a frame. */
export function sheetPng(frames: readonly (readonly string[])[]): PNG {
  const png = new PNG({ width: TILE * frames.length, height: TILE });
  frames.forEach((rows, f) => {
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const index = PALETTE_LEGEND[ch];
        const [r, g, b] = hexToRgb(TEAL_LETTERS[ch] ?? LETTER_PALETTE[index ?? 0] ?? '#1b1a2e');
        png.data.set([r, g, b, 255], (y * TILE * frames.length + f * TILE + x) * 4);
      });
    });
  });
  return png;
}

export interface Scripted {
  name: string;
  frames: readonly (readonly string[])[];
}

/** Writes the sheets, their kit.json entries and one manifest line each (kept on a rerun); returns the ids. */
export function writeScripted(spec: string, what: string, ramps: readonly string[], list: readonly Scripted[], root = ROOT, today = new Date().toISOString().slice(0, 10)): string[] {
  const kitPath = join(root, KIT_JSON);
  const manifest = join(root, 'tools/kit-gen/rich-wave.manifest.jsonl');
  let kit = readFileSync(kitPath, 'utf8');
  const wrote: string[] = [];
  for (const { name, frames } of list) {
    const id = `tiles/${name}`;
    const file = join(root, 'content/kit/core', `${id}.png`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, PNG.sync.write(sheetPng(frames)));
    const before = existsSync(manifest) ? readFileSync(manifest, 'utf8') : '';
    const lines = before.split('\n').filter((l) => l.trim() !== '');
    const own = lines.findIndex((l) => l.includes(`"sprite":"${id}"`) && l.includes(spec));
    let number = own + 1;
    if (own < 0) {
      const lead = before === '' || before.endsWith('\n') ? '' : '\n';
      number = lines.length + 1;
      appendFileSync(manifest, `${lead}${JSON.stringify({ sprite: id, name, spec, drawer: 'script', ref: id, what, ramps, picked: `script, ${today}` })}\n`);
    }
    const entry: Record<string, unknown> = { file: `${id}.png`, w: TILE, h: TILE, density: 4, ramps, source: { spec, manifest: `tools/kit-gen/rich-wave.manifest.jsonl:${number}` } };
    if (frames.length > 1) entry.frames = frames.length;
    kit = withSprite(kit, id, entry);
    wrote.push(id);
  }
  writeFileSync(kitPath, kit);
  return wrote;
}
