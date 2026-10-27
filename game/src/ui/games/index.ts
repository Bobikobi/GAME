/** Public entry point for the one-button gathering minigames and their rules. */
import './games.css';

export { fish } from './fish';
export { pick } from './pick';
export { snap } from './snap';
export { strike } from './strike';
export { timing } from './timing';
export {
  FISH_CAST_MS,
  FISH_TELL_MS,
  type FishPhase,
  type FishPlan,
  GRADE_NAMES,
  type GameOptions,
  type Minigame,
  type SnapLimits,
  type StrikeWindows,
  type TimingZones,
  JACKPOT_W,
  MARKER_W,
  PICK_QUICK_MS,
  fishGrade,
  fishPlan,
  fishWindow,
  pickGrade,
  pickSequence,
  pickWindow,
  snapGrade,
  snapLimits,
  strikeGrade,
  strikeTotal,
  strikeWindows,
  timingGrade,
  timingZones,
  widen,
} from './shared';
