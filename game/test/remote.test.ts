import { beforeAll, describe, expect, test } from 'vitest';
import { OWN_FIRE, canonical, lastDusk, publicState, type Action, type Bundle, type Gait, type GameEvent, type Tile } from '@game/kernel';

import { Session } from '../src/session';
import { RemoteSession, fetchWire, type ActResult, type ChangeReply, type StateReply, type Wire, WireGap, WireRefusal } from '../src/remote';
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

  test('a run or a sneak names its gait on the wire, a walk leaves it out (DECISIONS 2026-10-29)', async () => {
    const local = Session.fresh(bundle);
    const server = new FakeServer(bundle, local.state);
    const remote = await RemoteSession.join(bundle, server);
    await remote.act({ t: 'start', starter: 'core/forager', name: 'Tess' });
    server.calls.length = 0;

    const path = workNearby(local).route.slice(0, 3);
    const gaits: Gait[] = ['run', 'walk', 'sneak'];
    for (const [i, at] of path.entries()) remote.report(at, false, gaits[i]);
    await remote.flushMoves();

    const call = server.calls.find((entry) => entry.path === '/moves');
    const body = call!.body as { moves: { kind: string; at: Tile; tick: number; gait?: Gait }[] };
    expect(path).toHaveLength(3);
    expect(body.moves.map((move) => move.gait)).toEqual(['run', undefined, 'sneak']);
    // a walk carries no gait key at all, so a walked report reads as one from before the gaits
    expect(body.moves.filter((move) => move.gait === undefined).every((move) => !('gait' in move))).toBe(true);
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

  test('a node a reaction raises is the server\'s answer, and the phone only reads it', async () => {
    const local = Session.fresh(bundle);
    const server = new FakeServer(bundle, local.state);
    const remote = await RemoteSession.join(bundle, server);
    await remote.act({ t: 'start', starter: 'core/forager', name: 'Tess' });

    // the same id answers the same way on both sides, and the phone never saw a seed to work it out
    for (const id of Object.keys(bundle.instances).slice(0, 20)) {
      expect(remote.appears(id)).toBe(local.appears(id));
    }
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

/**
 * A wire that answers after a real pause and counts how many calls are in the air at once. The fake server
 * keeps no movement credit (see its header: the server's own tests hold that check), so the walks here are
 * single steps the real server would credit anyway.
 */
class SlowWire implements Wire {
  inFlight = 0;
  mostInFlight = 0;
  constructor(readonly server: FakeServer, private readonly delayMs = 5) {}

  private async slowly<T>(run: () => Promise<T>): Promise<T> {
    this.inFlight += 1;
    this.mostInFlight = Math.max(this.mostInFlight, this.inFlight);
    try {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      return await run();
    } finally {
      this.inFlight -= 1;
    }
  }

  post(path: '/session', body: unknown): Promise<StateReply>;
  post(path: '/action' | '/moves', body: unknown): Promise<ChangeReply>;
  post(path: '/action' | '/moves' | '/session', body: unknown): Promise<StateReply | ChangeReply> {
    return this.slowly(() => this.server.post(path as '/session', body) as Promise<StateReply | ChangeReply>);
  }

  get(path: '/state'): Promise<StateReply> {
    return this.slowly(() => this.server.get(path));
  }
}

async function started(clock = { now: 0 }) {
  const local = Session.fresh(bundle);
  const server = new FakeServer(bundle, local.state, () => clock.now);
  const wire = new SlowWire(server);
  const remote = await RemoteSession.join(bundle, wire);
  await remote.act({ t: 'start', starter: 'core/forager', name: 'Tess' });
  return { local, server, wire, remote, clock };
}

describe('the remote session: the clock on resume (Stage 2a follow-up)', () => {
  test('a player who returns at a late server tick can walk at once, with no catching up', async () => {
    const clock = { now: 0 };
    const { local, server, remote } = await started(clock);
    const route = workNearby(local).route;
    const home = [...remote.pos] as Tile;
    // an hour of game time passes with the phone in use, then the phone is closed
    clock.now += 3_600_000;
    remote.tick = 3_600_000;
    remote.report(route[0]!);
    await remote.flushMoves();
    expect(server.state.tick).toBe(3_600_000);

    const returned = await RemoteSession.join(bundle, new SlowWire(server));
    expect(returned.tick).toBe(server.state.tick);
    returned.report(home);
    await returned.flushMoves();
    expect(server.state.player.at).toEqual(home);
    expect(returned.connected).toBe(true);
  });

  test('a player back while work is still under way is not sent ahead of the server\'s clock', async () => {
    const { server } = await started();
    // work of 30 s began at the state's tick, and the player is back 1 s later (the wall clock barely moved)
    server.state.player.busyUntil = server.state.tick + 30_000;
    const returned = await RemoteSession.join(bundle, new SlowWire(server));
    expect(returned.tick).toBe(server.state.tick);
    expect(returned.busy).toBe(true);
    const answered = await returned.act({ t: 'carve', name: 'Tess' });
    expect(answered).not.toEqual({ ok: false, error: 'That game time is ahead of the time elapsed.' });
  });

  test('a resume after a dropped line never moves the clock backwards', async () => {
    const clock = { now: 0 };
    const { server, remote } = await started(clock);
    clock.now = 60_000;
    remote.tick = 60_000;
    server.gap = true;
    await remote.act({ t: 'carve', name: 'Tess' });
    // another device played on meanwhile: the server's clock is now ahead of the phone's
    server.state.tick += 120_000;
    server.gap = false;
    await remote.resumeFromServer();
    expect(remote.tick).toBeGreaterThanOrEqual(60_000);
    expect(remote.tick).toBeGreaterThanOrEqual(server.state.tick);
    expect(remote.tick).toBeGreaterThanOrEqual(server.state.player.busyUntil);
  });
});

describe('the remote session: one call at a time', () => {
  test('three flushers and an action never put two calls on the wire, and every move lands', async () => {
    const { local, server, wire, remote } = await started();
    const route = workNearby(local).route;
    remote.report(route[0]!);
    const answers = await Promise.all([
      remote.flushMoves(),
      remote.flushMoves(),
      remote.flushMoves(),
      remote.act({ t: 'eat', item: 'core/not-a-thing' }),
    ]);
    expect(wire.mostInFlight).toBe(1);
    // the action is refused for its own reason, never because a flusher left it a stale version
    const act = answers[3] as ActResult;
    expect(act.ok === false && /state changed/.test(act.error)).toBe(false);
    expect(server.state.player.at).toEqual(route[0]);
    expect(remote.version).toBe(server.version);
  });

  test('a second action waits for the first, and both name the version they find', async () => {
    const { server, wire, remote } = await started();
    const both = await Promise.all([
      remote.act({ t: 'eat', item: 'core/not-a-thing' }),
      remote.act({ t: 'eat', item: 'core/not-a-thing' }),
    ]);
    expect(wire.mostInFlight).toBe(1);
    for (const answer of both) expect(answer.ok === false && /state changed/.test(answer.error)).toBe(false);
    expect(remote.version).toBe(server.version);
    expect(remote.waiting).toBe(false);
  });

  test('a tile reported while an action is in flight is kept, not dropped', async () => {
    const { local, server, remote } = await started();
    const route = workNearby(local).route;
    const acting = remote.act({ t: 'eat', item: 'core/not-a-thing' });
    remote.report(route[0]!);
    await Promise.all([remote.flushMoves(), acting]);
    expect(server.state.player.at).toEqual(route[0]);
  });

  test('a batch that fills sends once and the rest follows behind it', async () => {
    const { local, server, wire, remote } = await started();
    const away = workNearby(local).route[0]!;
    // 300 reports: more than one batch, all sent in order, one call at a time
    for (let i = 0; i < 300; i++) remote.report(away);
    await remote.flushMoves();
    expect(wire.mostInFlight).toBe(1);
    expect(server.calls.filter((c) => c.path === '/moves').length).toBe(2);
  });

  test('a real conflict drops the walk, takes the server tile back and the next action goes through', async () => {
    const { local, server, remote } = await started();
    const home = [...remote.pos];
    const first = workNearby(local).route[0]!;
    // the scene moves the player and reports the tile; another device wins the version meanwhile
    remote.pos = [first[0], first[1]];
    remote.report(first);
    server.version += 1;
    await remote.flushMoves();
    expect(remote.version).toBe(server.version);
    expect(remote.pos).toEqual(home);
    expect(remote.pos).toEqual([server.state.player.at[0], server.state.player.at[1]]);
    const answered = await remote.act({ t: 'eat', item: 'core/not-a-thing' });
    expect(answered.ok === false && /state changed/.test(answered.error)).toBe(false);
  });
});

describe('the remote session: another device moved the state on', () => {
  test('an action refused as stale reads the state again, so the next one names the new version', async () => {
    const { server, remote } = await started();
    server.version += 1;
    const first = await remote.act({ t: 'carve', name: 'Tess' });
    expect(first).toEqual({ ok: false, error: 'The game state changed; resume before sending another action.' });
    expect(remote.version).toBe(server.version);
    const second = await remote.act({ t: 'carve', name: 'Tess' });
    expect(second.ok === false && /state changed/.test(second.error)).toBe(false);
  });
});

describe('the remote session: the 409 code, not only its words', () => {
  const STALE_WORDS = 'The game state changed; resume before sending another action.';

  test('an old server that sends the words and no code still gets its state read again', async () => {
    const { server, remote } = await started();
    server.noReasons = true;
    server.version += 1;
    server.calls.length = 0;
    const stale = await remote.act({ t: 'carve', name: 'Tess' });
    expect(stale).toEqual({ ok: false, error: STALE_WORDS });
    expect(server.calls.map((call) => call.path)).toEqual(['/action', '/state']);
    expect(remote.version).toBe(server.version);
  });

  test('a code that is not stale is believed over the words, and the state is not read again', async () => {
    const local = Session.fresh(bundle);
    const server = new FakeServer(bundle, local.state);
    const honouring = new SlowWire(server);
    // the same wire, with a step's own code on the answer that carries the stale words
    const rewrite = (error: unknown): never => {
      if (error instanceof WireRefusal && error.status === 409) throw new WireRefusal(error.message, 409, 'refused');
      throw error;
    };
    const lying: Wire = {
      post: ((path: string, body: unknown) => honouring.post(path as '/action', body).catch(rewrite)) as Wire['post'],
      get: (path) => honouring.get(path),
    };
    const remote = await RemoteSession.join(bundle, lying);
    await remote.act({ t: 'start', starter: 'core/forager', name: 'Tess' });
    server.calls.length = 0;
    server.version += 1;

    const refused = await remote.act({ t: 'carve', name: 'Tess' });
    expect(refused).toEqual({ ok: false, error: STALE_WORDS });
    expect(server.calls.map((call) => call.path)).toEqual(['/action']);
  });

  test('the reason reaches a WireRefusal through fetchWire, not only through a fake wire', async () => {
    const answer = () => new Response(JSON.stringify({ error: STALE_WORDS, reason: 'stale' }), { status: 409 });
    const wire = fetchWire('', (async () => answer()) as typeof fetch);
    const refusal = await wire.post('/action', { version: 1 }).catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(WireRefusal);
    expect((refusal as WireRefusal).reason).toBe('stale');
    expect((refusal as WireRefusal).message).toBe(STALE_WORDS);
  });
});

describe('the remote session: a failed resume', () => {
  test('stays closed, says so with one change, and reports the error', async () => {
    const { server, remote } = await started();
    server.gap = true;
    await remote.act({ t: 'carve', name: 'Tess' });
    expect(remote.connected).toBe(false);

    let changes = 0;
    remote.on('change', () => (changes += 1));
    await expect(remote.resumeFromServer()).rejects.toThrow();
    expect(remote.connected).toBe(false);
    expect(remote.paused).toBe(true);
    expect(changes).toBe(1);

    server.gap = false;
    await remote.resumeFromServer();
    expect(remote.connected).toBe(true);
  });

  test('a walk refused while the resume then fails leaves the session closed', async () => {
    const { server, remote } = await started();
    const [x, y] = remote.pos;
    remote.report([x + 8, y]);
    // the walk is refused as too far, and the resume that follows it finds the line down
    server.get = async () => {
      throw new WireGap('Waiting for the connection');
    };
    await remote.flushMoves().catch(() => undefined);
    expect(remote.connected).toBe(false);
  });
});

describe('the remote session: a fire going out is told', () => {
  /** The fire the long night tends, read from the content: a map fire or the player's own. */
  function tended(): string {
    const step = bundle.quests['core/the-long-night']!.steps.find((st) => st.kind === 'tend');
    if (step?.kind !== 'tend') throw new Error('The long night tends no fire.');
    return step.fire;
  }

  /** A started game at `lit`, with the fire the long night tends burning out at `until` and that quest open. */
  async function burning(lit: number, until: number) {
    const clock = { now: 0 };
    const game = await started(clock);
    const { server, remote } = game;
    const fire = tended();
    server.state.tick = lit;
    server.state.player.quests['core/the-long-night'] = 'active';
    if (fire === OWN_FIRE) server.state.player.own = { lit, until, at: [remote.pos[0] + 1, remote.pos[1]], log: until - lit };
    else server.state.player.fires = { [fire]: { lit, until } };
    await remote.resumeFromServer();
    server.calls.length = 0;
    return { ...game, fire };
  }

  test('a burn that runs out in the night is reported once, and its fire_out reaches the screens', async () => {
    const dusk = lastDusk(bundle, bundle.params.day_length_ms * 3);
    const { server, remote, clock, fire } = await burning(dusk - 1_000, dusk + 5_000);
    const told: GameEvent[] = [];
    remote.on('events', (events) => told.push(...events));
    for (let i = 0; i < 60; i++) {
      remote.advance(250);
      clock.now += 250;
    }
    await remote.flushMoves();
    const moves = server.calls.filter((c) => c.path === '/moves');
    expect(moves.length).toBe(1);
    const body = moves[0]!.body as { moves: { at: Tile }[] };
    expect(body.moves.at(-1)!.at).toEqual([...remote.pos]);
    expect(told).toContainEqual({ e: 'fire_out', id: fire });
  });

  test('a burn whose report was lost to a dropped line is asked about again after the resume', async () => {
    const dusk = lastDusk(bundle, bundle.params.day_length_ms * 3);
    const { server, remote, clock, fire } = await burning(dusk - 1_000, dusk + 5_000);
    const told: GameEvent[] = [];
    remote.on('events', (events) => told.push(...events));
    server.gap = true;
    for (let i = 0; i < 40 && remote.connected; i++) {
      remote.advance(250);
      clock.now += 250;
      await remote.flushMoves();
    }
    expect(remote.connected).toBe(false);
    server.gap = false;
    await remote.resumeFromServer();
    remote.advance(250);
    clock.now += 250;
    await remote.flushMoves();
    expect(told).toContainEqual({ e: 'fire_out', id: fire });
  });

  test('the player\'s own fire running out is asked about the same way', async () => {
    const { server, remote, clock } = await started();
    server.state.player.own = { lit: 0, until: 5_000, at: [remote.pos[0] + 1, remote.pos[1]], log: 5_000 };
    await remote.resumeFromServer();
    server.calls.length = 0;
    for (let i = 0; i < 40; i++) {
      remote.advance(250);
      clock.now += 250;
    }
    await remote.flushMoves();
    expect(server.calls.filter((c) => c.path === '/moves').length).toBe(1);
  });
});

describe('the remote session: the valley was updated (the server adapts a stored state, #490)', () => {
  class Seen {
    readonly values = new Map<string, string>();
    getItem(key: string): string | null {
      return this.values.get(key) ?? null;
    }
    setItem(key: string, value: string): void {
      this.values.set(key, value);
    }
  }

  async function joined(seen: Seen) {
    const local = Session.fresh(bundle);
    const server = new FakeServer(bundle, local.state);
    expect((await (await RemoteSession.join(bundle, server, seen)).act({ t: 'start', starter: 'core/forager', name: 'Tess' })).ok).toBe(true);
    return server;
  }

  test('says so once when the server answers other content than this browser last showed, and never on a first visit', async () => {
    const seen = new Seen();
    const server = await joined(seen);
    const first = await RemoteSession.join(bundle, server, seen);
    expect(first.adapted).toBe(false);
    // the title's probe joins without showing the world: nothing is noted until a frame runs
    expect(seen.values.size).toBe(0);
    first.advance(16);
    expect([...seen.values.values()]).toEqual([server.state.content]);

    // the server was updated and brought the state to its content
    server.state.content = 'a-newer-world';
    const back = await RemoteSession.join(bundle, server, seen);
    expect(back.adapted).toBe(true);
    back.advance(16);
    expect((await RemoteSession.join(bundle, server, seen)).adapted).toBe(false);
  });

  test('says so while the game is open when a state read again comes under other content', async () => {
    const seen = new Seen();
    const server = await joined(seen);
    const remote = await RemoteSession.join(bundle, server, seen);
    let updated = 0;
    remote.on('updated', () => updated++);
    // the server restarted on new content and adapted the state: the walk names the old version and is read again
    server.state.content = 'a-newer-world';
    server.version += 1;
    const [x, y] = remote.state.player.at;
    remote.report([x + 1, y]);
    await remote.flushMoves();
    expect(remote.state.content).toBe('a-newer-world');
    expect(updated).toBe(1);
    // a re-read under the same content says nothing
    await remote.resumeFromServer();
    expect(updated).toBe(1);
  });

  test('a browser whose storage is blocked plays on and says nothing', async () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    const server = await joined(new Seen());
    const remote = await RemoteSession.join(bundle, server, blocked);
    expect(remote.adapted).toBe(false);
    expect(() => remote.advance(16)).not.toThrow();
  });
});
