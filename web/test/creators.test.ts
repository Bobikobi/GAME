// The creator's data page (docs/team/GRUNT.md, item 19): a creator's records from `sources.usage`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { HubData } from '@game/schema/hub';
import { builders } from '../src/data/boards';
import { creatorRecords } from '../src/data/creator-usage';

const ROOT = join(import.meta.dirname, '..');
const fixture = JSON.parse(readFileSync(join(ROOT, '../schema/test/fixtures/hub-data.json'), 'utf8')) as HubData;
const trout = builders.find((b) => b.handle === 'trout-maker') ?? (fixture.creators.find((c) => c.handle === 'trout-maker') as (typeof builders)[number]);

describe('creatorRecords', () => {
  it('shows a creator record with zero counts when usage is null', () => {
    expect(fixture.usage).toBeNull();
    const rows = creatorRecords(trout, fixture);
    const ext = fixture.extensions.find((e) => e.id === 'trout-maker/river-trout')!;
    expect(rows).toEqual([{ id: 'trout-maker/river-trout', title: ext.title, url: ext.url, visits: 0, pickups: 0, reports: 0 }]);
  });

  it('carries the counts from sources.usage when it is filled', () => {
    const withUsage: HubData = {
      ...fixture,
      usage: {
        since: '2026-10-01T00:00:00.000Z',
        until: '2026-10-08T00:00:00.000Z',
        extensions: { 'trout-maker/river-trout': { visits: 40, pickups: 31, reports: 2 } },
        stops: [],
      },
    };
    const rows = creatorRecords(trout, withUsage);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ visits: 40, pickups: 31, reports: 2 });
  });

  it('falls back to the record id when it is not in extensions', () => {
    const ghost = { ...trout, extensions: ['core/no-such-record'] };
    const rows = creatorRecords(ghost, fixture);
    expect(rows).toEqual([{ id: 'core/no-such-record', title: 'core/no-such-record', visits: 0, pickups: 0, reports: 0 }]);
  });

  it('sorts by visits, most first, ties by title', () => {
    const multi = { ...trout, extensions: ['core/berry', 'core/trowel'] };
    const withUsage: HubData = {
      ...fixture,
      usage: { since: '2026-10-01T00:00:00.000Z', until: '2026-10-08T00:00:00.000Z', extensions: { 'core/berry': { visits: 5, pickups: 1, reports: 0 }, 'core/trowel': { visits: 9, pickups: 0, reports: 0 } }, stops: [] },
    };
    const rows = creatorRecords(multi, withUsage);
    expect(rows.map((r) => r.id)).toEqual(['core/trowel', 'core/berry']);
  });
});

describe('the creator page', () => {
  it('is built for a real creator, and says usage opens with the stage-1 service when it has none', () => {
    const core = builders.find((b) => b.handle === 'core')!;
    const html = readFileSync(join(ROOT, 'dist/hub/creators/core/index.html'), 'utf8');
    expect(html).toContain('Usage opens with the stage-1 service.');
    expect(html).toContain(core.name);
  });
});
