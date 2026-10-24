import { beforeAll, describe, expect, test } from 'vitest';
import type { Bundle } from '@game/kernel';
import { newState, publicState, step, serialize } from '@game/kernel';

import { joinRemote } from '../src/app';
import { WireGap } from '../src/remote';
import { Session } from '../src/session';
import { titleActions } from '../src/ui/title';
import { loadBundle } from '../../tools/test/helpers/world';
import { FakeAuthServer } from './fake-auth';
import { FakeServer } from './fake-server';

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

function begun(seed: number): Session {
  const session = Session.fresh(bundle, seed);
  expect(session.act({ t: 'start', race: 'core/elf', name: 'Tess' }).ok).toBe(true);
  return session;
}

/** Walk the player a tile at a time, as the world reports it. */
function walk(session: Session, tiles: number): void {
  for (let i = 0; i < tiles; i += 1) {
    session.tick += bundle.params.walk_step_ms;
    const [x, y] = session.state.player.at;
    for (const next of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as [number, number][]) {
      if (session.check({ t: 'move', at: next }) === undefined && session.state.player.at.join() !== next.join()) {
        session.report(next);
        break;
      }
    }
  }
}

describe('joining the game behind the server URL (NEXT 18 e)', () => {
  test('joinRemote sends one empty POST /session on the server URL and plays the state it answers', async () => {
    const wire = new FakeServer(bundle, newState(bundle, 3));
    const calls: { input: string; init: RequestInit }[] = [];
    const send = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input: String(input), init: init ?? {} });
      return new Response(JSON.stringify({ state: publicState(wire.state), version: wire.version, appears: [] }), { status: 200 });
    }) as typeof fetch;
    const remote = await joinRemote(bundle, 'https://play.example', send);
    expect(remote).toBeDefined();
    expect(remote!.state).toEqual(publicState(wire.state));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.input).toBe('https://play.example/session');
    expect(calls[0]!.init.method).toBe('POST');
    expect(calls[0]!.init.credentials).toBe('same-origin');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({});
  });

  test('an empty server URL joins the game on its own origin', async () => {
    const wire = new FakeServer(bundle, newState(bundle, 3));
    const inputs: string[] = [];
    const send = (async (input: RequestInfo | URL) => {
      inputs.push(String(input));
      return new Response(JSON.stringify({ state: publicState(wire.state), version: wire.version, appears: [] }), { status: 200 });
    }) as typeof fetch;
    const remote = await joinRemote(bundle, '', send);
    expect(remote).toBeDefined();
    expect(inputs).toEqual(['/session']);
  });

  test('a 401 (not signed in) and a 404 (no game yet) mean no remote session', async () => {
    const signedOut = (async () => new Response(JSON.stringify({ error: 'Sign in to continue.' }), { status: 401 })) as typeof fetch;
    await expect(joinRemote(bundle, '', signedOut)).resolves.toBeUndefined();
    const noGame = (async () => new Response(JSON.stringify({ error: 'No game state exists for this account.' }), { status: 404 })) as typeof fetch;
    await expect(joinRemote(bundle, '', noGame)).resolves.toBeUndefined();
  });

  test('a dropped line throws, so the title says so instead of playing on without the server', async () => {
    const dropped = (async () => {
      throw new TypeError('failed');
    }) as typeof fetch;
    await expect(joinRemote(bundle, '', dropped)).rejects.toBeInstanceOf(WireGap);
  });
});

describe("the title screen's sign-in (the screen logic)", () => {
  test('the demo build: no sign-in button, the demo note, New game from a save or not', () => {
    expect(titleActions({ server: false, hasSave: false, signedIn: false, started: false })).toEqual({
      canContinue: false,
      newGame: true,
      signIn: false,
      note: 'Demo: your progress is saved in this browser only, and will not move to an account later.',
    });
    expect(titleActions({ server: false, hasSave: true, signedIn: false, started: false }).canContinue).toBe(true);
  });

  test('a server build without a sign-in offers the sign-in button and says where progress lives', () => {
    const actions = titleActions({ server: true, hasSave: true, signedIn: false, started: false });
    expect(actions).toEqual({
      canContinue: true,
      newGame: true,
      signIn: true,
      note: 'Sign in to keep your valley. Until then your progress is saved in this browser.',
    });
  });

  test("a signed-in account continues the server's game, and cannot start a second one", () => {
    const actions = titleActions({ server: true, hasSave: false, signedIn: true, started: true });
    expect(actions).toEqual({ canContinue: true, newGame: false, signIn: false, note: 'Your game lives on the server and comes with you.' });
  });

  test('a signed-in account with no game yet starts a new one', () => {
    const actions = titleActions({ server: true, hasSave: false, signedIn: true, started: false });
    expect(actions).toEqual({ canContinue: false, newGame: true, signIn: false, note: 'Your game lives on the server and comes with you.' });
  });
});

describe('the fake sign-in server (NEXT 18 d handover, on the fake)', () => {
  // 1 June 2026: a fixed "today" for the age gate
  const NOW = Date.UTC(2026, 5, 1);
  const SECRET = 11;

  test('an opening the replay confirms is kept: the account plays it under the secret seed', () => {
    const auth = new FakeAuthServer(bundle, { now: () => NOW, secretSeed: () => SECRET });
    const session = begun(123);
    walk(session, 12);
    const upload = session.openingUpload()!;
    // the phone's log plays from its seed to its state, as the server replays it
    let state = newState(bundle, upload.seed);
    for (const { a, tick } of upload.log) {
      const result = step(bundle, state, a, tick);
      if (!result.ok) throw new Error(result.error);
      state = result.state;
    }
    expect(serialize(state)).toBe(upload.state);

    auth.ticket = 'tess@example.com';
    const answer = auth.signup({ name: 'Tess', birthDate: '2000-05-07', oneAccount: true, opening: upload });
    expect(answer.status).toBe(201);
    expect(answer.body).toEqual({ name: 'Tess', opening: 'kept' });
    expect(auth.signedIn).toBe(true);
    expect(auth.account).toEqual({ email: 'tess@example.com', name: 'Tess' });
    // the kept opening is the account's game, under a seed the phone never saw
    expect(auth.wire.state.player.name).toBe('Tess');
    expect(auth.wire.state.seed).toBe(SECRET);
  });

  test('a log the replay cannot confirm starts the account fresh, with the one-line answer the screen reads', () => {
    const auth = new FakeAuthServer(bundle, { now: () => NOW, secretSeed: () => SECRET });
    const session = begun(456);
    walk(session, 8);
    const upload = session.openingUpload()!;
    // tamper with the last step: the replay no longer lands on the phone's state
    const last = upload.log[upload.log.length - 1]!;
    upload.log[upload.log.length - 1] = { a: { ...last.a, at: [999, 999] } as typeof last.a, tick: last.tick };

    auth.ticket = 'tess@example.com';
    const answer = auth.signup({ name: 'Tess', birthDate: '2000-05-07', oneAccount: true, opening: upload });
    expect(answer.status).toBe(201);
    expect(answer.body).toEqual({ name: 'Tess', opening: 'fresh' });
    expect(auth.wire.state.seed).toBe(SECRET);
    expect(auth.wire.state.player.race).toBe('');
  });

  test('a date under the consent age is refused whole and points to the demo, which stays open', () => {
    const auth = new FakeAuthServer(bundle, { now: () => NOW, secretSeed: () => SECRET });
    auth.ticket = 'kid@example.com';
    const answer = auth.signup({ name: 'Kid', birthDate: '2015-01-01', oneAccount: true });
    expect(answer.status).toBe(403);
    expect(answer.body).toEqual({
      error: 'You cannot make an Openfold account. The demo stays open to you.',
      reason: 'under-age',
      demo: '/',
    });
    expect(auth.signedIn).toBe(false);
    // the ticket ends with the refusal, as the real one does
    expect(auth.ticket).toBeUndefined();
  });

  test('the wire answers 401 while the browser is not signed in', async () => {
    const auth = new FakeAuthServer(bundle, { now: () => NOW });
    const reply = (await fakeFetch(auth, '/session', '{}'))!;
    expect(reply.status).toBe(401);
    expect(await reply.json()).toEqual({ error: 'Sign in to continue.' });
  });
});

/** One request against the fake, as the game's fetch sends it. */
async function fakeFetch(auth: FakeAuthServer, path: string, body: string): Promise<Response> {
  const { createServer } = await import('node:http');
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    void auth
      .handle(request, response, url)
      .then((handled) => {
        if (!handled) {
          response.writeHead(404);
          response.end();
        }
      })
      .catch(() => {
        response.writeHead(500);
        response.end();
      });
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    return await fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', body });
  } finally {
    server.close();
  }
}
