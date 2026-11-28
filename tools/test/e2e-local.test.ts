import { describe, expect, test } from 'vitest';
import { CONTEXT, verdict } from '../src/e2e-local';

describe('the GPU run posts one status per commit', () => {
  test('every group green is success, counted', () => {
    expect(verdict([{ group: 'opening-phone', ok: true }, { group: 'map-and-shop', ok: true }])).toEqual({ state: 'success', description: '2/2 groups green on a GPU' });
  });

  test('a red group is a failure that names it, within the 140 characters a status holds', () => {
    const v = verdict([{ group: 'opening-phone', ok: false }, { group: 'map-and-shop', ok: true }]);
    expect(v).toEqual({ state: 'failure', description: '1/2 green; failed: opening-phone' });
    const many = verdict(Array.from({ length: 30 }, (_, i) => ({ group: `a-long-group-name-${i}`, ok: false })));
    expect(many.description.length).toBeLessThanOrEqual(140);
  });

  test('the status has one fixed name, so a later run replaces the earlier one', () => {
    expect(CONTEXT).toBe('e2e on a GPU');
  });
});
