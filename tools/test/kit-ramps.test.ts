import { describe, expect, test } from 'vitest';

import { runCheck } from '../src/check.js';
import { accentsOf, allowedColors, lightOf, rampProblems, warmthOf } from '../src/kit/ramps.js';
import { CORE_PALETTE } from '../src/kit/palette.js';

/**
 * ART_SYSTEM section 3: a ramp is five or six steps dark to light, each lighter than the one
 * below, the hue moving between them. The core's own ramps are the model, so they are what the
 * rule is measured against here.
 */
const WATER = { id: 'water', steps: ['#172a52', '#275a99', '#3f8fd1', '#7cc4ec', '#c4ecf8'] };
const GREENS = { id: 'meadow', steps: ['#1f3d2b', '#2e6b3b', '#4c9a3f', '#84c450', '#c8e88a'] };
// A neutral ramp: every step is its own light with no hue at all, which is the thing the rule
// is meant to refuse. The core's greys are not that - they drift from violet to near-neutral.
const NEUTRAL = { id: 'neutral', steps: ['#2b2b2b', '#4a4a4a', '#6b6b6b', '#909090', '#b8b8b8'] };

describe('the ramp rule', () => {
  test('the core water ramp and the core greens pass', () => {
    expect(rampProblems(WATER)).toEqual([]);
    expect(rampProblems(GREENS)).toEqual([]);
  });

  test('a ramp that only changes value is not a ramp', () => {
    const problems = rampProblems(NEUTRAL);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('only changes value');
  });

  test('the core greys are a ramp, because their hue drifts as they lighten', () => {
    expect(rampProblems({ id: 'grey', steps: ['#1b1a2e', '#3a3554', '#5d6177', '#8f94a8', '#c6cad6'] })).toEqual([]);
  });

  test('fewer than five steps or more than six is a problem', () => {
    expect(rampProblems({ id: 'short', steps: ['#172a52', '#3f8fd1', '#c4ecf8'] })[0]).toContain('3 steps');
    expect(rampProblems({ id: 'long', steps: [...WATER.steps, '#f5f4ef', '#f8de62'] })[0]).toContain('7 steps');
  });

  test('a step that is not lighter than the one under it is a problem', () => {
    const tooClose = { id: 'close', steps: ['#172a52', '#275a99', '#3f8fd1', '#3f8fd1', '#c4ecf8'] };
    const problems = rampProblems(tooClose);
    expect(problems.join(' ')).toContain('step 4');
    expect(problems.join(' ')).toContain('repeats');
  });

  test('light rises across a ramp and warmth travels with it', () => {
    const lights = WATER.steps.map(lightOf);
    expect([...lights].sort((a, b) => a - b)).toEqual(lights);
    expect(Math.abs(warmthOf(WATER.steps[4]!) - warmthOf(WATER.steps[0]!))).toBeGreaterThan(0.03);
  });
});

describe('which colours a sprite may use', () => {
  test('a sprite that names no ramp uses the core only', () => {
    const allowed = allowedColors(CORE_PALETTE, [WATER], []);
    expect(allowed.size).toBe(CORE_PALETTE.length);
    expect(allowed.has('#0a1a2e')).toBe(false);
  });

  test('a sprite that names a ramp may also use that ramp steps', () => {
    expect(allowedColors(CORE_PALETTE, [WATER], ['water']).has('#c4ecf8')).toBe(true);
    expect(allowedColors(['#1b1a2e'], [WATER], ['water']).size).toBe(6);
  });

  test('a tile is its ramp plus at most two accents', () => {
    expect(accentsOf(['#172a52', '#275a99', '#f5f4ef'], WATER).size).toBe(1);
    expect(accentsOf(['#172a52', '#f5f4ef', '#84c450', '#eda83a'], WATER).size).toBe(3);
  });
});

describe('the check on today content', () => {
  test('every kit of today passes unchanged, with no ramp declared', () => {
    const result = runCheck();
    expect(result.issues.filter((i) => i.message.includes('ramp'))).toEqual([]);
  });
});
