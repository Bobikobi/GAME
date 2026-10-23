/**
 * Ids and citations: how a decision, a rule and an old reference are named, found in a text and resolved.
 *
 *   entry id     <yyyy-mm-dd>-<slug>, never renamed, never reused; the file is decisions/<yyyy-mm>/<id>.md
 *   rule id      <entry id>.<n>
 *   citation     dec:<entry id>[.<n>], G<n>, S<n> (ranges too), CR-<n>, NEXT <n>, OG/OR/SQ/KS<n>, and the
 *                legacy forms 'DECISIONS <date> <title words>' and 'decision <n> of <D.M>'
 *
 * One resolver, resolve(), answers for every system. Nothing here reads a file: the model of model.ts is
 * handed in, so a test resolves over a handful of in-memory entries.
 */
import type { Model } from './model';

/** <yyyy-mm-dd>-<1 to 6 words>, at most 48 characters. */
export const ENTRY_ID = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+){0,5}$/;
export const ENTRY_ID_MAX = 48;

/** A dec: citation. Groups: entry id, rule number. */
export const DEC_TOKEN = /\bdec:(\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*)(?:\.(\d+))?\b/g;

const STOP_WORDS = new Set('the a an of and is are to in its it on for by from with as at be that this one'.split(' '));

/**
 * The words of a legacy heading's title that name its id: lowercased, "(decision <n> of 22.10)" and the
 * possessive 's dropped, split on anything that is no letter or digit, stop words dropped.
 */
export function slugWords(title: string): string[] {
  const t = title
    .toLowerCase()
    .replace(/\(decision \d+ of 22\.10\)/g, ' ')
    .replace(/['’]s\b/g, '');
  return t.split(/[^a-z0-9]+/).filter((w) => w !== '' && !STOP_WORDS.has(w));
}

/** The slug of a legacy title: its first `words` words (four, or five when two headings would share one). */
export function legacySlug(title: string, words = 4): string {
  return slugWords(title).slice(0, words).join('-');
}

/** The id a heading gets: the date, then the slug, clipped from the end while it runs past 48 characters. */
export function legacyId(date: string, title: string, words = 4): string {
  const w = slugWords(title).slice(0, words);
  let id = `${date}-${w.join('-')}`;
  while (id.length > ENTRY_ID_MAX && w.length > 2) {
    w.pop();
    id = `${date}-${w.join('-')}`;
  }
  return id;
}

/** The ids of a log's headings, in order: four words, five where two would share an id. A clash that is left is returned in `clashes`. */
export function legacyIds(headings: readonly { date: string; title: string }[]): { ids: string[]; clashes: string[] } {
  const four = headings.map((h) => legacyId(h.date, h.title, 4));
  const count = new Map<string, number>();
  for (const id of four) count.set(id, (count.get(id) ?? 0) + 1);
  const ids = headings.map((h, i) => ((count.get(four[i]!) ?? 0) > 1 ? legacyId(h.date, h.title, 5) : four[i]!));
  const again = new Map<string, number>();
  for (const id of ids) again.set(id, (again.get(id) ?? 0) + 1);
  return { ids, clashes: [...again].filter(([, n]) => n > 1).map(([id]) => id) };
}

export type CitationKind = 'dec' | 'g' | 's' | 'r' | 'og' | 'or' | 'sq' | 'ks' | 'cr' | 'next' | 'title' | 'decision-of' | 'line' | 'date-only';

export interface Citation {
  kind: CitationKind;
  /** the text matched */
  raw: string;
  /** offset in the text read */
  index: number;
  /** dec: the entry id */
  id?: string;
  /** dec: the rule number; g, s, r, og, or, sq, ks, cr, next, line, decision-of: the number (the first of a range) */
  n?: number;
  /** a range's last number */
  to?: number;
  /** title and date-only: yyyy-mm-dd, or D.M for a date written that way */
  date?: string;
  /** title: the title words */
  words?: string;
}

const PATTERNS: { kind: CitationKind; re: RegExp }[] = [
  { kind: 'dec', re: new RegExp(DEC_TOKEN.source, 'g') },
  // 'G15', 'G30-G35', 'G30 to G35'; a dash before the digits marks a spec id (G-3), not a rule
  { kind: 'g', re: /(?<![\w-])G(\d{1,3})(?:\s*(?:-|–|to)\s*G?(\d{1,3}))?(?![\w-]*\d)/g },
  { kind: 's', re: /(?<![\w-])S(\d{1,2})(?:\s*(?:-|–|to)\s*S?(\d{1,2}))?(?![\w-]*\d)/g },
  { kind: 'r', re: /(?<![\w-])R(\d{1,2})(?:\s*(?:-|–|to)\s*R?(\d{1,2}))?(?![\w-]*\d)/g },
  { kind: 'og', re: /(?<![\w-])OG(\d{1,2})(?:\s*(?:-|–)\s*(?:OG)?(\d{1,2}))?(?![\w-]*\d)/g },
  { kind: 'or', re: /(?<![\w-])OR(\d{1,2})(?:\s*(?:-|–)\s*(?:OR)?(\d{1,2}))?(?![\w-]*\d)/g },
  { kind: 'sq', re: /(?<![\w-])SQ(\d{1,2})(?:\s*(?:-|–)\s*(?:SQ)?(\d{1,2}))?(?![\w-]*\d)/g },
  { kind: 'ks', re: /(?<![\w-])KS(\d{1,2})(?:\s*(?:-|–)\s*(?:KS)?(\d{1,2}))?(?![\w-]*\d)/g },
  { kind: 'cr', re: /(?<![\w-])CR-(\d{1,3})(?![\w-]*\d)/g },
  { kind: 'next', re: /(?<![\w-])NEXT (\d{1,2})(?!\d)/g },
  { kind: 'decision-of', re: /\bdecision (\d+) of (\d{1,2}\.\d{1,2})\b/g },
  { kind: 'line', re: /\bdec (\d{2,4})\b|\bDECISIONS(?:\.md)? (?:line )?(\d{2,4})\b/g },
];

/** 'DECISIONS', 'DECISIONS.md' within three characters of a date: ISO, or D.M with an optional year. Groups: date, rest of the line. */
const DECISIONS_DATE = /\bDECISIONS(?:\.md)?[^\w\n]{1,3}(?:(\d{4}-\d{2}-\d{2})|(\d{1,2}\.\d{1,2}(?:\.\d{4})?))(?![\d.]*\d)(.*)/g;

/**
 * The citations in a text, in order of appearance. `kinds` limits what is looked for (default: all).
 * The text is read raw: '${...}' expressions of a message source stay in it.
 */
export function citationsIn(text: string, kinds?: readonly CitationKind[]): Citation[] {
  const want = (k: CitationKind): boolean => kinds === undefined || kinds.includes(k);
  const out: Citation[] = [];
  for (const { kind, re } of PATTERNS) {
    if (!want(kind)) continue;
    for (const m of text.matchAll(re)) {
      const c: Citation = { kind, raw: m[0], index: m.index ?? 0 };
      if (kind === 'dec') {
        c.id = m[1];
        if (m[2] !== undefined) c.n = Number(m[2]);
      } else if (kind === 'decision-of') {
        c.n = Number(m[1]);
        c.date = m[2];
      } else if (kind === 'line') {
        c.n = Number(m[1] ?? m[2]);
      } else {
        c.n = Number(m[1]);
        if (m[2] !== undefined) c.to = Number(m[2]);
      }
      out.push(c);
    }
  }
  if (want('title') || want('date-only')) {
    for (const m of text.matchAll(DECISIONS_DATE)) {
      const date = (m[1] ?? m[2])!;
      const rest = m[3]!.replace(/^[,:)\s]+/, '').replace(/^["“]/, '');
      const words = rest.split(/\s+/).filter(Boolean);
      const titleWords = m[1] !== undefined && words.length >= 3 ? rest.replace(/["”)].*$/, '').trim() : '';
      if (titleWords !== '' && want('title')) out.push({ kind: 'title', raw: m[0], index: m.index ?? 0, date, words: titleWords });
      else if (want('date-only')) out.push({ kind: 'date-only', raw: m[0], index: m.index ?? 0, date });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

export interface Resolved {
  ok: boolean;
  /** what the citation points at: an entry id, a rule id, a page path */
  target?: string;
  /** when not ok: what is wrong, in the words of a message ("cites X, which ...") */
  message?: string;
  /** a warning, not an error (a G number reserved for a page that is not on develop yet) */
  warning?: boolean;
}

/** A G rule's book: the page that holds it, and whether its text counts as holding rules. */
export interface GBook {
  page: string;
  ranges: readonly (readonly [number, number])[];
  /** a draft page resolves and holds nothing until the owner says it holds */
  holding: boolean;
}

export const G_BOOKS: readonly GBook[] = [
  { page: 'docs/design/GAME_RULES.md', ranges: [[1, 49], [68, 70]], holding: true },
  { page: 'docs/design/OPEN_WORLD.md', ranges: [[50, 67]], holding: false },
  { page: 'docs/design/EMPTY_WORLD.md', ranges: [[100, 101]], holding: false },
];

/** G numbers reserved for a page that is not on develop yet: a citation warns until it lands. */
export const RESERVED_G: readonly { from: number; to: number; page: string; branch: string }[] = [
  { from: 78, to: 86, page: 'docs/design/COMBAT.md', branch: 'docs/combat-frame' },
  { from: 93, to: 99, page: 'docs/design/SAFETY.md', branch: 'docs/safety-contract' },
];

/** The names of standards and formats that look like an id (AGPL-3, UTF-8) and are never flagged. */
export const PREFIX_ALLOWLIST: readonly string[] = ['AGPL', 'UTF', 'SHA', 'AES', 'ISO', 'RFC', 'HTTP', 'CVE', 'ES', 'ECMA', 'GPL', 'FNV', 'FR'];

export interface IdSystem {
  name: string;
  /** an example of an id of the system */
  example: string;
  /** the dash prefixes (two or more letters) the system writes */
  prefixes: readonly string[];
  /** the system resolves to a target */
  resolves: boolean;
  /** a citation of it holds a rule */
  holds: boolean;
}

/** Every id system the repository knows. A dash-number id whose prefix is in none of them, nor in PREFIX_ALLOWLIST, fails id-systems. */
export const ID_SYSTEMS: readonly IdSystem[] = [
  { name: 'decision', example: 'dec:2026-10-23-whole-game-rich-every.2', prefixes: [], resolves: true, holds: true },
  { name: 'rules of play', example: 'G15', prefixes: [], resolves: true, holds: true },
  { name: 'rules of the story', example: 'S3', prefixes: [], resolves: true, holds: true },
  { name: 'kernel review', example: 'R11', prefixes: [], resolves: true, holds: false },
  { name: 'opening review', example: 'OG5, OR3', prefixes: [], resolves: true, holds: false },
  { name: 'settlement questions', example: 'SQ2', prefixes: [], resolves: true, holds: false },
  { name: 'kernel review, second list', example: 'KS1', prefixes: [], resolves: true, holds: false },
  { name: 'open ends', example: 'CR-60', prefixes: ['CR'], resolves: true, holds: false },
  { name: 'next sections', example: 'NEXT 14', prefixes: [], resolves: true, holds: false },
  { name: 'the grunt list', example: 'M2, P-5, S-3', prefixes: [], resolves: false, holds: false },
  { name: 'the product spec', example: 'G-3, V-5', prefixes: [], resolves: false, holds: false },
  { name: 'crafting audit', example: 'D-CRAFT-6', prefixes: ['CRAFT'], resolves: false, holds: false },
];

/** Every prefix id-systems accepts. */
export function knownPrefixes(): Set<string> {
  const out = new Set<string>(PREFIX_ALLOWLIST);
  for (const s of ID_SYSTEMS) for (const p of s.prefixes) out.add(p);
  return out;
}

/** Which G book defines the number, if any. */
export function bookOf(n: number): GBook | undefined {
  return G_BOOKS.find((b) => b.ranges.some(([a, z]) => n >= a && n <= z));
}

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length]!;
}

/** The ids closest to a misspelt one: the same day first, then by edit distance. At most `n`. */
export function nearestIds(id: string, ids: readonly string[], n = 2): string[] {
  const day = id.slice(0, 10);
  const words = new Set(id.slice(11).split('-'));
  return ids
    .map((x) => {
      const shared = x.slice(11).split('-').filter((w) => words.has(w)).length;
      return { x, score: shared * 3 + (x.startsWith(day) ? 2 : 0) - distance(id, x) / 20 };
    })
    .sort((a, b) => b.score - a.score || (a.x < b.x ? -1 : 1))
    .slice(0, n)
    .map((s) => s.x);
}

function range(from: number, to: number): string {
  return from === to ? String(from) : `${from}-${to}`;
}

/**
 * The one resolver. It says what a citation points at, or what is wrong with it, in the words a message
 * continues after "cites <raw>".
 */
export function resolve(c: Citation, model: Model): Resolved {
  switch (c.kind) {
    case 'dec': {
      const entry = model.entries.get(c.id!);
      if (!entry) {
        const near = nearestIds(c.id!, [...model.entries.keys()]);
        return { ok: false, message: `cites dec:${c.id}, which is no entry: the nearest ids are ${near.join(' and ')} (pnpm decisions find "<words>")` };
      }
      if (c.n === undefined) return { ok: true, target: entry.id };
      if (entry.legacy) return { ok: true, target: entry.id };
      const count = entry.rules?.length ?? 0;
      if (c.n < 1 || c.n > count) {
        const has = count === 0 ? 'no rules' : `rules ${range(1, count)}`;
        return { ok: false, message: `cites dec:${c.id}.${c.n}, which does not exist: that entry has ${has} (pnpm decisions show ${c.id})` };
      }
      return { ok: true, target: `${entry.id}.${c.n}` };
    }
    case 'g':
    case 's': {
      const prefix = c.kind === 'g' ? 'G' : 'S';
      const missing: string[] = [];
      for (let n = c.n!; n <= (c.to ?? c.n!); n++) {
        const id = `${prefix}${n}`;
        if (model.rulesOfPlay.has(id)) continue;
        const reserved = c.kind === 'g' ? RESERVED_G.find((r) => n >= r.from && n <= r.to) : undefined;
        if (reserved) {
          return {
            ok: false,
            warning: true,
            message: `cites ${prefix}${n}, which is reserved for ${reserved.page} (branch ${reserved.branch}), not on develop yet: it resolves when that page lands`,
          };
        }
        missing.push(id);
      }
      if (missing.length) return { ok: false, message: `cites ${missing.join(', ')}, which no rule page defines` };
      return { ok: true, target: `${prefix}${c.n}` };
    }
    case 'cr': {
      if (model.openEnds.has(c.n!)) return { ok: true, target: `CR-${c.n}` };
      const alias = model.aliases.get(`CR-${c.n}`);
      if (alias) return { ok: true, target: alias };
      return { ok: false, message: `cites CR-${c.n}, which is no open end of docs/team/GRUNT.md and no rule's alias: cite the rule it means (pnpm decisions find "<words>")` };
    }
    case 'next':
      return model.nextSections.has(String(c.n))
        ? { ok: true, target: `NEXT ${c.n}` }
        : { ok: false, message: `cites NEXT ${c.n}, which is no section of docs/team/NEXT.md` };
    case 'og':
    case 'or':
    case 'sq':
    case 'ks':
    case 'r': {
      const label = c.kind.toUpperCase();
      return model.pageIds.has(`${label}${c.n}`)
        ? { ok: true, target: `${label}${c.n}` }
        : { ok: false, message: `cites ${label}${c.n}, which its page does not define` };
    }
    case 'title': {
      const day = [...model.entries.values()].filter((e) => e.id.startsWith(c.date!));
      const words = c.words!.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
      const hit = day.filter((e) => {
        const t = e.title.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
        return words.every((w, i) => t[i] === w);
      });
      if (hit.length === 1) return { ok: true, target: hit[0]!.id };
      return {
        ok: false,
        message: hit.length === 0
          ? `cites DECISIONS ${c.date} "${c.words}", which begins no title of that day: cite the rule by id, dec:<id>.<n> (pnpm decisions show ${c.date})`
          : `cites DECISIONS ${c.date} "${c.words}", which begins ${hit.length} titles of that day: cite the rule by id (pnpm decisions show ${c.date})`,
      };
    }
    case 'decision-of': {
      const id = model.aliases.get(`decision ${c.n} of ${c.date}`);
      return id ? { ok: true, target: id } : { ok: false, message: `cites "decision ${c.n} of ${c.date}", which no entry's aliases name` };
    }
    case 'line': {
      const id = model.lineIds.get(c.n!);
      return id ? { ok: true, target: id } : { ok: false, message: `cites dec ${c.n}, a line of DECISIONS.md the line-ids ledger does not map: cite the rule by id` };
    }
    case 'date-only':
      return { ok: false, message: `cites DECISIONS by date only (${c.date}): cite the rule by id, dec:<id>.<n> (pnpm decisions show ${c.date} lists that day's entries and their rules)` };
  }
}
