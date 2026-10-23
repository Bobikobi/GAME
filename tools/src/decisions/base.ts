/**
 * The base the checks against develop compare with, and a reader for files at that base.
 *
 *   DECISIONS_BASE unset   the merge base of HEAD and origin/develop
 *   DECISIONS_BASE=skip    no base: the checks against the base do not run, and nothing is printed
 *   DECISIONS_BASE=<ref>   that ref (CI sets HEAD^1 on a pull request: the tip of the base branch)
 *
 * base-available says so when the base cannot be read, instead of letting those checks pass silently:
 * an error in CI, a warning on a machine. Outside a git checkout there is no base and one warning.
 */
import { execFileSync } from 'node:child_process';
import type { Issue } from '../load';

const CHECK = '[base-available]';

/** Runs git in `cwd`; returns stdout, or null when git fails or is missing. */
export type GitRun = (args: string[], cwd: string, input?: string) => Buffer | null;

export const runGit: GitRun = (args, cwd, input) => {
  try {
    return execFileSync('git', args, { cwd, input, maxBuffer: 256 << 20, stdio: ['pipe', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
};

export interface Base {
  /** a commit id, or null when no check against the base runs */
  ref: string | null;
  issues: Issue[];
}

export function resolveBase(env: Readonly<Record<string, string | undefined>>, root: string, git: GitRun = runGit): Base {
  const wanted = env.DECISIONS_BASE?.trim();
  if (wanted === 'skip') return { ref: null, issues: [] };
  const issue = (message: string, level: Issue['level']): Base => ({
    ref: null,
    issues: [{ file: 'DECISIONS_BASE', where: '', message: `${message} ${CHECK}`, level }],
  });
  if (git(['rev-parse', '--is-inside-work-tree'], root) === null) {
    return issue('the checks against the base did not run: this folder is not a git checkout', 'warning');
  }
  const inCi = env.CI === 'true';
  if (wanted) {
    const sha = git(['rev-parse', '--verify', '--quiet', `${wanted}^{commit}`], root);
    if (sha === null) {
      return issue(
        `DECISIONS_BASE (${wanted}) cannot be read, so the checks against the base did not run: the checkout needs its history (fetch-depth) and DECISIONS_BASE=HEAD^1 on a pull request, or DECISIONS_BASE=skip on a push`,
        inCi ? 'error' : 'warning',
      );
    }
    return { ref: sha.toString('utf8').trim(), issues: [] };
  }
  const mb = git(['merge-base', 'HEAD', 'origin/develop'], root);
  if (mb === null) {
    return issue(
      'the checks against the base did not run: there is no origin/develop here (run "git fetch origin develop"), or set DECISIONS_BASE to the commit your branch starts from',
      inCi ? 'error' : 'warning',
    );
  }
  return { ref: mb.toString('utf8').trim(), issues: [] };
}

/**
 * The text of `paths` at `ref`, with one 'git ls-tree' and one 'git cat-file --batch'.
 * A path the ref does not hold maps to null.
 */
export function gitReader(ref: string, paths: readonly string[], root: string, git: GitRun = runGit): Map<string, string | null> {
  const out = new Map<string, string | null>(paths.map((p) => [p, null]));
  if (paths.length === 0) return out;
  const listed = git(['ls-tree', '-r', '--name-only', ref, '--', ...paths], root);
  if (listed === null) return out;
  const present = listed.toString('utf8').split('\n').filter((p) => out.has(p));
  if (present.length === 0) return out;
  const batch = git(['cat-file', '--batch'], root, present.map((p) => `${ref}:${p}\n`).join(''));
  if (batch === null) return out;
  let at = 0;
  for (const p of present) {
    const eol = batch.indexOf(10, at);
    if (eol < 0) break;
    const header = batch.subarray(at, eol).toString('utf8').split(' ');
    at = eol + 1;
    if (header[1] === 'missing') continue;
    const size = Number(header[2]);
    out.set(p, batch.subarray(at, at + size).toString('utf8'));
    at += size + 1;
  }
  return out;
}

/** The pull request numbers the history of HEAD names ('(#12)' of a squash merge, 'pull request #12' of a merge); null without git. */
export function mergedPullRequests(root: string, git: GitRun = runGit): Set<number> | null {
  const log = git(['log', '--format=%s', 'HEAD'], root);
  if (log === null) return null;
  const out = new Set<number>();
  for (const m of log.toString('utf8').matchAll(/\(#(\d+)\)|pull request #(\d+)/g)) out.add(Number(m[1] ?? m[2]));
  return out;
}
