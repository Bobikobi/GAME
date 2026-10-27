/**
 * The scripted session the simulated player plays (NEXT 18 g): a starter's whole opening, the first
 * outing the content has (through the night arch, the deep ruins and the tangle's heart), and the first
 * sale at the trader.
 *
 * It is a player, not a recording: every step is decided on the state the server answered, so a draw that
 * falls another way is walked through rather than expected. What it does send is kept, and the same log
 * replayed on the laptop must reach the same state byte for byte.
 *
 * The beats, and the test each one holds (`tools/test/opening.test.ts`, `tools/test/maze.test.ts`):
 * the own first task, the keystone and the bridge, the first fire and the log split at it, the town, the
 * two helps, Maru's coin, the arch at night, then past it by day: the deep ruins dug and the tangle's
 * heart found, and the walk home to hand it in.
 */
import {
  type Bundle,
  type GameEvent,
  type Tile,
  campTile,
  npcTile,
} from '@game/kernel';

import { firstOpenTick } from '../../../tools/test/helpers/world.js';
import { Player } from './player.js';

/** Every starter begins its own way: its own first task, and the place that task is met at. */
export interface Start {
  starter: string;
  /** the starter's own first quest */
  own: string;
  /** the resource or dig spot that quest names */
  place: string;
}

export const STARTS: readonly Start[] = [
  { starter: 'core/forager', own: 'core/first-pickings', place: 'core/bank-herbs' },
  { starter: 'core/digger', own: 'core/buried-axe', place: 'core/slid-bank-dig' },
  { starter: 'core/explorer', own: 'core/glint-by-the-bridge', place: 'core/bridge-glint' },
];

/** What the run did, as the test asserts it. */
export interface RunSummary {
  starter: string;
  /** the bag as the opening left it */
  bagAfterOpening: Record<string, number>;
  /** the spots the outing dug */
  digs: number;
  /** the item the first sale sold, and what the trader paid for it (milli-gold) */
  sold: string;
  paidMg: number;
  goldBeforeSale: number;
  goldAfterSale: number;
  /** how many actions and movement reports went over the wire */
  actions: number;
  moves: number;
  /** the game time the run took, in ms */
  gameMs: number;
}

function instancesOf(bundle: Bundle, source: string): [string, Bundle['instances'][string]][] {
  return Object.entries(bundle.instances)
    .filter(([, instance]) => instance.source === source)
    .sort(([a], [b]) => a.localeCompare(b));
}

function one<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

function at(tile: Tile): { x: number; y: number; w: number; h: number } {
  return { x: tile[0], y: tile[1], w: 1, h: 1 };
}

/** The whole session: the opening, the first outing, the first sale. */
export async function playSession(bundle: Bundle, player: Player, start: Start): Promise<RunSummary> {
  await playOpening(bundle, player, start);
  const bagAfterOpening = { ...player.state.player.bag };
  const { digs } = await playFirstOuting(bundle, player);
  const goldBeforeSale = player.state.player.gold;
  const { sold, paidMg, goldAfterSale } = await firstSale(bundle, player);
  return {
    starter: start.starter,
    bagAfterOpening,
    digs,
    sold,
    paidMg,
    goldBeforeSale,
    goldAfterSale,
    actions: player.log.filter((entry) => entry.a.t !== 'move').length,
    moves: player.log.filter((entry) => entry.a.t === 'move').length,
    gameMs: player.tick,
  };
}

/**
 * The opening, to the doorstep of the night ruins: its own first task, the keystone that mends the
 * bridge, the first fire, the town, the two helps, Maru's coin, and the arch that opens at night.
 */
export async function playOpening(bundle: Bundle, player: Player, start: Start): Promise<void> {
  const elder = at(one(npcTile(bundle, 'core/elder'), 'The elder has no tile.'));
  const trader = at(one(npcTile(bundle, 'core/trader'), 'The trader has no tile.'));

  await player.act({ t: 'start', starter: start.starter, name: 'Sim' });

  const ownTask = async (): Promise<void> => {
    const [spot] = instancesOf(bundle, start.place);
    if (!spot) throw new Error(`The map places no ${start.place}.`);
    if (bundle.instances[spot[0]]!.kind === 'resource') await player.gather(spot[0]);
    else await player.dig(spot[0]);
  };

  // the keystone waits for the start's own first task: the explorer's glint, the forager's herbs over the stone
  if (start.starter !== 'core/digger') await ownTask();

  // the taught strike: one keystone in the shallows mends the bridge
  const [keystone] = instancesOf(bundle, 'core/keystone');
  const strike = await player.gather(one(keystone, 'The map places no keystone.')[0]);
  if (!strike.some((event) => event.e === 'discover' && event.item === 'core/keystone')) {
    throw new Error('The keystone was gathered but not discovered.');
  }

  if (start.starter === 'core/digger') await ownTask();

  await player.actNear(player.slot('core/old-bridge'), (tile) => ({ t: 'restore', restore: 'core/old-bridge', at: tile }));

  // a fire before dark: one oak gives the logs, and the log that is left splits into two branches at it
  const [oak] = instancesOf(bundle, 'core/oak-trees');
  await player.gather(one(oak, 'The map places no oak.' )[0]);
  const fire = one(campTile(bundle, 'fire'), 'The map has no fire spot.');
  await player.actNear(at(fire), (tile) => ({ t: 'build', camp: 'core/campfire', at: tile }));
  await player.actNear(at(fire), (tile) => ({ t: 'craft', recipe: 'core/split-log', at: tile }));

  await player.visit('core/town-square');

  // the real choice: whom to help first. Both helps pick with a basket, so a start without one buys it.
  if ((player.state.player.bag['core/basket'] ?? 0) < 1) {
    await player.actNear(trader, (tile) => ({ t: 'buy', npc: 'core/trader', item: 'core/basket', qty: 1, at: tile }));
  }

  // Maru's bells: a basket of bell flowers for the elder
  await player.actNear(elder, (tile) => ({ t: 'accept', quest: 'core/three-fruits', at: tile }));
  await player.gather(one(instancesOf(bundle, 'core/bell-bushes')[0], 'The map places no bell bush.')[0]);
  await player.actNear(elder, (tile) => ({ t: 'turnin', quest: 'core/three-fruits', at: tile }));

  // Pell's herbs: one sun herb for the trader
  await player.actNear(trader, (tile) => ({ t: 'accept', quest: 'core/herbs-for-pell', at: tile }));
  await player.gather(one(instancesOf(bundle, 'core/sun-herbs')[0], 'The map places no sun herb.')[0]);
  await player.actNear(trader, (tile) => ({ t: 'turnin', quest: 'core/herbs-for-pell', at: tile }));

  // Maru's coin, by the trowel's road: a dig at the lantern's foot
  await player.actNear(elder, (tile) => ({ t: 'accept', quest: 'core/a-coin-for-maru', at: tile }));
  await player.dig(one(instancesOf(bundle, 'core/lantern-foot')[0], 'The map places no lantern foot.')[0]);
  await player.actNear(elder, (tile) => ({ t: 'turnin', quest: 'core/a-coin-for-maru', at: tile }));

  // the night discovery: the rubble fills the arch by day, and a way runs under it after dark
  await player.visit('core/arch-mouth');
  const dusk = firstOpenTick(bundle, Math.max(player.tick, player.state.player.busyUntil), [20, 5]);
  const events = await player.visit('core/arch-mouth', dusk);
  if (!events.some((event) => event.e === 'restore' && event.restore === 'core/arch-way')) {
    throw new Error('The arch did not open at night.');
  }
  await player.visit('core/night-threshold');
}

/**
 * The first outing: past the arch by day, the gate stones of the ruins dug (and the deep, once the gate
 * has taught the trowel's way), the tangle's heart found, and the walk home to hand it in to the elder.
 *
 * This is the first expedition `develop` has content for: `bundle.expeditions` is empty, since the night
 * ruins of NEXT 14b are not built. The outing is its own step so the real one joins here.
 */
/** The places the outing wants free before it sets out: one per dig it means to make. */
const OUTING_ROOM = 4;

export async function playFirstOuting(bundle: Bundle, player: Player): Promise<{ digs: number }> {
  const elder = at(one(npcTile(bundle, 'core/elder'), 'The elder has no tile.'));
  const trader = at(one(npcTile(bundle, 'core/trader'), 'The trader has no tile.'));
  // the ruins' night is the toll of the pit and the wolf's round: this outing is walked by day
  player.waitForHour(6);

  // a bag of 12 places has little room left after the opening (DECISIONS.md, 2026-10-23): a player
  // empties it at Pell's stall before the ruins, one unit at a time, until the finds have room
  while (player.freePlaces() < OUTING_ROOM) {
    const spare = player.sellable();
    if (spare === undefined) break;
    await player.actNear(trader, (tile) => ({ t: 'sell', npc: 'core/trader', item: spare, qty: 1, at: tile }));
  }

  await player.actNear(elder, (tile) => ({ t: 'accept', quest: 'core/the-tangle', at: tile }));

  // the gate stones behind the threshold, a day dig now that the arch is open
  let digs = 0;
  for (const [spot] of instancesOf(bundle, 'core/ruins-gate')) {
    if (!player.canDig(spot)) continue;
    await player.dig(spot);
    digs += 1;
  }
  // and the deep, once the gate has taught the trowel's way: it asks for a level the opening only just reaches
  for (const [spot] of instancesOf(bundle, 'core/ruins-deep')) {
    if (!player.canDig(spot)) break;
    await player.dig(spot);
    digs += 1;
    break;
  }

  await player.visit('core/tangle-heart');
  await player.actNear(elder, (tile) => ({ t: 'turnin', quest: 'core/the-tangle', at: tile }));
  // TODO(NEXT 18 g): when 14b's night ruins land, this outing is the expedition the item names.
  return { digs };
}

/** The first sale: one thing from the bag the trader pays for. */
export async function firstSale(
  bundle: Bundle,
  player: Player,
): Promise<{ sold: string; paidMg: number; goldAfterSale: number }> {
  const trader = at(one(npcTile(bundle, 'core/trader'), 'The trader has no tile.'));
  const sold = player.sellable();
  if (sold === undefined) throw new Error('The bag holds nothing the trader pays for.');
  const events = await player.actNear(trader, (tile) => ({ t: 'sell', npc: 'core/trader', item: sold, qty: 1, at: tile }));
  const gold = events.find((event): event is Extract<GameEvent, { e: 'gold' }> => event.e === 'gold');
  if (gold === undefined || gold.delta <= 0) throw new Error(`The sale of ${sold} paid no gold.`);
  return { sold, paidMg: gold.delta, goldAfterSale: player.state.player.gold };
}
