/** Lazy, self-contained sound system for Mistvale's music, ambience, and cues. */
import { AmbiencePlayer } from './ambience';
import type { AmbienceKind } from './ambience';
import { MusicPlayer, renderSong } from './player';
import { jingles, songs } from './songs';
import { playSfx } from './sfx';
import type { SfxId, SfxOptions } from './sfx';
import { readMuted, writeMuted } from './storage';
import type { SoundStorage } from './storage';

export type SongId = 'valley' | 'night';
export type JingleId = 'level' | 'quest' | 'found';
export type { SfxId } from './sfx';

export interface SoundState {
  unlocked: boolean;
  muted: boolean;
  song: SongId | null;
  ambience: AmbienceKind | null;
  sfxCount: number;
  lastSfx: string | null;
}

interface AudioGraph {
  master: GainNode;
  music: GainNode;
  effects: GainNode;
  ambience: GainNode;
  player: MusicPlayer;
  ambiencePlayer: AmbiencePlayer;
}

interface SoundApi {
  unlock(): void;
  installUnlock(target?: EventTarget): void;
  music(id: SongId | null, fadeMs?: number): void;
  jingle(id: JingleId): void;
  sfx(id: SfxId, opts?: SfxOptions): void;
  ambience(kind: AmbienceKind | null): void;
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
  master.connect(compressor).connect(audio.destination);
  graph = {
    master,
    music,
    effects,
    ambience,
    player: new MusicPlayer(audio, music, effects),
    ambiencePlayer: new AmbiencePlayer(audio, ambience),
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
  if (!context || context.state !== 'running' || isMuted || !graph) return;
  playSfx(context, graph.effects, id, context.currentTime, {
    ...options,
    detune: options.detune ?? Math.random() * 80 - 40,
  });
  playedCount += 1;
  lastPlayed = id;
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
  get muted() {
    loadPreference();
    return isMuted;
  },
  setMuted,
  state,
  measure,
};
