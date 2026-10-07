import { beforeAll, describe, expect, test } from 'vitest';

import type { Bundle } from '@game/kernel';
import { itemBenefit } from '../src/text';
import { loadBundle } from '../../tools/test/helpers/world';

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

describe('tool benefits', () => {
  test('derives resource and dig-site lists from the bundle', () => {
    expect(itemBenefit(bundle, 'core/basket')).toBe('Tier 1 basket · gathers forest mushrooms & wild herbs · 60 uses');
    expect(itemBenefit(bundle, 'core/trowel')).toBe('Tier 1 trowel · digs deep ruins & gate rubble · 40 uses');

    const withReeds: Bundle = {
      ...bundle,
      resources: {
        ...bundle.resources,
        'test/reeds': { ...bundle.resources['core/wild-herbs']!, id: 'test/reeds', title: 'Reeds' },
      },
    };
    expect(itemBenefit(withReeds, 'core/basket')).toContain('gathers forest mushrooms & reeds & wild herbs');
  });
});

describe('food benefits', () => {
  test('speak in food meter points and minutes of work', () => {
    expect(itemBenefit(bundle, 'core/berry')).toBe('+4 food · about 34 s of work');
    expect(itemBenefit(bundle, 'core/berry-mash')).toBe('+15 food · about 2 min of work');
  });
});
