/**
 * The pick as an action (docs/art/PRODUCTION_LINE.md section 4).
 *
 * `pnpm art:pick --from picks.json [--dry]` applies the owner's file, `pnpm art:pick <pool> <name> <draft-id> [--by who] [--dry]`
 * applies one pick. A file is `{ picked_by, at, picks: [{ draft, action: pick | again | wrong, note? }] }`:
 *
 * - pick: the draft's imported picture goes to `content/kit/core/<kit_id>.png`, the kit entry gets its size, density 4,
 *   ramps and source, one line is appended to the picks manifest, and the draft is `keep`;
 * - again: the draft becomes `rework` with the note, and the entry joins the next wave;
 * - wrong: the draft is `archive` with `looks_like` (the note), kept for another role.
 *
 * Only a name in `tools/kit-gen/pickers/owner.json` may pick; a builder never does. Nothing is written until every action in the
 * file has been checked, and the drafts index and the picks manifest only grow.
 */
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { CACHE_DIR, type Draft, DraftIndex, pngDims } from './drafts.js';
import { ROOT } from './queue.js';
import { POOLS, type PoolEntry, type PoolName, readPool } from './status.js';

export const PICKERS_PATH = 'tools/kit-gen/pickers/owner.json';
export const PICKS_MANIFEST = 'tools/kit-gen/rich-wave.manifest.jsonl';
export const KIT_JSON = 'content/kit/core/kit.json';
export const ACTIONS = ['pick', 'again', 'wrong'] as const;
export type PickActionName = (typeof ACTIONS)[number];

export interface PickAction {
  draft: string;
  action: PickActionName;
  note?: string;
}

export interface PicksFile {
  picked_by: string;
  at?: string;
  picks: PickAction[];
}

export function readPickers(root = ROOT): string[] {
  const parsed = JSON.parse(readFileSync(join(root, PICKERS_PATH), 'utf8')) as { pickers?: unknown };
  if (!Array.isArray(parsed.pickers) || parsed.pickers.some((p) => typeof p !== 'string')) throw new Error(`${PICKERS_PATH}: "pickers" must be a list of names`);
  return parsed.pickers as string[];
}

export function parsePicksFile(text: string): PicksFile {
  const data = JSON.parse(text) as Partial<PicksFile>;
  if (typeof data.picked_by !== 'string' || data.picked_by.trim() === '') throw new Error('picks file: "picked_by" must name the picker');
  if (!Array.isArray(data.picks)) throw new Error('picks file: "picks" must be a list');
  data.picks.forEach((p, i) => {
    const where = `picks file: picks[${i}]`;
    if (typeof p?.draft !== 'string' || !/^[0-9a-f]{16}$/u.test(p.draft)) throw new Error(`${where}.draft must be a draft id`);
    if (!(ACTIONS as readonly string[]).includes(p.action)) throw new Error(`${where}.action must be ${ACTIONS.join(', ')}`);
    if (p.note !== undefined && typeof p.note !== 'string') throw new Error(`${where}.note must be text`);
    if (p.action === 'wrong' && (p.note ?? '').trim() === '') throw new Error(`${where}: a wrong object says what it looks like (note)`);
  });
  return data as PicksFile;
}

/** One checked action and what it writes. */
export interface Step {
  action: PickAction;
  draft: Draft;
  entry: PoolEntry;
  pool: PoolName;
  /** Human lines for `--dry`. */
  lines: string[];
}

export interface PickContext {
  root?: string;
  indexPath?: string;
  cacheDir?: string;
  /** The day written into the manifest's `picked` text. */
  today?: string;
}

function findEntry(root: string, draft: Draft): { pool: PoolName; entry: PoolEntry } {
  const pools = draft.pool !== null && (POOLS as readonly string[]).includes(draft.pool) ? [draft.pool as PoolName] : [...POOLS];
  for (const pool of pools) {
    if (pool === 'cast') continue;
    const entry = readPool(pool, root).find((e) => e.name === draft.name);
    if (entry !== undefined) return { pool, entry };
  }
  throw new Error(`draft ${draft.id} (${draft.name}) is in no pool`);
}

/** Check a whole file against the index, the pools and the cache; throws on the first problem, writes nothing. */
export function planPicks(file: PicksFile, ctx: PickContext = {}): Step[] {
  const root = ctx.root ?? ROOT;
  const cache = ctx.cacheDir ?? CACHE_DIR;
  if (!readPickers(root).includes(file.picked_by)) throw new Error(`"${file.picked_by}" is not in ${PICKERS_PATH}: only the owner, and whom the owner names there, may pick`);
  const index = DraftIndex.open(ctx.indexPath ?? join(root, 'tools/kit-gen/drafts.jsonl'));
  const picked = new Map<string, string>();
  const seen = new Set<string>();
  return file.picks.map((action) => {
    const draft = index.drafts.get(action.draft);
    if (draft === undefined) throw new Error(`no draft ${action.draft} in the index`);
    if (seen.has(action.draft)) throw new Error(`draft ${action.draft} is in the file twice`);
    seen.add(action.draft);
    const { pool, entry } = findEntry(root, draft);
    const lines: string[] = [];
    if (action.action === 'pick') {
      const other = picked.get(entry.name);
      if (other !== undefined) throw new Error(`${entry.name} has two picks in the file (${other} and ${draft.id}): one pick an entry`);
      picked.set(entry.name, draft.id);
      const imported = join(cache, `${draft.id}.imported.png`);
      if (!existsSync(imported)) throw new Error(`draft ${draft.id}: ${imported} is missing; run pnpm art:drafts fetch`);
      const dims = pngDims(readFileSync(imported));
      if (dims === null || dims[0] !== entry.width || dims[1] !== entry.height) throw new Error(`draft ${draft.id}: the picture is ${dims?.join('x') ?? '?'}, the entry asks ${entry.width}x${entry.height}`);
      lines.push(
        `copy ${draft.id}.imported.png -> content/kit/core/${entry.kit_id}.png (${entry.width}x${entry.height})`,
        `kit.json: ${entry.kit_id} = density 4, ramps ${JSON.stringify(entry.ramps ?? draft.ramps ?? [])}, source ${entry.name} of tools/kit-gen/pools/${pool}.json`,
        `${PICKS_MANIFEST}: append a line (draft ${draft.id}, ${draft.recipe ?? draft.route} seed ${draft.seed}, picked_by ${file.picked_by})`,
        `drafts index: ${draft.id} review keep`,
      );
    } else if (action.action === 'again') {
      lines.push(`drafts index: ${draft.id} review rework${action.note ? ` (${action.note})` : ''}; ${entry.name} joins the next wave`);
    } else {
      lines.push(`drafts index: ${draft.id} review archive, looks like "${action.note}"`);
    }
    return { action, draft, entry, pool, lines };
  });
}

/** The kit.json text with one sprite added or replaced (the file is JSON at two spaces). */
export function withSprite(kitText: string, kitId: string, sprite: Record<string, unknown>): string {
  const kit = JSON.parse(kitText) as { kit: { sprites: Record<string, unknown> } };
  kit.kit.sprites[kitId] = sprite;
  return `${JSON.stringify(kit, null, 2)}\n`;
}

/** Apply checked steps. The index and the manifest are appended to; kit.json and the pictures are written. */
export function applyPicks(file: PicksFile, steps: readonly Step[], ctx: PickContext = {}): void {
  const root = ctx.root ?? ROOT;
  const cache = ctx.cacheDir ?? CACHE_DIR;
  const today = ctx.today ?? new Date().toISOString().slice(0, 10);
  const index = DraftIndex.open(ctx.indexPath ?? join(root, 'tools/kit-gen/drafts.jsonl'));
  const kitPath = join(root, KIT_JSON);
  const manifestPath = join(root, PICKS_MANIFEST);
  for (const { action, draft, entry, pool } of steps) {
    const by = file.picked_by;
    if (action.action === 'pick') {
      const target = join(root, 'content/kit/core', `${entry.kit_id}.png`);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(cache, `${draft.id}.imported.png`), target);
      const before = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : '';
      const lead = before === '' || before.endsWith('\n') ? '' : '\n';
      const line = {
        sprite: entry.kit_id, name: entry.name, spec: `tools/kit-gen/pools/${pool}.json`, round: draft.round, drawer: draft.route, model: draft.model,
        model_key: draft.recipe, model_version: draft.model_version, seed: draft.seed, ref: entry.ref, what: entry.what, detail: entry.detail,
        ramps: entry.ramps ?? draft.ramps ?? [], prompt: draft.prompt, picked: `${by}, ${by === 'measure' ? 'by measure' : 'by eye'}, ${today}`, draft: draft.id, pool: draft.pool, picked_by: by,
      };
      appendFileSync(manifestPath, `${lead}${JSON.stringify(line)}\n`);
      const number = (before + lead).split('\n').filter((l) => l.trim() !== '').length + 1;
      const kitId = entry.kit_id;
      const sprite = {
        file: `${kitId}.png`, w: entry.width, h: entry.height, density: 4, ramps: entry.ramps ?? draft.ramps ?? [],
        source: { spec: `tools/kit-gen/pools/${pool}.json`, manifest: `${PICKS_MANIFEST}:${number}` },
      };
      writeFileSync(kitPath, withSprite(readFileSync(kitPath, 'utf8'), kitId, sprite));
      index.amend({ id: draft.id, amend: true, review: 'keep', review_by: by, review_note: action.note ?? `picked ${today}` });
    } else if (action.action === 'again') {
      index.amend({ id: draft.id, amend: true, review: 'rework', review_by: by, review_note: action.note ?? `again, ${today}` });
    } else {
      index.amend({ id: draft.id, amend: true, review: 'archive', review_by: by, review_note: `${today}, wrong object`, looks_like: action.note ?? '' });
    }
  }
}

export function formatSteps(steps: readonly Step[], dry: boolean): string {
  const out = [`art pick: ${steps.length} action${steps.length === 1 ? '' : 's'}${dry ? ', dry run (nothing written)' : ''}`];
  for (const s of steps) {
    out.push(`${s.action.action} ${s.pool}/${s.entry.name} ${s.draft.id}`, ...s.lines.map((l) => `  ${l}`));
  }
  return `${out.join('\n')}\n`;
}

export function pickCli(args: readonly string[], ctx: PickContext = {}): { text: string; code: number } {
  const usage = 'Usage: art:pick --from picks.json [--dry]  |  art:pick <pool> <name> <draft-id> [--by who] [--dry]';
  const dry = args.includes('--dry');
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i < 0 ? undefined : args[i + 1];
  };
  const positional = args.filter((a, i) => !a.startsWith('--') && !['--from', '--by'].includes(args[i - 1] ?? ''));
  let file: PicksFile;
  if (args.includes('--from')) {
    const path = flag('--from');
    if (path === undefined || path.startsWith('--') || positional.length > 0) throw new Error(usage);
    file = parsePicksFile(readFileSync(path, 'utf8'));
  } else {
    const [pool, name, id] = positional;
    if (pool === undefined || name === undefined || id === undefined || positional.length > 3) throw new Error(usage);
    if (!(POOLS as readonly string[]).includes(pool)) throw new Error(`${usage}\n(unknown pool "${pool}")`);
    const by = flag('--by') ?? readPickers(ctx.root ?? ROOT)[0] ?? '';
    file = { picked_by: by, picks: [{ draft: id, action: 'pick' }] };
    const root = ctx.root ?? ROOT;
    const entry = readPool(pool as PoolName, root).find((e) => e.name === name);
    if (entry === undefined) throw new Error(`no entry "${name}" in the ${pool} pool`);
    const draft = DraftIndex.open(ctx.indexPath ?? join(root, 'tools/kit-gen/drafts.jsonl')).drafts.get(id);
    if (draft !== undefined && draft.name !== name) throw new Error(`draft ${id} is a draw of ${draft.name}, not ${name}`);
  }
  const steps = planPicks(file, ctx);
  if (!dry) applyPicks(file, steps, ctx);
  return { text: formatSteps(steps, dry), code: 0 };
}
