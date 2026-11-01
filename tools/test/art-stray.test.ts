import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { PNG } from 'pngjs';
import { afterAll, describe, expect, test } from 'vitest';

import { DraftIndex, type Gh, collectPictures, pushCollected } from '../src/art/drafts.js';
import { findStrays, indexedHashes, strayIssue, strayText } from '../src/art/stray.js';

const scratch = mkdtempSync(join(tmpdir(), 'art-stray-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function png(seed: number): Buffer {
  const p = new PNG({ width: 4, height: 4 });
  for (let i = 0; i < 16; i += 1) {
    p.data[i * 4] = (seed * 37 + i * 11) % 256;
    p.data[i * 4 + 3] = 255;
  }
  return PNG.sync.write(p);
}

/** A `gh` that keeps the names of what was uploaded, so the push finds its assets in the release. */
function fakeGh(): Gh {
  const store = new Map<string, Set<string>>();
  return (args) => {
    const [, verb, tag = ''] = args;
    const ok = (stdout = ''): { status: number; stdout: string; stderr: string } => ({ status: 0, stdout, stderr: '' });
    if (verb === 'view') {
      const release = store.get(tag);
      return release === undefined ? { status: 1, stdout: '', stderr: 'release not found' } : ok(JSON.stringify({ assets: [...release].map((name) => ({ name })) }));
    }
    if (verb === 'create') store.set(tag, store.get(tag) ?? new Set());
    if (verb === 'upload') for (const file of args.slice(5)) store.get(tag)?.add(basename(file));
    return ok();
  };
}

function worktree(name: string): string {
  const dir = join(scratch, name);
  mkdirSync(join(dir, 'tools/kit-gen'), { recursive: true });
  mkdirSync(join(dir, '.scratch/study'), { recursive: true });
  return dir;
}

describe('the stray art check', () => {
  test('one unpushed PNG is named and counted, and after art:drafts push the worktree is clean', () => {
    const wt = worktree('one');
    const file = join(wt, '.scratch/study/well.png');
    writeFileSync(file, png(1));
    const before = findStrays([wt], indexedHashes([wt]));
    expect(before).toEqual([{ worktree: wt, folder: '.scratch/study', file: '.scratch/study/well.png' }]);
    expect(strayText(before)).toContain(`${wt}  .scratch/study: 1`);
    expect(strayIssue(before)[0]).toMatchObject({ where: 'art.stray', level: 'warning' });
    const index = DraftIndex.open(join(wt, 'tools/kit-gen/drafts.jsonl'));
    pushCollected(collectPictures([file], { label: 'stray-test' }), index, { gh: fakeGh() });
    const after = findStrays([wt], indexedHashes([wt]));
    expect(after).toEqual([]);
    expect(strayIssue(after)).toEqual([]);
    expect(strayText(after)).toContain('no stray art');
  });

  test('an index line in any worktree counts, and files that are not art or sit in the fetched cache are not read', () => {
    const a = worktree('a');
    const b = worktree('b');
    const shared = join(a, '.scratch/study/shared.png');
    writeFileSync(shared, png(2));
    writeFileSync(join(b, '.scratch/study/same-bytes.png'), png(2));
    writeFileSync(join(b, '.scratch/study/notes.txt'), 'not art');
    mkdirSync(join(b, '.scratch/art-drafts'), { recursive: true });
    writeFileSync(join(b, '.scratch/art-drafts/cached.png'), png(3));
    pushCollected(collectPictures([shared], { label: 'stray-test' }), DraftIndex.open(join(a, 'tools/kit-gen/drafts.jsonl')), { gh: fakeGh() });
    expect(findStrays([a, b], indexedHashes([a, b]))).toEqual([]);
    expect(findStrays([a, b], indexedHashes([b]))).toHaveLength(2);
  });

  test('build output and captures are skipped by directory name, a draft beside them is still counted', () => {
    const wt = worktree('skip');
    for (const dir of ['signin-dist', 'dist', 'dist-3d', 'e2e3d', 'shots-before', 'refs', 'ref-natural-joins', 'stills2', 'owner-page-3010', 'tint-pick']) {
      mkdirSync(join(wt, '.scratch', dir), { recursive: true });
      writeFileSync(join(wt, '.scratch', dir, 'out.png'), png(7));
    }
    mkdirSync(join(wt, '.scratch/nested/signin-dist'), { recursive: true });
    writeFileSync(join(wt, '.scratch/nested/signin-dist/out.png'), png(7));
    writeFileSync(join(wt, '.scratch/study/draft.png'), png(8));
    expect(findStrays([wt], indexedHashes([wt])).map((s) => s.file)).toEqual(['.scratch/study/draft.png']);
  });
});
