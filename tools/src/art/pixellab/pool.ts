/**
 * The account pool. Each account is a token file named in `tools/kit-gen/pixellab/pool.json`, in a fixed order whose
 * position is the account's index (a file's position in a sorted listing is not an identity: the trial swapped which
 * account sat in which file). The pool reads every balance once, hands a job to the account that has room, and holds
 * its slots: an account runs at most `slots` jobs at a time (a trial account has one animate slot, tier 2 has ten).
 *
 * Choosing: of the accounts with the generations and a free slot, the one with the fewest generations left that still
 * covers the job, so the small trial accounts are used up first and a big account keeps its room for a big job. A job
 * bound to a character is bound to the account that made the character (a character belongs to its account);
 * pictures cross accounts freely.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { Client, type Balance, type ClientOptions, type Http } from './api.js';

export interface PoolConfigAccount {
  /** The token file, in the secrets directory. A file that is not there is an account that is not available. */
  file: string;
  /** A name for the ledger and the reports, not the file's and not secret. */
  label: string;
  slots: number;
  /** `paid` is an account the owner funded; `free` is a trial account that refills a little each day. An account that does not say is `paid`. */
  plan: 'free' | 'paid';
  /** May the nightly job spend on it. Only a `free` account can say yes: a config that marks a paid one is refused. */
  nightly: boolean;
}

export interface PoolConfig {
  dir: string;
  accounts: PoolConfigAccount[];
}

export function expandHome(path: string): string {
  return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
}

export function parsePoolConfig(text: string): PoolConfig {
  const raw = JSON.parse(text) as Partial<PoolConfig>;
  if (!Array.isArray(raw.accounts) || raw.accounts.length === 0) throw new Error('pool.json: "accounts" must list at least one account');
  const accounts = raw.accounts.map((a, i) => {
    if (typeof a?.file !== 'string' || a.file === '') throw new Error(`pool.json: account ${i} has no "file"`);
    const slots = a.slots ?? 1;
    if (!Number.isInteger(slots) || slots < 1) throw new Error(`pool.json: account ${i} needs "slots" of 1 or more`);
    const plan = a.plan ?? 'paid';
    if (plan !== 'free' && plan !== 'paid') throw new Error(`pool.json: account ${i} has "plan" ${JSON.stringify(plan)}, expected "free" or "paid"`);
    const nightly = a.nightly ?? false;
    if (typeof nightly !== 'boolean') throw new Error(`pool.json: account ${i} needs "nightly" to be true or false`);
    if (nightly && plan !== 'free') throw new Error(`pool.json: account ${i} (${a.label ?? a.file}) is a paid account and cannot be marked "nightly"`);
    return { file: a.file, label: a.label ?? `acct${i}`, slots, plan, nightly };
  });
  return { dir: raw.dir ?? process.env['PIXELLAB_SECRETS_DIR'] ?? join(homedir(), '.claude', 'secrets'), accounts };
}

/** The indexes the nightly job may spend on: the free accounts that say so. Never a paid one. */
export function nightlyIndexes(config: PoolConfig): number[] {
  return config.accounts.flatMap((a, i) => (a.nightly && a.plan === 'free' ? [i] : []));
}

export type TokenReader = (config: PoolConfig, account: PoolConfigAccount) => string | null;

/** Reads a token file inside the code that uses it. The value goes to a `Client` and nowhere else. */
export const readTokenFile: TokenReader = (config, account) => {
  const path = join(expandHome(config.dir), account.file);
  return existsSync(path) ? readFileSync(path, 'utf8').trim() : null;
};

export interface PoolAccount {
  index: number;
  label: string;
  slots: number;
  client: Client;
  /** Generations on the account when the run read them, less what the run has admitted since. */
  left: number;
  usd: number;
  busy: number;
  /** Set when the server refused the token: the account takes no more jobs. */
  dead: string | null;
}

export type Choice =
  | { ok: true; account: PoolAccount }
  /** Wait: an account with room is busy. */
  | { ok: false; reason: 'busy' }
  /** No account has the generations (or the pinned one does not): a job that no wait will help. */
  | { ok: false; reason: 'no-room'; best: number; pinned: number | null };

export class Pool {
  private constructor(readonly accounts: PoolAccount[]) {}

  /** Opens the pool: builds a client for each token that is there and reads each balance (the only call a dry run makes). */
  static async open(config: PoolConfig, readToken: TokenReader, http: Http, options: ClientOptions = {}, say: (t: string) => void = () => {}): Promise<Pool> {
    const accounts: PoolAccount[] = [];
    for (const [index, entry] of config.accounts.entries()) {
      const token = readToken(config, entry);
      if (token === null || token === '') {
        say(`account ${index} (${entry.label}): no token file, skipped`);
        continue;
      }
      const client = new Client(token, entry.label, http, options);
      let balance: Balance;
      try {
        balance = await client.balance();
      } catch (error) {
        say(`account ${index} (${entry.label}): balance not readable (${error instanceof Error ? error.message.slice(0, 120) : 'error'}), skipped`);
        continue;
      }
      accounts.push({ index, label: entry.label, slots: entry.slots, client, left: balance.generations, usd: balance.usd, busy: 0, dead: null });
    }
    return new Pool(accounts);
  }

  /** For tests and for a pool built without the network. */
  static of(accounts: PoolAccount[]): Pool {
    return new Pool(accounts);
  }

  byIndex(index: number): PoolAccount | undefined {
    return this.accounts.find((a) => a.index === index);
  }

  /** Who takes a job of `cost` generations. `pin` is the account index a character binds the job to. */
  choose(cost: number, pin: number | null = null, ignoreSlots = false): Choice {
    const live = this.accounts.filter((a) => a.dead === null && (pin === null || a.index === pin));
    const fits = live.filter((a) => a.left >= cost);
    if (fits.length === 0) {
      const best = Math.max(0, ...live.map((a) => a.left));
      return { ok: false, reason: 'no-room', best, pinned: pin === null ? null : (this.byIndex(pin)?.left ?? 0) };
    }
    const free = fits.filter((a) => ignoreSlots || a.busy < a.slots);
    if (free.length === 0) return { ok: false, reason: 'busy' };
    free.sort((a, b) => a.left - b.left || a.index - b.index);
    return { ok: true, account: free[0] as PoolAccount };
  }

  /** Takes a slot and sets the generations aside. */
  admit(account: PoolAccount, cost: number): void {
    account.busy += 1;
    account.left -= cost;
  }

  release(account: PoolAccount, cost: number, charged: number | null): void {
    account.busy -= 1;
    // the reserve was an estimate: put back the difference between it and what the account really lost
    if (charged !== null) account.left += cost - charged;
  }

  total(): number {
    return this.accounts.reduce((n, a) => n + a.left, 0);
  }
}
