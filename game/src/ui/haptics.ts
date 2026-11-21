/**
 * Short vibrations on phones that mirror what the hands do (G27): a tick under the
 * on-screen A and B buttons. A device or
 * browser without the API gets nothing, and one that refuses outside a gesture is ignored.
 */
/** A tap on an on-screen button, in milliseconds. */
export const TAP = 8;

export function buzz(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // a browser that only vibrates inside a user gesture: nothing to do
  }
}
