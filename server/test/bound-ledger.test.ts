/**
 * The bound starting gold is its own book (DECISIONS.md, 2026-10-10): the grant at the start and the spending at a
 * shop are rows of the 'bound' fund, they sum to the state's bound balance and never into the purse, and an
 * account whose log makes them verifies.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { widenSeed, type Bundle } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';
import { bookedGoldMg, boundSumMg, checkAccount, ledgerSumMg, replayAccount } from '../src';

const START = 40_000;
let bundle: Bundle;

beforeAll(() => {
  const base = loadBundle();
  bundle = { ...base, params: { ...base.params, starting_gold_mg: START } };
});

describe('the bound book', () => {
  test('the grant and a shop purchase are bound rows, and the account verifies', () => {
    const seed = widenSeed(7);
    const started = replayAccount(bundle, seed, [{ seq: 2, action: { t: 'start', starter: 'core/forager', name: 'Tess' }, tick: 0 }]);
    if (!started.ok) throw new Error(started.problem);
    expect(started.replay.ledger).toEqual([{ deltaMg: START, fund: 'bound', action: { t: 'start', starter: 'core/forager', name: 'Tess' }, tick: 0 }]);

    const start = started.replay.state;
    const books = { seed, log: [{ seq: 2, action: { t: 'start', starter: 'core/forager', name: 'Tess' }, tick: 0 }], state: start, ledger: started.replay.ledger };
    expect(checkAccount(bundle, books)).toEqual([]);
    expect(boundSumMg(books.ledger)).toBe(start.player.boundGold);
    expect(ledgerSumMg(books.ledger)).toBe(start.player.gold);

    // a bound row booked as purse gold, or a purse that holds the grant, is a finding
    const asPurse = checkAccount(bundle, { ...books, ledger: books.ledger.map(({ fund: _fund, ...row }) => row) });
    expect(asPurse.length).toBeGreaterThan(0);
  });

  test('a purchase that took from both books is booked as one row in each', () => {
    const rows = bookedGoldMg(bundle, { t: 'buy' }, [
      { e: 'bound', delta: -40_000 },
      { e: 'gold', delta: -20_000 },
    ]);
    expect(rows).toEqual([{ deltaMg: -40_000, fund: 'bound' }, { deltaMg: -20_000 }]);
  });
});
