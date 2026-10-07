/**
 * Words the valley says on its own: whispers in the mist at night and the
 * echo of a place nobody has mended yet. Atmosphere only, never a rule.
 */

/** Heard near the ruins and the mist after dark. */
export const WHISPERS = [
  '...come back...',
  '...the fire went out...',
  '...do you remember the name...',
  '...who left the gate open...',
  '...still waiting...',
  '...the bells, the bells...',
] as const;

/** What an empty place feels like when you look at it. */
export const ECHOES = [
  'The walls are cracked, but they still stand. Someone could mend this.',
  'Dust and silence. This place is waiting for a reason to wake.',
  'You can see where a door once hung. The frame is still good.',
  'Nothing here but echoes. But echoes mean something was here before.',
] as const;

export function pickOf<T>(list: readonly T[], random: () => number = Math.random): T {
  return list[Math.floor(random() * list.length) % list.length]!;
}
