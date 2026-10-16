/**
 * The first maze (GAME_RULES.md section 3, `maze`): the tangle south of the
 * ruins is map content and a visit of its heart, nothing new in the kernel.
 * These pin what makes it a maze and not a corridor: the heart is reachable
 * from the waking spot once the bridge is mended, the shortest route is long,
 * wrong turns end in dead ends, and the quest is a maze that comes after the
 * opening and never right after another maze (G17).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { type Bundle, type QuestDef, findSlot, inRect, makeWalkable } from '@game/kernel';
import { runCheck } from '../src/check';
import { OPENING_QUESTS, checkPlay, isMazeVisit } from '../src/play';

const HEART = 'core/tangle-heart';
const QUEST = 'core/the-tangle';
/** The one gap in the forest between the ruins and the tangle. */
const MOUTH: readonly [number, number] = [39, 34];
/** The tangle, in tiles: everything south of the old forest edge. */
const TANGLE = { x: 0, y: 34, w: 48, h: 15 };

const STEPS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

let bundle: Bundle;
let walk: (x: number, y: number) => boolean;

/** Steps from a tile to every tile reachable from it, walking four ways. */
function distances(from: readonly [number, number]): Map<number, number> {
  const { width } = bundle.map;
  const dist = new Map<number, number>([[from[1] * width + from[0], 0]]);
  const queue: [number, number][] = [[from[0], from[1]]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    const d = dist.get(y * width + x)!;
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!walk(nx, ny) || dist.has(ny * width + nx)) continue;
      dist.set(ny * width + nx, d + 1);
      queue.push([nx, ny]);
    }
  }
  return dist;
}

beforeAll(() => {
  const found = runCheck().assembled.bundle;
  if (!found) throw new Error('Content did not assemble into a bundle.');
  bundle = found;
  const walkable = makeWalkable(bundle);
  const view = { restored: Object.values(bundle.restores).filter((r) => r.passable).map((r) => r.id), camp: [] as string[] };
  walk = (x, y) => walkable(x, y, view);
});

describe('the tangle', () => {
  it('has its heart in an area the client sends a visit for', () => {
    const heart = findSlot(bundle.map, HEART);
    expect(heart?.kind).toBe('area');
    expect(heart && inRect(heart.x, heart.y, TANGLE)).toBe(true);
  });

  it('is entered by one gap south of the ruins, and the heart is reachable from the waking spot with the bridge mended', () => {
    const { width } = bundle.map;
    const gaps = [];
    for (let x = 0; x < width; x++) if (walk(x, TANGLE.y)) gaps.push(x);
    expect(gaps).toEqual([MOUTH[0]]);
    const fromSpawn = distances([bundle.map.spawn.x, bundle.map.spawn.y]);
    const heart = findSlot(bundle.map, HEART)!;
    const reached = [...fromSpawn.keys()].some((i) => inRect(i % width, Math.floor(i / width), heart));
    expect(reached).toBe(true);
  });

  it('is a maze, not a corridor: the route is long and wrong turns end in dead ends', () => {
    const { width } = bundle.map;
    const fromMouth = distances(MOUTH);
    const heart = findSlot(bundle.map, HEART)!;
    const route = Math.min(...[...fromMouth].filter(([i]) => inRect(i % width, Math.floor(i / width), heart)).map(([, d]) => d));
    // about 14 seconds of walking at 190 ms a tile if no turn is wrong
    expect(route).toBeGreaterThanOrEqual(60);
    let deadEnds = 0;
    for (const i of fromMouth.keys()) {
      const x = i % width;
      const y = Math.floor(i / width);
      if (!inRect(x, y, TANGLE) || inRect(x, y, heart)) continue;
      if (STEPS.filter(([dx, dy]) => walk(x + dx, y + dy)).length === 1) deadEnds++;
    }
    expect(deadEnds).toBeGreaterThanOrEqual(10);
  });

  it('is asked by a maze quest after the opening, answered by the visit alone, and the check passes it', () => {
    const q = bundle.quests[QUEST]!;
    expect(q.type).toBe('maze');
    expect(isMazeVisit(q)).toBe(true);
    expect(OPENING_QUESTS.has(QUEST)).toBe(false);
    for (const r of q.requires ?? []) {
      expect(OPENING_QUESTS.has(r), r).toBe(false);
      expect(bundle.quests[r]?.type, r).not.toBe('maze');
    }
    expect(checkPlay(bundle, {}).filter((i) => i.message.includes('maze'))).toEqual([]);
  });

  it('names tier 1 and a frame that holds the heart, the mouth and the mossy rocks, entered from the meadow north of it', () => {
    const maze = bundle.quests[QUEST]!.maze!;
    expect(maze.tier).toBe(1);
    const frame = findSlot(bundle.map, maze.area)!;
    expect(frame.kind).toBe('area');
    const heart = findSlot(bundle.map, HEART)!;
    expect(inRect(heart.x, heart.y, frame) && inRect(heart.x + heart.w - 1, heart.y + heart.h - 1, frame)).toBe(true);
    expect(inRect(MOUTH[0], MOUTH[1], frame)).toBe(true);
    expect(inRect(MOUTH[0], MOUTH[1] - 1, frame)).toBe(false);
    expect(walk(MOUTH[0], MOUTH[1] - 1)).toBe(true);
    const rocks = bundle.map.props.filter((p) => p.sprite === maze.landmark && inRect(p.x, p.y, frame));
    expect(rocks.length).toBeGreaterThanOrEqual(5);
    expect(checkPlay(bundle, {}).filter((i) => i.where.startsWith('quest.maze'))).toEqual([]);
  });

  it('refuses a maze block on another type, a frame that is not an area or misses the heart, and a landmark drawn nowhere in it', () => {
    const q = bundle.quests[QUEST]!;
    const withMaze = (patch: Partial<QuestDef>): Bundle => ({ ...bundle, quests: { ...bundle.quests, [QUEST]: { ...q, ...patch } } });
    const said = (b: Bundle) => checkPlay(b, {}).filter((i) => i.where.startsWith('quest.maze')).map((i) => i.message).join('\n');
    expect(said(withMaze({ type: 'discovery' }))).toContain('only a maze quest names a maze');
    expect(said(withMaze({ maze: { ...q.maze!, area: 'core/ruins-deep' } }))).toContain('is not an area slot');
    expect(said(withMaze({ maze: { ...q.maze!, area: 'core/town-square' } }))).toContain('the heart lies outside the frame');
    expect(said(withMaze({ maze: { ...q.maze!, landmark: 'core/base-kit:props/standing_stone' } }))).toContain('no prop inside');
  });

  it('a maze quest whose visit is not an area is refused, and a plain visit quest of another type is still a counter', () => {
    const bad: Bundle = {
      ...bundle,
      quests: { ...bundle.quests, [QUEST]: { ...bundle.quests[QUEST]!, steps: [{ kind: 'visit', slot: 'core/ruins-deep' }] } },
    };
    expect(checkPlay(bad, {}).some((i) => i.message.includes('a maze is answered by a visit of the area at its heart'))).toBe(true);
    const counter: Bundle = { ...bundle, quests: { ...bundle.quests, [QUEST]: { ...bundle.quests[QUEST]!, type: 'discovery' } } };
    expect(checkPlay(counter, {}).some((i) => i.message.includes('a counter, not a question'))).toBe(true);
  });
});
