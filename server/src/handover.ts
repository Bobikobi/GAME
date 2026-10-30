/**
 * From the demo to an account: the opening handover (NEXT 18 d; the owner's Q4, option A).
 *
 * The phone plays the opening under its own key, as the demo always has, and keeps every step it played.
 * At the sign-up it hands over that log, the seed and the state it ended on. The server plays the log
 * again from `newState(bundle, seed)` with the rules it applies to a request of its own (the kernel with
 * the travel check, and the movement-time credit of `/moves`), checks that the opening's game time and
 * its pay stayed under fixed caps, and keeps the result only when it lands on the phone's state token for
 * token. Then the state takes a seed only the server knows (kernel-review R4): from the account's first
 * request on, the luck is the server's.
 *
 * Anything else starts the account fresh (option B, the owner's fallback): a new state under the secret
 * seed, before the start, and nothing of the upload kept. A forged opening can therefore win no more than
 * the caps below, and an honest one that cannot be proven loses the opening, never the account.
 *
 * The account's books stay whole: a kept opening is the account's first `action_log` row, `{ kind:
 * 'opening', seed, log }`, with one `gold_ledger` row per grant it made, so `replayAccount` plays the same
 * opening under the phone's seed, switches to the account's seed, and lands on the stored state.
 */
import { OPENING_LOG_MAX, isSeed, newState, salePrice, serialize, step, type Action, type Bundle, type OpeningUpload, type Seed, type State, type Tile } from '@game/kernel';

import { createPlayerRecord, isAction, spendWalk, type PlayerRecord } from './api';
import { goldRowsOf, type LedgerRow } from './ledger';

/**
 * The most game time an opening may claim, in ms. The ladder's opening runs ten minutes at the screen
 * (GAME_RULES section 2); an hour is room for a slow first evening, and past it the time a log claims
 * would buy regrown nodes the opening never had.
 */
export const OPENING_TIME_MAX_MS = 60 * 60 * 1000;

/**
 * The most an opening may carry into an account, in milli-gold: the purse plus what the bag would sell
 * for. The opening's quests pay 80 gold (the bridge's purse 30, Pell 30, Maru's coin 20); the rest is
 * room for what ten minutes gather and sell. A test holds this above the content's opening pay.
 */
export const OPENING_PAY_MAX_MG = 150_000;

/** The two caps an opening is held to; a test lowers them to reach the refusal without playing an hour. */
export interface OpeningCaps {
  timeMs: number;
  payMg: number;
}

const CAPS: OpeningCaps = { timeMs: OPENING_TIME_MAX_MS, payMg: OPENING_PAY_MAX_MG };

/** A serialized state of the opening is a few kilobytes; this is far past any honest one. */
const STATE_TEXT_MAX = 256 * 1024;

/** The action an account's first log row holds when its opening was kept. */
export interface OpeningRow {
  kind: 'opening';
  /**
   * the phone's key, the one the opening's draws were made under; the account plays on under its own. A row
   * written before kernel 0.20 holds the phone's 32-bit seed here, which the replay widens as a save is.
   */
  seed: Seed | number;
  log: { a: Action; tick: number }[];
}

/** What the sign-up writes for the account's game: its first state row, and when the opening was kept, its books. */
export type Handover =
  | { kept: true; record: PlayerRecord; opening: OpeningRow; tick: number; gold: LedgerRow[] }
  | { kept: false; record: PlayerRecord; problem: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

/** The upload as the phone sent it, when its shape is the kernel's `OpeningUpload`; otherwise what is wrong with it. */
function readUpload(value: unknown): OpeningUpload | string {
  if (value === undefined) return 'no opening was sent';
  if (!isRecord(value) || !hasOnlyKeys(value, ['seed', 'log', 'state'])) return 'the opening holds a seed, a log and a state, nothing else';
  const { seed, log, state } = value;
  // a phone of kernel 0.19 or before sent a 32-bit number: its opening was played under the old draw and cannot land
  if (!isSeed(seed)) return 'the opening has no seed';
  if (typeof state !== 'string' || state.length > STATE_TEXT_MAX) return 'the opening has no state';
  if (!Array.isArray(log) || log.length === 0) return 'the opening has no log';
  if (log.length > OPENING_LOG_MAX) return `the opening log runs past ${OPENING_LOG_MAX} steps`;
  for (const [index, entry] of log.entries()) {
    if (!isRecord(entry) || !hasOnlyKeys(entry, ['a', 'tick']) || !isAction(entry.a) || !Number.isSafeInteger(entry.tick) || (entry.tick as number) < 0) {
      return `step ${index} is not an action with a tick`;
    }
  }
  return { seed, log: log as OpeningUpload['log'], state };
}

/** Gold plus what the bag would sell for: the whole pay an opening carries. */
function worthMg(bundle: Bundle, state: State): number {
  let worth = state.player.gold;
  for (const [item, qty] of Object.entries(state.player.bag)) worth += salePrice(bundle, state, item, qty) ?? 0;
  return worth;
}

/**
 * Play an opening log again under the server's rules, from the phone's seed: the first refusal is the
 * answer, and the whole log stands or falls with it.
 */
export function replayOpening(bundle: Bundle, upload: OpeningUpload, timeMaxMs = CAPS.timeMs): { state: State; gold: LedgerRow[] } | string {
  let state = newState(bundle, upload.seed);
  const gold: LedgerRow[] = [];
  let movementAt = 0;
  let creditMs = 0;
  // the unpaired step a diagonal pair may close, so a replay charges what the wire charges (the octile walk, G56)
  let leg: Tile | null = null;
  for (const [index, { a, tick }] of upload.log.entries()) {
    if (index === 0 && a.t !== 'start') return 'the opening does not begin with a start';
    if (index > 0 && a.t === 'start') return `step ${index} starts a second character`;
    if (tick < state.tick) return `step ${index} runs time backwards`;
    if (tick > timeMaxMs) return `step ${index} claims more than ${timeMaxMs} ms of game time`;
    if (a.t !== 'start') {
      // the walk a step claims costs what it costs on the wire: a phone that walked faster than the credit allows did not walk
      const walk = spendWalk(bundle, state, state.player.at, a.t === 'move' ? a.at : 'at' in a ? a.at : state.player.at, tick, movementAt, creditMs, leg);
      if (!walk) return `step ${index} walks further than the time allows`;
      ({ at: movementAt, creditMs, leg } = walk);
    }
    const result = step(bundle, state, a, tick, { validateTravel: true });
    if (!result.ok) return `step ${index} does not play: ${result.error}`;
    if (a.t === 'start') {
      // the credit starts with the character, as `createPlayerRecord` starts it for an account
      ({ movementAt, movementCreditMs: creditMs } = createPlayerRecord(bundle, result.state, 0));
    }
    gold.push(...goldRowsOf(bundle, [{ action: a, tick, events: result.events }]));
    state = result.state;
  }
  return { state, gold };
}

/**
 * The account's first game state, from what the sign-up was handed: the replayed opening under the
 * secret seed when every check holds, else a fresh state under it, with the reason the opening was not
 * kept. Never throws on what a phone sent.
 *
 * `accountName`, when the sign-up has one, is the name the account and its character share (finding 11 of
 * the 27.10 review). The opening's log is replayed byte for byte, so the state cannot be rewritten to carry
 * it: an opening that carved another name is not kept (the account starts fresh, as for any opening that
 * does not prove), and one that carved none yet is kept, its stone line left for the account's own name.
 */
export function takeOpening(bundle: Bundle, sent: unknown, secretSeed: Seed, now: number, caps: OpeningCaps = CAPS, accountName?: string): Handover {
  const fresh = (problem: string): Handover => ({ kept: false, record: createPlayerRecord(bundle, newState(bundle, secretSeed), now), problem });
  const upload = readUpload(sent);
  if (typeof upload === 'string') return fresh(upload);
  const played = replayOpening(bundle, upload, caps.timeMs);
  if (typeof played === 'string') return fresh(played);
  if (serialize(played.state) !== upload.state) return fresh('the replay does not land on the phone\'s state');
  const carved = played.state.player.name;
  if (accountName !== undefined && carved !== '' && carved !== accountName) {
    return fresh(`the opening carved the name ${JSON.stringify(carved)}, the account is ${JSON.stringify(accountName)}`);
  }
  const worth = worthMg(bundle, played.state);
  if (worth > caps.payMg) return fresh(`the opening carries ${worth} mg, past the cap of ${caps.payMg}`);
  // the phone's key is the phone's: from here on every draw is under the server's, which no reply carries
  const state: State = { ...played.state, seed: secretSeed };
  return {
    kept: true,
    record: createPlayerRecord(bundle, state, now),
    opening: { kind: 'opening', seed: upload.seed, log: upload.log },
    tick: state.tick,
    gold: played.gold,
  };
}
