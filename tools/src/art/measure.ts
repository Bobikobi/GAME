/**
 * The pick by measure (DECISIONS 2026-10-30, the rich 64 waves): the owner looks at one in-game still per
 * wave, not at every draft, so the builder picks among drafts by numbers that can be read off the pixels.
 *
 * `pnpm art:measure <pool> [--names a,b] [--json] [--files a.png,b.png --ramps green,moss]`
 *
 * A ground tile (a fill: every pixel opaque, 64 px) is measured on:
 * - fill: no clear pixel (a corner left clear cannot tile);
 * - palette: the share of pixels outside the 32 and the entry's shared ramps (palette.ts);
 * - colours: STYLE.md section 3 asks for at least five on a 64 px fill;
 * - seam: how much the tile's wrap-around edge differs, against how much two neighbouring columns (rows) of the
 *   tile differ (1 is a seam nobody sees);
 * - detail: the share of pixels that differ from the pixel beside them (flat ground is not rich);
 * - echo: the strongest copy of the tile on itself at a shift of 6 px or more (1 is a pattern that repeats in
 *   rows; random ground sits near 0).
 * `score` ranks the passing drafts of one entry: more colours and more detail, a quieter seam and echo.
 */
import { existsSync, readFileSync } from 'node:fs';
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
  maxSeam: number;
  minDetail: number;
  maxDetail: number;
  maxEcho: number;
}

export const LIMITS: Limits = { minColours: 5, maxOffPalette: 0.02, maxSeam: 1.35, minDetail: 0.12, maxDetail: 0.7, maxEcho: 0.62 };

export interface TileMeasure {
  width: number;
  height: number;
  /** share of clear pixels */
  clear: number;
  colours: number;
  offPalette: number;
  seam: number;
  detail: number;
  echo: number;
  failures: string[];
  pass: boolean;
  score: number;
}

const key = (r: number, g: number, b: number): number => (r << 16) | (g << 8) | b;
const dist = (a: Uint8Array | Buffer, i: number, j: number): number => Math.abs((a[i] ?? 0) - (a[j] ?? 0)) + Math.abs((a[i + 1] ?? 0) - (a[j + 1] ?? 0)) + Math.abs((a[i + 2] ?? 0) - (a[j + 2] ?? 0));

/** The wrap seam: the mean distance across the tile's own edge over the mean distance across its inner steps. */
export function seamRatio(png: PNG): number {
  const { width: w, height: h, data } = png;
  const mean = (edge: number, steps: number): number => (steps === 0 ? 0 : edge / steps);
  let edgeX = 0;
  let inX = 0;
  for (let y = 0; y < h; y++) {
    edgeX += dist(data, (y * w + w - 1) * 4, y * w * 4);
    for (let x = 0; x + 1 < w; x++) inX += dist(data, (y * w + x) * 4, (y * w + x + 1) * 4);
  }
  let edgeY = 0;
  let inY = 0;
  for (let x = 0; x < w; x++) {
    edgeY += dist(data, ((h - 1) * w + x) * 4, x * 4);
    for (let y = 0; y + 1 < h; y++) inY += dist(data, (y * w + x) * 4, ((y + 1) * w + x) * 4);
  }
  const base = (a: number, steps: number): number => Math.max(mean(a, steps), 1);
  return Math.max(mean(edgeX, h) / base(inX, h * (w - 1)), mean(edgeY, w) / base(inY, w * (h - 1)));
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
  const seam = seamRatio(png);
  const echoed = echo(png);
  const detail = differs / total;
  const failures: string[] = [];
  if (clear > 0) failures.push(`fill: ${clear} clear pixels`);
  if (seen.size < limits.minColours) failures.push(`colours: ${seen.size} < ${limits.minColours}`);
  if (off / total > limits.maxOffPalette) failures.push(`palette: ${(100 * off / total).toFixed(1)}% outside the shared ramps`);
  if (seam > limits.maxSeam) failures.push(`seam: ${seam.toFixed(2)} > ${limits.maxSeam}`);
  if (detail < limits.minDetail) failures.push(`detail: ${detail.toFixed(2)} < ${limits.minDetail} (flat)`);
  if (detail > limits.maxDetail) failures.push(`detail: ${detail.toFixed(2)} > ${limits.maxDetail} (noise)`);
  if (echoed > limits.maxEcho) failures.push(`echo: ${echoed.toFixed(2)} > ${limits.maxEcho} (a pattern in rows)`);
  const score = Math.min(seen.size, 24) / 24 + Math.min(detail, 0.4) / 0.4 - Math.max(0, seam - 1) - echoed;
  return { width, height, clear: clear / total, colours: seen.size, offPalette: off / total, seam, detail, echo: echoed, failures, pass: failures.length === 0, score };
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
        if (entry.kind === 'sprite') {
          out.push({ pool, entry, draft, file, m: measureSprite(png, entry.ramps ?? [], entry) });
          continue;
        }
        if (png.width !== entry.width || png.height !== entry.height) continue;
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

export function measureText(rows: readonly Measured[]): string {
  const lines: string[] = [];
  const best = bestPerEntry(rows);
  const names = [...new Set(rows.map((r) => r.entry.name))];
  for (const name of names) {
    lines.push(name);
    for (const r of rows.filter((x) => x.entry.name === name).sort((a, b) => b.m.score - a.m.score)) {
      const m = r.m;
      const tag = best.get(name) === r ? '*' : r.m.pass ? ' ' : 'x';
      lines.push(`  ${tag} ${r.draft.id} r${r.draft.round ?? '-'} ${(r.draft.recipe ?? 'old').padEnd(5)} score ${m.score.toFixed(2)}  col ${m.colours}  seam ${m.seam.toFixed(2)}  detail ${m.detail.toFixed(2)}  echo ${m.echo.toFixed(2)}${m.pass ? '' : `  FAIL ${m.failures.join('; ')}`}`);
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
      return `${f}  score ${m.score.toFixed(2)}  col ${m.colours}  seam ${m.seam.toFixed(2)}  detail ${m.detail.toFixed(2)}  echo ${m.echo.toFixed(2)}${m.pass ? '' : `  FAIL ${m.failures.join('; ')}`}`;
    }).join('\n');
    return { text: `${text}\n`, code: 0 };
  }
  const pools = (positional[0] ?? '').split(',').filter((p): p is PoolName => (POOLS as readonly string[]).includes(p));
  if (pools.length === 0) throw new Error(`Usage: art:measure <${POOLS.join('|')}>[,pool] [--names a,b] [--json] | --files a.png,b.png [--ramps green,moss]`);
  const names = flags.get('names')?.split(',');
  const rows = measurePool(pools, names);
  if (flags.has('json')) return { text: `${JSON.stringify(rows.map((r) => ({ name: r.entry.name, id: r.draft.id, round: r.draft.round, ...r.m })), null, 1)}\n`, code: 0 };
  return { text: measureText(rows), code: 0 };
}
