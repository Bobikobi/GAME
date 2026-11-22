/**
 * pnpm art:prune --dry [--seed N] [--offline] [--refresh-store] [--out DIR]
 *
 * One rerunnable command that sorts every draft of `tools/kit-gen/drafts.jsonl` into remove or keep by the written rules of
 * `prune.ts` and writes, into `.scratch/prune/` (or --out):
 *
 *   report.md        counts and bytes per rule, what each protection held back, what no rule caught, the inputs found
 *   remove.jsonl     one line per draft to remove: id, rule, code, evidence, how sure, files and hashes
 *   sheet-<rule>.png one contact sheet a rule: at most 48 thumbnails, at most 1200 px wide, the 10 the rule is least sure of
 *                    first, then a random sample; the report lists the cells in reading order
 *
 * A dry run deletes nothing and changes no file of the repo. It reads, beside the index: the owner's hand sort (the library
 * page's `reviews.jsonl`), the hub answers, the pick closes, the pools, a grep of the repo, and the drafts store's asset list
 * (cached in `.scratch/prune/store.json`; `--refresh-store` lists it again, `--offline` never asks GitHub).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import { DRAFTS_REPO, type Draft, DraftIndex, type Gh, INDEX_PATH, isRemoved, realGh, retry } from './drafts.js';
import { ensureThumbs, thumbPath } from './library-cli.js';
import { readReviews } from './library-reviews.js';
import { type Choice, type PickClose, type Plan, type PruneInput, type RetiredEntry, RULES, type Verdict, YOUNG_DAYS, assetsOf, byRule, bytesOf, planPrune, sampleFor } from './prune.js';
import { ROOT } from './queue.js';

export const CLOSES_PATH = 'tools/kit-gen/pick-closes.json';
const POOLS_DIR = 'tools/kit-gen/pools';
export const DEFAULT_SEED = 812;
const SHEET_COLS = 8;
const SHEET_ROWS = 6;
const CELL = 146;

/* ---- inputs ---- */

const libraryDir = (): string => resolve(process.env['ART_LIBRARY_OUT'] ?? join(homedir(), 'Projects/GAME/.scratch/art-library'));
const hubDir = (): string => resolve(process.env['HUB_ANSWERS'] ?? join(homedir(), 'Projects/GAME/.scratch/hub/answers'));

export function readCloses(root = ROOT): PickClose[] {
  const path = join(root, CLOSES_PATH);
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { closes?: PickClose[] };
  if (!Array.isArray(parsed.closes)) throw new Error(`${CLOSES_PATH}: "closes" must be a list`);
  for (const c of parsed.closes) {
    if (typeof c.id !== 'string' || typeof c.closed !== 'string' || typeof c.decision !== 'string' || !Array.isArray(c.lost)) throw new Error(`${CLOSES_PATH}: a close needs id, closed, decision and lost`);
  }
  return parsed.closes;
}

/** The pools' entries that say `retired`. */
export function readRetired(root = ROOT): RetiredEntry[] {
  const dir = join(root, POOLS_DIR);
  const out: RetiredEntry[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const parsed = JSON.parse(readFileSync(join(dir, file), 'utf8')) as { entries?: Record<string, unknown>[] };
    for (const e of parsed.entries ?? []) {
      if (typeof e['retired'] === 'string' && e['retired'] !== '' && typeof e['name'] === 'string') out.push({ name: e['name'], ...(typeof e['kit_id'] === 'string' ? { kit_id: e['kit_id'] } : {}), why: e['retired'] });
    }
  }
  return out;
}

const TEXT_EXT = ['.json', '.md', '.ts', '.js', '.jsonl', '.txt', '.yml', '.yaml', '.html'];
const IMAGE_EXT = ['.png', '.jpg', '.webp', '.glb'];
/** A file that only lists the drafts (the agents' triage legend) does not use them. */
const CATALOGUES = [/^docs\/art\/triage-/, /^tools\/kit-gen\/drafts\.jsonl$/, /^tools\/kit-gen\/pick-closes\.json$/];

function trackedFiles(root: string): string[] {
  const run = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0) throw new Error('git ls-files failed');
  return run.stdout.split('\n').filter((f) => f !== '');
}

const HEX16 = /(?<![0-9a-f])[0-9a-f]{16}(?![0-9a-f])/g;
const HEX64 = /(?<![0-9a-f])[0-9a-f]{64}(?![0-9a-f])/g;

/** The repo files that use each draft: its id or one of its file hashes written in a file, or its bytes as a picture. */
export function scanUses(drafts: readonly Draft[], root = ROOT): Map<string, string[]> {
  const ids = new Set(drafts.map((d) => d.id));
  const sha = new Map<string, string>();
  for (const d of drafts) for (const k of ['raw', 'full', 'imported'] as const) { const f = d.files[k]; if (f) sha.set(f.sha256, d.id); }
  const uses = new Map<string, Set<string>>();
  const add = (id: string, file: string): void => void uses.set(id, (uses.get(id) ?? new Set()).add(file));
  for (const file of trackedFiles(root)) {
    if (CATALOGUES.some((c) => c.test(file))) continue;
    const lower = file.toLowerCase();
    try {
      if (TEXT_EXT.some((e) => lower.endsWith(e))) {
        const body = readFileSync(join(root, file), 'utf8');
        for (const t of new Set(body.match(HEX16) ?? [])) if (ids.has(t)) add(t, file);
        for (const t of new Set(body.match(HEX64) ?? [])) { const id = sha.get(t); if (id !== undefined) add(id, file); }
      } else if (IMAGE_EXT.some((e) => lower.endsWith(e))) {
        const id = sha.get(createHash('sha256').update(readFileSync(join(root, file))).digest('hex'));
        if (id !== undefined) add(id, file);
      }
    } catch { /* a file git lists and the disk lacks (a sparse checkout) is not a use */ }
  }
  return new Map([...uses].map(([id, files]) => [id, [...files].sort()]));
}

/** A word-bounded search of content/ and docs/design/ for a retired subject's name. */
export function nameSearch(root = ROOT): (term: string) => string[] {
  const corpus: { file: string; body: string }[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (TEXT_EXT.some((x) => e.name.endsWith(x)) && statSync(join(root, rel)).size < 8 * 1024 * 1024) corpus.push({ file: rel, body: readFileSync(join(root, rel), 'utf8') });
    }
  };
  for (const dir of ['content', 'docs/design']) if (existsSync(join(root, dir))) walk(dir);
  return (term) => {
    const re = new RegExp(`(?<![A-Za-z0-9_])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_])`);
    return corpus.filter((c) => re.test(c.body)).map((c) => c.file);
  };
}

export function hubCheck(dir = hubDir()): (hub: string) => boolean | null {
  if (!existsSync(dir)) return () => null;
  return (hub) => {
    const file = join(dir, `${hub}.json`);
    if (!existsSync(file)) return false;
    try {
      const answer = JSON.parse(readFileSync(file, 'utf8')) as { void?: boolean; picks?: object };
      return answer.void !== true && answer.picks !== undefined;
    } catch {
      return false;
    }
  };
}

/* ---- the store's asset list ---- */

export interface StoreAsset { id: number; name: string; size: number; tag: string }

export function listStore(gh: Gh = realGh, say: (t: string) => void = () => undefined): StoreAsset[] {
  const rel = retry(gh, ['api', '--paginate', `repos/${DRAFTS_REPO}/releases?per_page=100`, '--jq', '.[] | [.id, .tag_name] | @tsv']);
  if (rel.status !== 0) throw new Error(`could not list the releases: ${rel.stderr.trim().slice(0, 200)}`);
  const releases = rel.stdout.split('\n').filter((l) => l !== '').map((l) => { const [id, tag] = l.split('\t'); return { id: String(id), tag: String(tag) }; });
  const assets: StoreAsset[] = [];
  for (const r of releases) {
    say(`store: ${r.tag}`);
    const got = retry(gh, ['api', '--paginate', `repos/${DRAFTS_REPO}/releases/${r.id}/assets?per_page=100`, '--jq', '.[] | [.id, .name, .size] | @tsv']);
    if (got.status !== 0) throw new Error(`could not list the assets of ${r.tag}: ${got.stderr.trim().slice(0, 200)}`);
    for (const l of got.stdout.split('\n').filter((x) => x !== '')) { const [id, name, size] = l.split('\t'); assets.push({ id: Number(id), name: String(name), size: Number(size), tag: r.tag }); }
  }
  return assets;
}

function storeAssets(out: string, opts: { offline: boolean; refresh: boolean; say: (t: string) => void }): { assets: StoreAsset[] | null; note: string } {
  const cache = join(out, 'store.json');
  if (!opts.refresh && existsSync(cache)) {
    const c = JSON.parse(readFileSync(cache, 'utf8')) as { at: string; assets: StoreAsset[] };
    return { assets: c.assets, note: `listed ${c.at} (cache)` };
  }
  if (opts.offline) return { assets: null, note: 'not listed (--offline): R6 cannot see a missing file' };
  const assets = listStore(realGh, opts.say);
  const at = new Date().toISOString();
  writeFileSync(cache, JSON.stringify({ at, assets }));
  return { assets, note: `listed ${at}` };
}

/* ---- the sheets ---- */

function findThumb(id: string, dirs: readonly string[]): string | null {
  for (const d of dirs) { const p = thumbPath(d, id); if (existsSync(p)) return p; }
  return null;
}

/** One ffmpeg sheet: 8 columns of 146 px cells with a 2 px gap, 1182 px wide, one input a picture (xstack). False when ffmpeg or a picture failed. */
export function makeSheet(files: readonly string[], to: string): boolean {
  if (files.length === 0) return false;
  const rows = Math.min(SHEET_ROWS, Math.ceil(files.length / SHEET_COLS));
  const shown = files.slice(0, SHEET_COLS * rows);
  const cell = (i: number): string => `[${i}:v]scale=${CELL}:${CELL}:force_original_aspect_ratio=decrease:flags=neighbor,pad=${CELL}:${CELL}:(ow-iw)/2:(oh-ih)/2:color=0x3a3a3a,format=rgb24[c${i}]`;
  const layout = shown.map((_, i) => `${(i % SHEET_COLS) * (CELL + 2)}_${Math.floor(i / SHEET_COLS) * (CELL + 2)}`).join('|');
  const stack = shown.length === 1 ? '[c0]null[out]' : `${shown.map((_, i) => `[c${i}]`).join('')}xstack=inputs=${shown.length}:layout=${layout}:fill=0x1a1a1a[out]`;
  const graph = [...shown.map((_, i) => cell(i)), stack].join(';');
  const run = spawnSync('ffmpeg', ['-v', 'error', '-y', ...shown.flatMap((f) => ['-i', f]), '-filter_complex', graph, '-map', '[out]', '-frames:v', '1', '-update', '1', to], { encoding: 'utf8' });
  return run.status === 0 && existsSync(to);
}

/* ---- the report ---- */

const mb = (n: number): string => (n / 1e6).toFixed(1);
const labelOf = (d: Draft): string => d.pool ?? d.sources[0]?.label ?? '?';

export interface SheetInfo { rule: string; file: string | null; cells: { n: number; id: string; name: string; doubt: boolean }[]; missing: number }

export function reportText(opts: { plan: Plan; drafts: readonly Draft[]; removedBefore: number; inputs: string[]; sheets: SheetInfo[]; seed: number; now: Date }): string {
  const { plan, drafts, sheets } = opts;
  const byId = new Map(drafts.map((d) => [d.id, d]));
  const per = byRule(plan);
  const total = plan.remove.length;
  const bytes = plan.remove.reduce((n, v) => n + v.bytes, 0);
  const lines: string[] = [];
  lines.push(`# Drafts prune, dry run ${opts.now.toISOString().slice(0, 16)}Z`, '');
  lines.push(`**${total} drafts to remove, ${mb(bytes)} MB**, of ${drafts.length} live drafts (${opts.removedBefore} already removed before this run). Nothing is deleted by a dry run.`, '');
  lines.push('| rule | code | drafts | MB | what |', '|---|---|---:|---:|---|');
  for (const r of RULES) {
    const vs = per.get(r.rule)!;
    lines.push(`| ${r.rule} | ${r.code} | ${vs.length} | ${mb(vs.reduce((n, v) => n + v.bytes, 0))} | ${r.title} |`);
  }
  lines.push('', `Seed for the samples: ${opts.seed}. Age guard: ${YOUNG_DAYS} days.`, '', '## Inputs', '', ...opts.inputs.map((i) => `- ${i}`), '');
  lines.push('## Matched, then held back by a protection', '', 'A rule matched these and a never-remove protection stopped it. They stay.', '', '| rule | protection | drafts |', '|---|---|---:|');
  const held = new Map<string, number>();
  for (const h of plan.held) held.set(`${h.rule}|${h.by.replace(/ by .*$/, '').replace(/^used by .*/, 'used by a file of the repo')}`, (held.get(`${h.rule}|${h.by.replace(/ by .*$/, '').replace(/^used by .*/, 'used by a file of the repo')}`) ?? 0) + 1);
  for (const [k, n] of [...held].sort()) { const [rule, by] = k.split('|'); lines.push(`| ${rule} | ${by} | ${n} |`); }
  if (held.size === 0) lines.push('| - | - | 0 |');
  lines.push('', '## Kept, no rule caught it', '');
  for (const [why, n] of [...plan.kept].sort((a, b) => b[1] - a[1])) lines.push(`- ${n}: ${why}`);
  lines.push('', '### Where the unsorted rest sits (no rule, no protection): the biggest groups', '', '| group | drafts | MB |', '|---|---:|---:|');
  const rest = new Map<string, { n: number; b: number }>();
  for (const id of plan.uncaught) { const d = byId.get(id)!; const g = rest.get(labelOf(d)) ?? { n: 0, b: 0 }; rest.set(labelOf(d), { n: g.n + 1, b: g.b + bytesOf(d) }); }
  for (const [g, v] of [...rest].sort((a, b) => b[1].n - a[1].n).slice(0, 12)) lines.push(`| ${g} | ${v.n} | ${mb(v.b)} |`);
  lines.push('');
  for (const r of RULES) {
    const vs = per.get(r.rule)!;
    lines.push(`## ${r.rule} ${r.code}: ${vs.length} drafts, ${mb(vs.reduce((n, v) => n + v.bytes, 0))} MB`, '');
    if (vs.length === 0) {
      const h = plan.held.filter((x) => x.rule === r.rule);
      lines.push(h.length === 0 ? 'No draft matches.' : `No draft removed. ${h.length} matched and were held: e.g. ${byId.get(h[0]!.id)?.name} (${h[0]!.by}).`, '');
      continue;
    }
    const groups = new Map<string, number>();
    for (const v of vs) groups.set(labelOf(byId.get(v.id)!), (groups.get(labelOf(byId.get(v.id)!)) ?? 0) + 1);
    lines.push(`By group: ${[...groups].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([g, n]) => `${g} ${n}`).join(', ')}`, '');
    lines.push(`Evidence, one example: ${vs[0]!.why}`, '');
    const sheet = sheets.find((s) => s.rule === r.rule);
    if (sheet?.file != null) {
      lines.push(`Sheet: \`${sheet.file}\` (${sheet.cells.length} cells, ${SHEET_COLS} a row, reading order; cells 1-${sheet.cells.filter((c) => c.doubt).length} are the ones the rule is least sure of${sheet.missing > 0 ? `; ${sheet.missing} had no picture` : ''})`, '');
      lines.push('| cell | id | name | |', '|---:|---|---|---|');
      for (const c of sheet.cells) lines.push(`| ${c.n} | ${c.id} | ${c.name} | ${c.doubt ? 'least sure' : ''} |`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

/* ---- the run ---- */

export interface DryOptions { out: string; seed: number; offline: boolean; refresh: boolean; say: (t: string) => void; indexPath?: string; now?: Date }

export function dryRun(opts: DryOptions): { plan: Plan; report: string; total: number } {
  const root = ROOT;
  mkdirSync(opts.out, { recursive: true });
  for (const old of readdirSync(opts.out).filter((f) => /^sheet-R\d\.png$/.test(f))) rmSync(join(opts.out, old));
  const index = DraftIndex.open(opts.indexPath ?? INDEX_PATH);
  const all = [...index.drafts.values()];
  const drafts = all.filter((d) => !isRemoved(d));
  const inputs: string[] = [];

  const known = new Set(index.drafts.keys());
  const reviews = readReviews(join(libraryDir(), 'reviews.jsonl'), known);
  const owner = new Map<string, Choice>([...reviews.choices].map(([id, c]) => [id, { review: c.review, at: c.at }]));
  inputs.push(reviews.lines === 0 ? `the owner's hand sort: \`${join(libraryDir(), 'reviews.jsonl')}\` not found, so R1 reads only the index` : `the owner's hand sort (library page reviews.jsonl): ${owner.size} drafts, ${[...owner.values()].filter((c) => c.review === 'archive').length} archived, ${[...owner.values()].filter((c) => c.review === 'keep').length} kept`);

  const closes = readCloses(root);
  const hub = hubCheck();
  inputs.push(`pick closes (${CLOSES_PATH}): ${closes.length}; hub answers folder ${existsSync(hubDir()) ? 'found' : 'not found'}`);
  const retired = readRetired(root);
  inputs.push(`retired pool entries: ${retired.length}`);
  opts.say('scanning the repo for uses...');
  const uses = scanUses(drafts, root);
  inputs.push(`drafts a file of the repo uses: ${uses.size}`);
  const store = storeAssets(opts.out, { offline: opts.offline, refresh: opts.refresh, say: opts.say });
  inputs.push(`the drafts store: ${store.assets === null ? store.note : `${store.assets.length} assets in ${new Set(store.assets.map((a) => a.tag)).size} releases, ${store.note}`}`);

  const input: PruneInput = { drafts, owner, uses, closes, hubOk: hub, retired, nameHits: nameSearch(root), present: store.assets === null ? null : new Set(store.assets.map((a) => a.name)), now: opts.now ?? new Date() };
  const plan = planPrune(input);

  const byId = new Map(drafts.map((d) => [d.id, d]));
  writeFileSync(join(opts.out, 'remove.jsonl'), plan.remove.map((v) => {
    const d = byId.get(v.id)!;
    return JSON.stringify({ ...v, name: d.name, label: labelOf(d), tag: d.stored?.tag ?? null, assets: assetsOf(d), sha: { raw: d.files.raw.sha256, full: d.files.full?.sha256 ?? null, imported: d.files.imported?.sha256 ?? null } });
  }).join('\n') + (plan.remove.length > 0 ? '\n' : ''));

  const thumbDirs = [join(opts.out, 'thumbs'), join(libraryDir(), 'thumb')];
  const sheets: SheetInfo[] = [];
  for (const [rule, vs] of byRule(plan)) {
    if (vs.length === 0) { sheets.push({ rule, file: null, cells: [], missing: 0 }); continue; }
    const { doubtful, sample } = sampleFor(vs, opts.seed + Number(rule.slice(1)));
    const cells: { v: Verdict; doubt: boolean }[] = [...doubtful.map((v) => ({ v, doubt: true })), ...sample.map((v) => ({ v, doubt: false }))];
    const need = cells.map((c) => byId.get(c.v.id)!).filter((d) => findThumb(d.id, thumbDirs) === null);
    if (need.length > 0) ensureThumbs(need, thumbDirs[0]!, { say: opts.say });
    const files: string[] = [];
    const used: SheetInfo['cells'] = [];
    let missing = 0;
    for (const c of cells) {
      const p = findThumb(c.v.id, thumbDirs);
      if (p === null) { missing += 1; continue; }
      files.push(p);
      used.push({ n: files.length, id: c.v.id, name: byId.get(c.v.id)!.name, doubt: c.doubt });
    }
    const file = join(opts.out, `sheet-${rule}.png`);
    const made = makeSheet(files, file);
    sheets.push({ rule, file: made ? `sheet-${rule}.png` : null, cells: made ? used : [], missing });
  }
  const report = reportText({ plan, drafts, removedBefore: all.length - drafts.length, inputs, sheets, seed: opts.seed, now: opts.now ?? new Date() });
  writeFileSync(join(opts.out, 'report.md'), report);
  return { plan, report, total: plan.remove.length };
}

/** The one line for the manager: `PRUNE DRY <total> drafts <MB> MB: R1 n, R2 n, ...`. */
export function summaryLine(plan: Plan): string {
  const per = byRule(plan);
  const bytes = plan.remove.reduce((n, v) => n + v.bytes, 0);
  return `PRUNE DRY ${plan.remove.length} drafts ${mb(bytes)} MB: ${RULES.map((r) => `${r.rule} ${per.get(r.rule)!.length}`).join(', ')}`;
}

function flag(args: readonly string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

export function main(args: readonly string[]): number {
  const say = (t: string): void => void process.stdout.write(`${t}\n`);
  if (!args.includes('--dry')) {
    process.stderr.write('art:prune: only --dry is available before the manager\'s GO; it writes .scratch/prune/report.md and remove.jsonl and deletes nothing.\n');
    return 2;
  }
  const out = resolve(flag(args, '--out') ?? join(ROOT, '.scratch/prune'));
  const seed = Number(flag(args, '--seed') ?? DEFAULT_SEED);
  const result = dryRun({ out, seed, offline: args.includes('--offline'), refresh: args.includes('--refresh-store'), say });
  say(summaryLine(result.plan));
  say(`report: ${join(out, 'report.md')}`);
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
