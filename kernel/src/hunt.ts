/**
 * Early prey, carcass dressing and spoilage (HUNTING.md sections 5–6, G28, Q1).
 */
import type { Bundle, Params } from './bundle';
import { idiv } from './num';
import { hourOf, type Carcass, type HuntBatch, type HuntStock, type PublicState, type Snare } from './state';
import type { Flight } from './stones';
import { walkableFor, type Tile } from './step';
import { anchorId } from './wild/den';
import { wildKindOf, wildReach } from './wild/valley';
import { seatOf } from './wild/seat';
import { d2, lineClear } from './wild/senses';
import { tagAt } from './world';

/** Dressing steps by size (HUNTING section 6). */
export const DRESS_STEPS = { small: 6, medium: 12, large: 24 } as const;
export type CreatureSize = keyof typeof DRESS_STEPS;
/**
 * The steps come in parts of six, one `dress` action a part, so every action stays inside the action cap (G43): a small
 * animal is one part, a medium two, a large four, the bag slots HUNTING section 6 gives them.
 */
export const DRESS_PART_STEPS = 6;
export const DRESS_PARTS = { small: 1, medium: 2, large: 4 } as const;

/** The grades an animal appears with (HUNTING section 5): read as a pose on the screen, never a number. */
export const ANIMAL_GRADES = [1, 2, 3] as const;
export type AnimalGrade = (typeof ANIMAL_GRADES)[number];

export type HuntKind = NonNullable<Bundle['map']['creatures']>['kinds'][string];
export type HuntFields = NonNullable<HuntKind['hunt']>;
type CreatureSpot = NonNullable<Bundle['map']['creatures']>['spots'][number];
export const SNARE_ITEM = 'core/snare';
/** The original stone reach (#819), still the roam fallback of a snare. */
export const STONE_RANGE = 3;

/**
 * How far a stone thrown at full power can strike small game (#923): its range, its roll and the width of a hit. A tap or a
 * short charge strikes nearer; the charge the distance wants is the player's to feel (`flightHits`).
 */
export function huntReach(bundle: Bundle): number {
  const thrown = bundle.params.liftables[bundle.params.hunt.throw_item];
  return thrown ? thrown.throw_range + thrown.roll + bundle.params.hunt.hit_tiles : 0;
}

/**
 * Whether a flown stone strikes the animal standing at `target`: the tile where it first touches the ground, or the tile it
 * comes to rest on, lies within `hunt.hit_tiles` of it (the king's-move distance). A stone that sank strikes nothing.
 */
export function flightHits(bundle: Bundle, flight: Flight, target: Tile): boolean {
  if (flight.sank) return false;
  const width = bundle.params.hunt.hit_tiles;
  return [flight.touch, flight.rest].some((t) => t !== undefined && Math.max(Math.abs(t[0] - target[0]), Math.abs(t[1] - target[1])) <= width);
}

function smallPrey(bundle: Bundle, id: string): HuntKind | undefined {
  const kind = bundle.map.creatures?.kinds[id];
  if (kind?.hunt?.size === "small" && kind.hunt.danger === 0 && !kind.protected) return kind;
}

export function preyKey(spot: CreatureSpot): string {
  return anchorId(spot.kind, spot.x, spot.y);
}

/**
 * Spot indices are authoritative; the client supplies neither the species nor where it stands beyond the kind's reach. An animal
 * the wild step moved (`wildStep`) is named by its spot and the tile it stands on (`stands`), held to `wildReach` of its anchor:
 * the world of stepped animals is the caller's until a server holds it. With no tile the animal stands at its seat: the spot it
 * lives at now, which is its own unless it was taken and returned elsewhere (`preySeats`, `wild/seat.ts`). The spot returned is the
 * animal's own (its index is its name); its anchor is `seatOf`.
 */
export function stonePrey(bundle: Bundle, state: PublicState, tick: number, index: number, at: Tile, stands?: Tile): CreatureSpot | undefined {
  if (!Number.isSafeInteger(index) || index < 0) return undefined;
  const spot = bundle.map.creatures?.spots[index];
  const kind = spot && smallPrey(bundle, spot.kind);
  if (!spot || !kind || (state.player.preyReturns?.[preyKey(spot)] ?? 0) > tick) return undefined;
  const seat = seatOf(bundle, state, index) ?? spot;
  const target: Tile = stands ?? [seat.x, seat.y];
  if (stands) {
    if (!Array.isArray(stands) || stands.length !== 2 || !stands.every(Number.isSafeInteger)) return undefined;
    const wild = wildKindOf(bundle, spot.kind);
    const reach = wild ? wildReach(wild) : 0;
    if (d2(stands, [seat.x, seat.y]) > reach * reach) return undefined;
  }
  const thrown = bundle.params.liftables[bundle.params.hunt.throw_item];
  if (thrown?.class !== 'hand') return undefined;
  const reach = huntReach(bundle);
  if (d2(at, target) > reach * reach) return undefined;
  if (kind.hours) {
    const hour = hourOf(bundle, tick);
    const [from, to] = kind.hours;
    if (!(from < to ? hour >= from && hour < to : hour >= from || hour < to)) return undefined;
  }
  const walk = walkableFor(bundle);
  if (!walk(at[0], at[1], state.player) || !walk(target[0], target[1], state.player)) return undefined;
  if (!lineClear({ blocks: (x, y) => !walk(x, y, state.player) }, at, target)) return undefined;
  return spot;
}

export function snareGround(bundle: Bundle, state: PublicState, tile: Tile): boolean {
  const [x, y] = tile;
  return tagAt(bundle.map, x, y) === 'meadow' && walkableFor(bundle)(x, y, state.player);
}

export function snareAt(state: PublicState, tile: Tile): Snare | undefined {
  return state.player.snares?.find(({ at }) => at[0] === tile[0] && at[1] === tile[1]);
}

export function snareKind(bundle: Bundle, id: string): HuntKind | undefined {
  const kind = smallPrey(bundle, id);
  if (kind?.hunt?.ways?.includes('snare')) return kind;
}

/** A meadow snare catches small game whose existing hunt data names this method. */
export function snarePrey(bundle: Bundle, tile: Tile): string | undefined {
  let found: string | undefined;
  let nearest = Number.MAX_SAFE_INTEGER;
  for (const spot of bundle.map.creatures?.spots ?? []) {
    const kind = snareKind(bundle, spot.kind);
    if (!kind) continue;
    const range = kind.behaviour?.roam ?? STONE_RANGE;
    const distance = d2(tile, [spot.x, spot.y]);
    if (distance > range * range || distance >= nearest) continue;
    nearest = distance;
    found = spot.kind;
  }
  return found;
}

/** The session already freezes its tick offline. A simulated time skip is deducted here. */
export function awakeHuntTick(state: PublicState, tick = state.tick): number {
  return tick - (state.player.huntPausedMs ?? 0);
}

/** The hunt fields of a kind; none when the kind is ambient only or unknown. */
export function huntOf(bundle: Bundle, kind: string): HuntFields | undefined {
  return bundle.map.creatures?.kinds[kind]?.hunt;
}

/** Game milliseconds dressing an animal of this size takes before any speed rule: its steps times one step's time. */
export function dressMs(params: Params, size: CreatureSize): number {
  return DRESS_STEPS[size] * params.hunt.dress_step_ms;
}

/** The active time of one part of the dressing, one `dress` action, before any speed rule. */
export function dressPartMs(params: Params): number {
  return DRESS_PART_STEPS * params.hunt.dress_step_ms;
}

/**
 * The item that stands for `itemId` at `grade`: the item whose `grade` names it at that step, or the item itself when
 * there is none (a plain good, or a grade nobody drew).
 */
export function gradeItem(bundle: Bundle, itemId: string, grade: number): string {
  if (grade <= 1) return itemId;
  for (const it of Object.values(bundle.items)) {
    if (it.grade?.of === itemId && it.grade.step === grade) return it.id;
  }
  return itemId;
}

/** Whole days of awake, online game time since the carcass was laid. */
function daysLain(bundle: Bundle, carcass: Carcass, awakeTick: number): number {
  return idiv(Math.max(0, awakeTick - (carcass.awakeSince ?? carcass.since)), bundle.params.day_length_ms);
}

/**
 * How a carcass has aged: fresh (meat, hide and bone), bare (the meat is gone after `meat_spoil_d` game days, hide and bone
 * remain) or gone (`hide_spoil_d`). What the screen draws it by; the goods follow the same days (`carcassGoods`).
 */
export type CarcassStage = 'fresh' | 'bare' | 'gone';
export function carcassStage(bundle: Bundle, carcass: Carcass, awakeTick: number): CarcassStage {
  const days = daysLain(bundle, carcass, awakeTick);
  const { hide_spoil_d, meat_spoil_d } = bundle.params.hunt;
  return days >= hide_spoil_d ? 'gone' : days >= meat_spoil_d ? 'bare' : 'fresh';
}

/** Whether nothing is left of a carcass: it has lain `hide_spoil_d` game days or more. */
export function carcassGone(bundle: Bundle, carcass: Carcass, awakeTick: number): boolean {
  return daysLain(bundle, carcass, awakeTick) >= bundle.params.hunt.hide_spoil_d;
}

/**
 * What dressing a carcass gives now: each drop of its kind at the carcass's grade; the meat (a drop of kind "food")
 * only while the carcass is younger than `meat_spoil_d` days; nothing once it is gone.
 */
export function carcassGoods(bundle: Bundle, carcass: Carcass, awakeTick: number): { item: string; qty: number }[] {
  const hunt = huntOf(bundle, carcass.kind);
  if (!hunt || carcassGone(bundle, carcass, awakeTick)) return [];
  const meatGone = daysLain(bundle, carcass, awakeTick) >= bundle.params.hunt.meat_spoil_d;
  const out: { item: string; qty: number }[] = [];
  for (const d of hunt.drops) {
    if (meatGone && bundle.items[d.item]?.kind === 'food') continue;
    out.push({ item: gradeItem(bundle, d.item, carcass.grade), qty: d.qty });
  }
  return out;
}

/** The grade an animal appears with, from one draw in basis points (0 to 9999): the finest first, the rest plain. */
export function gradeOfDraw(bundle: Bundle, bp: number): AnimalGrade {
  const { grade2_bp, grade3_bp } = bundle.params.hunt;
  if (bp < grade3_bp) return 3;
  if (bp < grade3_bp + grade2_bp) return 2;
  return 1;
}

/**
 * Lay a taken animal on a tile. Only a kind with hunt fields can fall, never a protected one. Carcasses that have
 * spoiled away are dropped first, so the list never holds more than still lies in the world. Returns the new carcass.
 */
export function placeCarcass(
  bundle: Bundle,
  state: PublicState,
  kind: string,
  at: readonly [number, number],
  grade: AnimalGrade,
  tick: number,
): Carcass {
  const k = bundle.map.creatures?.kinds[kind];
  if (!k?.hunt || k.protected) throw new Error(`"${kind}" is not an animal that can be taken.`);
  const p = state.player;
  const awakeSince = awakeHuntTick(state, tick);
  const kept = (p.carcasses ?? []).filter((c) => !carcassGone(bundle, c, awakeSince));
  const id = (p.fallen ?? 0) + 1;
  const carcass: Carcass = { id, kind, at: [at[0], at[1]], grade, since: tick };
  if (awakeSince !== tick) carcass.awakeSince = awakeSince;
  p.fallen = id;
  p.carcasses = [...kept, carcass];
  return carcass;
}

/** Raw hunt goods begin their own clock at dressing. Cooked, cured and dry goods have no expiry here. */
export function huntGoodsExpiry(bundle: Bundle, itemId: string, awakeTick: number): number | undefined {
  const item = bundle.items[itemId];
  if (!item) return undefined;
  const { hunt, day_length_ms } = bundle.params;
  if (item.class === 'core/hide') return awakeTick + hunt.hide_spoil_d * day_length_ms;
  if (item.class === 'core/meat' && item.kind === 'food') return awakeTick + hunt.meat_spoil_d * day_length_ms;
}

/** Move the oldest units first. An item's batches stay ordered by expiry. */
export function takeHuntBatches(batches: HuntBatch[], qty: number): HuntBatch[] {
  const moved: HuntBatch[] = [];
  while (qty > 0 && batches.length > 0) {
    const first = batches[0]!;
    const n = Math.min(qty, first.qty);
    moved.push({ qty: n, until: first.until });
    first.qty -= n;
    qty -= n;
    if (first.qty === 0) batches.shift();
  }
  return moved;
}

export function recordHuntBatches(stock: HuntStock, item: string, incoming: HuntBatch[]): void {
  if (incoming.length === 0) return;
  const batches = (stock[item] ??= []);
  for (const batch of incoming) {
    const same = batches.find(({ until }) => until === batch.until);
    if (same) same.qty += batch.qty;
    else batches.push(batch);
  }
  batches.sort((a, b) => a.until - b.until);
}

/** Every good of the hunt, plain and graded (HUNTING section 9): no trader buys one raw, and no shop sells one. */
export function huntGoods(bundle: Bundle): Set<string> {
  const plain = new Set<string>();
  for (const k of Object.values(bundle.map.creatures?.kinds ?? {})) for (const d of k.hunt?.drops ?? []) plain.add(d.item);
  const all = new Set(plain);
  for (const it of Object.values(bundle.items)) if (it.grade && plain.has(it.grade.of)) all.add(it.id);
  return all;
}
