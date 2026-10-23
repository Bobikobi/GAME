/**
 * The simulated player (NEXT 18 g): a hand that walks, waits and acts, and keeps the log it sent so the
 * same actions can be replayed on the laptop.
 *
 * Nothing here knows about HTTP: `Hands` is the surface a phone has (`RemoteSession` over the wire, or the
 * kernel directly in a dry run), and the player only ever reads the state the hand shows it. What it sends
 * comes back as events, and what the server answers is what the next decision is made on.
 */
import {
  type Action,
  type Bundle,
  type GameEvent,
  type PublicState,
  type Rect,
  type Tile,
  hourOf,
  professionLevel,
  salePrice,
} from '@game/kernel';

import { bfsInside, bfsNear, bfsToTile, firstOpenTick, type Tile as MapTile } from '../../../tools/test/helpers/world.js';

export type { MapTile };

/** What one action or one movement report carries to the wire: the shape `replay` takes. */
export interface LogEntry {
  a: Action;
  tick: number;
}

export type ActResult = { ok: true; events: GameEvent[] } | { ok: false; error: string };

/** The phone's surface, as far as a player uses it. */
export interface Hands {
  readonly state: PublicState;
  readonly tick: number;
  advance(dt: number): void;
  report(at: readonly [number, number]): void;
  act(action: Action): Promise<ActResult>;
  flushMoves(): Promise<void>;
}

/** One frame of the phone's loop: the longest `advance` takes at once (`LONGEST_FRAME_MS` in the client). */
const FRAME_MS = 250;

/** The server's wall clock: the run moves it with the game time it claims. */
export interface Clock {
  now: number;
}

export class Player {
  readonly log: LogEntry[] = [];

  constructor(
    readonly bundle: Bundle,
    readonly hands: Hands,
    readonly clock: Clock,
  ) {}

  get state(): PublicState {
    return this.hands.state;
  }

  get tick(): number {
    return this.hands.tick;
  }

  get at(): Tile {
    return [this.state.player.at[0], this.state.player.at[1]];
  }

  /** Game time passes on the phone and on the server's clock at the same rate: one cannot race the other. */
  time(ms: number): void {
    let left = Math.max(0, Math.round(ms));
    while (left > 0) {
      const dt = Math.min(FRAME_MS, left);
      this.hands.advance(dt);
      this.clock.now += dt;
      left -= dt;
    }
  }

  waitUntil(tick: number): void {
    this.time(Math.max(0, tick - this.tick));
  }

  /** The first tick at or after now whose hour is `hour`. */
  waitForHour(hour: number): void {
    this.waitUntil(firstOpenTick(this.bundle, this.tick, [hour, (hour + 1) % 24]));
  }

  /** Four-way walk to the last tile of `path`, one tile per step of the clock. */
  async walk(path: readonly MapTile[]): Promise<void> {
    for (const at of path.slice(1)) {
      this.time(this.bundle.params.walk_step_ms);
      this.hands.report(at);
      this.log.push({ a: { t: 'move', at: [at[0], at[1]] }, tick: this.hands.tick });
    }
    await this.hands.flushMoves();
  }

  async walkNear(target: Rect): Promise<MapTile> {
    const path = bfsNear(this.bundle, this.state.player, this.at, target);
    if (!path) throw new Error(`Nothing next to ${JSON.stringify(target)} can be walked to from ${this.at}.`);
    await this.walk(path);
    return path[path.length - 1]!;
  }

  async walkInto(slot: Rect): Promise<MapTile> {
    const path = bfsInside(this.bundle, this.state.player, this.at, slot);
    if (!path) throw new Error(`Nothing inside ${JSON.stringify(slot)} can be walked to from ${this.at}.`);
    await this.walk(path);
    return path[path.length - 1]!;
  }

  async walkTo(tile: MapTile): Promise<void> {
    const path = bfsToTile(this.bundle, this.state.player, this.at, tile);
    if (!path) throw new Error(`${tile} cannot be walked to from ${this.at}.`);
    await this.walk(path);
  }

  /** One action at the clock it stands at, once the work before it is done. */
  async act(action: Action): Promise<GameEvent[]> {
    await this.hands.flushMoves();
    this.waitUntil(Math.max(this.tick, this.state.player.busyUntil));
    const tick = this.hands.tick;
    const result = await this.hands.act(action);
    if (!result.ok) throw new Error(`${action.t} was refused: ${result.error}`);
    // a refusal changes nothing on the server, so only what it accepted goes in the log
    if (action.t !== 'move') this.log.push({ a: action, tick });
    return result.events;
  }

  /** An action made from the last tile of a walk to `target`. */
  async actNear(target: Rect, make: (at: Tile) => Action, tick?: number): Promise<GameEvent[]> {
    const at = await this.walkNear(target);
    if (tick !== undefined) this.waitUntil(tick);
    return this.act(make(at));
  }

  /** The instance's rect, as the map places it. */
  rectOf(instanceId: string): Rect {
    const instance = this.bundle.instances[instanceId];
    if (!instance) throw new Error(`The bundle places no ${instanceId}.`);
    return { x: instance.x, y: instance.y, w: 1, h: 1 };
  }

  slot(id: string): Rect & { id: string } {
    const slot = this.bundle.map.slots.find((entry) => entry.id === id);
    if (!slot) throw new Error(`The map has no slot ${id}.`);
    return slot as Rect & { id: string };
  }

  /** A gather, waiting for the plant's hours and the node's rest, at the timing grade a player aims for. */
  async gather(node: string): Promise<GameEvent[]> {
    const instance = this.bundle.instances[node];
    if (!instance) throw new Error(`The bundle places no ${node}.`);
    const resource = this.bundle.resources[instance.source];
    if (!resource) throw new Error(`${node} is not a resource.`);
    const minimum = Math.max(this.tick, this.state.player.busyUntil, this.state.nodes[node]?.readyAt ?? 0);
    const tick = firstOpenTick(this.bundle, minimum, resource.hours);
    return this.actNear(this.rectOf(node), (at) => ({ t: 'gather', node, grade: 3, at }), tick);
  }

  async dig(spot: string): Promise<GameEvent[]> {
    const instance = this.bundle.instances[spot];
    if (!instance) throw new Error(`The bundle places no ${spot}.`);
    const minimum = Math.max(this.tick, this.state.player.busyUntil, this.state.nodes[spot]?.readyAt ?? 0);
    return this.actNear(this.rectOf(spot), (at) => ({ t: 'dig', spot, grade: 3, at }), minimum);
  }

  async visit(slotId: string, tick?: number): Promise<GameEvent[]> {
    const at = await this.walkInto(this.slot(slotId));
    if (tick !== undefined) this.waitUntil(tick);
    return this.act({ t: 'visit', slot: slotId, at });
  }

  /** Whether a dig spot can be worked at all: its tool in the bag, and the level it asks for. */
  canDig(spot: string): boolean {
    const treasure = this.bundle.treasures[this.bundle.instances[spot]?.source ?? ''];
    if (treasure === undefined) return false;
    if (treasure.tool !== undefined) {
      const held = Object.keys(this.state.player.bag).some(
        (item) => this.bundle.items[item]?.tool?.kind === treasure.tool && (this.state.player.bag[item] ?? 0) > 0,
      );
      if (!held) return false;
    }
    if (treasure.level !== undefined && professionLevel(this.bundle, this.state, this.bundle.verbs.dig) < treasure.level) {
      return false;
    }
    return true;
  }

  /** The first thing in the bag a trader pays for, with one unit to sell: never a tool, which is what works. */
  sellable(): string | undefined {
    return Object.keys(this.state.player.bag)
      .filter((item) => (this.state.player.bag[item] ?? 0) > 0 && this.bundle.items[item]?.tool === undefined)
      .filter((item) => (salePrice(this.bundle, this.state, item, 1) ?? 0) > 0)
      .sort()[0];
  }

  /** The game's hour, read the way the screens read it. */
  hour(): number {
    return hourOf(this.bundle, this.tick);
  }
}
