import { describe, expect, test } from 'vitest';

import { STILL, STILL_FS, stillFs, type StillNumbers } from '../src/waterstill.js';

describe('the still water numbers (v10)', () => {
  test('the darks can only take light off, and never more than a fixed share: no black middle', () => {
    const worst = (1 - STILL.depth.drop) * STILL.streak.darkMul * STILL.patch.mul * Math.min(STILL.wet.mul, 1) * STILL.wet.thingMul;
    expect(STILL.depth.drop).toBeGreaterThan(0);
    expect(STILL.streak.darkMul).toBeLessThanOrEqual(1);
    expect(STILL.wet.mul).toBeLessThanOrEqual(1);
    expect(STILL.wet.thingMul).toBeLessThanOrEqual(1);
    // every multiplier stacked on one pixel (they never all meet) still leaves more than half of the painting's light
    expect(worst).toBeGreaterThan(0.5);
  });

  test('the lights are small additions', () => {
    expect(STILL.dash.add).toBeGreaterThan(0);
    expect(STILL.dash.add).toBeLessThan(0.3);
    expect(STILL.patch.lift).toBeLessThan(0.1);
    expect(STILL.foam.add).toBeGreaterThan(0);
    expect(STILL.foam.add).toBeLessThan(0.6);
  });

  test('the dashes are short, thin and sparse: a few cells in a hundred, two to a few pixels long inside their cell', () => {
    expect(STILL.dash.prob).toBeGreaterThan(0);
    expect(STILL.dash.prob).toBeLessThan(0.2);
    expect(STILL.dash.minLen).toBeGreaterThanOrEqual(1);
    expect(STILL.dash.maxLen).toBeLessThanOrEqual(STILL.dash.cell);
    expect(STILL.dash.maxLen).toBeGreaterThanOrEqual(STILL.dash.minLen);
  });

  test('the foam breathes between two widths and is broken by its noise cut', () => {
    expect(STILL.foam.hi).toBeGreaterThan(STILL.foam.lo);
    expect(STILL.foam.cut).toBeGreaterThan(0);
    expect(STILL.foam.cut).toBeLessThan(1);
  });

  test('the cells of the effects start where the painting\'s art grid starts: a fraction of an art pixel of 4 scene px', () => {
    for (const v of [STILL.grid.x, STILL.grid.y]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
    }
  });
});

describe('the shader source', () => {
  test('writes the identity off the water: 1 for the darks, 0 for the lights', () => {
    expect(STILL_FS).toContain('float ident = uPass < 0.5 ? 1.0 : 0.0;');
    expect(STILL_FS).toContain('if (fd.a < 0.5) { gl_FragColor = vec4(vec3(ident), 1.0); return; }');
  });

  test('takes its numbers from the object it is built from', () => {
    const other: StillNumbers = { ...STILL, foam: { ...STILL.foam, cut: 0.31 }, grid: { x: 0, y: 0 } };
    const fs = stillFs(other);
    expect(fs).toContain('nf > 0.31 -');
    expect(fs).toContain('vec2(0.000, 0.000)');
    expect(STILL_FS).toContain(`nf > ${STILL.foam.cut.toFixed(2)} -`);
    expect(fs).not.toBe(STILL_FS);
  });

  test('keeps the darks out of the dark: the floor is a little above the encoded brightness of L* 12 (0.126)', () => {
    expect(STILL.floor).toBeGreaterThan(0.126);
    expect(STILL.floor).toBeLessThan(0.3);
    expect(STILL_FS).toContain('m = max(m, min(1.0, 0.190 / max(lit, 0.001)));');
  });

  test('caps the step the darks may take in L* below the references\' deepest step (16.24)', () => {
    expect(STILL.maxStep).toBeGreaterThan(0);
    expect(STILL.maxStep).toBeLessThan(16.24);
    expect(STILL_FS).toContain('11.0 / lcube');
  });

  test('what the dashes add follows the painting\'s brightness under them', () => {
    expect(STILL_FS).toContain('float keep = clamp(0.15 + 1.4 * texture2D(uBase, uvA).r');
  });

  test('has balanced braces and one main', () => {
    const open = (STILL_FS.match(/\{/g) ?? []).length;
    const close = (STILL_FS.match(/\}/g) ?? []).length;
    expect(open).toBe(close);
    expect((STILL_FS.match(/void main/g) ?? []).length).toBe(1);
  });
});

describe('the water hue family and the midday glare (order v11b)', () => {
  test('the hue pull only moves bluer water toward the teal, by a bounded turn; the glare is bounded and the evening is outside it', () => {
    const { pull, glare } = STILL.depth;
    expect(pull.k).toBeGreaterThan(0);
    expect(pull.k).toBeLessThanOrEqual(1);
    expect(pull.max).toBeLessThanOrEqual(15);
    expect(pull.to).toBeGreaterThan(150);
    expect(pull.to).toBeLessThan(190);
    expect(glare.max).toBeLessThanOrEqual(3);
    expect(glare.k).toBeGreaterThan(0);
    expect(STILL_FS).toContain('uNoon');
  });
});
