/** Is a box wholly inside a frame? The rig's "in frame" for a still (phone camera, private #33): the middle of her box inside the frame let a head cut by the frame's top pass. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** True when the whole box lies inside the frame [0, width] x [0, height]: top at or below the frame's top, feet at or above its bottom, both sides inside. */
export function boxInFrame(b: Box, width: number, height: number): boolean {
  return b.x >= 0 && b.y >= 0 && b.x + b.w <= width && b.y + b.h <= height;
}

/** The smallest gap between the box and the frame's four edges, in pixels (negative when it sticks out): the number a still reports. */
export function frameGap(b: Box, width: number, height: number): number {
  return Math.min(b.x, b.y, width - (b.x + b.w), height - (b.y + b.h));
}
