/**
 * The verified boards (NEXT 18 g; kernel-review 8.3: "leaderboards rank accounts from server-validated
 * state only"). A board is never written from what a player reports: the server replays the account's own
 * action log through the kernel from its start state, and a log that does not land on the state the row
 * holds byte for byte is refused, so nothing is posted for it.
 *
 * The measures are CR-40's, read off the verified state alone: worth (gold plus the goods in the bag at
 * the trader's pay today), the collection (what the journal says was discovered), and the levels (every
 * profession's level, added up). Places and camp count nothing while houses and plots are paused.
 */
import type { Pool } from 'pg';

import {
  type Action,
  type Bundle,
  type PublicState,
  type State,
  canonical,
  newState,
  professionLevel,
  salePrice,
  step,
} from '@game/kernel';

export type BoardName = 'wealth' | 'collection' | 'levels';

export const BOARDS: readonly BoardName[] = ['wealth', 'collection', 'levels'];

export interface ScoreRow {
  board: BoardName;
  /** the measure, in integers: milli-gold for worth, a count for the other two */
  score: number;
}

/** One row of `action_log`: the action the client sent, or a movement batch, at the tick it named. */
export interface LogRow {
  seq: number;
  action: unknown;
  tick: number;
}

export type Verification = { ok: true; state: State; log: LogRow[] } | { ok: false; error: string };

/** A log that does not replay: the score it claims is not the score the rules give. */
export class ForgedLog extends Error {}

/** The first version a log row can carry: the player row is written at version 1, and every write adds one. */
const FIRST_SEQ = 2;

/**
 * The steps a log row stands for: a movement batch is several moves, and an action is one step. A move is
 * held to the server's travel check (G56), as `POST /moves` holds it; an action is not, as `POST /action`.
 */
function stepsOf(row: LogRow): { a: Action; tick: number; travel: boolean }[] {
  const action = row.action as { kind?: string; moves?: { at: readonly [number, number]; tick: number }[] };
  if (action?.kind === 'moves') {
    return (action.moves ?? []).map((move) => ({
      a: { t: 'move', at: [move.at[0], move.at[1]] },
      tick: move.tick,
      travel: true,
    }));
  }
  return [{ a: row.action as Action, tick: row.tick, travel: false }];
}

/**
 * Replay an account's log from its start state (`newState` and the seed the server alone keeps) and check
 * that it lands on the state the row holds: `serialize`, byte for byte.
 */
export function verifyLog(bundle: Bundle, seed: number, stored: PublicState, log: readonly LogRow[]): Verification {
  const start = newState(bundle, seed);
  if (stored.kernel !== start.kernel) {
    return { ok: false, error: `The state was written by kernel ${String(stored.kernel)}, and this server runs ${start.kernel}.` };
  }
  if (stored.content !== start.content) {
    return { ok: false, error: 'The state was written by other content, so its log cannot be replayed here.' };
  }
  let state = start;
  let expected = FIRST_SEQ;
  for (const row of log) {
    if (row.seq !== expected) return { ok: false, error: `The log skips from ${expected - 1} to ${row.seq}.` };
    expected += 1;
    for (const entry of stepsOf(row)) {
      const result = step(bundle, state, entry.a, entry.tick, { validateTravel: entry.travel });
      if (!result.ok) return { ok: false, error: `Action ${row.seq} does not replay: ${result.error}` };
      state = result.state;
    }
  }
  if (canonical(state) !== canonical({ ...stored, seed })) {
    return { ok: false, error: 'The log does not land on the state the row holds.' };
  }
  return { ok: true, state, log: [...log] };
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
  seed: string;
}

/**
 * Post an account's scores for a week: the log is read from the books, replayed, and only then ranked.
 * A forged score — a row that does not replay, or a log that skips — is refused before anything is written,
 * and the caller is told which action broke it.
 */
export async function postScores(pool: Pool, bundle: Bundle, accountId: string, week: string): Promise<ScoreRow[]> {
  const state = await pool.query<StateRow>('select state, seed from player_state where account_id = $1', [accountId]);
  const row = state.rows[0];
  if (!row) throw new Error('No game state exists for this account.');
  const { rows } = await pool.query<{ seq: string; action: unknown; tick: string }>(
    'select seq, action, tick from action_log where account_id = $1 order by seq',
    [accountId],
  );
  const log = rows.map((entry) => ({ seq: Number(entry.seq), action: entry.action, tick: Number(entry.tick) }));

  const verified = verifyLog(bundle, Number(row.seed), row.state, log);
  if (!verified.ok) throw new ForgedLog(verified.error);
  const scores = scoresOf(bundle, verified.state);

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
