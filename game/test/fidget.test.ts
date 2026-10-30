import { describe, expect, test } from 'vitest';

import {
  baseBoundary,
  cutAt,
  type DelayRanges,
  delayRange,
  type Episode,
  episodeAfter,
  type FidgetPlay,
  fidgetAt,
  fidgetCursor,
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

/** A kind's table as the client would carry it: anim.json's entries with each clip's pose times, and the base's. */
function tableOf(kind: string): FidgetTable {
  const spec = settings.targets[kind]?.fidgets;
  if (spec === undefined) throw new Error(`${kind} has no fidgets`);
  return {
    class: spec.class as FidgetTable['class'],
    base_ms: readClip(spec.base).ms ?? [],
    alarm: spec.alarm,
    entries: spec.entries.map((e) => ({ ...e, ms: readClip(e.clip).ms ?? [] })),
  };
}

/** Whether a creature in this coat is drawn on a one-sided body, as the client derives it from anim.json. */
function oneSidedOf(kind: string, coatId: string): boolean {
  const coat = settings.targets[kind]?.coats?.find((c) => c.id === coatId);
  if (coat === undefined) throw new Error(`${kind} has no coat ${coatId}`);
  return settings.targets[coat.body ?? kind]?.one_sided === true;
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

/** Every pose boundary of a base loop started at 0, up to `to`. */
function boundaries(baseMs: readonly number[], to: number): Set<number> {
  const out = new Set<number>([0]);
  for (let t = 0; t <= to; ) {
    for (const m of baseMs) {
      t += m;
      out.add(t);
    }
  }
  return out;
}

describe('fidget scheduler (game/src/fidget.ts)', () => {
  test('the kinds match the clip tool\'s, and each table is the page\'s four fidgets with pose times from their clips', () => {
    expect([...FIDGET_KINDS]).toEqual([...TOOL_KINDS]);
    expect(tableOf('hare').entries.map((e) => e.kind)).toEqual(['ear', 'look', 'sit', 'groom']);
    expect(tableOf('crow').entries.map((e) => e.kind)).toEqual(['look', 'call', 'shake', 'groom']);
    for (const kind of KINDS) {
      const t = tableOf(kind);
      expect(t.base_ms).toEqual(readClip(`${kind}_idle`).ms);
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
          expect(plays).toHaveLength(300);
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

  test('every gap is one delay of the class range, halved under suspicion, out to the idle\'s next pose boundary; each play lasts its poses times its repeats', () => {
    // neither shipped table can have a slot where nothing may play (two entries with no cooldown at every level), so
    // every gap is exactly one delay: a play starts on the first base boundary at or after the end before it plus a
    // draw from [lo, hi], and the idle restarts at its first pose at that end
    for (const kind of KINDS) {
      const t = tableOf(kind);
      const bounds = [...boundaries(t.base_ms, 20000)].sort((a, b) => a - b);
      for (const awareness of ['calm', 'suspicion'] as const) {
        const [lo, hi] = delayRange(t.class, awareness, DELAYS);
        expect([lo, hi]).toEqual(awareness === 'calm' ? DELAYS[t.class] : DELAYS[t.class].map((v) => Math.floor(v / 2)));
        const first = baseBoundary(t.base_ms, 0, lo);
        const most = baseBoundary(t.base_ms, 0, hi);
        expect(first).toBeLessThan(most);
        const allowed = new Set(bounds.filter((b) => b >= first && b <= most));
        const seen = new Set<number>();
        for (let id = 0; id < 30; id += 1) {
          const e = ep({ id: `${kind}-${id}`, awareness, start: 500 });
          let prevEnd = e.start;
          for (const p of take(t, e, 100)) {
            const gap = p.start - prevEnd;
            expect(allowed.has(gap), `${kind} ${awareness} gap ${gap} not a boundary in [${first}, ${most}]`).toBe(true);
            seen.add(gap);
            const entry = t.entries.find((x) => x.clip === p.clip)!;
            const [rLo, rHi] = entry.repeats ?? [1, 1];
            expect(p.repeats).toBeGreaterThanOrEqual(rLo);
            expect(p.repeats).toBeLessThanOrEqual(rHi);
            expect(p.end - p.start).toBe(entry.ms.reduce((a, b) => a + b, 0) * p.repeats);
            prevEnd = p.end;
          }
        }
        // the draws reach every boundary of the range, its two ends included
        expect([...seen].sort((a, b) => a - b), `${kind} ${awareness}`).toEqual([...allowed].sort((a, b) => a - b));
      }
    }
  });

  test('a slot where nothing may play draws another delay: a long gap is two delays or more, still on the idle\'s boundaries', () => {
    const base = tableOf('hare');
    const look = base.entries.find((e) => e.kind === 'look')!;
    const ear = base.entries.find((e) => e.kind === 'ear')!;
    const t: FidgetTable = { ...base, entries: [{ ...look, cooldown_ms: 30000 }, { ...ear, cooldown_ms: 30000, repeats: [1, 1] }] };
    const [lo, hi] = delayRange(t.class, 'calm', DELAYS);
    const bounds = boundaries(t.base_ms, 400000);
    let long = 0;
    let prevEnd = 0;
    for (const p of take(t, ep({ id: 'hare-gaps' }), 40)) {
      const gap = p.start - prevEnd;
      expect(bounds.has(gap)).toBe(true);
      if (gap > baseBoundary(t.base_ms, 0, hi)) {
        long += 1;
        expect(gap).toBeGreaterThanOrEqual(2 * lo);
      }
      prevEnd = p.end;
    }
    expect(long).toBeGreaterThan(10);
  });

  test('a fidget starts only on a pose boundary of the idle, from the episode\'s base, and after a cut the idle starts again with the new episode', () => {
    const t = tableOf('hare');
    const cycle = t.base_ms.reduce((a, b) => a + b, 0);
    // the idle began 300 ms before this episode (an awareness change while it ran): boundaries count from there
    const e = ep({ id: 'hare-base', start: 10000, base: 9700 });
    let anchor = 9700;
    const bounds = boundaries(t.base_ms, 4 * cycle);
    for (const p of take(t, e, 30)) {
      expect(bounds.has(p.start - anchor), `${p.start} from ${anchor}`).toBe(true);
      anchor = p.end;
    }
    expect(baseBoundary([700, 700], 0, 0)).toBe(0);
    expect(baseBoundary([700, 700], 0, 1)).toBe(700);
    expect(baseBoundary([700, 700], 0, 1400)).toBe(1400);
    expect(baseBoundary([700, 500], 100, 1300)).toBe(1300);
    expect(baseBoundary([700, 500], 100, 1350)).toBe(2000);
    expect(baseBoundary([700, 500], 100, 801)).toBe(1300);
    expect(baseBoundary([700, 500], 100, 50)).toBe(100);
    expect(baseBoundary([], 100, 333)).toBe(333);
    // a cut: the new episode starts where the fidget stops, and the idle restarts there
    const p = take(t, e, 5).find((x) => x.end - x.start > 1)!;
    const next = episodeAfter(t, DELAYS, e, p.start + 1, 'suspicion');
    expect(next.base).toBe(next.start);
    // no fidget playing: the idle keeps its phase from the last fidget's end
    const q = take(t, e, 5)[2]!;
    const between = episodeAfter(t, DELAYS, e, q.end + 1, 'suspicion');
    expect(between.start).toBe(q.end + 1);
    expect(between.base).toBe(q.end);
    // after the alert clip or a flight the idle starts again with the episode
    const alert = episodeAfter(t, DELAYS, e, q.end + 1, 'alert');
    expect(episodeAfter(t, DELAYS, alert, q.end + 5000, 'calm').base).toBe(q.end + 5000);
    expect(episodeAfter(t, DELAYS, e, q.end + 1, 'calm', true).base).toBe(q.end + 1);
  });

  test('suspicion turns grooming off, triples the look, the ear and the alarm; alert plays nothing', () => {
    for (const kind of KINDS) {
      const t = tableOf(kind);
      for (const e of t.entries) {
        const w = weightAt(e, t, 'suspicion');
        if (e.kind === 'groom') expect(w, e.clip).toBe(0);
        else if (e.kind === 'look' || e.kind === 'ear' || e.clip === t.alarm) expect(w, e.clip).toBe(e.weight * SUSPICION_BOOST);
        else expect(w, e.clip).toBe(e.weight);
        expect(weightAt(e, t, 'alert')).toBe(0);
        expect(weightAt(e, t, 'calm')).toBe(e.weight);
      }
      const off = new Set(t.entries.filter((e) => e.kind === 'groom').map((e) => e.clip));
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

  test('a cut at the boundary between two repeats stops there, and a change at a play\'s first instant shows none of it', () => {
    const t = tableOf('hare');
    const wash = t.entries.find((x) => x.clip === 'hare_wash')!;
    const total = wash.ms.reduce((a, b) => a + b, 0);
    const play: FidgetPlay = { index: 0, clip: 'hare_wash', start: 1000, end: 1000 + 3 * total, repeats: 3, flip: false };
    expect(cutAt(play, wash.ms, 1000 + total)).toBe(1000 + total);
    expect(cutAt(play, wash.ms, 1000 + 2 * total)).toBe(1000 + 2 * total);
    expect(cutAt(play, wash.ms, 1000 + total + 1)).toBe(1000 + total + wash.ms[0]!);
    expect(cutAt(play, wash.ms, 1000 + wash.ms[0]!)).toBe(1000 + wash.ms[0]!);
    // awareness rises at the exact instant a fidget was due: it never showed, so it is not the last and not cooling
    const e = ep({ id: 'hare-edge' });
    const [a, b] = take(t, e, 2) as [FidgetPlay, FidgetPlay];
    const next = episodeAfter(t, DELAYS, e, b.start, 'suspicion');
    expect(next.start).toBe(b.start);
    expect(next.last).toBe(a.clip);
    const entryA = t.entries.find((x) => x.clip === a.clip)!;
    expect(next.ready).toEqual({ [a.clip]: a.end + entryA.cooldown_ms });
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

  test('a mirror flip only for an entry marked mirror, both ways over many plays, and never on a one-sided body (the pied hare)', () => {
    for (const kind of KINDS) {
      const t = tableOf(kind);
      const plays = take(t, ep({ id: `${kind}-flip` }), 400);
      const mirrored = new Set(t.entries.filter((e) => e.mirror === true).map((e) => e.clip));
      expect(mirrored.size).toBeGreaterThan(0);
      for (const p of plays) if (!mirrored.has(p.clip)) expect(p.flip).toBe(false);
      const flips = plays.filter((p) => mirrored.has(p.clip));
      expect(flips.some((p) => p.flip)).toBe(true);
      expect(flips.some((p) => !p.flip)).toBe(true);
    }
    // the pied coats are drawn on the one-sided body, the plain ones are not
    expect(oneSidedOf('hare', 'brown-pied')).toBe(true);
    expect(oneSidedOf('hare', 'black-pied')).toBe(true);
    expect(oneSidedOf('hare', 'agouti')).toBe(false);
    expect(oneSidedOf('crow', 'black')).toBe(false);
    const t = tableOf('hare');
    for (let id = 0; id < 40; id += 1) {
      const pied = ep({ id: `hare-pied-${id}`, oneSided: true });
      const plays = take(t, pied, 200);
      expect(plays.some((p) => p.flip)).toBe(false);
      // the same draws otherwise: only the flip differs from the plain body's sequence
      expect(plays.map((p) => ({ ...p, flip: false }))).toEqual(take(t, ep({ id: `hare-pied-${id}` }), 200).map((p) => ({ ...p, flip: false })));
      // and the episode after carries it
      expect(episodeAfter(t, DELAYS, pied, 30000, 'suspicion').oneSided).toBe(true);
    }
  });

  test('a table where nothing may play, or nothing may follow, ends its sequence instead of hanging (no `until`)', () => {
    const t = tableOf('hare');
    const groomOnly: FidgetTable = { ...t, entries: t.entries.filter((e) => e.kind === 'groom') };
    expect(fidgetAt(groomOnly, DELAYS, ep({ awareness: 'suspicion' }), 60000)).toBeNull();
    expect(fidgetPlays(groomOnly, DELAYS, ep({ awareness: 'suspicion' })).next().done).toBe(true);
    // a look and a groom under suspicion: the look plays once, then only the groom remains, which suspicion turns off
    const look = t.entries.find((e) => e.kind === 'look')!;
    const wash = t.entries.find((e) => e.kind === 'groom')!;
    const pair: FidgetTable = { ...t, entries: [look, wash] };
    const plays = fidgetPlays(pair, DELAYS, ep({ awareness: 'suspicion' }));
    expect(plays.next().value?.clip).toBe(look.clip);
    expect(plays.next().done).toBe(true);
    // calm, the same pair takes turns for ever
    const calm = take(pair, ep(), 20).map((p) => p.clip);
    expect(calm).toHaveLength(20);
    for (let i = 1; i < calm.length; i += 1) expect(calm[i]).not.toBe(calm[i - 1]);
  });

  test('a cursor gives fidgetAt\'s and episodeAfter\'s answers over a long run, forward and when time steps back', () => {
    for (const kind of KINDS) {
      const t = tableOf(kind);
      for (const awareness of ['calm', 'suspicion'] as const) {
        const e = ep({ id: `${kind}-cursor`, awareness, start: 1000, base: 400 });
        const c = fidgetCursor(t, DELAYS, e);
        let shown = 0;
        // an hour at uneven frame steps, checked against the replay every 997th call
        for (let i = 0, now = 900; now < 1000 + 3600000; i += 1, now += 16 + (i % 7)) {
          const got = c.at(now);
          if (got !== null) shown += 1;
          if (i % 997 === 0) {
            expect(got, `${kind} ${awareness} at ${now}`).toEqual(fidgetAt(t, DELAYS, e, now));
            expect(c.after(now, 'suspicion')).toEqual(episodeAfter(t, DELAYS, e, now, 'suspicion'));
          }
        }
        expect(shown).toBeGreaterThan(1000);
        // back in time: the cursor starts its replay again
        for (const now of [2500000, 5000, 1000, 999, 777777]) {
          expect(c.at(now)).toEqual(fidgetAt(t, DELAYS, e, now));
          expect(c.after(now, 'alert', true)).toEqual(episodeAfter(t, DELAYS, e, now, 'alert', true));
        }
      }
    }
  });
});
