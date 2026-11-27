import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { paintedWanted } from '../src/trial';

/**
 * The painted ground ships dark: a player's page never mounts it, never downloads its code and never fetches one of its pictures. Three facts hold that, each pinned here:
 * only two queries ask for it, nothing reaches the mount but main.ts behind that question, and the modules that fetch the pictures are not among the ones a normal page loads.
 */
const SRC = resolve(__dirname, '../src');

function sourcesOf(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sourcesOf(p) : p.endsWith('.ts') ? [p] : [];
  });
}

/** the files a file loads with a static import (not `import type`, not a dynamic `import()`), by path */
function staticImports(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const out: string[] = [];
  for (const m of text.matchAll(/^(?:import|export)\s+(?!type\b)[^;'"]*?from\s+'(\.[^']+)'|^import\s+'(\.[^']+)'/gm)) {
    const rel = (m[1] ?? m[2])!;
    const base = resolve(dirname(file), rel.replace(/\.js$/, ''));
    for (const cand of [`${base}.ts`, join(base, 'index.ts')]) if (existsSync(cand)) out.push(cand);
  }
  return out;
}

function closure(roots: string[]): Set<string> {
  const seen = new Set<string>();
  const todo = [...roots];
  while (todo.length) {
    const f = todo.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    todo.push(...staticImports(f));
  }
  return seen;
}

describe('the painted ground ships dark', () => {
  test('only ?preview and ?debug&painted= ask for it: no query, ?debug alone, ?painted= without debug and an unrelated query mount nothing', () => {
    for (const q of ['', '?', '?debug', '?painted=valley', '?rich=all', '?stats=1&seed=7', '?previews']) expect(paintedWanted(q), q).toBe(false);
    for (const q of ['?preview', '?debug&painted=valley', '?seed=7&preview&hold=clock', '?painted=valley&debug']) expect(paintedWanted(q), q).toBe(true);
  });

  test('no query means app.painted stays undefined: it is assigned in main.ts alone, behind paintedWanted, from a dynamic import', () => {
    const assigns = sourcesOf(SRC).filter((f) => /\bapp\.painted\s*=[^=]/.test(readFileSync(f, 'utf8')));
    expect(assigns.map((f) => f.slice(SRC.length + 1))).toEqual(['main.ts']);
    const main = readFileSync(join(SRC, 'main.ts'), 'utf8');
    expect(main).toMatch(/if \(!paintedWanted\(query\)\) return;\s*[^]*?await import\('\.\/painted'\)/);
    // the painted module is imported dynamically in main.ts and nowhere else
    const dynamic = sourcesOf(SRC).filter((f) => /import\(\s*'(\.\.?\/)+painted'\s*\)/.test(readFileSync(f, 'utf8')));
    expect(dynamic.map((f) => f.slice(SRC.length + 1))).toEqual(['main.ts']);
  });

  test('a normal page never fetches a painted picture: the modules that fetch them are not in what main.ts and game.ts load', () => {
    const loaded = closure([join(SRC, 'main.ts'), join(SRC, 'game.ts')]);
    const names = new Set([...loaded].map((f) => f.slice(SRC.length + 1)));
    for (const fetcher of ['painted.ts', 'painted-stream.ts', 'early-fetch.ts']) expect(names.has(fetcher), `${fetcher} is statically reachable from the page's entry`).toBe(false);
    // and the picture folder is named by those fetchers alone
    const naming = sourcesOf(SRC).filter((f) => /['`"]painted\//.test(readFileSync(f, 'utf8')) || /\/painted\/\$\{/.test(readFileSync(f, 'utf8')));
    for (const f of naming) expect(names.has(f.slice(SRC.length + 1)), `${f} names painted/ and a normal page loads it`).toBe(false);
  });
});
