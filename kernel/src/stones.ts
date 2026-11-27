/**
 * Loose objects at map spots or moved by a player (DECISIONS.md, 2026-11-22 and 26). These readers and
 * integer flight rules are shared by actions and clients. The objects do not change the walk map.
 */
import type { Bundle } from './bundle';
import { idiv, mulDiv } from './num';
import { groundKey, type PublicState, type StoneState } from './state';
import { walkableFor, type Tile } from './step';
import { levelAt, tagAt } from './world';

/** Spots are kept in map order: a spot's index is its identity. */
export function stoneSpots(bundle: Bundle): NonNullable<Bundle['map']['stones']>['spots'] {
  return bundle.map.stones?.spots ?? [];
}

export function stoneBook(player: PublicState['player']): StoneState {
  return (player.stones ??= { taken: {}, placed: {}, returns: [] });
}

/** The entry occupying both hands. */
export function carriedKind(bundle: Bundle, state: PublicState): string | undefined {
  const kind = state.player.stones?.carry;
  return kind !== undefined && bundle.params.liftables[kind]?.class === 'arms' ? kind : undefined;
}

/** A carried object has priority; with free hands, choose an available bag item in id order. */
export function throwKind(bundle: Bundle, state: PublicState, requested?: string): string | undefined {
  const carry = carriedKind(bundle, state);
  if (carry !== undefined) return requested === undefined || requested === carry ? carry : undefined;
  const canThrow = (kind: string) => bundle.params.liftables[kind]?.class === 'hand' && (state.player.bag[kind] ?? 0) > 0;
  return requested === undefined ? Object.keys(state.player.bag).sort().find(canThrow) : canThrow(requested) ? requested : undefined;
}

/** The square of the map's grid a tile is in: the unit of the per-area cap. */
export function areaKey(bundle: Bundle, x: number, y: number): string {
  const side = bundle.params.stones.area_tiles;
  return `${idiv(x, side)},${idiv(y, side)}`;
}

/** The tile of a `groundKey`. */
export function keyTile(key: string): Tile {
  const [x, y] = key.split(',').map(Number) as [number, number];
  return [x, y];
}

/** The spot still holding its object for this player, if any. */
export function standingAt(bundle: Bundle, state: PublicState, tile: readonly [number, number]): { index: number; kind: string } | undefined {
  const spots = stoneSpots(bundle);
  const index = spots.findIndex((spot, i) => spot.x === tile[0] && spot.y === tile[1] && !state.player.stones?.taken[i]);
  return index < 0 ? undefined : { index, kind: spots[index]!.kind };
}

/** World objects set down or thrown, plus the object still at its spot. */
export interface Lying {
  placed: Record<string, number>;
  spot?: string;
  count: number;
}

export function lyingAt(bundle: Bundle, state: PublicState, tile: readonly [number, number]): Lying {
  const key = groundKey(tile);
  const placed = { ...state.player.stones?.placed[key] };
  for (const [id, count] of Object.entries(state.player.ground?.[key] ?? {})) {
    if (bundle.params.liftables[id]?.class === 'hand') placed[id] = count;
  }
  const spot = standingAt(bundle, state, tile)?.kind;
  const count = Object.values(placed).reduce((sum, qty) => sum + qty, spot === undefined ? 0 : 1);
  return { placed, spot, count };
}

export function looseInArea(bundle: Bundle, state: PublicState, area: string): number {
  let n = 0;
  for (const [i, spot] of stoneSpots(bundle).entries()) {
    if (!state.player.stones?.taken[i] && areaKey(bundle, spot.x, spot.y) === area) n++;
  }
  const inArea = (key: string) => {
    const [x, y] = keyTile(key);
    return areaKey(bundle, x, y) === area;
  };
  for (const [key, pile] of Object.entries(state.player.ground ?? {})) {
    if (!inArea(key)) continue;
    for (const [id, qty] of Object.entries(pile)) if (bundle.params.liftables[id]?.class === 'hand') n += qty;
  }
  for (const [key, pile] of Object.entries(state.player.stones?.placed ?? {})) {
    if (inArea(key)) for (const qty of Object.values(pile)) n += qty;
  }
  return n;
}

/** Put an object down in the same storage that lift and return read. */
export function placeLoose(bundle: Bundle, player: PublicState['player'], key: string, kind: string): void {
  const piles = bundle.params.liftables[kind]?.class === 'hand' ? (player.ground ??= {}) : stoneBook(player).placed;
  const pile = (piles[key] ??= {});
  pile[kind] = (pile[kind] ?? 0) + 1;
}

/** Remove one loose object if it is still here. */
export function removeLoose(bundle: Bundle, player: PublicState['player'], key: string, kind: string): boolean {
  const piles = bundle.params.liftables[kind]?.class === 'hand' ? player.ground : player.stones?.placed;
  const pile = piles?.[key];
  const count = pile?.[kind] ?? 0;
  if (!piles || !pile || count < 1) return false;
  if (count === 1) delete pile[kind];
  else pile[kind] = count - 1;
  if (Object.keys(pile).length === 0) delete piles[key];
  return true;
}

/** Why `n` more stones may not lie on `tile`, or undefined when they may: the pile's height and the area's cap. Checked on adding only, so a state already over either still loads. */
export function whyNoRoom(bundle: Bundle, state: PublicState, tile: readonly [number, number], n = 1, from?: Tile): string | undefined {
  const { pile_max, area_cap } = bundle.params.stones;
  if (lyingAt(bundle, state, tile).count + n > pile_max) return 'The stones are piled as high as they stay.';
  const area = areaKey(bundle, tile[0], tile[1]);
  if ((!from || areaKey(bundle, from[0], from[1]) !== area) && looseInArea(bundle, state, area) + n > area_cap) return 'Enough stones lie around here already.';
  return undefined;
}

/** The first spot this player emptied of that kind: where a stone coming home goes. */
function homeOf(bundle: Bundle, stones: StoneState, kind: string): string | undefined {
  const spots = stoneSpots(bundle);
  let best = -1;
  for (const k of Object.keys(stones.taken)) {
    const i = Number(k);
    if (spots[i]?.kind === kind && (best < 0 || i < best)) best = i;
  }
  return best < 0 ? undefined : String(best);
}

/**
 * Send home every thrown stone whose time is up: it leaves the tile it lies on (when it is still there) and its spot
 * is full again. A stone with no emptied spot of its kind to go to (one mined at a node, say) just leaves the world.
 * Mutates `player`; `step` runs it on its own copy at the start of every step, and `settled` runs it for the client.
 */
export function settleStones(bundle: Bundle, player: PublicState['player'], tick: number): void {
  const stones = player.stones;
  if (!stones || stones.returns.length === 0 || stones.returns[0]!.at > tick) return;
  const kept: StoneState['returns'] = [];
  for (const r of stones.returns) {
    if (r.at > tick) {
      kept.push(r);
      continue;
    }
    if (r.key !== '' && !removeLoose(bundle, player, r.key, r.kind)) continue;
    const home = homeOf(bundle, stones, r.kind);
    if (home !== undefined) delete stones.taken[home];
  }
  stones.returns = kept;
}

/** A thrown stone that is lifted again no longer goes home on its own: takes up to `n` of the oldest loans at that tile off the list. */
export function unloan(player: PublicState['player'], key: string, kind: string, n: number): void {
  const stones = player.stones;
  if (!stones || n < 1) return;
  let left = n;
  stones.returns = stones.returns.filter((r) => {
    if (left > 0 && r.key === key && r.kind === kind) {
      left--;
      return false;
    }
    return true;
  });
}

/** Put a stone on loan: it lies at `key` ('' where it sank) and goes home `stones.return_ms` after `tick`. */
export function lendStone(bundle: Bundle, player: PublicState['player'], key: string, kind: string, tick: number): void {
  // a stone that sank, or fell with its body, with no emptied spot of its kind to go home to (one mined at a node) just leaves the world:
  // nothing is written, so a player who never touched a spot keeps a state with no `stones` at all
  if (key === '' && (!player.stones || homeOf(bundle, player.stones, kind) === undefined)) return;
  const stones = stoneBook(player);
  stones.returns.push({ key, kind, at: tick + bundle.params.stones.return_ms });
  stones.returns.sort((a, b) => a.at - b.at);
}

/** The state as it stands at `tick`: the same object when no thrown stone is due home, else a copy with those stones back at their spots. What a client draws each frame. */
export function settled<T extends PublicState>(bundle: Bundle, state: T, tick: number): T {
  const stones = state.player.stones;
  if (!stones || stones.returns.length === 0 || stones.returns[0]!.at > tick) return state;
  const copy = structuredClone(state);
  settleStones(bundle, copy.player, tick);
  return copy;
}

/** The tick the next thrown stone goes home, or undefined with none on its way. */
export function nextStoneReturn(state: PublicState): number | undefined {
  return state.player.stones?.returns[0]?.at;
}

// ------------------------------------------------------------------ the throw

/** The most a throw's power may be (a thousandth part each): a full throw. */
export const FULL_POWER = 1000;

/**
 * The power a held press charges to (DECISIONS.md, 2026-11-22, the charged throw): `stones.throw_min_power` the moment
 * it is held (a tap throws at this), rising evenly to `FULL_POWER` over `stones.throw_charge_ms`, and full from then on.
 * The one curve the throw action's lower bound and the client's charge share, so the aim line and the throw cannot disagree.
 * `heldMs` is whole game milliseconds.
 */
export function chargePower(bundle: Bundle, heldMs: number): number {
  const { throw_min_power, throw_charge_ms } = bundle.params.stones;
  if (heldMs <= 0) return throw_min_power;
  if (heldMs >= throw_charge_ms) return FULL_POWER;
  return throw_min_power + mulDiv(FULL_POWER - throw_min_power, heldMs, throw_charge_ms);
}

/** The whole game milliseconds a press may be held: the charge to full plus the hold past full, after which the throw leaves on its own at full power. */
export function throwHoldLimit(bundle: Bundle): number {
  return bundle.params.stones.throw_charge_ms + bundle.params.stones.throw_hold_ms;
}

export interface Flight {
  /** the tile the throw left from */
  from: Tile;
  /** where the stone first touches the ground (or the water it sinks in) */
  touch: Tile;
  /** where it comes to rest after its roll; undefined when it sank */
  rest?: Tile;
  /** the tiles the stone passes over, from the tile after `from` to the touch tile */
  air: Tile[];
  /** the tiles it runs on along the ground from the touch to the rest */
  roll: Tile[];
  /** the flight stopped short at something in the way */
  blocked: boolean;
  sank: boolean;
}

/** The tiles of the integer line from `a` to `b`, `a` left out. */
export function lineTiles(a: Tile, b: Tile): Tile[] {
  const out: Tile[] = [];
  const dx = Math.abs(b[0] - a[0]);
  const dy = -Math.abs(b[1] - a[1]);
  const sx = a[0] < b[0] ? 1 : -1;
  const sy = a[1] < b[1] ? 1 : -1;
  let err = dx + dy;
  let x = a[0];
  let y = a[1];
  while (x !== b[0] || y !== b[1]) {
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
    out.push([x, y]);
  }
  return out;
}

/** a * n / m rounded half away from zero, for a whole a and positive n and m: the line's far end, in integers. */
function scaled(a: number, n: number, m: number): number {
  const q = idiv(2 * Math.abs(a) * n + m, 2 * m);
  return a < 0 ? -q : q;
}

/** Whether a stone in the air meets something at a tile: the map's edge, a wall, a tree, a person. Water does not stop it (it sinks in it). */
function stopsFlight(bundle: Bundle, state: PublicState, tile: Tile): boolean {
  const m = bundle.map;
  if (tile[0] < 0 || tile[1] < 0 || tile[0] >= m.width || tile[1] >= m.height) return true;
  return !walkableFor(bundle)(tile[0], tile[1], state.player) && tagAt(m, tile[0], tile[1]) !== 'water';
}

/**
 * Where a thrown object goes. Its entry gives the range and roll at full power. The flight stops short of
 * obstacles; after touching down it can roll on open ground that does not climb. Water takes it.
 */
export function throwFlight(bundle: Bundle, state: PublicState, kind: string, aim: Tile, power: number = FULL_POWER): Flight | { error: string } {
  const entry = bundle.params.liftables[kind];
  if (entry?.class !== 'hand' && entry?.class !== 'arms') return { error: 'That cannot be thrown.' };
  const p = state.player;
  const from: Tile = [p.at[0], p.at[1]];
  const dx = aim[0] - from[0];
  const dy = aim[1] - from[1];
  const m = Math.max(Math.abs(dx), Math.abs(dy));
  if (m === 0) return { error: 'Aim away from your own feet.' };
  const range = idiv(entry.throw_range * power, FULL_POWER);
  const roll = idiv(entry.roll * power, FULL_POWER);
  const n = Math.max(1, range + roll);
  const far: Tile = [from[0] + scaled(dx, n, m), from[1] + scaled(dy, n, m)];
  const line = lineTiles(from, far);
  // the air: the line tiles within the range, by the straight-line distance
  let reach = 0;
  while (reach < line.length && (line[reach]![0] - from[0]) ** 2 + (line[reach]![1] - from[1]) ** 2 <= range * range) reach++;
  const air: Tile[] = [];
  let blocked = false;
  for (let i = 0; i < reach; i++) {
    if (stopsFlight(bundle, state, line[i]!)) {
      blocked = true;
      break;
    }
    air.push(line[i]!);
  }
  const touch: Tile = air.length > 0 ? air[air.length - 1]! : from;
  const touchOnWater = air.length > 0 && tagAt(bundle.map, touch[0], touch[1]) === 'water';
  if (touchOnWater) return { from, touch, air, roll: [], blocked, sank: true };
  // a stone that struck something drops where it was; one that reached its range runs on
  const rolled: Tile[] = [];
  if (!blocked && air.length === reach) {
    const walk = walkableFor(bundle);
    let at = touch;
    for (let i = reach; i < Math.min(line.length, reach + roll); i++) {
      const next = line[i]!;
      if (!walk(next[0], next[1], p) || levelAt(bundle.map, next[0], next[1]) > levelAt(bundle.map, at[0], at[1])) break;
      rolled.push(next);
      at = next;
    }
  }
  const rest = rolled.length > 0 ? rolled[rolled.length - 1]! : touch;
  return { from, touch, rest, air, roll: rolled, blocked, sank: false };
}
