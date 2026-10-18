import { describe, expect, test } from 'vitest';

import { DEFAULT_CARVE, STONE_NAMES, STONE_PURSE, stoneView } from '../src/stone';

describe('the returners stone', () => {
  test('shows six written names above one line, which is the player\'s name', () => {
    const v = stoneView('core/old-bridge', ['core/old-bridge'], 'Tess')!;
    expect(v.names.length).toBeGreaterThanOrEqual(6);
    expect(v.names.every((n) => /^\S+$/.test(n))).toBe(true);
    expect(v.carved).toBe('Tess');
  });

  test('has an empty line until a name is cut, and a name made before it stays', () => {
    expect(stoneView('core/old-bridge', ['core/old-bridge'], '')!.carved).toBe('');
    expect(stoneView('core/old-bridge', ['core/old-bridge'], 'Old save')!.carved).toBe('Old save');
  });

  test('stands at the bridge only, and only once it is mended', () => {
    expect(stoneView('core/old-bridge', [], 'Tess')).toBeUndefined();
    expect(stoneView('core/arch-way', ['core/arch-way'], 'Tess')).toBeUndefined();
  });

  test('the default carve is a valid name, one word, apart from the written ones', () => {
    expect(DEFAULT_CARVE).toMatch(/^[A-Za-z0-9 _-]{1,16}$/);
    expect(STONE_NAMES).not.toContain(DEFAULT_CARVE);
  });

  test('every box is two lines of at most 80 characters and names no giver', () => {
    expect(STONE_PURSE.length).toBeLessThanOrEqual(2);
    expect(STONE_PURSE.every((l) => l.length <= 80)).toBe(true);
    expect(STONE_PURSE.join(' ')).not.toMatch(/\b(left|hung by|someone|they)\b/i);
  });
});
