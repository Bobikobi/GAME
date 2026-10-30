/** Runtime-synthesized interactions, feedback cues, and distant-world sounds. */
import { noiseBuffer, playPulse } from './synth';

export type SfxId =
  | 'strike' | 'crack' | 'snap' | 'tug' | 'rustle' | 'pluck' | 'dig' | 'thud' | 'douse'
  | 'hammer' | 'sizzle' | 'coin' | 'pickup' | 'ui' | 'back' | 'miss' | 'good'
  | 'perfect' | 'step' | 'whisper' | 'bell' | 'click' | 'voice' | 'growl' | 'safe'
  | 'wings' | 'plop' | 'journal';

export interface SfxOptions {
  pan?: number;
  gain?: number;
  detune?: number;
  /** A low-pass cutoff in Hz: the sound as heard from far off. */
  lowpass?: number;
}

/**
 * Each effect's own level under the call's gain (docs/design/SOUND.md section 1.3): the cues the player earns
 * sit near -17 dBFS at the speaker, under the tune rather than over it; the step is a breath.
 */
const BASE_GAIN: Partial<Record<SfxId, number>> = {
  step: 0.15,
  pickup: 0.55,
  journal: 0.55,
  perfect: 0.5,
  snap: 0.55,
  douse: 0.55,
  sizzle: 0.55,
};

/** Build and start one effect, returning its audible duration in seconds. */
export function playSfx(
  context: BaseAudioContext,
  destination: AudioNode,
  id: SfxId,
  when: number,
  options: SfxOptions = {},
): number {
  const output = context.createGain();
  const panner = context.createStereoPanner();
  output.gain.value = Math.max(0, Math.min(1, options.gain ?? 1)) * (BASE_GAIN[id] ?? 1);
  panner.pan.value = Math.max(-1, Math.min(1, options.pan ?? 0));
  if (options.lowpass !== undefined) {
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = options.lowpass;
    output.connect(filter).connect(panner).connect(destination);
  } else {
    output.connect(panner).connect(destination);
  }
  const detune = options.detune ?? 0;

  switch (id) {
    case 'strike': return strike(context, output, when, detune);
    case 'crack': return crack(context, output, when, detune);
    case 'snap': return snap(context, output, when);
    case 'tug': return tug(context, output, when, detune);
    case 'rustle': return rustle(context, output, when);
    case 'pluck': return pluck(context, output, when, detune);
    case 'dig': return dig(context, output, when, detune);
    case 'thud': return thud(context, output, when, detune);
    case 'hammer': return hammer(context, output, when, detune);
    case 'sizzle': return sizzle(context, output, when);
    case 'douse': return douse(context, output, when);
    case 'coin': return coin(context, output, when, detune);
    case 'pickup': return arpeggio(context, output, when, [659.25, 830.61, 987.77], 0.04, detune);
    case 'journal': return journal(context, output, when, detune);
    case 'ui': return pulseBlip(context, output, when, 1_046.5, 0.03, detune);
    case 'back': return pulseBlip(context, output, when, 783.99, 0.03, detune);
    case 'miss': return miss(context, output, when, detune);
    case 'good': return pulseBlip(context, output, when, 1_174.66, 0.09, detune);
    case 'perfect': return arpeggio(context, output, when, [1_046.5, 1_318.51, 1_567.98], 0.035, detune);
    case 'step': return noiseBurst(context, output, when, 0.02, 'bandpass', 1_200, 0.3);
    case 'whisper': return whisper(context, output, when);
    case 'bell': return bell(context, output, when, detune);
    case 'click': return click(context, output, when);
    case 'voice': return playVoice(context, output, when, detune);
    case 'growl': return growl(context, output, when, detune);
    case 'safe': return safe(context, output, when, detune);
    case 'wings': return wings(context, output, when);
    case 'plop': return plop(context, output, when, detune);
  }
}

/** Birds lift: a soft flutter of four wingbeats, quick at first and slowing as they climb away; about half a second. */
function wings(context: BaseAudioContext, out: AudioNode, at: number): number {
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1_600;
  filter.Q.value = 0.7;
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0, at);
  // four beats, each a short swell of air, further apart and fainter as the birds climb
  let t = at;
  for (let i = 0; i < 4; i++) {
    const peak = 0.22 * (1 - i / 6);
    envelope.gain.setValueAtTime(0, t);
    envelope.gain.linearRampToValueAtTime(peak, t + 0.015);
    envelope.gain.linearRampToValueAtTime(0, t + 0.06);
    t += 0.1 + i * 0.02;
  }
  filter.connect(envelope).connect(out);
  noiseSource(context, filter, at, t - at);
  return t - at;
}

/** A fish rises: a small drop into still water, a falling note and a breath of splash. */
function plop(context: BaseAudioContext, out: AudioNode, at: number, detune: number): number {
  const oscillator = context.createOscillator();
  oscillator.type = 'sine';
  oscillator.detune.value = detune;
  oscillator.frequency.setValueAtTime(620, at);
  oscillator.frequency.exponentialRampToValueAtTime(180, at + 0.09);
  oscillator.connect(decay(context, out, at, 0.12, 0.28));
  oscillator.start(at);
  oscillator.stop(at + 0.12);
  const filter = context.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 3_000;
  filter.connect(decay(context, out, at + 0.02, 0.08, 0.06));
  noiseSource(context, filter, at + 0.02, 0.08);
  return 0.14;
}

/** A predator has seen the player: a low growl that rises and sinks, rasping, over a breath of noise. */
function growl(context: BaseAudioContext, out: AudioNode, at: number, detune: number): number {
  const length = 0.75;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 520;
  filter.Q.value = 3;
  // the rasp: the growl's loudness shaken thirty times a second, between a fifth and the whole of it
  const rasp = context.createGain();
  rasp.gain.value = 0.6;
  const shake = context.createOscillator();
  const depth = context.createGain();
  shake.type = 'square';
  shake.frequency.value = 30;
  depth.gain.value = 0.4;
  shake.connect(depth).connect(rasp.gain);
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0, at);
  envelope.gain.linearRampToValueAtTime(0.55, at + 0.08);
  envelope.gain.setValueAtTime(0.55, at + 0.45);
  envelope.gain.linearRampToValueAtTime(0, at + length);
  const voice = context.createOscillator();
  voice.type = 'sawtooth';
  voice.detune.value = detune;
  voice.frequency.setValueAtTime(72, at);
  voice.frequency.linearRampToValueAtTime(94, at + 0.25);
  voice.frequency.linearRampToValueAtTime(60, at + length);
  voice.connect(filter).connect(rasp).connect(envelope).connect(out);
  voice.start(at);
  shake.start(at);
  voice.stop(at + length);
  shake.stop(at + length);
  noiseBurst(context, out, at, 0.55, 'bandpass', 380, 0.12);
  return length;
}

/** Safe ground after a hunt: two soft notes going up, a breath out. */
function safe(context: BaseAudioContext, out: AudioNode, at: number, detune: number): number {
  tone(context, out, at, 0.25, 392, 0.2, 'triangle', detune);
  tone(context, out, at + 0.14, 0.45, 587.33, 0.2, 'triangle', detune);
  return 0.59;
}

/** The dialogue's page-turn: a soft tick, always the same pitch, so a row of them reads as one steady beat. */
function click(context: BaseAudioContext, out: AudioNode, at: number): number {
  noiseBurst(context, out, at, 0.014, 'bandpass', 1_900, 0.22);
  tone(context, out, at, 0.03, 880, 0.12, 'sine', 0);
  return 0.04;
}

/** One syllable of a speaker's gibberish: a short, round pulse; `detune` carries the speaker's pitch. */
function playVoice(context: BaseAudioContext, out: AudioNode, at: number, detune: number): number {
  playPulse(context, out, 330, at, 0.05, { gain: 0.1, duty: 0.5, detune });
  return 0.09;
}

function strike(context: BaseAudioContext, out: AudioNode, at: number, detune: number): number {
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2_800;
  filter.Q.value = 2;
  filter.connect(out);
  tone(context, filter, at, 0.09, 2_350, 0.16, 'square', detune);
  tone(context, filter, at, 0.09, 3_170, 0.1, 'square', detune);
  const tok = context.createOscillator();
  tok.type = 'sine';
  tok.detune.value = detune;
  tok.frequency.setValueAtTime(620, at);
  tok.frequency.exponentialRampToValueAtTime(240, at + 0.06);
  tok.connect(decay(context, out, at, 0.11, 0.28));
  tok.start(at);
  tok.stop(at + 0.12);
  noiseBurst(context, out, at, 0.025, 'bandpass', 1_800, 0.12);
  return 0.12;
}

function crack(context: BaseAudioContext, out: AudioNode, at: number, detune: number): number {
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2_000, at);
  filter.frequency.exponentialRampToValueAtTime(500, at + 0.25);
  filter.connect(decay(context, out, at, 0.25, 0.45));
  noiseSource(context, filter, at, 0.25);
  tone(context, out, at, 0.12, 90, 0.35, 'sine', detune);
  return 0.25;
}

function snap(context: BaseAudioContext, out: AudioNode, at: number): number {
  noiseBurst(context, out, at, 0.015, 'highpass', 2_500, 0.5);
  noiseBurst(context, out, at + 0.035, 0.015, 'highpass', 2_500, 0.25);
  return 0.06;
}

function tug(context: BaseAudioContext, out: AudioNode, at: number, detune: number): number {
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 600;
  filter.connect(out);
  const oscillator = context.createOscillator();
  const wobble = context.createOscillator();
  const depth = context.createGain();
  oscillator.type = 'sawtooth';
  oscillator.frequency.value = 140;
  oscillator.detune.value = detune;
  wobble.frequency.value = 18;
  depth.gain.value = 15;
  wobble.connect(depth).connect(oscillator.frequency);
  oscillator.connect(decay(context, filter, at, 0.18, 0.08));
  oscillator.start(at);
  wobble.start(at);
  oscillator.stop(at + 0.18);
  wobble.stop(at + 0.18);
  return 0.18;
}

function rustle(context: BaseAudioContext, out: AudioNode, at: number): number {
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 4_000;
  filter.Q.value = 0.8;
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0, at);
  envelope.gain.linearRampToValueAtTime(0.25, at + 0.04);
  envelope.gain.linearRampToValueAtTime(0, at + 0.2);
  const wobble = context.createOscillator();
  const depth = context.createGain();
  wobble.frequency.value = 30;
  depth.gain.value = 0.07;
  wobble.connect(depth).connect(envelope.gain);
  filter.connect(envelope).connect(out);
  noiseSource(context, filter, at, 0.2);
  wobble.start(at);
  wobble.stop(at + 0.2);
  return 0.2;
}

function pluck(context: BaseAudioContext, out: AudioNode, at: number, detune: number): number {
  const oscillator = context.createOscillator();
  oscillator.type = 'sine';
  oscillator.detune.value = detune;
  oscillator.frequency.setValueAtTime(880, at);
  oscillator.frequency.exponentialRampToValueAtTime(440, at + 0.05);
  oscillator.connect(decay(context, out, at, 0.08, 0.2));
  oscillator.start(at);
  oscillator.stop(at + 0.08);
  return 0.08;
}

function dig(context: BaseAudioContext, out: AudioNode, at: number, detune: number): number {
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(900, at);
  filter.frequency.exponentialRampToValueAtTime(250, at + 0.14);
  filter.connect(decay(context, out, at, 0.14, 0.32));
  noiseSource(context, filter, at, 0.14);
  tone(context, out, at, 0.06, 180, 0.22, 'sine', detune);
  return 0.14;
}

function thud(context: BaseAudioContext, out: AudioNode, at: number, detune: number): number {
  const oscillator = context.createOscillator();
  oscillator.type = 'sine';
  oscillator.detune.value = detune;
  oscillator.frequency.setValueAtTime(110, at);
  oscillator.frequency.exponentialRampToValueAtTime(55, at + 0.12);
  oscillator.connect(decay(context, out, at, 0.18, 0.5));
  oscillator.start(at);
  oscillator.stop(at + 0.18);
  noiseBurst(context, out, at, 0.14, 'lowpass', 300, 0.25);
  return 0.18;
}

function hammer(context: BaseAudioContext, out: AudioNode, at: number, detune: number): number {
  const oscillator = context.createOscillator();
  oscillator.type = 'triangle';
  oscillator.detune.value = detune;
  oscillator.frequency.setValueAtTime(520, at);
  oscillator.frequency.exponentialRampToValueAtTime(300, at + 0.04);
  oscillator.connect(decay(context, out, at, 0.09, 0.36));
  oscillator.start(at);
  oscillator.stop(at + 0.09);
  noiseBurst(context, out, at, 0.01, 'bandpass', 1_500, 0.15);
  return 0.09;
}

function sizzle(context: BaseAudioContext, out: AudioNode, at: number): number {
  const filter = context.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 3_000;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.05, at);
  for (let time = 0; time < 0.35; time += 0.025) {
    gain.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.22, at + time);
  }
  gain.gain.linearRampToValueAtTime(0, at + 0.35);
  filter.connect(gain).connect(out);
  noiseSource(context, filter, at, 0.35);
  return 0.35;
}

/** A fire going out: a hiss that sinks and thins over a soft low drop. */
function douse(context: BaseAudioContext, out: AudioNode, at: number): number {
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(2_600, at);
  filter.frequency.exponentialRampToValueAtTime(350, at + 0.47);
  filter.connect(decay(context, out, at, 0.5, 0.32));
  noiseSource(context, filter, at, 0.5);
  const low = context.createOscillator();
  low.type = 'sine';
  low.frequency.setValueAtTime(140, at);
  low.frequency.exponentialRampToValueAtTime(60, at + 0.3);
  low.connect(decay(context, out, at, 0.3, 0.3));
  low.start(at);
  low.stop(at + 0.3);
  return 0.5;
}

/** A first-of-kind item reaches the journal: the pickup's three notes and a page's soft tick after them. */
function journal(context: BaseAudioContext, out: AudioNode, at: number, detune: number): number {
  arpeggio(context, out, at, [659.25, 830.61, 987.77], 0.04, detune);
  noiseBurst(context, out, at + 0.13, 0.03, 'bandpass', 1_900, 0.2);
  return 0.2;
}

function coin(context: BaseAudioContext, out: AudioNode, at: number, detune: number): number {
  tone(context, out, at, 0.07, 987.77, 0.18, 'square', detune);
  tone(context, out, at + 0.07, 0.18, 1_318.51, 0.16, 'square', detune);
  return 0.25;
}

function miss(context: BaseAudioContext, out: AudioNode, at: number, detune: number): number {
  const oscillator = context.createOscillator();
  oscillator.type = 'square';
  oscillator.detune.value = detune;
  oscillator.frequency.setValueAtTime(220, at);
  oscillator.frequency.exponentialRampToValueAtTime(150, at + 0.16);
  oscillator.connect(decay(context, out, at, 0.16, 0.16));
  oscillator.start(at);
  oscillator.stop(at + 0.16);
  return 0.16;
}

function whisper(context: BaseAudioContext, out: AudioNode, at: number): number {
  for (const [from, to] of [[600, 1_800], [1_800, 600]] as const) {
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 6;
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(to, at + 1.5);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(0.16, at + 0.5);
    envelope.gain.setValueAtTime(0.16, at + 0.8);
    envelope.gain.linearRampToValueAtTime(0, at + 1.5);
    filter.connect(envelope).connect(out);
    noiseSource(context, filter, at, 1.5);
  }
  return 1.5;
}

function bell(context: BaseAudioContext, out: AudioNode, at: number, detune: number): number {
  const wet = context.createGain();
  const delay = context.createDelay(0.4);
  const feedback = context.createGain();
  wet.gain.value = 0.3;
  delay.delayTime.value = 0.33;
  feedback.gain.value = 0.35;
  feedback.gain.setValueAtTime(0.35, at);
  feedback.gain.linearRampToValueAtTime(0, at + 3);
  wet.gain.setValueAtTime(0.3, at);
  wet.gain.linearRampToValueAtTime(0, at + 3);
  delay.connect(feedback).connect(delay);
  delay.connect(wet).connect(out);
  const partials = [
    [1, 0.38, 3],
    [2.76, 0.18, 1.8],
    [5.4, 0.1, 1.1],
    [8.93, 0.06, 0.6],
  ] as const;
  for (const [multiple, gain, duration] of partials) {
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 110 * multiple;
    oscillator.detune.value = detune;
    const envelope = decay(context, out, at, duration, gain);
    oscillator.connect(envelope);
    envelope.connect(delay);
    oscillator.start(at);
    oscillator.stop(at + duration);
  }
  return 3;
}

function arpeggio(
  context: BaseAudioContext,
  out: AudioNode,
  at: number,
  frequencies: readonly number[],
  noteLength: number,
  detune: number,
): number {
  frequencies.forEach((frequency, index) => {
    playPulse(context, out, frequency, at + index * noteLength, noteLength, { gain: 0.2, duty: 0.25, detune });
  });
  return frequencies.length * noteLength + 0.04;
}

function pulseBlip(
  context: BaseAudioContext,
  out: AudioNode,
  at: number,
  frequency: number,
  duration: number,
  detune: number,
): number {
  playPulse(context, out, frequency, at, duration, { gain: 0.18, duty: 0.25, detune });
  return duration + 0.04;
}

function tone(
  context: BaseAudioContext,
  out: AudioNode,
  at: number,
  duration: number,
  frequency: number,
  gain: number,
  type: OscillatorType,
  detune: number,
): OscillatorNode {
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  oscillator.detune.value = detune;
  oscillator.connect(decay(context, out, at, duration, gain));
  oscillator.start(at);
  oscillator.stop(at + duration);
  return oscillator;
}

function noiseBurst(
  context: BaseAudioContext,
  out: AudioNode,
  at: number,
  duration: number,
  type: BiquadFilterType,
  frequency: number,
  gain: number,
): number {
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.connect(decay(context, out, at, duration, gain));
  noiseSource(context, filter, at, duration);
  return duration;
}

function noiseSource(context: BaseAudioContext, out: AudioNode, at: number, duration: number): AudioBufferSourceNode {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context);
  source.loop = duration > 1;
  source.connect(out);
  source.start(at);
  source.stop(at + duration);
  return source;
}

function decay(context: BaseAudioContext, out: AudioNode, at: number, duration: number, gain: number): GainNode {
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(gain, at);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  envelope.connect(out);
  return envelope;
}
