/** The crackle of a burning fire (6b): rendered once, played only while heard, and nothing left running once it is quiet. */
import { afterEach, describe, expect, test, vi } from 'vitest';

import { Crackle, crackleBuffers } from '../../src/audio/crackle';

class FakeParam {
  value = 0;
  readonly targets: { value: number; at: number; constant: number }[] = [];

  setTargetAtTime(value: number, at: number, constant: number): this {
    this.targets.push({ value, at, constant });
    return this;
  }
}

class FakeNode {
  readonly outputs: FakeNode[] = [];
  disconnected = false;

  connect<T extends FakeNode>(node: T): T {
    this.outputs.push(node);
    return node;
  }

  disconnect(): void {
    this.disconnected = true;
    this.outputs.length = 0;
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}

class FakePanner extends FakeNode {
  readonly pan = new FakeParam();
}

class FakeBuffer {
  private readonly data: Float32Array;

  constructor(
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.data = new Float32Array(length);
  }

  get duration(): number {
    return this.length / this.sampleRate;
  }

  getChannelData(): Float32Array {
    return this.data;
  }
}

class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  loop = false;
  onended: (() => void) | null = null;
  started: { at: number; offset: number } | undefined;
  stopped: number | undefined;

  start(at: number, offset: number): void {
    this.started = { at, offset };
  }

  stop(at: number): void {
    this.stopped = at;
  }

  /** What the audio clock does once a stopped source has played to its stop. */
  end(): void {
    this.onended?.();
  }
}

class FakeContext {
  currentTime = 10;
  readonly sampleRate = 8000;
  readonly gains: FakeGain[] = [];
  readonly panners: FakePanner[] = [];
  readonly sources: FakeSource[] = [];
  buffersMade = 0;

  createGain(): FakeGain {
    const node = new FakeGain();
    this.gains.push(node);
    return node;
  }

  createStereoPanner(): FakePanner {
    const node = new FakePanner();
    this.panners.push(node);
    return node;
  }

  createBufferSource(): FakeSource {
    const node = new FakeSource();
    this.sources.push(node);
    return node;
  }

  createBuffer(_channels: number, length: number, rate: number): FakeBuffer {
    this.buffersMade += 1;
    return new FakeBuffer(length, rate);
  }
}

function crackleOn(): { context: FakeContext; bus: FakeNode; crackle: Crackle } {
  const context = new FakeContext();
  const bus = new FakeNode();
  const crackle = new Crackle(context as unknown as BaseAudioContext, bus as unknown as AudioNode);
  return { context, bus, crackle };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('the crackle', () => {
  test('is rendered once for a context: two loops that never line up, bounded, never silent', () => {
    const context = new FakeContext();
    const buffers = crackleBuffers(context as unknown as BaseAudioContext);
    expect(crackleBuffers(context as unknown as BaseAudioContext)).toBe(buffers);
    expect(context.buffersMade).toBe(2);
    expect(buffers.map((buffer) => buffer.duration)).toEqual([1.9, 2.7]);
    for (const buffer of buffers) {
      const data = buffer.getChannelData(0);
      let peak = 0;
      for (const sample of data) peak = Math.max(peak, Math.abs(sample));
      expect(peak).toBeGreaterThan(0.1);
      expect(peak).toBeLessThanOrEqual(1);
    }
  });

  test('holds no node while silent', () => {
    const { context, crackle } = crackleOn();
    crackle.set(0);
    crackle.set(-1, 0.5);
    expect(context.gains).toHaveLength(0);
    expect(context.sources).toHaveLength(0);
  });

  test('a level above 0 starts two looping sources through a gain and a pan into the bus, and glides there', () => {
    const { context, bus, crackle } = crackleOn();
    crackle.set(0.5, -0.4);
    const [gain] = context.gains;
    const [pan] = context.panners;
    expect(context.sources).toHaveLength(2);
    for (const source of context.sources) {
      expect(source.loop).toBe(true);
      expect(source.outputs).toEqual([gain]);
      expect(source.started!.at).toBe(10);
      expect(source.started!.offset).toBeGreaterThanOrEqual(0);
      expect(source.started!.offset).toBeLessThan(source.buffer!.duration);
    }
    expect(gain!.outputs).toEqual([pan]);
    expect(pan!.outputs).toEqual([bus]);
    // it starts at nothing and glides to the level, as the place's other sounds do
    expect(gain!.gain.value).toBe(0);
    const half = gain!.gain.targets.at(-1)!;
    expect(half.at).toBe(10);
    expect(half.value).toBeGreaterThan(0);
    expect(pan!.pan.targets.at(-1)!.value).toBeCloseTo(-0.4);
    // a new level moves the same voice: louder nearer, no new nodes
    crackle.set(1, 2);
    expect(context.sources).toHaveLength(2);
    expect(gain!.gain.targets.at(-1)!.value).toBeCloseTo(half.value * 2);
    expect(pan!.pan.targets.at(-1)!.value).toBe(1);
  });

  test('a level of 0 fades it, stops its sources on the audio clock, and lets go of every node as they end', () => {
    vi.useFakeTimers();
    const { context, crackle } = crackleOn();
    crackle.set(0.6);
    context.currentTime = 12;
    crackle.set(0);
    const [gain] = context.gains;
    const [pan] = context.panners;
    expect(gain!.gain.targets.at(-1)).toMatchObject({ value: 0, at: 12 });
    for (const source of context.sources) expect(source.stopped).toBeCloseTo(12.6);
    // no timer waits to clean up: the sources' own end does it
    expect(vi.getTimerCount()).toBe(0);
    // quiet again: a second 0 does nothing
    crackle.set(0);
    expect(context.sources.filter((s) => s.stopped !== undefined)).toHaveLength(2);
    context.sources[0]!.end();
    expect(context.sources[0]!.disconnected).toBe(true);
    expect(gain!.disconnected).toBe(false);
    context.sources[1]!.end();
    expect(context.sources[1]!.disconnected).toBe(true);
    expect(gain!.disconnected).toBe(true);
    expect(pan!.disconnected).toBe(true);
  });

  test('heard again after it went quiet, it is a new voice; the old one still goes', () => {
    const { context, crackle } = crackleOn();
    crackle.set(0.5);
    crackle.set(0);
    crackle.set(0.3);
    expect(context.gains).toHaveLength(2);
    expect(context.sources).toHaveLength(4);
    expect(context.sources.slice(0, 2).every((s) => s.stopped !== undefined)).toBe(true);
    expect(context.sources.slice(2).every((s) => s.stopped === undefined)).toBe(true);
  });
});
