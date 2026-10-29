import { describe, expect, it } from 'vitest';
import { FrameTimer, percentile, refreshFromStamps, roundRefresh, tierOf } from '../src/device';

describe('refresh', () => {
  it('rounds to 60, 90, 120 or 144', () => {
    expect(roundRefresh(59.4)).toBe(60);
    expect(roundRefresh(75)).toBe(60);
    expect(roundRefresh(88)).toBe(90);
    expect(roundRefresh(119.7)).toBe(120);
    expect(roundRefresh(143)).toBe(144);
    expect(roundRefresh(0)).toBe(60);
    expect(roundRefresh(NaN)).toBe(60);
  });
  it('reads the median interval of the stamps, ignoring a stall', () => {
    const stamps = Array.from({ length: 61 }, (_, i) => i * (1000 / 120) + (i > 30 ? 40 : 0));
    expect(refreshFromStamps(stamps)).toBe(120);
    expect(refreshFromStamps([0])).toBe(60);
  });
});

describe('FrameTimer', () => {
  it('gives p50 and p95 of a known sequence', () => {
    const t = new FrameTimer();
    for (let i = 1; i <= 100; i++) t.push(i);
    expect(t.p50).toBe(50);
    expect(t.p95).toBe(95);
  });
  it('keeps only the last 180 frames', () => {
    const t = new FrameTimer();
    for (let i = 0; i < 180; i++) t.push(100);
    for (let i = 0; i < 180; i++) t.push(5);
    expect(t.count).toBe(180);
    expect(t.p95).toBe(5);
  });
  it('ignores a bad frame time and handles empty', () => {
    const t = new FrameTimer();
    expect(t.p95).toBe(0);
    t.push(NaN);
    t.push(-1);
    expect(t.count).toBe(0);
    expect(percentile([], 0.5)).toBe(0);
  });
});

describe('tierOf', () => {
  it('sorts the hardware', () => {
    expect(tierOf({ cores: 8, memoryGb: 8, dpr: 3, gpu: 'Apple M2' })).toBe('high');
    expect(tierOf({ cores: 8, memoryGb: 4, dpr: 2.5, gpu: 'Adreno (TM) 640' })).toBe('mid');
    expect(tierOf({ cores: 4, memoryGb: 4, dpr: 2, gpu: '' })).toBe('mid');
    expect(tierOf({ cores: 2, memoryGb: 2, dpr: 2, gpu: '' })).toBe('low');
    expect(tierOf({ cores: 16, memoryGb: 16, dpr: 1, gpu: 'Google SwiftShader' })).toBe('low');
  });
});
