/**
 * Reads every content file and sorts them into the bundle's shape. Shared by
 * `check` (which reports what is wrong) and `bundle` (which refuses to build
 * when anything is).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFile, type ExtensionFile, type SchemaIssue } from '@game/schema';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONTENT_DIR = join(REPO_ROOT, 'content');
export const LOCK_FILE = join(CONTENT_DIR, 'values.lock.json');

export interface Issue {
  /** path relative to the repo root */
  file: string;
  /** where inside the file, as a dotted path; '' for the whole file */
  where: string;
  message: string;
  level: 'error' | 'warning';
}

export interface Loaded {
  /** path relative to content/, with forward slashes */
  rel: string;
  /** absolute path */
  abs: string;
  data: ExtensionFile;
}

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (name.endsWith('.json')) out.push(abs);
  }
}

/** Every JSON content file, in a stable order. The value lock is not content. */
export function listContentFiles(root = CONTENT_DIR): string[] {
  const out: string[] = [];
  walk(root, out);
  return out.filter((f) => f !== LOCK_FILE && !f.endsWith(`${sep}package.json`));
}

export function toRepoPath(abs: string): string {
  return relative(REPO_ROOT, abs).split(sep).join('/');
}

/** "/node/yield" -> "node.yield" */
export function pointerToPath(pointer: string): string {
  return pointer.replace(/^\//, '').split('/').join('.');
}

/** Line and column of a JSON.parse error, when the engine reports a position. */
function parseErrorWhere(text: string, err: unknown): string {
  const m = /position (\d+)/.exec(String(err));
  if (!m) return '';
  const pos = Number(m[1]);
  const before = text.slice(0, pos);
  const line = before.split('\n').length;
  const col = pos - before.lastIndexOf('\n');
  return `line ${line}, column ${col}`;
}

export function loadAll(root = CONTENT_DIR): { files: Loaded[]; issues: Issue[] } {
  const files: Loaded[] = [];
  const issues: Issue[] = [];
  for (const abs of listContentFiles(root)) {
    const file = toRepoPath(abs);
    const text = readFileSync(abs, 'utf8');
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (err) {
      issues.push({ file, where: parseErrorWhere(text, err), message: `not valid JSON: ${String(err).replace(/^SyntaxError: /, '')}`, level: 'error' });
      continue;
    }
    const schemaIssues: SchemaIssue[] = validateFile(data);
    for (const s of schemaIssues) issues.push({ file, where: pointerToPath(s.path), message: s.message, level: 'error' });
    if (schemaIssues.length === 0) {
      files.push({ rel: relative(root, abs).split(sep).join('/'), abs, data: data as ExtensionFile });
    }
  }
  return { files, issues };
}
