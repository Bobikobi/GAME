/**
 * The opening handover (NEXT 18 d): what the phone played before the account existed is played again on
 * the server, and kept only when every step plays under the server's rules and lands on the phone's state.
 *
 * Each opening below is captured from `LocalPhone`, which plays the server tests' opening script the way
 * the demo plays it: the phone's own kernel under the phone's own seed, no travel check, every step kept.
 * A forged opening is that capture with one thing changed, so each refusal names the one change.
 */
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import type { IncomingMessage, Server } from 'node:http';

import { LEGACY_STARTERS, OPENING_LOG_MAX, newState, npcTile, publicState, serialize, step, type Action, type Bundle, type OpeningUpload, type State } from '@game/kernel';

import {
  OPENING_PAY_MAX_MG,
  checkAccount,
  createGameApi,
  listen,
  takeOpening,
  type Handover,
} from '../src';
import { openingQuests } from '../../tools/src/play.js';
import { loadBundle } from '../../tools/test/helpers/world.js';
import { LocalPhone, MemoryStore, PLAYER, STARTS, Wire, playOpening, type Start } from './support/phone.js';

/** The phone's seed: the demo draws under it, and the account never plays under it again. */
const PHONE_SEED = 77;
/** The seed the server gives the account: its own, and nobody else's. */
const SECRET_SEED = 424242;
const NOW = 5_000_000;

let bundle: Bundle;
let server: Server | undefined;

beforeAll(() => {
  bundle = loadBundle();
});

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server!.close((error) => (error ? reject(error) : resolve())));
  server = undefined;
});

async function captured(start: Start = STARTS[0]): Promise<{ phone: LocalPhone; upload: OpeningUpload }> {
  const phone = new LocalPhone(bundle, PHONE_SEED);
  await playOpening(phone, start);
  return { phone, upload: phone.upload() };
}

/** Play an edited log on the phone's own kernel, as a phone that played it would have ended. */
function phonePlays(log: OpeningUpload['log']): string {
  let state = newState(bundle, PHONE_SEED);
  for (const { a, tick } of log) {
    const result = step(bundle, state, a, tick);
    if (!result.ok) throw new Error(`The phone refused ${JSON.stringify(a)}: ${result.error}`);
    state = result.state;
  }
  return serialize(state);
}

function expectFresh(handover: Handover, problem: RegExp): void {
  expect(handover.kept).toBe(false);
  if (handover.kept) return;
  expect(handover.problem).toMatch(problem);
  // nothing of the upload is kept: the account begins before the start, under its own seed
  expect(serialize(handover.record.state)).toBe(serialize(newState(bundle, SECRET_SEED)));
}

function kept(handover: Handover): Extract<Handover, { kept: true }> {
  if (!handover.kept) throw new Error(`The opening was not kept: ${handover.problem}`);
  return handover;
}

/** The quests the opening runs through: each start's own task, and the chain up to the arch at night. */
function openingGoldMg(): number {
  const ids = openingQuests(bundle);
  const seen = new Set<string>();
  const queue = ['core/the-night-arch'];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...(bundle.quests[id]?.requires ?? []));
  }
  return [...new Set([...ids, ...seen])].reduce((total, id) => total + (bundle.quests[id]?.reward?.gold_mg ?? 0), 0);
}

describe('the opening handover (NEXT 18 d)', () => {
  test.each(STARTS.map((start) => [start.starter, start] as const))(
    '%s: a captured opening replays to the same state, and the account plays on under its own seed',
    async (_starter, start) => {
      const { phone, upload } = await captured(start);
      const handover = kept(takeOpening(bundle, upload, SECRET_SEED, NOW));
      expect(serialize(handover.record.state)).toBe(serialize({ ...phone.state, seed: SECRET_SEED }));
      expect(handover.record.state.player.race).toBe(LEGACY_STARTERS[start.starter]!.race);
      expect(handover.opening).toEqual({ kind: 'opening', seed: PHONE_SEED, log: upload.log });
      expect(handover.tick).toBe(phone.state.tick);
      // the bridge's purse, the berry and the log: the opening's grants, each with the step that paid it
      expect(handover.gold.reduce((total, row) => total + row.deltaMg, 0)).toBe(phone.state.player.gold);
      expect(handover.gold).toHaveLength(3);
    },
  );

  test('a log with one illegal action is refused whole', async () => {
    const { upload } = await captured();
    const at = upload.log.findIndex((entry) => entry.a.t === 'restore');
    // the bridge restored a second time, right after the first: the kernel refuses it, and so does the server
    const log = [...upload.log.slice(0, at + 1), upload.log[at]!, ...upload.log.slice(at + 1)];
    expectFresh(takeOpening(bundle, { ...upload, log }, SECRET_SEED, NOW), new RegExp(`^step ${at + 1} does not play`));
  });

  test('a step the phone took and the server cannot, a jump across the map, is refused whole', async () => {
    // the explorer walks fifteen tiles to the glint by the bridge before it digs
    const { upload } = await captured(STARTS[2]);
    // that walk taken out, and the dig made from where the walk began: the phone checks the travel of a walked
    // tile only, so it digs at once from afar; the server checks the tile of every step
    const task = upload.log.findIndex((entry, index) => index > 0 && entry.a.t !== 'move');
    const walked = 1;
    expect(task - walked).toBeGreaterThan(4);
    const log = [upload.log[0]!, { a: upload.log[task]!.a, tick: upload.log[walked]!.tick }, ...upload.log.slice(task + 1)];
    const state = phonePlays(log);
    expectFresh(takeOpening(bundle, { ...upload, log, state }, SECRET_SEED, NOW), /^step 1 (walks further|does not play)/);
  });

  test('a log with a tampered coin count falls back to a fresh start', async () => {
    const { upload } = await captured();
    const state = JSON.parse(upload.state) as State;
    const tampered = serialize({ ...state, player: { ...state.player, gold: state.player.gold + 100_000 } });
    expectFresh(takeOpening(bundle, { ...upload, state: tampered }, SECRET_SEED, NOW), /does not land on the phone's state/);
  });

  test('a walk faster than the movement time allows is refused, though the phone accepted it', async () => {
    const { upload } = await captured();
    // every walked tile claimed a few ms after the one before: the kernel takes it, the movement credit does not
    let shift = 0;
    const log = upload.log.map((entry, index) => {
      const previous = upload.log[index - 1];
      if (entry.a.t === 'move' && previous?.a.t === 'move') shift += bundle.params.walk_step_ms - 5;
      return { a: entry.a, tick: entry.tick - shift };
    });
    const state = phonePlays(log);
    expectFresh(takeOpening(bundle, { ...upload, log, state }, SECRET_SEED, NOW), /walks further than the time allows/);
  });

  test('a second start, time run backwards, or a log that does not open with a start is refused', async () => {
    const { upload } = await captured();
    const start = upload.log[0]!;
    expectFresh(takeOpening(bundle, { ...upload, log: [start, { a: start.a, tick: 1 }] }, SECRET_SEED, NOW), /starts a second character/);
    const backwards = upload.log.map((entry, index) => (index === 5 ? { ...entry, tick: upload.log[3]!.tick - 1 } : entry));
    expectFresh(takeOpening(bundle, { ...upload, log: backwards }, SECRET_SEED, NOW), /runs time backwards|does not play/);
    expectFresh(takeOpening(bundle, { ...upload, log: upload.log.slice(1) }, SECRET_SEED, NOW), /does not begin with a start/);
  });

  test('an opening over either cap starts fresh: the game time it claims, and the pay it carries', async () => {
    const { phone, upload } = await captured();
    const lastTick = upload.log.at(-1)!.tick;
    kept(takeOpening(bundle, upload, SECRET_SEED, NOW, { timeMs: lastTick, payMg: OPENING_PAY_MAX_MG }));
    expectFresh(takeOpening(bundle, upload, SECRET_SEED, NOW, { timeMs: lastTick - 1, payMg: OPENING_PAY_MAX_MG }), /more than .* ms of game time/);
    // the pay is the purse and what the bag would sell for: a cap at the purse alone refuses a bag with anything in it
    const gold = phone.state.player.gold;
    expect(Object.keys(phone.state.player.bag).length).toBeGreaterThan(0);
    expectFresh(takeOpening(bundle, upload, SECRET_SEED, NOW, { timeMs: lastTick, payMg: gold }), /past the cap of/);
  });

  test("the caps leave an honest opening room: the hour and the pay stand above the content's own opening", async () => {
    // the quests' gold up to the arch at night, which every honest opening is paid in full
    expect(openingGoldMg()).toBeGreaterThan(0);
    expect(OPENING_PAY_MAX_MG).toBeGreaterThanOrEqual(openingGoldMg() + 50_000);
    for (const start of STARTS) {
      const { upload } = await captured(start);
      expect(upload.log.at(-1)!.tick).toBeLessThan(60 * 60 * 1000);
    }
  });

  test(`a log past ${OPENING_LOG_MAX} steps, an unknown field, or a malformed step is refused before anything plays`, async () => {
    const { upload } = await captured();
    const long = [...upload.log, ...Array.from({ length: OPENING_LOG_MAX }, () => upload.log.at(-1)!)];
    expectFresh(takeOpening(bundle, { ...upload, log: long }, SECRET_SEED, NOW), /runs past/);
    expectFresh(takeOpening(bundle, { ...upload, gold: 1 }, SECRET_SEED, NOW), /nothing else/);
    expectFresh(takeOpening(bundle, { ...upload, log: [{ a: { t: 'start' }, tick: -1 }] }, SECRET_SEED, NOW), /^step 0 is not/);
    expectFresh(takeOpening(bundle, undefined, SECRET_SEED, NOW), /no opening was sent/);
    expectFresh(takeOpening(bundle, 'opening', SECRET_SEED, NOW), /nothing else/);
  });

  test('a kept account proves itself: its log, opening first, replays to the stored state after it plays on over the wire', async () => {
    const { upload } = await captured(STARTS[2]);
    const handover = kept(takeOpening(bundle, upload, SECRET_SEED, NOW));

    const clock = { now: NOW };
    const store = new MemoryStore(bundle, newState(bundle, SECRET_SEED), NOW);
    store.record = structuredClone(handover.record);
    server = createGameApi({
      bundle,
      store,
      now: () => clock.now,
      resolvePlayerId: async (request: IncomingMessage) => (request.headers.authorization === 'Bearer test' ? PLAYER : undefined),
    });
    const address = await listen(server, 0);
    const wire = new Wire(bundle, `http://127.0.0.1:${address.port}`, publicState(store.record.state), clock);

    // the walk back to the stall and one more berry: a movement batch and a payment, under the account's seed
    const trader = npcTile(bundle, 'core/trader')!;
    await wire.walkNear({ x: trader[0], y: trader[1], w: 1, h: 1 });
    const buy: Action = { t: 'buy', npc: 'core/trader', item: 'core/berry', qty: 1, at: wire.state.player.at };
    await wire.act(buy);
    expect(store.actionLog.length).toBeGreaterThanOrEqual(2);

    const log = [{ seq: 1, action: handover.opening, tick: handover.tick }, ...store.actionLog];
    const books = { seed: SECRET_SEED, log, state: store.record.state, ledger: [...handover.gold, ...store.goldLedger] };
    expect(checkAccount(bundle, books)).toEqual([]);
    // the same books under the phone's seed do not prove: the account's luck is the server's from the sign-up on
    expect(checkAccount(bundle, { ...books, seed: PHONE_SEED })).not.toEqual([]);
  });
});
