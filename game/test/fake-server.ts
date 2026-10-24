/**
 * A server in the test, answering the four endpoints of NEXT 18 a so the client can be played against
 * something real without a socket or a database. It mirrors the wire's rules that the client depends on:
 * the version it must name, the anchored clock with its 2 s of slack, a kind on every report, and a patch
 * of the state per step. It is deliberately laxer than `server/src/api.ts` in one place: it keeps no
 * movement credit, so a client that cheats on distance would not be caught here (that check has its own
 * tests on the server).
 */
import { type Action, type Bundle, type GameEvent, type State, appearSlots, appears, publicState, statePatch, step } from '@game/kernel';

import type { ChangeReply, StateReply, Wire } from '../src/remote';
import { WireGap, WireRefusal } from '../src/remote';

const SLACK_MS = 2_000;
const MOVE_LIMIT = 256;

export class FakeServer implements Wire {
  state: State;
  version = 1;
  private acceptedAt: number;
  private now: () => number;
  private bundle: Bundle;
  /** every request the client sent, in order: what a test reads to see the batching */
  readonly calls: { path: string; body: unknown }[] = [];
  /** while true the line is down: every request fails the way a dropped connection does */
  gap = false;
  /** while true the server is one older than the reason code: a 409 carries the words only */
  noReasons = false;

  constructor(bundle: Bundle, state: State, now = () => 0) {
    this.bundle = bundle;
    this.state = structuredClone(state);
    this.now = now;
    this.acceptedAt = now();
  }

  async post(path: '/action' | '/moves' | '/session', body: unknown): Promise<StateReply | ChangeReply> {
    this.calls.push({ path, body });
    if (this.gap) throw new WireGap('Waiting for the connection');
    if (path === '/session') {
      if (Object.keys(body as object).length > 0) throw new WireRefusal('Resume does not accept client state.', 400);
      return this.snapshot();
    }
    const request = body as { version?: unknown; tick?: unknown; action?: unknown; moves?: unknown };
    if (request.version !== this.version) {
      throw this.refuse('The game state changed; resume before sending another action.', 409, 'stale');
    }
    if (path === '/action') return this.action(request.action as Action, request.tick as number);
    return this.moves(request.moves as { kind?: unknown; at?: [number, number]; tick?: number }[]);
  }

  async get(path: '/state'): Promise<StateReply> {
    this.calls.push({ path, body: undefined });
    if (this.gap) throw new WireGap('Waiting for the connection');
    if (path !== '/state') throw new WireRefusal('Not found.', 404);
    return this.snapshot();
  }

  /** a refusal as the real server sends it, or as the server before the reason code did */
  private refuse(message: string, status: number, reason?: string): WireRefusal {
    return new WireRefusal(message, status, this.noReasons ? undefined : reason);
  }

  private appearIds(): string[] {
    return [...appearSlots(this.bundle).keys()].filter((id) => appears(this.bundle, this.state, id, this.state.tick)).sort();
  }

  private snapshot(): StateReply {
    return { state: publicState(this.state), version: this.version, appears: this.appearIds() };
  }

  private checkClock(tick: number): void {
    if (tick - this.state.tick > this.now() - this.acceptedAt + SLACK_MS) {
      throw this.refuse('That game time is ahead of the time elapsed.', 409, 'clock-ahead');
    }
  }

  private action(action: Action, tick: number): ChangeReply {
    if (!action || typeof action !== 'object' || action.t === 'move') throw new WireRefusal('Send one non-movement action.', 400);
    if (!Number.isSafeInteger(tick) || (tick as number) < 0) throw new WireRefusal('A valid client tick is required.', 400);
    this.checkClock(tick);
    const result = step(this.bundle, this.state, action, tick, { validateTravel: true });
    if (!result.ok) throw this.refuse(result.error, 409, 'refused');
    return this.land(result.state, result.events);
  }

  private moves(moves: { kind?: unknown; at?: [number, number]; tick?: number }[]): ChangeReply {
    if (!Array.isArray(moves) || moves.length === 0 || moves.length > MOVE_LIMIT) {
      throw new WireRefusal(`Send between 1 and ${MOVE_LIMIT} movement reports.`, 400);
    }
    let state = this.state;
    const events: GameEvent[] = [];
    let previous = state.tick;
    for (const report of moves) {
      if (!report || report.kind !== 'move') throw new WireRefusal('Only movement reports are accepted here for now.', 400);
      if (!Number.isSafeInteger(report.tick)) throw new WireRefusal('Each movement report needs a tile and a valid tick.', 400);
      if ((report.tick as number) < previous) throw this.refuse('Movement report times cannot run backwards.', 409, 'backwards');
      previous = report.tick as number;
    }
    this.checkClock(previous);
    for (const report of moves) {
      const result = step(this.bundle, state, { t: 'move', at: report.at! }, report.tick as number, { validateTravel: true });
      if (!result.ok) throw this.refuse(result.error, 409, 'refused');
      state = result.state;
      events.push(...result.events);
    }
    return this.land(state, events);
  }

  private land(state: State, events: GameEvent[]): ChangeReply {
    const before = this.state;
    const patch = statePatch(before, state);
    this.state = state;
    this.version += 1;
    // the clock is anchored to the state tick, as the real server's is: game time, not wall time
    this.acceptedAt += state.tick - before.tick;
    return { events, patch, version: this.version, appears: this.appearIds() };
  }
}
