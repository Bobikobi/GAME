/**
 * The API as it runs on a machine (NEXT 18 a, the package; 18 b, the database): it reads the assembled
 * bundle, applies the migrations, and serves the four endpoints over the store postgres keeps.
 *
 * Nothing here is signed in yet: an account and its cookie are NEXT 18 e, so this entry refuses to start
 * (exit 1, before the bundle, the database or the port) unless AUTH_MODE names a mode the build knows and,
 * for the header mode, ALLOW_DEV_HEADER says in so many words that the box is a staging one. A box that
 * serves real players is started only after that item lands.
 */
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import type { Bundle } from '@game/kernel';

import { authFromEnv, BootError, createGameApi, createPgStore, listen, type Auth } from './index';
import { databaseUrl, migrate } from './migrate';

// the identity gate comes first: a refusal here has touched nothing
let auth: Auth;
try {
  auth = authFromEnv(process.env);
} catch (error) {
  if (!(error instanceof BootError)) throw error;
  console.error(`openfold api refuses to start: ${error.message}`);
  process.exit(1);
}
console.warn(auth.notice);

function bundleFrom(path: string): Bundle {
  const text = readFileSync(path, 'utf8');
  return JSON.parse(text) as Bundle;
}

const bundlePath = process.env.BUNDLE ?? new URL('./bundle.json', import.meta.url).pathname;
const port = Number(process.env.PORT ?? 8080);
const bundle = bundleFrom(bundlePath);
const pool = new Pool({ connectionString: databaseUrl() });

// the migrations run on boot and change nothing when they are current, so a restart never needs a hand
const applied = await migrate(pool);
if (applied.length > 0) console.log(`applied ${applied.length} migration(s): ${applied.join(', ')}`);

const server = createGameApi({
  bundle,
  store: createPgStore(pool),
  resolvePlayerId: auth.resolve,
  health: () => pool.query('select 1').then(() => true),
});
const address = await listen(server, port, '0.0.0.0');
console.log(`openfold api on ${address.address}:${address.port}, bundle ${bundle.tag}`);

let closing = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    if (closing) return;
    closing = true;
    console.log(`${signal}: finishing the requests in flight`);
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    });
    // a request that hangs must not hold the container open past a restart's grace
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
