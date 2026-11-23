/**
 * The removal itself, after the manager's GO (track #812). It executes a reviewed list (`remove.jsonl` of a dry run, with some
 * rows dropped by the manager) and nothing else:
 *
 *   1. the list's sha256 must be the one given with --go, and every row must still hold in a fresh plan (the same draft, the
 *      same rule); one that does not stops the run before anything is touched;
 *   2. a cold copy of every file of every draft, under a folder outside the repo, each checked by sha256 against the index;
 *      one failed check stops the run before any delete;
 *   3. the files are deleted from the drafts store's releases with `gh`, and a release left empty is deleted too;
 *   4. one amendment `{"id", "amend": true, "removed": "<rule code>", "at"}` per draft is appended to the index.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DRAFTS_REPO, type Draft, type DraftIndex, FILE_KINDS, type FileKind, type Gh, realGh, retry } from './drafts.js';
import { type Plan, type RuleId } from './prune.js';

export interface ListRow { id: string; rule: RuleId; code: string; name: string; tag: string | null; assets: string[]; bytes: number }

export function sha256OfText(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function parseList(text: string): ListRow[] {
  return text.split('\n').filter((l) => l.trim() !== '').map((l, i) => {
    const row = JSON.parse(l) as Partial<ListRow>;
    if (typeof row.id !== 'string' || !/^[0-9a-f]{16}$/.test(row.id) || typeof row.rule !== 'string' || typeof row.code !== 'string' || !Array.isArray(row.assets)) throw new Error(`list line ${i + 1} is not a removal row`);
    return row as ListRow;
  });
}

/** The rows that no longer hold: the draft is gone from the plan or another rule (or none) now stands for it. */
export function rowsThatFail(rows: readonly ListRow[], plan: Plan): string[] {
  const now = new Map(plan.remove.map((v) => [v.id, v]));
  const problems: string[] = [];
  for (const r of rows) {
    const v = now.get(r.id);
    if (v === undefined) problems.push(`${r.id} ${r.name}: ${r.rule} no longer removes it`);
    else if (v.rule !== r.rule) problems.push(`${r.id} ${r.name}: the list says ${r.rule}, the plan now says ${v.rule}`);
  }
  return problems;
}

const hashOf = (file: string): string => createHash('sha256').update(readFileSync(file)).digest('hex');

export interface ColdReport { copied: number; bytes: number; failures: string[] }

/** The index's hash for each asset of a draft: the asset's name to the kind's sha256. */
export function expectedHashes(d: Draft): Map<string, string> {
  const out = new Map<string, string>();
  for (const kind of FILE_KINDS) {
    const name = d.stored?.assets[kind as FileKind];
    const ref = d.files[kind];
    if (name !== undefined && ref) out.set(name, ref.sha256);
  }
  return out;
}

const BATCH = 40;

/** Copy every file of the listed drafts into `dest/<tag>/<asset>` and check each by sha256 against the index. Deletes nothing. */
export function coldCopy(rows: readonly ListRow[], byId: ReadonlyMap<string, Draft>, dest: string, gh: Gh = realGh, say: (t: string) => void = () => undefined): ColdReport {
  const report: ColdReport = { copied: 0, bytes: 0, failures: [] };
  const byTag = new Map<string, { asset: string; sha: string; id: string }[]>();
  for (const r of rows) {
    const d = byId.get(r.id);
    if (d === undefined || d.stored === null) { report.failures.push(`${r.id}: not stored in the drafts repo`); continue; }
    for (const [asset, sha] of expectedHashes(d)) byTag.set(d.stored.tag, [...(byTag.get(d.stored.tag) ?? []), { asset, sha, id: r.id }]);
  }
  const work = mkdtempSync(join(tmpdir(), 'art-prune-'));
  try {
    for (const [tag, items] of byTag) {
      mkdirSync(join(dest, tag), { recursive: true });
      for (let i = 0; i < items.length; i += BATCH) {
        const batch = items.slice(i, i + BATCH);
        say(`cold copy ${tag}: ${i + batch.length}/${items.length}`);
        const got = retry(gh, ['release', 'download', tag, '--repo', DRAFTS_REPO, '--dir', work, '--clobber', ...batch.flatMap((b) => ['-p', b.asset])]);
        for (const b of batch) {
          const file = join(work, b.asset);
          if (!existsSync(file)) { report.failures.push(`${b.id} ${b.asset}: not downloaded (${got.status === 0 ? 'the release has no such asset' : got.stderr.trim().slice(0, 100)})`); continue; }
          const sum = hashOf(file);
          if (sum !== b.sha) { report.failures.push(`${b.id} ${b.asset}: sha256 ${sum.slice(0, 12)} is not the index's ${b.sha.slice(0, 12)}`); rmSync(file, { force: true }); continue; }
          copyFileSync(file, join(dest, tag, b.asset));
          // the copy on disk is read back once more: the check is of the cold copy, not of the download
          if (hashOf(join(dest, tag, b.asset)) !== b.sha) { report.failures.push(`${b.id} ${b.asset}: the cold copy does not read back`); continue; }
          report.copied += 1;
          report.bytes += readFileSync(join(dest, tag, b.asset)).length;
        }
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return report;
}

export interface StoreAssetRef { id: number; name: string; tag: string }
export interface DeleteReport { deleted: number; absent: string[]; releasesDeleted: string[]; failures: string[] }

/** Delete the listed drafts' assets from their releases, then every release those deletions left empty. `store` is a fresh listing of the whole store. */
export function deleteFromStore(rows: readonly ListRow[], byId: ReadonlyMap<string, Draft>, store: readonly StoreAssetRef[], gh: Gh = realGh, say: (t: string) => void = () => undefined): DeleteReport {
  const report: DeleteReport = { deleted: 0, absent: [], releasesDeleted: [], failures: [] };
  const find = new Map(store.map((a) => [`${a.tag}/${a.name}`, a]));
  const left = new Map<string, number>();
  for (const a of store) left.set(a.tag, (left.get(a.tag) ?? 0) + 1);
  for (const r of rows) {
    const d = byId.get(r.id);
    if (d?.stored == null) continue;
    for (const asset of expectedHashes(d).keys()) {
      const a = find.get(`${d.stored.tag}/${asset}`);
      if (a === undefined) { report.absent.push(`${d.stored.tag}/${asset}`); continue; }
      const res = retry(gh, ['api', '-X', 'DELETE', `repos/${DRAFTS_REPO}/releases/assets/${a.id}`]);
      if (res.status !== 0) { report.failures.push(`${a.tag}/${a.name}: ${res.stderr.trim().slice(0, 100)}`); continue; }
      report.deleted += 1;
      left.set(a.tag, (left.get(a.tag) ?? 1) - 1);
    }
    say(`deleted ${report.deleted} files`);
  }
  for (const [tag, n] of left) {
    if (n > 0 || !rows.some((r) => byId.get(r.id)?.stored?.tag === tag)) continue;
    const res = retry(gh, ['release', 'delete', tag, '--repo', DRAFTS_REPO, '--yes', '--cleanup-tag']);
    if (res.status === 0) report.releasesDeleted.push(tag);
    else report.failures.push(`release ${tag}: ${res.stderr.trim().slice(0, 100)}`);
  }
  return report;
}

/** One amendment per draft whose files are gone. Returns how many lines were appended. */
export function markRemoved(index: DraftIndex, rows: readonly ListRow[], at: string): number {
  let n = 0;
  for (const r of rows) if (index.markRemoved(r.id, r.code, at)) n += 1;
  return n;
}

export function writeManifest(dest: string, rows: readonly ListRow[], listSha: string, at: string): void {
  mkdirSync(dest, { recursive: true });
  writeFileSync(join(dest, 'manifest.jsonl'), rows.map((r) => JSON.stringify({ id: r.id, rule: r.rule, code: r.code, name: r.name, tag: r.tag, assets: r.assets, list_sha256: listSha, at })).join('\n') + '\n');
}
