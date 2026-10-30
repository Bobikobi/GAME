/**
 * The synth's voices for the music by state (SOUND.md section 5, listen B pushed as far as the synth goes): a
 * recorder, a reed and a horn, plucked strings, a pad and strings, a bass, a bell and drums, all oscillators and
 * noise, with one filter per part shared by all its notes. The same voices rendered round 2's B files.
 */
import type { Ev } from './pieces';

const hz = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** Two seconds of white noise, the same every time, for the breath and the drums. */
export function noise(ctx: BaseAudioContext): AudioBuffer {
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = b.getChannelData(0);
  let r = 0.123;
  for (let i = 0; i < d.length; i++) {
    r = ((r * 9301 + 49297) % 233280) / 233280;
    d[i] = r * 2 - 1;
  }
  return b;
}

/** A small room: a decaying noise tail, the same every time, mixed under the dry sound. */
export function room(ctx: BaseAudioContext, dest: AudioNode, wet: number, seconds = 2.2): AudioNode {
  const input = ctx.createGain();
  const conv = ctx.createConvolver();
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const ir = ctx.createBuffer(2, len, rate);
  let r = 0.77;
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) {
      r = ((r * 9301 + 49297) % 233280) / 233280;
      d[i] = (r * 2 - 1) * Math.exp(-i / (rate * seconds * 0.22));
    }
  }
  conv.buffer = ir;
  const w = ctx.createGain();
  w.gain.value = wet;
  input.connect(dest);
  input.connect(conv).connect(w).connect(dest);
  return input;
}

function env(ctx: BaseAudioContext, out: AudioNode, t: number, a: number, peak: number, hold: number, rel: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + Math.max(a, hold));
  g.gain.linearRampToValueAtTime(0, t + Math.max(a, hold) + rel);
  g.connect(out);
  return g;
}

function osc(ctx: BaseAudioContext, type: OscillatorType, f: number, t: number, end: number, out: AudioNode, detune = 0, wobble?: AudioNode): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.detune.value = detune;
  if (wobble) wobble.connect(o.detune);
  o.connect(out);
  o.start(t);
  o.stop(end);
  return o;
}

/** One filter per part, shared by all its notes: a game pays for a part's colour once, not once a note. */
export function partBuses(ctx: BaseAudioContext, out: AudioNode): (part: string) => AudioNode {
  const made = new Map<string, AudioNode>();
  const filt = (type: BiquadFilterType, f: number, q = 0.7): AudioNode => {
    const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(out); return b;
  };
  const spec: Record<string, () => AudioNode> = {
    breath: () => filt('bandpass', 1_800, 2),
    counter: () => filt('lowpass', 1_400),
    horn: () => filt('lowpass', 1_500),
    pad: () => filt('lowpass', 900),
    strings: () => filt('lowpass', 2_200),
    stab: () => filt('lowpass', 2_500),
    hat: () => filt('highpass', 7_000),
    snare: () => filt('bandpass', 2_400),
    rim: () => filt('bandpass', 1_800, 6),
    drumlow: () => filt('lowpass', 500),
  };
  return (part) => {
    if (!spec[part]) return out;
    if (!made.has(part)) made.set(part, spec[part]!());
    return made.get(part)!;
  };
}

export function synthVoice(ctx: BaseAudioContext, out: AudioNode, bus: (part: string) => AudioNode, e: Ev, t: number, d: number, nb: AudioBuffer, wobble: AudioNode): void {
  const f = hz(e.n);
  const v = e.v;
  const decayGain = (dest: AudioNode, peak: number, ring: number): GainNode => {
    const g = ctx.createGain(); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + ring); g.connect(dest); return g;
  };
  switch (e.part) {
    case 'lead': { // a recorder: a sine with a breath of triangle, a slow vibrato and air
      const g = env(ctx, out, t, 0.04, 0.11 * v, d, 0.12);
      const o = osc(ctx, 'sine', f, t, t + d + 0.15, g, 0, wobble);
      osc(ctx, 'triangle', f, t, t + d + 0.15, env(ctx, g, t, 0.04, 0.35, d, 0.1), 0, wobble);
      if (d > 0.4) {
        const lfo = ctx.createOscillator(); const dep = ctx.createGain();
        lfo.frequency.value = 5; dep.gain.setValueAtTime(0, t); dep.gain.linearRampToValueAtTime(12, t + 0.35);
        lfo.connect(dep).connect(o.detune); lfo.start(t); lfo.stop(t + d + 0.15);
        const s = ctx.createBufferSource(); s.buffer = nb;
        s.connect(env(ctx, bus('breath'), t, 0.02, 0.012 * v, d * 0.5, 0.1)); s.start(t, Math.random()); s.stop(t + d + 0.15);
      }
      return;
    }
    case 'counter': case 'horn': { // a soft reed, or a horn: two saws a hair apart behind the part's low-pass
      const g = env(ctx, bus(e.part), t, e.part === 'horn' ? 0.08 : 0.06, (e.part === 'horn' ? 0.09 : 0.075) * v, d, 0.15);
      osc(ctx, 'sawtooth', f, t, t + d + 0.2, g, -5, wobble);
      osc(ctx, 'sawtooth', f, t, t + d + 0.2, g, 5, wobble);
      return;
    }
    case 'lute': case 'pluck': case 'pizz': case 'harp': { // a plucked string: a bright saw that dies fast over a rounder body that rings
      const ring = e.part === 'harp' ? 1.6 : e.part === 'pizz' ? 0.25 : e.part === 'pluck' ? 1.0 : 0.7;
      const peak = (e.part === 'harp' ? 0.07 : e.part === 'pluck' ? 0.11 : 0.07) * v;
      osc(ctx, 'triangle', f, t, t + ring, decayGain(out, peak, ring), 0, wobble);
      if (e.part !== 'harp') osc(ctx, 'sawtooth', f, t, t + 0.2, decayGain(out, peak * 0.35, 0.18), 0, wobble);
      return;
    }
    case 'pad': case 'strings': { // detuned saws behind the part's low-pass, swelling
      const g = env(ctx, bus(e.part), t, e.part === 'strings' ? 0.03 : 0.8, (e.part === 'strings' ? 0.06 : 0.04) * v, d, e.part === 'strings' ? 0.1 : 0.9);
      for (const dt of [-7, 7]) osc(ctx, 'sawtooth', f, t, t + d + 1, g, dt, wobble);
      return;
    }
    case 'stab': {
      const g = decayGain(bus('stab'), 0.07 * v, d + 0.1);
      for (const dt of [-6, 6]) osc(ctx, 'sawtooth', f, t, t + d + 0.1, g, dt);
      return;
    }
    case 'bass': {
      const g = env(ctx, out, t, 0.01, 0.17 * v, d * 0.9, 0.12);
      osc(ctx, 'triangle', f, t, t + d + 0.15, g);
      osc(ctx, 'sine', f / 2, t, t + d + 0.15, env(ctx, g, t, 0.01, 0.5, d, 0.1));
      return;
    }
    case 'bell': {
      for (const [m, a, r] of [[1, 0.05, 2.5], [2.76, 0.02, 1.4], [5.4, 0.01, 0.8]] as const) osc(ctx, 'sine', f * m, t, t + r, decayGain(out, a * v, r));
      return;
    }
    case 'kick': case 'taiko': {
      const big = e.part === 'taiko';
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(big ? 95 : 120, t); o.frequency.exponentialRampToValueAtTime(big ? 48 : 45, t + (big ? 0.25 : 0.12));
      o.connect(decayGain(out, (big ? 0.55 : 0.45) * v, big ? 0.6 : 0.3)); o.start(t); o.stop(t + 0.7);
      if (big) { const s = ctx.createBufferSource(); s.buffer = nb; s.connect(decayGain(bus('drumlow'), 0.2 * v, 0.25)); s.start(t, Math.random()); s.stop(t + 0.3); }
      return;
    }
    case 'snare': case 'rim': case 'hat': {
      const peak = (e.part === 'hat' ? 0.05 : e.part === 'rim' ? 0.2 : 0.14) * v;
      const dur = e.part === 'hat' ? 0.03 : e.part === 'rim' ? 0.04 : 0.14;
      const s = ctx.createBufferSource(); s.buffer = nb;
      s.connect(decayGain(bus(e.part), peak, dur)); s.start(t, Math.random()); s.stop(t + dur + 0.01);
      return;
    }
  }
}

// ---- the sampled instruments (FluidR3_GM, CC BY 3.0) -------------------------------------------------

