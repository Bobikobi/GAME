/**
 * The painted valley's browser tests on a machine with a real GPU, posted to the commit as a status (DECISIONS 2026-11-28
 * "The painted valley's browser tests run on a GPU machine and post a status").
 *
 *   pnpm e2e:local <pr-number | branch> [--groups a,b] [--post] [--keep]
 *
 * CI's runners draw WebGL in software, where the painted page runs at about 1 frame a second (classic: 37); a GPU draws
 * it at 60. This plays the groups of game/e2e/run.ts one after another, each with E2E_GPU=1, on a fresh detached worktree
 * of the commit, and with --post writes the commit status `e2e on a GPU` (pending at the start, then success or failure
 * with the groups that failed). Without --post nothing leaves the machine.
 *
 * Only the repo's own branches are played: a pull request from a fork is refused, so no code from outside runs here
 * unattended. The machine's own wrapper for heavy jobs goes in E2E_LOCAL_WRAP (a command each group runs under);
 * PAINTED_STORE names the pictures' store as for `pnpm painted:fetch`; E2E_LOCAL_DIR is where the worktree is made
 * (default: the system's temp folder).
 */
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO_ROOT } from './load';

/** The status's name on the commit. */
export const CONTEXT = 'e2e on a GPU';

/** What to play: a pull request of this repo or one of its branches, resolved to a commit. */
export interface Target {
  sha: string;
  label: string;
}

/** The status a finished run posts: every group green is success, anything else names the groups that failed. */
export function verdict(results: readonly { group: string; ok: boolean }[]): { state: 'success' | 'failure'; description: string } {
  const failed = results.filter((r) => !r.ok).map((r) => r.group);
  const green = results.length - failed.length;
  if (failed.length === 0) return { state: 'success', description: `${green}/${results.length} groups green on a GPU` };
  // a status description holds 140 characters
  return { state: 'failure', description: `${green}/${results.length} green; failed: ${failed.join(', ')}`.slice(0, 140) };
}

function run(cmd: string, args: readonly string[], cwd: string, env: NodeJS.ProcessEnv = process.env): SpawnSyncReturns<string> {
  return spawnSync(cmd, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
}

/** A step that failed: `step` names it for the public status, the message (with the command's output) stays on this machine's console. */
class StepError extends Error {
  constructor(
    readonly step: string,
    detail: string,
  ) {
    super(`${step} failed: ${detail}`);
  }
}

function must(cmd: string, args: readonly string[], cwd: string, what: string, env?: NodeJS.ProcessEnv): string {
  const r = run(cmd, args, cwd, env);
  if (r.status !== 0) throw new StepError(what, `(${cmd} ${args.join(' ')}): ${(r.stderr || r.stdout).trim().slice(-800)}`);
  return r.stdout.trim();
}

/** A pull request of this repo, or a branch on origin; a fork's pull request is refused. */
function resolveTarget(what: string): Target {
  if (/^\d+$/.test(what)) {
    const pr = JSON.parse(must('gh', ['pr', 'view', what, '--json', 'headRefOid,headRefName,isCrossRepository'], REPO_ROOT, 'reading the pull request')) as {
      headRefOid: string;
      headRefName: string;
      isCrossRepository: boolean;
    };
    if (pr.isCrossRepository) throw new Error(`#${what} comes from a fork: its code is never played here unattended`);
    return { sha: pr.headRefOid, label: `#${what} (${pr.headRefName})` };
  }
  const line = must('git', ['ls-remote', 'origin', `refs/heads/${what}`], REPO_ROOT, 'reading the branch');
  const sha = line.split(/\s+/)[0];
  if (!sha) throw new Error(`origin has no branch ${what}`);
  return { sha, label: what };
}

function groupsOf(dir: string): { group: string; build3d?: boolean }[] {
  return JSON.parse(must('node', ['game/e2e/run.ts', '--list'], dir, 'listing the groups')) as { group: string; build3d?: boolean }[];
}

function post(sha: string, state: 'pending' | 'success' | 'failure', description: string): void {
  must('gh', ['api', '--method', 'POST', `repos/{owner}/{repo}/statuses/${sha}`, '-f', `state=${state}`, '-f', `context=${CONTEXT}`, '-f', `description=${description}`], REPO_ROOT, 'posting the status');
}

function main(): void {
  const args = process.argv.slice(2);
  const what = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--groups');
  if (!what) {
    console.error('usage: pnpm e2e:local <pr-number | branch> [--groups a,b] [--post] [--keep]');
    process.exit(2);
  }
  const posting = args.includes('--post');
  const keep = args.includes('--keep');
  const only = args.includes('--groups') ? args[args.indexOf('--groups') + 1]?.split(',') : undefined;
  const target = resolveTarget(what);
  must('git', ['fetch', '--quiet', 'origin', target.sha], REPO_ROOT, 'fetching the commit');
  const dir = mkdtempSync(join(process.env.E2E_LOCAL_DIR ?? tmpdir(), 'e2e-local-'));
  const wrap = (process.env.E2E_LOCAL_WRAP ?? '').split(' ').filter(Boolean);
  const results: { group: string; ok: boolean; seconds: number }[] = [];
  console.log(`e2e:local ${target.label} at ${target.sha.slice(0, 8)} in ${dir}${posting ? '' : ' (no status posted: --post not given)'}`);
  try {
    must('git', ['worktree', 'add', '--detach', dir, target.sha], REPO_ROOT, 'making the worktree');
    if (posting) post(target.sha, 'pending', 'playing on a GPU');
    must('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], dir, 'installing');
    must('pnpm', ['bundle'], dir, 'the bundle (and the pictures)');
    must('pnpm', ['--filter', 'game', 'build'], dir, 'building the game');
    const groups = groupsOf(dir).filter((g) => !only || only.includes(g.group));
    if (groups.some((g) => g.build3d)) must('pnpm', ['exec', 'tsx', 'tools/src/site/build-3d.ts'], dir, 'building the 3D door');
    for (const g of groups) {
      const t0 = Date.now();
      const cmd = [...wrap, 'pnpm', 'e2e:group', g.group, join(dir, '.e2e-shots', g.group), '--retry'];
      const r = spawnSync(cmd[0]!, cmd.slice(1), { cwd: dir, env: { ...process.env, E2E_GPU: '1' }, stdio: 'inherit' });
      const seconds = Math.round((Date.now() - t0) / 1000);
      results.push({ group: g.group, ok: r.status === 0, seconds });
      console.log(`e2e:local ${g.group}: ${r.status === 0 ? 'green' : 'red'} in ${seconds} s`);
    }
    const v = verdict(results);
    console.log(`e2e:local ${target.label}: ${v.state}: ${v.description}`);
    if (posting) post(target.sha, v.state, v.description);
    if (v.state !== 'success') process.exitCode = 1;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`e2e:local: ${message}`);
    if (posting) {
      try {
        // the status is public: it names the step only, never the command's output (paths, the store's address)
        post(target.sha, 'failure', `the run broke at: ${e instanceof StepError ? e.step : 'an unexpected error'}`.slice(0, 140));
      } catch {
        // the status could not be posted either: the console line above is the record
      }
    }
    process.exitCode = 1;
  } finally {
    if (keep) console.log(`e2e:local: the worktree stays at ${dir} (--keep)`);
    else {
      run('git', ['worktree', 'remove', '--force', dir], REPO_ROOT);
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

if (process.argv[1]?.endsWith('e2e-local.ts')) main();
