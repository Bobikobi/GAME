/** The hourly refresh (docs/team/GRUNT.md, item 14): two hub-data documents are the same when only their times differ. */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildHubData } from '../../src/hub/build';
import { hubDifferences, runCli, sameHubData } from '../../src/hub/same';
import type { UsageReader } from '../../src/hub/usage';

const REPO = 'mist/vale';

/** A reader that answers every count with `count`. */
const reader = (count: number): UsageReader => ({
  counts: async (keys) => keys.map(() => count),
  members: async () => ['opening/arch'],
  lengths: async (keys) => keys.map(() => 0),
});

const build = (now: string, count = 3) =>
  buildHubData({ client: null, now: new Date(now), previews: true, repository: REPO, usage: reader(count), log: () => {} });

describe('sameHubData', () => {
  it('reads two documents built an hour apart from the same data as the same', async () => {
    const a = await build('2026-10-15T10:00:00Z');
    const b = await build('2026-10-15T11:00:00Z');
    expect(a.built_at).not.toBe(b.built_at);
    expect(a.usage?.until).not.toBe(b.usage?.until);
    expect(sameHubData(a, b)).toBe(true);
  });

  it('reads a changed count as changed and names where', async () => {
    const a = await build('2026-10-15T10:00:00Z', 3);
    const b = await build('2026-10-15T11:00:00Z', 4);
    expect(sameHubData(a, b)).toBe(false);
    const id = Object.keys(a.usage?.extensions ?? {})[0];
    expect(hubDifferences(a, b)).toContain(`/usage/extensions/${id}/visits`);
  });

  it('reads a missing usage section as changed, so a run without the counters cannot pass for a quiet one', async () => {
    const a = await build('2026-10-15T10:00:00Z');
    const b = { ...a, usage: null, sources: { ...a.sources, usage: null } };
    expect(hubDifferences(a, b)).toEqual(['/sources/usage', '/usage']);
  });

  it('keeps every other time: a moved vote close is data', () => {
    const a = { built_at: '1', votes: [{ closes_at: '2026-10-16T00:00:00Z' }] };
    expect(hubDifferences(a, { built_at: '2', votes: [{ closes_at: '2026-10-17T00:00:00Z' }] })).toEqual(['/votes/0/closes_at']);
    expect(hubDifferences(a, { built_at: '2', votes: [] })).toEqual(['/votes']);
    expect(hubDifferences({ a: 1 }, { b: 1 })).toEqual(['/a', '/b']);
  });
});

describe('pnpm hub:same', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
    vi.restoreAllMocks();
  });
  const files = (...docs: unknown[]) => {
    const dir = mkdtempSync(join(tmpdir(), 'hub-same-'));
    dirs.push(dir);
    return docs.map((doc, i) => {
      const path = join(dir, `${i}.json`);
      writeFileSync(path, JSON.stringify(doc));
      return path;
    });
  };

  it('prints the line the proving command greps for', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(runCli(files({ built_at: '1', n: 1 }, { built_at: '2', n: 1 }))).toBe(0);
    expect(runCli(files({ n: 1 }, { n: 2 }))).toBe(1);
    expect(log.mock.calls.map((c) => c[0])).toEqual(['hub-data same', 'hub-data changed: /n']);
  });

  it('exits 2 on a file it cannot read', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(runCli(['/nonexistent/a.json', '/nonexistent/b.json'])).toBe(2);
    expect(runCli([])).toBe(2);
  });
});
