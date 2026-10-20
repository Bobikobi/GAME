/**
 * The API as it runs on a machine (NEXT 18 a, the package; 18 b, the database): it reads the assembled
 * bundle, applies the migrations, and serves the four endpoints over the store postgres keeps.
 *
 * Nothing here is signed in yet: an account and its cookie are NEXT 18 e, so this entry refuses to start
 * unless AUTH_MODE says, in so many words, that the box is a staging one and the player's id arrives in a
 * header. A box that serves real players is started only after that item lands.
 */
import { readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { Pool } from 'pg';
import type { Bundle } from '@game/kernel';

import { createGameApi, createPgStore, listen } from './index';
import { databaseUrl, migrate } from './migrate';

const PLAYER_HEADER = 'x-player-id';

function bundleFrom(path: string): Bundle {
  const text = readFileSync(path, 'utf8');
  return JSON.parse(text) as Bundle;
}

function playerIdFor(request: IncomingMessage): Promise<string | undefined> {
  if (process.env.AUTH_MODE !== 'dev-header') {
    throw new Error('No sign-in is built yet (NEXT 18 e). A staging box sets AUTH_MODE=dev-header and sends x-player-id.');
  }
  const id = request.headers[PLAYER_HEADER];
  return Promise.resolve(typeof id === 'string' && id.length > 0 && id.length <= 64 ? id : undefined);
}

const bundlePath = process.env.BUNDLE ?? new URL('./bundle.json', import.meta.url).pathname;
const port = Number(process.env.PORT ?? 8080);
const bundle = bundleFrom(bundlePath);
const pool = new Pool({ connectionString: databaseUrl() });

// the migrations run on boot and change nothing when they are current, so a restart never needs a hand
const applied = await migrate(pool);
if (applied.length > 0) console.log(`applied ${applied.length} migration(s): ${applied.join(', ')}`);
if (process.env.AUTH_MODE !== 'dev-header') {
  console.warn('AUTH_MODE is not dev-header: every request will be refused until NEXT 18 e lands.');
}

const server = createGameApi({ bundle, store: createPgStore(pool), resolvePlayerId: playerIdFor });
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
