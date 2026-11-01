/**
 * One player's game, as the screens see it (NEXT 18 c): the classic client and the 3D door are handed
 * this interface, and two classes offer it. `Session` plays on the phone and keeps a save; `RemoteSession`
 * plays on the server and keeps none. A caller that wants the answer to an action waits for it, so the
 * same line works for both: `const answer = await s.act(action)`.
 *
 * The state a screen may read is the public one: the seed is the server's and never reaches the phone
 * (kernel-review R4), and a screen cannot tell the two apart.
 */
import type { Action, Bundle, FireState, Gait, GameEvent, PublicState } from '@game/kernel';

export type Facing = 'down' | 'up' | 'left' | 'right';

export interface LogEntry {
  a: Action;
  tick: number;
}

export type ActResult = { ok: true; events: GameEvent[] } | { ok: false; error: string };

export interface SessionEvents {
  /** an action started that keeps the player busy for `ms` */
  busy: { verb: string; ms: number };
  /** what an action produced, shown once the player is free again */
  events: GameEvent[];
  /** the state changed: redraw what depends on it */
  change: undefined;
  /** the server brought the state to newer content while the game was open (a session on the server only) */
  updated: undefined;
}

export interface GameSession {
  readonly bundle: Bundle;
  /** what a screen reads: the state without the seed */
  readonly state: PublicState;
  /** game time in ms; it runs while the world is on screen */
  tick: number;
  pos: [number, number];
  facing: Facing;
  readonly met: ReadonlySet<string>;
  readonly heard: ReadonlySet<string>;
  /** the last actions, attached to bug reports */
  tail: LogEntry[];
  readonly started: boolean;
  readonly busy: boolean;
  readonly paused: boolean;
  /** True while an action waits for the server; the local game never waits. */
  readonly waiting: boolean;
  /** True when a save from other content had to be fitted to this one. */
  readonly adapted: boolean;
  /** Remember an NPC before dialogue opens. Returns true only the first time. */
  meet(npcId: string): boolean;
  /** Remember a remark said or a topic asked, so it steps back next time. */
  hear(key: string): void;
  pause(): void;
  resume(): void;
  on<K extends keyof SessionEvents>(name: K, fn: (payload: SessionEvents[K]) => void): () => void;
  /** Called every frame with real elapsed ms. */
  advance(dt: number): void;
  /** Does a node a reaction can raise stand now? The server says; the game that holds a seed works it out. */
  appears(id: string): boolean;
  /** Ask whether an action would be accepted, when the caller can ask. The phone alone cannot. */
  check(action: Action): string | undefined;
  /** Tell the kernel which tile the player stands on. */
  report(at: readonly [number, number], again?: boolean, gait?: Gait): void;
  act(action: Action): ActResult | Promise<ActResult>;
  /** Walk away from work under way, when the session can still take it back. */
  cancelWork(): boolean;
  /** Write what is owed: the save on the phone, the pending walk on the wire. */
  save(): void;
}

/**
 * Did a burn run out after `since` and by `tick`? The kernel tells a fire going out (`fire_out`) only with a
 * step, so a session that sees this reports the tile again and shows what the step tells. The map's fires
 * and the player's own (#211) are asked alike. `RemoteSession` asks it every frame; `Session` keeps its own
 * loop until #227, which widens that loop to the own fire, moves it here.
 */
export function burnEnded(state: PublicState, since: number, tick: number): boolean {
  const own = state.player.own ?? null;
  const ends: FireState[] = [...Object.values(state.player.fires ?? {}), ...(own === null ? [] : [own])];
  return ends.some((fire) => fire.until > since && fire.until <= tick);
}
