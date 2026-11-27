import { describe, expect, test } from 'vitest';

import {
  DUSK, HEAD_GLOW, HOLE, LIGHT_POOL, NIGHT, POOL_DITHER, POOL_RADIUS, POOL_STEPS, READ, bankAt, bodyLight, bodyStep, cloudAt, cutAt, cutKeep, dappleAt, duskAt, frameAlpha, frameAt, hourAt,
  litSide, lumaOf, nightAt, poolAt, poolColour, poolDisc, poolStep, poolSun, readableAlpha, shadeAt, shaftAt, tableOf, washAt, warmth,
  PAINTED_POOL,
  paintedPoolTexel,
  paintedPoolStep,
  PAINTED_LIGHTS,
  FLAME_LEVELS,
  flameLevel,
  lightNow,
  poolJitter,
  poolGain,
  poolRadiusArt,
  poolTexelValue,
} from '../src/light.js';
import { FIGURE_ART_H } from '../src/contact.js';
import { groundLightOf, waterLook, type GroundLight } from '../src/look.js';
import lightTables from '../src/painted-light.json';

/**
 * ART_SYSTEM section 2: one module holds the light, and its numbers are today's numbers. Every
 * value world.ts drew by hand on 20.10 is pinned here, so moving the light out of the scene could
 * not have changed what a player sees.
 */
describe('the hour', () => {
  test('night falls from 21:00 to 04:00 and fades over two hours on each side', () => {
    expect(nightAt(12 * 60)).toBe(0);
    expect(nightAt(19 * 60)).toBe(0);
    expect(nightAt(20 * 60)).toBeCloseTo(0.5, 5);
    expect(nightAt(21 * 60)).toBe(1);
    expect(nightAt(2 * 60)).toBe(1);
    expect(nightAt(4 * 60)).toBe(1);
    expect(nightAt(5 * 60)).toBeCloseTo(0.5, 5);
    expect(nightAt(6 * 60)).toBe(0);
  });

  test('the hour of a minute is the hour a clock shows', () => {
    expect(hourAt(0)).toBe(0);
    expect(hourAt(19 * 60 + 59)).toBe(19);
    expect(hourAt(23 * 60 + 30)).toBe(23);
  });

  test('the dusk peaks at 20:00 and again at 05:30, and nowhere at noon', () => {
    expect(duskAt(20 * 60)).toBeCloseTo(DUSK.peak, 5);
    expect(duskAt(5 * 60 + 30)).toBeCloseTo(DUSK.peak, 5);
    expect(duskAt(12 * 60)).toBe(0);
  });
});

describe('what the shade and the dapple are worth', () => {
  test('the shade is half the night and the dapple is its opposite', () => {
    expect(shadeAt(0)).toBe(0);
    expect(shadeAt(1)).toBe(0.5);
    expect(dappleAt(0)).toBe(0.08);
    expect(dappleAt(1)).toBe(0);
  });

  test('the frame tightens at night, and tighter still with the light layer on', () => {
    expect(frameAt(0, true)).toEqual({ strength: 0.3, radius: 0.8 });
    expect(frameAt(1, true)).toEqual({ strength: 0.3 + 0.45, radius: 0.8 - 0.15 });
    expect(frameAt(1, false)).toEqual({ strength: 0.3 + 0.3, radius: 0.8 - 0.15 });
  });

  test('warmth is flat within half an hour of its centre and gone past the shoulder', () => {
    expect(warmth(20, 20)).toBe(1);
    expect(warmth(20.5, 20)).toBe(1);
    expect(warmth(22, 20)).toBe(0);
  });
});

describe('the lantern pool', () => {
  test('the hole is the pool plus its edge, both sides', () => {
    expect(HOLE).toBe(2 * (LIGHT_POOL.r + LIGHT_POOL.edge + 1));
  });

  test('the pool keeps the numbers it was decided with', () => {
    expect(LIGHT_POOL).toEqual({ r: 34, edge: 2, dark: 0.7, tint: 0xf0dcc0 });
    expect(NIGHT).toEqual({ from: 21, to: 4, fade: 2 });
  });
});

describe('the hour table from params', () => {
  // today's curve, keyed: gold at 40% across the half hour either side of 20:00 and of 05:30
  const KEYS = [
    { at: '04:15', tint: '#eda83a', pct: 0 },
    { at: '05:00', tint: '#eda83a', pct: 40 },
    { at: '06:00', tint: '#eda83a', pct: 40 },
    { at: '06:45', tint: '#eda83a', pct: 0 },
    { at: '18:45', tint: '#eda83a', pct: 0 },
    { at: '19:30', tint: '#eda83a', pct: 40 },
    { at: '20:30', tint: '#eda83a', pct: 40 },
    { at: '21:15', tint: '#eda83a', pct: 0 },
  ];
  const table = tableOf(KEYS);

  test('the keys sort by the clock, whatever order the file lists them in', () => {
    expect(table.map((k) => k.at)).toEqual([255, 300, 360, 405, 1125, 1170, 1230, 1275]);
  });

  test('the table reproduces the two peaks the valley shows today', () => {
    expect(washAt(table, 20 * 60)).toEqual({ tint: 0xeda83a, alpha: 0.4 });
    expect(washAt(table, 5 * 60 + 30)).toEqual({ tint: 0xeda83a, alpha: 0.4 });
    expect(washAt(table, 12 * 60)).toEqual({ tint: 0xeda83a, alpha: 0 });
    expect(washAt(table, 16 * 60 + 30)).toEqual({ tint: 0xeda83a, alpha: 0 });
  });

  test('the shoulders ramp evenly and reach nothing at the edges', () => {
    expect(washAt(table, 6 * 60 + 45).alpha).toBe(0);
    expect(washAt(table, 18 * 60 + 45).alpha).toBe(0);
    expect(washAt(table, 21 * 60 + 15).alpha).toBe(0);
    expect(washAt(table, 19 * 60).alpha).toBe(0.13);
    expect(washAt(table, 20 * 60 + 45).alpha).toBe(0.27);
  });

  test('outside the keys the day is plain', () => {
    expect(washAt(table, 2 * 60).alpha).toBe(0);
    expect(washAt(table, 23 * 60).alpha).toBe(0);
    expect(washAt(table, 12 * 60).alpha).toBe(0);
  });

  test('a key that crosses midnight is read across it, not cut at the clock', () => {
    // the decided night key as it will read: strong at 22:00, nothing at 05:00
    const night = tableOf([
      { at: '05:00', tint: '#000000', pct: 0 },
      { at: '22:00', tint: '#ffffff', pct: 60 },
    ]);
    expect(washAt(night, 22 * 60).alpha).toBeCloseTo(0.6, 5);
    expect(washAt(night, 5 * 60).alpha).toBeCloseTo(0, 5);
    // the stretch is 22:00 to 05:00, seven hours: 01:00 is three of them in, so three sevenths are gone
    expect(washAt(night, 60).alpha).toBeCloseTo(0.34, 2);
    expect(washAt(night, 23 * 60 + 59).alpha).toBeCloseTo(0.43, 2);
    expect(washAt(night, 2 * 60).alpha).toBeCloseTo(0.26, 2);
    // and no minute steps the wash by more than a rounding of a percent
    for (let m = 0; m < 1440; m += 1) {
      // whole percents, so a minute is at most a percent: no step in the circle is bigger than that
      expect(Math.abs(washAt(night, (m + 1) % 1440).alpha - washAt(night, m).alpha)).toBeLessThanOrEqual(0.0101);
    }
  });
});

describe('the wash steps its colour', () => {
  const t = tableOf([
    { at: '16:30', tint: '#eda83a', pct: 12 },
    { at: '17:30', tint: '#eda83a', pct: 28 },
    { at: '19:00', tint: '#e2533f', pct: 40 },
  ]);

  test('on a key the key colour, past it the next key colour, never a mix of the two', () => {
    expect(washAt(t, 19 * 60)).toEqual({ tint: 0xe2533f, alpha: 0.4 });
    expect(washAt(t, 17 * 60 + 30).tint).toBe(0xeda83a);
    expect(washAt(t, 18 * 60).tint).toBe(0xe2533f);
    expect(washAt(t, 18 * 60 + 15).alpha).toBe(0.34);
  });
});

describe('the lighting ladder (LIGHTING.md, C)', () => {
  test('the pool keeps the four steps and the dither it was picked with', () => {
    expect(POOL_STEPS.map((s) => [s.edge, s.tint, s.pct])).toEqual([[0.25, 0xf8de62, 24], [0.5, 0xeda83a, 18], [0.75, 0xeda83a, 12], [1, 0xb8661f, 8]]);
    expect(POOL_DITHER).toBe(0.03);
    expect(POOL_RADIUS).toEqual({ lamp: [1.5, 1.5], fire: [2, 2], window: [1, 0.625] });
    expect(HEAD_GLOW.steps).toEqual([{ r: 6, pct: 50 }, { r: 12, pct: 25 }]);
  });

  test('lamps and windows paint from 17:00 at half, full by 19:00, none by day; a fire from 16:30', () => {
    expect(poolAt(12 * 60, 'lamp')).toBe(0);
    expect(poolAt(16 * 60 + 59, 'lamp')).toBe(0);
    expect(poolAt(17 * 60, 'lamp')).toBe(0.5);
    expect(poolAt(17 * 60 + 30, 'lamp')).toBe(0.625);
    expect(poolAt(19 * 60, 'window')).toBe(1);
    expect(poolAt(2 * 60, 'lamp')).toBe(1);
    expect(poolAt(6 * 60, 'lamp')).toBe(0.75);
    expect(poolAt(7 * 60, 'lamp')).toBe(0);
    expect(poolAt(16 * 60 + 29, 'fire')).toBe(0);
    expect(poolAt(16 * 60 + 30, 'fire')).toBe(0.5);
    expect(poolAt(18 * 60 + 30, 'fire')).toBe(1);
  });

  test('a step is whole pixels, checkered only within the dither of its edge', () => {
    expect(poolStep(0, false)).toBe(0);
    expect(poolStep(0.24, false)).toBe(0);
    expect(poolStep(0.24, true)).toBe(1);
    expect(poolStep(0.6, true)).toBe(2);
    expect(poolStep(1.02, false)).toBe(3);
    expect(poolStep(1.04, false)).toBe(-1);
    const d = poolDisc(4, 4, 3);
    expect([d.w, d.h]).toEqual([9, 9]);
    expect(d.mask[4 * 9 + 4]).toBe(1);
    expect(d.mask[0]).toBe(0);
  });

  test('a step stores its colour times its strength times the gate', () => {
    expect(poolColour(POOL_STEPS[0]!, 1)).toBe((Math.round(0xf8 * 0.24) << 16) | (Math.round(0xde * 0.24) << 8) | Math.round(0x62 * 0.24));
    expect(poolColour(POOL_STEPS[0]!, 0)).toBe(0);
  });

  test('a light cuts the shade clean inside half its radius and to half in the ring (STYLE 5)', () => {
    expect(cutAt(0.2, false)).toBe(0);
    expect(cutAt(0.8, false)).toBe(0.5);
    expect(cutAt(1.2, false)).toBe(1);
    expect(cutKeep(0, 0.5)).toBe(0.5);
    expect(cutKeep(0.5, 1)).toBe(0.5);
  });

  test('the readable shade keeps the meadow green at the floor under the night ink', () => {
    const ground = lumaOf(READ.ground);
    const ink = lumaOf(0x172a52);
    const a = readableAlpha(READ.floor / 100, ground, ink);
    expect(ground * (1 - a + a * ink)).toBeCloseTo(READ.floor / 100, 6);
    expect(a).toBeLessThan(0.92);
    expect(readableAlpha(0.6, 0.5, 0.1)).toBe(0);
  });

  test('cloud shade is gone by 20:00, and a fog bank cannot stack past its cap at night', () => {
    expect(cloudAt(nightAt(12 * 60))).toBe(1);
    expect(cloudAt(nightAt(19 * 60 + 30))).toBe(0.5);
    expect(cloudAt(nightAt(20 * 60))).toBe(0);
    expect(bankAt(1, 1, 1, 0.4)).toBe(0.4);
    expect(bankAt(0.3, 1, 0, 0.4)).toBeCloseTo(0.3, 6);
    expect(bankAt(1, 1, 0, 0.4)).toBe(0.95);
  });

  test('body light: the lit side a step up its ramp, the far side a step down, ink stays ink, none at noon', () => {
    expect(litSide(0.5)).toBe('left');
    expect(litSide(-0.5)).toBe('right');
    expect(litSide(0.05)).toBeUndefined();
    expect(bodyStep(0x4c9a3f, 1)).toBe(0x84c450);
    expect(bodyStep(0x4c9a3f, -1)).toBe(0x2e6b3b);
    expect(bodyStep(0x1b1a2e, 1)).toBe(0x1b1a2e);
    // a row of ten solid pixels, lit from the left: four lighter, four darker, the middle untouched
    const src = new Uint8ClampedArray(10 * 4);
    for (let x = 0; x < 10; x++) src.set([0x4c, 0x9a, 0x3f, 255], 4 * x);
    const out = new Uint8ClampedArray(10 * 4);
    bodyLight(src, 10, 1, 'left', out);
    expect([...out.slice(0, 4)]).toEqual([0x84, 0xc4, 0x50, 255]);
    expect([...out.slice(16, 20)]).toEqual([0, 0, 0, 0]);
    expect([...out.slice(36, 40)]).toEqual([0x2e, 0x6b, 0x3b, 255]);
  });

  test('by night a body in a pool casts away from the light; outside it nothing casts', () => {
    const s = poolSun(0, -10, 24, 0.3, 1)!;
    expect(s.sy).toBeLessThan(0);
    expect(s.sx).toBe(0);
    expect(s.alpha).toBe(0.3);
    expect(poolSun(0, 30, 24, 0.3, 1)).toBeUndefined();
    expect(poolSun(0, 5, 24, 0.3, 0)).toBeUndefined();
  });
});

describe('the sun shaft', () => {
  test('in the late afternoon of a cloudy day, at 6%, and never with the sun down or the sky clear', () => {
    expect(shaftAt(17 * 60, true, true)).toBeCloseTo(0.06, 6);
    expect(shaftAt(16 * 60, true, true)).toBeCloseTo(0.03, 6);
    expect(shaftAt(12 * 60, true, true)).toBe(0);
    expect(shaftAt(17 * 60, false, true)).toBe(0);
    expect(shaftAt(17 * 60, true, false)).toBe(0);
  });
});

describe('frameAlpha: the frame is an edge by day and whole by night', () => {
  const day = frameAt(0, true);
  test('by day the grass 25% and 40% of the way out is untouched, and the ink shows only in the outer part', () => {
    expect(frameAlpha(0.125, day, 0)).toBe(0);
    expect(frameAlpha(0.2, day, 0)).toBe(0);
    expect(frameAlpha(0.3, day, 0)).toBe(0);
    expect(frameAlpha(0.5, day, 0)).toBeGreaterThan(0.4);
  });
  test('by night it is the vignette curve as it was', () => {
    const night = frameAt(1, true);
    for (const d of [0.1, 0.25, 0.4, 0.55]) {
      expect(frameAlpha(d, night, 1)).toBeCloseTo(Math.max(0, Math.sin((d / night.radius) * 3.14 * night.strength)), 10);
    }
  });
  test('it never rises toward the middle', () => {
    let last = 0;
    for (let d = 0; d <= 0.7; d += 0.01) {
      const a = frameAlpha(d, day, 0);
      expect(a).toBeGreaterThanOrEqual(last - 1e-9);
      last = a;
    }
  });
});

describe('the lantern on a painted land: light, not paint', () => {
  const R = poolRadiusArt();
  const c = R + 1;
  test('the full radius is between 2.2 and 3 figure heights (P6) and the figure stands whole in the core', () => {
    expect(R / FIGURE_ART_H).toBeGreaterThanOrEqual(2.2);
    expect(R / FIGURE_ART_H).toBeLessThanOrEqual(3);
    // her feet are 40 art px under the lamp, her head 11 above: the core's solid part holds both
    expect(PAINTED_POOL.edges[0]! * R - PAINTED_POOL.band).toBeGreaterThan(40);
  });
  test('at least 5 whole steps fall from the core to nothing; none above 30 percent of the core, the outermost at most 10 percent (P2)', () => {
    const lv = [...PAINTED_POOL.levels, 0];
    expect(PAINTED_POOL.levels[0]).toBe(1);
    expect(PAINTED_POOL.levels.length).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < lv.length - 1; i++) expect(lv[i]! - lv[i + 1]!).toBeLessThanOrEqual(0.3);
    expect(PAINTED_POOL.levels[PAINTED_POOL.levels.length - 1]).toBeLessThanOrEqual(0.1);
    // the outermost boundary's wanderings stay inside the full radius
    const room = PAINTED_POOL.jitter.reduce((a, b) => a + b, 0);
    expect(PAINTED_POOL.edges[PAINTED_POOL.edges.length - 1]! * R + room).toBeLessThanOrEqual(R);
  });
  test('the texture holds the steps and only the steps: a level, or the next level in the dither band, never a ramp (P3)', () => {
    const seen = new Set<number>();
    let inBand = 0;
    let broken = 0;
    for (let y = 0; y < 2 * c; y++) {
      for (let x = 0; x < 2 * c; x++) {
        const f = paintedPoolTexel(x, y, c);
        seen.add(f);
        const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
        if (d > R) expect(f).toBe(0);
        // the middle of one boundary's band, which wanders with the angle: both levels appear
        const edge = PAINTED_POOL.edges[3]! * R + poolJitter(3, Math.atan2(y + 0.5 - c, x + 0.5 - c));
        if (d > edge - PAINTED_POOL.band / 2 - 0.5 && d <= edge - PAINTED_POOL.band / 2 + 0.5) {
          inBand++;
          if (f === PAINTED_POOL.levels[4]) broken++;
        }
      }
    }
    expect([...seen].sort()).toEqual([0, ...PAINTED_POOL.levels].sort());
    expect(broken / inBand).toBeGreaterThan(0.2);
    expect(broken / inBand).toBeLessThan(0.8);
  });
  test('no step is a circle: along 16 rays each boundary\'s radius spreads by at least 2 art px (R1)', () => {
    for (let i = 0; i < PAINTED_POOL.edges.length; i++) {
      const r: number[] = [];
      for (let k = 0; k < 16; k++) r.push(PAINTED_POOL.edges[i]! * R + poolJitter(i, ((k + 0.5) / 16) * 2 * Math.PI));
      const m = r.reduce((a, b) => a + b, 0) / r.length;
      const sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / r.length);
      expect(sd).toBeGreaterThanOrEqual(2);
    }
  });
  test('the pattern is the texture\'s own and round: the same texel gives the same value, the four quarters mirror in what they hold', () => {
    expect(paintedPoolTexel(20, 30, c)).toBe(paintedPoolTexel(20, 30, c));
    // a texel inside the first step's solid part holds the core's level
    expect(paintedPoolTexel(c, c, c)).toBe(1);
    expect(paintedPoolTexel(0, 0, c)).toBe(0);
  });
  test('the gain per channel takes the flat ground from its light to its light plus the lamp, warm and never above one pass', () => {
    const night = [0.172, 0.195, 0.396];
    const g = poolGain(night, 1);
    for (let k = 0; k < 3; k++) {
      expect(g[k]).toBeGreaterThan(0);
      expect(g[k]).toBeLessThanOrEqual(1);
      const stack = (1 + g[k]!) ** PAINTED_POOL.passes;
      expect(stack).toBeCloseTo((night[k]! + PAINTED_POOL.lamp[k]!) / night[k]!, 6);
    }
    // the lit ground reads warm: red over blue of the light is at least 1.25 of noon's (about 1)
    const lit = night.map((b, k) => b + PAINTED_POOL.lamp[k]!);
    expect(lit[0]! / lit[2]!).toBeGreaterThanOrEqual(1.25);
    // no night, no light; a bright hour leaves a small gain
    expect(poolGain(night, 0)).toEqual([0, 0, 0]);
    expect(poolGain([1, 1, 1], 1)[0]).toBeLessThan(g[0]!);
  });
  test('the texture value of a step keeps its share of the core\'s lift on the green channel at night', () => {
    expect(poolTexelValue(1)).toBeCloseTo(1, 6);
    expect(poolTexelValue(0)).toBe(0);
    const g = poolGain(PAINTED_POOL.nominalBase, 1)[1];
    for (const f of PAINTED_POOL.levels) {
      const F = (1 + g) ** PAINTED_POOL.passes;
      const lift = (1 + g * poolTexelValue(f)) ** PAINTED_POOL.passes - 1;
      expect(lift / (F - 1)).toBeCloseTo(f, 6);
    }
  });
  test('it is drawn on the art pixel: at least 4 texels to the world pixel', () => {
    expect(PAINTED_POOL.grain).toBeGreaterThanOrEqual(4);
  });
});

describe('the water follows the world table through the ground light (13.11 round 3, order 2)', () => {
  const rows = (lightTables.worlds as unknown as Record<string, { rows: Array<GroundLight & { minute: number }> }>)['river']!.rows;
  const at = (m: number): GroundLight => rows.find((r) => r.minute === m)!;
  test('at 13:00 the factor is 1: the water keeps its old look', () => {
    const noon = at(780);
    const w = waterLook(noon, noon);
    for (let c = 0; c < 3; c++) {
      expect(w.tint[c]).toBeCloseTo(0.5 + 0.5 * (noon.amb[c]! + noon.sun[c]! * noon.elev), 9);
      expect(w.refl[c]).toBeCloseTo(noon.amb[c]! + noon.sun[c]! * noon.elev * 0.8, 9);
    }
  });
  test('at every hour the water tint over its noon look is the flat ground light over its noon light, per channel', () => {
    const noon = at(780);
    const w0 = waterLook(noon, noon);
    for (const m of [0, 390, 450, 1050, 1170, 1230]) {
      const w = waterLook(at(m), noon);
      const f = groundLightOf(at(m)).flat;
      const g = groundLightOf(noon).flat;
      for (let c = 0; c < 3; c++) expect(w.tint[c]! / w0.tint[c]!).toBeCloseTo(f[c]! / g[c]!, 9);
    }
  });
  test('the night water is dark and bluer than red (the ground beside it is)', () => {
    const n = waterLook(at(0), at(780)).tint;
    expect(n[2]!).toBeGreaterThan(n[0]!);
    expect(n[0]!).toBeLessThan(0.25);
  });
});

describe('the table of light kinds (order 3, F1 and F3)', () => {
  test('the torch is a row of the one table, redder than the lantern, and the lantern is the pool\'s own colour', () => {
    expect(PAINTED_LIGHTS.lantern.lamp).toEqual(PAINTED_POOL.lamp);
    const rb = (k: 'lantern' | 'torch' | 'lamp') => PAINTED_LIGHTS[k].lamp[0] / PAINTED_LIGHTS[k].lamp[2];
    expect(rb('torch')).toBeGreaterThan(rb('lantern'));
    // the ground's red over blue under the torch against the lantern's, at the night's flat ground light: at least 1.10 (F1)
    const base = PAINTED_POOL.nominalBase;
    const rob = (k: 'lantern' | 'torch') => {
      const g = poolGain(base, PAINTED_LIGHTS[k].strength, PAINTED_LIGHTS[k].lamp);
      return (base[0]! * (1 + g[0]) ** PAINTED_POOL.passes) / (base[2]! * (1 + g[2]) ** PAINTED_POOL.passes);
    };
    expect(rob('torch') / rob('lantern')).toBeGreaterThanOrEqual(1.1);
  });

  test('switching the kind sends the table\'s numbers to the light (F3)', () => {
    for (const k of ['lantern', 'torch', 'lamp'] as const) {
      const row = PAINTED_LIGHTS[k];
      const now = lightNow(row, 0);
      expect(now.radius).toBe(Math.round(poolRadiusArt() * row.reach));
      expect(now.strength).toBeCloseTo(row.strength, 9);
      expect(poolGain(PAINTED_POOL.nominalBase, now.strength, row.lamp)).toEqual(poolGain(PAINTED_POOL.nominalBase, row.strength, row.lamp));
    }
  });

  test('a steady kind never flickers; a flame is deterministic from the clock and stays within its levels', () => {
    for (let ms = 0; ms < 5000; ms += 37) expect(flameLevel(PAINTED_LIGHTS.lantern, ms)).toBe(0);
    const seen = new Set<number>();
    for (let ms = 0; ms < 20000; ms += 40) {
      const a = flameLevel(PAINTED_LIGHTS.torch, ms, 3);
      expect(flameLevel(PAINTED_LIGHTS.torch, ms, 3)).toBe(a);
      expect(Math.abs(a)).toBeLessThanOrEqual(FLAME_LEVELS);
      seen.add(a);
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
    // another light's flame is not in step with this one
    let same = 0;
    for (let ms = 0; ms < 20000; ms += 40) if (flameLevel(PAINTED_LIGHTS.torch, ms, 3) === flameLevel(PAINTED_LIGHTS.torch, ms, 4)) same++;
    expect(same).toBeLessThan(500 * 0.7);
  });

  test('the flame moves radius and strength together, and the core never moves more than 15% in a step (F2)', () => {
    const row = PAINTED_LIGHTS.torch;
    const lo = lightNow(row, -FLAME_LEVELS);
    const hi = lightNow(row, FLAME_LEVELS);
    expect(hi.radius).toBeGreaterThan(lo.radius);
    expect(hi.strength).toBeGreaterThan(lo.strength);
    let worst = 0;
    let prev = lightNow(row, flameLevel(row, 0, 1)).strength;
    for (let ms = row.flicker.every; ms < 60000; ms += row.flicker.every) {
      const s = lightNow(row, flameLevel(row, ms, 1)).strength;
      worst = Math.max(worst, Math.abs(s - prev) / prev);
      prev = s;
    }
    expect(worst).toBeLessThanOrEqual(0.15);
  });

  test('the flame moves on most steps and by no more than two levels at a time', () => {
    const row = PAINTED_LIGHTS.torch;
    let moved = 0;
    let worst = 0;
    const n = 600;
    for (let k = 1; k <= n; k++) {
      const d = Math.abs(flameLevel(row, k * row.flicker.every, 2) - flameLevel(row, (k - 1) * row.flicker.every, 2));
      worst = Math.max(worst, d);
      if (d > 0) moved++;
    }
    expect(worst).toBeLessThanOrEqual(2);
    expect(moved / n).toBeGreaterThan(0.5);
  });

  test('paintedPoolStep and the texel agree, outside is 0, the core is the first step', () => {
    const R = poolRadiusArt();
    const c = R + 2;
    expect(paintedPoolStep(c, c, c)).toBe(1);
    expect(paintedPoolStep(0, 0, c)).toBe(0);
    expect(paintedPoolTexel(c, c, c)).toBe(PAINTED_POOL.levels[0]);
    // a smaller radius is a smaller pool: nothing lit past it
    for (let x = 0; x < 2 * c; x++) if (Math.hypot(x + 0.5 - c, 0.5) > R * 0.9 + 1) expect(paintedPoolStep(x, c, c, Math.round(R * 0.9))).toBe(0);
  });
});

/** The wash as it was read before the ring of keys was walked without a copy: the reference the walk must equal at every minute. */
function washRing(table: readonly { at: number; tint: number; pct: number }[], minute: number): { tint: number; alpha: number } {
  const first = table[0]!;
  if (table.length === 1) return { tint: first.tint, alpha: first.pct / 100 };
  const last = table[table.length - 1]!;
  const ring = [...table, { ...first, at: first.at + 1440 }];
  const m = minute < first.at ? minute + 1440 : minute;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    if (m < a.at || m > b.at) continue;
    const span = b.at - a.at;
    const t = span === 0 ? 0 : (m - a.at) / span;
    return { tint: m === a.at ? a.tint : b.tint, alpha: Math.round(a.pct + (b.pct - a.pct) * t) / 100 };
  }
  return { tint: last.tint, alpha: last.pct / 100 };
}

describe('the wash walks the ring of keys without a copy', () => {
  const tables = [
    [{ at: 300, tint: 0x112233, pct: 40 }, { at: 420, tint: 0x445566, pct: 0 }, { at: 1080, tint: 0xeda83a, pct: 0 }, { at: 1200, tint: 0x112233, pct: 40 }],
    [{ at: 0, tint: 0x112233, pct: 10 }, { at: 720, tint: 0x445566, pct: 0 }, { at: 1439, tint: 0xeda83a, pct: 30 }],
    [{ at: 1000, tint: 0x112233, pct: 10 }, { at: 1000, tint: 0x445566, pct: 50 }, { at: 1300, tint: 0xeda83a, pct: 30 }],
    [{ at: 600, tint: 0x112233, pct: 25 }],
  ];
  test.each(tables.map((t, i) => [i, t] as const))('table %i: every minute and some between, the same as the copy', (_i, table) => {
    for (let m = -30; m < 1500; m += 0.5) expect(washAt(table, m)).toEqual(washRing(table, m));
  });
});
