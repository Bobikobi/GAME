import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { PNG } from 'pngjs';
import { paletteWithRamps } from '../kit/palette';

export interface FamilyAsset {
  id: string;
  file: string;
  sha256: string;
  frame: [number, number];
  provenance: string;
  review: { status: 'approved' | 'unreviewed' | 'rework'; by: string; evidence: string; reason: string };
}
export interface ArtFamily {
  format: 1;
  id: string;
  scope: string;
  owner: { agent: string; branch: string };
  anchor: string;
  ramps: string[];
  style: { projection: string; outline: string; detail: string; lighting: string };
  contract: {
    origin: [number, number];
    heights: number[];
    widthScales: number[];
    mirror: boolean;
    root: { offsetY: number; radiusX: number; radiusY: number };
    shadow: 'silhouette';
    occlusion: 'alpha';
  };
  comparison: { maxAspectRatio: number; maxEdgeDensityRatio: number };
  assets: FamilyAsset[];
  sceneAssets: string[];
}
export interface Finding { level: 'error' | 'warning'; code: string; asset: string; message: string }
export interface Metrics { aspect: number; fill: number; edgeDensity: number; colors: number; opaquePixels: number }
export interface FamilyReport {
  family: string;
  findings: Finding[];
  assets: { id: string; sha256: string; metrics: Metrics }[];
}

/** Reject malformed JSON before using paths or accepting review declarations. */
export function parseFamily(value: unknown): ArtFamily {
  function obj(v: unknown): Record<string, unknown> {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Expected an object');
    return v as Record<string, unknown>;
  }
  function text(v: unknown): asserts v is string {
    if (typeof v !== 'string' || !v.trim()) throw new Error('Expected a non-empty string');
  }
  function nums(v: unknown, count?: number): asserts v is number[] {
    if (!Array.isArray(v) || !v.length || (count !== undefined && v.length !== count) || v.some(n => typeof n !== 'number' || !Number.isFinite(n))) throw new Error('Expected finite numeric array');
  }
  function strings(v: unknown): asserts v is string[] {
    if (!Array.isArray(v)) throw new Error('Expected string array');
    v.forEach(text);
    if (new Set(v).size !== v.length) throw new Error('Duplicate entries');
  }
  const f = obj(value);
  if (f.format !== 1) throw new Error('Unsupported family format');
  for (const k of ['id', 'scope', 'anchor']) text(f[k]);
  if (!/^[a-z0-9-]+$/.test(f.id as string)) throw new Error('Invalid family id');
  const owner = obj(f.owner); text(owner.agent); text(owner.branch);
  const style = obj(f.style);
  for (const k of ['projection', 'outline', 'detail', 'lighting']) text(style[k]);
  strings(f.ramps); strings(f.sceneAssets);
  if (f.ramps.length > 6 || !f.sceneAssets.length) throw new Error('At most six ramps and at least one scene asset required');
  paletteWithRamps(f.ramps); // Unknown ramp names fail, never silently widen the palette.
  const c = obj(f.contract);
  nums(c.origin, 2); nums(c.heights); nums(c.widthScales);
  if (c.origin.some(n => n < 0 || n > 1) || c.heights.some(n => n <= 0 || !Number.isInteger(n)) || c.widthScales.some(n => n <= 0 || n > 2)) throw new Error('Invalid placement dimensions');
  if (typeof c.mirror !== 'boolean' || c.shadow !== 'silhouette' || c.occlusion !== 'alpha') throw new Error('Unsupported integration contract');
  const root = obj(c.root);
  for (const k of ['offsetY', 'radiusX', 'radiusY']) {
    const n = root[k];
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n > 1) throw new Error(`Invalid root ${k}`);
  }
  const comparison = obj(f.comparison);
  for (const k of ['maxAspectRatio', 'maxEdgeDensityRatio']) {
    const n = comparison[k];
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 1) throw new Error(`Invalid comparison ${k}`);
  }
  if (!Array.isArray(f.assets) || !f.assets.length) throw new Error('No assets');
  const ids = new Set<string>();
  for (const raw of f.assets) {
    const a = obj(raw);
    for (const k of ['id', 'file', 'sha256', 'provenance']) text(a[k]);
    const id = a.id as string;
    if (ids.has(id)) throw new Error(`Duplicate asset ${id}`);
    ids.add(id);
    if (!/^[a-f0-9]{64}$/.test(a.sha256 as string)) throw new Error(`Invalid hash: ${id}`);
    nums(a.frame, 2);
    if (a.frame.some(n => n <= 0 || !Number.isInteger(n))) throw new Error(`Invalid frame: ${id}`);
    const r = obj(a.review);
    if (!['approved', 'unreviewed', 'rework'].includes(r.status as string)) throw new Error(`Invalid review: ${id}`);
    for (const k of ['by', 'evidence', 'reason']) text(r[k]);
    if (r.status === 'approved' && r.by !== 'owner') throw new Error(`Approval must cite the owner: ${id}`);
  }
  if (!ids.has(f.anchor as string) || f.sceneAssets.some(id => !ids.has(id))) throw new Error('Unknown anchor or scene asset');
  return value as ArtFamily;
}

/** All records and their evidence remain portable and inside this repository. */
export function familyFile(root: string, file: string): string {
  if (isAbsolute(file)) throw new Error(`Absolute path is not portable: ${file}`);
  const resolved = realpathSync(resolve(root, file));
  const local = relative(realpathSync(root), resolved);
  if (local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local)) throw new Error(`Path escapes repository: ${file}`);
  return resolved;
}

/** Measured on the authored pixels, not a resized or palette-remapped preview. */
export function measureSprite(png: PNG): Metrics {
  let left = png.width, top = png.height, right = -1, bottom = -1;
  let opaquePixels = 0, pairs = 0, changes = 0;
  const colors = new Set<string>();
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const at = (y * png.width + x) * 4;
    if (png.data[at + 3]! < 128) continue;
    opaquePixels++;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    colors.add(png.data.subarray(at, at + 3).toString('hex'));
    for (const next of [x + 1 < png.width ? at + 4 : -1, y + 1 < png.height ? at + png.width * 4 : -1]) {
      if (next < 0 || png.data[next + 3]! < 128) continue;
      pairs++;
      if (!png.data.subarray(at, at + 3).equals(png.data.subarray(next, next + 3))) changes++;
    }
  }
  const w = right - left + 1, h = bottom - top + 1;
  return { aspect: opaquePixels ? w / h : 0, fill: opaquePixels ? opaquePixels / (w * h) : 0, edgeDensity: pairs ? changes / pairs : 0, colors: colors.size, opaquePixels };
}

export function inspectFamily(family: ArtFamily, root: string): FamilyReport {
  const report: FamilyReport = { family: family.id, findings: [], assets: [] };
  const add = (level: Finding['level'], code: string, asset: string, message: string) => report.findings.push({ level, code, asset, message });
  const palette = new Set(paletteWithRamps(family.ramps).map(hex => hex.slice(1)));
  for (const a of family.assets) {
    try {
      familyFile(root, a.provenance); familyFile(root, a.review.evidence);
      const bytes = readFileSync(familyFile(root, a.file));
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      if (sha256 !== a.sha256) add('error', 'changed-bytes', a.id, 'Bytes changed since the recorded review; review the new revision.');
      const png = PNG.sync.read(bytes);
      if (png.width !== a.frame[0] || png.height !== a.frame[1]) add('error', 'frame', a.id, `Expected ${a.frame.join('×')}, found ${png.width}×${png.height}.`);
      const outside = new Set<string>();
      let partial = 0;
      for (let at = 0; at < png.data.length; at += 4) {
        const alpha = png.data[at + 3]!;
        if (alpha === 0) continue;
        if (alpha !== 255) partial++;
        const hex = png.data.subarray(at, at + 3).toString('hex');
        if (!palette.has(hex)) outside.add(`#${hex}`);
      }
      if (outside.size) add('error', 'palette', a.id, `${outside.size} colors outside family ramps: ${[...outside].sort().slice(0, 8).join(', ')}`);
      if (partial) add('error', 'alpha', a.id, `${partial} partially transparent pixels; this pixel-sprite contract requires binary alpha.`);
      const metrics = measureSprite(png);
      if (!metrics.opaquePixels) add('error', 'empty', a.id, 'Sprite has no visible pixels.');
      report.assets.push({ id: a.id, sha256, metrics });
    } catch (error) { add('error', 'asset-file', a.id, String(error)); }
    if ((a.id === family.anchor || family.sceneAssets.includes(a.id)) && a.review.status !== 'approved') add('error', 'not-approved', a.id, 'Anchor and scene assets require an owner-approved revision.');
  }
  const anchor = report.assets.find(a => a.id === family.anchor);
  if (anchor) for (const a of report.assets) {
    if (a.id === anchor.id) continue;
    for (const [key, limit] of [['aspect', family.comparison.maxAspectRatio], ['edgeDensity', family.comparison.maxEdgeDensityRatio]] as const) {
      const low = Math.min(a.metrics[key], anchor.metrics[key]);
      const high = Math.max(a.metrics[key], anchor.metrics[key]);
      const ratio = low > 0 ? high / low : high > 0 ? Infinity : 1;
      if (ratio > limit) add('warning', `compare-${key}`, a.id, `${key} differs from ${anchor.id} by ${ratio.toFixed(2)}× (review threshold ${limit}×). Visual review required; this is not an artistic verdict.`);
    }
  }
  return report;
}

export function inspectFamilies(root: string): { file: string; family?: ArtFamily; report: FamilyReport }[] {
  const directory = resolve(root, 'docs/art/families');
  return readdirSync(directory).filter(name => name.endsWith('.json')).sort().map(name => {
    const file = `docs/art/families/${name}`;
    try {
      const family = parseFamily(JSON.parse(readFileSync(familyFile(root, file), 'utf8')));
      return { file, family, report: inspectFamily(family, root) };
    } catch (error) {
      return { file, report: { family: name, assets: [], findings: [{ level: 'error' as const, code: 'manifest', asset: name, message: String(error) }] } };
    }
  });
}
