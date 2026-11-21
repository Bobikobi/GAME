/** Combat events join GameEvent in step.ts, the kernel's existing event union. No pack/take yet. */
import type { Tile } from './wild/types';

export type FightSide = 'player' | 'foe';
export type FightFigure = { side: FightSide; id: string };
export type FightOutcomeKind = 'attack' | 'critical' | 'miss' | 'guard' | 'dodge';
export type FightOutcome = {
  kind: FightOutcomeKind;
  number: number;
  at: Tile;
  move: string;
  striker: FightFigure;
  struck: FightFigure;
  foe?: { left: number; whole: number };
};

export type FightEvent =
  | { e: 'engage'; player: string; foe: string }
  | ({ e: 'hit'; player: string; by: 'player' | 'foe' | 'other'; harm: number } & FightOutcome)
  | ({ e: 'fight_miss' | 'fight_guard' | 'fight_dodge' } & FightOutcome)
  | { e: 'stagger'; side: 'player' | 'foe'; id: string }
  | { e: 'foe_fall'; foe: string; at: Tile; drops: { item: string; qty: number }[] }
  | { e: 'disengage'; player: string }
  | { e: 'fight_refused'; player: string; verb: string; reason: string };
