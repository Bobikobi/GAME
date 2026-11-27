/**
 * Counts what the retry hides: reads the flake ledgers of CI runs (game/e2e/run.ts writes one `flakes.jsonl` per
 * job, CI keeps it as the artifact `e2e-flakes-<group>`) and prints, per script, the runs that passed only on a
 * retry, the runs that were red, and the most common first error.
 *
 *   gh run download <id> -p 'e2e-flakes-*' -D flakes/ && pnpm flakes flakes/
 *   node tools/src/flakes.ts <folder> | --table <file>      (--table: the job summary's markdown table of one file)
 *
 * Lives in tools/src, not game/e2e: it is a reader of downloaded records, not a browser test, and tools/test is
 * where its test runs. It imports only node, like docs-only.ts, so CI can run it with plain node.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface Record1 {
  group: string;
  script: string;
  result: 'retry_pass' | 'red';
  error: string;
  first_seconds: number;
  retry_seconds: number;
  commit: string;
  time: string;
}

export interface ScriptCount {
  group: string;
  script: string;
  retryPass: number;
  red: number;
  topError: string;
}

/** The lines of a JSONL text that are records; a line that does not parse is skipped, never thrown on. */
export function parseRecords(text: string): Record1[] {
  const out: Record1[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as Record1;
      if (r && typeof r.script === 'string' && (r.result === 'retry_pass' || r.result === 'red')) out.push(r);
    } catch {
      // a half-written line of a cancelled job
    }
  }
  return out;
}

/** Every `*.jsonl` under a folder, however deep (a downloaded artifact sits in a folder of its own). */
export function readFolder(dir: string): Record1[] {
  const out: Record1[] = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...readFolder(path));
    else if (name.endsWith('.jsonl')) out.push(...parseRecords(readFileSync(path, 'utf8')));
  }
  return out;
}

/** Per script: runs that passed on the retry, runs that failed twice, the most common first error (ties: the first seen). */
export function count(records: readonly Record1[]): ScriptCount[] {
  const by = new Map<string, { group: string; script: string; retryPass: number; red: number; errors: Map<string, number> }>();
  for (const r of records) {
    const key = `${r.group}/${r.script}`;
    const c = by.get(key) ?? { group: r.group, script: r.script, retryPass: 0, red: 0, errors: new Map() };
    if (r.result === 'red') c.red++;
    else c.retryPass++;
    c.errors.set(r.error, (c.errors.get(r.error) ?? 0) + 1);
    by.set(key, c);
  }
  return [...by.values()]
    .map((c) => ({ group: c.group, script: c.script, retryPass: c.retryPass, red: c.red, topError: [...c.errors].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '' }))
    .sort((a, b) => b.retryPass + b.red - (a.retryPass + a.red) || a.script.localeCompare(b.script));
}

/** The text report of `count`. */
export function report(records: readonly Record1[]): string {
  const rows = count(records);
  if (rows.length === 0) return 'no script needed a retry';
  return rows.map((r) => `${r.group}/${r.script}: ${r.retryPass} passed only on retry, ${r.red} red; most common first error: ${r.topError}`).join('\n');
}

/** The job summary of one ledger: a table titled "Passed only on retry"; empty text when the file holds no record. */
export function summaryTable(records: readonly Record1[]): string {
  if (records.length === 0) return '';
  const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ');
  const lines = ['### Passed only on retry', '', '| script | result | first attempt | retry | first error |', '|---|---|---|---|---|'];
  for (const r of records) {
    lines.push(`| ${cell(`${r.group}/${r.script}`)} | ${r.result === 'red' ? 'red (failed twice)' : 'passed on retry'} | ${r.first_seconds} s | ${r.retry_seconds} s | ${cell(r.error)} |`);
  }
  return lines.join('\n');
}

function main(): void {
  const [a, b] = process.argv.slice(2);
  if (a === '--table') {
    // never fails the job: a missing or unreadable ledger prints nothing
    try {
      if (b && existsSync(b)) console.log(summaryTable(parseRecords(readFileSync(b, 'utf8'))));
    } catch {
      // nothing to print
    }
    return;
  }
  if (!a || !existsSync(a)) {
    console.error('usage: flakes.ts <folder of downloaded flakes.jsonl> | --table <file>');
    process.exit(2);
  }
  console.log(report(readFolder(a)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
