import { describe, expect, test } from 'vitest';
import { draw, widenSeed } from '@game/kernel';

import { COAT_INK, type Coat, coatEntity, coatOf, coatTable, type Ramps, remapCoat } from '../src/coat';
import { readSettings } from '../../tools/src/anim/clip';
import { INK_HEX } from '../../tools/src/kit/ink';
import { CORE_RAMPS, DEEP_PALETTE } from '../../tools/src/kit/palette';

const RAMPS: Ramps = Object.fromEntries(CORE_RAMPS.map((r) => [r.id, r.steps]));
const PALETTE = new Set(DEEP_PALETTE.map((hex) => Number.parseInt(hex.slice(1), 16)));
const settings = readSettings();
const KINDS = ['hare', 'crow'] as const;
/** A world's key, as the server holds it: the coats' draws are taken under it. */
const SEED = widenSeed(911);
const coatsOf = (kind: string): Coat[] => (settings.targets[kind]?.coats ?? []) as Coat[];
const rgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** CIELAB of a colour (sRGB, D65), for telling two coats apart the way an eye does. */
function lab(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/**
 * The share of each body step on the rendered sheets (idle, walk and graze or peck, three views each), rounded: the
 * hare's body is mostly skin 1 with skin 4 ticking, the crow's mostly stone 0.
 */
const BODY: Record<string, { ramp: string; share: readonly number[] }> = {
  hare: { ramp: 'skin', share: [7, 50, 4, 0, 29, 10] },
  crow: { ramp: 'stone', share: [87, 12, 0, 0, 1, 0] },
};

/** A coat's mean body colour in CIELAB, each step of the body ramp weighted by its share on the sheets. */
function meanBody(kind: string, coat: Coat): [number, number, number] {
  const { ramp, share } = BODY[kind]!;
  const total = share.reduce((a, b) => a + b, 0);
  const table = coatTable(coat.map, RAMPS);
  const sum: [number, number, number] = [0, 0, 0];
  RAMPS[ramp]!.forEach((step, i) => {
    const c = Number.parseInt(step.slice(1), 16);
    const out = table.get(c) ?? c;
    lab(`#${out.toString(16).padStart(6, '0')}`).forEach((v, k) => { sum[k] += (v * share[i]!) / total; });
  });
  return sum;
}

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

  test('a coat is drawn under its own prefix, and the server\'s draw is fixed for a creature and a world', () => {
    expect(coatEntity('core/hare@3,4')).toBe('coat:core/hare@3,4');
    expect(coatEntity(42)).toBe('coat:42');
    const roll = draw(SEED, coatEntity('hare-17'), 0);
    expect(draw(SEED, coatEntity('hare-17'), 0)).toBe(roll);
    expect(draw(SEED, coatEntity('hare-18'), 0)).not.toBe(roll);
    expect(draw(widenSeed(912), coatEntity('hare-17'), 0)).not.toBe(roll);
    expect(Number.isInteger(roll) && roll >= 0 && roll < 2 ** 32).toBe(true);
  });

  test('the same draw always gives the same coat, and the ends of the draw the first and the last coat', () => {
    for (const kind of KINDS) {
      const coats = coatsOf(kind);
      for (let i = 0; i < 200; i += 1) {
        const roll = draw(SEED, coatEntity(`${kind}-${i}`), 0);
        const a = coatOf(coats, roll);
        expect(a).toBeDefined();
        expect(coatOf([...coats], roll)).toBe(a);
      }
      expect(coatOf(coats, 0)).toBe(coats[0]);
      expect(coatOf(coats, 2 ** 32 - 1)).toBe(coats[coats.length - 1]);
    }
  });

  test('over many creatures drawn by the kernel each coat\'s share is its weight\'s share, within a point and a half', () => {
    const n = 40000;
    for (const kind of KINDS) {
      const coats = coatsOf(kind);
      const total = coats.reduce((s, c) => s + c.weight, 0);
      const count = new Map<string, number>();
      for (let i = 0; i < n; i += 1) {
        const c = coatOf(coats, draw(SEED, coatEntity(i), 0))!;
        count.set(c.id, (count.get(c.id) ?? 0) + 1);
      }
      for (const c of coats) expect(Math.abs((count.get(c.id) ?? 0) / n - c.weight / total), `${kind} ${c.id}`).toBeLessThan(0.015);
    }
  });

  test('a kind with no coats, or weights that sum to nothing, wears none, and a weight that is not whole is refused', () => {
    expect(coatOf([], 1)).toBeUndefined();
    expect(coatOf([{ id: 'z', name: 'z', weight: 0, map: {} }], 1)).toBeUndefined();
    expect(() => coatOf([{ id: 'z', name: 'z', weight: 0.5, map: {} }, { id: 'y', name: 'y', weight: 0.5, map: {} }], 1)).toThrow(/"z" has a weight that is not a whole number/);
    expect(() => coatOf([{ id: 'z', name: 'z', weight: -1, map: {} }, { id: 'y', name: 'y', weight: 2, map: {} }], 1)).toThrow(/"z" has a weight/);
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

  test('a step list sends each step where it names, and null keeps a step', () => {
    const n = (hex: string) => Number.parseInt(hex.slice(1), 16);
    const table = coatTable({ stone: { steps: ['wood:0', 'wood:1', 'grey:5', null, null, null] } }, RAMPS);
    expect(table.get(n(RAMPS.stone![0]!))).toBe(n(RAMPS.wood![0]!));
    expect(table.get(n(RAMPS.stone![2]!))).toBe(n(RAMPS.grey![5]!));
    expect(table.has(n(RAMPS.stone![4]!))).toBe(false);
    expect(() => coatTable({ stone: { steps: ['wood:0'] } }, RAMPS)).toThrow(/six steps/);
    expect(() => coatTable({ stone: { steps: ['wood:9', null, null, null, null, null] } }, RAMPS)).toThrow(/ramp:step/);
  });

  test('refuses a step that lands on the ink, by shift or by name', () => {
    expect(() => coatTable({ skin: { to: 'grey', shift: -1 } }, RAMPS)).toThrow(/skin step 0 lands on the ink/);
    expect(() => coatTable({ wood: { to: 'grey' } }, RAMPS)).toThrow(/wood step 0 lands on the ink/);
    expect(() => coatTable({ skin: { steps: [null, 'grey:0', null, null, null, null] } }, RAMPS)).toThrow(/skin step 1 lands on the ink/);
  });

  test('every coat keeps the shading: its body ramp\'s six steps land on three colours or more', () => {
    const body: Record<string, string> = { hare: 'skin', crow: 'stone' };
    for (const kind of KINDS) {
      for (const coat of coatsOf(kind)) {
        const table = coatTable(coat.map, RAMPS);
        const steps = RAMPS[body[kind]!]!.map((hex) => Number.parseInt(hex.slice(1), 16));
        const out = new Set(steps.map((c) => table.get(c) ?? c));
        expect(out.size, `${kind} ${coat.id}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  test('no two coats on one body look alike: their mean body colours lie 12 or more apart in CIELAB', () => {
    for (const kind of KINDS) {
      const coats = coatsOf(kind);
      for (const [i, a] of coats.entries()) {
        for (const b of coats.slice(i + 1)) {
          if ((a.body ?? kind) !== (b.body ?? kind)) continue;
          const [la, lb] = [meanBody(kind, a), meanBody(kind, b)];
          expect(Math.hypot(la[0]! - lb[0]!, la[1]! - lb[1]!, la[2]! - lb[2]!), `${kind} ${a.id} and ${b.id}`).toBeGreaterThanOrEqual(12);
        }
      }
    }
  });

  test('the grey hares stay apart in lightness: black, ash grey and white each 15 or more apart on the body', () => {
    const coats = new Map(coatsOf('hare').map((c) => [c.id, c]));
    const [black, ash, white] = ['black', 'ash-grey', 'white'].map((id) => meanBody('hare', coats.get(id)!)[0]) as [number, number, number];
    expect(ash - black, 'ash grey over black').toBeGreaterThanOrEqual(15);
    expect(white - ash, 'white over ash grey').toBeGreaterThanOrEqual(15);
  });

  test('refuses a ramp it does not know', () => {
    expect(() => coatTable({ velvet: { to: 'grey' } }, RAMPS)).toThrow(/velvet/);
    expect(() => coatTable({ grey: { to: 'velvet' } }, RAMPS)).toThrow(/velvet/);
  });
});
