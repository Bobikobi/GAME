/**
 * The chunk's pure fight tick (COMBAT 4.2, 4.3, 4.7, 4.9). Never called by the game yet.
 * Order: bell/safety endings and expired dodges; inputs in supplied arrival order; held movement; engagement;
 * breath/guard drain; phase boundaries; players' strikes; foes' movement and strikes; endings.
 * Figures resolve by distance to their target, then UTF-16 account/spot id. Input tick is the
 * server's arrival stamp, never a client clock; equal stamps retain array order. No rolls here:
 * the caller supplies the pattern drawn at appearance and a read-only snapshot of animal tiles/kinds.
 * Windows are [since, until): at `until` the next phase already holds. A swing hits a target once.
 * Dodge moves out of reach; 4.9 supersedes 4.3's invulnerability. The leash/give-up rows also win,
 * and with them the ending: a foe left standing is whole again at once, only a fallen foe rests.
 */
import type { Bundle } from './bundle';
import { dangerAt, isSafe } from './danger';
import { type FightDef, type MoveDef, moveHarm, patternMoves } from './fightmath';
import { breathRefillPermille, walkStepMs } from './load';
import { assertInt, idiv, mulDiv, MILLI, PERCENT } from './num';
import { attrAt, hpCap, type State } from './state';
import { fightBell, fightHurt, type GameEvent } from './step';
import { makeStepRule, makeWalkable } from './world';
import type { Tile } from './wild/types';

export type FightPhase = 'idle' | 'windup' | 'active' | 'recovery';
export type FightInput = { player: string; tick: number } & (
  | { v: 'move' | 'guard'; dir: Tile | null }
  | { v: 'attack' | 'dodge'; dir: Tile }
  | { v: 'tech'; slot: number; dir: Tile }
);
interface Figure {
  breath: number;
  facing: Tile;
  move: string | null;
  phase: FightPhase;
  since: number;
  stagger: number;
  cooldowns: Record<string, number>;
}
export interface FightPlayer extends Figure {
  state: State;
  guarding: Tile | null;
  walking: Tile | null;
  credit: number;
  dodgeSteps: number;
}
export interface FightCreature extends Figure {
  spot: string;
  kind: string;
  /** Fixed at appearance, never redrawn by this tick. */
  pattern: string[];
  health: number;
  at: Tile;
  home: Tile;
  heed: string | null;
  engaged: string[];
  /** First tick beyond sight, by participant. */
  away: Record<string, number>;
  cursor: number;
  credit: number;
  hit: string[];
  /** Plain hunt goods announced on a fall; collection/dressing is outside this tick. */
  drops: { item: string; qty: number }[];
  /** Milliseconds, like State.nodes[spot].readyAt. */
  readyAt: number;
}
/** Records are keyed by account id and creature spot id respectively. The caller advances one tick at a time. */
export interface FightWorld {
  players: Record<string, FightPlayer>;
  creatures: Record<string, FightCreature>;
}
export type FightWorldEvent = GameEvent & { player?: string };
export type FightResult = { world: FightWorld; events: FightWorldEvent[] };

export function fightPlayer(bundle: Bundle, state: State): FightPlayer {
  return { state, breath: bundle.params.combat.breath_base + bundle.params.combat.breath_per_stamina * attrAt(bundle, state, 'stamina'), facing: [0, 1], guarding: null, walking: null, move: null, phase: 'idle', since: 0,
    cooldowns: {}, stagger: 0, credit: 0, dodgeSteps: 0 };
}

/** The snapshot boundary with wild: reads only a kind, tile and the appearance's chosen pattern. */
export function fightCreature(bundle: Bundle, spot: string, kind: string, at: Tile, pattern: readonly string[]): FightCreature {
  const def = bundle.map.creatures?.kinds[kind]?.fight;
  if (!def || pattern.length === 0 || patternMoves(def, pattern).length !== pattern.length) throw new Error('Unknown fight or pattern.');
  return { spot, kind, pattern: [...pattern], health: def.hp, breath: def.breath, at: [...at], home: [...at], facing: [0, 1],
    heed: null, engaged: [], away: {}, move: null, phase: 'idle', since: 0, cooldowns: {}, stagger: 0, cursor: 0, credit: 0, hit: [], drops: (bundle.map.creatures!.kinds[kind]!.hunt?.drops ?? []).map(({ item, qty }) => ({ item, qty })), readyAt: 0 };
}

const geometry = new WeakMap<Bundle, { walkable: ReturnType<typeof makeWalkable>; stepOpen: ReturnType<typeof makeStepRule> }>();

const distance = (a: Tile, b: Tile): number => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
const direction = (a: Tile, b: Tile): Tile => [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])];
const cardinal = (a: Tile, b: Tile): Tile => Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1])
  ? [Math.sign(b[0] - a[0]), 0] : [0, Math.sign(b[1] - a[1])];
const same = (a: Tile, b: Tile): boolean => a[0] === b[0] && a[1] === b[1];
const validDir = (d: Tile): boolean => d.length === [0, 0].length &&d.every((n) => Number.isSafeInteger(n) && Math.abs(n) <= 1) && !same(d, [0, 0]);
const due = (f: Figure, key: string): number => f.cooldowns[key] ?? 0;
const textOrder = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const ahead = (from: Tile, to: Tile, face: Tile, reach: number): boolean =>
  (face[0] === 0 || face[1] === 0) && distance(from, to) > 0 && distance(from, to) <= reach && same(direction(from, to), face);

export function fightTick(bundle: Bundle, world: FightWorld, inputs: readonly FightInput[], tick: number): FightResult {
  if (bundle.params.combat.enabled === 0) return { world, events: [] };
  assertInt(tick, 'fight tick');
  if (tick < 0) throw new Error('Fight tick cannot be negative.');
  const w = structuredClone(world);
  const events: FightWorldEvent[] = [];
  const c = bundle.params.combat;
  const ms = tick * bundle.params.wild.tick_ms;
  let ground = geometry.get(bundle);
  if (!ground) {
    ground = { walkable: makeWalkable(bundle), stepOpen: makeStepRule(bundle) };
    geometry.set(bundle, ground);
  }
  const { walkable, stepOpen } = ground;
  const players = (): [string, FightPlayer][] => Object.entries(w.players).sort(([a, p], [b, q]) => {
    const f = p.state.player.fight?.foe;
    const g = q.state.player.fight?.foe;
    return (f && w.creatures[f] ? distance(p.state.player.at, w.creatures[f]!.at) : 0)
      - (g && w.creatures[g] ? distance(q.state.player.at, w.creatures[g]!.at) : 0) || textOrder(a, b);
  });
  const foes = (): [string, FightCreature][] => Object.entries(w.creatures).sort(([a, f], [b, g]) =>
    (f.heed && w.players[f.heed] ? distance(f.at, w.players[f.heed]!.state.player.at) : 0)
    - (g.heed && w.players[g.heed] ? distance(g.at, w.players[g.heed]!.state.player.at) : 0) || textOrder(a, b));
  const safe = (at: Tile): boolean => dangerAt(bundle, [at[0], at[1]]) === 0 || Object.values(w.players).some((p) =>
    isSafe(bundle, { ...p.state, player: { ...p.state.player, aboard: null } }, [at[0], at[1]], ms));
  const playerSafe = (p: FightPlayer): boolean => p.state.player.aboard != null || safe(p.state.player.at);
  const cap = (p: FightPlayer): number => c.breath_base + c.breath_per_stamina * attrAt(bundle, p.state, 'stamina');
  const shortened = (p: FightPlayer, duration: number): number =>
    Math.max(1, mulDiv(duration, Math.max(0, PERCENT - bundle.params.per_point.agility_pct * attrAt(bundle, p.state, 'agility')), PERCENT));
  function end(id: string, p: FightPlayer): void {
    if (!p.state.player.fight) return;
    p.state.player.fight = null;
    p.guarding = null;
    p.walking = null;
    p.phase = 'idle';
    p.move = null;
    for (const f of Object.values(w.creatures)) {
      f.engaged = f.engaged.filter((player) => player !== id);
      delete f.away[id];
    }
    events.push({ e: 'disengage', player: id });
  }
  function engage(id: string, p: FightPlayer, fid: string, f: FightCreature): void {
    if (f.engaged.includes(id)) return;
    f.engaged.push(id);
    if (!p.state.player.fight) {
      p.state.player.fight = { foe: fid, since: tick };
      p.breath = cap(p);
    }
    f.heed ??= id;
    events.push({ e: 'engage', player: id, foe: fid });
  }
  function stagger(f: Figure, duration: number, side: 'player' | 'foe', id: string): void {
    f.stagger = Math.max(f.stagger, tick + duration);
    if (side === 'player') {
      const p = w.players[id]!;
      p.guarding = null;
      p.walking = null;
      p.phase = 'idle';
      p.move = null;
    }
    events.push({ e: 'stagger', side, id });
  }
  function spend(f: Figure, amount: number, side: 'player' | 'foe', id: string): void {
    const before = f.breath;
    f.breath = Math.max(0, before - amount);
    f.cooldowns.hold = tick + c.breath_hold_t;
    if (before > 0 && f.breath === 0) stagger(f, side === 'player' ? shortened(w.players[id]!, c.breath_stagger_t) : c.breath_stagger_t, side, id);
  }
  function step(at: Tile, dir: Tile, view: State, creature: boolean): [number, number] {
    const target: [number, number] = [at[0] + dir[0], at[1] + dir[1]];
    if (!walkable(target[0], target[1], view.player) || !stepOpen(at[0], at[1], target[0], target[1]) || (creature && safe(target))) return [at[0], at[1]];
    if (creature ? Object.values(w.players).some((p) => same(p.state.player.at, target))
      : Object.values(w.creatures).some((f) => f.health > 0 && ms >= f.readyAt && same(f.at, target))) return [at[0], at[1]];
    // Diagonal movement cannot squeeze through a blocked corner or bypass a cliff.
    if (dir[0] !== 0 && dir[1] !== 0) {
      const x: Tile = [target[0], at[1]], y: Tile = [at[0], target[1]];
      if (!walkable(x[0], x[1], view.player) || !walkable(y[0], y[1], view.player)
        || !stepOpen(...at, ...x) || !stepOpen(...at, ...y) || !stepOpen(...x, ...target) || !stepOpen(...y, ...target)
        || (creature && (safe(x) || safe(y)))) return [at[0], at[1]];
    }
    return target;
  }
  function finish(): void {
    for (const [, f] of foes()) {
      const sight = bundle.map.creatures!.kinds[f.kind]!.behaviour?.sight ?? c.engage_tiles;
      f.engaged = f.engaged.filter((id) => {
        const p = w.players[id];
        if (!p?.state.player.fight || f.health === 0 || playerSafe(p) || safe(f.at) || distance(f.at, f.home) > c.leash_tiles || distance(p.state.player.at, f.home) > c.leash_tiles) {
          delete f.away[id];
          return false;
        }
        if (distance(f.at, p.state.player.at) > sight) {
          f.away[id] ??= tick;
          return tick - f.away[id]! < c.give_up_t;
        }
        delete f.away[id];
        return true;
      });
      if (!f.engaged.length && f.heed !== null) {
        f.heed = null;
        f.phase = 'idle';
        f.move = null;
        const kind = bundle.map.creatures!.kinds[f.kind]!;
        if (f.health > 0) {
          // COMBAT 4.9 (leash_tiles): a foe left standing is whole again at once, so a run ends a fight and
          // kiting gains nothing. It stays where it stands; outside a fight its tile is the wild's.
          f.health = kind.fight!.hp; f.breath = kind.fight!.breath; f.cursor = 0; f.credit = 0; f.hit = []; f.away = {};
        } else {
          // Only a fallen foe rests. The kind's refill clock is in game days; there is no separate foe content type.
          f.readyAt = ms + (kind.hunt?.spawn.refill_d ?? 1) * bundle.params.day_length_ms;
          for (const [, p] of players()) p.state.nodes[f.spot] = { readyAt: f.readyAt, draws: p.state.nodes[f.spot]?.draws ?? 0 };
        }
      } else if (f.heed === null || !f.engaged.includes(f.heed)) f.heed = [...f.engaged].sort()[0] ?? null;
    }
    for (const [id, p] of players()) {
      if (!p.state.player.fight) continue;
      const still = foes().filter(([, f]) => f.engaged.includes(id));
      if (!still.length) end(id, p);
      else if (!still.some(([fid]) => fid === p.state.player.fight!.foe)) p.state.player.fight.foe = still[0]![0];
    }
  }

  // G49's walk-out precedes every input, even when a caller missed the bell tick.
  for (const [id, p] of players()) {
    const bell = fightBell(bundle, p.state, ms);
    if (bell) {
      p.state = bell.state;
      events.push(...bell.events.map((event) => ({ ...event, player: id })));
      end(id, p);
    }
  }
  finish();
  for (const [, p] of players()) {
    if (p.move === 'dodge' && tick - p.since >= c.dodge_t) { p.phase = 'idle'; p.move = null; }
  }
  for (const input of inputs) {
    const p = w.players[input.player];
    if (!p) continue;
    const refuse = (reason: string): void => { events.push({ e: 'fight_refused', player: input.player, verb: input.v, reason }); };
    if (!Number.isSafeInteger(input.tick) || input.tick < 0 || input.tick > tick) { refuse('Input has not arrived.'); continue; }
    if (input.v === 'tech') { refuse('Combat techniques are not implemented.'); continue; }
    if (input.dir !== null && !validDir(input.dir)) { refuse('Bad direction.'); continue; }
    if (tick < p.stagger) { refuse('Staggered.'); continue; }
    if (input.v === 'move') {
      p.walking = input.dir;
      if (input.dir) p.facing = input.dir;
      else p.credit = 0;
      continue;
    }
    if (!p.state.player.fight) {
      const candidate = foes().find(([, f]) => f.health > 0 && ms >= f.readyAt && !safe(f.at) && !playerSafe(p)
        && distance(p.state.player.at, f.home) <= c.leash_tiles && ahead(p.state.player.at, f.at, input.dir ?? p.facing, 1));
      if (candidate && input.v === 'attack') engage(input.player, p, ...candidate);
    }
    if (!p.state.player.fight) { refuse('Not engaged.'); continue; }
    if (input.v === 'guard') {
      if (input.dir && (p.phase !== 'idle' || p.breath === 0)) { refuse('Cannot guard now.'); continue; }
      p.cooldowns.hold = tick + c.breath_hold_t;
      p.guarding = input.dir;
      if (input.dir) p.facing = input.dir;
      continue;
    }
    if (p.phase !== 'idle') { refuse('Move in progress.'); continue; }
    const key = input.v === 'attack' ? 'hand' : 'dodge';
    const cost = input.v === 'attack' ? c.attack_breath : c.dodge_breath;
    if (tick < due(p, key) || p.breath < cost) { refuse('Cooldown or insufficient breath.'); continue; }
    p.facing = input.dir!;
    p.guarding = null;
    p.walking = null;
    p.move = input.v;
    p.phase = 'windup';
    p.since = tick;
    p.dodgeSteps = 0;
    p.cooldowns[key] = tick + (key === 'hand' ? Math.max(c.swing_floor_t, c.swing_quick_t) : c.dodge_t + shortened(p, c.dodge_cooldown_t));
    spend(p, cost, 'player', input.player);
  }

  for (const [id, p] of players()) {
    if (tick < p.stagger) continue;
    if (p.walking && p.phase === 'idle') {
      p.credit += bundle.params.wild.tick_ms;
      const pace = walkStepMs(bundle, p.state);
      while (p.credit >= pace) {
        p.state.player.at = step(p.state.player.at, p.walking, p.state, false);
        p.credit -= pace;
        p.state.player.movedAt = ms;
      }
    }
    if (p.move === 'dodge') {
      const steps = Math.min(c.dodge_tiles, idiv((tick - p.since + 1) * c.dodge_tiles, c.dodge_t));
      while (p.dodgeSteps < steps) {
        p.state.player.at = step(p.state.player.at, p.facing, p.state, false);
        p.dodgeSteps += 1;
      }
      if (tick - p.since >= c.dodge_t) { p.phase = 'idle'; p.move = null; }
    }
    // Movement can reach safety before any attack on this tick.
    if (p.state.player.fight && playerSafe(p)) end(id, p);
  }
  for (const [fid, f] of foes()) {
    if (ms >= f.readyAt && f.readyAt > 0) {
      const def = bundle.map.creatures!.kinds[f.kind]!.fight!;
      f.health = def.hp; f.breath = def.breath; f.at = [...f.home]; f.cooldowns = {}; f.cursor = 0; f.stagger = 0; f.readyAt = 0; f.away = {};
    }
    if (f.health === 0 || ms < f.readyAt || safe(f.at)) continue;
    for (const [id, p] of players()) {
      if (!playerSafe(p) && distance(f.at, p.state.player.at) <= c.engage_tiles && distance(f.at, f.home) <= c.leash_tiles && distance(p.state.player.at, f.home) <= c.leash_tiles) engage(id, p, fid, f);
    }
  }
  for (const [id, p] of players()) {
    if (!p.state.player.fight) continue;
    if (p.guarding) spend(p, c.guard_drain, 'player', id);
    else if (!p.walking && p.move !== 'dodge' && tick >= due(p, 'hold')) p.breath = Math.min(cap(p), p.breath + mulDiv(c.breath_refill, breathRefillPermille(bundle, p.state), MILLI));
  }
  // Derive foe phases before player damage so the recovery's first tick is already weak.
  function moveOf(f: FightCreature, def: FightDef): MoveDef | undefined { return def.moves.find((m) => m.id === f.move); }
  function phase(f: FightCreature, def: FightDef): void {
    const m = moveOf(f, def);
    if (!m || f.phase === 'idle') return;
    const age = tick - f.since;
    f.phase = age < m.windup_t ? 'windup' : age < m.windup_t + c.active_t ? 'active'
      : age < m.windup_t + c.active_t + m.recover_t ? 'recovery' : 'idle';
    if (f.phase === 'idle') f.move = null;
  }
  for (const [, f] of foes()) phase(f, bundle.map.creatures!.kinds[f.kind]!.fight!);
  for (const [id, p] of players()) {
    if (!p.state.player.fight || p.move !== 'attack' || tick < p.stagger || tick - p.since < c.bare_windup_t) continue;
    for (const [fid, f] of foes()) {
      if (f.health === 0 || ms < f.readyAt || safe(f.at) || !ahead(p.state.player.at, f.at, p.facing, 1)) continue;
      const def = bundle.map.creatures!.kinds[f.kind]!.fight!;
      let harm = c.bare_base;
      if (!same(direction(f.at, p.state.player.at), f.facing)) harm = mulDiv(harm, c.behind_permille, MILLI);
      if (f.phase === 'recovery' && f.move === def.weak?.after) harm = mulDiv(harm, c.weak_permille, MILLI);
      f.health = Math.max(0, f.health - harm);
      f.heed = id;
      events.push({ e: 'hit', player: id, by: 'player', harm, at: [...f.at] });
      if (f.health === 0) events.push({ e: 'foe_fall', foe: fid, at: [...f.at], drops: structuredClone(f.drops) });
      break;
    }
    p.phase = 'idle'; p.move = null;
  }
  for (const [fid, f] of foes()) {
    if (f.health === 0 || !f.heed || ms < f.readyAt || safe(f.at)) continue;
    const def = bundle.map.creatures!.kinds[f.kind]!.fight!;
    let target = w.players[f.heed];
    if (!f.engaged.includes(f.heed)) target = players().find(([id]) => f.engaged.includes(id))?.[1];
    if (!target) continue;
    const nextMove = patternMoves(def, f.pattern)[f.cursor % f.pattern.length]!;
    const standing = f.phase === 'recovery' || (f.phase === 'idle' && ahead(f.at, target.state.player.at, cardinal(f.at, target.state.player.at), nextMove.reach));
    if (tick >= due(f, 'hold') && standing) f.breath = Math.min(def.breath, f.breath + c.breath_refill);
    if (tick < f.stagger) continue;
    if (f.phase === 'idle') {
      f.facing = cardinal(f.at, target.state.player.at);
      const m = patternMoves(def, f.pattern)[f.cursor % f.pattern.length]!;
      if (!ahead(f.at, target.state.player.at, f.facing, m.reach)) {
        f.credit += bundle.params.wild.tick_ms;
        while (f.credit >= def.pace_ms) {
          const next = step(f.at, f.facing, target.state, true);
          if (distance(next, f.home) > c.leash_tiles) break;
          f.at = next; f.credit -= def.pace_ms;
        }
      } else if (tick >= due(f, m.id) && f.breath >= m.breath) {
        f.move = m.id; f.phase = 'windup'; f.since = tick; f.hit = [];
        f.cooldowns[m.id] = tick + m.cooldown_t;
        f.cursor += 1;
        spend(f, m.breath, 'foe', fid);
      }
    }
    const m = moveOf(f, def);
    if (!m || f.phase !== 'active') continue;
    for (const [id, p] of players()) {
      if (!f.engaged.includes(id) || f.hit.includes(id) || tick < due(p, 'mercy') || playerSafe(p)
        || !ahead(f.at, p.state.player.at, f.facing, m.reach)) continue;
      f.hit.push(id);
      if (p.guarding && same(p.guarding, direction(p.state.player.at, f.at))) {
        spend(p, c.guard_hit_breath, 'player', id);
        stagger(f, c.guard_stagger_t, 'foe', fid);
        break;
      }
      const harm = moveHarm(bundle.params, hpCap(bundle, p.state), m);
      events.push({ e: 'hit', player: id, by: 'foe', harm, at: [...p.state.player.at] });
      const result = fightHurt(bundle, p.state, harm, fid, ms);
      p.state = result.state;
      events.push(...result.events.map((event) => ({ ...event, player: id })));
      p.cooldowns.mercy = tick + c.mercy_t;
      stagger(p, c.stun_t, 'player', id);
      if (result.events.some((e) => e.e === 'fall')) {
        // fall already cleared the persistent marker; end still emits the live ending.
        p.state.player.fight = { foe: fid, since: tick };
        end(id, p);
      } else for (let n = 0; n < c.knockback_tiles; n++) p.state.player.at = step(p.state.player.at, direction(f.at, p.state.player.at), p.state, false);
    }
  }
  finish();
  return { world: w, events };
}
