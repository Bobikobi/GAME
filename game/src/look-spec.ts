/**
 * The HD-2D look trial (DECISIONS 2026-10-26, stills only): the cues that sit on top of the 2D world with no 3D
 * in it. A tilt-shift blurs the world toward the top and bottom of the screen; the perspective narrows the top
 * of the world against its bottom, as if the camera tilted back. Both are drawn on the world camera only: the
 * page's HUD, buttons and text are DOM and never pass through them. Off unless the page asks with `?look=`.
 */

export type Look = 'tiltshift' | 'tiltshift-persp';

export interface LookSpec {
  /** the crisp band, as fractions of the screen height from the top */
  bandTop: number;
  bandBottom: number;
  /** the height over which the blur grows from nothing to its full radius, as a fraction of the screen height */
  ramp: number;
  /** the full blur radius, as a fraction of the canvas width (18 device px on a 1170 wide phone) */
  radius: number;
  /** the width of the world's top row against its bottom row, 1 when there is no perspective */
  topWidth: number;
}

export const TILT: LookSpec = { bandTop: 0.25, bandBottom: 0.75, ramp: 0.15, radius: 18 / 1170, topWidth: 1 };
export const TILT_PERSP: LookSpec = { ...TILT, topWidth: 0.875 };

/** Reads `?look=`: `tiltshift`, `tiltshift-persp`, anything else is no look. */
export function parseLook(search: string): Look | null {
  const v = new URLSearchParams(search).get('look');
  return v === 'tiltshift' || v === 'tiltshift-persp' ? v : null;
}

export function specOf(look: Look): LookSpec {
  return look === 'tiltshift' ? TILT : TILT_PERSP;
}

/** The blur radius, as a fraction of its full radius, at a height t from the top of the screen (0 top, 1 bottom). */
export function blurAt(t: number, spec: LookSpec = TILT): number {
  const outside = t < spec.bandTop ? spec.bandTop - t : t > spec.bandBottom ? t - spec.bandBottom : 0;
  return Math.min(1, Math.max(0, outside / spec.ramp));
}

/** The width of the world's row at a height t from the top, against the bottom row. */
export function widthAt(t: number, spec: LookSpec = TILT_PERSP): number {
  return spec.topWidth + (1 - spec.topWidth) * t;
}
