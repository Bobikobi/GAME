/** The arithmetic of the frame-time walks (game/e2e/frame-stats.ts): a measuring tool is only as good as its sums. */
import { describe, expect, it } from 'vitest';
import { bestOf, bootBytes, gameClock, stopsOf, summarize, type FrameLog } from '../e2e/frame-stats';

const DAY = 1_200_000;

/** A log from intervals alone: frame k is at the sum of the intervals up to it, on tile (k, 0), at game tick 1000 k. */
function logOf(t: number[], long: [number, number][] = []): FrameLog {
  let at = 0;
  return {
    t,
    at: t.map((v) => (at += v)),
    tile: t.map((_, k) => [k, 0] as [number, number]),
    game: t.map((_, k) => 1000 * k),
    long,
  };
}

describe('summarize', () => {
  it('drops the first interval, which is the wait for the first frame', () => {
    const s = summarize(logOf([900, 16, 16, 16]), DAY);
    expect(s.n).toBe(3);
    expect(s.max).toBe(16);
    expect(s.over50).toBe(0);
  });

  it('counts frames strictly over 20 and over 50 ms', () => {
    const s = summarize(logOf([0, 20, 20.1, 50, 50.1, 300, 16]), DAY);
    expect(s.over20).toBe(4);
    expect(s.over50).toBe(2);
    expect(s.max).toBe(300);
  });

  it('reports the mean and the 95th percentile of the intervals kept', () => {
    // twenty intervals: nineteen of 10 ms and one of 210 ms, after the dropped first
    const t = [5, ...Array.from({ length: 19 }, () => 10), 210];
    const s = summarize(logOf(t), DAY);
    expect(s.n).toBe(20);
    expect(s.mean).toBe(20);
    // sorted, index floor(20 * 0.95) = 19 is the largest
    expect(s.p95).toBe(210);
  });

  it('names the longest freeze with the time into the window, the tile and the game clock', () => {
    const s = summarize(logOf([0, 16, 16, 250, 16]), DAY);
    expect(s.freeze).toEqual({ ms: 250, at_s: 0.3, tile: [3, 0], game: 'd1 12:03' });
    expect(s.worst[0]).toEqual(s.freeze);
    expect(s.worst.map((w) => w.ms)).toEqual([250, 16, 16, 16]);
  });

  it('keeps the earlier frame when two freezes tie', () => {
    const s = summarize(logOf([0, 100, 100]), DAY);
    expect(s.freeze?.tile).toEqual([1, 0]);
  });

  it('sums the long tasks and keeps the longest', () => {
    const s = summarize(logOf([0, 16], [[10, 60], [500, 130], [900, 51]]), DAY);
    expect(s.longtasks).toEqual({ n: 3, total_ms: 241, max_ms: 130 });
  });

  it('is empty-safe: no frames, no freeze, no NaN', () => {
    const s = summarize({ t: [], at: [], tile: [], game: [], long: [] }, DAY);
    expect(s).toMatchObject({ n: 0, mean: 0, p95: 0, max: 0, over20: 0, over50: 0, freeze: null, secs: 0 });
    expect(s.longtasks).toEqual({ n: 0, total_ms: 0, max_ms: 0 });
  });
});

describe('gameClock', () => {
  it('starts the day at noon, tick 0', () => {
    expect(gameClock(0, DAY)).toBe('d1 12:00');
  });
  it('reads a quarter of the day as 18:00 and a half as midnight', () => {
    expect(gameClock(DAY / 4, DAY)).toBe('d1 18:00');
    expect(gameClock(DAY / 2, DAY)).toBe('d1 00:00');
  });
  it('turns to the next day at the next noon', () => {
    expect(gameClock(DAY, DAY)).toBe('d2 12:00');
    expect(gameClock(DAY + DAY / 48, DAY)).toBe('d2 12:30');
  });
});

describe('bootBytes', () => {
  it('adds the fetches in both senses and counts them', () => {
    expect(bootBytes([{ transfer: 100, decoded: 400 }, { transfer: 0, decoded: 50 }])).toEqual({ requests: 2, transfer: 100, decoded: 450 });
    expect(bootBytes([])).toEqual({ requests: 0, transfer: 0, decoded: 0 });
  });
});

describe('stopsOf', () => {
  it('holds once along a straight run and stops where it turns', () => {
    expect(stopsOf([0, 0], ['right', 'right', 'right', 'down', 'down', 'left'])).toEqual([[3, 0], [3, 2], [2, 2]]);
  });
  it('is one stop for one step, and none for no steps', () => {
    expect(stopsOf([5, 5], ['up'])).toEqual([[5, 4]]);
    expect(stopsOf([5, 5], [])).toEqual([]);
  });
});

describe('bestOf', () => {
  const r = (max: number, over50: number, over20: number) => ({ max, over50, over20 });
  it('prefers the shortest freeze, then the fewest over 50 ms, then the fewest over 20 ms', () => {
    // a run with fewer slow frames but a long stall is not the better run
    expect(bestOf([r(900, 2, 10), r(300, 40, 90)])).toBe(1);
    expect(bestOf([r(300, 5, 10), r(300, 3, 90)])).toBe(1);
    expect(bestOf([r(300, 3, 50), r(300, 3, 40)])).toBe(1);
  });
  it('takes the first on a tie and answers -1 for no runs', () => {
    expect(bestOf([r(1, 1, 1), r(1, 1, 1)])).toBe(0);
    expect(bestOf([])).toBe(-1);
  });
});
