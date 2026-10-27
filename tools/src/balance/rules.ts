/**
 * The numbers the balance prover and the difficulty reckoning read, taken once
 * from the params file into plain whole numbers: the 9.10 scale and the
 * reckoning's knobs (`difficulty`), and the balance model of PROGRESSION 4.7
 * and BODY_CLOCKS 5-7 (`balance`). Both blocks are optional in the schema; a
 * params file without them gives undefined and the tools say so.
 */
import type { ParamsBody } from '@game/schema';

export const CATEGORIES = ['work', 'move', 'carry', 'health', 'sustain', 'find', 'sense', 'place'] as const;
export type Category = (typeof CATEGORIES)[number];

/** Rarity by rank: 0 common, 1 uncommon, 2 rare, 3 legendary (9.10). */
export const RARITY_NAMES = ['common', 'uncommon', 'rare', 'legendary'] as const;

export interface Rules {
  ratioPermille: number;
  hazardBp: number;
  grindPassesMax: number;
  questSharePct: number;
  questMinutesMax: number;
  questsMax: number;
  t1Ms: number;
  t1MinMs: number;
  t1MaxMs: number;
  steps: number;
  bandSize: number;
  bands: number;
  catalogueHoursMin: number;
  mentorBonusPct: number;
  groupShareMaxPermille: number;
  loopProfitMaxMg: number;
  ceilings: Record<Category, number[]>;
  raiseStep: Record<Category, number>;
  raisersMax: Record<Category, number>;
  wallMarginBp: number;
  wallCheeseGap: number;
  topBuildsN: number;
  topOverMedianMaxPermille: number;
  proofEnumMax: number;
  rarityEffectsMax: number[];
  rarityBandPermille: [number, number][];
  traitStrengthByTier: number[];
  masterStep: number;
  dishPlaceStep: number;
  dishSlots: number;
  gradeWalkPermille: number[];
  gradeDrainPct: number[];
  /** a game hour in real milliseconds: the day over 24 */
  gameHourMs: number;
  walkStepMs: number;
  /** the tier-1 cap of a worn effect: a common thing's smallest step (5.7) */
  wearStepPct: number;
}

const perCategory = (o: Record<string, number>): Record<Category, number> => ({
  work: o.work ?? 0,
  move: o.move ?? 0,
  carry: o.carry ?? 0,
  health: o.health ?? 0,
  sustain: o.sustain ?? 0,
  find: o.find ?? 0,
  sense: o.sense ?? 0,
  place: o.place ?? 0,
});

/** The rules, or undefined when the params file has no difficulty or no balance block. */
export function readRules(p: ParamsBody): Rules | undefined {
  const d = p.difficulty;
  const b = p.balance;
  if (!d || !b) return undefined;
  const c = b.ceilings;
  return {
    ratioPermille: d.ratio_permille.value,
    hazardBp: d.hazard_bp.value,
    grindPassesMax: d.grind_passes_max.value,
    questSharePct: d.quest_share_pct.value,
    questMinutesMax: d.quest_minutes_max.value,
    questsMax: d.quests_max.value,
    t1Ms: b.t1_ms.value,
    t1MinMs: b.t1_ms.min,
    t1MaxMs: b.t1_ms.max,
    steps: b.school_steps.value,
    bandSize: b.band_size.value,
    bands: c.work.length,
    catalogueHoursMin: b.catalogue_hours_min.value,
    mentorBonusPct: b.mentor_bonus_pct.value,
    groupShareMaxPermille: b.group_share_max_permille.value,
    loopProfitMaxMg: b.loop_profit_max_mg.value,
    ceilings: { work: [...c.work], move: [...c.move], carry: [...c.carry], health: [...c.health], sustain: [...c.sustain], find: [...c.find], sense: [...c.sense], place: [...c.place] },
    raiseStep: perCategory(b.raise_step),
    raisersMax: perCategory(b.raisers_max),
    wallMarginBp: b.wall_margin_bp.value,
    wallCheeseGap: b.wall_cheese_gap.value,
    topBuildsN: b.top_builds_n.value,
    topOverMedianMaxPermille: b.top_over_median_max_permille.value,
    proofEnumMax: b.proof_enum_max.value,
    rarityEffectsMax: [...b.rarity_effects_max],
    rarityBandPermille: b.rarity_band_permille.map((x) => [x[0] ?? 0, x[1] ?? 0] as [number, number]),
    traitStrengthByTier: [...b.trait_strength_by_tier],
    masterStep: b.master_step.value,
    dishPlaceStep: b.dish_place_step.value,
    dishSlots: b.dish_slots.value,
    gradeWalkPermille: [...b.grade_walk_permille],
    gradeDrainPct: [...b.grade_drain_pct],
    gameHourMs: Math.trunc(p.day_length_ms.value / 24),
    walkStepMs: p.walk_step_ms.value,
    wearStepPct: p.wear_effect_max_pct[0] ?? 0,
  };
}

/** The band of a level, 1 to the last band: five levels a band (PROGRESSION 3.3). */
export function bandOf(rules: Rules, level: number): number {
  return Math.min(rules.bands, Math.max(1, Math.trunc((level + rules.bandSize - 1) / rules.bandSize)));
}

/** A category's ceiling for a wearer of this band, with the raisers held (only the top band has any). */
export function ceilingOf(rules: Rules, cat: Category, band: number, raisers = 0): number {
  const b = Math.min(rules.bands, Math.max(1, band));
  const base = rules.ceilings[cat][b - 1] ?? 0;
  if (b < rules.bands) return base;
  return base + Math.min(raisers, rules.raisersMax[cat]) * rules.raiseStep[cat];
}
