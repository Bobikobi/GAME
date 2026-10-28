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
 *   drafted   a draft exists. The drafts index is wave 3 of the plan, so until it lands a draft is read from the run
 *             folders when they are there: a line of `.scratch/kit-gen/<run>/manifest.jsonl` with the entry's name and
 *             `ref`, a picture (`out`) and no error. With no run folder on disk a draft cannot be known.
 *   missing   none of the above.
 *
 * Reads only; nothing here writes a file.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  /** The drafts found in run folders, as `draftKey` strings. */
  drafts: ReadonlySet<string>;
  /** How many run folders were read; 0 means a draft cannot be known. */
  runFolders: number;
}

export function draftKey(name: string, ref: string): string {
  return `${ref}#${name}`;
}

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
  const drafts = new Set<string>();
  let runFolders = 0;
  const runs = join(root, '.scratch/kit-gen');
  for (const run of existsSync(runs) ? readdirSync(runs).sort() : []) {
    const manifest = join(runs, run, 'manifest.jsonl');
    if (!existsSync(manifest)) continue;
    runFolders += 1;
    for (const line of jsonLines(manifest).values()) {
      const l = line as { name?: unknown; ref?: unknown; out?: unknown; error?: unknown };
      if (typeof l.name === 'string' && typeof l.ref === 'string' && typeof l.out === 'string' && (l.error === null || l.error === undefined)) drafts.add(draftKey(l.name, l.ref));
    }
  }
  return { kit, picks, drafts, runFolders };
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

export function entryStatus(entry: PoolEntry, evidence: Evidence): Status {
  if (typeof entry.retired === 'string' && entry.retired !== '') return 'retired';
  if (isImported(entry, evidence)) return 'imported';
  if (isPicked(entry, evidence)) return 'picked';
  if (evidence.drafts.has(draftKey(entry.name, entry.ref))) return 'drafted';
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
  /** The next missing entries in rank order (a cast is never cut, so its list is empty). */
  next: EntryReport[];
  entries: EntryReport[];
}

export interface ArtStatus {
  pools: PoolReport[];
  /** How many missing entries each pool lists as next. */
  next_per_pool: number;
  /** Always `null` until the drafts index of wave 3 gives the meter its source. */
  gpu_minutes_week: number | null;
  drafts: { source: string; run_folders: number; known: boolean };
}

/** Rank order: the row of #328 first, entries with no row after, the file's order inside a row. */
function byRank(a: { rank: number | null; index: number }, b: { rank: number | null; index: number }): number {
  return (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) || a.index - b.index;
}

export function poolReport(pool: PoolName, entries: readonly PoolEntry[], evidence: Evidence, nextCount: number): PoolReport {
  const counts: Record<Status, number> = { missing: 0, drafted: 0, picked: 0, imported: 0, retired: 0 };
  const blocked = new Map<string, number>();
  const reports = entries.map((entry, index): EntryReport & { index: number } => {
    const status = entryStatus(entry, evidence);
    counts[status] += 1;
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
    next: TRACKED_ONLY.includes(pool) ? [] : ranked.filter((r) => r.status === 'missing').slice(0, nextCount).map(strip),
    entries: ranked.map(strip),
  };
}

export function artStatus(root = ROOT, options: { next?: number } = {}): ArtStatus {
  const evidence = loadEvidence(root);
  const nextCount = options.next ?? 5;
  return {
    pools: POOLS.map((pool) => poolReport(pool, readPool(pool, root), evidence, nextCount)),
    next_per_pool: nextCount,
    gpu_minutes_week: null,
    drafts: { source: '.scratch/kit-gen/*/manifest.jsonl', run_folders: evidence.runFolders, known: evidence.runFolders > 0 },
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
  lines.push('', `gpu minutes this week: ${status.gpu_minutes_week === null ? 'not tracked yet (the meter is the drafts index, wave 3)' : String(status.gpu_minutes_week)}`);
  lines.push(`drafts: ${status.drafts.known
    ? `read from ${status.drafts.run_folders} run folder${status.drafts.run_folders === 1 ? '' : 's'} (${status.drafts.source})`
    : `no run folder on disk (${status.drafts.source}), so a draft cannot be known: a missing entry may have drafts elsewhere`}`);
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
export function statusCli(args: readonly string[], root = ROOT): string {
  const at = args.indexOf('--next');
  const next = at === -1 ? 5 : Number(args[at + 1]);
  if (!Number.isInteger(next) || next < 0) throw new Error('--next takes a whole number from 0');
  const unknown = args.filter((a, i) => a !== '--json' && a !== '--next' && !(i > 0 && args[i - 1] === '--next'));
  if (unknown.length > 0) throw new Error(`Usage: art:status [--json] [--next N] (not: ${unknown.join(' ')})`);
  const status = artStatus(root, { next });
  return args.includes('--json') ? `${JSON.stringify(status, null, 2)}\n` : formatStatus(status);
}
