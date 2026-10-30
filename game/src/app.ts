/** The pieces every module reaches for, wired together once in main.ts. */
import type { Bundle, Grade } from '@game/kernel';
import type { Heard, SoundApi } from './audio';
import type { Controls } from './input';
import { RemoteSession, WireRefusal, fetchWire } from './remote';
import type { SignInfo } from './scenes/world';
import type { GameSession } from './session-surface';
import type { FishPhase } from './ui/games/shared';
import type { UI, WorkKind } from './ui/ui';

/** What the page UI asks of whichever world is on screen: the Phaser scene of /play/ or the three.js world of /play3d/. */
export interface WorldView {
  bind(session: GameSession): void;
  interact(): void;
  beat(nodeId: string, kind: WorkKind, grade: Grade): void;
  /** a cast's state moved on (fishing): the view draws the line and float; a view without it shows the minigame only */
  fishPhase?(nodeId: string, phase: FishPhase): void;
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
  /** where a predator stands as the player hears it (SOUND.md section 1.4); a view without it plays its growl whole */
  hazardHeard?(id: string): Heard | undefined;
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

/**
 * The game that lives on the server, behind the server URL a build names. Joining asks `POST /session`
 * and answers the state the server keeps, or undefined where there is no remote game to join: the
 * browser is not signed in (401), or the account has no game yet (404). A dropped line throws, so the
 * caller says "waiting for the connection" instead of playing on without the server (the owner, Q5).
 * `send` is the fetch a test replaces to answer for the wire.
 */
export async function joinRemote(bundle: Bundle, server: string, send: typeof fetch = fetch): Promise<RemoteSession | undefined> {
  try {
    return await RemoteSession.join(bundle, fetchWire(server, send));
  } catch (error) {
    if (error instanceof WireRefusal && (error.status === 401 || error.status === 404)) return undefined;
    throw error;
  }
}
