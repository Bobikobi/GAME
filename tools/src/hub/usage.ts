/**
 * The `usage` section of hub-data (docs/team/GRUNT.md, item 17): the stage-1 service's counters, read with the
 * two Upstash environment names. Without them `usage` and `sources.usage` stay null, and a section whose source
 * is missing is never guessed. The keys are the ones the endpoints write (schema/src/s1.ts).
 */
import { Redis } from '@upstash/redis';
import { s1Keys, s1Window } from '@game/schema/s1';
import type { HubUsage } from '@game/schema/hub';

/** Four weekly windows are summed, newest first. */
export const USAGE_WINDOWS = 4;
const MAX_STEPS = 200;

/** What the reader needs from Redis. */
export interface UsageReader {
  /** the values of the keys, null where a key is missing */
  counts(keys: string[]): Promise<(number | null)[]>;
  members(key: string): Promise<string[]>;
  lengths(keys: string[]): Promise<number[]>;
}

export function upstashReader(env: NodeJS.ProcessEnv = process.env): UsageReader | null {
  const url = env['UPSTASH_REDIS_REST_URL'];
  const token = env['UPSTASH_REDIS_REST_TOKEN'];
  if (!url || !token) return null;
  const redis = new Redis({ url, token });
  return {
    async counts(keys) {
      if (keys.length === 0) return [];
      return (await redis.mget<(number | string | null)[]>(...keys)).map((v) => (v === null ? null : Number(v)));
    },
    members: (key) => redis.smembers(key),
    async lengths(keys) {
      if (keys.length === 0) return [];
      const pipe = redis.pipeline();
      for (const key of keys) pipe.llen(key);
      return (await pipe.exec<number[]>()).map(Number);
    },
  };
}

/** The windows read, newest first, for an instant. */
export function usageWindows(now: Date): string[] {
  return Array.from({ length: USAGE_WINDOWS }, (_, i) => s1Window(new Date(now.getTime() - i * 7 * 86_400_000)));
}

const sum = (rows: (number | null)[][], i: number): number => rows.reduce((total, row) => total + (row[i] ?? 0), 0);

/** The usage of the given records and of every step seen in the windows. */
export async function readUsage(reader: UsageReader, ids: readonly string[], now: Date): Promise<{ usage: HubUsage; window_days: number }> {
  const windows = usageWindows(now);
  const visits = await Promise.all(windows.map((w) => reader.counts(ids.map((id) => s1Keys.visits(w, id)))));
  const pickups = await Promise.all(windows.map((w) => reader.counts(ids.map((id) => s1Keys.pickups(w, id)))));
  const reports = await reader.lengths(ids.map((id) => s1Keys.reports(id)));

  const stepSets = await Promise.all(windows.map((w) => reader.members(s1Keys.steps(w))));
  const steps = [...new Set(stepSets.flat())].filter((s) => /^[a-z0-9_./:-]{1,80}$/.test(s)).sort().slice(0, MAX_STEPS);
  const stops = await Promise.all(windows.map((w) => reader.counts(steps.map((s) => s1Keys.stops(w, s)))));

  const extensions: HubUsage['extensions'] = {};
  ids.forEach((id, i) => {
    extensions[id] = { visits: sum(visits, i), pickups: sum(pickups, i), reports: reports[i] ?? 0 };
  });
  const window_days = USAGE_WINDOWS * 7;
  return {
    window_days,
    usage: {
      since: new Date(now.getTime() - window_days * 86_400_000).toISOString(),
      until: now.toISOString(),
      extensions,
      stops: steps.map((step, i) => ({ step, players: sum(stops, i) })).filter((s) => s.players > 0),
    },
  };
}
