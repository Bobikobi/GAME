/** The body lines a pull request owes the tools that fire on it (tools/src/pr-rules.ts). */
import { spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decide, labelled, parseNameStatus, treeForm, PLAYER_EYE_CLIPS } from '../src/pr-rules';

const quest = { status: 'M', path: 'content/core/quests/first-fire.json' };
const sprite = { status: 'A', path: 'content/kit/core/props/stool.png' };
const docs = { status: 'M', path: 'AGENTS.md' };
/** a picture that is neither an interaction clip nor an object: a character's blink, owed the source line only */
const blink = { status: 'A', path: 'content/kit/core/chars/elder_blink.png' };
const lift = { status: 'M', path: 'content/kit/core/chars/human_lift_left.png' };
const world = 'Player eye: pass';
/** every body owes the tree line, so the bodies below that should pass carry it */
const tree = 'Tree: none: a test body, nothing a player grows in';
/** a quest is story too, so a quest's body owes both lines */
const story = `Story review: clear, every past line has a speaker\n${tree}`;

describe('the body rule script', () => {
  it.each([
    ['same-repository release', 'develop', 'mist/vale', 0],
    ['fork develop into main', 'develop', 'alice/vale', 1],
    ['same-repository hotfix into main', 'hotfix', 'mist/vale', 1],
  ])('checks %s', (_case, head, headRepository, status) => {
    const dir = mkdtempSync(join(tmpdir(), 'pr-rules-'));
    const diff = join(dir, 'diff');
    const report = join(dir, 'report');
    writeFileSync(diff, `M\t${quest.path}\nA\t${sprite.path}\n`);
    const input = openSync(diff, 'r');
    const output = openSync(report, 'w');
    try {
      const result = spawnSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../src/pr-rules-cli.ts', import.meta.url))], {
        stdio: [input, output, 'inherit'],
        env: { ...process.env, BASE: 'main', HEAD_REF: head, HEAD_REPOSITORY: headRepository, GITHUB_REPOSITORY: 'mist/vale', PR_BODY: '' },
      });
      const stdout = readFileSync(report, 'utf8');
      expect(result.status, stdout).toBe(status);
      if (status === 0) {
        expect(stdout).toBe('::notice::Release pull request. Each change carried its own lines when it entered develop.\n');
      } else {
        expect(stdout.split('\n')[0]).toBe('quest files changed: 1; story files changed: 1; pictures added under content/kit/: 1; player-eye pictures: 1; tree line: missing');
        expect(stdout.match(/^::error::/gm)).toHaveLength(4);
        expect(stdout.match(/^::warning::/gm)).toHaveLength(1);
      }
    } finally {
      closeSync(input);
      closeSync(output);
      rmSync(dir, { recursive: true });
    }
  });
});

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
      'content/core/passages/bay-crossing.json',
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
    expect(decide([blink], '').problems[0]).toMatch(/PROP_FROM_REF/);
    expect(decide([blink], `Source: redrawn from the kit stool with kit:gen, no outside picture\n${tree}`).problems).toEqual([]);
  });
  it('is not owed for a changed picture, a picture elsewhere, or "none" when a picture was added', () => {
    expect(decide([{ status: 'M', path: 'content/kit/core/props/stool.png' }], tree).problems).toEqual([]);
    expect(decide([{ status: 'A', path: 'web/public/a.png' }], tree).problems).toEqual([]);
    expect(decide([blink], `Source: none\n${tree}`).problems).toHaveLength(1);
  });
  it('four lines fail and the player eye line warns, all at once', () => {
    const verdict = decide([quest, sprite], '');
    expect(verdict.problems).toHaveLength(4);
    expect(verdict.warnings).toHaveLength(1);
  });
});

describe('the player eye line', () => {
  it('is owed when an interaction clip is added, changed or renamed, in core or an extension kit', () => {
    for (const status of ['A', 'M', 'R100']) {
      for (const path of [
        'content/kit/core/chars/human_lift_left.png',
        'content/kit/core/chars/elf_carry_front.png',
        'content/kit/core/chars/skeleton_throw_back.png',
        'content/kit/core/chars/human_push_left.png',
        'content/kit/kim/chars/kim_lift_left.png',
      ]) {
        expect(decide([{ status, path }], `Source: kit:gen\n${tree}`).warnings[0], `${status} ${path}`).toMatch(/player-eye skill/);
      }
    }
  });
  it('is owed when a new object is added, a prop or an item, and not when one is only changed or removed', () => {
    expect(decide([sprite], `Source: kit:gen\n${tree}`).warnings[0]).toMatch(/player-eye skill/);
    expect(decide([{ status: 'A', path: 'content/kit/core/items/stone_small.png' }], `Source: kit:gen\n${tree}`).warnings[0]).toMatch(/player-eye skill/);
    expect(decide([{ status: 'A', path: 'content/kit/kim/props/pie.png' }], `Source: kit:gen\n${tree}`).warnings[0]).toMatch(/player-eye skill/);
    expect(decide([{ status: 'M', path: 'content/kit/core/props/stool.png' }], tree).warnings).toEqual([]);
    expect(decide([{ status: 'D', path: 'content/kit/core/props/stool.png' }], tree).warnings).toEqual([]);
  });
  it('is not owed for ground, a character that is not an interaction clip, a clip of another verb, or a picture elsewhere', () => {
    for (const path of [
      'content/kit/core/tiles/grass.png',
      'content/kit/core/chars/elder_blink.png',
      'content/kit/core/chars/human_dodge_left.png',
      'content/kit/core/chars/human_left.png',
      'content/kit/core/creatures/wolf.png',
      'web/public/lift.png',
    ]) {
      expect(decide([{ status: 'A', path }], `Source: kit:gen\n${tree}`).warnings, path).toEqual([]);
    }
  });
  it('is met by a verdict, pass, fail or unsure, and by nothing else', () => {
    for (const line of ['Player eye: pass', 'Player eye: fail - Q3 the stone shrinks mid-lift', 'player eye: unsure - is a lifted stone the size of a loaf?']) {
      expect(decide([lift], `${line}\n${tree}`).warnings, line).toEqual([]);
    }
    expect(decide([lift], `Player eye:\n${tree}`).warnings).toHaveLength(1);
    expect(decide([lift], `Player eye: <verdict of the player-eye skill>\n${tree}`).warnings).toHaveLength(1);
    expect(decide([lift], `<!-- Player eye: pass -->\n${tree}`).warnings).toHaveLength(1);
  });
  it('warns, and never fails the check, when the line is missing or is no verdict (warn-only until the judge has proved itself)', () => {
    for (const body of [tree, `Player eye: n/a\n${tree}`, `Player eye: no new clip or object\n${tree}`, `Player eye: looks fine\n${tree}`]) {
      const verdict = decide([lift], body);
      expect(verdict.problems, body).toEqual([]);
      expect(verdict.warnings, body).toHaveLength(1);
    }
    expect(decide([lift], tree).warnings[0]).toMatch(/Player eye/);
    expect(decide([lift], `Player eye: n/a\n${tree}`).warnings[0]).toMatch(/adds or changes 1 picture/);
    expect(decide([lift], `Player eye: looks fine\n${tree}`).warnings[0]).toMatch(/pass, fail or unsure/);
    // the other lines still fail: a new prop owes its source, and only the source
    expect(decide([sprite], tree).problems).toHaveLength(1);
  });
  it('lists the pictures it is owed for', () => {
    expect(decide([lift, sprite, blink], `${world}\nSource: kit:gen\n${tree}`).playerEye).toEqual([lift.path, sprite.path]);
  });
  it('covers every clip in the core kit that carries hand data (a new held verb must be added to the rule)', () => {
    const sprites = JSON.parse(readFileSync(fileURLToPath(new URL('../../content/kit/core/kit.json', import.meta.url)), 'utf8')).kit.sprites as Record<string, { file: string; clip?: { hand?: unknown } }>;
    const held = Object.values(sprites).filter((s) => s.clip?.hand !== undefined);
    expect(held.length).toBeGreaterThan(0);
    for (const s of held) expect(PLAYER_EYE_CLIPS.test(`content/kit/core/${s.file}`), s.file).toBe(true);
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
