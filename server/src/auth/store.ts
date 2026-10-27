import type { Books, PlayerRecord } from '../api';
import type { ProviderId } from './provider';

/** How long a closed account can still be brought back by signing in; after it the details are erased (owner, 23.10). */
export const CLOSED_ACCOUNT_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

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

/**
 * The account's game as the sign-up starts it (NEXT 18 d): its first state row, and for an opening the
 * phone handed over and the server kept, the first `action_log` row and the gold rows it made.
 */
export interface NewGame {
  record: PlayerRecord;
  books?: Books;
}

export interface NewAccount {
  email: string;
  name: string;
  /** the proxy's country, kept with the fact that the age check passed; the band and the date are not kept */
  country?: string;
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

  /** The account an identity signs in to, open or closed (a closed one is brought back by signing in). */
  accountForIdentity(provider: ProviderId, subject: string): Promise<string | undefined>;
  accountForEmail(email: string): Promise<string | undefined>;
  /** Whether the account is closed and still inside its grace. */
  isClosed(accountId: string): Promise<boolean>;
  addIdentity(provider: ProviderId, subject: string, accountId: string): Promise<void>;

  /** Whether a live account already has the name, in any case: the sign-up asks before it replays an opening. */
  nameTaken(name: string): Promise<boolean>;

  saveTicket(ticket: SignupTicket): Promise<void>;
  loadTicket(ticketHash: string): Promise<SignupTicket | undefined>;
  dropTicket(ticketHash: string): Promise<void>;
  /** The account, its first identity, its game and the end of the ticket, in one transaction; or why it was not made. */
  createAccount(account: NewAccount, ticket: SignupTicket, game: NewGame): Promise<{ accountId: string } | 'name-taken' | 'email-taken'>;

  createSession(tokenHash: string, accountId: string, createdAt: number, expiresAt: number): Promise<void>;
  /** The account a session stands for while it is neither revoked nor past its end. */
  sessionAccount(tokenHash: string, now: number): Promise<string | undefined>;
  revokeSession(tokenHash: string, now: number): Promise<void>;
  /** The account while it is open; a closed account is hidden and answers undefined. */
  account(accountId: string): Promise<{ name: string; email: string } | undefined>;
  /**
   * Close the account at `now`: hidden at once, its sessions ended, its board places taken down. Nothing
   * is deleted until `eraseClosed` (the 30 days of the owner's answer of 23.10).
   */
  closeAccount(accountId: string, now: number): Promise<void>;
  /** Bring a closed account back; true when it was closed and not yet erased. */
  reopenAccount(accountId: string): Promise<boolean>;
  /**
   * Erase the personal details of every account closed more than `graceMs` before `now`: email, name,
   * identities, sessions, the game state and board places. The gold ledger and the action log keep
   * their rows under the account number. Running it again changes nothing. Returns how many accounts it erased.
   */
  eraseClosed(now: number, graceMs: number): Promise<number>;

  /** Remove the flows, links, tickets and sessions whose end has passed. */
  sweep(now: number): Promise<void>;
}
