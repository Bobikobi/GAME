/**
 * The smallest phone for the server's tests (NEXT 18 a, f): it posts what the game client posts, keeps
 * what the client keeps (the public state, built from the reply patches, and the state version), and
 * walks the opening of one starter through the real API, one request at a time.
 *
 * It is a helper and not a test: it asserts nothing, so a test can play the same script against the
 * memory store and against postgres and compare two books that were written by the same requests.
 *
 * `LocalPhone` plays the same script the way the demo does before an account exists (NEXT 18 d): on the
 * phone's own kernel, under the phone's own seed, keeping every step it played as the opening log.
 */
import {
  LEGACY_STARTERS,
  type Action,
  type Bundle,
  type GameEvent,
  type OpeningUpload,
  type PublicState,
  type Rect,
  type Seed,
  type State,
  type Tile,
  applyStatePatch,
  findSlot,
  newState,
  npcTile,
  salePrice,
  serialize,
  step,
  widenSeed,
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
/** A fixed key: the draws under it are the ones the tests here name. */
export const SEED: Seed = widenSeed(2026);

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
    for (const row of books.gold) {
      if (row.deltaMg === 0) continue;
      this.goldLedger.push(structuredClone(row));
    }
    return true;
  }
}

/** A walked tile as the client reports it, with the tick it was reached at. */
interface MoveReport {
  kind: 'move';
  at: Tile;
  tick: number;
}

/**
 * The script's player, wherever it plays: it walks and acts on the state it can see, and a subclass says
 * where a step goes, to the API or to the phone's own kernel.
 */
abstract class Player {
  abstract readonly state: PublicState;

  constructor(readonly bundle: Bundle) {}

  /** Play a run of walked tiles, each at its own tick. */
  protected abstract sendMoves(moves: MoveReport[]): Promise<void>;
  /** Play one action at a tick and answer its events. */
  protected abstract sendAction(action: Action, tick: number): Promise<GameEvent[]>;

  /** Walks a four-way path one tile at a time, in batches, as the client reports movement (NEXT 18 a). */
  async walk(path: readonly Tile[]): Promise<void> {
    const tiles = path.slice(1);
    if (tiles.length === 0) return;
    // the walk starts once the hands are free
    const from = Math.max(this.state.tick, this.state.player.busyUntil);
    const stepMs = this.bundle.params.walk_step_ms;
    const LIMIT = 200;
    for (let index = 0; index < tiles.length; index += LIMIT) {
      let tick = Math.max(from, this.state.tick);
      const moves = tiles.slice(index, index + LIMIT).map((at) => {
        tick += stepMs;
        return { kind: 'move' as const, at, tick };
      });
      await this.sendMoves(moves);
    }
  }

  async walkNear(target: Rect): Promise<void> {
    const path = bfsNear(this.bundle, this.state.player, this.state.player.at, target);
    if (!path) throw new Error(`No walking path to ${JSON.stringify(target)}.`);
    await this.walk(path);
  }

  async act(action: Action, tick = Math.max(this.state.tick, this.state.player.busyUntil)): Promise<GameEvent[]> {
    return this.sendAction(action, tick);
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

/**
 * A player at the API's door: it posts what a phone posts, and keeps only what a phone keeps - the
 * public state, built from the reply patches, and the version. It never reads the store's state.
 */
export class Wire extends Player {
  version = 1;
  state: PublicState;

  constructor(
    bundle: Bundle,
    readonly base: string,
    readonly startedAt: PublicState,
    readonly clock: { now: number },
  ) {
    super(bundle);
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

  protected async sendMoves(moves: MoveReport[]): Promise<void> {
    this.setTick(moves[moves.length - 1]!.tick);
    await this.post('/moves', { version: this.version, moves });
  }

  protected sendAction(action: Action, tick: number): Promise<GameEvent[]> {
    this.setTick(tick);
    return this.post('/action', { version: this.version, tick, action });
  }
}

/**
 * The demo before an account (NEXT 18 d): the phone's own kernel under the phone's own seed, as the game's
 * `Session` plays it - no travel check, since the server is not there yet - with every step it played kept
 * in order as the opening log the sign-up hands over.
 */
export class LocalPhone extends Player {
  state: State;
  readonly log: { a: Action; tick: number }[] = [];

  constructor(bundle: Bundle, readonly seed: Seed) {
    super(bundle);
    this.state = newState(bundle, seed);
  }

  private play(action: Action, tick: number): GameEvent[] {
    const result = step(this.bundle, this.state, action, tick);
    if (!result.ok) throw new Error(`The phone refused ${JSON.stringify(action)} at ${tick}: ${result.error}`);
    this.state = result.state;
    this.log.push({ a: structuredClone(action), tick });
    return result.events;
  }

  protected async sendMoves(moves: MoveReport[]): Promise<void> {
    for (const move of moves) this.play({ t: 'move', at: move.at }, move.tick);
  }

  protected async sendAction(action: Action, tick: number): Promise<GameEvent[]> {
    return this.play(action, tick);
  }

  /** What the sign-up hands over: the seed, the log, and the state the log ended on. */
  upload(): OpeningUpload {
    return { seed: this.seed, log: structuredClone(this.log), state: serialize(this.state) };
  }
}

/** The three starts, with their own first task and the place it happens (the opening, section 18). */
export const STARTS = [
  { starter: 'core/forager', own: 'core/first-pickings', place: 'core/bank-herbs' },
  { starter: 'core/digger', own: 'core/buried-axe', place: 'core/slid-bank-dig' },
  { starter: 'core/explorer', own: 'core/glint-by-the-bridge', place: 'core/bridge-glint' },
] as const;

export type Start = (typeof STARTS)[number];

/** What one played run leaves behind besides its books. */
export interface PlayedRun {
  /** the reeds the careless pull fell on: its draw is the one number the seed decides alone */
  careless: string;
  /** the reeds that pull paid, one or none */
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
 * The last action is one careless pull at the reeds: grade 0 pays nothing by itself, and the draw
 * under it decides whether a reed comes home. It comes last so that the luck shows in the books without
 * changing what the rest of the run costs. The reeds play a minigame; an oak is felled by itself, which
 * reads every grade as 3 and never misses (QUARRYING 10).
 */
export async function playOpening(wire: Player, start: Start): Promise<PlayedRun> {
  const { bundle } = wire;
  await wire.act({ t: 'start', starter: start.starter, name: 'Tess' }, 0);
  if (wire.state.player.race !== LEGACY_STARTERS[start.starter]?.race) throw new Error(`The server did not start ${start.starter}.`);

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

  const careless = required(instancesOf(bundle, 'core/reed-bank')[0], 'The map has no reeds.')[0];
  const before = wire.state.player.bag['core/reed'] ?? 0;
  await wire.gather(careless, 0);
  return { careless, drawn: (wire.state.player.bag['core/reed'] ?? 0) - before };
}
