/**
 * The drafts index: every picture a draw produced is kept and cited (docs/art/PRODUCTION_LINE.md section 3,
 * docs/art/DRAWERS.md "Drafts are kept").
 *
 * - `tools/kit-gen/drafts.jsonl` is the index, in the repo, append-only: one line per draft, and the file only ever
 *   grows. A draft's id is the first 16 hex of the SHA-256 of its raw PNG, so identical bytes are one draft and every
 *   place that made them is a source on it. Something learned later (where the files are stored, a review, what a
 *   wrong draw looks like, one more source) is a second line with `"amend": true` and only the changed fields; reading
 *   folds the lines by id.
 * - The pictures are too big for this repo. They live in the private repo `Bobikobi/GAME-art-drafts`, one GitHub
 *   release per kernel run, three assets a draft named by its id: `<id>.png` (the raw picture, what the importer read),
 *   `<id>.full.png` (the kernel's picture before the grid, when there is one) and `<id>.imported.png` (what the importer
 *   made). `stored` in the index cites tag and asset; `files` holds the hashes. Nothing is ever deleted there.
 * - `.scratch/art-drafts/` is the local cache. `pnpm art:drafts fetch` fills it, `verify` re-hashes it against the index.
 *
 *   pnpm art:drafts push <run folder | picture folder> --label <source> [--provenance <text>] [--backfill] [--tag <tag>]
 *                       [--picks <manifest>] [--round-from-folder] [--pool <pool>] [--route <route>] [--recursive] [--no-upload] [--dry]
 *   pnpm art:drafts fetch [<id> ...] [--all]
 *   pnpm art:drafts verify [--base <git ref>] [<id> ...] [--no-fetch] [--strict]
 *   pnpm art:drafts annotate-wrong-draws      (the wrong-draws library, as notes on the drafts it holds)
 *   pnpm art:drafts view wrong-draws [--write]
 *   pnpm art:drafts stats
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export const INDEX_PATH = join(ROOT, 'tools/kit-gen/drafts.jsonl');
export const CACHE_DIR = join(ROOT, '.scratch/art-drafts');
export const DRAFTS_REPO = 'Bobikobi/GAME-art-drafts';
export const WRONG_DRAWS_LIBRARY = join(ROOT, 'docs/art/wrong-draws/library.jsonl');

/** REUSE.md's review states. */
export const REVIEW_STATES = ['unreviewed', 'keep', 'reuse-parts', 'rework', 'archive'] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const FILE_KINDS = ['raw', 'full', 'imported'] as const;
export type FileKind = (typeof FILE_KINDS)[number];

/** A release has room for 1000 assets; three a draft, and a margin. */
const DRAFTS_PER_RELEASE = 300;

export interface FileRef {
  sha256: string;
  bytes: number;
  /** The file's extension when it is not `.png` (`.jpg`, `.webp`, `.glb`): the asset in the store keeps it. */
  ext?: string;
}

/** The extensions a draft may have, as the stray check names them; a PNG is the common case and needs no `ext`. */
export const DRAFT_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.glb'] as const;
/** A picture or model over this many bytes is not pushed (a raw photoscan runs to hundreds of megabytes). */
export const MAX_DRAFT_BYTES = 100 * 1024 * 1024;

export interface Stored {
  repo: string;
  tag: string;
  /** The asset name of each file this draft has in the release. */
  assets: Partial<Record<FileKind, string>>;
}

/** One place a draft came from. A draft that two runs drew identically keeps both. */
export interface DraftSource {
  /** The group the line came from: a source of the backfill, or the run's spec for a live run. */
  label: string;
  spec: string | null;
  /** The run folder's own name. */
  run: string | null;
  /** The raw file's name in that folder. */
  file: string | null;
  at: string | null;
  /** What is known and what is not, in words (`uncommitted, 19.10`). */
  provenance: string | null;
}

export interface Draft {
  id: string;
  pool: string | null;
  name: string;
  spec: string | null;
  round: number | null;
  /** The route that drew it: `codex`, `local`, `kaggle`, `gemini`, or null when the drawing's route is not known. */
  route: string | null;
  /** The kaggle recipe (`sd15`, `sdxl`, `flux`, `qwen`), or the route's own name. */
  recipe: string | null;
  /** The model in words, when a record had it. */
  model: string | null;
  model_version: string | null;
  seed: number | null;
  denoise: number | null;
  /** What the model drew on, in pixels; the asked size is what the spec wanted. */
  canvas: [number, number] | null;
  asked: [number, number] | null;
  ramps: string[] | null;
  prompt: string | null;
  negative: string | null;
  warnings: string[];
  errors: string[];
  /** The kernel run that drew it and that run's own total GPU seconds (the same on every draft of a run). */
  run: { id: string; gpu_seconds: number | null } | null;
  files: Record<'raw', FileRef> & Record<'full' | 'imported', FileRef | null>;
  stored: Stored | null;
  review: ReviewState;
  review_by?: string;
  review_note?: string;
  looks_like?: string;
  at: string | null;
  sources: DraftSource[];
}

/** The fields a later line may set; the others are the draft as it arrived. */
export const AMENDABLE = ['stored', 'review', 'review_by', 'review_note', 'looks_like', 'model', 'round', 'ramps', 'pool', 'seed', 'recipe'] as const;

export interface Amendment extends Partial<Pick<Draft, (typeof AMENDABLE)[number]>> {
  id: string;
  amend: true;
  sources?: DraftSource[];
}

export type DraftLine = Draft | Amendment;

export function isAmendment(line: DraftLine): line is Amendment {
  return (line as Amendment).amend === true;
}

/* ---- ids, hashes, picture sizes ---- */

export function sha256Hex(data: Buffer | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

export function draftId(raw: Buffer | Uint8Array): string {
  return sha256Hex(raw).slice(0, 16);
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function pngDims(png: Buffer): [number, number] | null {
  if (png.length < 24 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

function fileRef(data: Buffer, ext = '.png'): FileRef {
  return { sha256: sha256Hex(data), bytes: data.length, ...(ext === '.png' ? {} : { ext }) };
}

/* ---- the index: read, fold, append ---- */

const ID_PATTERN = /^[0-9a-f]{16}$/;

export function parseIndex(text: string): DraftLine[] {
  return text.split('\n').filter((l) => l.trim() !== '').map((l, i) => {
    let line: DraftLine;
    try {
      line = JSON.parse(l) as DraftLine;
    } catch {
      throw new Error(`drafts index line ${i + 1} is not JSON`);
    }
    if (typeof line.id !== 'string' || !ID_PATTERN.test(line.id)) throw new Error(`drafts index line ${i + 1} has no 16-hex id`);
    if (!isAmendment(line) && line.files?.raw?.sha256?.slice(0, 16) !== line.id) throw new Error(`drafts index line ${i + 1}: the id is not the first 16 hex of the raw file's hash`);
    return line;
  });
}

export function sourceKey(s: DraftSource): string {
  return [s.label, s.run ?? '', s.file ?? '', s.at ?? ''].join('|');
}

function mergeSources(into: DraftSource[], more: readonly DraftSource[] | undefined): DraftSource[] {
  const seen = new Set(into.map(sourceKey));
  const added: DraftSource[] = [];
  for (const s of more ?? []) {
    if (seen.has(sourceKey(s))) continue;
    seen.add(sourceKey(s));
    added.push(s);
  }
  into.push(...added);
  return added;
}

/** Fold one line into the map: a first line is the draft, a later line (or a repeated draft) only adds. */
export function foldLine(map: Map<string, Draft>, line: DraftLine): void {
  const existing = map.get(line.id);
  if (!isAmendment(line)) {
    if (existing === undefined) map.set(line.id, structuredClone(line));
    else mergeSources(existing.sources, line.sources);
    return;
  }
  if (existing === undefined) throw new Error(`an amendment names ${line.id}, which no line has introduced`);
  for (const key of AMENDABLE) {
    const value = line[key];
    if (value !== undefined) (existing as unknown as Record<string, unknown>)[key] = structuredClone(value);
  }
  mergeSources(existing.sources, line.sources);
}

export function foldIndex(lines: readonly DraftLine[]): Map<string, Draft> {
  const map = new Map<string, Draft>();
  for (const line of lines) foldLine(map, line);
  return map;
}

/** True when `next` is `previous` plus lines at the end: what CI checks of develop's file against the branch's. */
export function indexGrewOnly(previous: string, next: string): boolean {
  return next.startsWith(previous) && (previous === '' || previous.endsWith('\n'));
}

export type AddResult = 'added' | 'merged' | 'same';

/** The index file as it is on disk, with the folded view; every write goes to the end of the file. */
export class DraftIndex {
  readonly drafts: Map<string, Draft>;

  private constructor(readonly path: string, drafts: Map<string, Draft>) {
    this.drafts = drafts;
  }

  static open(path: string = INDEX_PATH): DraftIndex {
    return new DraftIndex(path, foldIndex(existsSync(path) ? parseIndex(readFileSync(path, 'utf8')) : []));
  }

  private write(line: DraftLine): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const lead = existsSync(this.path) && statSync(this.path).size > 0 && !readFileSync(this.path, 'utf8').endsWith('\n') ? '\n' : '';
    appendFileSync(this.path, `${lead}${JSON.stringify(line)}\n`);
    foldLine(this.drafts, line);
  }

  /** A draft: new bytes append a line, known bytes only gain what they add (a source, a storage citation, a blank field). */
  add(record: Draft): AddResult {
    const existing = this.drafts.get(record.id);
    if (existing === undefined) {
      this.write(record);
      return 'added';
    }
    const patch: Amendment = { id: record.id, amend: true };
    const fill = patch as unknown as Record<string, unknown>;
    for (const key of AMENDABLE) {
      const have = existing[key];
      const value = record[key];
      if ((have === null || have === undefined) && value !== null && value !== undefined && !(key === 'review' && value === 'unreviewed')) fill[key] = value;
    }
    const seen = new Set(existing.sources.map(sourceKey));
    const sources = record.sources.filter((s) => !seen.has(sourceKey(s)));
    if (sources.length > 0) patch.sources = sources;
    if (Object.keys(patch).length === 2) return 'same';
    this.write(patch);
    return 'merged';
  }

  /** A fact learned later. Nothing is written when it changes nothing. */
  amend(patch: Amendment): boolean {
    const existing = this.drafts.get(patch.id);
    if (existing === undefined) throw new Error(`no draft ${patch.id}`);
    const same = AMENDABLE.every((k) => patch[k] === undefined || JSON.stringify(patch[k]) === JSON.stringify(existing[k]));
    const seen = new Set(existing.sources.map(sourceKey));
    const sources = (patch.sources ?? []).filter((s) => !seen.has(sourceKey(s)));
    if (same && sources.length === 0) return false;
    this.write({ ...patch, ...(sources.length > 0 ? { sources } : {}) });
    return true;
  }
}

/** A kernel run's own seconds, once per run id: the meter of the weekly GPU budget (section 2 of the plan). */
export function gpuSecondsSince(drafts: Iterable<Draft>, since: Date): number {
  const runs = new Map<string, number>();
  for (const d of drafts) {
    if (d.run === null || d.run.gpu_seconds === null || d.at === null || Date.parse(d.at) < since.getTime()) continue;
    runs.set(d.run.id, d.run.gpu_seconds);
  }
  return [...runs.values()].reduce((a, b) => a + b, 0);
}

/* ---- from a run folder ---- */

/** The fields of a `kit:gen` manifest line that a draft is made from. */
export interface RunLine {
  name: string;
  route?: string;
  spec?: string;
  width?: number;
  height?: number;
  prompt?: string;
  drawer?: string;
  codex?: { version?: string; seconds?: number; log?: string } | null;
  raw?: string | null;
  out?: string | null;
  warnings?: string[];
  error?: string | null;
  at?: string;
  ramps?: string[];
}

/** What a picks manifest says about a draw, joined to a run line by name and time. */
export interface Hint {
  name: string;
  at: string;
  round?: number;
  model?: string;
  seed?: number;
  denoise?: number;
  picked?: string;
}

export function hintsFrom(text: string): Hint[] {
  return text.split('\n').filter((l) => l.trim() !== '').flatMap((l) => {
    const j = JSON.parse(l) as Partial<Hint>;
    return typeof j.name === 'string' && typeof j.at === 'string' ? [j as Hint] : [];
  });
}

export interface Collected {
  record: Draft;
  paths: Record<FileKind, string | null>;
}

export interface CollectOptions {
  label: string;
  provenance?: string;
  hints?: readonly Hint[];
  /** Read a round from a run folder named `r<N>-...` (the rich wave's rounds); a picks line, when there is one, wins. */
  roundFromFolder?: boolean;
  /** The index a failed line is reported to; a skipped line is never silent. */
  skipped?: { name: string; why: string }[];
}

/** A spec path as the index writes it: repo-relative, or only the file's name when it was somewhere else. */
export function specLabel(spec: string | undefined): string | null {
  if (spec === undefined || spec === '') return null;
  const at = spec.indexOf('tools/kit-gen/');
  if (at >= 0) return spec.slice(at);
  if (spec.startsWith('/')) return basename(spec);
  return spec;
}

export function poolOf(spec: string | null): string | null {
  const m = /^tools\/kit-gen\/pools\/([a-z0-9_-]+)\.json$/.exec(spec ?? '');
  return m === null ? null : (m[1] ?? null);
}

interface WaveRequest { name: string; file?: string; seed?: number; width?: number; height?: number; denoise?: number }
interface WaveFile { settings?: Record<string, unknown>; requests?: WaveRequest[] }

/** The kernel script keeps the wave it was pushed with as base64 JSON: the seed, canvas and denoise of every picture. */
export function readWave(script: string): WaveFile | null {
  const m = /WAVE_B64 = "([A-Za-z0-9+/=]+)"/.exec(script);
  if (m === null || m[1] === undefined) return null;
  try {
    return JSON.parse(Buffer.from(m[1], 'base64').toString('utf8')) as WaveFile;
  } catch {
    return null;
  }
}

export interface RunLog {
  runId: string | null;
  recipe: string | null;
  seed: number | null;
  denoise: number | null;
  kernelSeconds: number | null;
}

/** What a route's log says: the kaggle kernel folder and run seconds, the local route's seed and denoise. */
export function parseRunLog(text: string): RunLog {
  const num = (m: RegExpExecArray | null): number | null => (m?.[1] === undefined ? null : Number(m[1]));
  return {
    runId: /^kernel kaggle\/([^/\s]+)\/kernel$/m.exec(text)?.[1] ?? null,
    recipe: /^recipe (\w+)/m.exec(text)?.[1] ?? null,
    seed: num(/^seed (-?\d+)$/m.exec(text)),
    denoise: num(/^denoise ([\d.]+)/m.exec(text)),
    kernelSeconds: num(/, kernel ([\d.]+) s,/.exec(text)),
  };
}

function readIf(path: string): Buffer | null {
  return existsSync(path) && statSync(path).isFile() ? readFileSync(path) : null;
}

function readJson(path: string): Record<string, unknown> | null {
  const buf = readIf(path);
  if (buf === null) return null;
  try {
    return JSON.parse(buf.toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function roundOfFolder(folder: string): number | null {
  const m = /^r(\d+)[-_]/.exec(basename(folder));
  return m?.[1] === undefined ? null : Number(m[1]);
}

const NO_SPACE = (s: string): string => s.replace(/\s+/g, ' ').trim();

/**
 * One draft from one manifest line of a run folder, or null with the reason it is not one (no picture was drawn,
 * the file is gone). The id is the raw file's hash, so a line that names the same bytes as another is the same draft.
 */
export function collectLine(folder: string, line: RunLine, opts: CollectOptions): Collected | null {
  const skip = (why: string): null => {
    opts.skipped?.push({ name: line.name, why });
    return null;
  };
  // a scatter tile has no raw picture: the script wrote it, so the tile is both its raw and its imported file
  const rawFile = typeof line.raw === 'string' && line.raw.endsWith('.png') ? line.raw : line.route === 'scatter' && typeof line.out === 'string' && line.out.endsWith('.png') ? line.out : null;
  if (rawFile === null) return skip('no picture was drawn');
  const raw = readIf(join(folder, rawFile));
  if (raw === null) return skip('the raw file is not on disk');
  if (pngDims(raw) === null) return skip('the raw file is not a PNG');
  const imported = typeof line.out === 'string' ? readIf(join(folder, line.out)) : null;
  const log = typeof line.codex?.log === 'string' ? readIf(join(folder, line.codex.log))?.toString('utf8') ?? '' : '';
  const logged = parseRunLog(log);
  const route = line.drawer ?? (line.route === 'scatter' ? 'scatter' : 'codex');

  let full: Buffer | null = null;
  let fullPath: string | null = null;
  let runId: string | null = null;
  let gpuSeconds: number | null = null;
  let recipe: string | null = route === 'kaggle' ? logged.recipe : route;
  let seed = logged.seed;
  let denoise = logged.denoise;
  let negative: string | null = null;
  let canvas: [number, number] | null = null;
  if (route === 'kaggle' && logged.runId !== null) {
    runId = logged.runId;
    const dir = join(folder, 'kaggle', logged.runId);
    const wave = readWave(readIf(join(dir, 'kernel', 'kitgen_wave.py'))?.toString('utf8') ?? '');
    const request = wave?.requests?.find((r) => r.name === line.name);
    const kernel = readJson(join(dir, 'output', 'kitgen-manifest.json'));
    const settings = wave?.settings ?? {};
    if (typeof settings['recipe'] === 'string') recipe = settings['recipe'];
    if (typeof request?.seed === 'number') seed = request.seed;
    if (typeof request?.denoise === 'number') denoise = request.denoise;
    if (typeof request?.width === 'number' && typeof request.height === 'number') canvas = [request.width, request.height];
    if (typeof settings['negative'] === 'string' && (recipe === 'sd15' || recipe === 'sdxl')) negative = settings['negative'];
    const seconds = kernel?.['seconds'];
    gpuSeconds = typeof seconds === 'number' ? seconds : logged.kernelSeconds;
    const file = request?.file ?? `${line.name}.png`;
    fullPath = join(dir, 'output', `${file.replace(/\.png$/, '')}.full.png`);
    full = readIf(fullPath);
    if (full === null) fullPath = null;
  }
  const hint = opts.hints?.find((h) => h.name === line.name && h.at === line.at);
  if (seed === null && typeof hint?.seed === 'number') seed = hint.seed;
  if (denoise === null && typeof hint?.denoise === 'number') denoise = hint.denoise;
  const dims = (full !== null ? pngDims(full) : null) ?? canvas ?? pngDims(raw);
  const spec = specLabel(line.spec);
  const notes = [opts.provenance, hint?.picked === undefined ? undefined : `picks manifest: ${hint.picked}`].filter((x): x is string => x !== undefined);
  const record: Draft = {
    id: draftId(raw),
    pool: poolOf(spec),
    name: line.name,
    spec,
    round: typeof hint?.round === 'number' ? hint.round : opts.roundFromFolder === true ? roundOfFolder(folder) : null,
    route,
    recipe,
    model: hint?.model ?? null,
    model_version: line.codex?.version ?? null,
    seed,
    denoise,
    canvas: dims,
    asked: typeof line.width === 'number' && typeof line.height === 'number' ? [line.width, line.height] : null,
    ramps: line.ramps ?? null,
    prompt: line.prompt === undefined ? null : NO_SPACE(line.prompt) === '' ? null : line.prompt,
    negative,
    warnings: line.warnings ?? [],
    errors: typeof line.error === 'string' && line.error !== '' ? [line.error] : [],
    run: runId === null ? null : { id: runId, gpu_seconds: gpuSeconds },
    files: { raw: fileRef(raw), full: full === null ? null : fileRef(full), imported: imported === null ? null : fileRef(imported) },
    stored: null,
    review: 'unreviewed',
    at: line.at ?? null,
    sources: [{
      label: opts.label, spec, run: basename(folder), file: basename(rawFile), at: line.at ?? null,
      provenance: notes.length === 0 ? null : notes.join('; '),
    }],
  };
  return {
    record,
    paths: { raw: join(folder, rawFile), full: fullPath, imported: typeof line.out === 'string' && imported !== null ? join(folder, line.out) : null },
  };
}

export function readManifestLines(folder: string): RunLine[] {
  const text = readIf(join(folder, 'manifest.jsonl'))?.toString('utf8') ?? '';
  return text.split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as RunLine);
}

export function collectRun(folder: string, opts: CollectOptions): Collected[] {
  return readManifestLines(folder).flatMap((line) => collectLine(folder, line, opts) ?? []);
}

export interface PictureOptions extends CollectOptions {
  route?: string | null;
  pool?: string | null;
}

/**
 * Loose pictures from a study, with no manifest: each file is its own raw picture. A `<stem>.json` beside it may
 * carry the prompt, the tool and the date (`{prompt, tool, date}`); what is not known stays null.
 */
export function collectPictures(files: readonly string[], opts: PictureOptions): Collected[] {
  return files.flatMap((file) => {
    const ext = extname(file).toLowerCase();
    const raw = readIf(file);
    const isPng = ext === '.png';
    if (raw === null || (isPng && pngDims(raw) === null) || !(DRAFT_EXTENSIONS as readonly string[]).includes(ext) || raw.length > MAX_DRAFT_BYTES) {
      const why = raw === null ? 'the file is not on disk' : raw.length > MAX_DRAFT_BYTES ? `over the ${MAX_DRAFT_BYTES / 1024 / 1024} MB cap` : isPng ? 'not a PNG' : 'not a picture or model';
      opts.skipped?.push({ name: basename(file), why });
      return [];
    }
    const side = readJson(file.slice(0, file.length - ext.length) + '.json');
    const text = (k: string): string | null => (typeof side?.[k] === 'string' ? (side[k] as string) : null);
    const name = basename(file, extname(file));
    const date = text('date');
    return [{
      record: {
        id: draftId(raw), pool: opts.pool ?? null, name, spec: null, round: null, route: opts.route ?? null, recipe: text('tool'),
        model: null, model_version: null, seed: null, denoise: null, canvas: isPng ? pngDims(raw) : null, asked: null, ramps: null,
        prompt: text('prompt'), negative: null, warnings: [], errors: [], run: null,
        files: { raw: fileRef(raw, ext), full: null, imported: null }, stored: null, review: 'unreviewed', at: date,
        sources: [{ label: opts.label, spec: null, run: basename(dirname(file)), file: basename(file), at: date, provenance: opts.provenance ?? null }],
      },
      paths: { raw: file, full: null, imported: null },
    }];
  });
}

/* ---- kit:gen: one call where its manifest line is written ---- */

/**
 * `kit:gen` calls this where it writes a manifest line: a draft that was drawn gets its line in the index. It never
 * stops a run - a failure is told on stderr and the run's own manifest stays the log.
 */
export function noteDraft(folder: string, line: RunLine, index: string = INDEX_PATH): AddResult | null {
  try {
    const skipped: { name: string; why: string }[] = [];
    const collected = collectLine(folder, line, { label: specLabel(line.spec) ?? basename(folder), skipped });
    return collected === null ? null : DraftIndex.open(index).add(collected.record);
  } catch (error) {
    process.stderr.write(`drafts index: ${line.name} not recorded: ${(error as Error).message}\n`);
    return null;
  }
}

/* ---- the drafts repo ---- */

export interface GhResult { status: number | null; stdout: string; stderr: string }
export type Gh = (args: readonly string[]) => GhResult;

export const realGh: Gh = (args) => {
  const run = spawnSync('gh', [...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return { status: run.status, stdout: run.stdout ?? '', stderr: run.stderr ?? '' };
};

export function assetName(id: string, kind: FileKind, ext = '.png'): string {
  return kind === 'raw' ? `${id}${ext}` : `${id}.${kind}${ext}`;
}

/** Waits in seconds; replaced in tests. */
export const pacing = {
  sleep: (seconds: number): void => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(0, seconds) * 1000);
  },
};

const RATE_LIMITED = /rate limit exceeded/i;

/** Retry a gh call; a rate-limited answer waits and asks again (the window of the asset endpoint is its own, so poll rather than trust a reported reset). */
function retry(gh: Gh, args: readonly string[], times = 3): GhResult {
  let last: GhResult = { status: null, stdout: '', stderr: '' };
  let limited = 0;
  for (let i = 0; i < times; i += 1) {
    last = gh(args);
    if (last.status === 0) return last;
    if (RATE_LIMITED.test(last.stderr) && limited < 30) {
      limited += 1;
      process.stderr.write(`rate limited; waiting 120s for the window to reopen (${limited}/30)\n`);
      pacing.sleep(120);
      i -= 1;
    }
  }
  return last;
}

/** The tag of a draft's release: its kernel run (`run-<YYYYMMDD>-<6 hex of the run id>`) or its route and day. */
export function tagFor(draft: Draft): string {
  if (draft.run !== null) {
    const date = /^(\d{4})-(\d{2})-(\d{2})/.exec(draft.run.id);
    const day = date === null ? 'undated' : `${date[1]}${date[2]}${date[3]}`;
    return `run-${day}-${sha256Hex(Buffer.from(draft.run.id)).slice(0, 6)}`;
  }
  const day = (draft.at ?? '').replace(/-/g, '').slice(0, 8);
  return `run-${/^\d{8}$/.test(day) ? day : 'undated'}-${draft.route ?? 'unknown'}`;
}

export interface PushOptions {
  gh?: Gh;
  repo?: string;
  /** One tag for everything (the backfill's `run-backfill-<source>`); else each draft's own. */
  tag?: string;
  dry?: boolean;
  say?: (text: string) => void;
}

export interface PushReport { uploaded: number; files: number; bytes: number; skipped: number; tags: string[] }

function releaseAssets(gh: Gh, repo: string, tag: string): Set<string> | null {
  const view = gh(['release', 'view', tag, '--repo', repo, '--json', 'assets']);
  if (view.status !== 0) return null;
  const json = JSON.parse(view.stdout) as { assets?: { name: string }[] };
  return new Set((json.assets ?? []).map((a) => a.name));
}

/**
 * Upload what is not stored yet, one release per tag, and cite it in the index. A draft that already has `stored`
 * is left alone. Nothing is ever replaced (no `--clobber`): an asset that is there stays as it is.
 */
export function pushCollected(items: readonly Collected[], index: DraftIndex, opts: PushOptions = {}): PushReport {
  const gh = opts.gh ?? realGh;
  const repo = opts.repo ?? DRAFTS_REPO;
  const say = opts.say ?? ((): void => undefined);
  const report: PushReport = { uploaded: 0, files: 0, bytes: 0, skipped: 0, tags: [] };
  const pending = new Map<string, Collected[]>();
  const seenIds = new Set<string>();
  for (const item of items) {
    const known = index.drafts.get(item.record.id);
    if (known?.stored != null) {
      index.add(item.record);
      report.skipped += 1;
      continue;
    }
    if (seenIds.has(item.record.id)) continue;
    seenIds.add(item.record.id);
    const tag = opts.tag ?? tagFor(item.record);
    pending.set(tag, [...(pending.get(tag) ?? []), item]);
  }
  for (const [base, all] of pending) {
    for (let part = 0; part * DRAFTS_PER_RELEASE < all.length; part += 1) {
      const tag = part === 0 ? base : `${base}-${part + 1}`;
      const chunk = all.slice(part * DRAFTS_PER_RELEASE, (part + 1) * DRAFTS_PER_RELEASE);
      const uploads = chunk.flatMap((item) => FILE_KINDS.flatMap((kind) => {
        const path = item.paths[kind];
        return path === null ? [] : [{ item, kind, path, name: assetName(item.record.id, kind, item.record.files[kind]?.ext) }];
      }));
      say(`${tag}: ${chunk.length} drafts, ${uploads.length} files`);
      report.tags.push(tag);
      if (opts.dry === true) continue;
      let present = releaseAssets(gh, repo, tag);
      if (present === null) {
        const made = retry(gh, ['release', 'create', tag, '--repo', repo, '--title', tag, '--notes', `Drafts of ${tag}: raw pictures, kernel pictures before the grid, and what the importer made, named by draft id. The index is tools/kit-gen/drafts.jsonl in the game repo. Nothing here is ever deleted.`]);
        if (made.status !== 0) throw new Error(`could not create release ${tag}: ${made.stderr.trim()}`);
        present = new Set();
      }
      const todo = uploads.filter((u) => !present.has(u.name));
      const stage = mkdtempSync(join(tmpdir(), 'art-drafts-upload-'));
      try {
        for (let i = 0; i < todo.length; i += 40) {
          const batch = todo.slice(i, i + 40);
          const names = batch.map((u) => {
            const link = join(stage, u.name);
            symlinkSync(resolve(u.path), link);
            return link;
          });
          const sent = retry(gh, ['release', 'upload', tag, '--repo', repo, ...names]);
          if (sent.status !== 0) throw new Error(`upload to ${tag} failed: ${sent.stderr.trim()}`);
          for (const u of batch) {
            report.files += 1;
            report.bytes += u.item.record.files[u.kind]?.bytes ?? 0;
          }
        }
      } finally {
        rmSync(stage, { recursive: true, force: true });
      }
      const after = releaseAssets(gh, repo, tag) ?? new Set<string>();
      const lost = uploads.filter((u) => !after.has(u.name));
      if (lost.length > 0) throw new Error(`${tag} is missing ${lost.length} assets after the upload (first: ${lost[0]?.name ?? ''})`);
      for (const item of chunk) {
        const assets: Stored['assets'] = {};
        for (const kind of FILE_KINDS) if (item.paths[kind] !== null) assets[kind] = assetName(item.record.id, kind, item.record.files[kind]?.ext);
        index.add({ ...item.record, stored: { repo, tag, assets } });
        report.uploaded += 1;
      }
    }
  }
  return report;
}

/* ---- fetch and verify ---- */

export interface FetchReport { fetched: number; present: number; missing: { id: string; kind: FileKind; why: string }[] }

function cachePath(cache: string, id: string, kind: FileKind, ext?: string): string {
  return join(cache, assetName(id, kind, ext));
}

/** Fill the cache from the releases. Only what is missing is asked for; a file already there is never overwritten. */
export function fetchDrafts(index: DraftIndex, ids: readonly string[] | null, opts: { gh?: Gh; cache?: string; say?: (t: string) => void } = {}): FetchReport {
  const gh = opts.gh ?? realGh;
  const cache = opts.cache ?? CACHE_DIR;
  mkdirSync(cache, { recursive: true });
  const report: FetchReport = { fetched: 0, present: 0, missing: [] };
  const wanted = new Map<string, { id: string; kind: FileKind; asset: string; ext?: string }[]>();
  for (const draft of ids === null ? index.drafts.values() : ids.flatMap((id) => index.drafts.get(id) ?? [])) {
    for (const kind of FILE_KINDS) {
      const ref = draft.files[kind];
      if (ref === null) continue;
      if (existsSync(cachePath(cache, draft.id, kind, ref.ext))) {
        report.present += 1;
        continue;
      }
      const asset = draft.stored?.assets[kind];
      if (draft.stored == null || asset === undefined) {
        report.missing.push({ id: draft.id, kind, why: 'not stored in the drafts repo' });
        continue;
      }
      wanted.set(draft.stored.tag, [...(wanted.get(draft.stored.tag) ?? []), { id: draft.id, kind, asset, ...(ref.ext === undefined ? {} : { ext: ref.ext }) }]);
    }
  }
  for (const [tag, files] of wanted) {
    for (let i = 0; i < files.length; i += 40) {
      const batch = files.slice(i, i + 40);
      opts.say?.(`fetch ${tag}: ${i + batch.length}/${files.length}`);
      const got = retry(gh, ['release', 'download', tag, '--repo', DRAFTS_REPO, '--dir', cache, ...batch.flatMap((f) => ['-p', f.asset])]);
      for (const f of batch) {
        if (existsSync(cachePath(cache, f.id, f.kind, f.ext))) report.fetched += 1;
        else report.missing.push({ id: f.id, kind: f.kind, why: got.status === 0 ? 'the release has no such asset' : `download failed: ${got.stderr.trim().slice(0, 120)}` });
      }
    }
  }
  return report;
}

export interface VerifyReport {
  checked: number;
  ok: number;
  mismatched: { id: string; kind: FileKind; expected: string; actual: string }[];
  missing: { id: string; kind: FileKind; why: string }[];
  /** Drafts with no storage citation and no cached copy: waiting for a push. */
  unpushed: string[];
  fetched: number;
}

/** Re-hash every draft's files against the index, fetching what the cache lacks. Exit 0 means every file matches. */
export function verifyDrafts(index: DraftIndex, ids: readonly string[] | null, opts: { gh?: Gh; cache?: string; fetch?: boolean; say?: (t: string) => void } = {}): VerifyReport {
  const cache = opts.cache ?? CACHE_DIR;
  const fetched = opts.fetch === false ? { fetched: 0, present: 0, missing: [] as FetchReport['missing'] } : fetchDrafts(index, ids, { ...opts, cache });
  const report: VerifyReport = { checked: 0, ok: 0, mismatched: [], missing: [], unpushed: [], fetched: fetched.fetched };
  const drafts = ids === null ? [...index.drafts.values()] : ids.flatMap((id) => index.drafts.get(id) ?? []);
  for (const draft of drafts) {
    let kept = false;
    for (const kind of FILE_KINDS) {
      const ref = draft.files[kind];
      if (ref === null) continue;
      const file = readIf(cachePath(cache, draft.id, kind, ref.ext));
      if (file === null) {
        if (draft.stored == null) {
          if (!kept && !report.unpushed.includes(draft.id)) report.unpushed.push(draft.id);
        } else report.missing.push({ id: draft.id, kind, why: fetched.missing.find((m) => m.id === draft.id && m.kind === kind)?.why ?? 'not in the cache' });
        continue;
      }
      kept = true;
      report.checked += 1;
      const actual = sha256Hex(file);
      if (actual === ref.sha256 && file.length === ref.bytes) report.ok += 1;
      else report.mismatched.push({ id: draft.id, kind, expected: ref.sha256, actual });
    }
  }
  return report;
}

export function verifyExitCode(report: VerifyReport, strict = false): number {
  return report.mismatched.length > 0 || report.missing.length > 0 || (strict && report.unpushed.length > 0) ? 1 : 0;
}

export function verifyText(report: VerifyReport): string {
  const lines = [`drafts verify: ${report.checked} files checked, ${report.ok} match, ${report.mismatched.length} differ, ${report.missing.length} missing, ${report.unpushed.length} drafts not pushed yet (${report.fetched} fetched this run)`];
  for (const m of report.mismatched) lines.push(`  MISMATCH ${m.id} ${m.kind}: index ${m.expected.slice(0, 16)}, file ${m.actual.slice(0, 16)}`);
  for (const m of report.missing) lines.push(`  MISSING ${m.id} ${m.kind}: ${m.why}`);
  return lines.join('\n');
}

/* ---- the wrong-draws library as a view ---- */

interface LibraryLine {
  file: string;
  asked: string;
  looks_like: string;
  model?: string;
  model_version?: string;
  seed?: number;
  round?: number;
  drawer?: string;
  ramps?: string[];
  prompt?: string;
  at?: string;
  kept?: string;
}

/** The drafts that someone wrote a `looks_like` for, as the library lists them (`docs/art/wrong-draws/library.jsonl`). */
export function wrongDrawsView(drafts: Iterable<Draft>): (LibraryLine & { draft: string })[] {
  const out: (LibraryLine & { draft: string })[] = [];
  for (const d of drafts) {
    if (d.looks_like === undefined) continue;
    const source = d.sources.find((s) => s.label === 'wrong-draws');
    out.push({
      file: source?.file ?? `${d.id}.png`, asked: d.name, looks_like: d.looks_like,
      ...(d.model === null ? {} : { model: d.model }), ...(d.model_version === null ? {} : { model_version: d.model_version }),
      ...(d.seed === null ? {} : { seed: d.seed }), ...(d.round === null ? {} : { round: d.round }),
      ...(d.route === null ? {} : { drawer: d.route }), ...(d.ramps === null ? {} : { ramps: d.ramps }),
      ...(d.prompt === null ? {} : { prompt: d.prompt }), ...(d.at === null ? {} : { at: d.at }),
      ...(d.review_note === undefined ? {} : { kept: d.review_note }), draft: d.id,
    });
  }
  return out;
}

export function wrongDrawsText(drafts: Iterable<Draft>): string {
  return wrongDrawsView(drafts).map((l) => JSON.stringify(l)).join('\n') + '\n';
}

/**
 * Write what the library says onto the drafts it describes: each listed PNG is matched by hash to an imported or raw
 * file of a draft; its `looks_like` and the owner's keep note become an amendment, and the library file becomes a
 * source of that draft. Returns the library lines no draft matched.
 */
export function annotateWrongDraws(index: DraftIndex, libraryText: string, dir: string): { matched: number; unmatched: string[] } {
  const library = libraryText.split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as LibraryLine);
  let matched = 0;
  const unmatched: string[] = [];
  for (const entry of library) {
    const png = readIf(join(dir, entry.file));
    const hash = png === null ? null : sha256Hex(png);
    const found = hash === null ? undefined : [...index.drafts.values()].find((d) => d.files.imported?.sha256 === hash || d.files.raw.sha256 === hash || d.files.full?.sha256 === hash);
    if (found === undefined) {
      unmatched.push(entry.file);
      continue;
    }
    matched += 1;
    index.amend({
      id: found.id, amend: true, looks_like: entry.looks_like, review: 'archive', review_by: 'owner',
      ...(entry.kept === undefined ? {} : { review_note: entry.kept }),
      ...(found.model === null && entry.model !== undefined ? { model: entry.model } : {}),
      ...(found.round === null && entry.round !== undefined ? { round: entry.round } : {}),
      ...(found.seed === null && entry.seed !== undefined ? { seed: entry.seed } : {}),
      ...(found.ramps === null && entry.ramps !== undefined ? { ramps: entry.ramps } : {}),
      sources: [{ label: 'wrong-draws', spec: null, run: 'wrong-draws', file: entry.file, at: entry.at ?? null, provenance: 'a wrong-object draw the owner kept (DECISIONS 2026-10-23)' }],
    });
  }
  return { matched, unmatched };
}

/**
 * The library's listed PNGs that no draft in the index holds (the importer ran again since, or the run folder is gone):
 * each becomes a draft of its own with the PNG as its only file, and what the library knows about it.
 */
export function wrongDrawOrphans(index: DraftIndex, libraryText: string, dir: string): Collected[] {
  const library = libraryText.split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as LibraryLine);
  const held = new Set([...index.drafts.values()].flatMap((d) => [d.files.raw.sha256, d.files.full?.sha256, d.files.imported?.sha256]));
  return library.flatMap((entry) => {
    const path = join(dir, entry.file);
    const png = readIf(path);
    if (png === null || held.has(sha256Hex(png))) return [];
    const [item] = collectPictures([path], { label: 'wrong-draws', provenance: 'the 64 px import kept in the wrong-draws library; the raw picture is not among the run folders found on disk' });
    if (item === undefined) return [];
    const record: Draft = {
      ...item.record, name: entry.asked, route: entry.drawer ?? null, model: entry.model ?? null, model_version: entry.model_version ?? null,
      seed: entry.seed ?? null, round: entry.round ?? null, ramps: entry.ramps ?? null, prompt: entry.prompt ?? null, at: entry.at ?? null,
      sources: item.record.sources.map((s) => ({ ...s, run: 'wrong-draws', at: entry.at ?? null })),
    };
    return [{ record, paths: item.paths }];
  });
}

/* ---- the command line ---- */

interface Args { positional: string[]; flags: Map<string, string | true> }

function parseFlags(args: readonly string[]): Args {
  const out: Args = { positional: [], flags: new Map() };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i] ?? '';
    if (!a.startsWith('--')) {
      out.positional.push(a);
      continue;
    }
    const next = args[i + 1];
    if (['--label', '--provenance', '--tag', '--picks', '--pool', '--route', '--base'].includes(a) && next !== undefined && !next.startsWith('--')) {
      out.flags.set(a.slice(2), next);
      i += 1;
    } else out.flags.set(a.slice(2), true);
  }
  return out;
}

function listPictures(dir: string, recursive: boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return recursive ? listPictures(p, true) : [];
    return e.isFile() && (DRAFT_EXTENSIONS as readonly string[]).includes(extname(e.name).toLowerCase()) ? [p] : [];
  }).sort();
}

function stats(index: DraftIndex): string {
  const drafts = [...index.drafts.values()];
  const by = (f: (d: Draft) => string): string => {
    const counts = new Map<string, number>();
    for (const d of drafts) counts.set(f(d), (counts.get(f(d)) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');
  };
  const bytes = drafts.reduce((n, d) => n + FILE_KINDS.reduce((m, k) => m + (d.files[k]?.bytes ?? 0), 0), 0);
  return [
    `${drafts.length} drafts, ${(bytes / 1e9).toFixed(2)} GB, ${drafts.filter((d) => d.stored !== null).length} stored`,
    `by route: ${by((d) => d.route ?? 'unknown')}`, `by review: ${by((d) => d.review)}`, `by source: ${by((d) => d.sources[0]?.label ?? '?')}`,
    `stored in ${new Set(drafts.flatMap((d) => (d.stored === null ? [] : [d.stored.tag]))).size} releases`,
  ].join('\n');
}

export function runCli(argv: readonly string[]): number {
  const [command = '', ...rest] = argv;
  const { positional, flags } = parseFlags(rest);
  const say = (t: string): void => void process.stdout.write(`${t}\n`);
  const index = DraftIndex.open(process.env['ART_DRAFTS_INDEX'] ?? INDEX_PATH);
  switch (command) {
    case 'push': {
      const label = flags.get('label');
      if (positional.length === 0 || typeof label !== 'string') throw new Error('Usage: art:drafts push <run folder | picture folder | picture> ... --label <source> [--provenance <text>] [--backfill] [--tag <tag>] [--picks <manifest>] [--round-from-folder] [--pool <pool>] [--route <route>] [--recursive] [--no-upload] [--dry]');
      const skipped: { name: string; why: string }[] = [];
      const text = (name: string): string | undefined => (typeof flags.get(name) === 'string' ? (flags.get(name) as string) : undefined);
      const provenance = text('provenance');
      const picks = text('picks');
      const hints = picks === undefined ? [] : hintsFrom(readFileSync(picks, 'utf8'));
      const base = { label, ...(provenance === undefined ? {} : { provenance }), hints, skipped, roundFromFolder: flags.has('round-from-folder') };
      const items: Collected[] = [];
      for (const target of positional) {
        const pictureOpts = { ...base, pool: text('pool') ?? null, route: text('route') ?? null };
        const recursive = flags.has('recursive');
        if (existsSync(join(target, 'manifest.jsonl'))) {
          items.push(...collectRun(target, base));
          // a run folder's own manifest names only its sprites; with --recursive the sub-folders (refinements, references) are read too
          if (recursive) items.push(...collectPictures(listPictures(target, true), pictureOpts));
        } else {
          const files = statSync(target).isDirectory() ? listPictures(target, recursive) : [target];
          items.push(...collectPictures(files, pictureOpts));
        }
      }
      const tag = text('tag') ?? (flags.has('backfill') ? `run-backfill-${label}` : undefined);
      const seen = new Set(index.drafts.keys());
      let added = 0;
      let merged = 0;
      for (const item of items) {
        if (seen.has(item.record.id)) merged += 1;
        else added += 1;
        seen.add(item.record.id);
      }
      if (!flags.has('dry')) {
        if (flags.has('no-upload')) for (const item of items) index.add(item.record);
        else {
          const pushed = pushCollected(items, index, { ...(tag === undefined ? {} : { tag }), say });
          for (const item of items) index.add(item.record);
          say(`uploaded ${pushed.uploaded} drafts, ${pushed.files} files, ${(pushed.bytes / 1e6).toFixed(1)} MB; tags ${pushed.tags.join(', ') || '-'}`);
        }
      }
      say(`${label}: ${items.length} pictures read, ${added} new drafts, ${merged} already in the index (sources added)`);
      const reasons = new Map<string, number>();
      for (const s of skipped) reasons.set(s.why, (reasons.get(s.why) ?? 0) + 1);
      for (const [why, n] of reasons) say(`  skipped ${n}: ${why}`);
      return 0;
    }
    case 'fetch': {
      const ids = flags.has('all') || positional.length === 0 ? null : positional;
      const report = fetchDrafts(index, ids, { say });
      say(`fetch: ${report.fetched} files fetched, ${report.present} already cached, ${report.missing.length} missing`);
      for (const m of report.missing) say(`  MISSING ${m.id} ${m.kind}: ${m.why}`);
      return report.missing.length > 0 ? 1 : 0;
    }
    case 'verify': {
      const base = flags.get('base');
      if (typeof base === 'string') {
        const shown = spawnSync('git', ['show', `${base}:tools/kit-gen/drafts.jsonl`], { encoding: 'utf8', maxBuffer: 1 << 28 });
        if (shown.status !== 0 && !/does not exist|exists on disk, but not in/.test(shown.stderr)) throw new Error(`verify --base ${base}: git could not read it: ${shown.stderr.trim().slice(0, 200)}`);
        const before = shown.status === 0 ? shown.stdout : '';
        if (!indexGrewOnly(before, readFileSync(index.path, 'utf8'))) {
          say(`drafts verify: the index is not ${base}'s file plus new lines at the end (a line was edited, removed or reordered)`);
          return 1;
        }
        say(`drafts verify: the index is ${base}'s file plus new lines only`);
      }
      const report = verifyDrafts(index, positional.length === 0 ? null : positional, { fetch: !flags.has('no-fetch'), say });
      say(verifyText(report));
      return verifyExitCode(report, flags.has('strict'));
    }
    case 'annotate-wrong-draws': {
      const library = readFileSync(WRONG_DRAWS_LIBRARY, 'utf8');
      const dir = dirname(WRONG_DRAWS_LIBRARY);
      const orphans = wrongDrawOrphans(index, library, dir);
      if (orphans.length > 0) {
        if (flags.has('no-upload')) for (const o of orphans) index.add(o.record);
        else pushCollected(orphans, index, { tag: 'run-backfill-wrong-draws', say });
        say(`wrong draws: ${orphans.length} listed pictures had no draft; each is now a draft of its own`);
      }
      const result = annotateWrongDraws(index, library, dir);
      say(`wrong draws: ${result.matched} matched to drafts, ${result.unmatched.length} not (${result.unmatched.join(', ') || '-'})`);
      return result.unmatched.length > 0 ? 1 : 0;
    }
    case 'view': {
      if (positional[0] !== 'wrong-draws') throw new Error('Usage: art:drafts view wrong-draws [--write]');
      const text = wrongDrawsText(index.drafts.values());
      if (flags.has('write')) writeFileSync(WRONG_DRAWS_LIBRARY, text);
      else process.stdout.write(text);
      return 0;
    }
    case 'stats':
      say(stats(index));
      return 0;
    default:
      throw new Error('Usage: art:drafts <push|fetch|verify|annotate-wrong-draws|view|stats> ...');
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  try {
    process.exitCode = runCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  }
}
