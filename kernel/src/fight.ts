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
  const w = { ...world };
  const playerIds = Object.keys(world.players);
  // Only these figures can act without a new input/engagement. Keep sorting their
  // current records at each phase: movement and focus changes can change the order.
  const acting = new Set<string>(), safetyIds = new Set<string>();
  const visiting: string[] = [];
  let bounds: [number, number, number, number] | undefined;
  for (const id of playerIds) {
    const p = world.players[id]!, s = p.state;
    if (s.player.fight || p.walking || p.move) acting.add(id);
    if (s.player.camp.length || s.player.own) safetyIds.add(id);
    if (Object.keys(s.player.expeditions).length) visiting.push(id);
    const [x, y] = s.player.at;
    if (!bounds) bounds = [x, y, x, y];
    else {
      bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
      bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
    }
  }
  function writePlayer(id: string): FightPlayer {
    const p = w.players[id]!;
    if (p !== world.players[id]) return p;
    if (w.players === world.players) w.players = { ...w.players };
    return w.players[id] = { ...p, cooldowns: { ...p.cooldowns } };
  }
  function writeState(id: string): State {
    const p = writePlayer(id);
    if (p.state === world.players[id]!.state) p.state = { ...p.state };
    return p.state;
  }
  function writePlayerState(id: string): State['player'] {
    const s = writeState(id);
    if (s.player === world.players[id]!.state.player) s.player = { ...s.player };
    return s.player;
  }
  function writeNodes(id: string): State['nodes'] {
    const s = writeState(id);
    if (s.nodes === world.players[id]!.state.nodes) s.nodes = { ...s.nodes };
    return s.nodes;
  }
  function writeCreature(id: string): FightCreature {
    const f = w.creatures[id]!;
    if (f !== world.creatures[id]) return f;
    if (w.creatures === world.creatures) w.creatures = { ...w.creatures };
    return w.creatures[id] = { ...f, cooldowns: { ...f.cooldowns }, engaged: [...f.engaged], away: { ...f.away }, hit: [...f.hit] };
  }
  const events: FightWorldEvent[] = [];
  const c = bundle.params.combat;
  const ms = tick * bundle.params.wild.tick_ms;
  let ground = geometry.get(bundle);
  if (!ground) {
    ground = { walkable: makeWalkable(bundle), stepOpen: makeStepRule(bundle) };
    geometry.set(bundle, ground);
  }
  const { walkable, stepOpen } = ground;
  const players = (ids: Iterable<string> = acting): [string, FightPlayer][] =>
    Array.from(ids, (id): [string, FightPlayer] => [id, w.players[id]!]).sort(([a, p], [b, q]) => {
      const f = p.state.player.fight?.foe;
      const g = q.state.player.fight?.foe;
      return (f && w.creatures[f] ? distance(p.state.player.at, w.creatures[f]!.at) : 0)
        - (g && w.creatures[g] ? distance(q.state.player.at, w.creatures[g]!.at) : 0) || textOrder(a, b);
    });
  const foes = (): [string, FightCreature][] => Object.entries(w.creatures).sort(([a, f], [b, g]) =>
    (f.heed && w.players[f.heed] ? distance(f.at, w.players[f.heed]!.state.player.at) : 0)
    - (g.heed && w.players[g.heed] ? distance(g.at, w.players[g.heed]!.state.player.at) : 0) || textOrder(a, b));
  // Only camps and personal fires can add safety beyond dangerAt's static ground.
  // A hurt/bell can replace State; rebuild these views then rather than caching
  // them across ticks or scanning/copying every account for every safety query.
  let safety: State[] | undefined;
  const safe = (at: Tile): boolean => {
    if (dangerAt(bundle, [at[0], at[1]]) === 0) return true;
    if (!safety) {
      safety = [];
      for (const id of safetyIds) {
        const s = w.players[id]!.state;
        safety.push({ ...s, player: { ...s.player, aboard: null } });
      }
    }
    return safety.some((s) => isSafe(bundle, s, [at[0], at[1]], ms));
  };
  function replaceState(id: string, state: State): void {
    writePlayer(id).state = state;
    if (state.player.camp.length || state.player.own) safetyIds.add(id); else safetyIds.delete(id);
    safety = undefined;
    bounds = undefined;
  }
  // Built after held movement, used only by engagement. Filtering candidates
  // before the usual sort preserves their relative distance/account ordering.
  let tiles: Map<string, string[]> | undefined;
  const cell = c.engage_tiles + 1;
  const tileKey = (x: number, y: number): string => `${x},${y}`;
  function nearbyPlayers(at: Tile): [string, FightPlayer][] {
    if (!playerIds.length) return [];
    if (!bounds) {
      const first = w.players[playerIds[0]!]!.state.player.at;
      bounds = [first[0], first[1], first[0], first[1]];
      for (const id of playerIds) {
        const [x, y] = w.players[id]!.state.player.at;
        bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
        bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
      }
    }
    const r = c.engage_tiles;
    if (at[0] + r < bounds[0] || at[1] + r < bounds[1] || at[0] - r > bounds[2] || at[1] - r > bounds[3]) return [];
    if (!tiles) {
      tiles = new Map();
      for (const id of playerIds) {
        const [x, y] = w.players[id]!.state.player.at;
        const key = tileKey(idiv(x, cell), idiv(y, cell));
        const ids = tiles.get(key);
        if (ids) ids.push(id); else tiles.set(key, [id]);
      }
    }
    const ids: string[] = [], x = idiv(at[0], cell), y = idiv(at[1], cell);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      for (const id of tiles.get(tileKey(x + dx, y + dy)) ?? []) {
        if (distance(at, w.players[id]!.state.player.at) <= r) ids.push(id);
      }
    }
    return players(ids);
  }
  const playerSafe = (p: FightPlayer): boolean => p.state.player.aboard != null || safe(p.state.player.at);
  const cap = (p: FightPlayer): number => c.breath_base + c.breath_per_stamina * attrAt(bundle, p.state, 'stamina');
  const shortened = (p: FightPlayer, duration: number): number =>
    Math.max(1, mulDiv(duration, Math.max(0, PERCENT - bundle.params.per_point.agility_pct * attrAt(bundle, p.state, 'agility')), PERCENT));
  function end(id: string): void {
    if (!w.players[id]!.state.player.fight) return;
    const p = writePlayer(id);
    writePlayerState(id).fight = null;
    p.guarding = null;
    p.walking = null;
    p.phase = 'idle';
    p.move = null;
    for (const [fid, original] of Object.entries(w.creatures)) {
      if (!original.engaged.includes(id) && !Object.hasOwn(original.away, id)) continue;
      const f = writeCreature(fid);
      f.engaged = f.engaged.filter((player) => player !== id);
      delete f.away[id];
    }
    events.push({ e: 'disengage', player: id });
  }
  function engage(id: string, fid: string): void {
    if (w.creatures[fid]!.engaged.includes(id)) return;
    const f = writeCreature(fid), p = writePlayer(id);
    f.engaged.push(id);
    acting.add(id);
    if (!p.state.player.fight) {
      writePlayerState(id).fight = { foe: fid, since: tick };
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
    let restingPlayers: string[] | undefined;
    for (const [fid, original] of foes()) {
      if (!original.engaged.length && original.heed === null) continue;
      const f = writeCreature(fid);
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
          // Resting-node writes change neither positions nor focus, so this order
          // is shared by all fallen foes in this finish pass.
          restingPlayers ??= players(playerIds).map(([id]) => id);
          for (const id of restingPlayers) {
            const draws = w.players[id]!.state.nodes[f.spot]?.draws ?? 0;
            writeNodes(id)[f.spot] = { readyAt: f.readyAt, draws };
          }
        }
      } else if (f.heed === null || !f.engaged.includes(f.heed)) f.heed = [...f.engaged].sort()[0] ?? null;
    }
    // Ending a pairing and switching focus cannot change a foe's target tile.
    // Rank once here; the next phase will rank again after any movement.
    const remaining = foes();
    for (const [id, p] of players()) {
      if (!p.state.player.fight) continue;
      const still = remaining.filter(([, f]) => f.engaged.includes(id));
      if (!still.length) end(id);
      else if (!still.some(([fid]) => fid === p.state.player.fight!.foe)) writePlayerState(id).fight = { ...p.state.player.fight!, foe: still[0]![0] };
    }
  }

  // G49's walk-out precedes every input, even when a caller missed the bell tick.
  for (const [id, p] of players(visiting)) {
    const bell = fightBell(bundle, p.state, ms);
    if (bell) {
      replaceState(id, bell.state);
      events.push(...bell.events.map((event) => ({ ...event, player: id })));
      end(id);
    }
  }
  finish();
  for (const [id, p] of players()) {
    if (p.move === 'dodge' && tick - p.since >= c.dodge_t) { const next = writePlayer(id); next.phase = 'idle'; next.move = null; }
  }
  for (const input of inputs) {
    const found = w.players[input.player];
    if (!found) continue;
    let p: FightPlayer = found;
    const refuse = (reason: string): void => { events.push({ e: 'fight_refused', player: input.player, verb: input.v, reason }); };
    if (!Number.isSafeInteger(input.tick) || input.tick < 0 || input.tick > tick) { refuse('Input has not arrived.'); continue; }
    if (input.v === 'tech') { refuse('Combat techniques are not implemented.'); continue; }
    if (input.dir !== null && !validDir(input.dir)) { refuse('Bad direction.'); continue; }
    if (tick < p.stagger) { refuse('Staggered.'); continue; }
    if (input.v === 'move') {
      p = writePlayer(input.player);
      acting.add(input.player);
      p.walking = input.dir;
      if (input.dir) p.facing = input.dir;
      else p.credit = 0;
      continue;
    }
    if (!p.state.player.fight) {
      const candidate = foes().find(([, f]) => f.health > 0 && ms >= f.readyAt && !safe(f.at) && !playerSafe(p)
        && distance(p.state.player.at, f.home) <= c.leash_tiles && ahead(p.state.player.at, f.at, input.dir ?? p.facing, 1));
      if (candidate && input.v === 'attack') { engage(input.player, candidate[0]); p = w.players[input.player]!; }
    }
    if (!p.state.player.fight) { refuse('Not engaged.'); continue; }
    if (input.v === 'guard') {
      if (input.dir && (p.phase !== 'idle' || p.breath === 0)) { refuse('Cannot guard now.'); continue; }
      p = writePlayer(input.player);
      p.cooldowns.hold = tick + c.breath_hold_t;
      p.guarding = input.dir;
      if (input.dir) p.facing = input.dir;
      continue;
    }
    if (p.phase !== 'idle') { refuse('Move in progress.'); continue; }
    const key = input.v === 'attack' ? 'hand' : 'dodge';
    const cost = input.v === 'attack' ? c.attack_breath : c.dodge_breath;
    if (tick < due(p, key) || p.breath < cost) { refuse('Cooldown or insufficient breath.'); continue; }
    p = writePlayer(input.player);
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

  for (const [id, original] of players()) {
    let p = original;
    if (tick < p.stagger) continue;
    if (p.walking && p.phase === 'idle') {
      p = writePlayer(id);
      p.credit += bundle.params.wild.tick_ms;
      const pace = walkStepMs(bundle, p.state);
      while (p.credit >= pace) {
        bounds = undefined;
        writePlayerState(id).at = step(p.state.player.at, p.walking!, p.state, false);
        p.credit -= pace;
        writePlayerState(id).movedAt = ms;
      }
    }
    if (p.move === 'dodge') {
      p = writePlayer(id);
      const steps = Math.min(c.dodge_tiles, idiv((tick - p.since + 1) * c.dodge_tiles, c.dodge_t));
      while (p.dodgeSteps < steps) {
        bounds = undefined;
        writePlayerState(id).at = step(p.state.player.at, p.facing, p.state, false);
        p.dodgeSteps += 1;
      }
      if (tick - p.since >= c.dodge_t) { p.phase = 'idle'; p.move = null; }
    }
    // Movement can reach safety before any attack on this tick.
    if (p.state.player.fight && playerSafe(p)) end(id);
  }
  for (const [fid, original] of foes()) {
    let f = original;
    if (ms >= f.readyAt && f.readyAt > 0) {
      f = writeCreature(fid);
      const def = bundle.map.creatures!.kinds[f.kind]!.fight!;
      f.health = def.hp; f.breath = def.breath; f.at = [...f.home]; f.cooldowns = {}; f.cursor = 0; f.stagger = 0; f.readyAt = 0; f.away = {};
    }
    if (f.health === 0 || ms < f.readyAt || safe(f.at)) continue;
    for (const [id, p] of nearbyPlayers(f.at)) {
      if (!playerSafe(p) && distance(f.at, p.state.player.at) <= c.engage_tiles && distance(f.at, f.home) <= c.leash_tiles && distance(p.state.player.at, f.home) <= c.leash_tiles) engage(id, fid);
    }
  }
  for (const [id, p] of players()) {
    if (!p.state.player.fight) continue;
    if (p.guarding) spend(writePlayer(id), c.guard_drain, 'player', id);
    else if (!p.walking && p.move !== 'dodge' && tick >= due(p, 'hold')) {
      const breath = Math.min(cap(p), p.breath + mulDiv(c.breath_refill, breathRefillPermille(bundle, p.state), MILLI));
      if (breath !== p.breath) writePlayer(id).breath = breath;
    }
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
  for (const [fid, f] of foes()) {
    const def = bundle.map.creatures!.kinds[f.kind]!.fight!;
    if (f.phase !== 'idle' && moveOf(f, def)) phase(writeCreature(fid), def);
  }
  for (const [id, p] of players()) {
    if (!p.state.player.fight || p.move !== 'attack' || tick < p.stagger || tick - p.since < c.bare_windup_t) continue;
    for (const [fid, f] of foes()) {
      if (f.health === 0 || ms < f.readyAt || safe(f.at) || !ahead(p.state.player.at, f.at, p.facing, 1)) continue;
      const def = bundle.map.creatures!.kinds[f.kind]!.fight!;
      let harm = c.bare_base;
      if (!same(direction(f.at, p.state.player.at), f.facing)) harm = mulDiv(harm, c.behind_permille, MILLI);
      if (f.phase === 'recovery' && f.move === def.weak?.after) harm = mulDiv(harm, c.weak_permille, MILLI);
      const next = writeCreature(fid);
      next.health = Math.max(0, f.health - harm);
      next.heed = id;
      events.push({ e: 'hit', player: id, by: 'player', harm, at: [...f.at] });
      if (next.health === 0) events.push({ e: 'foe_fall', foe: fid, at: [...f.at], drops: structuredClone(f.drops) });
      break;
    }
    const next = writePlayer(id);
    next.phase = 'idle'; next.move = null;
  }
  for (const [fid] of foes()) {
    // An earlier foe's hit can end this pairing and copy this creature.
    let f = w.creatures[fid]!;
    if (f.health === 0 || !f.heed || ms < f.readyAt || safe(f.at)) continue;
    const def = bundle.map.creatures!.kinds[f.kind]!.fight!;
    let target = w.players[f.heed];
    if (!f.engaged.includes(f.heed)) target = players().find(([id]) => f.engaged.includes(id))?.[1];
    if (!target) continue;
    const nextMove = patternMoves(def, f.pattern)[f.cursor % f.pattern.length]!;
    const standing = f.phase === 'recovery' || (f.phase === 'idle' && ahead(f.at, target.state.player.at, cardinal(f.at, target.state.player.at), nextMove.reach));
    if (tick >= due(f, 'hold') && standing) {
      const breath = Math.min(def.breath, f.breath + c.breath_refill);
      if (breath !== f.breath) { f = writeCreature(fid); f.breath = breath; }
    }
    if (tick < f.stagger) continue;
    if (f.phase === 'idle') {
      f = writeCreature(fid);
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
    for (const [id, original] of players()) {
      let p = original;
      if (!f.engaged.includes(id) || f.hit.includes(id) || tick < due(p, 'mercy') || playerSafe(p)
        || !ahead(f.at, p.state.player.at, f.facing, m.reach)) continue;
      f = writeCreature(fid);
      f.hit.push(id);
      p = writePlayer(id);
      if (p.guarding && same(p.guarding, direction(p.state.player.at, f.at))) {
        spend(p, c.guard_hit_breath, 'player', id);
        stagger(f, c.guard_stagger_t, 'foe', fid);
        break;
      }
      const harm = moveHarm(bundle.params, hpCap(bundle, p.state), m);
      events.push({ e: 'hit', player: id, by: 'foe', harm, at: [...p.state.player.at] });
      const result = fightHurt(bundle, p.state, harm, fid, ms);
      replaceState(id, result.state);
      events.push(...result.events.map((event) => ({ ...event, player: id })));
      p.cooldowns.mercy = tick + c.mercy_t;
      stagger(p, c.stun_t, 'player', id);
      if (result.events.some((e) => e.e === 'fall')) {
        // fall already cleared the persistent marker; end still emits the live ending.
        writePlayerState(id).fight = { foe: fid, since: tick };
        end(id);
      } else for (let n = 0; n < c.knockback_tiles; n++) writePlayerState(id).at = step(p.state.player.at, direction(f.at, p.state.player.at), p.state, false);
    }
  }
  finish();
  return { world: w, events };
}
