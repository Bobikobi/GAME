/**
 * The four measures of a rendered clip, and what fails the check (tools/anim/anim.json limits):
 *  1. palette: every opaque pixel is in the clip's ramps or is the outline (fails under 100 %);
 *  2. outline: every frame has the one outline all round and nothing touches the frame's edge;
 *  3. silhouette: the opaque area of each frame against the view's mean (fails over the limit, locomotion only);
 *  4. foot slide at the game's pace (locomotion only): a planted foot, projected to art pixels by the renderer,
 *     against a foot fixed on the ground while the sprite moves at the game's speed (fails over 1 px).
 * The travel per pose is fitted once per view from the planted feet at every source frame (one shared slope, an
 * intercept per planted run), so a fast cycle with one drawn pose per plant still has a measured stride.
 */
import type { Pace, View } from './clip.js';
import { hexOf, type Picture } from './snap.js';

export interface FootPoint {
  px: [number, number];
  world: [number, number, number];
}
export type Feet = Record<'Left' | 'Right', FootPoint>;
export type ViewFeet = Partial<Record<View, Feet>>;

/** What the renderer writes next to the frames (<clip>_meta.json). */
export interface RenderMeta {
  frame: [number, number];
  scale_v: number;
  poses: ViewFeet[];
  dense?: ViewFeet[];
  dense_step?: number;
}

export function paletteShare(frames: readonly Picture[], allowed: ReadonlySet<string>): { opaque: number; inside: number; pct: number } {
  let opaque = 0;
  let inside = 0;
  for (const p of frames) {
    for (let i = 0; i < p.data.length; i += 4) {
      if ((p.data[i + 3] ?? 0) === 0) continue;
      opaque += 1;
      if (allowed.has(hexOf(p, i))) inside += 1;
    }
  }
  return { opaque, inside, pct: opaque === 0 ? 0 : Math.round((10000 * inside) / opaque) / 100 };
}

/** Whether every opaque pixel at the silhouette's edge is the outline colour, and whether the drawing touches the frame's edge. */
export function outlineOf(p: Picture, outline: string): { outlined: boolean; clipped: boolean } {
  const W = p.width;
  const H = p.height;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && (p.data[(y * W + x) * 4 + 3] ?? 0) > 0;
  let edges = 0;
  let bad = 0;
  let clipped = false;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (!on(x, y)) continue;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) clipped = true;
      if (on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1)) continue;
      edges += 1;
      if (hexOf(p, (y * W + x) * 4) !== outline) bad += 1;
    }
  }
  return { outlined: edges > 0 && bad === 0, clipped };
}

export function silhouette(frames: readonly Picture[]): { areas: number[]; maxDevPct: number; rangePct: number } {
  const areas = frames.map((p) => {
    let n = 0;
    for (let i = 3; i < p.data.length; i += 4) if ((p.data[i] ?? 0) > 0) n += 1;
    return n;
  });
  const mean = areas.reduce((a, b) => a + b, 0) / Math.max(areas.length, 1);
  if (mean === 0) return { areas, maxDevPct: 0, rangePct: 0 };
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    areas,
    maxDevPct: r2((100 * Math.max(...areas.map((a) => Math.abs(a - mean)))) / mean),
    rangePct: r2((100 * (Math.max(...areas) - Math.min(...areas))) / mean),
  };
}

/** The planted runs of one foot over a looping cycle: indices whose height is within `tol` of its lowest. */
export function plantedRuns(heights: readonly number[], tol: number): number[][] {
  const n = heights.length;
  const low = Math.min(...heights);
  const planted = heights.map((z) => z <= low + tol);
  const start = planted.findIndex((p) => !p);
  if (start < 0) return [];
  const runs: number[][] = [];
  let cur: number[] = [];
  for (let k = 1; k <= n; k += 1) {
    const i = (start + k) % n;
    if (planted[i]) cur.push(i);
    else if (cur.length > 0) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length > 0) runs.push(cur);
  return runs;
}

/** One shared slope through several runs, each with its own intercept (least squares). */
export function sharedSlope(runs: readonly (readonly number[])[]): number | undefined {
  let num = 0;
  let den = 0;
  for (const ys of runs) {
    if (ys.length < 2) continue;
    const kMean = (ys.length - 1) / 2;
    const yMean = ys.reduce((a, b) => a + b, 0) / ys.length;
    ys.forEach((y, k) => {
      num += (k - kMean) * (y - yMean);
      den += (k - kMean) ** 2;
    });
  }
  return den === 0 ? undefined : num / den;
}

export interface Stride {
  /** art px the ground moves under the body per drawn pose (signed along the view's axis) */
  slope: number;
  travelPerPose: number;
  cyclePx: number;
  /** a planted foot against the fitted ground, at whole pixels, when the pose follows the distance walked */
  lockedSlidePx: number;
  /** each planted run of the drawn poses: [foot, pose indices] */
  runs: [string, number[]][];
}

/** The stride of one view of a locomotion clip, from the renderer's projected feet. */
export function stride(meta: RenderMeta, view: View, poseStep: number, plantTol = 0.015): Stride {
  const W = meta.frame[0];
  const along = (f: FootPoint) => (view === 'left' ? W - f.px[0] : f.px[1]);
  const tol = plantTol * (meta.scale_v || 1);
  const feetOf = (list: readonly ViewFeet[], foot: 'Left' | 'Right') => list.map((p) => p[view]?.[foot]).filter((f): f is FootPoint => f !== undefined);
  const runsOf = (list: readonly ViewFeet[]) =>
    (['Left', 'Right'] as const).flatMap((foot) => {
      const pts = feetOf(list, foot);
      return plantedRuns(pts.map((f) => f.world[2]), tol).map((idx) => [foot, idx, idx.map((i) => along(pts[i] as FootPoint))] as const);
    });
  const poseRuns = runsOf(meta.poses);
  let slope: number | undefined;
  if (meta.dense !== undefined && meta.dense.length > 2) {
    const d = sharedSlope(runsOf(meta.dense).map(([, , ys]) => ys));
    if (d !== undefined) slope = (d * poseStep) / (meta.dense_step ?? 1);
  }
  slope ??= sharedSlope(poseRuns.map(([, , ys]) => ys)) ?? 0;
  let worst = 0;
  for (const [, , ys] of poseRuns) {
    const icpt = ys.reduce((a, y, k) => a + y - slope * k, 0) / ys.length;
    ys.forEach((y, k) => {
      worst = Math.max(worst, Math.abs(Math.round(y) - (icpt + slope * k)));
    });
  }
  const n = meta.poses.length;
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return {
    slope: r3(slope),
    travelPerPose: r3(Math.abs(slope)),
    cyclePx: Math.round(Math.abs(slope) * n * 10) / 10,
    lockedSlidePx: r3(worst),
    runs: poseRuns.map(([foot, idx]) => [foot, [...idx]]),
  };
}

export interface PaceSlide {
  speedPxS: number;
  /** poses a second the clip needs for its feet to hold at this speed, with the pose following the distance walked */
  lockedPoseRate: number;
  /** the slide the check judges: distance playback, the locked residual; time playback, the drift over a plant */
  slidePx: number;
}

/** A view's foot slide at one game speed, for the clip's playback. */
export function slideAtPace(s: Stride, ms: readonly number[], speedPxS: number, playback: 'distance' | 'time'): PaceSlide {
  const lockedPoseRate = s.travelPerPose === 0 ? 0 : Math.round((speedPxS / s.travelPerPose) * 10) / 10;
  if (playback === 'distance') return { speedPxS: Math.round(speedPxS * 10) / 10, lockedPoseRate, slidePx: s.lockedSlidePx };
  let drift = 0;
  for (const [, idx] of s.runs) {
    let acc = 0;
    for (let k = 0; k + 1 < idx.length; k += 1) acc += (speedPxS * (ms[idx[k] ?? 0] ?? 0)) / 1000 - s.travelPerPose;
    drift = Math.max(drift, Math.abs(acc));
  }
  return { speedPxS: Math.round(speedPxS * 10) / 10, lockedPoseRate, slidePx: Math.round((drift + s.lockedSlidePx) * 100) / 100 };
}

export interface ViewMeasures {
  frames: number;
  outlined: number;
  clipped: number;
  silhouette: ReturnType<typeof silhouette>;
  stride?: Stride;
  paces?: Record<Pace, PaceSlide>;
}

export interface ClipMeasures {
  palette: ReturnType<typeof paletteShare>;
  views: Partial<Record<View, ViewMeasures>>;
  problems: string[];
}

export interface MeasureInput {
  frames: Partial<Record<View, Picture[]>>;
  allowed: ReadonlySet<string>;
  outline: string;
  limits: { palette_pct: number; foot_slide_px: number; silhouette_dev_pct: number; poses_per_s_max: number };
  meta?: RenderMeta;
  locomotion?: { playback: 'distance' | 'time' };
  poseStep?: number;
  ms: readonly number[];
  paces: Record<Pace, number>;
}

/** All four measures of one clip, and the problems that fail the check. */
export function measureClip(input: MeasureInput): ClipMeasures {
  const problems: string[] = [];
  const all = Object.values(input.frames).flat();
  const palette = paletteShare(all, input.allowed);
  if (palette.pct < input.limits.palette_pct) problems.push(`palette ${palette.pct}% of opaque pixels in the ramps, under ${input.limits.palette_pct}%`);
  const views: Partial<Record<View, ViewMeasures>> = {};
  for (const [view, frames] of Object.entries(input.frames) as [View, Picture[]][]) {
    const outs = frames.map((p) => outlineOf(p, input.outline));
    const vm: ViewMeasures = {
      frames: frames.length,
      outlined: outs.filter((o) => o.outlined).length,
      clipped: outs.filter((o) => o.clipped).length,
      silhouette: silhouette(frames),
    };
    if (vm.outlined < vm.frames) problems.push(`${view}: ${vm.frames - vm.outlined} of ${vm.frames} frames without the full outline`);
    if (vm.clipped > 0) problems.push(`${view}: ${vm.clipped} frames touch the frame's edge (make the frame bigger or move the anchor)`);
    if (input.locomotion !== undefined) {
      if (vm.silhouette.maxDevPct > input.limits.silhouette_dev_pct) {
        problems.push(`${view}: silhouette deviates ${vm.silhouette.maxDevPct}% from its mean, over ${input.limits.silhouette_dev_pct}%`);
      }
      if (input.meta !== undefined) {
        const s = stride(input.meta, view, input.poseStep ?? 1);
        const paces = {} as Record<Pace, PaceSlide>;
        for (const [pace, speed] of Object.entries(input.paces) as [Pace, number][]) {
          paces[pace] = slideAtPace(s, input.ms, speed, input.locomotion.playback);
          const rate = paces[pace].lockedPoseRate;
          if (input.locomotion.playback === 'distance' && rate > input.limits.poses_per_s_max) {
            problems.push(`${view}: needs ${rate} poses a second at the ${pace} pace (${paces[pace].speedPxS} px/s) to keep its feet planted, over ${input.limits.poses_per_s_max}; the stride is too short for the speed`);
          }
          if (paces[pace].slidePx > input.limits.foot_slide_px) {
            problems.push(`${view}: feet slide ${paces[pace].slidePx} px at the ${pace} pace (${paces[pace].speedPxS} px/s, ${input.locomotion.playback} playback), over ${input.limits.foot_slide_px} px`);
          }
        }
        vm.stride = s;
        vm.paces = paces;
      }
    }
    views[view] = vm;
  }
  return { palette, views, problems };
}
