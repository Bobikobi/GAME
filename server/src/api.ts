import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ATTRIBUTES, WEAR_SLOTS, step, walkDistance, type Action, type Bundle, type GameEvent, type State, type Tile } from '@game/kernel';

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

export interface PlayerStore {
  load(playerId: string): Promise<PlayerRecord | undefined>;
  compareAndSet(playerId: string, expectedVersion: number, next: PlayerRecord): Promise<boolean>;
}

export interface ApiOptions {
  bundle: Bundle;
  store: PlayerStore;
  /** Must be supplied by trusted server-side authentication; identity is never read from request data. */
  resolvePlayerId(request: IncomingMessage): Promise<string | undefined>;
  now?: () => number;
  bodyLimit?: number;
}

interface ErrorBody {
  error: string;
}

interface StateBody {
  state: PublicState;
  version: number;
}

interface ChangeBody {
  events: GameEvent[];
  patch: MergePatch;
  version: number;
}

interface MoveReport {
  at: Tile;
  tick: number;
}

class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
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

function isAction(value: unknown): value is Action {
  if (!isRecord(value) || typeof value.t !== 'string') return false;
  switch (value.t) {
    case 'start':
      return hasOnlyKeys(value, ['t', 'starter', 'name', 'look'])
        && typeof value.starter === 'string'
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
    case 'wear':
      return hasOnlyKeys(value, ['t', 'item', 'slot'])
        && typeof value.item === 'string'
        && (value.slot === undefined || WEAR_SLOTS.some((slot) => slot === value.slot));
    case 'unwear':
      return hasOnlyKeys(value, ['t', 'slot', 'look'])
        && WEAR_SLOTS.some((slot) => slot === value.slot)
        && (value.look === undefined || typeof value.look === 'boolean');
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

function json(response: ServerResponse, status: number, body: ErrorBody | StateBody | ChangeBody): void {
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
  if (tick - record.state.tick > allowed) throw new RequestError('That game time is ahead of the time elapsed.', 409);
}

function nextMovementCredit(
  bundle: Bundle,
  state: State,
  from: Tile,
  target: Tile,
  tick: number,
  movementAt: number,
  movementCreditMs: number,
): { at: number; creditMs: number } {
  const { walk_step_ms: stepMs, move_reach_max: maxReach } = bundle.params;
  const elapsedSinceMove = Math.max(0, tick - state.player.movedAt);
  const reach = Math.min(2 + Math.floor(elapsedSinceMove / stepMs), maxReach);
  const distance = walkDistance(bundle, state, from, target, reach);
  if (distance === undefined) return { at: tick, creditMs: movementCreditMs };

  const maxCreditMs = maxReach * stepMs;
  const elapsedSinceCredit = Math.max(0, tick - movementAt);
  const available = Math.min(maxCreditMs, movementCreditMs + elapsedSinceCredit);
  const cost = distance * stepMs;
  if (cost > available) {
    throw new RequestError('That is further than a walk goes in that time.', 409);
  }
  return { at: tick, creditMs: available - cost };
}

function actionTile(action: Action, current: Tile): Tile {
  return 'at' in action ? action.at : current;
}

function refused(error: string): never {
  throw new RequestError(error, 409);
}

async function playerIdFor(request: IncomingMessage, resolve: ApiOptions['resolvePlayerId']): Promise<string> {
  const playerId = await resolve(request);
  if (!playerId) throw new RequestError('Sign in to continue.', 401);
  return playerId;
}

async function route(request: IncomingMessage, response: ServerResponse, options: ApiOptions): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.search || url.hash) throw new RequestError('This endpoint does not accept a query string.', 400);
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
    json(response, 200, { state: publicState(record.state), version: record.version });
    return;
  }

  const body = requireObject(await readJson(request, options.bodyLimit ?? BODY_LIMIT));
  if (!hasOnlyKeys(body, url.pathname === '/action' ? ['version', 'action', 'tick'] : ['version', 'moves'])) {
    throw new RequestError('The request contains an unexpected field.', 400);
  }
  if (!validVersion(body.version)) throw new RequestError('A valid state version is required.', 400);
  if (body.version !== record.version) throw new RequestError('The game state changed; resume before sending another action.', 409);

  const now = (options.now ?? Date.now)();
  let state = record.state;
  let events: GameEvent[] = [];
  let movementAt = record.movementAt;
  let movementCreditMs = record.movementCreditMs;

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
  } else {
    if (!Array.isArray(body.moves) || body.moves.length === 0 || body.moves.length > MOVE_LIMIT) {
      throw new RequestError(`Send between 1 and ${MOVE_LIMIT} movement reports.`, 400);
    }
    let previousTick = state.tick;
    for (const report of body.moves) {
      if (!isRecord(report) || !isTile(report.at) || !validTick(report.tick)) {
        throw new RequestError('Each movement report needs a tile and a valid tick.', 400);
      }
      if (report.tick < previousTick) throw new RequestError('Movement report times cannot run backwards.', 409);
      previousTick = report.tick;
    }
    checkClock(previousTick, record, now);
    for (const report of body.moves as MoveReport[]) {
      const nextCredit = nextMovementCredit(
        options.bundle,
        state,
        state.player.at,
        report.at,
        report.tick,
        movementAt,
        movementCreditMs,
      );
      const result = step(options.bundle, state, { t: 'move', at: report.at }, report.tick, { validateTravel: true });
      if (!result.ok) refused(result.error);
      state = result.state;
      events.push(...result.events);
      movementAt = nextCredit.at;
      movementCreditMs = nextCredit.creditMs;
    }
  }

  const next: PlayerRecord = {
    state,
    version: record.version + 1,
    acceptedAt: record.acceptedAt + state.tick - record.state.tick,
    movementAt,
    movementCreditMs,
  };
  if (!(await options.store.compareAndSet(playerId, record.version, next))) {
    throw new RequestError('The game state changed; resume before sending another action.', 409);
  }
  json(response, 200, { events, patch: statePatch(record.state, state), version: next.version });
}

export function createGameApi(options: ApiOptions): Server {
  return createServer((request, response) => {
    void route(request, response, options).catch((error: unknown) => {
      if (response.headersSent) {
        response.destroy(error instanceof Error ? error : undefined);
        return;
      }
      if (error instanceof RequestError) {
        json(response, error.status, { error: error.message });
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
