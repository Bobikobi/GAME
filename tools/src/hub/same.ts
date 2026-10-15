/**
 * pnpm hub:same <built.json> <deployed.json>
 *
 * Whether two hub-data documents carry the same data (docs/team/GRUNT.md, item 14): the hourly loop run builds
 * the document and deploys production only when it differs from the deployed one. Fields that only say when
 * something was read (`built_at`, `sources.*.fetched_at`, the `usage` window's `since` and `until`) are left out,
 * so a quiet hour reads the same. Prints `hub-data same` (exit 0) or `hub-data changed: <paths>` (exit 1);
 * exits 2 when a file cannot be read.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** The paths of the fields that hold a time of reading, never data. */
const TIMES: readonly RegExp[] = [/^\/built_at$/, /^\/sources\/[^/]+\/fetched_at$/, /^\/usage\/(since|until)$/];
const SHOWN = 10;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The paths where the two documents differ, times left out; an array of another length is one path. */
export function hubDifferences(a: unknown, b: unknown, path = ''): string[] {
  if (TIMES.some((t) => t.test(path))) return [];
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return [path || '/'];
    return a.flatMap((v, i) => hubDifferences(v, b[i], `${path}/${i}`));
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    return keys.flatMap((k) => (k in a && k in b ? hubDifferences(a[k], b[k], `${path}/${k}`) : [`${path}/${k}`]));
  }
  return Object.is(a, b) ? [] : [path || '/'];
}

/** True when every section but the times is equal. */
export const sameHubData = (a: unknown, b: unknown): boolean => hubDifferences(a, b).length === 0;

export function runCli(args: string[]): number {
  if (args.length !== 2) {
    console.error('usage: pnpm hub:same <built.json> <deployed.json>');
    return 2;
  }
  let docs: unknown[];
  try {
    docs = args.map((p) => JSON.parse(readFileSync(p, 'utf8')) as unknown);
  } catch (error) {
    console.error(`hub:same: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
  const paths = hubDifferences(docs[0], docs[1]);
  if (paths.length === 0) {
    console.log('hub-data same');
    return 0;
  }
  const more = paths.length > SHOWN ? `, and ${paths.length - SHOWN} more` : '';
  console.log(`hub-data changed: ${paths.slice(0, SHOWN).join(', ')}${more}`);
  return 1;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) process.exit(runCli(process.argv.slice(2)));
