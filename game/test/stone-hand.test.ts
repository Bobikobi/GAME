/**
 * STONE HAND (public #793): the stone a figure throws or pushes leaves the drawn hand, not the middle of the tile. The hand is data
 * beside each clip (`clip.hand`, a point a frame in sheet pixels); these tests hold the data to what the sheets draw and the numbers
 * to the pure functions the world uses. No renderer.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { REPO_ROOT } from '../../tools/src/load';
import { handAt, handWorld } from '../src/clips';
import { stoneMotion } from '../src/stone-art';

type Clip = { race: string; view: string; verb: string; frame_ms: number; anchor: [number, number]; fit_permille?: number; hand?: [number, number][] };
type Sprite = { file: string; w: number; h: number; frames: number; clip?: Clip };
const KIT = join(REPO_ROOT, 'content', 'kit', 'core');
const sprites = (JSON.parse(readFileSync(join(KIT, 'kit.json'), 'utf8')) as { kit: { sprites: Record<string, Sprite> } }).kit.sprites;
const RACES = ['human', 'elf', 'skeleton'];
const VIEWS = ['front', 'left', 'back'];
/** The throw's cells whose open hand is the sixth frame (the stone leaves at frame 5); the rest leave at frame 4. The push lets go at frame 2. */
const LATE = ['human left', 'elf back', 'skeleton left', 'skeleton back'];

const cell = (race: string, verb: string, view: string): Sprite => sprites[`chars/${race}_${verb}_${view}`]!;

describe('the hand points are data beside the clips', () => {
  test('every throw and push clip names its hand up to its release frame, and every carry clip names the stone in its hands', () => {
    for (const race of RACES) {
      for (const view of VIEWS) {
        const throwing = cell(race, 'throw', view).clip!.hand;
        const pushing = cell(race, 'push', view).clip!.hand;
        const carrying = cell(race, 'carry', view);
        expect(throwing, `${race} throw ${view}`).toHaveLength(LATE.includes(`${race} ${view}`) ? 6 : 5);
        expect(pushing, `${race} push ${view}`).toHaveLength(3);
        expect(carrying.clip!.hand, `${race} carry ${view}`).toHaveLength(carrying.frames);
      }
    }
  });

  test('every point is inside its frame', () => {
    for (const [name, s] of Object.entries(sprites)) {
      for (const [x, y] of s.clip?.hand ?? []) {
        expect(x >= 0 && x < s.w && y >= 0 && y < s.h, `${name}: ${x},${y} in ${s.w} x ${s.h}`).toBe(true);
      }
    }
  });

  test('the push begins where the carry left the stone: its first point is the carry\'s standing point in the push sheet\'s own frame', () => {
    for (const race of RACES) {
      for (const view of VIEWS) {
        const carry = cell(race, 'carry', view);
        const push = cell(race, 'push', view);
        const last = carry.clip!.hand![carry.frames - 1]!;
        const [ax, ay] = carry.clip!.anchor;
        const [bx, by] = push.clip!.anchor;
        expect(push.clip!.hand![0], `${race} ${view}`).toEqual([last[0] - ax + bx, last[1] - ay + by]);
      }
    }
  });
});

describe('the hand glides between frames', () => {
  const found = { frame_ms: 100, hand: [[0, 0], [10, 20], [30, 20]] as const };
  test('on a frame\'s start it is that frame\'s point, between frames a straight line, after the last it stays', () => {
    expect(handAt(found, 0)).toEqual([0, 0]);
    expect(handAt(found, 50)).toEqual([5, 10]);
    expect(handAt(found, 100)).toEqual([10, 20]);
    expect(handAt(found, 150)).toEqual([20, 20]);
    expect(handAt(found, 200)).toEqual([30, 20]);
    expect(handAt(found, 9999)).toEqual([30, 20]);
  });
  test('a clip with no hand, or not begun, has none', () => {
    expect(handAt({ frame_ms: 100 }, 10)).toBeUndefined();
    expect(handAt(found, -1)).toBeUndefined();
  });
});

describe('a point of the frame in the world', () => {
  const fig = { x: 100, y: 50, originX: 0.5, originY: 0.8, scaleX: 0.25, scaleY: 0.25, w: 128, h: 128, flip: false };
  test('the origin is the point that stands where the figure stands', () => {
    expect(handWorld(fig, [64, 102.4])).toEqual({ x: 100, y: 50 });
  });
  test('right of the origin is right, and a figure drawn flipped has it on the left', () => {
    expect(handWorld(fig, [96, 102.4]).x).toBeCloseTo(108);
    expect(handWorld({ ...fig, flip: true }, [96, 102.4]).x).toBeCloseTo(92);
    expect(handWorld(fig, [64, 70.4]).y).toBeCloseTo(42);
  });
});

describe('a stone leaves the hand', () => {
  const base = { size: 'large' as const, from: [5, 5] as [number, number], touch: [9, 5] as [number, number], at: [10, 5] as [number, number], ms: 700 };
  test('it starts at the hand, in the air at the hand\'s height, and the flight is the same from there on', () => {
    const m = stoneMotion({ ...base, hand: { x: 5.3, y: 5.9, lift: 0.8 } });
    const start = m.at(0);
    expect([start.x, start.y, start.lift]).toEqual([5.3, 5.9, 0.8]);
    expect(m.at(m.touchMs).x).toBeCloseTo(9.5);
    expect(m.at(m.touchMs).lift).toBeCloseTo(0);
    expect(m.at(700).done).toBe(true);
  });
  test('with no hand it leaves the middle of the tile as before', () => {
    const start = stoneMotion(base).at(0);
    expect([start.x, start.y]).toEqual([5.5, 5.5]);
    expect(start.shrink).toBe(1);
  });
  test('a stone drawn small in the hand grows to its own size by the middle of the air, with no pop at the release', () => {
    const m = stoneMotion({ ...base, hand: { x: 5.5, y: 5.5, lift: 0.8, share: 0.5 } });
    expect(m.at(0).shrink).toBeCloseTo(0.5);
    expect(m.at(m.touchMs / 2).shrink).toBeCloseTo(1);
    expect(m.at(m.touchMs - 1).shrink).toBe(1);
  });
  test('a stone in the hand with no share is its own size all the way: an object keeps its size (#874)', () => {
    const m = stoneMotion({ ...base, hand: { x: 5.5, y: 5.5, lift: 0.8 } });
    for (const t of [0, m.touchMs / 4, m.touchMs / 2, m.touchMs - 1]) expect(m.at(t).shrink).toBe(1);
  });
});
