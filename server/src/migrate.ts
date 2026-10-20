import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

/** The migration files in the order they are applied: a numbered set of SQL files, each run once. */
const MIGRATIONS = fileURLToPath(new URL('../migrations', import.meta.url));

/**
 * Apply every migration that has not run yet, each inside its own transaction, and return their names.
 * The table `schema_migrations` is the record: a file whose name is there is skipped, so a second run on
 * the same database applies nothing (NEXT 18 b).
 */
export async function migrate(pool: Pool): Promise<string[]> {
  await pool.query(
    'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
  );
  const { rows } = await pool.query<{ name: string }>('select name from schema_migrations');
  const applied = new Set(rows.map((row) => row.name));
  const files = (await readdir(MIGRATIONS)).filter((file) => file.endsWith('.sql')).sort();
  const ran: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(MIGRATIONS, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
      ran.push(file);
    } catch (error) {
      await client.query('rollback');
      throw new Error(`Migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    } finally {
      client.release();
    }
  }
  return ran;
}

/** The connection string the server and the migration CLI both read. */
export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.DATABASE_URL;
  if (!url) throw new Error('Set DATABASE_URL to the game database, for example postgres://game@localhost:5432/game.');
  return url;
}
