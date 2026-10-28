import { cameraK } from './view';

/**
 * This fixture uses 64 world units per tile, one per art pixel. Production uses
 * 16, so its approved close zoom (4 * ceil(1.5k), DECISIONS 2026-10-25) becomes
 * ceil(1.5k) here. Both views keep each art pixel whole on the device's canvas.
 * The wider view is retained only for comparing materials across the fixture.
 */
export function worldStudyCameraZoom(width: number, height: number, close = true): number {
  const k = cameraK(Math.min(width, height));
  return close ? Math.ceil(1.5 * k) : k;
}
