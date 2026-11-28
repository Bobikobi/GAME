import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { REPO_ROOT } from '../src/load.js';
import { type BasesData, clipBaseProblems, loadBases, raceOfSheet, refProblem } from '../src/kit/bases.js';
import { parseSpec } from '../src/kit/gen.js';

/** DECISIONS 2026-11-28: one base body for each race; the 30.10 walk sheets are retired as a base. */
const data: BasesData = {
  format: 1,
  decision: 'test',
  bases: { human: { left: 'chars/human_hit_left', front: 'chars/human_hit_front', back: 'chars/human_hit_back' } },
  base_frame: 0,
  retired: ['chars/human_down', 'chars/human_left', 'chars/human_up'],
  legacy_verbs: ['hit', 'strike'],
  waiting: ['chars/human_die_left'],
  clips: { 'chars/human_jump_left': 'chars/human_hit_left' },
};
const clip = (race: string, verb: string) => ({ clip: { race, verb } });

describe('kit:gen refuses a retired base', () => {
  test('a retired walk sheet, as a sprite id or as a png path', () => {
    expect(refProblem('chars/human_left', data)).toMatch(/retired walk sheet/);
    expect(refProblem('.scratch/figure-moves/keys-dressed/human_down.png', data)).toMatch(/retired walk sheet/);
  });
  test('a clip waiting for its redraw, and a clip recorded from a retired sheet', () => {
    expect(refProblem('chars/human_die_left', data)).toMatch(/waits for its redraw/);
    expect(refProblem('chars/human_run_left', { ...data, clips: { 'chars/human_run_left': 'chars/human_up' } })).toMatch(/drawn from chars\/human_up/);
  });
  test('the base, a clip drawn from it and a thing that is no figure stay open', () => {
    expect(refProblem('chars/human_hit_left', data)).toBeUndefined();
    expect(refProblem('chars/human_jump_left', data)).toBeUndefined();
    expect(refProblem('chars/elder', data)).toBeUndefined();
    expect(refProblem('props/tree_oak', data)).toBeUndefined();
  });
  test('a spec with a retired reference does not read', () => {
    const entry = { name: 'x', ref: 'chars/human_down', what: 'a human', width: 32, height: 48 };
    expect(() => parseSpec(JSON.stringify({ entries: [entry] }))).toThrow(/retired walk sheet/);
  });
});

describe('pnpm check holds the clips to the bases', () => {
  const sprites = {
    'chars/human_hit_left': clip('core/human', 'hit'),
    'chars/human_jump_left': clip('core/human', 'jump'),
    'chars/human_die_left': clip('core/human', 'die'),
    'chars/human_left': {},
  };
  test('a clean kit has no problem; the waiting clip is silent', () => {
    expect(clipBaseProblems(sprites, data)).toEqual([]);
  });
  test('a clip recorded from a retired sheet is an error', () => {
    const bad = { ...data, clips: { ...data.clips, 'chars/human_jump_left': 'chars/human_left' } };
    const out = clipBaseProblems(sprites, bad);
    expect(out).toHaveLength(1);
    expect(out[0]!.message).toMatch(/retired walk sheet/);
  });
  test('a clip of a new verb with no record is an error; an old verb is not', () => {
    const out = clipBaseProblems({ ...sprites, 'chars/human_run_left': clip('core/human', 'run') }, data);
    expect(out.map((p) => p.name)).toEqual(['chars/human_run_left']);
    expect(out[0]!.message).toMatch(/no recorded base/);
  });
  test('a redraw that lands must come off the waiting list', () => {
    const out = clipBaseProblems(sprites, { ...data, clips: { ...data.clips, 'chars/human_die_left': 'chars/human_hit_left' } });
    expect(out.map((p) => p.message).join()).toMatch(/take it off "waiting"/);
  });
  test('a name the kit no longer holds is stale, on either list', () => {
    const out = clipBaseProblems({ 'chars/human_hit_left': clip('core/human', 'hit') }, data);
    expect(out.map((p) => p.name).sort()).toEqual(['chars/human_die_left', 'chars/human_jump_left']);
  });
});

describe('the real data', () => {
  const real = loadBases();
  const kit = JSON.parse(readFileSync(join(REPO_ROOT, 'content/kit/core/kit.json'), 'utf8')) as { kit: { sprites: Record<string, { clip?: { race: string; verb: string } }> } };
  test('every base picture exists in the core kit and belongs to its race', () => {
    for (const [race, views] of Object.entries(real.bases)) {
      expect(Object.keys(views).sort()).toEqual(['back', 'front', 'left']);
      for (const sprite of Object.values(views)) {
        expect(kit.kit.sprites[sprite], sprite).toBeDefined();
        expect(raceOfSheet(sprite)).toBe(race);
      }
    }
  });
  test('the retired sheets exist today and no base is one of them', () => {
    for (const name of real.retired) expect(kit.kit.sprites[name], name).toBeDefined();
    for (const views of Object.values(real.bases)) for (const sprite of Object.values(views)) expect(real.retired).not.toContain(sprite);
  });
  test('the core kit passes', () => {
    expect(clipBaseProblems(kit.kit.sprites)).toEqual([]);
  });
});
