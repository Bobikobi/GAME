/** Lost replies exercised against the real HTTP API and its atomic state/ledger store contract. */
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import type { Server } from 'node:http';
import { canonical, npcTile, publicState, salePrice, type Action, type Bundle, type Tile } from '@game/kernel';
import { createGameApi, listen } from '../../server/src';
import { MemoryStore, PLAYER } from '../../server/test/support/phone';
import { bfsNear, loadBundle } from '../../tools/test/helpers/world.js';
import { RemoteSession, WireGap, fetchWire } from '../src/remote';
import { Session } from '../src/session';

let bundle: Bundle;
const servers: Server[] = [];
beforeAll(() => { bundle = loadBundle(); });
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  })));
});

type Fault = 'none' | 'before-send' | 'lost' | 'body-gap' | 'truncated' | 'invalid-envelope' | 'gateway';
async function sale() {
  const local = Session.fresh(bundle);
  expect(local.act({ t: 'start', starter: 'core/forager', name: 'Tess' }).ok).toBe(true);
  const state = local.state;
  state.player.attrs.might = 100;
  state.player.restored = ['core/old-bridge'];
  state.player.quests['core/fix-the-bridge'] = 'done';
  const trader = Object.keys(bundle.npcs).sort().find(id => {
    const shop = bundle.npcs[id]!.shop;
    return shop && bundle.shops[shop]?.buys;
  })!;
  const item = Object.keys(bundle.items).sort().find(id => {
    const probe = structuredClone(state); probe.player.bag[id] = 1;
    return (salePrice(bundle, probe, id, 1) ?? 0) >= 1;
  })!;
  state.player.bag[item] = 2;
  const [nx, ny] = npcTile(bundle, trader)!;
  const at = bfsNear(bundle, state.player, state.player.at, { x: nx, y: ny, w: 1, h: 1 })!.at(-1)! as Tile;
  state.player.at = at;
  const pay = salePrice(bundle, state, item, 1)!;
  const store = new MemoryStore(bundle, state, 1_000_000);
  const server = createGameApi({ bundle, store, now: () => 1_000_000, resolvePlayerId: async () => PLAYER });
  servers.push(server);
  const address = await listen(server, 0);
  let fault: Fault = 'none', actionPosts = 0, stateReads = 0;
  let holdState: Promise<void> | undefined;
  let brokenState = false;
  const wire = fetchWire(`http://127.0.0.1:${address.port}`, async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === '/state') {
      stateReads++; await holdState;
      if (brokenState) { brokenState = false; return new Response('{"state":', { status: 200 }); }
    }
    if (path !== '/action') return fetch(input, init);
    actionPosts++;
    const f = fault; fault = 'none';
    if (f === 'before-send') throw TypeError('connection lost before send');
    const response = await fetch(input, init);
    if (f === 'none') return response;
    // Consume the real accepted response before disrupting what reaches the client.
    await response.text();
    if (f === 'lost') throw TypeError('accepted reply lost');
    if (f === 'body-gap') return new Response(new ReadableStream({ start(controller) { controller.error(TypeError('body connection lost')); } }), { status: 200 });
    if (f === 'truncated') return new Response('{"patch":', { status: 200 });
    if (f === 'invalid-envelope') return new Response('{"ok":true}', { status: 200 });
    return new Response('Bad gateway', { status: 502 });
  });
  const remote = await RemoteSession.join(bundle, wire);
  const action: Action = { t: 'sell', npc: trader, item, qty: 1, at };
  return { remote, store, item, pay, action, fail: (f: Fault) => { fault = f; },
    holdReads(p: Promise<void> | undefined) { holdState = p; },
    breakNextState() { brokenState = true; },
    get actionPosts() { return actionPosts; }, get stateReads() { return stateReads; } };
}

describe('recovering an action whose reply was lost', () => {
  test.each(['headers', 'body'] as const)('a stalled %s response has a deadline, including body consumption', async phase => {
    vi.useFakeTimers();
    const wire = fetchWire('', async (_url, init) => {
      if (phase === 'headers') return await new Promise<Response>((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(TypeError('aborted')), { once: true });
      });
      return new Response(new ReadableStream({ start(controller) {
        init!.signal!.addEventListener('abort', () => controller.error(TypeError('body aborted')), { once: true });
      } }), { status: 200 });
    }, 1000);
    let settled = false;
    const request = wire.post('/action', {});
    void request.then(() => { settled = true; }, () => { settled = true; });
    const rejected = expect(request).rejects.toBeInstanceOf(WireGap);
    await vi.advanceTimersByTimeAsync(999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    expect(settled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  test.each(['lost', 'body-gap', 'truncated', 'invalid-envelope', 'gateway'] as const)('%s after commit recovers one sale and one ledger entry without replay', async fault => {
    const r = await sale();
    const known = canonical(r.remote.state);
    r.fail(fault);
    const answer = await r.remote.act(r.action);
    expect(answer.ok).toBe(false);
    expect(r.remote.connected).toBe(false);
    expect(r.remote.waiting).toBe(false);
    expect(canonical(r.remote.state)).toBe(known);
    expect(r.store.record.state.player.bag[r.item]).toBe(1);
    expect(r.store.goldLedger.map(row => row.deltaMg)).toEqual([r.pay]);
    await r.remote.resumeFromServer();
    await r.remote.resumeFromServer();
    expect(r.remote.connected).toBe(true);
    expect(canonical(r.remote.state)).toBe(canonical(publicState(r.store.record.state)));
    expect(r.actionPosts).toBe(1);
    expect(r.store.actionLog).toHaveLength(1);
    expect(r.store.goldLedger).toHaveLength(1);
  });

  test('a request lost before send is not silently replayed during resume', async () => {
    const r = await sale(); r.fail('before-send');
    expect((await r.remote.act(r.action)).ok).toBe(false);
    await r.remote.resumeFromServer();
    expect(r.remote.state.player.bag[r.item]).toBe(2);
    expect(r.store.goldLedger).toEqual([]);
    // A fresh explicit action is permitted after the authoritative state is restored.
    expect((await r.remote.act(r.action)).ok).toBe(true);
    expect(r.store.goldLedger).toHaveLength(1);
  });

  test('simultaneous resume inputs share one state request', async () => {
    const r = await sale(); r.fail('lost'); await r.remote.act(r.action);
    let release!: () => void;
    r.holdReads(new Promise<void>(resolve => { release = resolve; }));
    const first = r.remote.resumeFromServer(), second = r.remote.resumeFromServer(), third = r.remote.resumeFromServer();
    const same = first === second && second === third;
    release(); await Promise.all([first, second, third]);
    expect(same).toBe(true);
    expect(r.stateReads).toBe(1);
    expect(r.actionPosts).toBe(1);
    expect(r.store.goldLedger).toHaveLength(1);
  });

  test('a shared failed resume stays paused and can be retried without replaying the sale', async () => {
    const r = await sale(); r.fail('lost'); await r.remote.act(r.action);
    const known = canonical(r.remote.state);
    r.breakNextState();
    const attempts = await Promise.allSettled([r.remote.resumeFromServer(), r.remote.resumeFromServer()]);
    expect(attempts.map(result => result.status)).toEqual(['rejected', 'rejected']);
    expect(r.remote.connected).toBe(false);
    expect(canonical(r.remote.state)).toBe(known);
    await r.remote.resumeFromServer();
    expect(r.remote.connected).toBe(true);
    expect(r.remote.state.player.bag[r.item]).toBe(1);
    expect(r.stateReads).toBe(2);
    expect(r.actionPosts).toBe(1);
    expect(r.store.goldLedger).toHaveLength(1);
  });
});
