/** Reusable Game Boy Color-style voices for live and offline audio graphs. */
import type { Duty, VoiceSettings } from './songs';

const pulseWaves = new WeakMap<object, Map<Duty, PeriodicWave>>();
const waveWaves = new WeakMap<object, PeriodicWave>();
const noiseBuffers = new WeakMap<object, AudioBuffer>();

export interface VoiceOptions {
  gain: number;
  duty?: Duty;
  attack?: number;
  detune?: number;
}

export function pulseWave(context: BaseAudioContext, duty: Duty): PeriodicWave {
  let waves = pulseWaves.get(context);
  if (!waves) {
    waves = new Map();
    pulseWaves.set(context, waves);
  }
  const cached = waves.get(duty);
  if (cached) return cached;

  const real = new Float32Array(33);
  const imag = new Float32Array(33);
  real[0] = 2 * duty - 1;
  for (let harmonic = 1; harmonic <= 32; harmonic += 1) {
    real[harmonic] = 2 * Math.sin(2 * Math.PI * harmonic * duty) / (Math.PI * harmonic);
    imag[harmonic] = 2 * (1 - Math.cos(2 * Math.PI * harmonic * duty)) / (Math.PI * harmonic);
  }
  const wave = context.createPeriodicWave(real, imag, { disableNormalization: true });
  waves.set(duty, wave);
  return wave;
}

export function wavePeriodic(context: BaseAudioContext): PeriodicWave {
  const cached = waveWaves.get(context);
  if (cached) return cached;
  const real = new Float32Array(32);
  const imag = new Float32Array(32);
  for (let index = 0; index < 16; index += 1) {
    const harmonic = index * 2 + 1;
    const coefficient = 8 / (Math.PI ** 2 * harmonic ** 2);
    imag[harmonic] = (index % 2 === 0 ? 1 : -1) * coefficient;
  }
  const wave = context.createPeriodicWave(real, imag, { disableNormalization: true });
  waveWaves.set(context, wave);
  return wave;
}

export function noiseBuffer(context: BaseAudioContext): AudioBuffer {
  const cached = noiseBuffers.get(context);
  if (cached) return cached;
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
  noiseBuffers.set(context, buffer);
  return buffer;
}

export function playPulse(
  context: BaseAudioContext,
  destination: AudioNode,
  frequency: number,
  start: number,
  duration: number,
  options: VoiceOptions,
): OscillatorNode {
  const oscillator = context.createOscillator();
  oscillator.setPeriodicWave(pulseWave(context, options.duty ?? 0.25));
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.detune.setValueAtTime(options.detune ?? 0, start);
  const release = 0.04;
  const envelope = noteEnvelope(context, destination, start, duration, options.attack ?? 0.005, release, options.gain);
  oscillator.connect(envelope);

  if (duration > 0.4) {
    const vibrato = context.createOscillator();
    const depth = context.createGain();
    vibrato.frequency.value = 5.5;
    depth.gain.setValueAtTime(0, start);
    depth.gain.linearRampToValueAtTime(6, start + 0.28);
    vibrato.connect(depth).connect(oscillator.detune);
    vibrato.start(start);
    vibrato.stop(start + duration + release);
  }
  oscillator.start(start);
  oscillator.stop(start + duration + release);
  return oscillator;
}

export function playWave(
  context: BaseAudioContext,
  destination: AudioNode,
  frequency: number,
  start: number,
  duration: number,
  options: VoiceOptions,
): OscillatorNode {
  const oscillator = context.createOscillator();
  oscillator.setPeriodicWave(wavePeriodic(context));
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.detune.setValueAtTime(options.detune ?? 0, start);
  oscillator.connect(noteEnvelope(context, destination, start, duration, options.attack ?? 0.005, 0.08, options.gain));
  oscillator.start(start);
  oscillator.stop(start + duration + 0.08);
  return oscillator;
}

export function playDrum(
  context: BaseAudioContext,
  destination: AudioNode,
  kind: 'x' | 'o',
  start: number,
  gain: number,
): AudioBufferSourceNode {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context);
  const filter = context.createBiquadFilter();
  filter.type = kind === 'x' ? 'highpass' : 'lowpass';
  filter.frequency.value = kind === 'x' ? 7_000 : 180;
  const duration = kind === 'x' ? 0.03 : 0.09;
  source.connect(filter).connect(noteEnvelope(context, destination, start, duration, 0.002, 0.01, gain));
  source.start(start);
  source.stop(start + duration + 0.02);
  return source;
}

export function playVoice(
  context: BaseAudioContext,
  destination: AudioNode,
  value: string,
  frequency: number,
  start: number,
  duration: number,
  settings: VoiceSettings,
): AudioScheduledSourceNode {
  if (settings.kind === 'noise') return playDrum(context, destination, value as 'x' | 'o', start, settings.gain);
  const options = { gain: settings.gain, duty: settings.duty, attack: settings.attack };
  return settings.kind === 'pulse'
    ? playPulse(context, destination, frequency, start, duration, options)
    : playWave(context, destination, frequency, start, duration, options);
}

function noteEnvelope(
  context: BaseAudioContext,
  destination: AudioNode,
  start: number,
  duration: number,
  attack: number,
  release: number,
  gain: number,
): GainNode {
  const envelope = context.createGain();
  const attackEnd = start + Math.min(attack, duration * 0.5);
  const holdEnd = start + duration;
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(gain, attackEnd);
  envelope.gain.setValueAtTime(gain, holdEnd);
  envelope.gain.linearRampToValueAtTime(0, holdEnd + release);
  envelope.connect(destination);
  return envelope;
}
