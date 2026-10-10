import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Action,
  type Bundle,
  type GameEvent,
  type Rect,
  type State,
  campTile,
  findSlot,
  newState,
  npcTile,
  step,
} from '@game/kernel';

import {
  type Tile,
  bfsInside,
  bfsNear,
  bfsToTile,
  firstOpenTick,
  loadBundle,
} from './helpers/world.js';

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

describe('opening sequence', () => {
  test.each([
    ['core/forager', 'core/basket'],
    ['core/explorer', 'core/trowel'],
  ])('%s can finish the opening', (starter, tool) => {
    const planner = new Planner(bundle, 2026);

    planner.act({ t: 'start', starter, name: 'Tester' }, 0);
    expect(planner.state.player.starter).toBe(starter);
    expect(planner.state.player.name).toBe('Tester');
    expect(planner.state.tick).toBe(0);

    const fire = required(campTile(bundle, 'fire'), 'The map has no fire spot.');
    const spawn: Tile = [bundle.map.spawn.x, bundle.map.spawn.y];
    expect(bfsToTile(bundle, planner.state.player, spawn, fire)).toBeUndefined();

    const stones = instancesOf(bundle, 'core/river-stones');
    expect(stones).toHaveLength(3);
    const stoneEvents = stones.map(([id]) => planner.gather(id));
    expect(stoneEvents[0]).toContainEqual({ e: 'discover', item: 'core/stone' });
    expect(stoneEvents.flat()).toContainEqual({ e: 'level', profession: 'core/foraging', level: 2 });
    expect(planner.state.player.bag['core/stone']).toBe(3);

    const bridge = required(findSlot(bundle.map, 'core/old-bridge'), 'The bridge slot is missing.');
    planner.actNear(bridge, (at) => ({ t: 'restore', restore: 'core/old-bridge', at }));
    expect(planner.state.player.quests['core/fix-the-bridge']).toBe('done');
    expect(bfsToTile(bundle, planner.state.player, spawn, fire)).toBeDefined();

    // the axe comes with the character; one grown oak gives the logs of the first fire
    expect(planner.state.player.bag['core/axe']).toBe(1);
    const trees = instancesOf(bundle, 'core/oak-trees');
    expect(trees.length).toBeGreaterThanOrEqual(2);
    const felled = planner.gather(trees[0]![0]);
    expect(felled).toContainEqual({ e: 'gain', item: 'core/log', qty: 3 });
    expect(planner.state.player.xp['core/woodcutting']).toBe(3000);
    const berries = instancesOf(bundle, 'core/berry-bushes');
    planner.gather(berries[0]![0]);
    expect(planner.state.player.bag['core/log']).toBe(3);
    expect(planner.state.player.bag['core/berry']).toBeGreaterThanOrEqual(2);

    planner.actNear(
      { x: fire[0], y: fire[1], w: 1, h: 1 },
      (at) => ({ t: 'build', camp: 'core/campfire', at }),
    );
    expect(planner.state.player.camp).toContain('core/campfire');
    planner.actNear(
      { x: fire[0], y: fire[1], w: 1, h: 1 },
      (at) => ({ t: 'craft', recipe: 'core/berry-mash', at }),
    );
    expect(planner.state.player.bag['core/berry-mash']).toBe(1);
    planner.act({ t: 'eat', item: 'core/berry-mash' });
    expect(planner.state.player.bag['core/berry-mash']).toBeUndefined();
    expect(planner.state.player.quests['core/first-fire']).toBe('done');

    // the log that is left splits into two branches at the fire
    expect(planner.state.player.bag['core/log']).toBe(1);
    planner.actNear(
      { x: fire[0], y: fire[1], w: 1, h: 1 },
      (at) => ({ t: 'craft', recipe: 'core/split-log', at }),
    );
    expect(planner.state.player.bag['core/log']).toBeUndefined();
    expect(planner.state.player.bag['core/branch']).toBe(2);

    const square = required(findSlot(bundle.map, 'core/town-square'), 'The town square is missing.');
    planner.visit(square);
    expect(planner.state.player.quests['core/into-town']).toBe('done');

    const elder = required(npcTile(bundle, 'core/elder'), 'The elder is missing.');
    planner.actNear(
      { x: elder[0], y: elder[1], w: 1, h: 1 },
      (at) => ({ t: 'accept', quest: 'core/three-fruits', at }),
    );
    expect(planner.state.player.quests['core/three-fruits']).toBe('active');

    // the find: one bellberry from the garden behind the ruins, open by day only
    const bells = instancesOf(bundle, 'core/bell-bushes');
    expect(bells).toHaveLength(2);
    planner.gather(bells[0]![0]);
    expect(planner.state.player.bag['core/bellberry']).toBeGreaterThanOrEqual(1);
    planner.actNear(
      { x: elder[0], y: elder[1], w: 1, h: 1 },
      (at) => ({ t: 'turnin', quest: 'core/three-fruits', at }),
    );
    expect(planner.state.player.quests['core/three-fruits']).toBe('done');
    expect(planner.state.player.gold).toBe(30_000);
    expect(planner.state.player.recipes).toContain('core/herb-tea');
    expect(planner.state.player.rep['core/elder']).toBeGreaterThan(0);

    // the two places the next quests send the player to can be walked to
    const sunBank = required(findSlot(bundle.map, 'core/sun-bank'), 'The sun bank is missing.');
    expect(bfsNear(bundle, planner.state.player, planner.state.player.at, sunBank), 'The sun bank must be reachable.').toBeDefined();
    const [lanternFoot] = instancesOf(bundle, 'core/lantern-foot');
    expect(lanternFoot).toBeDefined();
    const spot = { x: lanternFoot![1].x, y: lanternFoot![1].y, w: 1, h: 1 };
    expect(bfsNear(bundle, planner.state.player, planner.state.player.at, spot), 'The spot under the hill lantern must be reachable.').toBeDefined();

    const shop = bundle.shops['core/trader-shop']!;
    const basket = shop.sells.find((offer) => offer.item === 'core/basket');
    const trowel = shop.sells.find((offer) => offer.item === 'core/trowel');
    expect(basket?.price_mg).toBeLessThanOrEqual(planner.state.player.gold);
    expect(trowel?.price_mg).toBeLessThanOrEqual(planner.state.player.gold);
    const trader = required(npcTile(bundle, 'core/trader'), 'The trader is missing.');
    planner.actNear(
      { x: trader[0], y: trader[1], w: 1, h: 1 },
      (at) => ({ t: 'buy', npc: 'core/trader', item: tool, qty: 1, at }),
    );
    expect(planner.state.player.bag[tool]).toBe(1);
    expect(planner.state.player.gold).toBe(0);
    expect(planner.state.player.gold).toBe(planner.state.ledger.minted - planner.state.ledger.burned);
  });
});

describe('trees in the way', () => {
  // a solid tree blocks its tile, so a tree must never cut a place off from the spawn
  test('every slot stays reachable with the trees standing', () => {
    const open = structuredClone(bundle);
    for (const resource of Object.values(open.resources)) delete resource.solid;
    const view = { restored: ['core/old-bridge'], camp: [] as string[] };
    const spawn: Tile = [bundle.map.spawn.x, bundle.map.spawn.y];
    for (const slot of bundle.map.slots) {
      const without = bfsNear(open, view, spawn, slot) !== undefined;
      const with_ = bfsNear(bundle, view, spawn, slot) !== undefined;
      expect(with_, `${slot.id} is cut off by a tree`).toBe(without);
    }
  });

  test('every oak is solid and has a place to stand next to it', () => {
    const spawn: Tile = [bundle.map.spawn.x, bundle.map.spawn.y];
    const view = { restored: ['core/old-bridge'], camp: [] as string[] };
    for (const [id, instance] of instancesOf(bundle, 'core/oak-trees')) {
      expect(bundle.resources[instance.source]!.solid, id).toBe(true);
      const around = bfsNear(bundle, view, spawn, { x: instance.x, y: instance.y, w: 1, h: 1 });
      expect(around, `${id} cannot be reached`).toBeDefined();
    }
  });
});

class Planner {
  readonly bundle: Bundle;
  state: State;

  constructor(bundle: Bundle, seed: number) {
    this.bundle = bundle;
    this.state = newState(bundle, seed);
  }

  act(action: Action, tick = Math.max(this.state.tick, this.state.player.busyUntil)): GameEvent[] {
    expect(tick).toBeGreaterThanOrEqual(this.state.tick);
    expect(tick).toBeGreaterThanOrEqual(action.t === 'start' ? 0 : this.state.player.busyUntil);
    const result = step(this.bundle, this.state, action, tick);
    expect(result.ok, result.ok ? undefined : result.error).toBe(true);
    if (!result.ok) throw new Error(result.error);
    this.state = result.state;
    return result.events;
  }

  actNear(target: Rect, action: (at: Tile) => Action, tick?: number): GameEvent[] {
    const path = bfsNear(this.bundle, this.state.player, this.state.player.at, target);
    expect(path, 'The target must be reachable by four-neighbour walking.').toBeDefined();
    return this.act(action(path!.at(-1)!), tick);
  }

  gather(node: string): GameEvent[] {
    const instance = required(this.bundle.instances[node], `Unknown resource instance ${node}.`);
    expect(instance.kind).toBe('resource');
    const resource = this.bundle.resources[instance.source]!;
    const minimum = Math.max(
      this.state.tick,
      this.state.player.busyUntil,
      this.state.nodes[node]?.readyAt ?? 0,
    );
    const tick = firstOpenTick(this.bundle, minimum, resource.hours);
    return this.actNear(
      { x: instance.x, y: instance.y, w: 1, h: 1 },
      (at) => ({ t: 'gather', node, grade: 3, at }),
      tick,
    );
  }

  visit(slot: Rect & { id: string }): GameEvent[] {
    const path = bfsInside(this.bundle, this.state.player, this.state.player.at, slot);
    expect(path, 'The visit slot must be reachable by four-neighbour walking.').toBeDefined();
    return this.act({ t: 'visit', slot: slot.id, at: path!.at(-1)! });
  }
}

function instancesOf(bundle: Bundle, source: string): [string, Bundle['instances'][string]][] {
  return Object.entries(bundle.instances)
    .filter(([, instance]) => instance.source === source)
    .sort(([a], [b]) => a.localeCompare(b));
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}
