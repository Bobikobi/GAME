/**
 * The four stage-1 endpoints (docs/team/GRUNT.md, item 17; DECISIONS.md 2026-10-07), as one function over a store
 * so the tests run on a fake. No identity is kept: the only trace of a caller is a rate-limit key made of the hash
 * of its address and the minute, which expires with the minute.
 */
import { createHash } from 'node:crypto';
import {
  S1_COUNTER_TTL_S,
  S1_RATE_LIMIT,
  S1_RATE_TTL_S,
  S1_REPORTS_KEPT,
  s1Keys,
  s1Valid,
  s1Window,
  type S1Endpoint,
  type S1Record,
  type S1Report,
  type S1Stop,
} from '@game/schema/s1';

/** What the handlers need from Redis: three operations, each a few commands. */
export interface S1Store {
  /** INCR; the first increment of a key also sets its expiry. Returns the new value. */
  incr(key: string, ttlSeconds: number): Promise<number>;
  /** SADD with an expiry on the set. */
  sadd(key: string, member: string, ttlSeconds: number): Promise<void>;
  /** LPUSH, then keep the newest `keep` entries. */
  push(key: string, value: string, keep: number): Promise<void>;
}

export interface S1Call {
  endpoint: string;
  method: string;
  /** the raw body text */
  body: string;
  /** the address of the caller, as the host reports it */
  ip: string;
  /** the Origin header, when the browser sent one */
  origin: string | null;
  /** the origin (scheme, host, port) this request was served from */
  self: string;
  now: Date;
}

export const MAX_BODY = 1024;

const reply = (status: number, headers?: Record<string, string>): Response => new Response(null, { status, ...(headers ? { headers } : {}) });

const isEndpoint = (name: string): name is S1Endpoint => ['visit', 'pickup', 'stop', 'report'].includes(name);

export async function handleS1(store: S1Store | null, call: S1Call): Promise<Response> {
  if (call.method !== 'POST') return reply(405, { Allow: 'POST' });
  if (!isEndpoint(call.endpoint)) return reply(404);
  // same origin only: a browser page of another site is refused, a plain request (curl, the beacon of /play/) has no Origin or ours
  if (call.origin !== null && call.origin !== 'null') {
    let sameHost = false;
    try {
      sameHost = new URL(call.origin).origin === call.self;
    } catch {
      /* an unreadable Origin is a foreign one */
    }
    if (!sameHost) return reply(403);
  } else if (call.origin === 'null') {
    return reply(403);
  }
  if (call.body.length > MAX_BODY) return reply(413);
  let body: unknown;
  try {
    body = JSON.parse(call.body);
  } catch {
    return reply(400);
  }
  if (!s1Valid(call.endpoint, body)) return reply(400);
  if (!store) return reply(503);

  const minute = Math.floor(call.now.getTime() / 60_000);
  const hash = createHash('sha256').update(call.ip).digest('hex');
  if ((await store.incr(s1Keys.rate(hash, minute), S1_RATE_TTL_S)) > S1_RATE_LIMIT) return reply(429, { 'Retry-After': '60' });

  const window = s1Window(call.now);
  switch (call.endpoint) {
    case 'visit':
      await store.incr(s1Keys.visits(window, (body as S1Record).id), S1_COUNTER_TTL_S);
      break;
    case 'pickup':
      await store.incr(s1Keys.pickups(window, (body as S1Record).id), S1_COUNTER_TTL_S);
      break;
    case 'stop': {
      const { step } = body as S1Stop;
      await store.sadd(s1Keys.steps(window), step, S1_COUNTER_TTL_S);
      await store.incr(s1Keys.stops(window, step), S1_COUNTER_TTL_S);
      break;
    }
    case 'report': {
      const { id, text } = body as S1Report;
      await store.push(s1Keys.reports(id), text, S1_REPORTS_KEPT);
      break;
    }
  }
  return reply(204);
}
