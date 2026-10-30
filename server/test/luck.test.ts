/**
 * Luck and the ledger on the server (NEXT 18 f): every grant and payment writes one `gold_ledger` row
 * with its action and tick, the draws stay `draw(seed, entity, counter)` from the state's secret seed,
 * and an account's whole `action_log` plays again from its start state to the stored state, byte for
 * byte.
 *
 * The runs below are played through the real API, over HTTP, one request at a time (see
 * `support/phone.ts`): a start, the start's own task, the keystone, the bridge, a felled oak, the
 * trader's stall for one payment and one sale, and one careless strike whose one log is the seed's.
 * Nothing is placed by hand and no state is written directly, so the log these tests replay is a log
 * the server itself accepted.
 */
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import type { IncomingMessage, Server } from 'node:http';

import {
  type Bundle,
  type GameEvent,
  type State,
  drawBasisPoints,
  missKeepBp,
  newState,
  publicState,
  salePrice,
  serialize,
  widenSeed,
} from '@game/kernel';

import {
  bookedGoldMg,
  checkAccount,
  goldRowsOf,
  replayAccount,
  createGameApi,
  ledgerSumMg,
  listen,
  type AccountBooks,
  type BookedStep,
  type LedgerRow,
} from '../src';
import { loadBundle } from '../../tools/test/helpers/world.js';
import { MemoryStore, PLAYER, SEED, STARTS, Wire, playOpening, type PlayedRun } from './support/phone.js';

let bundle: Bundle;
let server: Server | undefined;

beforeAll(() => {
  bundle = loadBundle();
});

/** A server for one account, and the wire that plays it: the memory store of a test, and its clock. */
async function api(): Promise<{ store: MemoryStore; wire: Wire }> {
  const clock = { now: 1_000_000 };
  const store = new MemoryStore(bundle, newState(bundle, SEED), clock.now);
  server = createGameApi({
    bundle,
    store,
    now: () => clock.now,
    resolvePlayerId: async (request: IncomingMessage) => request.headers.authorization === 'Bearer test' ? PLAYER : undefined,
  });
  const address = await listen(server, 0);
  const wire = new Wire(bundle, `http://127.0.0.1:${address.port}`, publicState(store.record.state), clock);
  return { store, wire };
}

async function scriptedRun(start: (typeof STARTS)[number]): Promise<PlayedRun & { store: MemoryStore }> {
  const { store, wire } = await api();
  const played = await playOpening(wire, start);
  return { ...played, store };
}

function booksOf(store: MemoryStore, over: Partial<AccountBooks> = {}): AccountBooks {
  return { seed: SEED, log: store.actionLog, state: store.record.state, ledger: store.goldLedger, ...over };
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server!.close((error) => (error ? reject(error) : resolve())));
  server = undefined;
});

describe('the ledger and the replay (NEXT 18 f)', () => {
  test.each(STARTS.map((start) => [start.starter, start] as const))(
    '%s: the whole action log plays again from the start state, byte for byte',
    async (_starter, start) => {
      const { store } = await scriptedRun(start);
      expect(checkAccount(bundle, booksOf(store))).toEqual([]);
      // the claim rests on a log with every kind of row in it: actions, movement batches, grants
      expect(store.actionLog.length).toBeGreaterThanOrEqual(9);
      expect(store.actionLog.some((entry) => (entry.action as { kind?: string }).kind === 'moves')).toBe(true);
      expect(store.goldLedger).toHaveLength(3);
    },
  );

  test.each(STARTS.map((start) => [start.starter, start] as const))(
    "%s: the ledger sums to the state's purse, and holds one row per grant and payment",
    async (_starter, start) => {
      const { store } = await scriptedRun(start);
      const logPays = required(salePrice(bundle, store.record.state, 'core/log', 1), 'The trader does not buy a log.');
      const berryMg = required(bundle.shops['core/trader-shop']!.sells.find((o) => o.item === 'core/berry'), 'The trader does not sell a berry.').price_mg;
      // the bridge's reward, the payment for a berry and the sale of a log, in the order the server took them
      expect(store.goldLedger.map((row) => row.deltaMg)).toEqual([30_000, -berryMg, logPays]);
      expect(ledgerSumMg(store.goldLedger)).toBe(store.record.state.player.gold);
      expect(store.record.state.player.gold).toBe(30_000 - berryMg + logPays);
      // each row names the action that made it, at the tick it was made at
      for (const row of store.goldLedger) {
        expect(store.actionLog.some((entry) => entry.tick === row.tick && JSON.stringify(entry.action) === JSON.stringify(row.action))).toBe(true);
      }
    },
  );

  test('a grant with no action behind it fails the check', async () => {
    const { store } = await scriptedRun(STARTS[0]);
    const forged: LedgerRow = { deltaMg: 100_000, action: { t: 'sell', npc: 'core/trader', item: 'core/log', qty: 1, at: [0, 0] }, tick: 1 };
    const problems = checkAccount(bundle, booksOf(store, { ledger: [...store.goldLedger, forged] }));
    expect(problems).toContainEqual(expect.stringContaining('a grant with no action behind it: 100000 mg'));
    expect(problems).toContainEqual(expect.stringContaining('the ledger sums to'));
  });

  test('a grant taken out of the books, or an action taken out of the log, fails the check', async () => {
    const { store } = await scriptedRun(STARTS[1]);
    // one gold row taken away: the purse no longer has the log to stand on
    const short = checkAccount(bundle, booksOf(store, { ledger: store.goldLedger.slice(1) }));
    expect(short).toContainEqual(expect.stringContaining('the log pays a grant the ledger does not hold'));

    // one action taken away from the log: the replay no longer lands on the stored state
    const opened = store.actionLog.findIndex((entry) => (entry.action as { t?: string }).t === 'restore');
    expect(opened).toBeGreaterThan(0);
    const stumped = store.actionLog.filter((_, index) => index !== opened);
    const replayed = checkAccount(bundle, booksOf(store, { log: stumped }));
    expect(replayed.length).toBeGreaterThan(0);
    expect(replayed.join(' ')).toMatch(/does not (land on the stored state|play again)/);
  });

  test("the luck is the secret seed's: a careless strike falls on the seed's own draw", async () => {
    const run = await scriptedRun(STARTS[0]);
    // the kernel's rule, read here: a careless gather pays nothing by itself, and one unit falls when
    // drawBasisPoints(seed, node, draws) stands under the miss-keeps line
    const keepBp = missKeepBp(bundle, run.store.record.state);
    const kept = drawBasisPoints(SEED, run.careless, 0) < keepBp;
    expect(run.store.record.state.nodes[run.careless]?.draws).toBe(1);
    expect(run.drawn).toBe(kept ? 1 : 0);

    // and a seed on the other side of that same draw cannot have written this state
    const other = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597]
      .map(widenSeed)
      .find((seed) => (drawBasisPoints(seed, run.careless, 0) < keepBp) !== kept);
    expect(other, 'no seed of this list lands on the other side of the draw').toBeDefined();
    const problems = checkAccount(bundle, booksOf(run.store, { seed: other! }));
    expect(problems.some((problem) => problem.includes('does not land on the stored state'))).toBe(true);
  });

  test('the opening grant is booked to the bound fund when the content pays a purse, and nothing when it does not', () => {
    const paid = structuredClone(bundle);
    paid.params.starting_gold_mg = 12_000;
    const start = { t: 'start', starter: 'core/forager', name: 'Tess' } as const;
    expect(bookedGoldMg(paid, start, [])).toEqual([{ deltaMg: 12_000, fund: 'bound' }]);
    expect(bookedGoldMg(bundle, start, [])).toEqual([]);
    // an event's gold is booked as it stands, and a zero is not a row
    expect(bookedGoldMg(bundle, { t: 'sell', npc: 'core/trader', item: 'core/berry', qty: 1 }, [
      { e: 'gold', delta: 250 },
      { e: 'gold', delta: 0 },
      { e: 'gold', delta: -100 },
    ] as GameEvent[])).toEqual([{ deltaMg: 250 }, { deltaMg: -100 }]);
    expect(ledgerSumMg([])).toBe(0);
  });

  test.each(STARTS.map((start) => [start.starter, start] as const))(
    "%s: the server's gold rows and the replay's gold rows are the same rows, action and tick and all",
    async (_starter, start) => {
      const { store } = await scriptedRun(start);
      const replay = replayAccount(bundle, SEED, store.actionLog);
      expect(replay.ok).toBe(true);
      if (!replay.ok) return;
      // not merely the same sum: the same rows, keyed the same way (the drift game-94 named on 21.10 14:10)
      expect(store.goldLedger).toEqual(replay.replay.ledger);
    },
  );

  test('a payment inside a movement batch is booked as the report that paid it, at the report\'s tick', () => {
    // No step inside a batch pays gold in today's content, and the kernel is not changed for this test:
    // the batch below is the one the books see, with the gold on its middle report. The server books its
    // requests through `goldRowsOf` and a replay books its steps through `goldRowsOf`, so this one rule is
    // what keeps an honest row from reading as forged the day a move pays (game-94, 21.10 14:10).
    const stepMs = bundle.params.walk_step_ms;
    const reports = [{ t: 'move', at: [2, 4] as [number, number] }, { t: 'move', at: [3, 4] as [number, number] }, { t: 'move', at: [4, 4] as [number, number] }];
    const steps: BookedStep[] = reports.map((action, i) => ({
      action,
      tick: 1_000 + i * stepMs,
      events: i === 1 ? [{ e: 'gold', delta: 250 }, { e: 'gold', delta: 0 }] : [],
    }));
    // one row, keyed by the report and its tick, not by the batch and the last tick
    expect(goldRowsOf(bundle, steps)).toEqual([{ deltaMg: 250, action: reports[1], tick: 1_000 + stepMs }]);
    // and a batch that pays twice keeps the order it paid in
    const twice: BookedStep[] = [
      { action: reports[0], tick: 1_000, events: [{ e: 'gold', delta: -100 }] },
      { action: reports[1], tick: 1_000 + stepMs, events: [{ e: 'gold', delta: 300 }] },
    ];
    expect(goldRowsOf(bundle, twice)).toEqual([
      { deltaMg: -100, action: reports[0], tick: 1_000 },
      { deltaMg: 300, action: reports[1], tick: 1_000 + stepMs },
    ]);
  });

  test('the log row and the state row line up: seq is the version the action made', async () => {
    const { store } = await scriptedRun(STARTS[2]);
    store.actionLog.forEach((entry, index) => expect(entry.seq).toBe(index + 2));
    expect(store.record.version).toBe(store.actionLog.length + 1);
    // the stored text carries the purse the replay must reach, not merely a state that looks the same
    expect(serialize(store.record.state)).toContain(`"gold":${store.record.state.player.gold}`);
  });
});

/** A state no server wrote: the check reads the text, so a state that is not the replay's must be caught. */
function tampered(state: State): State {
  const copy = structuredClone(state);
  copy.player.gold += 1;
  return copy;
}

describe('the check reads the stored text itself', () => {
  test('a stored state one milli-gold off the replay fails', async () => {
    const { store } = await scriptedRun(STARTS[1]);
    const problems = checkAccount(bundle, booksOf(store, { state: tampered(store.record.state) }));
    expect(problems).toContainEqual(expect.stringContaining('does not land on the stored state'));
    expect(problems).toContainEqual(expect.stringContaining('the ledger sums to'));
  });
});
