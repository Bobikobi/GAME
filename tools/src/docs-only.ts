/**
 * Is a pull request docs only? Docs-only pull requests skip the browser tests in CI (.github/workflows/ci.yml,
 * DECISIONS.md 2026-10-27): nothing the game builds or plays has changed, so a minute of Chrome would test prose.
 *
 * A file is prose when it is under `docs/`, a Markdown file anywhere but `game/` (the game's build reads that tree),
 * `DECISIONS.md`, a prompt under `.github/prompts/`, or a kit-gen spec `tools/kit-gen/*.json`. A pull request is docs
 * only when it changes at least one file and every file it changes is prose. An empty list is NOT docs only: a diff
 * that could not be read must never skip the browser tests.
 *
 * CI runs it with plain node (it imports only node, like game/e2e/run.ts), fed `git diff -z --no-renames --name-only`
 * (no renames, so the old path of a moved file is listed too):
 *   git diff -z --no-renames --name-only HEAD^1 HEAD | node tools/src/docs-only.ts
 * It prints the verdict as a line `docs_only=true|false` on stdout (CI appends it to the step's outputs) and the
 * changed files with their kind on stderr (the job log).
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Prose that no browser test reads. Paths are repository-relative with forward slashes. */
export function isProse(path: string): boolean {
  if (path.startsWith('docs/')) return true;
  if (path === 'DECISIONS.md') return true;
  if (path.startsWith('.github/prompts/')) return true;
  if (/^tools\/kit-gen\/[^/]+\.json$/.test(path)) return true;
  return path.endsWith('.md') && !path.startsWith('game/');
}

/** True when the list is not empty and every path in it is prose. */
export function isDocsOnly(paths: readonly string[]): boolean {
  return paths.length > 0 && paths.every(isProse);
}

/** Split `git diff -z` output (NUL-separated); a plain newline list works too when no NUL is present. */
export function parsePaths(text: string): string[] {
  const parts = text.includes('\0') ? text.split('\0') : text.split('\n');
  return parts.filter((p) => p.length > 0);
}

// run directly (and not imported by a test): read stdin, print the verdict
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const paths = parsePaths(readFileSync(0, 'utf8'));
  for (const path of paths) console.error(`${isProse(path) ? 'prose' : 'code '}  ${path}`);
  const docsOnly = isDocsOnly(paths);
  console.error(paths.length === 0 ? 'no changed files listed: not docs only' : `${paths.length} changed file(s): ${docsOnly ? 'docs only, the browser tests are skipped' : 'not docs only, the browser tests run'}`);
  console.log(`docs_only=${docsOnly}`);
}
