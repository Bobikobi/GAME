import { describe, expect, test } from 'vitest';

import { FrameProbe, liteUrl, median, SAMPLE_FRAMES, SLOW_FRAME_MS, WARMUP_FRAMES } from '../src/play3d/lite';

function fed(frames: number[]): FrameProbe {
  const probe = new FrameProbe();
  for (const ms of frames) probe.add(ms);
  return probe;
}

describe('the frame probe decides from the median of the frames after the warm-up', () => {
  test('a smooth machine is not slow', () => {
    const probe = fed(Array(WARMUP_FRAMES + SAMPLE_FRAMES).fill(16));
    expect(probe.done).toBe(true);
    expect(probe.slow).toBe(false);
  });

  test('a stuttering machine is slow', () => {
    const probe = fed(Array(WARMUP_FRAMES + SAMPLE_FRAMES).fill(SLOW_FRAME_MS + 30));
    expect(probe.slow).toBe(true);
  });

  test('the warm-up frames do not count, however slow', () => {
    const probe = fed([...Array(WARMUP_FRAMES).fill(400), ...Array(SAMPLE_FRAMES).fill(16)]);
    expect(probe.slow).toBe(false);
  });

  test('a few long frames in a smooth run do not sway the verdict', () => {
    const frames = Array(SAMPLE_FRAMES).fill(16);
    for (let i = 0; i < 10; i++) frames[i * 6] = 900;
    expect(fed([...Array(WARMUP_FRAMES).fill(16), ...frames]).slow).toBe(false);
  });

  test('no verdict before the sample is full', () => {
    const probe = fed(Array(WARMUP_FRAMES + SAMPLE_FRAMES - 1).fill(200));
    expect(probe.done).toBe(false);
    expect(probe.slow).toBe(false);
  });

  test('frames after the verdict change nothing', () => {
    const probe = fed(Array(WARMUP_FRAMES + SAMPLE_FRAMES).fill(16));
    for (let i = 0; i < SAMPLE_FRAMES; i++) probe.add(500);
    expect(probe.slow).toBe(false);
  });
});

describe('median', () => {
  test('odd and even counts', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('liteUrl keeps the page and its other parameters', () => {
  test('adds lite once', () => {
    const url = new URL(liteUrl('https://example.test/play3d/?debug&zoom=2'));
    expect(url.pathname).toBe('/play3d/');
    expect(url.searchParams.has('lite')).toBe(true);
    expect(url.searchParams.has('debug')).toBe(true);
    expect(url.searchParams.get('zoom')).toBe('2');
  });
});
