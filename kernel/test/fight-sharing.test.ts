import { beforeAll, describe, expect, it } from 'vitest';
import { type Bundle, type FightWorld, fightCreature, fightPlayer, fightTick, hashOf, lastBellAt, newState, visitNight } from '@game/kernel';
import { loadBundle } from '../../tools/test/helpers/world.js';
import golden from './fixtures/fight-golden.json';
import { fightArena, fightScripts, playedState, scriptInputs, scriptWorld } from './fight-scripts.js';

let b: Bundle;
beforeAll(() => { b = fightArena(loadBundle()); });

function freeze(value: unknown, seen = new WeakSet<object>()): void {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  Object.freeze(value);
}

function pair(): FightWorld {
  const w: FightWorld = { players: {}, creatures: {} };
  const p = fightPlayer(b, playedState(b, 42, [8, 9]));
  p.state.player.fight = { foe: 'foe', since: 0 };
  p.guarding = [0, -1];
  const f = fightCreature(b, 'foe', 'core/wolf', [8, 8], ['bite', 'bite', 'lunge']);
  f.engaged = ['player']; f.heed = 'player'; f.facing = [0, 1];
  w.players.player = p; w.creatures.foe = f;
  return w;
}

describe('fight tick golden identity and purity', () => {
  for (const script of fightScripts) {
    it(`${script.name}: 1,000 frozen ticks match both develop hashes without changing the input`, () => {
      const fixture = golden.scripts.find((s) => s.name === script.name)!;
      expect(fixture.seed).toBe(script.seed);
      expect(fixture.ticks).toHaveLength(1000);
      let w = scriptWorld(b, script);
      for (let tick = 0; tick < 1000; tick++) {
        const inputs = scriptInputs(script, w, tick);
        const before = structuredClone(w);
        freeze(w); freeze(inputs);
        const r = fightTick(b, w, inputs, tick);
        expect([hashOf(r.world), hashOf(r.events)], `tick ${tick}`).toEqual(fixture.ticks[tick]);
        expect(w, `input at tick ${tick}`).toEqual(before);
        w = r.world;
      }
    });
  }
  it('the golden scripts actually include a fall, foe fall and the timed give-up boundary', () => {
    expect(golden.scripts.find((s) => s.name === 'one-on-one')!.counts.fall).toBeGreaterThan(0);
    expect(golden.scripts.find((s) => s.name === 'four-on-one')!.counts.foe_fall).toBeGreaterThan(0);
    const script = fightScripts[2], w = scriptWorld(b, script);
    const c = b.params.combat;
    expect(fightTick(b, w, [], c.give_up_t - 1).events.some((e) => e.e === 'disengage')).toBe(false);
    expect(fightTick(b, w, [], c.give_up_t).events).toContainEqual({ e: 'disengage', player: 'account/0' });
  });
});

describe('fight tick structural sharing', () => {
  it('shares an idle player and idle creature, including while another pair fights', () => {
    const w = pair();
    w.players.idle = fightPlayer(b, newState(b, 7));
    w.players.idle.state.player.at = [62, 62];
    w.creatures.idle = fightCreature(b, 'idle', 'core/wolf', [50, 50], ['bite']);
    freeze(w);
    const r = fightTick(b, w, [], 1);
    expect(r.world.players.idle).toBe(w.players.idle);
    expect(r.world.creatures.idle).toBe(w.creatures.idle);
    expect(r.world.players.player).not.toBe(w.players.player);
    expect(r.world.creatures.foe).not.toBe(w.creatures.foe);
  });

  it('holding a guard copies the live record and cooldowns but shares the entire State', () => {
    const w = pair(); freeze(w);
    const r = fightTick(b, w, [], 1), p = r.world.players.player!;
    expect(p).not.toBe(w.players.player);
    expect(p.breath).toBe(w.players.player!.breath - b.params.combat.guard_drain);
    expect(p.cooldowns).not.toBe(w.players.player!.cooldowns);
    expect(p.state).toBe(w.players.player!.state);
  });

  it('walking credit alone shares State; a step copies only State and its player record', () => {
    const w = pair(), p = w.players.player!;
    p.guarding = null; p.walking = [1, 0];
    p.credit = 0;
    freeze(w);
    const credit = fightTick(b, w, [], 1).world.players.player!;
    expect(credit).not.toBe(p);
    expect(credit.state).toBe(p.state);
    const next = fightTick(b, { ...w, players: { player: credit } }, [], 2).world.players.player!;
    expect(next.state).not.toBe(credit.state);
    expect(next.state.player).not.toBe(credit.state.player);
    expect(next.state.player.bag).toBe(p.state.player.bag);
    expect(next.state.player.quests).toBe(p.state.player.quests);
    expect(next.state.nodes).toBe(p.state.nodes);
  });

  it('a foe fall copies node maps for every player, preserving the old nodes and bags', () => {
    const w = pair();
    w.players.idle = fightPlayer(b, newState(b, 7));
    w.players.idle.state.player.at = [62, 62];
    w.creatures.foe!.health = 0;
    const before = structuredClone(w); freeze(w);
    const r = fightTick(b, w, [], 1);
    expect(w).toEqual(before);
    for (const id of Object.keys(w.players)) {
      const p = r.world.players[id]!, old = w.players[id]!;
      expect(p).not.toBe(old); expect(p.state).not.toBe(old.state);
      expect(p.state.nodes).not.toBe(old.state.nodes);
      expect(p.state.player.bag).toBe(old.state.player.bag);
      expect(p.state.nodes.foe!.readyAt).toBe(r.world.creatures.foe!.readyAt);
    }
  });

  it('fight focus switches through a copied marker with two foes', () => {
    const w = pair();
    const second = fightCreature(b, 'other', 'core/wolf', [9, 9], ['bite']);
    second.engaged = ['player']; second.heed = 'player';
    w.creatures.other = second; w.creatures.foe!.health = 0;
    freeze(w);
    const r = fightTick(b, w, [], 1);
    expect(r.world.players.player!.state.player.fight!.foe).toBe('other');
    expect(w.players.player!.state.player.fight!.foe).toBe('foe');
  });

  it('a fall removes the player from a later foe before that foe can move', () => {
    const w = pair();
    w.players.player!.guarding = null;
    w.players.player!.state.player.hp = 1;
    const first = w.creatures.foe!;
    first.phase = 'active'; first.move = 'bite'; first.since = 0;
    const second = fightCreature(b, 'other', 'core/wolf', [8, 10], ['bite']);
    second.engaged = ['player']; second.heed = 'player';
    second.credit = b.map.creatures!.kinds['core/wolf']!.fight!.pace_ms;
    w.creatures.other = second;
    const before = structuredClone(w); freeze(w);
    const r = fightTick(b, w, [], 5);
    expect(r.events.some((e) => e.e === 'fall')).toBe(true);
    expect(r.world.creatures.other!.at).toEqual(second.at);
    expect(r.world.creatures.other!.facing).toEqual(second.facing);
    expect(w).toEqual(before);
  });

  it('a frozen expedition bell uses the existing walk-out before the attack', () => {
    const bundle = fightArena(b), w = pair();
    const x: Bundle['expeditions'][string] = {
      id: 'test/night', creator: 'test', title: 'Night', file: 'test', place: 'test/place',
      window: { bells: [20, 23, 2, 4] }, exit: 'test/exit', chain: [],
      climax: { slot: 'test/climax' }, reward: {}, on_miss: 'wait',
    };
    bundle.expeditions[x.id] = x;
    bundle.map.slots.push({ id: x.exit, kind: 'area', x: 2, y: 2, w: 1, h: 1, safe: true });
    const entered = 400000;
    w.players.player!.state.player.expeditions[x.id] = { climax: false, rung: 0, entered };
    const tick = Math.ceil(lastBellAt(bundle, x, visitNight(bundle, x, entered)) / bundle.params.wild.tick_ms);
    const before = structuredClone(w); freeze(w);
    const r = fightTick(bundle, w, [{ player: 'player', v: 'attack', dir: [0, -1], tick }], tick);
    expect(w).toEqual(before);
    expect(r.events).toContainEqual({ e: 'walked_out', expedition: x.id, player: 'player' });
    expect(r.events.some((e) => e.e === 'hit')).toBe(false);
  });

  it('a distant account can make camp ground safe for the fighting pair', () => {
    const bundle = fightArena(b), w = pair();
    bundle.map.slots.push({ id: 'test/camp', kind: 'camp', x: 8, y: 8, w: 1, h: 1 });
    const owner = fightPlayer(bundle, newState(bundle, 7));
    owner.state.player.at = [62, 62]; owner.state.player.camp = ['core/campfire'];
    w.players.owner = owner;
    freeze(w);
    const r = fightTick(bundle, w, [], 1);
    expect(r.events).toContainEqual({ e: 'disengage', player: 'player' });
    expect(r.world.players.owner).toBe(owner);
  });

  it('personal fire safety uses the current tick and its owner can remain shared', () => {
    const w = pair(), owner = fightPlayer(b, newState(b, 7));
    owner.state.player.at = [62, 62];
    owner.state.player.own = { at: [8, 8], lit: 0, until: 200, log: 200 };
    w.players.owner = owner; freeze(w);
    const burning = fightTick(b, w, [], 1);
    expect(burning.events).toContainEqual({ e: 'disengage', player: 'player' });
    expect(burning.world.players.owner).toBe(owner);
    expect(fightTick(b, w, [], 2).world.players.player!.state.player.fight).not.toBeNull();
  });

  it('disabled combat returns the exact input world', () => {
    const bundle = fightArena(b); bundle.params.combat.enabled = 0;
    const w = pair(); freeze(w);
    const r = fightTick(bundle, w, [], 0);
    expect(r.world).toBe(w); expect(r.events).toEqual([]);
  });
});
