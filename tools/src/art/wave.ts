/**
 * `pnpm art:wave <pool> [--size N] [--dry] [--prompts]`: cut a wave from a pool and queue it
 * (docs/art/PRODUCTION_LINE.md section 2).
 *
 * A wave is cut by rank: entries nobody drew yet (missing) first, then entries the owner sent back to be drawn
 * again (a draft of theirs is `rework`), at most N of them (12 by default, decided 27.10). An entry that waits for an
 * open owner call (`blocked_by`) gets one round of stills and no more until the block lifts. The cast, and the
 * ground entries Codex writes as text (`grid`, `scatter`), are never cut: no picture route draws them.
 *
 * On the free route every entry goes up on `qwen` with one seed and on `flux` with two (DECISIONS 2026-10-23, side
 * by side), so a wave is three kernel runs: a kernel loads one model, and a seed is one setting of a run. Each is a
 * job in the queue (`queue.ts`) whose command spells the recipe and the seed, with `--no-picks`, so a pick of an
 * earlier round can never change what a job draws.
 *
 * `--dry` reads and prints; it writes nothing and touches no network. The plan it prints is the one that is queued.
 */
import { join } from 'node:path';

import { type KaggleRecipe, kagglePrompt } from '../kit/drawers.js';
import { type Draft } from './drafts.js';
import {
  type Job, type WaveKind, QUEUE_DIR, ROOT, doneRecords, ensureQueue, queuePath, queuedNames, writeJob, writeJson,
} from './queue.js';
import {
  type Evidence, type PoolEntry, type PoolName, type Status, POOLS, TRACKED_ONLY, byRank, draftsOf, entryStatus, gpuWeek, loadEvidence, readPool,
} from './status.js';

/** The recipes of a wave on the free route and how many seeds each draws (decided 23.10, kept 27.10). */
export const WAVE_RECIPES: readonly { recipe: KaggleRecipe; seeds: number }[] = [
  { recipe: 'qwen', seeds: 1 },
  { recipe: 'flux', seeds: 2 },
];

/** Entries in a wave (decided 27.10: under 30 GPU minutes a kernel, about one sitting of cards). */
export const DEFAULT_SIZE = 12;

/** Kaggle gives 30 GPU hours a week; the line spends at most 20, keeps 6 for re-draws, and leaves 4 for other GPU work (decided 27.10). */
export const BUDGET = { weekHours: 30, lineHours: 20, floorHours: 6, spareHours: 4 } as const;

/** The most a wave may bring the week to, in GPU minutes: a first draw stays under the line's 20 hours (the floor is for re-draws), a re-draw may use the floor too. */
export function capMinutes(kind: WaveKind): number {
  return (kind === 'new' ? BUDGET.lineHours : BUDGET.weekHours - BUDGET.spareHours) * 60;
}

/** GPU minutes of a kernel run of n pictures, from the 27.10 and 23.10 measurements: qwen 5 + 1.8 n, flux 6 + 0.4 n. Not measured for this wave. */
export function estimateMinutes(recipe: KaggleRecipe, n: number): number {
  return recipe === 'qwen' ? 5 + 1.8 * n : recipe === 'flux' ? 6 + 0.4 * n : 5 + 1.8 * n;
}

/** The first seed of a round; a round never reuses an earlier round's seeds. */
export function seedBase(round: number): number {
  return 7 + 3 * (round - 1);
}

export interface Candidate {
  entry: PoolEntry;
  kind: WaveKind;
  round: number;
  status: Status;
}

export interface Cut {
  candidates: Candidate[];
  /** Why entries were left out, by reason. */
  skipped: Map<string, string[]>;
}

/** The rounds a pool entry has been drawn in; a draft with no round counts as round 1. */
function lastRound(drafts: readonly Draft[]): number {
  return Math.max(1, ...drafts.map((d) => d.round ?? 1));
}

/**
 * The entries of a wave, in the order they are drawn. `queued` are the names already waiting in the queue.
 * Missing entries first in rank order, then the drafted entries sent back; at most `size`.
 */
export function cutWave(pool: PoolName, entries: readonly PoolEntry[], evidence: Evidence, size: number, queued: ReadonlySet<string>): Cut {
  const skipped = new Map<string, string[]>();
  const skip = (why: string, name: string): void => void skipped.set(why, [...(skipped.get(why) ?? []), name]);
  const ranked = entries.map((entry, index) => ({ entry, index, rank: entry.rank ?? null })).sort(byRank);
  const fresh: Candidate[] = [];
  const again: Candidate[] = [];
  for (const { entry } of ranked) {
    const status = entryStatus(entry, evidence, pool);
    if (entry.route === 'grid' || entry.route === 'scatter') skip('written as text by Codex, not drawn on the GPU', entry.name);
    else if (queued.has(entry.name)) skip('already in the queue', entry.name);
    else if (status === 'retired') skip('retired', entry.name);
    else if (status === 'imported' || status === 'picked') skip(`already ${status}`, entry.name);
    else if (status === 'missing') fresh.push({ entry, kind: 'new', round: 1, status });
    else {
      const drafts = draftsOf(entry, pool, evidence);
      if (entry.blocked_by !== undefined) skip('drafted, and held by an open owner call (one round of stills only)', entry.name);
      else if (!drafts.some((d) => d.review === 'rework')) skip('drafted, not sent back', entry.name);
      else again.push({ entry, kind: 'again', round: lastRound(drafts) + 1, status });
    }
  }
  return { candidates: [...fresh, ...again].slice(0, size), skipped };
}

export interface Meter {
  /** GPU minutes of the last seven days: the drafts index (each kernel run once) plus the runner's own records of runs that drafted nothing. */
  minutes: number;
  index_minutes: number;
  extra_minutes: number;
}

/** The weekly meter. The index is the source (a run counted once); a kernel that died before drafting a picture leaves no index line, so the runner's `done/` records add those. */
export function weeklyMeter(root: string, drafts: readonly Draft[], now: Date): Meter {
  const week = gpuWeek(drafts, now);
  const known = new Set(drafts.flatMap((d) => (d.run === null ? [] : [d.run.id])));
  const since = now.getTime() - 7 * 86_400_000;
  let extra = 0;
  for (const record of doneRecords(root)) {
    if (Date.parse(record.finished) < since) continue;
    for (const kernel of record.kernels) if (!known.has(kernel.id)) extra += kernel.seconds;
  }
  const extraMinutes = Math.round(extra / 6) / 10;
  return { minutes: Math.round((week.minutes + extraMinutes) * 10) / 10, index_minutes: week.minutes, extra_minutes: extraMinutes };
}

export interface WavePlan {
  id: string;
  pool: PoolName;
  size: number;
  candidates: Candidate[];
  skipped: Map<string, string[]>;
  jobs: Job[];
  estimate_minutes: number;
  meter: Meter;
  cap_minutes: number;
  fits: boolean;
}

/** `20261028T201530`: the wave's stamp in UTC. */
export function waveStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').slice(0, 15);
}

/** One job per kernel run: per round, qwen on one seed and flux on two. */
export function planJobs(id: string, pool: PoolName, candidates: readonly Candidate[], created: string): Job[] {
  const spec = `${QUEUE_DIR}/waves/${id}/spec.json`;
  const out = `${QUEUE_DIR}/waves/${id}`;
  const rounds = [...new Set(candidates.map((c) => c.round))].sort((a, b) => a - b);
  const jobs: Job[] = [];
  for (const round of rounds) {
    const these = candidates.filter((c) => c.round === round);
    const kind: WaveKind = these.every((c) => c.kind === 'new') ? 'new' : 'again';
    for (const { recipe, seeds } of WAVE_RECIPES) {
      for (let s = 0; s < seeds; s += 1) {
        const seed = seedBase(round) + (recipe === 'qwen' ? 0 : 1 + s);
        const n = jobs.length + 1;
        jobs.push({
          id: `${id}-${String(n).padStart(2, '0')}-${recipe}-s${seed}`, wave: id, pool, kind, round, recipe, seed,
          entries: these.map((c) => c.entry.name), spec, out,
          env: { KAGGLE_MODEL: recipe, KAGGLE_SEED: String(seed) },
          args: [spec, '--out', out, '--drawer', 'kaggle', '--no-picks'],
          estimate_minutes: Math.round(estimateMinutes(recipe, these.length) * 10) / 10, created,
        });
      }
    }
  }
  return jobs;
}

export function planWave(root: string, pool: PoolName, options: { size?: number; now?: Date } = {}): WavePlan {
  if (TRACKED_ONLY.includes(pool)) throw new Error(`the ${pool} pool is tracked only: the line never draws it (docs/art/PRODUCTION_LINE.md, out of scope)`);
  const size = options.size ?? DEFAULT_SIZE;
  const now = options.now ?? new Date();
  const evidence = loadEvidence(root);
  const cut = cutWave(pool, readPool(pool, root), evidence, size, queuedNames(root, pool));
  const id = `${pool}-${waveStamp(now)}`;
  const jobs = planJobs(id, pool, cut.candidates, now.toISOString());
  const meter = weeklyMeter(root, evidence.drafts, now);
  const estimate = Math.round(jobs.reduce((n, j) => n + j.estimate_minutes, 0) * 10) / 10;
  const cap = capMinutes(cut.candidates.every((c) => c.kind === 'new') ? 'new' : 'again');
  return { id, pool, size, candidates: cut.candidates, skipped: cut.skipped, jobs, estimate_minutes: estimate, meter, cap_minutes: cap, fits: meter.minutes + estimate <= cap };
}

const minutes = (n: number): string => `${Math.round(n * 10) / 10}`;

export function formatPlan(plan: WavePlan, options: { dry: boolean; prompts?: boolean }): string {
  const lines: string[] = [];
  lines.push(`art wave: ${plan.pool}, up to ${plan.size}${options.dry ? ', dry run (nothing written, no network)' : ''}`);
  if (plan.candidates.length === 0) lines.push('nothing to draw');
  else {
    lines.push(`entries (${plan.candidates.length}), missing first, then sent back, in rank order:`);
    const width = Math.max(...plan.candidates.map((c) => c.entry.name.length));
    plan.candidates.forEach((c, i) => {
      const e = c.entry;
      const held = e.blocked_by === undefined ? '' : `  held: ${e.blocked_by}`;
      lines.push(`  ${String(i + 1).padStart(2)}  ${e.name.padEnd(width)}  ${`${e.width}x${e.height}`.padEnd(7)}  ${(e.rank === undefined ? 'no row' : `row ${e.rank}`).padEnd(6)}  ${c.kind === 'new' ? 'new   ' : 'again '} round ${c.round}${held}`);
    });
  }
  if (plan.skipped.size > 0) {
    lines.push('left out:');
    for (const [why, names] of plan.skipped) lines.push(`  ${names.length} ${why}`);
  }
  if (plan.jobs.length > 0) {
    lines.push('', `kernels (${plan.jobs.length}), one at a time, each \`kit:gen --drawer kaggle --no-picks\` with the recipe and seed below in its environment:`);
    plan.jobs.forEach((j, i) => {
      const formula = j.recipe === 'qwen' ? `5 + 1.8 x ${j.entries.length}` : `6 + 0.4 x ${j.entries.length}`;
      lines.push(`  ${i + 1}  ${j.recipe.padEnd(4)}  seed ${String(j.seed).padEnd(3)}  ${String(j.entries.length).padStart(2)} pictures  ~${minutes(j.estimate_minutes)} min (${formula})`);
    });
    const pictures = plan.jobs.reduce((n, j) => n + j.entries.length, 0);
    lines.push(`  total ~${minutes(plan.estimate_minutes)} GPU min for ${pictures} pictures: an estimate from the measured rates of PRODUCTION_LINE.md section 2, not measured for this wave`);
    const m = plan.meter;
    const first = plan.cap_minutes === capMinutes('new');
    lines.push(`the week: ${minutes(m.minutes)} min used; cap ${plan.cap_minutes} min (${minutes(plan.cap_minutes / 60)} h: ${first ? 'a first draw stays under the line\'s 20 h, the 6 h floor is kept for re-draws' : 'a re-draw may use the floor, 4 h stay spare'}); ${minutes(plan.cap_minutes - m.minutes)} left; with this wave ${minutes(m.minutes + plan.estimate_minutes)}: ${plan.fits ? 'fits' : 'DOES NOT FIT'}`);
    lines.push(`  meter: ${minutes(m.index_minutes)} min from the drafts index (each kernel run once)${m.extra_minutes > 0 ? ` + ${minutes(m.extra_minutes)} min of runs that drew nothing, from the queue's records` : ''}`);
  }
  if (options.prompts === true && plan.candidates.length > 0) {
    const recipes = [...new Set(plan.jobs.map((j) => j.recipe))];
    const prompts = recipes.map((recipe) => ({ recipe, text: plan.candidates.map((c) => kagglePrompt(c.entry, recipe)) }));
    const same = prompts.every((p) => p.text.join('\n') === prompts[0]?.text.join('\n'));
    lines.push('', 'prompts the kernels will read:');
    for (const p of same ? prompts.slice(0, 1) : prompts) {
      lines.push(`  ${same ? recipes.join(' and ') : p.recipe}${same ? ' read the same sentences' : ''}:`);
      plan.candidates.forEach((c, i) => lines.push(`    ${c.entry.name}: ${p.text[i] ?? ''}`));
    }
  }
  return `${lines.join('\n')}\n`;
}

/** Write the wave's folder and one job file per kernel run. Nothing is run. */
export function enqueueWave(root: string, plan: WavePlan): void {
  ensureQueue(root);
  const folder = queuePath(root, 'waves', plan.id);
  writeJson(join(folder, 'spec.json'), { entries: plan.candidates.map((c) => c.entry) });
  writeJson(join(folder, 'wave.json'), {
    id: plan.id, pool: plan.pool, size: plan.size, created: plan.jobs[0]?.created ?? null, estimate_minutes: plan.estimate_minutes,
    entries: plan.candidates.map((c) => ({ name: c.entry.name, kit_id: c.entry.kit_id, kind: c.kind, round: c.round })),
    jobs: plan.jobs.map((j) => j.id),
  });
  for (const job of plan.jobs) writeJob(root, job);
}

/** `pnpm art:wave`: the text to print and the exit code. Throws on a bad argument. */
export function waveCli(args: readonly string[], root = ROOT, now = new Date()): { text: string; code: number } {
  const flags = new Set(['--dry', '--prompts']);
  const positional: string[] = [];
  let size: number | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i] ?? '';
    if (a === '--size') {
      size = Number(args[i + 1]);
      i += 1;
    } else if (a.startsWith('--') && !flags.has(a)) throw new Error(`Usage: art:wave <pool> [--size N] [--dry] [--prompts] (not: ${a})`);
    else if (!a.startsWith('--')) positional.push(a);
  }
  if (size !== undefined && (!Number.isInteger(size) || size < 1)) throw new Error('--size takes a whole number from 1');
  const [pool, ...extra] = positional;
  if (pool === undefined || extra.length > 0 || !(POOLS as readonly string[]).includes(pool)) throw new Error(`Usage: art:wave <${POOLS.join('|')}> [--size N] [--dry] [--prompts]`);
  const dry = args.includes('--dry');
  const plan = planWave(root, pool as PoolName, { ...(size === undefined ? {} : { size }), now });
  const text = formatPlan(plan, { dry, prompts: args.includes('--prompts') });
  if (dry || plan.candidates.length === 0) return { text, code: 0 };
  if (!plan.fits) return { text: `${text}not queued: the wave does not fit the week's GPU budget\n`, code: 1 };
  enqueueWave(root, plan);
  return { text: `${text}queued as ${plan.id}: ${plan.jobs.length} jobs in ${QUEUE_DIR}/jobs; run them with pnpm art:run\n`, code: 0 };
}
