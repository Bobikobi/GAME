/**
 * The dry sand (rich wave 3b): the pool's sand tiles came out on the brown steps of the wood ramp, which reads as mud
 * next to a pale beach. Every pixel moves one step up the sand ramp (dark brown, brown, tan, pale), so the tile's
 * ripples and pebbles stay where they are and the world's wet rim (pathedge.ts) is the only darker sand. A tile is moved
 * once: one whose most common colour is no longer the brown is left alone. The ruins keep the old darker sand: before a
 * tile is moved its brown pixels are saved as `sand_ruin` (and `_1`, `_2`), which the world draws on the ruin floor's sand.
 * `pnpm art:sand` writes the PNGs, their kit.json entries and the manifest lines.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PNG } from 'pngjs';

import { KIT_JSON, withSprite } from './pick.js';
import { ROOT } from './queue.js';

const NAMES = ['sand', 'sand_1', 'sand_2'] as const;
const BROWN = 0x9e6b3c;
/** One step lighter on the sand ramp (the grey pebbles and the white glints stay). */
const DRIER = new Map<number, number>([
  [0x3d2618, 0x6e4226],
  [0x6e4226, 0x9e6b3c],
  [0x9e6b3c, 0xc99a5e],
  [0xc99a5e, 0xebd3a2],
]);

/** The tile one step drier, or null when it already is. */
export function drySand(png: PNG): PNG | null {
  const counts = new Map<number, number>();
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i + 3] === 0) continue;
    const c = (png.data[i]! << 16) | (png.data[i + 1]! << 8) | png.data[i + 2]!;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (top !== BROWN) return null;
  const out = new PNG({ width: png.width, height: png.height });
  for (let i = 0; i < png.data.length; i += 4) {
    const c = (png.data[i]! << 16) | (png.data[i + 1]! << 8) | png.data[i + 2]!;
    const m = DRIER.get(c) ?? c;
    out.data.set([m >> 16, (m >> 8) & 255, m & 255, png.data[i + 3]!], i);
  }
  return out;
}

/** Moves the sand tiles that are still brown, after saving each as the ruin's own; returns the ids it wrote. */
export function writeSand(root = ROOT, today = new Date().toISOString().slice(0, 10)): string[] {
  const manifest = join(root, 'tools/kit-gen/rich-wave.manifest.jsonl');
  const kitPath = join(root, KIT_JSON);
  const wrote: string[] = [];
  const log = (line: Record<string, unknown>): void => {
    const before = existsSync(manifest) ? readFileSync(manifest, 'utf8') : '';
    const lead = before === '' || before.endsWith('\n') ? '' : '\n';
    appendFileSync(manifest, `${lead}${JSON.stringify(line)}\n`);
  };
  for (const name of NAMES) {
    const file = join(root, 'content/kit/core/tiles', `${name}.png`);
    if (!existsSync(file)) continue;
    const old = readFileSync(file);
    const dry = drySand(PNG.sync.read(old));
    if (!dry) continue;
    const ruin = name.replace('sand', 'sand_ruin');
    writeFileSync(join(root, 'content/kit/core/tiles', `${ruin}.png`), old);
    const kit = JSON.parse(readFileSync(kitPath, 'utf8')) as { kit: { sprites: Record<string, Record<string, unknown>> } };
    const entry = kit.kit.sprites[`tiles/${name}`];
    if (entry) writeFileSync(kitPath, withSprite(readFileSync(kitPath, 'utf8'), `tiles/${ruin}`, { ...entry, file: `tiles/${ruin}.png` }));
    log({ sprite: `tiles/${ruin}`, name: ruin, spec: 'tools/src/art/sand.ts', drawer: 'script', ref: `tiles/${name}`, what: `the ruin floor's sand: tiles/${name} as the pool drew it, before it was dried`, ramps: ['wood', 'grey'], picked: `script, ${today}` });
    writeFileSync(file, PNG.sync.write(dry));
    log({ sprite: `tiles/${name}`, name, spec: 'tools/src/art/sand.ts', drawer: 'script', ref: `tiles/${name}`, what: 'sand one step drier on the sand ramp', ramps: ['wood', 'grey'], picked: `script, ${today}` });
    wrote.push(`tiles/${ruin}`, `tiles/${name}`);
  }
  return wrote;
}
