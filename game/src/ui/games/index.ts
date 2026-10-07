/** Public entry point for the one-button gathering minigames and their rules. */
import './games.css';

export { pick } from './pick';
export { snap } from './snap';
export { strike } from './strike';
export { timing } from './timing';
export {
  GRADE_NAMES,
  type GameOptions,
  type Minigame,
  type SnapLimits,
  type StrikeWindows,
  type TimingZones,
  JACKPOT_W,
  MARKER_W,
  PICK_QUICK_MS,
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
