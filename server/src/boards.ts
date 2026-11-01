/**
 * The verified boards (NEXT 18 g; kernel-review 8.3: "leaderboards rank accounts from server-validated
 * state only"). A board is never written from what a player reports: the account's own action log is
 * replayed through the kernel from its start state under the seed column, and only a log that lands on
 * the state the row holds - and whose grants the gold ledger holds - is scored. The proof itself is
 * `checkAccount` in `server/src/ledger.ts` (NEXT 18 f); this file reads the boards' measures off the state
 * that proof returns.
 *
 * The measures are CR-40's, read off the verified state alone: worth (gold plus the goods in the bag at
 * the trader's pay today), the collection (what the journal says was discovered), the levels (every
 * profession's level, added up), and the exploration (the places found and brought home, G63; DECISIONS.md,
 * 2026-10-09: the players' common task is to explore the world). Houses and the camp count nothing while
 * houses and plots are paused.
 */
import type { Pool } from 'pg';

import { type Bundle, type PublicState, type State, professionLevel, salePrice } from '@game/kernel';

import { type AccountBooks, type LedgerRow, type LoggedAction, checkAccount, replayAccount } from './ledger';
import { seedOfColumn } from './store-pg';

export type BoardName = 'wealth' | 'collection' | 'levels' | 'exploration';

export const BOARDS: readonly BoardName[] = ['wealth', 'collection', 'levels', 'exploration'];

export interface ScoreRow {
  board: BoardName;
  /** the measure, in integers: milli-gold for worth, a count for the others */
  score: number;
}

/** A log that does not replay: the score it claims is not the score the rules give. */
export class ForgedLog extends Error {}

/** The first version a log row can carry: the player row is written at version 1, and every write adds one. */
const FIRST_SEQ = 2;

/** The one row written with the account rather than after it: a kept opening (NEXT 18 d), `{ kind: 'opening', ... }`. */
function isOpening(action: unknown): boolean {
  return typeof action === 'object' && action !== null && (action as { kind?: unknown }).kind === 'opening';
}

/**
 * The log is the write history: version 1 is the first state row, so a verified log starts at 2 and steps
 * by one. The one row that may carry version 1 is a kept opening: the sign-up writes it in the same
 * transaction as the state row it produced (`createAccount`), and the log steps on from it. A hole is not a
 * log any more, whatever its rows replay to, and the board refuses it as such.
 */
export function gapIn(log: readonly LoggedAction[]): string | undefined {
  const first = log[0];
  if (first?.seq === 1 && !isOpening(first.action)) return 'the log starts at version 1, which only a kept opening may carry';
  let expected = first?.seq === 1 ? 1 : FIRST_SEQ;
  for (const row of log) {
    if (row.seq !== expected) return `the log skips from version ${expected - 1} to ${row.seq}`;
    expected += 1;
  }
  return undefined;
}

/** The scores a verified state is worth, in the board's own measures. */
export function scoresOf(bundle: Bundle, state: PublicState): ScoreRow[] {
  let goods = 0;
  for (const [item, qty] of Object.entries(state.player.bag)) {
    if (qty < 1) continue;
    goods += salePrice(bundle, state, item, qty) ?? 0;
  }
  let levels = 0;
  for (const profession of Object.keys(bundle.professions)) levels += professionLevel(bundle, state, profession);
  return [
    { board: 'wealth', score: state.player.gold + goods },
    { board: 'collection', score: state.player.journal.length },
    { board: 'levels', score: levels },
    { board: 'exploration', score: state.player.explored?.length ?? 0 },
  ];
}

/** The Monday of the week `at` falls in, as the `date` column takes it: the week's board is that week's. */
export function weekStart(at: Date): string {
  const day = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  // 0 is Sunday: a week starts on Monday, so Sunday belongs to the week that began six days before
  const back = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - back);
  return day.toISOString().slice(0, 10);
}

interface StateRow {
  state: PublicState;
  seed: Buffer;
}

/**
 * Post an account's scores for a week: read the books, prove them, and only then rank.
 *
 * The proof is 18 f's `checkAccount`: the log replays from `newState` under the seed column to the stored
 * state byte for byte, the ledger holds exactly the grants the log makes none more, and both sums are the
 * state's own purse. A state a client wrote for itself, a log with a hole in it and a grant with no action
 * behind it are each refused before the transaction opens, and the board is left as it was.
 */
export async function postScores(pool: Pool, bundle: Bundle, accountId: string, week: string): Promise<ScoreRow[]> {
  const row = await pool.query<StateRow>('select state, seed from player_state where account_id = $1', [accountId]);
  const stored = row.rows[0];
  if (!stored) throw new Error('No game state exists for this account.');
  const seed = seedOfColumn(stored.seed);
  const state: State = { ...stored.state, seed };

  const logRows = await pool.query<{ seq: string; action: unknown; tick: string }>(
    'select seq, action, tick from action_log where account_id = $1 order by seq',
    [accountId],
  );
  const log: LoggedAction[] = logRows.rows.map((entry) => ({
    seq: Number(entry.seq),
    action: entry.action,
    tick: Number(entry.tick),
  }));
  const gap = gapIn(log);
  if (gap !== undefined) throw new ForgedLog(gap);

  const ledgerRows = await pool.query<{ delta_mg: string; fund: string; action: unknown; tick: string }>(
    'select delta_mg, fund, action, tick from gold_ledger where account_id = $1 order by id',
    [accountId],
  );
  const ledger: LedgerRow[] = ledgerRows.rows.map((entry) => ({
    deltaMg: Number(entry.delta_mg),
    ...(entry.fund === 'bound' ? { fund: 'bound' as const } : {}),
    action: entry.action,
    tick: Number(entry.tick),
  }));

  const books: AccountBooks = { seed, state, log, ledger };
  const problems = checkAccount(bundle, books);
  if (problems.length > 0) throw new ForgedLog(problems.join('; '));

  const played = replayAccount(bundle, seed, log);
  if (!played.ok) throw new ForgedLog(played.problem);
  const scores = scoresOf(bundle, played.replay.state);

  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const { board, score } of scores) {
      // step every rank of this week's board out of the way, so the places can be handed out again
      await client.query('update boards set rank = rank + 1000000 where week = $1 and board = $2', [week, board]);
      await client.query(
        `insert into boards (week, board, rank, account_id, score)
         values ($1, $2, (select coalesce(max(rank), 1000000) + 1 from boards where week = $1 and board = $2), $3, $4)
         on conflict (week, board, account_id) do update set score = excluded.score`,
        [week, board, accountId, score],
      );
      await client.query(
        `with ranked as (
           select account_id, row_number() over (order by score desc, account_id) as place
             from boards where week = $1 and board = $2
         )
         update boards b set rank = ranked.place from ranked
          where b.week = $1 and b.board = $2 and b.account_id = ranked.account_id`,
        [week, board],
      );
    }
    await client.query('commit');
    return scores;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** The board as it stands for a week: the places, in order, as they were last written. */
export async function readBoard(
  pool: Pool,
  week: string,
  board: BoardName,
): Promise<{ rank: number; account: string; score: number }[]> {
  const { rows } = await pool.query<{ rank: string; account_id: string; score: string }>(
    'select rank, account_id, score from boards where week = $1 and board = $2 order by rank',
    [week, board],
  );
  return rows.map((row) => ({ rank: Number(row.rank), account: row.account_id, score: Number(row.score) }));
}
