/**
 * The clothing route played on the kernel (tools/src/balance/clothing-route.ts; docs/design/CLOTHING_BALANCE.md 3):
 * the hide chain is added only to a copy of the world, the route reaches its three milestones in order, and the
 * minutes the balance page cites still hold, so a change to the chain, the hunt or the opening that moves them shows
 * here before the page goes stale.
 */
import { describe, expect, it } from 'vitest';
import { type RouteRun, formatRoute, playRoute, withHideChain } from '../src/balance/clothing-route';
import { loadWorld } from '../src/balance/world';

const MIN = 60_000;

describe('the clothing route', () => {
  const { bundle } = loadWorld();

  it('adds the hide chain to a copy only: the world it was given is unchanged', () => {
    const before = JSON.stringify(bundle);
    const chained = withHideChain(bundle, 'found');
    expect(JSON.stringify(bundle)).toBe(before);
    expect(chained.recipes['core/hare-leather-shoes']?.known).toBe('start');
    expect(chained.recipes['core/boiled-leather-cap']?.known).toBe('found');
    expect(bundle.recipes['core/hare-leather-shoes']).toBeUndefined();
  });

  it('known from the start: first piece, kit and set in order, in the minutes the page cites', async () => {
    const run: RouteRun = await playRoute(bundle, 1, 'start');
    expect(run.failed).toBeUndefined();
    const [piece, kit, set] = run.milestones.map((m) => m.at / MIN);
    expect(run.milestones.map((m) => m.what)).toHaveLength(3);
    // CLOTHING_BALANCE 3: 4.4, 9.0 and 21.3 minutes from the morning after the opening
    expect(piece).toBeGreaterThan(3.5);
    expect(piece).toBeLessThan(5.5);
    expect(kit).toBeGreaterThan(piece!);
    expect(kit).toBeLessThan(11);
    expect(set).toBeGreaterThan(kit!);
    expect(set).toBeLessThan(25);
    expect(formatRoute([run])).toContain('first set worn');
  }, 60_000);

  it('dug up: the set waits for its scraps and comes later than when known', async () => {
    const run = await playRoute(bundle, 16, 'found');
    expect(run.failed).toBeUndefined();
    expect(run.digs).toBeGreaterThan(0);
    const set = run.milestones[run.milestones.length - 1]!;
    expect(set.split.dig).toBeGreaterThan(0);
    expect(set.at / MIN).toBeGreaterThan(25);
  }, 120_000);
});
