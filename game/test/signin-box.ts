/**
 * The one-origin box in a test (DECISIONS 2026-10-27): the real sign-in, `createSignIn` from
 * `server/src/auth/signin.ts`, standing in front of the game wire `FakeServer` offers, on the one origin the
 * game itself is served from (`publicOrigin` and `appOrigin` are the same). Nothing of the sign-in is
 * restated here: the store is the sign-in tests' `MemoryAuthStore`, the mail goes to an outbox the test reads,
 * Google's token and key endpoints answer from `FakeGoogle`, and the clock is the test's.
 *
 * The wire is gated as the API gates it: it answers only the account the request's session cookie stands
 * for (`SignIn.resolve`, which also refuses a POST from another origin), and that account plays the game its
 * sign-up made, read from the store's row. `seen` keeps what the browser actually sent and was answered, so a
 * test asserts on the Origin a real browser chose and the account its cookie resolved to, never on a cookie
 * read by script (it is httpOnly).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { widenSeed, type Bundle, type Seed } from '@game/kernel';

import { googleProvider } from '../../server/src/auth/google';
import type { Mail } from '../../server/src/auth/mailer';
import { createSignIn, type SignIn } from '../../server/src/auth/signin';
import { CLIENT_ID, CLIENT_SECRET, FakeGoogle, MemoryAuthStore } from '../../server/test/support/auth';
import { WireRefusal } from '../src/remote';
import { FakeServer } from './fake-server';

export interface SignInBoxOptions {
  /** the server's clock, in ms: the sign-in's links, tickets and age gate, and the wire's clock checks read it */
  now?: () => number;
  /** the secret seed an account's game runs under; fixed so a test can name it */
  secretSeed?: () => Seed;
}

/** One request the box answered: what the browser sent and what it was told. */
export interface Seen {
  method: string;
  path: string;
  /** the Origin header the browser sent, if any */
  origin?: string;
  status: number;
  location?: string;
  /** on the wire, the account the session cookie resolved to */
  account?: string;
}

const WIRE = new Set(['/session', '/state', '/action', '/moves']);
/**
 * Google's consent screen, played by the box. The browser is sent here with the very query the real
 * provider builds for Google, and comes back to the real callback with a code; the code's exchange and the
 * id token's checks are the real provider's, against `FakeGoogle`.
 */
export const GOOGLE_CONSENT = '/fake-google/authorize';

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

/** Where a response sends the browser: the headers `writeHead` is given never show in `getHeader`. */
function watchLocation(response: ServerResponse): () => string | undefined {
  let location: string | undefined;
  const writeHead = response.writeHead.bind(response) as (...args: unknown[]) => ServerResponse;
  (response as { writeHead: unknown }).writeHead = (...args: unknown[]) => {
    for (const arg of args.slice(1)) {
      if (typeof arg === 'object' && arg !== null && !Array.isArray(arg) && typeof (arg as Record<string, unknown>).location === 'string') {
        location = (arg as Record<string, string>).location;
      }
    }
    return writeHead(...args);
  };
  return () => location;
}

export class SignInBox {
  readonly store = new MemoryAuthStore();
  /** every mail the sign-in sent, in order */
  readonly outbox: Mail[] = [];
  readonly google = new FakeGoogle();
  /** each account's game on the wire, made from its sign-up's row the first time it is asked for */
  readonly wires = new Map<string, FakeServer>();
  readonly seen: Seen[] = [];

  private signIn?: SignIn;
  private readonly now: () => number;
  private readonly secretSeed: () => Seed;

  constructor(
    private readonly bundle: Bundle,
    options: SignInBoxOptions = {},
  ) {
    this.now = options.now ?? (() => 0);
    this.secretSeed = options.secretSeed ?? (() => widenSeed(7));
    this.google.clock = this.now;
  }

  /** The sign-in on the origin the box's server listens on: the API and the game are that one origin. */
  open(origin: string): void {
    const google = googleProvider({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, fetch: this.google.fetch });
    this.signIn = createSignIn({
      store: this.store,
      bundle: this.bundle,
      newSeed: this.secretSeed,
      mailer: { name: 'outbox', send: (mail) => Promise.resolve(void this.outbox.push(mail)) },
      google: { ...google, authorizeUrl: (request) => `${origin}${GOOGLE_CONSENT}${new URL(google.authorizeUrl(request)).search}` },
      publicOrigin: origin,
      appOrigin: origin,
      now: this.now,
    });
  }

  /** The link the last mail to an address carries, as the player opens it from the mail. */
  linkFor(email: string): string | undefined {
    const mail = this.outbox.findLast((sent) => sent.to === email);
    return mail === undefined ? undefined : /https?:\/\/\S+/.exec(mail.text)?.[0];
  }

  /** The account made for an address, with its id. */
  account(email: string): { id: string; name: string; email: string } | undefined {
    for (const [id, account] of this.store.accounts) if (account.email === email) return { id, name: account.name, email: account.email };
    return undefined;
  }

  /** The requests seen on a path, in order. */
  seenOn(method: string, path: string): Seen[] {
    return this.seen.filter((entry) => entry.method === method && entry.path === path);
  }

  /** One request: the wire, Google's consent screen, or the sign-in's `/auth/` routes; false for anything else. */
  async handle(request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean> {
    const signIn = this.signIn;
    if (!signIn) throw new Error('open the box on its origin first');
    const method = request.method ?? 'GET';
    const origin = typeof request.headers.origin === 'string' ? request.headers.origin : undefined;
    const location = watchLocation(response);
    let account: string | undefined;
    if (WIRE.has(url.pathname)) {
      account = await signIn.resolve(request);
      await this.wire(request, response, url, account);
    } else if (url.pathname === GOOGLE_CONSENT && method === 'GET') {
      this.consent(response, url);
    } else if (!(await signIn.handle(request, response, url))) {
      return false;
    }
    const sentTo = location();
    this.seen.push({ method, path: url.pathname, origin, status: response.statusCode, ...(sentTo ? { location: sentTo } : {}), ...(account ? { account } : {}) });
    return true;
  }

  /** The player says yes on Google's screen: back to the callback with a code, as Google sends them. */
  private consent(response: ServerResponse, url: URL): void {
    const state = url.searchParams.get('state') ?? '';
    // the id token Google will sign carries the nonce the flow sent
    this.google.nonce = url.searchParams.get('nonce') ?? '';
    const back = new URL(url.searchParams.get('redirect_uri') ?? '/');
    back.search = new URLSearchParams({ code: 'consented', state }).toString();
    response.writeHead(302, { location: back.toString(), 'cache-control': 'no-store' });
    response.end();
  }

  private async wire(request: IncomingMessage, response: ServerResponse, url: URL, account: string | undefined): Promise<void> {
    if (url.search) return json(response, 400, { error: 'This endpoint does not accept a query string.' });
    if (!account) return json(response, 401, { error: 'Sign in to continue.' });
    let wire = this.wires.get(account);
    if (!wire) {
      const game = this.store.games.get(account);
      if (!game) return json(response, 404, { error: 'No game state exists for this account.' });
      wire = new FakeServer(this.bundle, game.record.state, this.now);
      this.wires.set(account, wire);
    }
    let body: unknown = {};
    if (request.method === 'POST') {
      try {
        body = JSON.parse(await readBody(request)) as unknown;
      } catch {
        return json(response, 400, { error: 'The request is not valid JSON.' });
      }
    }
    try {
      const reply =
        url.pathname === '/state'
          ? await wire.get('/state')
          : url.pathname === '/session'
            ? await wire.post('/session', body)
            : await wire.post(url.pathname as '/action' | '/moves', body);
      json(response, 200, reply);
    } catch (error) {
      if (!(error instanceof WireRefusal)) throw error;
      json(response, error.status, { error: error.message, reason: error.reason });
    }
  }
}
