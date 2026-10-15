/**
 * A creator's records with their usage (docs/team/GRUNT.md, item 19), from `sources.usage` (item 17). Kept apart
 * from the page so it can be tested without a site build: a record with no usage key shows zero counts, and the
 * page itself decides whether to show the counts at all (usage is null until the stage-1 service runs).
 */
import type { HubData } from '@game/schema/hub';
import type { Builder } from './boards';

export interface CreatorRecord {
  id: string;
  title: string;
  url?: string;
  visits: number;
  pickups: number;
  reports: number;
}

export function creatorRecords(builder: Builder, hub: Pick<HubData, 'extensions' | 'usage'>): CreatorRecord[] {
  return builder.extensions
    .map((id) => {
      const ext = hub.extensions.find((e) => e.id === id);
      const counts = hub.usage?.extensions[id];
      return {
        id,
        title: ext?.title ?? id,
        ...(ext?.url ? { url: ext.url } : {}),
        visits: counts?.visits ?? 0,
        pickups: counts?.pickups ?? 0,
        reports: counts?.reports ?? 0,
      };
    })
    .sort((a, b) => b.visits - a.visits || a.title.localeCompare(b.title));
}
