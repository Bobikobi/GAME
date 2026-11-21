/**
 * The clothing route, played (docs/design/CLOTHING_BALANCE.md; #769): how long a player who knows the way takes from
 * the end of the opening to the first worn leather piece, to the tier-1 kit and to the first set, on the kernel itself.
 *
 * The hide chain is proposed content (CLOTHING appendix, "For the take verb"): until it lands, `withHideChain` adds its
 * items and recipes to a copy of the bundle exactly as the appendix lists them, with values from the calculator's
 * hand table (CLOTHING 4.3). Nothing lays a carcass in play yet (kernel/src/hunt.ts:2-5), so the take is modelled as
 * the hunt fields state it: the player stands by an animal's spot for its `take_s` and the carcass lies on the spot
 * (`placeCarcass`, as the tests lay one). Every other step is a real action through `step`, with the travel rule on:
 * gathering, building, crafting with its chance and its misses, dressing, wearing, walking tile by tile.
 *
 * It writes nothing. The clock is the game's: a game millisecond is a real one (`day_length_ms` 20 minutes a day).
 */
import {
  type Action,
  type Bundle,
  type ItemInfo,
  type RecipeDef,
  type PublicState,
  type State,
  campTile,
  npcTile,
  newState,
  placeCarcass,
  professionLevel,
  publicState,
  step,
} from '@game/kernel';

import { type ActResult, type Hands, Player } from '../../../server/test/sim/player.js';
import { STARTS, playOpening } from '../../../server/test/sim/session.js';
import { firstOpenTick } from '../../../tools/test/helpers/world.js';

const HAND = 'core/handcraft';
const KIT = 'core/base-kit:items/basket';

type Piece = { slot: 'head' | 'top' | 'legs' | 'feet'; effects: { effect: string; value: number }[]; set?: string };

/** One proposed good of the appendix: its item and the recipe that makes it. */
interface Row {
  id: string;
  name: string;
  cls: string;
  family?: string;
  tier: number;
  rarity: 'common' | 'uncommon' | 'rare';
  weight: number;
  value: number;
  wear?: Piece;
  station: number;
  active: number;
  level: number;
  inputs: [string, number][];
  out?: number;
}

/** CLOTHING appendix, "For the take verb", row by row (values from section 4.3). */
export const HIDE_CHAIN: readonly Row[] = [
  { id: 'core/scraped-hare-hide', name: 'Scraped hare hide', cls: 'core/hide', family: 'hare', tier: 1, rarity: 'common', weight: 1, value: 20960, station: 1, active: 6000, level: 1, inputs: [['core/hare-hide', 1], ['core/stone-flakes', 1]] },
  { id: 'core/scraped-roe-hide', name: 'Scraped roe hide', cls: 'core/hide', family: 'roe', tier: 1, rarity: 'common', weight: 1, value: 28640, station: 1, active: 6000, level: 1, inputs: [['core/roe-hide', 1], ['core/stone-flakes', 1]] },
  { id: 'core/hare-leather', name: 'Hare leather', cls: 'core/hide', family: 'hare', tier: 1, rarity: 'common', weight: 1, value: 24760, station: 1, active: 4000, level: 1, inputs: [['core/scraped-hare-hide', 1], ['core/herb', 1]] },
  { id: 'core/hare-fur', name: 'Hare fur', cls: 'core/hide', family: 'hare', tier: 1, rarity: 'common', weight: 1, value: 24760, station: 1, active: 4000, level: 1, inputs: [['core/scraped-hare-hide', 1], ['core/herb', 1]] },
  { id: 'core/roe-leather', name: 'Roe leather', cls: 'core/hide', family: 'roe', tier: 1, rarity: 'common', weight: 1, value: 32440, station: 1, active: 4000, level: 1, inputs: [['core/scraped-roe-hide', 1], ['core/herb', 1]] },
  { id: 'core/sinew-thread', name: 'Sinew thread', cls: 'core/sinew', tier: 1, rarity: 'common', weight: 0, value: 3630, station: 1, active: 3000, level: 1, inputs: [['core/roe-sinew', 1]], out: 2 },
  { id: 'core/hare-fur-hood', name: 'Hare-fur hood', cls: 'core/fur', family: 'hare', tier: 1, rarity: 'common', weight: 1, value: 32390, wear: { slot: 'head', effects: [{ effect: 'craft_speed_pct', value: 5 }] }, station: 1, active: 5000, level: 1, inputs: [['core/hare-fur', 1], ['core/sinew-thread', 1]] },
  { id: 'core/roe-leather-jerkin', name: 'Roe-leather jerkin', cls: 'core/leather', family: 'roe', tier: 1, rarity: 'common', weight: 1, value: 44500, wear: { slot: 'top', effects: [{ effect: 'dig_speed_pct', value: 5 }] }, station: 1, active: 6000, level: 2, inputs: [['core/roe-leather', 1], ['core/sinew-thread', 2]] },
  { id: 'core/roe-leather-leggings', name: 'Roe-leather leggings', cls: 'core/leather', family: 'roe', tier: 1, rarity: 'common', weight: 1, value: 44500, wear: { slot: 'legs', effects: [{ effect: 'dig_speed_pct', value: 5 }] }, station: 1, active: 6000, level: 2, inputs: [['core/roe-leather', 1], ['core/sinew-thread', 2]] },
  { id: 'core/hare-leather-shoes', name: 'Hare-leather shoes', cls: 'core/leather', family: 'hare', tier: 1, rarity: 'common', weight: 1, value: 32390, wear: { slot: 'feet', effects: [{ effect: 'dig_speed_pct', value: 5 }] }, station: 1, active: 5000, level: 1, inputs: [['core/hare-leather', 1], ['core/sinew-thread', 1]] },
  { id: 'core/boiled-leather', name: 'Boiled leather', cls: 'core/hide', family: 'roe', tier: 2, rarity: 'uncommon', weight: 1, value: 38040, station: 2, active: 5000, level: 3, inputs: [['core/roe-leather', 1], ['core/branch', 1]] },
  { id: 'core/boiled-leather-cap', name: 'Boiled-leather cap', cls: 'core/leather', family: 'roe', tier: 2, rarity: 'uncommon', weight: 1, value: 46670, wear: { slot: 'head', effects: [{ effect: 'dig_speed_pct', value: 5 }], set: 'core/digger-leathers' }, station: 2, active: 5000, level: 4, inputs: [['core/boiled-leather', 1], ['core/sinew-thread', 1]] },
  { id: 'core/boiled-leather-boots', name: 'Boiled-leather boots', cls: 'core/leather', family: 'roe', tier: 2, rarity: 'uncommon', weight: 1, value: 47670, wear: { slot: 'feet', effects: [{ effect: 'dig_speed_pct', value: 5 }], set: 'core/digger-leathers' }, station: 2, active: 6000, level: 5, inputs: [['core/boiled-leather', 1], ['core/sinew-thread', 1]] },
];

/**
 * How the tier-2 recipes are learned: `start`, known from the start inside their level band (every route open, the
 * owner's \`teach\` of 12.11); `found`, the appendix's design: a scrap dug at the gate rubble, four new rows at chance 5.
 */
export type Teach = 'start' | 'found';

/** The appendix's four tier-2 scraps at the gate rubble (CLOTHING 6, "Where the scraps lie"); the cloak's is dug but not needed here. */
export const GATE_SCRAPS: readonly [string, string][] = [
  ['core/boil-leather-scrap', 'core/boiled-leather'],
  ['core/fur-cloak-scrap', 'core/fur-lined-cloak'],
  ['core/leather-cap-scrap', 'core/boiled-leather-cap'],
  ['core/leather-boots-scrap', 'core/boiled-leather-boots'],
];

/** A copy of the bundle with the hide chain added as the appendix lists it; tier 1 is known from the start, tier 2 by `teach`. */
export function withHideChain(base: Bundle, teach: Teach = 'start'): Bundle {
  const b = structuredClone(base);
  for (const r of HIDE_CHAIN) {
    const item = {
      id: r.id,
      name: r.name,
      kind: 'material',
      rarity: r.rarity,
      class: r.cls,
      ...(r.family ? { family: r.family } : {}),
      tier: r.tier,
      sprite: KIT,
      weight: r.weight,
      ...(r.wear ? { wear: r.wear } : {}),
      creator: 'core',
      file: 'clothing-route',
    } as unknown as ItemInfo;
    b.items[r.id] = item;
    b.values[r.id] = r.value;
    const recipe = {
      id: r.id,
      title: r.name,
      station: 'workshop',
      active_ms: r.active,
      level: r.level,
      inputs: r.inputs.map(([item, qty]) => ({ item, qty })),
      outputs: [{ item: r.id, qty: r.out ?? 1, share_pct: 100 }],
      known: teach === 'found' && r.tier >= 2 ? 'found' : 'start',
      // CLOTHING 6.1 (#776): a worn piece is of the `wear` family; a hide step or a thread belongs to none
      ...(r.wear ? { family: 'wear' } : {}),
    } as unknown as RecipeDef;
    b.recipes[r.id] = recipe;
  }
  if (teach === 'found') {
    const gate = b.treasures['core/ruins-gate']!;
    const scrap = b.items['core/stew-scrap']!;
    for (const [id, unlocks] of GATE_SCRAPS) {
      b.items[id] = { ...structuredClone(scrap), id, name: 'Recipe scrap', fragment: { unlocks } };
      // the appendix's rows: chance 5 each, appended after today's (the share re-split moves only values, not the draw)
      gate.finds = [...gate.finds, { item: id, chance_pct: 5, share_pct: 1 }];
    }
  }
  // the digger leathers' own bonus (CLOTHING 8): dig +2 when both are worn
  if (b.sets) b.sets['core/digger-leathers'] = { id: 'core/digger-leathers', effect: 'dig_speed_pct', value: 2 } as Bundle['sets'][string];
  return b;
}

/** The kernel's hands with one more power: laying a taken animal, as the take verb will once it lands. */
class RouteHands implements Hands {
  tick = 0;
  raw: State;
  /** set once the route begins: from then a fall stops the run */
  strict = false;
  private pub: PublicState | null = null;
  private pending: { at: [number, number]; tick: number }[] = [];

  constructor(
    private readonly bundle: Bundle,
    seed: number,
  ) {
    this.raw = newState(bundle, seed);
  }

  get state(): PublicState {
    if (this.pub === null) this.pub = publicState(this.raw);
    return this.pub;
  }

  advance(dt: number): void {
    this.tick += dt;
  }

  report(at: readonly [number, number]): void {
    this.pending.push({ at: [at[0], at[1]], tick: this.tick });
  }

  async flushMoves(): Promise<void> {
    const moves = this.pending;
    this.pending = [];
    for (const m of moves) {
      const r = step(this.bundle, this.raw, { t: 'move', at: m.at }, m.tick, { validateTravel: true });
      if (!r.ok) throw new Error(`The move to ${m.at[0]},${m.at[1]} at ${m.tick} ms was refused: ${r.error}`);
      this.raw = r.state;
      this.pub = null;
    }
  }

  async act(action: Action): Promise<ActResult> {
    const r = step(this.bundle, this.raw, action, this.tick, { validateTravel: true });
    if (!r.ok) return { ok: false, error: r.error };
    // a fall loses part of the bag: the route is then no longer the one measured, so it stops
    if (this.strict && r.events.some((e) => e.e === 'fall')) throw new Error(`the player fell during ${action.t} at ${this.tick} ms`);
    this.raw = r.state;
    this.pub = null;
    return { ok: true, events: r.events };
  }

  lay(kind: string, at: readonly [number, number]): number {
    const next = structuredClone(this.raw);
    const c = placeCarcass(this.bundle, next, kind, at, 1, this.tick);
    this.raw = next;
    this.pub = null;
    return c.id;
  }
}

/** Where the time of a leg went, in game milliseconds. */
export interface Split {
  walk: number;
  /** digging for the recipe scraps, the dig's own time */
  dig: number;
  hunt: number;
  gather: number;
  craft: number;
  /** waiting for a node to come back */
  wait: number;
  /** waiting for an animal's hours (the opening ends after dark) */
  night: number;
}

export interface Milestone {
  what: string;
  /** game ms since the route began (the end of the opening) */
  at: number;
  split: Split;
  handcraft: number;
  misses: number;
}

export interface RouteRun {
  seed: number;
  teach: Teach;
  /** digs the scraps took (found only) */
  digs?: number;
  /** trowels bought again on the way (found only) */
  trowels?: number;
  /** game ms the opening took */
  openingMs: number;
  /** game ms from the end of the opening to the next morning, when the route begins */
  nightMs: number;
  milestones: Milestone[];
  failed?: string;
}

const tile = (t: readonly [number, number]) => ({ x: t[0], y: t[1], w: 1, h: 1 });
/** The hours the route works in: the hare's day (its kind's \`hours\`), outside the wolf's night. */
const DAY: [number, number] = [6, 19];

/** One run of the route from the forager's start with one world seed. */
export async function playRoute(base: Bundle, seed: number, teach: Teach = 'start'): Promise<RouteRun> {
  const b = withHideChain(base, teach);
  const hands = new RouteHands(b, seed);
  const player = new Player(b, hands, { now: 0 });
  const run: RouteRun = { seed, teach, openingMs: 0, nightMs: 0, milestones: [] };
  const split: Split = { walk: 0, dig: 0, hunt: 0, gather: 0, craft: 0, wait: 0, night: 0 };
  let misses = 0;
  let begin = 0;

  /** Book the time a piece of work took under `kind`. */
  const book = async (kind: keyof Split, work: () => Promise<unknown>): Promise<void> => {
    const t0 = player.tick;
    await work();
    split[kind] += player.tick - t0;
  };
  const bag = (item: string) => player.state.player.bag[item] ?? 0;
  const mark = (what: string) =>
    run.milestones.push({ what, at: player.tick - begin, split: { ...split }, handcraft: professionLevel(b, player.state, HAND), misses });

  const workshop = tile(campTile(b, 'workshop')!);
  const fire = tile(campTile(b, 'fire')!);
  const instances = (source: string) =>
    Object.keys(b.instances)
      .filter((id) => b.instances[id]!.source === source)
      .sort();
  const spots = (kind: string) => (b.map.creatures?.spots ?? []).filter((s) => s.kind === kind);
  const used = new Set<string>();

  /** Leave behind what the route does not need when the bag runs short of places. */
  const SOLD = ['core/pottery-shard', 'core/old-coin'];
  const KEEP = new Set([...SOLD, 'core/stone', 'core/stone-flakes', 'core/herb', 'core/branch', 'core/log', 'core/reed', 'core/reed-cord', 'core/hare-hide', 'core/roe-hide', 'core/roe-sinew', ...HIDE_CHAIN.map((r) => r.id)]);
  const room = async (need: number) => {
    if (player.freePlaces() >= need) return;
    const spare = Object.keys(player.state.player.bag)
      .filter((id) => !KEEP.has(id) && b.items[id]?.tool === undefined && !Object.values(player.state.player.worn).includes(id) && bag(id) > 0)
      .sort();
    for (const id of spare) {
      if (player.freePlaces() >= need) return;
      await player.act({ t: 'drop', item: id, qty: bag(id), at: player.at });
    }
  };

  const gatherUntil = async (source: string, item: string, want: number) => {
    while (bag(item) < want) {
      await room(1);
      const node = instances(source)
        .map((id) => ({ id, ready: player.state.nodes[id]?.readyAt ?? 0 }))
        .sort((x, y) => x.ready - y.ready || x.id.localeCompare(y.id))[0];
      if (!node) throw new Error(`No ${source} on the map.`);
      const rect = player.rectOf(node.id);
      await book('walk', () => player.walkNear(rect));
      const wait = Math.max(0, node.ready - player.tick);
      if (wait > 0) await book('wait', async () => player.time(wait));
      await book('gather', async () => {
        const r = await hands.act({ t: 'gather', node: node.id, at: player.at });
        if (!r.ok) throw new Error(`gather ${node.id} at ${player.at} (rect ${JSON.stringify(rect)}) refused: ${r.error}`);
        player.waitUntil(player.state.player.busyUntil);
      });
    }
  };

  const craft = async (recipe: string, times = 1) => {
    const out = b.recipes[recipe]!.outputs[0]!.item;
    for (let i = 0; i < times; ) {
      await room(2);
      await book('walk', () => player.walkNear(b.recipes[recipe]!.station === 'fire' ? fire : workshop));
      const before = bag(out);
      await book('craft', async () => {
        await player.act({ t: 'craft', recipe, at: player.at });
        player.waitUntil(player.state.player.busyUntil);
      });
      if (bag(out) > before) i++;
      else {
        misses++;
        for (const s of b.recipes[recipe]!.inputs) {
          if (s.item === 'core/sinew-thread') while (bag(s.item) < s.qty && bag('core/roe-sinew') > 0) await craft('core/sinew-thread');
          if (s.item === 'core/branch' && bag(s.item) < s.qty) {
            await gatherUntil('core/oak-trees', 'core/log', 1);
            await craft('core/split-log');
          }
          if (bag(s.item) < s.qty) throw new Error(`A missed ${recipe} left too little ${s.item} to try again.`);
        }
      }
    }
  };

  const hunt = async (kind: string) => {
    const fields = b.map.creatures!.kinds[kind]!.hunt!;
    const free = spots(kind)
      .filter((s) => !used.has(`${s.x},${s.y}`))
      .map((s) => ({ s, d: Math.abs(s.x - player.at[0]) + Math.abs(s.y - player.at[1]) }))
      .sort((x, y) => x.d - y.d)[0];
    if (!free) throw new Error(`No ${kind} left to take today.`);
    used.add(`${free.s.x},${free.s.y}`);
    await room(4);
    await book('walk', () => player.walkNear(tile([free.s.x, free.s.y])));
    // an animal is about in its own hours only (the kind's \`hours\`): a hunt at night waits for the morning
    const hours = b.map.creatures!.kinds[kind]!.hours;
    if (hours) {
      const open = firstOpenTick(b, player.tick, hours);
      if (open > player.tick) await book('night', async () => player.waitUntil(open));
    }
    // the take: the animal's own time at its spot, then it lies there
    await book('hunt', async () => {
      player.time(fields.take_s * 1000);
      const id = hands.lay(kind, [free.s.x, free.s.y]);
      while ((player.state.player.carcasses ?? []).some((c) => c.id === id)) {
        await player.act({ t: 'dress', carcass: id, at: player.at });
        player.waitUntil(player.state.player.busyUntil);
      }
    });
  };

  /** Dig the gate rubble until every recipe in `want` is known, reading each scrap as it comes. */
  const digFor = async (want: string[]) => {
    const scrapOf = new Map(GATE_SCRAPS.map(([id, unlocks]) => [unlocks, id]));
    run.digs = 0;
    const known = () => want.every((r) => player.state.player.recipes.includes(r));
    while (!known()) {
      for (const r of want) {
        const id = scrapOf.get(r)!;
        if (bag(id) > 0 && !player.state.player.recipes.includes(r)) await player.act({ t: 'learn', item: id });
      }
      if (known()) break;
      await room(1);
      // a trowel wears out (40 uses): a worn-out one is bought again from the trader, walk and price counted
      const hasTrowel = Object.keys(player.state.player.bag).some((id) => b.items[id]?.tool?.kind === 'trowel' && bag(id) > 0);
      if (!hasTrowel) {
        const trader = tile(npcTile(b, 'core/trader')!);
        await book('walk', () => player.walkNear(trader));
        // what the digs turned up pays for it
        for (const id of SOLD) if (bag(id) > 0) await player.act({ t: 'sell', npc: 'core/trader', item: id, qty: bag(id), at: player.at });
        await player.act({ t: 'buy', npc: 'core/trader', item: 'core/trowel', qty: 1, at: player.at });
        run.trowels = (run.trowels ?? 0) + 1;
      }
      const spot = instances('core/ruins-gate')
        .map((id) => ({ id, ready: player.state.nodes[id]?.readyAt ?? 0 }))
        .sort((x, y) => x.ready - y.ready || x.id.localeCompare(y.id))[0]!;
      await book('walk', () => player.walkNear(player.rectOf(spot.id)));
      const wait = Math.max(0, spot.ready - player.tick);
      if (wait > 0) await book('wait', async () => player.time(wait));
      const open = firstOpenTick(b, player.tick, DAY);
      if (open > player.tick) await book('night', async () => player.waitUntil(open));
      await book('dig', async () => {
        await player.act({ t: 'dig', spot: spot.id, at: player.at });
        player.waitUntil(player.state.player.busyUntil);
      });
      run.digs++;
      // shards and coins are kept to sell; a scrap the route does not read, or a second copy, is left where it was dug
      const extra = [...GATE_SCRAPS.map(([id]) => id), 'core/stew-scrap'].filter((id) => {
        const unlocks = b.items[id]?.fragment?.unlocks;
        return bag(id) > 0 && (!want.includes(unlocks ?? '') || player.state.player.recipes.includes(unlocks ?? '') || bag(id) > 1);
      });
      for (const id of extra) {
        const keep = want.includes(b.items[id]!.fragment!.unlocks) && !player.state.player.recipes.includes(b.items[id]!.fragment!.unlocks) ? 1 : 0;
        if (bag(id) > keep) await player.act({ t: 'drop', item: id, qty: bag(id) - keep, at: player.at });
      }
    }
  };

  const wear = async (item: string) => {
    await player.act({ t: 'wear', item });
  };

  try {
    await playOpening(b, player, STARTS[0]!);
    player.waitUntil(player.state.player.busyUntil);
    run.openingMs = player.tick;
    // the opening ends after dark, when the camp's wolf walks: the route starts with the next morning, as a player's next day would
    run.nightMs = firstOpenTick(b, player.tick, DAY) - player.tick;
    player.waitUntil(player.tick + run.nightMs);
    begin = player.tick;
    hands.strict = true;

    // 1. the first piece: a hare for the leather, a roe for the thread, the work stone and two flakes, two herbs
    if (!player.state.player.camp.includes('core/work-stone')) {
      await gatherUntil('core/river-stones', 'core/stone', 4);
      await book('walk', () => player.walkNear(workshop));
      await book('craft', async () => {
        await player.act({ t: 'build', camp: 'core/work-stone', at: player.at });
        player.waitUntil(player.state.player.busyUntil);
      });
    }
    await gatherUntil('core/river-stones', 'core/stone', 4);
    await craft('core/stone-flakes', 2);
    await gatherUntil('core/wild-herbs', 'core/herb', 2);
    await hunt('core/hare');
    await hunt('core/roe');
    await craft('core/scraped-hare-hide');
    await craft('core/hare-leather');
    await craft('core/sinew-thread');
    await craft('core/hare-leather-shoes');
    await wear('core/hare-leather-shoes');
    mark('first piece worn (hare-leather shoes)');

    // 2. the tier-1 kit: hood, jerkin, leggings beside the shoes (one more hare, one more roe)
    await gatherUntil('core/river-stones', 'core/stone', 6);
    await craft('core/stone-flakes', 3);
    await gatherUntil('core/wild-herbs', 'core/herb', 4);
    await hunt('core/hare');
    await hunt('core/roe');
    await craft('core/scraped-hare-hide');
    await craft('core/hare-fur');
    await craft('core/scraped-roe-hide', 2);
    await craft('core/roe-leather', 2);
    await craft('core/sinew-thread', 3);
    await craft('core/hare-fur-hood');
    await craft('core/roe-leather-jerkin');
    await craft('core/roe-leather-leggings');
    for (const piece of ['core/hare-fur-hood', 'core/roe-leather-jerkin', 'core/roe-leather-leggings']) await wear(piece);
    mark('tier-1 kit worn (4 pieces)');

    // 3. the first set, the digger leathers (tier 2): the scraps when they are found, the workbench, two more roe boiled, the cap and the boots
    if (teach === 'found') await digFor(['core/boiled-leather', 'core/boiled-leather-cap', 'core/boiled-leather-boots']);
    if (!player.state.player.camp.includes('core/workbench')) {
      await gatherUntil('core/river-stones', 'core/stone', 4);
      await craft('core/stone-flakes', 2);
      await gatherUntil('core/reed-bank', 'core/reed', 4);
      await craft('core/reed-cord', 2);
      await gatherUntil('core/oak-trees', 'core/log', 3);
      await craft('core/split-log', 3);
      await book('walk', () => player.walkNear(workshop));
      await book('craft', async () => {
        await player.act({ t: 'build', camp: 'core/workbench', at: player.at });
        player.waitUntil(player.state.player.busyUntil);
      });
    }
    await gatherUntil('core/river-stones', 'core/stone', 4);
    await craft('core/stone-flakes', 2);
    await gatherUntil('core/wild-herbs', 'core/herb', 2);
    if (bag('core/branch') < 2) {
      await gatherUntil('core/oak-trees', 'core/log', 1);
      await craft('core/split-log', 1);
    }
    await hunt('core/roe');
    await hunt('core/roe');
    await craft('core/scraped-roe-hide', 2);
    await craft('core/roe-leather', 2);
    await craft('core/boiled-leather', 2);
    for (const piece of ['core/boiled-leather-cap', 'core/boiled-leather-boots']) {
      while (bag('core/sinew-thread') < 1) await craft('core/sinew-thread');
      await craft(piece);
    }
    for (const piece of ['core/boiled-leather-cap', 'core/boiled-leather-boots']) await wear(piece);
    mark('first set worn (digger leathers, tier 2)');
  } catch (e) {
    const held = Object.entries(player.state.player.bag).filter(([, n]) => n > 0).map(([id, n]) => `${id.replace('core/', '')} ${n}`).join(', ');
    run.failed = `${e instanceof Error ? e.message : String(e)} (bag: ${held})`;
  }
  return run;
}

const min = (ms: number) => (ms / 60000).toFixed(1);

export function formatRoute(runs: readonly RouteRun[]): string {
  const lines: string[] = [];
  for (const r of runs) {
    lines.push(`seed ${r.seed}, tier 2 ${r.teach}${r.digs !== undefined ? ` (${r.digs} digs, ${r.trowels ?? 0} trowels bought)` : ''}: opening ${min(r.openingMs)} min, then ${min(r.nightMs)} min of night to the morning${r.failed ? `; STOPPED: ${r.failed}` : ''}`);
    for (const m of r.milestones) {
      const s = m.split;
      lines.push(
        `  ${min(m.at).padStart(5)} min  ${m.what}  [walk ${min(s.walk)}, dig ${min(s.dig)}, hunt ${min(s.hunt)}, gather ${min(s.gather)}, craft ${min(s.craft)}, node wait ${min(s.wait)}, night ${min(s.night)}; handcraft ${m.handcraft}; misses ${m.misses}]`,
      );
    }
  }
  return lines.join('\n');
}
