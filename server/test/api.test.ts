import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { appearSlots, appears, gaitStepMs, makeWalkable, newState, npcTile, salePrice, serialize, step, type Bundle, type Gait, type State, type Tile } from '@game/kernel';
import type { IncomingMessage, Server } from 'node:http';

import { createGameApi, createPlayerRecord, isAction, listen, replayAccount, type Books, type PlayerRecord, type PlayerStore } from '../src';
import { newerKernel } from '../src/api';
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

async function api(state: State, now = 1_000_000, world: Bundle = bundle): Promise<{ store: MemoryStore; base: string; clock: { now: number } }> {
  const clock = { now };
  const store = new MemoryStore(state, now);
  server = createGameApi({
    bundle: world,
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

async function closeServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  server = undefined;
}

afterEach(closeServer);

function started(): State {
  const result = step(bundle, newState(bundle, 17), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

/** The appear nodes the state's key makes stand now, as the kernel draws them: what a reply must list. */
function standing(state: State): string[] {
  return [...appearSlots(bundle).keys()].filter((id) => appears(bundle, state, id, state.tick)).sort();
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
    state.player.attrs.might = 100;
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
    expect(resumed).toEqual({ state: publicState(store.record.state), version: 1, appears: standing(store.record.state) });
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
    expect(body).toEqual({ state: publicState(state), version: 1, appears: standing(state) });
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
    expect(await extraField.json()).toEqual({ error: 'A movement report holds a kind, a tile, a tick and a gait, nothing else.' });

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

/** The top-left tile of a square of open ground `side` tiles wide, for the forager. */
function openSquare(state: State, side: number): Tile {
  const walkable = makeWalkable(bundle);
  const { width: w, height: h } = bundle.map;
  for (let y = 0; y + side <= h; y++) {
    for (let x = 0; x + side <= w; x++) {
      let open = true;
      for (let dy = 0; dy < side && open; dy++) for (let dx = 0; dx < side && open; dx++) open = walkable(x + dx, y + dy, state.player);
      if (open) return [x, y];
    }
  }
  throw new Error(`The map has no open square of ${side} tiles.`);
}

describe('the free walk on the server (NEXT 22 c)', () => {
  /**
   * A free walk at full speed on a diagonal, as the client reports it: the feet cross a corner every
   * `walk_step_ms * sqrt 2`, and the side tile goes first, at the same tick, so the reports stay four-way.
   * It bounces between two corners of an open square, `pairs` tiles each way.
   */
  function diagonalWalk(start: Tile, pairs: number, ms: number): { kind: 'move'; at: Tile; tick: number }[] {
    const stepMs = bundle.params.walk_step_ms;
    const reports: { kind: 'move'; at: Tile; tick: number }[] = [];
    let at = start;
    let sign = 1;
    for (let k = 1; ; k++) {
      const tick = Math.round(k * stepMs * Math.SQRT2);
      if (tick > ms) break;
      const side: Tile = [at[0] + sign, at[1]];
      const corner: Tile = [at[0] + sign, at[1] + sign];
      reports.push(move(side, tick), move(corner, tick));
      at = corner;
      if (k % pairs === 0) sign = -sign;
    }
    return reports;
  }

  test('a 20 s diagonal walk at full speed passes from a fresh record, and a jump of 3 tiles is still refused', async () => {
    const state = started();
    const corner = openSquare(state, 6);
    state.player.at = corner;
    const { base, store, clock } = await api(state);
    const reports = diagonalWalk(corner, 5, 20_000);
    expect(reports.length).toBeGreaterThan(140);
    clock.now += 20_000;
    for (let i = 0; i < reports.length; i += 256) {
      const response = await post(base, '/moves', { version: store.record.version, moves: reports.slice(i, i + 256) });
      expect(response.status, await response.clone().text()).toBe(200);
    }
    const last = reports[reports.length - 1]!;
    expect(store.record.state.player.at).toEqual(last.at);

    // the same frame, three tiles on: further than a walk goes in that time
    const before = serialize(store.record.state);
    const jump = await post(base, '/moves', { version: store.record.version, moves: [move([last.at[0] + 3, last.at[1]], last.tick)] });
    expect(jump.status).toBe(409);
    expect(serialize(store.record.state)).toBe(before);
  });

  test('the same walk charged by its four-way length would run dry', () => {
    // what the octile charge fixes: four-way steps cost 1.41 walk_step_ms per walk_step_ms on a diagonal
    const stepMs = bundle.params.walk_step_ms;
    const reports = diagonalWalk([0, 0], 5, 20_000);
    const fourWay = reports.length * stepMs;
    const refill = 20_000 + 2 * stepMs;
    expect(fourWay).toBeGreaterThan(refill + bundle.params.move_reach_max * stepMs);
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

describe('the move carries its gait to the server (DECISIONS 2026-10-29, the gaits)', () => {
  // the night round of kernel/test/stealth.test.ts: at dusk the wolf stands on [8, 22] and looks east
  const DUSK = 400_000;
  const ROUND: Tile[] = [[8, 22], [9, 22], [9, 23], [8, 23]];

  function wolfWorld(): Bundle {
    const b = structuredClone(bundle);
    b.map.props = [
      ...b.map.props.filter((p) => !p.hazard && p.cover !== true),
      {
        id: 'test/wolf',
        sprite: 'core/base-kit:props/standing_stone',
        x: 8,
        y: 22,
        w: 1,
        h: 1,
        solid: false,
        hazard: { kind: 'predator', window: ['night'], reach: 3, round: ROUND, pace_ms: 600, eyes: 5 },
      },
    ];
    return b;
  }

  function moveAt(at: Tile, tick: number, gait?: Gait): { kind: 'move'; at: Tile; tick: number; gait?: Gait } {
    return gait === undefined ? { kind: 'move', at, tick } : { kind: 'move', at, tick, gait };
  }

  /**
   * A fresh account in the wolf's world, played over the wire from its first request: the start, a day walk
   * from the spawn to [12, 22] (four tiles in front of the wolf's den, where a walk is heard and a sneak is
   * not), and at dusk one batch of `gait` steps that stays four tiles off the wolf. Every row is the server's own.
   */
  async function nightBatch(gait: Gait): Promise<{ world: Bundle; seed: State['seed']; store: MemoryStore }> {
    const world = wolfWorld();
    const fresh = newState(world, 17);
    const { base, store, clock } = await api(fresh, 1_000_000, world);
    const start = await post(base, '/action', { version: 1, tick: 0, action: { t: 'start', starter: 'core/forager', name: 'Tess' } });
    expect(start.status, await start.clone().text()).toBe(200);

    const path = bfsToTile(world, store.record.state.player, store.record.state.player.at, [12, 22]);
    expect(path, 'the day walk from the spawn to the wolf').toBeTruthy();
    const stepMs = world.params.walk_step_ms;
    const day = path!.slice(1).map((at, i) => moveAt(at, 1_000 + i * stepMs));
    clock.now += 1_000 + day.length * stepMs;
    const walked = await post(base, '/moves', { version: store.record.version, moves: day });
    expect(walked.status, await walked.clone().text()).toBe(200);
    expect(store.record.state.player.chase).toBeNull();

    clock.now += DUSK;
    const night = [moveAt([12, 23], DUSK + 100, gait), moveAt([12, 22], DUSK + 100, gait), moveAt([12, 23], DUSK + 100, gait)];
    const response = await post(base, '/moves', { version: store.record.version, moves: night });
    expect(response.status, await response.clone().text()).toBe(200);
    // the book holds the reports as they came, gait and all, so the replay hears the same steps
    expect(store.actionLog.at(-1)!.books.action).toEqual({ kind: 'moves', moves: night });
    return { world, seed: fresh.seed, store };
  }

  function logOf(store: MemoryStore): { seq: number; action: unknown; tick: number }[] {
    return store.actionLog.map(({ seq, books }) => ({ seq, action: books.action, tick: books.tick }));
  }

  test('a sneak batch four tiles off the wolf is not seen, the same batch run is (stealth.test.ts on the wire)', async () => {
    const sneak = await nightBatch('sneak');
    expect(sneak.store.record.state.player.chase).toBeNull();
    await closeServer();
    const run = await nightBatch('run');
    expect(run.store.record.state.player.chase).toEqual({ hazard: 'test/wolf', since: DUSK + 100, bites: 0 });
  });

  test('the replay of a log with gaits lands on the stored state, and the same log without them does not', async () => {
    const { world, seed, store } = await nightBatch('sneak');
    const replay = replayAccount(world, seed, logOf(store));
    expect(replay.ok, replay.ok ? '' : replay.problem).toBe(true);
    if (!replay.ok) return;
    expect(serialize(replay.replay.state)).toBe(serialize(store.record.state));

    // what the server did before the fix: every step a walk, and the wolf hears the walk at four tiles
    const walked = logOf(store).map((row) => {
      const action = row.action as { kind?: string; moves?: { gait?: Gait }[] };
      if (action.kind !== 'moves') return row;
      return { ...row, action: { ...action, moves: action.moves!.map(({ gait: _gait, ...report }) => report) } };
    });
    const asWalks = replayAccount(world, seed, walked);
    expect(asWalks.ok).toBe(true);
    if (!asWalks.ok) return;
    expect(asWalks.replay.state.player.chase).not.toBeNull();
  });

  test('an unknown gait is refused before the kernel, and a known one is an action', async () => {
    const { base, store } = await api(started());
    const before = serialize(store.record.state);
    const at = store.record.state.player.at;
    const crawl = await post(base, '/moves', { version: 1, moves: [{ kind: 'move', at, tick: 0, gait: 'crawl' }] });
    expect(crawl.status).toBe(400);
    expect(await crawl.json()).toEqual({ error: 'A movement report walks, runs or sneaks.' });
    expect(serialize(store.record.state)).toBe(before);
    expect(store.record.version).toBe(1);
    expect(store.actionLog).toEqual([]);

    // the wire's action shape (an opening's log is read by it) knows the kernel's three gaits and no fourth
    expect(isAction({ t: 'move', at, gait: 'sneak' })).toBe(true);
    expect(isAction({ t: 'move', at, gait: 'run' })).toBe(true);
    expect(isAction({ t: 'move', at, gait: 'walk' })).toBe(true);
    expect(isAction({ t: 'move', at })).toBe(true);
    expect(isAction({ t: 'move', at, gait: 'crawl' })).toBe(false);
    expect(isAction({ t: 'move', at, gait: 1 })).toBe(false);

    // the crossing's three acts: the board names its passage and tile, the sail holds nothing, a riddle's answer is a whole number
    expect(isAction({ t: 'board', passage: 'core/bay-crossing', at })).toBe(true);
    expect(isAction({ t: 'board', passage: 'core/bay-crossing' })).toBe(false);
    expect(isAction({ t: 'sail' })).toBe(true);
    expect(isAction({ t: 'sail', segments: 3 })).toBe(false);
    expect(isAction({ t: 'answer' })).toBe(true);
    expect(isAction({ t: 'answer', choice: 1 })).toBe(true);
    expect(isAction({ t: 'answer', choice: 'left' })).toBe(false);
  });

  test('the credit pays a tile at the gait\'s pace: a run buys twice the tiles of a walk, a sneak half', async () => {
    const state = started();
    const path = longMovementPath(state);
    const creditMs = 2 * bundle.params.walk_step_ms;
    // a fresh record holds two tiles of credit at the content's walk: at the forager's light pace that buys four run tiles and one sneak tile
    expect(Math.floor(creditMs / gaitStepMs(bundle, state, 'run'))).toBe(4);
    expect(Math.floor(creditMs / gaitStepMs(bundle, state, 'sneak'))).toBe(1);

    const ran = await api(state);
    const run = await post(ran.base, '/moves', { version: 1, moves: path.slice(1, 5).map((at) => moveAt(at, 0, 'run')) });
    expect(run.status, await run.clone().text()).toBe(200);
    const spent = await post(ran.base, '/moves', { version: 2, moves: [moveAt(path[3]!, 0, 'run')] });
    expect(spent.status).toBe(409);
    expect(((await spent.json()) as { reason: string }).reason).toBe('walk-credit');
    await closeServer();

    // a sneak cannot be claimed at a walk's speed: the second tile in the same instant is past the credit
    const crept = await api(state);
    const first = await post(crept.base, '/moves', { version: 1, moves: [moveAt(path[1]!, 0, 'sneak')] });
    expect(first.status, await first.clone().text()).toBe(200);
    const second = await post(crept.base, '/moves', { version: 2, moves: [moveAt(path[2]!, 0, 'sneak')] });
    expect(second.status).toBe(409);
    expect(((await second.json()) as { reason: string }).reason).toBe('walk-credit');
  });
});

describe('a state stored under older content (a new image of the server)', () => {
  function olderWorld(): State {
    const state = started();
    state.content = 'an-older-world';
    // an item the older content had and today's does not
    state.player.bag['core/no-longer-made'] = 3;
    return state;
  }

  function neighbour(state: State): Tile {
    const walkable = makeWalkable(bundle);
    const [x, y] = state.player.at;
    const found = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([dx, dy]): Tile => [x + dx, y + dy]).find(([tx, ty]) => walkable(tx, ty, state.player));
    if (!found) throw new Error('The start tile has no walkable neighbour.');
    return found;
  }

  test('is adapted on its first read, logged once as its own version, and plays on', async () => {
    const { base, store, clock } = await api(olderWorld());
    const read = await fetch(`${base}/state`, { headers: { authorization: 'Bearer test' } });
    expect(read.status).toBe(200);
    const body = (await read.json()) as { state: State; version: number };
    expect(body.version).toBe(2);
    expect(body.state.content).toBe(bundle.tag);
    expect(body.state.player.bag['core/no-longer-made']).toBeUndefined();
    expect(store.actionLog).toEqual([{ seq: 2, books: { action: { kind: 'adapt', from: 'an-older-world', to: bundle.tag }, tick: store.record.state.tick, gold: [] } }]);
    // a second read finds today's content and writes nothing
    expect((await fetch(`${base}/state`, { headers: { authorization: 'Bearer test' } })).status).toBe(200);
    expect(store.actionLog).toHaveLength(1);

    clock.now += 10_000;
    const tick = store.record.state.tick + bundle.params.walk_step_ms;
    const walked = await post(base, '/moves', { version: 2, moves: [move(neighbour(store.record.state), tick)] });
    expect(walked.status).toBe(200);
    expect(store.record.version).toBe(3);
  });

  test('a request that names the version before the adapt is told to read the state again', async () => {
    const { base, store, clock } = await api(olderWorld());
    clock.now += 10_000;
    const tick = store.record.state.tick + bundle.params.walk_step_ms;
    const stale = await post(base, '/moves', { version: 1, moves: [move(neighbour(store.record.state), tick)] });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ reason: 'stale' });
    // the adapt was written, once, and the walk was not
    expect(store.record.version).toBe(2);
    expect(store.actionLog.map((entry) => entry.books.action)).toEqual([{ kind: 'adapt', from: 'an-older-world', to: bundle.tag }]);
  });

  test('a state a newer kernel wrote is left for the newer image: a rolled-back server never adapts it down', async () => {
    const newer = olderWorld();
    newer.kernel = '99.0.0';
    const { base, store } = await api(newer);
    const before = serialize(store.record.state);
    const read = await fetch(`${base}/state`, { headers: { authorization: 'Bearer test' } });
    expect(read.status).toBe(503);
    expect(serialize(store.record.state)).toBe(before);
    expect(store.actionLog).toHaveLength(0);
  });

  test('newerKernel compares major, minor and patch as numbers, and reads nothing it cannot parse as newer', () => {
    expect(newerKernel('0.22.1', '0.22.0')).toBe(true);
    expect(newerKernel('0.23.0', '0.22.9')).toBe(true);
    expect(newerKernel('0.10.0', '0.9.0')).toBe(true);
    expect(newerKernel('0.22.0', '0.22.0')).toBe(false);
    expect(newerKernel('0.20.0', '0.22.0')).toBe(false);
    expect(newerKernel(undefined, '0.22.0')).toBe(false);
    expect(newerKernel('next', '0.22.0')).toBe(false);
  });

  test('a character whose race left the content is refused, and its row is left as it was', async () => {
    const gone = olderWorld();
    gone.player.race = 'core/a-race-that-left';
    const { base, store } = await api(gone);
    const before = serialize(store.record.state);
    const read = await fetch(`${base}/state`, { headers: { authorization: 'Bearer test' } });
    expect(read.status).toBe(409);
    expect(await read.json()).toEqual({ error: 'The race of this character is no longer in the game.', reason: 'refused' });
    expect(serialize(store.record.state)).toBe(before);
    expect(store.actionLog).toHaveLength(0);
  });
});

describe('the players counter (GET /stats)', () => {
  async function counted(counts: (now: number) => Promise<{ accounts: number; new_7d: number }>, clock = { now: 1_000_000 }) {
    const store = new MemoryStore(started(), clock.now);
    const loads: string[] = [];
    const load = store.load.bind(store);
    store.load = async (id) => { loads.push(id); return load(id); };
    server = createGameApi({ bundle, store, now: () => clock.now, resolvePlayerId: async () => undefined, accountCounts: counts });
    const address = await listen(server, 0);
    return { base: `http://127.0.0.1:${address.port}`, loads };
  }

  test('answers the two counts to anyone, with no identity and no player row read, and lets a cache keep them a minute', async () => {
    const { base, loads } = await counted(async () => ({ accounts: 12, new_7d: 3 }));
    const response = await fetch(`${base}/stats`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=60');
    expect(await response.json()).toEqual({ accounts: 12, new_7d: 3 });
    expect(loads).toEqual([]);
    expect((await fetch(`${base}/stats`, { method: 'POST' })).status).toBe(405);
    expect((await fetch(`${base}/stats?who=all`)).status).toBe(400);
  });

  test('reads the store once a minute however often it is asked, and asks again after a failed read', async () => {
    const clock = { now: 1_000_000 };
    let reads = 0;
    let failing = false;
    const { base } = await counted(async () => {
      reads++;
      if (failing) throw new Error('the database is away');
      return { accounts: reads, new_7d: 0 };
    }, clock);
    await Promise.all(Array.from({ length: 5 }, () => fetch(`${base}/stats`)));
    expect(reads).toBe(1);
    clock.now += 59_999;
    expect(await (await fetch(`${base}/stats`)).json()).toEqual({ accounts: 1, new_7d: 0 });
    clock.now += 1;
    failing = true;
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const down = await fetch(`${base}/stats`).finally(() => quiet.mockRestore());
    expect(down.status).toBe(503);
    expect(down.headers.get('cache-control')).toBe('no-store');
    failing = false;
    expect(await (await fetch(`${base}/stats`)).json()).toEqual({ accounts: 3, new_7d: 0 });
    expect(reads).toBe(3);
  });

  test('is not found where players are not accounts (the header mode passes no counter)', async () => {
    const { base } = await api(started());
    expect((await fetch(`${base}/stats`)).status).toBe(404);
  });
});
