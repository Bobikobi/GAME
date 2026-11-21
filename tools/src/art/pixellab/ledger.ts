/**
 * The ledger of the PixelLab route: `tools/kit-gen/pixellab-ledger.jsonl`, append-only, one line per step of a job.
 * It is a write-ahead log. A job writes `started` before it posts, `submitted` the moment the server has answered with
 * its ids, `done` when the pictures are on disk. A run that stops anywhere folds the log by job key and goes on from
 * the last step: `done` is skipped, `submitted` is collected without a second post (the job is already paid for), and
 * `started` with no `submitted` is checked against the balance and reported, never silently posted again.
 *
 * A line holds the account's index and label, never a token. The key is the job id plus a hash of what the job asks
 * for, so an edited spec is a new job and an old `done` cannot stand in for it.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type Phase = 'started' | 'submitted' | 'done' | 'failed' | 'ambiguous';

export interface Ids {
  background_job_ids?: string[];
  character_id?: string;
  animation_group_id?: string;
}

export interface LedgerLine {
  at: string;
  /** `<spec>/<job>#<hash>`. */
  key: string;
  spec: string;
  job: string;
  recipe: string;
  phase: Phase;
  /** The account's index in the pool config. */
  account: number;
  label: string;
  /** The estimate the run admitted the job on; null when the recipe's cost has not been measured. */
  estimate?: number | null;
  /** Generations on the account before and after, read from /balance. */
  before?: number;
  after?: number;
  /** before - after, or null when another job ran on the same account meanwhile and the difference is shared. */
  spent?: number | null;
  exact?: boolean;
  /** What the response said it charged (`usage`), when it said. */
  usage?: unknown;
  seconds?: number;
  ids?: Ids;
  /** Output files, relative to the spec's output folder, in the order `@job#n` counts them. */
  files?: string[];
  /** The key structure of the first answer of this recipe, without picture data. */
  shape?: string[];
  result?: 'ok' | 'failed' | 'lost' | 'resumed' | 'unknown';
  error?: string;
}

export function parseLedger(text: string): LedgerLine[] {
  return text.split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as LedgerLine);
}

export class Ledger {
  readonly lines: LedgerLine[];

  constructor(readonly path: string, private readonly clock: () => Date = () => new Date()) {
    this.lines = existsSync(path) ? parseLedger(readFileSync(path, 'utf8')) : [];
  }

  append(line: Omit<LedgerLine, 'at'>): LedgerLine {
    const full = { at: this.clock().toISOString(), ...line } as LedgerLine;
    mkdirSync(dirname(this.path), { recursive: true });
    appendFileSync(this.path, `${JSON.stringify(full)}\n`);
    this.lines.push(full);
    return full;
  }

  /** Where a job stands: its last line, and the ids and files any line of it carried. */
  state(key: string): JobState | null {
    const mine = this.lines.filter((l) => l.key === key);
    if (mine.length === 0) return null;
    const last = mine[mine.length - 1] as LedgerLine;
    const ids: Ids = {};
    for (const l of mine) Object.assign(ids, l.ids);
    const done = mine.find((l) => l.phase === 'done');
    const started = [...mine].reverse().find((l) => l.phase === 'started');
    return { phase: last.phase, last, ids, files: done?.files ?? [], account: last.account, before: started?.before ?? null };
  }

  /** The cost the API has charged for a recipe, measured: the median of its exact `spent`, or null before the first. */
  measured(recipe: string): number | null {
    const spent = this.lines.filter((l) => l.recipe === recipe && l.phase === 'done' && l.exact === true && typeof l.spent === 'number' && l.spent > 0).map((l) => l.spent as number).sort((a, b) => a - b);
    if (spent.length === 0) return null;
    return spent[Math.floor((spent.length - 1) / 2)] ?? null;
  }
}

export interface JobState {
  phase: Phase;
  last: LedgerLine;
  ids: Ids;
  files: string[];
  account: number;
  /** The balance read before the job's post, for the check after a post that may have been charged. */
  before: number | null;
}
