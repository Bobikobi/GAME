/** Crossfaded procedural day and night beds with cancellable wildlife timers. */
import { playSfx } from './sfx';
import { noiseBuffer, wavePeriodic } from './synth';

export type AmbienceKind = 'day' | 'night';

interface Bed {
  gain: GainNode;
  sources: AudioScheduledSourceNode[];
  timers: Array<ReturnType<typeof setTimeout>>;
  stopped: boolean;
}

export class AmbiencePlayer {
  private active: Bed | null = null;

  constructor(
    private readonly context: AudioContext,
    private readonly destination: AudioNode,
  ) {}

  play(kind: AmbienceKind | null): void {
    const now = this.context.currentTime;
    const old = this.active;
    if (old) {
      old.stopped = true;
      old.timers.forEach(clearTimeout);
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + 2);
      setTimeout(() => this.dispose(old), 2_050);
      this.active = null;
    }
    if (!kind) return;
    const bed: Bed = {
      gain: this.context.createGain(),
      sources: [],
      timers: [],
      stopped: false,
    };
    bed.gain.gain.setValueAtTime(0, now);
    bed.gain.gain.linearRampToValueAtTime(1, now + 2);
    bed.gain.connect(this.destination);
    if (kind === 'day') this.startDay(bed);
    else this.startNight(bed);
    this.active = bed;
  }

  private startDay(bed: Bed): void {
    const now = this.context.currentTime;
    const wind = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const lfo = this.context.createOscillator();
    const depth = this.context.createGain();
    const gain = this.context.createGain();
    wind.buffer = noiseBuffer(this.context);
    wind.loop = true;
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    filter.Q.value = 0.7;
    lfo.frequency.value = 1 / 9;
    depth.gain.value = 300;
    gain.gain.value = 0.35;
    lfo.connect(depth).connect(filter.frequency);
    wind.connect(filter).connect(gain).connect(bed.gain);
    wind.start(now);
    lfo.start(now);
    bed.sources.push(wind, lfo);

    const birds = (): void => {
      if (bed.stopped) return;
      const at = this.context.currentTime + 0.02;
      const panner = this.context.createStereoPanner();
      const birdGain = this.context.createGain();
      panner.pan.value = Math.random() * 1.6 - 0.8;
      birdGain.gain.value = 0.12;
      panner.connect(birdGain).connect(bed.gain);
      const count = 2 + Math.floor(Math.random() * 3);
      for (let index = 0; index < count; index += 1) {
        const oscillator = this.context.createOscillator();
        const envelope = this.context.createGain();
        const start = at + index * 0.09;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(2_800 + Math.random() * 300, start);
        oscillator.frequency.exponentialRampToValueAtTime(3_800 + Math.random() * 400, start + 0.065);
        envelope.gain.setValueAtTime(0, start);
        envelope.gain.linearRampToValueAtTime(1, start + 0.01);
        envelope.gain.linearRampToValueAtTime(0, start + 0.07);
        oscillator.connect(envelope).connect(panner);
        oscillator.start(start);
        oscillator.stop(start + 0.075);
        bed.sources.push(oscillator);
      }
      this.later(bed, birds, randomBetween(8, 20));
    };
    this.later(bed, birds, randomBetween(8, 20));
  }

  private startNight(bed: Bed): void {
    const now = this.context.currentTime;
    const droneGain = this.context.createGain();
    droneGain.gain.value = 0.25;
    droneGain.connect(bed.gain);
    for (const frequency of [55, 55.4]) {
      const oscillator = this.context.createOscillator();
      oscillator.setPeriodicWave(wavePeriodic(this.context));
      oscillator.frequency.value = frequency;
      oscillator.connect(droneGain);
      oscillator.start(now);
      bed.sources.push(oscillator);
    }

    const crickets = (): void => {
      if (bed.stopped) return;
      const at = this.context.currentTime + 0.02;
      const panner = this.context.createStereoPanner();
      const cricketGain = this.context.createGain();
      panner.pan.value = Math.random() * 1.8 - 0.9;
      cricketGain.gain.value = 0.06;
      panner.connect(cricketGain).connect(bed.gain);
      const count = 3 + Math.floor(Math.random() * 4);
      for (let index = 0; index < count; index += 1) {
        const oscillator = this.context.createOscillator();
        const envelope = this.context.createGain();
        const start = at + index * 0.045;
        oscillator.type = 'square';
        oscillator.frequency.value = 4_600;
        envelope.gain.setValueAtTime(0.7, start);
        envelope.gain.linearRampToValueAtTime(0, start + 0.02);
        oscillator.connect(envelope).connect(panner);
        oscillator.start(start);
        oscillator.stop(start + 0.02);
        bed.sources.push(oscillator);
      }
      this.later(bed, crickets, randomBetween(2, 6));
    };
    this.later(bed, crickets, randomBetween(2, 6));

    const ruinsBell = (): void => {
      if (bed.stopped) return;
      playSfx(this.context, bed.gain, 'bell', this.context.currentTime + 0.02, { gain: 0.4 });
      this.later(bed, ruinsBell, randomBetween(60, 120));
    };
    this.later(bed, ruinsBell, randomBetween(60, 120));
  }

  private later(bed: Bed, callback: () => void, seconds: number): void {
    const timer = setTimeout(() => {
      const index = bed.timers.indexOf(timer);
      if (index >= 0) bed.timers.splice(index, 1);
      callback();
    }, seconds * 1_000);
    bed.timers.push(timer);
  }

  private dispose(bed: Bed): void {
    for (const source of bed.sources) {
      try {
        source.stop();
      } catch {
        // One-shot wildlife often ends before its bed is replaced.
      }
    }
    bed.sources.length = 0;
    bed.gain.disconnect();
  }
}

function randomBetween(minimum: number, maximum: number): number {
  return minimum + Math.random() * (maximum - minimum);
}
