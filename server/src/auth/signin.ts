import { createHash, randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SEED_BYTES, seedFromBytes, type Bundle, type Seed } from '@game/kernel';

import { takeOpening } from '../handover';

import { ageGate, parseBirthDate } from './age';
import { AGE_COOKIE, clearCookie, cookie, FLOW_COOKIE, readCookie, SESSION_COOKIE, SIGNUP_COOKIE } from './cookies';
import type { CountryLookup } from './country';
import { inboxOf, RateLimit } from './limits';
import type { Mailer } from './mailer';
import { PROVES_ADDRESS, SignInRefusal, WEAKER_WAYS, type OAuthProvider, type ProvenIdentity, type ProviderId } from './provider';
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
/** links sent to one inbox (`+tag` dropped) within a link's life, counted in this process; past it, the same answer and nothing sent */
const LINKS_PER_INBOX = 3;
/** email sign-ins one client address may ask for within a link's life; past it, 429 */
const EMAIL_STARTS_PER_CLIENT = 10;
/** Google or Discord sign-ins one client address may start within a flow's life; past it, back to the game */
const OAUTH_STARTS_PER_CLIENT = 20;
/** how often `sweep` is meant to run; main.ts runs it on a timer, off every request */
export const SWEEP_EVERY_MS = MINUTE;
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
  /** the account's secret key, 128 bits; a test passes its own */
  newSeed?: () => Seed;
  mailer: Mailer;
  /** Google, when its client id and secret are set; closed ("not open yet") without them */
  google?: OAuthProvider;
  /** Discord, the same way */
  discord?: OAuthProvider;
  /** the origin this API answers on: the OAuth redirect and the email link are built on it */
  publicOrigin: string;
  /** where the game is: a browser is sent there after a sign-in, and a POST must come from it or from publicOrigin */
  appOrigin: string;
  /**
   * The request header our nginx sets to the visitor's country, overwriting any the client sent: an override
   * that wins over `countryLookup` when it carries a country. Unset, no header is read.
   */
  countryHeader?: string;
  /**
   * The country of the client's address, looked up in a database the server holds (COUNTRY_DB). With neither
   * this nor a header that answers, every sign-up is held to the highest age; the player never says where they are.
   */
  countryLookup?: CountryLookup;
  /**
   * The request header our nginx sets to the client's address (X-Real-IP), overwriting any the client sent;
   * the per-address limits count by it. Unset (a laptop with no proxy), the socket's address is used.
   */
  addressHeader?: string;
  now?: () => number;
}

export interface SignIn {
  /** The account the request's session cookie stands for, or undefined. A POST from another origin stands for no one. */
  resolve(request: IncomingMessage): Promise<string | undefined>;
  /** The name of an open account: the one name its character carves and starts with (finding 11 of the 27.10 review). */
  accountName(accountId: string): Promise<string | undefined>;
  /** Answer a request under `/auth/`; false for any other path. */
  handle(request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean>;
  /** Remove what has expired: the store's flows, links, tickets and sessions, and the limits' old counts. Run on a timer, never on a player's request. */
  sweep(): Promise<void>;
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
  // read outside the parse, as api.ts does: a body too large keeps its 413, and a broken socket is not called bad JSON
  const text = await readBody(request, limit);
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
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

/**
 * The email link page's one script. The token rides in the link's fragment, which a browser never sends, so
 * no server log, proxy log or Referer carries it; the script reads it into the form and takes it out of the
 * address bar and the history. The page's CSP allows this script by its hash and nothing else.
 */
export const LINK_SCRIPT =
  "var m=/^#token=([A-Za-z0-9_-]{43})$/.exec(location.hash);history.replaceState(null,'',location.pathname);var f=document.forms[0];" +
  "if(m){f.elements.token.value=m[1];f.querySelector('button').disabled=false}else{f.hidden=true;document.getElementById('missing').hidden=false}";
const LINK_SCRIPT_SOURCE = `'sha256-${createHash('sha256').update(LINK_SCRIPT, 'utf8').digest('base64')}'`;
const INCOMPLETE_LINK = 'This sign-in link is not complete. Ask for a new one in the game.';

function linkPageHtml(body: string): string {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Loomvale sign-in</title>${body}</html>`;
}

function slowDown(): SignInRefusal {
  return new SignInRefusal('Too many sign-ins were asked for from here. Wait a few minutes and try again.', 'slow-down', 429);
}

/**
 * Sign-in for the game's API (NEXT 18 e): Google and Discord by OAuth, and an email link.
 * A proven identity that names an account signs in at once; one that names none waits on a sign-up ticket
 * until the player gives a name and a year of birth, and only then is the account made.
 */
export function createSignIn(options: SignInOptions): SignIn {
  const { store, mailer } = options;
  const now = options.now ?? Date.now;
  // 16 bytes from the system's secure source: the key every draw of the account is made under (finding 3)
  const newSeed = options.newSeed ?? (() => seedFromBytes(randomBytes(SEED_BYTES)));
  /** every non-GET call comes from the game's pages */
  const gameOrigins: ReadonlySet<string> = new Set([options.appOrigin]);
  /** but one: the email link page is this API's own, and its button posts from here (finding 1 of the 27.10 review) */
  const linkPageOrigins: ReadonlySet<string> = new Set([options.publicOrigin]);
  const redirectUri = (provider: string) => `${options.publicOrigin}/auth/${provider}/callback`;
  const emailStartsByClient = new RateLimit(EMAIL_STARTS_PER_CLIENT, LINK_TTL_MS);
  const linksByInbox = new RateLimit(LINKS_PER_INBOX, LINK_TTL_MS);
  const oauthStartsByClient = new RateLimit(OAUTH_STARTS_PER_CLIENT, FLOW_TTL_MS);
  const limits = [emailStartsByClient, linksByInbox, oauthStartsByClient];

  function fromOrigin(request: IncomingMessage, allowed: ReadonlySet<string> = gameOrigins): boolean {
    const origin = request.headers.origin;
    return typeof origin === 'string' && allowed.has(origin);
  }

  function requireOrigin(request: IncomingMessage, allowed: ReadonlySet<string> = gameOrigins): void {
    if (!fromOrigin(request, allowed)) throw new SignInRefusal('That request did not come from the game.', 'origin', 403);
  }

  /** The client's address as our proxy names it, never as a body or a header the client wrote says. */
  function clientAddress(request: IncomingMessage): string {
    if (options.addressHeader) {
      const value = request.headers[options.addressHeader];
      if (typeof value === 'string' && value.length > 0 && value.length <= 64) return value;
    }
    return request.socket.remoteAddress ?? 'unknown';
  }

  /** The browser goes back to the game, with what happened in the fragment, which no server log sees. */
  function backToGame(response: ServerResponse, outcome: string, cookies: string[] = []): void {
    redirect(response, `${options.appOrigin}/#signin=${outcome}`, cookies, 303);
  }

  /** A new session, and the one the browser had revoked: the token changes at every sign-in. */
  /** A session through `via`, the way in that was just proven: none if a proof of the address took that way away meanwhile. */
  async function startSession(request: IncomingMessage, accountId: string, at: number, via: { provider: ProviderId; subject: string }): Promise<string> {
    const previous = readCookie(request, SESSION_COOKIE);
    if (isToken(previous)) await store.revokeSession(tokenHash(previous), at);
    const token = newToken();
    if (!(await store.createSession(tokenHash(token), accountId, at, at + SESSION_TTL_MS, via))) {
      throw new SignInRefusal('That address already has an account. Sign in the way you made it.', 'email-taken', 409);
    }
    return cookie(SESSION_COOKIE, token, SESSION_TTL_MS / 1000);
  }

  /**
   * Where a proven identity leads: the account it already signs in to; else the account its address already
   * has, which a proof of the address joins (`PROVES_ADDRESS`), taking the address back from any weaker way in
   * on it, and which a weaker one is refused; else a sign-up ticket.
   */
  async function arrive(request: IncomingMessage, response: ServerResponse, identity: ProvenIdentity, at: number): Promise<void> {
    const email = identity.email.trim().toLowerCase();
    let accountId = await store.accountForIdentity(identity.provider, identity.subject);
    if (!accountId) {
      accountId = await store.accountForEmail(email);
      if (accountId && !PROVES_ADDRESS[identity.provider]) {
        throw new SignInRefusal('That address already has an account. Sign in the way you made it.', 'email-taken', 409);
      }
      if (accountId) {
        // whoever made or joined the account through a weaker way in may not have held this mailbox: they are signed
        // out and that way in is gone, so the address's owner is the only one left in the account
        await store.dropIdentities(accountId, WEAKER_WAYS, at);
        await store.addIdentity(identity.provider, identity.subject, accountId);
      }
    }
    if (accountId) {
      // an account closed within its 30 days comes back by signing in; the game is told plainly
      const restored = (await store.isClosed(accountId)) && (await store.reopenAccount(accountId));
      const session = await startSession(request, accountId, at, identity);
      backToGame(response, restored ? 'restored' : 'ok', [session, clearCookie(SIGNUP_COOKIE), clearCookie(FLOW_COOKIE)]);
      return;
    }
    const ticket = newToken();
    await store.saveTicket({ ticketHash: tokenHash(ticket), provider: identity.provider, subject: identity.subject, email, createdAt: at, expiresAt: at + TICKET_TTL_MS });
    backToGame(response, 'signup', [cookie(SIGNUP_COOKIE, ticket, TICKET_TTL_MS / 1000), clearCookie(FLOW_COOKIE)]);
  }

  async function oauthStart(response: ServerResponse, provider: OAuthProvider): Promise<void> {
    const at = now();
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
    // The flow is spent before the code is exchanged, on purpose: a state answers once even when two
    // callbacks race, and the code it guards is single-use at Google (RFC 6749 4.1.2), so a reload after a
    // failed exchange could not finish anyway. A failed exchange goes back to the game as `provider`, and
    // the player starts again with a fresh state.
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
    // a client asking for many links is told to wait: that says nothing about any address
    if (!emailStartsByClient.take(clientAddress(request), at)) throw slowDown();
    // the answer is the same whether a link went out, was held back, or the address has no account,
    // so the endpoint tells no one which addresses play here; the links counted are the ones still alive
    const send = linksByInbox.take(inboxOf(email), at) && (await store.countEmailLinks(email, at - LINK_TTL_MS + 1)) < LINKS_PER_ADDRESS;
    if (send) {
      const token = newToken();
      await store.saveEmailLink({ tokenHash: tokenHash(token), email, createdAt: at, expiresAt: at + LINK_TTL_MS });
      await mailer.send({
        to: email,
        subject: 'Your Loomvale sign-in link',
        // the token after `#`: a browser never sends the fragment, so no server or proxy log ever holds it
        text: `Open this link to sign in to Loomvale. It works once, for ${LINK_TTL_MS / MINUTE} minutes:\n${options.publicOrigin}/auth/email/link#token=${token}\n\nIf you did not ask for it, ignore this message.`,
      });
    }
    sendJson(response, 202, { sent: true });
  }

  /**
   * The page the emailed link opens. It changes nothing: a mail scanner that follows links must not spend
   * the link, so the sign-in happens only when the player presses the button, which posts the token.
   *
   * The token is in the fragment, read by the page's own script (LINK_SCRIPT). The page is served with
   * `referrer-policy: same-origin`, so its button's POST carries this API's origin (under `no-referrer` a
   * browser sends `Origin: null`), and `form-action` names the game's origin, which the confirm's 303 goes
   * to (Chromium and WebKit check a form's redirect against it too).
   */
  function emailLinkPage(response: ServerResponse, url: URL): void {
    if (url.search !== '') {
      // TODO(remove one release after the fragment link ships, finding 5 of the 27.10 review): a link mailed
      // before it carries `?token=`. It is moved to the fragment at once, before any page is drawn, so the
      // page and its button see only the new form; the request line that brought it was logged as before.
      const token = url.searchParams.get('token');
      if (isToken(token) && [...url.searchParams.keys()].length === 1) {
        redirect(response, `${options.publicOrigin}/auth/email/link#token=${token}`);
        return;
      }
      response.writeHead(400, {
        'cache-control': 'no-store',
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
      });
      response.end(linkPageHtml(`<p>${INCOMPLETE_LINK}</p>`));
      return;
    }
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': `default-src 'none'; script-src ${LINK_SCRIPT_SOURCE}; form-action 'self' ${options.appOrigin}; base-uri 'none'; frame-ancestors 'none'`,
      'referrer-policy': 'same-origin',
      'x-content-type-options': 'nosniff',
    });
    response.end(
      linkPageHtml(
        '<form method="post" action="/auth/email/confirm"><input type="hidden" name="token"><button type="submit" disabled>Sign in to Loomvale</button></form>' +
          `<p id="missing" hidden>${INCOMPLETE_LINK}</p><noscript><p>This page needs JavaScript to read the link.</p></noscript>` +
          `<script>${LINK_SCRIPT}</script>`,
      ),
    );
  }

  async function emailConfirm(request: IncomingMessage, response: ServerResponse): Promise<void> {
    // the one POST that comes from this API's own page, never from the game's
    requireOrigin(request, linkPageOrigins);
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

  /**
   * The country the request comes from: the one our proxy's header names when it holds one plain code, else the
   * one the country database gives the client's address (as our proxy names it); undefined when neither knows.
   */
  function countryOf(request: IncomingMessage): string | undefined {
    if (options.countryHeader) {
      const value = request.headers[options.countryHeader];
      if (typeof value === 'string' && COUNTRY.test(value)) return value;
    }
    return options.countryLookup?.(clientAddress(request));
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
    const name = body.name.trim();
    const birth = parseBirthDate(body.birthDate, at);
    if (!birth) throw new SignInRefusal('Give the day you were born.', 'request');
    const gate = ageGate(birth, countryOf(request), at);
    if ('underAge' in gate) return refuseAge(response, ticket.ticketHash, [cookie(AGE_COOKIE, '1', AGE_REFUSAL_TTL_MS / 1000)]);
    // A taken name is refused before the opening is replayed, so a ticket retried with one name after
    // another replays its opening once, for the name that lands (finding 12 of the 27.10 review). The
    // insert below still holds the rule for a name taken in between.
    const nameTaken = () => new SignInRefusal('That name is taken in this world. Choose another.', 'name-taken', 409);
    if (await store.nameTaken(name)) throw nameTaken();
    // the opening the phone played comes with the account, replayed and proven, or the game starts fresh (NEXT 18 d)
    // the account's name is its character's name: an opening that carved another one is not kept (finding 11)
    const handover = takeOpening(options.bundle, body.opening, newSeed(), at, undefined, name);
    const game = handover.kept
      ? { record: handover.record, books: { action: handover.opening, tick: handover.tick, gold: handover.gold } }
      : { record: handover.record };
    const made = await store.createAccount({ email: ticket.email, name, country: countryOf(request) }, ticket, game);
    if (made === 'name-taken') throw nameTaken();
    if (made === 'email-taken') {
      // the address or the identity has an account by now: this ticket can never make one, so it ends
      await store.dropTicket(ticket.ticketHash);
      throw new SignInRefusal('That address already has an account. Sign in instead.', 'email-taken', 409);
    }
    const session = await startSession(request, made.accountId, at, ticket);
    sendJson(response, 201, { name, opening: handover.kept ? 'kept' : 'fresh' }, [session, clearCookie(SIGNUP_COOKIE)]);
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
    const open = provider === 'google' ? options.google : options.discord;
    const closed: Route = () => Promise.reject(new SignInRefusal(`Sign-in with ${provider === 'google' ? 'Google' : 'Discord'} is not open yet.`, 'not-open', 501));
    // every start writes a flow row, so one client address starts only so many (finding 6 of the 27.10 review)
    const start: Route = async (request, response, url) => {
      if (!oauthStartsByClient.take(clientAddress(request), now())) throw slowDown();
      await (open ? oauthStart(response, open) : closed(request, response, url));
    };
    if (!open) return { start, callback: closed };
    return { start, callback: (request, response, url) => oauthCallback(request, response, url, open) };
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
  const navigations = new Set(['/auth/google/start', '/auth/google/callback', '/auth/discord/start', '/auth/discord/callback', '/auth/email/confirm']);

  return {
    async sweep() {
      const at = now();
      for (const limit of limits) limit.prune(at);
      await store.sweep(at);
    },

    async resolve(request) {
      if (request.method !== 'GET' && !fromOrigin(request)) return undefined;
      return (await sessionHash(request))?.accountId;
    },

    async accountName(accountId) {
      return (await store.account(accountId))?.name;
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
