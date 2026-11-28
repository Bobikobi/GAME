/**
 * Where a taken animal returns (the owner, 28.11.2026, public #930: "not from the same place"; HUNTING section 8).
 *
 * An animal of `map.creatures.spots` is named by its spot's index, as a take names it, and that index never changes. The
 * spot it LIVES at, its seat, does: when it is taken, the world's secret key draws the seat it will come back to, another
 * spot of its kind, and `player.preySeats` keeps it (identity key to seat key, both `anchorId`). A save with no entry reads
 * every animal at its own spot, which is what every save before kernel 0.42 holds. The return time is untouched (`refill_d`).
 *
 * The draw: among the kind's spots other than the seat the animal was taken from, the ones the fewest animals live at (the
 * taken one counted out), then one of those by a keyed draw. So a spot a hare left is filled again before any spot holds
 * three, and a kind with one spot keeps it. Integers only (rule R2), keyed by the animal and the number of the carcass it
 * left (rule R4), so it is the same wherever the step is run.
 */
import type { Bundle } from '../bundle';
import { idiv } from '../num';
import { drawBasisPoints, type Seed } from '../rng';
import type { PublicState } from '../state';
import { anchorId } from './den';

type Spot = NonNullable<Bundle['map']['creatures']>['spots'][number];

const keys = new WeakMap<Bundle, Map<string, number>>();

/** The spot index of an anchor key (`kind@x,y`), or none. */
function indexOfKey(bundle: Bundle, key: string): number | undefined {
  let cache = keys.get(bundle);
  if (!cache) {
    cache = new Map();
    for (const [i, s] of (bundle.map.creatures?.spots ?? []).entries()) cache.set(anchorId(s.kind, s.x, s.y), i);
    keys.set(bundle, cache);
  }
  return cache.get(key);
}

/** The index of the spot animal `index` lives at: its own unless a seat is recorded and is a spot of the same kind. */
export function seatIndex(bundle: Bundle, state: PublicState, index: number): number {
  const spots = bundle.map.creatures?.spots ?? [];
  const home = spots[index];
  if (!home) return index;
  const seat = state.player.preySeats?.[anchorId(home.kind, home.x, home.y)];
  if (seat === undefined) return index;
  const at = indexOfKey(bundle, seat);
  return at !== undefined && spots[at]!.kind === home.kind ? at : index;
}

/** The spot animal `index` lives at; none for an index that is no spot. */
export function seatOf(bundle: Bundle, state: PublicState, index: number): Spot | undefined {
  return bundle.map.creatures?.spots[seatIndex(bundle, state, index)];
}

/**
 * Draws the seat animal `index` returns to and records it: not the seat it stands at, the least occupied of the kind's
 * others, ties by the keyed draw of `salt` (the number of the carcass it left). A kind with no other spot keeps its seat.
 * Returns the seat's spot index.
 */
export function drawSeat(bundle: Bundle, state: PublicState, seed: Seed, index: number, salt: number): number {
  const spots = bundle.map.creatures?.spots ?? [];
  const home = spots[index];
  if (!home) return index;
  const from = seatIndex(bundle, state, index);
  const lives = new Map<number, number>();
  const kin: number[] = [];
  spots.forEach((s, i) => { if (s.kind === home.kind) kin.push(i); });
  for (const j of kin) {
    if (j === index) continue;
    const at = seatIndex(bundle, state, j);
    lives.set(at, (lives.get(at) ?? 0) + 1);
  }
  const others = kin.filter((i) => i !== from);
  if (others.length === 0) return from;
  const fewest = Math.min(...others.map((i) => lives.get(i) ?? 0));
  const pool = others.filter((i) => (lives.get(i) ?? 0) === fewest);
  const pick = pool[idiv(drawBasisPoints(seed, `preyseat:${anchorId(home.kind, home.x, home.y)}`, salt) * pool.length, 10_000)]!;
  const seats = (state.player.preySeats ??= {});
  const homeKey = anchorId(home.kind, home.x, home.y);
  if (pick === index) delete seats[homeKey];
  else {
    const s = spots[pick]!;
    seats[homeKey] = anchorId(s.kind, s.x, s.y);
  }
  if (Object.keys(seats).length === 0) delete state.player.preySeats;
  return pick;
}
