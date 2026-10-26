/** The body lines a pull request owes the tools that fire on it (tools/src/pr-rules.ts). */
import { describe, expect, it } from 'vitest';
import { decide, labelled, parseNameStatus, treeForm } from '../src/pr-rules';

const quest = { status: 'M', path: 'content/core/quests/first-fire.json' };
const sprite = { status: 'A', path: 'content/kit/core/props/stool.png' };
const docs = { status: 'M', path: 'AGENTS.md' };
/** every body owes the tree line, so the bodies below that should pass carry it */
const tree = 'Tree: none: a test body, nothing a player grows in';
/** a quest is story too, so a quest's body owes both lines */
const story = `Story review: clear, every past line has a speaker\n${tree}`;

describe('the quest review line', () => {
  it('is owed when a quest file changes, core or extension', () => {
    expect(decide([quest], '').problems[0]).toMatch(/quest-designer skill/);
    expect(decide([{ status: 'A', path: 'content/extensions/kim/quests/pie.json' }], story).problems).toHaveLength(1);
  });
  it('is met by a verdict, and by nothing else', () => {
    expect(decide([quest], `What\nQuest review: fine, the hand gains no pair, type differs from both neighbours\n${story}`).problems).toEqual([]);
    expect(decide([quest], `Quest review:\n${story}`).problems).toHaveLength(1);
    expect(decide([quest], `Quest review: <verdict of the quest-designer skill, or "no quest changed">\n${story}`).problems).toHaveLength(1);
    expect(decide([quest], `<!-- Quest review: fine -->\n${story}`).problems).toHaveLength(1);
  });
  it('cannot say no quest changed when one did, and a deleted quest counts', () => {
    expect(decide([quest], `Quest review: no quest changed\n${story}`).problems[0]).toMatch(/changes 1 quest file/);
    expect(decide([{ status: 'D', path: 'content/core/quests/x.json' }], story).problems).toHaveLength(1);
  });
  it('is not owed for other files', () => {
    expect(decide([docs, { status: 'M', path: 'content/core/map.json' }], tree).problems).toEqual([]);
  });
});

describe('the story review line', () => {
  it('is owed when a file a player reads as story changes, deleted ones too', () => {
    for (const path of [
      'content/core/npcs/maru.json',
      'content/core/pockets/west-bank.json',
      'content/core/restores/old-bridge.json',
      'content/extensions/kim/treasures/pie-tin.json',
      'docs/design/STORY.md',
      'docs/design/story/chapter-1.md',
    ]) {
      expect(decide([{ status: 'M', path }], '').problems[0]).toMatch(/story-keeper skill/);
    }
    expect(decide([{ status: 'D', path: 'content/core/races/elf.json' }], tree).problems).toHaveLength(1);
  });
  it('is owed beside the quest review when a quest changes, and met by a verdict', () => {
    expect(decide([quest], `Quest review: fine\n${tree}`).problems[0]).toMatch(/Story review/);
    expect(decide([quest], `Quest review: fine\n${story}`).problems).toEqual([]);
    expect(decide([{ status: 'M', path: 'content/core/npcs/maru.json' }], `Story review: none\n${tree}`).problems[0]).toMatch(/changes 1 story file/);
  });
  it('is not owed for the map, the items or other docs', () => {
    expect(decide([docs, { status: 'M', path: 'content/core/items/axe.json' }, { status: 'M', path: 'docs/design/GAME_RULES.md' }], tree).problems).toEqual([]);
  });
});

describe('the source line', () => {
  it('is owed when a picture is added under content/kit/', () => {
    expect(decide([sprite], '').problems[0]).toMatch(/PROP_FROM_REF/);
    expect(decide([sprite], `Source: redrawn from the kit stool with kit:gen, no outside picture\n${tree}`).problems).toEqual([]);
  });
  it('is not owed for a changed picture, a picture elsewhere, or "none" when a picture was added', () => {
    expect(decide([{ status: 'M', path: 'content/kit/core/props/stool.png' }], tree).problems).toEqual([]);
    expect(decide([{ status: 'A', path: 'web/public/a.png' }], tree).problems).toEqual([]);
    expect(decide([sprite], `Source: none\n${tree}`).problems).toHaveLength(1);
  });
  it('all four lines can be owed at once', () => {
    expect(decide([quest, sprite], '').problems).toHaveLength(4);
  });
});

describe('the tree line', () => {
  it('is owed by every pull request, whatever it changes', () => {
    expect(decide([docs], '').problems[0]).toMatch(/Tree first, both ways/);
    expect(decide([], 'What this adds: a fix').problems).toHaveLength(1);
    expect(decide([docs], 'Tree: <school>/<node ids> | extends the tree: <path of the proposal> | none: <why>').problems).toHaveLength(1);
    expect(decide([docs], '<!-- Tree: none: a comment -->').problems).toHaveLength(1);
  });
  it('is met by the nodes the work builds or serves', () => {
    for (const line of ['Tree: woodcutting/felling-line', 'tree: travel/path-read, sure-foot (the first crossing)', 'Tree: core/woodcutting-school/heartwood; foraging/see-ripe']) {
      expect(decide([docs], line).problems).toEqual([]);
    }
    expect(decide([docs], 'Tree: travel/path-read').tree).toBe('nodes');
  });
  it('is met by the path of a proposal that extends the tree', () => {
    expect(decide([docs], 'Tree: extends the tree: docs/design/PROGRESSION.md section 4.8').tree).toBe('extends');
    expect(decide([docs], 'Tree: extends the tree:').problems[0]).toMatch(/none of the three forms/);
    expect(decide([docs], 'Tree: extends the tree: <path of the proposal>').problems).toHaveLength(1);
  });
  it('is met by none only with a reason', () => {
    expect(decide([docs], 'Tree: none: CI only').tree).toBe('none');
    for (const line of ['Tree: none', 'Tree: none:', 'Tree: none: n/a', 'Tree: no', 'Tree: n/a', 'Tree: none: <why>']) {
      expect(decide([docs], line).problems[0], line).toMatch(/none of the three forms/);
    }
  });
  it('refuses a line in none of the forms', () => {
    for (const line of ['Tree: yes', 'Tree: docs/design/PROGRESSION.md', 'Tree: travel']) {
      expect(treeForm(line.slice('Tree: '.length)), line).toBe('unreadable');
    }
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
