import { Pool } from 'pg';

import { databaseUrl, migrate } from './migrate';

const pool = new Pool({ connectionString: databaseUrl() });
try {
  const ran = await migrate(pool);
  console.log(ran.length === 0 ? 'the database is up to date' : `applied ${ran.length} migration(s): ${ran.join(', ')}`);
} finally {
  await pool.end();
}
