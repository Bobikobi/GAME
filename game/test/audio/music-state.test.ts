/** The music by state: which piece the signals ask for, the fallback, the crossfade, the player's source, the scores. */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';

import { newState, step, type Bundle, type State } from '@game/kernel';
import { beatSeconds, loopSeconds, piece } from '../../src/audio/pieces';
import { DEFAULT_SOURCE, MUSIC_PREF_NAME, readSource, writeSource } from '../../src/audio/source';
import {
  COMBAT_IN_MS,
  CROSSFADE_MS,
  SONG_OF,
  crossfadeMs,
  musicState,
  signalsOf,
  type MusicSignals,
  type MusicState,
} from '../../src/audio/state';
import { loadBundle } from '../../../tools/test/helpers/world';

const CALM: MusicSignals = { night: false, outsideTown: true, attacked: false, hunting: false, hp: 10_000, hpCap: 10_000, lowPct: 25 };
const STATES: MusicState[] = ['routine', 'night', 'hunting', 'combat', 'near-death'];

describe('the state from the signals', () => {
  test('a calm day is the routine, in town or out', () => {
    expect(musicState(CALM)).toBe('routine');
    expect(musicState({ ...CALM, outsideTown: false })).toBe('routine');
  });

  test('night plays outside the town only', () => {
    expect(musicState({ ...CALM, night: true })).toBe('night');
    expect(musicState({ ...CALM, night: true, outsideTown: false })).toBe('routine');
  });

  test('an attack is a fight, a hunt is a hunt, and a fight outranks the hunt and the night', () => {
    expect(musicState({ ...CALM, attacked: true })).toBe('combat');
    expect(musicState({ ...CALM, hunting: true, night: true })).toBe('hunting');
    expect(musicState({ ...CALM, attacked: true, hunting: true, night: true })).toBe('combat');
  });

  test('near death is under the low mark, before everything else', () => {
    expect(musicState({ ...CALM, hp: 2_499 })).toBe('near-death');
    expect(musicState({ ...CALM, hp: 2_499, attacked: true, night: true })).toBe('near-death');
    // on the mark is not under it; an empty bar is a fall, not near death; a mark of 0 never asks
    expect(musicState({ ...CALM, hp: 2_500 })).toBe('routine');
    expect(musicState({ ...CALM, hp: 0 })).toBe('routine');
    expect(musicState({ ...CALM, hp: 1, lowPct: 0 })).toBe('routine');
  });

  test('a state that ends falls back to the routine', () => {
    const fight = { ...CALM, attacked: true };
    expect(musicState(fight)).toBe('combat');
    expect(musicState({ ...fight, attacked: false })).toBe('routine');
    expect(musicState({ ...CALM, hp: 1_000 })).toBe('near-death');
    expect(musicState({ ...CALM, hp: 9_000 })).toBe('routine');
    expect(musicState({ ...CALM, night: true })).toBe('night');
    expect(musicState({ ...CALM, night: false })).toBe('routine');
  });
});

describe('the crossfade', () => {
  test('every change crossfades within two seconds, never a cut', () => {
    for (const from of [undefined, ...STATES]) {
      for (const to of STATES) {
        if (from === to) continue;
        const ms = crossfadeMs(from, to);
        expect(ms).toBeGreaterThan(0);
        expect(ms).toBeLessThanOrEqual(2_000);
      }
    }
  });

  test('a fight comes in fast, everything else takes the full two seconds, and the same state does not fade', () => {
    expect(crossfadeMs('routine', 'combat')).toBe(COMBAT_IN_MS);
    expect(crossfadeMs('combat', 'routine')).toBe(CROSSFADE_MS);
    expect(crossfadeMs('routine', 'night')).toBe(2_000);
    expect(crossfadeMs('night', 'night')).toBe(0);
  });

  test('each state has its own song id, and the routine keeps the valley\'s', () => {
    expect(SONG_OF.routine).toBe('valley');
    expect(new Set(Object.values(SONG_OF)).size).toBe(STATES.length);
  });
});

describe('the signals of the game', () => {
  let b: Bundle;
  let s: State;
  beforeAll(() => {
    b = loadBundle();
    const r = step(b, newState(b, 7), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  });
  const town = () => {
    for (let y = 0; y < b.map.height; y++) for (let x = 0; x < b.map.width; x++) if (b.map.ground[y]?.[x] === '=') return [x, y] as [number, number];
    throw new Error('no cobble on the map');
  };
  const at = (tile: [number, number], patch: (st: State) => void = () => undefined): State => {
    const out = structuredClone(s);
    out.player.at = tile;
    patch(out);
    return out;
  };

  test('a fresh start by day is the routine; the night outside the town is the night piece; the town at night is the routine', () => {
    expect(musicState(signalsOf(b, s, false))).toBe('routine');
    expect(musicState(signalsOf(b, s, true))).toBe('night');
    expect(musicState(signalsOf(b, at(town()), true))).toBe('routine');
  });

  test('the predator\'s hunt of the player is a fight, and its end falls back', () => {
    const chased = at(s.player.at, (st) => {
      st.player.chase = { hazard: 'core/test-wolf', since: 0, bites: 0 };
    });
    expect(musicState(signalsOf(b, chased, true))).toBe('combat');
    expect(musicState(signalsOf(b, s, true))).toBe('night');
  });

  test('a bar under the kernel\'s low mark is near death', () => {
    const cap = signalsOf(b, s, false).hpCap;
    const low = at(s.player.at, (st) => {
      st.player.hp = Math.floor((cap * b.params.hp_low_pct) / 100) - 1;
    });
    expect(musicState(signalsOf(b, low, false))).toBe('near-death');
  });
});

describe('the player\'s source', () => {
  const store = (value?: string) => {
    const m = new Map<string, string>(value === undefined ? [] : [[MUSIC_PREF_NAME, value]]);
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
  };

  test('the real instruments by default, when nothing or nonsense is kept', () => {
    expect(DEFAULT_SOURCE).toBe('real');
    expect(readSource(store())).toBe('real');
    expect(readSource(store('not json'))).toBe('real');
    expect(readSource(store('{"source":"kazoo"}'))).toBe('real');
    expect(readSource(undefined)).toBe('real');
  });

  test('the choice is kept and read back', () => {
    const s = store();
    writeSource(s, 'synth');
    expect(readSource(s)).toBe('synth');
    writeSource(s, 'real');
    expect(readSource(s)).toBe('real');
  });

  test('a storage that throws leaves the default', () => {
    const broken = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } };
    expect(readSource(broken)).toBe('real');
    expect(() => writeSource(broken, 'synth')).not.toThrow();
  });
});

describe('the scores and the files', () => {
  const MUSIC = join(__dirname, '../../public/music');

  test.each(STATES)('%s: every note starts inside its loop, and the loop is whole bars', (state) => {
    const p = piece(state);
    expect(p.loopBeats % 4).toBe(0);
    const inside = p.events.filter((e) => e.t < p.loopBeats);
    expect(inside.length).toBeGreaterThan(0);
    for (const e of inside) expect(beatSeconds(p, e.t)).toBeLessThan(loopSeconds(p));
  });

  test('the routine runs three minutes and the states thirty seconds or so', () => {
    expect(loopSeconds(piece('routine'))).toBeGreaterThan(180);
    for (const state of STATES.filter((s) => s !== 'routine')) {
      expect(loopSeconds(piece(state))).toBeGreaterThan(27);
      expect(loopSeconds(piece(state))).toBeLessThan(33);
    }
  });

  test('each state ships one file, the five together at most 4 MB', () => {
    let total = 0;
    for (const state of STATES) {
      const bytes = statSync(join(MUSIC, `${state}.ogg`)).size;
      expect(bytes).toBeGreaterThan(100_000);
      total += bytes;
    }
    expect(total).toBeLessThanOrEqual(4_000_000);
    expect(readFileSync(join(MUSIC, 'LICENSE.txt'), 'utf8')).toContain('Creative Commons Attribution 3.0');
  });
});
