import { describe, expect, test } from 'vitest';
import { loadBundle } from '../../tools/test/helpers/world';

import { stoneView } from '../src/stone';

const bundle = loadBundle();
const bridge = bundle.restores['core/old-bridge']!;
const stone = bridge.stone!;

describe('the returners stone', () => {
  test('shows six written names above one line, which is the player\'s name', () => {
    const v = stoneView(bridge, ['core/old-bridge'], 'Tess')!;
    expect(v.names.length).toBeGreaterThanOrEqual(6);
    expect(v.names.every((n) => /^\S+$/.test(n))).toBe(true);
    expect(v.carved).toBe('Tess');
  });

  test('has an empty line until a name is cut, and a name made before it stays', () => {
    expect(stoneView(bridge, ['core/old-bridge'], '')!.carved).toBe('');
    expect(stoneView(bridge, ['core/old-bridge'], 'Old save')!.carved).toBe('Old save');
  });

  test('stands at the bridge only, and only once it is mended', () => {
    expect(stoneView(bridge, [], 'Tess')).toBeUndefined();
    const arch = bundle.restores['core/arch-way']!;
    expect(stoneView(arch, ['core/arch-way'], 'Tess')).toBeUndefined();
    expect(stoneView(undefined, ['core/old-bridge'], 'Tess')).toBeUndefined();
  });

  test('the default carve is a valid name, one word, apart from the written ones', () => {
    expect(stone.default_name).toMatch(/^[A-Za-z0-9 _-]{1,16}$/);
    expect(stone.names).not.toContain(stone.default_name);
  });

  test('every box is two lines of at most 80 characters and names no giver', () => {
    expect(stone.purse.length).toBeLessThanOrEqual(2);
    expect(stone.purse.every((l) => l.length <= 80)).toBe(true);
    expect(stone.purse.join(' ')).not.toMatch(/\b(left|hung by|someone|they)\b/i);
  });
});
