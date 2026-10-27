import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import type { Server } from 'node:http';
import { isSeed, newState, serialize, step, widenSeed, type Bundle, type Seed, type State } from '@game/kernel';

import { createGameApi, createPlayerRecord, createSignIn, googleProvider, listen, type Mail, type PlayerRecord, type PlayerStore, type SignIn } from '../src';
import { ageGate, ageOn, consentAge, parseBirthDate, UNKNOWN_COUNTRY_AGE } from '../src/auth/age';
import { pkceChallenge, tokenHash } from '../src/auth/tokens';
import { loadBundle } from '../../tools/test/helpers/world.js';
import { Browser, CLIENT_ID, CLIENT_SECRET, FakeGoogle, MemoryAuthStore } from './support/auth.js';
import { LocalPhone, STARTS, playOpening } from './support/phone.js';

const APP = 'http://localhost:5173';
/** the key every account of these tests is given: the server's own, never the phone's */
const SECRET_SEED: Seed = [424242, 0x9e3779b9, 0x7f4a7c15, 0xf39cc060];
let bundle: Bundle;
let server: Server | undefined;

beforeAll(() => {
  bundle = loadBundle();
});

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server!.close((error) => (error ? reject(error) : resolve())));
  server = undefined;
});

/** A player store that holds a state for whichever account a test gives one to. */
class Players implements PlayerStore {
  rows = new Map<string, PlayerRecord>();
  /** the games the sign-up made: an account's first state, until a test or a request writes another */
  constructor(private readonly made: MemoryAuthStore) {}
  async load(playerId: string) {
    return this.rows.get(playerId) ?? this.made.games.get(playerId)?.record;
  }
  async compareAndSet(playerId: string, expected: number, next: PlayerRecord) {
    if (this.rows.get(playerId)?.version !== expected) return false;
    this.rows.set(playerId, next);
    return true;
  }
}

function started(): State {
  const result = step(bundle, newState(bundle, 17), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

/** The API in the session mode, on a free port, with Google, a mail outbox and a clock the test moves. */
async function ready(options: { google?: boolean; countryHeader?: string; ownKeys?: boolean } = {}) {
  const clock = { now: Date.UTC(2026, 9, 21, 12) };
  const store = new MemoryAuthStore();
  const players = new Players(store);
  const google = new FakeGoogle();
  google.clock = () => clock.now;
  const outbox: Mail[] = [];
  // the redirect is built on the port, so the sign-in is made once the server listens
  const late: { signIn?: SignIn } = {};
  server = createGameApi({
    bundle,
    store: players,
    now: () => clock.now,
    resolvePlayerId: (request) => late.signIn!.resolve(request),
    signIn: { handle: (request, response, url) => late.signIn!.handle(request, response, url) },
  });
  const base = `http://127.0.0.1:${(await listen(server, 0)).port}`;
  late.signIn = createSignIn({
    store,
    bundle,
    // `ownKeys` leaves the key to the sign-in's own source, as the API runs it
    ...(options.ownKeys ? {} : { newSeed: () => SECRET_SEED }),
    mailer: { name: 'test', send: (mail) => Promise.resolve(void outbox.push(mail)) },
    google: options.google === false ? undefined : googleProvider({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, fetch: google.fetch }),
    publicOrigin: base,
    appOrigin: APP,
    countryHeader: options.countryHeader,
    now: () => clock.now,
  });
  return { clock, store, players, google, outbox, base, browser: new Browser(base, base) };
}

/** The game's address with what happened in the fragment, as the browser is sent back. */
function outcome(response: Response): string | undefined {
  const location = response.headers.get('location') ?? '';
  return location.startsWith(`${APP}/#signin=`) ? location.slice(`${APP}/#signin=`.length) : undefined;
}

async function googleUpTo(w: Awaited<ReturnType<typeof ready>>): Promise<URL> {
  const start = await w.browser.request('/auth/google/start');
  expect(start.status).toBe(302);
  const authorize = new URL(start.headers.get('location')!);
  w.google.nonce = authorize.searchParams.get('nonce')!;
  return authorize;
}

async function googleSignIn(w: Awaited<ReturnType<typeof ready>>): Promise<Response> {
  const authorize = await googleUpTo(w);
  return w.browser.request(`/auth/google/callback?code=a-code&state=${authorize.searchParams.get('state')}`);
}

async function emailLink(w: Awaited<ReturnType<typeof ready>>, address = 'player@example.com'): Promise<string> {
  const before = w.outbox.length;
  const response = await w.browser.request('/auth/email/start', { method: 'POST', json: { email: address } });
  expect(response.status).toBe(202);
  expect(w.outbox.length).toBe(before + 1);
  const link = /https?:\/\/\S+/.exec(w.outbox.at(-1)!.text)![0];
  return new URL(link).searchParams.get('token')!;
}

const SIGNUP = { name: 'Tess', birthDate: '2000-01-01', oneAccount: true };

describe('sign-in with Google (NEXT 18 e)', () => {
  test('the start sends the browser to Google with PKCE S256, a state, a nonce and the three scopes, and binds the state to a cookie', async () => {
    const w = await ready();
    const start = await w.browser.request('/auth/google/start');
    const authorize = new URL(start.headers.get('location')!);
    expect(`${authorize.origin}${authorize.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    const query = Object.fromEntries(authorize.searchParams);
    expect(query).toMatchObject({
      client_id: CLIENT_ID,
      redirect_uri: `${w.base}/auth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      code_challenge_method: 'S256',
    });
    expect(query.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(query.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(query).not.toHaveProperty('client_secret');
    const flowCookie = start.headers.getSetCookie().find((line) => line.startsWith('__Host-of_flow='))!;
    expect(flowCookie).toBe(`__Host-of_flow=${query.state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
    // the database keeps the state's hash, never the state
    expect([...w.store.flows.keys()]).toEqual([tokenHash(query.state!)]);
  });

  test('a new player: the callback proves the identity, the sign-up makes the account, and the session cookie signs them in', async () => {
    const w = await ready();
    const authorize = await googleUpTo(w);
    const callback = await w.browser.request(`/auth/google/callback?code=a-code&state=${authorize.searchParams.get('state')}`);
    expect(callback.status).toBe(303);
    expect(outcome(callback)).toBe('signup');
    expect(w.store.accounts.size).toBe(0);

    // the code was exchanged with the secret and the verifier whose S256 is the challenge Google saw
    const exchange = w.google.exchanges[0]!;
    expect(exchange.get('client_secret')).toBe(CLIENT_SECRET);
    expect(exchange.get('code')).toBe('a-code');
    expect(exchange.get('redirect_uri')).toBe(`${w.base}/auth/google/callback`);
    expect(pkceChallenge(exchange.get('code_verifier')!)).toBe(authorize.searchParams.get('code_challenge'));

    const shown = await w.browser.request('/auth/signup');
    expect(await shown.json()).toEqual({ email: 'player@example.com' });
    const made = await w.browser.request('/auth/signup', { method: 'POST', json: SIGNUP });
    expect(made.status).toBe(201);
    expect(await made.json()).toEqual({ name: 'Tess', opening: 'fresh' });
    expect([...w.store.accounts.values()]).toEqual([{ email: 'player@example.com', name: 'Tess', country: undefined }]);
    const sessionCookie = made.headers.getSetCookie().find((line) => line.startsWith('__Host-of_session='))!;
    expect(sessionCookie).toMatch(/^__Host-of_session=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000$/);
    expect(w.browser.jar.has('__Host-of_signup')).toBe(false);

    const me = await w.browser.request('/auth/me');
    expect(await me.json()).toEqual({ name: 'Tess', email: 'player@example.com' });
  });

  test('a returning player signs in at once, and the session token changes: the old one is revoked', async () => {
    const w = await ready();
    await googleSignIn(w);
    await w.browser.request('/auth/signup', { method: 'POST', json: SIGNUP });
    const first = w.browser.jar.get('__Host-of_session')!;

    const again = await googleSignIn(w);
    expect(outcome(again)).toBe('ok');
    const second = w.browser.jar.get('__Host-of_session')!;
    expect(second).not.toBe(first);
    expect(w.store.accounts.size).toBe(1);

    const stale = new Browser(w.base, w.base);
    stale.jar.set('__Host-of_session', first);
    expect((await stale.request('/auth/me')).status).toBe(401);
    expect((await w.browser.request('/auth/me')).status).toBe(200);
  });

  test('a wrong state is refused: another value, no cookie, or a state already answered once', async () => {
    const w = await ready();
    const authorize = await googleUpTo(w);
    const state = authorize.searchParams.get('state')!;

    const forged = await w.browser.request(`/auth/google/callback?code=a-code&state=${'A'.repeat(43)}`);
    expect(outcome(forged)).toBe('state');

    const other = new Browser(w.base, w.base);
    expect(outcome(await other.request(`/auth/google/callback?code=a-code&state=${state}`))).toBe('state');

    // the forged and the cookieless attempts reached neither Google nor the store
    expect(w.google.exchanges).toHaveLength(0);
    expect(w.store.flows.size).toBe(1);

    w.browser.jar.set('__Host-of_flow', state);
    expect(outcome(await w.browser.request(`/auth/google/callback?code=a-code&state=${state}`))).toBe('signup');
    w.browser.jar.set('__Host-of_flow', state);
    expect(outcome(await w.browser.request(`/auth/google/callback?code=a-code&state=${state}`))).toBe('state');
    expect(w.store.tickets.size).toBe(1);
  });

  test('a state past its ten minutes is refused', async () => {
    const w = await ready();
    const authorize = await googleUpTo(w);
    w.clock.now += 10 * 60 * 1000;
    const late = await w.browser.request(`/auth/google/callback?code=a-code&state=${authorize.searchParams.get('state')}`);
    expect(outcome(late)).toBe('state');
    expect(w.google.exchanges).toHaveLength(0);
  });

  test.each([
    ['another app\'s audience', { aud: 'someone-else.apps.googleusercontent.com' }, 'provider'],
    ['another issuer', { iss: 'https://evil.example.com' }, 'provider'],
    ['an expired token', { exp: Math.floor(Date.UTC(2026, 9, 21, 12) / 1000) - 120 }, 'provider'],
    ['another attempt\'s nonce', { nonce: 'not-this-one' }, 'provider'],
    ['an unverified email', { email_verified: false }, 'email-unverified'],
    ['a verified flag sent as text', { email_verified: 'true' }, 'email-unverified'],
  ] as const)('an id token with %s is refused, and nothing is made', async (_name, change, reason) => {
    const w = await ready();
    const claims = w.google.claims;
    w.google.claims = (nonce, now) => ({ ...claims(nonce, now), ...change });
    const callback = await googleSignIn(w);
    expect(outcome(callback)).toBe(reason);
    expect(w.store.tickets.size).toBe(0);
    expect(w.store.accounts.size).toBe(0);
    expect(w.store.sessions.size).toBe(0);
  });

  test('an id token signed with a key Google does not publish is refused', async () => {
    const w = await ready();
    w.google.forge = true;
    expect(outcome(await googleSignIn(w))).toBe('provider');
    expect(w.store.tickets.size).toBe(0);
  });

  test('Google refusing the code, or the player cancelling, sends the player back with nothing made', async () => {
    const w = await ready();
    w.google.tokenStatus = 400;
    expect(outcome(await googleSignIn(w))).toBe('provider');
    const authorize = await googleUpTo(w);
    expect(outcome(await w.browser.request(`/auth/google/callback?error=access_denied&state=${authorize.searchParams.get('state')}`))).toBe('provider');
    expect(w.store.tickets.size).toBe(0);
  });

  test('Google without its client id is closed, and Discord is a slot that is not open yet', async () => {
    const w = await ready({ google: false });
    const google = await w.browser.request('/auth/google/start');
    expect(google.status).toBe(501);
    expect(await google.json()).toMatchObject({ reason: 'not-open' });
    const discord = await w.browser.request('/auth/discord/start');
    expect(discord.status).toBe(501);
    expect(await discord.json()).toEqual({ error: 'Sign-in with Discord is not open yet.', reason: 'not-open' });
  });
});

describe('sign-in by an email link (NEXT 18 e)', () => {
  test('the link signs in once, and only when the player presses the button: opening it changes nothing', async () => {
    const w = await ready();
    const token = await emailLink(w);
    expect(w.outbox[0]!.to).toBe('player@example.com');
    // the database keeps the hash only
    expect([...w.store.links.keys()]).toEqual([tokenHash(token)]);

    const page = await w.browser.request(`/auth/email/link?token=${token}`);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-security-policy')).toContain("form-action 'self'");
    expect(page.headers.get('referrer-policy')).toBe('no-referrer');
    expect(await page.text()).toContain('<form method="post" action="/auth/email/confirm">');
    expect([...w.store.links.values()][0]!.usedAt).toBeUndefined();

    const confirm = await w.browser.request('/auth/email/confirm', { method: 'POST', form: { token } });
    expect(confirm.status).toBe(303);
    expect(outcome(confirm)).toBe('signup');
    expect((await w.browser.request('/auth/signup', { method: 'POST', json: SIGNUP })).status).toBe(201);
    expect([...w.store.identities.keys()]).toEqual(['email:player@example.com']);
  });

  test('a replayed link is refused', async () => {
    const w = await ready();
    const token = await emailLink(w);
    expect(outcome(await w.browser.request('/auth/email/confirm', { method: 'POST', form: { token } }))).toBe('signup');
    const replay = new Browser(w.base, w.base);
    expect(outcome(await replay.request('/auth/email/confirm', { method: 'POST', form: { token } }))).toBe('link-used');
    expect(replay.jar.size).toBe(0);
    expect(w.store.tickets.size).toBe(1);
  });

  test('an expired link is refused, and so is one this server never sent', async () => {
    const w = await ready();
    const token = await emailLink(w);
    w.clock.now += 15 * 60 * 1000;
    expect(outcome(await w.browser.request('/auth/email/confirm', { method: 'POST', form: { token } }))).toBe('link-expired');
    expect(outcome(await w.browser.request('/auth/email/confirm', { method: 'POST', form: { token: 'B'.repeat(43) } }))).toBe('link-unknown');
    expect(w.store.tickets.size).toBe(0);
    expect(w.browser.jar.has('__Host-of_session')).toBe(false);
  });

  test('the request answers the same for any address, and past three links in a link\'s life it sends nothing', async () => {
    const w = await ready();
    for (let n = 0; n < 3; n++) await emailLink(w, 'Someone@Example.com ');
    const fourth = await w.browser.request('/auth/email/start', { method: 'POST', json: { email: 'someone@example.com' } });
    expect(fourth.status).toBe(202);
    expect(await fourth.json()).toEqual({ sent: true });
    expect(w.outbox).toHaveLength(3);
    expect(w.outbox.every((mail) => mail.to === 'someone@example.com')).toBe(true);
    w.clock.now += 15 * 60 * 1000;
    await emailLink(w, 'someone@example.com');
  });

  test('an address that already has an account signs in to it, whichever way it was proven first', async () => {
    const w = await ready();
    await googleSignIn(w);
    await w.browser.request('/auth/signup', { method: 'POST', json: SIGNUP });
    const phone = new Browser(w.base, w.base);
    const token = await emailLink({ ...w, browser: phone }, 'PLAYER@example.com');
    expect(outcome(await phone.request('/auth/email/confirm', { method: 'POST', form: { token } }))).toBe('ok');
    expect(await (await phone.request('/auth/me')).json()).toEqual({ name: 'Tess', email: 'player@example.com' });
    expect(w.store.accounts.size).toBe(1);
    expect(new Set(w.store.identities.values()).size).toBe(1);
  });

  test('the request refuses a body with anything but the address, and an address that is not one', async () => {
    const w = await ready();
    for (const json of [{ email: 'player@example.com', name: 'Tess' }, { email: 'not-an-address' }, { email: 42 }, {}]) {
      const response = await w.browser.request('/auth/email/start', { method: 'POST', json });
      expect(response.status, JSON.stringify(json)).toBe(400);
    }
    expect(w.outbox).toHaveLength(0);
  });
});

describe('the sign-up (NEXT 18 e; CR-49, CR-53)', () => {
  async function ticket(options: { countryHeader?: string; ownKeys?: boolean } = {}) {
    const w = await ready(options);
    await googleSignIn(w);
    return w;
  }

  /** The sign-up as a browser behind our proxy sends it: the proxy's country header, if any, beside the body. */
  function signUp(w: Awaited<ReturnType<typeof ready>>, json: unknown, country?: string): Promise<Response> {
    return w.browser.request('/auth/signup', { method: 'POST', json, headers: country === undefined ? {} : { 'x-country': country } });
  }

  test('asks for a name and a date of birth and nothing else: any other field, a country among them, is refused', async () => {
    const w = await ticket();
    for (const extra of [{ email: 'other@example.com' }, { phone: '000' }, { birthYear: 2000 }, { country: 'IL' }, { look: 3 }]) {
      const response = await signUp(w, { ...SIGNUP, ...extra });
      expect(response.status, JSON.stringify(extra)).toBe(400);
    }
    expect(w.store.accounts.size).toBe(0);
  });

  test('one person, one account in a world: the sign-up is refused until the player agrees to it', async () => {
    const w = await ticket();
    for (const oneAccount of [undefined, false, 'yes']) {
      const response = await signUp(w, { ...SIGNUP, oneAccount });
      expect(response.status).toBe(400);
      expect((await response.json()).error).toMatch(/One person, one account in a world/);
    }
    expect(w.store.accounts.size).toBe(0);
  });

  test('under 13 is refused without naming an age, pointed to the demo, and the ticket ends', async () => {
    const w = await ticket();
    const response = await signUp(w, { ...SIGNUP, birthDate: '2014-01-01' });
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ error: 'You cannot make an Loomvale account. The demo stays open to you.', reason: 'under-age', demo: '/' });
    expect(body.error).not.toMatch(/\d/);
    expect(w.store.accounts.size).toBe(0);
    expect(w.store.tickets.size).toBe(0);
    expect((await signUp(w, { ...SIGNUP, birthDate: '1990-01-01' })).status).toBe(401);
  });

  test('each account is given 128 bits of its own from the secure source, and no reply carries them (finding 3)', async () => {
    const keys: Seed[] = [];
    for (let i = 0; i < 2; i++) {
      const w = await ticket({ ownKeys: true });
      expect((await signUp(w, SIGNUP)).status).toBe(201);
      const game = [...w.store.games.values()][0]!;
      keys.push(game.record.state.seed);
      const served = await (await w.browser.request('/state')).text();
      expect(served).not.toMatch(/"seed"/);
      // a word long enough not to turn up by chance among the state's own numbers
      for (const word of game.record.state.seed) if (word >= 1_000_000) expect(served).not.toContain(String(word));
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
    for (const key of keys) expect(isSeed(key)).toBe(true);
    expect(keys[0]).not.toEqual(keys[1]);
    // four random words: all three upper ones zero, as a widened 32-bit seed has them, is a 2^-96 chance
    for (const key of keys) expect(key.slice(1).some((word) => word !== 0)).toBe(true);
  });

  test('the opening the phone played comes along: replayed, kept under the server\'s seed, and served as the account\'s game', async () => {
    const w = await ticket();
    const phone = new LocalPhone(bundle, widenSeed(77));
    await playOpening(phone, STARTS[1]);
    const response = await signUp(w, { ...SIGNUP, opening: phone.upload() });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ name: 'Tess', opening: 'kept' });

    const accountId = [...w.store.accounts.keys()][0]!;
    const game = w.store.games.get(accountId)!;
    expect(game.record.state.seed).toEqual(SECRET_SEED);
    expect(serialize(game.record.state)).toBe(serialize({ ...phone.state, seed: SECRET_SEED }));
    // the account's books begin with the opening, and its grants are booked beside it
    expect(game.books?.action).toMatchObject({ kind: 'opening', seed: widenSeed(77) });
    expect(game.books?.gold.reduce((total, row) => total + row.deltaMg, 0)).toBe(phone.state.player.gold);

    const state = await w.browser.request('/state');
    const served = (await state.json()).state;
    expect(served.player.race).toBe('core/skeleton');
    expect(served.tick).toBe(phone.state.tick);
    expect(served).not.toHaveProperty('seed');
  });

  test('an opening that does not prove, or none at all, starts the account fresh, and the reply says so', async () => {
    const w = await ticket();
    const phone = new LocalPhone(bundle, widenSeed(77));
    await playOpening(phone, STARTS[0]);
    const upload = phone.upload();
    const forged = upload.state.replace(`"gold":${phone.state.player.gold}`, `"gold":${phone.state.player.gold + 1}`);
    expect(forged).not.toBe(upload.state);
    const response = await signUp(w, { ...SIGNUP, opening: { ...upload, state: forged } });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ name: 'Tess', opening: 'fresh' });
    const game = w.store.games.get([...w.store.accounts.keys()][0]!)!;
    expect(serialize(game.record.state)).toBe(serialize(newState(bundle, SECRET_SEED)));
    expect(game.books).toBeUndefined();
    // before the start: the player picks a start again, under the account's own seed
    expect((await (await w.browser.request('/state')).json()).state.player.race).toBe('');
  });

  test('a browser refused for its age gets no new date for a day, even after a new proof; another browser is not touched', async () => {
    const w = await ticket();
    const refused = await signUp(w, { ...SIGNUP, birthDate: '2014-01-01' });
    expect(refused.headers.getSetCookie()).toContain('__Host-of_age=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400');

    // proving the address again opens a ticket, but the page and the form both answer as the refusal did
    await googleSignIn(w);
    expect(w.store.tickets.size).toBe(1);
    const page = await w.browser.request('/auth/signup');
    expect(page.status).toBe(403);
    expect(await page.json()).toMatchObject({ reason: 'under-age' });
    await googleSignIn(w);
    const older = await signUp(w, { ...SIGNUP, birthDate: '1990-01-01' });
    expect(older.status).toBe(403);
    expect(await older.json()).toMatchObject({ reason: 'under-age' });
    expect(w.store.tickets.size).toBe(0);
    expect(w.store.accounts.size).toBe(0);

    const other = new Browser(w.base, w.base);
    await googleSignIn({ ...w, browser: other });
    expect((await other.request('/auth/signup', { method: 'POST', json: SIGNUP })).status).toBe(201);
  });

  test('the birthday counts from its own day, on the server\'s date: the day before the 13th is refused, the day itself is not', async () => {
    // the clock stands at 2026-10-21 12:00 UTC
    const before = await ticket({ countryHeader: 'x-country' });
    expect((await signUp(before, { ...SIGNUP, birthDate: '2013-10-22' }, 'US')).status).toBe(403);
    const on = await ticket({ countryHeader: 'x-country' });
    expect((await signUp(on, { ...SIGNUP, birthDate: '2013-10-21' }, 'US')).status).toBe(201);
    expect(Object.keys([...on.store.accounts.values()][0]!)).not.toContain('birthBand');
  });

  test('the 16th birthday in a country that asks for 16: the day before is refused, the day itself is not', async () => {
    const before = await ticket({ countryHeader: 'x-country' });
    expect((await signUp(before, { ...SIGNUP, birthDate: '2010-10-22' }, 'DE')).status).toBe(403);
    const on = await ticket({ countryHeader: 'x-country' });
    expect((await signUp(on, { ...SIGNUP, birthDate: '2010-10-21' }, 'DE')).status).toBe(201);
    expect([...on.store.accounts.values()][0]!.country).toBe('DE');
  });

  test('the country is the one our proxy\'s header names; without the header the highest age holds', async () => {
    const fifteen = { ...SIGNUP, birthDate: '2011-01-01' };
    const germany = await ticket({ countryHeader: 'x-country' });
    expect((await signUp(germany, fifteen, 'DE')).status).toBe(403);
    const israel = await ticket({ countryHeader: 'x-country' });
    expect((await signUp(israel, fifteen, 'IL')).status).toBe(201);
    const none = await ticket({ countryHeader: 'x-country' });
    expect((await signUp(none, fifteen)).status).toBe(403);
    expect(UNKNOWN_COUNTRY_AGE).toBe(16);
  });

  test('a country header is trusted only when the server is told our proxy sets it, and only as one plain code', async () => {
    const fifteen = { ...SIGNUP, birthDate: '2011-01-01' };
    // no COUNTRY_HEADER: a header the client sends itself is not read
    const unset = await ticket();
    expect((await signUp(unset, fifteen, 'IL')).status).toBe(403);
    // a value that is not one capital code (lower case, or two values joined) counts as no country
    for (const value of ['il', 'IL, DE', 'ISR', '']) {
      const w = await ticket({ countryHeader: 'x-country' });
      expect((await signUp(w, fifteen, value)).status, value).toBe(403);
    }
  });

  test('a name the world already shows, in any case, is refused', async () => {
    const w = await ticket();
    await signUp(w, SIGNUP);
    const other = new Browser(w.base, w.base);
    w.google.claims = (nonce, now) => ({ ...new FakeGoogle().claims(nonce, now), sub: 'another', email: 'other@example.com' });
    await googleSignIn({ ...w, browser: other });
    const taken = await other.request('/auth/signup', { method: 'POST', json: { ...SIGNUP, name: 'TESS' } });
    expect(taken.status).toBe(409);
    expect(await taken.json()).toMatchObject({ reason: 'name-taken' });
    expect(w.store.accounts.size).toBe(1);
  });

  test('the name follows the kernel\'s rule, and the date of birth must be a past day of the calendar', async () => {
    const w = await ticket();
    for (const json of [
      { ...SIGNUP, name: '' },
      { ...SIGNUP, name: '   ' },
      { ...SIGNUP, name: 'x'.repeat(17) },
      { ...SIGNUP, name: '<b>Tess</b>' },
      { ...SIGNUP, birthDate: '2026-10-22' },
      { ...SIGNUP, birthDate: '2000-02-30' },
      { ...SIGNUP, birthDate: '2000-13-01' },
      { ...SIGNUP, birthDate: '2000-1-1' },
      { ...SIGNUP, birthDate: 20000101 },
      { ...SIGNUP, birthDate: '1905-10-20' },
      { ...SIGNUP, birthDate: undefined },
    ]) {
      expect((await signUp(w, json)).status, JSON.stringify(json)).toBe(400);
    }
    expect(w.store.accounts.size).toBe(0);
  });

  test('the age is exact on the server\'s UTC date, a leap-day birthday counts from 1 March, and the gate keeps only that the check passed, never a band or the date', () => {
    const born = (text: string) => parseBirthDate(text, Date.UTC(2026, 9, 21))!;
    expect(ageOn(born('2013-10-21'), Date.UTC(2026, 9, 20, 23, 59, 59))).toBe(12);
    expect(ageOn(born('2013-10-21'), Date.UTC(2026, 9, 21, 0, 0, 0))).toBe(13);
    expect(ageOn(born('2012-02-29'), Date.UTC(2025, 1, 28))).toBe(12);
    expect(ageOn(born('2012-02-29'), Date.UTC(2025, 2, 1))).toBe(13);
    expect(ageOn(born('2012-02-29'), Date.UTC(2024, 1, 29))).toBe(12);
    expect(parseBirthDate('1906-10-21', Date.UTC(2026, 9, 21))).toBeDefined();
    expect(parseBirthDate('1905-12-31', Date.UTC(2026, 9, 21))).toBeUndefined();

    const now = Date.UTC(2026, 5, 1);
    expect(ageGate(born('2013-06-02'), 'US', now)).toEqual({ underAge: true });
    expect(ageGate(born('2013-06-01'), 'US', now)).toEqual({ passed: true });
    expect(ageGate(born('2010-06-01'), 'US', now)).toEqual({ passed: true });
    expect(ageGate(born('2008-06-02'), 'US', now)).toEqual({ passed: true });
    expect(ageGate(born('2008-06-01'), 'US', now)).toEqual({ passed: true });
    expect(consentAge('FR')).toBe(15);
    expect(consentAge('CN')).toBe(14);
    expect(consentAge('KR')).toBe(14);
    expect(consentAge('IL')).toBe(13);
    expect(consentAge(undefined)).toBe(16);
  });
});

describe('the session (NEXT 18 e)', () => {
  async function signedIn() {
    const w = await ready();
    await googleSignIn(w);
    await w.browser.request('/auth/signup', { method: 'POST', json: SIGNUP });
    const accountId = [...w.store.accounts.keys()][0]!;
    return { ...w, accountId };
  }

  test('the game\'s endpoints read the player from the session cookie and from nothing else', async () => {
    const w = await signedIn();
    w.players.rows.set(w.accountId, createPlayerRecord(bundle, started(), w.clock.now));
    const state = await w.browser.request('/state');
    expect(state.status).toBe(200);
    expect((await state.json()).state.player.name).toBe('Tess');

    const stranger = new Browser(w.base, w.base);
    expect((await stranger.request('/state')).status).toBe(401);
    const header = await fetch(`${w.base}/state`, { headers: { 'x-player-id': w.accountId } });
    expect(header.status).toBe(401);
  });

  test('a POST from another origin stands for no one, so a forged form on another site cannot act', async () => {
    const w = await signedIn();
    w.players.rows.set(w.accountId, createPlayerRecord(bundle, started(), w.clock.now));
    w.browser.origin = 'https://evil.example.com';
    const action = await w.browser.request('/action', { method: 'POST', json: { version: 1, tick: 0, action: { t: 'carve', name: 'Tess' } } });
    expect(action.status).toBe(401);
    const closing = await w.browser.request('/auth/close', { method: 'POST', json: { close: true } });
    expect(closing.status).toBe(403);
    w.browser.origin = undefined;
    expect((await w.browser.request('/auth/signout', { method: 'POST', json: {} })).status).toBe(403);
    w.browser.origin = APP;
    expect((await w.browser.request('/auth/me')).status).toBe(200);
    expect(w.store.accounts.size).toBe(1);
  });

  test('signing out revokes the session row: the same cookie no longer signs in', async () => {
    const w = await signedIn();
    const token = w.browser.jar.get('__Host-of_session')!;
    const out = await w.browser.request('/auth/signout', { method: 'POST', json: {} });
    expect(out.status).toBe(200);
    expect(w.browser.jar.has('__Host-of_session')).toBe(false);
    const thief = new Browser(w.base, w.base);
    thief.jar.set('__Host-of_session', token);
    expect((await thief.request('/auth/me')).status).toBe(401);
  });

  test('a session ends after thirty days', async () => {
    const w = await signedIn();
    w.clock.now += 30 * 24 * 60 * 60 * 1000;
    expect((await w.browser.request('/auth/me')).status).toBe(401);
  });

  test('closing an account hides it at once and ends its sessions; it needs the word', async () => {
    const w = await signedIn();
    expect((await w.browser.request('/auth/close', { method: 'POST', json: {} })).status).toBe(400);
    expect(w.store.closedAt.size).toBe(0);
    const closed = await w.browser.request('/auth/close', { method: 'POST', json: { close: true } });
    expect(closed.status).toBe(200);
    expect(await closed.json()).toEqual({ closed: true, restorableDays: 30 });
    expect(w.store.closedAt.size).toBe(1);
    expect(w.store.sessions.size).toBe(0);
    expect((await w.browser.request('/auth/me')).status).toBe(401);
  });

  test('signing in to a closed account brings it back and says so', async () => {
    const w = await signedIn();
    await w.browser.request('/auth/close', { method: 'POST', json: { close: true } });
    w.clock.now += 29 * 24 * 60 * 60 * 1000;
    expect(outcome(await googleSignIn(w))).toBe('restored');
    expect(w.store.closedAt.size).toBe(0);
    expect((await w.browser.request('/auth/me')).status).toBe(200);
  });

  test('sign-in paths answer only their method, and an unknown one is not found', async () => {
    const w = await ready();
    expect((await w.browser.request('/auth/me', { method: 'POST', json: {} })).status).toBe(405);
    expect((await w.browser.request('/auth/nothing')).status).toBe(404);
    expect((await w.browser.request('/auth/email/link?token=short')).status).toBe(400);
  });
});
