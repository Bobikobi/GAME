/**
 * The door's own guard against a machine that cannot keep up: the world watches its first frames while the title is up
 * and, when they are slow, asks for the lighter draw (`?lite`: no shadows, no smoothing, one pixel per pixel) instead of
 * letting the player walk into a valley that stutters. A page opened with `?lite` never probes (the e2e runs so).
 */

/** frames skipped first: shaders compile and textures upload while the title is up, and those frames are slow anywhere */
export const WARMUP_FRAMES = 30;
/** frames measured after the warm-up */
export const SAMPLE_FRAMES = 60;
/** a median frame longer than this (under 20 frames a second) is a slow machine */
export const SLOW_FRAME_MS = 50;

export class FrameProbe {
  private seen = 0;
  private readonly times: number[] = [];

  /** Feeds one frame's length in ms; the verdict is ready once `done` turns true. */
  add(ms: number): void {
    if (this.done) return;
    this.seen++;
    if (this.seen > WARMUP_FRAMES) this.times.push(ms);
  }

  get done(): boolean {
    return this.times.length >= SAMPLE_FRAMES;
  }

  /** true when the median sampled frame is slow; a few long frames (a tab switch, a load) do not sway a median */
  get slow(): boolean {
    return this.done && median(this.times) > SLOW_FRAME_MS;
  }
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** The same page with `lite` in its query, every other parameter kept. */
export function liteUrl(href: string): string {
  const url = new URL(href);
  url.searchParams.set('lite', '');
  return url.toString();
}
