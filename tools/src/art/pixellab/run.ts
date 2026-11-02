/**
 * Runs a PixelLab spec: plan every job without the network, show the estimate (`--dry-run`: the only live call is
 * /balance, and nothing is written), or spend: pick an account per job, post, poll, collect, and keep the pictures with
 * their prompt, seed and tool for the drafts store.
 *
 * The rules this file keeps (docs/art/DRAWERS.md, "The PixelLab route"):
 * - A generation is the owner's money. A job whose cost no one has measured runs alone and first, needs
 *   `--max-generations`, and its real cost goes to the ledger; the next estimate reads it. A response that charges USD
 *   stops the run.
 * - The ledger is a write-ahead log (ledger.ts). A job already submitted is collected, never posted again; a job whose
 *   post may have been charged is checked against the balance and reported, never retried blind.
 * - A job needing a character runs on the account that made it. Pictures cross accounts.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { AmbiguousSubmit, HttpError, PollTimeout, type Http, type ClientOptions } from './api.js';
import { cutSheet } from './cut.js';
import { Ledger, type Ids, type LedgerLine } from './ledger.js';
import { findImages, findUrls, numberField, shapeOf, stringField, type Json } from './payload.js';
import { Pool, type PoolAccount, type PoolConfig, type TokenReader } from './pool.js';
import {
  RECIPES, RECIPE_NAMES, gridVariants, parseRef, plan, pngSize, seedFor, type Base64Image, type Io, type JobSpec, type PlanContext, type Planned, type Recipe, type RecipeName, type Size, type Spec,
} from './recipes.js';
import { PNG } from 'pngjs';

/* ---- the spec ---- */

export function parseSpec(text: string, where = 'spec'): Spec {
  const raw = JSON.parse(text) as Partial<Spec>;
  if (typeof raw.name !== 'string' || !/^[A-Za-z0-9._-]+$/.test(raw.name)) throw new Error(`${where}: "name" is required (letters, digits, . - _)`);
  if (!Array.isArray(raw.jobs) || raw.jobs.length === 0) throw new Error(`${where}: "jobs" must list at least one job`);
  const seen = new Set<string>();
  for (const [i, job] of raw.jobs.entries()) {
    if (typeof job?.id !== 'string') throw new Error(`${where}: job ${i} has no "id"`);
    if (seen.has(job.id)) throw new Error(`${where}: two jobs are called "${job.id}"`);
    seen.add(job.id);
    if (!(RECIPE_NAMES as readonly string[]).includes(job.recipe)) throw new Error(`${where}: job "${job.id}" has recipe "${String(job.recipe)}"; the recipes are ${RECIPE_NAMES.join(', ')}`);
    if (job.inputs === undefined || typeof job.inputs !== 'object' || job.inputs === null) throw new Error(`${where}: job "${job.id}" has no "inputs"`);
  }
  return raw as Spec;
}

/** Jobs in an order where every job comes after the jobs it reads. */
export function orderJobs(jobs: readonly JobSpec[], depsOf: (job: JobSpec) => string[]): JobSpec[] {
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const out: JobSpec[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (job: JobSpec, chain: string[]): void => {
    const s = state.get(job.id);
    if (s === 'done') return;
    if (s === 'visiting') throw new Error(`the jobs read each other in a circle: ${[...chain, job.id].join(' -> ')}`);
    state.set(job.id, 'visiting');
    for (const dep of depsOf(job)) {
      const d = byId.get(dep);
      if (d !== undefined) visit(d, [...chain, job.id]);
    }
    state.set(job.id, 'done');
    out.push(job);
  };
  for (const job of jobs) visit(job, []);
  return out;
}

function canonical(value: unknown, base: string): Json {
  if (typeof value === 'string') {
    if (value.length < 260 && !value.startsWith('@') && !value.includes('\n')) {
      const path = resolve(base, value);
      if (existsSync(path) && statSync(path).isFile()) return `file:${createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16)}`;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => canonical(v, base));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, canonical(v, base)]));
  }
  return value as Json;
}

/** `<spec>/<job>#<hash>`: the hash covers the recipe, the inputs (a picture by its bytes), the seed, the pin and the keys of what the job reads. */
export function jobKey(specName: string, job: JobSpec, base: string, depKeys: readonly string[]): string {
  const hash = createHash('sha256')
    .update(JSON.stringify({ recipe: job.recipe, inputs: canonical(job.inputs, base), seed: job.seed ?? null, account: job.account ?? null, strong: job.allow_strong_init ?? false, deps: depKeys }))
    .digest('hex')
    .slice(0, 10);
  return `${specName}/${job.id}#${hash}`;
}

/* ---- the plan ---- */

export interface JobPlan extends Planned {
  key: string;
  /** Jobs this one reads. */
  deps: string[];
}

export interface SpecPlan {
  spec: Spec;
  base: string;
  out: string;
  jobs: JobPlan[];
  issues: string[];
}

export function planSpec(spec: Spec, specPath: string, ledger: Ledger, root: string): SpecPlan {
  const base = dirname(resolve(specPath));
  const ctx: PlanContext = { base, jobs: new Map(spec.jobs.map((j) => [j.id, j])), measured: (r) => ledger.measured(r) };
  const first = new Map(spec.jobs.map((j) => [j.id, plan(j, ctx)]));
  const issues: string[] = [];
  let ordered: JobSpec[];
  try {
    ordered = orderJobs(spec.jobs, (j) => (first.get(j.id) as Planned).refs.map((r) => r.job));
  } catch (error) {
    return { spec, base, out: resolve(root, spec.out ?? `.scratch/pixellab/${spec.name}`), jobs: [], issues: [(error as Error).message] };
  }
  const keys = new Map<string, string>();
  const jobs: JobPlan[] = ordered.map((job) => {
    const p = first.get(job.id) as Planned;
    const deps = [...new Set(p.refs.map((r) => r.job))];
    const key = jobKey(spec.name, job, base, deps.map((d) => keys.get(d) ?? d));
    keys.set(job.id, key);
    for (const i of p.issues) issues.push(`${job.id}: ${i}`);
    return { ...p, key, deps };
  });
  return { spec, base, out: resolve(root, spec.out ?? `.scratch/pixellab/${spec.name}`), jobs, issues };
}

/* ---- the dry run ---- */

/** What a job counts as when nothing says what it costs: one generation, shown with a `?`. */
export const ASSUMED_UNKNOWN = 1;

export interface DryRow {
  id: string;
  recipe: string;
  gens: number | null;
  assumed: number;
  basis: string;
  note: string;
  account: number | null;
  label: string;
  state: string;
}

export interface DryReport {
  rows: DryRow[];
  perAccount: { index: number; label: string; left: number; usd: number; known: number; unknownJobs: number }[];
  known: number;
  unknownJobs: number;
  short: string[];
}

export function dryReport(p: SpecPlan, pool: Pool, ledger: Ledger): DryReport {
  const rows: DryRow[] = [];
  const pinned = new Map<string, number>();
  const per = new Map(pool.accounts.map((a) => [a.index, { index: a.index, label: a.label, left: a.left, usd: a.usd, known: 0, unknownJobs: 0 }]));
  const short: string[] = [];
  const left = new Map(pool.accounts.map((a) => [a.index, a.left]));
  let known = 0;
  let unknownJobs = 0;
  for (const j of p.jobs) {
    const gens = j.cost.gens;
    const state = ledger.state(j.key);
    const finished = state?.phase === 'done';
    const resume = state?.phase === 'submitted';
    const cost = finished ? 0 : (gens ?? ASSUMED_UNKNOWN);
    let pin: number | null = j.job.account ?? null;
    if (pin === null && j.characterOf !== null) pin = pinned.get(j.characterOf) ?? null;
    if (pin === null && resume) pin = state?.account ?? null;
    const extra = j.job.recipe === 'character' && !finished
      ? p.jobs.filter((d) => d.characterOf === j.job.id && ledger.state(d.key)?.phase !== 'done').reduce((n, d) => n + (d.cost.gens ?? ASSUMED_UNKNOWN), 0)
      : 0;
    const candidates = pool.accounts.filter((a) => a.dead === null && (pin === null || a.index === pin) && (left.get(a.index) ?? 0) >= cost + extra);
    candidates.sort((a, b) => (left.get(a.index) ?? 0) - (left.get(b.index) ?? 0) || a.index - b.index);
    const chosen = candidates[0];
    if (chosen !== undefined && !finished) {
      left.set(chosen.index, (left.get(chosen.index) ?? 0) - cost);
      const t = per.get(chosen.index);
      if (t !== undefined) {
        if (gens === null) t.unknownJobs += 1;
        else t.known += gens;
      }
      pinned.set(j.job.id, chosen.index);
    } else if (!finished) short.push(`${j.job.id} needs ${gens ?? '?'} generations${extra > 0 ? ` and ${extra} more for the jobs that use its character` : ''}${pin === null ? '' : ` on account ${pin}`}: ${pool.accounts.length === 0 ? 'no account is available' : 'no account has room'}`);
    if (!finished) {
      if (gens === null) unknownJobs += 1;
      else known += gens;
    }
    rows.push({
      id: j.job.id,
      recipe: j.job.recipe,
      gens,
      assumed: cost,
      basis: j.cost.basis,
      note: j.cost.note,
      account: finished ? (state?.account ?? null) : (chosen?.index ?? null),
      label: finished ? (state?.last.label ?? '') : (chosen?.label ?? ''),
      state: finished ? 'done in the ledger, skipped' : resume ? 'submitted, would be collected without a new post' : state?.phase === 'started' ? 'started, would be checked against the balance first' : 'new',
    });
  }
  return { rows, perAccount: [...per.values()], known, unknownJobs, short };
}

export function dryText(p: SpecPlan, r: DryReport): string {
  const lines = [`pixellab dry run: ${p.spec.name}, ${p.jobs.length} jobs, output ${p.out}`];
  for (const row of r.rows) {
    const cost = row.gens === null ? '?' : String(row.gens);
    lines.push(`  ${row.id.padEnd(22)} ${row.recipe.padEnd(10)} ${cost.padStart(2)} gen  ${row.account === null ? 'no account' : `account ${row.account} (${row.label})`}  [${row.basis}] ${row.state === 'new' ? '' : row.state}`);
    lines.push(`      ${row.note}`);
  }
  lines.push('per account:');
  for (const a of r.perAccount) lines.push(`  ${a.index} ${a.label.padEnd(10)} holds ${String(a.left).padStart(4)} generations${a.usd > 0 ? ` and ${a.usd} USD of credit (never spent here)` : ''}; this spec would use ${a.known}${a.unknownJobs > 0 ? ` and ${a.unknownJobs} job${a.unknownJobs === 1 ? '' : 's'} of unknown cost` : ''}`);
  lines.push(r.unknownJobs === 0 ? `total: ${r.known} generations` : `total: ${r.known} generations measured or published, plus ${r.unknownJobs} job${r.unknownJobs === 1 ? '' : 's'} of unknown cost (?): at least ${r.known + r.unknownJobs}, no upper limit until the first real call. A live run needs --max-generations.`);
  for (const s of r.short) lines.push(`SHORT: ${s}`);
  for (const i of p.issues) lines.push(`SPEC: ${i}`);
  for (const j of p.jobs) for (const w of j.warnings) lines.push(`warning: ${j.job.id}: ${w}`);
  return `${lines.join('\n')}\n`;
}

/* ---- running ---- */

export type PushFn = (folder: string, label: string, provenance: string) => void;

export interface RunDeps {
  http: Http;
  config: PoolConfig;
  readToken: TokenReader;
  ledgerPath: string;
  /** The repository root: relative output folders are under it. */
  root: string;
  push: PushFn;
  say: (text: string) => void;
  clock?: () => Date;
  client?: ClientOptions;
}

export interface RunOptions {
  dryRun: boolean;
  push: boolean;
  maxGenerations: number | null;
  only: string[] | null;
  /** Run again a job that failed after it was charged (it will be charged again). */
  retryPaidFailures: boolean;
}

export interface JobOutcome {
  id: string;
  status: 'done' | 'skipped' | 'resumed' | 'failed' | 'blocked' | 'planned';
  message: string | null;
  account: number | null;
  spent: number | null;
  files: string[];
}

export interface RunReport {
  outcomes: JobOutcome[];
  spent: number;
  issues: string[];
  aborted: string | null;
  ok: boolean;
}

interface Output {
  /** Absolute paths, in the order `@job#n` counts. */
  files: string[];
  characterId: string | null;
  account: number;
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function scalars(body: Record<string, Json>): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === 'description' || k === 'action' || k === 'action_description') continue;
    if (v !== null && typeof v === 'object') {
      const o = v as Record<string, Json>;
      if (!Array.isArray(v) && ('base64' in o || 'image' in o)) out[k] = '(input picture)';
      else if (Array.isArray(v) && v.some((x) => x !== null && typeof x === 'object' && ('base64' in (x as object) || 'image' in (x as object)))) out[k] = '(input pictures)';
      else if (!Array.isArray(v) && Object.values(o).every((x) => typeof x === 'number')) out[k] = v;
      else if (Array.isArray(v) && v.every((x) => typeof x === 'string')) out[k] = v;
      continue;
    }
    if (typeof v === 'string' && v.length > 60) continue;
    out[k] = v;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** The `tool` string the drafts index keeps for a PixelLab picture, in the trial's shape. */
export function toolString(recipe: Recipe, body: Record<string, Json>): string {
  return `pixellab ${recipe.path} ${JSON.stringify(scalars(body))}`;
}

function promptOf(body: Record<string, Json>, fallback: string): string {
  for (const k of ['description', 'action', 'action_description']) if (typeof body[k] === 'string') return body[k] as string;
  return fallback;
}

export async function runSpec(specPath: string, deps: RunDeps, opts: RunOptions): Promise<RunReport> {
  const { say, http } = deps;
  const spec = parseSpec(readFileSync(specPath, 'utf8'), specPath);
  const ledger = new Ledger(deps.ledgerPath, deps.clock);
  const sp = planSpec(spec, specPath, ledger, deps.root);
  const only = opts.only === null ? null : new Set(opts.only);
  if (only !== null) {
    for (const id of only) if (!sp.jobs.some((j) => j.job.id === id)) sp.issues.push(`--only: no job "${id}"`);
  }
  const selected = only === null ? sp.jobs : sp.jobs.filter((j) => only.has(j.job.id));
  const pool = await Pool.open(deps.config, deps.readToken, http, deps.client, say);

  if (opts.dryRun) {
    const report = dryReport({ ...sp, jobs: selected }, pool, ledger);
    say(dryText({ ...sp, jobs: selected }, report).trimEnd());
    const blocked = sp.issues.length > 0 || report.short.length > 0;
    return { outcomes: selected.map((j) => ({ id: j.job.id, status: 'planned' as const, message: null, account: report.rows.find((r) => r.id === j.job.id)?.account ?? null, spent: null, files: [] })), spent: 0, issues: sp.issues, aborted: null, ok: !blocked };
  }

  if (sp.issues.length > 0) {
    for (const i of sp.issues) say(`SPEC: ${i}`);
    return { outcomes: [], spent: 0, issues: sp.issues, aborted: null, ok: false };
  }
  const guard = liveGuard(selected, ledger, opts);
  if (guard !== null) {
    say(guard);
    return { outcomes: [], spent: 0, issues: [guard], aborted: null, ok: false };
  }
  return new Executor(sp, selected, pool, ledger, deps, opts).run();
}

/** Refuses a live run that could spend without a limit. */
export function liveGuard(jobs: readonly JobPlan[], ledger: Ledger, opts: RunOptions): string | null {
  const fresh = jobs.filter((j) => ledger.state(j.key)?.phase !== 'done');
  const unknown = fresh.filter((j) => j.cost.gens === null);
  if (unknown.length > 0 && opts.maxGenerations === null) {
    return `${unknown.length} job${unknown.length === 1 ? '' : 's'} (${unknown.map((j) => j.job.id).join(', ')}) ha${unknown.length === 1 ? 's' : 've'} no measured cost. Run with --max-generations N so a call that costs more than thought cannot run on; the first real call writes its cost to the ledger.`;
  }
  if (opts.maxGenerations !== null) {
    const estimate = fresh.reduce((n, j) => n + (j.cost.gens ?? ASSUMED_UNKNOWN), 0);
    if (estimate > opts.maxGenerations) return `the estimate is ${estimate} generations (unknown jobs counted at ${ASSUMED_UNKNOWN}), over --max-generations ${opts.maxGenerations}.`;
  }
  return null;
}

class Executor {
  private readonly outputs = new Map<string, Output>();
  private readonly status = new Map<string, JobOutcome>();
  private readonly running = new Map<string, Promise<void>>();
  private readonly overlap = new Set<string>();
  private readonly byAccount = new Map<string, number>();
  private spent = 0;
  private committed = 0;
  private fatal: string | null = null;
  private exclusive = false;
  private readonly firstShape = new Set<RecipeName>();

  constructor(
    private readonly sp: SpecPlan,
    private readonly jobs: readonly JobPlan[],
    private readonly pool: Pool,
    private readonly ledger: Ledger,
    private readonly deps: RunDeps,
    private readonly opts: RunOptions,
  ) {
    for (const l of ledger.lines) if (l.shape !== undefined) this.firstShape.add(l.recipe as RecipeName);
    // a job run on its own (--only) reads the pictures its inputs already made
    const chosen = new Set(jobs.map((j) => j.job.id));
    for (const j of jobs) {
      for (const dep of j.deps) {
        if (chosen.has(dep) || this.outputs.has(dep)) continue;
        const d = sp.jobs.find((x) => x.job.id === dep);
        const state = d === undefined ? null : ledger.state(d.key);
        if (state?.phase === 'done' && state.files.every((f) => existsSync(resolve(sp.out, f)))) {
          this.outputs.set(dep, { files: state.files.map((f) => resolve(sp.out, f)), characterId: state.ids.character_id ?? null, account: state.account });
        }
      }
    }
  }

  private get say(): (t: string) => void {
    return this.deps.say;
  }

  async run(): Promise<RunReport> {
    const pending = new Set(this.jobs.map((j) => j.job.id));
    const byId = new Map(this.sp.jobs.map((j) => [j.job.id, j]));
    for (;;) {
      let started = false;
      // jobs nobody has measured go first, one at a time; the rest in the spec's order
      const unknownFirst = (j: JobPlan): number => (this.costNow(j) === null ? 0 : 1);
      const ready = [...pending].map((id) => byId.get(id) as JobPlan).filter((j) => this.depsDone(j, pending)).sort((a, b) => unknownFirst(a) - unknownFirst(b));
      for (const j of ready) {
        const missing = this.missingInput(j);
        if (missing !== null) {
          pending.delete(j.job.id);
          this.mark(j, 'blocked', `reads "${missing}", which has not been run (run it first, or leave out --only)`);
          started = true;
          continue;
        }
        const broken = j.deps.find((d) => {
          const s = this.status.get(d);
          return s !== undefined && (s.status === 'failed' || s.status === 'blocked');
        });
        if (broken !== undefined) {
          pending.delete(j.job.id);
          this.mark(j, 'blocked', `waits on "${broken}", which did not finish`);
          started = true;
          continue;
        }
        if (this.fatal !== null) {
          pending.delete(j.job.id);
          this.mark(j, 'blocked', `run stopped: ${this.fatal}`);
          started = true;
          continue;
        }
        const verdict = this.admit(j);
        if (verdict === 'wait') continue;
        pending.delete(j.job.id);
        started = true;
        if (verdict !== 'started') this.mark(j, 'blocked', verdict);
      }
      if (this.running.size === 0) {
        if (!started && pending.size === 0) break;
        if (!started) {
          // nothing runs, nothing could start: whatever is left waits on a job that is not coming
          for (const id of pending) this.mark(byId.get(id) as JobPlan, 'blocked', 'nothing could start it');
          pending.clear();
          break;
        }
        continue;
      }
      await Promise.race(this.running.values());
    }
    return this.finish();
  }

  private depsDone(j: JobPlan, pending: Set<string>): boolean {
    return j.deps.every((d) => !pending.has(d) && !this.running.has(d));
  }

  /** A dependency outside the chosen jobs that has not been run: the job cannot read what is not there. */
  private missingInput(j: JobPlan): string | null {
    return j.deps.find((d) => !this.outputs.has(d) && !this.status.has(d) && !this.jobs.some((x) => x.job.id === d)) ?? null;
  }

  private costNow(j: JobPlan): number | null {
    return j.cost.gens ?? this.ledger.measured(j.job.recipe);
  }

  private mark(j: JobPlan, status: JobOutcome['status'], message: string | null, extra: Partial<JobOutcome> = {}): void {
    this.status.set(j.job.id, { id: j.job.id, status, message, account: null, spent: null, files: [], ...extra });
    if (status === 'blocked') this.say(`blocked ${j.job.id}: ${message ?? ''}`);
  }

  /** Starts the job if an account has room and a slot, says to wait, or says why it never can. */
  private admit(j: JobPlan): 'started' | 'wait' | string {
    const state = this.ledger.state(j.key);
    if (state?.phase === 'done' && state.files.every((f) => existsSync(resolve(this.sp.out, f)))) {
      const char = state.ids.character_id ?? null;
      this.outputs.set(j.job.id, { files: state.files.map((f) => resolve(this.sp.out, f)), characterId: char, account: state.account });
      this.mark(j, 'skipped', 'done in the ledger', { account: state.account, files: state.files });
      return 'started';
    }
    const cost = this.costNow(j);
    const unknown = cost === null;
    const reserve = cost ?? ASSUMED_UNKNOWN;
    if (this.exclusive || (unknown && this.running.size > 0)) return 'wait';
    if (this.opts.maxGenerations !== null && this.spent + this.committed + reserve > this.opts.maxGenerations) return `over --max-generations ${this.opts.maxGenerations} (${this.spent} spent, ${this.committed} in flight, ${reserve} wanted)`;
    if (state?.phase === 'failed' && (state.last.spent ?? 0) > 0 && !this.opts.retryPaidFailures) return `failed after it was charged (${state.last.spent} generations); --retry-paid to pay again`;

    const resuming = state?.phase === 'submitted' || state?.phase === 'started' || state?.phase === 'ambiguous';
    const pin = this.pinOf(j) ?? (resuming ? (state?.account ?? null) : null);
    // a character's account must also have room for the jobs that use the character, or they are stranded after it is paid for
    const extra = j.job.recipe === 'character' ? this.dependentsCost(j) : 0;
    const choice = this.pool.choose(resuming && state?.phase === 'submitted' ? 0 : reserve + extra, pin);
    if (!choice.ok) {
      if (choice.reason === 'busy') return 'wait';
      const need = `${reserve + extra} generation${reserve + extra === 1 ? '' : 's'}${extra > 0 ? ` (${reserve} for the character and ${extra} for the jobs that use it)` : ''}`;
      return pin === null ? `no account holds ${need} (the most any holds is ${choice.best})` : `account ${pin} holds ${choice.pinned ?? 0}, the job needs ${need}`;
    }
    const account = choice.account;
    if (account.busy > 0) {
      for (const id of this.running.keys()) if (this.byAccount.get(id) === account.index) this.overlap.add(id);
      this.overlap.add(j.job.id);
    }
    // a job already submitted is paid for: it holds a slot and no generations
    const held = state?.phase === 'submitted' ? 0 : reserve;
    this.pool.admit(account, held);
    this.committed += reserve;
    this.byAccount.set(j.job.id, account.index);
    if (unknown) this.exclusive = true;
    const task = this.execute(j, account, state, held, reserve).finally(() => {
      this.running.delete(j.job.id);
      this.byAccount.delete(j.job.id);
      if (unknown) this.exclusive = false;
    });
    this.running.set(j.job.id, task);
    return 'started';
  }

  /** What the jobs that read this character's id will cost, the ones the ledger has not finished. */
  private dependentsCost(j: JobPlan): number {
    return this.sp.jobs.filter((d) => d.characterOf === j.job.id && this.ledger.state(d.key)?.phase !== 'done').reduce((n, d) => n + (this.costNow(d) ?? ASSUMED_UNKNOWN), 0);
  }

  private pinOf(j: JobPlan): number | null {
    if (j.job.account !== undefined) return j.job.account;
    if (j.characterOf !== null) return this.outputs.get(j.characterOf)?.account ?? null;
    return null;
  }

  private finish(): RunReport {
    const outcomes = this.jobs.map((j) => this.status.get(j.job.id) ?? { id: j.job.id, status: 'blocked' as const, message: 'never started', account: null, spent: null, files: [] });
    if (this.opts.push && this.fatal === null) this.pushDrafts(outcomes);
    const ok = outcomes.every((o) => o.status === 'done' || o.status === 'skipped' || o.status === 'resumed') && this.fatal === null;
    this.say(`${ok ? 'done' : 'stopped'}: ${outcomes.filter((o) => o.status === 'done' || o.status === 'resumed').length} jobs run, ${outcomes.filter((o) => o.status === 'skipped').length} skipped, ${outcomes.filter((o) => o.status === 'failed' || o.status === 'blocked').length} not finished; ${this.spent} generations spent`);
    return { outcomes, spent: this.spent, issues: [], aborted: this.fatal, ok };
  }

  private pushDrafts(outcomes: JobOutcome[]): void {
    const label = this.sp.spec.label ?? `pixellab-${this.sp.spec.name}`;
    const provenance = this.sp.spec.provenance ?? `PixelLab route, spec ${this.sp.spec.name}`;
    for (const o of outcomes) {
      if (o.status !== 'done' && o.status !== 'resumed' && o.status !== 'skipped') continue;
      if (o.files.length === 0) continue;
      try {
        this.deps.push(join(this.sp.out, o.id), label, provenance);
      } catch (error) {
        this.say(`drafts push of ${o.id} failed (${(error as Error).message.slice(0, 160)}); run it again, the files are on disk`);
      }
    }
  }

  /* ---- one job ---- */

  private io(seed: number): Io {
    const read = (value: unknown): Buffer => {
      const ref = parseRef(value);
      if (ref !== null) {
        const out = this.outputs.get(ref.job);
        const file = out?.files[ref.index === 'all' ? 0 : ref.index];
        if (file === undefined) throw new Error(`@${ref.job}: the job has no picture #${ref.index === 'all' ? 0 : ref.index}`);
        return readFileSync(file);
      }
      return readFileSync(resolve(this.sp.base, String(value)));
    };
    const b64 = (buf: Buffer): Base64Image => ({ type: 'base64', base64: buf.toString('base64'), format: 'png' });
    return {
      seed,
      image: (v) => b64(read(v)),
      images: (v) => {
        const list = Array.isArray(v) ? v : [v];
        return list.flatMap((item) => {
          const ref = parseRef(item);
          if (ref !== null && ref.index === 'all') return (this.outputs.get(ref.job)?.files ?? []).map((f) => b64(readFileSync(f)));
          return [b64(read(item))];
        });
      },
      size: (v) => {
        const size = pngSize(read(Array.isArray(v) ? v[0] : v));
        if (size === null) throw new Error('a picture the job reads is not a PNG');
        return size;
      },
      character: (v) => {
        const ref = parseRef(v);
        if (ref === null) return String(v);
        const id = this.outputs.get(ref.job)?.characterId ?? null;
        if (id === null) throw new Error(`@${ref.job} has no character id`);
        return id;
      },
    };
  }

  private async execute(j: JobPlan, account: PoolAccount, state: ReturnType<Ledger['state']>, held: number, reserve: number): Promise<void> {
    const t0 = this.deps.http.now();
    const recipe = RECIPES[j.job.recipe];
    const dir = join(this.sp.out, j.job.id);
    const rel = (p: string): string => relative(this.sp.out, p);
    let charged: number | null = null;
    let readBefore: number | null = state?.before ?? null;
    // set once the server has taken the job: from then on it is paid for, and a failure leaves it to be collected, not posted again
    let submitted = state?.phase === 'submitted';
    const line = (phase: LedgerLine['phase'], extra: Partial<LedgerLine> = {}): LedgerLine => this.ledger.append({
      key: j.key, spec: this.sp.spec.name, job: j.job.id, recipe: j.job.recipe, phase, account: account.index, label: account.label, estimate: j.cost.gens, ...extra,
    });
    try {
      mkdirSync(dir, { recursive: true });
      const seed = j.job.seed ?? seedFor(j.key);
      const body = recipe.body(j.job, this.io(seed)) as Record<string, Json>;
      let ids: Ids = state?.ids ?? {};
      let resumed = false;
      let before: number | null = state?.before ?? null;

      if (state?.phase === 'submitted') {
        resumed = true;
        this.say(`${j.job.id}: submitted before; collecting from account ${account.index}, no new post`);
      } else {
        const balance = await account.client.balance();
        if (state?.phase === 'started' || state?.phase === 'ambiguous') {
          // an earlier run posted and did not hear back: if the account lost generations since, it was charged
          if (before !== null && balance.generations < before) {
            line('ambiguous', { before, after: balance.generations, spent: before - balance.generations, exact: false, result: 'unknown', error: 'an earlier post may have been charged; not posted again' });
            throw new Stop(`an earlier post of this job may have been charged (account ${account.index} went from ${before} to ${balance.generations}); look at its /characters and the dashboard before posting again`, 'failed');
          }
        }
        before = balance.generations;
        readBefore = before;
        line('started', { before });
        const posted = await this.post(account, recipe.path, body, before, line);
        const usd = usdCharged(posted.json);
        if (usd !== null) this.fatal = `a response charged ${usd} USD (job ${j.job.id}, account ${account.index}): this route spends generations only`;
        ids = idsOf(posted.json);
        if (recipe.flow === 'sync') {
          const images = findImages(posted.json);
          if (images.length === 0) throw new Stop('the answer held no picture', 'failed');
          const files = this.save(dir, j, recipe, body, seed, images.map((b) => Buffer.from(b, 'base64')));
          await this.settle(j, account, line, { before, files: files.map(rel), ids, usage: usageOf(posted.json), shape: this.shape(j, posted.json), started: t0, resumed: false, reserve });
          charged = this.lastCharged;
          this.outputs.set(j.job.id, { files, characterId: null, account: account.index });
          this.mark(j, 'done', null, { account: account.index, spent: charged, files: files.map(rel) });
          return;
        }
        line('submitted', { ids, usage: usageOf(posted.json), shape: this.shape(j, posted.json), before });
        submitted = true;
        const quoted = numberField(posted.json, 'quoted_generations');
        if (quoted !== null && j.cost.gens !== null && quoted !== j.cost.gens) this.say(`${j.job.id}: the API quotes ${quoted} generations, the table says ${j.cost.gens}`);
      }

      const files = await this.collect(j, recipe, account, ids, dir, body, seed);
      await this.settle(j, account, line, { before, files: files.map(rel), ids, usage: null, shape: undefined, started: t0, resumed, reserve });
      charged = this.lastCharged;
      this.outputs.set(j.job.id, { files, characterId: ids.character_id ?? null, account: account.index });
      this.mark(j, resumed ? 'resumed' : 'done', null, { account: account.index, spent: charged, files: files.map(rel) });
    } catch (error) {
      const stop = error instanceof Stop;
      const message = error instanceof Error ? error.message : String(error);
      // a job the server failed is over; any other trouble after the post (a timeout, a lost download, a shape not understood) is collected again on the next run
      const pollOut = error instanceof PollTimeout || (submitted && !(stop && (error as Stop).kind === 'job-failed'));
      if (!stop || (error as Stop).record) {
        // a job that failed after it was charged is told apart from one that was not: the balance says which
        const after = pollOut ? null : await this.balanceAfter(account);
        const lost = readBefore !== null && after !== null ? readBefore - after : null;
        if (lost !== null) charged = lost;
        line(pollOut ? 'submitted' : 'failed', {
          result: pollOut ? 'unknown' : 'failed', error: message.slice(0, 300), seconds: Math.round((this.deps.http.now() - t0) / 100) / 10,
          ...(readBefore === null ? {} : { before: readBefore }), ...(after === null ? {} : { after }), ...(lost === null ? {} : { spent: lost }),
        });
      }
      this.mark(j, 'failed', message.slice(0, 300), { account: account.index });
      this.say(`failed ${j.job.id}: ${message.slice(0, 300)}`);
    } finally {
      this.committed -= reserve;
      this.pool.release(account, held, charged);
      if (charged !== null) this.spent += charged;
    }
  }

  private lastCharged: number | null = null;

  private async balanceAfter(account: PoolAccount): Promise<number | null> {
    return account.client.balance().then((b) => b.generations, () => null);
  }

  /** Reads the balance after, writes the `done` line with what the job cost. */
  private async settle(
    j: JobPlan, account: PoolAccount, line: (p: LedgerLine['phase'], e?: Partial<LedgerLine>) => LedgerLine,
    d: { before: number | null; files: string[]; ids: Ids; usage: unknown; shape: string[] | undefined; started: number; resumed: boolean; reserve: number },
  ): Promise<void> {
    await this.deps.http.sleep(3_000);
    const after = await this.balanceAfter(account);
    // a resumed job's "before" is from an earlier run: whatever happened to the account since (a top-up, other jobs) is not its cost
    const exact = !d.resumed && !this.overlap.has(j.job.id);
    const spent = d.before !== null && after !== null ? d.before - after : null;
    this.lastCharged = d.resumed ? null : spent;
    const seconds = Math.round((this.deps.http.now() - d.started) / 100) / 10;
    line('done', {
      ...(d.before === null ? {} : { before: d.before }), ...(after === null ? {} : { after }), spent: exact ? spent : null, exact, usage: d.usage, seconds, ids: d.ids, files: d.files, result: d.resumed ? 'resumed' : 'ok',
      ...(d.shape === undefined ? {} : { shape: d.shape }),
    });
    if (!exact && spent !== null) this.say(`${j.job.id}: the account's balance fell by ${spent} while other jobs ran on it; the ledger keeps the shared difference out of its measurements`);
    this.say(`${j.job.id}: ${d.files.length} file${d.files.length === 1 ? '' : 's'}, ${seconds} s, ${spent === null ? 'cost not readable' : `${spent} generation${spent === 1 ? '' : 's'}`} (account ${account.index})`);
  }

  private shape(j: JobPlan, payload: unknown): string[] | undefined {
    if (this.firstShape.has(j.job.recipe)) return undefined;
    this.firstShape.add(j.job.recipe);
    return shapeOf(payload);
  }

  /** A post. A network drop or a 5xx leaves it unknown: the balance says whether it was charged, and only an uncharged one is tried again. */
  private async post(account: PoolAccount, path: string, body: Record<string, Json>, before: number, line: (p: LedgerLine['phase'], e?: Partial<LedgerLine>) => LedgerLine): Promise<{ json: unknown }> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await account.client.post(path, body);
      } catch (error) {
        if (error instanceof AmbiguousSubmit) {
          const now = (await account.client.balance().catch(() => null))?.generations ?? null;
          if (now !== null && now >= before && attempt < 2) {
            await this.deps.http.sleep(5_000 * (attempt + 1));
            continue;
          }
          line('ambiguous', { before, ...(now === null ? {} : { after: now }), result: 'unknown', error: error.message.slice(0, 300) });
          throw new Stop(now === null ? `${error.message}; the balance could not be read to tell whether it was charged` : `${error.message}; the account went from ${before} to ${now}`, 'failed', false);
        }
        if (error instanceof HttpError) throw new Stop(error.message, 'failed');
        throw error;
      }
    }
  }

  private save(dir: string, j: JobPlan, recipe: Recipe, body: Record<string, Json>, seed: number, buffers: Buffer[], names?: string[]): string[] {
    const sidecar = { prompt: promptOf(body, j.job.id), tool: toolString(recipe, body), date: (this.deps.clock?.() ?? new Date()).toISOString().slice(0, 10), seed };
    const out: string[] = [];
    let pieces = buffers;
    const variants = j.job.recipe === 'grid' ? gridVariants(Math.max(...Object.values((body['image_size'] as unknown as Size)))) : 1;
    // a Pro grid that came back as one sheet is cut into its pieces (the trial's cut.py); a fill is cut when the job says so
    const cutIt = (j.job.recipe === 'grid' && buffers.length === 1 && variants > 1) || (j.job.recipe === 'fill' && j.job.inputs['cut'] === true);
    if (cutIt) {
      const sheetPath = join(dir, `${j.job.id}-sheet.png`);
      writeFileSync(sheetPath, buffers[0] as Buffer);
      writeFileSync(sheetPath.replace(/\.png$/, '.json'), JSON.stringify({ ...sidecar, prompt: `${sidecar.prompt} (the whole sheet)` }));
      pieces = cutSheet(PNG.sync.read(buffers[0] as Buffer)).map((p) => PNG.sync.write(p));
      if (j.job.recipe === 'grid' && pieces.length !== variants) this.say(`${j.job.id}: cut ${pieces.length} pieces from the sheet, the API's table says ${variants} at this size`);
    } else if (j.job.recipe === 'grid' && buffers.length !== variants) {
      this.say(`${j.job.id}: ${buffers.length} pictures came back, the API's table says ${variants} at this size`);
    }
    pieces.forEach((buf, n) => {
      if (buf.subarray(0, 4).compare(PNG_MAGIC) !== 0) throw new Stop('a picture in the answer is not a PNG', 'failed');
      const stem = names?.[n] ?? `${j.job.id}${pieces.length === 1 ? '' : `-${String(n).padStart(2, '0')}`}`;
      const path = join(dir, `${stem}.png`);
      writeFileSync(path, buf);
      writeFileSync(path.replace(/\.png$/, '.json'), JSON.stringify(sidecar));
      out.push(path);
    });
    return out;
  }

  /** Waits for a submitted job and takes its pictures; the same path serves a fresh job and a resumed one. */
  private async collect(j: JobPlan, recipe: Recipe, account: PoolAccount, ids: Ids, dir: string, body: Record<string, Json>, seed: number): Promise<string[]> {
    const client = account.client;
    const jobIds = ids.background_job_ids ?? [];
    if (jobIds.length === 0) throw new Stop('the answer carried no job id', 'failed');
    const results = [];
    for (const id of jobIds) {
      const result = await client.waitJob(id);
      if (result.status === 'failed') throw new Stop(`the job failed: ${JSON.stringify(result.lastResponse).slice(0, 200)}`, 'job-failed');
      const usd = usdCharged(result.raw);
      if (usd !== null) this.fatal = `a response charged ${usd} USD (job ${j.job.id}, account ${account.index})`;
      results.push(result);
    }
    // what the server said is kept before anything is parsed or downloaded, so a lost download is collected again, not paid again
    writeFileSync(join(dir, 'answer.json'), JSON.stringify({ ids, results: results.map((r) => elide(r.raw)) }, null, 2));

    if (recipe.flow === 'job') {
      const result = results[0];
      const found = findImages(result?.lastResponse);
      const links = found.length > 0 ? [] : findUrls(result?.lastResponse);
      const buffers: Buffer[] = found.map((b) => Buffer.from(b, 'base64'));
      const names: string[] = [];
      for (const link of links) {
        if (!/\.png(\?.*)?$/i.test(link.url) && !/\.png$/i.test(link.path)) continue;
        buffers.push(await client.download(link.url));
        names.push(`${j.job.id}-${(new URL(link.url).pathname.split('/').pop() ?? String(names.length)).replace(/\.png$/i, '')}`);
      }
      if (buffers.length === 0) throw new Stop('the finished job held no picture', 'failed');
      return this.save(dir, j, recipe, body, seed, buffers, links.length > 0 && found.length === 0 ? uniqueNames(names, j.job.id) : undefined);
    }

    const characterId = ids.character_id ?? stringField(body, 'character_id');
    if (characterId === null) throw new Stop('no character id to collect from', 'failed');
    const character = await client.character(characterId);
    if (recipe.flow === 'character') {
      const buffers: Buffer[] = [];
      const names: string[] = [];
      for (const link of findUrls(omit(character, 'animations'))) {
        buffers.push(await client.download(link.url));
        const dir8 = /north-east|north-west|south-east|south-west|north|south|east|west/.exec(link.path) ?? /north-east|north-west|south-east|south-west|north|south|east|west/.exec(link.url);
        names.push(`${j.job.id}-${dir8?.[0] ?? String(names.length).padStart(2, '0')}`);
      }
      if (buffers.length === 0) throw new Stop('the finished character held no rotation links', 'failed');
      return this.save(dir, j, recipe, body, seed, buffers, uniqueNames(names, j.job.id));
    }
    // animation: the frames of the group this job started, by its group id (two animations at once do not mix)
    const group = ids.animation_group_id ?? null;
    const animations = (Array.isArray((character as { animations?: unknown }).animations) ? (character as { animations: unknown[] }).animations : []);
    const mine = animations.find((a) => stringField(a, 'animation_group_id') === group) ?? null;
    if (mine === null) throw new Stop(`the character holds no animation group ${group ?? '(none recorded)'}`, 'failed');
    const buffers: Buffer[] = [];
    const names: string[] = [];
    const directions = Array.isArray((mine as { directions?: unknown }).directions) ? ((mine as { directions: unknown[] }).directions) : [];
    for (const d of directions) {
      const name = stringField(d, 'direction') ?? 'south';
      const frames = Array.isArray((d as { frames?: unknown }).frames) ? ((d as { frames: unknown[] }).frames) : [];
      for (const [i, url] of frames.entries()) {
        if (typeof url !== 'string') continue;
        buffers.push(await client.download(url));
        names.push(`${j.job.id}-${name}-${String(i).padStart(2, '0')}`);
      }
    }
    if (buffers.length === 0) throw new Stop('the animation group holds no frames yet', 'failed');
    return this.save(dir, j, recipe, body, seed, buffers, names);
  }
}

/** A stop with a reason. `record` says whether the catch writes a `failed` line (a post that was written as ambiguous already has its line). */
class Stop extends Error {
  constructor(message: string, readonly kind: 'failed' | 'job-failed', readonly record = true) {
    super(message);
    this.name = 'Stop';
  }
}

function uniqueNames(names: string[], fallback: string): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const base = n === '' ? fallback : n;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  });
}

function omit(node: unknown, key: string): unknown {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return node;
  return Object.fromEntries(Object.entries(node as Record<string, unknown>).filter(([k]) => k !== key));
}

/** The answer with its picture data replaced by a length, for a file a person reads. */
function elide(node: unknown): unknown {
  if (typeof node === 'string') return node.length > 400 ? `<${node.length} characters>` : node;
  if (Array.isArray(node)) return node.map(elide);
  if (node !== null && typeof node === 'object') return Object.fromEntries(Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, elide(v)]));
  return node;
}

export function idsOf(payload: unknown): Ids {
  const out: Ids = {};
  const single = stringField(payload, 'background_job_id');
  const many = field(payload, 'background_job_ids');
  if (Array.isArray(many)) out.background_job_ids = many.filter((x): x is string => typeof x === 'string');
  else if (single !== null) out.background_job_ids = [single];
  const character = stringField(payload, 'character_id');
  if (character !== null) out.character_id = character;
  const group = stringField(payload, 'animation_group_id');
  if (group !== null) out.animation_group_id = group;
  return out;
}

function field(node: unknown, key: string): unknown {
  return node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined;
}

function usageOf(payload: unknown): unknown {
  return field(payload, 'usage') ?? null;
}

/** A charge in dollars in a response: this route spends generations, and a USD charge stops the run. */
export function usdCharged(payload: unknown): number | null {
  const usage = field(payload, 'usage');
  if (usage === null || typeof usage !== 'object') return null;
  const usd = (usage as { usd?: unknown }).usd;
  return typeof usd === 'number' && usd > 0 ? usd : null;
}
