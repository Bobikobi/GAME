import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { Pool } from 'pg';
import { newState, step, type Bundle, type State } from '@game/kernel';

import { createPlayerRecord } from '../src';
import { createPgStore, insertPlayer } from '../src';
import { migrate } from '../src/migrate';
import { loadBundle } from '../../tools/test/helpers/world.js';

/** The database tests run against a real postgres, and are skipped when none is given (NEXT 18 b). */
const DATABASE_URL = process.env.DATABASE_URL;

let bundle: Bundle;
let pool: Pool;
let schema: string;

beforeAll(async () => {
  bundle = loadBundle();
  if (!DATABASE_URL) return;
  schema = `dbtest_${process.pid}_${Date.now()}`;
  const setup = new Pool({ connectionString: DATABASE_URL });
  await setup.query(`create schema ${schema}`);
  await setup.end();
  pool = new Pool({ connectionString: DATABASE_URL, options: `-c search_path=${schema}` });
});

afterAll(async () => {
  if (!pool) return;
  await pool.end();
  const cleanup = new Pool({ connectionString: DATABASE_URL });
  await cleanup.query(`drop schema ${schema} cascade`);
  await cleanup.end();
});

let accounts = 0;

async function account(email = `player-${++accounts}@example.com`): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    'insert into accounts (email, name, birth_band) values ($1, $2, $3) returning id',
    [email, 'Tess', '18+'],
  );
  return rows[0]!.id;
}

function started(): State {
  const result = step(bundle, newState(bundle, 17), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe.skipIf(!DATABASE_URL)('the database of Stage 2a (NEXT 18 b)', () => {
  test('the migrations apply once, and a second run applies nothing', async () => {
    const first = await migrate(pool);
    expect(first).toEqual(['0001_accounts.sql', '0002_player_state.sql']);
    expect(await migrate(pool)).toEqual([]);
  });

  test('a player state round-trips, with the seed in its own column and never in the state', async () => {
    const id = await account();
    const record = createPlayerRecord(bundle, started(), 1_000_000);
    await insertPlayer(pool, id, record);

    const loaded = await createPgStore(pool).load(id);
    expect(loaded).toEqual(record);

    const { rows } = await pool.query<{ has_seed: boolean }>(
      "select state ? 'seed' as has_seed from player_state where account_id = $1",
      [id],
    );
    expect(rows[0]!.has_seed).toBe(false);
  });

  test('the version is an optimistic lock: of two writes at one version, only one lands', async () => {
    const id = await account();
    const store = createPgStore(pool);
    const record = createPlayerRecord(bundle, started(), 1_000_000);
    await insertPlayer(pool, id, record);

    const next = { ...record, version: record.version + 1, acceptedAt: record.acceptedAt + 500 };
    const results = await Promise.all([
      store.compareAndSet(id, record.version, next),
      store.compareAndSet(id, record.version, next),
    ]);
    expect(results.sort()).toEqual([false, true]);
    expect((await store.load(id))!.version).toBe(record.version + 1);
  });

  test('a stale write changes nothing', async () => {
    const id = await account();
    const store = createPgStore(pool);
    const record = createPlayerRecord(bundle, started(), 1_000_000);
    await insertPlayer(pool, id, record);

    const moved = { ...record, version: 2, acceptedAt: 1_001_000 };
    expect(await store.compareAndSet(id, 1, moved)).toBe(true);
    expect(await store.compareAndSet(id, 1, { ...moved, version: 2, acceptedAt: 1_002_000 })).toBe(false);
    expect((await store.load(id))!.acceptedAt).toBe(1_001_000);
  });

  test('the action log and the gold ledger are append-only', async () => {
    const id = await account();
    const { rows } = await pool.query<{ id: string }>(
      "insert into action_log (account_id, seq, action, tick) values ($1, 1, '{\"t\":\"move\"}', 0) returning id",
      [id],
    );
    await expect(pool.query('update action_log set tick = 1 where id = $1', [rows[0]!.id])).rejects.toThrow(/append-only/);
    await expect(pool.query('delete from action_log where id = $1', [rows[0]!.id])).rejects.toThrow(/append-only/);

    const gold = await pool.query<{ id: string }>(
      'insert into gold_ledger (account_id, delta_mg, action, tick) values ($1, 25, $2, 0) returning id',
      [id, JSON.stringify({ t: 'gather', node: 'core/berry-bush' })],
    );
    await expect(pool.query('update gold_ledger set delta_mg = 30 where id = $1', [gold.rows[0]!.id])).rejects.toThrow(/append-only/);
    await expect(pool.query('delete from gold_ledger where id = $1', [gold.rows[0]!.id])).rejects.toThrow(/append-only/);
  });

  test('gold is an integer: a fraction of a milli-gold is refused', async () => {
    const id = await account();
    // a fraction sent as text is parsed by the column itself, so the refusal is the column's, not the driver's
    await expect(
      pool.query('insert into gold_ledger (account_id, delta_mg, action, tick) values ($1, $2, $3, 0)', [id, '2.5', '{}']),
    ).rejects.toThrow(/invalid input syntax for type bigint/);
  });

  test('one person is one account, and one identity belongs to one provider and subject', async () => {
    const id = await account('double@example.com');
    await expect(account('double@example.com')).rejects.toThrow(/duplicate key value/);
    await pool.query("insert into sign_in_identities (provider, subject, account_id) values ('google', 'sub-1', $1)", [id]);
    await expect(
      pool.query("insert into sign_in_identities (provider, subject, account_id) values ('google', 'sub-1', $1)", [id]),
    ).rejects.toThrow(/duplicate key value/);
    await expect(
      pool.query("insert into sign_in_identities (provider, subject, account_id) values ('myspace', 'sub-2', $1)", [id]),
    ).rejects.toThrow(/sign_in_identities_provider_is_known/);
  });

  test('an account keeps the age band CR-49 asks for, not a birth date', async () => {
    await expect(
      pool.query("insert into accounts (email, name, birth_band) values ('young@example.com', 'Young', '9')"),
    ).rejects.toThrow(/accounts_birth_band_is_known/);
    await expect(
      pool.query("insert into accounts (email, name, birth_band) values ('Case@Example.com', 'Case', '13-15')"),
    ).rejects.toThrow(/accounts_email_is_lower_case/);
  });
});
