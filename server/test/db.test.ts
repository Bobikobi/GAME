import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { newState, publicState, step, widenSeed, type Bundle, type Seed, type State } from '@game/kernel';

import { checkAccount, createGameApi, createPlayerRecord, listen } from '../src';
import { createPgStore, insertPlayer, seedOfColumn, type Books } from '../src';
import { migrate } from '../src/migrate';
import { loadBundle } from '../../tools/test/helpers/world.js';
import { SEED, STARTS, Wire, playOpening } from './support/phone.js';

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

const books: Books = { action: { t: 'carve', name: 'Tess' }, tick: 500, gold: [] };

async function bookRows(id: string): Promise<{ log: number; ledger: number }> {
  const log = await pool.query<{ n: string }>('select count(*) as n from action_log where account_id = $1', [id]);
  const ledger = await pool.query<{ n: string }>('select count(*) as n from gold_ledger where account_id = $1', [id]);
  return { log: Number(log.rows[0]!.n), ledger: Number(ledger.rows[0]!.n) };
}

let accounts = 0;
let names = 0;

async function account(email = `player-${++accounts}@example.com`): Promise<string> {
  // a name is unique in the world (migration 0003), so each account gets its own and only the email can collide
  const { rows } = await pool.query<{ id: string }>(
    'insert into accounts (email, name) values ($1, $2) returning id',
    [email, `Tess ${++names}`],
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
    expect(first).toEqual(['0001_accounts.sql', '0002_player_state.sql', '0003_signin.sql', '0004_bound_gold.sql', '0005_close_grace.sql', '0007_keyed_luck.sql']);
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
      store.compareAndSet(id, record.version, next, books),
      store.compareAndSet(id, record.version, next, books),
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
    expect(await store.compareAndSet(id, 1, moved, books)).toBe(true);
    expect(await store.compareAndSet(id, 1, { ...moved, version: 2, acceptedAt: 1_002_000 }, books)).toBe(false);
    expect((await store.load(id))!.acceptedAt).toBe(1_001_000);
  });

  test('a won write adds one action_log row at the new version and one gold_ledger row per gold change', async () => {
    const id = await account();
    const store = createPgStore(pool);
    const record = createPlayerRecord(bundle, started(), 1_000_000);
    await insertPlayer(pool, id, record);

    const saleAction = { t: 'sell', npc: 'core/trader', item: 'core/berries', qty: 2 };
    const gold = [30, -10, 0].map((deltaMg) => ({ deltaMg, action: saleAction, tick: 700 }));
    const sale: Books = { action: saleAction, tick: 700, gold };
    expect(await store.compareAndSet(id, 1, { ...record, version: 2 }, sale)).toBe(true);

    const log = await pool.query('select seq, action, tick from action_log where account_id = $1', [id]);
    expect(log.rows).toEqual([{ seq: '2', action: sale.action, tick: '700' }]);
    const ledger = await pool.query('select delta_mg, action, tick from gold_ledger where account_id = $1 order by id', [id]);
    expect(ledger.rows).toEqual([
      { delta_mg: '30', action: sale.action, tick: '700' },
      { delta_mg: '-10', action: sale.action, tick: '700' },
    ]);
  });

  test('a lost race writes neither book: of two writes at one version, one log row and one set of gold rows land', async () => {
    const id = await account();
    const store = createPgStore(pool);
    const record = createPlayerRecord(bundle, started(), 1_000_000);
    await insertPlayer(pool, id, record);

    const sale: Books = { action: { t: 'sell' }, tick: 700, gold: [{ deltaMg: 25, action: { t: 'sell' }, tick: 700 }] };
    const next = { ...record, version: 2 };
    const results = await Promise.all([
      store.compareAndSet(id, 1, next, sale),
      store.compareAndSet(id, 1, next, sale),
      store.compareAndSet(id, 1, next, sale),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await bookRows(id)).toEqual({ log: 1, ledger: 1 });
    // a stale one afterwards writes nothing either
    expect(await store.compareAndSet(id, 1, next, sale)).toBe(false);
    expect(await bookRows(id)).toEqual({ log: 1, ledger: 1 });
  });

  test('the books and the state move together: when a book row cannot be written, the state stays at its version', async () => {
    const id = await account();
    const store = createPgStore(pool);
    const record = createPlayerRecord(bundle, started(), 1_000_000);
    await insertPlayer(pool, id, record);
    // a log row already stands at seq 2, so the insert inside the transaction raises
    await pool.query("insert into action_log (account_id, seq, action, tick) values ($1, 2, '{}', 0)", [id]);

    await expect(store.compareAndSet(id, 1, { ...record, version: 2 }, books)).rejects.toThrow(/duplicate key/);
    expect((await store.load(id))!.version).toBe(1);
    expect(await bookRows(id)).toEqual({ log: 1, ledger: 0 });
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
    await expect(account('double@example.com')).rejects.toThrow(/"accounts_email"/);
    await pool.query("insert into sign_in_identities (provider, subject, account_id) values ('google', 'sub-1', $1)", [id]);
    await expect(
      pool.query("insert into sign_in_identities (provider, subject, account_id) values ('google', 'sub-1', $1)", [id]),
    ).rejects.toThrow(/duplicate key value/);
    await expect(
      pool.query("insert into sign_in_identities (provider, subject, account_id) values ('myspace', 'sub-2', $1)", [id]),
    ).rejects.toThrow(/sign_in_identities_provider_is_known/);
  });

  test('an account keeps that the age check passed and the country, not a birth date or a band', async () => {
    await expect(
      pool.query("insert into accounts (email, name, country) values ('young@example.com', 'Young', 'israel')"),
    ).rejects.toThrow(/accounts_country_is_two_letters/);
    await expect(
      pool.query("insert into accounts (email, name, age_checked) values ('nope@example.com', 'Nope', false)"),
    ).rejects.toThrow(/accounts_age_was_checked/);
    await expect(
      pool.query("insert into accounts (email, name) values ('Case@Example.com', 'Case')"),
    ).rejects.toThrow(/accounts_email_is_lower_case/);
  });

  test('a played account replays from its stored log to its stored row, byte for byte (NEXT 18 f)', async () => {
    const id = await account();
    const acceptedAt = 1_000_000;
    const clock = { now: acceptedAt };
    await insertPlayer(pool, id, createPlayerRecord(bundle, newState(bundle, SEED), acceptedAt));

    const server = createGameApi({
      bundle,
      store: createPgStore(pool),
      now: () => clock.now,
      resolvePlayerId: async () => id,
    });
    try {
      const address = await listen(server, 0);
      const wire = new Wire(bundle, `http://127.0.0.1:${address.port}`, publicState(newState(bundle, SEED)), clock);
      await playOpening(wire, STARTS[0]);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    // the books as postgres holds them: bigint comes back as text, and jsonb as what was written
    const log = await pool.query<{ seq: string; action: unknown; tick: string }>(
      'select seq, action, tick from action_log where account_id = $1 order by seq',
      [id],
    );
    const ledger = await pool.query<{ delta_mg: string; action: unknown; tick: string }>(
      'select delta_mg, action, tick from gold_ledger where account_id = $1 order by id',
      [id],
    );
    const stored = (await createPgStore(pool).load(id))!;

    expect(log.rows.length).toBeGreaterThanOrEqual(9);
    expect(ledger.rows).toHaveLength(3);
    const problems = checkAccount(bundle, {
      seed: SEED,
      log: log.rows.map((row) => ({ seq: Number(row.seq), action: row.action, tick: Number(row.tick) })),
      state: stored.state,
      ledger: ledger.rows.map((row) => ({ deltaMg: Number(row.delta_mg), action: row.action, tick: Number(row.tick) })),
    });
    expect(problems).toEqual([]);
  });
});

/** The migrations folder, read here so a test can stop short of one migration and run it by hand. */
const MIGRATIONS = new URL('../migrations/', import.meta.url);
const migration = (name: string) => readFileSync(new URL(name, MIGRATIONS), 'utf8');

describe.skipIf(!DATABASE_URL)('the keyed luck in the database (migration 0007, finding 3)', () => {
  let old: Pool;
  let oldSchema: string;

  beforeAll(async () => {
    oldSchema = `dbkey_${process.pid}_${Date.now()}`;
    const setup = new Pool({ connectionString: DATABASE_URL });
    await setup.query(`create schema ${oldSchema}`);
    await setup.end();
    old = new Pool({ connectionString: DATABASE_URL, options: `-c search_path=${oldSchema}` });
    // the database as it stood before the key: every migration before 0007, run as `migrate` runs them
    for (const name of readdirSync(MIGRATIONS).filter((file) => file.endsWith('.sql') && file < '0007').sort()) {
      await old.query(migration(name));
    }
  });

  afterAll(async () => {
    if (!old) return;
    await old.end();
    const cleanup = new Pool({ connectionString: DATABASE_URL });
    await cleanup.query(`drop schema ${oldSchema} cascade`);
    await cleanup.end();
  });

  test('a row with a 32-bit seed widens to the key the kernel widens it to, and its state reads as format 3', async () => {
    const { rows } = await old.query<{ id: string }>("insert into accounts (email, name) values ('old@example.com', 'Old') returning id");
    const id = rows[0]!.id;
    const state = { ...publicState(started()), format: 2 };
    await old.query(
      `insert into player_state (account_id, state, seed, kernel_version, content_version, clock_anchor_ms, movement_at, movement_credit_ms)
       values ($1, $2, $3, '0.19.0', $4, 0, 0, 0)`,
      [id, JSON.stringify(state), 3_987_654_321, state.content],
    );
    await old.query('begin');
    await old.query(migration('0007_keyed_luck.sql'));
    await old.query('commit');

    const after = await old.query<{ seed: Buffer; format: number; has_seed: boolean }>(
      "select seed, (state->>'format')::int as format, state ? 'seed' as has_seed from player_state where account_id = $1",
      [id],
    );
    const row = after.rows[0]!;
    expect(row.seed.toString('hex')).toBe('b1c6aeed000000000000000000000000');
    expect(seedOfColumn(row.seed)).toEqual(widenSeed(3_987_654_321));
    expect(row.format).toBe(3);
    expect(row.has_seed).toBe(false);
    // the column holds 16 bytes, no other length, and the state still holds no seed
    await expect(old.query('update player_state set seed = $1 where account_id = $2', [Buffer.alloc(15), id])).rejects.toThrow(/player_state_seed_is_128_bit/);
    await expect(old.query("update player_state set state = state || '{\"seed\": 1}' where account_id = $1", [id])).rejects.toThrow(/state_has_no_seed/);
  });

  test('a key of all 128 bits goes into its column and comes back whole', async () => {
    const { rows } = await old.query<{ id: string }>("insert into accounts (email, name) values ('new@example.com', 'New') returning id");
    const id = rows[0]!.id;
    const key: Seed = [0xdeadbeef, 0x01234567, 0x89abcdef, 0xfffffffe];
    const record = createPlayerRecord(bundle, { ...started(), seed: key }, 1_000_000);
    await insertPlayer(old, id, record);
    expect((await createPgStore(old).load(id))!.state.seed).toEqual(key);
    const raw = await old.query<{ seed: Buffer }>('select seed from player_state where account_id = $1', [id]);
    expect(raw.rows[0]!.seed.toString('hex')).toBe('efbeadde67452301efcdab89feffffff');
  });
});
