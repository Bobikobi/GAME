/** Structural tests keep every authored channel aligned at its loop boundary. */
import { describe, expect, test } from 'vitest';

import { parseChannel } from '../../src/audio/sequence';
import { jingles, songs } from '../../src/audio/songs';

describe('song scores', () => {
  test.each(Object.entries(songs))('%s fills every bar in every channel', (name, song) => {
    const expected = song.bars * 16;
    for (const [channel, notation] of Object.entries(song.channels)) {
      expect(parseChannel(name, channel, notation, expected).totalSteps).toBe(expected);
    }
  });

  test.each(Object.entries(jingles))('%s fills every jingle channel', (name, jingle) => {
    for (const [channel, notation] of Object.entries(jingle.channels)) {
      expect(parseChannel(name, channel, notation, jingle.steps).totalSteps).toBe(jingle.steps);
    }
  });
});
