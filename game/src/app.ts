/** The pieces every module reaches for, wired together once in main.ts. */
import type { Bundle } from '@game/kernel';
import type { SoundApi } from './audio';
import type { Controls } from './input';
import type { WorldScene } from './scenes/world';
import type { Session } from './session';
import type { UI } from './ui/ui';

export interface App {
  bundle: Bundle;
  controls: Controls;
  ui: UI;
  sound?: SoundApi;
  world?: WorldScene;
  session?: Session;
}

export const app = {} as App;
