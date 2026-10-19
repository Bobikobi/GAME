/**
 * Ambient creatures are map content (DECISIONS 2026-10-19): kinds and spots in
 * `content/core/map.json`, drawn by the client behind `?rich=` motion, never
 * seen by the kernel. These pin that every spot sits where its kind perches,
 * and that the four looks the first step promises are all present.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Bundle } from '@game/kernel';
import { runCheck } from '../src/check';

let bundle: Bundle;

beforeAll(() => {
  const found = runCheck().assembled.bundle;
  if (!found) throw new Error('Content did not assemble into a bundle.');
  bundle = found;
});

describe('ambient creatures', () => {
  it('has a bird, a fish, a rabbit and a deer, each with at least one spot', () => {
    const { kinds, spots } = bundle.map.creatures!;
    for (const look of ['bird', 'fish', 'rabbit', 'deer'] as const) {
      const ids = Object.entries(kinds).filter(([, k]) => k.look === look).map(([id]) => id);
      expect(spots.some((s) => ids.includes(s.kind)), look).toBe(true);
    }
  });

  it('sets every spot on the kind of ground its kind perches on', () => {
    const { legend, ground, creatures } = bundle.map;
    for (const s of creatures!.spots) {
      const tile = legend[ground[s.y]![s.x]!]!;
      const perch = creatures!.kinds[s.kind]!.perch;
      if (perch === 'water') expect(tile.tag, `${s.kind} ${s.x},${s.y}`).toBe('water');
      else if (perch === 'tree') expect(tile.tag === 'grove' && tile.solid, `${s.kind} ${s.x},${s.y}`).toBe(true);
      else expect(tile.solid, `${s.kind} ${s.x},${s.y}`).toBe(false);
    }
  });

  it('keeps deer to the dawn', () => {
    const deer = Object.values(bundle.map.creatures!.kinds).filter((k) => k.look === 'deer');
    for (const k of deer) expect(k.hours).toBeDefined();
  });
});
