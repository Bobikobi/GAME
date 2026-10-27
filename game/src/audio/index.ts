/** Lazy, self-contained sound system for Loomvale's music, ambience, and cues. */
import { AmbiencePlayer } from './ambience';
import { BED_IDS, BedPlayer } from './beds';
import { Crackle } from './crackle';
import type { BedId } from './beds';
import type { AmbienceKind } from './ambience';
import { MusicPlayer, renderSong } from './player';
import { jingles, songs } from './songs';
import { playSfx } from './sfx';
import type { SfxId, SfxOptions } from './sfx';
import { readMuted, writeMuted } from './storage';
import type { SoundStorage } from './storage';

export type SongId = 'valley' | 'night' | 'chase';
export type JingleId = 'level' | 'quest' | 'found';
export type { SfxId } from './sfx';
export type { BedId } from './beds';

export interface SoundState {
  unlocked: boolean;
  muted: boolean;
  song: SongId | null;
  ambience: AmbienceKind | null;
  sfxCount: number;
  lastSfx: string | null;
  /** how many of each effect were asked for, and how many of those actually sounded (not muted, not locked) */
  asked: Record<string, number>;
  counts: Record<string, number>;
  /** each position bed's level, 0 to 1, as the player's place asks for it */
  beds: Record<BedId, number>;
  /** the crackle of the burning fire the player stands near, 0 to 1 */
  crackle: number;
}

interface AudioGraph {
  master: GainNode;
  music: GainNode;
  effects: GainNode;
  ambience: GainNode;
  player: MusicPlayer;
  ambiencePlayer: AmbiencePlayer;
  beds: BedPlayer;
  crackle: Crackle;
  analyser: AnalyserNode;
}

export interface SoundApi {
  unlock(): void;
  installUnlock(target?: EventTarget): void;
  music(id: SongId | null, fadeMs?: number): void;
  jingle(id: JingleId): void;
  sfx(id: SfxId, opts?: SfxOptions): void;
  ambience(kind: AmbienceKind | null): void;
  /** Sets a position bed (campfire, stream, ruins) to a level 0..1 and a stereo pan -1..1. */
  bed(id: BedId, level: number, pan?: number): void;
  /** Sets a burning fire's crackle to a level 0..1 and a pan -1..1; at 0 it stops and holds no node. */
  crackle(level: number, pan?: number): void;
  /** The loudness (RMS, 0..1) of what is leaving the speakers right now; 0 when muted or locked. */
  level(): number;
  readonly muted: boolean;
  setMuted(muted: boolean): void;
  state(): SoundState;
  measure(id: SongId, seconds: number): Promise<{ rms: number; peak: number }>;
}

let context: ReturnType<typeof createContext> | null = null;
let graph: AudioGraph | null = null;
let preferenceLoaded = false;
let isMuted = false;
let wasUnlocked = false;
let visibilityInstalled = false;
let requestedSong: SongId | null = null;
let requestedFade = 1_000;
let appliedSong: SongId | null = null;
let requestedAmbience: AmbienceKind | null = null;
let appliedAmbience: AmbienceKind | null = null;
let playedCount = 0;
const asked: Record<string, number> = {};
const played: Record<string, number> = {};
const bedRequests: Record<BedId, { level: number; pan: number }> = {
  fire: { level: 0, pan: 0 },
  stream: { level: 0, pan: 0 },
  dread: { level: 0, pan: 0 },
};
let crackleRequest = { level: 0, pan: 0 };
let lastPlayed: string | null = null;
const unlockTargets = new WeakSet<EventTarget>();

function createContext() {
  const browser = globalThis as unknown as {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  const Context = browser.AudioContext ?? browser.webkitAudioContext;
  if (!Context) throw new Error('Web Audio is not supported in this browser');
  return new Context();
}

function storage(): SoundStorage | undefined {
  try {
    return (globalThis as unknown as { localStorage?: SoundStorage }).localStorage;
  } catch {
    return undefined;
  }
}

function loadPreference(): void {
  if (preferenceLoaded) return;
  isMuted = readMuted(storage());
  preferenceLoaded = true;
}

function ensureGraph(): AudioGraph {
  if (graph) return graph;
  const audio = context ?? createContext();
  context = audio;
  const master = audio.createGain();
  const compressor = audio.createDynamicsCompressor();
  const music = audio.createGain();
  const effects = audio.createGain();
  const ambience = audio.createGain();
  master.gain.value = isMuted ? 0 : 0.8;
  music.gain.value = 0.45;
  effects.gain.value = 0.8;
  ambience.gain.value = 0.5;
  compressor.threshold.value = -10;
  compressor.ratio.value = 4;
  music.connect(master);
  effects.connect(master);
  ambience.connect(master);
  const analyser = audio.createAnalyser();
  analyser.fftSize = 2048;
  master.connect(compressor).connect(audio.destination);
  compressor.connect(analyser);
  graph = {
    master,
    music,
    effects,
    ambience,
    player: new MusicPlayer(audio, music, effects),
    ambiencePlayer: new AmbiencePlayer(audio, ambience),
    beds: new BedPlayer(audio, ambience),
    crackle: new Crackle(audio, ambience),
    analyser,
  };
  installVisibility();
  return graph;
}

function installVisibility(): void {
  if (visibilityInstalled) return;
  const page = typeof document === 'undefined' ? undefined : document;
  if (!page) return;
  visibilityInstalled = true;
  page.addEventListener('visibilitychange', () => {
    if (!context) return;
    if (page.hidden) void context.suspend();
    else if (wasUnlocked) void context.resume().then(syncRequests).catch(() => undefined);
  });
}

function syncRequests(): void {
  if (!context || context.state !== 'running') return;
  const audio = ensureGraph();
  if (appliedSong !== requestedSong) {
    audio.player.play(requestedSong ? songs[requestedSong] : null, requestedFade);
    appliedSong = requestedSong;
  }
  if (appliedAmbience !== requestedAmbience) {
    audio.ambiencePlayer.play(requestedAmbience);
    appliedAmbience = requestedAmbience;
  }
  for (const id of BED_IDS) audio.beds.set(id, bedRequests[id].level, bedRequests[id].pan);
  audio.crackle.set(crackleRequest.level, crackleRequest.pan);
}

function unlock(): void {
  loadPreference();
  ensureGraph();
  wasUnlocked = true;
  const page = typeof document === 'undefined' ? undefined : document;
  if (page?.hidden) {
    if (context?.state === 'running') void context.suspend();
    return;
  }
  if (context?.state === 'running') {
    syncRequests();
    return;
  }
  void context?.resume().then(syncRequests).catch(() => undefined);
}

function installUnlock(target?: EventTarget): void {
  const actual = target ?? (typeof document === 'undefined' ? undefined : document);
  if (!actual || unlockTargets.has(actual)) return;
  unlockTargets.add(actual);
  actual.addEventListener('pointerdown', unlock, { once: true });
  actual.addEventListener('keydown', unlock, { once: true });
}

function music(id: SongId | null, fadeMs = 1_000): void {
  loadPreference();
  if (requestedSong === id) return;
  requestedSong = id;
  requestedFade = Math.max(0, fadeMs);
  syncRequests();
}

function jingle(id: JingleId): void {
  loadPreference();
  if (!context || context.state !== 'running' || isMuted || !graph) return;
  graph.player.jingle(jingles[id]);
  playedCount += 1;
  lastPlayed = id;
}

function sfx(id: SfxId, options: SfxOptions = {}): void {
  loadPreference();
  asked[id] = (asked[id] ?? 0) + 1;
  if (!context || context.state !== 'running' || isMuted || !graph) return;
  playSfx(context, graph.effects, id, context.currentTime, {
    ...options,
    detune: options.detune ?? Math.random() * 80 - 40,
  });
  playedCount += 1;
  played[id] = (played[id] ?? 0) + 1;
  lastPlayed = id;
}

function bed(id: BedId, level: number, pan = 0): void {
  loadPreference();
  bedRequests[id] = { level: Math.max(0, Math.min(1, level)), pan };
  if (graph && context?.state === 'running') graph.beds.set(id, bedRequests[id].level, pan);
}

function crackle(level: number, pan = 0): void {
  loadPreference();
  crackleRequest = { level: Math.max(0, Math.min(1, level)), pan };
  if (graph && context?.state === 'running') graph.crackle.set(crackleRequest.level, pan);
}

function level(): number {
  if (!context || context.state !== 'running' || !graph) return 0;
  const samples = new Float32Array(graph.analyser.fftSize);
  graph.analyser.getFloatTimeDomainData(samples);
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

function ambience(kind: AmbienceKind | null): void {
  loadPreference();
  if (requestedAmbience === kind) return;
  requestedAmbience = kind;
  syncRequests();
}

function setMuted(muted: boolean): void {
  loadPreference();
  isMuted = muted;
  writeMuted(storage(), muted);
  if (!context || !graph) return;
  const now = context.currentTime;
  graph.master.gain.cancelScheduledValues(now);
  graph.master.gain.setValueAtTime(graph.master.gain.value, now);
  graph.master.gain.linearRampToValueAtTime(muted ? 0 : 0.8, now + 0.05);
}

function state(): SoundState {
  loadPreference();
  return {
    unlocked: context?.state === 'running',
    muted: isMuted,
    song: requestedSong,
    ambience: requestedAmbience,
    sfxCount: playedCount,
    lastSfx: lastPlayed,
    asked: { ...asked },
    counts: { ...played },
    beds: { fire: bedRequests.fire.level, stream: bedRequests.stream.level, dread: bedRequests.dread.level },
    crackle: crackleRequest.level,
  };
}

async function measure(id: SongId, seconds: number): Promise<{ rms: number; peak: number }> {
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('seconds must be positive');
  const browser = globalThis as unknown as {
    OfflineAudioContext?: new (channels: number, length: number, sampleRate: number) => OfflineAudioContext;
    webkitOfflineAudioContext?: new (channels: number, length: number, sampleRate: number) => OfflineAudioContext;
  };
  const OfflineContext = browser.OfflineAudioContext ?? browser.webkitOfflineAudioContext;
  if (!OfflineContext) throw new Error('Offline Web Audio is not supported in this browser');
  const sampleRate = 44_100;
  const offline = new OfflineContext(1, Math.ceil(seconds * sampleRate), sampleRate);
  const master = offline.createGain();
  const musicBus = offline.createGain();
  const compressor = offline.createDynamicsCompressor();
  master.gain.value = 0.8;
  musicBus.gain.value = 0.45;
  compressor.threshold.value = -10;
  compressor.ratio.value = 4;
  musicBus.connect(master).connect(compressor).connect(offline.destination);
  renderSong(offline, musicBus, songs[id], seconds);
  const rendered = await offline.startRendering();
  const samples = rendered.getChannelData(0);
  let sumSquares = 0;
  let peak = 0;
  for (const sample of samples) {
    sumSquares += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  return { rms: Math.sqrt(sumSquares / samples.length), peak };
}

export const sound: SoundApi = {
  unlock,
  installUnlock,
  music,
  jingle,
  sfx,
  ambience,
  bed,
  crackle,
  level,
  get muted() {
    loadPreference();
    return isMuted;
  },
  setMuted,
  state,
  measure,
};
