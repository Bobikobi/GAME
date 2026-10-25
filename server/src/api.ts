import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ATTRIBUTES, STEP_MILLI, WEAR_SLOTS, appearSlots, appears, step, walkCharge, walkStepMs, type Action, type Bundle, type GameEvent, type State, type Tile } from '@game/kernel';

import { goldRowsOf, type BookedStep, type LedgerRow } from './ledger';
import { publicState, statePatch, type MergePatch, type PublicState } from './patch';

const BODY_LIMIT = 64 * 1024;
const MOVE_LIMIT = 256;
const TICK_SLACK_MS = 2_000;

export interface PlayerRecord {
  state: State;
  version: number;
  /** Wall-clock time corresponding to state.tick; preserve its offset when state.tick advances. */
  acceptedAt: number;
  /** Game tick at which movement credit was last refilled. */
  movementAt: number;
  /** Unspent movement time, in milliseconds. */
  movementCreditMs: number;
}

export function createPlayerRecord(bundle: Bundle, state: State, acceptedAt: number): PlayerRecord {
  return {
    state: structuredClone(state),
    version: 1,
    acceptedAt,
    movementAt: state.tick,
    movementCreditMs: Math.min(2, bundle.params.move_reach_max) * bundle.params.walk_step_ms,
  };
}

/**
 * What an accepted request adds to the two books (NEXT 18 b): one action_log row, and one gold_ledger row
 * per grant and payment (NEXT 18 f). The store writes them in the transaction of the compare-and-set, so a
 * write that loses the race leaves neither behind.
 *
 * A gold row carries the action that paid it and that action's own tick, not the request's: inside a
 * movement batch the paying step is one report, and a replay books the same row from the same report
 * (`goldRowsOf` is the one rule both sides read).
 *
 * Gold is milli-gold in a JS number here, exact up to 2^53 milli-gold; it is a bigint only in the database.
 */
export interface Books {
  /** the action as the client sent it, or `{ kind: 'moves', moves }` for a movement batch */
  action: unknown;
  tick: number;
  /** one row per grant and payment, each with the action and tick that paid it; a zero is never booked */
  gold: LedgerRow[];
}

export interface PlayerStore {
  load(playerId: string): Promise<PlayerRecord | undefined>;
  compareAndSet(playerId: string, expectedVersion: number, next: PlayerRecord, books: Books): Promise<boolean>;
}

export interface ApiOptions {
  bundle: Bundle;
  store: PlayerStore;
  /** Must be supplied by trusted server-side authentication; identity is never read from request data. */
  resolvePlayerId(request: IncomingMessage): Promise<string | undefined>;
  /** Whether the database answers; GET /health reports it and reads no player row. Absent, the process is the only thing checked. */
  health?(): Promise<boolean>;
  /** Sign-in's routes under `/auth/` (NEXT 18 e); absent in the header mode, where those paths are not found. */
  signIn?: { handle(request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean> };
  now?: () => number;
  bodyLimit?: number;
}

interface ErrorBody {
  error: string;
  /** a 409's machine-readable kind, so the phone reads a code rather than the words */
  reason?: ConflictReason;
}

/**
 * Why a 409 came back: the state a call named is no longer the server's (`stale`), or the step it named was
 * refused for its own reason. The words say it to the player; the code is what the client branches on.
 */
export type ConflictReason = 'stale' | 'clock-ahead' | 'walk-credit' | 'refused' | 'backwards';

interface StateBody {
  state: PublicState;
  version: number;
  /** the appear nodes that stand at this state's tick: drawn from the seed here, never on the phone */
  appears: string[];
}

interface ChangeBody {
  events: GameEvent[];
  patch: MergePatch;
  version: number;
  appears: string[];
}

/** The kinds of client-played step a batch may carry. An encounter joins this list later (NEXT 18 a), with no new endpoint. */
const MOVE_REPORT_KEYS = ['kind', 'at', 'tick'] as const;

interface MoveReport {
  kind: 'move';
  at: Tile;
  tick: number;
}

class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason?: ConflictReason,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTile(value: unknown): value is Tile {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isSafeInteger);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function moveReport(value: unknown): MoveReport {
  if (!isRecord(value)) throw new RequestError('Each movement report must be an object.', 400);
  if (!hasOnlyKeys(value, MOVE_REPORT_KEYS)) {
    throw new RequestError('A movement report holds a kind, a tile and a tick, nothing else.', 400);
  }
  if (value.kind !== 'move') throw new RequestError('Only movement reports are accepted here for now.', 400);
  if (!isTile(value.at) || !validTick(value.tick)) {
    throw new RequestError('Each movement report needs a tile and a valid tick.', 400);
  }
  return { kind: 'move', at: value.at, tick: value.tick };
}

/** Whether a value is an action the wire accepts: the kernel's shape, and no field besides it. */
export function isAction(value: unknown): value is Action {
  if (!isRecord(value) || typeof value.t !== 'string') return false;
  switch (value.t) {
    case 'start':
      // a race (DECISIONS.md, 2026-10-22), or a format 1 starter id: a logged opening from before the races replays as it played
      return hasOnlyKeys(value, ['t', 'race', 'starter', 'name', 'look'])
        && (typeof value.race === 'string') !== (typeof value.starter === 'string')
        && (value.race === undefined || typeof value.race === 'string')
        && (value.starter === undefined || typeof value.starter === 'string')
        && typeof value.name === 'string'
        && (value.look === undefined || Number.isSafeInteger(value.look));
    case 'carve':
      return hasOnlyKeys(value, ['t', 'name']) && typeof value.name === 'string';
    case 'gather':
      return hasOnlyKeys(value, ['t', 'node', 'grade', 'at'])
        && typeof value.node === 'string'
        && Number.isSafeInteger(value.grade)
        && (value.grade as number) >= 0
        && (value.grade as number) <= 4
        && isTile(value.at);
    case 'dig':
      return hasOnlyKeys(value, ['t', 'spot', 'grade', 'at'])
        && typeof value.spot === 'string'
        && Number.isSafeInteger(value.grade)
        && (value.grade as number) >= 0
        && (value.grade as number) <= 4
        && isTile(value.at);
    case 'search':
      return hasOnlyKeys(value, ['t', 'spot', 'at']) && typeof value.spot === 'string' && isTile(value.at);
    case 'take':
      return hasOnlyKeys(value, ['t', 'spot', 'row', 'at'])
        && typeof value.spot === 'string'
        && (value.row === undefined || (Number.isSafeInteger(value.row) && (value.row as number) >= 0))
        && isTile(value.at);
    case 'craft':
      return hasOnlyKeys(value, ['t', 'recipe', 'at']) && typeof value.recipe === 'string' && isTile(value.at);
    case 'eat':
      return hasOnlyKeys(value, ['t', 'item']) && typeof value.item === 'string';
    case 'feed':
      return hasOnlyKeys(value, ['t', 'fire', 'item', 'at'])
        && typeof value.fire === 'string'
        && typeof value.item === 'string'
        && isTile(value.at);
    case 'kindle':
      return hasOnlyKeys(value, ['t', 'fire', 'at']) && isTile(value.fire) && isTile(value.at);
    case 'buy':
    case 'sell':
      return hasOnlyKeys(value, ['t', 'npc', 'item', 'qty', 'at'])
        && typeof value.npc === 'string'
        && typeof value.item === 'string'
        && Number.isSafeInteger(value.qty)
        && isTile(value.at);
    case 'restore':
      return hasOnlyKeys(value, ['t', 'restore', 'at']) && typeof value.restore === 'string' && isTile(value.at);
    case 'build':
      return hasOnlyKeys(value, ['t', 'camp', 'at']) && typeof value.camp === 'string' && isTile(value.at);
    case 'accept':
    case 'turnin':
      return hasOnlyKeys(value, ['t', 'quest', 'at']) && typeof value.quest === 'string' && isTile(value.at);
    case 'visit':
      return hasOnlyKeys(value, ['t', 'slot', 'at']) && typeof value.slot === 'string' && isTile(value.at);
    case 'learn':
      return hasOnlyKeys(value, ['t', 'item']) && typeof value.item === 'string';
    case 'spend':
      return hasOnlyKeys(value, ['t', 'attr']) && ATTRIBUTES.some((attribute) => attribute === value.attr);
    case 'learn_node':
      return hasOnlyKeys(value, ['t', 'node', 'at']) && typeof value.node === 'string' && isTile(value.at);
    case 'equip':
      return hasOnlyKeys(value, ['t', 'node', 'slot', 'at']) && typeof value.node === 'string' && Number.isSafeInteger(value.slot) && isTile(value.at);
    case 'unequip':
      return hasOnlyKeys(value, ['t', 'slot', 'at']) && Number.isSafeInteger(value.slot) && isTile(value.at);
    case 'wear':
      return hasOnlyKeys(value, ['t', 'item', 'slot'])
        && typeof value.item === 'string'
        && (value.slot === undefined || WEAR_SLOTS.some((slot) => slot === value.slot));
    case 'unwear':
      return hasOnlyKeys(value, ['t', 'slot', 'look'])
        && WEAR_SLOTS.some((slot) => slot === value.slot)
        && (value.look === undefined || typeof value.look === 'boolean');
    case 'drop':
      return hasOnlyKeys(value, ['t', 'item', 'qty', 'at']) && typeof value.item === 'string' && Number.isSafeInteger(value.qty) && isTile(value.at);
    case 'pickup':
      return hasOnlyKeys(value, ['t', 'item', 'at']) && typeof value.item === 'string' && isTile(value.at);
    case 'move':
      return hasOnlyKeys(value, ['t', 'at']) && isTile(value.at);
    default:
      return false;
  }
}

function validVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function validTick(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function appearIds(bundle: Bundle, state: State): string[] {
  return [...appearSlots(bundle).keys()]
    .filter((id) => appears(bundle, state, id, state.tick))
    .sort();
}

interface HealthBody {
  ok: boolean;
}

function json(response: ServerResponse, status: number, body: ErrorBody | StateBody | ChangeBody | HealthBody): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage, maxBytes: number): Promise<unknown> {
  const contentType = request.headers['content-type']?.toLowerCase() ?? '';
  if (!/^application\/json(?:\s*;|$)/.test(contentType)) {
    throw new RequestError('Send JSON with content-type application/json.', 415);
  }
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const value of request) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    length += chunk.length;
    if (length > maxBytes) throw new RequestError('The request is too large.', 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new RequestError('The request is not valid JSON.', 400);
  }
}

function requireObject(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new RequestError('The request body must be an object.', 400);
  return value;
}

function requirePlayer(record: PlayerRecord | undefined): PlayerRecord {
  if (!record) throw new RequestError('No game state exists for this account.', 404);
  return record;
}

function checkClock(tick: number, record: PlayerRecord, now: number): void {
  const allowed = now - record.acceptedAt + TICK_SLACK_MS;
  if (tick - record.state.tick > allowed) throw new RequestError('That game time is ahead of the time elapsed.', 409, 'clock-ahead');
}

/**
 * The movement-time credit after a walk to `target` at `tick` (NEXT 18 a): a four-way path spends it, the
 * game time since it was last refilled refills it, and `move_reach_max` caps it. Undefined when the walk
 * costs more than the credit holds. A target the kernel cannot reach is left to the kernel to refuse.
 */
export function spendWalk(
  bundle: Bundle,
  state: State,
  from: Tile,
  target: Tile,
  tick: number,
  movementAt: number,
  movementCreditMs: number,
  leg: Tile | null = null,
): { at: number; creditMs: number; leg: Tile | null } | undefined {
  // the pace the load allows (the 23.10 decision): a heavy player cannot report a light walk
  const stepMs = walkStepMs(bundle, state);
  const maxReach = bundle.params.move_reach_max;
  const elapsedSinceMove = Math.max(0, tick - state.player.movedAt);
  const reach = Math.min(2 + Math.floor(elapsedSinceMove / stepMs), maxReach);
  // the octile length of the walk (G56): a free walk on a diagonal pays for its distance, not its staircase
  const charge = walkCharge(bundle, state, from, target, reach, leg);
  if (charge === undefined) return { at: tick, creditMs: movementCreditMs, leg: null };

  const maxCreditMs = maxReach * stepMs;
  const elapsedSinceCredit = Math.max(0, tick - movementAt);
  const available = Math.min(maxCreditMs, movementCreditMs + elapsedSinceCredit);
  const cost = Math.floor((charge.milli * stepMs) / STEP_MILLI);
  if (cost > available) return undefined;
  return { at: tick, creditMs: available - cost, leg: charge.leg };
}

function nextMovementCredit(...walk: Parameters<typeof spendWalk>): { at: number; creditMs: number; leg: Tile | null } {
  const next = spendWalk(...walk);
  if (!next) throw new RequestError('That is further than a walk goes in that time.', 409, 'walk-credit');
  return next;
}

function actionTile(action: Action, current: Tile): Tile {
  return 'at' in action ? action.at : current;
}

function refused(error: string): never {
  throw new RequestError(error, 409, 'refused');
}

async function playerIdFor(request: IncomingMessage, resolve: ApiOptions['resolvePlayerId']): Promise<string> {
  const playerId = await resolve(request);
  if (!playerId) throw new RequestError('Sign in to continue.', 401);
  return playerId;
}

async function route(request: IncomingMessage, response: ServerResponse, options: ApiOptions): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost');
  // sign-in reads its own query strings (an OAuth callback, an email link) and answers before the game's rules
  if (options.signIn && (await options.signIn.handle(request, response, url))) return;
  if (url.search || url.hash) throw new RequestError('This endpoint does not accept a query string.', 400);
  if (url.pathname === '/health') {
    // no identity and no player row: the one answer is whether the process and its pool are up, and it says nothing more
    if (request.method !== 'GET') {
      response.setHeader('allow', 'GET');
      throw new RequestError('Method not allowed.', 405);
    }
    const up = await (options.health?.() ?? Promise.resolve(true)).catch(() => false);
    json(response, up ? 200 : 503, { ok: up });
    return;
  }
  if (!['/action', '/moves', '/state', '/session'].includes(url.pathname)) {
    throw new RequestError('Not found.', 404);
  }
  const expectedMethod = url.pathname === '/state' ? 'GET' : 'POST';
  if (request.method !== expectedMethod) {
    response.setHeader('allow', expectedMethod);
    throw new RequestError('Method not allowed.', 405);
  }

  const playerId = await playerIdFor(request, options.resolvePlayerId);
  const record = requirePlayer(await options.store.load(playerId));

  if (url.pathname === '/state' || url.pathname === '/session') {
    if (url.pathname === '/session') {
      const body = requireObject(await readJson(request, options.bodyLimit ?? BODY_LIMIT));
      if (Object.keys(body).length > 0) throw new RequestError('Resume does not accept client state.', 400);
    }
    json(response, 200, { state: publicState(record.state), version: record.version, appears: appearIds(options.bundle, record.state) });
    return;
  }

  const body = requireObject(await readJson(request, options.bodyLimit ?? BODY_LIMIT));
  if (!hasOnlyKeys(body, url.pathname === '/action' ? ['version', 'action', 'tick'] : ['version', 'moves'])) {
    throw new RequestError('The request contains an unexpected field.', 400);
  }
  if (!validVersion(body.version)) throw new RequestError('A valid state version is required.', 400);
  if (body.version !== record.version) throw new RequestError('The game state changed; resume before sending another action.', 409, 'stale');

  const now = (options.now ?? Date.now)();
  let state = record.state;
  let events: GameEvent[] = [];
  let movementAt = record.movementAt;
  let movementCreditMs = record.movementCreditMs;
  let booked: unknown;
  /** the steps the request played: one action, or one step per report inside a movement batch */
  const played: BookedStep[] = [];

  if (url.pathname === '/action') {
    if (!isAction(body.action) || body.action.t === 'move') throw new RequestError('Send one non-movement action.', 400);
    if (!validTick(body.tick)) throw new RequestError('A valid client tick is required.', 400);
    checkClock(body.tick, record, now);
    let nextCredit = { at: movementAt, creditMs: movementCreditMs };
    if (body.action.t !== 'start') {
      nextCredit = nextMovementCredit(
        options.bundle,
        state,
        state.player.at,
        actionTile(body.action, state.player.at),
        body.tick,
        movementAt,
        movementCreditMs,
      );
    }
    const result = step(options.bundle, state, body.action, body.tick, { validateTravel: true });
    if (!result.ok) refused(result.error);
    state = result.state;
    events = result.events;
    movementAt = nextCredit.at;
    movementCreditMs = nextCredit.creditMs;
    played.push({ action: body.action, tick: state.tick, events: result.events });
    booked = body.action;
  } else {
    if (!Array.isArray(body.moves) || body.moves.length === 0 || body.moves.length > MOVE_LIMIT) {
      throw new RequestError(`Send between 1 and ${MOVE_LIMIT} movement reports.`, 400);
    }
    const reports = body.moves.map(moveReport);
    let previousTick = state.tick;
    for (const report of reports) {
      if (report.tick < previousTick) throw new RequestError('Movement report times cannot run backwards.', 409, 'backwards');
      previousTick = report.tick;
    }
    checkClock(previousTick, record, now);
    // the unpaired step a diagonal pair may close; a batch starts with none
    let leg: Tile | null = null;
    for (const report of reports) {
      const nextCredit = nextMovementCredit(
        options.bundle,
        state,
        state.player.at,
        report.at,
        report.tick,
        movementAt,
        movementCreditMs,
        leg,
      );
      const result = step(options.bundle, state, { t: 'move', at: report.at }, report.tick, { validateTravel: true });
      if (!result.ok) refused(result.error);
      state = result.state;
      events.push(...result.events);
      movementAt = nextCredit.at;
      movementCreditMs = nextCredit.creditMs;
      leg = nextCredit.leg;
      // the report is the action that paid, at the report's own tick, and the replay reads the same two
      played.push({ action: { t: 'move', at: report.at }, tick: report.tick, events: result.events });
    }
    booked = { kind: 'moves', moves: reports };
  }

  const next: PlayerRecord = {
    state,
    version: record.version + 1,
    acceptedAt: record.acceptedAt + state.tick - record.state.tick,
    movementAt,
    movementCreditMs,
  };
  const books: Books = {
    action: booked,
    tick: state.tick,
    gold: goldRowsOf(options.bundle, played),
  };
  if (!(await options.store.compareAndSet(playerId, record.version, next, books))) {
    throw new RequestError('The game state changed; resume before sending another action.', 409, 'stale');
  }
  json(response, 200, { events, patch: statePatch(record.state, state), version: next.version, appears: appearIds(options.bundle, state) });
}

export function createGameApi(options: ApiOptions): Server {
  return createServer((request, response) => {
    void route(request, response, options).catch((error: unknown) => {
      if (response.headersSent) {
        response.destroy(error instanceof Error ? error : undefined);
        return;
      }
      if (error instanceof RequestError) {
        const body: ErrorBody = error.reason === undefined ? { error: error.message } : { error: error.message, reason: error.reason };
        json(response, error.status, body);
        return;
      }
      json(response, 500, { error: 'The game server could not complete the request.' });
      console.error('Game API request failed:', error);
    });
  });
}

export async function listen(server: Server, port: number, host = '127.0.0.1'): Promise<AddressInfo> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('The game API did not bind to a TCP port.');
  return address;
}
