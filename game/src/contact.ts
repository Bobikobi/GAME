/**
 * The figure's contact patch, the pure parts (figure presence, step A of the lane `presence`, 11.11):
 * how strong the patch is on a given ground, and how its strength moves so it never pops while the figure walks.
 * No Phaser here, so the rules are tested alone (test/contact.test.ts).
 */

/**
 * The painted lands' camera (figure presence, owner 11.11: zoom 3 stays, zoom 4 dropped): screen pixels per art pixel.
 * The one named number; the camera zoom is `ART_PX_WORLD * this` (a whole number, so every art pixel is a whole block of screen pixels).
 */
export const PAINTED_SCREEN_PX_PER_ART_PX = 3;

/** The screen height (CSS px) the owner's zoom 3 was picked on: a full screen. */
export const PAINTED_ZOOM_REF_HEIGHT = 1080;

/**
 * The phone camera (`zoom=auto`, private #33, manager's ruling of 21.11): the CSS pixels one art pixel gets so the figure keeps the share of
 * the screen's height she has at zoom 3 on a 1080 px high screen: max(1, round(3 x height / 1080)). 1080 gives 3, 390 gives 1.
 */
export function phoneArtPx(cssHeight: number): number {
  return Math.max(1, Math.round((PAINTED_SCREEN_PX_PER_ART_PX * cssHeight) / PAINTED_ZOOM_REF_HEIGHT));
}

/**
 * The camera zoom of the phone camera: whole CSS pixels per art pixel turned into whole canvas (device) pixels, so every art pixel is a whole block
 * of device pixels (no half pixels, no smoothing). `canvasPerCss` is the canvas's device pixels per CSS pixel (view.ts pixelRatio()).
 */
export function phoneCameraZoom(artPxWorld: number, cssHeight: number, canvasPerCss = 1): number {
  const ratio = canvasPerCss > 0 ? canvasPerCss : 1;
  return artPxWorld * Math.max(1, Math.round(phoneArtPx(cssHeight) * ratio));
}

/** The figure's height in art pixels on a painted land: the yardstick the lantern's pool and the contact patch's ring are sized in. */
export const FIGURE_ART_H = 51;

/** The camera zoom of a painted land: `figzoom` (a whole number of screen px per art px, for tests) when asked, else the default above. */
export function paintedCameraZoom(artPxWorld: number, figZoom = 0): number {
  const k = figZoom > 0 ? Math.round(figZoom) : PAINTED_SCREEN_PX_PER_ART_PX;
  return artPxWorld * k;
}

/** CIE lightness L* (0-100) of an sRGB colour given as 0-255 */
export function lstar(r: number, g: number, b: number): number {
  const lin = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
}

export interface ContactAim {
  /** L* the band under the feet should sit below the surrounding ring's median */
  aim: number;
  /** nothing is drawn where the band is already this far (or more) under the ring */
  skip: number;
  /** the strongest alpha the patch may have */
  max: number;
  /** the share of the measured band the patch covers (the band is wider than the patch), so the patch aims a little deeper */
  cover: number;
}

/** the alpha of a multiply patch in `tint` that takes the band's mean colour to the aimed lightness; 0 where the ground is dark enough already */
export function aimAlpha(band: readonly [number, number, number], bandL: number, ringL: number, tint: number, a: ContactAim): number {
  if (bandL <= ringL - a.skip) return 0;
  const target = bandL - (bandL - (ringL - a.aim)) / a.cover;
  const tr = (tint >> 16) & 255, tg = (tint >> 8) & 255, tb = tint & 255;
  const at = (alpha: number): number =>
    lstar(band[0] * (1 - alpha * (1 - tr / 255)), band[1] * (1 - alpha * (1 - tg / 255)), band[2] * (1 - alpha * (1 - tb / 255)));
  if (at(0) <= target) return 0;
  if (at(a.max) > target) return a.max;
  let lo = 0, hi = a.max;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) > target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** the time constant of the strength's easing, ms, and the most it may move in one 16 ms frame */
export const CONTACT_TAU_MS = 150;
export const CONTACT_SLEW_PER_16MS = 0.05;

/** moves the drawn alpha toward its target: an exponential ease, never faster than the slew limit, so a jump of the target never pops */
export function easeAlpha(current: number, target: number, deltaMs: number): number {
  const k = 1 - Math.exp(-Math.max(0, deltaMs) / CONTACT_TAU_MS);
  const slew = (CONTACT_SLEW_PER_16MS * Math.max(0, deltaMs)) / 16;
  const step = Math.max(-slew, Math.min(slew, (target - current) * k));
  return current + step;
}

/** the median of numbers (the middle one, the mean of the two middle ones when even) */
export function median(v: readonly number[]): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** the lowest opaque row of one frame (-1 when it is empty) */
export function bottomRow(f: number, w: number, h: number, alphaAt: (f: number, x: number, y: number) => number): number {
  for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x++) if (alphaAt(f, x, y) > 32) return y;
  return -1;
}

/**
 * Where the drawn feet are across a frame: for each frame the middle of the opaque columns in its lowest three opaque rows, the median over
 * the frames, in art pixels from the frame's middle (negative = left). `alphaAt(frame, x, y)` reads one pixel of one frame.
 */
export function feetOffset(frames: number, w: number, h: number, alphaAt: (f: number, x: number, y: number) => number): number {
  const mids: number[] = [];
  for (let f = 0; f < frames; f++) {
    const bottom = bottomRow(f, w, h, alphaAt);
    if (bottom < 0) continue;
    let lo = w, hi = -1;
    for (let y = bottom; y > bottom - 3 && y >= 0; y--) for (let x = 0; x < w; x++) if (alphaAt(f, x, y) > 32) { if (x < lo) lo = x; if (x > hi) hi = x; }
    if (hi >= 0) mids.push((lo + hi + 1) / 2 - w / 2);
  }
  return median(mids);
}

/** the drawn sole of a frame whose lowest opaque row is `bottom`: the sheets' feet sit 0.7 art px under their lowest row (FIGURE_SOLE 94.7 on row 94) */
export const SOLE_BELOW_BOTTOM = 0.7;
