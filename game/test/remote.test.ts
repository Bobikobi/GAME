import { beforeAll, describe, expect, test } from 'vitest';
import { canonical, publicState, type Action, type Bundle, type Tile } from '@game/kernel';

import { Session } from '../src/session';
import { RemoteSession, type ActResult } from '../src/remote';
import { bfsNear, loadBundle } from '../../tools/test/helpers/world.js';
import { FakeServer } from './fake-server';

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

/**
 * The first real work a new character can do: walk to the nearest node the map places and gather it. The
 * walk is four-way and on ground the kernel accepts, in the order the phone reports it.
 */
function workNearby(session: Session): { route: Tile[]; gather: Action; back: Tile[] } {
  let best: { path: Tile[]; node: string } | undefined;
  for (const [node, inst] of Object.entries(bundle.instances)) {
    if (inst.kind !== 'resource') continue;
    const path = bfsNear(bundle, session.state.player, session.pos, { x: inst.x, y: inst.y, w: 1, h: 1 });
    if (!path || path.length < 2) continue;
    if (!best || path.length < best.path.length) best = { path, node };
  }
  if (!best) throw new Error('The valley has no node within reach of the wake.');
  const at = best.path[best.path.length - 1]!;
  return {
    route: best.path.slice(1),
    gather: { t: 'gather', node: best.node, grade: 3, at },
    back: [...best.path.slice(1, -1)].reverse(),
  };
}

describe('the remote session (NEXT 18 c)', () => {
  test('a 30-minute scripted run reaches the same state over the wire as in the save', async () => {
    const local = Session.fresh(bundle);
    // the server anchors game time to the wall clock, so the run moves both: 4 frames a second, for 30 minutes
    const clock = { now: 0 };
    const server = new FakeServer(bundle, local.state, () => clock.now);
    const remote = await RemoteSession.join(bundle, server);
    expect(canonical(remote.state)).toBe(canonical(publicState(local.state)));

    const frame = 250;
    const until = 1_800_000;
    let walked = 0;
    let worked = 0;
    expect(local.act({ t: 'start', starter: 'core/forager', name: 'Tess' }).ok).toBe(true);
    expect((await remote.act({ t: 'start', starter: 'core/forager', name: 'Tess' })).ok).toBe(true);

    // the first work a new character does: walk to the nearest node, gather it, and walk back
    const work = workNearby(local);
    const route: Tile[] = [...work.route, ...work.back];
    const script: Action[] = [work.gather];
    let walkedRoute = 0;

    let frameIndex = 0;
    while (local.tick < until) {
      local.advance(frame);
      remote.advance(frame);
      clock.now += frame;
      frameIndex += 1;

      // every 800th frame an action waits for its reply; the rest of the run is the walk
      const action = frameIndex === 400 ? script[0] : undefined;
      if (action && walkedRoute >= work.route.length) {
        const mine = local.act(action) as ActResult;
        const theirs = await remote.act(action);
        expect(theirs.ok, `${action.t}: ${'error' in theirs ? theirs.error : ''}`).toBe(mine.ok);
        if (!mine.ok) expect(theirs).toEqual({ ok: false, error: mine.error });
        if (theirs.ok) worked += 1;
      } else if (frameIndex % 8 === 0 && walkedRoute < route.length) {
        const at = route[walkedRoute]!;
        walkedRoute += 1;
        local.report(at);
        remote.report(at);
        await remote.flushMoves();
        walked += 1;
      } else if (frameIndex % 8 === 0) {
        // the day goes on: the player stands still and only the clock moves
      }
      expect(canonical(remote.state), `frame ${frameIndex}: local at ${local.state.player.at}, remote at ${remote.state.player.at}`).toBe(canonical(publicState(local.state)));
    }

    expect(local.tick).toBeGreaterThanOrEqual(until);
    expect(walked).toBe(route.length);
    expect(worked).toBe(1);
    expect(canonical(remote.state)).toBe(canonical(publicState(local.state)));
  });

  test('a report batches the walk and sends a kind with every tile', async () => {
    const local = Session.fresh(bundle);
    const server = new FakeServer(bundle, local.state);
    const remote = await RemoteSession.join(bundle, server);
    await remote.act({ t: 'start', starter: 'core/forager', name: 'Tess' });
    server.calls.length = 0;

    const path = workNearby(local).route;
    for (const at of path) remote.report(at);
    // nothing goes out until it is flushed
    expect(server.calls).toEqual([]);
    await remote.flushMoves();

    const call = server.calls.find((entry) => entry.path === '/moves');
    expect(call).toBeDefined();
    const body = call!.body as { version: number; moves: { kind: string; at: Tile; tick: number }[] };
    expect(body.moves.map((move) => move.kind)).toEqual(path.map(() => 'move'));
    expect(body.moves.map((move) => move.at)).toEqual(path);
    expect(canonical(remote.state)).toBe(canonical(publicState(server.state)));
  });

  test('an action flushes the walk first, so its tile is known before it is judged', async () => {
    const local = Session.fresh(bundle);
    const server = new FakeServer(bundle, local.state);
    const remote = await RemoteSession.join(bundle, server);
    await remote.act({ t: 'start', starter: 'core/forager', name: 'Tess' });
    server.calls.length = 0;

    remote.report(workNearby(local).route[0]!);
    await remote.act({ t: 'carve', name: 'Tess' });
    expect(server.calls.map((entry) => entry.path)).toEqual(['/moves', '/action']);
  });

  test('a refusal comes back in plain words and changes nothing on either side', async () => {
    const local = Session.fresh(bundle);
    const server = new FakeServer(bundle, local.state);
    const remote = await RemoteSession.join(bundle, server);
    await remote.act({ t: 'start', starter: 'core/forager', name: 'Tess' });

    const before = canonical(remote.state);
    const answered = await remote.act({ t: 'eat', item: 'core/not-a-thing' });
    expect(answered.ok).toBe(false);
    if (!answered.ok) expect(answered.error.length).toBeGreaterThan(0);
    expect(canonical(remote.state)).toBe(before);
  });

  test('a walk that is too far is refused and the phone takes the server tile back', async () => {
    const local = Session.fresh(bundle);
    const server = new FakeServer(bundle, local.state, () => 0);
    const remote = await RemoteSession.join(bundle, server);
    await remote.act({ t: 'start', starter: 'core/forager', name: 'Tess' });

    const [x, y] = remote.pos;
    remote.report([x + 8, y]);
    await remote.flushMoves();
    expect(canonical(remote.state)).toBe(canonical(publicState(server.state)));
    expect(remote.pos).toEqual([server.state.player.at[0], server.state.player.at[1]]);
  });

  test('a state from the future is refused in plain words and changes nothing', async () => {
    const local = Session.fresh(bundle);
    const server = new FakeServer(bundle, local.state, () => 0);
    const remote = await RemoteSession.join(bundle, server);
    await remote.act({ t: 'start', starter: 'core/forager', name: 'Tess' });

    const before = canonical(remote.state);
    remote.tick = 10_000;
    const answered = await remote.act({ t: 'carve', name: 'Tess' });
    expect(answered).toEqual({ ok: false, error: 'That game time is ahead of the time elapsed.' });
    expect(canonical(remote.state)).toBe(before);
  });

  test('a dropped line pauses instead of playing on, and a resume brings the state back', async () => {
    const local = Session.fresh(bundle);
    const server = new FakeServer(bundle, local.state);
    const remote = await RemoteSession.join(bundle, server);
    await remote.act({ t: 'start', starter: 'core/forager', name: 'Tess' });
    expect(remote.connected).toBe(true);

    server.gap = true;
    const answered = await remote.act({ t: 'carve', name: 'Tess' });
    expect(answered).toEqual({ ok: false, error: 'Waiting for the connection' });
    expect(remote.connected).toBe(false);
    expect(remote.paused).toBe(true);

    server.gap = false;
    await remote.resumeFromServer();
    expect(remote.connected).toBe(true);
    expect(canonical(remote.state)).toBe(canonical(publicState(server.state)));
  });

  test('there is no save to write: saving sends the walk to the server', async () => {
    const local = Session.fresh(bundle);
    const server = new FakeServer(bundle, local.state);
    const remote = await RemoteSession.join(bundle, server);
    await remote.act({ t: 'start', starter: 'core/forager', name: 'Tess' });
    server.calls.length = 0;

    remote.report(workNearby(local).route[0]!);
    remote.save();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(server.calls.map((entry) => entry.path)).toEqual(['/moves']);
  });
});
