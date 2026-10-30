/**
 * Dressing a taken animal (docs/design/HUNTING.md sections 5-6; DECISIONS.md,
 * 2026-10-30: the hunt foundations). Nothing here takes an animal: a carcass
 * is laid by whatever ends a hunt or a fight once the combat rules land (G35),
 * and by tests until then. What is here is what a carcass holds, how it spoils
 * by the game day, which item stands for a good at a grade, the draw of a
 * grade when an animal appears, and the goods nobody buys raw.
 */
import type { Bundle, Params } from './bundle';
import { idiv } from './num';
import type { Carcass, PublicState } from './state';

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

/** Whole game days a carcass has lain. */
function daysLain(bundle: Bundle, carcass: Carcass, tick: number): number {
  return idiv(Math.max(0, tick - carcass.since), bundle.params.day_length_ms);
}

/** Whether nothing is left of a carcass: it has lain `hide_spoil_d` game days or more. */
export function carcassGone(bundle: Bundle, carcass: Carcass, tick: number): boolean {
  return daysLain(bundle, carcass, tick) >= bundle.params.hunt.hide_spoil_d;
}

/**
 * What dressing a carcass gives now: each drop of its kind at the carcass's grade; the meat (a drop of kind "food")
 * only while the carcass is younger than `meat_spoil_d` days; nothing once it is gone.
 */
export function carcassGoods(bundle: Bundle, carcass: Carcass, tick: number): { item: string; qty: number }[] {
  const hunt = huntOf(bundle, carcass.kind);
  if (!hunt || carcassGone(bundle, carcass, tick)) return [];
  const meatGone = daysLain(bundle, carcass, tick) >= bundle.params.hunt.meat_spoil_d;
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
  const kept = (p.carcasses ?? []).filter((c) => !carcassGone(bundle, c, tick));
  const id = (p.fallen ?? 0) + 1;
  const carcass: Carcass = { id, kind, at: [at[0], at[1]], grade, since: tick };
  p.fallen = id;
  p.carcasses = [...kept, carcass];
  return carcass;
}

/** Every good of the hunt, plain and graded (HUNTING section 9): no trader buys one raw, and no shop sells one. */
export function huntGoods(bundle: Bundle): Set<string> {
  const plain = new Set<string>();
  for (const k of Object.values(bundle.map.creatures?.kinds ?? {})) for (const d of k.hunt?.drops ?? []) plain.add(d.item);
  const all = new Set(plain);
  for (const it of Object.values(bundle.items)) if (it.grade && plain.has(it.grade.of)) all.add(it.id);
  return all;
}
