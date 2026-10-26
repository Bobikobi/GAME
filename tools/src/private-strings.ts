/**
 * The public tree carries nothing that belongs to one person's machine: no home-directory path, no private
 * tool, no personal address. `pnpm private` (part of `pnpm verify`, so part of CI) fails when a tracked file
 * names one. The patterns are written as regular expressions, so this file does not match itself.
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

export interface PrivateHit {
  file: string;
  line: number;
  what: string;
}

/** The hits in one file's text, one per line and rule. */
export function scanText(file: string, text: string): PrivateHit[] {
  const hits: PrivateHit[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const rule of PRIVATE_RULES) {
      if (rule.pattern.test(lines[i] as string)) hits.push({ file, line: i + 1, what: rule.what });
    }
  }
  return hits;
}

/** Scan the named files under `root`; binary, oversized and allow-listed files are skipped. */
export function scanFiles(root: string, files: readonly string[]): PrivateHit[] {
  const hits: PrivateHit[] = [];
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
    hits.push(...scanText(file, buf.toString('utf8')));
  }
  return hits;
}

/** Every file git tracks under `root`. */
export function trackedFiles(root: string): string[] {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  return out.split('\0').filter((f) => f !== '');
}
