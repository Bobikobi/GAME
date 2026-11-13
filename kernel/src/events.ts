/** Combat events join GameEvent in step.ts, the kernel's existing event union. No pack/take yet. */
import type { Tile } from './wild/types';

export type FightEvent =
  | { e: 'engage'; player: string; foe: string }
  | { e: 'hit'; player: string; by: 'player' | 'foe' | 'other'; harm: number; at: Tile }
  | { e: 'stagger'; side: 'player' | 'foe'; id: string }
  | { e: 'foe_fall'; foe: string; at: Tile; drops: { item: string; qty: number }[] }
  | { e: 'disengage'; player: string }
  | { e: 'fight_refused'; player: string; verb: string; reason: string };
