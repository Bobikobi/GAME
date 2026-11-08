/**
 * The generator's input and output as content (DECISIONS 2026-11-08): a story file, a creature spot with the
 * generator's axes on a map and in a chunk, and a region card's air.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CORE_ONLY_TYPES, PARTICLE_KINDS, SCHEMAS, SIDES, SPOT_RANKS, SPOT_SHAPES, STORY_WORLDS, validateFile } from '../src/index';

const load = (path: string) => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));

const story = () => ({
  $schema: '../../../schema/json/story.schema.json',
  format: 1,
  type: 'story',
  id: 'core/elf-wood',
  title: 'The elf wood',
  creator: 'core',
  description: 'Bright and clear: sun shafts between the trees, pollen by day, fireflies by night.',
  story: {
    seed: 'fireflies',
    world: 'elf',
    origin: { cx: 3, cy: 1 },
    size: { w: 3, h: 3 },
    forest: 70,
    relief: 35,
    water: 40,
    caves: 3,
    entries: ['s', 'e'],
    ruins: 1,
    life: 25,
  },
});
type StorySample = ReturnType<typeof story>;
const storyWith = (change: (s: StorySample) => void) => {
  const s = story();
  change(s);
  return s;
};

describe('the story file', () => {
  it('is a file type of its own and validates with every field', () => {
    expect(Object.keys(SCHEMAS)).toContain('story');
    expect(validateFile(story())).toEqual([]);
  });

  it('needs only the land\'s shape: ruins and life may be left out', () => {
    expect(validateFile(storyWith((s) => {
      delete (s.story as { ruins?: number }).ruins;
      delete (s.story as { life?: number }).life;
    }))).toEqual([]);
  });

  it('refuses an unknown field, a world it does not know, a side named twice and a share over 100', () => {
    expect(validateFile(storyWith((s) => ((s.story as Record<string, unknown>).mist = 400)))).not.toEqual([]);
    expect(validateFile(storyWith((s) => ((s.story as Record<string, unknown>).world = 'dwarf')))).not.toEqual([]);
    expect(validateFile(storyWith((s) => ((s.story as Record<string, unknown>).entries = ['s', 's'])))).not.toEqual([]);
    expect(validateFile(storyWith((s) => ((s.story as Record<string, unknown>).entries = [])))).not.toEqual([]);
    expect(validateFile(storyWith((s) => (s.story.forest = 101)))).not.toEqual([]);
    expect(validateFile(storyWith((s) => (s.story.caves = 9)))).not.toEqual([]);
    expect(validateFile(storyWith((s) => (s.story.size.w = 9)))).not.toEqual([]);
  });

  it('may name the chunk of the land below, inside the grid', () => {
    expect(validateFile(storyWith((s) => ((s.story as Record<string, unknown>).below = { cx: 3, cy: 12 })))).toEqual([]);
    expect(validateFile(storyWith((s) => ((s.story as Record<string, unknown>).below = { cx: 16, cy: 12 })))).not.toEqual([]);
    expect(validateFile(storyWith((s) => ((s.story as Record<string, unknown>).below = { cx: 3 })))).not.toEqual([]);
  });

  it('may name the settlement at the hub, a clearing to a city', () => {
    for (const town of [0, 1, 2, 3]) expect(validateFile(storyWith((s) => ((s.story as Record<string, unknown>).town = town)))).toEqual([]);
    expect(validateFile(storyWith((s) => ((s.story as Record<string, unknown>).town = 4)))).not.toEqual([]);
    expect(validateFile(storyWith((s) => ((s.story as Record<string, unknown>).town = 'city')))).not.toEqual([]);
  });

  it('is core-only, so the project board and the assembler know it as the core\'s record', () => {
    expect([...CORE_ONLY_TYPES]).toContain('story');
  });

  it('names three worlds and four sides', () => {
    expect([...STORY_WORLDS]).toEqual(['human', 'elf', 'undead']);
    expect([...SIDES]).toEqual(['n', 'e', 's', 'w']);
  });
});

const GROUND_ROW = '.'.repeat(64);
const chunk = (spawns?: unknown) => ({
  $schema: '../../schema/json/chunk.schema.json',
  format: 1,
  type: 'chunk',
  id: 'core/chunk-0-0',
  title: 'Chunk (0, 0)',
  creator: 'core',
  chunk: {
    x: 0,
    y: 0,
    grounds: Array.from({ length: 64 }, () => GROUND_ROW),
    props: [],
    stamps: [],
    ...(spawns === undefined ? {} : { spawns }),
  },
});

const fullSpot = {
  kind: 'core/wolf',
  x: 10,
  y: 12,
  rank: 'elite',
  shape: 'camp',
  count: [3, 6],
  affixes: ['fast', 'caller'],
  leader: 'core/wolf',
  route: [
    [10, 12],
    [11, 12],
    [12, 12],
  ],
};

describe('a creature spot with the generator\'s axes', () => {
  it('stands on the map as before: kind, x and y alone still validate', () => {
    const map = load('content/core/map.json');
    expect(map.map.creatures.spots.length).toBeGreaterThan(0);
    expect(validateFile(map)).toEqual([]);
  });

  it('carries a rank, a shape, a count, affixes, a leader and a route on the map', () => {
    const map = load('content/core/map.json');
    map.map.creatures.spots.push({ ...fullSpot, kind: Object.keys(map.map.creatures.kinds)[0] });
    expect(validateFile(map)).toEqual([]);
    for (const rank of SPOT_RANKS) {
      map.map.creatures.spots[map.map.creatures.spots.length - 1].rank = rank;
      expect(validateFile(map)).toEqual([]);
    }
    for (const shape of SPOT_SHAPES) {
      map.map.creatures.spots[map.map.creatures.spots.length - 1].shape = shape;
      expect(validateFile(map)).toEqual([]);
    }
  });

  it('refuses a rank it does not know, an affix twice, a count of 0 and a route of one tile', () => {
    const bad = (change: (s: Record<string, unknown>) => void) => {
      const map = load('content/core/map.json');
      const s: Record<string, unknown> = { ...fullSpot, kind: Object.keys(map.map.creatures.kinds)[0] };
      change(s);
      map.map.creatures.spots.push(s);
      return validateFile(map);
    };
    expect(bad((s) => (s.rank = 'legendary'))).not.toEqual([]);
    expect(bad((s) => (s.shape = 'swarm'))).not.toEqual([]);
    expect(bad((s) => (s.affixes = ['fast', 'fast']))).not.toEqual([]);
    expect(bad((s) => (s.affixes = ['Fast']))).not.toEqual([]);
    expect(bad((s) => (s.count = [0, 4]))).not.toEqual([]);
    expect(bad((s) => (s.route = [[1, 1]]))).not.toEqual([]);
    expect(bad((s) => (s.danger = 2))).not.toEqual([]);
  });

  it('sits in a chunk too, in chunk tiles: a chunk without spawns validates, one with them validates, a tile past 63 is refused', () => {
    expect(validateFile(chunk())).toEqual([]);
    expect(validateFile(chunk([fullSpot, { kind: 'core/hare', x: 63, y: 0 }]))).toEqual([]);
    expect(validateFile(chunk([{ kind: 'core/hare', x: 64, y: 0 }]))).not.toEqual([]);
    // a route is in world tiles even in a chunk, so a patrol may cross a seam
    expect(validateFile(chunk([{ ...fullSpot, route: [[64, 0], [63, 0]] }]))).toEqual([]);
    expect(validateFile(chunk([{ ...fullSpot, route: [[1024, 0], [1023, 0]] }]))).not.toEqual([]);
    expect(validateFile(chunk(Array.from({ length: 65 }, (_, i) => ({ kind: 'core/hare', x: i % 64, y: 1 }))))).not.toEqual([]);
  });
});

const air = {
  sun: { day: [236, 255, 220], dusk: [220, 255, 200] },
  night_depth: 40,
  particles: [
    { kind: 'fireflies', density: 6 },
    { kind: 'pollen', density: 5 },
  ],
  shafts: true,
};

describe('a region card\'s air', () => {
  const mapWith = (atmosphere?: unknown) => {
    const map = load('content/core/map.json');
    const card = map.map.cards[0];
    if (atmosphere === undefined) delete card.atmosphere;
    else card.atmosphere = atmosphere;
    return map;
  };

  it('is optional: the valley\'s cards validate without it', () => {
    expect(load('content/core/map.json').map.cards.length).toBeGreaterThan(0);
    expect(validateFile(mapWith())).toEqual([]);
  });

  it('carries the sun\'s tints, the night\'s depth, what drifts and the shafts', () => {
    expect(validateFile(mapWith(air))).toEqual([]);
    expect(validateFile(mapWith({ ...air, shafts: undefined, particles: [] }))).toEqual([]);
    for (const kind of PARTICLE_KINDS) expect(validateFile(mapWith({ ...air, particles: [{ kind, density: 1 }] }))).toEqual([]);
  });

  it('refuses a colour past 255, a depth past 100, rain as a particle (the weather\'s) and a fog of its own (the weather\'s too)', () => {
    expect(validateFile(mapWith({ ...air, sun: { day: [256, 0, 0], dusk: [0, 0, 0] } }))).not.toEqual([]);
    expect(validateFile(mapWith({ ...air, night_depth: 101 }))).not.toEqual([]);
    expect(validateFile(mapWith({ ...air, particles: [{ kind: 'rain', density: 3 }] }))).not.toEqual([]);
    expect(validateFile(mapWith({ ...air, particles: [{ kind: 'ash', density: 11 }] }))).not.toEqual([]);
    expect(validateFile(mapWith({ ...air, fog: 400 }))).not.toEqual([]);
  });
});

describe('the way below', () => {
  it('a prop may be a portal to a world tile, and a chunk prop\'s portal names a world tile too', () => {
    const map = load('content/core/map.json');
    map.map.props.push({ id: 'core/old-well', sprite: map.map.props[0].sprite, x: 5, y: 5, w: 1, h: 1, solid: false, portal: { x: 900, y: 1000 } });
    expect(validateFile(map)).toEqual([]);
    const c = chunk();
    c.chunk.props.push({ id: 'core/cave-1', sprite: 'core/base-kit:props/ruin_arch', x: 3, y: 4, w: 1, h: 1, solid: false, portal: { x: 1023, y: 1023 } } as never);
    expect(validateFile(c)).toEqual([]);
  });

  it('refuses a portal past the world and one with a field of its own', () => {
    const bad = (portal: unknown) => {
      const map = load('content/core/map.json');
      map.map.props.push({ id: 'core/old-well', sprite: map.map.props[0].sprite, x: 5, y: 5, w: 1, h: 1, solid: false, portal });
      return validateFile(map);
    };
    expect(bad({ x: 1024, y: 0 })).not.toEqual([]);
    expect(bad({ x: 0, y: -1 })).not.toEqual([]);
    expect(bad({ x: 0, y: 0, layer: 1 })).not.toEqual([]);
    expect(bad([0, 0])).not.toEqual([]);
  });

  it('a region may lie underground, and only as true', () => {
    const regionWith = (underground: unknown) => {
      const map = load('content/core/map.json');
      map.map.regions = [{ id: 'below', x: 0, y: 960, w: 64, h: 64, ...(underground === undefined ? {} : { underground }) }];
      return validateFile(map);
    };
    expect(regionWith(undefined)).toEqual([]);
    expect(regionWith(true)).toEqual([]);
    expect(regionWith(false)).not.toEqual([]);
    expect(regionWith(1)).not.toEqual([]);
  });
});
