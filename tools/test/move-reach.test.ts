import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { ParamsFile } from '@game/schema';
import { flattenParams } from '../src/assemble';
import { CONTENT_DIR } from '../src/load';

describe('move_reach_max', () => {
  test('old params without the optional cap use the bounded default', () => {
    const file = JSON.parse(readFileSync(join(CONTENT_DIR, 'core', 'params.json'), 'utf8')) as ParamsFile;
    const params = structuredClone(file.params);
    delete params.move_reach_max;
    expect(flattenParams(params).move_reach_max).toBe(32);
  });
});
