import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanFiles, scanText } from '../src/private-strings';

// every planted string is built from parts, so this file holds none of them whole
const home = ['', 'home', 'someone', 'work'].join('/');
const tools = ['~', '.claude', 'tools', 'x'].join('/');
const heavy = ['heavy', 'sh'].join('.');
const opener = ['open-url', 'sh'].join('.');
const mail = ['eladeladsaa', 'gmail.com'].join('@');

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
});
