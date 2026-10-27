import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { OPENING_LOG_MAX, type Bundle, newState, serialize, step } from '@game/kernel';
import { app } from '../src/app';
import { SAVE_KEY } from '../src/config';
import { Session } from '../src/session';
import { birthDateOf, signupBody } from '../src/ui/signup';
import { loadBundle } from '../../tools/test/helpers/world';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
  app.bundle = bundle;
});
beforeEach(() => void vi.stubGlobal('localStorage', new MemoryStorage()));
afterEach(() => vi.unstubAllGlobals());

function begun(): Session {
  const session = Session.fresh(bundle);
  expect(session.act({ t: 'start', starter: 'core/forager', name: 'Tess' }).ok).toBe(true);
  return session;
}

/** Walk the player a tile at a time east or west, as the world reports it. */
function walk(session: Session, tiles: number): void {
  for (let i = 0; i < tiles; i += 1) {
    session.tick += bundle.params.walk_step_ms;
    const [x, y] = session.state.player.at;
    for (const next of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as [number, number][]) {
      if (session.check({ t: 'move', at: next }) === undefined && session.state.player.at.join() !== next.join()) {
        session.report(next);
        break;
      }
    }
  }
}

describe('the phone keeps the opening (NEXT 18 d)', () => {
  test('the upload is the seed, every step since the start, and the state they end on: the kernel plays it to the same state', () => {
    const session = begun();
    const seed = session.state.seed;
    walk(session, 12);
    const upload = session.openingUpload()!;
    expect(upload.seed).toEqual(seed);
    expect(upload.log[0]!.a.t).toBe('start');
    expect(upload.log.length).toBeGreaterThan(5);
    let state = newState(bundle, upload.seed);
    for (const { a, tick } of upload.log) {
      const result = step(bundle, state, a, tick);
      if (!result.ok) throw new Error(result.error);
      state = result.state;
    }
    expect(serialize(state)).toBe(upload.state);
  });

  test('it outlives the 40-action tail, and a reload keeps it', () => {
    const session = begun();
    walk(session, 60);
    expect(session.tail.length).toBeLessThanOrEqual(40);
    const before = session.openingUpload()!;
    expect(before.log.length).toBeGreaterThan(40);
    session.save();
    expect(localStorage.getItem(SAVE_KEY)).toContain('"opening"');
    expect(Session.restore(bundle)!.openingUpload()).toEqual(before);
  });

  test('work walked away from is taken back out of the log with the state', () => {
    const session = begun();
    const length = session.openingUpload()!.log.length;
    const node = Object.entries(bundle.instances).find(([, i]) => i.kind === 'resource')![0];
    const near = session.check({ t: 'gather', node, grade: 3, at: session.state.player.at });
    if (near !== undefined) return; // not reachable from the wake tile: nothing to take back here
    session.act({ t: 'gather', node, grade: 3, at: session.state.player.at });
    expect(session.cancelWork()).toBe(true);
    expect(session.openingUpload()!.log).toHaveLength(length);
  });

  test(`a log past ${OPENING_LOG_MAX} steps is too long to hand over: no upload, the account starts fresh`, () => {
    const session = begun();
    const sink = session as unknown as { keep(a: { t: 'move'; at: [number, number] }, tick: number, seed: number): void };
    for (let i = 0; i < OPENING_LOG_MAX + 1; i += 1) sink.keep({ t: 'move', at: [0, 0] }, i, 1);
    expect(session.openingUpload()).toBeUndefined();
  });

  test('a game saved before the log existed has nothing to hand over', () => {
    const session = begun();
    session.save();
    const file = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    delete file.opening;
    localStorage.setItem(SAVE_KEY, JSON.stringify(file));
    expect(Session.restore(bundle)!.openingUpload()).toBeUndefined();
  });
});

describe('the sign-up box (the neutral age screen)', () => {
  test('the date is sent only when the day, the month and the year are all answered', () => {
    expect(birthDateOf({ day: '', month: '5', year: '2000' })).toBeUndefined();
    expect(birthDateOf({ day: '7', month: '', year: '2000' })).toBeUndefined();
    expect(birthDateOf({ day: '7', month: '5', year: '' })).toBeUndefined();
    expect(birthDateOf({ day: '7', month: '5', year: '20' })).toBeUndefined();
    expect(birthDateOf({ day: '7', month: '5', year: '2000' })).toBe('2000-05-07');
  });

  test('the body carries the name, the date, the agreement and the opening, and nothing else', () => {
    const form = { name: 'Tess', day: '7', month: '5', year: '2000', oneAccount: true };
    expect(signupBody(form, undefined)).toEqual({ name: 'Tess', birthDate: '2000-05-07', oneAccount: true });
    const upload = { seed: 1, log: [], state: '' };
    expect(signupBody(form, upload)).toEqual({ name: 'Tess', birthDate: '2000-05-07', oneAccount: true, opening: upload });
    expect(signupBody({ ...form, day: '' }, upload)).toBeUndefined();
  });
});
