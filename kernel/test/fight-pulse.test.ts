/** The one fight pulse dial: millisecond durations keep one hand-built fight's order and results at 10, 20 and 30 Hz. */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  type Bundle, type FightInput, type FightWorld, fightCreature, fightPlayer, fightTick, hpCap,
} from '@game/kernel';
import { loadBundle } from '../../tools/test/helpers/world.js';
import { fightArena, playedState } from './fight-scripts.js';

const FOE = 'foe';
const rates = [100, 50, 33] as const;

interface Run {
  outcomes: { at: number; e: string; kind: string; number: number }[];
  phases: { phase: string; at: number }[];
  foeHealth: number;
  playerHealth: number[];
}

let base: Bundle;
beforeAll(() => { base = fightArena(loadBundle()); });

function run(tickMs: number): Run {
  const b = structuredClone(base);
  b.params.wild.tick_ms = tickMs;
  const w: FightWorld = { players: {}, creatures: {} };
  const add = (id: string, at: [number, number], facing: [number, number]) => {
    const p = fightPlayer(b, playedState(b, 54900 + Object.keys(w.players).length, at));
    p.state.player.at = at;
    p.state.player.hp = hpCap(b, p.state);
    p.state.player.fight = { foe: FOE, since: 0 };
    p.facing = facing;
    w.players[id] = p;
  };
  add('striker', [8, 7], [0, 1]);
  add('guard', [8, 9], [0, -1]);
  add('dodger', [8, 9], [0, -1]);
  const foe = fightCreature(b, FOE, 'core/wolf', [8, 8], ['bite']);
  foe.health = 64;
  foe.engaged = ['striker', 'guard', 'dodger'];
  foe.heed = 'guard';
  foe.facing = [0, 1];
  w.creatures[FOE] = foe;

  const opening: FightInput[] = [
    { player: 'striker', tick: 0, v: 'attack', dir: [0, 1] },
    { player: 'guard', tick: 0, v: 'guard', dir: [0, -1] },
  ];
  const dodgeTick = Math.floor(300 / tickMs);
  let world = w;
  const outcomes: Run['outcomes'] = [], phases: Run['phases'] = [];
  let phase = foe.phase;
  for (let tick = 0; tick * tickMs <= 1700; tick++) {
    const inputs: FightInput[] = tick === 0 ? opening : tick === dodgeTick
      ? [{ player: 'dodger', tick, v: 'dodge', dir: [0, 1] }]
      : [];
    const result = fightTick(b, world, inputs, tick);
    world = result.world;
    for (const event of result.events) {
      if (event.e === 'hit' || event.e === 'fight_guard' || event.e === 'fight_dodge') {
        // A dodge is known when the active window closes; the event is emitted on that window's last pulse.
        const at = event.e === 'fight_dodge' ? (tick + 1) * tickMs : tick * tickMs;
        outcomes.push({ at, e: event.e, kind: event.kind, number: event.number });
      }
    }
    const next = world.creatures[FOE]!.phase;
    if (next !== phase) { phases.push({ phase: next, at: tick * tickMs }); phase = next; }
  }
  return {
    outcomes,
    phases,
    foeHealth: world.creatures[FOE]!.health,
    playerHealth: Object.values(world.players).map((p) => p.state.player.hp),
  };
}

describe('the fight pulse is one dial', () => {
  it('keeps a strike, one foe move, a guard and a dodge at 100, 50 and 33 ms', () => {
    const runs = new Map(rates.map((rate) => [rate, run(rate)]));
    const baseline = runs.get(100)!;
    const largestMoves: { rate: number; ms: number }[] = [];
    expect(baseline.outcomes.map(({ e, kind, number }) => ({ e, kind, number }))).toEqual([
      { e: 'hit', kind: 'attack', number: 16 },
      { e: 'fight_guard', kind: 'guard', number: 0 },
      { e: 'fight_dodge', kind: 'dodge', number: 0 },
    ]);
    for (const rate of rates) {
      const result = runs.get(rate)!;
      expect(result.outcomes.map(({ e, kind, number }) => ({ e, kind, number }))).toEqual(
        baseline.outcomes.map(({ e, kind, number }) => ({ e, kind, number })),
      );
      expect(result.foeHealth).toBe(baseline.foeHealth);
      expect(result.playerHealth).toEqual(baseline.playerHealth);
      const moments = [...result.outcomes.map((e) => e.at), ...result.phases.slice(0, 4).map((p) => p.at)];
      const ideals = [300, 500, 700, 0, 500, 700, 1500];
      const moves = moments.map((at, i) => Math.abs(at - ideals[i]!));
      const largest = Math.max(...moves);
      expect(largest, `${rate} ms pulse: bare_windup_ms, windup_ms, active_ms or recover_ms moved too far`).toBeLessThanOrEqual(rate);
      largestMoves.push({ rate, ms: largest });
      process.stdout.write(`fight pulse ${rate} ms: largest move ${largest} ms; moments ${moments.join(',')}\n`);
    }
    expect(largestMoves).toEqual([{ rate: 100, ms: 0 }, { rate: 50, ms: 0 }, { rate: 33, ms: 30 }]);
  });
});
