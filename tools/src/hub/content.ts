/**
 * The sections of the hub-data document that come from the checkout: the creators board, the accepted records, the
 * kits, the slots of the map and the parameters (docs/team/GRUNT.md, item 3). Nothing here needs the network.
 *
 * The board's counts come from content/board.json, which `pnpm board` writes from the full history and which is
 * committed, because a deploy builds from a shallow clone that cannot see the history (tools/src/board.ts).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Bundle } from '@game/kernel';
import type { HubCreator, HubExtension, HubKit, HubParameters, HubSlot } from '@game/schema/hub';
import type { Assembled } from '../assemble';
import type { PointsConfig } from '../board';
import type { LoopConfig } from '../loop/config';

/** Where a link to a file of the repository points: the branch every pull request targets. */
export const LINK_REF = 'develop';

export const treeUrl = (repository: string, path: string): string => `https://github.com/${repository}/tree/${LINK_REF}/${path}`;
export const blobUrl = (repository: string, path: string): string => `https://github.com/${repository}/blob/${LINK_REF}/${path}`;

export interface ContentSections {
  creators: HubCreator[];
  extensions: HubExtension[];
  kits: HubKit[];
  slots: HubSlot[];
}

/** The record placed in each slot, by record id. Resources and treasures through their instances, the rest by `place.slot`. */
function slotOf(bundle: Bundle): Map<string, string> {
  const out = new Map<string, string>();
  const placed: Record<string, { place?: { slot?: string } }>[] = [bundle.resources, bundle.treasures, bundle.npcs, bundle.restores];
  for (const records of placed) {
    for (const [id, record] of Object.entries(records)) {
      const slot = record.place?.slot;
      if (slot) out.set(id, slot);
    }
  }
  return out;
}

/** The creator's folder: core's content, or the extension folder of a handle. */
function folderOf(handle: string): string {
  return handle === 'core' ? 'content/core' : `content/extensions/${handle}`;
}

export function contentSections(
  bundle: Bundle,
  kits: Assembled['kits'],
  points: PointsConfig,
  repository: string,
  addedAt: Map<string, string>,
): ContentSections {
  const slots = slotOf(bundle);
  const extensions: HubExtension[] = bundle.credits.map((c) => {
    const slot = slots.get(c.id);
    const merged = addedAt.get(c.file);
    return {
      id: c.id,
      type: c.type as HubExtension['type'],
      title: c.title,
      creator: c.creator,
      file: c.file,
      url: blobUrl(repository, c.file),
      ...(slot ? { slot } : {}),
      ai_tools: [...c.ai_tools],
      ...(merged ? { merged_at: merged } : {}),
    };
  });

  // records are what is in the game now (the credits); commits are the history's, from content/board.json
  const records = new Map<string, string[]>();
  for (const c of bundle.credits) (records.get(c.creator) ?? records.set(c.creator, []).get(c.creator)!).push(c.id);
  const handles = [...new Set([...Object.keys(bundle.board), ...records.keys()])].sort();
  const creators: HubCreator[] = handles.map((handle) => {
    const profile = bundle.creators[handle];
    const ids = records.get(handle) ?? [];
    const commits = bundle.board[handle]?.commits ?? 0;
    return {
      handle,
      name: profile?.name ?? handle,
      ...(profile?.role ? { role: profile.role } : {}),
      ...(profile?.signature ? { signature: { ...profile.signature } } : {}),
      points: points.per_record * ids.length + points.per_commit * commits,
      records: ids.length,
      commits,
      extensions: ids,
      url: treeUrl(repository, folderOf(handle)),
    };
  });

  const kitList: HubKit[] = Object.entries(kits).map(([id, kit]) => {
    const credit = bundle.credits.find((c) => c.id === id);
    return {
      id,
      title: credit?.title ?? id,
      creator: credit?.creator ?? id.split('/')[0]!,
      sprites: Object.keys(kit.sprites).length,
      url: treeUrl(repository, kit.rel),
    };
  });

  const filledBy = new Map<string, string>();
  for (const [id, slot] of [...slots].sort((a, b) => a[0].localeCompare(b[0]))) if (!filledBy.has(slot)) filledBy.set(slot, id);
  const slotList: HubSlot[] = bundle.map.slots.map((s) => ({
    id: s.id,
    kind: s.kind as HubSlot['kind'],
    ...(s.label ? { label: s.label } : {}),
    x: s.x,
    y: s.y,
    w: s.w,
    h: s.h,
    filled_by: filledBy.get(s.id) ?? null,
  }));

  return { creators, extensions, kits: kitList, slots: slotList };
}

interface BoundedValue {
  value: number;
  min: number;
  max: number;
  step: number;
}

const isBounded = (v: unknown): v is BoundedValue =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && ['value', 'min', 'max', 'step'].every((k) => typeof (v as Record<string, unknown>)[k] === 'number');

/** Every bounded number of the params body, flattened with dots; arrays take their index as a key. Plain numbers are left out. */
export function flattenBounded(body: unknown, prefix = ''): HubParameters['game'] {
  const out: HubParameters['game'] = {};
  const visit = (node: unknown, key: string) => {
    if (isBounded(node)) {
      out[key] = { value: node.value, min: node.min, max: node.max, step: node.step };
      return;
    }
    if (Array.isArray(node)) node.forEach((v, i) => visit(v, key ? `${key}.${i}` : String(i)));
    else if (typeof node === 'object' && node !== null) for (const [k, v] of Object.entries(node)) visit(v, key ? `${key}.${k}` : k);
  };
  visit(body, prefix);
  return out;
}

export function parameters(root: string, loop: LoopConfig, points: PointsConfig): HubParameters {
  const params = JSON.parse(readFileSync(join(root, 'content/core/params.json'), 'utf8')) as { params: unknown };
  const lock = JSON.parse(readFileSync(join(root, 'content/values.lock.json'), 'utf8')) as { values: Record<string, number> };
  return { loop, points, game: flattenBounded(params.params), values: { ...lock.values } };
}

const git = (root: string, args: string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/** The time a commit was made, in the form the document uses. */
export const isoOf = (unixSeconds: number): string => new Date(unixSeconds * 1000).toISOString();

/**
 * When each content file was first added, by repository path. Empty in a shallow clone: there the oldest commit
 * seems to add every file, and a guessed date is worse than none.
 */
export function addedTimes(root: string): Map<string, string> {
  const out = new Map<string, string>();
  try {
    if (git(root, ['rev-parse', '--is-shallow-repository']) === 'true') return out;
    const log = git(root, ['log', '--reverse', '--diff-filter=A', '--name-only', '--format=%x00%ct', '--', 'content']);
    for (const block of log.split('\0').slice(1)) {
      const [head, ...files] = block.split('\n').filter((l) => l.trim() !== '');
      const at = Number(head);
      if (!Number.isFinite(at)) continue;
      for (const f of files) if (!out.has(f)) out.set(f, isoOf(at));
    }
  } catch {
    // not a git checkout: no dates
  }
  return out;
}

/**
 * The commit the document is built from: its sha, time and branch. A host that builds from the files without the
 * history (Vercel) names the commit in its variables; the time is then the build's, the nearest one known.
 */
export function head(root: string, now: Date, env: NodeJS.ProcessEnv = process.env): { sha: string; at: string; branch: string } {
  try {
    return {
      sha: git(root, ['rev-parse', 'HEAD']),
      at: isoOf(Number(git(root, ['log', '-1', '--format=%ct']))),
      branch: git(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    };
  } catch {
    const sha = env['VERCEL_GIT_COMMIT_SHA'] || env['GITHUB_SHA'];
    if (!sha) throw new Error('pnpm hub:data needs a git checkout or the commit in VERCEL_GIT_COMMIT_SHA: the document names the commit it was built from.');
    return { sha, at: now.toISOString(), branch: env['VERCEL_GIT_COMMIT_REF'] || 'HEAD' };
  }
}
