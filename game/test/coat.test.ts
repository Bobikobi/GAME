import { describe, expect, test } from 'vitest';

import { COAT_INK, type Coat, coatHash, coatOf, coatTable, idHash, type Ramps, remapCoat } from '../src/coat';
import { readSettings } from '../../tools/src/anim/clip';
import { INK_HEX } from '../../tools/src/kit/ink';
import { CORE_RAMPS, DEEP_PALETTE } from '../../tools/src/kit/palette';

const RAMPS: Ramps = Object.fromEntries(CORE_RAMPS.map((r) => [r.id, r.steps]));
const PALETTE = new Set(DEEP_PALETTE.map((hex) => Number.parseInt(hex.slice(1), 16)));
const settings = readSettings();
const KINDS = ['hare', 'crow'] as const;
const coatsOf = (kind: string): Coat[] => (settings.targets[kind]?.coats ?? []) as Coat[];
const rgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** A made-up sheet: every step of every shared ramp, opaque, then the ink, a half-transparent pixel and a clear one. */
function sheet(): Uint8ClampedArray {
  const colours = [...CORE_RAMPS.flatMap((r) => r.steps), INK_HEX];
  const data = new Uint8ClampedArray((colours.length + 2) * 4);
  colours.forEach((hex, i) => data.set([...rgb(hex), 255], i * 4));
  data.set([...rgb('#c99a5e'), 128], colours.length * 4);
  return data;
}

describe('coat pick', () => {
  test('the ink is the kit\'s one ink', () => {
    expect(COAT_INK).toBe(Number.parseInt(INK_HEX.slice(1), 16));
  });

  test('the hash is fixed, unsigned and takes a numeric id and its text alike', () => {
    expect(idHash('')).toBe(2166136261);
    expect(idHash('a')).toBe(0xe40c292c);
    expect(idHash(42)).toBe(idHash('42'));
    expect(coatHash('hare-17', 3)).toBe(coatHash('hare-17', 3));
    expect(coatHash('hare-17', 3)).not.toBe(coatHash('hare-17', 4));
    expect(coatHash('hare-17', 3)).not.toBe(coatHash('hare-18', 3));
    const h = coatHash(123456789, -7);
    expect(Number.isInteger(h) && h >= 0 && h < 2 ** 32).toBe(true);
  });

  test('the same creature in the same world always wears the same coat', () => {
    for (const kind of KINDS) {
      const coats = coatsOf(kind);
      for (let i = 0; i < 200; i += 1) {
        const a = coatOf(coats, `${kind}-${i}`, 20261030);
        expect(a).toBeDefined();
        expect(coatOf([...coats], `${kind}-${i}`, 20261030)).toBe(a);
      }
    }
  });

  test('over many creatures each coat\'s share is its weight\'s share, within a point and a half', () => {
    const n = 40000;
    for (const kind of KINDS) {
      const coats = coatsOf(kind);
      const total = coats.reduce((s, c) => s + c.weight, 0);
      const count = new Map<string, number>();
      for (let i = 0; i < n; i += 1) {
        const c = coatOf(coats, i, 911)!;
        count.set(c.id, (count.get(c.id) ?? 0) + 1);
      }
      for (const c of coats) expect(Math.abs((count.get(c.id) ?? 0) / n - c.weight / total), `${kind} ${c.id}`).toBeLessThan(0.015);
    }
  });

  test('a kind with no coats, or weights that sum to nothing, wears none', () => {
    expect(coatOf([], 'x', 1)).toBeUndefined();
    expect(coatOf([{ id: 'z', name: 'z', weight: 0, map: {} }], 'x', 1)).toBeUndefined();
  });
});

describe('coat recolour', () => {
  test('every coat writes palette colours only, leaves the ink and the clear pixels alone, and moves only its ramps', () => {
    for (const kind of KINDS) {
      for (const coat of coatsOf(kind)) {
        const before = sheet();
        const data = sheet();
        remapCoat(data, coat.map, RAMPS);
        const mapped = new Set(Object.keys(coat.map).flatMap((r) => RAMPS[r]!.map((h) => Number.parseInt(h.slice(1), 16))));
        for (let i = 0; i < data.length; i += 4) {
          const was = (before[i]! << 16) | (before[i + 1]! << 8) | before[i + 2]!;
          const now = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
          expect(data[i + 3], `${kind} ${coat.id} alpha`).toBe(before[i + 3]);
          if (before[i + 3] !== 255) expect(now).toBe(was);
          else expect(PALETTE.has(now), `${kind} ${coat.id} #${now.toString(16)}`).toBe(true);
          if (was === COAT_INK || !mapped.has(was)) expect(now, `${kind} ${coat.id} #${was.toString(16)}`).toBe(was);
        }
      }
    }
  });

  test('a step goes to the shifted step of the other ramp, clamped at both ends', () => {
    const table = coatTable({ skin: { to: 'stone', shift: -1 }, wood: { to: 'grey', shift: 3 } }, RAMPS);
    const n = (hex: string) => Number.parseInt(hex.slice(1), 16);
    const skin = RAMPS.skin!;
    const stone = RAMPS.stone!;
    const wood = RAMPS.wood!;
    const grey = RAMPS.grey!;
    expect(table.get(n(skin[0]!))).toBe(n(stone[0]!));
    expect(table.get(n(skin[3]!))).toBe(n(stone[2]!));
    expect(table.get(n(wood[1]!))).toBe(n(grey[4]!));
    expect(table.get(n(wood[4]!))).toBe(n(grey[5]!));
  });

  test('the outline stays the ink even when the grey ramp, whose darkest step it is, is mapped', () => {
    const data = new Uint8ClampedArray([...rgb(INK_HEX), 255, ...rgb(RAMPS.grey![1]!), 255]);
    remapCoat(data, { grey: { to: 'bark', shift: 2 } }, RAMPS);
    expect([...data.subarray(0, 4)]).toEqual([...rgb(INK_HEX), 255]);
    expect([...data.subarray(4, 7)]).toEqual(rgb(RAMPS.bark![3]!));
  });

  test('refuses a ramp it does not know', () => {
    expect(() => coatTable({ velvet: { to: 'grey' } }, RAMPS)).toThrow(/velvet/);
    expect(() => coatTable({ grey: { to: 'velvet' } }, RAMPS)).toThrow(/velvet/);
  });
});
