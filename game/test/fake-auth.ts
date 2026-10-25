/**
 * A server in the test with the sign-in the real server runs (NEXT 18 e): the account routes of
 * `server/src/auth/*` standing in front of the game wire `FakeServer` offers, so a browser can be driven
 * through Google, an email link and the neutral age screen without a provider or a database. Where a rule
 * has its own test on the server, the fake answers by the server's own function instead of a copy: the
 * opening is handed over with `takeOpening` (replayed under the secret seed, and a log the replay cannot
 * confirm starts the account fresh), and the age gate is the real `ageGate`.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Bundle } from '@game/kernel';
import { newState } from '@game/kernel';

import { ageGate, parseBirthDate } from '../../server/src/auth/age';
import { takeOpening } from '../../server/src/handover';
import { WireRefusal } from '../src/remote';
import { FakeServer } from './fake-server';

export interface FakeAuthOptions {
  /** the server's clock, in ms; the age gate and the wire's clock checks read it */
  now?: () => number;
  /** the secret seed an account's game runs under; fixed so a test can name it */
  secretSeed?: () => number;
}

export interface SignupReply {
  name?: string;
  opening?: 'kept' | 'fresh';
  error?: string;
  reason?: string;
  demo?: string;
}

/** the identity Google's fake OAuth round proves */
const GOOGLE = { provider: 'google' as const, subject: 'google-1', email: 'google@example.com' };
const NAME = /^[A-Za-z0-9 _-]{1,16}$/;

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

export class FakeAuthServer {
  /** the game wire the account routes stand in front of */
  readonly wire: FakeServer;
  /** the one account this fake keeps; undefined until a sign-up lands */
  account?: { email: string; name: string };
  /** the address a sign-up ticket waits for: Google or an email link that named no account */
  ticket?: string;
  /** an email link sent and not yet used: token -> email */
  readonly links = new Map<string, string>();
  /** true while a session cookie is set */
  signedIn = false;

  private readonly bundle: Bundle;
  private readonly now: () => number;
  private readonly secretSeed: () => number;
  private nextLink = 1;

  constructor(bundle: Bundle, options: FakeAuthOptions = {}) {
    this.bundle = bundle;
    this.now = options.now ?? (() => 0);
    this.secretSeed = options.secretSeed ?? (() => 7);
    this.wire = new FakeServer(bundle, newState(bundle, this.secretSeed()), this.now);
  }

  /**
   * The sign-up itself, as `/auth/signup` answers it: the name, the date and the one-account yes; the
   * real age gate; and the real opening handover under the secret seed. A success signs the browser in.
   */
  signup(body: Record<string, unknown>): { status: number; body: SignupReply } {
    if (!this.ticket) return { status: 401, body: { error: 'Sign in again to make your account.', reason: 'no-signup' } };
    const email = this.ticket;
    if (body.oneAccount !== true) return { status: 400, body: { error: 'One person, one account in a world: agree to it to make your account.' } };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!NAME.test(name)) return { status: 400, body: { error: 'A name is 1 to 16 letters, digits, spaces, "_" or "-".' } };
    const birth = parseBirthDate(body.birthDate, this.now());
    if (!birth) return { status: 400, body: { error: 'Give the day you were born.' } };
    const gate = ageGate(birth, undefined, this.now());
    if ('underAge' in gate) {
      // the ticket ends with the refusal, as the real one does
      this.ticket = undefined;
      return { status: 403, body: { error: 'You cannot make an Openfold account. The demo stays open to you.', reason: 'under-age', demo: '/' } };
    }
    const handover = takeOpening(this.bundle, body.opening, this.secretSeed(), this.now());
    this.wire.state = handover.record.state;
    this.wire.version = 1;
    this.account = { email, name };
    this.ticket = undefined;
    this.signedIn = true;
    return { status: 201, body: { name, opening: handover.kept ? 'kept' : 'fresh' } };
  }

  /** Where a proven identity leads, as the OAuth and email callbacks answer: the account, or a sign-up ticket. */
  arrive(email: string): 'ok' | 'signup' {
    if (this.account && this.account.email === email) {
      this.signedIn = true;
      return 'ok';
    }
    this.ticket = email;
    return 'signup';
  }

  /** An email link, as the email start route answers it; the returned token is the one the mail would carry. */
  emailStart(email: string): string {
    const token = `link-${this.nextLink++}`;
    this.links.set(token, email);
    return token;
  }

  /** The token of the link sent to an address, for a test to open it the way the mail's link would. */
  linkFor(email: string): string | undefined {
    for (const [token, address] of this.links) if (address === email) return token;
    return undefined;
  }

  /**
   * One request, answered in place when it is the fake's: the game wire (with a 401 while not signed in)
   * and the account routes. Returns true when answered; a static server answers the rest.
   */
  async handle(request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean> {
    const method = request.method ?? 'GET';
    const json = (status: number, body: unknown, extra: Record<string, string> = {}): void => {
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...extra });
      response.end(JSON.stringify(body));
    };
    const redirect = (status: number, location: string, extra: Record<string, string> = {}): void => {
      response.writeHead(status, { location, ...extra });
      response.end();
    };
    const sessionCookie = { 'set-cookie': 'openfold_session=fake; Path=/; HttpOnly; SameSite=Lax' };

    // the game wire: nothing answers while the browser is not signed in
    if (url.pathname === '/session' || url.pathname === '/state' || url.pathname === '/action' || url.pathname === '/moves') {
      if (url.search || url.hash) {
        json(400, { error: 'This endpoint does not accept a query string.' });
        return true;
      }
      if (!this.signedIn) {
        json(401, { error: 'Sign in to continue.' });
        return true;
      }
      let body: unknown;
      try {
        body = JSON.parse(await readBody(request)) as unknown;
      } catch {
        body = {};
      }
      try {
        const reply =
          url.pathname === '/state'
            ? await this.wire.get('/state')
            : url.pathname === '/session'
              ? await this.wire.post('/session', body)
              : url.pathname === '/action'
                ? await this.wire.post('/action', body)
                : await this.wire.post('/moves', body);
        json(200, reply);
      } catch (error) {
        if (error instanceof WireRefusal) json(error.status, { error: error.message, reason: error.reason });
        else throw error;
      }
      return true;
    }

    if (url.pathname === '/auth/google/start' && method === 'GET') {
      // the fake OAuth round: straight back to the callback, as Google would come back with a code
      redirect(302, '/auth/google/callback?code=fake&state=fake');
      return true;
    }
    if (url.pathname === '/auth/google/callback' && method === 'GET') {
      const outcome = this.arrive(GOOGLE.email);
      redirect(303, `/#signin=${outcome}`, outcome === 'ok' ? sessionCookie : {});
      return true;
    }
    if (url.pathname === '/auth/email/start' && method === 'POST') {
      const body = JSON.parse(await readBody(request)) as { email?: unknown };
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (email === '') {
        json(400, { error: 'Give an email address.' });
        return true;
      }
      this.emailStart(email);
      json(200, {});
      return true;
    }
    if (url.pathname === '/auth/email/link' && method === 'GET') {
      const token = url.searchParams.get('token') ?? '';
      if (!this.links.has(token)) {
        json(400, { error: 'That sign-in link is not one this server sent.' });
        return true;
      }
      const html =
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Openfold sign-in</title>' +
        `<form method="post" action="/auth/email/confirm"><input type="hidden" name="token" value="${token}"><button type="submit">Sign in to Openfold</button></form></html>`;
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(html);
      return true;
    }
    if (url.pathname === '/auth/email/confirm' && method === 'POST') {
      const token = new URLSearchParams(await readBody(request)).get('token') ?? '';
      const email = this.links.get(token);
      if (!email) {
        json(400, { error: 'That sign-in link is not one this server sent.' });
        return true;
      }
      this.links.delete(token);
      const outcome = this.arrive(email);
      redirect(303, `/#signin=${outcome}`, outcome === 'ok' ? sessionCookie : {});
      return true;
    }
    if (url.pathname === '/auth/signup') {
      if (method === 'GET') {
        if (!this.ticket) {
          json(401, { error: 'Sign in again to make your account.', reason: 'no-signup' });
          return true;
        }
        json(200, { email: this.ticket });
        return true;
      }
      if (method === 'POST') {
        const body = JSON.parse(await readBody(request)) as Record<string, unknown>;
        const answer = this.signup(body);
        json(answer.status, answer.body, answer.status === 201 ? sessionCookie : {});
        return true;
      }
    }
    return false;
  }
}
