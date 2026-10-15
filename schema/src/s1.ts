/**
 * The bodies of the stage-1 service (docs/team/GRUNT.md, item 17; DECISIONS.md 2026-10-07): four POST
 * endpoints under /api/s1/ that count visits, pickups and stops and keep short reports, with no identity.
 * The key names live here too, so the endpoints that write them and `pnpm hub:data` that reads them agree.
 */
import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { Id } from './index';

/** A record seen or picked up: `visit` and `pickup` carry the same body. */
export const S1Record = Type.Object({ id: Id }, { additionalProperties: false, description: 'Body of POST /api/s1/visit and /api/s1/pickup.' });

export const S1Stop = Type.Object(
  { step: Type.String({ pattern: '^[a-z0-9_./:-]+$', minLength: 1, maxLength: 80, description: 'The opening step the player reached.' }) },
  { additionalProperties: false, description: 'Body of POST /api/s1/stop.' },
);

export const S1_REPORT_MAX = 240;
export const S1Report = Type.Object(
  { id: Id, text: Type.String({ minLength: 1, maxLength: S1_REPORT_MAX, description: 'A short note on the record. Kept as typed, so it is never shown unreviewed.' }) },
  { additionalProperties: false, description: 'Body of POST /api/s1/report.' },
);

export type S1Record = Static<typeof S1Record>;
export type S1Stop = Static<typeof S1Stop>;
export type S1Report = Static<typeof S1Report>;

/** The four endpoints and the body each takes. */
export const S1_ENDPOINTS = { visit: S1Record, pickup: S1Record, stop: S1Stop, report: S1Report } as const;
export type S1Endpoint = keyof typeof S1_ENDPOINTS;

export const S1_SCHEMAS = { 's1-record': S1Record, 's1-stop': S1Stop, 's1-report': S1Report } as const;

/** True when `body` fits the endpoint's schema. */
export function s1Valid(endpoint: S1Endpoint, body: unknown): boolean {
  return Value.Check(S1_ENDPOINTS[endpoint], body);
}

/** Counters live in weekly windows; a key outlives its window by about three months and then goes. */
export const S1_COUNTER_TTL_S = 100 * 24 * 3600;
export const S1_RATE_LIMIT = 30;
export const S1_RATE_TTL_S = 60;
export const S1_REPORTS_KEPT = 50;

/** "2026-W41": the ISO week of a UTC instant. */
export function s1Window(at: Date): string {
  const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export const s1Keys = {
  visits: (window: string, id: string) => `s1:${window}:visits:${id}`,
  pickups: (window: string, id: string) => `s1:${window}:pickups:${id}`,
  stops: (window: string, step: string) => `s1:${window}:stops:${step}`,
  /** the steps seen in a window, so the reader needs no scan */
  steps: (window: string) => `s1:${window}:steps`,
  reports: (id: string) => `s1:reports:${id}`,
  rate: (ipHash: string, minute: number) => `s1:rl:${ipHash}:${minute}`,
} as const;
