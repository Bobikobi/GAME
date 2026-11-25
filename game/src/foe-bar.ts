/**
 * The small health bar under a fighting creature, with its number (issue #866, the screen step of #549).
 * Pure numbers for the bar and its flight; the DOM is foe-bar-layer.ts. The bar reads the fight's own
 * state, never a new kernel field: a creature's `health` and the kind's `fight.hp` arrive on the `hit`
 * event's `foe: { left, whole }` (DECISIONS 2026-11-14, #715). The number is the current health.
 */
import type { GameEvent } from '@game/kernel';

/** A creature's bar: its health now, the whole it fights with, and when it was last seen fighting. */
export interface FoeBar {
  /** current health, the `hit` event's `foe.left` (the fight's `health`) */
  health: number;
  /** the kind's `fight.hp`, the `hit` event's `foe.whole`; 0 while the foe has engaged but is not hit yet */
  whole: number;
  /** when it was last known to be fighting, ms: a hit, an engage, or the player's current foe (refreshed while it fights) */
  last: number;
  /** set on `foe_fall` (or a killing hit): the bar is gone at once */
  dead: boolean;
}

/** CSS pixels the track spans. */
export const FOE_BAR_WIDTH = 24;
/** CSS pixels the track is tall. */
export const FOE_BAR_HEIGHT = 5;
/** Gap in CSS pixels between the creature's feet line and the top of the bar. */
export const FOE_BAR_GAP = 4;
/** Milliseconds the bar fades out over after the fight ends, then it is gone. */
export const FOE_BAR_FADE_MS = 2000;

/** The filled share of the bar: `health / hp` of the kind, clamped; whole until the first hit reports the numbers. */
export function foeBarFill(bar: FoeBar): number {
  if (bar.whole <= 0) return 1;
  return Math.min(1, Math.max(0, bar.health / bar.whole));
}

/** The number on the bar: the creature's current health; none before the first hit. */
export function foeBarNumber(bar: FoeBar): string {
  return bar.whole <= 0 ? '' : String(Math.max(0, Math.floor(bar.health)));
}

/**
 * The bar's opacity at `now`: whole while it fights, fading to nothing over `FOE_BAR_FADE_MS` once the
 * fight ends, gone at once when it dies. Under reduced motion the fade is held whole until the bar is
 * removed, as the fight words hold their flight.
 */
export function foeBarAlpha(bar: FoeBar, now: number, reducedMotion = false): number {
  if (bar.dead) return 0;
  const age = Math.max(0, now - bar.last);
  if (reducedMotion) return age >= FOE_BAR_FADE_MS ? 0 : 1;
  if (age >= FOE_BAR_FADE_MS) return 0;
  return 1 - age / FOE_BAR_FADE_MS;
}

/**
 * The anchor y (the bar's bottom edge, in CSS pixels) for a creature whose feet line sits at `feetY`:
 * `FOE_BAR_GAP` under the feet, plus the bar's own height. The DOM layer anchors the track by its
 * bottom-centre (the world-labels' `translate: -50% -100%`), so the bar sits under the feet and never
 * over the fight words, which rise from the head above.
 */
export function foeBarAnchorY(feetY: number): number {
  return feetY + FOE_BAR_GAP + FOE_BAR_HEIGHT;
}

/** Fold the fight's events into the bars: an engage shows a whole bar, a hit reports the numbers, a fall ends it. */
export function foeBarPlay(bars: Map<string, FoeBar>, events: readonly GameEvent[], now: number): void {
  for (const event of events) {
    if (event.e === 'engage') {
      const bar = bars.get(event.foe);
      if (bar) bar.last = now;
      else bars.set(event.foe, { health: 0, whole: 0, last: now, dead: false });
    } else if (event.e === 'hit' && event.struck.side === 'foe' && event.foe) {
      bars.set(event.struck.id, { health: event.foe.left, whole: event.foe.whole, last: now, dead: event.foe.left === 0 });
    } else if (event.e === 'foe_fall') {
      const bar = bars.get(event.foe);
      if (bar) {
        bar.dead = true;
        bar.last = now;
      }
    }
  }
}

/** Keep the player's current foe fresh while the fight runs, so the bar stays and does not fade mid-fight. */
export function foeBarRefresh(bars: Map<string, FoeBar>, now: number, currentFoe: string | undefined): void {
  if (currentFoe === undefined) return;
  const bar = bars.get(currentFoe);
  if (bar && !bar.dead) bar.last = now;
}
