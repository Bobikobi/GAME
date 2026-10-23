/**
 * The record format of a decision: one file, decisions/<yyyy-mm>/<id>.md.
 *
 *   # <title>
 *
 *   - <key>: <value>          the head, one plain Markdown list in HEAD_ORDER
 *
 *   <!-- state: ... -->       a generated block, only when due
 *
 *   <prose>                   the history as written
 *
 *   ## Rules
 *   1. <one statement a guard, a bind, a judge or a plan can answer for>
 *      - <field>: <value>
 *
 * parseEntry reads a file into an Entry plus the structural problems it found (the check turns them into
 * messages); renderEntry writes an Entry back, so a file that follows the format round-trips byte for byte.
 * parseRulebook reads the rules of play of a rule page (G<n> of GAME_RULES.md, S<n> of STORY.md) and the
 * indented status fields under them.
 */

/** The day the decision files take over from DECISIONS.md: null until the cutover, then 'yyyy-mm-dd'. */
export const CUTOVER: string | null = null;

export const MARKS = ['chosen', 'failed', 'retry', 'paused', 'closed'] as const;
export type Mark = (typeof MARKS)[number];

/** The sign of a legacy heading and the mark it stands for (the pause sign is mapped by the backfill, not by the sign). */
export const LEGACY_MARK_SIGNS: Readonly<Record<string, Mark>> = {
  '✅': 'chosen',
  '(done)': 'chosen',
  '❌': 'failed',
  '\u{1F501}': 'retry',
  '⏸': 'paused',
};

export const AREAS = [
  'systems',
  'story-quests',
  'platform',
  'art-pixels',
  'world-map',
  'content-pipeline',
  'ui-frame',
  'process',
  'tests-ci',
  'art-3d',
  'camera-view',
  'other',
] as const;
export type Area = (typeof AREAS)[number];

/** A new entry in one of these says whether it is a direction (the owner picks a direction). */
export const DIRECTION_AREAS: readonly string[] = ['art-pixels', 'art-3d', 'camera-view', 'ui-frame'];

/** The head keys in the order they must come, each at most once. */
export const HEAD_ORDER = [
  'mark',
  'area',
  'direction',
  'owner',
  'model',
  'branch',
  'pr',
  'retries',
  'pauses',
  'resumes',
  'replaces',
  'replaced-by',
  'aliases',
  'rules',
] as const;
export type HeadKey = (typeof HEAD_ORDER)[number];

/** The fields a rule may carry. */
export const RULE_FIELDS = ['from', 'replaces', 'pauses', 'resumes', 'amends', 'adds', 'open', 'judge', 'binds', 'retires', 'aliases', 'disputed'] as const;
export type RuleFieldKey = (typeof RULE_FIELDS)[number];

/** The fields that may repeat on one rule. */
export const REPEATING_FIELDS: readonly string[] = ['from', 'binds', 'retires'];

/** The fields a rule of a rule page may carry (its text changes in place, through an amending decision). */
export const PAGE_FIELDS = ['open', 'judge', 'binds', 'retires', 'disputed', 'aliases'] as const;

export const JUDGES = ['owner', 'review'] as const;

/** The shortest reason a judge or an opt-out may give. */
export const MIN_REASON = 20;

export const STATE_OPEN = '<!-- state: written by pnpm decisions views from the decision files; do not edit -->';
export const STATE_CLOSE = '<!-- /state -->';

/** A line of the owner's word in a new entry. Groups: day, month, year. */
export const OWNER_LINE = /^The owner, (\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?: .+$/;

/** The dated forms of the owner's word in a legacy entry. Groups: day, month. */
export const LEGACY_OWNER_DATED =
  /\bthe owner(?:,|'s word|'s answers? of| picked| asked| said| chose| answered)?\s*\(?(?:on |the same day, )?(\d{1,2})\.(\d{1,2})\b/gi;

/** The undated forms: they back the entry's own date. */
export const LEGACY_OWNER_UNDATED =
  /\b(?:[Tt]he owner|Elad)(?:'s yes|'s word|'s answer| ruled| asked| picked| chose| said| answered| found| played| approved| wants| wanted|:)/;

/** Words that say a rule replaces, pauses or undoes another. */
export const SUPERSESSION_WORDS =
  /\b(supersed\w*|replac\w*|no longer|instead of|overrid\w*|revers\w*|retir\w*|paus\w*|withdraw\w*|in place of|undoes)\b/i;

export interface Field {
  key: string;
  value: string;
  /** 1-based line of the file */
  line: number;
}

export interface Rule {
  n: number;
  /** the statement: its first line, then any continuation lines joined by a newline */
  text: string;
  fields: Field[];
  /** 1-based line of the "<n>. " line */
  line: number;
}

export interface Problem {
  /** 'head', 'file', 'text' or 'rules' for the file; 'rule <n>' for one rule */
  where: string;
  message: string;
  line: number;
}

export interface Entry {
  path: string;
  /** the id: the file name without its folder and extension */
  id: string;
  title: string;
  /** every head line in file order, so the check can say a key is repeated or out of order */
  head: Field[];
  /** the generated block, from its open marker to its close marker, or null */
  state: string | null;
  /** the history as written: the lines between the head (and the state block) and "## Rules", blank ends trimmed */
  prose: string;
  /** null when the file has no "## Rules" */
  rules: Rule[] | null;
  /** 1-based line of "## Rules", or 0 */
  rulesLine: number;
  /** true for an entry from DECISIONS.md read in legacy mode: no file, no rules */
  legacy: boolean;
  problems: Problem[];
}

const HEAD_LINE = /^- ([a-z][a-z-]*): ?(.*)$/;
const FIELD_LINE = /^ {3}- ([a-z][a-z-]*): ?(.*)$/;
const RULE_LINE = /^(\d+)\. ?(.*)$/;

/** "   - key: value" -> the field, or null when the line is no field. */
export function parseField(line: string, lineNo = 0, indent: 2 | 3 = 3): Field | null {
  const m = (indent === 3 ? FIELD_LINE : /^ {2}- ([a-z][a-z-]*): ?(.*)$/).exec(line);
  return m ? { key: m[1]!, value: m[2]!.trim(), line: lineNo } : null;
}

/** The value of a head key, or undefined. */
export function headValue(entry: Pick<Entry, 'head'>, key: string): string | undefined {
  return entry.head.find((f) => f.key === key)?.value;
}

/** The day of a head's owner list, ascending as written: ['2026-10-07', ...]. */
export function ownerDates(entry: Pick<Entry, 'head'>): string[] {
  const v = headValue(entry, 'owner');
  return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

/** A comma list of a head or field value. */
export function listOf(value: string | undefined): string[] {
  return value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

export function fieldValues(rule: Pick<Rule, 'fields'>, key: string): string[] {
  return rule.fields.filter((f) => f.key === key).map((f) => f.value);
}

/** The quoted passage of a from: field: the text between the first and the last double quote. */
export function fromQuote(value: string): string | null {
  const a = value.indexOf('"');
  const b = value.lastIndexOf('"');
  return a >= 0 && b > a ? value.slice(a + 1, b) : null;
}

export function parseEntry(path: string, text: string): Entry {
  const id = path.replace(/^.*\//, '').replace(/\.md$/, '');
  const problems: Problem[] = [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  else problems.push({ where: 'file', message: 'the file does not end with one final newline', line: lines.length });
  if (text.includes('\r')) problems.push({ where: 'file', message: 'the file has CR line ends: use LF', line: 1 });
  const entry: Entry = { path, id, title: '', head: [], state: null, prose: '', rules: null, rulesLine: 0, legacy: false, problems };
  let at = 0;
  const first = lines[0] ?? '';
  if (first.startsWith('# ')) {
    entry.title = first.slice(2).trim();
    at = 1;
  } else {
    problems.push({ where: 'head', message: 'line 1 is not a "# <title>" line', line: 1 });
  }
  // the head: the list that follows the title and one blank line
  while (at < lines.length && lines[at] === '') at++;
  while (at < lines.length) {
    const m = HEAD_LINE.exec(lines[at]!);
    if (!m) break;
    entry.head.push({ key: m[1]!, value: m[2]!.trim(), line: at + 1 });
    at++;
  }
  while (at < lines.length && lines[at] === '') at++;
  // the state block
  if (lines[at] === STATE_OPEN) {
    const from = at;
    while (at < lines.length && lines[at] !== STATE_CLOSE) at++;
    if (at < lines.length) {
      entry.state = lines.slice(from, at + 1).join('\n');
      at++;
    } else {
      problems.push({ where: 'text', message: 'the state block is not closed', line: from + 1 });
    }
    while (at < lines.length && lines[at] === '') at++;
  }
  // the prose, up to "## Rules" (the last such line)
  let rulesAt = -1;
  for (let i = at; i < lines.length; i++) if (lines[i] === '## Rules') rulesAt = i;
  const proseEnd = rulesAt >= 0 ? rulesAt : lines.length;
  const proseLines = lines.slice(at, proseEnd);
  while (proseLines.length && proseLines[proseLines.length - 1] === '') proseLines.pop();
  entry.prose = proseLines.join('\n');
  if (rulesAt >= 0) {
    entry.rulesLine = rulesAt + 1;
    entry.rules = [];
    let cur: Rule | null = null;
    for (let i = rulesAt + 1; i < lines.length; i++) {
      const line = lines[i]!;
      if (line === '') continue;
      const rm = RULE_LINE.exec(line);
      if (rm && !line.startsWith(' ')) {
        cur = { n: Number(rm[1]), text: rm[2]!, fields: [], line: i + 1 };
        entry.rules.push(cur);
        continue;
      }
      if (!cur) {
        problems.push({ where: 'rules', message: `"${line.trim()}" comes before the first numbered rule`, line: i + 1 });
        continue;
      }
      const f = parseField(line, i + 1);
      if (f) cur.fields.push(f);
      else if (line.startsWith('   ') && !cur.fields.length) cur.text += `\n${line.slice(3)}`;
      else problems.push({ where: `rule ${cur.n}`, message: `"${line.trim()}" is neither a field nor a continuation line of the rule: indent three spaces`, line: i + 1 });
    }
  }
  return entry;
}

/** The file text of an entry. A file that follows the format reads back byte for byte. */
export function renderEntry(entry: Entry): string {
  const out: string[] = [`# ${entry.title}`, ''];
  for (const f of entry.head) out.push(`- ${f.key}: ${f.value}`.trimEnd());
  out.push('');
  if (entry.state !== null) out.push(entry.state, '');
  if (entry.prose !== '') out.push(entry.prose);
  if (entry.rules !== null) {
    if (entry.prose !== '') out.push('');
    out.push('## Rules', '');
    for (const r of entry.rules) {
      const [first, ...rest] = r.text.split('\n');
      out.push(`${r.n}. ${first}`);
      for (const c of rest) out.push(`   ${c}`);
      for (const f of r.fields) out.push(`   - ${f.key}: ${f.value}`);
    }
  }
  return `${out.join('\n')}\n`;
}

/** A rule of play or of the story on a rule page. */
export interface RuleOfPlay {
  /** 'G15', 'S3' */
  id: string;
  name: string;
  /** the bullet without its fields, continuation lines joined by one space */
  text: string;
  fields: Field[];
  /** 1-based line of the bullet */
  line: number;
  path: string;
}

export interface Rulebook {
  path: string;
  rules: RuleOfPlay[];
}

const PAGE_RULE = /^(?:- )?\*\*([GS]\d+)(?:\.| ) ?(.*?)\*\*(?: (.*))?$/;

/**
 * The rules of a rule page. A rule stays "- **G<n> <Name>.** <text>" with two-space continuation lines;
 * OPEN_WORLD.md's "**G<n>. <Name>.**" is read too. Its fields are two-space sub-bullets under it.
 */
export function parseRulebook(path: string, text: string): Rulebook {
  const rules: RuleOfPlay[] = [];
  const lines = text.split('\n');
  let cur: RuleOfPlay | null = null;
  let body: string[] = [];
  const close = (): void => {
    if (cur) cur.text = body.join(' ').replace(/\s+/g, ' ').trim();
    cur = null;
    body = [];
  };
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith('```')) fence = !fence;
    if (fence) continue;
    const m = PAGE_RULE.exec(line);
    if (m) {
      close();
      const name = m[2]!.replace(/\.$/, '').trim();
      cur = { id: m[1]!, name, text: '', fields: [], line: i + 1, path };
      rules.push(cur);
      if (m[3]) body.push(m[3]);
      continue;
    }
    if (!cur) continue;
    if (/^#{1,6} /.test(line) || (/^(- |\* |\d+\. |\*\*)/.test(line) && !line.startsWith(' '))) {
      close();
      continue;
    }
    if (line.trim() === '') {
      // a blank line ends a bullet's continuation, but an OPEN_WORLD rule runs over paragraphs until the next rule or heading
      body.push('');
      continue;
    }
    const f = parseField(line, i + 1, 2);
    if (f && (PAGE_FIELDS as readonly string[]).includes(f.key)) {
      cur.fields.push(f);
      continue;
    }
    body.push(line.trim());
  }
  close();
  return { path, rules };
}
