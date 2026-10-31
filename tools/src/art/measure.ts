/**
 * The pick by measure (DECISIONS 2026-10-30, the rich 64 waves): the owner looks at one in-game still per
 * wave, not at every draft, so the builder picks among drafts by numbers that can be read off the pixels.
 *
 * `pnpm art:measure <pool> [--names a,b] [--json] [--write-picks picks.json] [--files a.png,b.png --ramps green,moss]`
 *
 * A ground tile (a fill: every pixel opaque, 64 px) is measured on:
 * - fill: no clear pixel (a corner left clear cannot tile);
 * - palette: the share of pixels outside the 32 and the entry's shared ramps (palette.ts);
 * - colours: STYLE.md section 3 asks for at least five on a 64 px fill;
 * - seam: whether the colour changes across the tile's wrap-around edge as often as it changes inside it
 *   (z below 3: a seam nobody sees);
 * - detail: the share of pixels that differ from the pixel beside them (flat ground is not rich);
 * - echo: the strongest copy of the tile on itself at a shift of 6 px or more (1 is a pattern that repeats in
 *   rows; random ground sits near 0).
 * `score` ranks the passing drafts of one entry: more colours and more detail, a quieter seam and echo.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PNG } from 'pngjs';

import { CACHE_DIR, type Draft, DraftIndex } from './drafts.js';
import { ROOT } from './queue.js';
import { type PoolEntry, type PoolName, POOLS, readPool } from './status.js';
import { hexToRgb, paletteWithRamps } from '../kit/palette.js';
import { measureSprite } from './measure-sprite.js';

export interface Limits {
  minColours: number;
  maxOffPalette: number;
  maxSeamZ: number;
  minDetail: number;
  maxDetail: number;
  maxEcho: number;
}

export const LIMITS: Limits = { minColours: 5, maxOffPalette: 0.02, maxSeamZ: 3, minDetail: 0.12, maxDetail: 0.7, maxEcho: 0.62 };

export interface TileMeasure {
  width: number;
  height: number;
  /** share of clear pixels */
  clear: number;
  colours: number;
  offPalette: number;
  seam: number;
  seamZ: number;
  detail: number;
  echo: number;
  failures: string[];
  pass: boolean;
  score: number;
}

const key = (r: number, g: number, b: number): number => (r << 16) | (g << 8) | b;
const dist = (a: Uint8Array | Buffer, i: number, j: number): number => Math.abs((a[i] ?? 0) - (a[j] ?? 0)) + Math.abs((a[i + 1] ?? 0) - (a[j + 1] ?? 0)) + Math.abs((a[i + 2] ?? 0) - (a[j + 2] ?? 0));

/**
 * The wrap seam. Of the steps across the tile's own edge (the last column to the first, the last row to the first), the
 * share where the colour changes (`edge`), against the same share over the steps inside the tile (`inner`): a tile
 * that wraps has the same share on both. `z` is how many standard deviations the edge share sits above the inner one
 * (a binomial over the edge steps); a seam nobody sees is below 3. `ratio` is the mean colour distance across the edge
 * over the mean across an inner step, kept to read by.
 */
export function seamOf(png: PNG): { edge: number; inner: number; z: number; ratio: number } {
  const { width: w, height: h, data } = png;
  let edgeChanged = 0;
  let edgeDist = 0;
  let innerChanged = 0;
  let innerDist = 0;
  let inner = 0;
  const step = (i: number, j: number, onEdge: boolean): void => {
    const d = dist(data, i, j);
    if (onEdge) {
      edgeDist += d;
      if (d > 0) edgeChanged++;
    } else {
      innerDist += d;
      inner++;
      if (d > 0) innerChanged++;
    }
  };
  for (let y = 0; y < h; y++) {
    step((y * w + w - 1) * 4, y * w * 4, true);
    for (let x = 0; x + 1 < w; x++) step((y * w + x) * 4, (y * w + x + 1) * 4, false);
  }
  for (let x = 0; x < w; x++) {
    step(((h - 1) * w + x) * 4, x * 4, true);
    for (let y = 0; y + 1 < h; y++) step((y * w + x) * 4, ((y + 1) * w + x) * 4, false);
  }
  const edgeSteps = w + h;
  const p = innerChanged / Math.max(1, inner);
  const q = edgeChanged / edgeSteps;
  const sd = Math.sqrt(Math.max(p * (1 - p), 1 / edgeSteps) / edgeSteps);
  return { edge: q, inner: p, z: (q - p) / sd, ratio: (edgeDist / edgeSteps) / Math.max(innerDist / Math.max(1, inner), 1) };
}

/** The strongest copy of the wrapping tile on itself at a shift of `minShift` px or more: 1 repeats, 0 is random. */
export function echo(png: PNG, minShift = 6): number {
  const { width: w, height: h, data } = png;
  const n = w * h;
  // the distance between two random pixels, from a fixed stride walk
  let random = 0;
  for (let i = 0; i < n; i++) random += dist(data, i * 4, ((i * 7919 + 13) % n) * 4);
  random = Math.max(random / n, 1);
  let best = 0;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = -(w >> 1); dx < w >> 1; dx++) {
      const ay = Math.min(dy, h - dy);
      if (Math.hypot(dx, ay) < minShift) continue;
      let d = 0;
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) d += dist(data, (y * w + x) * 4, (((y + dy) % h) * w + ((x + dx + w) % w)) * 4);
      best = Math.max(best, 1 - d / (n / 4) / random);
    }
  }
  return Math.max(0, best);
}

export function measureTile(png: PNG, ramps: readonly string[], limits: Limits = LIMITS): TileMeasure {
  const { width, height, data } = png;
  const allowed = new Set(paletteWithRamps(ramps).map((hex) => key(...hexToRgb(hex))));
  const seen = new Set<number>();
  let clear = 0;
  let off = 0;
  let differs = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if ((data[i + 3] ?? 0) < 255) {
        clear++;
        continue;
      }
      const k = key(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
      seen.add(k);
      if (!allowed.has(k)) off++;
      const r = (y * width + ((x + 1) % width)) * 4;
      const b = (((y + 1) % height) * width + x) * 4;
      if (dist(data, i, r) > 0 || dist(data, i, b) > 0) differs++;
    }
  }
  const total = width * height;
  const seamStat = seamOf(png);
  const seam = seamStat.ratio;
  const echoed = echo(png);
  const detail = differs / total;
  const failures: string[] = [];
  if (clear > 0) failures.push(`fill: ${clear} clear pixels`);
  if (seen.size < limits.minColours) failures.push(`colours: ${seen.size} < ${limits.minColours}`);
  if (off / total > limits.maxOffPalette) failures.push(`palette: ${(100 * off / total).toFixed(1)}% outside the shared ramps`);
  if (seamStat.z > limits.maxSeamZ) failures.push(`seam: ${(100 * seamStat.edge).toFixed(0)}% of the steps across the edge change colour, ${(100 * seamStat.inner).toFixed(0)}% inside (z ${seamStat.z.toFixed(1)} > ${limits.maxSeamZ})`);
  if (detail < limits.minDetail) failures.push(`detail: ${detail.toFixed(2)} < ${limits.minDetail} (flat)`);
  if (detail > limits.maxDetail) failures.push(`detail: ${detail.toFixed(2)} > ${limits.maxDetail} (noise)`);
  if (echoed > limits.maxEcho) failures.push(`echo: ${echoed.toFixed(2)} > ${limits.maxEcho} (a pattern in rows)`);
  const score = Math.min(seen.size, 24) / 24 + Math.min(detail, 0.4) / 0.4 - Math.max(0, seamStat.z) / 6 - echoed;
  return { width, height, clear: clear / total, colours: seen.size, offPalette: off / total, seam, seamZ: seamStat.z, detail, echo: echoed, failures, pass: failures.length === 0, score };
}

/** The picture of a draft the measures read: the imported one, else the raw one. */
export function draftFile(draft: Draft, cache = CACHE_DIR): string | null {
  for (const name of [`${draft.id}.imported.png`, `${draft.id}.png`]) if (existsSync(join(cache, name))) return join(cache, name);
  return null;
}

export interface Measured {
  pool: PoolName;
  entry: PoolEntry;
  draft: Draft;
  file: string;
  m: TileMeasure;
}

/** Every cached draft of the chosen entries, measured; archived drafts are left out. */
export function measurePool(pools: readonly PoolName[], names: readonly string[] | undefined, root = ROOT, cache = CACHE_DIR): Measured[] {
  const index = DraftIndex.open(join(root, 'tools/kit-gen/drafts.jsonl'));
  const out: Measured[] = [];
  for (const pool of pools) {
    for (const entry of readPool(pool, root)) {
      if (names !== undefined && !names.includes(entry.name)) continue;
      for (const draft of index.drafts.values()) {
        if (draft.name !== entry.name || (draft.pool !== null && draft.pool !== pool) || draft.review === 'archive') continue;
        const file = draftFile(draft, cache);
        if (file === null) continue;
        const png = PNG.sync.read(readFileSync(file));
        if (png.width !== entry.width || png.height !== entry.height) continue;
        if (entry.kind === 'sprite') {
          out.push({ pool, entry, draft, file, m: measureSprite(png, entry.ramps ?? [], entry) });
          continue;
        }
        out.push({ pool, entry, draft, file, m: measureTile(png, entry.ramps ?? []) });
      }
    }
  }
  return out;
}

/** The best passing draft of each entry, by score; an entry with none passing is absent. */
export function bestPerEntry(rows: readonly Measured[]): Map<string, Measured> {
  const best = new Map<string, Measured>();
  for (const row of rows) {
    if (!row.m.pass) continue;
    const held = best.get(row.entry.name);
    if (held === undefined || row.m.score > held.m.score) best.set(row.entry.name, row);
  }
  return best;
}

/** The picks file `art:pick --from` applies: the best passing draft of each entry, picked by "measure" (pickers/owner.json). */
export function picksFileOf(rows: readonly Measured[], at = new Date()): { picked_by: string; at: string; picks: { draft: string; action: 'pick'; note: string }[] } {
  const picks = [...bestPerEntry(rows).values()].map((r) => ({ draft: r.draft.id, action: 'pick' as const, note: `measure: score ${r.m.score.toFixed(2)}, ${r.m.colours} colours, seam z ${r.m.seamZ.toFixed(1)}, detail ${r.m.detail.toFixed(2)}, echo ${r.m.echo.toFixed(2)}` }));
  return { picked_by: 'measure', at: at.toISOString(), picks };
}

export function measureText(rows: readonly Measured[]): string {
  const lines: string[] = [];
  const best = bestPerEntry(rows);
  const names = [...new Set(rows.map((r) => r.entry.name))];
  for (const name of names) {
    lines.push(name);
    for (const r of rows.filter((x) => x.entry.name === name).sort((a, b) => b.m.score - a.m.score)) {
      const m = r.m;
      const tag = best.get(name) === r ? '*' : r.m.pass ? ' ' : 'x';
      lines.push(`  ${tag} ${r.draft.id} r${r.draft.round ?? '-'} ${(r.draft.recipe ?? 'old').padEnd(5)} score ${m.score.toFixed(2)}  col ${m.colours}  seam z ${m.seamZ.toFixed(1)}  detail ${m.detail.toFixed(2)}  echo ${m.echo.toFixed(2)}${m.pass ? '' : `  FAIL ${m.failures.join('; ')}`}`);
    }
  }
  const missing = names.filter((n) => !best.has(n));
  lines.push('', `${best.size} of ${names.length} entries have a passing draft (* is the pick)${missing.length > 0 ? `; none passes: ${missing.join(', ')}` : ''}`);
  return `${lines.join('\n')}\n`;
}

export function measureCli(args: readonly string[]): { text: string; code: number } {
  const flags = new Map<string, string>();
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? '';
    if (a.startsWith('--')) {
      const next = args[i + 1];
      if (a === '--json') flags.set('json', '1');
      else if (next === undefined || next.startsWith('--')) throw new Error(`${a} needs a value`);
      else {
        flags.set(a.slice(2), next);
        i++;
      }
    } else positional.push(a);
  }
  if (flags.has('files')) {
    const ramps = (flags.get('ramps') ?? '').split(',').filter((s) => s !== '');
    const text = (flags.get('files') ?? '').split(',').map((f) => {
      const m = measureTile(PNG.sync.read(readFileSync(f)), ramps);
      return `${f}  score ${m.score.toFixed(2)}  col ${m.colours}  seam z ${m.seamZ.toFixed(1)}  detail ${m.detail.toFixed(2)}  echo ${m.echo.toFixed(2)}${m.pass ? '' : `  FAIL ${m.failures.join('; ')}`}`;
    }).join('\n');
    return { text: `${text}\n`, code: 0 };
  }
  const pools = (positional[0] ?? '').split(',').filter((p): p is PoolName => (POOLS as readonly string[]).includes(p));
  if (pools.length === 0) throw new Error(`Usage: art:measure <${POOLS.join('|')}>[,pool] [--names a,b] [--json] [--write-picks file.json] | --files a.png,b.png [--ramps green,moss]`);
  const names = flags.get('names')?.split(',');
  const rows = measurePool(pools, names);
  const writePicks = flags.get('write-picks');
  if (writePicks !== undefined) {
    writeFileSync(writePicks, `${JSON.stringify(picksFileOf(rows), null, 1)}\n`);
    return { text: `${measureText(rows)}picks file: ${writePicks}\n`, code: 0 };
  }
  if (flags.has('json')) return { text: `${JSON.stringify(rows.map((r) => ({ name: r.entry.name, id: r.draft.id, round: r.draft.round, ...r.m })), null, 1)}\n`, code: 0 };
  return { text: measureText(rows), code: 0 };
}
