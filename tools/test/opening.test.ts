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
  wakePocket,
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
  // the recut B on the axe and the starts: a keystone, a felled tree for the fire, one purse,
  // then whom to help first, Maru or Pell, and the arch at night
  // one race per wake pocket, as the e2e opening plays them (DECISIONS.md, 2026-10-22); the pocket is drawn by the seed
  const STARTS: [string, string, string, string][] = [
    ['core/elf', 'core/west-bank', 'core/first-pickings', 'core/bank-herbs'],
    ['core/skeleton', 'core/slid-bank', 'core/buried-axe', 'core/slid-bank-dig'],
    ['core/human', 'core/north-meadow', 'core/glint-by-the-bridge', 'core/bridge-glint'],
  ];
  const ORDERS = ['core/three-fruits', 'core/herbs-for-pell'] as const;
  test.each(STARTS.flatMap(([race, pocket, own, place]) => ORDERS.map((first) => [race, pocket, first, own, place] as const)))(
    '%s in %s can finish the opening, helping first with %s',
    (race, pocket, first, own, place) => {
      const planner = new Planner(bundle, seedFor(bundle, pocket));
      const kit = bundle.pockets[pocket]!.ground.map((k) => k.item);

      planner.act({ t: 'start', race, name: 'Tester' }, 0);
      expect(planner.state.player.race).toBe(race);
      expect(planner.state.player.pocket).toBe(pocket);
      expect(planner.state.player.name).toBe('Tester');
      expect(planner.state.tick).toBe(0);
      expect(hourOf(bundle, planner.state.tick)).toBe(12);
      const spawn: Tile = [bundle.map.spawn.x, bundle.map.spawn.y];
      const wake = bundle.pockets[pocket]!.wake;
      expect(planner.state.player.at).toEqual([wake.x, wake.y]);
      // the pocket's tools lie on the ground by the wake tile: picked up by hand, never in the bag at the start
      for (const g of bundle.pockets[pocket]!.ground) {
        expect(planner.state.player.bag[g.item], g.item).toBeUndefined();
        const [spot] = Object.entries(bundle.instances).filter(
          ([, i]) => i.kind === 'treasure' && bundle.treasures[i.source]!.pocket === pocket && bundle.treasures[i.source]!.tool === undefined && bundle.treasures[i.source]!.finds[0]!.item === g.item,
        );
        planner.dig(spot![0]);
        expect(planner.state.player.bag[g.item], g.item).toBe(g.qty);
      }

      const fire = required(campTile(bundle, 'fire'), 'The map has no fire spot.');
      expect(bfsToTile(bundle, planner.state.player, spawn, fire)).toBeUndefined();

      // its own first task on its own road: herbs on the west bank, or the axe on a spot of its own
      const ownTask = () => {
        expect(planner.state.player.quests[own]).toBe('active');
        const [spot] = instancesOf(bundle, place);
        if (spot![1].kind === 'resource') planner.gather(spot![0]);
        else planner.dig(spot![0]);
        expect(planner.state.player.quests[own]).toBe('done');
      };

      // the taught strike: one keystone in the shallows mends the bridge
      const keystones = instancesOf(bundle, 'core/keystone');
      expect(keystones).toHaveLength(1);
      // in the north meadow the senses answer first: the keystone waits for the glint's axe
      if (pocket === 'core/north-meadow') {
        const key = keystones[0]![1];
        const before = JSON.stringify(planner.state);
        const near = required(bfsNear(bundle, planner.state.player, planner.state.player.at, { x: key.x, y: key.y, w: 1, h: 1 }), 'The keystone is out of reach.');
        const tried = step(bundle, planner.state, { t: 'gather', node: keystones[0]![0], grade: 3, at: near.at(-1)! }, Math.max(planner.state.tick, planner.state.player.busyUntil));
        expect(tried).toEqual({ ok: false, error: 'Something else catches the light first.' });
        expect(JSON.stringify(planner.state)).toBe(before);
        ownTask();
      }
      const strike = planner.gather(keystones[0]![0]);
      expect(strike).toContainEqual({ e: 'discover', item: 'core/keystone' });
      // the first level comes with the first strike, and a point to spend now
      expect(strike).toContainEqual({ e: 'level', profession: 'core/foraging', level: 2 });
      expect(planner.state.player.bag['core/keystone']).toBe(1);

      if (pocket !== 'core/north-meadow') ownTask();

      const known = [...planner.state.player.recipes];
      const bridge = required(findSlot(bundle.map, 'core/old-bridge'), 'The bridge slot is missing.');
      planner.actNear(bridge, (at) => ({ t: 'restore', restore: 'core/old-bridge', at }));
      expect(planner.state.player.quests['core/fix-the-bridge']).toBe('done');
      expect(planner.state.player.bag['core/keystone']).toBeUndefined();
      expect(bfsToTile(bundle, planner.state.player, spawn, fire)).toBeDefined();
      // the purse under the sign: the price of one tool, and gold only
      const shop = bundle.shops['core/trader-shop']!;
      const price = (item: string) => required(shop.sells.find((offer) => offer.item === item), `The stall does not sell ${item}.`).price_mg;
      expect(planner.state.player.gold).toBe(price('core/basket'));
      expect(planner.state.player.gold).toBe(price('core/trowel'));
      expect(planner.state.player.recipes).toEqual(known);

      // a fire before dark: the axe came with the character or was found, and one oak gives the logs
      expect(planner.state.player.quests['core/first-fire']).toBe('active');
      expect(planner.state.player.bag['core/axe']).toBe(1);
      const trees = instancesOf(bundle, 'core/oak-trees');
      expect(trees.length).toBeGreaterThanOrEqual(2);
      const felled = planner.gather(trees[0]![0]);
      expect(felled).toContainEqual({ e: 'gain', item: 'core/log', qty: 3 });
      expect(planner.state.player.xp['core/woodcutting']).toBe(3000);
      planner.actNear(
        { x: fire[0], y: fire[1], w: 1, h: 1 },
        (at) => ({ t: 'build', camp: 'core/campfire', at }),
      );
      expect(planner.state.player.camp).toContain('core/campfire');
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

      // the real choice: whom to help first. Both helps pick with a basket, so a start without one spends the purse on it
      const elder = required(npcTile(bundle, 'core/elder'), 'The elder is missing.');
      const trader = required(npcTile(bundle, 'core/trader'), 'The trader is missing.');
      const atElder = { x: elder[0], y: elder[1], w: 1, h: 1 };
      const atTrader = { x: trader[0], y: trader[1], w: 1, h: 1 };
      if (!planner.state.player.bag['core/basket']) {
        expect(planner.state.player.gold).toBeGreaterThanOrEqual(price('core/basket'));
        planner.actNear(atTrader, (at) => ({ t: 'buy', npc: 'core/trader', item: 'core/basket', qty: 1, at }));
      }
      expect(planner.state.player.bag['core/basket']).toBe(1);
      /** Gathers one plant for a help; neither help waits on a window, with two hours to spare for the walk. */
      const pick = (source: string) => {
        const [node] = instancesOf(bundle, source);
        const reached = Math.max(planner.state.tick, planner.state.player.busyUntil);
        const hours = bundle.resources[source]!.hours!;
        expect(firstOpenTick(bundle, reached, hours), `${source} is closed when the player gets there`).toBe(reached);
        expect(hourOf(bundle, reached)).toBeLessThan(hours[1] - 2);
        planner.gather(node![0]);
      };
      const bells = () => {
        planner.actNear(atElder, (at) => ({ t: 'accept', quest: 'core/three-fruits', at }));
        pick('core/bell-bushes');
        planner.actNear(atElder, (at) => ({ t: 'turnin', quest: 'core/three-fruits', at }));
        expect(planner.state.player.quests['core/three-fruits']).toBe('done');
        // Maru's old trowel, or a walking staff for a start that woke with a trowel
        const gift = kit.includes('core/trowel') ? 'core/walking-staff' : 'core/trowel';
        expect(planner.state.player.bag[gift]).toBe(1);
      };
      const herbs = () => {
        const gold = planner.state.player.gold;
        planner.actNear(atTrader, (at) => ({ t: 'accept', quest: 'core/herbs-for-pell', at }));
        pick('core/sun-herbs');
        planner.actNear(atTrader, (at) => ({ t: 'turnin', quest: 'core/herbs-for-pell', at }));
        expect(planner.state.player.quests['core/herbs-for-pell']).toBe('done');
        expect(planner.state.player.recipes).toContain('core/herb-stew');
        expect(planner.state.player.gold).toBe(gold + 30_000);
      };
      if (first === 'core/three-fruits') {
        bells();
        herbs();
      } else {
        herbs();
        bells();
      }

      // Maru's coin, by the trowel's road: every start holds a trowel by now
      planner.actNear(atElder, (at) => ({ t: 'accept', quest: 'core/a-coin-for-maru', at }));
      expect(planner.state.player.bag['core/trowel']).toBe(1);
      const [lantern] = instancesOf(bundle, 'core/lantern-foot');
      expect(planner.dig(lantern![0])).toContainEqual({ e: 'riddle', quest: 'core/a-coin-for-maru' });
      expect(planner.state.player.bag['core/maru-coin']).toBe(1);
      planner.actNear(atElder, (at) => ({ t: 'turnin', quest: 'core/a-coin-for-maru', at }));
      expect(planner.state.player.quests['core/a-coin-for-maru']).toBe('done');
      expect(planner.state.player.recipes).toContain('core/herb-tea');
      expect(planner.state.player.rep['core/elder']).toBeGreaterThan(0);
      expect(planner.state.player.rep['core/trader']).toBeGreaterThan(0);

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

      expect(planner.state.player.gold + planner.state.player.boundGold).toBe(planner.state.ledger.minted - planner.state.ledger.burned);
    },
  );
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

/** A seed whose world wakes in this pocket. */
function seedFor(bundle: Bundle, pocket: string): number {
  for (let seed = 2026; seed < 12_026; seed++) if (wakePocket(bundle, seed) === pocket) return seed;
  throw new Error(`no seed wakes in ${pocket}`);
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
