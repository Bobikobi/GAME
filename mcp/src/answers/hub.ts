/**
 * The hub-data document the `slots`, `requests` and `preview` answers read: the one `pnpm site` publishes in
 * web/public/api/, else one built now from the checkout alone. A document built here has no GitHub sections
 * (`sources.github` is null), so a request list is empty rather than a sample (DECISIONS.md 2026-10-10, "No sample
 * numbers").
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateHubData, type HubData } from '@game/schema/hub';
import { buildHubData } from '@game/tools';

let built: HubData | undefined;

export interface HubSource {
  doc: HubData;
  /** where the document came from, said in the answer's text */
  from: string;
}

export async function hubData(root: string): Promise<HubSource> {
  const published = join(root, 'web', 'public', 'api', 'hub-data.json');
  if (existsSync(published)) {
    const { $schema: _schema, ...doc } = JSON.parse(readFileSync(published, 'utf8')) as HubData & { $schema?: string };
    if (validateHubData(doc).length === 0) return { doc, from: `web/public/api/hub-data.json, built ${doc.built_at}` };
  }
  built ??= await buildHubData({ root, client: null, now: new Date(), previews: false, log: () => {} });
  return { doc: built, from: 'the checkout, without GitHub: run "pnpm hub:data" with a token for requests and proposals' };
}
