/** Sound by position: the falloff never rises with distance, a voice keeps its pitch, the places sound where they stand. */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, campTile, newState } from '@game/kernel';
import { falloff, panFor, voicePitch } from '../src/audio/spatial';
import { CRACKLE_RANGE, DREAD_RANGE, FIRE_RANGE, STREAM_RANGE, soundscape } from '../src/soundscape';
import { loadBundle } from '../../tools/test/helpers/world';

describe('falloff', () => {
  test('is 1 inside the near ring and 0 beyond the far one', () => {
    expect(falloff(0, 2, 10)).toBe(1);
    expect(falloff(2, 2, 10)).toBe(1);
    expect(falloff(10, 2, 10)).toBe(0);
    expect(falloff(50, 2, 10)).toBe(0);
  });

  test('never rises as the distance grows', () => {
    let last = 1;
    for (let d = 0; d <= 14; d += 0.25) {
      const level = falloff(d, 2, 10);
      expect(level).toBeLessThanOrEqual(last);
      expect(level).toBeGreaterThanOrEqual(0);
      last = level;
    }
  });

  test('pan follows the side of the source and stays in one ear at most 0.7', () => {
    expect(panFor(-20, 10)).toBeCloseTo(-0.7);
    expect(panFor(20, 10)).toBeCloseTo(0.7);
    expect(panFor(0, 10)).toBe(0);
  });
});

describe('voicePitch', () => {
  test('is the same every time and is not the same for everyone', () => {
    expect(voicePitch('Marta')).toBe(voicePitch('Marta'));
    const pitches = new Set(['Marta', 'Odo', 'Pell', 'Wren', 'Tobin', 'Iska', 'Joss', 'Hale'].map(voicePitch));
    expect(pitches.size).toBeGreaterThan(2);
  });
});

describe('soundscape', () => {
  let b: Bundle;
  beforeAll(() => {
    b = loadBundle();
  });

  const withFire = () => {
    const state = newState(b, 1);
    const id = Object.entries(b.camps).find(([, c]) => c.slot === 'fire')![0];
    state.player.camp = [id];
    return state;
  };

  test('the campfire is silent until built, then falls off with distance', () => {
    const fire = campTile(b, 'fire')!;
    const [fx, fy] = [fire[0] + 0.5, fire[1] + 0.5];
    expect(soundscape(b, newState(b, 1), 0, fx, fy).fire.level).toBe(0);
    const built = withFire();
    let last = 2;
    for (let d = 0; d <= FIRE_RANGE[1] + 2; d += 0.5) {
      const level = soundscape(b, built, 0, fx + d, fy).fire.level;
      expect(level).toBeLessThanOrEqual(last);
      last = level;
    }
    expect(soundscape(b, built, 0, fx, fy).fire.level).toBe(1);
    expect(soundscape(b, built, 0, fx + FIRE_RANGE[1], fy).fire.level).toBe(0);
  });

  test('the stream is loudest at the water and gone far from it', () => {
    let wet: [number, number] | undefined;
    for (let y = 0; y < b.map.height && !wet; y += 1) {
      for (let x = 0; x < b.map.width; x += 1) {
        if (b.map.legend[b.map.ground[y]![x]!]?.tag === 'water') {
          wet = [x, y];
          break;
        }
      }
    }
    const state = newState(b, 1);
    expect(soundscape(b, state, 0, wet![0] + 0.5, wet![1] + 0.5).stream.level).toBe(1);
    const far = soundscape(b, state, 0, 44, 33);
    expect(far.stream.level).toBeLessThan(0.01);
    expect(STREAM_RANGE[0]).toBeLessThan(STREAM_RANGE[1]);
  });

  test('dread gathers on unsafe ruin ground, more by night, and never on safe ground', () => {
    const state = newState(b, 1);
    const deep = b.map.slots.find((s) => s.id === 'core/ruins-deep')!;
    const [x, y] = [deep.x + deep.w / 2, deep.y + deep.h / 2];
    const night = b.params.day_length_ms / 2;
    const day = 0;
    const byDay = soundscape(b, state, day, x, y).dread.level;
    const byNight = soundscape(b, state, night, x, y).dread.level;
    expect(byNight).toBeGreaterThan(byDay);
    expect(byDay).toBeGreaterThan(0);
    const square = b.map.slots.find((s) => s.id === 'core/town-square')!;
    expect(soundscape(b, state, night, square.x + 1, square.y + 1).dread.level).toBe(0);
    expect(DREAD_RANGE[1]).toBeGreaterThan(DREAD_RANGE[0]);
  });

  test('a burning fire crackles within six tiles of it, louder nearer, and is silent once out (6b)', () => {
    const hearth = b.map.props.find((p) => p.id === 'core/elder-hearth')!;
    const [cx, cy] = [hearth.x + hearth.w / 2, hearth.y + hearth.h / 2];
    const state = newState(b, 1);
    // never lit: silent beside it
    expect(soundscape(b, state, 0, cx, cy).crackle.level).toBe(0);
    state.player.fires['core/elder-hearth'] = { lit: 0, until: 100_000 };
    expect(soundscape(b, state, 0, cx, cy).crackle.level).toBe(1);
    expect(soundscape(b, state, 0, cx + 1, cy).crackle.level).toBe(1);
    let last = 2;
    for (let d = 0; d <= CRACKLE_RANGE[1] + 2; d += 0.5) {
      const level = soundscape(b, state, 50_000, cx + d, cy).crackle.level;
      expect(level).toBeLessThanOrEqual(last);
      last = level;
    }
    const mid = soundscape(b, state, 0, cx + 3, cy).crackle;
    expect(mid.level).toBeGreaterThan(0);
    expect(mid.level).toBeLessThan(1);
    // the fire on the left is heard on the left
    expect(mid.pan).toBeLessThan(0);
    expect(soundscape(b, state, 0, cx, cy + 6).crackle.level).toBe(0);
    expect(soundscape(b, state, 0, cx - 7, cy).crackle.level).toBe(0);
    // out at its until: silent beside it
    expect(soundscape(b, state, 99_999, cx, cy).crackle.level).toBe(1);
    expect(soundscape(b, state, 100_000, cx, cy).crackle.level).toBe(0);
    expect(CRACKLE_RANGE).toEqual([1.5, 6]);
  });

  test("a fire of the player's own crackles on its tile while it burns, and not once out (NEXT 21b)", () => {
    const state = newState(b, 1);
    const [cx, cy] = [27.5, 16.5];
    expect(soundscape(b, state, 0, cx, cy).crackle.level).toBe(0);
    state.player.own = { at: [27, 16], lit: 0, until: 100_000, log: 66_666 };
    expect(soundscape(b, state, 0, cx, cy).crackle.level).toBe(1);
    expect(soundscape(b, state, 0, cx + 3, cy).crackle.level).toBeGreaterThan(0);
    expect(soundscape(b, state, 100_000, cx, cy).crackle.level).toBe(0);
  });
});
