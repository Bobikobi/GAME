/**
 * Short vibrations on phones that mirror what the hands do (G27): a tick under the
 * on-screen A and B buttons, a pattern per grade at every minigame beat. A device or
 * browser without the API gets nothing, and one that refuses outside a gesture is ignored.
 */
import type { Grade } from '@game/kernel';

/** A tap on an on-screen button, in milliseconds. */
export const TAP = 8;

/** One pattern per grade: a miss stutters, a jackpot rings twice. */
export const BEAT: Record<Grade, number | number[]> = { 0: [20, 40, 20], 1: 10, 2: 16, 3: 26, 4: [26, 40, 26] };

export function buzz(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // a browser that only vibrates inside a user gesture: nothing to do
  }
}
