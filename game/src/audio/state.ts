/**
 * Which music plays (DECISIONS.md, 2026-10-30 "Music: the sampled real instruments by default"; SOUND.md sections 4
 * and 5): the routine piece, or one piece for each state that asks for its own, read from the game's own signals.
 * Pure: the scenes hand in what they know and play what comes back.
 */
import { hpCap, isTownTile, type Bundle, type PublicState } from '@game/kernel';
import type { SongId } from './index';

/** The five pieces: the routine, and the four states that have their own music. */
export type MusicState = 'routine' | 'night' | 'hunting' | 'combat' | 'near-death';

/** What the game knows that decides the music. */
export interface MusicSignals {
  /** the hour is the night's (the scene's shade, as the night song always followed) */
  night: boolean;
  /** the player stands off the town's cobbles */
  outsideTown: boolean;
  /** something is attacking the player: today the predator's hunt */
  attacked: boolean;
  /** the player is on a hunt of their own; never until the hunt is built */
  hunting: boolean;
  /** the health bar now and its top, in milli-points */
  hp: number;
  hpCap: number;
  /** the bar's low mark, in percent of its top (the kernel's `hp_low_pct`) */
  lowPct: number;
}

/**
 * The state the signals ask for, most pressing first: near death, then a fight, then a hunt, then night outside
 * the town; the routine when none of them holds, so a state that ends falls back to it. A bar at 0 is a fall,
 * which the fall's own scene plays, not near death.
 */
export function musicState(s: MusicSignals): MusicState {
  if (s.hp > 0 && s.lowPct > 0 && s.hp * 100 < s.hpCap * s.lowPct) return 'near-death';
  if (s.attacked) return 'combat';
  if (s.hunting) return 'hunting';
  if (s.night && s.outsideTown) return 'night';
  return 'routine';
}

/** The longest any change of music takes: a crossfade, never a cut. */
export const CROSSFADE_MS = 2_000;
/** A fight comes in fast, still as a crossfade. */
export const COMBAT_IN_MS = 500;

/** How long the change from one state's music to the next takes, in ms. */
export function crossfadeMs(from: MusicState | undefined, to: MusicState): number {
  if (from === to) return 0;
  return to === 'combat' ? COMBAT_IN_MS : CROSSFADE_MS;
}

/** The song id each state plays under: the routine is the valley's tune, a fight takes the hunt's old place. */
export const SONG_OF: Readonly<Record<MusicState, SongId>> = {
  routine: 'valley',
  night: 'night',
  hunting: 'hunting',
  combat: 'chase',
  'near-death': 'near-death',
};

/**
 * The fight and the hunt, the one place their signals are read. Today a fight is the predator's hunt of the player
 * (`player.chase`, from its seeing the player to the player's safety); the player's own hunt is not built
 * (HUNTING.md), so it is never on. The combat and hunt code fills this in when it lands.
 */
export function danger(state: PublicState): { attacked: boolean; hunting: boolean } {
  return { attacked: state.player.chase !== null, hunting: false };
}

/** The signals of a session's state, with the night as the scene sees it. */
export function signalsOf(bundle: Bundle, state: PublicState, night: boolean): MusicSignals {
  const { attacked, hunting } = danger(state);
  return {
    night,
    outsideTown: !isTownTile(bundle, state.player.at),
    attacked,
    hunting,
    hp: state.player.hp,
    hpCap: hpCap(bundle, state),
    lowPct: bundle.params.hp_low_pct,
  };
}
