/** The light block is data in params and reaches the bundle, wash and sun alike (ART_SYSTEM section 2). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { ParamsFile } from '@game/schema';
import { flattenParams } from '../src/assemble';
import { CONTENT_DIR } from '../src/load';

describe('the light block', () => {
  test('reaches the bundle with its wash and its sun', () => {
    const file = JSON.parse(readFileSync(join(CONTENT_DIR, 'core', 'params.json'), 'utf8')) as ParamsFile;
    const params = flattenParams(file.params);
    expect(params.light?.keys.length).toBeGreaterThanOrEqual(2);
    expect(params.light?.sun?.keys.length).toBeGreaterThanOrEqual(2);
    expect(params.light?.sun?.alpha).toBe(30);
    expect(params.light?.sun?.cap).toBe(110);
  });
});
