/**
 * The rig the simulated player runs against (NEXT 18 g): the real HTTP API of `server/` over a real
 * socket, on the store postgres keeps when `DATABASE_URL` names one, and in memory when it does not.
 *
 * The one seam is the clock the API already offers (`ApiOptions.now`): the run walks the game's hours in
 * a few seconds, so the simulated player moves the server's clock with the game time it claims, and never
 * further. The time proof still refuses every hour the clock did not pay for (`server/test/api.test.ts`).
 */
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { Pool } from 'pg';

import { newState, type Bundle, type State } from '@game/kernel';

import {
  type Books,
  type PlayerRecord,
  type PlayerStore,
  authFromEnv,
  createGameApi,
  createPlayerRecord,
  createPgStore,
  insertPlayer,
  listen,
  migrate,
} from '../../src/index.js';
import type { Clock } from './player.js';

/** One row of the action log, as the books hold it: the action the client sent, or a movement batch. */
export interface BookRow {
  action: unknown;
  tick: number;
}

/** An account with a player row, and what the books hold about it. */
export interface Account {
  /** the account id: the header the dev identity mode reads */
  id: string;
  name: string;
  /** the state the server keeps, the seed back in the place the column holds it */
  stored(): Promise<State>;
  /** every milli-gold the ledger recorded, in the order it was written */
  ledger(): Promise<number[]>;
  /** the log the books hold, in the order it was written */
  bookLog(): Promise<BookRow[]>;
}

export interface Rig {
  base: string;
  clock: Clock;
  /** the database, when there is one: the boards tests read and forge rows through it */
  pool?: Pool;
  /** Make an account and put its first state row in place, at version 1, as signing up does (NEXT 18 d). */
  account(name: string, seed: number): Promise<Account>;
  close(): Promise<void>;
}

/** `DATABASE_URL` is set in CI (the postgres service container); locally the same code runs in memory. */
export function hasDatabase(): boolean {
  return (process.env.DATABASE_URL ?? '') !== '';
}

/** The store the api tests use: one row per player, written only when the version it read still stands. */
class MemoryStore implements PlayerStore {
  readonly records = new Map<string, PlayerRecord>();
  readonly books = new Map<string, BookRow[]>();
  readonly gold = new Map<string, number[]>();

  constructor(readonly bundle: Bundle) {}

  async load(playerId: string): Promise<PlayerRecord | undefined> {
    const record = this.records.get(playerId);
    return record ? structuredClone(record) : undefined;
  }

  async compareAndSet(playerId: string, expectedVersion: number, next: PlayerRecord, books: Books): Promise<boolean> {
    const record = this.records.get(playerId);
    if (!record || record.version !== expectedVersion) return false;
    this.records.set(playerId, structuredClone(next));
    this.books.set(playerId, [...(this.books.get(playerId) ?? []), { action: structuredClone(books.action), tick: books.tick }]);
    this.gold.set(playerId, [...(this.gold.get(playerId) ?? []), ...books.gold.map((row) => row.deltaMg)]);
    return true;
  }
}

/** The schema this run's tables live in, so two runs on one database never meet (as `db.test.ts` does). */
let schemas = 0;

export async function startRig(bundle: Bundle): Promise<Rig> {
  const clock: Clock = { now: 1_000 };
  const auth = authFromEnv({ AUTH_MODE: 'dev-header', ALLOW_DEV_HEADER: 'staging-only' });
  if (auth.mode !== 'dev-header') throw new Error('the sim names its players by the dev header');
  const memory = new MemoryStore(bundle);

  let store: PlayerStore = memory;
  let pool: Pool | undefined;
  let schema: string | undefined;

  if (hasDatabase()) {
    const { Pool: PgPool } = await import('pg');
    schema = `sim_${process.pid}_${Date.now()}_${++schemas}`;
    const setup = new PgPool({ connectionString: process.env.DATABASE_URL });
    await setup.query(`create schema ${schema}`);
    await setup.end();
    pool = new PgPool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
    await migrate(pool);
    store = createPgStore(pool);
  }

  const server: Server = createGameApi({
    bundle,
    store,
    now: () => clock.now,
    resolvePlayerId: auth.resolve,
    health: () => (pool ? pool.query('select 1').then(() => true) : Promise.resolve(true)),
  });
  const address = await listen(server, 0);

  async function account(name: string, seed: number): Promise<Account> {
    const id = randomUUID();
    const state = newState(bundle, seed);
    if (pool) {
      await pool.query('insert into accounts (id, email, name, birth_band) values ($1, $2, $3, $4)', [
        id,
        `${id}@sim.openfold.test`,
        name,
        '18+',
      ]);
      await insertPlayer(pool, id, createPlayerRecord(bundle, state, clock.now));
    } else {
      memory.records.set(id, createPlayerRecord(bundle, state, clock.now));
    }
    return {
      id,
      name,
      async stored(): Promise<State> {
        if (pool) {
          const { rows } = await pool.query<{ state: State; seed: string }>(
            'select state, seed from player_state where account_id = $1',
            [id],
          );
          const row = rows[0];
          if (!row) throw new Error(`${name} has no state row.`);
          return { ...row.state, seed: Number(row.seed) };
        }
        const record = memory.records.get(id);
        if (!record) throw new Error(`${name} has no state row.`);
        return structuredClone(record.state);
      },
      async ledger(): Promise<number[]> {
        if (pool) {
          const { rows } = await pool.query<{ delta_mg: string }>(
            'select delta_mg from gold_ledger where account_id = $1 order by id',
            [id],
          );
          return rows.map((row) => Number(row.delta_mg));
        }
        return [...(memory.gold.get(id) ?? [])];
      },
      async bookLog(): Promise<BookRow[]> {
        if (pool) {
          const { rows } = await pool.query<{ action: unknown; tick: string }>(
            'select action, tick from action_log where account_id = $1 order by seq',
            [id],
          );
          return rows.map((row) => ({ action: row.action, tick: Number(row.tick) }));
        }
        return (memory.books.get(id) ?? []).map((row) => ({ ...row }));
      },
    };
  }

  return {
    base: `http://127.0.0.1:${address.port}`,
    clock,
    pool,
    account,
    async close(): Promise<void> {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      if (pool) {
        await pool.end();
        const { Pool: PgPool } = await import('pg');
        const cleanup = new PgPool({ connectionString: process.env.DATABASE_URL });
        await cleanup.query(`drop schema ${schema} cascade`);
        await cleanup.end();
      }
    },
  };
}
