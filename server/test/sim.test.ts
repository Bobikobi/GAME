/**
 * The simulated player in CI (NEXT 18 g): a starter's whole opening, the first outing and the first sale,
 * played through the real HTTP API by the real client (`RemoteSession` over `fetchWire`), and the state the
 * server ends on compared with the same log replayed on the laptop: `serialize`, byte for byte.
 *
 * Against postgres when `DATABASE_URL` names it (CI's service container), in memory otherwise, so a
 * laptop without a database still runs the same script and the same comparison.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import {
  type Action,
  type Bundle,
  canonical,
  newState,
  publicState,
  replay,
  serialize,
} from '@game/kernel';

import { RemoteSession, fetchWire } from '../../game/src/remote.js';
import { loadBundle } from '../../tools/test/helpers/world.js';
import type { LogEntry } from './sim/player.js';
import { Player } from './sim/player.js';
import { STARTS, playSession } from './sim/session.js';
import { type Account, type BookRow, type Rig, startRig } from './sim/rig.js';

let bundle: Bundle;
let rig: Rig;

/** One fixed seed per starter: the draws are the server's, and a run that replays is the same run. */
const SEEDS: Record<string, number> = {
  'core/forager': 2026,
  'core/digger': 2027,
  'core/explorer': 2028,
};

/** The quests the opening and the outing finish, whatever the draws gave. */
const DONE = [
  'core/fix-the-bridge',
  'core/first-fire',
  'core/into-town',
  'core/three-fruits',
  'core/herbs-for-pell',
  'core/a-coin-for-maru',
  'core/the-night-arch',
  'core/the-tangle',
];

beforeAll(async () => {
  bundle = loadBundle();
  rig = await startRig(bundle);
}, 120_000);

afterAll(async () => {
  await rig?.close();
});

/** The log the books hold, flattened the way the player's own log is: one entry per action or move. */
function flatten(books: readonly BookRow[]): LogEntry[] {
  const out: LogEntry[] = [];
  for (const row of books) {
    const action = row.action as { kind?: string; moves?: { at: [number, number]; tick: number }[] };
    if (action.kind === 'moves') {
      for (const move of action.moves ?? []) out.push({ a: { t: 'move', at: move.at }, tick: move.tick });
    } else {
      out.push({ a: row.action as Action, tick: row.tick });
    }
  }
  return out;
}

function wireFor(account: Account) {
  return fetchWire(rig.base, (url, init) =>
    fetch(url, {
      ...init,
      headers: { ...(init?.headers as Record<string, string>), 'x-player-id': account.id },
    }),
  );
}

describe('the simulated player over the wire (NEXT 18 g)', () => {
  test.each(STARTS.map((start) => [start.starter, start] as const))(
    '%s plays the opening, the first outing and the first sale, and the server lands on the laptop replay',
    async (_starter, start) => {
      const seed = SEEDS[start.starter]!;
      const account = await rig.account(start.starter, seed);
      const session = await RemoteSession.join(bundle, wireFor(account));
      const player = new Player(bundle, session, rig.clock);

      const summary = await playSession(bundle, player, start);

      // what the run did, as the server kept it
      const stored = await account.stored();
      const finished = Object.entries(stored.player.quests)
        .filter(([, state]) => state === 'done')
        .map(([quest]) => quest)
        .sort();
      expect(finished).toEqual(expect.arrayContaining([...DONE, start.own].sort()));
      expect(summary.digs).toBeGreaterThanOrEqual(3);
      expect(summary.paidMg).toBeGreaterThan(0);
      expect(summary.goldAfterSale).toBe(summary.goldBeforeSale + summary.paidMg);
      expect((await account.ledger()).at(-1)).toBe(summary.paidMg);

      // the books hold exactly what the player sent
      expect(canonical(flatten(await account.bookLog()))).toBe(canonical(player.log));

      // byte for byte: the state the server keeps is the same log replayed on the laptop
      const laptop = replay(bundle, newState(bundle, seed), player.log);
      expect(laptop.error).toBeUndefined();
      expect(serialize(stored)).toBe(serialize(laptop.state));

      // and the phone's own mirror, rebuilt from the server's patches, says the same
      expect(canonical(session.state)).toBe(canonical(publicState(stored)));
    },
    240_000,
  );
});
