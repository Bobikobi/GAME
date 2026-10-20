import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { newState, serialize, step, type Bundle, type State } from '@game/kernel';
import type { IncomingMessage, Server } from 'node:http';

import { createGameApi, listen, type PlayerRecord, type PlayerStore } from '../src';
import { applyStatePatch, publicState } from '../src/patch';
import { loadBundle } from '../../tools/test/helpers/world.js';

const PLAYER = 'player-1';
let bundle: Bundle;
let server: Server | undefined;

beforeAll(() => {
  bundle = loadBundle();
});

class MemoryStore implements PlayerStore {
  record: PlayerRecord;

  constructor(state: State, acceptedAt: number) {
    this.record = { state, version: 1, acceptedAt };
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

async function api(state: State, now = 1_000_000): Promise<{ store: MemoryStore; base: string }> {
  const store = new MemoryStore(state, now);
  server = createGameApi({
    bundle,
    store,
    now: () => now,
    resolvePlayerId: async (request: IncomingMessage) => request.headers.authorization === 'Bearer test' ? PLAYER : undefined,
  });
  const address = await listen(server, 0);
  return { store, base: `http://127.0.0.1:${address.port}` };
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

describe('Stage 2a server protocol', () => {
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
    const malformed = await post(base, '/moves', { version: 1, moves: [{ at: [1], tick: 0 }] });
    expect(malformed.status).toBe(400);
    const oversized = await post(base, '/moves', {
      version: 1,
      moves: Array.from({ length: 257 }, () => ({ at: store.record.state.player.at, tick: 0 })),
    });
    expect(oversized.status).toBe(400);
    expect(serialize(store.record.state)).toBe(before);
  });
});
