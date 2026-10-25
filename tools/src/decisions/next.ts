/**
 * next-status: every section of docs/team/NEXT.md says where it stands.
 *
 * A section is a heading '## <id>. <title>'. Its first non-empty line is a Status line in one grammar:
 *
 *   Status: open | building - <stream id> | built (#<n>[, #<n>]) | built - <where> | paused - <why> | dropped - <why>
 *
 * The 22 numbered sections are a frozen legacy list. A new section takes a slug id ('## <slug>. <title>'),
 * so two streams that add a section in parallel cannot pick the same number.
 */
import type { Issue } from '../load';

export const NEXT_FILE = 'docs/team/NEXT.md';

/** The numbered sections that existed when the slug rule came in; no new number joins them. */
export const LEGACY_SECTION_IDS: readonly string[] = Array.from({ length: 22 }, (_, i) => String(i + 1));

const CHECK = '[next-status]';
const HEADING = /^## (\S+?)\. (.+)$/;
const SLUG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const NUMERIC = /^\d+$/;

export interface NextSection {
  id: string;
  title: string;
  /** 1-based line of the heading */
  line: number;
  /** the text after 'Status:' on the first non-empty line, or null when that line is not a Status line */
  status: string | null;
}

export type NextStatus =
  | { kind: 'open' }
  | { kind: 'building'; stream: string }
  | { kind: 'built'; prs: number[] }
  | { kind: 'built-where'; where: string }
  | { kind: 'paused'; why: string }
  | { kind: 'dropped'; why: string };

/** The '## <id>. <title>' sections of NEXT.md, in order; other '## ' headings are not sections. */
export function nextSections(text: string): NextSection[] {
  const lines = text.split(/\r?\n/);
  const out: NextSection[] = [];
  lines.forEach((line, i) => {
    const m = HEADING.exec(line);
    if (!m) return;
    let status: string | null = null;
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j]!.trim();
      if (next === '') continue;
      const s = /^Status:\s*(.*)$/.exec(next);
      if (s) status = s[1]!.trim();
      break;
    }
    out.push({ id: m[1]!, title: m[2]!.trim(), line: i + 1, status });
  });
  return out;
}

/** Reads the text after 'Status:'; null when it breaks the grammar. */
export function parseStatus(text: string): NextStatus | null {
  const t = text.trim();
  if (t === 'open') return { kind: 'open' };
  let m = /^building - ([a-z0-9][a-z0-9-]*)$/.exec(t);
  if (m) return { kind: 'building', stream: m[1]! };
  m = /^built \((#\d+(?:, #\d+)*)\)$/.exec(t);
  if (m) return { kind: 'built', prs: m[1]!.split(', ').map((p) => Number(p.slice(1))) };
  m = /^built - (\S.*)$/.exec(t);
  if (m) return { kind: 'built-where', where: m[1]! };
  m = /^(paused|dropped) - (\S.*)$/.exec(t);
  if (m) return m[1] === 'paused' ? { kind: 'paused', why: m[2]! } : { kind: 'dropped', why: m[2]! };
  return null;
}

const GRAMMAR =
  '"Status: open", "Status: building - <stream id>", "Status: built (#<pull request>)", "Status: built - <where>", "Status: paused - <why>" or "Status: dropped - <why>"';

/**
 * `streamIds` are the ids of docs/team/streams.json. `merged` holds the pull request numbers the develop
 * history names; when it is undefined (no git here) a 'built (#n)' line is taken as written.
 */
export function checkNext(text: string, streamIds: readonly string[], merged?: ReadonlySet<number>): Issue[] {
  const issues: Issue[] = [];
  const err = (where: string, message: string): void => {
    issues.push({ file: NEXT_FILE, where, message: `${message} ${CHECK}`, level: 'error' });
  };
  const seen = new Map<string, NextSection>();
  for (const s of nextSections(text)) {
    const where = `section ${s.id}`;
    const first = seen.get(s.id);
    if (first) {
      err(
        where,
        `two sections take the id ${s.id} ("${first.title}" and "${s.title}"), which a parallel merge leaves behind: give the later one a slug id (## <slug>. <title>) and fix the "NEXT ${s.id}" citations that meant it (git grep -n "NEXT ${s.id}")`,
      );
    } else seen.set(s.id, s);
    if (NUMERIC.test(s.id)) {
      if (!LEGACY_SECTION_IDS.includes(s.id)) {
        err(where, `"${s.title}" takes a new number: the 22 numbered sections are a frozen list, and a new section takes a slug id (## <slug>. <title>), so two streams cannot pick the same number`);
      }
    } else if (!SLUG.test(s.id)) {
      err(where, `"${s.id}" is not a slug id: use lowercase words joined by hyphens (## <slug>. <title>)`);
    }
    if (s.status === null) {
      err(where, `"${s.title}" has no Status line: add ${GRAMMAR} as the first line under the heading`);
      continue;
    }
    const status = parseStatus(s.status);
    if (!status) {
      err(where, `"Status: ${s.status}" breaks the grammar: write ${GRAMMAR}`);
      continue;
    }
    if (status.kind === 'building' && !streamIds.includes(status.stream)) {
      err(where, `"building - ${status.stream}" names no stream of docs/team/streams.json: name one of its ids (pnpm streams lists them)`);
    }
    if (status.kind === 'built' && merged) {
      for (const pr of status.prs.filter((n) => !merged.has(n))) {
        err(where, `"built (#${pr})": no commit on develop names #${pr}: name the pull request that landed it, or write "building - <stream id>" until it merges`);
      }
    }
  }
  return issues;
}
