/** The walking wolf's sprite: never more than a tile from the kernel's tile, and no slide toward its den before dawn. */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type Hazard, hazardsOf, nightEnds, nightFalls, predatorAt, windowOpen } from '@game/kernel';
import { predatorSpriteAt } from '../src/predator';
import { loadBundle } from '../../tools/test/helpers/world';

const STEP = 5;

function gap(a: readonly [number, number], b: readonly [number, number]): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
}

describe('predatorSpriteAt', () => {
  let b: Bundle;
  let wolf: Hazard;
  beforeAll(() => {
    b = loadBundle();
    const found = hazardsOf(b).find((h) => h.id === 'core/bank-wolf');
    if (!found?.round) throw new Error('core/bank-wolf with a round is missing from the map');
    wolf = found;
  });

  // the shipped pace, and one that does not divide the night, so the last pace is cut short by dawn
  for (const pace of [undefined, 700]) {
    describe(pace === undefined ? 'at the shipped pace' : `at pace ${pace}`, () => {
      const rule = (): Hazard => (pace === undefined ? wolf : { ...wolf, pace });

      test('stays within one tile of the kernel tile all night and glides without jumps', () => {
        const r = rule();
        const dusk = nightFalls(b, 0);
        const dawn = nightEnds(b, dusk);
        let prev: [number, number] | undefined;
        for (let t = dusk - 2000; t <= dawn + 2000; t += STEP) {
          const at = predatorSpriteAt(b, r, t);
          expect(gap(at, predatorAt(b, r, t))).toBeLessThanOrEqual(1);
          if (prev && windowOpen(b, r, t) && windowOpen(b, r, t - STEP)) expect(gap(at, prev)).toBeLessThanOrEqual(0.5);
          prev = at;
        }
      });

      test('holds on its tile through the last pace before dawn, then sleeps on the den', () => {
        const r = rule();
        const dusk = nightFalls(b, 0);
        const dawn = nightEnds(b, dusk);
        // the last step the kernel takes before dawn; a night need not hold a whole number of paces
        const last = dusk + Math.floor((dawn - 1 - dusk) / r.pace) * r.pace;
        for (let t = last; t < dawn; t += STEP) {
          expect(predatorSpriteAt(b, r, t)).toEqual(predatorAt(b, r, t));
        }
        expect(predatorSpriteAt(b, r, dawn)).toEqual(r.round![0]);
      });
    });
  }

  test('reaches each kernel tile on the tick that tile begins', () => {
    const dusk = nightFalls(b, 0);
    for (let k = 0; k < 2 * wolf.round!.length; k++) {
      const t = dusk + k * wolf.pace;
      expect(predatorSpriteAt(b, wolf, t)).toEqual(predatorAt(b, wolf, t));
    }
  });
});
