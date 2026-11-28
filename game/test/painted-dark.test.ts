import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { PAINTED_DEFAULT, paintedQuery } from '../src/trial';

/**
 * Every page mounts one valley, the painted one (public #919): the default query names it on its own map with the phone camera, nothing but main.ts
 * mounts it, the painted code stays its own file fetched behind the title, and the pixel valley's map is no longer the game's content.
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

describe('the painted valley is the first place', () => {
  test('a page with no query, or with only its own options, mounts the painted valley on its own map; its own options come first and win', () => {
    expect(PAINTED_DEFAULT).toBe('?painted=valley-blk2x3&base=1&zoom=auto');
    for (const q of ['', '?']) expect(paintedQuery(q), q).toBe(PAINTED_DEFAULT);
    const q = new URLSearchParams(paintedQuery('?debug&seed=7&zoom=3'));
    expect([q.get('painted'), q.get('base'), q.get('zoom'), q.get('seed')]).toEqual(['valley-blk2x3', '1', '3', '7']);
  });

  test('a page that names its own land keeps its query whole: no base or zoom it did not ask for', () => {
    expect(paintedQuery('?debug&painted=other')).toBe('?debug&painted=other');
  });

  test('app.painted is assigned in main.ts alone, with no question before the mount, from a dynamic import', () => {
    const assigns = sourcesOf(SRC).filter((f) => /\bapp\.painted\s*=[^=]/.test(readFileSync(f, 'utf8')));
    expect(assigns.map((f) => f.slice(SRC.length + 1))).toEqual(['main.ts']);
    const main = readFileSync(join(SRC, 'main.ts'), 'utf8');
    const mount = main.slice(main.indexOf('async function mountTrial'), main.indexOf('app.painted = mount'));
    expect(mount, 'nothing in mountTrial returns before the painted mount').not.toMatch(/\breturn\b/);
    expect(mount).toMatch(/await import\('\.\/painted'\)/);
    // the painted module is imported dynamically in main.ts and nowhere else
    const dynamic = sourcesOf(SRC).filter((f) => /import\(\s*'(\.\.?\/)+painted'\s*\)/.test(readFileSync(f, 'utf8')));
    expect(dynamic.map((f) => f.slice(SRC.length + 1))).toEqual(['main.ts']);
  });

  test('the painted code is its own file, fetched behind the title: the modules that fetch the pictures are not in what main.ts and game.ts load statically', () => {
    const loaded = closure([join(SRC, 'main.ts'), join(SRC, 'game.ts')]);
    const names = new Set([...loaded].map((f) => f.slice(SRC.length + 1)));
    for (const fetcher of ['painted.ts', 'painted-stream.ts', 'early-fetch.ts']) expect(names.has(fetcher), `${fetcher} is statically reachable from the page's entry`).toBe(false);
  });

  test("the game's map is the painted valley's: one ring of walls round the scene's 39 x 28 cells, as the default's base=1 needs (painted-presence.ts baseOf)", () => {
    const map = (JSON.parse(readFileSync(resolve(__dirname, '../../content/core/map.json'), 'utf8')) as { map: { width: number; ground: string[] } }).map;
    expect([map.width, map.ground.length]).toEqual([39 + 2, 28 + 2]);
  });
});
