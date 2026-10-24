/** The pieces every module reaches for, wired together once in main.ts. */
import type { Bundle, Grade } from '@game/kernel';
import type { SoundApi } from './audio';
import type { Controls } from './input';
import type { SignInfo } from './scenes/world';
import type { GameSession } from './session-surface';
import type { UI, WorkKind } from './ui/ui';

/** What the page UI asks of whichever world is on screen: the Phaser scene of /play/ or the three.js world of /play3d/. */
export interface WorldView {
  bind(session: GameSession): void;
  interact(): void;
  beat(nodeId: string, kind: WorkKind, grade: Grade): void;
  signText(slotId: string): SignInfo;
  screenOf(x: number, y: number): { x: number; y: number };
  startWork(nodeId: string, onDone?: () => void): void | Promise<void>;
  dropWork(): void;
  lightLantern(): void;
  /** whether a rectangle of tiles is on the screen now; a view without it is read by distance */
  /** the camera comes down to a place and holds close on it (the returners' stone); a view without it stays where it is */
  stoneStop?(slotId: string): Promise<void>;
  /** the camera lets go of the hold and follows the player again */
  stoneRelease?(): void;
  sees?(r: { x: number; y: number; w: number; h: number }): boolean;
}

export interface App {
  bundle: Bundle;
  controls: Controls;
  ui: UI;
  sound?: SoundApi;
  world?: WorldView;
  session?: GameSession;
}

export const app = {} as App;
