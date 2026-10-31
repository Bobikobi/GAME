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

  test('carries the owner\'s pick of 30.10 and the night\'s readable floor', () => {
    const file = JSON.parse(readFileSync(join(CONTENT_DIR, 'core', 'params.json'), 'utf8')) as ParamsFile;
    const params = flattenParams(file.params);
    const at = (h: string) => params.light?.keys.find((k) => k.at === h);
    expect(at('16:30')).toEqual({ at: '16:30', tint: '#eda83a', pct: 12 });
    expect(at('17:30')).toEqual({ at: '17:30', tint: '#eda83a', pct: 28 });
    expect(at('19:00')).toEqual({ at: '19:00', tint: '#e2533f', pct: 40 });
    expect(at('21:00')).toEqual({ at: '21:00', tint: '#172a52', pct: 92 });
    expect(params.light?.read).toEqual({ floor: 22, fog: 40 });
  });
});
