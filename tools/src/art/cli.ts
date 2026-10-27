// pnpm exec tsx tools/src/art/cli.ts [--out game/public/art-review]
// Read-only without --out; exits nonzero on technical errors, not style warnings.
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { REPO_ROOT } from '../load';
import { inspectFamilies } from './family';
import { familyHtml } from './report';

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--out')) throw new Error('Usage: tsx tools/src/art/cli.ts [--out directory]');
const results = inspectFamilies(REPO_ROOT);
if (args[1]) {
  const out = resolve(REPO_ROOT, args[1]);
  const local = relative(realpathSync(REPO_ROOT), out);
  if (!local || local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local)) throw new Error('Output must be a subdirectory of this checkout');
  mkdirSync(out, { recursive: true });
  const realLocal = relative(realpathSync(REPO_ROOT), realpathSync(out));
  if (realLocal === '..' || realLocal.startsWith(`..${sep}`) || isAbsolute(realLocal)) throw new Error('Output symlink escapes checkout');
  for (const { family, report } of results) {
    if (!family) continue;
    const dir = resolve(out, family.id);
    mkdirSync(dir, { recursive: true });
    // Also reject existing family subdirectories that redirect outside the output.
    if (relative(realpathSync(out), realpathSync(dir)) !== family.id) throw new Error('Invalid report directory');
    writeFileSync(resolve(dir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(resolve(dir, 'index.html'), familyHtml(family, report, REPO_ROOT));
  }
}
console.log(JSON.stringify(results.map(({ file, report }) => ({ file, ...report })), null, 2));
process.exitCode = results.some(r => r.report.findings.some(f => f.level === 'error')) ? 1 : 0;
