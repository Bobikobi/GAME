/**
 * The last 16 px props, redrawn at 64 px by script (rich wave 3d): the five ruin pieces (ruins.ts) and the blue flowers and
 * the hazard wolf (smalls.ts). `pnpm art:wave3d` writes the PNGs, their kit.json entries (with a declared `scale`, so the
 * scale guard reads it) and one manifest line each, kept on a rerun. Deterministic: the same files every run.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { PNG } from 'pngjs';

import { opaqueHeight } from './foliage.js';
import { KIT_JSON, withSprite } from './pick.js';
import { ROOT } from './queue.js';
import { CHARACTER_PX, RUINS, type PropDraw } from './ruins.js';
import { SMALLS } from './smalls.js';

export const WAVE3D: readonly PropDraw[] = [...RUINS, ...SMALLS];

const SPECS: Record<string, string> = Object.fromEntries([...RUINS.map((p) => [p.id, 'tools/src/art/ruins.ts']), ...SMALLS.map((p) => [p.id, 'tools/src/art/smalls.ts'])]);
const MANIFEST = 'tools/kit-gen/rich-wave.manifest.jsonl';

/** The frames of a prop side by side in one sheet. */
export function propSheet(p: PropDraw): PNG {
  const frames = Array.from({ length: p.frames }, (_, f) => p.draw(f));
  const out = new PNG({ width: p.w * p.frames, height: p.h });
  frames.forEach((f, n) => PNG.bitblt(f, out, 0, 0, f.width, f.height, n * p.w, 0));
  return out;
}

/** The height of the tallest frame in characters (two decimals), as the scale audit reads it. */
export function propScale(p: PropDraw): number {
  const tallest = Math.max(...Array.from({ length: p.frames }, (_, f) => opaqueHeight(p.draw(f))));
  return Math.round((tallest / CHARACTER_PX) * 100) / 100;
}

/** Writes the props of the given ids (all by default), their kit.json entries and one manifest line each; returns a line per prop. */
export function writeWave3d(only?: readonly string[], root = ROOT, today = new Date().toISOString().slice(0, 10)): string[] {
  const wrote: string[] = [];
  for (const p of WAVE3D) {
    if (only && !only.includes(p.id)) continue;
    const file = join(root, 'content/kit/core', `${p.id}.png`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, PNG.sync.write(propSheet(p)));
    const scale = propScale(p);
    const spec = SPECS[p.id]!;
    const manifest = join(root, MANIFEST);
    const before = existsSync(manifest) ? readFileSync(manifest, 'utf8') : '';
    const lines = before.split('\n').filter((l) => l.trim() !== '');
    const own = lines.findIndex((l) => l.includes(`"sprite":"${p.id}"`) && l.includes(spec));
    let number = own + 1;
    if (own < 0) {
      const lead = before === '' || before.endsWith('\n') ? '' : '\n';
      number = lines.length + 1;
      const line = { sprite: p.id, name: p.id.split('/').pop(), spec, drawer: 'script', ref: p.id, what: p.what, ramps: p.ramps, picked: `script, ${today}` };
      appendFileSync(manifest, `${lead}${JSON.stringify(line)}\n`);
    }
    const entry: Record<string, unknown> = { file: `${p.id}.png`, w: p.w, h: p.h, density: 4, ramps: p.ramps, scale, source: { spec, manifest: `${MANIFEST}:${number}` } };
    if (p.frames > 1) entry.frames = p.frames;
    const kitPath = join(root, KIT_JSON);
    writeFileSync(kitPath, withSprite(readFileSync(kitPath, 'utf8'), p.id, entry));
    wrote.push(`${p.id} ${p.w}x${p.h} x${p.frames}, tallest frame ${scale} characters`);
  }
  return wrote;
}
