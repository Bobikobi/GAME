/** Unit tests for equal-tempered note conversion. */
import { describe, expect, test } from 'vitest';

import { noteFreq } from '../../src/audio/sequence';

describe('note frequencies', () => {
  test('uses concert A at 440 Hz', () => {
    expect(noteFreq('A4')).toBe(440);
  });

  test('converts natural and sharp notes', () => {
    expect(noteFreq('C4')).toBeCloseTo(261.63, 2);
    expect(noteFreq('G#4')).toBeCloseTo(415.3, 2);
  });

  test('doubles frequency at the octave', () => {
    expect(noteFreq('C5')).toBeCloseTo(noteFreq('C4') * 2, 10);
  });
});
