/**
 * The bridge's moment, the parts that are not the mist (NEXT 16 d): the far bell (criterion 5) and the
 * town's smoke at the view's edge (criterion 9).
 */
import { describe, expect, test } from 'vitest';

import { FAR_BELL, THRESHOLD_BELL_GAIN, farBellDue, nearestChimney, smokeAlpha, smokeAt } from '../src/hookbridge';
import { playSfx } from '../src/audio/sfx';

describe('the far bell (criterion 5)', () => {
  test('rings for the first mend a save has had, and not before it, on a reload, or for a second mend', () => {
    expect(farBellDue([], 'core/old-bridge')).toBe(false);
    expect(farBellDue(['core/old-bridge'], 'core/old-bridge')).toBe(true);
    expect(farBellDue(['core/old-bridge', 'core/arch-way'], 'core/arch-way')).toBe(false);
    expect(farBellDue(['core/arch-way'], 'core/old-bridge')).toBe(false);
  });

  test("is quieter than the threshold's bell and low-passed", () => {
    expect(FAR_BELL.gain).toBeLessThan(THRESHOLD_BELL_GAIN);
    expect(FAR_BELL.lowpass).toBeLessThan(2000);
  });

  test('the low-pass goes between the sound and the destination only when asked', () => {
    const made: string[] = [];
    interface Fake {
      [k: string]: unknown;
    }
    const noop = (): void => undefined;
    const param = (): Fake => ({ value: 0, setValueAtTime: noop, linearRampToValueAtTime: noop, exponentialRampToValueAtTime: noop });
    const node = (name: string): Fake => {
      made.push(name);
      const n: Fake = { gain: param(), pan: param(), frequency: param(), Q: param(), detune: param(), delayTime: param(), start: noop, stop: noop };
      n.connect = (to: Fake): Fake => to;
      return n;
    };
    const ctx = new Proxy({ currentTime: 0, sampleRate: 44100 } as Fake, { get: (t, k: string) => (k in t ? t[k] : () => node(k)) }) as unknown as BaseAudioContext;
    playSfx(ctx, node('dest') as unknown as AudioNode, 'bell', 0, { gain: FAR_BELL.gain, lowpass: FAR_BELL.lowpass });
    expect(made).toContain('createBiquadFilter');
    made.length = 0;
    playSfx(ctx, node('dest') as unknown as AudioNode, 'bell', 0, { gain: 0.4 });
    expect(made).not.toContain('createBiquadFilter');
  });
});

describe('the town smoke marker (criterion 9)', () => {
  const view = { x: 100, y: 100, width: 320, height: 200 };
  test('off screen it sits on the view edge, on the line from the middle toward the chimney', () => {
    const chimney = { x: 900, y: 200 };
    const at = smokeAt(view, chimney, 30);
    expect(at.edge).toBe(true);
    expect(at.x).toBeCloseTo(view.x + view.width - 30, 6);
    expect(at.y).toBeCloseTo(200, 6);
    const north = smokeAt(view, { x: 260, y: -500 }, 30);
    expect(north.y).toBeCloseTo(view.y + 30, 6);
    expect(north.x).toBeCloseTo(260, 6);
  });

  test('it moves with the player: another view puts it elsewhere on the same edge', () => {
    const chimney = { x: 900, y: 400 };
    const a = smokeAt(view, chimney, 30);
    const b = smokeAt({ ...view, y: 160 }, chimney, 30);
    expect(a.edge && b.edge).toBe(true);
    expect(a.y).not.toBe(b.y);
  });

  test('in view it is at the chimney itself', () => {
    expect(smokeAt(view, { x: 250, y: 200 }, 30)).toEqual({ x: 250, y: 200, edge: false });
  });

  test('it dims with the night and never goes out', () => {
    expect(smokeAlpha(1)).toBeLessThan(smokeAlpha(0));
    expect(smokeAlpha(1)).toBeGreaterThan(0.2);
  });

  test('the nearest chimney is the one it points at', () => {
    expect(nearestChimney([{ x: 10, y: 10 }, { x: 500, y: 500 }], { x: 400, y: 400 })).toEqual({ x: 500, y: 500 });
    expect(nearestChimney([], { x: 0, y: 0 })).toBeUndefined();
  });
});
