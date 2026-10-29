/**
 * The client's feet read the height rule (NEXT 19 item c, G68). The kernel refuses a step over a rock face unless one end of it is a crossing,
 * and the server checks every tile the phone reports with that rule (`validateTravel`, G56). The body on the phone asks the same rule
 * (`canEnter`, `Walker`), so a player never walks off a face to be sent back, and the searches that pick a route (the peek's line, the wolf's
 * run, the planners of the e2e) go through the crossing. A small map with one face and one crossing first, then the valley's own town face
 * (x=21|22) and its steps (28,14).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type Rect, type State, type Tile, MAX_LEVEL_STEP, levelAt, makeWalkable, newState, step, stepRuleFor } from '@game/kernel';
import { STEP_MS } from '../src/config';
import { peekOnStep, route } from '../src/peek';
import { firstStep } from '../src/predator';
import type { GameSession } from '../src/session-surface';
import { ART_PX, BODY_BOX, type Open, Walker, canEnter } from '../src/walking';
import { loadBundle, mulberry32 } from '../../tools/test/helpers/world';

/** About sixty frames a second, as the scene runs. */
const FRAME = 16;
const AROUND: readonly Tile[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** Ten by six: level 0 up to x=4 and level 1 from x=5, so a face lies between x=4 and x=5 on every row. */
const LEVELS = Array.from({ length: 6 }, () => '0000011111');
/** The one crossing, on the lower tile beside the face, where the schema puts it. */
const CROSSING: Tile = [4, 4];

interface Rig {
  b: Bundle;
  walkable: ReturnType<typeof makeWalkable>;
  nodeAt: ReadonlyMap<string, string>;
  /** a started player of the real content: the view `walkable` reads */
  state: State;
}

let base: Bundle;

beforeAll(() => {
  base = loadBundle();
});

/** A started forager of the real content; the small worlds borrow it, as the kernel's height test does. */
function started(): State {
  const r = step(base, newState(base, 7), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** The same player set down on a tile, at the start of the clock. */
const placed = (state: State, at: Tile): State => ({ ...state, player: { ...state.player, at: [at[0], at[1]], movedAt: state.tick } });

/** A small flat-ground world of the real content's rules, with a height layer, crossing props and, when asked, areas. */
function small(levels: string[] = LEVELS, crossings: Tile[] = [CROSSING], slots: { id: string; kind: 'area'; x: number; y: number; w: number; h: number }[] = []): Rig {
  const props = crossings.map(([x, y], i) => ({ id: `test/ramp-${i}`, sprite: 'core/base-kit:props/rock', x, y, w: 1, h: 1, solid: false, crossing: true as const }));
  const map = { ...base.map, width: levels[0]!.length, height: levels.length, ground: levels.map((row) => '.'.repeat(row.length)), props, slots, spawn: { x: 0, y: 0 }, levels };
  const b = { ...base, map, instances: {}, npcs: {}, restores: {}, pockets: {} } as Bundle;
  return { b, walkable: makeWalkable(b), nodeAt: new Map(), state: started() };
}

/** The real valley, with the node table the scenes build for their walk. */
function valley(): Rig {
  const nodeAt = new Map<string, string>();
  for (const [id, inst] of Object.entries(base.instances)) nodeAt.set(`${inst.x},${inst.y}`, id);
  return { b: base, walkable: makeWalkable(base), nodeAt, state: started() };
}

/** What `canEnter` reads of a session: where the player stands, the clock and the state. */
const playerAt = (r: Rig, at: Tile): Pick<GameSession, 'pos' | 'tick' | 'state'> => ({ pos: [at[0], at[1]], tick: 0, state: r.state });

/** `canEnter` as a scene asks it: the player stands on `at`, and the step is into (x, y), from the tile `from` when that is given. */
const asks = (r: Rig, at: Tile, x: number, y: number, from?: readonly [number, number]): boolean => canEnter(r.b, r.walkable, r.nodeAt, playerAt(r, at), x, y, from);

/** The feet's rule as the scenes hand it to the body (`canWalk`): the player's own tile is somewhere else, the tile left is given. */
const feet = (r: Rig): Open => (x, y, from) => asks(r, [0, 0], x, y, from);

/** The shortest walk over what `canEnter` lets the player enter, asked from the tile it leaves, as the e2e and the stealth flow plan it. */
function plan(r: Rig, from: Tile, to: Tile): Tile[] | undefined {
  const prev = new Map<string, Tile | null>([[`${from[0]},${from[1]}`, null]]);
  const queue: Tile[] = [from];
  for (let i = 0; i < queue.length && !prev.has(`${to[0]},${to[1]}`); i++) {
    const [cx, cy] = queue[i]!;
    for (const [dx, dy] of AROUND) {
      const [nx, ny] = [cx + dx, cy + dy];
      if (prev.has(`${nx},${ny}`) || !asks(r, [0, 0], nx, ny, [cx, cy])) continue;
      prev.set(`${nx},${ny}`, [cx, cy]);
      queue.push([nx, ny]);
    }
  }
  if (!prev.has(`${to[0]},${to[1]}`)) return undefined;
  const path: Tile[] = [];
  for (let at: Tile | null = to; at; at = prev.get(`${at[0]},${at[1]}`) ?? null) path.unshift(at);
  return path;
}

/** Walk `ms` of frames with one input, as the scene does; every tile entered, in order. */
function hold(w: Walker, input: readonly [number, number], ms: number, open: Open): Tile[] {
  const tiles: Tile[] = [];
  for (let t = 0; t < ms; t += FRAME) tiles.push(...w.frame(input, Math.min(FRAME, ms - t), STEP_MS, open));
  return tiles;
}

/** The tiles the body's box overlaps: half-open, so a box that only touches a tile's edge does not overlap it. */
function overlapped(w: Walker): Tile[] {
  const tiles: Tile[] = [];
  const x0 = Math.floor((w.x - BODY_BOX.w / 2) / ART_PX);
  const x1 = Math.ceil((w.x + BODY_BOX.w / 2) / ART_PX) - 1;
  const y0 = Math.floor((w.y - BODY_BOX.h / 2) / ART_PX);
  const y1 = Math.ceil((w.y + BODY_BOX.h / 2) / ART_PX) - 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles.push([x, y]);
  return tiles;
}

/** Every pair of side-by-side tiles under the box that the rule keeps apart: the box lies across a face. */
function acrossFace(w: Walker, rule: (x1: number, y1: number, x2: number, y2: number) => boolean): string[] {
  const body = overlapped(w);
  const across: string[] = [];
  for (const a of body) {
    for (const c of body) if (Math.abs(a[0] - c[0]) + Math.abs(a[1] - c[1]) === 1 && !rule(a[0], a[1], c[0], c[1])) across.push(`${a} | ${c}`);
  }
  return across;
}

describe('a step is the rule\'s to allow, asked from the tile the player stands on', () => {
  test('the face is refused both ways on every row but the crossing, and the crossing lets by', () => {
    const r = small();
    for (let y = 0; y < 6; y++) {
      const open = y === CROSSING[1];
      expect({ y, up: asks(r, [4, y], 5, y) }).toEqual({ y, up: open });
      expect({ y, down: asks(r, [5, y], 4, y) }).toEqual({ y, down: open });
    }
  });

  test('along the face and anywhere on one level the step is open, and the edge of the map stays shut', () => {
    const r = small();
    expect(asks(r, [4, 2], 4, 3)).toBe(true);
    expect(asks(r, [5, 2], 5, 3)).toBe(true);
    expect(asks(r, [5, 2], 6, 2)).toBe(true);
    expect(asks(r, [0, 0], 1, 0)).toBe(true);
    expect(asks(r, [0, 0], -1, 0)).toBe(false);
    expect(asks(r, [9, 5], 9, 6)).toBe(false);
  });

  test('a target that is no step from the player is judged by its own tile', () => {
    const r = small();
    expect(asks(r, [3, 2], 5, 2)).toBe(true);
    expect(asks(r, [5, 2], 5, 2)).toBe(true);
    expect(asks(r, [1, 1], 8, 1)).toBe(true);
  });

  test('the tile left can be given: a search asks from the tile it expands, not from the player', () => {
    const r = small();
    expect(asks(r, [9, 5], 5, 2, [4, 2])).toBe(false);
    expect(asks(r, [9, 5], 5, 4, [4, 4])).toBe(true);
    expect(asks(r, [9, 5], 4, 4, [5, 4])).toBe(true);
    // none given is the player's own tile
    expect(asks(r, [4, 2], 5, 2)).toBe(false);
    expect(asks(r, [4, 4], 5, 4)).toBe(true);
  });

  test('a rise of up to three levels crosses at the crossing, and more is a mountain band', () => {
    for (let top = 1; top <= 9; top++) {
      const r = small(Array.from({ length: 6 }, () => `00000${String(top).repeat(5)}`));
      expect({ top, crossing: asks(r, [4, 4], 5, 4) }).toEqual({ top, crossing: top <= MAX_LEVEL_STEP });
      expect({ top, face: asks(r, [4, 2], 5, 2) }).toEqual({ top, face: false });
    }
  });
});

describe('the body walks by the same rule', () => {
  test('held at the face the body stops flush against it and tells no tile beyond', () => {
    const r = small();
    const w = new Walker();
    w.place([1, 2]);
    expect(hold(w, [1, 0], 4000, feet(r))).toEqual([[2, 2], [3, 2], [4, 2]]);
    expect(w.x + BODY_BOX.w / 2).toBe(5 * ART_PX);
  });

  test('along the crossing row the body goes up the face, and back down it', () => {
    const r = small();
    const w = new Walker();
    w.place([1, 4]);
    expect(hold(w, [1, 0], 4000, feet(r))).toEqual([[2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4]]);
    expect(hold(w, [-1, 0], 4000, feet(r))).toEqual([[8, 4], [7, 4], [6, 4], [5, 4], [4, 4], [3, 4], [2, 4], [1, 4], [0, 4]]);
  });

  test('pressed at the face with the feet in the crossing row, the body is eased into the lane and goes up', () => {
    const r = small();
    const w = new Walker();
    // the centre in row 4, the box half in row 3
    w.x = 2 * ART_PX + ART_PX / 2;
    w.y = 4 * ART_PX + 4;
    expect(overlapped(w).map(String)).toContain('2,3');
    const told = hold(w, [1, 0], 4000, feet(r));
    expect(told.map(String)).toContain('5,4');
  });

  test('a body astride the crossing does not go down along the face: its box would lie across it', () => {
    const r = small();
    const rule = stepRuleFor(r.b);
    const w = new Walker();
    // on the edge itself: the box lies half in the crossing tile and half on the level above it
    w.x = 5 * ART_PX;
    w.y = 4 * ART_PX + ART_PX / 2;
    expect(overlapped(w)).toEqual([[4, 4], [5, 4]]);
    const told: Tile[] = [];
    for (let t = 0; t < 2000; t += FRAME) {
      told.push(...w.frame([0, 1], FRAME, STEP_MS, feet(r)));
      expect(acrossFace(w, rule)).toEqual([]);
    }
    // it was eased into the lane of the tile its feet stand in and went down there, on the upper level
    expect(told).toEqual([[5, 5]]);
    expect(w.x - BODY_BOX.w / 2).toBeGreaterThanOrEqual(5 * ART_PX);
  });

  test('whatever the angle, the box never lies across a face, every tile told is an allowed step, and the server takes them all', () => {
    const r = small();
    const rule = stepRuleFor(r.b);
    const open = feet(r);
    const rand = mulberry32(68);
    const slips: string[] = [];
    let told = 0;
    let crossed = 0;
    for (let run = 0; run < 150; run++) {
      const start: Tile = [Math.floor(rand() * 10), Math.floor(rand() * 6)];
      const w = new Walker();
      w.place(start);
      let at = start;
      let state = placed(r.state, start);
      let tick = 0;
      let angle = rand() * 2 * Math.PI;
      for (let f = 0; f < 150; f++) {
        // a thumb turns now and then, and frames come at different lengths
        if (f % 25 === 0) angle = rand() * 2 * Math.PI;
        const ms = [8, 16, 33, 100][Math.floor(rand() * 4)]!;
        for (const tile of w.frame([Math.cos(angle), Math.sin(angle)], ms, STEP_MS, open)) {
          told++;
          if (Math.abs(tile[0] - at[0]) + Math.abs(tile[1] - at[1]) !== 1 || !rule(at[0], at[1], tile[0], tile[1])) slips.push(`run ${run}: told ${at} -> ${tile}`);
          if (levelAt(r.b.map, at[0], at[1]) !== levelAt(r.b.map, tile[0], tile[1])) crossed++;
          // the server's own check of the report (G56): the tile is reached by a four-way walk, over the faces as the rule has them
          tick += r.b.params.walk_step_ms;
          const answer = step(r.b, state, { t: 'move', at: tile }, tick, { validateTravel: true });
          if (answer.ok) state = answer.state;
          else slips.push(`run ${run}: the server refused ${at} -> ${tile}: ${answer.error}`);
          at = tile;
        }
        for (const edge of acrossFace(w, rule)) slips.push(`run ${run} frame ${f}: the box lies across ${edge}`);
      }
    }
    expect(slips).toEqual([]);
    // the walks were not idle, and some of them went over the crossing
    expect(told).toBeGreaterThan(500);
    expect(crossed).toBeGreaterThan(0);
  });
});

describe('the searches that pick a route go through the crossing', () => {
  const ends = (path: Tile[]): string[] => path.map(String);

  test('the planner of the e2e: from the left block to the right one is 13 steps, over (4,4) to (5,4)', () => {
    const r = small();
    const path = plan(r, [1, 1], [8, 1])!;
    expect(path.length - 1).toBe(13);
    const over = path.flatMap((tile, i) => (i > 0 && levelAt(r.b.map, path[i - 1]![0], path[i - 1]![1]) !== levelAt(r.b.map, tile[0], tile[1]) ? [`${path[i - 1]} > ${tile}`] : []));
    expect(over).toEqual(['4,4 > 5,4']);
  });

  test('the peek line bends to the crossing', () => {
    const r = small();
    const frame: Rect = { x: 0, y: 0, w: 10, h: 6 };
    const hearts: Rect[] = [{ x: 8, y: 1, w: 1, h: 1 }];
    const walk = (x: number, y: number) => r.walkable(x, y, r.state.player);
    const line = route(frame, walk, [1, 1], hearts, stepRuleFor(r.b));
    expect(line).toHaveLength(14);
    expect(ends(line)).toContain('4,4');
    expect(ends(line)).toContain('5,4');
    // asked nothing of the rule, the line runs straight over the face, as it did before
    expect(route(frame, walk, [1, 1], hearts)).toHaveLength(8);
  });

  test('the peek a step into a maze opens bends to the crossing', () => {
    const slots = [
      { id: 'test/frame', kind: 'area' as const, x: 0, y: 0, w: 10, h: 6 },
      { id: 'test/heart', kind: 'area' as const, x: 8, y: 1, w: 1, h: 1 },
    ];
    const r = small(LEVELS, [CROSSING], slots);
    // a maze quest framed by the whole map, with its heart in the right block; the player steps in from outside, on the left
    const quests = { 'test/maze': { id: 'test/maze', maze: { tier: 1, area: 'test/frame' }, steps: [{ kind: 'visit', slot: 'test/heart' }] } };
    const b = { ...r.b, quests } as unknown as Bundle;
    const walk = (x: number, y: number) => r.walkable(x, y, r.state.player);
    const peek = peekOnStep(b, () => false, walk, [-1, 1], [0, 1]);
    expect(peek?.route).toHaveLength(15);
    expect(ends(peek!.route)).toContain('4,4');
    expect(ends(peek!.route)).toContain('5,4');
  });

  test('the wolf run bends to the crossing', () => {
    const r = small();
    const walk = (x: number, y: number) => r.walkable(x, y, r.state.player);
    const run = (stepOpen?: (x1: number, y1: number, x2: number, y2: number) => boolean): Tile[] => {
      let at: Tile = [1, 1];
      const path: Tile[] = [at];
      for (let i = 0; i < 50; i++) {
        const next = firstStep(at, [8, 1], 0, walk, stepOpen);
        if (!next) break;
        path.push(next);
        at = next;
      }
      return path;
    };
    const bent = run(stepRuleFor(r.b));
    expect(bent).toHaveLength(14);
    expect(ends(bent)).toContain('4,4');
    expect(ends(bent)).toContain('5,4');
    expect(run()).toHaveLength(8);
  });
});

describe('the valley', () => {
  test('the town face at x=21|22 stops the feet, and the steps at (28,14) let them up', () => {
    const r = valley();
    const player = r.state.player;
    // both sides are ground a player may stand on: the rule alone says no
    expect(r.walkable(21, 7, player) && r.walkable(22, 7, player)).toBe(true);
    expect(asks(r, [21, 7], 22, 7)).toBe(false);
    expect(asks(r, [22, 7], 21, 7)).toBe(false);
    // the steps lie on the lower tile and either end counts
    expect(r.walkable(28, 13, player) && r.walkable(28, 14, player)).toBe(true);
    expect(asks(r, [28, 14], 28, 13)).toBe(true);
    expect(asks(r, [28, 13], 28, 14)).toBe(true);
    // the tiles beside the steps are face
    expect(asks(r, [27, 14], 27, 13)).toBe(false);
    expect(asks(r, [29, 14], 29, 13)).toBe(false);
  });

  test('a walk from outside the wall into the square goes round to a crossing, one step over the face', () => {
    const r = valley();
    const path = plan(r, [21, 7], [22, 7])!;
    expect(path).toBeDefined();
    // far more than the one step across the face
    expect(path.length - 1).toBeGreaterThan(20);
    const rule = stepRuleFor(r.b);
    const crossings = r.b.map.props.filter((p) => p.crossing === true);
    const onCrossing = ([x, y]: Tile) => crossings.some((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);
    let changes = 0;
    for (let i = 1; i < path.length; i++) {
      const [a, c] = [path[i - 1]!, path[i]!];
      expect(rule(a[0], a[1], c[0], c[1])).toBe(true);
      if (levelAt(r.b.map, a[0], a[1]) !== levelAt(r.b.map, c[0], c[1])) {
        changes++;
        expect(onCrossing(a) || onCrossing(c)).toBe(true);
      }
    }
    expect(changes).toBe(1);
  });
});

/** What the page of the opening e2e answers: its planner, the node that shuts a way and its probe of a step, as game/e2e/opening.ts ships them. */
interface OpeningPage {
  plan(rect: Rect): { path: string[]; face: string; goal: Tile } | null;
  blocker(rect: Rect): { id: string; source: string; x: number; y: number } | null;
  open(x: number, y: number, from?: Tile): boolean;
}

/**
 * The in-page helpers of the opening e2e (`IN_PAGE`, game/e2e/opening.ts) run over the real valley with the player on `at`. The source
 * is read, not imported: the script starts a browser when it loads. A copy of the planner in this file would stay right while the
 * shipped one drifted, which is how the merge of 29.10 sent both CI openings into the town face: develop's room-aware `walker()` took
 * only (x, y), so every step of the search arrived as a single-tile probe and the plan ran straight over x=21|22.
 */
function openingPage(r: Rig, at: Tile): OpeningPage {
  const src = readFileSync(fileURLToPath(new URL('../e2e/opening.ts', import.meta.url)), 'utf8');
  const raw = /const IN_PAGE = `([\s\S]*?)`;\n/.exec(src)?.[1];
  if (raw === undefined) throw new Error('game/e2e/opening.ts has no "const IN_PAGE = `...`;" any more: teach this test where the in-page helpers went');
  // the template as TypeScript reads it, escapes and all; an interpolation in it would throw here, which says the test must learn it
  const code = runInNewContext('`' + raw + '`', {}) as string;
  const session = { pos: [at[0], at[1]], facing: 'down', busy: false, tick: 0, state: r.state };
  const world = {
    room: null,
    body: { moving: false },
    canWalk: (s: Pick<GameSession, 'pos' | 'tick' | 'state'>, x: number, y: number, from?: readonly [number, number]) => canEnter(r.b, r.walkable, r.nodeAt, s, x, y, from),
  };
  const window: { addEventListener: () => void; __game: unknown; __e2e?: OpeningPage } = {
    addEventListener: () => undefined,
    __game: { session, world, bundle: r.b, ui: { blocking: false } },
  };
  runInNewContext(code, { window });
  const page = window.__e2e;
  if (!page) throw new Error('the in-page helpers did not define __e2e');
  // what the page hands back is made in the other realm: plain data again
  return {
    plan: (rect) => JSON.parse(JSON.stringify(page.plan(rect))),
    blocker: (rect) => JSON.parse(JSON.stringify(page.blocker(rect))),
    open: (x, y, from) => page.open(x, y, from),
  };
}

describe('the opening e2e plans its walks by the same rule, as its page runs it', () => {
  const DELTA: Record<string, Tile> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  /** The valley as the opening finds it once the bridge is mended, which is where every walk after the bridge begins. */
  function mended(): Rig {
    const r = valley();
    return { ...r, state: { ...r.state, player: { ...r.state.player, restored: [...r.state.player.restored, 'core/old-bridge'] } } };
  }

  /** The planned path, replayed from where it starts over the kernel's rule: where it ends, the steps the rule refuses and the steps over a change of level. */
  function replay(r: Rig, from: Tile, path: string[]): { end: Tile; refused: string[]; changes: Tile[][] } {
    const rule = stepRuleFor(r.b);
    const refused: string[] = [];
    const changes: Tile[][] = [];
    let at = from;
    for (const d of path) {
      const next: Tile = [at[0] + DELTA[d]![0], at[1] + DELTA[d]![1]];
      if (!rule(at[0], at[1], next[0], next[1])) refused.push(`${at} > ${next}`);
      if (levelAt(r.b.map, at[0], at[1]) !== levelAt(r.b.map, next[0], next[1])) changes.push([at, next]);
      at = next;
    }
    return { end: at, refused, changes };
  }

  /** What the content names, found by its id: a missing one says which. */
  function named<T>(found: T | undefined, what: string): T {
    if (found === undefined) throw new Error(`the content has no ${what} any more: teach this test its new name`);
    return found;
  }

  test('the probe asks a step from the tile it is given, and from the player\'s own when none is', () => {
    const page = openingPage(valley(), [21, 9]);
    expect(page.open(22, 9)).toBe(false);
    expect(page.open(22, 9, [21, 9])).toBe(false);
    // the player is far from the steps and the face beside them: a search asks from the tile it has reached
    expect(page.open(28, 13, [28, 14])).toBe(true);
    expect(page.open(27, 13, [27, 14])).toBe(false);
    expect(page.open(29, 13, [29, 14])).toBe(false);
  });

  test('from the foot of the town face, where CI stood, the plan to the square goes round to the steps and over the face once, on a crossing', () => {
    const r = valley();
    const square = named(r.b.map.slots.find((x) => x.id === 'core/town-square'), 'town square');
    const plan = openingPage(r, [21, 9]).plan(square);
    expect(plan).not.toBeNull();
    const walked = replay(r, [21, 9], plan!.path);
    expect(walked.refused).toEqual([]);
    expect(walked.end).toEqual(plan!.goal);
    expect(walked.changes).toEqual([[[28, 14], [28, 13]]]);
  });

  test('from the fire the plan reaches every place the opening walks to, each step by the rule', () => {
    const r = mended();
    const b = r.b;
    const slot = (id: string) => named(b.map.slots.find((x) => x.id === id), `slot ${id}`);
    const prop = (id: string) => named(b.map.props.find((x) => x.id === id), `prop ${id}`);
    const nodes = (source: string): Rect[] => Object.values(b.instances).filter((i) => i.source === source).map((i) => ({ x: i.x, y: i.y, w: 1, h: 1 }));
    const camp = slot('core/camp');
    const fire: Tile = [camp.x + 2, camp.y + 2];
    const elder = slot('core/elder-house');
    const trader = slot('core/trader-stall');
    const places: [string, Rect][] = [
      ['the town square', slot('core/town-square')],
      ['Elder Maru', { x: elder.x + 1, y: elder.y + 1, w: 1, h: 1 }],
      ["Pell's door", { x: trader.x, y: trader.y, w: 1, h: 1 }],
      ['the ruined house', slot('core/town-edge')],
      ['the broken arch', slot('core/arch-mouth')],
      ['the grove', slot('core/forest-mushrooms')],
      ...['core/marked-stone', 'core/town-lantern', 'core/hill-lantern', 'core/arch-stone'].map((id): [string, Rect] => [id, prop(id)]),
      ...['core/lantern-foot', 'core/bell-bushes', 'core/sun-herbs', 'core/berry-bushes', 'core/wild-herbs', 'core/oak-trees'].flatMap((source) =>
        nodes(source).map((rect, i): [string, Rect] => [`${source} #${i}`, rect]),
      ),
    ];
    const page = openingPage(r, fire);
    const lost: string[] = [];
    for (const [what, rect] of places) {
      const plan = page.plan(rect);
      if (!plan) {
        lost.push(`${what}: no way`);
        continue;
      }
      const walked = replay(r, fire, plan.path);
      if (walked.refused.length > 0 || walked.end.join(',') !== plan.goal.join(',')) lost.push(`${what}: refused [${walked.refused.join('; ')}], ends ${walked.end} not ${plan.goal}`);
    }
    expect(lost).toEqual([]);
  });

  test('the collapsed hall is dug by day from the lane south of the ruins: a ready log across the east lane shuts the way until it is taken', () => {
    const r = mended();
    const stall = named(r.b.map.slots.find((x) => x.id === 'core/trader-stall'), 'trader stall');
    // where the walk to the hall begins: the doorstep of Pell's stall, as the shop puts the player back on the valley
    const doorstep: Tile = [stall.x, stall.y + 1];
    const spots = Object.values(r.b.instances).filter((i) => i.source === 'core/ruins-hall').map((i): Rect => ({ x: i.x, y: i.y, w: 1, h: 1 }));
    expect(spots.length).toBeGreaterThan(0);
    const shut = openingPage(r, doorstep);
    const blockers = new Set<string>();
    for (const spot of spots) {
      expect(shut.plan(spot)).toBeNull();
      const block = shut.blocker(spot);
      expect(block?.source).toBe('core/fallen-logs');
      blockers.add(block!.id);
    }
    // every dig spot is shut by the same log: taking it opens the lane, and each walk then keeps to the rule
    expect([...blockers]).toHaveLength(1);
    const [log] = [...blockers];
    const taken: Rig = { ...r, state: { ...r.state, nodes: { ...r.state.nodes, [log!]: { readyAt: 1_000_000, draws: 1 } } } };
    const open = openingPage(taken, doorstep);
    for (const spot of spots) {
      const plan = open.plan(spot);
      expect(plan).not.toBeNull();
      const walked = replay(taken, doorstep, plan!.path);
      expect(walked.refused).toEqual([]);
      expect(walked.end).toEqual(plan!.goal);
    }
  });

  test('the night ruins stay out of reach before the arch, as the script checks, and no node is to blame', () => {
    const r = mended();
    const threshold = named(r.b.map.slots.find((x) => x.id === 'core/night-threshold'), 'night threshold');
    const camp = named(r.b.map.slots.find((x) => x.id === 'core/camp'), 'camp');
    const page = openingPage(r, [camp.x + 2, camp.y + 2]);
    expect(page.plan(threshold)).toBeNull();
    expect(page.blocker(threshold)).toBeNull();
  });
});
