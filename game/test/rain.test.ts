/**
 * The day's weather as the valley shows it (issue 581): the look a sky gives, and the rain's pixels as the owner
 * picked them on 21.10 (DECISIONS "Rain: the drops fall and land, and the wet world shines").
 */
import { describe, expect, test } from 'vitest';
import type { RegionCardDef } from '@game/schema';
import {
  FOG_DAY_FLOOR,
  LANDING,
  RAIN_HEAD,
  RAIN_LENGTH,
  RAIN_MAX,
  RAIN_RGB,
  RAIN_TAIL,
  bankFog,
  dropsAlive,
  landingsPerSecond,
  markPixels,
  skyLook,
  streakPixels,
  washRgb,
} from '../src/rain';

const card = (rain: number, fog: number): RegionCardDef => ({
  id: 'bay-coast',
  title: 'The bay + south coast',
  weather: { rain: 3500, fog: 2500 },
  look: { rain, fog },
  ambience: { day: 'day', night: 'night' },
});

describe('the look of a day\'s sky', () => {
  test('a clear day and no sky at all leave the valley as it was', () => {
    for (const look of [skyLook('clear', card(1200, 1400)), skyLook(undefined, undefined)]) {
      expect(look).toEqual({ overcast: false, rain: 0, fogFloor: 0, fogScale: 1, wash: false });
      for (const fog of [0, 0.3, 1]) expect(bankFog(fog, look)).toBe(fog);
    }
  });

  test('rain is the whole sky\'s cloud and the cool light, at the card\'s share of the decided drops', () => {
    expect(skyLook('rain', card(1200, 1000))).toEqual({ overcast: true, rain: 1.2, fogFloor: 0, fogScale: 1, wash: true });
    expect(skyLook('rain', undefined).rain).toBe(1);
  });

  test('a fog day keeps the banks all day, at the card\'s weight, and draws nothing new', () => {
    const look = skyLook('fog', card(1000, 1300));
    expect(look.overcast).toBe(true);
    expect(look.wash).toBe(false);
    expect(look.rain).toBe(0);
    expect(bankFog(0, look)).toBeCloseTo(FOG_DAY_FLOOR * 1.3);
    expect(bankFog(1, look)).toBe(1);
  });
});

describe('the rain of 21.10', () => {
  test('about 140 drops over a phone\'s view at the full look, at a card\'s share, and a wide screen is capped', () => {
    // a phone at four screen pixels to the world's: about 97 by 211 world units
    expect(dropsAlive(97 * 211, 1)).toBe(143);
    expect(dropsAlive(97 * 211, 0.5)).toBe(72);
    expect(dropsAlive(97 * 211, 0)).toBe(0);
    expect(dropsAlive(960 * 540, 1)).toBe(RAIN_MAX);
  });

  test('marks land on a surface in proportion to its share of the view', () => {
    expect(landingsPerSecond(256, 0, 100)).toBe(0);
    expect(landingsPerSecond(256, 50, 100)).toBeCloseTo(landingsPerSecond(256, 100, 100) / 2);
  });

  test('the streak is long and one pixel thin, leans with the wind, and fades from its head to its tail', () => {
    const s = streakPixels();
    expect(s.h).toBe(RAIN_LENGTH);
    expect(s.px).toHaveLength(RAIN_LENGTH);
    expect(new Set(s.px.map((p) => p.y)).size).toBe(RAIN_LENGTH);
    expect(s.px.at(-1)!.x).toBeGreaterThan(s.px[0]!.x);
    expect(s.px[0]!.a).toBeCloseTo(RAIN_TAIL);
    expect(s.px.at(-1)!.a).toBeCloseTo(RAIN_HEAD);
    // cooler than the sky is white: blue leads red
    expect(RAIN_RGB & 0xff).toBeGreaterThan(RAIN_RGB >> 16);
  });

  test('each surface answers its own way: stone a ring, a crown and a dark centre; water a ripple and no crown; sand no shine', () => {
    const ring = markPixels('ring');
    expect(ring.px.filter((p) => p.y === 0)).toEqual([{ x: 2, y: 0, rgb: RAIN_RGB, a: RAIN_HEAD }]);
    expect(ring.px.some((p) => p.rgb !== RAIN_RGB && p.x === 2 && p.y === 2)).toBe(true);
    expect(ring.px.filter((p) => p.a === 0.6).length).toBeGreaterThan(6);
    const ripple = markPixels('ripple');
    expect(ripple.px.every((p) => p.rgb === RAIN_RGB && p.a === 0.6)).toBe(true);
    expect(markPixels('dimple').px.some((p) => p.rgb === RAIN_RGB)).toBe(false);
    expect(LANDING.grove).toBeUndefined();
    expect(LANDING.interior).toBeUndefined();
  });

  test('the rain\'s light is the day minus 30%, leaning cool', () => {
    const rgb = washRgb();
    const r = rgb >> 16;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;
    expect(b).toBeGreaterThan(r);
    expect((0.299 * r + 0.587 * g + 0.114 * b) / 255).toBeCloseTo(0.7, 2);
  });
});
