/**
 * The creators board (spec C-1): creator points and commits, computed
 * from the repository history and the content that is in the game now.
 *
 * Weights are configured in .github/points.json:
 *   points = per_record for every content record the creator has in the game
 *          + per_commit for every commit that changed their files
 *
 * Core is the main developer: every commit in the repository counts for it.
 * A creator's commits are those that touched content/extensions/<handle>/ or
 * content/kit/<handle>/. Points for reviewers come with the server.
 *
 * `pnpm board` writes content/board.json, which is committed: a deploy builds
 * from a shallow clone that cannot see the history.
 *
 * On a branch the board is written with `--base origin/develop`: the base's
 * history plus the branch's own changes as one commit, which is what develop
 * has once the pull request lands as a squash. CI verifies every pull request's
 * board against that (`--verify --base HEAD^1`), so a stale copy or a number
 * written by hand fails the check instead of reaching the site.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BoardEntry, Credit } from '@game/kernel';
import { BOARD_PATH, REPO_ROOT } from './load';

export const BOARD_FILE = BOARD_PATH;

export interface PointsConfig {
  per_record: number;
  per_commit: number;
  per_approval: number;
  weekly_pool: number;
  weekly_pool_active: boolean;
}

const ALLOWED_KEYS = new Set(['per_record', 'per_commit', 'per_approval', 'weekly_pool', 'weekly_pool_active']);

export function readPoints(root = REPO_ROOT): PointsConfig {
  const file = join(root, '.github', 'points.json');
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid points.json: must be an object');
  }
  const keys = Object.keys(raw);
  for (const k of keys) {
    if (!ALLOWED_KEYS.has(k)) {
      throw new Error(`Invalid key "${k}" in points.json`);
    }
  }
  for (const k of ALLOWED_KEYS) {
    if (!(k in raw)) {
      throw new Error(`Missing key "${k}" in points.json`);
    }
  }
  if (
    typeof raw.per_record !== 'number' ||
    typeof raw.per_commit !== 'number' ||
    typeof raw.per_approval !== 'number' ||
    typeof raw.weekly_pool !== 'number' ||
    typeof raw.weekly_pool_active !== 'boolean'
  ) {
    throw new Error('Invalid types in points.json');
  }
  return raw as unknown as PointsConfig;
}

export interface Commit {
  /** unix seconds */
  at: number;
  files: string[];
}

/** Which creators a commit worked for: core always, others by the files it touched. */
export function creatorsOf(commit: Commit): Set<string> {
  const out = new Set<string>(['core']);
  for (const f of commit.files) {
    const m = /^content\/(?:extensions|kit)\/([a-z0-9_-]+)\//.exec(f);
    if (m && m[1] !== 'core') out.add(m[1]!);
  }
  return out;
}

export function computeBoard(
  commits: readonly Commit[],
  credits: readonly Credit[],
  points: PointsConfig = readPoints(),
): Record<string, BoardEntry> {
  const times = new Map<string, number[]>();
  for (const c of commits) for (const who of creatorsOf(c)) (times.get(who) ?? times.set(who, []).get(who)!).push(c.at);
  const records = new Map<string, number>();
  for (const c of credits) records.set(c.creator, (records.get(c.creator) ?? 0) + 1);
  const handles = [...new Set([...times.keys(), ...records.keys()])].sort();
  const board: Record<string, BoardEntry> = {};
  for (const handle of handles) {
    const t = times.get(handle) ?? [];
    const n = records.get(handle) ?? 0;
    board[handle] = {
      points: points.per_record * n + points.per_commit * t.length,
      records: n,
      commits: t.length,
    };
  }
  return board;
}

const GIT_BUFFER = 64 * 1024 * 1024;

/** A commit that only rewrote the board is not work: it does not count. */
function boardOnly(files: readonly string[]): boolean {
  return files.length > 0 && files.every((f) => f === 'content/board.json');
}

/** Every commit with its time and files, oldest first: the checkout's history, or `ref`'s when given. */
export function readCommits(cwd = REPO_ROOT, ref?: string): Commit[] {
  const args = ['log', '--reverse', '--name-only', '--format=%x00%ct', ...(ref ? [ref] : []), '--'];
  const out = execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: GIT_BUFFER });
  const commits: Commit[] = [];
  for (const block of out.split('\0').slice(1)) {
    const [head, ...files] = block.split('\n').filter((l) => l.trim() !== '');
    const at = Number(head);
    if (!Number.isFinite(at)) continue;
    if (boardOnly(files)) continue;
    commits.push({ at, files });
  }
  return commits;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: GIT_BUFFER });
}

/**
 * The history `base` has once the checkout lands on it as one commit (a squash): the base's
 * commits, then the checkout's own changes since it left the base, as a single commit. The changes
 * are read from the working tree, new files included, so the board is the same whether it is
 * written before or after the branch's commits. A branch that only rewrote the board adds
 * nothing, like such a commit in the history.
 */
export function squashedCommits(base: string, cwd = REPO_ROOT): Commit[] {
  const commits = readCommits(cwd, base);
  const left = git(cwd, 'merge-base', base, 'HEAD').trim();
  const lines = `${git(cwd, 'diff', '--name-only', left, '--')}\n${git(cwd, 'ls-files', '--others', '--exclude-standard')}`;
  const files = [...new Set(lines.split('\n').filter((l) => l.trim() !== ''))].sort();
  if (files.length > 0 && !boardOnly(files)) {
    const last = commits[commits.length - 1];
    commits.push({ at: last ? last.at + 1 : 0, files });
  }
  return commits;
}

export function readBoard(): Record<string, BoardEntry> {
  if (!existsSync(BOARD_FILE)) return {};
  try {
    const data = JSON.parse(readFileSync(BOARD_FILE, 'utf8')) as { board?: Record<string, BoardEntry> };
    return data.board ?? {};
  } catch {
    return {};
  }
}

/** The file `pnpm board` writes for `board`, byte for byte. */
export function boardText(board: Record<string, BoardEntry>): string {
  const note = 'Creators board (spec C-1), generated by "pnpm board" from the git history and .github/points.json. Do not edit by hand.';
  return `${JSON.stringify({ format: 1, note, board }, null, 2)}\n`;
}

export function writeBoard(board: Record<string, BoardEntry>): void {
  writeFileSync(BOARD_FILE, boardText(board));
}

/** True when `file` holds exactly what `pnpm board` would write for `board`: not stale, not edited by hand. */
export function boardIsCurrent(board: Record<string, BoardEntry>, file = BOARD_FILE): boolean {
  return existsSync(file) && readFileSync(file, 'utf8') === boardText(board);
}
