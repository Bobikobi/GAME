import { describe, expect, test } from 'vitest';

import { boxInFrame, frameGap } from '../e2e/inframe.js';

describe('the rig\'s "in frame": her whole box', () => {
  test('a box wholly inside passes', () => {
    expect(boxInFrame({ x: 400, y: 20, w: 60, h: 150 }, 844, 390)).toBe(true);
  });

  test('a box whose middle is inside but whose top is outside fails (the head cut by the frame\'s top)', () => {
    const b = { x: 400, y: -10, w: 60, h: 200 };
    expect(b.x + b.w / 2).toBeGreaterThan(0);
    expect(b.y + b.h / 2).toBeLessThan(390);
    expect(boxInFrame(b, 844, 390)).toBe(false);
    expect(frameGap(b, 844, 390)).toBe(-10);
  });

  test('feet below the bottom or a side outside fail; touching the frame passes', () => {
    expect(boxInFrame({ x: 400, y: 250, w: 60, h: 150 }, 844, 390)).toBe(false);
    expect(boxInFrame({ x: -1, y: 20, w: 60, h: 150 }, 844, 390)).toBe(false);
    expect(boxInFrame({ x: 800, y: 20, w: 60, h: 150 }, 844, 390)).toBe(false);
    expect(boxInFrame({ x: 0, y: 0, w: 844, h: 390 }, 844, 390)).toBe(true);
  });

  test('the gap is the smallest distance to an edge', () => {
    expect(frameGap({ x: 100, y: 30, w: 50, h: 100 }, 844, 390)).toBe(30);
  });
});
