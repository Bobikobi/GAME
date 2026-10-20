/**
 * The same game, played on the server (NEXT 18 c). `RemoteSession` offers the surface `Session` offers,
 * but it holds no save and no seed: the server keeps the state, the seed and the clock, and this class
 * sends what the player did and shows what comes back.
 *
 * What stays on the device: the settings the game keeps outside any save (sound, language, zoom) and the
 * day the demo was first played. What lives on the server: the state, the bag, the last position, and what
 * the player has met and heard. A dropped line pauses rather than guesses (the owner, Q5): every action but
 * a walk waits for the reply, because the seed is the server's and a drawn outcome cannot be predicted.
 */
import {
  type Action,
  type Bundle,
  type GameEvent,
  type MergePatch,
  type PublicState,
  type Tile,
  applyStatePatch,
  hourOf,
} from '@game/kernel';

import { LONGEST_FRAME_MS, type Facing, type LogEntry, type SessionEvents } from './session';

export type ActResult = { ok: true; events: GameEvent[] } | { ok: false; error: string };

/** What the four endpoints answer: the state, or a patch of it with the events of the step. */
export interface StateReply {
  state: PublicState;
  version: number;
  /** the appear nodes standing now, as the server drew them */
  appears: string[];
}

export interface ChangeReply {
  events: GameEvent[];
  patch: MergePatch;
  version: number;
  /** the appear nodes standing now, as the server drew them */
  appears: string[];
}

/** The wire the phone talks over. A test passes a fake that answers the same four shapes. */
export interface Wire {
  post(path: '/session', body: unknown): Promise<StateReply>;
  post(path: '/action' | '/moves', body: unknown): Promise<ChangeReply>;
  get(path: '/state'): Promise<StateReply>;
}

/** The server refused, in plain words a player can read. Nothing changed. */
export class WireRefusal extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** The line is gone: the game pauses until a resume answers. Nothing was sent. */
export class WireGap extends Error {}

/**
 * The wire over `fetch`, with the session cookie a signed-in player carries. Same-origin by default, so
 * the cookie is `httpOnly`, `secure` and `same-site` without the script ever touching it (NEXT 18 e).
 */
export function fetchWire(base = '', send: typeof fetch = fetch): Wire {
  const call = async (path: string, method: 'GET' | 'POST', body?: unknown): Promise<StateReply | ChangeReply> => {
    let response: Response;
    try {
      response = await send(`${base}${path}`, {
        method,
        credentials: 'same-origin',
        headers: body === undefined ? { accept: 'application/json' } : { accept: 'application/json', 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new WireGap('Waiting for the connection');
    }
    if (response.status === 401) throw new WireRefusal('Sign in to continue.', 401);
    const answer = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new WireRefusal(answer.error ?? 'The game server could not complete the request.', response.status);
    return answer as StateReply | ChangeReply;
  };
  function post(path: '/session', body: unknown): Promise<StateReply>;
  function post(path: '/action' | '/moves', body: unknown): Promise<ChangeReply>;
  function post(path: '/action' | '/moves' | '/session', body: unknown): Promise<StateReply | ChangeReply> {
    return call(path, 'POST', body);
  }
  return { post, get: (path) => call(path, 'GET') as Promise<StateReply> };
}

const TAIL = 40;
/** How many movement reports one batch carries at most: the server's own cap (NEXT 18 a). */
const MOVE_BATCH = 256;

export class RemoteSession {
  readonly bundle: Bundle;
  state: PublicState;
  tick = 0;
  pos: [number, number];
  facing: Facing = 'down';
  /** what the server has told this session; a resume brings it back */
  readonly met = new Set<string>();
  readonly heard = new Set<string>();
  tail: LogEntry[] = [];
  /** the appear nodes the server says stand now: drawn on the phone, never drawn from a seed here */
  private appearing = new Set<string>();
  /** the state version the next write names: two requests cannot both win on the server */
  version: number;
  /** true while an action waits for its reply: input is held, so nothing is sent twice */
  waiting = false;
  private open = true;
  private pauses = 0;
  private deferred: GameEvent[] = [];
  private moves: { kind: 'move'; at: Tile; tick: number }[] = [];
  private listeners = new Map<keyof SessionEvents, Set<(payload: never) => void>>();
  private wire: Wire;
  /** the in-game hour of the last frame: when it turns, what depends on the hour redraws */
  private hour = -1;

  private constructor(bundle: Bundle, wire: Wire, state: PublicState, version: number) {
    this.bundle = bundle;
    this.wire = wire;
    this.state = state;
    this.version = version;
    this.pos = [state.player.at[0], state.player.at[1]];
  }

  /**
   * Resume: `POST /session` with nothing in it answers the state the server keeps. The phone sends no state
   * of its own, and the game never runs a tick the player did not ask for.
   */
  static async join(bundle: Bundle, wire: Wire): Promise<RemoteSession> {
    const reply = await wire.post('/session', {}) as StateReply;
    return new RemoteSession(bundle, wire, reply.state, reply.version);
  }

  get started(): boolean {
    return this.state.player.starter !== '';
  }

  get busy(): boolean {
    return this.tick < this.state.player.busyUntil;
  }

  get paused(): boolean {
    return this.pauses > 0 || !this.open;
  }

  /** A node a reaction raises: the server drew it, and this phone only reads that it stands. */
  appears(id: string): boolean {
    return this.appearing.has(id);
  }

  /** False once the line dropped: the game waits for `resume()` rather than play on. */
  get connected(): boolean {
    return this.open;
  }

  meet(npcId: string): boolean {
    if (this.met.has(npcId)) return false;
    this.met.add(npcId);
    return true;
  }

  hear(key: string): void {
    this.heard.add(key);
  }

  pause(): void {
    this.pauses++;
  }

  resume(): void {
    this.pauses = Math.max(0, this.pauses - 1);
  }

  on<K extends keyof SessionEvents>(name: K, fn: (payload: SessionEvents[K]) => void): () => void {
    let set = this.listeners.get(name);
    if (!set) {
      set = new Set();
      this.listeners.set(name, set);
    }
    const listener = fn as (payload: never) => void;
    set.add(listener);
    return () => set.delete(listener);
  }

  private emit<K extends keyof SessionEvents>(name: K, payload: SessionEvents[K]): void {
    for (const fn of this.listeners.get(name) ?? []) (fn as (p: SessionEvents[K]) => void)(payload);
  }

  /** Called every frame with real elapsed ms, as the local session is. */
  advance(dt: number): void {
    if (!this.started || this.paused) return;
    this.tick += Math.max(0, Math.min(LONGEST_FRAME_MS, Math.round(dt)));
    if (this.deferred.length > 0 && !this.busy) {
      const events = this.deferred;
      this.deferred = [];
      this.emit('events', events);
      this.emit('change', undefined);
    }
    const hour = hourOf(this.bundle, this.tick);
    if (hour !== this.hour) {
      if (this.hour >= 0) this.emit('change', undefined);
      this.hour = hour;
    }
  }

  /**
   * Nothing can be checked without the server: whether an action is allowed is its word, not the phone's.
   * A caller that shows "you cannot do that" before sending waits for `act`'s refusal instead.
   */
  check(): undefined {
    return undefined;
  }

  /** Report the tile the player stands on. Reports batch, and go out with the next action or on their own. */
  report(at: readonly [number, number], again = false): void {
    if (!this.started || !this.open) return;
    const p = this.state.player;
    if (!again && p.at[0] === at[0] && p.at[1] === at[1]) return;
    this.moves.push({ kind: 'move', at: [at[0], at[1]], tick: this.tick });
    if (this.moves.length >= MOVE_BATCH) void this.flushMoves().catch(() => undefined);
  }

  /** Send what is owed: the batched walk first, so an action names the tile the server already knows. */
  async flushMoves(): Promise<void> {
    if (!this.open) return;
    while (this.moves.length > 0) {
      const batch = this.moves.splice(0, MOVE_BATCH);
      let reply: ChangeReply | undefined;
      try {
        reply = await this.call('/moves', { version: this.version, moves: batch });
      } catch (error) {
        // a refused walk is not retried: the phone is out of step, so it takes the server's tile back
        if (error instanceof WireRefusal) {
          this.moves = [];
          await this.resumeFromServer().catch(() => undefined);
          return;
        }
        throw error;
      }
      if (!reply) {
        this.moves.unshift(...batch);
        return;
      }
      this.land(reply);
      if (reply.events.length > 0) {
        this.wake(reply.events);
        this.emit('events', reply.events);
        this.emit('change', undefined);
      }
    }
  }

  /**
   * One action, and the server's answer. The phone shows what came back: a busy step holds the rest of the
   * events until the player is free, as the local session does, so an animation and its yield stay in step.
   */
  async act(action: Action): Promise<ActResult> {
    await this.flushMoves();
    if (!this.open) return { ok: false, error: 'Waiting for the connection' };
    this.waiting = true;
    try {
      let reply: ChangeReply | undefined;
      try {
        reply = await this.call('/action', { version: this.version, tick: this.tick, action });
      } catch (error) {
        if (error instanceof WireRefusal) return { ok: false, error: error.message };
        throw error;
      }
      if (!reply) return { ok: false, error: 'Waiting for the connection' };
      this.land(reply);
      this.tail.push({ a: action, tick: this.tick });
      if (this.tail.length > TAIL) this.tail.splice(0, this.tail.length - TAIL);
      if (action.t === 'start') this.pos = [this.state.player.at[0], this.state.player.at[1]];
      this.wake(reply.events);
      const busy = reply.events.find((e) => e.e === 'busy');
      if (busy?.e === 'busy') {
        this.deferred.push(...reply.events.filter((e) => e.e !== 'busy'));
        this.emit('busy', { verb: busy.verb, ms: busy.ms });
      } else {
        this.emit('events', reply.events);
        this.emit('change', undefined);
      }
      return { ok: true, events: reply.events };
    } finally {
      this.waiting = false;
    }
  }

  /**
   * The server already made the step, so work cannot be taken back here: a player who walks away from a
   * busy action keeps it. False, as when nothing is under way in the local session.
   */
  cancelWork(): boolean {
    return false;
  }

  /**
   * The device keeps settings only: there is no save file to write. What is owed is the walk, and that goes
   * to the server at once rather than at the next tick.
   */
  save(): void {
    void this.flushMoves().catch(() => undefined);
  }

  /** After a dropped line: ask for the state again and go on from it, with no tick replayed. */
  async resumeFromServer(): Promise<void> {
    const reply = await this.wire.get('/state').catch((error: unknown) => {
      throw error;
    }) as StateReply;
    this.land(reply);
    this.moves = [];
    this.deferred = [];
    this.open = true;
    this.emit('change', undefined);
  }

  /** The line dropped: the game pauses at once and takes no input until a resume answers. */
  private drop(): void {
    this.open = false;
    this.emit('change', undefined);
  }

  private async call(path: '/action' | '/moves', body: unknown): Promise<ChangeReply | undefined> {
    try {
      return await this.wire.post(path, body);
    } catch (error) {
      if (error instanceof WireRefusal) {
        if (error.status === 401) this.drop();
        throw error;
      }
      if (error instanceof WireGap) {
        this.drop();
        return undefined;
      }
      throw error;
    }
  }

  private land(reply: StateReply | ChangeReply): void {
    this.state = 'patch' in reply ? applyStatePatch(this.state, reply.patch) : reply.state;
    this.appearing = new Set(reply.appears);
    this.version = reply.version;
  }

  /** A fall moves the player to the town they were last in: the walk goes on from there. */
  private wake(events: readonly GameEvent[]): void {
    const fall = events.find((e) => e.e === 'fall');
    if (fall?.e !== 'fall') return;
    this.pos = [fall.at[0], fall.at[1]];
    this.deferred = [];
  }
}
