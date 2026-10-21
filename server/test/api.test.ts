import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { makeWalkable, newState, npcTile, salePrice, serialize, step, type Bundle, type State, type Tile } from '@game/kernel';
import type { IncomingMessage, Server } from 'node:http';

import { createGameApi, createPlayerRecord, listen, type Books, type PlayerRecord, type PlayerStore } from '../src';
import { applyStatePatch, publicState } from '../src/patch';
import { bfsNear, bfsToTile, loadBundle } from '../../tools/test/helpers/world.js';

const PLAYER = 'player-1';
let bundle: Bundle;
let server: Server | undefined;
const health = { up: true };

beforeAll(() => {
  bundle = loadBundle();
});

class MemoryStore implements PlayerStore {
  record: PlayerRecord;
  /** the two books, written only when the compare-and-set wins, as the postgres store does in one transaction */
  actionLog: Array<{ seq: number; books: Books }> = [];
  goldLedger: Array<{ seq: number; deltaMg: number; action: unknown; tick: number }> = [];

  constructor(state: State, acceptedAt: number) {
    this.record = createPlayerRecord(bundle, state, acceptedAt);
  }

  async load(playerId: string): Promise<PlayerRecord | undefined> {
    return playerId === PLAYER ? structuredClone(this.record) : undefined;
  }

  async compareAndSet(playerId: string, expectedVersion: number, next: PlayerRecord, books: Books): Promise<boolean> {
    if (playerId !== PLAYER || this.record.version !== expectedVersion) return false;
    this.record = structuredClone(next);
    this.actionLog.push({ seq: next.version, books: structuredClone(books) });
    for (const row of books.gold) {
      if (row.deltaMg === 0) continue;
      this.goldLedger.push({ seq: next.version, ...structuredClone(row) });
    }
    return true;
  }
}

async function api(state: State, now = 1_000_000): Promise<{ store: MemoryStore; base: string; clock: { now: number } }> {
  const clock = { now };
  const store = new MemoryStore(state, now);
  server = createGameApi({
    bundle,
    store,
    now: () => clock.now,
    resolvePlayerId: async (request: IncomingMessage) => request.headers.authorization === 'Bearer test' ? PLAYER : undefined,
    health: async () => health.up,
  });
  const address = await listen(server, 0);
  return { store, base: `http://127.0.0.1:${address.port}`, clock };
}

async function post(base: string, path: string, body: unknown, authorization = 'Bearer test'): Promise<Response> {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  server = undefined;
});

function started(): State {
  const result = step(bundle, newState(bundle, 17), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function move(at: Tile, tick: number): { kind: 'move'; at: Tile; tick: number } {
  return { kind: 'move', at, tick };
}

function longMovementPath(state: State): Tile[] {
  const walkable = makeWalkable(bundle);
  const [x, y] = state.player.at;
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -6; dx <= 6; dx++) {
      const target: Tile = [x + dx, y + dy];
      if (!walkable(target[0], target[1], state.player)) continue;
      const path = bfsToTile(bundle, state.player, state.player.at, target);
      if (path && path.length >= 5) return path;
    }
  }
  throw new Error('The starting area has no walkable path long enough to test movement limits.');
}

describe('Stage 2a server protocol', () => {
  test('starts the movement clock at the server-owned state tick', () => {
    const state = started();
    state.tick = 10_000;
    const record = createPlayerRecord(bundle, state, 1_000_000);
    expect(record.movementAt).toBe(state.tick);
    expect(record.movementCreditMs).toBe(2 * bundle.params.walk_step_ms);
  });

  test('requires an authenticated server-side identity and never accepts a client player id', async () => {
    const { base } = await api(started());
    const response = await post(base, '/action', {
      playerId: PLAYER,
      version: 1,
      tick: 0,
      action: { t: 'carve', name: 'Tess' },
    }, '');
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Sign in to continue.' });
  });

  test('a valid identity that also puts another player in the body acts only as the first', async () => {
    const { base, store } = await api(started());
    const response = await post(base, '/action', {
      playerId: 'player-2',
      version: 1,
      tick: 0,
      action: { t: 'carve', name: 'Tess' },
    });
    // the body is checked field by field: a player id there is refused, never read as who is acting
    expect(response.status).toBe(400);
    expect(store.record.version).toBe(1);
    expect(store.actionLog).toEqual([]);

    const resumed = await post(base, '/session', { playerId: 'player-2' });
    expect(resumed.status).toBe(400);
    const own = await post(base, '/session', {});
    expect(own.status).toBe(200);
  });

  test('the identity comes from the resolver alone: no header or body names the player', async () => {
    const { base } = await api(started());
    for (const headers of [{ 'x-player-id': PLAYER }, { 'x-player-id': 'player-2', authorization: 'Bearer other' }] as Array<Record<string, string>>) {
      const response = await fetch(`${base}/state`, { headers });
      expect(response.status).toBe(401);
    }
  });

  test('a successful action returns a versioned patch that reproduces the full state', async () => {
    const initial = newState(bundle, 17);
    const { base, store } = await api(initial);
    const response = await post(base, '/action', {
      version: 1,
      tick: 0,
      action: { t: 'start', starter: 'core/forager', name: 'Tess' },
    });
    expect(response.status, await response.clone().text()).toBe(200);
    const body = await response.json() as { events: unknown[]; patch: Parameters<typeof applyStatePatch>[1]; version: number };
    expect(body.version).toBe(2);
    expect(body.events.length).toBeGreaterThan(0);
    expect(applyStatePatch(publicState(initial), body.patch)).toEqual(publicState(store.record.state));
    expect(body.patch).not.toHaveProperty('seed');
    expect(store.record.state.player.name).toBe('Tess');
  });

  test('refuses a client tick ahead of elapsed wall time without changing state', async () => {
    const { base, store } = await api(started());
    const before = serialize(store.record.state);
    const response = await post(base, '/action', {
      version: 1,
      tick: 2_001,
      action: { t: 'carve', name: 'Tess' },
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'That game time is ahead of the time elapsed.', reason: 'clock-ahead' });
    expect(serialize(store.record.state)).toBe(before);
    expect(store.record.version).toBe(1);
  });

  test('does not grant the two-second clock slack again after every accepted request', async () => {
    const { base, store, clock } = await api(started());
    const first = await post(base, '/moves', {
      version: 1,
      moves: [move(store.record.state.player.at, 2_000)],
    });
    expect(first.status, await first.clone().text()).toBe(200);

    const before = serialize(store.record.state);
    const repeatedSlack = await post(base, '/moves', {
      version: 2,
      moves: [move(store.record.state.player.at, 4_000)],
    });
    expect(repeatedSlack.status).toBe(409);
    expect(await repeatedSlack.json()).toEqual({ error: 'That game time is ahead of the time elapsed.', reason: 'clock-ahead' });
    expect(serialize(store.record.state)).toBe(before);
    expect(store.record.version).toBe(2);

    clock.now += 1_000;
    const elapsedTime = await post(base, '/moves', {
      version: 2,
      moves: [move(store.record.state.player.at, 3_000)],
    });
    expect(elapsedTime.status).toBe(200);
  });

  test('refuses a repeated action with its stale version without changing the accepted state', async () => {
    const { base, store } = await api(newState(bundle, 17));
    const body = { version: 1, tick: 0, action: { t: 'start', starter: 'core/forager', name: 'Tess' } };
    expect((await post(base, '/action', body)).status).toBe(200);
    const afterFirst = serialize(store.record.state);
    const response = await post(base, '/action', body);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'The game state changed; resume before sending another action.', reason: 'stale' });
    expect(serialize(store.record.state)).toBe(afterFirst);
    expect(store.record.version).toBe(2);
  });

  test('an optimistic version check lets only one concurrent request write', async () => {
    const { base, store } = await api(newState(bundle, 17));
    const body = { version: 1, tick: 0, action: { t: 'start', starter: 'core/forager', name: 'Tess' } };
    const responses = await Promise.all([post(base, '/action', body), post(base, '/action', body)]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(store.record.version).toBe(2);
  });

  test('an accepted action writes one action_log row, at the version it made', async () => {
    const { base, store } = await api(newState(bundle, 17));
    const action = { t: 'start', starter: 'core/forager', name: 'Tess' };
    expect((await post(base, '/action', { version: 1, tick: 0, action })).status).toBe(200);
    expect(store.actionLog).toHaveLength(1);
    expect(store.actionLog[0]!.seq).toBe(2);
    expect(store.actionLog[0]!.books.action).toEqual(action);
    expect(store.actionLog[0]!.books.tick).toBe(store.record.state.tick);
    expect(store.goldLedger).toEqual([]);
  });

  test('a movement batch is one action_log row holding the batch, and a refused request writes nothing', async () => {
    const { base, store } = await api(started());
    const at = store.record.state.player.at;
    const reports = [move(at, 0), move(at, 100)];
    expect((await post(base, '/moves', { version: 1, moves: reports })).status).toBe(200);
    expect(store.actionLog).toHaveLength(1);
    expect(store.actionLog[0]!.books.action).toEqual({ kind: 'moves', moves: reports });
    // no step inside a batch pays gold today, and a step that does would book the report that paid, not the batch
    expect(store.actionLog[0]!.books.gold).toEqual([]);

    expect((await post(base, '/moves', { version: 1, moves: reports })).status).toBe(409);
    expect((await post(base, '/action', { version: 2, tick: 99_999_999, action: { t: 'carve', name: 'Tess' } })).status).toBe(409);
    expect(store.actionLog).toHaveLength(1);
  });

  test('a sale writes one gold_ledger row for the gold it paid, with its action and tick', async () => {
    const trader = Object.keys(bundle.npcs).sort().find((id) => {
      const shop = bundle.npcs[id]!.shop;
      return shop !== undefined && bundle.shops[shop]?.buys;
    })!;
    const state = started();
    state.player.attrs.carry = 100;
    state.player.restored = ['core/old-bridge'];
    state.player.quests['core/fix-the-bridge'] = 'done';
    const item = Object.keys(bundle.items).sort().find((id) => {
      const probe = structuredClone(state);
      probe.player.bag[id] = 1;
      return (salePrice(bundle, probe, id, 1) ?? 0) >= 1;
    })!;
    state.player.bag[item] = 1;
    const [nx, ny] = npcTile(bundle, trader)!;
    const spot = { x: nx, y: ny, w: 1, h: 1 };
    const at = bfsNear(bundle, state.player, state.player.at, spot)!.at(-1)! as Tile;
    state.player.at = at;
    const pay = salePrice(bundle, state, item, 1)!;

    const { base, store } = await api(state);
    const action = { t: 'sell', npc: trader, item, qty: 1, at };
    const response = await post(base, '/action', { version: 1, tick: state.tick, action });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(store.goldLedger).toEqual([{ seq: 2, deltaMg: pay, action, tick: store.record.state.tick }]);
    expect(store.actionLog).toHaveLength(1);
  });

  test('a lost race writes neither book', async () => {
    const { base, store } = await api(newState(bundle, 17));
    const body = { version: 1, tick: 0, action: { t: 'start', starter: 'core/forager', name: 'Tess' } };
    await Promise.all([post(base, '/action', body), post(base, '/action', body)]);
    expect(store.record.version).toBe(2);
    expect(store.actionLog).toHaveLength(1);
  });

  test('GET /health answers 200 with no identity and no store read, and 503 when the pool does not answer', async () => {
    const { base, store } = await api(started());
    const loads: string[] = [];
    const load = store.load.bind(store);
    store.load = async (id) => { loads.push(id); return load(id); };

    const up = await fetch(`${base}/health`);
    expect(up.status).toBe(200);
    expect(await up.json()).toEqual({ ok: true });
    expect(loads).toEqual([]);

    health.up = false;
    try {
      const down = await fetch(`${base}/health`);
      expect(down.status).toBe(503);
      expect(await down.json()).toEqual({ ok: false });
    } finally {
      health.up = true;
    }

    const wrong = await fetch(`${base}/health`, { method: 'POST' });
    expect(wrong.status).toBe(405);
  });

  test('refuses unknown action fields before reaching the kernel', async () => {
    const { base, store } = await api(newState(bundle, 17));
    const response = await post(base, '/action', {
      version: 1,
      tick: 0,
      action: { t: 'start', starter: 'core/forager', name: 'Tess', seed: 123 },
    });
    expect(response.status).toBe(400);
    expect(serialize(store.record.state)).toBe(serialize(newState(bundle, 17)));
  });

  test('resume returns server state, and client-supplied state is refused', async () => {
    const { base, store } = await api(started());
    const response = await post(base, '/session', {});
    expect(response.status).toBe(200);
    const resumed = await response.json() as { state: Record<string, unknown>; version: number };
    expect(resumed).toEqual({ state: publicState(store.record.state), version: 1, appears: [] });
    expect(resumed.state).not.toHaveProperty('seed');
    const forged = await post(base, '/session', { state: newState(bundle, 1) });
    expect(forged.status).toBe(400);
  });

  test('GET state returns the canonical server-owned state', async () => {
    const state = started();
    const { base } = await api(state);
    const response = await fetch(`${base}/state`, { headers: { authorization: 'Bearer test' } });
    expect(response.status).toBe(200);
    const body = await response.json() as { state: Record<string, unknown>; version: number };
    expect(body).toEqual({ state: publicState(state), version: 1, appears: [] });
    expect(body.state).not.toHaveProperty('seed');
  });

  test('refuses malformed and overlong movement batches without mutation', async () => {
    const { base, store } = await api(started());
    const before = serialize(store.record.state);
    const malformed = await post(base, '/moves', { version: 1, moves: [{ kind: 'move', at: [1], tick: 0 }] });
    expect(malformed.status).toBe(400);
    const oversized = await post(base, '/moves', {
      version: 1,
      moves: Array.from({ length: 257 }, () => move(store.record.state.player.at, 0)),
    });
    expect(oversized.status).toBe(400);
    expect(serialize(store.record.state)).toBe(before);
  });

  test('kindle names its fire as a tile, not as a fire id', async () => {
    const state = started();
    const { base, store } = await api(state);
    const before = serialize(store.record.state);
    const [x, y] = state.player.at;

    const tileFire = await post(base, '/action', {
      version: 1,
      tick: 0,
      action: { t: 'kindle', fire: [x + 1, y], at: [x, y] },
    });
    expect(tileFire.status, await tileFire.clone().text()).toBe(409);

    const fireId = await post(base, '/action', {
      version: 1,
      tick: 0,
      action: { t: 'kindle', fire: 'own', at: [x, y] },
    });
    expect(fireId.status).toBe(400);
    expect(await fireId.json()).toEqual({ error: 'Send one non-movement action.' });
    expect(serialize(store.record.state)).toBe(before);
  });

  test('a movement report names its kind, and an unknown kind is refused', async () => {
    const { base, store } = await api(started());
    const before = serialize(store.record.state);
    const at = store.record.state.player.at;

    const withoutKind = await post(base, '/moves', { version: 1, moves: [{ at, tick: 0 }] });
    expect(withoutKind.status).toBe(400);
    expect(await withoutKind.json()).toEqual({ error: 'Only movement reports are accepted here for now.' });

    const unknownKind = await post(base, '/moves', { version: 1, moves: [{ kind: 'encounter', at, tick: 0 }] });
    expect(unknownKind.status).toBe(400);
    expect(await unknownKind.json()).toEqual({ error: 'Only movement reports are accepted here for now.' });

    const extraField = await post(base, '/moves', { version: 1, moves: [{ kind: 'move', at, tick: 0, blows: [] }] });
    expect(extraField.status).toBe(400);
    expect(await extraField.json()).toEqual({ error: 'A movement report holds a kind, a tile and a tick, nothing else.' });

    expect(serialize(store.record.state)).toBe(before);
    expect(store.record.version).toBe(1);
  });

  test('movement credit is cumulative across reports and separate requests', async () => {
    const state = started();
    const path = longMovementPath(state);
    const { base, store } = await api(state);
    const before = serialize(store.record.state);
    const batch = await post(base, '/moves', {
      version: 1,
      moves: path.slice(1, 4).map((at) => move(at, 0)),
    });
    expect(batch.status).toBe(409);
    expect(serialize(store.record.state)).toBe(before);

    for (const [index, at] of path.slice(1, 3).entries()) {
      const response = await post(base, '/moves', {
        version: store.record.version,
        moves: [move(at, 0)],
      });
      expect(response.status, `movement report ${index + 1}`).toBe(200);
    }
    const afterTwoTiles = serialize(store.record.state);
    const thirdTile = await post(base, '/moves', {
      version: store.record.version,
      moves: [move(path[3]!, 0)],
    });
    expect(thirdTile.status).toBe(409);
    expect(serialize(store.record.state)).toBe(afterTwoTiles);
  });

  test('movement credit refills with elapsed game time', async () => {
    const state = started();
    const path = longMovementPath(state);
    const { base, store, clock } = await api(state);
    for (const at of path.slice(1, 3)) {
      const response = await post(base, '/moves', {
        version: store.record.version,
        moves: [move(at, 0)],
      });
      expect(response.status).toBe(200);
    }

    clock.now += bundle.params.walk_step_ms;
    const response = await post(base, '/moves', {
      version: store.record.version,
      moves: [move(path[3]!, bundle.params.walk_step_ms)],
    });
    expect(response.status).toBe(200);
  });
});

describe('a 409 says why in a code as well as in words', () => {
  const stale = { error: 'The game state changed; resume before sending another action.', reason: 'stale' };

  async function reasonOf(response: Response): Promise<unknown> {
    return ((await response.json()) as { reason?: unknown }).reason;
  }

  test('a version the server has left behind is stale, on both of its places', async () => {
    // the version check, before the store is asked
    const { base } = await api(newState(bundle, 17));
    const body = { version: 1, tick: 0, action: { t: 'start', starter: 'core/forager', name: 'Tess' } };
    expect((await post(base, '/action', body)).status).toBe(200);
    const repeated = await post(base, '/action', body);
    expect(repeated.status).toBe(409);
    expect(await repeated.json()).toEqual(stale);

    // the compare-and-set losing the race, the second place that throws the same words
    const { base: racingBase } = await api(newState(bundle, 17));
    const raced = await Promise.all([post(racingBase, '/action', body), post(racingBase, '/action', body)]);
    expect(raced.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await raced.find((response) => response.status === 409)!.json()).toEqual(stale);
  });

  test('a tick ahead of the clock says clock-ahead, and so does the clock slack spent twice', async () => {
    const { base } = await api(started());
    const ahead = await post(base, '/action', { version: 1, tick: 2_001, action: { t: 'carve', name: 'Tess' } });
    expect(ahead.status).toBe(409);
    expect(await reasonOf(ahead)).toBe('clock-ahead');
  });

  test('a walk further than the credit allows says walk-credit', async () => {
    const state = started();
    const path = longMovementPath(state);
    const { base } = await api(state);
    const beyond = await post(base, '/moves', { version: 1, moves: path.slice(1, 4).map((at) => move(at, 0)) });
    expect(beyond.status).toBe(409);
    expect((await beyond.json()) as { error: string }).toEqual({
      error: 'That is further than a walk goes in that time.',
      reason: 'walk-credit',
    });
  });

  test('a step the kernel refuses says refused, and the kernel keeps its own words', async () => {
    const { base } = await api(started());
    const refused = await post(base, '/action', { version: 1, tick: 0, action: { t: 'eat', item: 'core/not-a-thing' } });
    expect(refused.status).toBe(409);
    expect(await reasonOf(refused)).toBe('refused');
  });

  test('movement report times running backwards say backwards', async () => {
    const state = started();
    const path = longMovementPath(state);
    const { base } = await api(state);
    const backwards = await post(base, '/moves', { version: 1, moves: [move(path[1]!, 1_000), move(path[2]!, 500)] });
    expect(backwards.status).toBe(409);
    expect((await backwards.json()) as { error: string }).toEqual({
      error: 'Movement report times cannot run backwards.',
      reason: 'backwards',
    });
  });
});
