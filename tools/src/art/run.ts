/**
 * `pnpm art:run [--once] [--dry] [--no-upload] [--clear-stop] [--max-wait-hours N] [--poll-seconds N]`: work the queue
 * that `art:wave` filled (docs/art/PRODUCTION_LINE.md section 2).
 *
 * One kernel run at a time, in the order the jobs were cut. A job is `kit:gen --drawer kaggle --no-picks` for a wave's
 * entries, with the recipe and the seed in its environment. `kit:gen` appends each draft to the drafts index as it
 * imports; the runner then fills in the pool and the round on the lines that have none, checks that the recipe and the
 * seed the index recorded are the job's, and uploads the pictures to the drafts repo (one release per kernel run).
 *
 * - Retries: a job that fails (an error, a timeout, a black picture) is run once more, only the entries that failed, same
 *   seeds. A second failure stops the queue (`state.json`, shown by `art:status`); `--clear-stop` lifts it.
 * - Kaggle down: when `kaggle kernels status` fails, the kernel is busy with another run, or Kaggle refuses the kernel
 *   (the GPU, the hours), the queue pauses with its reason and waits (`--poll-seconds`, up to `--max-wait-hours`; `--once`
 *   does not wait). It never falls back to the laptop or to another route.
 * - Budget: a job that would take the week past its cap (`wave.ts`) pauses the queue and does not wait; a later week frees it.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, openSync, closeSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { kaggleManifest, kaggleKernelId, kaggleSettings, kaggleStatus } from '../kit/drawers.js';
import {
  type Collected, DraftIndex, type Gh, INDEX_PATH, collectLine, pushCollected, readManifestLines, realGh,
} from './drafts.js';
import {
  type DoneRecord, type Failure, type Job, ROOT, dropLock, ensureQueue, finishJob, queuePath, readState,
  recoverRunning, requeueJob, startJob, takeLock, waitingJobs, writeState,
} from './queue.js';
import { capMinutes, weeklyMeter } from './wave.js';

/** Is Kaggle there to take a kernel? */
export interface KaggleProbe {
  up: boolean;
  /** Why not, in words; null when it is up. */
  reason: string | null;
}

/** The state words of a kernel that is still working: a new push would stack on it or replace it. */
const WORKING = new Set(['running', 'queued']);

/** Read the answer of `kaggle kernels status <kernel>`. Pure, so the words are tested without the CLI. */
export function readProbe(status: number | null, text: string, spawnError: string | null): KaggleProbe {
  if (spawnError !== null) return { up: false, reason: `the kaggle CLI did not run (${spawnError}); set KAGGLE_CLI` };
  const state = kaggleStatus(text).state;
  if (state !== null && WORKING.has(state)) return { up: false, reason: `the kernel is busy (${state}); a second wave needs its own KAGGLE_KERNEL` };
  if (state !== null) return { up: true, reason: null };
  // the kernel was never pushed: Kaggle answered, the account is there
  if (/\b404\b|not found|does not exist/iu.test(text)) return { up: true, reason: null };
  const said = text.trim().replace(/\s+/gu, ' ').slice(0, 200);
  return { up: false, reason: `Kaggle did not answer${status === null ? '' : ` (exit ${status})`}${said === '' ? '' : `: ${said}`}` };
}

export function probeKaggle(env: NodeJS.ProcessEnv = process.env): KaggleProbe {
  const settings = kaggleSettings(env);
  const kernel = kaggleKernelId(settings, env);
  if (kernel.id === null) return { up: false, reason: kernel.error ?? 'no kernel id' };
  const run = spawnSync(settings.cli, ['kernels', 'status', kernel.id], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 });
  return readProbe(run.status, `${run.stdout ?? ''}${run.stderr ?? ''}`, run.error === undefined ? null : run.error.message);
}

/**
 * Is this error Kaggle being unavailable rather than a picture going wrong? Such an error pauses the queue and does not
 * use up the job's retry. Null for an error of the draw itself.
 */
export function pauseReason(error: string): string | null {
  if (/kaggle cli did not run|not signed in|set kaggle_cli/iu.test(error)) return 'the kaggle CLI is not available or not signed in';
  if (/kaggle refused the kernel/iu.test(error)) return error.replace(/\s+/gu, ' ').slice(0, 240);
  if (/quota|gpu hours|out of .{0,20}hours|rate limit|too many requests|\b429\b|\b50[23]\b|connection (?:error|reset|refused)|network is unreachable|could not resolve|enotfound|econnreset/iu.test(error)) return `Kaggle was unreachable or out of allowance: ${error.replace(/\s+/gu, ' ').slice(0, 200)}`;
  return null;
}

export interface Exec {
  status: number | null;
  /** The last of what `kit:gen` printed, for a failure with no result of its own. */
  tail: string;
}

export interface RunDeps {
  root: string;
  now: () => Date;
  sleep: (seconds: number) => void;
  probe: () => KaggleProbe;
  /** Run `kit:gen` for the job's entries (a retry narrows them), its output going to `log`. */
  exec: (job: Job, only: readonly string[], log: string) => Exec;
  say: (text: string) => void;
  pid: number;
  indexPath: string;
  gh: Gh;
}

export function realDeps(root = ROOT): RunDeps {
  return {
    root,
    now: () => new Date(),
    sleep: (seconds) => void Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(0, seconds) * 1000),
    probe: () => probeKaggle(),
    exec: (job, only, log) => {
      const fd = openSync(log, 'a');
      try {
        const run = spawnSync('pnpm', ['kit:gen', ...job.args, '--only', only.join(',')], {
          cwd: root, env: { ...process.env, ...job.env }, stdio: ['ignore', fd, fd],
        });
        const tail = existsSync(log) ? readFileSync(log, 'utf8').slice(-400) : '';
        return { status: run.status, tail: run.error === undefined ? tail : `${run.error.message}\n${tail}` };
      } finally {
        closeSync(fd);
      }
    },
    say: (text) => void process.stdout.write(`${text}\n`),
    pid: process.pid,
    indexPath: process.env['ART_DRAFTS_INDEX'] ?? INDEX_PATH,
    gh: realGh,
  };
}

export interface RunOptions {
  /** Do not wait for Kaggle: write the pause and stop. */
  once?: boolean;
  /** Print the queue and what would run; touch nothing. */
  dry?: boolean;
  upload?: boolean;
  maxWaitHours?: number;
  pollSeconds?: number;
}

/** Kernel runs in a wave folder, by folder name; each is `kaggle/<stamp>-<n>` with the kernel's own manifest under `output/`. */
function kernelFolders(folder: string): string[] {
  const dir = join(folder, 'kaggle');
  return existsSync(dir) ? readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory()).sort() : [];
}

function kernelSeconds(folder: string, id: string): number | null {
  const path = join(folder, 'kaggle', id, 'output', 'kitgen-manifest.json');
  return existsSync(path) ? kaggleManifest(readFileSync(path, 'utf8')).seconds : null;
}

interface AttemptResult {
  drawn: string[];
  failed: Failure[];
  added: number;
  seen: number;
  kernels: { id: string; seconds: number }[];
  releases: string[];
  uploadError: string | null;
  notes: string[];
}

/** What one `kit:gen` run did for `names`: which pictures came, which did not, and the drafts they became. */
function afterAttempt(deps: RunDeps, job: Job, names: readonly string[], exec: Exec, before: { lines: number; drafts: number; kernels: Set<string> }, options: RunOptions): AttemptResult {
  const folder = join(deps.root, job.out);
  const lines = readManifestLines(folder).slice(before.lines);
  const drawn: string[] = [];
  const failed: Failure[] = [];
  for (const name of names) {
    const own = lines.filter((l) => l.name === name);
    const last = own.at(-1);
    if (last !== undefined && last.error === null && typeof last.out === 'string') drawn.push(name);
    else failed.push({ name, error: last?.error ?? `kit:gen ended (exit ${exec.status ?? 'none'}) with no result for it: ${exec.tail.trim().slice(-200)}` });
  }
  const kernels = kernelFolders(folder).filter((id) => !before.kernels.has(id)).flatMap((id) => {
    const seconds = kernelSeconds(folder, id);
    return seconds === null ? [] : [{ id, seconds }];
  });
  const result: AttemptResult = { drawn, failed, added: 0, seen: 0, kernels, releases: [], uploadError: null, notes: [] };
  const skipped: { name: string; why: string }[] = [];
  const items: Collected[] = lines.flatMap((line) => (names.includes(line.name) ? collectLine(folder, line, { label: job.wave, skipped }) ?? [] : []));
  result.seen = items.length;
  const index = DraftIndex.open(deps.indexPath);
  result.added = index.drafts.size - before.drafts;
  for (const item of items) {
    index.add(item.record);
    const d = index.drafts.get(item.record.id);
    if (d === undefined) continue;
    index.amend({ id: d.id, amend: true, pool: d.pool ?? job.pool, round: d.round ?? job.round });
    if (item.record.recipe !== job.recipe || item.record.seed !== job.seed) {
      result.notes.push(`${item.record.name}: the index records ${item.record.recipe ?? '?'} seed ${item.record.seed ?? '?'}, the job asked for ${job.recipe} seed ${job.seed}`);
    }
  }
  if (options.upload !== false && items.length > 0) {
    try {
      result.releases = pushCollected(items, index, { gh: deps.gh, say: deps.say }).tags;
    } catch (error) {
      result.uploadError = (error as Error).message;
    }
  }
  return result;
}

function pause(deps: RunDeps, reason: string): void {
  writeState(deps.root, { status: 'paused', reason, at: deps.now().toISOString() });
  deps.say(`paused: ${reason}`);
}

/** One job, up to two attempts. */
function workJob(deps: RunDeps, job: Job, options: RunOptions): 'done' | 'paused' | 'stopped' {
  const folder = join(deps.root, job.out);
  const log = queuePath(deps.root, 'logs', `${job.id}.log`);
  const started = deps.now().toISOString();
  const drawn: string[] = [];
  let names = [...job.entries];
  let failed: Failure[] = [];
  const kernels: { id: string; seconds: number }[] = [];
  const releases = new Set<string>();
  const notes: string[] = [];
  let added = 0;
  let seen = 0;
  let uploadError: string | null = null;
  let attempts = 0;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    attempts = attempt;
    startJob(deps.root, { ...job, entries: names }, attempt, deps.pid, deps.now());
    deps.say(`${job.id}: attempt ${attempt}, ${names.length} pictures (${job.recipe}, seed ${job.seed})`);
    const before = { lines: readManifestLines(folder).length, drafts: DraftIndex.open(deps.indexPath).drafts.size, kernels: new Set(kernelFolders(folder)) };
    const exec = deps.exec(job, names, log);
    const got = afterAttempt(deps, job, names, exec, before, options);
    drawn.push(...got.drawn);
    kernels.push(...got.kernels);
    got.releases.forEach((r) => releases.add(r));
    notes.push(...got.notes);
    added += got.added;
    seen += got.seen;
    uploadError = got.uploadError ?? uploadError;
    failed = got.failed;
    if (failed.length === 0) break;
    const unavailable = failed.map((f) => pauseReason(f.error)).find((r): r is string => r !== null);
    if (unavailable !== undefined) {
      // Kaggle was not there to draw: nothing was tried, so the job goes back whole minus what it drew
      requeueJob(deps.root, { ...job, entries: failed.map((f) => f.name) });
      pause(deps, unavailable);
      return 'paused';
    }
    deps.say(`${job.id}: ${failed.length} failed (${failed.map((f) => f.name).join(', ')})${attempt === 1 ? '; once more' : ''}`);
    names = failed.map((f) => f.name);
  }
  const record: DoneRecord = {
    job, outcome: failed.length === 0 ? 'ok' : 'failed', attempts, drawn, failed, drafts_added: added, drafts_seen: seen, kernels,
    gpu_minutes: Math.round(kernels.reduce((n, k) => n + k.seconds, 0) / 6) / 10, releases: [...releases], upload_error: uploadError,
    notes, gallery: `${job.out}/gallery.html`, started, finished: deps.now().toISOString(),
  };
  finishJob(deps.root, record);
  deps.say(describeDone(record));
  if (record.outcome === 'failed') {
    writeState(deps.root, { status: 'stopped', reason: `${job.id} failed twice: ${failed.map((f) => `${f.name}: ${f.error.replace(/\s+/gu, ' ').slice(0, 120)}`).join('; ')}`, at: deps.now().toISOString() });
    return 'stopped';
  }
  return 'done';
}

export function describeDone(record: DoneRecord): string {
  const lines = [
    `${record.job.id}: ${record.outcome}, ${record.drawn.length} of ${record.job.entries.length} pictures, ${record.drafts_added} new drafts in the index, ${record.gpu_minutes} GPU min (${record.kernels.length} kernel run${record.kernels.length === 1 ? '' : 's'}), releases: ${record.releases.join(', ') || 'none'}`,
  ];
  for (const f of record.failed) lines.push(`  failed ${f.name}: ${f.error.replace(/\s+/gu, ' ').slice(0, 200)}`);
  for (const n of record.notes) lines.push(`  NOTE ${n}`);
  if (record.upload_error !== null) lines.push(`  upload to the drafts repo failed (pnpm art:drafts push will redo it): ${record.upload_error}`);
  lines.push(`  gallery ${record.gallery}`);
  return lines.join('\n');
}

/** Run the queue to its end, a pause or a stop. Returns the exit code: 0 done or idle, 1 stopped, 2 paused for Kaggle, 3 paused for the budget, 4 another runner holds the queue. */
export function runQueue(deps: RunDeps, options: RunOptions = {}): number {
  ensureQueue(deps.root);
  if (options.dry === true) {
    const jobs = waitingJobs(deps.root);
    deps.say(jobs.length === 0 ? 'the queue is empty' : `${jobs.length} job${jobs.length === 1 ? '' : 's'} waiting:`);
    for (const j of jobs) deps.say(`  ${j.id}  ${j.recipe} seed ${j.seed}  ${j.entries.length} pictures  ~${j.estimate_minutes} min  ${j.entries.join(', ')}`);
    const state = readState(deps.root);
    if (state.status !== 'idle') deps.say(`state: ${state.status}${state.reason === null ? '' : `: ${state.reason}`}`);
    return 0;
  }
  const lock = takeLock(deps.root, deps.pid);
  if (!lock.ok) {
    deps.say(`another runner (pid ${lock.holder}) holds the queue`);
    return 4;
  }
  try {
    const recovered = recoverRunning(deps.root);
    if (recovered.length > 0) deps.say(`back in the queue after a runner that died: ${recovered.join(', ')}`);
    const state = readState(deps.root);
    if (state.status === 'stopped') {
      deps.say(`the queue is stopped: ${state.reason ?? ''}\nfix the cause, then pnpm art:run --clear-stop`);
      return 1;
    }
    const maxWait = (options.maxWaitHours ?? 6) * 3600;
    const poll = options.pollSeconds ?? 600;
    let waited = 0;
    for (;;) {
      const job = waitingJobs(deps.root)[0];
      if (job === undefined) {
        if (readState(deps.root).status !== 'stopped') writeState(deps.root, { status: 'idle', reason: null, at: deps.now().toISOString() });
        deps.say('the queue is empty');
        return 0;
      }
      const kaggle = deps.probe();
      if (!kaggle.up) {
        pause(deps, kaggle.reason ?? 'Kaggle is not available');
        if (options.once === true || waited >= maxWait) return 2;
        deps.sleep(poll);
        waited += poll;
        continue;
      }
      const meter = weeklyMeter(deps.root, [...DraftIndex.open(deps.indexPath).drafts.values()], deps.now());
      const cap = capMinutes(job.kind);
      if (meter.minutes + job.estimate_minutes > cap) {
        pause(deps, `the week's GPU budget: ${meter.minutes} min used of ${cap}, and ${job.id} needs ~${job.estimate_minutes}`);
        return 3;
      }
      const outcome = workJob(deps, job, options);
      if (outcome === 'stopped') return 1;
      if (outcome === 'paused') {
        if (options.once === true || waited >= maxWait) return 2;
        deps.sleep(poll);
        waited += poll;
        continue;
      }
      waited = 0;
      writeState(deps.root, { status: 'idle', reason: null, at: deps.now().toISOString() });
    }
  } finally {
    dropLock(deps.root, deps.pid);
  }
}

export function clearStop(root: string, now: Date = new Date()): string {
  const state = readState(root);
  if (state.status !== 'stopped') return `the queue is not stopped (${state.status})`;
  writeState(root, { status: 'idle', reason: null, at: now.toISOString() });
  return `cleared: ${state.reason ?? ''}`;
}

/** `pnpm art:run`: parse, then run. Returns the exit code. */
export function runCli(args: readonly string[], deps: RunDeps = realDeps()): number {
  const value = (flag: string): number | undefined => {
    const at = args.indexOf(flag);
    if (at < 0) return undefined;
    const n = Number(args[at + 1]);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${flag} takes a number`);
    return n;
  };
  const known = new Set(['--once', '--dry', '--no-upload', '--clear-stop', '--max-wait-hours', '--poll-seconds']);
  const unknown = args.filter((a, i) => !(known.has(a) || (i > 0 && (args[i - 1] === '--max-wait-hours' || args[i - 1] === '--poll-seconds'))));
  if (unknown.length > 0) throw new Error(`Usage: art:run [--once] [--dry] [--no-upload] [--clear-stop] [--max-wait-hours N] [--poll-seconds N] (not: ${unknown.join(' ')})`);
  if (args.includes('--clear-stop')) {
    deps.say(clearStop(deps.root, deps.now()));
    return 0;
  }
  const maxWaitHours = value('--max-wait-hours');
  const pollSeconds = value('--poll-seconds');
  return runQueue(deps, {
    once: args.includes('--once'), dry: args.includes('--dry'), upload: !args.includes('--no-upload'),
    ...(maxWaitHours === undefined ? {} : { maxWaitHours }), ...(pollSeconds === undefined ? {} : { pollSeconds }),
  });
}

