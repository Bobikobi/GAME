import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { makeWalkable, newState, serialize, step, type Bundle, type State, type Tile } from '@game/kernel';
import type { IncomingMessage, Server } from 'node:http';

import { createGameApi, createPlayerRecord, listen, type PlayerRecord, type PlayerStore } from '../src';
import { applyStatePatch, publicState } from '../src/patch';
import { bfsToTile, loadBundle } from '../../tools/test/helpers/world.js';

const PLAYER = 'player-1';
let bundle: Bundle;
let server: Server | undefined;

beforeAll(() => {
  bundle = loadBundle();
});

class MemoryStore implements PlayerStore {
  record: PlayerRecord;

  constructor(state: State, acceptedAt: number) {
    this.record = createPlayerRecord(bundle, state, acceptedAt);
  }

  async load(playerId: string): Promise<PlayerRecord | undefined> {
    return playerId === PLAYER ? structuredClone(this.record) : undefined;
  }

  async compareAndSet(playerId: string, expectedVersion: number, next: PlayerRecord): Promise<boolean> {
    if (playerId !== PLAYER || this.record.version !== expectedVersion) return false;
    this.record = structuredClone(next);
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
    expect(await response.json()).toEqual({ error: 'That game time is ahead of the time elapsed.' });
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
    expect(await repeatedSlack.json()).toEqual({ error: 'That game time is ahead of the time elapsed.' });
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
    expect(await response.json()).toEqual({ error: 'The game state changed; resume before sending another action.' });
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
    expect(resumed).toEqual({ state: publicState(store.record.state), version: 1 });
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
    expect(body).toEqual({ state: publicState(state), version: 1 });
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
