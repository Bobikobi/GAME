import { beforeAll, describe, expect, test } from 'vitest';
import { statePatch, type Bundle, type Tile } from '@game/kernel';
import { bfsNear, loadBundle } from '../../tools/test/helpers/world.js';
import { RemoteSession, type ChangeReply, type StateReply, type Wire } from '../src/remote';
import { Session } from '../src/session';
import { FakeServer } from './fake-server';

let bundle: Bundle;
beforeAll(() => { bundle = loadBundle(); });

/** Stop one movement request before acceptance or after acceptance but before its reply. */
class GatedWire implements Wire {
  private gate?: { phase: 'request' | 'reply'; entered: () => void; released: Promise<void> };
  /** A server fall reply, for exercising the client's relocation contract. */
  fallAt?: Tile;
  constructor(readonly server: FakeServer) {}

  hold(phase: 'request' | 'reply') {
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>(resolve => { enter = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });
    this.gate = { phase, entered: enter, released };
    return { entered, release };
  }

  post(path: '/session', body: unknown): Promise<StateReply>;
  post(path: '/action' | '/moves', body: unknown): Promise<ChangeReply>;
  async post(path: '/session' | '/action' | '/moves', body: unknown): Promise<StateReply | ChangeReply> {
    const gate = path === '/moves' ? this.gate : undefined;
    if (gate) this.gate = undefined;
    if (gate?.phase === 'request') { gate.entered(); await gate.released; }
    const before = this.fallAt && path === '/moves' ? structuredClone(this.server.state) : undefined;
    const reply = path === '/session' ? await this.server.post(path, body) : await this.server.post(path, body);
    if (before && this.fallAt && 'patch' in reply) {
      const from: Tile = [...this.server.state.player.at];
      this.server.state.player.at = [...this.fallAt];
      reply.patch = statePatch(before, this.server.state);
      reply.events.push({ e: 'fall', from, at: [...this.fallAt], lost: [] });
      this.fallAt = undefined;
    }
    if (gate?.phase === 'reply') { gate.entered(); await gate.released; }
    return reply;
  }

  get(path: '/state'): Promise<StateReply> { return this.server.get(path); }
}

async function ready() {
  const local = Session.fresh(bundle);
  expect(local.act({ t: 'start', starter: 'core/forager', name: 'Tess' }).ok).toBe(true);
  const server = new FakeServer(bundle, local.state);
  const wire = new GatedWire(server);
  const remote = await RemoteSession.join(bundle, wire);
  const home: Tile = [...remote.pos];
  let away: Tile | undefined;
  for (const inst of Object.values(bundle.instances)) {
    if (inst.kind !== 'resource') continue;
    const path = bfsNear(bundle, local.state.player, home, { x: inst.x, y: inst.y, w: 1, h: 1 });
    if (path && path.length > 1) { away = path[1]; break; }
  }
  if (!away) throw Error('No walkable neighbour of the wake');
  server.calls.length = 0;
  return { server, wire, remote, home, away };
}

function sentTiles(server: FakeServer): Tile[] {
  return server.calls.filter(c => c.path === '/moves').flatMap(c => (c.body as { moves: { at: Tile }[] }).moves.map(m => m.at));
}

describe('remote movement preserves the route before acknowledgement', () => {
  test('walking out and back before a flush keeps both steps', async () => {
    const { server, remote, home, away } = await ready();
    remote.report(away);
    remote.report(home);
    await remote.flushMoves();
    expect(sentTiles(server)).toEqual([away, home]);
    expect(server.state.player.at).toEqual(home);
    expect(remote.state.player.at).toEqual(home);
  });

  test.each(['request', 'reply'] as const)('a return during an in-flight %s is retained', async phase => {
    const { server, wire, remote, home, away } = await ready();
    const gate = wire.hold(phase);
    remote.report(away);
    const flushing = remote.flushMoves();
    await gate.entered;
    remote.report(home);
    gate.release();
    await flushing;
    expect(sentTiles(server)).toEqual([away, home]);
    expect(server.state.player.at).toEqual(home);
    expect(remote.version).toBe(server.version);
  });

  test('an unchanged tile is skipped only when no walk is owed; forced standing reports still go out', async () => {
    const { server, remote, home } = await ready();
    remote.report(home);
    await remote.flushMoves();
    expect(sentTiles(server)).toEqual([]);
    remote.report(home, true);
    await remote.flushMoves();
    expect(sentTiles(server)).toEqual([home]);
  });

  test('reconnect discards the unacknowledged route and accepts a fresh out-and-back walk', async () => {
    const { server, wire, remote, home, away } = await ready();
    const gate = wire.hold('request');
    remote.report(away);
    const flushing = remote.flushMoves();
    await gate.entered;
    remote.report(home);
    server.gap = true;
    gate.release();
    await flushing;
    expect(remote.connected).toBe(false);
    server.gap = false;
    await remote.resumeFromServer();
    server.calls.length = 0;
    await remote.flushMoves();
    expect(sentTiles(server)).toEqual([]);
    remote.report(away);
    remote.report(home);
    await remote.flushMoves();
    expect(sentTiles(server)).toEqual([away, home]);
    expect(server.state.player.at).toEqual(home);
  });
});

describe('actions do not cross a movement correction', () => {
  test('a refused move cancels the action that depended on reaching it', async () => {
    const { server, remote, home } = await ready();
    remote.report([home[0] + 8, home[1]]);
    const answer = await remote.act({ t: 'eat', item: 'core/not-a-thing' });
    expect(answer).toEqual({ ok: false, error: 'The game state changed; try the action again.' });
    expect(server.calls.map(c => c.path)).toEqual(['/moves', '/state']);
    expect(remote.pos).toEqual(home);
    expect(remote.waiting).toBe(false);
    // A fresh input after the correction is allowed to reach the server.
    await remote.act({ t: 'eat', item: 'core/not-a-thing' });
    expect(server.calls.at(-1)?.path).toBe('/action');
  });

  test('an action queued behind a stale movement flush is cancelled after resync', async () => {
    const { server, wire, remote, away } = await ready();
    const gate = wire.hold('request');
    remote.report(away);
    const flushing = remote.flushMoves();
    await gate.entered;
    const action = remote.act({ t: 'eat', item: 'core/not-a-thing' });
    server.version++;
    gate.release();
    await flushing;
    expect((await action).ok).toBe(false);
    expect(server.calls.map(c => c.path)).toEqual(['/moves', '/state']);
    expect(remote.version).toBe(server.version);
  });

  test('an action waiting on a state refresh is not replayed after that refresh', async () => {
    const { server, remote } = await ready();
    const resuming = remote.resumeFromServer();
    const action = remote.act({ t: 'eat', item: 'core/not-a-thing' });
    await resuming;
    expect((await action).ok).toBe(false);
    expect(server.calls.map(c => c.path)).toEqual(['/state']);
  });

  test('a server fall cancels queued actions from the old location', async () => {
    const { server, wire, remote, home, away } = await ready();
    const gate = wire.hold('reply');
    wire.fallAt = home;
    remote.report(away);
    const flushing = remote.flushMoves();
    await gate.entered;
    const action = remote.act({ t: 'eat', item: 'core/not-a-thing' });
    gate.release();
    await flushing;
    expect((await action).ok).toBe(false);
    expect(server.calls.map(c => c.path)).toEqual(['/moves']);
    expect(remote.pos).toEqual(home);
    expect(remote.state.player.at).toEqual(home);
    expect(remote.waiting).toBe(false);
  });
});
