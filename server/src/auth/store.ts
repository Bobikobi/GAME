import type { BirthBand } from './age';
import type { ProviderId } from './provider';

/** Instants are milliseconds since the epoch, from the server's clock, so a test can move time. */
export interface OAuthFlow {
  stateHash: string;
  provider: Exclude<ProviderId, 'email'>;
  verifier: string;
  nonce: string;
  createdAt: number;
  expiresAt: number;
}

export interface EmailLink {
  tokenHash: string;
  email: string;
  createdAt: number;
  expiresAt: number;
}

export interface SignupTicket {
  ticketHash: string;
  provider: ProviderId;
  subject: string;
  email: string;
  createdAt: number;
  expiresAt: number;
}

export interface NewAccount {
  email: string;
  name: string;
  birthBand: BirthBand;
}

/**
 * What sign-in keeps (migration 0003): the OAuth round trips, the email links, the sign-ups that wait for a
 * name, the sessions, and the accounts with their identities (0001). Every token arrives hashed.
 */
export interface AuthStore {
  saveFlow(flow: OAuthFlow): Promise<void>;
  /** The flow of a state, removed as it is read: a state answers once. */
  takeFlow(stateHash: string): Promise<OAuthFlow | undefined>;

  saveEmailLink(link: EmailLink): Promise<void>;
  /** How many links were made for an address since an instant: the send is held back past a few. */
  countEmailLinks(email: string, since: number): Promise<number>;
  /** Mark a link used and return it; `used` when an earlier request already did, undefined when it never existed. */
  useEmailLink(tokenHash: string, now: number): Promise<EmailLink | 'used' | undefined>;

  accountForIdentity(provider: ProviderId, subject: string): Promise<string | undefined>;
  accountForEmail(email: string): Promise<string | undefined>;
  addIdentity(provider: ProviderId, subject: string, accountId: string): Promise<void>;

  saveTicket(ticket: SignupTicket): Promise<void>;
  loadTicket(ticketHash: string): Promise<SignupTicket | undefined>;
  dropTicket(ticketHash: string): Promise<void>;
  /** The account, its first identity and the end of the ticket, in one transaction; or why it was not made. */
  createAccount(account: NewAccount, ticket: SignupTicket): Promise<{ accountId: string } | 'name-taken' | 'email-taken'>;

  createSession(tokenHash: string, accountId: string, createdAt: number, expiresAt: number): Promise<void>;
  /** The account a session stands for while it is neither revoked nor past its end. */
  sessionAccount(tokenHash: string, now: number): Promise<string | undefined>;
  revokeSession(tokenHash: string, now: number): Promise<void>;
  account(accountId: string): Promise<{ name: string; email: string } | undefined>;
  /** Delete the account and, by cascade, every row that names it (NEXT 18 e). */
  closeAccount(accountId: string): Promise<void>;

  /** Remove the flows, links, tickets and sessions whose end has passed. */
  sweep(now: number): Promise<void>;
}
