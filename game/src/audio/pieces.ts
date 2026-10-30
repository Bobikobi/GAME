/**
 * The music by state as scores (SOUND.md section 5, round 2): a routine piece of three minutes in six passages
 * that never play the same way twice, and four 30-second loops for night outside the town, hunting, combat and
 * near death, all from the valley's tune. One set of notes, two renderings: the synth plays these events live
 * (pieces-player.ts), and game/public/music holds the same events rendered on sampled instruments.
 */
import type { MusicState } from './state';
import { songs } from './songs';

/** One note: its part (the voice that plays it), start and length in beats, MIDI pitch and loudness 0 to 1. */
export interface Ev { part: string; t: number; d: number; n: number; v: number }

export interface Piece {
  name: MusicState;
  bpm: number;
  /** where an off-beat eighth falls, in beats (0.5 is straight) */
  swing: number;
  /** the loop, in beats: whole bars */
  loopBeats: number;
  events: Ev[];
  fx: { reverb: number; lofi: boolean; closeLowpass?: [number, number] };
}

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(name: string): number {
  const m = /^([A-G])(#?)(-?\d)$/.exec(name)!;
  return (Number(m[3]) + 1) * 12 + SEMI[m[1]!]! + (m[2] ? 1 : 0);
}

/** A line in the songs' notation (sixteenth steps), laid from a bar onward. */
function line(evs: Ev[], part: string, notation: string, startBar: number, v = 0.8, shift = 0): void {
  let step = 0;
  for (const tok of notation.split(/\s+/).filter((x) => x && x !== '|')) {
    const [n, len] = tok.split(':');
    const steps = len ? Number(len) : 1;
    if (n !== '-') evs.push({ part, t: startBar * 4 + step / 4, d: steps / 4, n: midi(n!) + shift, v });
    step += steps;
  }
}

const bars = (s: string) => s.split('|').map((b) => b.trim()).filter(Boolean);
const VALLEY_LEAD = bars(songs.valley.channels.lead);
const VALLEY_CHORDS = ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E', 'F', 'G', 'Em', 'Am', 'F', 'G', 'Am', 'Am'];

const CHORD: Record<string, number[]> = {
  Am: [57, 60, 64], F: [53, 57, 60], C: [48, 52, 55], G: [55, 59, 62], E: [52, 56, 59], Em: [52, 55, 59], Dm: [50, 53, 57],
};
const ROOT: Record<string, number> = { Am: 45, F: 41, C: 48, G: 43, E: 40, Em: 40, Dm: 38 };

/** The lute's broken chord in eighths, in one of three shapes, a little louder on the beat. */
function lute(evs: Ev[], part: string, chord: string, bar: number, shape: 0 | 1 | 2, v = 0.55): void {
  const [r, th, fi] = CHORD[chord]! as [number, number, number];
  const up = r + 12;
  const pats = [[r, fi, th, fi, r, fi, th, fi], [r, th, fi, up, fi, th, r, th], [fi, up, th + 12, up, fi, up, th + 12, up]];
  pats[shape]!.forEach((n, i) => evs.push({ part, t: bar * 4 + i / 2, d: 0.5, n: n!, v: v * (i % 2 === 0 ? 1 : 0.8) }));
}

function pad(evs: Ev[], chord: string, bar: number, beats = 4, v = 0.35): void {
  for (const n of CHORD[chord]!) evs.push({ part: 'pad', t: bar * 4, d: beats, n, v });
}

function lofiDrums(evs: Ev[], bar: number, kind: 'full' | 'light' | 'kick', fill = false): void {
  const b = bar * 4;
  evs.push({ part: 'kick', t: b, d: 0.5, n: 36, v: 0.9 }, { part: 'kick', t: b + 2.5, d: 0.5, n: 36, v: 0.7 });
  if (kind === 'kick') return;
  const back = kind === 'full' ? 'snare' : 'rim';
  evs.push({ part: back, t: b + 1, d: 0.25, n: 38, v: 0.8 }, { part: back, t: b + 3, d: 0.25, n: 38, v: 0.85 });
  for (let i = 0; i < 8; i++) evs.push({ part: 'hat', t: b + i / 2, d: 0.1, n: 42, v: i % 2 ? 0.45 : 0.7 });
  if (fill) for (let i = 0; i < 4; i++) evs.push({ part: 'snare', t: b + 3 + i / 4, d: 0.2, n: 38, v: 0.35 + i * 0.12 });
}

/** A grace note from above before each long lead note: the medieval turn the recorder keeps. */
function ornament(evs: Ev[], part: string): void {
  for (const e of evs.filter((x) => x.part === part && x.d >= 2)) {
    evs.push({ part, t: e.t - 0.125, d: 0.125, n: e.n + 2, v: e.v * 0.7 });
  }
}

const COUNTER = [
  'E4:16', 'F4:8 A4:8', 'G4:8 E4:8', '-:4 G4:2 A4:2 B4:4 G4:4', 'A4:8 C5:8', 'A4:8 C5:8', 'B4:8 D5:8', '-:4 E5:2 D5:2 B4:4 G#4:4',
  'A4:16', 'B4:8 D5:8', 'G4:8 B4:8', '-:4 C5:2 B4:2 A4:4 E4:4', 'C5:8 A4:8', 'B4:8 G4:8', 'E4:8 C5:8', '-:4 E5:2 D5:2 C5:4 A4:4',
];
const WALK = [
  'A2:4 C3:4 E3:4 G2:4', 'F2:4 A2:4 C3:4 B2:4', 'C3:4 E3:4 G3:4 A2:4', 'G2:4 B2:4 D3:4 G#2:4', 'A2:4 C3:4 E3:4 G2:4', 'F2:4 A2:4 C3:4 F#2:4', 'G2:4 B2:4 D3:4 F2:4', 'E2:4 G#2:4 B2:4 E2:4',
  'F2:4 A2:4 C3:4 F#2:4', 'G2:4 B2:4 D3:4 F#2:4', 'E2:4 G2:4 B2:4 G#2:4', 'A2:4 C3:4 E3:4 G2:4', 'F2:4 A2:4 C3:4 F#2:4', 'G2:4 B2:4 D3:4 G#2:4', 'A2:4 C3:4 E3:4 C3:4', 'A2:4 E2:4 A2:8',
];

/** The routine: medieval lofi cozy, 76 bpm with a lazy swing, 58 bars in six sections that never play the same way twice. */
function routine(): Piece {
  const evs: Ev[] = [];
  let bar = 0;
  // intro, 4 bars: the lute alone over a held chord, the kick comes in
  ['Am', 'F', 'C', 'G'].forEach((c, i) => {
    pad(evs, c, bar + i, 4, 0.25);
    lute(evs, 'lute', c, bar + i, 0, 0.45);
    if (i >= 2) lofiDrums(evs, bar + i, 'kick');
    if (i >= 1) evs.push({ part: 'bass', t: (bar + i) * 4, d: 3, n: ROOT[c]!, v: 0.6 });
  });
  bar += 4;
  // A1, 16 bars: the valley's tune on the recorder, the lute rocking, brushes and a lazy kick
  VALLEY_CHORDS.forEach((c, i) => {
    pad(evs, c, bar + i, 4, 0.22);
    lute(evs, 'lute', c, bar + i, 0);
    evs.push({ part: 'bass', t: (bar + i) * 4, d: 2.5, n: ROOT[c]!, v: 0.75 }, { part: 'bass', t: (bar + i) * 4 + 3, d: 1, n: ROOT[c]! + 7, v: 0.55 });
    lofiDrums(evs, bar + i, 'full', i === 7 || i === 15);
    line(evs, 'lead', VALLEY_LEAD[i]!, bar + i, 0.8);
  });
  bar += 16;
  // B, 8 bars: the relative major, a new line that answers the tune, a rim instead of the brush
  const bChords = ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'E'];
  const bLead = ['E5:4 D5:4 C5:4 G4:4', 'B4:4 D5:4 G5:8', 'A5:4 G5:4 E5:4 C5:4', 'F5:8 A5:4 G5:4', 'E5:4 C5:4 G4:4 C5:4', 'D5:6 B4:2 G4:8', 'A4:4 C5:4 F5:4 E5:4', 'E5:8 G#4:8'];
  bChords.forEach((c, i) => {
    pad(evs, c, bar + i, 4, 0.28);
    lute(evs, 'lute', c, bar + i, 1, 0.5);
    evs.push({ part: 'bass', t: (bar + i) * 4, d: 1.5, n: ROOT[c]!, v: 0.7 }, { part: 'bass', t: (bar + i) * 4 + 2, d: 1.5, n: ROOT[c]! + 12, v: 0.5 });
    lofiDrums(evs, bar + i, 'light', i === 7);
    line(evs, 'counter', bLead[i]!, bar + i, 0.75);
    // the harp answers on the off-bar with the chord's third
    evs.push({ part: 'harp', t: (bar + i) * 4 + 2, d: 2, n: CHORD[c]![1]! + 12, v: 0.4 });
  });
  bar += 8;
  // A2, 16 bars: the tune moves to the lute an octave down, the recorder takes the counter-melody, the bass walks
  VALLEY_CHORDS.forEach((c, i) => {
    pad(evs, c, bar + i, 4, 0.2);
    line(evs, 'pluck', VALLEY_LEAD[i]!, bar + i, 0.85, -12);
    line(evs, 'lead', COUNTER[i]!, bar + i, 0.6, 12);
    line(evs, 'bass', WALK[i]!, bar + i, 0.7);
    lofiDrums(evs, bar + i, 'full', i % 4 === 3);
    for (const [k, n] of CHORD[c]!.entries()) evs.push({ part: 'harp', t: (bar + i) * 4 + k * 0.5 + 2, d: 2, n: n + 12, v: 0.3 });
  });
  bar += 16;
  // C, the bridge, 8 bars: the drums rest, the tune's head slowed to half its pace over the harp
  const cChords = ['Dm', 'Am', 'Dm', 'E', 'F', 'C', 'Dm', 'E'];
  const cLead = ['A4:8 C5:8', 'E5:16', 'D5:8 F5:8', 'E5:16', 'C5:8 A4:8', 'G4:8 C5:8', 'D5:8 A4:8', 'B4:12 G#4:4'];
  cChords.forEach((c, i) => {
    pad(evs, c, bar + i, 4, 0.32);
    const [r, th, fi] = CHORD[c]!;
    [r, th, fi, r! + 12, fi, th].forEach((n, k) => evs.push({ part: 'harp', t: (bar + i) * 4 + k * (2 / 3), d: 1, n: n! + 12, v: 0.4 }));
    evs.push({ part: 'bass', t: (bar + i) * 4, d: 4, n: ROOT[c]!, v: 0.5 });
    line(evs, 'counter', cLead[i]!, bar + i, 0.7);
  });
  bar += 8;
  // A3, 6 bars: the tune's head an octave up, then its cadence, and the chord left to ring
  const outro: Array<[string, number]> = [['Am', 0], ['F', 1], ['F', 12], ['G', 13], ['Am', 14], ['Am', 15]];
  outro.forEach(([c, src], i) => {
    pad(evs, c, bar + i, i === 5 ? 6 : 4, 0.25);
    lute(evs, 'lute', c, bar + i, 2, 0.4);
    evs.push({ part: 'bass', t: (bar + i) * 4, d: i === 5 ? 6 : 3, n: ROOT[c]!, v: 0.65 });
    if (i < 5) lofiDrums(evs, bar + i, i < 4 ? 'full' : 'light');
    line(evs, 'lead', VALLEY_LEAD[src]!, bar + i, 0.75, src < 2 ? 12 : 0);
  });
  bar += 6;
  ornament(evs, 'lead');
  return { name: 'routine', bpm: 76, swing: 0.58, loopBeats: bar * 4, events: evs, fx: { reverb: 0.22, lofi: true } };
}

/** Night outside the town: the night song's line on the harp's ring, slow, with a low drone and no drum. */
function night(): Piece {
  const evs: Ev[] = [];
  const lead = bars(songs.night.channels.lead);
  const chords = ['Am', 'Dm', 'Am', 'E', 'Am', 'F', 'Dm', 'E'];
  chords.forEach((c, i) => {
    line(evs, 'counter', lead[i]!, i, 0.6);
    pad(evs, c, i, 4, 0.22);
    const [r, th, fi] = CHORD[c]!;
    [r, fi, th! + 12, fi].forEach((n, k) => evs.push({ part: 'harp', t: i * 4 + k, d: 1, n: n!, v: 0.35 }));
    evs.push({ part: 'bass', t: i * 4, d: 4, n: ROOT[c]!, v: 0.45 });
  });
  return { name: 'night', bpm: 60, swing: 0.5, loopBeats: 32, events: evs, fx: { reverb: 0.4, lofi: false } };
}

/** Hunting: the tune's head turned to E Phrygian as a horn call over a held-breath ostinato. */
function hunting(): Piece {
  const evs: Ev[] = [];
  for (let i = 0; i < 12; i++) {
    line(evs, 'bass', i % 2 ? 'E2:2 E2:2 G2:2 F2:2 E2:2 E2:2 F2:2 E2:2' : 'E2:2 E2:2 F2:2 E2:2 E2:2 E2:2 G2:2 F2:2', i, 0.6);
    line(evs, 'pizz', i % 4 === 3 ? 'E4:2 B3:2 F4:2 B3:2 G4:2 B3:2 F4:2 B3:2' : 'E4:2 B3:2 E4:2 B3:2 F4:2 B3:2 E4:2 B3:2', i, 0.45);
    evs.push({ part: 'taiko', t: i * 4, d: 1, n: 36, v: 0.6 }, { part: 'taiko', t: i * 4 + 2, d: 1, n: 36, v: 0.45 });
    if (i >= 8) for (let k = 0; k < 4; k++) evs.push({ part: 'rim', t: i * 4 + k + 0.5, d: 0.2, n: 38, v: 0.4 });
    if (i >= 4) pad(evs, i % 4 < 2 ? 'Em' : 'Dm', i, 4, 0.2);
  }
  for (const b of [1, 5, 9]) line(evs, 'horn', 'E4:4 G4:4 B4:8 | C5:4 B4:4 G4:8', b, 0.7);
  return { name: 'hunting', bpm: 100, swing: 0.5, loopBeats: 48, events: evs, fx: { reverb: 0.25, lofi: false } };
}

/** Combat: the chase song's call and bass, doubled by strings, with the big drum on every downbeat. */
function combat(): Piece {
  const evs: Ev[] = [];
  const lead = bars(songs.chase.channels.lead);
  for (let i = 0; i < 16; i++) {
    line(evs, 'strings', lead[i % 4]!, i, 0.75, i >= 8 ? 12 : 0);
    line(evs, 'bass', 'E2:2 E2:2 F2:2 E2:2 E2:2 E2:2 G2:2 F2:2', i, 0.8);
    evs.push({ part: 'taiko', t: i * 4, d: 1, n: 36, v: 1 }, { part: 'taiko', t: i * 4 + 1.5, d: 1, n: 36, v: 0.6 }, { part: 'taiko', t: i * 4 + 3, d: 1, n: 36, v: 0.8 });
    evs.push({ part: 'snare', t: i * 4 + 1, d: 0.25, n: 38, v: 0.7 }, { part: 'snare', t: i * 4 + 3, d: 0.25, n: 38, v: 0.75 });
    for (const t of [0, 1.5]) for (const n of [52, 59, 64]) evs.push({ part: 'stab', t: i * 4 + t, d: 0.4, n: n + (i % 4 === 3 ? 1 : 0), v: 0.55 });
    if (i % 4 === 3) line(evs, 'horn', '-:8 B4:2 C5:2 D5:2 E5:2', i, 0.65);
  }
  return { name: 'combat', bpm: 138, swing: 0.5, loopBeats: 64, events: evs, fx: { reverb: 0.15, lofi: false } };
}

/** Near death: the tune's head falling slowly over a heartbeat, the room closing in. */
function nearDeath(): Piece {
  const evs: Ev[] = [];
  line(evs, 'counter', 'E5:8 D5:4 C5:4 | A4:16 | C5:8 B4:4 A4:4 | F4:16 | E4:8 F4:8 | E4:16 | -:16', 0, 0.6);
  for (let beat = 0; beat < 28; beat++) {
    evs.push({ part: 'kick', t: beat, d: 0.3, n: 36, v: 0.7 }, { part: 'kick', t: beat + 0.3, d: 0.3, n: 36, v: 0.45 });
  }
  for (let i = 0; i < 7; i++) {
    for (const n of [57, 60, 64]) evs.push({ part: 'pad', t: i * 4, d: 4, n, v: 0.25 });
    evs.push({ part: 'bell', t: i * 4 + 2, d: 2, n: 70 + (i % 2), v: 0.25 });
  }
  return { name: 'near-death', bpm: 56, swing: 0.5, loopBeats: 28, events: evs, fx: { reverb: 0.35, lofi: false, closeLowpass: [3_000, 600] } };
}

/** Each state's piece, built once when first asked for. */
const BUILD: Record<MusicState, () => Piece> = { routine, night, hunting, combat, 'near-death': nearDeath };
const built = new Map<MusicState, Piece>();
export function piece(state: MusicState): Piece {
  let p = built.get(state);
  if (!p) {
    p = BUILD[state]();
    built.set(state, p);
  }
  return p;
}

/** When a beat falls, in seconds from the loop's start, the swing laid on the off-beat eighths. */
export function beatSeconds(p: Piece, beats: number): number {
  const whole = Math.floor(beats);
  const frac = beats - whole;
  return ((whole + (Math.abs(frac - 0.5) < 1e-6 ? p.swing : frac)) * 60) / p.bpm;
}

/** A loop's length in seconds. */
export function loopSeconds(p: Piece): number {
  return (p.loopBeats * 60) / p.bpm;
}
