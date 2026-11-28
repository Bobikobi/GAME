import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ART_PATH_WHAT, knownPaths, scanFiles, scanText } from '../src/private-strings';

// every planted string is built from parts, so this file holds none of them whole
const home = ['', 'home', 'someone', 'work'].join('/');
const tools = ['~', '.claude', 'tools', 'x'].join('/');
const heavy = ['heavy', 'sh'].join('.');
const opener = ['open-url', 'sh'].join('.');
const mail = ['eladeladsaa', 'gmail.com'].join('@');
const art = (...parts: string[]): string => ['tools', ...parts].join('/');

describe('private strings', () => {
  it('catches each kind, with its line number', () => {
    for (const planted of [`cd ${home}`, `run ${tools}`, `under ${heavy}`, `via ${opener}`, `mail ${mail}`]) {
      const hits = scanText('doc.md', `fine\n${planted}\nfine`);
      expect(hits, planted).toHaveLength(1);
      expect(hits[0]?.line).toBe(2);
    }
  });

  it('leaves ordinary text and in-repo skill folders alone', () => {
    const fine = ['.claude/skills/quest-designer/SKILL.md', 'web/src/pages/home/index.astro', 'a heavy job on a shared machine', 'https://example.com/home/page'];
    for (const line of fine) expect(scanText('doc.md', line), line).toEqual([]);
  });

  it('skips lockfiles and binary files, and reads everything else', () => {
    const root = mkdtempSync(join(tmpdir(), 'private-strings-'));
    try {
      mkdirSync(join(root, 'sub'));
      writeFileSync(join(root, 'pnpm-lock.yaml'), `resolved: ${home}\n`);
      writeFileSync(join(root, 'sub', 'pic.png'), Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(home)]));
      writeFileSync(join(root, 'sub', 'note.md'), `see ${tools}\n`);
      const hits = scanFiles(root, ['pnpm-lock.yaml', 'sub/pic.png', 'sub/note.md', 'gone.md']);
      expect(hits.map((h) => `${h.file}:${h.line}`)).toEqual(['sub/note.md:1']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('flags a path into the art tools only when the tree does not hold it', () => {
    const known = knownPaths([art('art', 'clothing', 'run.py'), art('src', 'art', 'drafts.ts')]);
    const flagged = [`see ${art('art', 'scene', 'cut.py')}`, `baked by ${art('src', 'art', 'bake.ts')}`, `(${art('art', 'other')}/)`];
    for (const line of flagged) {
      const hits = scanText('a.ts', line, known);
      expect(hits.map((h) => h.what), line).toEqual([ART_PATH_WHAT]);
    }
    const fine = [
      `run ${art('art', 'clothing', 'run.py')}`, // a tracked file
      `the folder ${art('art', 'clothing')}/ and ${art('art')}/`, // tracked folders, a trailing slash
      `import { x } from '../../${art('src', 'art', 'drafts')}'`, // an import without its extension
      `from '${art('src', 'art', 'drafts.js')}'`, // a .js import of a .ts file
      'the tools for art live elsewhere',
    ];
    for (const line of fine) expect(scanText('a.ts', line, known), line).toEqual([]);
    // without the tree the rule is off: scanText alone cannot know what is tracked
    expect(scanText('a.ts', flagged[0] as string)).toEqual([]);
  });

  it('leaves the decisions log out of the art-path rule, and only that rule', () => {
    const root = mkdtempSync(join(tmpdir(), 'private-strings-'));
    try {
      writeFileSync(join(root, 'DECISIONS.md'), `tried ${art('src', 'art', 'gone.ts')}\nunder ${heavy}\n`);
      writeFileSync(join(root, 'note.md'), `tried ${art('src', 'art', 'gone.ts')}\n`);
      const hits = scanFiles(root, ['DECISIONS.md', 'note.md']);
      expect(hits.map((h) => `${h.file}:${h.line}`)).toEqual(['DECISIONS.md:2', 'note.md:1']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
