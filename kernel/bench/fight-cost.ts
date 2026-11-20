/** pnpm exec tsx kernel/bench/fight-cost.ts — elapsed time excludes setup, resets and serialization. */
import { performance } from 'node:perf_hooks';
import { type FightInput, type FightWorld, fightCreature, fightPlayer, fightTick } from '@game/kernel';
import { loadBundle } from '../../tools/test/helpers/world.js';
import { fightArena, playedState } from '../test/fight-scripts.js';

const b = fightArena(loadBundle());
const warmup = 200, samples = 2000;
const rows: string[] = [];
for (const count of [1, 20, 50, 200]) {
  for (const busy of [false, true]) {
    let world: FightWorld = { players: {}, creatures: {} };
    const engaged = busy ? Math.min(20, count) : 0;
    const states = Array.from({ length: count }, (_, i) => playedState(b, 54900 + i,
      i < engaged ? [4 + (i % 5) * 12, 5 + Math.floor(i / 5) * 12] : [62, 62]));
    const firstTick = Math.ceil(Math.max(...states.map((s) => s.tick)) / b.params.wild.tick_ms) + 1;
    for (const [i, s] of states.entries()) world.players[`account/${i}`] = fightPlayer(b, s);
    const resetPair = (i: number): void => {
      const id = `account/${i}`, spot = `foe/${i}`;
      const p = fightPlayer(b, states[i]!);
      // This is an appearance/rejoin between encounters, outside the timed tick.
      p.state = { ...p.state, player: { ...p.state.player, fight: { foe: spot, since: firstTick } } };
      p.facing = [0, -1];
      const f = fightCreature(b, spot, 'core/wolf', [p.state.player.at[0], p.state.player.at[1] - 1], ['bite', 'bite', 'lunge']);
      f.engaged = [id]; f.heed = id; f.facing = [0, 1];
      world.players[id] = p; world.creatures[spot] = f;
    };
    for (let i = 0; i < Math.min(20, count); i++) {
      if (busy) resetPair(i);
      else world.creatures[`foe/${i}`] = fightCreature(b, `foe/${i}`, 'core/wolf', [4 + i * 2, 4], ['bite', 'bite', 'lunge']);
    }
    const bytes = Buffer.byteLength(JSON.stringify(world));
    const timings: number[] = [];
    for (let n = 0; n < warmup + samples; n++) {
      const tick = firstTick + n;
      const inputs: FightInput[] = [];
      for (let i = 0; i < engaged; i++) {
        const id = `account/${i}`, p = world.players[id]!, f = world.creatures[`foe/${i}`]!;
        if (!p.state.player.fight || f.health === 0) resetPair(i);
        // Each engaged player sends one input every tick: strikes, held/released guard, dodge.
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
    const percentile = (p: number): string => timings[Math.ceil(p * samples) - 1]!.toFixed(2);
    rows.push(`| ${count} | ${busy ? 'busy' : 'idle'} | ${percentile(0.5)} | ${percentile(0.95)} | ${percentile(0.99)} | ${bytes} |`);
  }
}
process.stdout.write(['| players | case | median µs | p95 µs | p99 µs | world bytes |',
  '| --- | --- | ---: | ---: | ---: | ---: |', ...rows, ''].join('\n'));
