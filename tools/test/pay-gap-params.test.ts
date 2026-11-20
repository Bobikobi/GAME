import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { ParamsFile } from '@game/schema';
import { flattenParams } from '../src/assemble';
import { CONTENT_DIR } from '../src/load';

/**
 * The pay-gap check's two params (G62, docs/design/OPEN_WORLD.md 1.5): the ceiling of pillar 1 in game
 * milliseconds and the tiles a pay is already on screen. Older content without them reads the draft's numbers.
 */
describe('pay_gap_ms and pay_sight_tiles', () => {
  const file = JSON.parse(readFileSync(join(CONTENT_DIR, 'core', 'params.json'), 'utf8')) as ParamsFile;

  test('the core params carry the draft\'s values', () => {
    const params = flattenParams(file.params);
    expect(params.pay_gap_ms).toBe(90000);
    expect(params.pay_sight_tiles).toBe(5);
  });

  test('old params without them use the bounded defaults', () => {
    const params = structuredClone(file.params);
    delete params.pay_gap_ms;
    delete params.pay_sight_tiles;
    const flat = flattenParams(params);
    expect(flat.pay_gap_ms).toBe(90000);
    expect(flat.pay_sight_tiles).toBe(5);
  });

  test('the allowance at the core params is 241 steps', () => {
    const p = flattenParams(file.params);
    expect(Math.floor(p.pay_gap_ms / (2 * p.walk_step_ms)) + p.pay_sight_tiles).toBe(241);
  });
});
