import { beforeAll, describe, expect, test } from 'vitest';
import { WEAR_SLOTS, adaptState, itemCategory, newState, serialize, slotsFor, step, wornValue, type Bundle } from '@game/kernel';
import { loadBundle } from '../../tools/test/helpers/world';

let b: Bundle;
beforeAll(() => {
  b = structuredClone(loadBundle());
  b.items['x/gloves'] = {
    ...b.items['core/work-clothes']!, id: 'x/gloves', name: 'Gloves',
    wear: { slot: 'hands', effects: [{ effect: 'gather_speed_pct', value: 5 }] },
  };
});

function wearer() {
  const r = step(b, newState(b, 1), { t: 'start', starter: 'core/forager', name: 'Wearer' }, 0);
  if (!r.ok) throw new Error(r.error);
  r.state.player.worn = {};
  r.state.player.bag['x/gloves'] = 1;
  return r.state;
}

describe('the hands wear place', () => {
  test('ten places keep hands after feet and the held hand separate', () => {
    expect(WEAR_SLOTS).toEqual(['head', 'top', 'legs', 'outfit', 'feet', 'hands', 'jewelry1', 'jewelry2', 'hand', 'back']);
    expect(slotsFor('hands')).toEqual(['hands']);
    expect(slotsFor('hand')).toEqual(['hand']);
  });

  test('a glove is clothing and its worn effect counts from hands', () => {
    const r = step(b, wearer(), { t: 'wear', item: 'x/gloves' }, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.player.worn).toEqual({ hands: 'x/gloves' });
    expect(wornValue(b, r.state, 'gather_speed_pct')).toBe(5);
    expect(itemCategory(b.items['x/gloves']!)).toBe('wear');
  });

  test('the same glove is refused in hand', () => {
    expect(step(b, wearer(), { t: 'wear', item: 'x/gloves', slot: 'hand' }, 0)).toEqual({ ok: false, error: 'It does not go there.' });
  });

  test('a held tool is refused in hands', () => {
    const s = wearer();
    s.player.bag['core/walking-staff'] = 1;
    expect(step(b, s, { t: 'wear', item: 'core/walking-staff', slot: 'hands' }, 0)).toEqual({ ok: false, error: 'It does not go there.' });
  });

  test('the existing save adapter loads an old save with hands empty', () => {
    const saved = wearer();
    saved.kernel = '0.26.0';
    saved.content = 'older-content';
    saved.player.worn.hand = 'core/walking-staff';
    saved.player.bag['core/walking-staff'] = 1;
    const before = serialize(saved);
    const loaded = adaptState(b, JSON.parse(before))!;
    expect(loaded.kernel).toBe('0.27.0');
    expect(loaded.player.worn.hands).toBeUndefined();
    expect(loaded.player.looks.hands).toBeUndefined();
    expect(loaded.player.worn.hand).toBe('core/walking-staff');
    expect(serialize(saved)).toBe(before);
    expect(step(b, loaded, { t: 'wear', item: 'x/gloves' }, 0).ok).toBe(true);
  });
});
