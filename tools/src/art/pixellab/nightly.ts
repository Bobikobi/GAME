/**
 * The nightly PixelLab job: what free generations buy while nobody is looking (docs/art/DRAWERS.md, "The nightly job").
 *
 * The owner's free accounts refill a few generations a day and keep up to 20. This spends them, one small piece of the
 * game's queue per generation (a text `fill` at the game's camera), and stops each account when the server refuses.
 *
 * - **Free accounts only.** The accounts come from `nightlyIndexes(config)` and only their token files are ever read: the
 *   paid account's file is never opened, so a run on it is not a case the code has to catch. A queue piece cannot name an
 *   account either (`parseQueue` refuses the key).
 * - **The balance is not trusted.** The API read 0 on the free accounts while they still gave generations, so each account
 *   is tried until the server says no. HTTP 402 ("Insufficient credits") is "none today": the answer of an account that
 *   has spent its day, not a failure. HTTP 429 is "no free slot": `Client.post` waits and asks again. Anything else (a 401
 *   token, a 422 request, a 5xx or a dropped network, a picture that cannot be read) is a failure, said out loud, and ends
 *   that account's night; the other accounts still run.
 * - **Spend is bounded.** At most `maxPerAccount` generations an account (a free account stores up to 20), so a fault in
 *   this loop cannot spend without end.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AmbiguousSubmit, Client, HttpError, type ClientOptions, type Http } from './api.js';
import { findImages, type Json } from './payload.js';
import { nightlyIndexes, type PoolConfig, type TokenReader } from './pool.js';
import { RECIPES, seedFor, type JobSpec } from './recipes.js';
import { toolString } from './run.js';

export const PIECE_CLASSES = ['pickup', 'prop'] as const;

export interface Piece {
  id: string;
  /** What it is, in words a picture model can draw. */
  what: string;
  class: (typeof PIECE_CLASSES)[number];
  /** The file or page that names the piece: why the game lacks it. */
  source: string;
}

export interface Queue {
  size: number;
  view: string;
  outline: string;
  shading: string;
  detail: string;
  pieces: Piece[];
}

const PIECE_KEYS = new Set(['id', 'what', 'class', 'source']);

/** Reads the queue file. A piece is a plain record: a key such as `account` is refused, so no piece can pin a job to an account. */
export function parseQueue(text: string): Queue {
  const raw = JSON.parse(text) as Record<string, unknown>;
  if (raw === null || typeof raw !== 'object' || !Array.isArray(raw['pieces']) || raw['pieces'].length === 0) throw new Error('queue: "pieces" must list at least one piece');
  const size = raw['size'];
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 16 || size > 400) throw new Error('queue: "size" is a whole number from 16 to 400');
  const text_ = (key: string): string => {
    const v = raw[key];
    if (typeof v !== 'string' || v === '') throw new Error(`queue: "${key}" must be a non-empty string`);
    return v;
  };
  const seen = new Set<string>();
  const pieces = (raw['pieces'] as unknown[]).map((p, i) => {
    const r = p as Record<string, unknown>;
    if (r === null || typeof r !== 'object') throw new Error(`queue: piece ${i} is not a record`);
    for (const k of Object.keys(r)) if (!PIECE_KEYS.has(k)) throw new Error(`queue: piece ${i} has the key "${k}"; a piece has only ${[...PIECE_KEYS].join(', ')}`);
    const { id, what, source } = r as { id?: unknown; what?: unknown; source?: unknown };
    if (typeof id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(id)) throw new Error(`queue: piece ${i} needs an "id" in lowercase letters, digits and _`);
    if (seen.has(id)) throw new Error(`queue: the piece "${id}" is listed twice`);
    seen.add(id);
    if (typeof what !== 'string' || what.trim() === '') throw new Error(`queue: piece "${id}" needs a "what"`);
    if (typeof source !== 'string' || source === '') throw new Error(`queue: piece "${id}" needs a "source"`);
    const cls = r['class'];
    if (cls !== 'pickup' && cls !== 'prop') throw new Error(`queue: piece "${id}" has "class" ${JSON.stringify(cls)}, expected pickup or prop`);
    return { id, what, class: cls as Piece['class'], source };
  });
  return { size, view: text_('view'), outline: text_('outline'), shading: text_('shading'), detail: text_('detail'), pieces };
}

/** The words sent to the model. */
export function promptFor(piece: Piece): string {
  const kind = piece.class === 'pickup' ? 'a small pickup item' : 'a small prop standing in the world';
  return `${piece.what}, ${kind} for a pixel art adventure game, a single object centred in the picture, nothing else`;
}

export interface NightlyDeps {
  http: Http;
  config: PoolConfig;
  readToken: TokenReader;
  queue: Queue;
  /** Piece ids that were made on an earlier night (the landed log) or earlier in this state. */
  done: ReadonlySet<string>;
  /** Where the pictures go: `<out>/<id>.png` with `<id>.json` beside it. */
  out: string;
  /** The night's date, `YYYY-MM-DD`. */
  date: string;
  say: (text: string) => void;
  clientOptions?: ClientOptions;
}

export interface NightlyOptions {
  /** Generations to try on one account in a night. */
  maxPerAccount: number;
}

export type Outcome = 'refused' | 'cap' | 'queue-empty' | 'failed' | 'no-token';

export interface AccountNight {
  label: string;
  /** Pictures this account gave tonight. */
  given: number;
  outcome: Outcome;
  error: string | null;
  /** What `/balance` said before the first try. For the log only: it has read 0 on accounts that still gave. */
  apiBalance: number | null;
}

export interface Made {
  id: string;
  account: string;
  file: string;
  seed: number;
}

export interface NightlyResult {
  date: string;
  accounts: AccountNight[];
  made: Made[];
  failures: string[];
}

function noInit(what: string): never {
  throw new Error(`the nightly fill has no ${what} input`);
}

/** The request body of one piece: the repository's own `fill` recipe, with the piece as its prompt. */
export function bodyFor(piece: Piece, queue: Queue, seed: number): { body: Record<string, Json>; job: JobSpec } {
  const job: JobSpec = {
    id: piece.id,
    recipe: 'fill',
    inputs: { description: promptFor(piece), size: queue.size, view: queue.view, outline: queue.outline, shading: queue.shading, detail: queue.detail, no_background: true },
    seed,
  };
  const body = RECIPES.fill.body(job, { image: () => noInit('picture'), images: () => noInit('picture'), size: () => noInit('size'), character: () => noInit('character'), seed }) as Record<string, Json>;
  return { body, job };
}

export async function runNightly(deps: NightlyDeps, opts: NightlyOptions): Promise<NightlyResult> {
  const { config, queue, say } = deps;
  const indexes = nightlyIndexes(config);
  const result: NightlyResult = { date: deps.date, accounts: [], made: [], failures: [] };
  if (indexes.length === 0) {
    result.failures.push('the pool has no account marked nightly');
    return result;
  }
  const madeNow = new Set<string>();
  const next = (): Piece | undefined => queue.pieces.find((p) => !deps.done.has(p.id) && !madeNow.has(p.id));
  mkdirSync(deps.out, { recursive: true });

  for (const index of indexes) {
    const account = config.accounts[index];
    // the paid account never gets here (nightlyIndexes), and this is the line that would stop a config that let it
    if (account === undefined || account.plan !== 'free' || !account.nightly) throw new Error(`account ${index} is not a free nightly account`);
    const night: AccountNight = { label: account.label, given: 0, outcome: 'refused', error: null, apiBalance: null };
    result.accounts.push(night);
    const token = deps.readToken(config, account);
    if (token === null) {
      night.outcome = 'no-token';
      say(`${account.label}: no token file, skipped`);
      continue;
    }
    const client = new Client(token, account.label, deps.http, deps.clientOptions);
    night.apiBalance = await client.balance().then((b) => b.generations, () => null);

    for (;;) {
      if (night.given >= opts.maxPerAccount) {
        night.outcome = 'cap';
        break;
      }
      const piece = next();
      if (piece === undefined) {
        night.outcome = 'queue-empty';
        break;
      }
      const seed = seedFor(`nightly/${piece.id}`);
      const { body, job } = bodyFor(piece, queue, seed);
      try {
        const answer = await client.post(RECIPES.fill.path, body);
        const image = findImages(answer.json)[0];
        if (image === undefined) throw new Error('the answer holds no picture');
        const file = join(deps.out, `${piece.id}.png`);
        writeFileSync(file, Buffer.from(image, 'base64'));
        writeFileSync(join(deps.out, `${piece.id}.json`), JSON.stringify({ prompt: promptFor(piece), tool: toolString(RECIPES.fill, body), date: deps.date, seed }));
        night.given += 1;
        madeNow.add(piece.id);
        result.made.push({ id: job.id, account: account.label, file, seed });
        say(`${account.label}: ${piece.id}`);
      } catch (error) {
        if (error instanceof HttpError && error.status === 402) {
          night.outcome = 'refused';
          say(`${account.label}: none today after ${night.given}`);
        } else {
          night.outcome = 'failed';
          night.error = error instanceof AmbiguousSubmit ? `${error.path}: ${error.why}` : error instanceof HttpError ? `HTTP ${error.status} ${error.path}: ${error.detail}` : error instanceof Error ? error.message : String(error);
          result.failures.push(`${account.label} on ${piece.id}: ${night.error}`);
          say(`${account.label}: FAILED on ${piece.id}: ${night.error}`);
        }
        break;
      }
    }
  }
  return result;
}
