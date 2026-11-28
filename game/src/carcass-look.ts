/**
 * The carcass on its tile (public #930): what the screen draws of an animal a stone took, from the saved carcass alone.
 * Pure, so it is tested without a scene (scenes/carcasses.ts draws it).
 *
 * STAND-IN. Until the carcass has its own drawn clips (whole, half, bones: the art list of public #930), the carcass is the
 * animal's OWN existing picture (its still, or frame 0 of its idle sheet from the front) laid on its side, a quarter turn of
 * pixels that already exist; nobody draws pixels by code
 * (docs/art/PROP_FROM_REF.md). It shrinks in quarter steps with the dressing's progress (`Carcass.dressed` of the
 * kind's `DRESS_PARTS`) and once the meat has spoiled (`carcassStage` 'bare': the hide and bones are what is left).
 */
import { type Bundle, type Carcass, type PublicState, DRESS_PARTS, awakeHuntTick, carcassStage, huntOf } from '@game/kernel';

/** The step a carcass shrinks in, and so the smallest share of its full size it is drawn at. */
export const CARCASS_STEP = 0.25;
/** Share of the size kept once the meat has spoiled: the hide and the bones. */
export const BARE_SHARE = 0.5;

export interface CarcassLook {
  id: number;
  kind: string;
  tile: [number, number];
  /** the share of the animal's own picture it is drawn at: 1 whole, down to 0.25 in quarter steps */
  scale: number;
  /** degrees it is turned to lie on its side: a quarter turn, to the left or the right by its number so a field of them is not a row */
  angle: 90 | -90;
}

/** Share of full size, in whole quarters: `(parts - dressed) / parts` of it, half of that once the meat is gone. 0 when nothing is left. */
export function carcassScale(b: Bundle, c: Carcass, awakeTick: number): number {
  const stage = carcassStage(b, c, awakeTick);
  const hunt = huntOf(b, c.kind);
  if (stage === 'gone' || !hunt) return 0;
  const parts = DRESS_PARTS[hunt.size];
  const left = Math.max(0, parts - (c.dressed ?? 0)) / parts;
  const raw = left * (stage === 'bare' ? BARE_SHARE : 1);
  if (raw <= 0) return 0;
  return Math.max(CARCASS_STEP, Math.ceil(raw / CARCASS_STEP) * CARCASS_STEP);
}

/** Every carcass on the ground that still shows something, as the screen draws it. */
export function carcassLooks(b: Bundle, state: PublicState, tick: number): CarcassLook[] {
  const awake = awakeHuntTick(state, tick);
  const out: CarcassLook[] = [];
  for (const c of state.player.carcasses ?? []) {
    const scale = carcassScale(b, c, awake);
    if (scale > 0) out.push({ id: c.id, kind: c.kind, tile: [c.at[0], c.at[1]], scale, angle: c.id % 2 === 0 ? 90 : -90 });
  }
  return out;
}
