import type { Pool } from 'pg';

import { insertPlayer } from '../store-pg';
import type { ProviderId } from './provider';
import type { AuthStore, EmailLink, OAuthFlow, NewGame, SignupTicket } from './store';

/** An account id is a uuid: anything else names no account, and asking the database would raise. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An instant as postgres takes it: the server's clock in milliseconds, never the database's `now()`. */
function at(ms: number): Date {
  return new Date(ms);
}

function ms(value: Date): number {
  return value.getTime();
}

/** The unique index a refused insert ran into, if it was one of the two sign-up checks. */
function uniqueViolation(error: unknown): 'name-taken' | 'email-taken' | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code, constraint } = error as { code?: string; constraint?: string };
  if (code !== '23505') return undefined;
  if (constraint === 'accounts_name') return 'name-taken';
  if (constraint === 'accounts_email' || constraint === 'sign_in_identities_pkey') return 'email-taken';
  return undefined;
}

/** The sign-in store of migration 0003 over postgres. */
export function createPgAuthStore(pool: Pool): AuthStore {
  return {
    async saveFlow(flow) {
      await pool.query(
        `insert into oauth_flows (state_hash, provider, code_verifier, nonce, created_at, expires_at)
         values ($1, $2, $3, $4, $5, $6)`,
        [flow.stateHash, flow.provider, flow.verifier, flow.nonce, at(flow.createdAt), at(flow.expiresAt)],
      );
    },

    async takeFlow(stateHash) {
      const { rows } = await pool.query<{ provider: OAuthFlow['provider']; code_verifier: string; nonce: string; created_at: Date; expires_at: Date }>(
        'delete from oauth_flows where state_hash = $1 returning provider, code_verifier, nonce, created_at, expires_at',
        [stateHash],
      );
      const row = rows[0];
      return row && { stateHash, provider: row.provider, verifier: row.code_verifier, nonce: row.nonce, createdAt: ms(row.created_at), expiresAt: ms(row.expires_at) };
    },

    async saveEmailLink(link) {
      await pool.query(
        'insert into email_links (token_hash, email, created_at, expires_at) values ($1, $2, $3, $4)',
        [link.tokenHash, link.email, at(link.createdAt), at(link.expiresAt)],
      );
    },

    async countEmailLinks(email, since) {
      const { rows } = await pool.query<{ n: string }>(
        'select count(*) as n from email_links where email = $1 and created_at >= $2',
        [email, at(since)],
      );
      return Number(rows[0]?.n ?? 0);
    },

    async useEmailLink(tokenHash, now): Promise<EmailLink | 'used' | undefined> {
      // one statement decides: of two requests with the same link, only one finds `used_at` still empty
      const { rows } = await pool.query<{ email: string; created_at: Date; expires_at: Date }>(
        `update email_links set used_at = $2
          where token_hash = $1 and used_at is null
          returning email, created_at, expires_at`,
        [tokenHash, at(now)],
      );
      const row = rows[0];
      if (row) return { tokenHash, email: row.email, createdAt: ms(row.created_at), expiresAt: ms(row.expires_at) };
      const seen = await pool.query('select 1 from email_links where token_hash = $1', [tokenHash]);
      return (seen.rowCount ?? 0) > 0 ? 'used' : undefined;
    },

    async accountForIdentity(provider, subject) {
      const { rows } = await pool.query<{ account_id: string }>(
        'select account_id from sign_in_identities where provider = $1 and subject = $2',
        [provider, subject],
      );
      return rows[0]?.account_id;
    },

    async accountForEmail(email) {
      const { rows } = await pool.query<{ id: string }>('select id from accounts where email = $1', [email]);
      return rows[0]?.id;
    },

    async addIdentity(provider, subject, accountId) {
      await pool.query(
        'insert into sign_in_identities (provider, subject, account_id) values ($1, $2, $3) on conflict do nothing',
        [provider, subject, accountId],
      );
    },

    async saveTicket(ticket) {
      await pool.query(
        `insert into signup_tickets (ticket_hash, provider, subject, email, created_at, expires_at)
         values ($1, $2, $3, $4, $5, $6)`,
        [ticket.ticketHash, ticket.provider, ticket.subject, ticket.email, at(ticket.createdAt), at(ticket.expiresAt)],
      );
    },

    async loadTicket(ticketHash) {
      const { rows } = await pool.query<{ provider: ProviderId; subject: string; email: string; created_at: Date; expires_at: Date }>(
        'select provider, subject, email, created_at, expires_at from signup_tickets where ticket_hash = $1',
        [ticketHash],
      );
      const row = rows[0];
      return row && { ticketHash, provider: row.provider, subject: row.subject, email: row.email, createdAt: ms(row.created_at), expiresAt: ms(row.expires_at) };
    },

    async dropTicket(ticketHash) {
      await pool.query('delete from signup_tickets where ticket_hash = $1', [ticketHash]);
    },

    async createAccount(account, ticket: SignupTicket, game: NewGame) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const { rows } = await client.query<{ id: string }>(
          'insert into accounts (email, name, birth_band) values ($1, $2, $3) returning id',
          [account.email, account.name, account.birthBand],
        );
        const accountId = rows[0]!.id;
        await client.query(
          'insert into sign_in_identities (provider, subject, account_id) values ($1, $2, $3)',
          [ticket.provider, ticket.subject, accountId],
        );
        // the game starts with the account (NEXT 18 d): its state row, and a kept opening's books beside it
        await insertPlayer(client, accountId, game.record);
        if (game.books) {
          await client.query(
            'insert into action_log (account_id, seq, action, tick) values ($1, $2, $3, $4)',
            [accountId, game.record.version, JSON.stringify(game.books.action), game.books.tick],
          );
          for (const row of game.books.gold) {
            if (row.deltaMg === 0) continue;
            await client.query(
              'insert into gold_ledger (account_id, delta_mg, action, tick, fund) values ($1, $2, $3, $4, $5)',
              [accountId, row.deltaMg, JSON.stringify(row.action), row.tick, row.fund ?? 'purse'],
            );
          }
        }
        await client.query('delete from signup_tickets where ticket_hash = $1', [ticket.ticketHash]);
        await client.query('commit');
        return { accountId };
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        const taken = uniqueViolation(error);
        if (taken) return taken;
        throw error;
      } finally {
        client.release();
      }
    },

    async createSession(tokenHash, accountId, createdAt, expiresAt) {
      await pool.query(
        'insert into sessions (token_hash, account_id, created_at, expires_at) values ($1, $2, $3, $4)',
        [tokenHash, accountId, at(createdAt), at(expiresAt)],
      );
    },

    async sessionAccount(tokenHash, now) {
      const { rows } = await pool.query<{ account_id: string }>(
        'select account_id from sessions where token_hash = $1 and revoked_at is null and expires_at > $2',
        [tokenHash, at(now)],
      );
      return rows[0]?.account_id;
    },

    async revokeSession(tokenHash, now) {
      await pool.query('update sessions set revoked_at = $2 where token_hash = $1 and revoked_at is null', [tokenHash, at(now)]);
    },

    async account(accountId) {
      if (!UUID.test(accountId)) return undefined;
      const { rows } = await pool.query<{ name: string; email: string }>('select name, email from accounts where id = $1', [accountId]);
      return rows[0];
    },

    async closeAccount(accountId) {
      if (!UUID.test(accountId)) return;
      await pool.query('delete from accounts where id = $1', [accountId]);
    },

    async sweep(now) {
      const before = at(now);
      await pool.query('delete from oauth_flows where expires_at <= $1', [before]);
      await pool.query('delete from email_links where expires_at <= $1', [before]);
      await pool.query('delete from signup_tickets where expires_at <= $1', [before]);
      await pool.query('delete from sessions where expires_at <= $1 or revoked_at is not null', [before]);
    },
  };
}
