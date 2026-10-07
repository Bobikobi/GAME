/** Unit tests for compact score parsing and sixteenth-note timing. */
import { describe, expect, test } from 'vitest';

import { parseChannel, stepMs } from '../../src/audio/sequence';
import { songs } from '../../src/audio/songs';

describe('score parser', () => {
  test('parses notes, rests, default lengths, and ignored bar lines', () => {
    expect(parseChannel('tiny', 'lead', 'A4 -:2 | G#4:3 C5', 7)).toEqual({
      events: [
        { value: 'A4', start: 0, steps: 1 },
        { value: null, start: 1, steps: 2 },
        { value: 'G#4', start: 3, steps: 3 },
        { value: 'C5', start: 6, steps: 1 },
      ],
      totalSteps: 7,
    });
  });

  test('reports the tune, channel, expected length, and actual length', () => {
    expect(() => parseChannel('valley', 'lead', 'A4:3', 16)).toThrowError(
      'valley lead: expected 16 steps, found 3',
    );
  });
});

describe('score timing', () => {
  test('derives one sixteenth note from BPM', () => {
    expect(stepMs(88)).toBeCloseTo(60_000 / 88 / 4, 10);
  });

  test('starts valley lead bar two at step 16', () => {
    const lead = parseChannel('valley', 'lead', songs.valley.channels.lead, songs.valley.bars * 16);
    expect(lead.events.find((event) => event.start >= 16)?.start).toBe(16);
  });
});
