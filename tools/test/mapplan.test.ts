/**
 * The map plan's checks (DECISIONS.md, 2026-10-23): the plan block agrees with the tiles, paths wind
 * (G69), and the first night is held by the size of the land (G71), measured with the walk speed and
 * the clock as the params set them.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Bundle } from '@game/kernel';
import { validateFile } from '@game/schema';
import { ROAD_MARGIN, checkMapPlan, exitRoads, firstDusk, firstNight, straightRuns } from '../src/mapplan';
import { loadBundle } from './helpers/world';

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

type Map = Bundle['map'];
const withMap = (patch: Partial<Map>): Bundle => ({ ...bundle, map: { ...bundle.map, ...patch } });
const errors = (b: Bundle) => checkMapPlan(b, {}).filter((i) => i.level === 'error');

describe('the plan block in the schema', () => {
  const load = () => JSON.parse(readFileSync(new URL('../../content/core/map.json', import.meta.url), 'utf8'));

  it('is optional, and a full block validates', () => {
    const file = load();
    delete file.map.plan;
    delete file.map.levels;
    expect(validateFile(file)).toEqual([]);
    file.map.plan = {
      regions: [{ id: 'core/a-bank', purpose: 'stop', cells: [[2, 2, 4, 4]], height: 0, tags: ['meadow'], cover: { 'core/base-kit:props/reeds': 30 }, opens_by: 'wake' }],
      paths: [{ id: 'core/a-path', width: 1, via: [[2, 2], [2, 5]] }],
      routes: [{ id: 'core/a-round', who: 'Maru', hours: [5, 10], via: [[2, 2]] }],
      rests: [{ x: 2, y: 2 }],
      wakes: [{ pocket: 'core/west-bank', quest: 'core/first-pickings' }],
      exits: [{ id: 'core/a-way', at: [2, 5], to: 'core/a-bank', min_road_steps: 2200 }],
    };
    file.map.levels = file.map.ground.map((row: string) => '0'.repeat(row.length));
    expect(validateFile(file)).toEqual([]);
  });

  it('refuses a purpose outside stop and passage, a cover over 300 and a height that is not a digit', () => {
    const file = load();
    file.map.plan = { regions: [{ id: 'core/a-bank', purpose: 'scenery', cells: [[2, 2, 4, 4]], opens_by: 'wake' }] };
    expect(validateFile(file)).not.toEqual([]);
    file.map.plan = { regions: [{ id: 'core/a-bank', purpose: 'stop', cells: [[2, 2, 4, 4]], cover: { 'core/base-kit:props/reeds': 301 }, opens_by: 'wake' }] };
    expect(validateFile(file)).not.toEqual([]);
    file.map.plan = {};
    file.map.levels = file.map.ground.map((row: string) => 'a'.repeat(row.length));
    expect(validateFile(file)).not.toEqual([]);
  });
});

describe('G69: paths wind', () => {
  it('splits a chain into straight runs that share their corner tiles', () => {
    const runs = straightRuns([
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
      [3, 2],
    ]);
    expect(runs.map((r) => r.length)).toEqual([3, 3, 2]);
  });

  it('refuses a planned path with a straight run over 8 tiles, and one whose corners share no row', () => {
    const ground = bundle.map.ground.map((row, y) => (y === 3 ? `${row.slice(0, 2)}${':'.repeat(9)}${row.slice(11)}` : row));
    const legend = { ...bundle.map.legend, ':': { sprite: 'core/base-kit:tiles/path', solid: false, tag: 'path' as const } };
    const long = withMap({ ground, legend, plan: { paths: [{ id: 'core/long', width: 1, via: [[2, 3], [10, 3]] }] } });
    const messages = errors(long).map((i) => i.message);
    expect(messages.some((m) => m.includes('core/long: a straight run of 9 tiles'))).toBe(true);
    expect(messages.some((m) => m.includes('a straight run of 9 path tiles from (2, 3) to (10, 3)'))).toBe(true);
    const bent = withMap({ ground, legend, plan: { paths: [{ id: 'core/bent', width: 1, via: [[2, 3], [5, 5]] }] } });
    expect(errors(bent).some((i) => i.message.includes('share no row and no column'))).toBe(true);
  });
});

describe('the spawn pool', () => {
  it('names each wake pocket with its first task, and refuses a quest of another pocket', () => {
    const wrong = withMap({ plan: { wakes: [{ pocket: 'core/west-bank', quest: 'core/buried-axe' }] } });
    expect(errors(wrong).some((i) => i.message.includes('is not the first task of core/west-bank'))).toBe(true);
  });
});

describe('G71: the first night is held by size', () => {
  it('measures daylight from waking at noon to the first dusk with the params clock', () => {
    // tick 0 is noon; night begins at 20:00, eight game hours of a day later
    expect(firstDusk(bundle)).toBe((bundle.params.day_length_ms * 8) / 24);
  });

  it('the core valley holds every wake inside it until the first dusk, every gate open', () => {
    const walk = bundle.params.walk_step_ms;
    for (const f of firstNight(bundle)) {
      if (f.exitSteps !== null) expect(f.exitSteps * walk, f.pocket).toBeGreaterThan(f.daylightMs);
    }
    expect(errors(bundle).filter((i) => i.message.startsWith('G71'))).toEqual([]);
  });

  it('fails a map whose wake lies one step from ground of another world', () => {
    const pocket = Object.values(bundle.pockets)[0]!;
    const near = withMap({ regions: [{ id: 'elsewhere', x: pocket.wake.x, y: pocket.wake.y, w: 1, h: 1, world: 'elsewhere' }] });
    const found = errors(near).find((i) => i.message.startsWith(`G71: from the wake of ${pocket.id} `));
    expect(found, 'the wake on ground of its own world one step from the valley').toBeDefined();
    expect(found!.message).toContain('a walk of 1 steps');
  });

  describe('an exit: the road beyond the gate holds the night, never the gate', () => {
    // a corridor: the wake at x 1, the valley to x 4, the gate at x 5 (shut rubble), the road beyond to x 19
    const stitched = (worldFrom: number | null, minRoad: number): Bundle => {
      const row = (y: number) => (y === 2 ? `%${'.'.repeat(4)}%${'.'.repeat(14)}` : '%'.repeat(20));
      const map: Map = {
        ...bundle.map,
        width: 20,
        height: 5,
        ground: [0, 1, 2, 3, 4].map(row),
        levels: undefined,
        props: [],
        slots: [{ id: 'core/a-gate', kind: 'area', x: 5, y: 2, w: 1, h: 1 }],
        regions: worldFrom === null ? undefined : [{ id: 'elsewhere', x: worldFrom, y: 0, w: 20 - worldFrom, h: 5, world: 'elsewhere' }],
        plan: {
          regions: [{ id: 'core/a-wood', purpose: 'passage', cells: [[5, 0, 15, 5]], opens_by: 'core/a-quest' }],
          exits: [{ id: 'core/a-way', slot: 'core/a-gate', to: 'core/a-wood', min_road_steps: minRoad }],
        },
      };
      const pocket = Object.values(bundle.pockets)[0]!;
      return { ...bundle, map, instances: {}, pockets: { [pocket.id]: { ...pocket, wake: { x: 1, y: 2 } } } };
    };
    const g71 = (b: Bundle) => errors(b).filter((i) => i.message.startsWith('G71'));

    it('names the least road beyond: the daylight in steps less the walk to the gate, plus the margin', () => {
      const [road] = exitRoads(stitched(null, 1));
      expect(road!.gateSteps).toBe(4);
      expect(road!.needed).toBe(Math.ceil(firstDusk(bundle) / bundle.params.walk_step_ms - 4) + ROAD_MARGIN);
      expect(road!.road).toBeNull();
      expect(g71(stitched(null, road!.needed!))).toEqual([]);
      expect(g71(stitched(null, road!.needed! - 1)).map((i) => i.message).join(' / ')).toContain(`must run at least ${road!.needed} steps`);
    });

    it('fails a stitched map whose road beyond the gate is shorter than the plan asks', () => {
      const needed = exitRoads(stitched(null, 1))[0]!.needed!;
      const short = stitched(10, needed);
      expect(exitRoads(short)[0]!.road).toBe(5);
      const found = g71(short).find((i) => i.message.includes('beyond core/a-way the next region'));
      expect(found, 'a road of 5 steps where the plan asks for the night').toBeDefined();
      expect(found!.message).toContain('5 steps past the gate');
    });
  });
});
