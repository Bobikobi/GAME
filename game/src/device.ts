/**
 * What the game can learn about the device it runs on, for the settings system (settings.ts). A web page
 * cannot read the screen's refresh rate or the phone's speed, so the numbers are measured: the interval of
 * requestAnimationFrame over a few frames gives the refresh, and the loop's own frame time (Phaser's
 * game.loop.delta) gives how hard the drawing is for this device. The maths is pure and takes its inputs as
 * arguments so it can be tested without a browser; only measureRefresh and readDevice touch the page.
 */

/** The refresh rates a screen is rounded to. */
export const REFRESH_STEPS = [60, 90, 120, 144] as const;
/** How many recent frames the FrameTimer keeps. */
export const TIMER_FRAMES = 180;

export type Tier = 'low' | 'mid' | 'high';

export interface Device {
  tier: Tier;
  /** automated or software-drawn (webdriver, SwiftShader): not a phone, so Auto changes nothing there */
  headless: boolean;
  /** the screen's measured refresh in Hz, or 0 while it is not measured yet */
  refreshHz: number;
  /** frame time in ms of the world, 0 while not measured */
  p50: number;
  p95: number;
}

/** The nearest step to a measured rate; anything under 75 Hz counts as 60. */
export function roundRefresh(hz: number): number {
  if (!Number.isFinite(hz) || hz <= 0) return 60;
  let best: number = REFRESH_STEPS[0];
  for (const s of REFRESH_STEPS) if (Math.abs(s - hz) < Math.abs(best - hz)) best = s;
  return best;
}

/** The refresh in Hz from a list of rAF timestamps in ms, rounded to a step. The median interval ignores a stalled frame. */
export function refreshFromStamps(stamps: readonly number[]): number {
  const gaps: number[] = [];
  for (let i = 1; i < stamps.length; i++) gaps.push(stamps[i]! - stamps[i - 1]!);
  const mid = percentile(gaps, 0.5);
  return mid > 0 ? roundRefresh(1000 / mid) : 60;
}

/** Measures the refresh over `frames` animation frames. Resolves 60 where rAF is missing. */
export function measureRefresh(frames = 60): Promise<number> {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve(60);
  return new Promise((resolve) => {
    const stamps: number[] = [];
    const tick = (t: number) => {
      stamps.push(t);
      if (stamps.length > frames) resolve(refreshFromStamps(stamps));
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** The value at fraction q (0 to 1) of the sorted list, nearest rank. Zero for an empty list. */
export function percentile(values: readonly number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(q * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))]!;
}

/** The last TIMER_FRAMES frame times, with their p50 and p95. */
export class FrameTimer {
  private readonly ring: number[] = [];
  private at = 0;

  constructor(private readonly size = TIMER_FRAMES) {}

  /** Records one frame time in ms (game.loop.delta). */
  push(ms: number): void {
    if (!Number.isFinite(ms) || ms <= 0) return;
    if (this.ring.length < this.size) this.ring.push(ms);
    else this.ring[this.at] = ms;
    this.at = (this.at + 1) % this.size;
  }

  get count(): number {
    return this.ring.length;
  }

  get p50(): number {
    return percentile(this.ring, 0.5);
  }

  get p95(): number {
    return percentile(this.ring, 0.95);
  }
}

/** What the hardware tells, as plain numbers so the tier can be tested. */
export interface Hardware {
  cores: number;
  /** device memory in GB, 0 when the browser does not say */
  memoryGb: number;
  dpr: number;
  /** the WebGL renderer string, '' when hidden */
  gpu: string;
}

/** A GPU name that is a software renderer or an old mobile part. */
const WEAK_GPU = /swiftshader|llvmpipe|software|mali-4|mali-t|adreno \(?[2-4]\d\d\b|powervr|videocore/i;
/** A GPU name that is a software renderer: a test browser or a machine without a graphics chip. */
export const SOFTWARE_GPU = /swiftshader|llvmpipe|software/i;
/** A GPU name that is a recent desktop or phone part. */
const STRONG_GPU = /apple (m|a1[5-9])|rtx|radeon rx|adreno \(?[7-9]\d\d\b|mali-g7|mali-g[89]/i;
/** Fewer cores than this is a low tier, at least HIGH_CORES with the memory below is a high tier. */
const LOW_CORES = 4;
const HIGH_CORES = 8;
/** Memory in GB: at most LOW_MEMORY is low, at least HIGH_MEMORY counts toward high. */
const LOW_MEMORY = 2;
const HIGH_MEMORY = 6;
/** A screen denser than this costs a phone more pixels to fill. */
const DENSE_DPR = 3;

/** The tier of a device from its hardware: weak signals pull down, strong ones up, the rest is mid. */
export function tierOf(hw: Hardware): Tier {
  if (WEAK_GPU.test(hw.gpu)) return 'low';
  if (hw.memoryGb > 0 && hw.memoryGb <= LOW_MEMORY) return 'low';
  if (hw.cores > 0 && hw.cores < LOW_CORES) return 'low';
  const strongMemory = hw.memoryGb === 0 || hw.memoryGb >= HIGH_MEMORY;
  if (hw.cores >= HIGH_CORES && strongMemory && hw.dpr <= DENSE_DPR + 1 && (STRONG_GPU.test(hw.gpu) || hw.gpu === '')) return 'high';
  if (STRONG_GPU.test(hw.gpu) && hw.cores >= LOW_CORES + 2) return 'high';
  return 'mid';
}

/** The WebGL renderer string where the browser shows it, else ''. */
export function gpuName(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return info && gl ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  } catch {
    return '';
  }
}

/** The device as far as it is known at launch: the tier now, the frame numbers measured later. */
export function readDevice(): Device {
  const nav = (typeof navigator === 'undefined' ? {} : navigator) as Navigator & { deviceMemory?: number };
  const hw: Hardware = {
    cores: nav.hardwareConcurrency ?? 0,
    memoryGb: nav.deviceMemory ?? 0,
    dpr: typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
    gpu: typeof document === 'undefined' ? '' : gpuName(),
  };
  const headless = nav.webdriver === true || SOFTWARE_GPU.test(hw.gpu);
  return { tier: tierOf(hw), headless, refreshHz: 0, p50: 0, p95: 0 };
}
