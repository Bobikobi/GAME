/** Which pull requests skip the browser tests in CI (tools/src/docs-only.ts). */
import { describe, expect, it } from 'vitest';
import { isDocsOnly, isProse, parsePaths } from '../src/docs-only';

describe('a file that is prose', () => {
  it('is anything under docs/, any Markdown file outside game/, DECISIONS.md, a prompt, a kit-gen spec', () => {
    for (const path of ['docs/art/DRAWERS.md', 'docs/team/diagram.png', 'README.md', 'AGENTS.md', 'DECISIONS.md', '.claude/skills/integrator/SKILL.md', 'tools/anim/README.md', '.github/prompts/ground-64.json', 'tools/kit-gen/rich-props-small.json']) {
      expect(isProse(path), path).toBe(true);
    }
  });

  it('is not code, content, workflows, configs or anything the game builds', () => {
    for (const path of ['kernel/src/rng.ts', 'content/core/quests/first-fire.json', 'game/public3d/models/README.md', 'game/src/main.ts', '.github/workflows/ci.yml', '.github/CODEOWNERS', 'tools/kit-gen/rich-wave.manifest.jsonl', 'tools/kit-gen/sub/spec.json', 'tools/src/docs-only.ts', 'package.json', 'pnpm-lock.yaml', 'docsx/readme.txt', 'notes.md.ts']) {
      expect(isProse(path), path).toBe(false);
    }
  });
});

describe('a docs-only pull request', () => {
  it('changes only prose', () => {
    expect(isDocsOnly(['docs/art/DRAWERS.md', 'DECISIONS.md', 'tools/kit-gen/ground-32.json'])).toBe(true);
  });

  it('is not one when a single file is code, however many are prose', () => {
    expect(isDocsOnly(['docs/a.md', 'docs/b.md', 'kernel/src/rng.ts'])).toBe(false);
    expect(isDocsOnly(['docs/a.md', '.github/workflows/ci.yml'])).toBe(false);
  });

  it('is not one when nothing is listed: an unreadable diff never skips the browser tests', () => {
    expect(isDocsOnly([])).toBe(false);
  });

  it('counts the old path of a moved file: prose moved into code, or code moved into docs, is not docs only', () => {
    expect(isDocsOnly(['docs/old.md', 'game/src/new.ts'])).toBe(false);
    expect(isDocsOnly(['game/src/old.ts', 'docs/new.md'])).toBe(false);
  });
});

describe('the list git prints', () => {
  it('splits on NUL (git diff -z) and keeps spaces and newlines inside a path', () => {
    expect(parsePaths('docs/a b.md\0docs/c\nd.md\0')).toEqual(['docs/a b.md', 'docs/c\nd.md']);
  });

  it('splits on newlines when there is no NUL, and skips blanks', () => {
    expect(parsePaths('docs/a.md\n\nREADME.md\n')).toEqual(['docs/a.md', 'README.md']);
  });
});
