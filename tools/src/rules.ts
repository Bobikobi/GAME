/**
 * pnpm rules [--write] [--json]
 *
 * One "current rules" page from DECISIONS.md and the rule pages: for every
 * rule id (G, R, STORY S, SETTLEMENT S, CR) the rule's own sentence, then the
 * latest DECISIONS entries that name it, newest first. An entry that a later
 * entry superseded in part shows the superseded line folded under the entry
 * that replaced it, so a reader sees the latest word on each topic first.
 *
 * Nothing here edits a rule page. `--write` saves docs/design/RULES_CURRENT.md;
 * without it the page goes to stdout. `--json` prints the model instead.
 * The review that asked for this page is docs/design/RULES_REVIEW.md.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './load';

export interface Supersession {
  /** The date in the line, as written: `10.10`. */
  when: string;
  /** The superseded part, as the entry states it. */
  text: string;
  /** Titles of the entries the line points at (`the entry on ...`), resolved. */
  by: string[];
  /** Phrases that no entry title matched. */
  unresolved: string[];
}

export interface Entry {
  date: string;
  status: string;
  title: string;
  /** 1-based line of the heading in DECISIONS.md. */
  line: number;
  /** Body without the trailing meta lines. */
  body: string;
  supersedes: string[];
  supersededInPart: Supersession[];
  closes: string[];
  retry?: string;
}

export interface Rule {
  /** Page name: GAME_RULES, OPEN_WORLD, kernel, STORY, SETTLEMENT, GRUNT. */
  page: string;
  id: string;
  title: string;
  /** The rule's text after the title, one paragraph or table row. */
  text: string;
  line: number;
}

export interface Mention {
  entry: Entry;
  /** True when a later entry superseded this one in part or whole. */
  folded: boolean;
}

export interface CurrentRule extends Rule {
  mentions: Mention[];
}

export interface RulesModel {
  entries: Entry[];
  rules: CurrentRule[];
  /** Reference phrases no entry title matched, for the report. */
  unresolved: string[];
}

const HEADING = /^## (\d{4}-\d{2}-\d{2}) (\S+) (.+)$/;
const META = /^\*\*(Supersedes|Superseded in part(?: \(([0-9.]+)\))?|Closes|Retry when):\*\*\s*(.*)$/;
const REF = /the entr(?:y|ies) on ([^).;]+)/g;

/** Split DECISIONS.md into entries, in file order. */
export function parseDecisions(text: string): Entry[] {
  const lines = text.split('\n');
  const entries: Entry[] = [];
  let current: Entry | undefined;
  let body: string[] = [];
  const close = (): void => {
    if (current) {
      current.body = body.join('\n').trim();
      entries.push(current);
    }
    body = [];
  };
  lines.forEach((raw, i) => {
    const h = HEADING.exec(raw);
    if (h) {
      close();
      current = { date: h[1] ?? '', status: h[2] ?? '', title: (h[3] ?? '').trim(), line: i + 1, body: '', supersedes: [], supersededInPart: [], closes: [] };
      return;
    }
    if (!current) return;
    const m = META.exec(raw);
    if (!m) {
      body.push(raw);
      return;
    }
    const kind = m[1] ?? '';
    const rest = (m[3] ?? '').trim();
    if (kind === 'Supersedes') current.supersedes.push(rest);
    else if (kind.startsWith('Superseded in part')) current.supersededInPart.push({ when: m[2] ?? '', text: rest, by: [], unresolved: [] });
    else if (kind === 'Closes') current.closes.push(rest);
    else current.retry = rest;
  });
  close();
  return entries;
}

const SMALL = new Set(['the', 'and', 'on', 'of', 'a', 'an', 'in', 'to', 'for', 'its', 'is', 'as', 'at', 'by']);

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !SMALL.has(w));
}

/**
 * Find the entry a phrase like "the shared world" or "the game read as one
 * line" points at: the title that holds the most of the phrase's words, at
 * least three in five. Ties go to the earliest entry, since a reference names
 * an entry already written.
 */
export function resolveRef(phrase: string, entries: Entry[]): Entry | undefined {
  const want = words(phrase.replace(/,\s*\d+(\.\d+)?\s*$/, '').replace(/\s+(above|below|holds)$/, ''));
  if (want.length === 0) return undefined;
  let best: Entry | undefined;
  let bestScore = 0;
  for (const e of entries) {
    const have = new Set(words(e.title));
    const hit = want.filter((w) => have.has(w)).length;
    const score = hit / want.length;
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return bestScore >= 0.6 ? best : undefined;
}

/** Fill `by` on every supersession line from its "the entry on ..." phrases. */
export function resolveSupersessions(entries: Entry[]): string[] {
  const unresolved: string[] = [];
  for (const e of entries) {
    for (const s of e.supersededInPart) {
      for (const m of s.text.matchAll(REF)) {
        for (const phrase of (m[1] ?? '').split(/\band on\b/)) {
          const p = phrase.trim();
          if (!p) continue;
          const target = resolveRef(p, entries);
          if (target && target !== e) s.by.push(target.title);
          else {
            s.unresolved.push(p);
            unresolved.push(p);
          }
        }
      }
    }
  }
  return unresolved;
}

/** Rule ids and their pages. The S ids live on two pages (RULES_REVIEW case 9). */
export const RULE_PAGES: Array<{ page: string; path: string }> = [
  { page: 'GAME_RULES', path: 'docs/design/GAME_RULES.md' },
  { page: 'OPEN_WORLD', path: 'docs/design/OPEN_WORLD.md' },
  { page: 'kernel', path: 'docs/kernel-review-v1.md' },
  { page: 'STORY', path: 'docs/design/STORY.md' },
  { page: 'SETTLEMENT', path: 'docs/design/SETTLEMENT.md' },
  { page: 'GRUNT', path: 'docs/team/GRUNT.md' },
];

const BOLD_RULE = /^(?:- )?\*\*((?:G|R|S)\d+b?)\.? ([^*]+?)\.?\*\*\s*(.*)$/;
const CR_ROW = /^\| (CR-\d+) \| (.*?) \|/;

/** Parse one rule page: `**Gnn Title.** text`, `- **Sn Title.** text`, `| CR-n | problem |`. */
export function parseRulePage(page: string, text: string): Rule[] {
  const rules: Rule[] = [];
  const seen = new Set<string>();
  const lines = text.split('\n');
  lines.forEach((raw, i) => {
    const line = raw.trim();
    const b = BOLD_RULE.exec(line);
    if (b) {
      const id = b[1] ?? '';
      if (seen.has(id)) return;
      seen.add(id);
      let body = (b[3] ?? '').trim();
      // A wrapped bullet (GAME_RULES) or a paragraph rule (OPEN_WORLD, the kernel review) runs on
      // until a blank line or the next rule; the lines are joined with one space.
      for (let j = i + 1; j < lines.length; j++) {
        const next = (lines[j] ?? '').trim();
        if (!next || BOLD_RULE.test(next) || next.startsWith('#')) break;
        body = `${body} ${next}`.trim();
      }
      rules.push({ page, id, title: (b[2] ?? '').trim(), text: body, line: i + 1 });
      return;
    }
    const cr = CR_ROW.exec(line);
    const crId = cr?.[1];
    if (cr && crId && !seen.has(crId)) {
      seen.add(crId);
      rules.push({ page, id: crId, title: (cr[2] ?? '').trim(), text: '', line: i + 1 });
    }
  });
  return rules;
}

function mentionPattern(id: string): RegExp {
  return new RegExp(`(^|[^A-Za-z0-9-])${id.replace('-', '\\-')}(?![0-9A-Za-z])`);
}

function isSuperseded(e: Entry, entries: Entry[]): boolean {
  if (e.supersededInPart.length > 0) return true;
  const title = e.title.toLowerCase();
  return entries.some((o) => o !== e && o.supersedes.some((s) => s.toLowerCase().includes(title.slice(0, 24))));
}

/** Join the entries to the rules: every entry that names a rule id, newest first, superseded ones marked. */
export function buildModel(rules: Rule[], entries: Entry[]): RulesModel {
  const unresolved = resolveSupersessions(entries);
  const byDate = [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.line - b.line));
  const current: CurrentRule[] = rules.map((r) => {
    const re = mentionPattern(r.id);
    const mentions = byDate.filter((e) => re.test(e.title) || re.test(e.body)).map((entry) => ({ entry, folded: isSuperseded(entry, entries) }));
    return { ...r, mentions };
  });
  return { entries, rules: current, unresolved };
}

/** Render the model as one Markdown page. */
export function renderCurrent(model: RulesModel): string {
  const out: string[] = [];
  out.push('# The current rules');
  out.push('');
  out.push('Generated by `pnpm rules` from DECISIONS.md and the rule pages. Do not edit; edit the pages and the entries.');
  out.push(`Entries read: ${model.entries.length}. Rules read: ${model.rules.length}. Entries superseded in part: ${model.entries.filter((e) => e.supersededInPart.length > 0).length}.`);
  out.push('');
  let page = '';
  for (const r of model.rules) {
    if (r.page !== page) {
      page = r.page;
      out.push(`## ${page}`);
      out.push('');
    }
    out.push(`### ${r.id} ${r.title}`);
    if (r.text) out.push(r.text);
    const live = r.mentions.filter((m) => !m.folded);
    const folded = r.mentions.filter((m) => m.folded);
    if (live.length > 0) {
      out.push('');
      out.push('Latest word:');
      for (const m of live.slice(0, 5)) out.push(`- ${m.entry.date} ${m.entry.status} ${m.entry.title}`);
    }
    if (folded.length > 0) {
      out.push('');
      out.push(`<details><summary>Folded: ${folded.length} superseded in part or whole</summary>`);
      out.push('');
      for (const m of folded) {
        out.push(`- ${m.entry.date} ${m.entry.status} ${m.entry.title}`);
        for (const s of m.entry.supersededInPart) out.push(`  - superseded (${s.when || 'later'}): ${s.text}${s.by.length ? ` -> ${s.by.join('; ')}` : ''}`);
      }
      out.push('');
      out.push('</details>');
    }
    out.push('');
  }
  if (model.unresolved.length > 0) {
    out.push('## References no entry title matched');
    out.push('');
    for (const u of [...new Set(model.unresolved)].sort()) out.push(`- the entry on ${u}`);
    out.push('');
  }
  return `${out.join('\n')}\n`;
}

/** Read the repository (or `root`) and build the model. */
export function loadModel(root: string = REPO_ROOT): RulesModel {
  const entries = parseDecisions(readFileSync(join(root, 'DECISIONS.md'), 'utf8'));
  const rules: Rule[] = [];
  for (const p of RULE_PAGES) {
    const file = join(root, p.path);
    if (existsSync(file)) rules.push(...parseRulePage(p.page, readFileSync(file, 'utf8')));
  }
  return buildModel(rules, entries);
}

export const CURRENT_PAGE = 'docs/design/RULES_CURRENT.md';

function main(): void {
  const args = process.argv.slice(2);
  const model = loadModel();
  if (args.includes('--json')) {
    console.log(JSON.stringify({ entries: model.entries.length, rules: model.rules.map((r) => ({ page: r.page, id: r.id, mentions: r.mentions.length })), unresolved: model.unresolved }, null, 2));
    return;
  }
  const page = renderCurrent(model);
  if (args.includes('--write')) {
    writeFileSync(join(REPO_ROOT, CURRENT_PAGE), page);
    console.log(`${CURRENT_PAGE}: ${model.rules.length} rules, ${model.entries.length} entries, ${model.unresolved.length} unresolved references.`);
  } else process.stdout.write(page);
}

if (process.argv[1] && /rules\.(ts|js)$/.test(process.argv[1])) main();
