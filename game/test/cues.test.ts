/**
 * The world's cues (docs/design/REACTIONS.md, section 5): every cue the schema names has a shape and
 * a sound, and a cue far off is heard softer but never lost.
 */
import { describe, expect, test } from 'vitest';
import { CUES } from '@game/schema';

import { BIRDS, CUE_LOOK, cueGain } from '../src/cues';

describe('cues', () => {
  test('every cue the schema names is drawn and heard', () => {
    for (const cue of CUES) {
      expect(CUE_LOOK[cue].sfx).toBeTruthy();
      expect(CUE_LOOK[cue].ms).toBeGreaterThan(0);
    }
    expect(BIRDS.length).toBeGreaterThan(1);
  });

  test('a cue is heard whole on the tile and softer the farther it is, never under a third', () => {
    expect(cueGain(0)).toBe(1);
    for (let d = 1; d <= 8; d++) expect(cueGain(d)).toBeLessThan(cueGain(d - 1) + 1e-9);
    expect(cueGain(8)).toBeGreaterThanOrEqual(0.35);
    expect(cueGain(20)).toBe(0.35);
  });
});
