/** Pure sound-by-position helpers: how loud a source is from where the player stands, and a speaker's pitch. */

/** Full volume inside `near` tiles, silent beyond `far`, a smooth fall between; never rises with distance. */
export function falloff(distance: number, near: number, far: number): number {
  if (!(distance > near)) return 1;
  if (distance >= far) return 0;
  const t = (far - distance) / (far - near);
  return t * t * (3 - 2 * t);
}

/** Left (-1) to right (1) from a source's offset along x, tempered so a source never plays in one ear only. */
export function panFor(dx: number, far: number): number {
  return Math.max(-1, Math.min(1, dx / far)) * 0.7;
}

/** A speaker's voice pitch in cents, the same every time: a name picks one step of a pentatonic ladder. */
const LADDER = [-700, -500, -300, 0, 200, 400, 700, 900] as const;

export function voicePitch(speaker: string): number {
  let hash = 2166136261;
  for (let i = 0; i < speaker.length; i += 1) {
    hash ^= speaker.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return LADDER[hash % LADDER.length]!;
}
