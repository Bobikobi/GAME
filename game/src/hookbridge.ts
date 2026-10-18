/**
 * The bridge's moment (NEXT 16 d): the far bell after the first mend, and the town's smoke held at the
 * view's edge. Pure, so a test reads the very numbers the scene draws.
 */

/** The threshold's bell (audio/ambience.ts, the ruins bed) plays at this gain; the far bell is quieter and low-passed. */
export const THRESHOLD_BELL_GAIN = 0.4;
export const FAR_BELL = { gain: 0.18, lowpass: 900, detune: -200, delayMs: 1500 } as const;

/** The far bell rings for the first mend a save has ever had: a reload, or a second mend, is silent. */
export function farBellDue(restoredAfter: readonly string[], justMended: string): boolean {
  return restoredAfter.length === 1 && restoredAfter[0] === justMended;
}

export interface View {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where the town's smoke is drawn, in world px: at its chimney once that is in view, else on the view's edge toward it. */
export function smokeAt(view: View, chimney: { x: number; y: number }, inset: number): { x: number; y: number; edge: boolean } {
  const inside = chimney.x >= view.x + inset && chimney.x <= view.x + view.width - inset && chimney.y >= view.y + inset && chimney.y <= view.y + view.height - inset;
  if (inside) return { x: chimney.x, y: chimney.y, edge: false };
  const cx = view.x + view.width / 2;
  const cy = view.y + view.height / 2;
  const dx = chimney.x - cx;
  const dy = chimney.y - cy;
  const t = Math.min(dx === 0 ? Infinity : (view.width / 2 - inset) / Math.abs(dx), dy === 0 ? Infinity : (view.height / 2 - inset) / Math.abs(dy));
  return { x: cx + dx * t, y: cy + dy * t, edge: true };
}

/** The nearest of the town's chimneys to a point. */
export function nearestChimney(chimneys: readonly { x: number; y: number }[], from: { x: number; y: number }): { x: number; y: number } | undefined {
  let best: { x: number; y: number } | undefined;
  let bestD = Infinity;
  for (const c of chimneys) {
    const d = Math.hypot(c.x - from.x, c.y - from.y);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

/** How bright the marker is: full by day, dimmer as the night comes (night 0..1). */
export function smokeAlpha(night: number): number {
  return 0.85 * (1 - 0.6 * night);
}

/** The column's single puffs, from the base up: a rise in px, a sideways bend that grows toward the top, a size in px. */
export const SMOKE_PUFFS: readonly { dy: number; dx: number; size: number }[] = [
  { dy: 0, dx: 0, size: 3 },
  { dy: -6, dx: 0, size: 3 },
  { dy: -12, dx: 1, size: 4 },
  { dy: -18, dx: 3, size: 4 },
  { dy: -23, dx: 7, size: 5 },
];
