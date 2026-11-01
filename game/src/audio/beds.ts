/**
 * Four position-driven beds on the ambience bus (so the mute covers them): the campfire's
 * crackle, the stream's water, the dread of the ruins and the prowl of a predator near (the
 * threat telegraph's near beat, NEXT.md 12 c). Each runs quietly all the time and
 * only its gain follows the player's distance; sources are never restarted by walking about.
 */
import { noiseBuffer, wavePeriodic } from './synth';

export type BedId = 'fire' | 'stream' | 'dread' | 'prowl';
export const BED_IDS: readonly BedId[] = ['fire', 'stream', 'dread', 'prowl'];

/** The loudest each bed gets at level 1, under the ambience bus. */
const TOP: Record<BedId, number> = { fire: 0.9, stream: 0.7, dread: 0.8, prowl: 0.9 };

export interface BedLevel {
  level: number;
  pan: number;
}

export class BedPlayer {
  private readonly gains = new Map<BedId, GainNode>();
  private readonly pans = new Map<BedId, StereoPannerNode>();
  private pops: ReturnType<typeof setTimeout> | null = null;
  private prowls: ReturnType<typeof setTimeout> | null = null;
  private level: Record<BedId, number> = { fire: 0, stream: 0, dread: 0, prowl: 0 };

  constructor(
    private readonly context: AudioContext,
    private readonly destination: AudioNode,
  ) {
    for (const id of BED_IDS) {
      const gain = context.createGain();
      const pan = context.createStereoPanner();
      gain.gain.value = 0;
      gain.connect(pan).connect(destination);
      this.gains.set(id, gain);
      this.pans.set(id, pan);
    }
    this.buildFire(this.gains.get('fire')!);
    this.buildStream(this.gains.get('stream')!);
    this.buildDread(this.gains.get('dread')!);
    this.buildProwl(this.gains.get('prowl')!);
    this.schedulePop();
    this.scheduleProwl();
  }

  set(id: BedId, level: number, pan = 0): void {
    const clamped = Math.max(0, Math.min(1, level));
    this.level[id] = clamped;
    const now = this.context.currentTime;
    this.gains.get(id)!.gain.setTargetAtTime(clamped * TOP[id], now, 0.25);
    this.pans.get(id)!.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, 0.25);
  }

  levels(): Record<BedId, number> {
    return { ...this.level };
  }

  private noise(): AudioBufferSourceNode {
    const source = this.context.createBufferSource();
    source.buffer = noiseBuffer(this.context);
    source.loop = true;
    source.start(this.context.currentTime);
    return source;
  }

  /** A low hush under the pops, which `schedulePop` throws in at random. */
  private buildFire(out: AudioNode): void {
    const filter = this.context.createBiquadFilter();
    const hush = this.context.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    hush.gain.value = 0.22;
    this.noise().connect(filter).connect(hush).connect(out);
  }

  private schedulePop(): void {
    const next = (): void => {
      this.pops = setTimeout(next, 40 + Math.random() * 220);
      if (this.context.state !== 'running' || this.level.fire < 0.02) return;
      const at = this.context.currentTime + 0.01;
      const length = 0.012 + Math.random() * 0.03;
      const filter = this.context.createBiquadFilter();
      const envelope = this.context.createGain();
      const source = this.context.createBufferSource();
      filter.type = 'bandpass';
      filter.frequency.value = 1_400 + Math.random() * 3_200;
      filter.Q.value = 1.2;
      envelope.gain.setValueAtTime(0.25 + Math.random() * 0.55, at);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
      source.buffer = noiseBuffer(this.context);
      source.connect(filter).connect(envelope).connect(this.gains.get('fire')!);
      source.start(at, Math.random() * 0.8);
      source.stop(at + length);
    };
    next();
  }

  private buildStream(out: AudioNode): void {
    const low = this.context.createBiquadFilter();
    const bubbles = this.context.createBiquadFilter();
    const body = this.context.createGain();
    const sparkle = this.context.createGain();
    low.type = 'bandpass';
    low.frequency.value = 800;
    low.Q.value = 0.5;
    bubbles.type = 'bandpass';
    bubbles.frequency.value = 2_300;
    bubbles.Q.value = 3;
    body.gain.value = 0.55;
    sparkle.gain.value = 0.1;
    for (const [rate, depth, target] of [[0.31, 220, low.frequency], [0.77, 140, low.frequency], [2.3, 0.07, sparkle.gain]] as const) {
      const lfo = this.context.createOscillator();
      const amount = this.context.createGain();
      lfo.frequency.value = rate;
      amount.gain.value = depth;
      lfo.connect(amount).connect(target);
      lfo.start(this.context.currentTime);
    }
    const source = this.noise();
    source.connect(low).connect(body).connect(out);
    source.connect(bubbles).connect(sparkle).connect(out);
  }

  /** Two sub-bass pitches a hair apart beat slowly, with a breath of dark noise over them. */
  private buildDread(out: AudioNode): void {
    const low = this.context.createBiquadFilter();
    const drone = this.context.createGain();
    low.type = 'lowpass';
    low.frequency.value = 180;
    drone.gain.value = 0.5;
    for (const frequency of [41.2, 43.4]) {
      const oscillator = this.context.createOscillator();
      oscillator.setPeriodicWave(wavePeriodic(this.context));
      oscillator.frequency.value = frequency;
      oscillator.connect(low);
      oscillator.start(this.context.currentTime);
    }
    low.connect(drone).connect(out);
    const breath = this.context.createBiquadFilter();
    const air = this.context.createGain();
    const lfo = this.context.createOscillator();
    const amount = this.context.createGain();
    breath.type = 'bandpass';
    breath.frequency.value = 260;
    breath.Q.value = 1.4;
    air.gain.value = 0.12;
    lfo.frequency.value = 0.13;
    amount.gain.value = 0.1;
    lfo.connect(amount).connect(air.gain);
    lfo.start(this.context.currentTime);
    this.noise().connect(breath).connect(air).connect(out);
  }

  /** A slow breath: dark noise through a low band, swelling and easing about every three seconds. */
  private buildProwl(out: AudioNode): void {
    const band = this.context.createBiquadFilter();
    const breath = this.context.createGain();
    const lfo = this.context.createOscillator();
    const amount = this.context.createGain();
    band.type = 'bandpass';
    band.frequency.value = 340;
    band.Q.value = 2.2;
    breath.gain.value = 0.18;
    lfo.frequency.value = 0.33;
    amount.gain.value = 0.16;
    lfo.connect(amount).connect(breath.gain);
    lfo.start(this.context.currentTime);
    this.noise().connect(band).connect(breath).connect(out);
  }

  /** Now and then over the breath: a twig snapping (a bright tick) or a pad on the ground (a soft low knock). */
  private scheduleProwl(): void {
    const next = (): void => {
      this.prowls = setTimeout(next, 700 + Math.random() * 1_600);
      if (this.context.state !== 'running' || this.level.prowl < 0.02) return;
      const at = this.context.currentTime + 0.01;
      const twig = Math.random() < 0.3;
      const length = twig ? 0.025 : 0.09;
      const filter = this.context.createBiquadFilter();
      const envelope = this.context.createGain();
      const source = this.context.createBufferSource();
      filter.type = twig ? 'highpass' : 'lowpass';
      filter.frequency.value = twig ? 2_400 : 220;
      envelope.gain.setValueAtTime(twig ? 0.5 : 0.8, at);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
      source.buffer = noiseBuffer(this.context);
      source.connect(filter).connect(envelope).connect(this.gains.get('prowl')!);
      source.start(at, Math.random() * 0.8);
      source.stop(at + length);
    };
    next();
  }

  dispose(): void {
    if (this.pops) clearTimeout(this.pops);
    this.pops = null;
    if (this.prowls) clearTimeout(this.prowls);
    this.prowls = null;
  }
}
