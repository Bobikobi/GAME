/**
 * The weapon block (WEAPONS 3; appendix row 1): eight closed fields, no class field, every bound held by
 * the schema. The check refuses every weapon block in content until combat (G35, G44); here only the shape.
 */
import { describe, expect, it } from 'vitest';
import { FORMAT_VERSION, WEAPON_TEMPOS, validateFile } from '../src/index';

const items = (...list: object[]) => ({ format: FORMAT_VERSION, type: 'items', id: 'tester/items', title: 'Items', creator: 'tester', items: list });
const hand = (weapon: object) => ({
  id: 'tester/club',
  name: 'Club',
  kind: 'tool',
  rarity: 'common',
  class: 'tool',
  tier: 1,
  sprite: 'core/base-kit:items/herb',
  weight: 1,
  wear: { slot: 'hand' },
  weapon,
});
const base = { tempo: 'standard', windup_t: 4, reach: 1, harm: 100 };
const check = (weapon: object) => validateFile(items(hand(weapon)));
const pathsOf = (weapon: object) => check(weapon).map((i) => i.path);

describe('the weapon block', () => {
  it('accepts a weapon block at every bound (WEAPONS 3)', () => {
    for (const tempo of WEAPON_TEMPOS) expect(check({ ...base, tempo })).toEqual([]);
    for (const windup_t of [2, 10]) expect(check({ ...base, windup_t })).toEqual([]);
    for (const reach of [1, 2]) expect(check({ ...base, reach })).toEqual([]);
    for (const harm of [0, 1000]) expect(check({ ...base, harm })).toEqual([]);
    for (const range of [2, 12]) expect(check({ ...base, range })).toEqual([]);
    for (const noise of [0, 12]) expect(check({ ...base, noise })).toEqual([]);
    for (const uses of [1, 1000]) expect(check({ ...base, uses })).toEqual([]);
    for (const ammo of ['tool', 'core/arrow']) expect(check({ ...base, ammo })).toEqual([]);
  });

  it('refuses a weapon block past each bound, with the path at the field', () => {
    expect(check(base)).toEqual([]);
    const past: [string, number][] = [
      ['windup_t', 1],
      ['windup_t', 11],
      ['reach', 0],
      ['reach', 3],
      ['harm', -1],
      ['harm', 1001],
      ['range', 1],
      ['range', 13],
      ['noise', -1],
      ['noise', 13],
      ['uses', 0],
      ['uses', 1001],
    ];
    for (const [field, value] of past) expect(pathsOf({ ...base, [field]: value })).toContain(`/items/0/weapon/${field}`);
  });

  it('refuses an unknown tempo, a class key and a missing tempo', () => {
    expect(check(base)).toEqual([]);
    expect(pathsOf({ ...base, tempo: 'slow' })).toContain('/items/0/weapon/tempo');
    // the class is the item's own (WEAPONS 3): the block is closed
    const withClass = pathsOf({ ...base, class: 'core/spear' });
    expect(withClass.length).toBeGreaterThan(0);
    expect(withClass.every((p) => p.startsWith('/items/0/weapon/'))).toBe(true);
    const { tempo: _tempo, ...noTempo } = base;
    const missing = pathsOf(noTempo);
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.every((p) => p.startsWith('/items/0/weapon/'))).toBe(true);
  });
});
