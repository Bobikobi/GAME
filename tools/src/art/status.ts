/**
 * The art pools and the status of every entry in them (docs/art/PRODUCTION_LINE.md, section 1 and wave 2).
 *
 * A pool is one master spec, `tools/kit-gen/pools/<pool>.json`, in the shape `kit:gen` reads (`parseSpec`),
 * plus the fields of `PoolEntry`. A pool is hand-edited; its status is never written by hand: it is derived
 * here from files, first rule that holds wins.
 *
 *   retired   the entry says `retired`, with the DECISIONS title that retired it.
 *   imported  `content/kit/core/kit.json` holds `kit_id` at density 4 at the asked size, and its
 *             `source.manifest` cites a line of a picks manifest that names the same sprite.
 *   picked    a picks manifest line (`tools/kit-gen/*.manifest.jsonl`) names the sprite, and the kit does not hold it yet.
 *   drafted   the drafts index (`tools/kit-gen/drafts.jsonl`, wave 3) holds a draft of the entry that is not archived: its
 *             name, and its pool when the draft says one. An archived draw is a wrong object, kept for another role, so an
 *             entry with nothing else is still missing.
 *   missing   none of the above.
 *
 * The GPU meter is the same index: each kernel run's own seconds, counted once per run id, over the last seven days.
 * Kaggle documents no weekly reset day, so the window rolls; it can only over-count against a fixed reset, never under-count.
 *
 * Reads only; nothing here writes a file.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type Draft, REVIEW_STATES, type ReviewState, foldIndex, gpuSecondsSince, parseIndex } from './drafts.js';
import { type GenEntry, parseSpec } from '../kit/gen.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export const POOLS = ['ground', 'trees', 'props', 'items', 'cast'] as const;
export type PoolName = (typeof POOLS)[number];

/** The cast is tracked only: the line never draws a character, so it is never cut into a wave. */
export const TRACKED_ONLY: readonly PoolName[] = ['cast'];

export const STATUSES = ['missing', 'drafted', 'picked', 'imported', 'retired'] as const;
export type Status = (typeof STATUSES)[number];

/** Where the art pools live, relative to the repository root. */
export const POOL_DIR = 'tools/kit-gen/pools';

/** A pool entry: a `kit:gen` entry plus what the line needs to rank it, block it and find its sprite. */
export interface PoolEntry extends GenEntry {
  /** The kit sprite it becomes (`props/tree_oak`). */
  kit_id: string;
  /** Its row in docs/art/PRE_RICH_REDRAW.md; absent when it is not on that list (already rich). Ties keep the file's order. */
  rank?: number;
  /** An open owner call (`#328 open 4`) or the DECISIONS title that holds the entry. */
  blocked_by?: string;
  /** An approved sprite the draws are compared to, such as the original oak (named `anchor_sprite` because `anchor` is the placement of a `kit:gen` entry). */
  anchor_sprite?: string;
  /** True when the kit does not hold `kit_id` yet: a regional variant it gains on pick. */
  new?: boolean;
  /** The DECISIONS title that retired the entry. */
  retired?: string;
}

const KIT_ID = /^[a-z0-9_-]+\/[a-z0-9_-]+$/;

/** Read a pool: it must parse as a `kit:gen` spec, and every pool field must be well formed. */
export function parsePool(text: string): PoolEntry[] {
  const entries = parseSpec(text) as PoolEntry[];
  const kitIds = new Set<string>();
  entries.forEach((entry, index) => {
    const where = `pool entries[${index}] (${entry.name})`;
    if (typeof entry.kit_id !== 'string' || !KIT_ID.test(entry.kit_id)) throw new Error(`${where}.kit_id must be a kit id like props/tree_oak`);
    if (kitIds.has(entry.kit_id)) throw new Error(`${where}.kit_id "${entry.kit_id}" appears twice`);
    kitIds.add(entry.kit_id);
    if (entry.rank !== undefined && (!Number.isInteger(entry.rank) || entry.rank < 1)) throw new Error(`${where}.rank must be a whole row number from 1`);
    for (const field of ['blocked_by', 'anchor_sprite', 'retired'] as const) {
      const value: unknown = entry[field];
      if (value !== undefined && (typeof value !== 'string' || value.trim() === '')) throw new Error(`${where}.${field} must be text`);
    }
    if (entry.new !== undefined && typeof entry.new !== 'boolean') throw new Error(`${where}.new must be true or false`);
  });
  return entries;
}

export function readPool(pool: PoolName, root = ROOT): PoolEntry[] {
  return parsePool(readFileSync(join(root, POOL_DIR, `${pool}.json`), 'utf8'));
}

/** What the kit holds of one sprite. */
export interface KitSprite {
  w: number;
  h: number;
  density?: number;
  source?: { spec?: string; manifest?: string };
}

/** A line of a picks manifest, as far as the status reads it. */
export interface PickLine {
  sprite?: string;
  picked?: string;
}

/** Everything the status is derived from. */
export interface Evidence {
  kit: Readonly<Record<string, KitSprite>>;
  /** Picks manifests by repo path; each is indexed by its 1-based file line, as `source.manifest` cites it. */
  picks: ReadonlyMap<string, ReadonlyMap<number, PickLine>>;
  /** Every draft of the index, the amendments folded in; empty when there is no index. */
  drafts: readonly Draft[];
  /** The same drafts by entry name. */
  draftsByName: ReadonlyMap<string, readonly Draft[]>;
}

/** The weekly meter reads this many days back (see the head of this file). */
export const GPU_WINDOW_DAYS = 7;

/** Where the drafts index is, relative to the repository root. */
export const DRAFTS_INDEX = 'tools/kit-gen/drafts.jsonl';

function jsonLines(path: string): Map<number, unknown> {
  const lines = new Map<number, unknown>();
  readFileSync(path, 'utf8').split('\n').forEach((text, index) => {
    if (text.trim() === '') return;
    try {
      lines.set(index + 1, JSON.parse(text));
    } catch {
      // a half-written line (a run in progress) is not a draft yet
    }
  });
  return lines;
}

export function loadEvidence(root = ROOT): Evidence {
  const kit = (JSON.parse(readFileSync(join(root, 'content/kit/core/kit.json'), 'utf8')) as { kit: { sprites: Record<string, KitSprite> } }).kit.sprites;
  const picks = new Map<string, Map<number, PickLine>>();
  const kitGen = join(root, 'tools/kit-gen');
  for (const file of existsSync(kitGen) ? readdirSync(kitGen).filter((f) => f.endsWith('.manifest.jsonl')).sort() : []) {
    picks.set(`tools/kit-gen/${file}`, jsonLines(join(kitGen, file)) as Map<number, PickLine>);
  }
  const index = join(root, DRAFTS_INDEX);
  const drafts = [...foldIndex(existsSync(index) ? parseIndex(readFileSync(index, 'utf8')) : []).values()];
  const draftsByName = new Map<string, Draft[]>();
  for (const draft of drafts) draftsByName.set(draft.name, [...(draftsByName.get(draft.name) ?? []), draft]);
  return { kit, picks, drafts, draftsByName };
}

/** The drafts of one entry: its name, in its own pool when the draft names a pool, and not archived (a wrong object). */
export function draftsOf(entry: PoolEntry, pool: PoolName, evidence: Evidence, includeArchived = false): Draft[] {
  return (evidence.draftsByName.get(entry.name) ?? []).filter((d) => (d.pool === null || d.pool === pool) && (includeArchived || d.review !== 'archive'));
}

/** The kit holds the sprite at density 4 at the asked size, and its `source.manifest` cites a picks line of the same sprite. */
function isImported(entry: PoolEntry, evidence: Evidence): boolean {
  const sprite = evidence.kit[entry.kit_id];
  if (sprite === undefined || sprite.density !== 4 || sprite.w !== entry.width || sprite.h !== entry.height) return false;
  const cited = /^(.+):(\d+)$/.exec(sprite.source?.manifest ?? '');
  if (cited === null) return false;
  return evidence.picks.get(cited[1] ?? '')?.get(Number(cited[2]))?.sprite === entry.kit_id;
}

function isPicked(entry: PoolEntry, evidence: Evidence): boolean {
  for (const lines of evidence.picks.values()) {
    for (const line of lines.values()) if (line.sprite === entry.kit_id && typeof line.picked === 'string' && line.picked !== '') return true;
  }
  return false;
}

export function entryStatus(entry: PoolEntry, evidence: Evidence, pool: PoolName): Status {
  if (typeof entry.retired === 'string' && entry.retired !== '') return 'retired';
  if (isImported(entry, evidence)) return 'imported';
  if (isPicked(entry, evidence)) return 'picked';
  if (draftsOf(entry, pool, evidence).length > 0) return 'drafted';
  return 'missing';
}

export interface EntryReport {
  name: string;
  kit_id: string;
  status: Status;
  rank: number | null;
  width: number;
  height: number;
  blocked_by: string | null;
}

export interface PoolReport {
  pool: PoolName;
  total: number;
  counts: Record<Status, number>;
  /** What holds entries that are not done, and how many each: `[{ blocked_by, count }]` in the order first met. */
  blocked: { blocked_by: string; count: number }[];
  /** The drafts of this pool's entries by review state, archived ones included. */
  reviews: Record<ReviewState, number>;
  /** The next missing entries in rank order (a cast is never cut, so its list is empty). */
  next: EntryReport[];
  entries: EntryReport[];
}

export interface ArtStatus {
  pools: PoolReport[];
  /** How many missing entries each pool lists as next. */
  next_per_pool: number;
  /** GPU minutes of the last seven days, each kernel run counted once; `null` when there is no drafts index. */
  gpu_minutes_week: number | null;
  /** How many kernel runs those minutes come from. */
  gpu_runs_week: number;
  drafts: { source: string; count: number; known: boolean };
}

/** Rank order: the row of #328 first, entries with no row after, the file's order inside a row. */
function byRank(a: { rank: number | null; index: number }, b: { rank: number | null; index: number }): number {
  return (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) || a.index - b.index;
}

export function poolReport(pool: PoolName, entries: readonly PoolEntry[], evidence: Evidence, nextCount: number): PoolReport {
  const counts: Record<Status, number> = { missing: 0, drafted: 0, picked: 0, imported: 0, retired: 0 };
  const reviews = Object.fromEntries(REVIEW_STATES.map((r) => [r, 0])) as Record<ReviewState, number>;
  const blocked = new Map<string, number>();
  const reports = entries.map((entry, index): EntryReport & { index: number } => {
    const status = entryStatus(entry, evidence, pool);
    counts[status] += 1;
    for (const draft of draftsOf(entry, pool, evidence, true)) reviews[draft.review] += 1;
    if (entry.blocked_by !== undefined && (status === 'missing' || status === 'drafted')) blocked.set(entry.blocked_by, (blocked.get(entry.blocked_by) ?? 0) + 1);
    return {
      index, name: entry.name, kit_id: entry.kit_id, status, rank: entry.rank ?? null, width: entry.width, height: entry.height, blocked_by: entry.blocked_by ?? null,
    };
  });
  const ranked = [...reports].sort(byRank);
  const strip = ({ index: _index, ...rest }: EntryReport & { index: number }): EntryReport => rest;
  return {
    pool,
    total: entries.length,
    counts,
    blocked: [...blocked].map(([blocked_by, count]) => ({ blocked_by, count })),
    reviews,
    next: TRACKED_ONLY.includes(pool) ? [] : ranked.filter((r) => r.status === 'missing').slice(0, nextCount).map(strip),
    entries: ranked.map(strip),
  };
}

/** The meter: each kernel run's own seconds once, over the `GPU_WINDOW_DAYS` days up to `now`. */
function gpuWeek(all: readonly Draft[], now: Date): { minutes: number; runs: number } {
  const since = new Date(now.getTime() - GPU_WINDOW_DAYS * 86_400_000);
  const drafts = all.filter((d) => d.at !== null && Date.parse(d.at) <= now.getTime());
  const runs = new Set(drafts.filter((d) => d.run !== null && d.run.gpu_seconds !== null && Date.parse(d.at ?? '') >= since.getTime()).map((d) => d.run?.id));
  return { minutes: Math.round(gpuSecondsSince(drafts, since) / 6) / 10, runs: runs.size };
}

export function artStatus(root = ROOT, options: { next?: number; now?: Date } = {}): ArtStatus {
  const evidence = loadEvidence(root);
  const nextCount = options.next ?? 5;
  const known = evidence.drafts.length > 0;
  const week = gpuWeek(evidence.drafts, options.now ?? new Date());
  return {
    pools: POOLS.map((pool) => poolReport(pool, readPool(pool, root), evidence, nextCount)),
    next_per_pool: nextCount,
    gpu_minutes_week: known ? week.minutes : null,
    gpu_runs_week: week.runs,
    drafts: { source: DRAFTS_INDEX, count: evidence.drafts.length, known },
  };
}

/** The plain-text report: one line a pool, then what blocks, the meter, the drafts' source and the next-up list. Stable order, no clock. */
export function formatStatus(status: ArtStatus): string {
  const width = Math.max(...status.pools.map((p) => p.pool.length));
  const lines = ['art pools'];
  for (const p of status.pools) {
    lines.push(`${p.pool.padEnd(width)}  ${String(p.total).padStart(3)} entries: ${STATUSES.map((s) => `${p.counts[s]} ${s}`).join(', ')}`);
  }
  const blockers = new Map<string, string[]>();
  for (const p of status.pools) for (const b of p.blocked) blockers.set(b.blocked_by, [...(blockers.get(b.blocked_by) ?? []), `${p.pool} ${b.count}`]);
  lines.push('', 'blocked (missing or drafted entries held by an open call):');
  if (blockers.size === 0) lines.push('  none');
  for (const [by, where] of blockers) lines.push(`  ${by}: ${where.join(', ')}`);
  lines.push('', `gpu minutes, last ${GPU_WINDOW_DAYS} days: ${status.gpu_minutes_week === null
    ? `not known (no drafts index at ${status.drafts.source})`
    : `${status.gpu_minutes_week} from ${status.gpu_runs_week} kernel run${status.gpu_runs_week === 1 ? '' : 's'}, each run counted once`}`);
  lines.push(`drafts: ${status.drafts.known
    ? `${status.drafts.count} in the index (${status.drafts.source}); of the pools' entries:`
    : `no index at ${status.drafts.source}, so a draft cannot be known`}`);
  if (status.drafts.known) {
    for (const p of status.pools) {
      const held = REVIEW_STATES.filter((r) => p.reviews[r] > 0);
      if (held.length > 0) lines.push(`  ${p.pool.padEnd(width)}  ${held.map((r) => `${p.reviews[r]} ${r}`).join(', ')}`);
    }
  }
  const next = status.pools.flatMap((p) => p.next.map((e) => ({ pool: p.pool, e })));
  lines.push('', `next missing, in rank order, ${status.next_per_pool} a pool (the cast is tracked only):`);
  if (next.length === 0) lines.push('  none');
  const nameWidth = Math.max(0, ...next.map((n) => n.e.name.length));
  for (const { pool, e } of next) {
    lines.push(`  ${pool.padEnd(width)}  ${e.name.padEnd(nameWidth)}  ${`${e.width}x${e.height}`.padEnd(7)}  ${(e.rank === null ? 'no row' : `row ${e.rank}`).padEnd(6)}${e.blocked_by === null ? '' : `  blocked: ${e.blocked_by}`}`.trimEnd());
  }
  return `${lines.join('\n')}\n`;
}

/** `pnpm art:status [--json] [--next N]`: the text a run prints. Throws on a bad argument. */
export function statusCli(args: readonly string[], root = ROOT, now = new Date()): string {
  const at = args.indexOf('--next');
  const next = at === -1 ? 5 : Number(args[at + 1]);
  if (!Number.isInteger(next) || next < 0) throw new Error('--next takes a whole number from 0');
  const unknown = args.filter((a, i) => a !== '--json' && a !== '--next' && !(i > 0 && args[i - 1] === '--next'));
  if (unknown.length > 0) throw new Error(`Usage: art:status [--json] [--next N] (not: ${unknown.join(' ')})`);
  const status = artStatus(root, { next, now });
  return args.includes('--json') ? `${JSON.stringify(status, null, 2)}\n` : formatStatus(status);
}
