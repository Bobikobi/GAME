/**
 * The stray art check (GRUNT CR-114, after 541 indexed drafts were lost with two removed worktrees on 2026-10-30):
 * every art file (png, jpg, webp, glb) under a registered worktree's `.scratch`, `assets/gen` or run folder whose hash
 * is not in the drafts index is a stray, a picture the drafts store does not hold and a removed worktree would lose.
 *
 *   pnpm art:stray        lists the strays by worktree and folder with a count; exit 1 when there are any, 0 when none
 *
 * Not strays, by directory name anywhere under a bench: `dist`, `dist-3d` and any name ending in `-dist` (built game output, such
 * as `.scratch/signin-dist`), and any name starting with `e2e` or `shots` (e2e captures and before/after shots). A stray is a
 * picture the pipeline made that nobody indexed; build output and captures are regenerable by a command and are not art the
 * store should hold.
 *
 * `art:drafts push` is what clears a stray: it adds the picture's hash to `tools/kit-gen/drafts.jsonl`. A picture counts
 * as indexed when any worktree's index holds its hash (the index only ever grows, so a worktree's own newer lines count).
 * `pnpm check` prints the count as a `!` line (warning, never an error).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { foldIndex, parseIndex, sha256Hex } from './drafts.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ART_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.glb']);
/** The folders of a worktree where art is made and left; `art-drafts` is the fetched cache of indexed drafts. */
export const WORKBENCHES = ['.scratch', 'assets/gen', 'tools/kit-gen/runs'] as const;
const SKIP = new Set(['node_modules', '.git', 'art-drafts']);

/** A directory of regenerable output: a build (`dist`, `dist-3d`, `*-dist`) or a capture (`e2e*`, `shots*`). */
export function regenerable(name: string): boolean {
  return name === 'dist' || name === 'dist-3d' || name.endsWith('-dist') || name.startsWith('e2e') || name.startsWith('shots');
}

export interface Stray {
  worktree: string;
  /** The folder under the workbench, `.scratch/w3d`; the workbench itself for a file straight in it. */
  folder: string;
  file: string;
}

/** The worktrees git has registered for the repo that holds `repo`. */
export function registeredWorktrees(repo: string = REPO): string[] {
  const run = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: repo, encoding: 'utf8' });
  if (run.status !== 0) return [];
  return run.stdout
    .split('\n')
    .filter((l) => l.startsWith('worktree '))
    .map((l) => l.slice('worktree '.length).trim())
    .filter((p) => existsSync(p));
}

/** Every hash the drafts indexes of these worktrees hold: the raw, full and imported file of each draft. */
export function indexedHashes(worktrees: readonly string[]): Set<string> {
  const hashes = new Set<string>();
  for (const wt of worktrees) {
    const path = join(wt, 'tools/kit-gen/drafts.jsonl');
    if (!existsSync(path)) continue;
    for (const draft of foldIndex(parseIndex(readFileSync(path, 'utf8'))).values()) {
      for (const ref of Object.values(draft.files)) if (ref) hashes.add(ref.sha256);
    }
  }
  return hashes;
}

function artFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!regenerable(entry.name)) out.push(...artFiles(path));
      continue;
    }
    if (entry.isFile() && ART_EXT.has(extname(entry.name).toLowerCase())) out.push(path);
  }
  return out;
}

type HashCache = Record<string, { size: number; mtime: number; sha: string }>;

/** The strays of the given worktrees. `cachePath` remembers hashes by path, size and mtime so a rerun reads only what changed. */
export function findStrays(worktrees: readonly string[], hashes: ReadonlySet<string>, cachePath?: string): Stray[] {
  let cache: HashCache = {};
  if (cachePath && existsSync(cachePath)) {
    try {
      cache = JSON.parse(readFileSync(cachePath, 'utf8')) as HashCache;
    } catch {
      cache = {};
    }
  }
  const next: HashCache = {};
  const strays: Stray[] = [];
  for (const wt of worktrees) {
    for (const bench of WORKBENCHES) {
      const root = join(wt, bench);
      if (!existsSync(root) || !statSync(root).isDirectory()) continue;
      for (const file of artFiles(root)) {
        const st = statSync(file);
        const hit = cache[file];
        const sha = hit && hit.size === st.size && hit.mtime === st.mtimeMs ? hit.sha : sha256Hex(readFileSync(file));
        next[file] = { size: st.size, mtime: st.mtimeMs, sha };
        if (hashes.has(sha)) continue;
        const below = relative(root, file).split('/');
        strays.push({ worktree: wt, folder: below.length > 1 ? `${bench}/${below[0]}` : bench, file: relative(wt, file) });
      }
    }
  }
  if (cachePath) {
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(next));
  }
  return strays;
}

/** The report: a line per worktree and folder with its count, then the total. Empty when nothing is stray. */
export function strayText(strays: readonly Stray[]): string {
  if (strays.length === 0) return 'no stray art: every picture under a worktree workbench is in the drafts index';
  const groups = new Map<string, Stray[]>();
  for (const s of strays) groups.set(`${s.worktree}  ${s.folder}`, [...(groups.get(`${s.worktree}  ${s.folder}`) ?? []), s]);
  const lines = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, list]) => `${key}: ${list.length}`);
  return [...lines, `${strays.length} stray art file${strays.length === 1 ? '' : 's'} in ${groups.size} folder${groups.size === 1 ? '' : 's'}: push them with "pnpm art:drafts push <folder> --label <source>" before a worktree is removed`].join('\n');
}

/** Strays of every worktree registered for `repo`, the index being the union of theirs. */
export function strayArt(repo: string = REPO, cachePath: string | undefined = join(repo, '.scratch/stray-cache.json')): Stray[] {
  const worktrees = registeredWorktrees(repo);
  if (worktrees.length === 0) return [];
  return findStrays(worktrees, indexedHashes(worktrees), cachePath);
}

export function runStray(repo: string = REPO, say: (text: string) => void = (t) => process.stdout.write(`${t}\n`)): number {
  const strays = strayArt(repo);
  say(strayText(strays));
  return strays.length === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(runStray());

/** The check's issue: one `!` line with the count, none when the benches are clean. */
export function strayIssue(strays: readonly Stray[]): { file: string; where: string; message: string; level: 'warning' }[] {
  if (strays.length === 0) return [];
  const folders = new Set(strays.map((s) => `${s.worktree} ${s.folder}`)).size;
  return [{
    file: 'tools/kit-gen/drafts.jsonl',
    where: 'art.stray',
    message: `${strays.length} art file${strays.length === 1 ? '' : 's'} in ${folders} worktree folder${folders === 1 ? '' : 's'} not in the drafts index; removing the worktree loses them: run "pnpm art:stray", then "pnpm art:drafts push"`,
    level: 'warning',
  }];
}
