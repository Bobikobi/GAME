/** The find and riddle steps, quest.type and prop ids (GRUNT P-2) validate; the limits hold. */
import { describe, expect, it } from 'vitest';
import { FORMAT_VERSION, QUEST_TYPES, validateFile } from '../src/index';

const quest = (steps: unknown[], extra: Record<string, unknown> = {}) => ({
  format: FORMAT_VERSION,
  type: 'quest',
  id: 'tester/q',
  title: 'A test',
  creator: 'tester',
  quest: { summary: 'A quest for the test.', steps, reward: { rep: 1 }, ...extra },
});

const find = { kind: 'find', item: 'core/old-coin', clue: 'Under the gate stones.' };
const riddle = {
  kind: 'riddle',
  clue: 'The marks name the order.',
  props: ['core/stone-a', 'core/stone-b'],
  answer: { kind: 'dig', treasure: 'core/ruins-gate' },
};

describe('quest steps', () => {
  it('accept a find and a riddle with a dig answer', () => {
    expect(validateFile(quest([find, riddle]))).toEqual([]);
  });

  it('accept a riddle answered by a place by night', () => {
    const byNight = { ...riddle, answer: { kind: 'visit', slot: 'core/west-glade', at: 'night' } };
    expect(validateFile(quest([byNight]))).toEqual([]);
  });

  it('refuse a riddle with no props, five props, or an answer of another kind', () => {
    expect(validateFile(quest([{ ...riddle, props: [] }]))).not.toEqual([]);
    expect(validateFile(quest([{ ...riddle, props: ['a/1', 'a/2', 'a/3', 'a/4', 'a/5'] }]))).not.toEqual([]);
    expect(validateFile(quest([{ ...riddle, answer: { kind: 'craft', recipe: 'core/herb-stew' } }]))).not.toEqual([]);
  });

  it('refuse a find without a clue and a clue that is the answer-sized essay', () => {
    expect(validateFile(quest([{ kind: 'find', item: 'core/old-coin' }]))).not.toEqual([]);
    expect(validateFile(quest([{ ...find, clue: 'x'.repeat(241) }]))).not.toEqual([]);
  });

  it('accept every palette type and refuse one outside it', () => {
    for (const type of QUEST_TYPES) expect(validateFile(quest([find], { type }))).toEqual([]);
    expect(validateFile(quest([find], { type: 'kill' }))).not.toEqual([]);
    expect(QUEST_TYPES).toHaveLength(12);
  });

  it('accept a map prop with an id and refuse an id in the wrong shape', () => {
    const map = (id: string) => ({
      format: FORMAT_VERSION,
      type: 'map',
      id: 'core/map',
      title: 'Valley',
      creator: 'core',
      map: {
        width: 8,
        height: 8,
        legend: { '.': { sprite: 'core/base-kit:tiles/grass', solid: false, tag: 'meadow' } },
        ground: Array.from({ length: 8 }, () => '........'),
        props: [{ id, sprite: 'core/base-kit:props/standing_stone', x: 1, y: 1, w: 1, h: 1, solid: true, note: 'Old marks.' }],
        spawn: { x: 0, y: 0 },
        slots: [],
      },
    });
    expect(validateFile(map('core/stone-a'))).toEqual([]);
    expect(validateFile(map('Stone A'))).not.toEqual([]);
  });
});
