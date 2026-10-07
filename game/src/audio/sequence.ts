/** Pure helpers for turning the compact music notation into timed events. */

export interface SequenceEvent {
  value: string | null;
  start: number;
  steps: number;
}

export interface ParsedChannel {
  events: SequenceEvent[];
  totalSteps: number;
}

/** The duration of one sixteenth-note step. */
export function stepMs(bpm: number): number {
  return 60_000 / bpm / 4;
}

/** Convert a scientific-pitch name such as C#4 to hertz. */
export function noteFreq(note: string): number {
  const match = /^([A-G])(#?)(-?\d+)$/.exec(note);
  if (!match) throw new Error(`Invalid note: ${note}`);
  const semitones: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const pitch = semitones[match[1]!];
  const octave = Number(match[3]);
  const midi = (octave + 1) * 12 + pitch! + (match[2] === '#' ? 1 : 0);
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Parse one channel and verify that it fills the tune exactly. */
export function parseChannel(
  song: string,
  channel: string,
  notation: string,
  expectedSteps: number,
): ParsedChannel {
  const events: SequenceEvent[] = [];
  let totalSteps = 0;
  for (const token of notation.split(/\s+/).filter((part) => part && part !== '|')) {
    const match = /^([^:]+)(?::(\d+))?$/.exec(token);
    if (!match) throw new Error(`${song} ${channel}: invalid token ${token}`);
    const steps = match[2] === undefined ? 1 : Number(match[2]);
    if (!Number.isInteger(steps) || steps < 1) {
      throw new Error(`${song} ${channel}: invalid token ${token}`);
    }
    const raw = match[1]!;
    if (raw !== '-' && raw !== 'x' && raw !== 'o') noteFreq(raw);
    events.push({ value: raw === '-' ? null : raw, start: totalSteps, steps });
    totalSteps += steps;
  }
  if (totalSteps !== expectedSteps) {
    throw new Error(`${song} ${channel}: expected ${expectedSteps} steps, found ${totalSteps}`);
  }
  return { events, totalSteps };
}
