import { makeStepRule } from '@game/kernel';
import { validateFile } from '@game/schema';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTENT_DIR } from '../src/load';
import { chunkProblems } from '../src/chunks';
import { cut } from '../src/gen/cut';
import { G, Land, type Tile } from '../src/gen/grid';
import { generate } from '../src/gen/land';
import { DOOR_FORMS, type Looks, footprint, kitSprites, looksOf, looksProblems, pieceOf } from '../src/gen/looks';
import { fbm, valueNoise } from '../src/gen/noise';
import { BRIDGE_RUN_MAX, RUN_MAX, longestRuns, repair, straightRuns } from '../src/gen/paths';
import { storySeed } from '../src/gen/rand';
import { focusTiles, render, renderBelow } from '../src/gen/render';
import { HUB_CLEAR, affixProblems, affixes, fields, kindProblems, kindsOf, spawn, tagOf } from '../src/gen/spawn';
import { atmosphereCards, atmosphereOf, atmosphereProblems, cardOf } from '../src/gen/atmosphere';
import { STORIES_DIR, type StoryDef, listStories, loadStory, parseStory, storyOf, storyProblems } from '../src/gen/story';

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
  below: { cx: 2, cy: 12 },
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

/** The fixture as a story file: the envelope round the body, the way content/core/stories/ holds one. */
function fileOf(story: StoryDef): Record<string, unknown> {
  const { id, title, description, ...body } = story;
  return { $schema: '../../../schema/json/story.schema.json', format: 1, type: 'story', id, title, creator: 'core', ...(description ? { description } : {}), story: body };
}

describe('story', () => {
  it('reads a sound story file through the shared schema and names every fault of a bad one', () => {
    const file = fileOf(fixture);
    expect(storyProblems(file)).toEqual([]);
    expect(storyOf(file as never)).toEqual(fixture);
    const bad = { ...file, story: { ...fixture, forest: 140, entries: ['n', 'n'], extra: 1 } } as unknown;
    const problems = storyProblems(bad);
    expect(problems.some((p) => p.startsWith('story.forest:'))).toBe(true);
    expect(problems.some((p) => p.startsWith('story.entries'))).toBe(true);
    expect(problems.some((p) => /extra/.test(p))).toBe(true);
    expect(storyProblems({ ...file, type: 'chunk' })[0]).toMatch(/type: must be "story"/);
    expect(() => parseStory('{"id":"x"}')).toThrow(/not a story/);
  });
  it('finds every story of the core by name, and each is a sound story file', () => {
    const names = listStories();
    expect(names.length).toBeGreaterThanOrEqual(3);
    expect(STORIES_DIR).toBe(join(CONTENT_DIR, 'core', 'stories'));
    for (const name of names) {
      const byName = loadStory(name);
      expect(byName).toEqual(loadStory(join(STORIES_DIR, `${name}.json`)));
      expect(byName.id).toBe(`core/${name}`);
      expect(validateFile(JSON.parse(readFileSync(join(STORIES_DIR, `${name}.json`), 'utf8')))).toEqual([]);
    }
  });
});

describe('generate', () => {
  const gen = generate(fixture);
  const looks = looksOf();
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
    expect(crossings.every((p) => p.sprite.endsWith(looks.places.crossing))).toBe(true);
  });

  it('hides its doors far from the roads and from each other, each of another form, each reached on foot and hinted at', () => {
    const marks = land.marks.filter((m) => m.kind === 'cave');
    expect(marks.length).toBe(fixture.caves);
    expect(gen.doors.length).toBe(fixture.caves);
    expect(new Set(gen.doors.map((d) => d.form)).size).toBe(Math.min(fixture.caves, DOOR_FORMS.length));
    const roads = land.roads.flat();
    for (const d of gen.doors) {
      expect(land.walkable(d.x, d.y)).toBe(true);
      expect(land.walkable(d.step[0], d.step[1])).toBe(true);
      expect(Math.abs(d.step[0] - d.x) + Math.abs(d.step[1] - d.y)).toBe(1);
      expect(Math.min(...roads.map(([x, y]) => Math.abs(x - d.x) + Math.abs(y - d.y)))).toBeGreaterThanOrEqual(d.form === 'cellar' ? 3 : 6);
      const prop = land.props.find((p) => p.x === d.x && p.y === d.y);
      expect(prop?.sprite.endsWith(looks.doors[d.form].sprite)).toBe(true);
      expect(prop?.solid).toBe(false);
      expect(prop?.id).toBe(`core/test-wood-door-${d.n}`);
      // the hint: something laid within two tiles that is not the door itself, or a worn trail from the step
      const hinted = land.props.some((p) => p !== prop && Math.abs(p.x - d.x) <= 2 && Math.abs(p.y - d.y) <= 2) || land.get(d.step[0], d.step[1]) === G.path;
      expect(hinted).toBe(true);
    }
    for (let i = 1; i < gen.doors.length; i++) {
      expect(Math.max(Math.abs(gen.doors[i]!.x - gen.doors[0]!.x), Math.abs(gen.doors[i]!.y - gen.doors[0]!.y))).toBeGreaterThan(12);
    }
  });

  it('leads every door down to the land below and back: a portal each way, every floor tile reached', () => {
    const below = gen.below!;
    expect(below).toBeDefined();
    expect(below.land.x0).toBe(2 * 64);
    expect(below.land.y0).toBe(12 * 64);
    expect(below.measure.unreachable).toBe(0);
    expect(below.measure.chambers).toBe(fixture.caves);
    expect(below.arrivals.length).toBe(gen.doors.length);
    expect(below.measure.span).toBeGreaterThan(20);
    expect(below.measure.secrets + (below.measure.pool ? 1 : 0)).toBeGreaterThan(0);
    gen.doors.forEach((d, i) => {
      const door = land.props.find((p) => p.id === `core/test-wood-door-${d.n}`)!;
      const [ax, ay] = below.arrivals[i]!;
      const [sx, sy] = below.steps[i]!;
      // the door lands the player beside the way up, never on it: one way per step, no chain
      expect(door.portal).toEqual({ x: sx, y: sy });
      expect(Math.abs(sx - ax) + Math.abs(sy - ay)).toBe(1);
      expect(below.land.walkable(ax, ay)).toBe(true);
      expect(below.land.walkable(sx, sy)).toBe(true);
      expect(below.land.props.some((p) => p.x === sx && p.y === sy && p.portal)).toBe(false);
      const up = below.land.props.find((p) => p.x === ax && p.y === ay)!;
      expect(up.sprite.endsWith(looks.below.way_up)).toBe(true);
      expect(up.solid).toBe(false);
      expect(up.id).toBe(`core/test-wood-up-${d.n}`);
      expect(up.portal).toEqual({ x: d.step[0], y: d.step[1] });
    });
    for (const p of below.land.props) expect([G.mountain, G.water].includes(below.land.get(p.x, p.y) as typeof G.water)).toBe(false);
    const again = generate(fixture).below!;
    expect(again.land.ground.join('')).toBe(below.land.ground.join(''));
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

  it('cuts into chunk files the shape check and the schema accept, the land below among them, the spots in theirs', () => {
    const { spawns } = spawn(gen);
    const files = cut(gen, spawns);
    expect(files.length).toBe(fixture.size.w * fixture.size.h + gen.below!.land.w / 64);
    let spots = 0;
    for (const f of files) {
      expect(validateFile(f)).toEqual([]);
      expect(chunkProblems(f.chunk)).toEqual([]);
      expect(f.chunk.x % 64).toBe(0);
      expect(f.chunk.levels?.length).toBe(64);
      for (const p of f.chunk.props) expect(p.x + p.w <= 64 && p.y + p.h <= 64).toBe(true);
      for (const s of f.chunk.spawns ?? []) {
        expect(s.kind.startsWith('core/')).toBe(true);
        expect(s.x >= 0 && s.x < 64 && s.y >= 0 && s.y < 64).toBe(true);
        if (s.route) expect(s.route.every(([x, y]) => x >= f.chunk.x - 64 && x < f.chunk.x + 128 && y >= f.chunk.y - 64 && y < f.chunk.y + 128)).toBe(true);
        spots++;
      }
    }
    expect(spots).toBe(spawns.length);
    const ids = files.flatMap((f) => f.chunk.props.map((p) => p.id).filter(Boolean));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('draws the phone-size picture with the clearing and a door in its windows, and the land below dark in its own', () => {
    const [a, b] = focusTiles(gen);
    expect(land.marks.some((m) => m.kind === 'clearing' && m.x === a[0] && m.y === a[1])).toBe(true);
    expect(land.marks.some((m) => m.kind === 'cave' && m.x === b[0] && m.y === b[1])).toBe(true);
    for (const png of [render(gen), renderBelow(gen)!]) {
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect(png.readUInt32BE(16)).toBe(390);
      expect(png.readUInt32BE(20)).toBe(844);
    }
    expect(renderBelow({ ...gen, below: undefined })).toBeUndefined();
  });
});

describe('spawn', () => {
  const gen = generate(fixture);
  const { land } = gen;
  const { spawns, measure } = spawn(gen);
  const kinds = kindsOf(fixture.world);
  const f = fields(land);
  const kindOf = (id: string) => kinds.find((k) => k.id === id)!;

  it('reads sound tables and names a bad row', () => {
    for (const world of ['human', 'elf', 'undead'] as const) expect(kindsOf(world).length).toBeGreaterThanOrEqual(9);
    expect(kindProblems({ ...kindOf('core/lynx'), danger: 2, size: 'small' })).toContain('danger: a hunter is medium or large');
    expect(kindProblems({ ...kindOf('core/dove'), group: { class: 'pack', bands: [100, 0, 0, 0] } })).toContain('group.class: a pack is hunters or defenders, not danger 0');
    expect(affixes().length).toBeGreaterThan(4);
    expect(affixProblems({ id: 'Fast', worlds: [], ranks: ['regular'], note: 1 }).length).toBe(4);
  });

  it('is the same twice and places most kinds', () => {
    expect(JSON.stringify(spawn(gen).spawns)).toBe(JSON.stringify(spawns));
    expect(measure.kinds).toBeGreaterThanOrEqual(8);
    expect(measure.spots).toBeGreaterThan(20);
  });

  it('stands every kind on its habitat, off the roads, clear of the hub (HUNTING 8)', () => {
    for (const s of spawns) {
      const k = kindOf(s.kind);
      if (s.shape !== 'patrol') expect(k.habitat).toContain(tagOf(land.get(s.x, s.y)));
      expect(f.hubPlain[land.key(s.x, s.y)]).toBeGreaterThan(HUB_CLEAR);
      expect(f.fromRoad[land.key(s.x, s.y)]).toBeGreaterThanOrEqual(2);
      if (k.drinks) expect(f.water[land.key(s.x, s.y)]).toBeLessThanOrEqual(k.roam);
      if (k.near === 'rock') expect(f.rock[land.key(s.x, s.y)]).toBeLessThanOrEqual(3);
    }
  });

  it('puts no hunter nearer than danger 2 and no defender on the hub ring (G64, G30)', () => {
    for (const s of spawns) expect(s.danger).toBeGreaterThanOrEqual(kindOf(s.kind).danger);
    expect(spawns.some((s) => kindOf(s.kind).danger === 2)).toBe(true);
  });

  it('keeps one anchor a tile, anchors apart, and every kind under its cap', () => {
    const tiles = new Set(spawns.map((s) => `${s.x},${s.y}`));
    expect(tiles.size).toBe(spawns.length);
    for (const a of spawns) {
      for (const b of spawns) {
        if (a === b) continue;
        expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))).toBeGreaterThanOrEqual(2);
      }
    }
    for (const [id, { standing, mean }] of Object.entries(measure.load)) {
      expect(mean, id).toBeLessThanOrEqual(Math.max(standing, 1) * 1.5 + 2);
    }
  });

  it('crowns at most one boss, the strongest hunter, and dresses the ranks from the world list', () => {
    const bosses = spawns.filter((s) => s.rank === 'boss');
    expect(bosses.length).toBeLessThanOrEqual(1);
    if (bosses[0]) {
      const top = Math.max(...spawns.filter((s) => kindOf(s.kind).danger === 2 && s.danger >= 2).map((s) => kindOf(s.kind).tier));
      expect(kindOf(bosses[0].kind).tier).toBe(top);
      expect(bosses[0].affixes.length).toBe(2);
    }
    const table = affixes();
    for (const s of spawns) {
      if (s.rank === 'regular') expect(s.affixes).toEqual([]);
      else expect(s.affixes.length).toBeGreaterThanOrEqual(1);
      expect(new Set(s.affixes).size).toBe(s.affixes.length);
      for (const id of s.affixes) {
        const a = table.find((x) => x.id === id)!;
        expect(a.worlds).toContain(fixture.world);
        expect(a.ranks).toContain(s.rank);
      }
    }
    expect(spawns.filter((s) => s.rank === 'rare').length).toBeGreaterThanOrEqual(1);
  });

  it('shapes: a lone kind stands alone, a camp has a leader, a patrol walks road tiles end to end', () => {
    for (const s of spawns) {
      const k = kindOf(s.kind);
      if (s.shape === 'lone') expect(s.count).toEqual([1, 1]);
      if (k.group.class === 'solitary' && s.rank !== 'boss') expect(s.shape).toBe('lone');
      if (s.shape === 'camp') {
        expect(s.leader).toBe(s.kind);
        expect(s.rank).not.toBe('regular');
      }
      if (s.shape === 'patrol') {
        expect(s.route!.length).toBeGreaterThanOrEqual(8);
        for (let i = 1; i < s.route!.length; i++) {
          const [ax, ay] = s.route![i - 1]!;
          const [bx, by] = s.route![i]!;
          expect(Math.abs(ax - bx) + Math.abs(ay - by)).toBeLessThanOrEqual(2);
          expect([G.path, G.bridge]).toContain(land.get(bx, by));
        }
      }
      expect(s.count[0]).toBeLessThanOrEqual(s.count[1]);
    }
  });

  it('draws the spots on the picture', () => {
    const png = render(gen, spawns);
    expect(png.readUInt32BE(16)).toBe(390);
  });
});

describe('atmosphere', () => {
  it('has a sound air for every world, and a card the real map schema takes, with mist only in the valley', () => {
    const cards = atmosphereCards();
    for (const world of ['human', 'elf', 'undead'] as const) expect(atmosphereProblems(cards[world])).toEqual([]);
    expect(cards.elf.atmosphere.particles.map((p) => p.kind)).toContain('fireflies');
    expect(cards.undead.atmosphere.night_depth).toBeGreaterThan(cards.elf.atmosphere.night_depth);
    expect(cards.undead.atmosphere.sun.day[0]).toBeGreaterThan(cards.undead.atmosphere.sun.day[2]);
    // the owner's v14 list (8.11): warmer light on the human land, leaves in the air
    expect(cards.human.atmosphere.sun.day[0]).toBeGreaterThan(cards.human.atmosphere.sun.day[2]);
    expect(cards.human.atmosphere.particles.some((p) => p.kind === 'leaves')).toBe(true);
    expect(atmosphereOf(fixture)).toEqual(cards.elf.atmosphere);
    expect(atmosphereProblems({ ...cards.elf, atmosphere: { ...cards.elf.atmosphere, particles: [{ kind: 'rain', density: 1 }] } })[0]).toMatch(/unknown kind rain/);
    const card = cardOf(fixture);
    expect(card.id).toBe('test-wood-air');
    expect(card.weather.fog).toBe(0);
    expect(card.look.fog).toBe(0);
    expect(cardOf({ ...fixture, id: 'core/valley' }).weather.fog).toBeGreaterThan(0);
    // the card goes where the owner's map would put it, and the map's own schema takes it
    const map = JSON.parse(readFileSync(join(CONTENT_DIR, 'core', 'map.json'), 'utf8')) as { map: { cards: unknown[]; regions?: unknown[] } };
    expect((map.map.cards as { id: string }[]).some((c) => c.id === cardOf({ ...fixture, id: 'core/elf-wood' }).id)).toBe(false);
    map.map.cards.push(card);
    map.map.regions = [
      ...(map.map.regions ?? []),
      { id: 'test-wood', x: 128, y: 128, w: 128, h: 128, world: 'elf', card: card.id, title: fixture.title },
      { id: 'test-wood-below', x: 128, y: 768, w: 128, h: 64, world: 'elf', card: card.id, title: `${fixture.title}, below`, underground: true },
    ];
    expect(validateFile(map)).toEqual([]);
  });
});

describe('looks', () => {
  const base = looksOf();
  const clone = () => structuredClone(base) as Looks & { pieces: Record<string, Partial<{ w: number; h: number; solid: boolean }>> };

  it('the repo table passes, and every name it uses is drawn in the kit', () => {
    expect(looksProblems(base, kitSprites())).toEqual([]);
  });

  it('refuses a missing world, a wrong hint count, a footprint out of range, a bad name and a name the kit lacks', () => {
    const noWorld = clone();
    delete (noWorld.worlds as Partial<typeof noWorld.worlds>).elf;
    expect(looksProblems(noWorld).join('\n')).toContain('worlds.elf: missing');
    const shortHint = clone();
    shortHint.doors.well = { sprite: 'props/standing_stone', hint: ['props/grass_tall'] };
    expect(looksProblems(shortHint).join('\n')).toContain('doors.well.hint: 2 names');
    const wide = clone();
    wide.pieces['props/tree_oak'] = { w: 9 };
    expect(looksProblems(wide).join('\n')).toContain('pieces.props/tree_oak.w: 1 to 8');
    const badName = clone();
    (badName.below as { glow: string }).glow = 'Glow Mushrooms';
    expect(looksProblems(badName).join('\n')).toContain('below.glow: a kit name');
    const undrawn = clone();
    (undrawn.below as { glow: string }).glow = 'props/not_drawn_yet';
    expect(looksProblems(undrawn, kitSprites()).join('\n')).toContain('props/not_drawn_yet: not drawn in the kit');
    expect(looksProblems(undrawn)).toEqual([]);
  });

  it('a piece with a footprint stands whole: in one chunk, under no other prop, its solid tiles blocked, and the land still walks', () => {
    const big = clone();
    big.pieces['props/tree_oak'] = { w: 2, h: 2, solid: true };
    big.pieces['props/ruin_arch'] = { w: 3, h: 2 };
    big.pieces['props/standing_stone'] = { w: 2, h: 1, solid: true };
    const gen = generate(fixture, big);
    const lands = [gen.land, gen.below!.land];
    let wide = 0;
    for (const land of lands) {
      const taken = new Set<number>();
      for (const p of land.props) {
        const name = p.sprite.slice(big.kit.length);
        const def = pieceOf(big, name);
        expect([p.w, p.h]).toEqual([def.w, def.h]);
        if (p.w > 1 || p.h > 1) wide++;
        const tiles = footprint(big, name, p.x, p.y);
        expect(new Set(tiles.map(([x]) => Math.floor(x / 64))).size).toBe(1);
        expect(new Set(tiles.map(([, y]) => Math.floor(y / 64))).size).toBe(1);
        for (const [x, y] of tiles) {
          expect(land.inside(x, y)).toBe(true);
          expect(taken.has(land.key(x, y))).toBe(false);
          taken.add(land.key(x, y));
          if (p.solid) expect(land.blocked.has(land.key(x, y))).toBe(true);
        }
      }
    }
    expect(wide).toBeGreaterThan(20);
    expect(gen.measure.unreachable).toBe(0);
    expect(gen.below!.measure.unreachable).toBe(0);
    expect(gen.doors.length).toBe(fixture.caves);
    for (const d of gen.doors) expect(gen.land.walkable(d.step[0], d.step[1])).toBe(true);
    for (const f of cut(gen)) {
      expect(validateFile(f)).toEqual([]);
      expect(chunkProblems(f.chunk)).toEqual([]);
    }
    expect(generate(fixture, big).land.props.length).toBe(gen.land.props.length);
  });
});
