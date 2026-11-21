/** Five observations of the existing busy-200 workload at each allowed pulse trial. */
import { performance } from 'node:perf_hooks';
import { type FightInput, type FightWorld, fightCreature, fightPlayer, fightTick } from '@game/kernel';
import { loadBundle } from '../../tools/test/helpers/world.js';
import { fightArena, playedState } from '../test/fight-scripts.js';

const selected = (name: string, fallback: number[]): number[] =>
  (process.env[name]?.split(',').map(Number) ?? fallback).map((n) => {
    if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`${name} must contain positive integers.`);
    return n;
  });
const warmup = selected('FIGHT_PULSE_WARMUP', [200])[0]!;
const samples = selected('FIGHT_PULSE_SAMPLES', [2000])[0]!;
const runs = selected('FIGHT_PULSE_RUNS', [5])[0]!;

function observation(tickMs: number, players: number): number {
  const b = fightArena(loadBundle());
  b.params.wild.tick_ms = tickMs;
  let world: FightWorld = { players: {}, creatures: {} };
  const states = Array.from({ length: players }, (_, i) => playedState(b, 54900 + i,
    [2 + (i % 20) * 3, 3 + Math.floor(i / 20) * 3]));
  const firstTick = Math.ceil(Math.max(...states.map((s) => s.tick)) / tickMs) + 1;
  for (const [i, state] of states.entries()) world.players[`account/${i}`] = fightPlayer(b, state);
  const resetPair = (i: number): void => {
    const id = `account/${i}`, spot = `foe/${i}`;
    const p = fightPlayer(b, states[i]!);
    p.state = { ...p.state, player: { ...p.state.player, fight: { foe: spot, since: firstTick } } };
    p.facing = [0, -1];
    const f = fightCreature(b, spot, 'core/wolf', [p.state.player.at[0], p.state.player.at[1] - 1], ['bite', 'bite', 'lunge']);
    f.engaged = [id]; f.heed = id; f.facing = [0, 1];
    world.players[id] = p; world.creatures[spot] = f;
  };
  for (let i = 0; i < players; i++) resetPair(i);
  const timings: number[] = [];
  for (let n = 0; n < warmup + samples; n++) {
    const tick = firstTick + n;
    const inputs: FightInput[] = [];
    for (let i = 0; i < players; i++) {
      const id = `account/${i}`, p = world.players[id]!, f = world.creatures[`foe/${i}`]!;
      if (!p.state.player.fight || f.health === 0) resetPair(i);
      const phase = n % 40;
      inputs.push(phase < 20 ? { player: id, tick, v: 'attack', dir: [0, -1] }
        : phase < 35 ? { player: id, tick, v: 'guard', dir: [0, -1] }
        : phase === 35 ? { player: id, tick, v: 'dodge', dir: [1, 0] }
        : { player: id, tick, v: 'guard', dir: null });
    }
    const start = performance.now();
    const result = fightTick(b, world, inputs, tick);
    const elapsed = (performance.now() - start) * 1000;
    world = result.world;
    if (n >= warmup) timings.push(elapsed);
  }
  timings.sort((a, z) => a - z);
  return timings[Math.ceil(samples / 2) - 1]!;
}

for (const players of selected('FIGHT_PULSE_PAIRS', [200])) {
  for (const tickMs of selected('FIGHT_PULSE_MS', [100, 50, 33])) {
    const observations = Array.from({ length: runs }, () => observation(tickMs, players));
    const sorted = [...observations].sort((a, z) => a - z);
    const median = sorted[Math.ceil(runs / 2) - 1]!;
    const hz = 1000 / tickMs;
    const core = median * hz / 10000;
    process.stdout.write(`${players} pairs | ${tickMs} ms | runs ${observations.map((n) => n.toFixed(2)).join(', ')} us | median ${median.toFixed(2)} us | ${hz.toFixed(3)} pulses/s | ${core.toFixed(3)}% core\n`);
  }
}
