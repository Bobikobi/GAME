/**
 * Helpers for the sign-in tests (NEXT 18 e): a store in memory that keeps the rules the postgres one keeps,
 * a Google that answers from a key pair made here, and a browser that keeps its cookies and sends an Origin.
 * They assert nothing; the tests do.
 */
import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';

import type { AuthStore, EmailLink, NewAccount, NewGame, OAuthFlow, SignupTicket } from '../../src/auth/store';
import type { ProviderId } from '../../src/auth/provider';

export class MemoryAuthStore implements AuthStore {
  flows = new Map<string, OAuthFlow>();
  links = new Map<string, EmailLink & { usedAt?: number }>();
  tickets = new Map<string, SignupTicket>();
  sessions = new Map<string, { accountId: string; expiresAt: number; revokedAt?: number }>();
  accounts = new Map<string, NewAccount>();
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
    const account = this.accounts.get(accountId);
    return account && { name: account.name, email: account.email };
  }
  async closeAccount(accountId: string) {
    this.accounts.delete(accountId);
    this.games.delete(accountId);
    for (const [key, id] of this.identities) if (id === accountId) this.identities.delete(key);
    for (const [hash, session] of this.sessions) if (session.accountId === accountId) this.sessions.delete(hash);
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
      if (this.tokenStatus !== 200) return Response.json({ error: 'invalid_grant' }, { status: this.tokenStatus });
      return Response.json({ access_token: 'unused', token_type: 'Bearer', id_token: this.idToken(this.claims(this.nonce, this.clock())) });
    }
    throw new Error(`The fake Google was asked for ${url}`);
  };
}

/** A browser with a cookie jar: it sends its cookies and an Origin, and never follows a redirect. */
export class Browser {
  readonly jar = new Map<string, string>();

  constructor(
    readonly base: string,
    public origin: string | undefined,
  ) {}

  async request(path: string, init: { method?: string; json?: unknown; form?: Record<string, string>; headers?: Record<string, string> } = {}): Promise<Response> {
    const headers: Record<string, string> = { accept: 'application/json', ...init.headers };
    if (this.jar.size > 0) headers.cookie = [...this.jar].map(([name, value]) => `${name}=${value}`).join('; ');
    if (this.origin !== undefined && (init.method ?? 'GET') !== 'GET') headers.origin = this.origin;
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
