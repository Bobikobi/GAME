/**
 * The painted lands' pictures stay out of git (DECISIONS 2026-11-22, "the painted pictures go out through our own store"): the repo keeps a
 * manifest per scene, `game/painted/<scene id>.json`, that lists every file the game reads with its size and sha256, and the store keeps the
 * files themselves, each under its own sha256 (a flat folder of blobs, the form Git LFS and DVC use). `pnpm bundle` (so `pnpm dev`, `pnpm build`
 * and CI's e2e job alike) runs `fetchPainted`: every file comes from a cache keyed by its checksum, or from the store when the cache lacks it,
 * is verified byte for byte, and is placed beside the page at `game/public/painted/<scene id>/<path>`, where the game reads it
 * (`PAINTED_BASE`, game/src/painted.ts). A file whose bytes do not match its line fails the run: nothing half-checked reaches a page.
 *
 * The store is a local folder or an http(s) address that serves `<store>/<sha256>`: `PAINTED_STORE` names it, or the manifest's own `store`.
 * With neither, the run says so and places nothing (a page without the pictures cannot mount the valley, which every page mounts: game/src/trial.ts),
 * unless `PAINTED_REQUIRED=1`, which fails the run.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { REPO_ROOT } from './load';

/** the manifests, in git */
export const PAINTED_MANIFESTS = join(REPO_ROOT, 'game', 'painted');
/** the files by checksum, out of git (CI caches it by the manifests' hash) */
export const PAINTED_CACHE = join(REPO_ROOT, 'tools', '.cache', 'painted');
/** beside the page: Vite serves `game/public` in `pnpm dev` and copies it into `game/dist` */
export const PAINTED_OUT = join(REPO_ROOT, 'game', 'public', 'painted');

export interface ManifestFile {
  /** the file's path inside the scene folder, with forward slashes */
  path: string;
  bytes: number;
  /** 64 lowercase hex */
  sha256: string;
}

export interface Manifest {
  format: 1;
  /** the scene's id: the folder beside the page is `painted/<scene>` and the page asks `?painted=<scene>` */
  scene: string;
  /** where the blobs are read from, when a public store holds them; `PAINTED_STORE` overrides it */
  store?: string;
  files: ManifestFile[];
}

const SHA = /^[0-9a-f]{64}$/;

export function sha256(buf: Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex');
}

function walk(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) out.push(...walk(abs, base));
    else out.push(relative(base, abs).split(sep).join('/'));
  }
  return out;
}

/**
 * The files a page reads from a scene folder. A land cut into units (`scene.json` carries `tiles` of format 1) is read as the scene, its water's
 * means, its figures and its units (game/src/painted.ts `mountPainted` and the stream); the whole layers beside them are only read by a land laid
 * whole (`?whole`), so they stay out. A land not cut into units is read whole: every file of the folder.
 */
export function readSet(sceneDir: string): string[] {
  const scene = JSON.parse(readFileSync(join(sceneDir, 'scene.json'), 'utf8')) as { tiles?: { format?: number } };
  const all = walk(sceneDir);
  if (scene.tiles?.format !== 1) return all;
  return all.filter((p) => p === 'scene.json' || p === 'water.json' || p.startsWith('figures/') || p.startsWith('tiles/'));
}

/** The manifest of a scene folder's read set, and, with `storeDir`, every one of its files written into that folder under its sha256 (a stand-in store, or what a release then carries). */
export function makeManifest(sceneDir: string, storeDir?: string): Manifest {
  const scene = JSON.parse(readFileSync(join(sceneDir, 'scene.json'), 'utf8')) as { id?: unknown };
  if (typeof scene.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(scene.id)) throw new Error(`${sceneDir}/scene.json: the scene needs an id of lowercase letters, digits and dashes`);
  if (storeDir) mkdirSync(storeDir, { recursive: true });
  const files = readSet(sceneDir).map((path) => {
    const buf = readFileSync(join(sceneDir, path));
    const sum = sha256(buf);
    if (storeDir && !existsSync(join(storeDir, sum))) writeFileSync(join(storeDir, sum), buf);
    return { path, bytes: buf.length, sha256: sum };
  });
  return { format: 1, scene: scene.id, files };
}

/** What is wrong with a manifest, one line each; empty when it is sound. */
export function manifestProblems(m: unknown): string[] {
  const p: string[] = [];
  const o = m as Partial<Manifest> | null;
  if (!o || o.format !== 1) return ['format must be 1'];
  if (typeof o.scene !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(o.scene)) p.push('scene must be lowercase letters, digits and dashes');
  if (o.store !== undefined && typeof o.store !== 'string') p.push('store must be a string');
  if (!Array.isArray(o.files) || o.files.length === 0) return [...p, 'files must list at least one file'];
  const seen = new Set<string>();
  for (const f of o.files) {
    const path = String(f?.path ?? '');
    if (!path || isAbsolute(path) || path.split('/').some((s) => s === '' || s === '.' || s === '..') || path.includes('\\')) p.push(`${path || '(no path)'}: a path inside the scene folder, with forward slashes`);
    if (seen.has(path)) p.push(`${path}: listed twice`);
    seen.add(path);
    if (!SHA.test(String(f?.sha256 ?? ''))) p.push(`${path}: sha256 must be 64 lowercase hex`);
    if (!Number.isInteger(f?.bytes) || f.bytes < 0) p.push(`${path}: bytes must be a whole number`);
  }
  return p;
}

/** Reads one blob from a store: a folder, or an http(s) address serving `<store>/<sha256>`. */
export type BlobSource = (sum: string) => Promise<Uint8Array>;

export function storeSource(store: string): BlobSource {
  if (/^https?:\/\//.test(store)) {
    const base = store.replace(/\/+$/, '');
    return async (sum) => {
      const res = await fetch(`${base}/${sum}`, { redirect: 'follow' });
      if (!res.ok) throw new Error(`the store answered ${res.status} for ${sum}`);
      return new Uint8Array(await res.arrayBuffer());
    };
  }
  const dir = resolve(store);
  return async (sum) => {
    const path = join(dir, sum);
    if (!existsSync(path)) throw new Error(`the store has no ${sum}`);
    return readFileSync(path);
  };
}

export interface FetchReport {
  scene: string;
  files: number;
  bytes: number;
  /** files taken from the cache */
  cached: number;
  /** files read from the store */
  fetched: number;
  /** files already in place with the right bytes */
  kept: number;
  /** files in the scene's folder beside the page that the manifest does not list, removed */
  removed: number;
}

/** Writes through a name of its own and renames, so a run that stops halfway never leaves a short file under the real name. */
function writeWhole(path: string, buf: Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.part-${process.pid}`;
  writeFileSync(tmp, buf);
  renameSync(tmp, path);
}

function bytesMatch(path: string, f: ManifestFile): boolean {
  if (!existsSync(path) || statSync(path).size !== f.bytes) return false;
  return sha256(readFileSync(path)) === f.sha256;
}

function check(buf: Uint8Array, f: ManifestFile, where: string): void {
  if (buf.length !== f.bytes || sha256(buf) !== f.sha256) {
    throw new Error(`${f.path}: the ${where} gave ${buf.length} bytes with sha256 ${sha256(buf).slice(0, 12)}..., the manifest says ${f.bytes} bytes and ${f.sha256.slice(0, 12)}...`);
  }
}

/**
 * Places every file of the manifest at `out/<scene>/<path>`: kept when it is already there with the right bytes, else copied from the cache
 * (`cache/<sha256>`, verified), else read from the store, verified, cached and placed. Throws on the first file whose bytes do not match, before
 * it is placed. Files in `out/<scene>` that the manifest does not list are removed (the folder holds exactly the manifest), nothing outside it.
 */
export async function fetchPainted(m: Manifest, opts: { source: BlobSource; cache: string; out: string; atOnce?: number }): Promise<FetchReport> {
  const problems = manifestProblems(m);
  if (problems.length > 0) throw new Error(`manifest ${String((m as { scene?: unknown }).scene)}: ${problems.join('; ')}`);
  const root = join(opts.out, m.scene);
  const report: FetchReport = { scene: m.scene, files: m.files.length, bytes: 0, cached: 0, fetched: 0, kept: 0, removed: 0 };
  mkdirSync(opts.cache, { recursive: true });
  const one = async (f: ManifestFile): Promise<void> => {
    report.bytes += f.bytes;
    const dest = join(root, ...f.path.split('/'));
    if (bytesMatch(dest, f)) {
      report.kept++;
      return;
    }
    const cached = join(opts.cache, f.sha256);
    if (bytesMatch(cached, f)) {
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(cached, dest);
      report.cached++;
      return;
    }
    const buf = await opts.source(f.sha256);
    check(buf, f, 'store');
    writeWhole(cached, buf);
    writeWhole(dest, buf);
    report.fetched++;
  };
  const queue = [...m.files];
  const workers = Array.from({ length: Math.max(1, opts.atOnce ?? 6) }, async () => {
    for (let f = queue.shift(); f; f = queue.shift()) await one(f);
  });
  await Promise.all(workers);
  // the scene's folder holds exactly the manifest's files
  if (existsSync(root)) {
    const listed = new Set(m.files.map((f) => f.path));
    for (const path of walk(root)) {
      if (listed.has(path)) continue;
      rmSync(join(root, ...path.split('/')));
      report.removed++;
    }
    const prune = (dir: string): void => {
      for (const name of readdirSync(dir)) if (statSync(join(dir, name)).isDirectory()) prune(join(dir, name));
      if (dir !== root && readdirSync(dir).length === 0) rmdirSync(dir);
    };
    prune(root);
  }
  return report;
}

/** The manifests in a folder (`game/painted/*.json`), sorted by name. */
export function readManifests(dir: string): Manifest[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith('.json'))
    .sort()
    .map((n) => JSON.parse(readFileSync(join(dir, n), 'utf8')) as Manifest);
}

/** One line for a run, the way `pnpm bundle` prints its own. */
export function reportLine(r: FetchReport): string {
  return `painted ${r.scene}: ${r.files} files, ${(r.bytes / 1e6).toFixed(1)} MB (${r.kept} in place, ${r.cached} from the cache, ${r.fetched} from the store${r.removed ? `, ${r.removed} stale removed` : ''})`;
}

/**
 * The run `pnpm bundle` and `pnpm painted:fetch` make: every manifest in `manifestDir`, each from `PAINTED_STORE` or its own `store`. A manifest
 * with no store is reported and skipped, or fails the run with `required` (`PAINTED_REQUIRED=1`). Returns the lines to print.
 */
export async function fetchAll(opts: { manifestDir: string; cache: string; out: string; store?: string; required?: boolean }): Promise<string[]> {
  const lines: string[] = [];
  for (const m of readManifests(opts.manifestDir)) {
    const store = opts.store || m.store;
    if (!store) {
      const line = `painted ${m.scene}: no store named (PAINTED_STORE or the manifest's store), so its ${m.files.length} pictures are not placed`;
      if (opts.required) throw new Error(line);
      lines.push(line);
      continue;
    }
    lines.push(reportLine(await fetchPainted(m, { source: storeSource(store), cache: opts.cache, out: opts.out })));
  }
  return lines;
}
