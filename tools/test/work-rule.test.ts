/**
 * The one work rule, held by the sources (QUARRYING 10; DECISIONS.md, 2026-11-20): no grade is sent from any work,
 * and the timing window, its jackpot and its miss draw are left only in history (the docs and the DECISIONS log).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

import { REPO_ROOT } from '../src/load';

const SKIP = new Set(['node_modules', 'dist', '.git', '.scratch', 'generated', 'coverage', '.worktrees']);

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.(ts|tsx|css|json)$/.test(name) && !/schema\/json\//.test(path)) out.push(path);
  }
  return out;
}

const live = ['kernel/src', 'game/src', 'server/src', 'schema/src', 'content', 'tools/src', 'web'].flatMap((d) => sources(join(REPO_ROOT, d)));

describe('no grade leaves a work', () => {
  test('no client or tool source builds a gather or a dig with a grade of its own', () => {
    const offenders: string[] = [];
    for (const file of live) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\{\s*t:\s*'(gather|dig)',[^}]*\}/g)) {
        if (/\bgrade\b/.test(m[0])) offenders.push(`${relative(REPO_ROOT, file)}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('the kernel reads no grade: a gather and a dig are one unit whatever the action carries', () => {
    const step = readFileSync(join(REPO_ROOT, 'kernel/src/step.ts'), 'utf8');
    expect(step).not.toMatch(/a\.grade|action\.grade|\.grade\b[^?]*GRADE/);
  });
});

describe('the timing window is left only in history', () => {
  test('no live source names a jackpot, a timing grade, a miss draw or the timing window effect', () => {
    const words = /jackpot|GRADE_PCT|missKeepBp|timing_window_pct|solveMinigame|minigame-layer/i;
    const offenders = live.filter((file) => words.test(readFileSync(file, 'utf8'))).map((file) => relative(REPO_ROOT, file));
    expect(offenders).toEqual([]);
  });
});
