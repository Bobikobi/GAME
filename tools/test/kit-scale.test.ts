import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { runCheck } from '../src/check.js';
import { scaleKindOf, scaleProblems } from '../src/kit/scale.js';
import { CONTENT_DIR } from '../src/load.js';

/**
 * NATURE section 1 and STYLE 1b: a sprite may declare `scale`, its height in characters, and a
 * kind with a floor may not fall under it. A creature with no `scale` is a warning once the first
 * creature kit lands, which is no kit of today.
 */
describe('which kind a sprite is', () => {
  test('the core sprites read as their kinds', () => {
    expect(scaleKindOf('props/tree_oak')?.kind).toBe('oak');
    expect(scaleKindOf('props/young_tree')?.kind).toBe('young tree');
    expect(scaleKindOf('props/dead_tree')?.kind).toBe('dead tree');
    expect(scaleKindOf('props/house_small')?.kind).toBe('house');
    expect(scaleKindOf('props/lantern_post')?.kind).toBe('street lamp');
    expect(scaleKindOf('props/market_stall')?.kind).toBe('market stall');
    expect(scaleKindOf('props/bush_berry')?.kind).toBe('bush');
    expect(scaleKindOf('chars/elder')?.kind).toBe('elder');
  });

  test('a character that is no child and no elder is an adult', () => {
    expect(scaleKindOf('chars/player_down')?.kind).toBe('adult');
    expect(scaleKindOf('chars/forager_w_work_left')?.floor).toBe(1);
  });

  test('a mat is no door and a head is no statue', () => {
    expect(scaleKindOf('props/door_mat')).toBeUndefined();
    expect(scaleKindOf('props/statue_head')).toBeUndefined();
    expect(scaleKindOf('props/broken_statue')?.kind).toBe('standing stone');
  });

  test('NATURE gives a range to some kinds: a door 1.3 to 1.5, a boulder 0.5 to 1.5, an oak only a floor', () => {
    expect([scaleKindOf('props/door_front')?.floor, scaleKindOf('props/door_front')?.ceil]).toEqual([1.3, 1.5]);
    expect(scaleKindOf('props/boulder_big')?.ceil).toBe(1.5);
    expect(scaleKindOf('props/tree_oak')?.ceil).toBeUndefined();
  });

  test('a thing no floor speaks for has no kind', () => {
    expect(scaleKindOf('props/chest')).toBeUndefined();
    expect(scaleKindOf('items/log')).toBeUndefined();
  });
});

describe('the scale warnings', () => {
  test('a kind with a scale under its floor is a warning', () => {
    const [problem] = scaleProblems('props/tree_oak', 2);
    expect(problem).toContain('under the floor of a oak, 3 characters');
    expect(scaleProblems('props/hazard_wolf', 0.5)[0]).toContain('0.55');
    expect(scaleProblems('chars/child_down', 0.6)[0]).toContain('child');
  });

  test('a scale at or over its floor says nothing: bigger is open', () => {
    expect(scaleProblems('props/tree_oak', 3)).toEqual([]);
    expect(scaleProblems('props/tree_oak', 12.5)).toEqual([]);
    expect(scaleProblems('props/horse', 1.3)).toEqual([]);
    expect(scaleProblems('props/chest', 0.4)).toEqual([]);
  });

  test('a world sprite with no scale is a warning; ground and inventory icons owe none', () => {
    expect(scaleProblems('props/chest', undefined)[0]).toContain('pnpm art:scale --declare');
    expect(scaleProblems('chars/human_down', undefined)).toHaveLength(1);
    expect(scaleProblems('tiles/grass', undefined)).toEqual([]);
    expect(scaleProblems('items/log', undefined)).toEqual([]);
  });

  test('the floors STYLE 1b picked with two decimals hold as given', () => {
    expect(scaleProblems('props/dog', 0.45)).toEqual([]);
    expect(scaleProblems('props/dog', 0.4)[0]).toContain('0.45');
    expect(scaleProblems('props/horse', 1.2)[0]).toContain('1.25');
  });

  test('a creature with no scale is a warning', () => {
    expect(scaleProblems('creatures/deer_walk', undefined)[0]).toContain('a creature declares its "scale"');
  });

  test('a creature is exempt from the floors: a monster declares its own grade', () => {
    // NATURE section 1: "Monsters are exempt from the floors, never from the rules", and a monster kind
    // declares its own grade, a design value chosen with its danger and not this table's animal
    expect(scaleProblems('creatures/wolf', 0.5)).toEqual([]);
    expect(scaleProblems('creatures/hen', 0.2)).toEqual([]);
  });

  test('any other world sprite with no scale is told to declare it', () => {
    expect(scaleProblems('props/tree_oak', undefined)[0]).toContain('declare "scale"');
    expect(scaleProblems('props/hazard_wolf', undefined)[0]).toContain('declare "scale"');
  });
});

describe('the check on today content', () => {
  // The scale audit (31.10): every world sprite of the shipped kits declares its drawn height, so the floors hold
  // all of them. The floor lines that remain are the open list of the audit; a redraw takes its line away.
  const lines = runCheck().issues.filter((i) => /scale|floor of a|creature declares/.test(i.message));

  test('no world sprite of the shipped kits lacks a scale', () => {
    expect(lines.filter((i) => i.message.includes('declare "scale"'))).toEqual([]);
  });

  test('what is left is a warning that names its sprite, its height and its floor', () => {
    for (const i of lines) {
      expect(i.level).toBe('warning');
      expect(i.where).toMatch(/^kit\.sprites\./);
      expect(i.message).toMatch(/^scale [\d.]+ is under the floor of a /);
    }
  });
});

describe('the check, end to end, on a kit that declares a height', () => {
  // the whole content in a copy, one oak and one creature sprite given a `scale`: the warning has to come
  // out of `pnpm check` itself, not only out of the function above, or the field would be read by nobody
  const root = mkdtempSync(join(tmpdir(), 'loomvale-scale-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
  cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });

  const kitPath = join(root, 'kit', 'core', 'kit.json');
  const kit = JSON.parse(readFileSync(kitPath, 'utf8')) as { kit: { sprites: Record<string, { scale?: number }> } };
  kit.kit.sprites['props/tree_oak']!.scale = 2;
  kit.kit.sprites['props/house_small']!.scale = 3.5;
  writeFileSync(kitPath, JSON.stringify(kit, null, 2));

  const issues = runCheck(root).issues;

  test('an oak declared at 2 characters is a warning from the check, under the floor of 3', () => {
    const problem = issues.find((i) => i.where === 'kit.sprites.props/tree_oak');
    expect(problem?.level).toBe('warning');
    expect(problem?.message).toContain('under the floor of a oak, 3 characters');
  });

  test('a house at 3.5 characters, over its floor, says nothing, and nothing new is an error', () => {
    expect(issues.some((i) => i.where === 'kit.sprites.props/house_small')).toBe(false);
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
  });
});
