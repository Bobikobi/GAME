/**
 * `pnpm exec tsx tools/src/balance/weapons-cli.ts [--tables] [--variant <name>] [--json]`: the weapon matrix report
 * (docs/design/WEAPON_MATRIX.md 10 and 13) over tools/src/balance/weapon-matrix.json and the content's built values.
 * `--tables` adds the per-form harm table and the launcher pairs; `--variant` runs one of default, stop-at-9,
 * no-crossbows, rate-10-3000, all-to-10, freeze-at-5 (every variant runs every check, WM-COUNT included); `--json`
 * prints the rows, counts, errors and notes instead of the text. Exit 1 when a check fails, 2 on a bad flag. The
 * package.json script waits for the first weapon content (WEAPONS 5.5).
 */
import { readFileSync } from 'node:fs';
import { PARAMS_FILE, VARIANTS, builtFromWorld, isVariant, readSource, weaponsOutputs } from './weapons';
import { loadWorld } from './world';

const args = process.argv.slice(2);
const at = args.indexOf('--variant');
const variant = at >= 0 ? (args[at + 1] ?? '') : 'default';
if (!isVariant(variant)) {
  process.stderr.write(`usage: weapons-cli [--tables] [--variant ${VARIANTS.join('|')}] [--json]\n`);
  process.exitCode = 2;
} else {
  const { bundle, params } = loadWorld();
  const built = builtFromWorld(bundle, params, readFileSync(PARAMS_FILE, 'utf8'));
  const report = weaponsOutputs(readSource(), built, { variant, tables: args.includes('--tables') });
  if (args.includes('--json')) {
    const rows = report.rows.map(({ src: _src, inputs, ...rest }) => {
      const plain: Record<string, unknown> = { ...rest, inputs: Object.fromEntries(inputs) };
      delete plain.form;
      delete plain.spec;
      return plain;
    });
    const out = { variant: report.variant, counts: Object.fromEntries(report.counts), errors: report.errors, notes: report.notes, variants: report.variants.map((v) => v.line), rows };
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  } else {
    process.stdout.write(report.text);
  }
  process.exitCode = report.errors.length > 0 ? 1 : 0;
}
