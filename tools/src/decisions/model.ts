/**
 * The model: every decision, rule page and plan the checks read, in one structure, and the state each rule
 * is in. loadModel(io) reads through an io of { read, list }, so a test runs on in-memory files.
 *
 * While the cutover is null (legacy mode) the entries are the headings of DECISIONS.md: an id, a title, a
 * mark and the prose, with no rules. After it they are the files of decisions/<yyyy-mm>/.
 *
 * A rule's state, derived from the link fields of all the entries:
 *   replaced        a built rule (one with no open line) replaces it
 *   being replaced  only open rules replace it: its guards stay until the replacement is built
 *   paused          a current head or rule pauses it and nothing later resumes it
 *   open            it has an open line: decided, not built
 *   holds           none of the above; a disputed rule still holds
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Issue } from '../load';
import { gitReader, runGit, type GitRun } from './base';
import {
  CUTOVER,
  LEGACY_MARK_SIGNS,
  type Entry,
  type Field,
  fieldValues,
  headValue,
  listOf,
  parseEntry,
  parseRulebook,
  type Rule,
  type RuleOfPlay,
  type Rulebook,
} from './format';
import { legacyIds } from './ids';
import { nextSections, type NextSection } from './next';

export interface Io {
  /** the text of a repo file, or null when it does not exist */
  read(path: string): string | null;
  /** the repo files whose path starts with `prefix` ('' is all of them): tracked, plus new and not ignored */
  list(prefix: string): string[];
}

/** An io over in-memory files, for tests. */
export function memIo(files: Readonly<Record<string, string>>): Io {
  return {
    read: (path) => files[path] ?? null,
    list: (prefix) => Object.keys(files).filter((p) => p.startsWith(prefix)).sort(),
  };
}

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', '.vercel', '.scratch', '.astro']);

function walk(root: string, dir: string, out: string[]): void {
  for (const name of readdirSync(join(root, dir)).sort()) {
    if (SKIP_DIRS.has(name)) continue;
    const rel = dir ? `${dir}/${name}` : name;
    if (statSync(join(root, rel)).isDirectory()) walk(root, rel, out);
    else out.push(rel);
  }
}

export interface FsIo extends Io {
  /** true when this folder is no git checkout: the file list is a walk, and the checks against the base do not run */
  noGit: boolean;
}

/** The repository on disk. The file list is `git ls-files --cached --others --exclude-standard`, or a walk without git. */
export function fsIo(root: string, git: GitRun = runGit): FsIo {
  let all: string[] | null = null;
  let noGit = false;
  const files = (): string[] => {
    if (all) return all;
    const out = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'], root);
    if (out === null) {
      noGit = true;
      all = [];
      walk(root, '', all);
    } else {
      all = out.toString('utf8').split('\0').filter((p) => p !== '' && existsSync(join(root, p)));
    }
    return all;
  };
  return {
    read: (path) => {
      const abs = join(root, path);
      return existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, 'utf8') : null;
    },
    list: (prefix) => files().filter((p) => p.startsWith(prefix)),
    get noGit() {
      files();
      return noGit;
    },
  };
}

/** The repository as `ref` held it. A listing prefetches what it lists with one 'git cat-file --batch'. */
export function baseIo(ref: string, root: string, git: GitRun = runGit): Io {
  const cache = new Map<string, string | null>();
  return {
    read: (path) => {
      if (!cache.has(path)) for (const [p, t] of gitReader(ref, [path], root, git)) cache.set(p, t);
      return cache.get(path) ?? null;
    },
    list: (prefix) => {
      const listed = git(['ls-tree', '-r', '--name-only', ref, '--', prefix || '.'], root);
      const paths = listed === null ? [] : listed.toString('utf8').split('\n').filter((p) => p !== '' && p.startsWith(prefix));
      const missing = paths.filter((p) => !cache.has(p));
      for (const [p, t] of gitReader(ref, missing, root, git)) cache.set(p, t);
      return paths;
    },
  };
}

/** The rule pages and where the model reads each of them from. */
export const RULE_PAGES = [
  'docs/design/GAME_RULES.md',
  'docs/design/STORY.md',
  'docs/design/OPEN_WORLD.md',
  'docs/design/EMPTY_WORLD.md',
  'docs/design/OPENING_REVIEW.md',
  'docs/design/SETTLEMENT.md',
  'docs/kernel-review-v1.md',
] as const;

export const DECISIONS_LOG = 'DECISIONS.md';
export const GRUNT_FILE = 'docs/team/GRUNT.md';
export const STREAMS_FILE = 'docs/team/streams.json';
export const LINE_IDS_FILE = 'tools/src/decisions/ledger/line-ids.json';
export const DECISION_FILE = /^decisions\/(\d{4}-\d{2})\/([^/]+)\.md$/;

export interface RuleState {
  /** '<entry id>.<n>' */
  id: string;
  entry: Entry;
  rule: Rule;
  /** the built rules that replace this one */
  replacedBy: string[];
  /** the open rules that replace this one */
  beingReplacedBy: string[];
  /** the heads and rules that pause this one, not resumed */
  pausedBy: string[];
  /** the open line's value, or null */
  open: string | null;
  /** the disputed line's value, or null */
  disputed: string | null;
  /** nothing replaces it, nothing pauses it, it is not open and its entry is not paused */
  holds: boolean;
}

export interface Model {
  mode: 'legacy' | 'files';
  cutover: string | null;
  /** every entry by id */
  entries: Map<string, Entry>;
  /** the ids by date then id */
  order: string[];
  rulebooks: Rulebook[];
  /** 'G15', 'S3': the rules of the pages that define them */
  rulesOfPlay: Map<string, RuleOfPlay>;
  /** the ids the review pages define (R1, OG5, SQ2, KS1) */
  pageIds: Set<string>;
  /** the CR numbers of the Open ends table of GRUNT */
  openEnds: Set<number>;
  /** an alias ('decision 9 of 22.10', 'CR-60', a G rule's alias) to the entry or rule it names */
  aliases: Map<string, string>;
  /** DECISIONS.md line number at the cutover base to entry id, for the legacy 'dec <n>' form */
  lineIds: Map<number, string>;
  /** the sections of NEXT.md by id */
  nextSections: Map<string, NextSection>;
  streams: string[];
  /** every numbered rule of every entry */
  rules: Map<string, RuleState>;
  /** the entries a head's pauses names, by the pausing entry */
  retriedBy: Map<string, string[]>;
  pausedEntries: Map<string, string[]>;
  /** problems reading the files, as issues */
  problems: Issue[];
}

/** The date of an entry id. */
export function dateOf(id: string): string {
  return id.slice(0, 10);
}

const LEGACY_HEADING = /^## (\d{4}-\d{2}-\d{2}) (✅|❌|\u{1F501}|⏸|\(done\)) (.*)$/u;

/** The headings of DECISIONS.md read as entries: id, title, mark and prose; no rules. */
export function legacyEntries(text: string, problems: Issue[]): Entry[] {
  const lines = text.split('\n');
  const heads: { date: string; sign: string; title: string; at: number }[] = [];
  lines.forEach((line, i) => {
    if (!line.startsWith('## ')) return;
    const m = LEGACY_HEADING.exec(line);
    if (m) heads.push({ date: m[1]!, sign: m[2]!, title: m[3]!.trim(), at: i });
    else problems.push({ file: DECISIONS_LOG, where: `line ${i + 1}`, message: `"${line.slice(0, 60)}" is no heading of the log: "## <yyyy-mm-dd> <sign> <title>" [entry-format]`, level: 'error' });
  });
  const { ids, clashes } = legacyIds(heads);
  for (const id of clashes) problems.push({ file: DECISIONS_LOG, where: '', message: `two headings take the id ${id} even with five words: reword one title [entry-format]`, level: 'error' });
  return heads.map((h, i) => {
    const end = i + 1 < heads.length ? heads[i + 1]!.at : lines.length;
    const prose = lines.slice(h.at + 1, end);
    while (prose.length && prose[0] === '') prose.shift();
    while (prose.length && prose[prose.length - 1] === '') prose.pop();
    return {
      path: DECISIONS_LOG,
      id: ids[i]!,
      title: h.title,
      head: [{ key: 'mark', value: LEGACY_MARK_SIGNS[h.sign] ?? 'chosen', line: h.at + 1 }],
      state: null,
      prose: prose.join('\n'),
      rules: null,
      rulesLine: 0,
      legacy: true,
      problems: [],
    };
  });
}

function rulePageIds(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const m = /^(?:- )?(?:\*\*|\|\s*)(OG|OR|SQ|KS|R)(\d{1,2})\b/.exec(line);
    if (m) out.push(`${m[1]}${m[2]}`);
  }
  return out;
}

function openEndsOf(text: string): number[] {
  const out: number[] = [];
  const at = text.indexOf('\n## Open ends');
  if (at < 0) return out;
  for (const line of text.slice(at + 1).split('\n').slice(1)) {
    if (line.startsWith('## ')) break;
    const m = /^\| CR-(\d+) \|/.exec(line);
    if (m) out.push(Number(m[1]));
  }
  return out;
}

/** The day an entry's id says. */
function byDate(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Whether a rule field names a target that has a built replacement (no open line). */
export function isBuilt(rule: Rule): boolean {
  return fieldValues(rule, 'open').length === 0;
}

export function loadModel(io: Io, opts: { cutover?: string | null } = {}): Model {
  const cutover = opts.cutover === undefined ? CUTOVER : opts.cutover;
  const problems: Issue[] = [];
  const entries = new Map<string, Entry>();
  const mode = cutover === null ? 'legacy' : 'files';
  if (mode === 'legacy') {
    const log = io.read(DECISIONS_LOG);
    if (log !== null) for (const e of legacyEntries(log, problems)) if (!entries.has(e.id)) entries.set(e.id, e);
  } else {
    for (const path of io.list('decisions/')) {
      const m = DECISION_FILE.exec(path);
      if (!m) continue;
      const text = io.read(path);
      if (text === null) continue;
      const entry = parseEntry(path, text);
      if (entries.has(entry.id)) problems.push({ file: path, where: 'file', message: `the id ${entry.id} is taken by ${entries.get(entry.id)!.path} [entry-format]`, level: 'error' });
      else entries.set(entry.id, entry);
    }
  }
  const order = [...entries.keys()].sort(byDate);

  const rulebooks: Rulebook[] = [];
  const rulesOfPlay = new Map<string, RuleOfPlay>();
  const pageIds = new Set<string>();
  for (const page of RULE_PAGES) {
    const text = io.read(page);
    if (text === null) continue;
    const book = parseRulebook(page, text);
    rulebooks.push(book);
    for (const r of book.rules) {
      // a number defined twice stays the first, and id-systems says so
      if (!rulesOfPlay.has(r.id) && (r.id.startsWith('G') || page === 'docs/design/STORY.md')) rulesOfPlay.set(r.id, r);
    }
    for (const id of rulePageIds(text)) pageIds.add(id);
  }

  const grunt = io.read(GRUNT_FILE);
  const openEnds = new Set(grunt === null ? [] : openEndsOf(grunt));
  const next = io.read('docs/team/NEXT.md');
  const nextMap = new Map<string, NextSection>();
  if (next !== null) for (const s of nextSections(next)) if (!nextMap.has(s.id)) nextMap.set(s.id, s);
  let streams: string[] = [];
  const streamsText = io.read(STREAMS_FILE);
  if (streamsText !== null) {
    try {
      streams = ((JSON.parse(streamsText) as { streams?: { id: string }[] }).streams ?? []).map((s) => s.id);
    } catch {
      problems.push({ file: STREAMS_FILE, where: '', message: 'not valid JSON [entry-format]', level: 'error' });
    }
  }
  const lineIds = new Map<number, string>();
  const lineText = io.read(LINE_IDS_FILE);
  if (lineText !== null) {
    try {
      for (const [k, v] of Object.entries(JSON.parse(lineText) as Record<string, string>)) lineIds.set(Number(k), v);
    } catch {
      problems.push({ file: LINE_IDS_FILE, where: '', message: 'not valid JSON [entry-format]', level: 'error' });
    }
  }

  const aliases = new Map<string, string>();
  const rules = new Map<string, RuleState>();
  const retriedBy = new Map<string, string[]>();
  const pausedEntries = new Map<string, string[]>();
  const push = (map: Map<string, string[]>, key: string, value: string): void => {
    map.set(key, [...(map.get(key) ?? []), value]);
  };
  for (const id of order) {
    const e = entries.get(id)!;
    for (const a of (headValue(e, 'aliases') ?? '').split(';').map((s) => s.trim()).filter(Boolean)) if (!aliases.has(a)) aliases.set(a, id);
    for (const t of listOf(headValue(e, 'retries'))) push(retriedBy, t, id);
    for (const t of listOf(headValue(e, 'pauses'))) push(pausedEntries, t, id);
    for (const r of e.rules ?? []) {
      for (const v of fieldValues(r, 'aliases')) for (const a of v.split(/[;,]/).map((s) => s.trim()).filter(Boolean)) if (!aliases.has(a)) aliases.set(a, `${id}.${r.n}`);
      rules.set(`${id}.${r.n}`, {
        id: `${id}.${r.n}`,
        entry: e,
        rule: r,
        replacedBy: [],
        beingReplacedBy: [],
        pausedBy: [],
        open: fieldValues(r, 'open')[0] ?? null,
        disputed: fieldValues(r, 'disputed')[0] ?? null,
        holds: false,
      });
    }
  }
  for (const book of rulebooks) {
    for (const r of book.rules) for (const f of r.fields) if (f.key === 'aliases') for (const a of f.value.split(/[;,]/).map((s) => s.trim()).filter(Boolean)) if (!aliases.has(a)) aliases.set(a, r.id);
  }

  // links: replaces, then pauses and resumes
  const target = (value: string, ownEntry: string): string[] => listOf(value).map((t) => (t.includes('.') ? t : `${ownEntry}.${t}`));
  const resumed = new Set<string>();
  for (const st of rules.values()) for (const t of target(fieldValues(st.rule, 'resumes').join(','), st.entry.id)) resumed.add(t);
  for (const id of order) for (const t of listOf(headValue(entries.get(id)!, 'resumes'))) resumed.add(t);
  for (const st of rules.values()) {
    for (const t of listOf(fieldValues(st.rule, 'replaces').join(','))) {
      const old = rules.get(t);
      if (!old) continue;
      (isBuilt(st.rule) ? old.replacedBy : old.beingReplacedBy).push(st.id);
    }
  }
  const isCurrent = (st: RuleState): boolean => st.replacedBy.length === 0;
  for (const st of rules.values()) {
    for (const t of listOf(fieldValues(st.rule, 'pauses').join(','))) {
      if (!isCurrent(st) || resumed.has(t)) continue;
      const old = rules.get(t);
      if (old) old.pausedBy.push(st.id);
    }
  }
  for (const [paused, by] of pausedEntries) {
    if (resumed.has(paused)) continue;
    for (const [id, st] of rules) if (id.startsWith(`${paused}.`) && st.entry.id === paused) st.pausedBy.push(...by.filter((b) => entries.has(b)));
  }
  for (const st of rules.values()) {
    const mark = headValue(st.entry, 'mark');
    const paused = st.pausedBy.length > 0 || mark === 'paused';
    st.holds = st.replacedBy.length === 0 && st.beingReplacedBy.length === 0 && !paused && st.open === null && mark !== 'closed';
  }

  return { mode, cutover, entries, order, rulebooks, rulesOfPlay, pageIds, openEnds, aliases, lineIds, nextSections: nextMap, streams, rules, retriedBy, pausedEntries, problems };
}

/** Every head and rule field of an entry, for a check that walks them. */
export function allFields(entry: Entry): Field[] {
  return [...entry.head, ...(entry.rules ?? []).flatMap((r) => r.fields)];
}

/** git is on this machine and this folder is its checkout. */
export function hasGit(root: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
