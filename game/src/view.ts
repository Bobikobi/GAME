/**
 * The canvas at the device's own pixels, and the camera's whole-number zoom (NEXT 15, DECISIONS 2026-10-18).
 * The world keeps 16 units per tile; the zoom is 4k canvas pixels per unit, so an art pixel at 64 px per tile
 * is k device pixels and one of the 16 px art is 4k. Everything the page lays over the world is in CSS pixels.
 */
import type * as Phaser from 'phaser';

/** Device pixels a short side must hold per tile row of the least view: 9 tiles of 64 art pixels. */
const MIN_SIDE = 9 * 64;

/** k: whole device pixels per art pixel at 64 px per tile, from the canvas's shorter side in device pixels. */
export function cameraK(shortSide: number): number {
  return Math.max(1, Math.floor(shortSide / MIN_SIDE));
}

/** The camera zoom: canvas pixels per world unit, always a multiple of 4. */
export function cameraZoom(shortSide: number): number {
  return 4 * cameraK(shortSide);
}

/** A world point as a CSS-pixel point on the page, for what the page lays over the world: the camera's zoom is in canvas pixels. */
export function worldToPage(view: { x: number; y: number }, zoom: number, canvasPerCss: number, x: number, y: number): { x: number; y: number } {
  const k = zoom / canvasPerCss;
  return { x: (x - view.x) * k, y: (y - view.y) * k };
}

let ratio = 1;

/** Canvas pixels per CSS pixel, as the canvas was last sized. */
export function pixelRatio(): number {
  return ratio;
}

/**
 * The canvas size for a CSS size: the browser's own device-pixel size where it gave one, else the rounded product.
 * A box more than 2 px off the product is not believed: a browser under device emulation reports the CSS size.
 */
export function deviceSize(cssW: number, cssH: number, dpr: number, box?: { w: number; h: number }): { w: number; h: number } {
  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(cssH * dpr));
  if (box && Math.abs(box.w - w) <= 2 && Math.abs(box.h - h) <= 2) return { w: Math.round(box.w), h: Math.round(box.h) };
  return { w, h };
}

/** The ratio a canvas of that many device pixels has over a CSS width. */
export function ratioOf(deviceW: number, cssW: number): number {
  return cssW > 0 ? deviceW / cssW : 1;
}

/** The size the first frame is made at, before the host has been measured. */
export function firstSize(): { w: number; h: number } {
  const dpr = window.devicePixelRatio || 1;
  return deviceSize(window.innerWidth, window.innerHeight, dpr);
}

/**
 * Keeps the canvas at the host's device pixels: on a resize, on a change of the page's zoom, and when the
 * window moves to a screen of another density. The canvas's CSS size is the host's (style.css).
 */
export function bindDeviceCanvas(game: Phaser.Game, host: HTMLElement): void {
  const apply = (box?: { w: number; h: number }) => {
    const css = host.getBoundingClientRect();
    const { w, h } = deviceSize(css.width, css.height, window.devicePixelRatio || 1, box);
    ratio = ratioOf(w, css.width);
    if (game.scale.width !== w || game.scale.height !== h) game.scale.resize(w, h);
  };
  const watcher = new ResizeObserver((entries) => {
    const size = entries[0]?.devicePixelContentBoxSize?.[0];
    apply(size ? { w: size.inlineSize, h: size.blockSize } : undefined);
  });
  try {
    watcher.observe(host, { box: 'device-pixel-content-box' });
  } catch {
    watcher.observe(host);
  }
  window.addEventListener('resize', () => apply());
  // a window dragged to another screen changes the ratio and nothing else
  const watchRatio = () => {
    matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener(
      'change',
      () => {
        apply();
        watchRatio();
      },
      { once: true },
    );
  };
  watchRatio();
  apply();
}
