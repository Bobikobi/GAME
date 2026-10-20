import type { Pool } from 'pg';
import type { State } from '@game/kernel';

import type { Books, PlayerRecord, PlayerStore } from './api';
import { publicState } from './patch';

/** An account id is a uuid: anything else names no account, and asking the database would raise. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PlayerRow {
  state: State;
  seed: string;
  clock_anchor_ms: string;
  movement_at: string;
  movement_credit_ms: number;
  version: string;
}

/** The columns a record is written to, without the seed: that one has a column of its own (NEXT 18 b). */
function rowOf(record: PlayerRecord): unknown[] {
  return [
    JSON.stringify(publicState(record.state)),
    record.state.seed,
    record.state.kernel,
    record.state.content,
    record.acceptedAt,
    record.movementAt,
    record.movementCreditMs,
  ];
}

function recordOf(row: PlayerRow): PlayerRecord {
  return {
    state: { ...row.state, seed: Number(row.seed) },
    version: Number(row.version),
    acceptedAt: Number(row.clock_anchor_ms),
    movementAt: Number(row.movement_at),
    movementCreditMs: row.movement_credit_ms,
  };
}

/** Write a player's first row: the state as `createPlayerRecord` built it, at version 1. */
export async function insertPlayer(pool: Pool, playerId: string, record: PlayerRecord): Promise<void> {
  await pool.query(
    `insert into player_state (state, seed, kernel_version, content_version, clock_anchor_ms, movement_at, movement_credit_ms, version, account_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [...rowOf(record), record.version, playerId],
  );
}

/**
 * The store of NEXT 18 b over postgres: one row per player, the seed in its own column, and the version
 * as an optimistic lock, so a write lands only when the row still stands at the version it was read at.
 */
export function createPgStore(pool: Pool): PlayerStore {
  return {
    async load(playerId: string): Promise<PlayerRecord | undefined> {
      if (!UUID.test(playerId)) return undefined;
      const { rows } = await pool.query<PlayerRow>(
        `select state, seed, clock_anchor_ms, movement_at, movement_credit_ms, version
           from player_state
          where account_id = $1`,
        [playerId],
      );
      const row = rows[0];
      return row ? recordOf(row) : undefined;
    },

    async compareAndSet(playerId: string, expectedVersion: number, next: PlayerRecord, books: Books): Promise<boolean> {
      if (!UUID.test(playerId)) return false;
      // the state, the log row and the gold rows are one transaction: a write that loses the race, or a book
      // that cannot be written, leaves nothing of the other two
      const client = await pool.connect();
      try {
        await client.query('begin');
        const { rowCount } = await client.query(
          `update player_state
              set state = $1, seed = $2, kernel_version = $3, content_version = $4, clock_anchor_ms = $5,
                  movement_at = $6, movement_credit_ms = $7, version = $8, updated_at = now()
            where account_id = $9 and version = $10`,
          [...rowOf(next), next.version, playerId, expectedVersion],
        );
        if ((rowCount ?? 0) !== 1) {
          await client.query('rollback');
          return false;
        }
        const action = JSON.stringify(books.action);
        await client.query(
          'insert into action_log (account_id, seq, action, tick) values ($1, $2, $3, $4)',
          [playerId, next.version, action, books.tick],
        );
        for (const deltaMg of books.goldDeltasMg) {
          if (deltaMg === 0) continue; // the table refuses a zero, and a zero moved nothing
          await client.query(
            'insert into gold_ledger (account_id, delta_mg, action, tick) values ($1, $2, $3, $4)',
            [playerId, deltaMg, action, books.tick],
          );
        }
        await client.query('commit');
        return true;
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
