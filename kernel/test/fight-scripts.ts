/** Shared, deterministic workloads; no State is fabricated for the cost measurement. */
import {
  type Action, type Bundle, type FightInput, type FightWorld, type State,
  bagCapacity, bagUsed, drawBasisPoints, fightCreature, fightPlayer, newState, step,
} from '@game/kernel';

/** The existing fight test's open meadow, enlarged to one 64 x 64 presence chunk. */
export function fightArena(base: Bundle): Bundle {
  const b = structuredClone(base);
  b.params.combat.enabled = 1;
  b.map.width = 64; b.map.height = 64;
  b.map.ground = Array.from({ length: 64 }, () => '.'.repeat(64));
  b.map.legend = { '.': { tag: 'meadow', solid: false, sprite: '' } };
  b.map.props = []; b.map.slots = [];
  delete b.map.levels;
  b.npcs = {}; b.instances = {}; b.restores = {};
  b.map.spawn = { x: 1, y: 1 };
  b.params.combat.knockback_tiles = 0;
  return b;
}

/**
 * Play an account into a full bag and a history of gathering and quests. The arena
 * places 36 ordinary fallen-log nodes together, then herbs/reeds/berries/stones.
 * Start supplies the legacy forager's basket and axe. Dropping each log keeps room
 * for the next; the real 180 s refill leaves all 36 logs resting after this walk.
 * Normal automatic quest accounting finishes first-pickings and opens the bridge.
 */
export function playedState(b: Bundle, seed: number, at: [number, number]): State {
  const prep = { ...b, instances: { ...b.instances } };
  let s = newState(prep, seed);
  const act = (a: Action): void => {
    const r = step(prep, s, a, Math.max(s.tick + 1, s.player.busyUntil));
    if (!r.ok) throw new Error(`Account preparation ${a.t}: ${r.error}`);
    s = r.state;
  };
  act({ t: 'start', starter: 'core/forager', name: 'Walker' });
  for (const source of ['core/wild-herbs', 'core/reed-bank', 'core/berry-bushes', 'core/river-stones']) {
    const node = `${source}#bench`;
    prep.instances[node] = { source, kind: 'resource', x: at[0], y: at[1] };
    act({ t: 'gather', node, grade: 3, at });
  }
  // Herbs have zero weight in live content: fill places without inventing carry capacity.
  for (let i = 0; bagUsed(prep, s) < bagCapacity(prep, s); i++) {
    if (i > 100) throw new Error('Account bag did not fill.');
    const node = `core/wild-herbs#fill-${i}`;
    prep.instances[node] = { source: 'core/wild-herbs', kind: 'resource', x: at[0], y: at[1] };
    act({ t: 'gather', node, grade: 3, at });
  }
  // Empty one place, work 36 distinct log nodes, then retrieve the herbs.
  act({ t: 'drop', item: 'core/herb', qty: s.player.bag['core/herb']! });
  for (let i = 0; i < 36; i++) {
    const node = `core/fallen-logs#bench-${i}`;
    prep.instances[node] = { source: 'core/fallen-logs', kind: 'resource', x: at[0], y: at[1] };
    act({ t: 'gather', node, grade: 3, at });
    act({ t: 'drop', item: 'core/log', qty: 1 });
  }
  act({ t: 'pickup', item: 'core/herb', at });
  if (Object.values(s.nodes).filter((n) => n.readyAt > s.tick).length < 36
    || !Object.values(s.player.quests).includes('active') || !Object.values(s.player.quests).includes('done')) {
    throw new Error('Account lacks resting nodes or active/finished quests.');
  }
  return s;
}

export const fightScripts = [
  { name: 'one-on-one', seed: 54901, players: 1, foes: 1 },
  { name: 'four-on-one', seed: 54904, players: 4, foes: 1 },
  { name: 'two-on-one', seed: 54902, players: 1, foes: 2 },
] as const;
export type FightScript = typeof fightScripts[number];

export function scriptWorld(b: Bundle, script: FightScript): FightWorld {
  const w: FightWorld = { players: {}, creatures: {} };
  for (let i = 0; i < script.players; i++) {
    const at: [number, number] = script.foes === 2 ? [18, 18] : [8, 9];
    const p = fightPlayer(b, playedState(b, script.seed + i, at));
    p.state.player.fight = { foe: 'foe/0', since: 0 };
    p.facing = [0, -1];
    w.players[`account/${i}`] = p;
  }
  for (let i = 0; i < script.foes; i++) {
    const f = fightCreature(b, `foe/${i}`, 'core/wolf', [8 + i, 8], ['bite', 'bite', 'lunge']);
    f.engaged = Object.keys(w.players); f.heed = 'account/0'; f.facing = [0, 1];
    if (script.foes === 2) {
      // The existing give-up boundary case: both sides within the den's leash,
      // outside sight, with stagger holding the foes still until after give-up.
      f.home = [12, 12]; f.away = { 'account/0': 0 }; f.stagger = b.params.combat.give_up_t + 10;
    }
    w.creatures[f.spot] = f;
  }
  return w;
}

export function scriptInputs(script: FightScript, w: FightWorld, tick: number): FightInput[] {
  const inputs: FightInput[] = [];
  for (const [id, p] of Object.entries(w.players)) {
    const roll = drawBasisPoints(p.state.seed, `fight-script/${script.seed}`, tick);
    const send = (v: 'attack' | 'dodge' | 'guard' | 'move', dir: [number, number] | null): void => {
      inputs.push({ player: id, tick, v, dir } as FightInput);
    };
    if (script.players === 4 && tick === 0) send('attack', [0, -1]);
    else if (script.foes === 2 && tick < 60) continue;
    else if (script.foes === 2 && tick < 100) send('move', [-1, -1]);
    else if (tick === 0) send('guard', [0, -1]);
    else if (tick === 2) send('guard', null);
    else if (tick === 3) send('attack', [1, 0]); // strike into empty space, allowing the fall control
    else if (tick === 12) send('dodge', [1, 0]);
    else if (tick === 17) send('move', [-1, 0]);
    else if (tick === 22) send('move', null);
    else if (tick > 200) {
      if (roll < 1500) send('guard', roll < 750 ? null : [0, -1]);
      else if (roll < 3000) send('attack', [0, -1]);
      else if (roll < 3500) send('dodge', [1, 0]);
      else if (roll < 4000) send('move', [0, 1]);
      else if (roll < 4500) send('move', null);
    }
  }
  return inputs;
}
