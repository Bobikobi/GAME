/** Song and jingle scores; bar lines are retained only to keep the music readable. */

export type Duty = 0.125 | 0.25 | 0.5;

export interface VoiceSettings {
  kind: 'pulse' | 'wave' | 'noise';
  gain: number;
  duty?: Duty;
  attack?: number;
}

export interface Song {
  bpm: number;
  bars: number;
  loop: true;
  channels: { lead: string; harmony: string; bass: string; drums: string };
  voices: { lead: VoiceSettings; harmony: VoiceSettings; bass: VoiceSettings; drums: VoiceSettings };
}

export interface Jingle {
  bpm: number;
  steps: number;
  channels: { lead: string; harmony: string; bass: string };
  voices: { lead: VoiceSettings; harmony: VoiceSettings; bass: VoiceSettings };
}

const arp = {
  Am: 'A3:2 C4:2 E4:2 C4:2 A3:2 C4:2 E4:2 C4:2',
  F: 'F3:2 A3:2 C4:2 A3:2 F3:2 A3:2 C4:2 A3:2',
  C: 'C4:2 E4:2 G4:2 E4:2 C4:2 E4:2 G4:2 E4:2',
  G: 'G3:2 B3:2 D4:2 B3:2 G3:2 B3:2 D4:2 B3:2',
  E: 'E3:2 G#3:2 B3:2 G#3:2 E3:2 G#3:2 B3:2 G#3:2',
  Em: 'E3:2 G3:2 B3:2 G3:2 E3:2 G3:2 B3:2 G3:2',
} as const;

const bass = {
  Am: 'A2:6 -:2 E3:6 -:2',
  F: 'F2:6 -:2 C3:6 -:2',
  C: 'C3:6 -:2 G3:6 -:2',
  G: 'G2:6 -:2 D3:6 -:2',
  E: 'E2:6 -:2 B2:6 -:2',
  Em: 'E2:6 -:2 B2:6 -:2',
} as const;

const valleyChords = ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E', 'F', 'G', 'Em', 'Am', 'F', 'G', 'Am', 'Am'] as const;

export const songs = {
  valley: {
    bpm: 88,
    bars: 16,
    loop: true,
    channels: {
      lead: `
        A4:4 C5:4 E5:8 | F5:4 E5:4 C5:8 | G4:4 C5:4 E5:4 D5:4 | D5:12 -:4 |
        A4:4 C5:4 E5:4 A5:4 | G5:4 F5:2 E5:2 F5:8 | E5:4 D5:4 B4:4 G4:4 | G#4:8 B4:4 -:4 |
        C5:4 F5:4 A5:6 G5:2 | G5:4 F5:4 D5:8 | E5:4 G5:4 B5:6 A5:2 | A5:12 -:4 |
        A5:4 G5:4 F5:4 E5:4 | D5:4 E5:4 F5:4 D5:4 | C5:4 B4:4 A4:4 E4:4 | A4:12 -:4
      `,
      harmony: valleyChords.map((chord) => arp[chord]).join(' | '),
      bass: valleyChords.map((chord) => bass[chord]).join(' | '),
      drums: '-:128 | o:4 x:4 -:4 x:4 | -:4 x:4 -:4 x:4 | -:4 x:4 -:4 x:4 | -:4 x:4 -:4 x:4 | o:4 x:4 -:4 x:4 | -:4 x:4 -:4 x:4 | -:4 x:4 -:4 x:4 | -:4 x:4 -:4 x:4',
    },
    voices: {
      lead: { kind: 'pulse', duty: 0.25, gain: 0.22 },
      harmony: { kind: 'pulse', duty: 0.125, gain: 0.09 },
      bass: { kind: 'wave', gain: 0.28 },
      drums: { kind: 'noise', gain: 0.05 },
    },
  },
  night: {
    bpm: 66,
    bars: 8,
    loop: true,
    channels: {
      lead: `
        E5:8 D5:4 C5:4 | D5:12 -:4 | C5:4 B4:4 A4:8 | G#4:12 -:4 |
        A4:4 C5:4 E5:8 | F5:8 E5:4 C5:4 | D5:8 A4:8 | B4:12 -:4
      `,
      harmony: 'E5:12 -:4 | A5:12 -:4 | E5:12 -:4 | B5:12 -:4 | E5:12 -:4 | C6:12 -:4 | A5:12 -:4 | B5:12 -:4',
      bass: 'A2:16 | D2:16 | A2:16 | E2:16 | A2:16 | F2:16 | D2:16 | E2:16',
      drums: '-:128',
    },
    voices: {
      lead: { kind: 'pulse', duty: 0.5, gain: 0.14, attack: 0.04 },
      harmony: { kind: 'pulse', duty: 0.125, gain: 0.06 },
      bass: { kind: 'wave', gain: 0.22 },
      drums: { kind: 'noise', gain: 0 },
    },
  },
  // a hunt: a short loop in E with the flat second, the bass driving under a call that keeps coming back
  chase: {
    bpm: 132,
    bars: 4,
    loop: true,
    channels: {
      lead: 'B4:2 -:2 C5:2 -:2 B4:2 -:2 E5:4 | D5:2 C5:2 B4:2 A4:2 B4:8 | B4:2 -:2 C5:2 -:2 B4:2 -:2 F5:4 | E5:2 D5:2 C5:2 D5:2 B4:6 -:2',
      harmony: '-:2 E4:2 -:2 E4:2 -:2 F4:2 -:2 E4:2 | -:2 E4:2 -:2 E4:2 -:2 F4:2 -:2 E4:2 | -:2 E4:2 -:2 E4:2 -:2 G4:2 -:2 F4:2 | -:2 E4:2 -:2 E4:2 -:2 G4:2 -:2 F4:2',
      bass: new Array<string>(4).fill('E2:2 E2:2 F2:2 E2:2 E2:2 E2:2 G2:2 F2:2').join(' | '),
      drums: new Array<string>(4).fill('o:2 x:2 x:2 x:2 o:2 x:2 o:2 x:2').join(' | '),
    },
    voices: {
      lead: { kind: 'pulse', duty: 0.25, gain: 0.16 },
      harmony: { kind: 'pulse', duty: 0.125, gain: 0.06 },
      bass: { kind: 'wave', gain: 0.26 },
      drums: { kind: 'noise', gain: 0.06 },
    },
  },
} satisfies Record<'valley' | 'night' | 'chase', Song>;

// 0.55 of their first level (docs/design/SOUND.md section 1.3): a jingle peaks near -10 dBFS, not -4
const jingleVoices = {
  lead: { kind: 'pulse', duty: 0.25, gain: 0.13 },
  harmony: { kind: 'pulse', duty: 0.125, gain: 0.055 },
  bass: { kind: 'wave', gain: 0.11 },
} as const;

export const jingles = {
  level: {
    bpm: 150,
    steps: 24,
    channels: {
      lead: 'C5:2 E5:2 G5:2 C6:4 -:2 G5:2 C6:8 -:2',
      harmony: 'E4:2 G4:2 C5:2 E5:4 -:2 E5:2 G5:8 -:2',
      bass: 'C3:8 G2:8 C3:6 -:2',
    },
    voices: jingleVoices,
  },
  quest: {
    bpm: 130,
    steps: 20,
    channels: {
      lead: 'G4:2 C5:2 E5:2 G5:4 E5:2 G5:8',
      harmony: 'E4:2 G4:2 C5:2 E5:4 C5:2 E5:8',
      bass: 'C3:6 G2:4 C3:2 C3:8',
    },
    voices: jingleVoices,
  },
  found: {
    bpm: 160,
    steps: 8,
    channels: {
      lead: 'E5 G5 B5 E6:5',
      harmony: '-:8',
      bass: 'E3:8',
    },
    voices: jingleVoices,
  },
} satisfies Record<'level' | 'quest' | 'found', Jingle>;
