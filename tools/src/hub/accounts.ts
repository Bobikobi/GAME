/**
 * The `accounts` section of hub-data, the players counter (DECISIONS.md, 2026-10-31): the game server's GET /stats
 * (server/src/stats.ts), read from the origin in GAME_SERVER_ORIGIN. The hourly refresh takes that name from a
 * repository variable, so it never enters the repo. Not named, a name that is not an https origin, unreachable, an
 * error, an answer of another shape or more than 5 seconds: `accounts` and `sources.accounts` stay null, and the hub
 * says the count is unknown, never a guessed 0.
 */
import type { HubAccounts } from '@game/schema/hub';

/** The longest the build waits for the server. */
export const ACCOUNTS_TIMEOUT_MS = 5_000;

/** What the build needs: the two counts, or a thrown error when they cannot be had. */
export type AccountsReader = () => Promise<HubAccounts>;

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

/** The https origin GAME_SERVER_ORIGIN names, or null with the reason when it names none. */
export function serverOrigin(env: NodeJS.ProcessEnv = process.env): { origin: string } | { origin: null; reason: string } {
  const raw = env['GAME_SERVER_ORIGIN']?.trim();
  if (!raw) return { origin: null, reason: 'GAME_SERVER_ORIGIN is not set' };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { origin: null, reason: 'GAME_SERVER_ORIGIN is not a URL' };
  }
  // the value is never printed: only its shape is wrong
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search !== '' || url.hash !== '' || url.username !== '' || url.password !== '') {
    return { origin: null, reason: 'GAME_SERVER_ORIGIN is not an https origin' };
  }
  return { origin: url.origin };
}

/** Reads GET /stats at `origin`; throws on anything but 200 and the two counts within the time limit. */
export function statsReader(origin: string, fetcher: typeof fetch = fetch, timeoutMs = ACCOUNTS_TIMEOUT_MS): AccountsReader {
  return async () => {
    const response = await fetcher(`${origin}/stats`, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`the game server's counter answered ${response.status}`);
    const body = (await response.json()) as { accounts?: unknown; new_7d?: unknown };
    if (!isCount(body.accounts) || !isCount(body.new_7d) || body.new_7d > body.accounts) throw new Error("the game server's counter answered another shape");
    return { open: body.accounts, new_7d: body.new_7d };
  };
}

/** The reader from the environment, or null (with a log line saying why) when it names no server. */
export function accountsReader(env: NodeJS.ProcessEnv = process.env, log: (line: string) => void = console.log): AccountsReader | null {
  const named = serverOrigin(env);
  if (named.origin === null) {
    log(`note: the players count is unknown: ${named.reason}`);
    return null;
  }
  return statsReader(named.origin);
}
