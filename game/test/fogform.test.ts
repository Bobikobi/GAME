import { describe, expect, test } from 'vitest';

import { FOG_BURN, FOG_EVEN, FOG_FORM, FOG_HOLLOW, burnOf, evenBanks, fogSkyOf, lownessOf, thinOver } from '../src/fogform.js';
import { fogColour } from '../src/look.js';

describe('the form of the fog (v10)', () => {
  test('a frame holds fog and clear air: the floor is low, the thick banks reach the cap, the soft edge is between them', () => {
    expect(FOG_FORM.floor).toBeLessThan(0.1);
    expect(FOG_FORM.lo).toBeLessThan(FOG_FORM.hi);
    expect(FOG_FORM.hi).toBeLessThan(1);
    expect(FOG_FORM.cap).toBeGreaterThan(0.3);
    expect(FOG_FORM.cap).toBeLessThan(0.7);
    expect(FOG_FORM.gain).toBeGreaterThan(1);
  });
});

describe('the fog is the sky\'s light (order v11)', () => {
  const luma = (c: readonly number[]): number => 0.3 * c[0]! + 0.59 * c[1]! + 0.11 * c[2]!;
  const chroma = (c: readonly number[]): number => Math.max(...c) - Math.min(...c);
  test('the sky is lighter than the hour\'s light colour and holds less chroma of it, at a dusk hour and at a noon', () => {
    for (const l of [{ amb: [0.42, 0.5, 0.7], sun: [0.95, 0.38, 0.26], elev: 0.4 }, { amb: [0.62, 0.63, 0.66], sun: [0.46, 0.45, 0.42], elev: 0.88 }] as const) {
      const c = fogColour(l);
      const s = fogSkyOf(c);
      expect(luma(s)).toBeGreaterThan(luma(c));
      expect(chroma(s)).toBeLessThan(chroma(c));
    }
  });
  test('mixing a darker, more coloured pixel toward the sky lifts its light and takes out its chroma', () => {
    const sky = fogSkyOf(fogColour({ amb: [0.42, 0.5, 0.7], sun: [0.95, 0.38, 0.26], elev: 0.4 }));
    const ground = [0.2, 0.12, 0.1];
    for (const a of [0.2, 0.6]) {
      const out = ground.map((g, i) => g + a * Math.max(sky[i]! - g, 0));
      expect(luma(out)).toBeGreaterThan(luma(ground));
      expect(chroma(out)).toBeLessThan(chroma(ground));
    }
  });
  test('the low ground: high over water, falling off to 0 far from any water, the ridge keeps part of the fog', () => {
    const w = 60;
    const h = 20;
    const water = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < 12; x++) water[y * w + x] = 1;
    const low = lownessOf(water, w, h, FOG_HOLLOW.reach);
    expect(low[10 * w + 3]).toBeGreaterThan(200);
    expect(low[10 * w + 20]!).toBeGreaterThan(0);
    expect(low[10 * w + 20]!).toBeLessThan(low[10 * w + 12]!);
    expect(low[10 * w + 50]).toBe(0);
    expect(FOG_HOLLOW.ridge).toBeGreaterThan(0.3);
    expect(FOG_HOLLOW.ridge).toBeLessThan(1);
    expect(lownessOf(new Uint8Array(w * h), w, h, FOG_HOLLOW.reach).every((v) => v === 0)).toBe(true);
  });
});

describe('the high sun burns the thin fog off dry ground (order v11b)', () => {
  test('0 at the evening and the morning sun, 1 at midday, rising smoothly between, and the cut is a minor part of the fog cap', () => {
    expect(burnOf(0.4)).toBe(0);
    expect(burnOf(FOG_BURN.lo)).toBe(0);
    expect(burnOf(FOG_BURN.hi)).toBe(1);
    expect(burnOf(0.88)).toBe(1);
    const mid = burnOf((FOG_BURN.lo + FOG_BURN.hi) / 2);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
    expect(FOG_BURN.cut).toBeGreaterThan(0);
    expect(FOG_BURN.cut).toBeLessThan(0.4);
  });
});

describe('fog over water is an even veil (order v11c)', () => {
  test('over water a gap and a bank differ by under half of the banks\' swing (no dark smudge) but not by nothing (the fog still drifts); on dry ground they are untouched', () => {
    expect(Math.abs(evenBanks(1, 1) - evenBanks(0, 1))).toBeLessThan(0.5);
    expect(Math.abs(evenBanks(1, 1) - evenBanks(0, 1))).toBeGreaterThan(0.2);
    expect(evenBanks(0, 1)).toBeGreaterThan(0);
    expect(evenBanks(1, 1)).toBeLessThan(1);
    for (const b of [0, 0.3, 1]) expect(evenBanks(b, 0)).toBe(b);
    expect(evenBanks(1, 0.3)).toBe(1);
  });
  test('between the margin and open water the pull grows smoothly, and with k 0 (the proof switch) nothing changes', () => {
    const swing = (low: number): number => evenBanks(1, low) - evenBanks(0, low);
    expect(swing(0.6)).toBeLessThan(swing(0.5));
    expect(swing(0.8)).toBeLessThan(swing(0.6));
    for (const b of [0, 0.4, 1]) expect(evenBanks(b, 1, 0)).toBe(b);
    expect(FOG_EVEN.mean).toBeGreaterThan(0.5);
    expect(FOG_EVEN.mean).toBeLessThanOrEqual(1);
  });
});

describe('fog over water is thin so the water reads (order v11d)', () => {
  test('dry ground keeps all its density, open water keeps `thin` of it, and the margin falls smoothly between', () => {
    expect(thinOver(0)).toBe(1);
    expect(thinOver(0.5)).toBe(1);
    expect(thinOver(1)).toBeCloseTo(FOG_EVEN.thin, 10);
    expect(thinOver(0.6)).toBeLessThan(thinOver(0.5));
    expect(thinOver(0.8)).toBeLessThan(thinOver(0.6));
    expect(thinOver(1, 1)).toBe(1);
  });
  test('the water keeps at least 70% of its own contrast: a lerp toward the sky of density a keeps 1 - a of it, and a is the veil density times the thinning', () => {
    // bone at 13:00 measured a density of about .55 on the open water under the even veil (water's large-scale contrast 1.86 -> .55 L*, 30%); the thinning must bring the retained share to 70% or more
    const aNow = 0.55 * thinOver(1);
    expect(1 - aNow).toBeGreaterThanOrEqual(0.7);
  });
});
