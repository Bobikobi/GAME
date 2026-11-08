import { makeStepRule } from '@game/kernel';
import { validateFile } from '@game/schema';
import { describe, expect, it } from 'vitest';
import { chunkProblems } from '../src/chunks';
import { cut } from '../src/gen/cut';
import { G, Land, type Tile } from '../src/gen/grid';
import { CAVE_MOUTH, CROSSING, generate } from '../src/gen/land';
import { fbm, valueNoise } from '../src/gen/noise';
import { BRIDGE_RUN_MAX, RUN_MAX, longestRuns, repair, straightRuns } from '../src/gen/paths';
import { storySeed } from '../src/gen/rand';
import { focusTiles, render } from '../src/gen/render';
import { type StoryDef, parseStory, storyProblems } from '../src/gen/story';

const fixture: StoryDef = {
  id: 'core/test-wood',
  title: 'Test wood',
  seed: 'acorn',
  world: 'elf',
  origin: { cx: 2, cy: 2 },
  size: { w: 2, h: 2 },
  forest: 65,
  relief: 40,
  water: 40,
  caves: 2,
  entries: ['s', 'w'],
  ruins: 1,
};

describe('noise', () => {
  const seed = storySeed('acorn');
  it('is the same for the same seed and point, in 0..65535', () => {
    for (let i = 0; i < 50; i++) {
      const a = valueNoise(seed, 'h', i * 7, i * 3, 16);
      expect(a).toBe(valueNoise(seed, 'h', i * 7, i * 3, 16));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(65535);
      const f = fbm(seed, 'h', i * 7, i * 3, [32, 16, 8], [4, 2, 1]);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(65535);
    }
  });
  it('changes little between neighbours and much between seeds', () => {
    let maxStep = 0;
    let differ = 0;
    const other = storySeed('oak');
    for (let x = 0; x < 200; x++) {
      maxStep = Math.max(maxStep, Math.abs(valueNoise(seed, 'h', x + 1, 5, 16) - valueNoise(seed, 'h', x, 5, 16)));
      if (valueNoise(seed, 'h', x, 5, 16) !== valueNoise(other, 'h', x, 5, 16)) differ++;
    }
    expect(maxStep).toBeLessThan(65535 / 4);
    expect(differ).toBeGreaterThan(190);
  });
});

describe('repair', () => {
  it('breaks a straight road into runs no longer than the limit and keeps every step a neighbour', () => {
    const land = new Land(0, 0, 64, 64);
    const straight: Tile[] = Array.from({ length: 40 }, (_, i) => [10 + i, 20] as const);
    const fixed = repair(straight, ([x, y]) => land.inside(x, y));
    expect(fixed[0]).toEqual(straight[0]);
    expect(fixed[fixed.length - 1]).toEqual(straight[straight.length - 1]);
    for (let i = 1; i < fixed.length; i++) {
      const [ax, ay] = fixed[i - 1]!;
      const [bx, by] = fixed[i]!;
      expect(Math.abs(ax - bx) + Math.abs(ay - by)).toBe(1);
    }
    for (const run of straightRuns(fixed)) expect(run.length).toBeLessThanOrEqual(RUN_MAX);
    expect(longestRuns(land, fixed)[0]).toBeLessThanOrEqual(RUN_MAX);
  });
});

describe('story', () => {
  it('reads a sound story and names every fault of a bad one', () => {
    expect(storyProblems(fixture)).toEqual([]);
    const bad = { ...fixture, forest: 140, entries: ['n', 'n'], extra: 1 } as unknown;
    const problems = storyProblems(bad);
    expect(problems.some((p) => p.startsWith('forest:'))).toBe(true);
    expect(problems.some((p) => p.startsWith('entries:'))).toBe(true);
    expect(problems.some((p) => p.startsWith('extra:'))).toBe(true);
    expect(() => parseStory('{"id":"x"}')).toThrow(/not a story/);
  });
});

describe('generate', () => {
  const gen = generate(fixture);
  const { land, measure } = gen;

  it('gives the same land for the same story and another for another seed', () => {
    const again = generate(fixture);
    expect(JSON.stringify(cut(again))).toBe(JSON.stringify(cut(gen)));
    const other = generate({ ...fixture, seed: 'birch' });
    expect(other.land.ground.join('')).not.toBe(land.ground.join(''));
  });

  it('reaches every walkable tile from the roads in under the step rule (G68)', () => {
    expect(measure.unreachable).toBe(0);
    expect(measure.walkable).toBeGreaterThan((land.w * land.h) / 4);
    // the kernel's own rule agrees with the land's
    const levels = Array.from({ length: land.h }, (_, y) => Array.from({ length: land.w }, (_, x) => String(land.level(land.x0 + x, land.y0 + y))).join(''));
    const props = land.props.map((p) => ({ ...p, x: p.x - land.x0, y: p.y - land.y0 }));
    const bundle = { map: { width: land.w, height: land.h, levels, props } } as unknown as Parameters<typeof makeStepRule>[0];
    const step = makeStepRule(bundle);
    for (let y = 0; y < land.h - 1; y++) {
      for (let x = 0; x < land.w - 1; x++) {
        const [wx, wy] = [land.x0 + x, land.y0 + y];
        expect(land.canStep(wx, wy, wx + 1, wy)).toBe(step(x, y, x + 1, y));
        expect(land.canStep(wx, wy, wx, wy + 1)).toBe(step(x, y, x, y + 1));
      }
    }
  });

  it('winds its roads: no straight run past the rule, a bridge not past its own (G69)', () => {
    expect(measure.roads).toBe(fixture.entries.length);
    expect(measure.longestRun).toBeLessThanOrEqual(8);
    expect(measure.longestBridgeRun).toBeLessThanOrEqual(BRIDGE_RUN_MAX);
  });

  it('puts a crossing on the lower tile of every level change along a road', () => {
    for (const road of land.roads) {
      for (let i = 1; i < road.length; i++) {
        const [ax, ay] = road[i - 1]!;
        const [bx, by] = road[i]!;
        if (land.level(ax, ay) === land.level(bx, by)) continue;
        expect(land.canStep(ax, ay, bx, by)).toBe(true);
      }
    }
    const crossings = land.props.filter((p) => p.crossing);
    expect(crossings.length).toBe(land.crossings.size);
    expect(crossings.every((p) => p.sprite.endsWith(CROSSING))).toBe(true);
  });

  it('hides its cave mouths deep in the wood, far from the roads and from each other, each reached on foot', () => {
    const mouths = land.marks.filter((m) => m.kind === 'cave');
    expect(mouths.length).toBe(fixture.caves);
    const roads = land.roads.flat();
    for (const m of mouths) {
      expect(land.walkable(m.x, m.y)).toBe(true);
      let wall = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && [G.forest, G.mountain].includes(land.get(m.x + dx, m.y + dy) as typeof G.forest)) wall++;
      expect(wall).toBeGreaterThanOrEqual(5);
      expect(Math.min(...roads.map(([x, y]) => Math.abs(x - m.x) + Math.abs(y - m.y)))).toBeGreaterThanOrEqual(8);
      const prop = land.props.find((p) => p.x === m.x && p.y === m.y);
      expect(prop?.sprite.endsWith(CAVE_MOUTH)).toBe(true);
      expect(prop?.id).toMatch(/^core\/test-wood-cave-\d$/);
    }
    for (let i = 1; i < mouths.length; i++) {
      expect(Math.max(Math.abs(mouths[i]!.x - mouths[0]!.x), Math.abs(mouths[i]!.y - mouths[0]!.y))).toBeGreaterThan(12);
    }
  });

  it('varies the wood: denser and sparser blocks, more than one tree', () => {
    expect(measure.woodSpread[1] - measure.woodSpread[0]).toBeGreaterThanOrEqual(25);
    expect(measure.treeKinds).toBeGreaterThanOrEqual(2);
    // no three identical trunks in a row
    for (const p of land.props) {
      const b = land.props.find((q) => q.x === p.x + 1 && q.y === p.y && q.sprite === p.sprite && q.solid);
      const c = land.props.find((q) => q.x === p.x + 2 && q.y === p.y && q.sprite === p.sprite && q.solid);
      if (p.solid && b && c) throw new Error(`three ${p.sprite} in a row at ${p.x},${p.y}`);
    }
  });

  it('keeps props off the roads and never on a solid tile', () => {
    for (const p of land.props) {
      const ch = land.get(p.x, p.y);
      expect([G.path, G.bridge].includes(ch as typeof G.path) && !p.crossing).toBe(false);
      expect([G.forest, G.water, G.mountain].includes(ch as typeof G.forest)).toBe(false);
    }
  });

  it('cuts into chunk files the shape check and the schema accept', () => {
    const files = cut(gen);
    expect(files.length).toBe(fixture.size.w * fixture.size.h);
    for (const f of files) {
      expect(validateFile(f)).toEqual([]);
      expect(chunkProblems(f.chunk)).toEqual([]);
      expect(f.chunk.x % 64).toBe(0);
      expect(f.chunk.levels?.length).toBe(64);
    }
    const ids = files.flatMap((f) => f.chunk.props.map((p) => p.id).filter(Boolean));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('draws the phone-size picture with the clearing and a cave in its windows', () => {
    const [a, b] = focusTiles(gen);
    expect(land.marks.some((m) => m.kind === 'clearing' && m.x === a[0] && m.y === a[1])).toBe(true);
    expect(land.marks.some((m) => m.kind === 'cave' && m.x === b[0] && m.y === b[1])).toBe(true);
    const png = render(gen);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(390);
    expect(png.readUInt32BE(20)).toBe(844);
  });
});
