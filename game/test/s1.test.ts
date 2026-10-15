// The stage-1 client (docs/team/GRUNT.md, item 18): one visit per record per session, one report per record per browser.
import { beforeEach, describe, expect, test } from 'vitest';
import { REPORTED_PREFIX, s1, s1Available, s1Use } from '../src/net/s1';

const calls: [string, unknown][] = [];
const store = new Map<string, string>();

beforeEach(() => {
  calls.length = 0;
  store.clear();
  s1Use((path, body) => void calls.push([path, body]));
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
  });
});

describe('the stage-1 client', () => {
  test('sends one visit per record per session', () => {
    s1.visit('core/old-bridge');
    s1.visit('core/old-bridge');
    s1.visit('core/berry');
    expect(calls).toEqual([['visit', { id: 'core/old-bridge' }], ['visit', { id: 'core/berry' }]]);
  });

  test('a pickup and a stop are each sent once, and kept apart from a visit', () => {
    s1.visit('core/berry');
    s1.pickup('core/berry');
    s1.pickup('core/berry');
    s1.stop('core/fix-the-bridge');
    s1.stop('core/fix-the-bridge');
    expect(calls.map(([p]) => p)).toEqual(['visit', 'pickup', 'stop']);
  });

  test('a second report for the same record is not sent, in this session or the next', () => {
    expect(s1.report('core/berry', ' looks wrong ')).toBe(true);
    expect(s1.report('core/berry', 'again')).toBe(false);
    expect(calls).toEqual([['report', { id: 'core/berry', text: 'looks wrong' }]]);
    expect(store.has(`${REPORTED_PREFIX}core/berry`)).toBe(true);
    s1Use((path, body) => void calls.push([path, body]));
    expect(s1.report('core/berry', 'next session')).toBe(false);
    expect(calls).toHaveLength(1);
  });

  test('an empty note is not sent and does not use up the record', () => {
    expect(s1.report('core/berry', '   ')).toBe(false);
    expect(s1.report('core/berry', 'now')).toBe(true);
    expect(calls).toHaveLength(1);
  });

  test('a report is cut to 240 characters', () => {
    s1.report('core/berry', 'x'.repeat(500));
    expect((calls[0]![1] as { text: string }).text).toHaveLength(240);
  });

  test('a failing transport never breaks the game', () => {
    s1Use(() => {
      throw new Error('offline');
    });
    expect(() => s1.visit('core/berry')).not.toThrow();
    expect(() => s1.report('core/berry', 'hi')).not.toThrow();
  });

  test('nothing is sent from a file or a dev machine', () => {
    expect(s1Available({ protocol: 'file:', hostname: '' })).toBe(false);
    expect(s1Available({ protocol: 'http:', hostname: 'localhost' })).toBe(false);
    expect(s1Available({ protocol: 'https:', hostname: 'site.example' })).toBe(true);
  });
});
