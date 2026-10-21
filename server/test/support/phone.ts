/**
 * The smallest phone for the server's tests (NEXT 18 a, f): it posts what the game client posts, keeps
 * what the client keeps (the public state, built from the reply patches, and the state version), and
 * walks the opening of one starter through the real API, one request at a time.
 *
 * It is a helper and not a test: it asserts nothing, so a test can play the same script against the
 * memory store and against postgres and compare two books that were written by the same requests.
 */
import {
  type Action,
  type Bundle,
  type GameEvent,
  type PublicState,
  type Rect,
  type State,
  type Tile,
  applyStatePatch,
  findSlot,
  npcTile,
  salePrice,
} from '@game/kernel';

import {
  createPlayerRecord,
  type Books,
  type LedgerRow,
  type LoggedAction,
  type MergePatch,
  type PlayerRecord,
  type PlayerStore,
} from '../../src';
import { bfsNear, firstOpenTick } from '../../../tools/test/helpers/world.js';

/** The one player an in-memory server serves; a test that needs two starts two servers. */
export const PLAYER = 'player-1';
/** A fixed seed: the draws under it are the ones the tests here name. */
export const SEED = 2026;

/** The store of a test: one player in memory, and the two books written as postgres writes them. */
export class MemoryStore implements PlayerStore {
  record: PlayerRecord;
  actionLog: LoggedAction[] = [];
  goldLedger: LedgerRow[] = [];

  constructor(
    readonly bundle: Bundle,
    state: State,
    acceptedAt: number,
  ) {
    this.record = createPlayerRecord(bundle, state, acceptedAt);
  }

  async load(playerId: string): Promise<PlayerRecord | undefined> {
    return playerId === PLAYER ? structuredClone(this.record) : undefined;
  }

  /** the books are written only when the compare-and-set wins, as the postgres store does in one transaction */
  async compareAndSet(playerId: string, expectedVersion: number, next: PlayerRecord, books: Books): Promise<boolean> {
    if (playerId !== PLAYER || this.record.version !== expectedVersion) return false;
    this.record = structuredClone(next);
    this.actionLog.push({ seq: next.version, action: structuredClone(books.action), tick: books.tick });
    for (const deltaMg of books.goldDeltasMg) {
      if (deltaMg === 0) continue;
      this.goldLedger.push({ deltaMg, action: structuredClone(books.action), tick: books.tick });
    }
    return true;
  }
}

/**
 * A player at the API's door: it posts what a phone posts, and keeps only what a phone keeps - the
 * public state, built from the reply patches, and the version. It never reads the store's state.
 */
export class Wire {
  version = 1;
  state: PublicState;

  constructor(
    readonly bundle: Bundle,
    readonly base: string,
    readonly startedAt: PublicState,
    readonly clock: { now: number },
  ) {
    this.state = startedAt;
  }

  /** The time proof: the wall clock moves with the game tick the client claims, never ahead of it. */
  private setTick(tick: number): void {
    this.clock.now += Math.max(0, tick - this.state.tick);
  }

  private async post(path: string, body: unknown): Promise<GameEvent[]> {
    const response = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: { authorization: 'Bearer test', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    if (response.status !== 200) throw new Error(`POST ${path} answered ${response.status}: ${text}`);
    const reply = JSON.parse(text) as { events: GameEvent[]; patch: MergePatch; version: number };
    this.version = reply.version;
    this.state = applyStatePatch(this.state, reply.patch);
    return reply.events;
  }

  /** Walks a four-way path one tile at a time, in batches, as the client reports movement (NEXT 18 a). */
  async walk(path: readonly Tile[]): Promise<void> {
    const tiles = path.slice(1);
    if (tiles.length === 0) return;
    // the walk starts once the hands are free, and the wall clock moves with the tick it claims
    const from = Math.max(this.state.tick, this.state.player.busyUntil);
    const stepMs = this.bundle.params.walk_step_ms;
    const LIMIT = 200;
    for (let index = 0; index < tiles.length; index += LIMIT) {
      let tick = Math.max(from, this.state.tick);
      const moves = tiles.slice(index, index + LIMIT).map((at) => {
        tick += stepMs;
        return { kind: 'move' as const, at, tick };
      });
      this.setTick(tick);
      await this.post('/moves', { version: this.version, moves });
    }
  }

  async walkNear(target: Rect): Promise<void> {
    const path = bfsNear(this.bundle, this.state.player, this.state.player.at, target);
    if (!path) throw new Error(`No walking path to ${JSON.stringify(target)}.`);
    await this.walk(path);
  }

  async act(action: Action, tick = Math.max(this.state.tick, this.state.player.busyUntil)): Promise<GameEvent[]> {
    this.setTick(tick);
    return this.post('/action', { version: this.version, tick, action });
  }

  async gather(node: string, grade: number): Promise<GameEvent[]> {
    const instance = this.bundle.instances[node]!;
    const resource = this.bundle.resources[instance.source]!;
    await this.walkNear({ x: instance.x, y: instance.y, w: 1, h: 1 });
    const ready = Math.max(this.state.tick, this.state.player.busyUntil, this.state.nodes[node]?.readyAt ?? 0);
    return this.act(
      { t: 'gather', node, grade: grade as 0 | 1 | 2 | 3 | 4, at: this.state.player.at },
      firstOpenTick(this.bundle, ready, resource.hours),
    );
  }

  async dig(spot: string, grade: number): Promise<GameEvent[]> {
    const instance = this.bundle.instances[spot]!;
    await this.walkNear({ x: instance.x, y: instance.y, w: 1, h: 1 });
    const ready = Math.max(this.state.tick, this.state.player.busyUntil, this.state.nodes[spot]?.readyAt ?? 0);
    return this.act({ t: 'dig', spot, grade: grade as 0 | 1 | 2 | 3 | 4, at: this.state.player.at }, ready);
  }
}

/** The three starts, with their own first task and the place it happens (the opening, section 18). */
export const STARTS = [
  { starter: 'core/forager', own: 'core/first-pickings', place: 'core/bank-herbs' },
  { starter: 'core/digger', own: 'core/buried-axe', place: 'core/slid-bank' },
  { starter: 'core/explorer', own: 'core/glint-by-the-bridge', place: 'core/bridge-glint' },
] as const;

export type Start = (typeof STARTS)[number];

/** What one played run leaves behind besides its books. */
export interface PlayedRun {
  /** the oak the careless strike fell on: its draw is the one number the seed decides alone */
  careless: string;
  /** the logs that strike paid, one or none */
  drawn: number;
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

/**
 * Play one start's opening through the wire: the start, its own task, the keystone, the bridge's
 * reward, one felled oak, and at the stall one payment and one sale. Every request is a phone's, in a
 * phone's order, so the log it leaves is a log the server accepted.
 *
 * The last action is one careless strike at a second oak: grade 0 pays nothing by itself, and the draw
 * under it decides whether a log falls. It comes last so that the luck shows in the books without
 * changing what the rest of the run costs.
 */
export async function playOpening(wire: Wire, start: Start): Promise<PlayedRun> {
  const { bundle } = wire;
  await wire.act({ t: 'start', starter: start.starter, name: 'Tess' }, 0);
  if (wire.state.player.starter !== start.starter) throw new Error(`The server did not start ${start.starter}.`);

  const [own, instance] = required(instancesOf(bundle, start.place)[0], `The map has no ${start.place}.`);
  if (instance.kind === 'resource') await wire.gather(own, 3);
  else await wire.dig(own, 3);
  if (wire.state.player.quests[start.own] !== 'done') throw new Error(`${start.own} is not done after its own task.`);

  const [keystone] = required(instancesOf(bundle, 'core/keystone')[0], 'The map has no keystone.');
  await wire.gather(keystone, 3);
  const bridge = required(findSlot(bundle.map, 'core/old-bridge'), 'The bridge slot is missing.');
  await wire.walkNear(bridge);
  await wire.act({ t: 'restore', restore: 'core/old-bridge', at: wire.state.player.at });

  const oaks = instancesOf(bundle, 'core/oak-trees');
  const [oak] = required(oaks[0], 'The map has no oak.');
  await wire.gather(oak, 3);
  if ((wire.state.player.bag['core/log'] ?? 0) < 1) throw new Error('The oak gave no log.');

  const trader = required(npcTile(bundle, 'core/trader'), 'The trader is missing.');
  await wire.walkNear({ x: trader[0], y: trader[1], w: 1, h: 1 });
  const at = wire.state.player.at;
  await wire.act({ t: 'buy', npc: 'core/trader', item: 'core/berry', qty: 1, at });
  required(salePrice(bundle, wire.state, 'core/log', 1), 'The trader does not buy a log.');
  await wire.act({ t: 'sell', npc: 'core/trader', item: 'core/log', qty: 1, at });

  const careless = required(oaks[1], 'The map has a single oak.')[0];
  const before = wire.state.player.bag['core/log'] ?? 0;
  await wire.gather(careless, 0);
  return { careless, drawn: (wire.state.player.bag['core/log'] ?? 0) - before };
}
