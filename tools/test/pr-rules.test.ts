/** The body lines a pull request owes the tools that fire on it (tools/src/pr-rules.ts). */
import { describe, expect, it } from 'vitest';
import { decide, labelled, parseNameStatus } from '../src/pr-rules';

const quest = { status: 'M', path: 'content/core/quests/first-fire.json' };
const sprite = { status: 'A', path: 'content/kit/core/props/stool.png' };
const docs = { status: 'M', path: 'AGENTS.md' };

describe('the quest review line', () => {
  it('is owed when a quest file changes, core or extension', () => {
    expect(decide([quest], '').problems[0]).toMatch(/quest-designer skill/);
    expect(decide([{ status: 'A', path: 'content/extensions/kim/quests/pie.json' }], 'x').problems).toHaveLength(1);
  });
  it('is met by a verdict, and by nothing else', () => {
    expect(decide([quest], 'What\nQuest review: fine, the hand gains no pair, type differs from both neighbours').problems).toEqual([]);
    expect(decide([quest], 'Quest review:').problems).toHaveLength(1);
    expect(decide([quest], 'Quest review: <verdict of the quest-designer skill, or "no quest changed">').problems).toHaveLength(1);
    expect(decide([quest], '<!-- Quest review: fine -->').problems).toHaveLength(1);
  });
  it('cannot say no quest changed when one did, and a deleted quest counts', () => {
    expect(decide([quest], 'Quest review: no quest changed').problems[0]).toMatch(/changes 1 quest file/);
    expect(decide([{ status: 'D', path: 'content/core/quests/x.json' }], '').problems).toHaveLength(1);
  });
  it('is not owed for other files', () => {
    expect(decide([docs, { status: 'M', path: 'content/core/map.json' }], '').problems).toEqual([]);
  });
});

describe('the source line', () => {
  it('is owed when a picture is added under content/kit/', () => {
    expect(decide([sprite], '').problems[0]).toMatch(/PROP_FROM_REF/);
    expect(decide([sprite], 'Source: redrawn from the kit stool with kit:gen, no outside picture').problems).toEqual([]);
  });
  it('is not owed for a changed picture, a picture elsewhere, or "none" when a picture was added', () => {
    expect(decide([{ status: 'M', path: 'content/kit/core/props/stool.png' }], '').problems).toEqual([]);
    expect(decide([{ status: 'A', path: 'web/public/a.png' }], '').problems).toEqual([]);
    expect(decide([sprite], 'Source: none').problems).toHaveLength(1);
  });
  it('both lines can be owed at once', () => {
    expect(decide([quest, sprite], '').problems).toHaveLength(2);
  });
});

describe('reading', () => {
  it('finds a label at the start of a line, case blind', () => {
    expect(labelled('a\n  quest review: ok', 'Quest review')).toBe('ok');
    expect(labelled('see Quest review: ok', 'Quest review')).toBeUndefined();
  });
  it('reads git name-status, a rename by its new path', () => {
    expect(parseNameStatus('M\ta.json\nR100\told.png\tnew.png\n')).toEqual([
      { status: 'M', path: 'a.json' },
      { status: 'R100', path: 'new.png' },
    ]);
  });
});
