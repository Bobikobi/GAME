/**
 * pnpm art:library:land [--out DIR] [--apply] [--pr]
 *
 * Carries the owner's hand sort (the page's `reviews.jsonl`, see `library-reviews.ts`) into the drafts index as amendment
 * lines `{"id", "amend": true, "review", "review_by": "owner", "review_note"}`, on a fresh branch from `origin/develop`.
 *
 *   (no flag)  count what would land, against `origin/develop`'s index; writes nothing.
 *   --apply    a worktree of `origin/develop` under `<repo>.worktrees/`, the amendments appended, one commit.
 *   --pr       also push the branch and open the pull request against `develop`. The command never pushes to `develop`
 *              itself; the manager lands the pull request.
 *
 * Idempotent: a choice the index already holds is not written again, the last choice for an id wins, and while a landing
 * pull request is open another is refused (two would carry the same lines).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

import { DraftIndex } from './drafts.js';
import { type Choice, REVIEWS_FILE, readReviews } from './library-reviews.js';
import { ROOT } from './queue.js';

export const LAND_BRANCH_PREFIX = 'art/library-reviews-';
const INDEX_REL = 'tools/kit-gen/drafts.jsonl';

export interface LandReport { written: string[]; same: number }

/** Append the choices that the index does not hold yet. Pure over a `DraftIndex`. */
export function landChoices(index: DraftIndex, choices: ReadonlyMap<string, Choice>): LandReport {
  const report: LandReport = { written: [], same: 0 };
  for (const choice of choices.values()) {
    const have = index.drafts.get(choice.id);
    if (have === undefined) continue;
    const haveNote = have.review_note ?? '';
    // choosing "unreviewed" on a draft nobody sorted says nothing
    if (choice.review === 'unreviewed' && have.review === 'unreviewed' && choice.note === '' && haveNote === '') { report.same += 1; continue; }
    // his note replaces an agent's, so an empty note is written when there is something to clear
    const wrote = index.amend({
      id: choice.id, amend: true, review: choice.review, review_by: 'owner',
      ...(choice.note !== '' || haveNote !== '' ? { review_note: choice.note } : {}),
    });
    if (wrote) report.written.push(choice.id);
    else report.same += 1;
  }
  return report;
}

export type Run = (cmd: string, args: readonly string[], cwd?: string) => { status: number | null; stdout: string; stderr: string };

export const realRun: Run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
};

function must(run: Run, cmd: string, args: readonly string[], cwd?: string): string {
  const r = run(cmd, args, cwd);
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${r.status}): ${r.stderr.trim().slice(0, 300)}`);
  return r.stdout;
}

/** `<repo>.worktrees/<branch with slashes as dashes>`, next to the repo whichever of its worktrees this runs in. */
export function worktreeDir(root: string, branch: string): string {
  const parent = dirname(root);
  const base = basename(parent).endsWith('.worktrees') ? parent : join(parent, `${basename(root)}.worktrees`);
  return join(base, branch.replace(/\//g, '-'));
}

export function prBody(count: number, ids: readonly string[]): string {
  return [
    `The owner sorted ${count} pictures by hand on the image library page (issue #658). This appends one amendment line per picture to the drafts index: \`review\`, \`review_by: owner\` and his note. His choice wins over an agent's state of 30.10; nothing is deleted from the store (archive is a state).`,
    '',
    'Issue #658',
    'Tree: none: the drafts index gains review states, nothing a player can grow in changes',
    '',
    `Written by \`pnpm art:library:land --pr\` from \`reviews.jsonl\`; first ids: ${ids.slice(0, 5).join(', ')}${ids.length > 5 ? ', ...' : ''}.`,
  ].join('\n');
}

export interface LandOptions {
  reviewsFile: string;
  apply: boolean;
  pr: boolean;
  run?: Run;
  root?: string;
  say?: (line: string) => void;
  now?: Date;
}

export interface LandResult { branch: string | null; dir: string | null; written: string[]; same: number; skipped: number; pr: string | null }

export function landReviews(opts: LandOptions): LandResult {
  const run = opts.run ?? realRun;
  const root = opts.root ?? ROOT;
  const say = opts.say ?? (() => undefined);
  must(run, 'git', ['fetch', '--quiet', 'origin', 'develop'], root);
  const developIndex = must(run, 'git', ['show', `origin/develop:${INDEX_REL}`], root);
  const probe = mkdtempSync(join(tmpdir(), 'art-library-land-'));
  let plan: LandReport;
  let skipped: number;
  try {
    const copy = join(probe, 'drafts.jsonl');
    writeFileSync(copy, developIndex);
    const index = DraftIndex.open(copy);
    const read = readReviews(opts.reviewsFile, new Set(index.drafts.keys()));
    skipped = read.skipped;
    plan = landChoices(index, read.choices);
  } finally {
    rmSync(probe, { recursive: true, force: true });
  }
  say(`${plan.written.length} choices to land, ${plan.same} already in origin/develop's index, ${skipped} lines of reviews.jsonl skipped`);
  const base: LandResult = { branch: null, dir: null, written: plan.written, same: plan.same, skipped, pr: null };
  if (!opts.apply && !opts.pr) return base;
  if (plan.written.length === 0) { say('nothing to land'); return base; }

  const open = JSON.parse(must(run, 'gh', ['pr', 'list', '--state', 'open', '--base', 'develop', '--json', 'number,headRefName', '--limit', '200'], root)) as { number: number; headRefName: string }[];
  const clash = open.find((p) => p.headRefName.startsWith(LAND_BRANCH_PREFIX));
  if (clash !== undefined) throw new Error(`pull request #${clash.number} (${clash.headRefName}) is still open and carries choices; land it first, or this one would repeat them`);

  const stamp = (opts.now ?? new Date()).toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-');
  const branch = `${LAND_BRANCH_PREFIX}${stamp}`;
  const dir = worktreeDir(root, branch);
  // --no-track: a branch of ours never has develop as its upstream
  must(run, 'git', ['worktree', 'add', '--no-track', '-b', branch, dir, 'origin/develop'], root);
  const index = DraftIndex.open(join(dir, INDEX_REL));
  const written = landChoices(index, readReviews(opts.reviewsFile, new Set(index.drafts.keys())).choices);
  if (written.written.length !== plan.written.length) throw new Error(`the worktree's index took ${written.written.length} choices, the plan said ${plan.written.length}`);
  const current = must(run, 'git', ['branch', '--show-current'], dir).trim();
  if (current !== branch) throw new Error(`the worktree is on ${current}, not ${branch}`);
  must(run, 'git', ['add', INDEX_REL], dir);
  must(run, 'git', ['commit', '-m', `art(library): ${written.written.length} pictures sorted by the owner\n\nThe owner's hand sort from the image library page, as amendment lines on the drafts index (issue #658).`], dir);
  say(`committed ${written.written.length} choices on ${branch} in ${dir}`);
  let pr: string | null = null;
  if (opts.pr) {
    must(run, 'git', ['push', '-u', 'origin', branch], dir);
    pr = must(run, 'gh', ['pr', 'create', '--base', 'develop', '--head', branch, '--title', `art(library): ${written.written.length} pictures sorted by the owner`, '--body', prBody(written.written.length, written.written)], dir).trim();
    say(`pull request: ${pr}`);
    must(run, 'git', ['worktree', 'remove', dir], root);
  }
  return { ...base, branch, dir: pr === null ? dir : null, pr };
}

function flag(args: readonly string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

export function main(args: readonly string[]): number {
  const out = resolve(flag(args, '--out') ?? process.env.ART_LIBRARY_OUT ?? join(homedir(), 'Projects/GAME/.scratch/art-library'));
  const result = landReviews({ reviewsFile: join(out, REVIEWS_FILE), apply: args.includes('--apply'), pr: args.includes('--pr'), say: (l) => void process.stdout.write(`${l}\n`) });
  if (!args.includes('--apply') && !args.includes('--pr')) process.stdout.write(`dry run: ${result.written.length} would be written. --apply makes the branch and the commit, --pr also opens the pull request.\n`);
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
