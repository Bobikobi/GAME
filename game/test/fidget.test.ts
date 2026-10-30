import { describe, expect, test } from 'vitest';

import {
  cutAt,
  type DelayRanges,
  delayRange,
  type Episode,
  episodeAfter,
  type FidgetPlay,
  fidgetAt,
  fidgetPlays,
  type FidgetTable,
  FIDGET_KINDS,
  poseAt,
  SUSPICION_BOOST,
  weightAt,
} from '../src/fidget';
import { FIDGET_KINDS as TOOL_KINDS, readClip, readSettings } from '../../tools/src/anim/clip';

const settings = readSettings();
const DELAYS = settings.fidget_delay_ms as unknown as DelayRanges;

/** A kind's table as the client would carry it: anim.json's entries with each clip's pose times. */
function tableOf(kind: string): FidgetTable {
  const spec = settings.targets[kind]?.fidgets;
  if (spec === undefined) throw new Error(`${kind} has no fidgets`);
  return {
    class: spec.class as FidgetTable['class'],
    alarm: spec.alarm,
    entries: spec.entries.map((e) => ({ ...e, ms: readClip(e.clip).ms ?? [] })),
  };
}

const KINDS = ['hare', 'crow'] as const;
const ep = (over: Partial<Episode> = {}): Episode => ({ id: 'hare-7', salt: 1234, start: 0, awareness: 'calm', ...over });

/** The first n plays of an episode. */
function take(table: FidgetTable, e: Episode, n: number): FidgetPlay[] {
  const out: FidgetPlay[] = [];
  for (const p of fidgetPlays(table, DELAYS, e)) {
    out.push(p);
    if (out.length >= n) break;
  }
  return out;
}

describe('fidget scheduler (game/src/fidget.ts)', () => {
  test('the kinds match the clip tool\'s, and both tables carry pose times from their clips', () => {
    expect([...FIDGET_KINDS]).toEqual([...TOOL_KINDS]);
    for (const kind of KINDS) {
      const t = tableOf(kind);
      expect(t.entries.length).toBeGreaterThanOrEqual(4);
      for (const e of t.entries) expect(e.ms.length, e.clip).toBeGreaterThan(0);
    }
  });

  test('deterministic: the same id, salt and start give the same plays; another id, salt or start another sequence', () => {
    const t = tableOf('hare');
    const a = take(t, ep(), 50);
    expect(take(t, ep(), 50)).toEqual(a);
    expect(take(t, ep({ id: 'hare-8' }), 50)).not.toEqual(a);
    expect(take(t, ep({ salt: 1235 }), 50)).not.toEqual(a);
    expect(take(t, ep({ start: 10 }), 50).map((p) => p.clip)).not.toEqual(a.map((p) => p.clip));
    for (const p of a) {
      expect(Number.isInteger(p.start) && Number.isInteger(p.end)).toBe(true);
      expect(p.end).toBeGreaterThan(p.start);
    }
  });

  test('never the same fidget twice in a row, never one inside its cooldown, over long runs of many animals', () => {
    for (const kind of KINDS) {
      const t = tableOf(kind);
      for (let id = 0; id < 40; id += 1) {
        for (const awareness of ['calm', 'suspicion'] as const) {
          const plays = take(t, ep({ id: `${kind}-${id}`, awareness }), 300);
          const ready: Record<string, number> = {};
          for (let i = 0; i < plays.length; i += 1) {
            const p = plays[i]!;
            if (i > 0) expect(p.clip, `${kind}-${id} ${awareness} #${i}`).not.toBe(plays[i - 1]!.clip);
            expect(p.start, `${kind}-${id} ${p.clip} in its cooldown`).toBeGreaterThanOrEqual(ready[p.clip] ?? 0);
            const entry = t.entries.find((e) => e.clip === p.clip)!;
            ready[p.clip] = p.end + entry.cooldown_ms;
          }
        }
      }
    }
  });

  test('the delays fall in the class range, halved under suspicion, and each play lasts its poses times its repeats', () => {
    for (const kind of KINDS) {
      const t = tableOf(kind);
      for (const awareness of ['calm', 'suspicion'] as const) {
        const [lo, hi] = delayRange(t.class, awareness, DELAYS);
        expect([lo, hi]).toEqual(awareness === 'calm' ? DELAYS[t.class] : DELAYS[t.class].map((v) => Math.floor(v / 2)));
        let seenLo = Infinity;
        let seenHi = -Infinity;
        for (let id = 0; id < 30; id += 1) {
          const e = ep({ id: `${kind}-${id}`, awareness, start: 500 });
          let prevEnd = e.start;
          for (const p of take(t, e, 100)) {
            const gap = p.start - prevEnd;
            // a slot where nothing may play draws another delay, so a gap is one delay or a whole number of them
            expect(gap, `${kind} ${awareness}`).toBeGreaterThanOrEqual(lo);
            if (gap <= hi) {
              seenLo = Math.min(seenLo, gap);
              seenHi = Math.max(seenHi, gap);
            }
            const entry = t.entries.find((x) => x.clip === p.clip)!;
            const [rLo, rHi] = entry.repeats ?? [1, 1];
            expect(p.repeats).toBeGreaterThanOrEqual(rLo);
            expect(p.repeats).toBeLessThanOrEqual(rHi);
            expect(p.end - p.start).toBe(entry.ms.reduce((a, b) => a + b, 0) * p.repeats);
            prevEnd = p.end;
          }
        }
        // the draws cover the range: within a tenth of it at each end
        expect(seenLo - lo).toBeLessThan((hi - lo) / 10);
        expect(hi - seenHi).toBeLessThan((hi - lo) / 10);
      }
    }
  });

  test('suspicion turns grooming and feeding off, triples the look, the ear and the alarm; alert plays nothing', () => {
    for (const kind of KINDS) {
      const t = tableOf(kind);
      for (const e of t.entries) {
        const w = weightAt(e, t, 'suspicion');
        if (e.kind === 'groom' || e.kind === 'feed') expect(w, e.clip).toBe(0);
        else if (e.kind === 'look' || e.kind === 'ear' || e.clip === t.alarm) expect(w, e.clip).toBe(e.weight * SUSPICION_BOOST);
        else expect(w, e.clip).toBe(e.weight);
        expect(weightAt(e, t, 'alert')).toBe(0);
        expect(weightAt(e, t, 'calm')).toBe(e.weight);
      }
      const off = new Set(t.entries.filter((e) => e.kind === 'groom' || e.kind === 'feed').map((e) => e.clip));
      for (let id = 0; id < 30; id += 1) {
        for (const p of take(t, ep({ id: `${kind}-${id}`, awareness: 'suspicion' }), 60)) expect(off.has(p.clip), p.clip).toBe(false);
      }
      expect(take(t, ep({ awareness: 'alert' }), 5)).toEqual([]);
      expect(fidgetAt(t, DELAYS, ep({ awareness: 'alert' }), 100000)).toBeNull();
    }
    // the alarm is the commoner pick under suspicion: the hare sits up, the crow caws
    expect(tableOf('hare').alarm).toBe('hare_situp');
    expect(tableOf('crow').alarm).toBe('crow_caw');
  });

  test('after a flight the first fidget is a look, for every animal', () => {
    for (const kind of KINDS) {
      const t = tableOf(kind);
      const look = t.entries.find((e) => e.kind === 'look')!.clip;
      for (let id = 0; id < 50; id += 1) {
        const first = take(t, ep({ id: `${kind}-${id}`, afterFlight: true }), 1)[0]!;
        expect(first.clip).toBe(look);
      }
      // through episodeAfter: calm, a flight (alert), then calm again after it
      const calm = ep({ id: `${kind}-x` });
      const fled = episodeAfter(t, DELAYS, calm, 20000, 'alert');
      expect(take(t, fled, 3)).toEqual([]);
      const back = episodeAfter(t, DELAYS, fled, 26000, 'calm', true);
      expect(take(t, back, 1)[0]!.clip).toBe(look);
    }
  });

  test('a rise in awareness cuts a playing fidget at its next pose, and the next episode keeps its cooldowns and its last', () => {
    const t = tableOf('hare');
    const e = ep({ id: 'hare-cut' });
    const plays = take(t, e, 40);
    const p = plays.find((x) => x.end - x.start >= 300)!;
    const entry = t.entries.find((x) => x.clip === p.clip)!;
    const mid = p.start + Math.floor(entry.ms[0]! / 2);
    expect(fidgetAt(t, DELAYS, e, mid)?.clip).toBe(p.clip);
    expect(poseAt(p, entry.ms, mid)).toBe(0);
    expect(cutAt(p, entry.ms, mid)).toBe(p.start + entry.ms[0]!);
    expect(cutAt(p, entry.ms, p.start + entry.ms[0]!)).toBe(p.start + entry.ms[0]!);
    expect(cutAt(p, entry.ms, p.end + 5)).toBe(p.end);
    const next = episodeAfter(t, DELAYS, e, mid, 'suspicion');
    expect(next.start).toBe(p.start + entry.ms[0]!);
    expect(next.last).toBe(p.clip);
    expect(next.ready?.[p.clip]).toBe(next.start + entry.cooldown_ms);
    const after = take(t, next, 1)[0]!;
    expect(after.clip).not.toBe(p.clip);
    // between two plays the base loop plays: nothing is returned there
    const q = plays[plays.indexOf(p) + 1]!;
    expect(fidgetAt(t, DELAYS, e, p.end)).toBeNull();
    expect(fidgetAt(t, DELAYS, e, q.start - 1)).toBeNull();
    expect(fidgetAt(t, DELAYS, e, q.start)?.clip).toBe(q.clip);
    expect(fidgetAt(t, DELAYS, e, -1)).toBeNull();
  });

  test('the first pick over many animals follows the weights, within 1.5 points', () => {
    for (const kind of KINDS) {
      const t = tableOf(kind);
      const total = t.entries.reduce((a, e) => a + e.weight, 0);
      const n = 40000;
      const count: Record<string, number> = {};
      for (let id = 0; id < n; id += 1) {
        const first = take(t, ep({ id, salt: 99 }), 1)[0]!;
        count[first.clip] = (count[first.clip] ?? 0) + 1;
      }
      for (const e of t.entries) expect(Math.abs((100 * (count[e.clip] ?? 0)) / n - (100 * e.weight) / total), `${kind} ${e.clip}`).toBeLessThan(1.5);
    }
  });

  test('a long run follows the weights as the no-repeat rule bends them: a share of w(W - w), within 1.5 points', () => {
    // with no cooldown the only rule is "not the last one", a chain whose long-run share of an entry is proportional to
    // w * (W - w) (it is reversible: w_i w_j / ((W - w_i)(W - w_j)) is symmetric)
    for (const kind of KINDS) {
      const base = tableOf(kind);
      const t: FidgetTable = { ...base, entries: base.entries.map((e) => ({ ...e, cooldown_ms: 0 })) };
      const W = t.entries.reduce((a, e) => a + e.weight, 0);
      const z = t.entries.reduce((a, e) => a + e.weight * (W - e.weight), 0);
      const count: Record<string, number> = {};
      let n = 0;
      for (let id = 0; id < 20; id += 1) {
        for (const p of take(t, ep({ id: `${kind}-run-${id}` }), 2000)) {
          count[p.clip] = (count[p.clip] ?? 0) + 1;
          n += 1;
        }
      }
      for (const e of t.entries) {
        const want = (100 * e.weight * (W - e.weight)) / z;
        expect(Math.abs((100 * (count[e.clip] ?? 0)) / n - want), `${kind} ${e.clip}`).toBeLessThan(1.5);
      }
    }
  });

  test('a mirror flip only for an entry marked mirror, both ways over many plays', () => {
    const t = tableOf('hare');
    const plays = take(t, ep({ id: 'hare-flip' }), 400);
    const mirrored = new Set(t.entries.filter((e) => e.mirror === true).map((e) => e.clip));
    for (const p of plays) if (!mirrored.has(p.clip)) expect(p.flip).toBe(false);
    const flips = plays.filter((p) => mirrored.has(p.clip));
    expect(flips.some((p) => p.flip)).toBe(true);
    expect(flips.some((p) => !p.flip)).toBe(true);
  });

  test('a table where nothing may play yields no fidget and does not hang', () => {
    const t = tableOf('hare');
    const groomOnly: FidgetTable = { ...t, entries: t.entries.filter((e) => e.kind === 'groom' || e.kind === 'feed') };
    expect(fidgetAt(groomOnly, DELAYS, ep({ awareness: 'suspicion' }), 60000)).toBeNull();
    expect([...fidgetPlays(groomOnly, DELAYS, ep({ awareness: 'suspicion' }), 60000)]).toEqual([]);
  });
});
