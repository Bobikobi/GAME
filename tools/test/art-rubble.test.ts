import { describe, expect, test } from 'vitest';

import { rubbleRows } from '../src/art/rubble.js';

describe('the rubble tiles', () => {
  test('each variant is 64 x 64 and the same seed draws the same rows', () => {
    for (const seed of [211, 240, 269, 298]) {
      const rows = rubbleRows(seed);
      expect(rows).toHaveLength(64);
      expect(rows.every((r) => r.length === 64)).toBe(true);
      expect(rubbleRows(seed)).toEqual(rows);
    }
  });
  test('the variants differ, and each shows lit stone, ink outline and bare ground', () => {
    expect(rubbleRows(211)).not.toEqual(rubbleRows(240));
    const flat = rubbleRows(211).join('');
    expect(flat).toMatch(/o/);
    expect(flat).toMatch(/H|G/);
    expect(flat).toMatch(/d/);
  });
});
