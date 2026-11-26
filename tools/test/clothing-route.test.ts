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

  it('overlays the route recipes on a copy only: the world it was given is unchanged', () => {
    const before = JSON.stringify(bundle);
    const chained = withHideChain(bundle, 'found');
    expect(JSON.stringify(bundle)).toBe(before);
    expect(chained.recipes['core/hare-leather-shoes']?.known).toBe('start');
    // the content's chain waits behind the fight's gate; the copy opens it for the route and the content keeps it
    expect(chained.recipes['core/hare-leather-shoes']?.gate).toBeUndefined();
    expect(chained.recipes['core/tan-roe-leather']?.gate).toBeUndefined();
    expect(chained.recipes['core/scraped-hare-hide']).toBeUndefined();
    // the route keeps no copy of the tier-1 chain: the only recipes it adds are the three proposed tier-2 rows, with the solver's values
    const added = Object.keys(chained.recipes).filter((id) => !(id in bundle.recipes)).sort();
    expect(added).toEqual(['core/boiled-leather', 'core/boiled-leather-boots', 'core/boiled-leather-cap']);
    for (const id of added) expect(chained.values[id]).toBeGreaterThan(0);
    expect(chained.recipes['core/boiled-leather-cap']?.known).toBe('found');
    expect(bundle.recipes['core/hare-leather-shoes']).toMatchObject({ known: 'start', gate: 'combat' });
  });

  it('known from the start: first piece, kit and set in order, in the minutes the page cites', async () => {
    const run: RouteRun = await playRoute(bundle, 1, 'start');
    expect(run.failed).toBeUndefined();
    const [piece, kit, set] = run.milestones.map((m) => m.at / MIN);
    expect(run.milestones.map((m) => m.what)).toHaveLength(3);
    // CLOTHING_BALANCE 3, pinned to the tenth of a minute: 4.4, 8.7 and 24.3 minutes passed from the morning after the opening
    // (the set passes a night: the route sets out only by day, the bank wolf walks the road after dark)
    const tenth = (ms: number) => Math.round(ms / MIN * 10) / 10;
    expect([piece, kit, set].map((m) => tenth(m! * MIN))).toEqual([4.4, 8.7, 24.3]);
    // and the same three as active play: passed minus the waits on nodes and the night, 3.6, 7.4 and 13.1
    const active = run.milestones.map((m) => tenth(m.at - m.split.wait - m.split.night));
    expect(active).toEqual([3.6, 7.4, 13.1]);
    expect(formatRoute([run])).toContain('first set worn');
  }, 60_000);

  it('dug up: the set waits for its scraps and comes later than when known', async () => {
    const run = await playRoute(bundle, 16, 'found');
    expect(run.failed).toBeUndefined();
    expect(run.digs).toBeGreaterThan(0);
    const set = run.milestones[run.milestones.length - 1]!;
    expect(set.split.dig).toBeGreaterThan(0);
    // seed 16 digs 10 times: 28.5 minutes passed (39.8 before the dig rule landed: a scrap of a recipe already known is
    // skipped and its chance goes to the other rows, so the set comes sooner). The page's median over seeds 1 to 20 is
    // not pinned here: twenty found runs take minutes of wall time; `clothing-route-cli.ts --found --seeds 1,...,20` reproduces it.
    expect(Math.round(set.at / MIN * 10) / 10).toBe(28.5);
  }, 120_000);
});
