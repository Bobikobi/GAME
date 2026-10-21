/**
 * The verified boards (NEXT 18 g): a score is posted only when the account's own action log replays to the
 * state its row holds, byte for byte. A forged score — a tampered state, or a log with a hole in it — is
 * refused, and the board it would have joined is left as it was.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { type Action, type Bundle, type PublicState, newState, publicState, step } from '@game/kernel';

import { RemoteSession, fetchWire } from '../../game/src/remote.js';
import { loadBundle } from '../../tools/test/helpers/world.js';
import { ForgedLog, postScores, readBoard, scoresOf, verifyLog, weekStart } from '../src/boards.js';
import { Player } from './sim/player.js';
import { STARTS, playSession } from './sim/session.js';
import { hasDatabase, startRig, type Account, type Rig } from './sim/rig.js';

let bundle: Bundle;

/** The first action of every account, and the state it earns. */
function opened(seed: number): { seed: number; action: Action; state: PublicState } {
  const result = step(bundle, newState(bundle, seed), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
  if (!result.ok) throw new Error(result.error);
  return { seed, action: { t: 'start', starter: 'core/forager', name: 'Tess' }, state: publicState(result.state) };
}

beforeAll(() => {
  bundle = loadBundle();
});

describe('a log that replays (NEXT 18 g)', () => {
  test('lands on the state its row holds, and a state that is not the log\'s is refused', () => {
    const { seed, action, state } = opened(42);
    const log = [{ seq: 2, action, tick: 0 }];

    const verified = verifyLog(bundle, seed, state, log);
    expect(verified.ok, verified.ok ? undefined : verified.error).toBe(true);

    // a client that writes itself a purse: the log still says what it says, so the row is not its state
    const richer: PublicState = { ...state, player: { ...state.player, gold: state.player.gold + 100_000 } };
    const refused = verifyLog(bundle, seed, richer, log);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toMatch(/does not land/);

    // a log with a hole in it: the address books every write, so a missing row is a forgery too
    const skipped = verifyLog(bundle, seed, state, [{ seq: 4, action, tick: 0 }]);
    expect(skipped.ok).toBe(false);
    if (!skipped.ok) expect(skipped.error).toMatch(/skips/);
  });

  test('a state written by another kernel or other content cannot be replayed here', () => {
    const { seed, action, state } = opened(43);
    const log = [{ seq: 2, action, tick: 0 }];
    expect(verifyLog(bundle, seed, { ...state, kernel: '0.0.1' }, log).ok).toBe(false);
    expect(verifyLog(bundle, seed, { ...state, content: 'not-this-content' }, log).ok).toBe(false);
  });

  test('the measures are CR-40\'s, read off the state alone', () => {
    const { state } = opened(44);
    const scores = scoresOf(bundle, state);
    expect(scores.map((score) => score.board)).toEqual(['wealth', 'collection', 'levels']);
    expect(scores.find((score) => score.board === 'wealth')!.score).toBe(state.player.gold);
    expect(scores.find((score) => score.board === 'collection')!.score).toBe(state.player.journal.length);
    expect(scores.find((score) => score.board === 'levels')!.score).toBeGreaterThanOrEqual(
      Object.keys(bundle.professions).length,
    );
  });

  test('a week starts on its Monday, as the date column takes it', () => {
    expect(weekStart(new Date('2026-10-21T13:00:00Z'))).toBe('2026-10-19');
    expect(weekStart(new Date('2026-10-19T00:00:00Z'))).toBe('2026-10-19');
    // a Sunday belongs to the week that began six days before it
    expect(weekStart(new Date('2026-10-25T23:59:00Z'))).toBe('2026-10-19');
  });
});

describe.skipIf(!hasDatabase())('the boards over the books (NEXT 18 g)', () => {
  let rig: Rig;

  beforeAll(async () => {
    rig = await startRig(bundle);
  }, 120_000);

  afterAll(async () => {
    await rig?.close();
  });

  async function played(start: (typeof STARTS)[number], seed: number): Promise<Account> {
    const account = await rig.account(start.starter, seed);
    const wire = fetchWire(rig.base, (url, init) =>
      fetch(url, { ...init, headers: { ...(init?.headers as Record<string, string>), 'x-player-id': account.id } }),
    );
    const session = await RemoteSession.join(bundle, wire);
    await playSession(bundle, new Player(bundle, session, rig.clock), start);
    return account;
  }

  test('an account\'s verified scores are posted, and the richer account ranks first', async () => {
    const forager = await played(STARTS[0]!, 2026);
    const explorer = await played(STARTS[2]!, 2028);
    const week = weekStart(new Date());

    const foragerScores = await postScores(rig.pool!, bundle, forager.id, week);
    const explorerScores = await postScores(rig.pool!, bundle, explorer.id, week);

    const wealth = await readBoard(rig.pool!, week, 'wealth');
    expect(wealth).toHaveLength(2);
    expect(wealth[0]!.rank).toBe(1);
    // the board holds exactly the verified measures, never a number the player reported
    const worth = new Map([
      [forager.id, foragerScores.find((score) => score.board === 'wealth')!.score],
      [explorer.id, explorerScores.find((score) => score.board === 'wealth')!.score],
    ]);
    const expected = [...worth.entries()]
      .sort(([aId, a], [bId, b]) => (b - a) || aId.localeCompare(bId))
      .map(([id]) => id);
    expect(wealth.map((row) => row.account)).toEqual(expected);
    expect(wealth.map((row) => row.score)).toEqual(expected.map((id) => worth.get(id)));
    for (const board of ['collection', 'levels'] as const) {
      expect(await readBoard(rig.pool!, week, board)).toHaveLength(2);
    }
  }, 240_000);

  test('a score whose log does not replay is not posted, and the board it would have joined is untouched', async () => {
    const account = await played(STARTS[0]!, 2031);
    const week = weekStart(new Date());
    const before = await readBoard(rig.pool!, week, 'wealth');

    // the forgery: the row claims a purse the log never earned
    await rig.pool!.query(
      `update player_state
          set state = jsonb_set(state, '{player,gold}', to_jsonb((state #>> '{player,gold}')::bigint + 500000))
        where account_id = $1`,
      [account.id],
    );
    await expect(postScores(rig.pool!, bundle, account.id, week)).rejects.toBeInstanceOf(ForgedLog);
    expect(await readBoard(rig.pool!, week, 'wealth')).toEqual(before);

    // and a log with a hole in it, under a state that really is the log's: still refused
    const honest = await played(STARTS[1]!, 2032);
    await rig.pool!.query(
      'insert into action_log (account_id, seq, action, tick) values ($1, $2, $3, $4)',
      [honest.id, 999, { t: 'carve', name: 'Forged' }, 0],
    );
    await expect(postScores(rig.pool!, bundle, honest.id, week)).rejects.toBeInstanceOf(ForgedLog);
    expect(await readBoard(rig.pool!, week, 'wealth')).toEqual(before);
  }, 240_000);
});
