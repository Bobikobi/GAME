/**
 * Plays the music by state (state.ts) from one of two sources, the player's choice (source.ts):
 * - real: round 2's renders of the pieces on sampled instruments (game/public/music, FluidR3_GM by Frank Wen,
 *   CC BY 3.0). The routine streams through a media element, so its first note does not wait for its 1.3 MB;
 *   the 30-second loops are fetched whole and decoded, so they loop without a gap. Each file is fetched when its
 *   state first comes, never before play begins.
 * - synth: the same notes (pieces.ts) played live on the synth's voices (voices.ts).
 * A change of piece or of source is a crossfade. A file that cannot be fetched or decoded plays on the synth.
 */
import { beatSeconds, loopSeconds, piece, type Piece } from './pieces';
import type { MusicSource } from './source';
import type { MusicState } from './state';
import { noise, partBuses, room, synthVoice } from './voices';

/** The files were rendered 1.35 times louder than the notes' own level, for headroom: this brings them back. */
export const REAL_GAIN = 1 / 1.3497;
/**
 * The pieces' level on the music bus: the routine as loud as the valley song it replaces (RMS 0.10 against 0.24
 * at the bus, measured 30.10), the states at their own levels around it.
 */
export const PIECES_GAIN = 2.4;

const TICK_MS = 50;
const LOOK_AHEAD = 0.3;
/** How long a synth piece rings on after its fade, for the room's tail. */
const TAIL = 3;

export function musicUrl(state: MusicState): string {
  return `music/${state}.ogg`;
}

interface Track {
  state: MusicState;
  source: MusicSource;
  gain: GainNode;
  /** resolves when the first note can sound; rejects when the source cannot play */
  ready: Promise<void>;
  start(): void;
  stop(at: number): void;
}

export interface PiecesOptions {
  /** the address of a state's file; the page's own folder by default */
  url?: (state: MusicState) => string;
  fetcher?: typeof fetch;
}

export class PiecePlayer {
  private active: Track | null = null;
  private readonly buffers = new Map<MusicState, Promise<AudioBuffer>>();
  /** the routine's element, made the first time it plays */
  private stream: { el: HTMLAudioElement; level: GainNode; ready: Promise<void> } | null = null;
  /** states whose file failed: they play on the synth from then on */
  private readonly broken = new Set<MusicState>();
  private readonly output: GainNode;
  private readonly url: (state: MusicState) => string;
  private readonly fetcher: typeof fetch;
  /** every file asked for, in order, for the e2e and the measures */
  readonly fetched: string[] = [];

  constructor(
    private readonly context: AudioContext,
    destination: AudioNode,
    options: PiecesOptions = {},
  ) {
    this.output = context.createGain();
    this.output.gain.value = PIECES_GAIN;
    this.output.connect(destination);
    this.url = options.url ?? musicUrl;
    this.fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
  }

  /** The piece now playing (or loading), and from which source. */
  now(): { state: MusicState; source: MusicSource } | null {
    return this.active ? { state: this.active.state, source: this.active.source } : null;
  }

  /** Plays a state's piece from a source, crossfading from what plays now over `fadeMs`; null fades to silence. */
  play(state: MusicState | null, source: MusicSource, fadeMs: number): void {
    const old = this.active;
    const real = source === 'real' && state !== null && !this.broken.has(state) ? 'real' : 'synth';
    if (old && state && old.state === state && old.source === real) return;
    const fade = Math.max(0.05, fadeMs / 1_000);
    if (!state) {
      this.active = null;
      if (old) old.stop(this.context.currentTime + fade);
      return;
    }
    const track = real === 'real' ? this.realTrack(state) : this.synthTrack(state);
    this.active = track;
    track.ready.then(
      () => {
        if (this.active !== track) return;
        const now = this.context.currentTime;
        track.gain.gain.setValueAtTime(0, now);
        track.gain.gain.linearRampToValueAtTime(1, now + fade);
        track.start();
        if (old) old.stop(now + fade);
      },
      () => {
        // the file would not play: this state plays on the synth, now and from here on
        this.broken.add(state);
        if (this.active !== track) return;
        this.active = null;
        this.play(state, 'synth', fadeMs);
      },
    );
  }

  private realTrack(state: MusicState): Track {
    return state === 'routine' ? this.streamed(state) : this.decoded(state);
  }

  /** The routine: streamed through a media element, playing as soon as enough of it has come. */
  private streamed(state: MusicState): Track {
    const gain = this.context.createGain();
    gain.gain.value = 0;
    gain.connect(this.output);
    // one element for the whole session: a switch back to the real instruments plays on from it, not fetched again
    if (!this.stream) {
      const el = new Audio();
      el.preload = 'auto';
      el.loop = true;
      const src = this.url(state);
      this.fetched.push(src);
      el.src = src;
      const level = this.context.createGain();
      level.gain.value = REAL_GAIN;
      this.context.createMediaElementSource(el).connect(level);
      const ready = new Promise<void>((ok, fail) => {
        el.addEventListener('canplay', () => ok(), { once: true });
        el.addEventListener('error', () => fail(new Error(`cannot play ${src}`)), { once: true });
      });
      this.stream = { el, level, ready };
    }
    const { el, level, ready } = this.stream;
    // a suspended context (the page hidden) holds the element still with it
    const follow = () => {
      if (this.context.state === 'running') void el.play().catch(() => undefined);
      else el.pause();
    };
    return {
      state,
      source: 'real',
      gain,
      ready,
      start: () => {
        level.connect(gain);
        this.context.addEventListener('statechange', follow);
        follow();
      },
      stop: (at) => {
        gain.gain.cancelScheduledValues(this.context.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, this.context.currentTime);
        gain.gain.linearRampToValueAtTime(0, at);
        setTimeout(() => {
          this.context.removeEventListener('statechange', follow);
          // the element pauses only when no newer routine track has taken it
          if (this.active?.state !== 'routine' || this.active.source !== 'real') el.pause();
          gain.disconnect();
        }, (at - this.context.currentTime) * 1_000 + 100);
      },
    };
  }

  /** A loop: fetched whole the first time its state comes, decoded once, then looped without a seam. */
  private decoded(state: MusicState): Track {
    const gain = this.context.createGain();
    gain.gain.value = 0;
    gain.connect(this.output);
    let buffer = this.buffers.get(state);
    if (!buffer) {
      const src = this.url(state);
      this.fetched.push(src);
      buffer = this.fetcher(src)
        .then((r) => {
          if (!r.ok) throw new Error(`${src}: ${r.status}`);
          return r.arrayBuffer();
        })
        .then((bytes) => this.context.decodeAudioData(bytes));
      // a failed fetch is tried again the next time the state comes
      buffer.catch(() => this.buffers.delete(state));
      this.buffers.set(state, buffer);
    }
    let node: AudioBufferSourceNode | null = null;
    const ready = buffer.then((b) => {
      node = this.context.createBufferSource();
      node.buffer = b;
      node.loop = true;
      const level = this.context.createGain();
      level.gain.value = REAL_GAIN;
      node.connect(level).connect(gain);
    });
    return {
      state,
      source: 'real',
      gain,
      ready,
      start: () => node?.start(),
      stop: (at) => {
        gain.gain.cancelScheduledValues(this.context.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, this.context.currentTime);
        gain.gain.linearRampToValueAtTime(0, at);
        try {
          node?.stop(at + 0.05);
        } catch {
          // never started: its fade was cut before it was ready
        }
        setTimeout(() => gain.disconnect(), (at - this.context.currentTime) * 1_000 + 200);
      },
    };
  }

  /** The synth: the piece's notes scheduled a little ahead on the audio clock, loop after loop. */
  private synthTrack(state: MusicState): Track {
    const ctx = this.context;
    const p: Piece = piece(state);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.output);
    let bus: AudioNode = gain;
    let close: BiquadFilterNode | null = null;
    if (p.fx.closeLowpass) {
      close = ctx.createBiquadFilter();
      close.type = 'lowpass';
      close.frequency.value = p.fx.closeLowpass[0];
      close.connect(bus);
      bus = close;
    }
    if (p.fx.lofi) {
      const warm = ctx.createBiquadFilter();
      warm.type = 'lowpass';
      warm.frequency.value = 5_200;
      warm.connect(bus);
      bus = warm;
    }
    const out = room(ctx, bus, p.fx.reverb);
    const parts = partBuses(ctx, out);
    const nb = noise(ctx);
    // the tape's slow wobble, shared by every pitched voice of a lofi piece
    const wob = ctx.createOscillator();
    const wobble = ctx.createGain();
    wob.frequency.value = 0.4;
    wobble.gain.value = p.fx.lofi ? 6 : 0;
    wob.connect(wobble);
    const loop = loopSeconds(p);
    const events = p.events.filter((e) => e.t < p.loopBeats).map((e) => ({ e, at: beatSeconds(p, e.t), d: (e.d * 60) / p.bpm }));
    let origin = 0;
    let cycle = 0;
    let index = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    let endAt = Number.POSITIVE_INFINITY;
    const schedule = (): void => {
      const horizon = ctx.currentTime + LOOK_AHEAD;
      for (;;) {
        const next = events[index];
        if (!next) break;
        const at = origin + cycle * loop + next.at;
        if (at > horizon || at >= endAt) break;
        if (index === 0 && close && p.fx.closeLowpass) {
          close.frequency.setValueAtTime(p.fx.closeLowpass[0], at);
          close.frequency.exponentialRampToValueAtTime(p.fx.closeLowpass[1], at + loop - 0.01);
        }
        if (at >= ctx.currentTime - 0.01) synthVoice(ctx, out, parts, next.e, Math.max(at, ctx.currentTime), next.d, nb, wobble);
        index += 1;
        if (index === events.length) {
          index = 0;
          cycle += 1;
        }
      }
    };
    return {
      state,
      source: 'synth',
      gain,
      ready: Promise.resolve(),
      start: () => {
        origin = ctx.currentTime + 0.05;
        wob.start();
        schedule();
        timer = setInterval(schedule, TICK_MS);
      },
      stop: (at) => {
        endAt = at;
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, at);
        setTimeout(() => {
          if (timer !== null) clearInterval(timer);
          try {
            wob.stop();
          } catch {
            // never started
          }
          gain.disconnect();
        }, (at - ctx.currentTime + TAIL) * 1_000);
      },
    };
  }
}
