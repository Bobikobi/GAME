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

  test('any other sprite with no scale says nothing', () => {
    expect(scaleProblems('props/tree_oak', undefined)).toEqual([]);
    expect(scaleProblems('props/hazard_wolf', undefined)).toEqual([]);
  });
});

describe('the check on today content', () => {
  test('every kit of today passes with no scale line', () => {
    const result = runCheck();
    expect(result.issues.filter((i) => /scale|floor of a|creature declares/.test(i.message))).toEqual([]);
  });
});

describe('the check, end to end, on a kit that declares a height', () => {
  // the whole content in a copy, one oak and one creature sprite given a `scale`: the warning has to come
  // out of `pnpm check` itself, not only out of the function above, or the field would be read by nobody
  const root = mkdtempSync(join(tmpdir(), 'openfold-scale-'));
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
