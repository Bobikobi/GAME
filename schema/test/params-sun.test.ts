/** The sun's shear is data beside the hour table (ART_SYSTEM section 2, STYLE section 4). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Value } from '@sinclair/typebox/value';
import { describe, expect, it } from 'vitest';

import { LightParams } from '../src/index';

const PARAMS = join(import.meta.dirname, '..', '..', 'content', 'core', 'params.json');
const file = JSON.parse(readFileSync(PARAMS, 'utf8')) as {
  params: { light: { keys: unknown[]; sun: { keys: { right: number }[] } } };
};
const light = file.params.light;

describe('the sun block', () => {
  it('is in the valley params and validates', () => {
    expect(light.sun.keys.length).toBeGreaterThanOrEqual(2);
    expect(Value.Check(LightParams, light)).toBe(true);
  });

  it('steps from a left lean in the morning to a right lean in the evening', () => {
    expect(light.sun.keys[0]!.right).toBeLessThan(0);
    expect(light.sun.keys[light.sun.keys.length - 1]!.right).toBeGreaterThan(0);
  });

  it('refuses a shear outside its bounds, and a sun with no keys', () => {
    const bad = structuredClone(light) as { sun: { keys: { right: number }[] } };
    bad.sun.keys[0]!.right = 400;
    expect(Value.Check(LightParams, bad)).toBe(false);
    const empty = structuredClone(light) as { sun: { keys: unknown[] } };
    empty.sun.keys = [];
    expect(Value.Check(LightParams, empty)).toBe(false);
  });
});
