/**
 * Loose stones (DECISIONS.md, 2026-11-22; kernel 0.35.0): small and large stones lying at the map's spots that a
 * player lifts, carries, throws to a landing that runs on, sets down and piles. Pure and integer-only, like the rest
 * of the kernel; `step.ts` holds the actions, this holds what they and the client both read, so the aim line, the
 * counts and the returns cannot disagree.
 *
 * The world is the player's own, as the dropped things and the taken prey are (`player.ground`, `preyReturns`): the
 * map's `stones.spots` say where a stone lies, and `player.stones` says which spots this player emptied, which large
 * stones lie away from a spot and which thrown stones are on their way home.
 *
 * Strength: the existing attribute `might`. A large stone weighs `stones.large_weight` in the load (`loadWeight`), so
 * who can lift one is the might limit's hard edge (`loadMax`: 30 + 10 a point, one and a half times over) and how
 * fast they walk with it is the load band: no second slowdown and no second strength rule.
 *
 * A stone never changes the walk map: a stone or a pile is not a prop, nothing here is read by `makeWalkable`.
 */
import type { Bundle } from './bundle';
import { idiv } from './num';
import { groundKey, type PublicState, type StoneSize, type StoneState } from './state';
import { walkableFor, type Tile } from './step';
import { levelAt, tagAt } from './world';

/** The one small stone: the item the bag holds and the thrown stone of small game (#819; a test keeps it equal to `THROW_STONE`, which this file cannot import without a cycle). A large stone is no item. */
export const STONE_ITEM = 'core/stone';

export const STONE_SIZES: readonly StoneSize[] = ['small', 'large'];

/** The spots the map lays stones at, in the map's order (a spot's index is its identity). */
export function stoneSpots(bundle: Bundle): readonly { x: number; y: number; size: StoneSize }[] {
  return bundle.map.stones?.spots ?? [];
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

/** The index of the spot at a tile still holding its stone for this player, if any, with its size. */
export function standingAt(bundle: Bundle, state: PublicState, tile: readonly [number, number]): { index: number; size: StoneSize } | undefined {
  const taken = state.player.stones?.taken;
  const spots = stoneSpots(bundle);
  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i]!;
    if (spot.x === tile[0] && spot.y === tile[1] && !taken?.[String(i)]) return { index: i, size: spot.size };
  }
  return undefined;
}

/** What lies on a tile: the stones set down or thrown there, and the stone still lying at its own spot. */
export interface Lying {
  small: number;
  large: number;
  spot?: StoneSize;
  /** all of it: what a pile is counted by */
  count: number;
}

export function lyingAt(bundle: Bundle, state: PublicState, tile: readonly [number, number]): Lying {
  const key = groundKey(tile as [number, number]);
  const small = state.player.ground?.[key]?.[STONE_ITEM] ?? 0;
  const large = state.player.stones?.large[key] ?? 0;
  const spot = standingAt(bundle, state, tile);
  return { small, large, spot: spot?.size, count: small + large + (spot ? 1 : 0) };
}

/** How many stones lie loose in an area: those at their spots, those set down and those thrown. */
export function looseInArea(bundle: Bundle, state: PublicState, area: string): number {
  let n = 0;
  const spots = stoneSpots(bundle);
  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i]!;
    if (!state.player.stones?.taken[String(i)] && areaKey(bundle, spot.x, spot.y) === area) n++;
  }
  for (const [key, pile] of Object.entries(state.player.ground ?? {})) {
    const qty = pile[STONE_ITEM] ?? 0;
    if (qty > 0) {
      const [x, y] = keyTile(key);
      if (areaKey(bundle, x, y) === area) n += qty;
    }
  }
  for (const [key, qty] of Object.entries(state.player.stones?.large ?? {})) {
    const [x, y] = keyTile(key);
    if (qty > 0 && areaKey(bundle, x, y) === area) n += qty;
  }
  return n;
}

/** Why `n` more stones may not lie on `tile`, or undefined when they may: the pile's height and the area's cap. Checked on adding only, so a state already over either still loads. */
export function whyNoRoom(bundle: Bundle, state: PublicState, tile: readonly [number, number], n = 1): string | undefined {
  const { pile_max, area_cap } = bundle.params.stones;
  if (lyingAt(bundle, state, tile).count + n > pile_max) return 'The stones are piled as high as they stay.';
  if (looseInArea(bundle, state, areaKey(bundle, tile[0], tile[1])) + n > area_cap) return 'Enough stones lie around here already.';
  return undefined;
}

/** The first spot this player emptied of that size: where a stone coming home goes. */
function homeOf(bundle: Bundle, stones: StoneState, size: StoneSize): string | undefined {
  const spots = stoneSpots(bundle);
  let best = -1;
  for (const k of Object.keys(stones.taken)) {
    const i = Number(k);
    if (spots[i]?.size === size && (best < 0 || i < best)) best = i;
  }
  return best < 0 ? undefined : String(best);
}

/**
 * Send home every thrown stone whose time is up: it leaves the tile it lies on (when it is still there) and its spot
 * is full again. A stone with no emptied spot of its size to go to (one mined at a node, say) just leaves the world.
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
    if (r.key !== '') {
      if (r.size === 'small') {
        const pile = player.ground?.[r.key];
        if (pile && (pile[STONE_ITEM] ?? 0) > 0) {
          if (pile[STONE_ITEM] === 1) delete pile[STONE_ITEM];
          else pile[STONE_ITEM] = (pile[STONE_ITEM] ?? 0) - 1;
          if (Object.keys(pile).length === 0) delete player.ground![r.key];
        } else continue;
      } else {
        const n = stones.large[r.key] ?? 0;
        if (n < 1) continue;
        if (n === 1) delete stones.large[r.key];
        else stones.large[r.key] = n - 1;
      }
    }
    const home = homeOf(bundle, stones, r.size);
    if (home !== undefined) delete stones.taken[home];
  }
  stones.returns = kept;
}

/** A thrown stone that is lifted again no longer goes home on its own: takes up to `n` of the oldest loans at that tile off the list. */
export function unloan(player: PublicState['player'], key: string, size: StoneSize, n: number): void {
  const stones = player.stones;
  if (!stones || n < 1) return;
  let left = n;
  stones.returns = stones.returns.filter((r) => {
    if (left > 0 && r.key === key && r.size === size) {
      left--;
      return false;
    }
    return true;
  });
}

/** Put a stone on loan: it lies at `key` ('' where it sank) and goes home `stones.return_ms` after `tick`. */
export function lendStone(bundle: Bundle, player: PublicState['player'], key: string, size: StoneSize, tick: number): void {
  // a stone that sank, or fell with its body, with no emptied spot of its size to go home to (one mined at a node) just leaves the world:
  // nothing is written, so a player who never touched a spot keeps a state with no `stones` at all
  if (key === '' && (!player.stones || homeOf(bundle, player.stones, size) === undefined)) return;
  const stones = (player.stones ??= { taken: {}, large: {}, returns: [] });
  stones.returns.push({ key, size, at: tick + bundle.params.stones.return_ms });
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

/** The most a throw's power may be (a thousandth part each): a full throw. The charged throw (a later track) lowers it. */
export const FULL_POWER = 1000;

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
 * Where a thrown stone goes, the one rule the throw action and the client's aim line share. The stone flies from the
 * thrower's tile along the line toward `aim` for the size's range (`stones.small_range` or `large_range`, times the
 * power over a thousand), stops short of anything in the way, touches down, and then runs on along the same line for
 * the size's roll (`small_roll`, `large_roll`) while the ground is open and does not climb. Water takes it: a stone
 * coming down on water sinks. The line, the range and the roll are content; nothing here is drawn.
 */
export function throwFlight(bundle: Bundle, state: PublicState, size: StoneSize, aim: Tile, power: number = FULL_POWER): Flight | { error: string } {
  const p = state.player;
  const from: Tile = [p.at[0], p.at[1]];
  const dx = aim[0] - from[0];
  const dy = aim[1] - from[1];
  const m = Math.max(Math.abs(dx), Math.abs(dy));
  if (m === 0) return { error: 'Aim away from your own feet.' };
  const c = bundle.params.stones;
  const range = idiv((size === 'small' ? c.small_range : c.large_range) * power, FULL_POWER);
  const roll = idiv((size === 'small' ? c.small_roll : c.large_roll) * power, FULL_POWER);
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
