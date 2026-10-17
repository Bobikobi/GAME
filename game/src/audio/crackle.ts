/**
 * The crackle of a burning fire the player stands near: pops of bright noise over a low hush,
 * rendered once per audio context (no asset) and looped while it is heard. It holds nothing
 * while silent: a level above 0 starts it, and a level of 0 fades it, stops its sources on the
 * audio clock and lets go of every node as they end, so no node runs and no timer waits once
 * it is quiet. It plays into the ambience bus, so the mute and the volume cover it.
 */

/** The loudest the crackle gets at level 1, under the ambience bus. */
const TOP = 0.9;
/** The time constant of a level change, in seconds, as the position beds glide. */
const GLIDE = 0.25;
/** The fade to silence, and when the sources stop after it (seven fade constants: nothing left to hear). */
const FADE = 0.08;
const STOP_AFTER = 0.6;

/** Two loops whose lengths never line up, so the pops do not come round in a pattern; the first carries the hush. */
const LOOPS = [
  { seconds: 1.9, seed: 0x2f6b, hush: 0.5, pops: 1 },
  { seconds: 2.7, seed: 0x51d3, hush: 0, pops: 0.7 },
] as const;

const rendered = new WeakMap<BaseAudioContext, AudioBuffer[]>();

/** A fixed-seed generator: the crackle is the same every time it is rendered. */
function rng(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

/** One loop: a low hush, and pops (a few ms of bright noise dying away) 40 to 260 ms apart; its tail is laid over its head, so it has no seam. */
function render(context: BaseAudioContext, seconds: number, seed: number, hush: number, pops: number): AudioBuffer {
  const rate = context.sampleRate;
  const length = Math.round(seconds * rate);
  const join = Math.round(0.05 * rate);
  const raw = new Float32Array(length + join);
  const rand = rng(seed);
  let low = 0;
  for (let i = 0; i < raw.length; i++) {
    low += (rand() * 2 - 1 - low) * 0.02;
    raw[i] = low * hush;
  }
  for (let at = Math.round(rand() * 0.1 * rate); at < raw.length; at += Math.round((0.04 + rand() * 0.22) * rate)) {
    const n = Math.round((0.003 + rand() * 0.02) * rate);
    const gain = (0.2 + rand() * 0.6) * pops;
    let last = 0;
    for (let k = 0; k < n && at + k < raw.length; k++) {
      const white = rand() * 2 - 1;
      raw[at + k] = raw[at + k]! + (white - last) * 0.5 * gain * Math.exp((-5 * k) / n);
      last = white;
    }
  }
  const buffer = context.createBuffer(1, length, rate);
  const out = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) out[i] = i < join ? raw[i]! * (i / join) + raw[length + i]! * (1 - i / join) : raw[i]!;
  return buffer;
}

/** The crackle's loops for a context, rendered on first use. */
export function crackleBuffers(context: BaseAudioContext): AudioBuffer[] {
  let buffers = rendered.get(context);
  if (!buffers) {
    buffers = LOOPS.map((l) => render(context, l.seconds, l.seed, l.hush, l.pops));
    rendered.set(context, buffers);
  }
  return buffers;
}

interface Voice {
  sources: AudioBufferSourceNode[];
  gain: GainNode;
  pan: StereoPannerNode;
}

export class Crackle {
  private voice: Voice | null = null;

  constructor(
    private readonly context: BaseAudioContext,
    private readonly destination: AudioNode,
  ) {}

  /** The crackle at a level 0..1 and a pan -1..1: above 0 it starts if silent and glides there; 0 lets it fade and go. */
  set(level: number, pan = 0): void {
    const clamped = Math.max(0, Math.min(1, level));
    if (clamped === 0) {
      this.stop();
      return;
    }
    const now = this.context.currentTime;
    const voice = this.voice ?? this.start(now);
    voice.gain.gain.setTargetAtTime(clamped * TOP, now, GLIDE);
    voice.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, GLIDE);
  }

  private start(now: number): Voice {
    const gain = this.context.createGain();
    const pan = this.context.createStereoPanner();
    gain.gain.value = 0;
    gain.connect(pan).connect(this.destination);
    let left = 0;
    const sources = crackleBuffers(this.context).map((buffer) => {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      // each source lets go of itself as it ends, and the last one of the gain and the pan
      source.onended = () => {
        source.disconnect();
        left -= 1;
        if (left > 0) return;
        gain.disconnect();
        pan.disconnect();
      };
      source.start(now, Math.random() * buffer.duration);
      left += 1;
      return source;
    });
    this.voice = { sources, gain, pan };
    return this.voice;
  }

  /** A quick fade, then the sources stop on the audio clock (no timer) and let go of their nodes as they end. */
  private stop(): void {
    const voice = this.voice;
    if (!voice) return;
    this.voice = null;
    const now = this.context.currentTime;
    voice.gain.gain.setTargetAtTime(0, now, FADE);
    for (const source of voice.sources) source.stop(now + STOP_AFTER);
  }
}
