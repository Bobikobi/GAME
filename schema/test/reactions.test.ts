/** World reactions validate within their closed lists (docs/design/REACTIONS.md, sections 3 and 4). */
import { describe, expect, it } from 'vitest';
import { CREATOR_TYPES, FORMAT_VERSION, validateFile } from '../src/index';

const reaction = (body: object) => ({
  format: FORMAT_VERSION,
  type: 'reaction',
  id: 'tester/a-reaction',
  title: 'A reaction',
  creator: 'tester',
  reaction: body,
});
const windfall = {
  on: { resource: 'core/berry-bushes' },
  when: { ready_for_ms: 240000 },
  then: {
    appear: { output: 'core/berry', yield: 1, active_ms: 1500, respawn_ms: 240000, level: 1, game: 'pick', sprite: 'core/base-kit:items/berry', at: 'below' },
  },
};
const birds = { on: { treasure: '*' }, when: { player_within: 8, unseen: true }, then: { cue: 'birds_lift', spread: 2 } };
const fish = { on: { tag: 'riverbank' }, when: { hours: [18, 21], chance_pct: 30 }, then: { cue: 'fish_rise' } };
const slower = { on: { resource: '*' }, when: { night: true }, then: { wait: 1500 } };

describe('reactions', () => {
  it('a creator may write one', () => {
    expect(CREATOR_TYPES).toContain('reaction');
  });

  it('accept an appear, a cue on a hidden spot, a cue on a ground tag and a wait', () => {
    for (const body of [windfall, birds, fish, slower]) expect(validateFile(reaction(body))).toEqual([]);
  });

  it('refuse a cue, a side or a condition outside the lists', () => {
    expect(validateFile(reaction({ ...birds, then: { cue: 'wolf_howl' } }))).not.toEqual([]);
    expect(validateFile(reaction({ ...windfall, then: { appear: { ...windfall.then.appear, at: 'far' } } }))).not.toEqual([]);
    expect(validateFile(reaction({ ...birds, when: { player_doing: 'fell' } }))).not.toEqual([]);
    expect(validateFile(reaction({ ...fish, on: { tag: 'lava' } }))).not.toEqual([]);
  });

  it('refuse a reaction with no condition, two effects, or no effect', () => {
    expect(validateFile(reaction({ ...birds, when: {} }))).not.toEqual([]);
    expect(validateFile(reaction({ ...slower, then: { wait: 1500, cue: 'fish_rise' } }))).not.toEqual([]);
    expect(validateFile(reaction({ ...slower, then: {} }))).not.toEqual([]);
  });

  it('accept a weather from the closed list, and refuse any other', () => {
    for (const weather of ['clear', 'rain', 'fog']) expect(validateFile(reaction({ ...slower, when: { weather } }))).toEqual([]);
    expect(validateFile(reaction({ ...fish, when: { hours: [18, 21], weather: 'rain' } }))).toEqual([]);
    expect(validateFile(reaction({ ...slower, when: { weather: 'snow' } }))).not.toEqual([]);
  });

  it('hold the guards in numbers: a reach of 8 at most, a wait inside 500-2000, a spread of 2 at most', () => {
    expect(validateFile(reaction({ ...birds, when: { player_within: 9 } }))).not.toEqual([]);
    expect(validateFile(reaction({ ...slower, then: { wait: 499 } }))).not.toEqual([]);
    expect(validateFile(reaction({ ...slower, then: { wait: 2001 } }))).not.toEqual([]);
    expect(validateFile(reaction({ ...birds, then: { cue: 'birds_lift', spread: 3 } }))).not.toEqual([]);
    expect(validateFile(reaction({ ...fish, when: { chance_pct: 0 } }))).not.toEqual([]);
  });
});
