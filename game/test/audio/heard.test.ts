/** Which effects are heard and how loud (docs/design/SOUND.md sections 1.3 and 1.4). */
import { describe, expect, test } from 'vitest';

import {
  FAR_TILES,
  NEAR_TILES,
  OFFSCREEN_GAIN,
  OFFSCREEN_LOWPASS,
  distanceGain,
  gapAllows,
  hearing,
  planBatch,
  type Cue,
} from '../../src/audio/heard';

const names = (cues: Cue[]) => cues.map((c) => ('jingle' in c ? `jingle:${c.jingle}` : c.sfx));

describe('the batch rule', () => {
  test('a batch with a jingle plays that jingle alone', () => {
    expect(names(planBatch([{ sfx: 'pluck' }, { sfx: 'pickup' }, { sfx: 'perfect' }, { jingle: 'quest' }]))).toEqual(['jingle:quest']);
  });

  test('of two jingles the level wins, and a rare find wins over a task done', () => {
    // the pick of 25 s in the measured opening: six cues in 0.7 s
    const pick: Cue[] = [{ sfx: 'pluck' }, { sfx: 'pickup' }, { sfx: 'perfect' }, { jingle: 'found' }, { jingle: 'level' }, { jingle: 'quest' }];
    expect(names(planBatch(pick))).toEqual(['jingle:level']);
    // the riddle of the measured opening: solved and the task done in one step
    expect(names(planBatch([{ jingle: 'quest' }, { jingle: 'found' }]))).toEqual(['jingle:found']);
  });

  test('without a jingle, two small cues speak, by rank', () => {
    expect(names(planBatch([{ sfx: 'pickup' }, { sfx: 'perfect' }, { sfx: 'coin' }, { sfx: 'ui' }]))).toEqual(['coin', 'ui']);
  });

  test('the journal takes the pickup\'s place, so a first-of-kind item plays one sound', () => {
    expect(names(planBatch([{ sfx: 'pickup' }, { sfx: 'journal' }]))).toEqual(['journal']);
    expect(names(planBatch([{ sfx: 'pickup' }, { sfx: 'journal' }, { sfx: 'perfect' }]))).toEqual(['journal', 'perfect']);
  });

  test('danger speaks before what was earned', () => {
    expect(names(planBatch([{ sfx: 'pickup' }, { sfx: 'coin' }, { sfx: 'growl' }]))).toEqual(['growl', 'coin']);
  });

  test('a lone cue and an empty batch pass as they are', () => {
    expect(names(planBatch([{ sfx: 'pluck', detune: -400 }]))).toEqual(['pluck']);
    expect(planBatch([])).toEqual([]);
  });

  test('a cue keeps its own gain, pitch and place', () => {
    const cue: Cue = { sfx: 'growl', gain: 0.5, detune: 10, heard: { owner: 'world', tiles: 8 } };
    expect(planBatch([cue])).toEqual([cue]);
  });
});

describe('the gap of a repeated cause', () => {
  test('wings sound once in 1.5 s', () => {
    expect(gapAllows('wings', 1_000, undefined)).toBe(true);
    expect(gapAllows('wings', 2_499, 1_000)).toBe(false);
    expect(gapAllows('wings', 2_500, 1_000)).toBe(true);
  });

  test('an effect with no gap always sounds', () => {
    expect(gapAllows('dig', 1_001, 1_000)).toBe(true);
  });
});

describe('the distance curve', () => {
  test('whole inside the near tiles', () => {
    for (const d of [0, 1, 2.5, NEAR_TILES]) expect(distanceGain(d)).toBe(1);
  });

  test('half as loud for each doubling of the distance beyond them', () => {
    expect(distanceGain(NEAR_TILES * 2)).toBeCloseTo(0.5);
    expect(distanceGain(NEAR_TILES * 4)).toBeCloseTo(0.25);
  });

  test('never rises with the distance, and is silent from the far tiles on', () => {
    let last = 1;
    for (let d = 0; d <= FAR_TILES + 4; d += 0.25) {
      const g = distanceGain(d);
      expect(g).toBeLessThanOrEqual(last);
      last = g;
    }
    expect(distanceGain(FAR_TILES)).toBe(0);
    expect(distanceGain(FAR_TILES - 0.01)).toBeGreaterThan(0);
  });
});

describe('how an effect is heard', () => {
  test('the player\'s own cause beside them is whole, with no filter', () => {
    expect(hearing('thud')).toEqual({ gain: 1 });
    expect(hearing('coin', { owner: 'self' })).toEqual({ gain: 1 });
  });

  test('a cause off-screen is fainter and dulled', () => {
    expect(hearing('growl', { owner: 'world', tiles: 3, offscreen: true })).toEqual({ gain: OFFSCREEN_GAIN, lowpass: OFFSCREEN_LOWPASS });
    expect(hearing('growl', { owner: 'world', tiles: 8, offscreen: true })!.gain).toBeCloseTo(0.5 * OFFSCREEN_GAIN);
  });

  test('another player\'s chop nearby is heard; their coin is not', () => {
    expect(hearing('thud', { owner: 'other', tiles: 3 })).toEqual({ gain: 1 });
    expect(hearing('coin', { owner: 'other', tiles: 0 })).toBeNull();
    expect(hearing('pickup', { owner: 'other', tiles: 1 })).toBeNull();
    expect(hearing('journal', { owner: 'other', tiles: 1 })).toBeNull();
  });

  test('a fight off-screen near by sounds distant; far off it is silent', () => {
    expect(hearing('strike', { owner: 'other', tiles: 10, offscreen: true })).toEqual({ gain: (NEAR_TILES / 10) * OFFSCREEN_GAIN, lowpass: OFFSCREEN_LOWPASS });
    expect(hearing('strike', { owner: 'other', tiles: FAR_TILES })).toBeNull();
  });
});
