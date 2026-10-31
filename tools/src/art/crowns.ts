/**
 * The forest crowns at 64 px per tile (rich wave 3c): `props/canopy_1..3`, each 128 x 128 (a block of 2 x 2 forest tiles).
 * The old crowns were 32 x 32 sprites at 16 px per tile, so a forest showed a grid of identical blocks. A crown is now a
 * union of rounded lobes with a scalloped edge, lit from the top left: every lobe is a dome whose slope sets one of the
 * green ramp's steps, broken into leaf clumps (a jittered cell grid, each clump lit on its upper left, a dark crevice
 * between neighbours) with a few pale leaf glints. The silhouette's lower right edge takes the ramp's darkest step. The
 * three variants differ in their lobes. `pnpm art:crowns` writes the PNGs, their kit.json entries and manifest lines.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { PNG } from 'pngjs';
import { PNG as Png } from 'pngjs';

import { KIT_JSON, withSprite } from './pick.js';
import { type Lobe, drawMass, fillPockets, hash3, inkEdge, opaqueHeight, rampOf, surface } from './foliage.js';
import { ROOT } from './queue.js';
import { CHARACTER_PX } from './trees.js';

export const CROWN = 128;
/**
 * The forest's crown ramp, dark to light: the moss ramp's two olive darks for the shade a mass of crowns makes, then the green
 * ramp's fresh greens and its pale lime for the lit clumps (the shared `moss` and `green` ramps; the owner's olive moss of 30.10).
 */
export const GREEN = ['#1b2a16', '#2f4722', '#4a6a2c', '#4c9a3f', '#84c450', '#c8e88a'] as const;

/** The lobes of a variant: a ring of big ones round a middle one, each wholly inside the 128 box. */
function lobesOf(seed: number): Lobe[] {
  const lobes: Lobe[] = [];
  const count = 11 + Math.floor(hash3(seed, 1, 1) * 4);
  for (let i = 0; i < count; i += 1) {
    const ring = i === 0 ? 0 : 1;
    const angle = (i / (count - 1)) * Math.PI * 2 + hash3(seed, 2, i) * 0.7;
    const spread = ring * (20 + hash3(seed, 3, i) * 22);
    const r = 17 + hash3(seed, 4, i) * 12 + (ring === 0 ? 8 : 0);
    const x = Math.min(CROWN - 2 - r, Math.max(2 + r, CROWN / 2 + Math.cos(angle) * spread));
    const y = Math.min(CROWN - 2 - r, Math.max(2 + r, CROWN / 2 + Math.sin(angle) * spread * 0.9));
    lobes.push({ x, y, r });
  }
  return lobes;
}

/** One crown as RGBA pixels. */
export function crownPng(seed: number): PNG {
  const png = surface(CROWN, CROWN);
  drawMass(png, { ox: 0, oy: 0, w: CROWN, h: CROWN, seed, lobes: lobesOf(seed), ramp: rampOf(GREEN), clump: 26, tone: 0.1, glints: 1, contrast: 1.8 });
  fillPockets(png, rampOf(GREEN)[1]!);
  inkEdge(png);
  return png;
}

const NAMES = ['canopy_1', 'canopy_2', 'canopy_3'] as const;
const SEEDS = [11, 23, 37] as const;
const SPEC = 'tools/src/art/crowns.ts';

/** Writes the three crowns, their kit.json entries and one manifest line each (kept on a rerun); returns the ids. */
export function writeCrowns(root = ROOT, today = new Date().toISOString().slice(0, 10)): string[] {
  const kitPath = join(root, KIT_JSON);
  const manifest = join(root, 'tools/kit-gen/rich-wave.manifest.jsonl');
  let kit = readFileSync(kitPath, 'utf8');
  const wrote: string[] = [];
  NAMES.forEach((name, n) => {
    const id = `props/${name}`;
    const file = join(root, 'content/kit/core', `${id}.png`);
    mkdirSync(dirname(file), { recursive: true });
    const crown = crownPng(SEEDS[n]!);
    writeFileSync(file, Png.sync.write(crown));
    const scale = Math.round((opaqueHeight(crown) / CHARACTER_PX) * 100) / 100;
    const before = existsSync(manifest) ? readFileSync(manifest, 'utf8') : '';
    const lines = before.split('\n').filter((l) => l.trim() !== '');
    const own = lines.findIndex((l) => l.includes(`"sprite":"${id}"`) && l.includes(SPEC));
    let number = own + 1;
    if (own < 0) {
      const lead = before === '' || before.endsWith('\n') ? '' : '\n';
      number = lines.length + 1;
      const line = { sprite: id, name, spec: SPEC, drawer: 'script', ref: id, what: 'a forest crown at 64 px: rounded lobes of leaf clumps, lit from the top left', ramps: ['green', 'moss'], picked: `script, ${today}` };
      appendFileSync(manifest, `${lead}${JSON.stringify(line)}\n`);
    }
    kit = withSprite(kit, id, { file: `${id}.png`, w: CROWN, h: CROWN, density: 4, ramps: ['green', 'moss'], scale, source: { spec: SPEC, manifest: `tools/kit-gen/rich-wave.manifest.jsonl:${number}` } });
    wrote.push(id);
  });
  writeFileSync(kitPath, kit);
  return wrote;
}
