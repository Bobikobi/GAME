/**
 * Writes schema/json/<name>.schema.json from the TypeBox definitions, so
 * editors and AI tools can read the format without running any code.
 * Two groups: the extension file types (SCHEMAS) and the published documents
 * (DOCUMENT_SCHEMAS, today hub-data). `--verify` fails when the committed
 * files are stale (run in CI).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMAS } from './index';
import { DOCUMENT_SCHEMAS } from './hub';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'json');
const verify = process.argv.includes('--verify');
const stale: string[] = [];
const all = { ...SCHEMAS, ...DOCUMENT_SCHEMAS };

mkdirSync(outDir, { recursive: true });
for (const [name, schema] of Object.entries(all)) {
  const doc = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    ...JSON.parse(JSON.stringify(schema)),
    $id: `https://github.com/Bobikobi/GAME/schema/json/${name}.schema.json`,
  };
  const text = `${JSON.stringify(doc, null, 2)}\n`;
  const file = join(outDir, `${name}.schema.json`);
  if (verify) {
    if (!existsSync(file) || readFileSync(file, 'utf8') !== text) stale.push(file);
  } else {
    writeFileSync(file, text);
  }
}

if (verify && stale.length > 0) {
  console.error(`Schema files are out of date. Run "pnpm schemas" and commit:\n  ${stale.join('\n  ')}`);
  process.exit(1);
}
console.log(verify ? 'schema files are current' : `wrote ${Object.keys(all).length} schema files to schema/json`);
