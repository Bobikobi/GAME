/**
 * The public tree carries nothing that belongs to one person's machine: no home-directory path, no private
 * tool, no personal address. `pnpm private` (part of `pnpm verify`, so part of CI) fails when a tracked file
 * names one. The patterns are written as regular expressions, so this file does not match itself.
 *
 * One more rule needs the tree itself: a path into the art tools (`tools/art/...`, `tools/src/art/...`) that git does not
 * track. The art tools that make lands live in a private repo; a comment that points at one of them names a tool the public
 * tree does not have. The rule lists no names: a path is a hit exactly when it is not here. The decisions log is left
 * out of this one rule: it records the paths of files the repo has since removed, and a removed file is history, not a
 * private tool.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface PrivateRule {
  /** what the pattern catches, in words (never the string itself) */
  what: string;
  pattern: RegExp;
}

export const PRIVATE_RULES: readonly PrivateRule[] = [
  { what: "a path in a person's home directory", pattern: /(?<![\w.-])\/home\/[A-Za-z]/ },
  { what: "the owner's private tool folder", pattern: /(?:~|\$HOME|\$\{HOME\})\/\.claude\b/ },
  { what: "the owner's job-throttling script", pattern: /\bheavy\.sh\b/ },
  { what: "the owner's browser-opening script", pattern: /\bopen-url\.sh\b/ },
  { what: "the owner's personal e-mail address", pattern: /\beladeladsaa@/i },
];

/** Files that may say anything: lockfiles carry registry URLs and hashes, not prose. */
export const ALLOWED_FILES: readonly RegExp[] = [/(^|\/)pnpm-lock\.yaml$/, /(^|\/)package-lock\.json$/, /(^|\/)yarn\.lock$/];

const MAX_BYTES = 5_000_000;

/** What the art-path rule says of a hit. */
export const ART_PATH_WHAT = 'a path to an art tool that is not in this repo';

/** Files the art-path rule does not read (every other rule still does). */
export const ART_PATH_HISTORY: readonly RegExp[] = [/^DECISIONS\.md$/];

const ART_PATH = /\btools\/(?:src\/)?art\/[\w.-]+(?:\/[\w.-]+)*/g;

/** Every tracked file and every folder above one, so a path to either is known. */
export function knownPaths(files: readonly string[]): Set<string> {
  const known = new Set<string>();
  for (const f of files) {
    known.add(f);
    for (let i = f.lastIndexOf('/'); i > 0; i = f.lastIndexOf('/', i - 1)) known.add(f.slice(0, i));
  }
  return known;
}

/** A path the tree holds: as written, as an import without its extension, or a `.js` import of a `.ts` file. */
function holds(known: ReadonlySet<string>, path: string): boolean {
  const p = path.replace(/[./-]+$/, '');
  return known.has(p) || known.has(`${p}.ts`) || (p.endsWith('.js') && known.has(`${p.slice(0, -3)}.ts`));
}

export interface PrivateHit {
  file: string;
  line: number;
  what: string;
}

/** The hits in one file's text, one per line and rule; with `known` (the tracked paths), the art-path rule too. */
export function scanText(file: string, text: string, known?: ReadonlySet<string>): PrivateHit[] {
  const hits: PrivateHit[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    for (const rule of PRIVATE_RULES) {
      if (rule.pattern.test(line)) hits.push({ file, line: i + 1, what: rule.what });
    }
    if (known && [...line.matchAll(ART_PATH)].some((m) => !holds(known, m[0]))) hits.push({ file, line: i + 1, what: ART_PATH_WHAT });
  }
  return hits;
}

/** Scan the named files under `root`; binary, oversized and allow-listed files are skipped. The named files are the tree the art-path rule checks against. */
export function scanFiles(root: string, files: readonly string[]): PrivateHit[] {
  const hits: PrivateHit[] = [];
  const known = knownPaths(files);
  for (const file of files) {
    if (ALLOWED_FILES.some((a) => a.test(file))) continue;
    const path = join(root, file);
    let size: number;
    try {
      size = statSync(path).size;
    } catch {
      continue; // listed but gone from the working tree (a deletion not yet committed)
    }
    if (size > MAX_BYTES) continue;
    const buf = readFileSync(path);
    if (buf.includes(0)) continue;
    hits.push(...scanText(file, buf.toString('utf8'), ART_PATH_HISTORY.some((h) => h.test(file)) ? undefined : known));
  }
  return hits;
}

/** Every file git tracks under `root`. */
export function trackedFiles(root: string): string[] {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  return out.split('\0').filter((f) => f !== '');
}
