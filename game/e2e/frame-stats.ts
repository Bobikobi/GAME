/**
 * The arithmetic of a frame-time walk (valley-walk.ts, west-stutter.ts): pure functions over the numbers the page recorded,
 * so a unit test can pin them (game/test/frame-stats.test.ts) without a browser.
 */

/** What the page wrote down over the window: one entry per requestAnimationFrame, in order (the first is the frame the recorder started on). */
export interface FrameLog {
  /** the interval since the frame before, ms */
  t: number[];
  /** the time of the frame since the window opened, ms */
  at: number[];
  /** the tile under the feet at the frame */
  tile: [number, number][];
  /** the game's own clock at the frame (the session tick, ms; tick 0 is noon) */
  game: number[];
  /** long tasks: [start since the window opened, duration], ms */
  long: [number, number][];
}

export interface Freeze {
  ms: number;
  at_s: number;
  tile: [number, number];
  /** the game's clock as the kernel counts it: day, then HH:MM (tick 0 is noon) */
  game: string;
}

export interface FrameSummary {
  secs: number;
  n: number;
  mean: number;
  p95: number;
  over20: number;
  over50: number;
  max: number;
  longtasks: { n: number; total_ms: number; max_ms: number };
  freeze: Freeze | null;
  worst: Freeze[];
}

/** The game's clock at a tick, for a day of `dayMs` that starts at noon: "d1 12:00". */
export function gameClock(tick: number, dayMs: number): string {
  const day = Math.floor(tick / dayMs) + 1;
  const into = ((tick % dayMs) + dayMs) % dayMs;
  const minutes = Math.floor((into / dayMs) * 24 * 60 + 12 * 60) % (24 * 60);
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `d${day} ${hh}:${mm}`;
}

const round = (v: number, places: number): number => Number(v.toFixed(places));

/** The summary of one window. The first entry is dropped: it has no frame before it, so its interval is the time to the first frame, not a frame. */
export function summarize(log: FrameLog, dayMs: number, worstCount = 5): FrameSummary {
  const t = log.t.slice(1);
  const sorted = [...t].sort((a, b) => a - b);
  const worst = t
    .map((v, i) => [v, i + 1] as const)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1])
    .slice(0, worstCount)
    .map(([v, i]): Freeze => ({ ms: Math.round(v), at_s: round((log.at[i] ?? 0) / 1000, 1), tile: log.tile[i] ?? [0, 0], game: gameClock(log.game[i] ?? 0, dayMs) }));
  const long = log.long.map((l) => l[1]);
  return {
    secs: round((log.at[log.at.length - 1] ?? 0) / 1000, 1),
    n: t.length,
    mean: round(t.reduce((a, b) => a + b, 0) / Math.max(t.length, 1), 2),
    p95: round(sorted[Math.floor(sorted.length * 0.95)] ?? 0, 1),
    over20: t.filter((v) => v > 20).length,
    over50: t.filter((v) => v > 50).length,
    max: round(sorted[sorted.length - 1] ?? 0, 1),
    longtasks: { n: long.length, total_ms: Math.round(long.reduce((a, b) => a + b, 0)), max_ms: Math.max(0, ...long) },
    freeze: worst[0] ?? null,
    worst,
  };
}

/** One browser entry of the page's resource timing, reduced to what the boot counts. */
export interface Fetched {
  /** bytes over the wire (headers and body) */
  transfer: number;
  /** bytes of the body after decoding */
  decoded: number;
}

/** The total of a boot's fetches up to a moment: the count, and the bytes in both senses. */
export function bootBytes(entries: readonly Fetched[]): { requests: number; transfer: number; decoded: number } {
  return {
    requests: entries.length,
    transfer: entries.reduce((a, e) => a + e.transfer, 0),
    decoded: entries.reduce((a, e) => a + e.decoded, 0),
  };
}

/**
 * The tiles where a walk turns, from the tile it starts on and the steps the planner gave (one of up, down, left, right each):
 * the body holds toward a turning tile and lets go there, so a straight run is one hold and not one per tile.
 */
export function stopsOf(from: readonly [number, number], path: readonly ('up' | 'down' | 'left' | 'right')[]): [number, number][] {
  const step = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] } as const;
  const stops: [number, number][] = [];
  let at: [number, number] = [from[0], from[1]];
  for (let i = 0; i < path.length; i++) {
    at = [at[0] + step[path[i]!][0], at[1] + step[path[i]!][1]];
    if (i === path.length - 1 || path[i + 1] !== path[i]) stops.push(at);
  }
  return stops;
}

/**
 * The best of several runs of one walk, by the number that compares between builds: the shortest freeze (software GL inflates ordinary
 * frames, never the long stalls), then the fewest frames over 50 ms, then the fewest over 20 ms. Returns the index (the first on a tie),
 * -1 for no runs.
 */
export function bestOf(runs: readonly Pick<FrameSummary, 'over50' | 'max' | 'over20'>[]): number {
  let best = -1;
  runs.forEach((r, i) => {
    const b = runs[best];
    const better = !b || r.max < b.max || (r.max === b.max && (r.over50 < b.over50 || (r.over50 === b.over50 && r.over20 < b.over20)));
    if (better) best = i;
  });
  return best;
}
