/**
 * The players counter (DECISIONS 2026-10-31, "The players counter"): how many accounts are open, and how many of them signed up in
 * the last 7 days. GET /stats answers it to anyone, and the hourly hub-data refresh reads it (tools/src/hub/accounts.ts),
 * so the number of players is read from the sign-in store, never guessed. Two counts leave the database and
 * nothing else: no id, name, email, country or time of any account.
 */
import type { Pool } from 'pg';

/** "New" is an account opened this long before the request. */
export const NEW_ACCOUNT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** The counts are kept this long, so a stranger repeating the request reaches the database once a minute at most. */
export const STATS_CACHE_MS = 60 * 1000;

export interface AccountCounts {
  /** open accounts: a closed one, erased or not, is not counted */
  accounts: number;
  /** of those, the ones opened in the last NEW_ACCOUNT_WINDOW_MS */
  new_7d: number;
}

/** The counts as postgres holds them, at the server's instant `now` (never the database's clock). */
export function pgAccountCounts(pool: Pool): (now: number) => Promise<AccountCounts> {
  return async (now) => {
    const { rows } = await pool.query<{ accounts: string; recent: string }>(
      'select count(*) as accounts, count(*) filter (where created_at >= $1) as recent from accounts where closed_at is null',
      [new Date(now - NEW_ACCOUNT_WINDOW_MS)],
    );
    const row = rows[0];
    return { accounts: Number(row?.accounts ?? 0), new_7d: Number(row?.recent ?? 0) };
  };
}

/**
 * One read per `cacheMs`, shared by every request inside it, the ones in flight too. A read that fails is not
 * kept, so the next request asks again.
 */
export function cachedCounts(read: (now: number) => Promise<AccountCounts>, cacheMs = STATS_CACHE_MS): (now: number) => Promise<AccountCounts> {
  let kept: { at: number; counts: Promise<AccountCounts> } | undefined;
  return (now) => {
    if (kept && now >= kept.at && now - kept.at < cacheMs) return kept.counts;
    const counts = read(now);
    const entry = { at: now, counts };
    kept = entry;
    counts.catch(() => {
      if (kept === entry) kept = undefined;
    });
    return counts;
  };
}
