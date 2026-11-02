/**
 * pnpm art:library [--out DIR] [--seed-thumbs DIR] [--no-fetch]
 *
 * Builds the image library page (see `library.ts`) into DIR (default `.scratch/art-library/`): `index.html` and
 * `thumb/<id>.webp`. A thumbnail is made once, from the draft's raw picture in the private drafts store, and kept; a run
 * fetches only what is missing. A model file or a failed fetch gets a placeholder and a line in the log, and never stops
 * the build. `--seed-thumbs` copies thumbnails from an older folder first, to save the download.
 */
import { spawnSync } from 'node:child_process';
import { closeSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { DRAFTS_REPO, type Draft, DraftIndex, type Gh, INDEX_PATH, pngDims, realGh, retry } from './drafts.js';
import { dateReport, dateReportText, renderLibrary, rowOf } from './library.js';
import { IDS_FILE, REVIEWS_FILE, applyChoice, readReviews } from './library-reviews.js';
import { ROOT } from './queue.js';

export const THUMB_SIDE = 300;
const BATCH = 40;
const PICTURE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export type Convert = (from: string, to: string, smallSource: boolean) => boolean;

/** ffmpeg: fit the picture in a square, nearest neighbour when it is smaller than the square (pixel art stays crisp). */
export const ffmpegConvert: Convert = (from, to, small) => {
  const flags = small ? 'neighbor' : 'lanczos';
  const run = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', from, '-vf', `scale=${THUMB_SIDE}:${THUMB_SIDE}:force_original_aspect_ratio=decrease:flags=${flags}`, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', to], { encoding: 'utf8' });
  return run.status === 0 && existsSync(to);
};

export interface ThumbReport { present: number; seeded: number; made: number; placeholders: number; failed: { id: string; why: string }[] }

export interface ThumbOptions { gh?: Gh; convert?: Convert; seedFrom?: string; fetch?: boolean; say?: (line: string) => void }

export const thumbPath = (dir: string, id: string): string => join(dir, `${id}.webp`);

/** Make the thumbnail of every draft that lacks one. */
export function ensureThumbs(drafts: readonly Draft[], dir: string, opts: ThumbOptions = {}): ThumbReport {
  const gh = opts.gh ?? realGh;
  const convert = opts.convert ?? ffmpegConvert;
  const say = opts.say ?? (() => undefined);
  mkdirSync(dir, { recursive: true });
  const report: ThumbReport = { present: 0, seeded: 0, made: 0, placeholders: 0, failed: [] };
  const wanted = new Map<string, { draft: Draft; asset: string }[]>();
  for (const draft of drafts) {
    const target = thumbPath(dir, draft.id);
    if (existsSync(target)) { report.present += 1; continue; }
    const seed = opts.seedFrom === undefined ? null : thumbPath(opts.seedFrom, draft.id);
    if (seed !== null && existsSync(seed)) { copyFileSync(seed, target); report.seeded += 1; continue; }
    const ext = draft.files.raw.ext ?? '.png';
    if (!PICTURE_EXTENSIONS.has(ext)) { report.placeholders += 1; say(`placeholder ${draft.id} ${draft.name}: a ${ext} file has no picture`); continue; }
    const asset = draft.stored?.assets.raw;
    if (draft.stored == null || asset === undefined) { report.failed.push({ id: draft.id, why: 'not stored in the drafts repo' }); say(`no thumbnail ${draft.id} ${draft.name}: not stored in the drafts repo`); continue; }
    if (opts.fetch === false) continue;
    wanted.set(draft.stored.tag, [...(wanted.get(draft.stored.tag) ?? []), { draft, asset }]);
  }
  if (wanted.size === 0) return report;
  const work = mkdtempSync(join(tmpdir(), 'art-library-'));
  try {
    for (const [tag, items] of wanted) {
      for (let i = 0; i < items.length; i += BATCH) {
        const batch = items.slice(i, i + BATCH);
        say(`fetch ${tag}: ${i + batch.length}/${items.length}`);
        const got = retry(gh, ['release', 'download', tag, '--repo', DRAFTS_REPO, '--dir', work, ...batch.flatMap((b) => ['-p', b.asset])]);
        for (const { draft, asset } of batch) {
          const file = join(work, asset);
          if (!existsSync(file)) {
            const why = got.status === 0 ? 'the release has no such asset' : `download failed: ${got.stderr.trim().slice(0, 120)}`;
            report.failed.push({ id: draft.id, why });
            say(`no thumbnail ${draft.id} ${draft.name}: ${why}`);
            continue;
          }
          const dims = pngDims(readHead(file));
          const small = dims !== null && Math.max(dims[0], dims[1]) < THUMB_SIDE;
          if (convert(file, thumbPath(dir, draft.id), small)) report.made += 1;
          else { report.failed.push({ id: draft.id, why: 'the picture could not be converted' }); say(`no thumbnail ${draft.id} ${draft.name}: the picture could not be converted`); }
          rmSync(file, { force: true });
        }
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return report;
}

function readHead(file: string): Buffer {
  const head = Buffer.alloc(32);
  const fd = openSync(file, 'r');
  try {
    readSync(fd, head, 0, 32, 0);
  } finally {
    closeSync(fd);
  }
  return head;
}

export interface BuildResult { total: number; html: string; thumbs: ThumbReport; dates: string; reviews: { applied: number; skipped: number } }

/** The whole build: thumbnails, then the page. Throws only when the index cannot be read. */
export function buildLibrary(index: DraftIndex, out: string, opts: ThumbOptions & { builtAt?: string } = {}): BuildResult {
  const drafts = [...index.drafts.values()];
  const thumbDir = join(out, 'thumb');
  const thumbs = ensureThumbs(drafts, thumbDir, opts);
  // the owner's hand sort (reviews.jsonl, kept in the page's folder by tools/art-library/serve.py) is laid over the index: his choice wins
  const known = new Set(index.drafts.keys());
  const saved = readReviews(join(out, REVIEWS_FILE), known);
  const rows = drafts.map((d) => applyChoice(rowOf(d, (id) => existsSync(thumbPath(thumbDir, id))), saved.choices.get(d.id)));
  const html = renderLibrary(rows, { builtAt: opts.builtAt ?? new Date().toISOString() });
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'index.html.tmp'), html);
  // the page appears whole or not at all: the server may be reading it
  renameSync(join(out, 'index.html.tmp'), join(out, 'index.html'));
  // the ids the page holds: the server accepts a choice only for one of them
  writeFileSync(join(out, `${IDS_FILE}.tmp`), JSON.stringify([...known]));
  renameSync(join(out, `${IDS_FILE}.tmp`), join(out, IDS_FILE));
  return { total: rows.length, html, thumbs, dates: dateReportText(dateReport(rows)), reviews: { applied: saved.choices.size, skipped: saved.skipped } };
}

function flag(args: readonly string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

export function main(args: readonly string[]): number {
  const out = resolve(flag(args, '--out') ?? join(ROOT, '.scratch/art-library'));
  const seed = flag(args, '--seed-thumbs');
  const index = DraftIndex.open(INDEX_PATH);
  const say = (line: string): void => void process.stdout.write(`${line}\n`);
  const result = buildLibrary(index, out, { say, fetch: !args.includes('--no-fetch'), ...(seed === undefined ? {} : { seedFrom: resolve(seed) }) });
  const t = result.thumbs;
  say(`thumbnails: ${t.present} kept, ${t.seeded} seeded, ${t.made} fetched, ${t.placeholders} placeholders (no picture), ${t.failed.length} failed`);
  say(result.dates);
  say(`reviews.jsonl: ${result.reviews.applied} choices laid over the index, ${result.reviews.skipped} lines skipped (not a choice for a draft on the page)`);
  say(`${result.total} drafts on the page: ${join(out, 'index.html')}`);
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  }
}
