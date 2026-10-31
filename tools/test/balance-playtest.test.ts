/**
 * The balance playtest (NEXT 19 b): the simulated player's session on the kernel, measured place
 * by place against the difficulty reckoning. The numbers are the designer's to read; the tests
 * hold that the session plays through from every start, that every place reached has its
 * expectation for the pocket the start woke in, that the same seed gives the same run, and that
 * the table says what the runs say.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { type Bundle, near } from '@game/kernel';
import { Player } from '../../server/test/sim/player.js';
import { STARTS } from '../../server/test/sim/session.js';
import { levelOf } from '../src/balance/curve';
import { KernelHands, type PlaytestRun, alwaysUnder, formatLadders, formatPlaytest, playtest, playtestRun } from '../src/balance/playtest';
import { type PlaceRow, reckon, wakes } from '../src/balance/reckon';
import type { Rules } from '../src/balance/rules';
import { loadWorld } from '../src/balance/world';
import { bfsNear } from './helpers/world.js';

let bundle: Bundle;
let rules: Rules;
let rows: PlaceRow[];
let runs: PlaytestRun[];

beforeAll(async () => {
  ({ bundle, rules } = loadWorld());
  rows = reckon(bundle, rules);
  runs = await playtest(bundle, rules, rows);
});

describe('the hands on the kernel', () => {
  it('step each movement report at the tick it was reported, not at the flush, and refuse a jump the travel rule forbids', async () => {
    const hands = new KernelHands(bundle, 1);
    const player = new Player(bundle, hands, { now: 0 });
    await player.act({ t: 'start', starter: STARTS[0]!.starter, name: 'Sim' });
    expect(hands.state.player.pocket).not.toBe('');

    // the walk as Player.walk makes it: a step of the clock, then the report of the next tile
    const bridge = player.slot('core/old-bridge');
    const path = bfsNear(bundle, hands.state.player, player.at, bridge);
    expect(path).toBeDefined();
    for (const at of path!.slice(1)) {
      player.time(bundle.params.walk_step_ms);
      hands.report(at);
    }
    const reported = hands.tick;
    expect(reported).toBeGreaterThan(0);
    // the phone's clock runs on before the batch goes out
    hands.advance(1000);
    await hands.flushMoves();
    expect(near(hands.state.player.at, bridge)).toBe(true);
    expect(hands.state.tick).toBe(reported);
    expect(hands.state.player.movedAt).toBe(reported);
    expect(hands.tick).toBe(reported + 1000);

    const [x, y] = hands.state.player.at;
    hands.report([x + 40, y + 40]);
    await expect(hands.flushMoves()).rejects.toThrow(/refused/);
  });
});

describe('the session, from every start', () => {
  it('plays through for every start, to the first sale, from the pocket the kernel woke it in', () => {
    expect(runs.map((run) => run.starter)).toEqual(STARTS.map((start) => start.starter));
    const pockets = wakes(bundle).map((w) => w.pocket);
    for (const run of runs) {
      expect(run.failed, run.starter).toBeUndefined();
      expect(pockets, run.starter).toContain(run.pocket);
      expect(run.paidMg, run.starter).toBeGreaterThan(0);
      expect(run.gameMs).toBeGreaterThan(0);
      expect(run.actions).toBeGreaterThan(0);
      expect(run.moves).toBeGreaterThan(0);
    }
  });

  it('reaches the places the content scripts, in time order, each with the reckoning\'s expectation for its pocket', () => {
    for (const run of runs) {
      const slots = run.visits.map((v) => v.slot);
      for (const slot of ['core/old-bridge', 'core/town-square', 'core/arch-mouth', 'core/tangle-heart']) {
        expect(slots, run.starter).toContain(slot);
      }
      expect(new Set(slots).size).toBe(slots.length);
      for (let i = 1; i < run.visits.length; i++) expect(run.visits[i]!.tick).toBeGreaterThanOrEqual(run.visits[i - 1]!.tick);
      for (const v of run.visits) {
        const row = rows.find((r) => r.slot === v.slot);
        expect(row, v.slot).toBeDefined();
        expect(v.expected, `${v.slot} from ${run.pocket}`).not.toBeNull();
        expect(v.expected!.pocket).toBe(run.pocket);
        expect(v.gap).toBe(v.levelCurve - v.expected!.level);
        expect(v.levelCurve).toBe(levelOf(rules, v.xpMs));
        expect(v.xpAllMs).toBeGreaterThanOrEqual(v.xpMs);
      }
    }
  });

  it('gains experience along the road: the last place is reached with more than the first', () => {
    for (const run of runs) {
      const first = run.visits[0]!;
      const last = run.visits[run.visits.length - 1]!;
      expect(last.xpAllMs, run.starter).toBeGreaterThan(first.xpAllMs);
      expect(Object.values(run.xp).reduce((a, c) => a + c, 0)).toBeGreaterThanOrEqual(last.xpAllMs);
    }
  });

  it('gives the same run for the same seed', async () => {
    const start = STARTS[1]!;
    const again = await playtestRun(bundle, rules, rows, start, 1);
    expect(again).toEqual(runs.find((run) => run.starter === start.starter));
  });

  it('plays every start from the seed given; the pocket is the start\'s, not the seed\'s', async () => {
    const seven = await playtest(bundle, rules, rows, { seed: 7 });
    expect(seven.map((run) => run.starter)).toEqual(runs.map((run) => run.starter));
    expect(seven.map((run) => run.pocket)).toEqual(runs.map((run) => run.pocket));
    for (const run of seven) {
      expect(run.seed).toBe(7);
      expect(run.failed, run.starter).toBeUndefined();
    }
  });
});

describe('the table', () => {
  it('names both ladders and has one line per place reached, with the gap as the runs say', () => {
    const text = formatPlaytest(runs, bundle, rules);
    expect(text).toContain(formatLadders(bundle, rules));
    expect(formatLadders(bundle, rules)).toMatch(/^ladders \(s of active work to L2 L3 L4 L5\): curve \d+ \d+ \d+ \d+ \| /);
    const lines = text.split('\n');
    for (const run of runs) {
      expect(text).toContain(`== ${run.starter.replace(/^core\//, '')} from ${run.pocket.replace(/^core\//, '')} (seed ${run.seed})`);
      for (const v of run.visits) {
        const own = lines.filter((l) => l.startsWith(v.slot.replace(/^core\//, '').padEnd(18) + ' '));
        expect(own.length, v.slot).toBeGreaterThanOrEqual(1);
        const gap = v.gap! > 0 ? `+${v.gap}` : String(v.gap);
        expect(own.some((l) => l.includes(`| L${v.expected!.level}`) && l.trimEnd().endsWith(gap)), v.slot).toBe(true);
      }
    }
    expect(text).toMatch(/under the reckoning in every run \(the mildest gap\): |no place is under the reckoning in every run/);
  });

  it('counts a place as under in every run only when every run reached it under', () => {
    const under = alwaysUnder(runs);
    for (const { slot, gap } of under) {
      expect(gap).toBeLessThan(0);
      for (const run of runs) expect(run.visits.find((v) => v.slot === slot)!.gap).toBeLessThanOrEqual(gap);
    }
    const lifted = runs.map((run, i) => (i === 0 ? { ...run, visits: run.visits.map((v) => ({ ...v, gap: 0 })) } : run));
    expect(alwaysUnder(lifted)).toEqual([]);
    expect(alwaysUnder([])).toEqual([]);
  });
});
