/**
 * The expedition content rules: one varied giver-less chain of its own with its
 * problems inside its place, danger, a climax and a safe exit (G36), never the
 * only road (G37), and its reward counted where the check asks what gives an item.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type Bundle, findSlot, inRect, makeWalkable } from '@game/kernel';
import { runCheck } from '../src/check';
import { CONTENT_DIR } from '../src/load';
import { RULES_PAGE, checkPlay } from '../src/play';

const EXPEDITION = 'test/expedition';
const PLACE = 'test/place';
const CLIMAX = 'test/climax';
/** An inscription inside the place: the chain's riddles read it. */
const STONE = 'test/hall-stone';
const QUESTS = ['test/one', 'test/two', 'test/three'] as const;
/** The place on the core map: the ruins south of the night threshold, its exit. */
const RECT = { x: 35, y: 21, w: 4, h: 5 };
const EXIT = 'core/night-threshold';
const WALL = 'core/base-kit:props/rock_mossy';

type Prop = Bundle['map']['props'][number];

/**
 * The core map seals the threshold's doorstep (36,21) with rubble on three sides, while the ruins open on the meadow
 * (the 14.10 audit). The fixtures open its south side (36,22), the way NEXT 14b plans, and wall the rest.
 */
function openDoorstep(ground: string[]): string[] {
  return ground.map((row, y) => (y === 22 ? row.slice(0, 36) + '#' + row.slice(37) : row));
}

let base: Bundle;

/**
 * Rocks that make the place one room entered from its exit only (G36): on every open tile beside the part of the place
 * the exit leads into, and on every tile of the place it does not lead into. Read with the doorstep open.
 */
function walls(b: Bundle): Prop[] {
  const walkable = makeWalkable({ ...b, map: { ...b.map, ground: openDoorstep(b.map.ground) } });
  const view = { restored: [] as string[], camp: [] as string[] };
  const exit = findSlot(b.map, EXIT)!;
  const steps = (x: number, y: number) => [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]] as const;
  // the part of the place the exit leads into, walking four ways
  const room = new Set<string>();
  const queue: [number, number][] = [];
  for (let x = exit.x; x < exit.x + exit.w; x++) queue.push([x, exit.y + exit.h]);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    if (!inRect(x, y, RECT) || room.has(`${x},${y}`) || !walkable(x, y, view)) continue;
    room.add(`${x},${y}`);
    queue.push(...steps(x, y).map(([nx, ny]) => [nx, ny] as [number, number]));
  }
  const rocks = new Map<string, Prop>();
  const rock = (x: number, y: number) => rocks.set(`${x},${y}`, { sprite: WALL, x, y, w: 1, h: 1, solid: true });
  for (let y = RECT.y; y < RECT.y + RECT.h; y++) {
    for (let x = RECT.x; x < RECT.x + RECT.w; x++) {
      if (!walkable(x, y, view)) continue;
      if (!room.has(`${x},${y}`)) {
        rock(x, y);
        continue;
      }
      for (const [nx, ny] of steps(x, y)) {
        if (!inRect(nx, ny, RECT) && !inRect(nx, ny, exit) && walkable(nx, ny, view)) rock(nx, ny);
      }
    }
  }
  return [...rocks.values()];
}

beforeAll(() => {
  const found = runCheck().assembled.bundle;
  if (!found) throw new Error('Content did not assemble into a bundle.');
  base = found;
});

function good(): Bundle {
  const b = structuredClone(base);
  b.map.ground = openDoorstep(b.map.ground);
  b.map.slots = [
    ...b.map.slots,
    { id: PLACE, kind: 'area', ...RECT },
    { id: CLIMAX, kind: 'ruin', x: 37, y: 24, w: 1, h: 1 },
  ];
  b.map.props = [
    ...b.map.props,
    { id: STONE, sprite: 'core/base-kit:props/standing_stone', x: 38, y: 22, w: 1, h: 1, solid: false, note: 'Four bells are cut in a row.' },
    ...walls(base),
  ];
  const source = b.quests['core/the-night-arch']!;
  const types = ['investigation', 'skill', 'tending'] as const;
  QUESTS.forEach((id, i) => {
    b.quests[id] = {
      ...source,
      id,
      giver: undefined,
      pocket: undefined,
      type: types[i]!,
      requires: i === 0 ? undefined : [QUESTS[i - 1]!],
      // read and answered inside the place
      steps: [{ kind: 'riddle', clue: 'The stone counts the bells.', props: [STONE], answer: { kind: 'visit', slot: CLIMAX, at: 'night' } }],
      reward: { rep: 0 },
    };
  });
  b.expeditions[EXPEDITION] = {
    id: EXPEDITION,
    creator: 'test',
    title: 'The night place',
    file: 'test',
    place: PLACE,
    window: { bells: [20, 23, 2, 4] },
    exit: EXIT,
    chain: [...QUESTS],
    climax: { slot: CLIMAX },
    reward: { items: [{ item: 'core/stone', qty: 1 }], opens: ['core/arch-way'] },
    on_miss: 'wait',
  };
  return b;
}

/** The lines that cite one rule of the rules page, G36 unless another is named. */
function messages(b: Bundle, rule = 'G36'): string {
  return checkPlay(b, {})
    .filter((issue) => issue.message.includes(`${RULES_PAGE} ${rule},`))
    .map((issue) => issue.message)
    .join('\n');
}

describe('expedition rules', () => {
  it('accepts a good expedition', () => {
    expect(messages(good())).toBe('');
    expect(messages(good(), 'G37')).toBe('');
  });

  it('refuses a repeated quest type', () => {
    const b = good();
    b.quests[QUESTS[2]]!.type = b.quests[QUESTS[1]]!.type;
    expect(messages(b)).toContain('type "skill" is repeated');
  });

  it('refuses a giver on a chain quest', () => {
    const b = good();
    b.quests[QUESTS[1]]!.giver = 'core/maru';
    expect(messages(b)).toContain('has a giver');
  });

  it('refuses an exit off safe ground', () => {
    const b = good();
    b.expeditions[EXPEDITION]!.exit = 'core/arch-mouth';
    expect(messages(b)).toContain('is not safe ground');
  });

  it('refuses an exit on the camp ground, which is safe only once a camp part stands', () => {
    const b = good();
    b.expeditions[EXPEDITION]!.exit = 'core/camp';
    expect(messages(b)).toContain('exit slot "core/camp" is not safe ground');
  });

  it('refuses a climax outside the place', () => {
    const b = good();
    b.expeditions[EXPEDITION]!.climax.slot = 'core/tangle-heart';
    expect(messages(b)).toContain('is not inside');
  });

  it('refuses bells out of ring order', () => {
    const b = good();
    b.expeditions[EXPEDITION]!.window.bells = [20, 2, 23, 4];
    expect(messages(b)).toContain('out of ring order');
  });

  it('refuses an expedition place with no hazard', () => {
    const b = good();
    b.map.props = b.map.props.filter((prop) => prop.hazard === undefined);
    expect(messages(b)).toContain('contains no hazard prop');
  });

  it('refuses a step of the chain that lies outside the place', () => {
    const b = good();
    b.quests[QUESTS[0]]!.steps = [
      { kind: 'visit', slot: 'core/town-square' },
      { kind: 'restore', restore: 'core/old-bridge' },
      { kind: 'build', camp: 'core/campfire' },
    ];
    // the arch's own riddle reads the stone north of the place
    b.quests[QUESTS[1]]!.steps = structuredClone(base.quests['core/the-night-arch']!.steps);
    const said = messages(b);
    expect(said).toContain(`quest "${QUESTS[0]}" has a visit step at "core/town-square", outside "${PLACE}"`);
    expect(said).toContain(`quest "${QUESTS[0]}" has a restore step at "core/old-bridge", outside "${PLACE}"`);
    expect(said).toContain(`quest "${QUESTS[0]}" has a build step at "core/campfire", outside "${PLACE}"`);
    expect(said).toContain(`quest "${QUESTS[1]}" has a riddle step at "core/arch-stone", outside "${PLACE}"`);
  });

  it('refuses a chain riddle answered outside the place and a fire kept outside it', () => {
    const b = good();
    const hearth = 'test/far-hearth';
    b.map.props = [...b.map.props, { id: hearth, sprite: 'core/base-kit:props/standing_stone', x: 30, y: 30, w: 1, h: 1, solid: true, fire: true }];
    const clue = 'The stone counts the bells.';
    // read inside the place, answered by standing at the arch north of it
    b.quests[QUESTS[0]]!.steps = [{ kind: 'riddle', clue, props: [STONE], answer: { kind: 'visit', slot: 'core/arch-mouth', at: 'night' } }];
    // read inside the place, answered by digging in the deep ruins east of it
    b.quests[QUESTS[1]]!.steps = [{ kind: 'riddle', clue, props: [STONE], answer: { kind: 'dig', treasure: 'core/ruins-deep' } }];
    b.quests[QUESTS[2]]!.steps = [{ kind: 'tend', fire: hearth }];
    const said = messages(b);
    expect(said).toContain(`quest "${QUESTS[0]}" has a riddle step at "core/arch-mouth", outside "${PLACE}"`);
    expect(said).toContain(`quest "${QUESTS[1]}" has a riddle step at "core/ruins-deep", outside "${PLACE}"`);
    expect(said).toContain(`quest "${QUESTS[2]}" has a tend step at "${hearth}", outside "${PLACE}"`);
  });

  it('accepts a chain riddle answered by a dig inside the place and a fire kept inside it', () => {
    const b = good();
    const hearth = 'test/hall-hearth';
    const floor = 'test/hall-floor';
    b.map.props = [...b.map.props, { id: hearth, sprite: 'core/base-kit:props/standing_stone', x: 36, y: 23, w: 1, h: 1, solid: true, fire: true }];
    b.treasures[floor] = { ...structuredClone(b.treasures['core/ruins-deep']!), id: floor, place: { slot: CLIMAX } };
    b.quests[QUESTS[1]]!.steps = [{ kind: 'riddle', clue: 'The stone counts the bells.', props: [STONE], answer: { kind: 'dig', treasure: floor } }];
    b.quests[QUESTS[2]]!.steps = [{ kind: 'tend', fire: hearth }];
    expect(messages(b)).toBe('');
  });

  it('refuses a second way into the place, and an exit that opens onto none of it', () => {
    const b = good();
    // one rock of the wall taken away: the place can be walked into beside its exit
    const gap = walls(base).find((r) => !inRect(r.x, r.y, RECT))!;
    b.map.props = b.map.props.filter((p) => !(p.sprite === WALL && p.x === gap.x && p.y === gap.y));
    expect(messages(b)).toContain(`"${PLACE}" can be walked into from (${gap.x},${gap.y}), not only from its exit "${EXIT}"`);

    const shut = good();
    // the place's row under the threshold filled with rock: the exit opens onto nothing
    for (let x = RECT.x; x < RECT.x + RECT.w; x++) shut.map.props.push({ sprite: WALL, x, y: RECT.y, w: 1, h: 1, solid: true });
    expect(messages(shut)).toContain(`no walkable tile of "${PLACE}" touches its exit "${EXIT}"`);
  });

  it('refuses a back door a passable restore opens once mended, unless the expedition\'s own reward opens it', () => {
    const b = good();
    const gap = walls(base).find((r) => !inRect(r.x, r.y, RECT))!;
    const door = 'test/back-door';
    b.map.slots = [...b.map.slots, { id: door, kind: 'restore', x: gap.x, y: gap.y, w: 1, h: 1 }];
    b.restores[door] = { ...structuredClone(b.restores['core/old-bridge']!), id: door, place: { slot: door }, passable: true };
    expect(messages(b)).toContain(`"${PLACE}" can be walked into from (${gap.x},${gap.y}), not only from its exit "${EXIT}", by day or once the valley's restores are mended`);

    b.expeditions[EXPEDITION]!.reward.opens = [...(b.expeditions[EXPEDITION]!.reward.opens ?? []), door];
    expect(messages(b)).not.toContain('can be walked into');
  });

  it('refuses an exit whose corner, where the walk-out sets the player, cannot be stood on', () => {
    const b = good();
    const exit = b.map.slots.find((slot) => slot.id === EXIT)!;
    b.map.props.push({ sprite: WALL, x: exit.x, y: exit.y, w: 1, h: 1, solid: true });
    expect(messages(b)).toContain(`the walk-out sets the player on (${exit.x},${exit.y}), the corner of "${EXIT}", and no one can stand there`);
  });

  it('refuses a chain quest that opens a restore outside the place', () => {
    const b = good();
    b.quests[QUESTS[1]]!.reward.opens = ['core/old-bridge'];
    expect(messages(b)).toContain(`quest "${QUESTS[1]}" opens "core/old-bridge", outside "${PLACE}"`);
  });

  it('refuses a find in the chain whose item is found only outside the place, and accepts it once it grows inside', () => {
    const b = good();
    // a resource none of whose nodes stands inside the place
    const outside = Object.values(b.resources).find(
      (r) => !Object.values(b.instances).some((i) => i.kind === 'resource' && b.resources[i.source]?.output === r.output && inRect(i.x, i.y, RECT)),
    )!;
    b.quests[QUESTS[1]]!.steps = [{ kind: 'find', item: outside.output, clue: 'It grows where the bells are loudest.' }];
    expect(messages(b)).toContain(`quest "${QUESTS[1]}" has a find step for "${outside.output}", which nothing inside "${PLACE}" gives`);

    b.instances['test/hall-node'] = { source: outside.id, kind: 'resource', x: 36, y: 23 };
    expect(messages(b)).toBe('');
  });

  it('refuses a quest of another expedition\'s chain', () => {
    const b = good();
    b.expeditions['test/other'] = { ...structuredClone(b.expeditions[EXPEDITION]!), id: 'test/other' };
    const said = messages(b);
    expect(said).toContain(`quest "${QUESTS[1]}" is also in the chain of "test/other"`);
    expect(said).toContain(`quest "${QUESTS[1]}" is also in the chain of "${EXPEDITION}"`);
  });
});

describe('an expedition is never the only road (G37)', () => {
  const SHARD = 'test/bell-shard';

  it('refuses a chain quest under another creator\'s name', () => {
    const b = good();
    const borrowed = 'other/two';
    b.quests[borrowed] = { ...structuredClone(b.quests[QUESTS[1]]!), id: borrowed };
    b.quests[QUESTS[2]]!.requires = [borrowed];
    b.expeditions[EXPEDITION]!.chain = [QUESTS[0], borrowed, QUESTS[2]];
    expect(messages(b, 'G37')).toContain(`quest "${borrowed}" is not under "test/"`);
  });

  it('refuses a quest of the opening in the chain', () => {
    const b = good();
    b.quests[QUESTS[0]]!.pocket = 'core/west-bank';
    expect(messages(b, 'G37')).toContain(`quest "${QUESTS[0]}" is part of the opening`);
  });

  it('refuses a restore whose input only the expedition gives, its chain included, until another road gives it', () => {
    const b = good();
    b.items[SHARD] = { ...structuredClone(b.items['core/stone']!), id: SHARD };
    b.restores['test/stair'] = { ...structuredClone(b.restores['core/old-bridge']!), id: 'test/stair', inputs: [{ item: SHARD, qty: 2 }] };
    b.expeditions[EXPEDITION]!.reward.items = [{ item: SHARD, qty: 1 }];
    const refused = `only an expedition gives "${SHARD}"`;
    expect(messages(b, 'G37')).toContain(refused);

    // a quest of the chain begins only inside the place: it is the expedition too
    b.expeditions[EXPEDITION]!.reward.items = [];
    b.quests[QUESTS[2]]!.reward.items = [{ item: 'core/trowel', qty: 1, instead: SHARD }];
    expect(messages(b, 'G37')).toContain(refused);

    // a quest of the day is another road
    b.quests['core/the-night-arch']!.reward.items = [{ item: SHARD, qty: 1 }];
    expect(messages(b, 'G37')).toBe('');
  });

  it('refuses a quest of the day that asks for what only the expedition gives', () => {
    const b = good();
    b.items[SHARD] = { ...structuredClone(b.items['core/stone']!), id: SHARD };
    b.expeditions[EXPEDITION]!.reward.items = [{ item: SHARD, qty: 1 }];
    const day = 'test/day-bring';
    b.quests[day] = { ...structuredClone(b.quests['core/the-night-arch']!), id: day, steps: [{ kind: 'bring', item: SHARD, qty: 1 }] };
    expect(messages(b, 'G37')).toContain(`only an expedition gives "${SHARD}": a quest of the day would wait on the expedition`);

    // a find asks for it as much as a bring
    b.quests[day]!.steps = [{ kind: 'find', item: SHARD, clue: 'A shard of the bell lies where it fell.' }];
    expect(messages(b, 'G37')).toContain(`only an expedition gives "${SHARD}": a quest of the day would wait on the expedition`);
  });

  it('refuses a quest of the day that requires a quest of the chain, and counts nothing it gives as a road by day', () => {
    const b = good();
    const day = 'test/day-after';
    b.items[SHARD] = { ...structuredClone(b.items['core/stone']!), id: SHARD };
    b.restores['test/stair'] = { ...structuredClone(b.restores['core/old-bridge']!), id: 'test/stair', inputs: [{ item: SHARD, qty: 2 }] };
    b.expeditions[EXPEDITION]!.reward.items = [{ item: SHARD, qty: 1 }];
    b.quests[day] = { ...structuredClone(b.quests['core/the-night-arch']!), id: day, requires: [QUESTS[2]], reward: { rep: 0, items: [{ item: SHARD, qty: 1 }] } };
    const said = messages(b, 'G37');
    expect(said).toContain(`"${QUESTS[2]}" is a quest of an expedition's chain: a quest of the day would wait on the expedition`);
    expect(said).toContain(`only an expedition gives "${SHARD}"`);
  });

  it('refuses a place that opens by no hand when only the expedition opens it, until a quest of the day opens it too', () => {
    const b = good();
    const vault = 'test/vault';
    b.restores[vault] = { ...structuredClone(b.restores['core/old-bridge']!), id: vault, inputs: [] };
    b.expeditions[EXPEDITION]!.reward.opens = [vault];
    expect(messages(b, 'G37')).toContain(`only an expedition opens "${vault}"`);

    b.quests['core/the-night-arch']!.reward.opens = [...(b.quests['core/the-night-arch']!.reward.opens ?? []), vault];
    expect(messages(b, 'G37')).toBe('');
  });

  it('accepts a restore a quest of the day opens, whatever it needs by hand', () => {
    const b = good();
    b.items[SHARD] = { ...structuredClone(b.items['core/stone']!), id: SHARD };
    b.restores['test/stair'] = { ...structuredClone(b.restores['core/old-bridge']!), id: 'test/stair', inputs: [{ item: SHARD, qty: 2 }] };
    b.expeditions[EXPEDITION]!.reward.items = [{ item: SHARD, qty: 1 }];
    b.quests['core/the-night-arch']!.reward.opens = [...(b.quests['core/the-night-arch']!.reward.opens ?? []), 'test/stair'];
    expect(messages(b, 'G37')).toBe('');
  });
});

describe('what an expedition gives, in the content check', () => {
  const root = mkdtempSync(join(tmpdir(), 'openfold-expedition-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
  cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });

  // the place, its climax and an inscription its riddles read, on a copy of the core map
  const mapPath = join(root, 'core', 'map.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf8')) as { map: { ground: string[]; slots: object[]; props: object[] } };
  map.map.ground = openDoorstep(map.map.ground);
  // the rocks seal the room off the place's one door (the arch, DECISIONS 2026-10-16): in this copy the west wall comes
  // down, and so does the hall's north wall (row 27), so the rest of the walled ruins keeps a road out and the wolf's
  // chase still ends (G34)
  map.map.props = map.map.props.filter((p) => {
    const q = p as { sprite: string; x: number; y: number };
    if (q.sprite.endsWith('/ruin_wall') && q.y === 27 && q.x >= 35) return false;
    return !(q.sprite.endsWith('/ruin_pillar') && q.x === 32 && q.y >= 21 && q.y <= 30);
  });
  map.map.slots.push({ id: 'core/test-hall', kind: 'area', x: 35, y: 21, w: 4, h: 5 }, { id: 'core/test-altar', kind: 'ruin', x: 37, y: 24, w: 1, h: 1 });
  map.map.props.push(...walls(runCheck().assembled.bundle!), {
    id: 'core/test-hall-stone',
    sprite: 'core/base-kit:props/standing_stone',
    x: 38,
    y: 22,
    w: 1,
    h: 1,
    solid: false,
    note: 'Four bells are cut in a row.',
  });
  writeFileSync(mapPath, JSON.stringify(map, null, 2));

  const ext = join(root, 'extensions', 'tester');
  const write = (dir: string, name: string, body: unknown) => {
    mkdirSync(join(ext, dir), { recursive: true });
    writeFileSync(join(ext, dir, `${name}.json`), JSON.stringify(body));
  };
  const envelope = (type: string, name: string) => ({ format: 1, type, id: `tester/${name}`, title: name, creator: 'tester' });
  const look = (name: string) => ({
    id: `tester/${name}`,
    name,
    kind: 'material',
    rarity: 'common',
    class: 'garment',
    tier: 1,
    sprite: 'core/base-kit:items/herb',
    wear: { slot: 'head', look: true },
    premium_later: true,
  });

  write('items', 'items', {
    ...envelope('items', 'items'),
    items: [
      { id: 'tester/bell-shard', name: 'bell shard', kind: 'material', rarity: 'common', class: 'relic', tier: 1, sprite: 'core/base-kit:items/herb' },
      // given in place of a trowel to a start whose kit holds one: only the expedition gives it
      look('bell-veil'),
      // given by nothing at all
      look('lost-veil'),
    ],
  });
  const chain = ['hall-one', 'hall-two', 'hall-three'];
  const types = ['investigation', 'skill', 'tending'];
  chain.forEach((name, i) =>
    write('quests', name, {
      ...envelope('quest', name),
      quest: {
        type: types[i],
        summary: 'The stone in the hall counts the bells.',
        ...(i === 0 ? {} : { requires: [`tester/${chain[i - 1]}`] }),
        steps: [
          {
            kind: 'riddle',
            clue: 'The stone in the hall counts the bells.',
            props: ['core/test-hall-stone'],
            answer: { kind: 'visit', slot: 'core/test-altar', at: 'night' },
          },
        ],
        reward: { rep: 0 },
      },
    }),
  );
  write('expeditions', 'bell-hall', {
    ...envelope('expedition', 'bell-hall'),
    expedition: {
      place: 'core/test-hall',
      window: { bells: [20, 23, 2, 4] },
      exit: 'core/night-threshold',
      chain: chain.map((name) => `tester/${name}`),
      climax: { slot: 'core/test-altar' },
      reward: {
        items: [
          { item: 'tester/bell-shard', qty: 1 },
          { item: 'core/trowel', qty: 1, instead: 'tester/bell-veil' },
        ],
      },
      on_miss: 'wait',
    },
  });
  // a place mended by hand with what only the expedition gives
  write('restores', 'edge-house', {
    ...envelope('restore', 'edge-house'),
    restore: {
      place: { slot: 'core/town-edge' },
      before: 'core/base-kit:tiles/rubble',
      after: 'core/base-kit:tiles/ruin_floor',
      inputs: [{ item: 'tester/bell-shard', qty: 1 }],
      active_ms: 1000,
      passable: true,
    },
  });

  const result = runCheck(root);
  const errors = result.issues.filter((i) => i.level === 'error');

  it('R7: what an expedition gives is given', () => {
    expect(errors.filter((i) => i.message === 'nothing in the world gives "tester/bell-shard"')).toEqual([]);
  });

  it('G39: a premium look an expedition gives in place of a kit item stays obtainable, and the line names the expedition among the roads', () => {
    expect(errors.filter((i) => i.where === 'items.tester/bell-veil.premium_later')).toEqual([]);
    expect(errors.filter((i) => i.where === 'items.tester/lost-veil.premium_later').map((i) => i.message)).toEqual([
      'a look with the premium marker stays obtainable in the game: a node, a dig spot, a recipe, a shop for gold, a quest or an expedition gives it (G39)',
    ]);
  });

  it('G37: the place that needs it is refused, and nothing else in the world is', () => {
    const g37 = errors.filter((i) => i.message.includes(`${RULES_PAGE} G37,`));
    expect(g37.map((i) => [i.file.endsWith('edge-house.json'), i.where])).toEqual([[true, 'restore.inputs.0']]);
    expect(g37[0]!.message).toContain('only an expedition gives "tester/bell-shard"');
    const others = errors.filter((i) => !g37.includes(i) && i.where !== 'items.tester/lost-veil.premium_later');
    expect(others).toEqual([]);
  });
});
