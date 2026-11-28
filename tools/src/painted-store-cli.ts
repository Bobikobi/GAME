/**
 * The painted lands' pictures through the store (tools/src/painted-store.ts).
 *
 *   pnpm painted:fetch                        place every manifest's files beside the page (pnpm bundle runs the same)
 *   pnpm painted:manifest <scene-dir> [--store <dir>]
 *                                             write game/painted/<scene id>.json from a finished scene folder; with --store, also write its
 *                                             files into that folder under their sha256 (a local stand-in store)
 *
 * PAINTED_STORE names the store (a folder or an http(s) address), PAINTED_REQUIRED=1 makes a manifest with no store fail the run.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { REPO_ROOT } from './load';
import { PAINTED_CACHE, PAINTED_MANIFESTS, PAINTED_OUT, fetchAll, makeManifest } from './painted-store';

const [command, ...args] = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

if (command === 'fetch') {
  try {
    for (const line of await fetchAll({ manifestDir: PAINTED_MANIFESTS, cache: PAINTED_CACHE, out: PAINTED_OUT, store: process.env.PAINTED_STORE, required: process.env.PAINTED_REQUIRED === '1' })) console.log(line);
  } catch (e) {
    console.error(`painted: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
} else if (command === 'manifest' && args[0] && !args[0].startsWith('--')) {
  const store = flag('--store');
  const m = makeManifest(resolve(args[0]), store ? resolve(store) : undefined);
  mkdirSync(PAINTED_MANIFESTS, { recursive: true });
  const path = join(PAINTED_MANIFESTS, `${m.scene}.json`);
  writeFileSync(path, `${JSON.stringify(m, null, 2)}\n`);
  const bytes = m.files.reduce((n, f) => n + f.bytes, 0);
  console.log(`${path.slice(REPO_ROOT.length + 1)}: ${m.files.length} files, ${bytes} bytes${store ? `; blobs in ${store}` : ''}`);
} else {
  console.error('usage: tsx tools/src/painted-store-cli.ts fetch | manifest <scene-dir> [--store <dir>]');
  process.exit(2);
}
