/**
 * The client of the stage-1 service (docs/team/GRUNT.md, item 18; DECISIONS.md 2026-10-07): a visit when a player
 * reaches a placed record, a pickup when they gather from it, a stop on each quest step, and one report per
 * record. No identity is sent and no error is ever shown: the game plays the same when the service is down.
 */

export type Post = (path: string, body: unknown) => void;

/** The service lives next to the game: /play/ and /api/s1/ are siblings. */
const BASE = '../api/s1/';

/** A page opened from a file or a dev machine has no service to talk to. */
export function s1Available(loc: Pick<Location, 'protocol' | 'hostname'> = location): boolean {
  if (loc.protocol !== 'http:' && loc.protocol !== 'https:') return false;
  return !['localhost', '127.0.0.1', '[::1]', '::1'].includes(loc.hostname);
}

/** `navigator.sendBeacon` when there is one, else `fetch` with `keepalive`; every error is swallowed. */
export const beaconPost: Post = (path, body) => {
  try {
    if (!s1Available()) return;
    const url = new URL(`${BASE}${path}/`, location.href).href;
    const text = JSON.stringify(body);
    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url, new Blob([text], { type: 'text/plain' }))) return;
    void fetch(url, { method: 'POST', body: text, keepalive: true, credentials: 'omit', headers: { 'content-type': 'text/plain' } }).catch(() => {});
  } catch {
    /* the service is not the game's business */
  }
};

let post: Post = beaconPost;
const sent = new Set<string>();

/** Tests swap the transport and start from nothing sent. */
export function s1Use(next: Post): void {
  post = next;
  sent.clear();
}

const once = (kind: string, key: string, path: string, body: unknown): void => {
  const id = `${kind}:${key}`;
  if (sent.has(id)) return;
  sent.add(id);
  try {
    post(path, body);
  } catch {
    /* never breaks play */
  }
};

export const REPORTED_PREFIX = 's1.reported.';

const reportedBefore = (id: string): boolean => {
  try {
    return localStorage.getItem(`${REPORTED_PREFIX}${id}`) !== null;
  } catch {
    return sent.has(`report:${id}`);
  }
};

export const s1 = {
  /** once per record per session */
  visit: (id: string): void => once('visit', id, 'visit', { id }),
  /** once per record per session: a count of who picked from it, not of how often */
  pickup: (id: string): void => once('pickup', id, 'pickup', { id }),
  /** once per step per session */
  stop: (step: string): void => once('stop', step, 'stop', { step }),
  reported: reportedBefore,
  /** Sends one report for a record, ever for this browser. False when it was sent before or the text is empty. */
  report(id: string, text: string): boolean {
    const t = text.trim().slice(0, 240);
    if (!t || reportedBefore(id)) return false;
    try {
      localStorage.setItem(`${REPORTED_PREFIX}${id}`, '1');
    } catch {
      /* a browser without storage keeps the once-per-session guard below */
    }
    once('report', id, 'report', { id, text: t });
    return true;
  },
};
