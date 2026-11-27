import { describe, expect, test } from 'vitest';
import { risesOutOfFog } from '../src/painted-wind.js';

// private #44 H: the split made one piece per tree (oak, pine at 80-110 art px) and named the old 'rock' masses cliff and terrace;
// the morning fog's mask must treat them as the old wood masses and rocks were treated, so the split changes no pixel of the fog
describe('which pieces rise out of the fog', () => {
  test('a single tree of the split rises at any height', () => {
    expect(risesOutOfFog('oak', 85)).toBe(true);
    expect(risesOutOfFog('pine', 60)).toBe(true);
  });
  test('stone stands in the fog however tall, as the old rock pieces did', () => {
    for (const k of ['rock', 'cliff', 'terrace']) expect(risesOutOfFog(k, 477)).toBe(false);
  });
  test('the old kinds keep the 120 art px rule; low growth never rises', () => {
    expect(risesOutOfFog('fir', 119)).toBe(false);
    expect(risesOutOfFog('fir', 120)).toBe(true);
    expect(risesOutOfFog('ruin', 150)).toBe(true);
    expect(risesOutOfFog('grass', 300)).toBe(false);
  });
});

describe('where the fog stands on a piece', () => {
  test('a tree of the split has its crown over the fog line and its trunk in it', async () => {
    const { fogUp } = await import('../src/painted-wind.js');
    const { fogLetThrough } = await import('../src/look.js');
    const h = 90;
    // the crown (the upper two thirds) keeps the fog out almost wholly; the foot row lets it all through
    expect(fogLetThrough(fogUp('oak', h, 20), true)).toBeLessThan(0.2);
    expect(fogLetThrough(fogUp('oak', h, h - 1), true)).toBeCloseTo(1);
    // every other kind keeps its own height's rule
    expect(fogUp('fir', 300, 0)).toBeCloseTo(1 - 0.5 / 300);
  });
});
