/** Public entry point for the one-button gathering minigames and their rules. */
import './games.css';

export { pick } from './pick';
export { snap } from './snap';
export { strike } from './strike';
export {
  GRADE_NAMES,
  type GameOptions,
  type Minigame,
  type SnapLimits,
  type StrikeWindows,
  pickGrade,
  pickSequence,
  pickWindow,
  snapGrade,
  snapLimits,
  strikeGrade,
  strikeTotal,
  strikeWindows,
} from './shared';
