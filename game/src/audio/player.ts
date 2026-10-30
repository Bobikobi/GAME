/** Look-ahead song scheduler: the display clock queues work on the audio clock. */
import { noteFreq, parseChannel, stepMs } from './sequence';
import type { ParsedChannel } from './sequence';
import type { Jingle, Song, VoiceSettings } from './songs';
import { playVoice } from './synth';

const TICK_MS = 25;
const LOOK_AHEAD = 0.12;

interface Cursor {
  parsed: ParsedChannel;
  voice: VoiceSettings;
  index: number;
  cycle: number;
}

interface ActiveSong {
  gain: GainNode;
  start: number;
  stepSeconds: number;
  loopSteps: number;
  cursors: Cursor[];
  sources: Set<AudioScheduledSourceNode>;
  endAt: number;
}

export class MusicPlayer {
  private readonly duck: GainNode;
  private active: ActiveSong | null = null;
  private readonly fading = new Set<ActiveSong>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly context: AudioContext,
    musicDestination: AudioNode,
    private readonly jingleDestination: AudioNode,
  ) {
    this.duck = context.createGain();
    this.duck.connect(musicDestination);
  }

  /** Where other music joins this player's: under the same duck, so a jingle ducks it too (G26). */
  get input(): AudioNode {
    return this.duck;
  }

  play(song: Song | null, fadeMs: number): void {
    const now = this.context.currentTime;
    const fade = Math.max(0, fadeMs) / 1_000;
    const old = this.active;
    if (old) {
      old.endAt = now + fade;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, old.endAt);
      this.fading.add(old);
      this.stopLater(old, fade);
      this.active = null;
    }
    if (song) {
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(fade > 0 ? 0 : 1, now);
      if (fade > 0) gain.gain.linearRampToValueAtTime(1, now + fade);
      gain.connect(this.duck);
      const loopSteps = song.bars * 16;
      const cursors = Object.entries(song.channels).map(([name, notation]) => ({
        parsed: parseChannel('song', name, notation, loopSteps),
        voice: song.voices[name as keyof Song['voices']],
        index: 0,
        cycle: 0,
      }));
      this.active = {
        gain,
        start: now,
        stepSeconds: stepMs(song.bpm) / 1_000,
        loopSteps,
        cursors,
        sources: new Set(),
        endAt: Number.POSITIVE_INFINITY,
      };
      this.schedule();
    }
    this.syncTimer();
  }

  jingle(jingle: Jingle): number {
    const now = this.context.currentTime;
    const stepSeconds = stepMs(jingle.bpm) / 1_000;
    const duration = jingle.steps * stepSeconds;
    this.duck.gain.cancelScheduledValues(now);
    this.duck.gain.setValueAtTime(this.duck.gain.value, now);
    this.duck.gain.linearRampToValueAtTime(0.3, now + 0.04);
    this.duck.gain.setValueAtTime(0.3, now + duration);
    this.duck.gain.linearRampToValueAtTime(1, now + duration + 0.6);

    for (const [name, notation] of Object.entries(jingle.channels)) {
      const parsed = parseChannel('jingle', name, notation, jingle.steps);
      const voice = jingle.voices[name as keyof Jingle['voices']];
      for (const event of parsed.events) {
        if (!event.value) continue;
        const start = now + event.start * stepSeconds;
        playVoice(this.context, this.jingleDestination, event.value, noteFreq(event.value), start, event.steps * stepSeconds, voice);
      }
    }
    return duration;
  }

  private schedule = (): void => {
    for (const active of this.active ? [...this.fading, this.active] : this.fading) {
      this.scheduleSong(active);
    }
  };

  private scheduleSong(active: ActiveSong): void {
    const horizon = this.context.currentTime + LOOK_AHEAD;
    for (const cursor of active.cursors) {
      while (true) {
        const event = cursor.parsed.events[cursor.index];
        if (!event) break;
        const absoluteStep = cursor.cycle * active.loopSteps + event.start;
        const start = active.start + absoluteStep * active.stepSeconds;
        if (start > horizon || start >= active.endAt) break;
        if (event.value && start >= this.context.currentTime - 0.01) {
          const frequency = cursor.voice.kind === 'noise' ? 0 : noteFreq(event.value);
          const source = playVoice(
            this.context,
            active.gain,
            event.value,
            frequency,
            Math.max(start, this.context.currentTime),
            event.steps * active.stepSeconds,
            cursor.voice,
          );
          active.sources.add(source);
          source.addEventListener('ended', () => active.sources.delete(source), { once: true });
        }
        cursor.index += 1;
        if (cursor.index === cursor.parsed.events.length) {
          cursor.index = 0;
          cursor.cycle += 1;
        }
      }
    }
  }

  private syncTimer(): void {
    if ((this.active || this.fading.size > 0) && this.timer === null) this.timer = setInterval(this.schedule, TICK_MS);
    if (!this.active && this.fading.size === 0 && this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private stopLater(song: ActiveSong, delaySeconds: number): void {
    setTimeout(() => {
      for (const source of song.sources) {
        try {
          source.stop();
        } catch {
          // A source can finish naturally before the crossfade does.
        }
      }
      song.sources.clear();
      song.gain.disconnect();
      this.fading.delete(song);
      this.syncTimer();
    }, delaySeconds * 1_000 + 50);
  }
}

/** Schedule a complete score into an offline graph without relying on timers. */
export function renderSong(
  context: OfflineAudioContext,
  destination: AudioNode,
  song: Song,
  seconds: number,
): void {
  const loopSteps = song.bars * 16;
  const stepSeconds = stepMs(song.bpm) / 1_000;
  const loopSeconds = loopSteps * stepSeconds;
  for (let loopStart = 0; loopStart < seconds; loopStart += loopSeconds) {
    for (const [name, notation] of Object.entries(song.channels)) {
      const voice = song.voices[name as keyof Song['voices']];
      const parsed = parseChannel('song', name, notation, loopSteps);
      for (const event of parsed.events) {
        const start = loopStart + event.start * stepSeconds;
        if (!event.value || start >= seconds) continue;
        const frequency = voice.kind === 'noise' ? 0 : noteFreq(event.value);
        playVoice(context, destination, event.value, frequency, start, Math.min(event.steps * stepSeconds, seconds - start), voice);
      }
    }
  }
}
