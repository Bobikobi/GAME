/** The pieces every module reaches for, wired together once in main.ts. */
import type { Bundle, Grade } from '@game/kernel';
import type { SoundApi } from './audio';
import type { Controls } from './input';
import type { SignInfo } from './scenes/world';
import type { Session } from './session';
import type { UI, WorkKind } from './ui/ui';

/** What the page UI asks of whichever world is on screen: the Phaser scene of /play/ or the three.js world of /play3d/. */
export interface WorldView {
  bind(session: Session): void;
  interact(): void;
  beat(nodeId: string, kind: WorkKind, grade: Grade): void;
  signText(slotId: string): SignInfo;
  screenOf(x: number, y: number): { x: number; y: number };
}

export interface App {
  bundle: Bundle;
  controls: Controls;
  ui: UI;
  sound?: SoundApi;
  world?: WorldView;
  session?: Session;
}

export const app = {} as App;
