import { randomInt } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Bundle } from '@game/kernel';

import { takeOpening } from '../handover';

import { ageGate, parseBirthDate } from './age';
import { AGE_COOKIE, clearCookie, cookie, FLOW_COOKIE, readCookie, SESSION_COOKIE, SIGNUP_COOKIE } from './cookies';
import type { Mailer } from './mailer';
import { SignInRefusal, type OAuthProvider, type ProvenIdentity } from './provider';
import { CLOSED_ACCOUNT_GRACE_MS, type AuthStore } from './store';
import { isToken, newToken, pkceChallenge, sameSecret, tokenHash } from './tokens';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const FLOW_TTL_MS = 10 * MINUTE;
const LINK_TTL_MS = 15 * MINUTE;
const TICKET_TTL_MS = 30 * MINUTE;
const SESSION_TTL_MS = 30 * 24 * 60 * MINUTE;
/** how long a browser that was refused for its age is refused a new date (the neutral age screen) */
const AGE_REFUSAL_TTL_MS = 24 * 60 * MINUTE;
/** links sent to one address within a link's life; past it the request is answered the same and nothing is sent */
const LINKS_PER_ADDRESS = 3;
const SWEEP_EVERY_MS = MINUTE;
const BODY_LIMIT = 4 * 1024;
/** the sign-up carries the opening the phone played: up to 2000 steps and the state they end on (NEXT 18 d) */
const SIGNUP_BODY_LIMIT = 512 * 1024;
/** the kernel's rule for a name (kernel/src/step.ts, checkName): the world shows the same name it played with */
const NAME = /^[A-Za-z0-9 _-]{1,16}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTRY = /^[A-Z]{2}$/;

export interface SignInOptions {
  store: AuthStore;
  /** the world the sign-up replays a handed-over opening in (NEXT 18 d) */
  bundle: Bundle;
  /** the account's secret seed; a test passes its own */
  newSeed?: () => number;
  mailer: Mailer;
  /** Google, when its client id and secret are set; Discord is a slot that is not open yet */
  google?: OAuthProvider;
  /** the origin this API answers on: the OAuth redirect and the email link are built on it */
  publicOrigin: string;
  /** where the game is: a browser is sent there after a sign-in, and a POST must come from it or from publicOrigin */
  appOrigin: string;
  /**
   * The request header our nginx sets to the visitor's country from GeoIP, overwriting any the client sent.
   * Unset, no header is read and every sign-up is held to the highest age; the player never says where they are.
   */
  countryHeader?: string;
  now?: () => number;
}

export interface SignIn {
  /** The account the request's session cookie stands for, or undefined. A POST from another origin stands for no one. */
  resolve(request: IncomingMessage): Promise<string | undefined>;
  /** Answer a request under `/auth/`; false for any other path. */
  handle(request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean>;
}

function sendJson(response: ServerResponse, status: number, body: unknown, cookies: string[] = []): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    ...(cookies.length > 0 ? { 'set-cookie': cookies } : {}),
  });
  response.end(JSON.stringify(body));
}

function redirect(response: ServerResponse, location: string, cookies: string[] = [], status = 302): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    location,
    'referrer-policy': 'no-referrer',
    ...(cookies.length > 0 ? { 'set-cookie': cookies } : {}),
  });
  response.end();
}

async function readBody(request: IncomingMessage, limit = BODY_LIMIT): Promise<string> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const value of request) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    length += chunk.length;
    if (length > limit) throw new SignInRefusal('The request is too large.', 'request', 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readJsonObject(request: IncomingMessage, limit = BODY_LIMIT): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:\s*;|$)/.test(request.headers['content-type']?.toLowerCase() ?? '')) {
    throw new SignInRefusal('Send JSON with content-type application/json.', 'request', 415);
  }
  let value: unknown;
  try {
    value = JSON.parse(await readBody(request, limit)) as unknown;
  } catch {
    throw new SignInRefusal('The request is not valid JSON.', 'request');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SignInRefusal('The request body must be an object.', 'request');
  }
  return value as Record<string, unknown>;
}

function onlyKeys(body: Record<string, unknown>, keys: readonly string[]): void {
  if (!Object.keys(body).every((key) => keys.includes(key))) {
    throw new SignInRefusal('The request contains an unexpected field.', 'request');
  }
}

function normalEmail(value: unknown): string {
  if (typeof value !== 'string') throw new SignInRefusal('Give an email address.', 'request');
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 320 || !EMAIL.test(email)) {
    throw new SignInRefusal('That does not look like an email address.', 'request');
  }
  return email;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Sign-in for the game's API (NEXT 18 e): Google by OAuth, an email link, and a Discord slot not open yet.
 * A proven identity that names an account signs in at once; one that names none waits on a sign-up ticket
 * until the player gives a name and a year of birth, and only then is the account made.
 */
export function createSignIn(options: SignInOptions): SignIn {
  const { store, mailer } = options;
  const now = options.now ?? Date.now;
  const newSeed = options.newSeed ?? (() => randomInt(0, 2 ** 32));
  const allowedOrigins = new Set([options.publicOrigin, options.appOrigin]);
  const redirectUri = (provider: string) => `${options.publicOrigin}/auth/${provider}/callback`;
  let sweptAt = 0;

  async function sweep(at: number): Promise<void> {
    if (at - sweptAt < SWEEP_EVERY_MS) return;
    sweptAt = at;
    await store.sweep(at);
  }

  function fromAllowedOrigin(request: IncomingMessage): boolean {
    const origin = request.headers.origin;
    return typeof origin === 'string' && allowedOrigins.has(origin);
  }

  function requireOrigin(request: IncomingMessage): void {
    if (!fromAllowedOrigin(request)) throw new SignInRefusal('That request did not come from the game.', 'origin', 403);
  }

  /** The browser goes back to the game, with what happened in the fragment, which no server log sees. */
  function backToGame(response: ServerResponse, outcome: string, cookies: string[] = []): void {
    redirect(response, `${options.appOrigin}/#signin=${outcome}`, cookies, 303);
  }

  /** A new session, and the one the browser had revoked: the token changes at every sign-in. */
  async function startSession(request: IncomingMessage, accountId: string, at: number): Promise<string> {
    const previous = readCookie(request, SESSION_COOKIE);
    if (isToken(previous)) await store.revokeSession(tokenHash(previous), at);
    const token = newToken();
    await store.createSession(tokenHash(token), accountId, at, at + SESSION_TTL_MS);
    return cookie(SESSION_COOKIE, token, SESSION_TTL_MS / 1000);
  }

  /**
   * Where a proven identity leads: the account it already signs in to; else the account its address
   * already has, which it joins (the provider has proven the address); else a sign-up ticket.
   */
  async function arrive(request: IncomingMessage, response: ServerResponse, identity: ProvenIdentity, at: number): Promise<void> {
    const email = identity.email.trim().toLowerCase();
    let accountId = await store.accountForIdentity(identity.provider, identity.subject);
    if (!accountId) {
      accountId = await store.accountForEmail(email);
      if (accountId) await store.addIdentity(identity.provider, identity.subject, accountId);
    }
    if (accountId) {
      // an account closed within its 30 days comes back by signing in; the game is told plainly
      const restored = (await store.isClosed(accountId)) && (await store.reopenAccount(accountId));
      const session = await startSession(request, accountId, at);
      backToGame(response, restored ? 'restored' : 'ok', [session, clearCookie(SIGNUP_COOKIE), clearCookie(FLOW_COOKIE)]);
      return;
    }
    const ticket = newToken();
    await store.saveTicket({ ticketHash: tokenHash(ticket), provider: identity.provider, subject: identity.subject, email, createdAt: at, expiresAt: at + TICKET_TTL_MS });
    backToGame(response, 'signup', [cookie(SIGNUP_COOKIE, ticket, TICKET_TTL_MS / 1000), clearCookie(FLOW_COOKIE)]);
  }

  async function oauthStart(response: ServerResponse, provider: OAuthProvider): Promise<void> {
    const at = now();
    await sweep(at);
    const state = newToken();
    const verifier = newToken();
    const nonce = newToken();
    await store.saveFlow({ stateHash: tokenHash(state), provider: provider.id, verifier, nonce, createdAt: at, expiresAt: at + FLOW_TTL_MS });
    const location = provider.authorizeUrl({ state, challenge: pkceChallenge(verifier), nonce, redirectUri: redirectUri(provider.id) });
    redirect(response, location, [cookie(FLOW_COOKIE, state, FLOW_TTL_MS / 1000)]);
  }

  async function oauthCallback(request: IncomingMessage, response: ServerResponse, url: URL, provider: OAuthProvider): Promise<void> {
    const at = now();
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    const bound = readCookie(request, FLOW_COOKIE);
    // the state must be the one this browser was sent off with, and one this server still holds
    if (!isToken(state) || !isToken(bound) || !sameSecret(state, bound)) {
      throw new SignInRefusal('That sign-in did not start in this browser. Start again.', 'state');
    }
    const flow = await store.takeFlow(tokenHash(state));
    if (!flow || flow.provider !== provider.id || flow.expiresAt <= at) {
      throw new SignInRefusal('That sign-in is no longer open. Start again.', 'state');
    }
    if (url.searchParams.has('error') || code === null || code.length === 0 || code.length > 2048) {
      throw new SignInRefusal('The sign-in was not completed.', 'provider');
    }
    const identity = await provider.identify({ code, verifier: flow.verifier, nonce: flow.nonce, redirectUri: redirectUri(provider.id), now: at });
    await arrive(request, response, identity, at);
  }

  async function emailStart(request: IncomingMessage, response: ServerResponse): Promise<void> {
    requireOrigin(request);
    const body = await readJsonObject(request);
    onlyKeys(body, ['email']);
    const email = normalEmail(body.email);
    const at = now();
    await sweep(at);
    // the answer is the same whether a link went out, was held back, or the address has no account,
    // so the endpoint tells no one which addresses play here
    if ((await store.countEmailLinks(email, at - LINK_TTL_MS)) < LINKS_PER_ADDRESS) {
      const token = newToken();
      await store.saveEmailLink({ tokenHash: tokenHash(token), email, createdAt: at, expiresAt: at + LINK_TTL_MS });
      await mailer.send({
        to: email,
        subject: 'Your Loomvale sign-in link',
        text: `Open this link to sign in to Loomvale. It works once, for ${LINK_TTL_MS / MINUTE} minutes:\n${options.publicOrigin}/auth/email/link?token=${token}\n\nIf you did not ask for it, ignore this message.`,
      });
    }
    sendJson(response, 202, { sent: true });
  }

  /**
   * The page the emailed link opens. It changes nothing: a mail scanner that follows links must not spend
   * the link, so the sign-in happens only when the player presses the button, which posts the token.
   */
  function emailLinkPage(response: ServerResponse, url: URL): void {
    const token = url.searchParams.get('token');
    const valid = isToken(token);
    const body = valid
      ? `<form method="post" action="/auth/email/confirm"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit">Sign in to Loomvale</button></form>`
      : '<p>This sign-in link is not complete. Ask for a new one in the game.</p>';
    response.writeHead(valid ? 200 : 400, {
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'",
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    });
    response.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Loomvale sign-in</title>${body}</html>`);
  }

  async function emailConfirm(request: IncomingMessage, response: ServerResponse): Promise<void> {
    requireOrigin(request);
    if (!/^application\/x-www-form-urlencoded(?:\s*;|$)/.test(request.headers['content-type']?.toLowerCase() ?? '')) {
      throw new SignInRefusal('Send the form as the link page sends it.', 'request', 415);
    }
    const token = new URLSearchParams(await readBody(request)).get('token');
    if (!isToken(token)) throw new SignInRefusal('That sign-in link is not one this server sent.', 'link-unknown');
    const at = now();
    const link = await store.useEmailLink(tokenHash(token), at);
    if (link === undefined) throw new SignInRefusal('That sign-in link is not one this server sent.', 'link-unknown');
    if (link === 'used') throw new SignInRefusal('That sign-in link was already used. Ask for a new one.', 'link-used');
    if (link.expiresAt <= at) throw new SignInRefusal('That sign-in link has expired. Ask for a new one.', 'link-expired');
    await arrive(request, response, { provider: 'email', subject: link.email, email: link.email }, at);
  }

  async function ticketOf(request: IncomingMessage, at: number) {
    const ticket = readCookie(request, SIGNUP_COOKIE);
    const found = isToken(ticket) ? await store.loadTicket(tokenHash(ticket)) : undefined;
    if (!found || found.expiresAt <= at) throw new SignInRefusal('Sign in again to make your account.', 'no-signup', 401);
    return found;
  }

  /** The 403 that ends a sign-up for its age. It names no age, so it is no hint for the next answer. */
  async function refuseAge(response: ServerResponse, ticketHash: string, cookies: string[]): Promise<void> {
    await store.dropTicket(ticketHash);
    sendJson(response, 403, {
      error: 'You cannot make an Loomvale account. The demo stays open to you.',
      reason: 'under-age',
      demo: '/',
    }, [...cookies, clearCookie(SIGNUP_COOKIE)]);
  }

  /** The country our proxy says the request comes from; undefined without the header, or with a value that is not one. */
  function countryOf(request: IncomingMessage): string | undefined {
    if (!options.countryHeader) return undefined;
    const value = request.headers[options.countryHeader];
    return typeof value === 'string' && COUNTRY.test(value) ? value : undefined;
  }

  async function signupShow(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const ticket = await ticketOf(request, now());
    if (readCookie(request, AGE_COOKIE) !== undefined) return refuseAge(response, ticket.ticketHash, []);
    sendJson(response, 200, { email: ticket.email });
  }

  /**
   * The sign-up asks for a name and a date of birth, and nothing else (DECISIONS 2026-10-09; CR-49): the
   * address comes from the proven identity, and the country from our proxy, never from the player. The
   * date is checked and not kept, nor is its band: the account keeps that the check passed, and the country. `oneAccount` is the player's yes to "one person, one account in a
   * world" (CR-53). A browser refused for its age is refused a new date for a day, as a neutral age screen
   * asks, and its ticket ends. `opening`, when the phone sends it, is the opening it played before the
   * account existed (NEXT 18 d): the account keeps it when the server's replay proves it, and starts fresh
   * otherwise; the reply says which in `opening`, `kept` or `fresh`.
   */
  async function signupCreate(request: IncomingMessage, response: ServerResponse): Promise<void> {
    requireOrigin(request);
    const at = now();
    const ticket = await ticketOf(request, at);
    if (readCookie(request, AGE_COOKIE) !== undefined) return refuseAge(response, ticket.ticketHash, []);
    const body = await readJsonObject(request, SIGNUP_BODY_LIMIT);
    onlyKeys(body, ['name', 'birthDate', 'oneAccount', 'opening']);
    if (body.oneAccount !== true) {
      throw new SignInRefusal('One person, one account in a world: agree to it to make your account.', 'request');
    }
    if (typeof body.name !== 'string' || !NAME.test(body.name) || body.name.trim() === '') {
      throw new SignInRefusal('A name is 1 to 16 letters, digits, spaces, "_" or "-".', 'request');
    }
    const birth = parseBirthDate(body.birthDate, at);
    if (!birth) throw new SignInRefusal('Give the day you were born.', 'request');
    const gate = ageGate(birth, countryOf(request), at);
    if ('underAge' in gate) return refuseAge(response, ticket.ticketHash, [cookie(AGE_COOKIE, '1', AGE_REFUSAL_TTL_MS / 1000)]);
    // the opening the phone played comes with the account, replayed and proven, or the game starts fresh (NEXT 18 d)
    const handover = takeOpening(options.bundle, body.opening, newSeed(), at);
    const game = handover.kept
      ? { record: handover.record, books: { action: handover.opening, tick: handover.tick, gold: handover.gold } }
      : { record: handover.record };
    const made = await store.createAccount({ email: ticket.email, name: body.name.trim(), country: countryOf(request) }, ticket, game);
    if (made === 'name-taken') throw new SignInRefusal('That name is taken in this world. Choose another.', 'name-taken', 409);
    if (made === 'email-taken') throw new SignInRefusal('That address already has an account. Sign in instead.', 'email-taken', 409);
    const session = await startSession(request, made.accountId, at);
    sendJson(response, 201, { name: body.name.trim(), opening: handover.kept ? 'kept' : 'fresh' }, [session, clearCookie(SIGNUP_COOKIE)]);
  }

  async function sessionHash(request: IncomingMessage): Promise<{ hash: string; accountId: string } | undefined> {
    const token = readCookie(request, SESSION_COOKIE);
    if (!isToken(token)) return undefined;
    const hash = tokenHash(token);
    const accountId = await store.sessionAccount(hash, now());
    return accountId ? { hash, accountId } : undefined;
  }

  async function me(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const session = await sessionHash(request);
    const account = session && (await store.account(session.accountId));
    if (!account) throw new SignInRefusal('Sign in to continue.', 'no-signup', 401);
    sendJson(response, 200, account);
  }

  async function signOut(request: IncomingMessage, response: ServerResponse): Promise<void> {
    requireOrigin(request);
    const session = await sessionHash(request);
    if (session) await store.revokeSession(session.hash, now());
    sendJson(response, 200, { signedOut: true }, [clearCookie(SESSION_COOKIE)]);
  }

  /** Closing an account hides it at once and ends its sessions; signing in within 30 days brings it back, after that the details are erased (23.10). */
  async function close(request: IncomingMessage, response: ServerResponse): Promise<void> {
    requireOrigin(request);
    const session = await sessionHash(request);
    if (!session) throw new SignInRefusal('Sign in to continue.', 'no-signup', 401);
    const body = await readJsonObject(request);
    onlyKeys(body, ['close']);
    if (body.close !== true) throw new SignInRefusal('Confirm that the account is to be closed.', 'request');
    await store.closeAccount(session.accountId, now());
    sendJson(response, 200, { closed: true, restorableDays: CLOSED_ACCOUNT_GRACE_MS / DAY }, [clearCookie(SESSION_COOKIE)]);
  }

  type Route = (request: IncomingMessage, response: ServerResponse, url: URL) => Promise<void>;

  function oauth(provider: 'google' | 'discord'): { start: Route; callback: Route } {
    const open = provider === 'google' ? options.google : undefined;
    // TODO(NEXT 18 e, gate h5): Discord's OAuth app needs the owner's own login, so the slot answers "not
    // open" until it exists; a `discordProvider` then fills `open` like Google's.
    const closed: Route = () => Promise.reject(new SignInRefusal(`Sign-in with ${provider === 'google' ? 'Google' : 'Discord'} is not open yet.`, 'not-open', 501));
    if (!open) return { start: closed, callback: closed };
    return {
      start: (_request, response) => oauthStart(response, open),
      callback: (request, response, url) => oauthCallback(request, response, url, open),
    };
  }

  const google = oauth('google');
  const discord = oauth('discord');
  const routes: Record<string, { GET?: Route; POST?: Route }> = {
    '/auth/google/start': { GET: google.start },
    '/auth/google/callback': { GET: google.callback },
    '/auth/discord/start': { GET: discord.start },
    '/auth/discord/callback': { GET: discord.callback },
    '/auth/email/start': { POST: emailStart },
    '/auth/email/link': { GET: (_request, response, url) => Promise.resolve(emailLinkPage(response, url)) },
    '/auth/email/confirm': { POST: emailConfirm },
    '/auth/signup': { GET: signupShow, POST: signupCreate },
    '/auth/me': { GET: me },
    '/auth/signout': { POST: signOut },
    '/auth/close': { POST: close },
  };
  /** the routes a browser reaches by navigating: a refusal there goes back to the game, not to a JSON page */
  const navigations = new Set(['/auth/google/callback', '/auth/discord/callback', '/auth/email/confirm']);

  return {
    async resolve(request) {
      if (request.method !== 'GET' && !fromAllowedOrigin(request)) return undefined;
      return (await sessionHash(request))?.accountId;
    },

    async handle(request, response, url) {
      const route = routes[url.pathname];
      if (!url.pathname.startsWith('/auth/')) return false;
      const method = request.method === 'GET' || request.method === 'POST' ? request.method : undefined;
      const run = route && method ? route[method] : undefined;
      if (!route) {
        sendJson(response, 404, { error: 'Not found.' });
        return true;
      }
      if (!run) {
        response.setHeader('allow', Object.keys(route).join(', '));
        sendJson(response, 405, { error: 'Method not allowed.' });
        return true;
      }
      try {
        await run(request, response, url);
      } catch (error) {
        if (!(error instanceof SignInRefusal)) throw error;
        if (navigations.has(url.pathname)) {
          // the flow cookie has done its work either way
          backToGame(response, error.reason, [clearCookie(FLOW_COOKIE)]);
          return true;
        }
        sendJson(response, error.status, { error: error.message, reason: error.reason });
      }
      return true;
    },
  };
}
