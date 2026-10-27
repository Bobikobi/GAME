// The whole project in one plain-text file for an AI reader (docs/team/SEO_GEO.md section 7): the README, the
// contributing guide, the roadmap and the creator guide, read from the repository at build time so it cannot go
// stale. llms.txt is the index; this is the body.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { APIRoute } from 'astro';

const PARTS: readonly [string, string][] = [
  ['README.md', 'What Loomvale is and how it is built'],
  ['CONTRIBUTING.md', 'How a pull request is reviewed and merged'],
  ['ROADMAP.md', 'The stages: where the project is going'],
  ['docs/creators/README.md', 'The creator guide: add a record to the valley'],
];

export const GET: APIRoute = () => {
  const root = resolve(process.cwd(), '..');
  const body = PARTS.map(([file, what]) => `# ${what} (${file})\n\n${readFileSync(resolve(root, file), 'utf8').trim()}\n`).join('\n---\n\n');
  const head = `# Loomvale, in full\n\nA free pixel-art game in the browser whose places, quests and items are data records that builders add to an open repository. Code is AGPL-3.0, content is CC BY-SA 4.0. The index of this site for AI readers is /llms.txt.\n\n---\n\n`;
  return new Response(head + body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
