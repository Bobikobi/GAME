/**
 * The art queue on disk (docs/art/PRODUCTION_LINE.md section 2): `.scratch/art-queue/` with
 *
 *   jobs/      a job per kernel run that waits (`<wave>-<n>-<recipe>-s<seed>.json`)
 *   running/   the job being worked, with the runner's pid
 *   done/      one record per finished job: what it drew, what failed, the GPU minutes, the releases
 *   logs/      what `kit:gen` printed, attempt by attempt
 *   waves/     one folder a wave: its cut `spec.json` and the `kit:gen` run folder (manifest, pictures, gallery)
 *   state.json idle, paused or stopped, and why
 *
 * The queue is scratch: the drafts index and the drafts repo hold what must outlive it. Reads and writes files only.
 */
import {
  existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { KaggleRecipe } from '../kit/drawers.js';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Where the queue lives, relative to the repository root. */
export const QUEUE_DIR = '.scratch/art-queue';

export const SUBDIRS = ['jobs', 'running', 'done', 'logs', 'waves'] as const;

/** Why a wave was cut: entries nobody drew yet, or entries the owner sent back. They draw against different caps (budget.ts). */
export type WaveKind = 'new' | 'again';

/** One kernel run: a recipe and a seed on a list of a wave's entries. */
export interface Job {
  id: string;
  wave: string;
  pool: string;
  kind: WaveKind;
  /** The draw's round: 1 for a first draw, one more than the entry's last round for a redraw. */
  round: number;
  recipe: KaggleRecipe;
  seed: number;
  entries: string[];
  /** The wave's cut spec and the `kit:gen` run folder, relative to the repository root. */
  spec: string;
  out: string;
  /** The environment `kit:gen` runs under; the recipe and the seed are spelled here and nowhere else. */
  env: Record<string, string>;
  /** The `kit:gen` arguments after `pnpm kit:gen`, `--only` excluded (a retry narrows it). */
  args: string[];
  estimate_minutes: number;
  created: string;
}

export interface RunningRecord {
  job: Job;
  pid: number;
  started: string;
  attempt: number;
}

export interface Failure {
  name: string;
  error: string;
}

export interface DoneRecord {
  job: Job;
  outcome: 'ok' | 'failed';
  attempts: number;
  drawn: string[];
  failed: Failure[];
  /** Drafts this job added to the index (new picture bytes). */
  drafts_added: number;
  drafts_seen: number;
  /** Every kernel run this job started, failed ones included, with the seconds the kernel reported: the meter's second source (a run that drew nothing leaves no draft in the index). */
  kernels: { id: string; seconds: number }[];
  gpu_minutes: number;
  /** The drafts-repo releases the pictures went to. */
  releases: string[];
  upload_error: string | null;
  /** Anything the runner saw that the owner or the manager should read (a recipe or seed the index does not match). */
  notes: string[];
  gallery: string;
  started: string;
  finished: string;
}

export interface QueueState {
  status: 'idle' | 'paused' | 'stopped';
  reason: string | null;
  at: string | null;
}

export function queuePath(root: string, ...parts: string[]): string {
  return join(root, QUEUE_DIR, ...parts);
}

export function ensureQueue(root: string): void {
  for (const dir of SUBDIRS) mkdirSync(queuePath(root, dir), { recursive: true });
}

export function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 1)}\n`);
}

export function readState(root: string): QueueState {
  return readJson<QueueState>(queuePath(root, 'state.json')) ?? { status: 'idle', reason: null, at: null };
}

export function writeState(root: string, state: QueueState): void {
  writeJson(queuePath(root, 'state.json'), state);
}

function listJson<T>(root: string, dir: string): { file: string; value: T }[] {
  const base = queuePath(root, dir);
  if (!existsSync(base)) return [];
  return readdirSync(base).filter((f) => f.endsWith('.json')).sort().flatMap((file) => {
    const value = readJson<T>(join(base, file));
    return value === null ? [] : [{ file, value }];
  });
}

/** The waiting jobs, in the order they were cut. */
export function waitingJobs(root: string): Job[] {
  return listJson<Job>(root, 'jobs').map((j) => j.value);
}

export function runningJobs(root: string): RunningRecord[] {
  return listJson<RunningRecord>(root, 'running').map((j) => j.value);
}

export function doneRecords(root: string): DoneRecord[] {
  return listJson<DoneRecord>(root, 'done').map((j) => j.value);
}

export function writeJob(root: string, job: Job): void {
  writeJson(queuePath(root, 'jobs', `${job.id}.json`), job);
}

/** A waiting job moves to `running/`. */
export function startJob(root: string, job: Job, attempt: number, pid: number, now: Date): void {
  const record: RunningRecord = { job, pid, started: now.toISOString(), attempt };
  writeJson(queuePath(root, 'running', `${job.id}.json`), record);
  const waiting = queuePath(root, 'jobs', `${job.id}.json`);
  if (existsSync(waiting)) rmSync(waiting);
}

/** A job that could not run yet goes back to `jobs/` untouched. */
export function requeueJob(root: string, job: Job): void {
  writeJob(root, job);
  const running = queuePath(root, 'running', `${job.id}.json`);
  if (existsSync(running)) rmSync(running);
}

export function finishJob(root: string, record: DoneRecord): void {
  writeJson(queuePath(root, 'done', `${record.job.id}.json`), record);
  const running = queuePath(root, 'running', `${record.job.id}.json`);
  if (existsSync(running)) rmSync(running);
}

/** Entry names that already wait or run, so a second wave never cuts them again. */
export function queuedNames(root: string, pool: string): Set<string> {
  const names = new Set<string>();
  for (const job of [...waitingJobs(root), ...runningJobs(root).map((r) => r.job)]) {
    if (job.pool === pool) for (const name of job.entries) names.add(name);
  }
  return names;
}

/** Pids of other runners are not trusted past a restart: a process that is gone holds no lock. */
export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** Take the runner lock, or say who holds it. */
export function takeLock(root: string, pid: number): { ok: true } | { ok: false; holder: number } {
  const path = queuePath(root, 'run.lock');
  const held = readJson<{ pid: number }>(path);
  if (held !== null && held.pid !== pid && pidAlive(held.pid)) return { ok: false, holder: held.pid };
  writeJson(path, { pid });
  return { ok: true };
}

export function dropLock(root: string, pid: number): void {
  const path = queuePath(root, 'run.lock');
  if (readJson<{ pid: number }>(path)?.pid === pid) rmSync(path);
}

/** A job the last runner left in `running/` when it died goes back to `jobs/`; returns their ids. */
export function recoverRunning(root: string): string[] {
  const back: string[] = [];
  for (const { file, value } of listJson<RunningRecord>(root, 'running')) {
    if (pidAlive(value.pid)) continue;
    renameSync(queuePath(root, 'running', file), queuePath(root, 'jobs', file));
    writeJob(root, value.job);
    back.push(value.job.id);
  }
  return back;
}

export interface QueueSummary {
  state: QueueState;
  waiting: Job[];
  running: RunningRecord[];
  /** The last finished job, with the errors it ended on. */
  last: DoneRecord | null;
  finished: number;
}

export function queueSummary(root: string): QueueSummary {
  const done = doneRecords(root);
  const lastFile = listJson<DoneRecord>(root, 'done').sort((a, b) => (a.value.finished < b.value.finished ? -1 : 1)).at(-1)?.value ?? null;
  return { state: readState(root), waiting: waitingJobs(root), running: runningJobs(root), last: lastFile, finished: done.length };
}

/** The queue's lines for `art:status`: empty when nothing waits, runs, paused or stopped it and nothing finished. */
export function formatQueue(summary: QueueSummary): string {
  const { state, waiting, running, last, finished } = summary;
  if (state.status === 'idle' && waiting.length === 0 && running.length === 0 && finished === 0) return '';
  const lines = ['', `art queue: ${state.status}${state.reason === null ? '' : ` (${state.reason})`}`];
  lines.push(`  ${waiting.length} waiting, ${running.length} running, ${finished} finished`);
  for (const r of running) lines.push(`  running  ${r.job.id}  attempt ${r.attempt}  ${r.job.entries.join(', ')}`);
  for (const j of waiting) lines.push(`  waiting  ${j.id}  ~${j.estimate_minutes} min  ${j.entries.join(', ')}`);
  if (last !== null) {
    lines.push(`  last     ${last.job.id}: ${last.outcome}, ${last.drawn.length} of ${last.job.entries.length} drawn, ${last.gpu_minutes} GPU min`);
    for (const f of last.failed) lines.push(`           failed ${f.name}: ${f.error.replace(/\s+/gu, ' ').slice(0, 160)}`);
  }
  return `${lines.join('\n')}\n`;
}
