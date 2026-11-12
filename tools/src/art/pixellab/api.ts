/**
 * The PixelLab client: one account, one token, nothing else. Everything outside the process is injected (`Http`:
 * fetch, sleep, clock) so the tests run with no network and no real wait, and an unmocked call cannot spend.
 *
 * The token goes into one header, to `api.pixellab.ai` only. It is never in an error message, a log line or the
 * request that an error carries: a failure says the status, the path and what the server answered with the token
 * scrubbed out of it.
 */
import { numberField, stringField } from './payload.js';

export const API = 'https://api.pixellab.ai/v2';
const API_HOST = new URL(API).host;

export interface Http {
  fetch: typeof globalThis.fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

export const realHttp: Http = {
  fetch: (input, init) => globalThis.fetch(input, init),
  sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
  now: () => Date.now(),
};

/** The server answered and said no. Not charged unless the recipe says otherwise (`charged` is the caller's to check). */
export class HttpError extends Error {
  constructor(readonly status: number, readonly path: string, readonly detail: string) {
    super(`PixelLab ${path}: HTTP ${status} ${detail}`);
    this.name = 'HttpError';
  }
}

/** A job-creating call whose outcome is unknown: the network dropped, or the server failed, after the request left. */
export class AmbiguousSubmit extends Error {
  constructor(readonly path: string, readonly why: string) {
    super(`PixelLab ${path}: the request may or may not have been accepted (${why})`);
    this.name = 'AmbiguousSubmit';
  }
}

/** A job that did not finish inside the time given. The job is not lost: its id is in the ledger and a rerun collects it. */
export class PollTimeout extends Error {
  constructor(readonly jobId: string, readonly seconds: number) {
    super(`PixelLab job ${jobId} was still running after ${seconds} s`);
    this.name = 'PollTimeout';
  }
}

export interface ClientOptions {
  base?: string;
  /** Waits after a 429 (no free job slot): they grow to the last value and stay there. */
  slotBackoffMs?: readonly number[];
  /** How long to keep waiting for a slot before giving up. */
  slotWaitMs?: number;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  /** Tries for a read that dropped the network, and for a download. */
  retries?: number;
}

const DEFAULTS = {
  slotBackoffMs: [10_000, 20_000, 30_000],
  slotWaitMs: 30 * 60_000,
  pollIntervalMs: 5_000,
  pollTimeoutMs: 15 * 60_000,
  retries: 5,
};

export interface Balance {
  /** The subscription's generations left: the only thing this route spends. */
  generations: number;
  /** USD credit on the account. Shown, never spent: a route that charged dollars would stop the run. */
  usd: number;
  plan: string | null;
  status: string | null;
}

export interface Answer {
  status: number;
  json: unknown;
}

export interface JobResult {
  status: string;
  lastResponse: unknown;
  usage: unknown;
  raw: unknown;
}

export class Client {
  private readonly o: Required<ClientOptions>;

  constructor(private readonly token: string, readonly label: string, private readonly http: Http, options: ClientOptions = {}) {
    this.o = { base: API, ...DEFAULTS, ...options };
  }

  private scrub(text: string): string {
    return text.split(this.token).join('[token]').slice(0, 400);
  }

  private parse(text: string): unknown {
    try {
      return text === '' ? null : JSON.parse(text);
    } catch {
      return { raw: this.scrub(text) };
    }
  }

  private async send(method: 'GET' | 'POST', path: string, body: unknown): Promise<Answer> {
    const response = await this.http.fetch(`${this.o.base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    const json = this.parse(text);
    if (response.status >= 400) throw new HttpError(response.status, path, this.scrub(typeof json === 'object' && json !== null ? JSON.stringify(json) : text));
    return { status: response.status, json };
  }

  /** A read. A dropped network is tried again; nothing is charged by a read. */
  async get(path: string): Promise<Answer> {
    let last: unknown = null;
    for (let i = 0; i < this.o.retries; i += 1) {
      try {
        return await this.send('GET', path, undefined);
      } catch (error) {
        if (error instanceof HttpError && (error.status < 500 && error.status !== 429)) throw error;
        last = error;
        await this.http.sleep(Math.min(5_000 * (i + 1), 30_000));
      }
    }
    throw last instanceof Error ? last : new Error(`PixelLab ${path}: unreachable`);
  }

  /**
   * A call that starts work and may be charged. A 429 (no free job slot on a trial account: "Not enough concurrent
   * job slots") waits and asks again, a 4xx is the server refusing and is thrown as it is, and anything that leaves
   * the outcome unknown (the network, a 5xx) is an `AmbiguousSubmit`: the caller reads the balance before it
   * decides, so a job is never paid twice.
   */
  async post(path: string, body: unknown): Promise<Answer> {
    const started = this.http.now();
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.send('POST', path, body);
      } catch (error) {
        if (error instanceof HttpError) {
          if (error.status === 429) {
            if (this.http.now() - started >= this.o.slotWaitMs) throw error;
            const steps = this.o.slotBackoffMs;
            await this.http.sleep(steps[Math.min(attempt, steps.length - 1)] ?? 30_000);
            continue;
          }
          if (error.status >= 500) throw new AmbiguousSubmit(path, `HTTP ${error.status}`);
          throw error;
        }
        throw new AmbiguousSubmit(path, error instanceof Error ? this.scrub(error.message) : 'network');
      }
    }
  }

  async balance(): Promise<Balance> {
    const { json } = await this.get('/balance');
    return {
      generations: numberField(json, 'subscription', 'generations') ?? 0,
      usd: numberField(json, 'credits', 'usd') ?? 0,
      plan: stringField(json, 'subscription', 'plan'),
      status: stringField(json, 'subscription', 'status'),
    };
  }

  /** Waits for a background job. A failed job is returned, not thrown: whether it was charged is the caller's to read from the balance. */
  async waitJob(jobId: string, onPoll?: (status: string) => void): Promise<JobResult> {
    const started = this.http.now();
    for (;;) {
      const { json } = await this.get(`/background-jobs/${jobId}`);
      const status = stringField(json, 'status') ?? 'unknown';
      onPoll?.(status);
      if (status === 'completed' || status === 'failed') {
        return { status, lastResponse: (json as Record<string, unknown> | null)?.['last_response'] ?? null, usage: (json as Record<string, unknown> | null)?.['usage'] ?? null, raw: json };
      }
      if (this.http.now() - started >= this.o.pollTimeoutMs) throw new PollTimeout(jobId, Math.round((this.http.now() - started) / 1000));
      await this.http.sleep(this.o.pollIntervalMs);
    }
  }

  /** A stored character: its rotations and animations, with links to the pictures. */
  async character(id: string): Promise<unknown> {
    return (await this.get(`/characters/${id}`)).json;
  }

  /**
   * One picture from a link in an answer. The trial's downloads sent a browser User-Agent and the storage refused
   * without it; the Bearer token goes only to the API's own host.
   */
  async download(url: string): Promise<Buffer> {
    const headers: Record<string, string> = { 'User-Agent': 'Mozilla/5.0' };
    if (new URL(url).host === API_HOST) headers['Authorization'] = `Bearer ${this.token}`;
    let why = '';
    for (let i = 0; i < this.o.retries; i += 1) {
      try {
        const response = await this.http.fetch(url, { headers });
        if (response.ok) return Buffer.from(await response.arrayBuffer());
        why = `HTTP ${response.status}`;
      } catch (error) {
        why = error instanceof Error ? this.scrub(error.message) : 'network';
      }
      await this.http.sleep(3_000 * (i + 1));
    }
    throw new Error(`could not download ${new URL(url).host}${new URL(url).pathname}: ${why}`);
  }
}
