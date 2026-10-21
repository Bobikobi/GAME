import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { Pool } from 'pg';
import { newState, step, type Bundle, type State } from '@game/kernel';

import { checkAccount, createPgAuthStore, createPgStore, createPlayerRecord, takeOpening, type AuthStore, type NewGame } from '../src';
import { migrate } from '../src/migrate';
import { newToken, tokenHash } from '../src/auth/tokens';
import { loadBundle } from '../../tools/test/helpers/world.js';
import { LocalPhone, STARTS, playOpening } from './support/phone.js';

/** Sign-in's tables against a real postgres (NEXT 18 e, migration 0003); skipped when none is given, as db.test.ts is. */
const DATABASE_URL = process.env.DATABASE_URL;
const NOW = Date.UTC(2026, 9, 21, 12);
const MINUTE = 60 * 1000;

let bundle: Bundle;
let pool: Pool;
let schema: string;
let store: AuthStore;

beforeAll(async () => {
  bundle = loadBundle();
  if (!DATABASE_URL) return;
  schema = `signintest_${process.pid}_${Date.now()}`;
  const setup = new Pool({ connectionString: DATABASE_URL });
  await setup.query(`create schema ${schema}`);
  await setup.end();
  pool = new Pool({ connectionString: DATABASE_URL, options: `-c search_path=${schema}` });
  await migrate(pool);
  store = createPgAuthStore(pool);
});

afterAll(async () => {
  if (!pool) return;
  await pool.end();
  const cleanup = new Pool({ connectionString: DATABASE_URL });
  await cleanup.query(`drop schema ${schema} cascade`);
  await cleanup.end();
});

let made = 0;

/** A game as a sign-up without an opening starts it: a fresh state, before the start. */
function freshGame(): NewGame {
  return { record: createPlayerRecord(bundle, newState(bundle, 1), NOW) };
}

/** An account made the way the sign-up makes one: a ticket, then the account, its identity, its game, the ticket gone. */
async function account(name = `Player ${++made}`, game: NewGame = freshGame()): Promise<string> {
  const ticketHash = tokenHash(newToken());
  const email = `${name.toLowerCase().replace(/\s/g, '-')}@example.com`;
  const ticket = { ticketHash, provider: 'google' as const, subject: `sub-${name}`, email, createdAt: NOW, expiresAt: NOW + 30 * MINUTE };
  await store.saveTicket(ticket);
  const result = await store.createAccount({ email, name, birthBand: '18+' }, ticket, game);
  if (typeof result === 'string') throw new Error(result);
  return result.accountId;
}

async function count(table: string, accountId: string): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(`select count(*) as n from ${table} where account_id = $1`, [accountId]);
  return Number(rows[0]!.n);
}

function started(): State {
  const result = step(bundle, newState(bundle, 17), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe.skipIf(!DATABASE_URL)('sign-in in postgres (NEXT 18 e)', () => {
  test('an email link is spent by exactly one of two requests that race for it', async () => {
    const token = newToken();
    await store.saveEmailLink({ tokenHash: tokenHash(token), email: 'race@example.com', createdAt: NOW, expiresAt: NOW + 15 * MINUTE });
    const both = await Promise.all([store.useEmailLink(tokenHash(token), NOW), store.useEmailLink(tokenHash(token), NOW)]);
    expect(both.filter((result) => typeof result === 'object')).toHaveLength(1);
    expect(both.filter((result) => result === 'used')).toHaveLength(1);
    expect(await store.useEmailLink(tokenHash(newToken()), NOW)).toBeUndefined();
  });

  test('an OAuth state answers once', async () => {
    const stateHash = tokenHash(newToken());
    await store.saveFlow({ stateHash, provider: 'google', verifier: newToken(), nonce: newToken(), createdAt: NOW, expiresAt: NOW + 10 * MINUTE });
    expect((await store.takeFlow(stateHash))?.provider).toBe('google');
    expect(await store.takeFlow(stateHash)).toBeUndefined();
  });

  test('a token is kept only as a sha-256: the table refuses anything else', async () => {
    await expect(pool.query(
      'insert into sessions (token_hash, account_id, expires_at) values ($1, $2, now())',
      [newToken(), await account()],
    )).rejects.toThrow(/sessions_token_hash_is_sha256/);
  });

  test('the sign-up makes the account, its identity, and ends the ticket in one go; a name in any case is taken once', async () => {
    const accountId = await account('Rowan');
    expect(await store.accountForIdentity('google', 'sub-Rowan')).toBe(accountId);
    expect(await store.accountForEmail('rowan@example.com')).toBe(accountId);

    const ticket = { ticketHash: tokenHash(newToken()), provider: 'email' as const, subject: 'x@example.com', email: 'x@example.com', createdAt: NOW, expiresAt: NOW + MINUTE };
    await store.saveTicket(ticket);
    expect(await store.createAccount({ email: 'x@example.com', name: 'ROWAN', birthBand: '18+' }, ticket, freshGame())).toBe('name-taken');
    // the refusal rolled back whole: no account, no identity, and the ticket still stands
    expect(await store.accountForEmail('x@example.com')).toBeUndefined();
    expect(await store.loadTicket(ticket.ticketHash)).toBeDefined();
    expect(await store.createAccount({ email: 'rowan@example.com', name: 'Other', birthBand: '18+' }, ticket, freshGame())).toBe('email-taken');
    expect(await store.createAccount({ email: 'x@example.com', name: 'Other', birthBand: '13-15' }, ticket, freshGame())).toEqual({ accountId: expect.any(String) });
    expect(await store.loadTicket(ticket.ticketHash)).toBeUndefined();
  });

  test('a kept opening is written with the account in one go: its state, its log row and its grants, and the books prove it', async () => {
    const phone = new LocalPhone(bundle, 77);
    await playOpening(phone, STARTS[0]);
    const handover = takeOpening(bundle, phone.upload(), 424242, NOW);
    if (!handover.kept) throw new Error(handover.problem);
    const accountId = await account(undefined, { record: handover.record, books: { action: handover.opening, tick: handover.tick, gold: handover.gold } });

    const log = await pool.query<{ seq: string; action: unknown; tick: string }>('select seq, action, tick from action_log where account_id = $1 order by seq', [accountId]);
    const ledger = await pool.query<{ delta_mg: string; action: unknown; tick: string }>('select delta_mg, action, tick from gold_ledger where account_id = $1 order by id', [accountId]);
    const stored = (await createPgStore(pool).load(accountId))!;
    expect(log.rows.map((row) => Number(row.seq))).toEqual([1]);
    expect(ledger.rows).toHaveLength(3);
    expect(stored.state.seed).toBe(424242);
    expect(checkAccount(bundle, {
      seed: stored.state.seed,
      log: log.rows.map((row) => ({ seq: Number(row.seq), action: row.action, tick: Number(row.tick) })),
      state: stored.state,
      ledger: ledger.rows.map((row) => ({ deltaMg: Number(row.delta_mg), action: row.action, tick: Number(row.tick) })),
    })).toEqual([]);
  });

  test('a sign-up refused for its name leaves no game behind: no state row, no log row, no grant', async () => {
    await account('Ash');
    const ticket = { ticketHash: tokenHash(newToken()), provider: 'email' as const, subject: 'ash2@example.com', email: 'ash2@example.com', createdAt: NOW, expiresAt: NOW + MINUTE };
    await store.saveTicket(ticket);
    const before = await pool.query<{ n: string }>('select (select count(*) from player_state) + (select count(*) from action_log) + (select count(*) from gold_ledger) as n');
    const phone = new LocalPhone(bundle, 77);
    await playOpening(phone, STARTS[0]);
    const handover = takeOpening(bundle, phone.upload(), 424242, NOW);
    if (!handover.kept) throw new Error(handover.problem);
    const game = { record: handover.record, books: { action: handover.opening, tick: handover.tick, gold: handover.gold } };
    expect(await store.createAccount({ email: 'ash2@example.com', name: 'ash', birthBand: '18+' }, ticket, game)).toBe('name-taken');
    const after = await pool.query<{ n: string }>('select (select count(*) from player_state) + (select count(*) from action_log) + (select count(*) from gold_ledger) as n');
    expect(after.rows[0]!.n).toBe(before.rows[0]!.n);
  });

  test('a session stands while it is neither revoked nor past its end', async () => {
    const accountId = await account();
    const live = tokenHash(newToken());
    await store.createSession(live, accountId, NOW, NOW + 30 * 24 * 60 * MINUTE);
    expect(await store.sessionAccount(live, NOW)).toBe(accountId);
    expect(await store.sessionAccount(live, NOW + 30 * 24 * 60 * MINUTE)).toBeUndefined();
    await store.revokeSession(live, NOW);
    expect(await store.sessionAccount(live, NOW)).toBeUndefined();
  });

  test('closing an account deletes every row that names it, the two append-only books included', async () => {
    const record = createPlayerRecord(bundle, started(), NOW);
    const accountId = await account(undefined, { record });
    const other = await account();
    await store.createSession(tokenHash(newToken()), accountId, NOW, NOW + MINUTE);
    await createPgStore(pool).compareAndSet(accountId, 1, { ...record, version: 2 }, { action: { t: 'carve', name: 'Tess' }, tick: 0, gold: [{ deltaMg: 500, action: { t: 'carve', name: 'Tess' }, tick: 0 }] });
    await pool.query('insert into boards (week, board, rank, account_id, score) values ($1, $2, 1, $3, 10)', ['2026-10-19', 'gold', accountId]);
    const tables = ['sign_in_identities', 'sessions', 'player_state', 'action_log', 'gold_ledger', 'boards'];
    for (const table of tables) expect(await count(table, accountId), table).toBe(1);

    // while the account stands, a book still refuses a removal
    await expect(pool.query('delete from action_log where account_id = $1', [accountId])).rejects.toThrow(/append-only/);

    await store.closeAccount(accountId);
    expect(await store.account(accountId)).toBeUndefined();
    for (const table of tables) expect(await count(table, accountId), table).toBe(0);
    expect(await store.account(other)).toBeDefined();
    expect(await count('sign_in_identities', other)).toBe(1);
  });

  test('the sweep removes what has ended and keeps what has not', async () => {
    const ended = tokenHash(newToken());
    const open = tokenHash(newToken());
    await store.saveEmailLink({ tokenHash: ended, email: 'sweep@example.com', createdAt: NOW - 20 * MINUTE, expiresAt: NOW - 5 * MINUTE });
    await store.saveEmailLink({ tokenHash: open, email: 'sweep@example.com', createdAt: NOW, expiresAt: NOW + 15 * MINUTE });
    await store.sweep(NOW);
    expect(await store.countEmailLinks('sweep@example.com', 0)).toBe(1);
    expect(await store.useEmailLink(open, NOW)).toMatchObject({ email: 'sweep@example.com' });
  });
});
