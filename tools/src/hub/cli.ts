/**
 * pnpm hub:data [--from <url>] [--out <path>]
 *
 * Builds the hub-data document from the checkout and GitHub, validates it and writes it (default
 * web/public/api/hub-data.json, which the site publishes at /api/hub-data.json). The token comes from
 * HUB_GITHUB_TOKEN, else GITHUB_TOKEN; without one the GitHub sections are empty and sources.github is null.
 * The players count comes from the game server GAME_SERVER_ORIGIN names; without it `accounts` is null.
 * `--from` downloads a published document instead of building one, validates it and writes it.
 * Exits 1 when the document does not validate, with the issues printed.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { validateHubData } from '@game/schema/hub';
import { REPO_ROOT } from '../load';
import { GitHubClient } from '../loop/github';
import { accountsReader } from './accounts';
import { buildHubData, buildTarget } from './build';
import { upstashReader } from './usage';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const outArg = flag('--out') ?? 'web/public/api/hub-data.json';
const out = isAbsolute(outArg) ? outArg : join(REPO_ROOT, outArg);
const from = flag('--from');

async function main(): Promise<number> {
  let doc: unknown;
  if (from) {
    const response = await fetch(from);
    if (!response.ok) {
      console.error(`hub:data: ${from} answered ${response.status}`);
      return 1;
    }
    doc = await response.json();
  } else {
    const token = process.env['HUB_GITHUB_TOKEN'] || process.env['GITHUB_TOKEN'];
    const target = buildTarget();
    doc = await buildHubData({
      client: token ? new GitHubClient(token, true) : null,
      now: new Date(),
      previews: true,
      usage: upstashReader(),
      accounts: accountsReader(),
      ...target,
    });
  }
  const issues = validateHubData(doc);
  if (issues.length > 0) {
    console.error('hub:data: the document does not validate:');
    for (const issue of issues) console.error(`  ${issue.path || '/'}: ${issue.message}`);
    return 1;
  }
  const typed = doc as { creators: unknown[]; sources: { github: { fetched_at: string } | null } };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify({ $schema: './schema/hub-data.schema.json', ...(doc as object) }, null, 2)}\n`);
  const github = typed.sources.github ? `GitHub read at ${typed.sources.github.fetched_at}` : 'without GitHub';
  console.log(`hub:data: wrote ${out.replace(`${REPO_ROOT}/`, '')}, ${typed.creators.length} creators, ${github}`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(`hub:data: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
