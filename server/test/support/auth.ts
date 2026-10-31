/**
 * Helpers for the sign-in tests (NEXT 18 e): a store in memory that keeps the rules the postgres one keeps,
 * a Google that answers from a key pair made here, and a browser that keeps its cookies and sends the Origin a
 * browser would. They assert nothing; the tests do.
 */
import { createHash, generateKeyPairSync, sign, type KeyObject } from 'node:crypto';

import type { AuthStore, EmailLink, NewAccount, NewGame, OAuthFlow, SignupTicket } from '../../src/auth/store';
import type { ProviderId } from '../../src/auth/provider';

export class MemoryAuthStore implements AuthStore {
  flows = new Map<string, OAuthFlow>();
  links = new Map<string, EmailLink & { usedAt?: number }>();
  tickets = new Map<string, SignupTicket>();
  sessions = new Map<string, { accountId: string; expiresAt: number; revokedAt?: number }>();
  accounts = new Map<string, NewAccount>();
  closedAt = new Map<string, number>();
  identities = new Map<string, string>();
  /** the game each account was made with (NEXT 18 d), as postgres writes it in the same transaction */
  games = new Map<string, NewGame>();
  private ids = 0;

  async saveFlow(flow: OAuthFlow) {
    this.flows.set(flow.stateHash, { ...flow });
  }
  async takeFlow(stateHash: string) {
    const flow = this.flows.get(stateHash);
    this.flows.delete(stateHash);
    return flow;
  }
  async saveEmailLink(link: EmailLink) {
    this.links.set(link.tokenHash, { ...link });
  }
  async countEmailLinks(email: string, since: number) {
    return [...this.links.values()].filter((link) => link.email === email && link.createdAt >= since).length;
  }
  async useEmailLink(tokenHash: string, now: number) {
    const link = this.links.get(tokenHash);
    if (!link) return undefined;
    if (link.usedAt !== undefined) return 'used' as const;
    link.usedAt = now;
    return { tokenHash, email: link.email, createdAt: link.createdAt, expiresAt: link.expiresAt };
  }
  async accountForIdentity(provider: ProviderId, subject: string) {
    return this.identities.get(`${provider}:${subject}`);
  }
  async accountForEmail(email: string) {
    return [...this.accounts].find(([, account]) => account.email === email)?.[0];
  }
  async addIdentity(provider: ProviderId, subject: string, accountId: string) {
    if (!this.identities.has(`${provider}:${subject}`)) this.identities.set(`${provider}:${subject}`, accountId);
  }
  async dropIdentities(accountId: string, providers: readonly ProviderId[], now: number) {
    let count = 0;
    for (const [key, id] of this.identities) {
      if (id === accountId && providers.includes(key.slice(0, key.indexOf(':')) as ProviderId)) {
        this.identities.delete(key);
        count++;
      }
    }
    if (count > 0) for (const session of this.sessions.values()) if (session.accountId === accountId && session.revokedAt === undefined) session.revokedAt = now;
    return count;
  }
  async nameTaken(name: string) {
    return [...this.accounts.values()].some((account) => account.name.toLowerCase() === name.toLowerCase());
  }
  async saveTicket(ticket: SignupTicket) {
    this.tickets.set(ticket.ticketHash, { ...ticket });
  }
  async loadTicket(ticketHash: string) {
    return this.tickets.get(ticketHash);
  }
  async dropTicket(ticketHash: string) {
    this.tickets.delete(ticketHash);
  }
  async createAccount(account: NewAccount, ticket: SignupTicket, game: NewGame) {
    const accounts = [...this.accounts.values()];
    if (accounts.some((other) => other.name.toLowerCase() === account.name.toLowerCase())) return 'name-taken' as const;
    if (accounts.some((other) => other.email === account.email) || this.identities.has(`${ticket.provider}:${ticket.subject}`)) {
      return 'email-taken' as const;
    }
    const accountId = `00000000-0000-4000-8000-${String(++this.ids).padStart(12, '0')}`;
    this.accounts.set(accountId, { ...account });
    this.identities.set(`${ticket.provider}:${ticket.subject}`, accountId);
    this.tickets.delete(ticket.ticketHash);
    this.games.set(accountId, structuredClone(game));
    return { accountId };
  }
  async createSession(tokenHash: string, accountId: string, _createdAt: number, expiresAt: number) {
    this.sessions.set(tokenHash, { accountId, expiresAt });
  }
  async sessionAccount(tokenHash: string, now: number) {
    const session = this.sessions.get(tokenHash);
    return session && session.revokedAt === undefined && session.expiresAt > now ? session.accountId : undefined;
  }
  async revokeSession(tokenHash: string, now: number) {
    const session = this.sessions.get(tokenHash);
    if (session && session.revokedAt === undefined) session.revokedAt = now;
  }
  async account(accountId: string) {
    const account = this.closedAt.has(accountId) ? undefined : this.accounts.get(accountId);
    return account && { name: account.name, email: account.email };
  }
  async isClosed(accountId: string) {
    return this.closedAt.has(accountId);
  }
  async closeAccount(accountId: string, now: number) {
    if (!this.accounts.has(accountId) || this.closedAt.has(accountId)) return;
    this.closedAt.set(accountId, now);
    for (const [hash, session] of this.sessions) if (session.accountId === accountId) this.sessions.delete(hash);
  }
  async reopenAccount(accountId: string) {
    return this.closedAt.delete(accountId);
  }
  async eraseClosed(now: number, graceMs: number) {
    let n = 0;
    for (const [accountId, closed] of this.closedAt) {
      if (closed > now - graceMs) continue;
      this.closedAt.delete(accountId);
      this.accounts.delete(accountId);
      this.games.delete(accountId);
      for (const [key, id] of this.identities) if (id === accountId) this.identities.delete(key);
      n++;
    }
    return n;
  }
  async sweep(now: number) {
    for (const [key, flow] of this.flows) if (flow.expiresAt <= now) this.flows.delete(key);
    for (const [key, link] of this.links) if (link.expiresAt <= now) this.links.delete(key);
    for (const [key, ticket] of this.tickets) if (ticket.expiresAt <= now) this.tickets.delete(key);
  }
}

export const CLIENT_ID = '322116273473-test.apps.googleusercontent.com';
export const CLIENT_SECRET = 'test-secret-not-a-real-one';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const KEYS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

export interface IdClaims {
  iss?: unknown;
  aud?: unknown;
  azp?: unknown;
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  exp?: unknown;
  iat?: unknown;
  nonce?: unknown;
}

function keyPair(): { privateKey: KeyObject; jwk: Record<string, unknown> } {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { privateKey, jwk: { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' } };
}

/**
 * Google as the tests need it: the token endpoint answers with an id token signed by a key made here, and
 * the keys endpoint publishes that key. `claims` shapes the next id token from the nonce the flow sent;
 * `forger` signs with a key Google never published.
 */
export class FakeGoogle {
  private readonly real = keyPair();
  private readonly forger = keyPair();
  /** every form the token endpoint received */
  readonly exchanges: URLSearchParams[] = [];
  claims: (nonce: string, now: number) => IdClaims = (nonce, now) => ({
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: '1234567890',
    email: 'Player@Example.com',
    email_verified: true,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + 3600,
    nonce,
  });
  forge = false;
  tokenStatus = 200;
  /** how the token endpoint fails, when it does: the call rejects, answers a page that is not JSON, or never answers */
  tokenFault: 'reject' | 'not-json' | 'hang' | undefined;
  /** the nonce of the last authorize URL, read by the test from the redirect */
  nonce = '';
  clock = () => Date.now();

  idToken(claims: IdClaims, forge = this.forge): string {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const key = forge ? this.forger.privateKey : this.real.privateKey;
    const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), key).toString('base64url');
    return `${header}.${payload}.${signature}`;
  }

  readonly fetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url === KEYS_URL) return Response.json({ keys: [this.real.jwk] });
    if (url === TOKEN_URL) {
      const form = new URLSearchParams(String(init?.body ?? ''));
      this.exchanges.push(form);
      if (this.tokenFault === 'reject') throw new TypeError('fetch failed');
      if (this.tokenFault === 'not-json') return new Response('<html>busy</html>', { status: 200, headers: { 'content-type': 'text/html' } });
      if (this.tokenFault === 'hang') {
        // a Google that never answers: only the caller's signal ends the wait
        return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)));
      }
      if (this.tokenStatus !== 200) return Response.json({ error: 'invalid_grant' }, { status: this.tokenStatus });
      return Response.json({ access_token: 'unused', token_type: 'Bearer', id_token: this.idToken(this.claims(this.nonce, this.clock())) });
    }
    throw new Error(`The fake Google was asked for ${url}`);
  };
}

export const DISCORD_CLIENT_ID = '1300000000000000000';
export const DISCORD_CLIENT_SECRET = 'discord-test-secret-not-a-real-one';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_ME_URL = 'https://discord.com/api/v10/users/@me';

/**
 * Discord as the tests need it: the token endpoint hands out an access token, and `/users/@me` answers for
 * that token alone with `me`. A call with any other token is refused, as Discord refuses it.
 */
export class FakeDiscord {
  /** every form the token endpoint received */
  readonly exchanges: URLSearchParams[] = [];
  /** every Authorization header `/users/@me` was asked with */
  readonly asked: string[] = [];
  me: Record<string, unknown> = { id: '80351110224678912', username: 'tess', email: 'Player@Example.com', verified: true };
  tokenStatus = 200;
  /** how the token endpoint fails, when it does: as `FakeGoogle.tokenFault` */
  tokenFault: 'reject' | 'not-json' | 'hang' | undefined;
  private readonly token = 'discord-access-token';

  readonly fetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url === DISCORD_TOKEN_URL) {
      this.exchanges.push(new URLSearchParams(String(init?.body ?? '')));
      if (this.tokenFault === 'reject') throw new TypeError('fetch failed');
      if (this.tokenFault === 'not-json') return new Response('<html>busy</html>', { status: 200, headers: { 'content-type': 'text/html' } });
      if (this.tokenFault === 'hang') {
        return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)));
      }
      if (this.tokenStatus !== 200) return Response.json({ error: 'invalid_grant' }, { status: this.tokenStatus });
      return Response.json({ access_token: this.token, token_type: 'Bearer', expires_in: 604800, refresh_token: 'unused', scope: 'identify email' });
    }
    if (url === DISCORD_ME_URL) {
      const authorization = new Headers(init?.headers).get('authorization') ?? '';
      this.asked.push(authorization);
      if (authorization !== `Bearer ${this.token}`) return Response.json({ message: '401: Unauthorized', code: 0 }, { status: 401 });
      return Response.json(this.me);
    }
    throw new Error(`The fake Discord was asked for ${url}`);
  };
}

/** The parts of a Content-Security-Policy header, by directive. */
function policy(header: string | null): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of (header ?? '').split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) directives.set(name.toLowerCase(), sources);
  }
  return directives;
}

/** Whether a CSP source list lets a page of `self` send a form to `target` (form-action has no fallback to default-src). */
function formMayGo(sources: string[] | undefined, self: string, target: URL): boolean {
  if (sources === undefined) return true;
  return sources.some((source) => (source === "'self'" ? target.origin === self : source.replace(/\/$/, '') === target.origin));
}

/** The email link page as a browser opened it. */
export interface OpenedPage {
  response: Response;
  /** where the browser stands, fragment included */
  url: URL;
  html: string;
}

/**
 * A browser with a cookie jar: it sends its cookies, and on a non-GET call the Origin of the page it stands
 * on (`origin`, the game's page, unless a test moves it). It never follows a redirect by itself. The email
 * link page is opened and pressed as a browser does it (`open`, `press`): the Origin of that POST comes from
 * the page's own referrer policy, never from the test.
 */
export class Browser {
  readonly jar = new Map<string, string>();

  constructor(
    readonly base: string,
    public origin: string | undefined,
  ) {}

  /**
   * Open a link by navigating to it: the fragment stays in the browser, a redirect is followed with its
   * own fragment (or the link's, when it has none), and the page it lands on is returned.
   */
  async open(link: string): Promise<OpenedPage> {
    let url = new URL(link, this.base);
    for (let hop = 0; hop < 3; hop++) {
      const response = await this.request(`${url.origin}${url.pathname}${url.search}`, { headers: { accept: 'text/html' } });
      const location = response.headers.get('location');
      if (response.status < 300 || response.status >= 400 || location === null) return { response, url, html: await response.text() };
      const next = new URL(location, url);
      if (next.hash === '') next.hash = url.hash;
      url = next;
    }
    throw new Error(`more than three redirects from ${link}`);
  }

  /**
   * Press the link page's button as a browser would: the page's script runs only when the CSP names its
   * hash, the form posts with the Origin the page's referrer policy gives (Fetch: under `no-referrer` a
   * POST carries `Origin: null`), and CSP `form-action` is checked on the action and on the redirect that
   * answers it, as Chromium and WebKit do. Throws where a browser would stop.
   */
  async press(page: OpenedPage): Promise<Response> {
    const csp = policy(page.response.headers.get('content-security-policy'));
    const script = /<script>([\s\S]*?)<\/script>/.exec(page.html)?.[1];
    if (script === undefined) throw new Error('the page has no script to read the link');
    const hash = `'sha256-${createHash('sha256').update(script, 'utf8').digest('base64')}'`;
    if (!(csp.get('script-src') ?? csp.get('default-src') ?? []).includes(hash)) throw new Error('the CSP does not allow the page\'s script');
    const action = /<form method="post" action="([^"]+)">/.exec(page.html)?.[1];
    if (action === undefined) throw new Error('the page has no form');

    // the page's script against the few parts of a document it touches
    const input = { value: '' };
    const button = { disabled: /<button[^>]* disabled/.test(page.html) };
    const form = { hidden: false, elements: { token: input }, querySelector: () => button };
    const missing = { hidden: true };
    const location = { hash: page.url.hash, pathname: page.url.pathname };
    const history = { replaceState: (_state: unknown, _title: string, path: string) => Object.assign(location, { hash: '', pathname: path }) };
    const document = { forms: [form], getElementById: (id: string) => (id === 'missing' ? missing : null) };
    new Function('document', 'location', 'history', script)(document, location, history);
    if (location.hash !== '') throw new Error('the token stayed in the address bar');
    if (form.hidden || button.disabled) throw new Error('the page offers no button to press');

    const self = page.url.origin;
    const target = new URL(action, page.url);
    if (!formMayGo(csp.get('form-action'), self, target)) throw new Error(`CSP form-action blocks the form's post to ${target.origin}`);
    const referrerPolicy = page.response.headers.get('referrer-policy') ?? 'strict-origin-when-cross-origin';
    const origin = referrerPolicy === 'no-referrer' || (referrerPolicy === 'same-origin' && target.origin !== self) ? 'null' : self;
    const response = await this.request(target.toString(), { method: 'POST', form: { token: input.value }, headers: { origin } });
    const location3xx = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location3xx !== null && !formMayGo(csp.get('form-action'), self, new URL(location3xx, target))) {
      throw new Error(`CSP form-action blocks the redirect to ${new URL(location3xx, target).origin}`);
    }
    return response;
  }

  async request(path: string, init: { method?: string; json?: unknown; form?: Record<string, string>; headers?: Record<string, string> } = {}): Promise<Response> {
    const headers: Record<string, string> = { accept: 'application/json', ...init.headers };
    if (this.jar.size > 0) headers.cookie = [...this.jar].map(([name, value]) => `${name}=${value}`).join('; ');
    if (this.origin !== undefined && (init.method ?? 'GET') !== 'GET' && init.headers?.origin === undefined) headers.origin = this.origin;
    let body: string | undefined;
    if (init.json !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(init.json);
    } else if (init.form !== undefined) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(init.form).toString();
    }
    const url = path.startsWith('http') ? path : `${this.base}${path}`;
    const response = await fetch(url, { method: init.method ?? 'GET', headers, body, redirect: 'manual' });
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const at = pair!.indexOf('=');
      const name = pair!.slice(0, at);
      const value = pair!.slice(at + 1);
      if (/Max-Age=0(?:;|$)/.test(line)) this.jar.delete(name);
      else this.jar.set(name, value);
    }
    return response;
  }
}
