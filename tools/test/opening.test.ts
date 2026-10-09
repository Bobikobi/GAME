import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Action,
  type Bundle,
  type GameEvent,
  type Rect,
  type State,
  campTile,
  findSlot,
  hourOf,
  isNight,
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
  // the recut B: a keystone, a dry log, one purse and two roads, then the arch at night
  test.each([
    ['core/forager', 'core/a-coin-for-maru'],
    ['core/explorer', 'core/three-fruits'],
  ])('%s can finish the opening, taking %s first', (starter, first) => {
    const planner = new Planner(bundle, 2026);

    planner.act({ t: 'start', starter, name: 'Tester' }, 0);
    expect(planner.state.player.starter).toBe(starter);
    expect(planner.state.player.name).toBe('Tester');
    expect(planner.state.tick).toBe(0);
    expect(hourOf(bundle, planner.state.tick)).toBe(12);

    const fire = required(campTile(bundle, 'fire'), 'The map has no fire spot.');
    const spawn: Tile = [bundle.map.spawn.x, bundle.map.spawn.y];
    expect(bfsToTile(bundle, planner.state.player, spawn, fire)).toBeUndefined();

    // the taught strike: one keystone in the shallows mends the bridge
    const keystones = instancesOf(bundle, 'core/keystone');
    expect(keystones).toHaveLength(1);
    const strike = planner.gather(keystones[0]![0]);
    expect(strike).toContainEqual({ e: 'discover', item: 'core/keystone' });
    // the first level comes with the first strike, and a point to spend now
    expect(strike).toContainEqual({ e: 'level', profession: 'core/foraging', level: 2 });
    expect(planner.state.player.bag['core/keystone']).toBe(1);

    const bridge = required(findSlot(bundle.map, 'core/old-bridge'), 'The bridge slot is missing.');
    planner.actNear(bridge, (at) => ({ t: 'restore', restore: 'core/old-bridge', at }));
    expect(planner.state.player.quests['core/fix-the-bridge']).toBe('done');
    expect(planner.state.player.bag['core/keystone']).toBeUndefined();
    expect(bfsToTile(bundle, planner.state.player, spawn, fire)).toBeDefined();
    // the purse under the sign: the price of one tool, and a recipe, so the reward is not coins alone
    const shop = bundle.shops['core/trader-shop']!;
    const price = (item: string) => required(shop.sells.find((offer) => offer.item === item), `The stall does not sell ${item}.`).price_mg;
    expect(planner.state.player.gold).toBe(price('core/basket'));
    expect(planner.state.player.gold).toBe(price('core/trowel'));
    expect(planner.state.player.recipes).toContain('core/mushroom-skewer');

    // the find by the senses: one dry log in the wet reeds, picked up by hand
    expect(planner.state.player.quests['core/first-fire']).toBe('active');
    const logs = instancesOf(bundle, 'core/dry-log');
    expect(logs).toHaveLength(1);
    expect(Object.keys(planner.state.player.bag).filter((id) => bundle.items[id]?.tool)).toEqual([]);
    planner.dig(logs[0]![0]);
    expect(planner.state.player.bag['core/dry-log']).toBe(1);
    expect(planner.state.player.wear).toEqual({});
    expect(planner.state.player.quests['core/first-fire']).toBe('active');
    planner.actNear(
      { x: fire[0], y: fire[1], w: 1, h: 1 },
      (at) => ({ t: 'build', camp: 'core/campfire', at }),
    );
    expect(planner.state.player.camp).toContain('core/campfire');
    expect(planner.state.player.bag['core/dry-log']).toBeUndefined();
    // the log burned in the fire still counts: a find with no giver is found once
    expect(planner.state.player.quests['core/first-fire']).toBe('done');

    const square = required(findSlot(bundle.map, 'core/town-square'), 'The town square is missing.');
    planner.visit(square);
    expect(planner.state.player.quests['core/into-town']).toBe('done');

    // the real choice: one purse, two tools, and whichever road comes first pays for the other tool
    const elder = required(npcTile(bundle, 'core/elder'), 'The elder is missing.');
    const trader = required(npcTile(bundle, 'core/trader'), 'The trader is missing.');
    const atElder = { x: elder[0], y: elder[1], w: 1, h: 1 };
    const buy = (item: string) => {
      if (planner.state.player.bag[item]) return;
      expect(planner.state.player.gold).toBeGreaterThanOrEqual(price(item));
      planner.actNear({ x: trader[0], y: trader[1], w: 1, h: 1 }, (at) => ({ t: 'buy', npc: 'core/trader', item, qty: 1, at }));
      expect(planner.state.player.bag[item]).toBe(1);
    };
    const coinRoad = () => {
      planner.actNear(atElder, (at) => ({ t: 'accept', quest: 'core/a-coin-for-maru', at }));
      buy('core/trowel');
      const [spot] = instancesOf(bundle, 'core/lantern-foot');
      expect(planner.dig(spot![0])).toContainEqual({ e: 'riddle', quest: 'core/a-coin-for-maru' });
      expect(planner.state.player.bag['core/maru-coin']).toBe(1);
      planner.actNear(atElder, (at) => ({ t: 'turnin', quest: 'core/a-coin-for-maru', at }));
      expect(planner.state.player.quests['core/a-coin-for-maru']).toBe('done');
      expect(planner.state.player.bag['core/basket']).toBeGreaterThanOrEqual(1);
    };
    const bellsRoad = () => {
      planner.actNear(atElder, (at) => ({ t: 'accept', quest: 'core/three-fruits', at }));
      buy('core/basket');
      const bells = instancesOf(bundle, 'core/bell-bushes');
      expect(bells).toHaveLength(2);
      planner.gather(bells[0]![0]);
      planner.actNear(atElder, (at) => ({ t: 'turnin', quest: 'core/three-fruits', at }));
      expect(planner.state.player.quests['core/three-fruits']).toBe('done');
      expect(planner.state.player.recipes).toContain('core/herb-tea');
    };
    const roads = first === 'core/a-coin-for-maru' ? [coinRoad, bellsRoad] : [bellsRoad, coinRoad];
    roads[0]!();
    if (first === 'core/three-fruits') expect(planner.state.player.gold).toBeGreaterThanOrEqual(price('core/trowel'));
    roads[1]!();
    expect(planner.state.player.rep['core/elder']).toBeGreaterThan(0);

    // the night discovery: rubble fills the broken arch by day, and a way runs under it after dark
    expect(planner.state.player.quests['core/the-night-arch']).toBe('active');
    const mouth = required(findSlot(bundle.map, 'core/arch-mouth'), 'The arch mouth is missing.');
    const threshold = required(findSlot(bundle.map, 'core/night-threshold'), 'The night threshold is missing.');
    expect(bfsInside(bundle, planner.state.player, planner.state.player.at, threshold), 'The threshold is closed by day.').toBeUndefined();
    expect(isNight(bundle, planner.state.tick)).toBe(false);
    planner.visit(mouth);
    expect(planner.state.player.quests['core/the-night-arch']).toBe('active');
    expect(planner.state.player.restored).not.toContain('core/arch-way');
    const night = firstOpenTick(bundle, Math.max(planner.state.tick, planner.state.player.busyUntil), [20, 5]);
    // the first dusk falls inside the first session: the night comes before the first midnight
    expect(night).toBeLessThan(bundle.params.day_length_ms / 2);
    const events = planner.visit(mouth, night);
    expect(events).toContainEqual({ e: 'riddle', quest: 'core/the-night-arch' });
    expect(events).toContainEqual({ e: 'restore', restore: 'core/arch-way' });
    expect(planner.state.player.quests['core/the-night-arch']).toBe('done');
    expect(planner.state.player.restored).toContain('core/arch-way');
    planner.visit(threshold);
    expect(planner.state.player.visited).toContain('core/night-threshold');

    expect(planner.state.player.gold).toBe(planner.state.ledger.minted - planner.state.ledger.burned);
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

  dig(spot: string): GameEvent[] {
    const instance = required(this.bundle.instances[spot], `Unknown dig spot ${spot}.`);
    expect(instance.kind).toBe('treasure');
    const tick = Math.max(this.state.tick, this.state.player.busyUntil, this.state.nodes[spot]?.readyAt ?? 0);
    return this.actNear(
      { x: instance.x, y: instance.y, w: 1, h: 1 },
      (at) => ({ t: 'dig', spot, grade: 3, at }),
      tick,
    );
  }

  visit(slot: Rect & { id: string }, tick?: number): GameEvent[] {
    const path = bfsInside(this.bundle, this.state.player, this.state.player.at, slot);
    expect(path, 'The visit slot must be reachable by four-neighbour walking.').toBeDefined();
    return this.act({ t: 'visit', slot: slot.id, at: path!.at(-1)! }, tick);
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
