/**
 * Ambient creatures are map content (DECISIONS 2026-10-19): kinds and spots in
 * `content/core/map.json`, for the client to draw behind `?rich=` motion (no
 * client draws them yet). The kernel reads them since: a kind's `hunt` (the
 * dress verb and the hunt value source) and, for a den, its spots (the bolt
 * hole, kernel/src/wild/den.ts). These pin that every spot sits where its kind
 * perches, that the four looks the first step promises are all present, and
 * that every kind of the core keeps BESTIARY 1's hours.
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

  it('keeps deer to the bestiary hours, the dusk ramp included, and no kind of the core out at every hour', () => {
    const { kinds } = bundle.map.creatures!;
    const deer = Object.values(kinds).filter((k) => k.look === 'deer');
    expect(deer.length).toBeGreaterThan(0);
    for (const k of deer) expect(k.hours).toEqual([5, 22]);
    // a kind with no hours is out at every hour, the night included (the wild brain's awake), so each names its own
    for (const [id, k] of Object.entries(kinds)) expect(k.hours, id).toBeDefined();
  });
});
