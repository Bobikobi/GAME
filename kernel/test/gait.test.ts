import { beforeAll, describe, expect, test } from 'vitest';
import { GAITS, gaitStepMs, newState, noiseRadius, step, walkStepMs, type Bundle, type State } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

let bundle: Bundle;
let state: State;

beforeAll(() => {
  bundle = loadBundle();
  const result = step(bundle, newState(bundle, 17), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
  if (!result.ok) throw new Error(result.error);
  state = result.state;
});

describe('the gaits', () => {
  test('a walk is the pace the load allows, a run half of it and a sneak twice, in whole milliseconds', () => {
    const walk = walkStepMs(bundle, state);
    expect(gaitStepMs(bundle, state, 'walk')).toBe(walk);
    expect(gaitStepMs(bundle, state, 'run')).toBe(walk / 2);
    expect(gaitStepMs(bundle, state, 'sneak')).toBe(walk * 2);
    for (const gait of GAITS) expect(Number.isInteger(gaitStepMs(bundle, state, gait))).toBe(true);
  });

  test('every load band divides into whole milliseconds for a run', () => {
    const { load, walk_step_ms, gait } = bundle.params;
    for (const pace of [load.light_step_ms, walk_step_ms, load.heavy_step_ms]) expect(pace % gait.run_div).toBe(0);
  });

  test('the noise table is still 2, sneak 3, walk 5, run 8 and only grows with the pace', () => {
    expect([noiseRadius(bundle, 'still'), noiseRadius(bundle, 'sneak'), noiseRadius(bundle, 'walk'), noiseRadius(bundle, 'run')]).toEqual([2, 3, 5, 8]);
  });
});
