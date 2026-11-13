import { beforeAll, describe, expect, it } from 'vitest';
import {
  type Action, type Bundle, type FightInput, type FightWorld, type State, adaptState, fightCreature,
  fightPlayer, fightTick, hashOf, hpCap, lastBellAt, makeWalkable, migrateState, newState, step, visitNight,
} from '@game/kernel';
import { loadBundle } from '../../tools/test/helpers/world.js';

let base: Bundle;
beforeAll(() => { base = loadBundle(); });
const PLAYER = 'account/a';
const FOE = 'core/bank-wolf';

function arena(): Bundle {
  const b = structuredClone(base);
  b.params.combat.enabled = 1;
  b.map.width = 24; b.map.height = 24;
  b.map.ground = Array.from({ length: 24 }, () => '.'.repeat(24));
  b.map.legend = { '.': { tag: 'meadow', solid: false, sprite: '' } };
  b.map.props = []; b.map.slots = [];
  delete b.map.levels;
  b.npcs = {}; b.instances = {}; b.restores = {};
  b.map.spawn = { x: 1, y: 1 };
  b.params.combat.knockback_tiles = 0;
  return b;
}
function setup(b: Bundle, engaged = true): FightWorld {
  const s = newState(b, 42);
  s.player.race = 'core/human';
  s.player.attrs.stamina = 1;
  s.player.at = [8, 9];
  s.player.hp = hpCap(b, s);
  s.player.fight = engaged ? { foe: FOE, since: 0 } : null;
  const p = fightPlayer(b, s);
  p.facing = [0, -1];
  p.breath = b.params.combat.breath_base + b.params.combat.breath_per_stamina;
  const f = fightCreature(b, FOE, 'core/wolf', [8, 8], ['bite', 'bite', 'lunge']);
  if (engaged) { f.heed = PLAYER; f.engaged = [PLAYER]; }
  f.facing = [0, 1];
  return { players: { [PLAYER]: p }, creatures: { [FOE]: f } };
}
function input(v: 'attack' | 'dodge', tick: number, dir: [number, number] = [0, -1]): FightInput {
  return { player: PLAYER, v, tick, dir };
}
function guard(tick: number, dir: [number, number] | null = [0, -1]): FightInput {
  return { player: PLAYER, v: 'guard', tick, dir };
}
function active(w: FightWorld, since: number, move = 'bite'): void {
  const f = w.creatures[FOE]!;
  f.move = move; f.phase = 'active'; f.since = since; f.heed = PLAYER;
}
function integers(value: unknown): void {
  if (typeof value === 'number') { if (!Number.isSafeInteger(value)) throw new Error(`Non-integer: ${value}`); }
  else if (value && typeof value === 'object') for (const x of Object.values(value)) integers(x);
}

describe('fight tick', () => {
  it('off: 100 ticks of all verbs preserve the original world and emit nothing', () => {
    const b = arena(); b.params.combat.enabled = 0;
    const w = setup(b), before = hashOf(w);
    for (let t = 0; t < 100; t++) {
      const r = fightTick(b, w, [{ player: PLAYER, v: 'move', tick: t, dir: [1, 0] }, input('attack', t), guard(t), input('dodge', t), { player: PLAYER, v: 'tech', slot: 0, dir: [0, 1], tick: t }], t);
      expect(r.world).toBe(w); expect(r.events).toEqual([]);
    }
    expect(hashOf(w)).toBe(before);
  });

  it('determinism: the same arrival-ordered inputs for 1,000 ticks give the same world hash twice', () => {
    const b = arena();
    const start = setup(b), before = hashOf(start);
    const run = (): string => {
      let w = start;
      for (let t = 0; t < 1000; t++) w = fightTick(b, w, t % 20 === 0 ? [guard(t, null), input('attack', t)] : [], t).world;
      return hashOf(w);
    };
    expect(run()).toBe(run());
    expect(hashOf(start)).toBe(before);
  });

  it('integer-only: recursively walks every world and event during 1,000 ticks', () => {
    const b = arena(); let w = setup(b);
    for (let t = 0; t < 1000; t++) {
      const r = fightTick(b, w, t % 12 === 0 ? [input('dodge', t, [1, 0])] : t % 9 === 0 ? [input('attack', t)] : [], t);
      integers(r); w = r.world;
    }
  });

  it('hard and possible: reading the bank wolf wins bare-handed; never guarding falls (prints both tick counts)', () => {
    const b = structuredClone(base); b.params.combat.enabled = 1;
    const bank = b.map.props.find((p) => p.id === FOE)!;
    const initial = setup(b, false);
    const p = initial.players[PLAYER]!;
    const open = makeWalkable(b);
    const at = [[bank.x, bank.y + 1], [bank.x, bank.y - 1], [bank.x + 1, bank.y], [bank.x - 1, bank.y]]
      .find(([x, y]) => open(x!, y!, p.state.player))! as [number, number];
    p.state.player.at = at;
    const f = initial.creatures[FOE]!;
    f.at = [bank.x, bank.y]; f.home = [...f.at];
    const run = (read: boolean): number => {
      let w = structuredClone(initial);
      for (let t = 0; t < 1000; t++) {
        const player = w.players[PLAYER]!, foe = w.creatures[FOE]!;
        const dir: [number, number] = [Math.sign(foe.at[0] - player.state.player.at[0]), Math.sign(foe.at[1] - player.state.player.at[1])];
        const inputs: FightInput[] = [];
        if (read && player.state.player.fight) {
          if ((foe.phase === 'windup' || foe.phase === 'active') && !player.guarding) inputs.push(guard(t, dir));
          if (foe.phase === 'recovery') {
            if (player.guarding) inputs.push(guard(t, null));
            if (foe.move === 'lunge' && player.phase === 'idle') inputs.push(input('attack', t, dir));
          }
        }
        const r = fightTick(b, w, inputs, t); w = r.world;
        if (read && r.events.some((e) => e.e === 'foe_fall')) {
          expect(w.players[PLAYER]!.state.player.falls).toBe(0);
          expect(r.events).toContainEqual(expect.objectContaining({ e: 'foe_fall', drops: b.map.creatures!.kinds['core/wolf']!.hunt!.drops.map(({ item, qty }) => ({ item, qty })) }));
          return t;
        }
        if (!read && r.events.some((e) => e.e === 'fall')) return t;
      }
      throw new Error(read ? 'Reader did not fell the wolf.' : 'Unguarded player did not fall.');
    };
    const won = run(true), fell = run(false);
    process.stdout.write(`hard and possible: guarded wolf fall=${won} ticks; unguarded player fall=${fell} ticks\n`);
    expect(won).toBeGreaterThan(0); expect(fell).toBeGreaterThan(won);
  });

  it('mercy: the last protected tick misses, and the next tick takes harm', () => {
    const b = arena(), w = setup(b);
    active(w, 0);
    const first = fightTick(b, w, [], 5);
    const until = 5 + b.params.combat.mercy_t;
    expect(first.world.players[PLAYER]!.cooldowns.mercy).toBe(until);
    active(first.world, until - 1 - 5);
    first.world.creatures[FOE]!.hit = [];
    expect(fightTick(b, first.world, [], until - 1).events.some((e) => e.e === 'hurt')).toBe(false);
    expect(fightTick(b, first.world, [], until).events.some((e) => e.e === 'hurt')).toBe(true);
  });

  it('stagger: the last stagger tick refuses a strike, and the next tick accepts it', () => {
    const b = arena(), w = setup(b); w.players[PLAYER]!.stagger = 10;
    expect(fightTick(b, w, [input('attack', 9)], 9).events).toContainEqual(expect.objectContaining({ e: 'fight_refused', reason: 'Staggered.' }));
    expect(fightTick(b, w, [input('attack', 10)], 10).world.players[PLAYER]!.move).toBe('attack');
  });

  it('guard break: one breath still guards; on the next drain it breaks and staggers', () => {
    const b = arena(), w = setup(b), p = w.players[PLAYER]!;
    p.breath = 2 * b.params.combat.guard_drain; p.guarding = [0, -1];
    const edge = fightTick(b, w, [], 1);
    expect(edge.world.players[PLAYER]!.guarding).toEqual([0, -1]);
    const after = fightTick(b, edge.world, [], 2);
    expect(after.world.players[PLAYER]!.breath).toBe(0);
    expect(after.world.players[PLAYER]!.guarding).toBeNull();
    expect(after.events).toContainEqual({ e: 'stagger', side: 'player', id: PLAYER });
  });

  it('guard: a guarded hit drains the guard and staggers the striker, including its expiry edge', () => {
    const b = arena(), w = setup(b); active(w, 0); w.players[PLAYER]!.guarding = [0, -1];
    const r = fightTick(b, w, [], 5);
    expect(r.events.some((e) => e.e === 'hurt')).toBe(false);
    expect(r.world.players[PLAYER]!.breath).toBe(w.players[PLAYER]!.breath - b.params.combat.guard_drain - b.params.combat.guard_hit_breath);
    const until = 5 + b.params.combat.guard_stagger_t;
    expect(r.world.creatures[FOE]!.stagger).toBe(until);
    const boundary = structuredClone(r.world);
    boundary.players[PLAYER]!.guarding = null;
    active(boundary, until - 1 - 5);
    boundary.creatures[FOE]!.hit = [];
    expect(fightTick(b, boundary, [], until - 1).events.some((e) => e.e === 'hurt')).toBe(false);
    expect(fightTick(b, boundary, [], until).events.some((e) => e.e === 'hurt')).toBe(true);
    // After the end of recovery it can begin another move, at or after the stagger's end.
    expect(fightTick(b, r.world, [], 15).world.creatures[FOE]!.phase).toBe('windup');
  });

  it('dodge window: moves two tiles by its last tick, ends next tick, and has no invulnerability', () => {
    const b = arena(), w = setup(b);
    let r = fightTick(b, w, [input('dodge', 0, [1, 0])], 0);
    r = fightTick(b, r.world, [], 1); r = fightTick(b, r.world, [], 2);
    expect(r.world.players[PLAYER]!.state.player.at).toEqual([10, 9]);
    expect(r.world.players[PLAYER]!.move).toBe('dodge');
    expect(fightTick(b, r.world, [], 3).world.players[PLAYER]!.move).toBeNull();
    expect(fightTick(b, r.world, [input('attack', 3)], 3).world.players[PLAYER]!.move).toBe('attack');
    const blocked = setup(b); active(blocked, 0);
    b.map.props.push({ x: 9, y: 9, w: 1, h: 1, solid: true, sprite: '' });
    // New bundle identity because geometry is cached, just like step's walkable cache.
    const wall = structuredClone(b);
    const hit = fightTick(wall, blocked, [input('dodge', 5, [1, 0])], 5);
    expect(hit.events.some((e) => e.e === 'hurt')).toBe(true);
  });

  it('dodge cooldown: refuses on its last tick and accepts on the next', () => {
    const b = arena(), w = setup(b); w.players[PLAYER]!.cooldowns.dodge = 10;
    expect(fightTick(b, w, [input('dodge', 9)], 9).events.some((e) => e.e === 'fight_refused')).toBe(true);
    expect(fightTick(b, w, [input('dodge', 10)], 10).world.players[PLAYER]!.move).toBe('dodge');
  });

  it('weak window: first and last recovery ticks multiply harm, the next tick does not', () => {
    const b = arena();
    for (const [t, expected] of [[9, 16], [18, 16], [19, 8]]) {
      const w = setup(b), p = w.players[PLAYER]!, f = w.creatures[FOE]!;
      f.health = 100; active(w, 0, 'lunge');
      p.move = 'attack'; p.phase = 'windup'; p.since = t! - b.params.combat.bare_windup_t;
      expect(fightTick(b, w, [], t!).events).toContainEqual(expect.objectContaining({ e: 'hit', by: 'player', harm: expected }));
    }
  });

  it('behind: an unwatched side multiplies harm before heed changes', () => {
    const b = arena(), w = setup(b), p = w.players[PLAYER]!;
    w.creatures[FOE]!.facing = [0, -1];
    p.move = 'attack'; p.phase = 'windup'; p.since = 0;
    expect(fightTick(b, w, [], 3).events).toContainEqual(expect.objectContaining({ e: 'hit', by: 'player', harm: 16 }));
  });

  it('breath hold: last held tick does not refill; next tick does, standing still only', () => {
    const b = arena(), w = setup(b), p = w.players[PLAYER]!;
    p.breath = 20; p.cooldowns.hold = 10;
    expect(fightTick(b, w, [], 9).world.players[PLAYER]!.breath).toBe(20);
    expect(fightTick(b, w, [], 10).world.players[PLAYER]!.breath).toBe(22);
    p.walking = [1, 0];
    expect(fightTick(b, w, [], 10).world.players[PLAYER]!.breath).toBe(20);
  });

  it('zero breath: paying the final breath staggers and cancels the strike', () => {
    const b = arena(), w = setup(b); w.players[PLAYER]!.breath = b.params.combat.attack_breath;
    const r = fightTick(b, w, [input('attack', 1)], 1);
    expect(r.world.players[PLAYER]!.move).toBeNull();
    expect(r.world.players[PLAYER]!.stagger).toBe(1 + b.params.combat.breath_stagger_t);
  });

  it('inputs: preserves arrival order and refuses the typed tech stub with a reason', () => {
    const b = arena(), w = setup(b);
    const r = fightTick(b, w, [guard(1), guard(1, null), { player: PLAYER, v: 'tech', slot: 0, tick: 1, dir: [0, -1] }], 1);
    expect(r.world.players[PLAYER]!.guarding).toBeNull();
    expect(r.events).toContainEqual(expect.objectContaining({ e: 'fight_refused', verb: 'tech', reason: 'Combat techniques are not implemented.' }));
    expect(fightTick(b, w, [guard(1, null), guard(1)], 1).world.players[PLAYER]!.guarding).toEqual([0, -1]);
  });

  it('engages on approach or first strike, ends at safety, and never walks a creature into safety', () => {
    const b = arena(), w = setup(b, false);
    expect(fightTick(b, w, [], 0).events).toContainEqual({ e: 'engage', player: PLAYER, foe: FOE });
    expect(fightTick(b, w, [input('attack', 0)], 0).world.players[PLAYER]!.move).toBe('attack');
    b.map.slots.push({ id: 'test/safe', kind: 'area', x: 8, y: 9, w: 1, h: 1, safe: true });
    const ended = fightTick(b, setup(b), [], 1);
    expect(ended.events).toContainEqual({ e: 'disengage', player: PLAYER });
    expect(ended.world.players[PLAYER]!.state.player.fight).toBeNull();
    expect(ended.world.creatures[FOE]!.at).toEqual([8, 8]);
  });

  it('give-up: last distant tick stays engaged; next tick ends and preserves health until refill', () => {
    const b = arena(), w = setup(b), p = w.players[PLAYER]!, f = w.creatures[FOE]!;
    p.state.player.at = [18, 18]; f.home = [12, 12]; f.away[PLAYER] = 0; f.health = 7;
    expect(fightTick(b, w, [], b.params.combat.give_up_t - 1).world.players[PLAYER]!.state.player.fight).not.toBeNull();
    const ended = fightTick(b, w, [], b.params.combat.give_up_t);
    expect(ended.world.players[PLAYER]!.state.player.fight).toBeNull();
    const foe = ended.world.creatures[FOE]!;
    expect(foe.health).toBe(7);
    expect(ended.world.players[PLAYER]!.state.nodes[FOE]!.readyAt).toBe(foe.readyAt);
    const refill = Math.ceil(foe.readyAt / b.params.wild.tick_ms);
    expect(fightTick(b, ended.world, [], refill - 1).world.creatures[FOE]!.health).toBe(7);
    expect(fightTick(b, ended.world, [], refill).world.creatures[FOE]!.health).toBe(16);
  });

  it('leash: the den boundary stays engaged, and the next tile disengages immediately', () => {
    const b = arena(), w = setup(b);
    w.players[PLAYER]!.state.player.at = [8 + b.params.combat.leash_tiles, 8];
    const edge = fightTick(b, w, [], 1);
    expect(edge.world.players[PLAYER]!.state.player.fight).not.toBeNull();
    edge.world.players[PLAYER]!.state.player.at = [9 + b.params.combat.leash_tiles, 8];
    expect(fightTick(b, edge.world, [], 2).world.players[PLAYER]!.state.player.fight).toBeNull();
  });

  it('multiplayer: one active swing hits each account once, and account order breaks equal-distance ties', () => {
    const b = arena(), w = setup(b); active(w, 0);
    w.players['account/b'] = structuredClone(w.players[PLAYER]!);
    w.creatures[FOE]!.engaged.push('account/b');
    const r = fightTick(b, w, [], 5);
    expect(r.events.filter((e) => e.e === 'hit').map((e) => e.e === 'hit' && e.player)).toEqual([PLAYER, 'account/b']);
    expect(fightTick(b, r.world, [], 6).events.some((e) => e.e === 'hurt')).toBe(false);
  });

  it('multiple foes: simultaneous strikes share player mercy, and losing one foe keeps the other engaged', () => {
    const b = arena(), w = setup(b); active(w, 0);
    const other = fightCreature(b, 'test/second', 'core/wolf', [8, 10], ['bite']);
    other.facing = [0, -1]; other.heed = PLAYER; other.engaged = [PLAYER];
    other.phase = 'active'; other.move = 'bite'; other.since = 0;
    w.creatures[other.spot] = other;
    const r = fightTick(b, w, [], 5);
    expect(r.events.filter((e) => e.e === 'hurt')).toHaveLength(1);
    expect(r.world.creatures[other.spot]!.engaged).toContain(PLAYER);
    r.world.creatures[FOE]!.health = 0;
    const next = fightTick(b, r.world, [], 6);
    expect(next.world.players[PLAYER]!.state.player.fight?.foe).toBe(other.spot);
    expect(next.events.some((e) => e.e === 'disengage')).toBe(false);
  });

  it('old saves load with fight null through both existing adapters', () => {
    const b = arena(); const old = setup(b).players[PLAYER]!.state;
    delete (old.player as Partial<State['player']>).fight;
    expect(migrateState(old).player.fight).toBeNull();
    expect(adaptState(b, old)!.player.fight).toBeNull();
    expect(old.player).not.toHaveProperty('fight');
  });

  it('craft, kindle and restore are refused while the player fight marker is set', () => {
    const b = structuredClone(base), s = setup(b).players[PLAYER]!.state;
    const actions: Action[] = [
      { t: 'craft', recipe: 'core/herb-tea', at: s.player.at },
      { t: 'kindle', fire: s.player.at, at: s.player.at },
      { t: 'restore', restore: 'core/old-bridge', at: s.player.at },
    ];
    for (const a of actions) expect(step(b, s, a, 0)).toEqual({ ok: false, error: 'Not during a fight.' });
  });

  it('movement: spends integer walking credit and cannot step onto a living creature', () => {
    const b = arena(), w = setup(b);
    const pace = 2 * b.params.wild.tick_ms;
    b.params.load.light_step_ms = pace;
    let r = fightTick(b, w, [{ player: PLAYER, v: 'move', dir: [1, 0], tick: 0 }], 0);
    expect(r.world.players[PLAYER]!.state.player.at).toEqual([8, 9]);
    r = fightTick(b, r.world, [], 1);
    expect(r.world.players[PLAYER]!.state.player.at).toEqual([9, 9]);
    const collision = fightTick(b, w, [{ player: PLAYER, v: 'move', dir: [0, -1], tick: 0 }], 0);
    expect(fightTick(b, collision.world, [], 1).world.players[PLAYER]!.state.player.at).toEqual([8, 9]);
  });

  it('movement: dodge crosses neither a solid corner nor a level boundary', () => {
    const b = arena();
    b.map.props.push({ x: 9, y: 9, w: 1, h: 1, solid: true, sprite: '' });
    let r = fightTick(b, setup(b), [input('dodge', 0, [1, 1])], 0);
    r = fightTick(b, r.world, [], 1); r = fightTick(b, r.world, [], 2);
    expect(r.world.players[PLAYER]!.state.player.at).toEqual([8, 9]);
    const cliff = arena();
    cliff.map.levels = Array.from({ length: 24 }, (_, y) => y === 9 ? '0'.repeat(9) + '1'.repeat(15) : '0'.repeat(24));
    r = fightTick(cliff, setup(cliff), [input('dodge', 0, [1, 0])], 0);
    r = fightTick(cliff, r.world, [], 1); r = fightTick(cliff, r.world, [], 2);
    expect(r.world.players[PLAYER]!.state.player.at).toEqual([8, 9]);
  });

  it('fall: reuses outing loss and wake-up, then disengages in the same tick', () => {
    const b = arena(), w = setup(b), p = w.players[PLAYER]!;
    p.state.player.hp = 1;
    p.state.player.bag['core/stone'] = 3;
    p.state.player.outing = { gained: { 'core/stone': 2 }, solved: [], visited: [] };
    active(w, 0);
    const r = fightTick(b, w, [], 5);
    expect(r.events).toContainEqual(expect.objectContaining({ e: 'fall', lost: [{ item: 'core/stone', qty: 2 }] }));
    expect(r.events).toContainEqual({ e: 'disengage', player: PLAYER });
    expect(r.world.players[PLAYER]!.state.player.bag['core/stone']).toBe(1);
    expect(r.world.players[PLAYER]!.state.player.fight).toBeNull();
    expect(r.world.players[PLAYER]!.state.player.hp).toBe(hpCap(b, p.state));
  });

  it('last expedition bell walks out before a same-tick attack', () => {
    const b = structuredClone(base); b.params.combat.enabled = 1;
    const w = setup(b), p = w.players[PLAYER]!;
    const x: Bundle['expeditions'][string] = {
      id: 'test/night', creator: 'test', title: 'Night', file: 'test', place: 'test/place',
      window: { bells: [20, 23, 2, 4] }, exit: 'test/exit', chain: [],
      climax: { slot: 'test/climax' }, reward: {}, on_miss: 'wait',
    };
    b.expeditions[x.id] = x;
    b.map.slots.push({ id: x.exit, kind: 'area', x: 2, y: 2, w: 1, h: 1, safe: true });
    const entered = 400_000;
    p.state.player.expeditions[x.id] = { climax: false, rung: 0, entered };
    const bell = lastBellAt(b, x, visitNight(b, x, entered));
    const t = Math.ceil(bell / b.params.wild.tick_ms);
    const r = fightTick(b, w, [input('attack', t)], t);
    expect(r.events).toContainEqual({ e: 'walked_out', expedition: x.id, player: PLAYER });
    expect(r.events.some((e) => e.e === 'hit')).toBe(false);
    expect(r.world.players[PLAYER]!.state.player.fight).toBeNull();
  });
});
