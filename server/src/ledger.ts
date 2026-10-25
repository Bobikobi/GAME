/**
 * The gold books and the replay (NEXT 18 f, rule R6: one ledger, rule R4: the draws are the seed's).
 *
 * Two jobs, one file, because they must agree: what the server books when it accepts a request
 * (`bookedGoldMg`, the only definition the API uses to write `gold_ledger`), and what the books must
 * hold when an account's whole `action_log` is played again from its start state (`checkAccount`).
 *
 * The replay is the account's proof. It starts from `newState(bundle, seed)`, the one state a player
 * begins with, plays every logged action at its logged tick with the same rules the server applies,
 * and must land on the stored state token for token (`serialize`). The draws need no separate check:
 * a draw is `draw(seed, entity, counter)` and the state carries every counter, so a replay under the
 * account's own secret seed draws the same luck and a replay under another seed cannot.
 *
 * Anything the replay cannot reproduce is reported, never repaired: a log the server wrote is the
 * account, and a book that disagrees with it is a finding, not a rounding.
 *
 * An account whose opening was handed over from the phone (NEXT 18 d) starts its log with that opening:
 * one row `{ kind: 'opening', seed, log }`. The replay plays it from `newState(bundle, seed)` under the
 * phone's seed, then gives the state the account's own seed, as the sign-up did, and goes on from there.
 */
import { newState, serialize, step, type Action, type Bundle, type GameEvent, type State } from '@game/kernel';

/** One row of `action_log`: the action as the client sent it (a `moves` batch included) and its tick. */
export interface LoggedAction {
  /** the state version the action produced, so a log row and a state row line up */
  seq: number;
  action: unknown;
  tick: number;
}

/** One row of `gold_ledger`: milli-gold, and the action and tick it was booked with. */
export interface LedgerRow {
  deltaMg: number;
  /** 'bound' for the starting gold's own book (a bound balance beside the purse); absent for the purse */
  fund?: 'bound';
  action: unknown;
  tick: number;
}

/** The books of one account, as the database holds them. */
export interface AccountBooks {
  /** the state's secret seed: the server's alone, and the key the replay's luck is drawn from */
  seed: number;
  log: readonly LoggedAction[];
  state: State;
  ledger: readonly LedgerRow[];
}

export interface Replay {
  state: State;
  /** one row per grant and payment the log makes, in the order they were made */
  ledger: LedgerRow[];
}

export type ReplayResult = { ok: true; replay: Replay } | { ok: false; problem: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Whether a logged action opens a character: the one action the kernel pays for without an event. */
function isStart(action: unknown): action is Action & { t: 'start' } {
  return isRecord(action) && action.t === 'start';
}

/** One step of a request, as the books see it: the action that played, its tick, and what it reported. */
export interface BookedStep {
  /** the action as it was played: a whole request, or one report inside a movement batch */
  action: unknown;
  tick: number;
  events: readonly GameEvent[];
}

/**
 * The milli-gold of each grant and payment one step makes, in order; a zero is never booked (the table
 * refuses it, and a zero moved nothing).
 *
 * A step reports its gold as `gold` events, and the server books one row per event, so a sale pays one
 * row and a purchase one row even when they stand in the same request. The opening is the one grant the
 * kernel makes without an event: `start` sets the purse from `params.starting_gold_mg` and adds it to
 * the state's own ledger, so the server books it here from the same number, or the purse would stand in
 * the state with nothing behind it in the book.
 */
export function bookedGoldMg(bundle: Bundle, action: unknown, events: readonly GameEvent[]): BookedMg[] {
  const rows: BookedMg[] = events.flatMap((event): BookedMg[] => {
    if (event.e === 'gold' && event.delta !== 0) return [{ deltaMg: event.delta }];
    if (event.e === 'bound' && event.delta !== 0) return [{ deltaMg: event.delta, fund: 'bound' }];
    return [];
  });
  if (isStart(action) && bundle.params.starting_gold_mg !== 0) rows.unshift({ deltaMg: bundle.params.starting_gold_mg, fund: 'bound' });
  return rows;
}

/** One booked movement before it is tied to an action: its milli-gold and the fund it moves. */
export interface BookedMg {
  deltaMg: number;
  fund?: 'bound';
}

/**
 * The gold rows a request's steps make: one row per grant or payment, carrying the action that paid it
 * and that action's own tick. The server books its request through here and a replay books its steps
 * through here, so the two can never key the same grant differently: a payment inside a movement batch
 * is the one report that made it, at the report's tick, on both sides.
 */
export function goldRowsOf(bundle: Bundle, steps: readonly BookedStep[]): LedgerRow[] {
  return steps.flatMap((one) =>
    bookedGoldMg(bundle, one.action, one.events).map((row) => ({ ...row, action: one.action, tick: one.tick })),
  );
}

/** The gold a book holds, in milli-gold: the state's purse is this number, exactly. The bound balance is its own book (`boundSumMg`). */
export function ledgerSumMg(ledger: readonly LedgerRow[]): number {
  return ledger.reduce((total, row) => total + (row.fund === 'bound' ? 0 : row.deltaMg), 0);
}

/** The bound starting gold a book holds, in milli-gold: the state's bound balance is this number, exactly. */
export function boundSumMg(ledger: readonly LedgerRow[]): number {
  return ledger.reduce((total, row) => total + (row.fund === 'bound' ? row.deltaMg : 0), 0);
}

/**
 * The steps a logged row stands for: one action under its own tick, or a `moves` batch under its last
 * report's tick and every report inside it at the report's own tick (NEXT 18 a: the batch is one row,
 * one request and many steps).
 */
function stepsOf(action: unknown, tick: number): { action: Action; tick: number }[] | string {
  if (!isRecord(action) || action.kind !== 'moves') {
    if (!isRecord(action) || typeof action.t !== 'string') return 'the log row holds no action';
    return [{ action: action as unknown as Action, tick }];
  }
  if (!Array.isArray(action.moves) || action.moves.length === 0) return 'the movement batch holds no report';
  const steps: { action: Action; tick: number }[] = [];
  for (const report of action.moves) {
    if (!isRecord(report) || !Array.isArray(report.at) || !Number.isSafeInteger(report.tick)) {
      return 'a movement report holds no tile or tick';
    }
    steps.push({ action: { t: 'move', at: report.at as [number, number] }, tick: report.tick as number });
  }
  return steps;
}

/** The opening a log row hands over (NEXT 18 d): the phone's seed and its steps, or undefined for any other row. */
function openingOf(action: unknown): { seed: number; steps: { action: Action; tick: number }[] } | string | undefined {
  if (!isRecord(action) || action.kind !== 'opening') return undefined;
  if (!Number.isSafeInteger(action.seed) || !Array.isArray(action.log)) return 'the opening row holds no seed or log';
  const steps: { action: Action; tick: number }[] = [];
  for (const entry of action.log) {
    if (!isRecord(entry) || !isRecord(entry.a) || typeof entry.a.t !== 'string' || !Number.isSafeInteger(entry.tick)) {
      return 'an opening step holds no action or tick';
    }
    steps.push({ action: entry.a as unknown as Action, tick: entry.tick as number });
  }
  return { seed: action.seed as number, steps };
}

/**
 * Play an account's whole log from its start state, under its own seed, and return the state and the
 * ledger the log implies. The first refusal is the answer: an action the server accepted must play
 * again, so a log that stops replaying at row N is a finding about either the log or the rules.
 */
export function replayAccount(bundle: Bundle, seed: number, log: readonly LoggedAction[]): ReplayResult {
  let state = newState(bundle, seed);
  const ledger: LedgerRow[] = [];
  for (const [index, row] of log.entries()) {
    const opening = openingOf(row.action);
    if (typeof opening === 'string') return { ok: false, problem: `seq ${row.seq}: ${opening}` };
    if (opening) {
      if (index !== 0) return { ok: false, problem: `seq ${row.seq}: an opening is handed over only as the first row` };
      // the opening played under the phone's seed; the account plays on under its own, as the sign-up set it
      state = newState(bundle, opening.seed);
      for (const one of opening.steps) {
        const result = step(bundle, state, one.action, one.tick, { validateTravel: true });
        if (!result.ok) return { ok: false, problem: `seq ${row.seq} does not play again: ${result.error}` };
        ledger.push(...goldRowsOf(bundle, [{ action: one.action, tick: one.tick, events: result.events }]));
        state = result.state;
      }
      state = { ...state, seed: seed >>> 0 };
      continue;
    }
    const steps = stepsOf(row.action, row.tick);
    if (typeof steps === 'string') return { ok: false, problem: `seq ${row.seq}: ${steps}` };
    for (const one of steps) {
      const result = step(bundle, state, one.action, one.tick, { validateTravel: true });
      if (!result.ok) return { ok: false, problem: `seq ${row.seq} does not play again: ${result.error}` };
      // the same rule the server books with, on the step rather than on the request (NEXT 18 f)
      ledger.push(...goldRowsOf(bundle, [{ action: one.action, tick: one.tick, events: result.events }]));
      state = result.state;
    }
  }
  return { ok: true, replay: { state, ledger } };
}

/** Where two serialized states first part ways, in a form a reader can act on. */
function firstDifference(one: string, other: string): string {
  let at = 0;
  while (at < one.length && at < other.length && one[at] === other[at]) at += 1;
  const from = Math.max(0, at - 40);
  const slice = (text: string) => text.slice(from, at + 60);
  return `byte ${at}: replay ${JSON.stringify(slice(one))} against stored ${JSON.stringify(slice(other))}`;
}

/** Multiset of the rows: the same grant twice is two rows, and a row nobody made is a row too many. */
function ledgerKey(row: LedgerRow): string {
  return `${JSON.stringify(row.action)}|${row.tick}|${row.deltaMg}|${row.fund ?? 'purse'}`;
}

function ledgerProblems(expected: readonly LedgerRow[], actual: readonly LedgerRow[]): string[] {
  const counts = new Map<string, number>();
  for (const row of expected) counts.set(ledgerKey(row), (counts.get(ledgerKey(row)) ?? 0) + 1);
  const extra: LedgerRow[] = [];
  for (const row of actual) {
    const key = ledgerKey(row);
    const left = counts.get(key) ?? 0;
    if (left === 0) extra.push(row);
    else counts.set(key, left - 1);
  }
  const problems: string[] = [];
  for (const row of extra) {
    problems.push(`the ledger holds a grant with no action behind it: ${row.deltaMg} mg at tick ${row.tick} by ${JSON.stringify(row.action)}`);
  }
  for (const [key, left] of counts) {
    if (left > 0) problems.push(`the log pays a grant the ledger does not hold (${left} row(s)): ${key}`);
  }
  return problems;
}

/**
 * The account's proof, as a list of problems; an empty list is a verified account. It replays the log,
 * and then asks three questions of the books: is the replayed state the stored state, does the ledger
 * hold exactly the grants the log makes (no forged row, no missing one), and is its sum the state's
 * gold, down to the milli-gold.
 */
export function checkAccount(bundle: Bundle, books: AccountBooks): string[] {
  const played = replayAccount(bundle, books.seed, books.log);
  if (!played.ok) return [played.problem];
  const { state, ledger } = played.replay;
  const problems: string[] = [];

  const replayText = serialize(state);
  const storedText = serialize(books.state);
  if (replayText !== storedText) {
    problems.push(`the replay does not land on the stored state (${firstDifference(replayText, storedText)})`);
  }

  problems.push(...ledgerProblems(ledger, books.ledger));

  const sum = ledgerSumMg(books.ledger);
  if (sum !== books.state.player.gold) {
    problems.push(`the ledger sums to ${sum} mg and the state's purse holds ${books.state.player.gold} mg`);
  }
  const bound = boundSumMg(books.ledger);
  if (bound !== books.state.player.boundGold) {
    problems.push(`the bound book sums to ${bound} mg and the state's bound balance holds ${books.state.player.boundGold} mg`);
  }
  const minted = books.state.ledger.minted - books.state.ledger.burned;
  const held = books.state.player.gold + books.state.player.boundGold;
  if (minted !== held) {
    problems.push(`the state's own book mints ${minted} mg and its purse and bound balance hold ${held} mg`);
  }
  return problems;
}
