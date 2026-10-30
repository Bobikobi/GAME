/**
 * The starting gold is a bound balance beside the purse (DECISIONS.md, 2026-10-10: starting gold and
 * the kit are bound): the start fills it, a shop purchase spends it first and the purse after, nothing
 * else moves it, and the ledger counts it as minted at the start and burned when spent.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Action, type Bundle, type State, type StepResult, migrateState, newState, npcTile, serialize, step } from '@game/kernel';

import { bfsNear, loadBundle } from '../../tools/test/helpers/world.js';

const START = 40_000;
const BASKET = 30_000;
let b: Bundle;
let trader: string;

beforeAll(() => {
  const base = loadBundle();
  b = { ...base, params: { ...base.params, starting_gold_mg: START } };
  trader = Object.keys(b.npcs)
    .sort()
    .find((id) => {
      const shop = b.npcs[id]!.shop;
      return shop !== undefined && b.shops[shop]?.buys && b.shops[shop]!.sells.some((o) => o.item === 'core/basket' && o.price_mg === BASKET);
    })!;
});

function started(): State {
  const r = step(b, newState(b, 1), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
  if (!r.ok) throw new Error(r.error);
  // the bridge is mended and its quest already paid, so the road to the trader is open and no purse gold arrives
  r.state.player.restored = ['core/old-bridge'];
  r.state.player.quests['core/fix-the-bridge'] = 'done';
  r.state.player.bag = {};
  return r.state;
}

function ok(s: State, a: Action): Extract<StepResult, { ok: true }> {
  const r = step(b, s, a, Math.max(s.tick, s.player.busyUntil));
  if (!r.ok) throw new Error(r.error);
  return r;
}

function atTrader(s: State): [number, number] {
  const tile = npcTile(b, trader)!;
  return bfsNear(b, s.player, s.player.at, { x: tile[0], y: tile[1], w: 1, h: 1 })!.at(-1)! as [number, number];
}

const buy = (s: State, qty = 1): Extract<StepResult, { ok: true }> =>
  ok(s, { t: 'buy', npc: trader, item: 'core/basket', qty, at: atTrader(s) });

const held = (s: State) => s.player.gold + s.player.boundGold;
const books = (s: State) => s.ledger.minted - s.ledger.burned;

describe('the bound starting gold', () => {
  test('the start puts the gold in the bound balance, not the purse, and mints it', () => {
    const s = started();
    expect(s.player.boundGold).toBe(START);
    expect(s.player.gold).toBe(0);
    expect(books(s)).toBe(START);
  });

  test('a purchase spends the bound balance first, and the ledger burns what was spent', () => {
    const r = buy(started());
    expect(r.state.player.boundGold).toBe(START - BASKET);
    expect(r.state.player.gold).toBe(0);
    expect(r.events).toContainEqual({ e: 'bound', delta: -BASKET });
    expect(r.events.some((e) => e.e === 'gold')).toBe(false);
    expect(books(r.state)).toBe(held(r.state));
  });

  test('a purchase larger than the bound balance takes the rest from the purse', () => {
    const s = started();
    s.player.gold = 25_000;
    s.ledger.minted += 25_000;
    const r = buy(s, 2); // 60000: 40000 bound, 20000 purse
    expect(r.state.player.boundGold).toBe(0);
    expect(r.state.player.gold).toBe(5_000);
    expect(r.events).toContainEqual({ e: 'bound', delta: -START });
    expect(r.events).toContainEqual({ e: 'gold', delta: -(2 * BASKET - START) });
    expect(books(r.state)).toBe(held(r.state));
  });

  test('a purchase the two together cannot pay is refused and changes nothing', () => {
    const s = started();
    const before = serialize(s);
    const r = step(b, s, { t: 'buy', npc: trader, item: 'core/basket', qty: 2, at: atTrader(s) }, 0);
    expect(r.ok).toBe(false);
    expect(serialize(s)).toBe(before);
  });

  test('a sale pays the purse and leaves the bound balance alone', () => {
    const fresh = started();
    fresh.player.bag['core/log'] = 1;
    const sold = ok(fresh, { t: 'sell', npc: trader, item: 'core/log', qty: 1, at: atTrader(fresh) });
    expect(sold.state.player.boundGold).toBe(START);
    expect(sold.state.player.gold).toBeGreaterThan(0);
    expect(books(sold.state)).toBe(held(sold.state));
  });

  test('the shop is the only spender: no other action moves the bound balance, and nothing pays it out', () => {
    // the kernel has no trainer, settlement, player-to-player payment or listing action yet; this keeps
    // the day one is added from spending or lending the bound gold unnoticed
    const s = started();
    const moved = ok(s, { t: 'move', at: [s.player.at[0] + 1, s.player.at[1]] });
    expect(moved.state.player.boundGold).toBe(START);
    expect(moved.events.some((e) => e.e === 'bound')).toBe(false);
  });

  test('a save from before the field reads as no bound gold', () => {
    const s = started();
    const old = structuredClone(s) as unknown as { player: { boundGold?: number } };
    delete old.player.boundGold;
    expect(migrateState(old as unknown as State).player.boundGold).toBe(0);
    expect(migrateState(s).player.boundGold).toBe(START);
  });
});
