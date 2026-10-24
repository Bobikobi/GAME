/**
 * pnpm check | values | bundle
 *
 *   check    validate every content file (schema, references, economy, sprites), NEXT.md's Status lines and the shrink-only lists
 *   values   re-anchor content/values.lock.json (core maintainers only) and print gold per hour of making
 *   bundle   build game/src/generated/bundle.json and copy the kits for the client
 *   credits  write CREDITS.md from the content (--verify: fail when it is stale)
 *   board    write content/board.json, creator points and commits, from the git history
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonical } from '@game/kernel';
import { computeBoard, readCommits, readPoints, writeBoard } from './board';
import { formatIssues, runCheck, runRepoCheck } from './check';
import { LOCK_FILE, REPO_ROOT } from './load';
import { formatMaking, makingReport } from './making';

const [command, ...args] = process.argv.slice(2);
const json = args.includes('--json');

function check(): ReturnType<typeof runCheck> {
  const result = runRepoCheck();
  if (json) console.log(JSON.stringify({ files: result.files, issues: result.issues }, null, 2));
  else console.log(formatIssues(result));
  return result;
}

switch (command) {
  case 'check': {
    const result = check();
    process.exit(result.issues.some((i) => i.level === 'error') ? 1 : 0);
    break;
  }
  case 'values': {
    const { assembled } = runCheck();
    const b = assembled.bundle;
    if (!b) {
      console.error('The content does not assemble; run "pnpm check" first.');
      process.exit(1);
    }
    const sorted = Object.fromEntries(Object.keys(b.values).sort().map((k) => [k, b.values[k]]));
    writeFileSync(LOCK_FILE, `${JSON.stringify({ format: 1, note: 'Value anchor (rule R11). Re-anchored only by core maintainers.', values: sorted }, null, 2)}\n`);
    console.log(`anchored ${Object.keys(sorted).length} values in content/values.lock.json`);
    console.log(`\ngold per hour of making, an average try at the recipe's own level (CR-22):\n${formatMaking(makingReport(b))}`);
    break;
  }
  case 'bundle': {
    const result = runCheck();
    const errors = result.issues.filter((i) => i.level === 'error');
    const b = result.assembled.bundle;
    if (errors.length > 0 || !b) {
      console.log(formatIssues(result));
      console.error('\nNot bundling: fix the errors above.');
      process.exit(1);
    }
    const generated = join(REPO_ROOT, 'game', 'src', 'generated');
    mkdirSync(generated, { recursive: true });
    // canonical() proves the bundle holds integers only before the client sees it
    canonical(b);
    writeFileSync(join(generated, 'bundle.json'), JSON.stringify(b));
    const kitOut = join(REPO_ROOT, 'game', 'public', 'kit');
    rmSync(kitOut, { recursive: true, force: true });
    for (const [kitId, kit] of Object.entries(result.assembled.kits)) {
      cpSync(kit.dir, join(kitOut, kitId), { recursive: true, filter: (src) => !src.endsWith('.json') });
    }
    console.log(`bundle ${b.tag}: ${Object.keys(b.items).length} items, ${Object.keys(b.instances).length} placed nodes, ${Object.keys(b.sprites).length} sprites`);
    break;
  }
  case 'board': {
    const b = runCheck().assembled.bundle;
    if (!b) {
      console.error('The content does not assemble; run "pnpm check" first.');
      process.exit(1);
    }
    const points = readPoints();
    const board = computeBoard(readCommits(), b.credits, points);
    writeBoard(board);
    for (const [who, e] of Object.entries(board)) console.log(`${who}: ${e.points} points, ${e.records} records, ${e.commits} commits`);
    break;
  }
  case 'credits': {
    const b = runCheck().assembled.bundle;
    if (!b) {
      console.error('The content does not assemble; run "pnpm check" first.');
      process.exit(1);
    }
    const file = join(REPO_ROOT, 'CREDITS.md');
    const text = creditsText(b.credits);
    if (args.includes('--verify')) {
      if (!existsSync(file) || readFileSync(file, 'utf8') !== text) {
        console.error('CREDITS.md is out of date: run "pnpm credits" and commit it.');
        process.exit(1);
      }
      console.log('CREDITS.md is current');
      break;
    }
    writeFileSync(file, text);
    console.log(`wrote CREDITS.md: ${b.credits.length} files by ${new Set(b.credits.map((c) => c.creator)).size} creators`);
    break;
  }
  default:
    console.error('usage: tsx tools/src/cli.ts check [--json] | values | bundle | credits [--verify]');
    process.exit(2);
}

function creditsText(credits: { title: string; type: string; creator: string; file: string; ai_tools: string[] }[]): string {
  const lines = [
    '# Credits',
    '',
    'Everyone whose work is in the valley. Written by `pnpm credits` from the content files; CI fails when it is stale, so do not edit it by hand.',
    '',
  ];
  const creators = [...new Set(credits.map((c) => c.creator))].sort((a, b) => (a === 'core' ? -1 : b === 'core' ? 1 : a.localeCompare(b)));
  for (const creator of creators) {
    const mine = credits.filter((c) => c.creator === creator).sort((a, b) => a.file.localeCompare(b.file));
    lines.push(`## ${creator === 'core' ? 'The core team' : `[${creator}](https://github.com/${creator})`}`, '');
    for (const c of mine) lines.push(`- ${c.title} (${c.type}) - \`${c.file}\``);
    const tools = [...new Set(mine.flatMap((c) => c.ai_tools))].sort();
    if (tools.length > 0) lines.push('', `AI tools: ${tools.join('; ')}.`);
    lines.push('');
  }
  lines.push(
    '## Libraries and fonts',
    '',
    '- [Phaser](https://phaser.io) game framework - MIT license.',
    '- [Pixelify Sans](https://github.com/eifetx/Pixelify-Sans) by Stefie Justprince - SIL Open Font License 1.1 (`game/public/fonts/OFL.txt`).',
    '- [Atkinson Hyperlegible Next](https://github.com/googlefonts/atkinson-hyperlegible-next) by the Braille Institute of America - SIL Open Font License 1.1 (`game/public/fonts/atkinson-hyperlegible-next/OFL.txt`).',
    '',
  );
  return lines.join('\n');
}
