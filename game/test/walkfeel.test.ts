/**
 * The walk's feel on a phone (public #641, walkfeel.ts): the gait follows the thumb's push and not a timer, the speed ramps,
 * a wall slides the body along it, and `?walk=old` keeps the 400 ms hold. Numbers are the headless measurement of the build
 * before the change (production and develop alike, the light load: 170 ms a tile walking, 85 ms running).
 */
import { afterEach, describe, expect, test, vi } from 'vitest';

import { Controls, RUN_HOLD_MS, STICK_DEAD, STICK_FULL, stickFrom } from '../src/input';
import { RAMP_DOWN_MS, RAMP_UP_MS, RUN_ENTER, RUN_LEAVE, SpeedRamp, reportedGait, stickGait, walkMode } from '../src/walkfeel';
import { ART_PX, Walker } from '../src/walking';
import { loadBundle } from '../../tools/test/helpers/world';

// the kernel's step times at the light load, the player's band while the bag is near empty: the walk and the run (gaitStepMs)
const { light_step_ms: WALK_MS } = loadBundle().params.load;
const RUN_MS = Math.floor(WALK_MS / loadBundle().params.gait.run_div);

/** Tiles a second at a step time in ms a tile. */
const tilesPerS = (stepMs: number) => 1000 / stepMs;

describe('the mode', () => {
  test('?walk=old asks for the old walk, anything else the standard', () => {
    expect(walkMode('?walk=old')).toBe('old');
    expect(walkMode('?debug&walk=old&rich=none')).toBe('old');
    expect(walkMode('')).toBe('standard');
    expect(walkMode('?walk=new')).toBe('standard');
  });
});

describe('the gait follows the push', () => {
  test('a gentle push walks at a share of the walk pace, a firm one runs at the full run pace', () => {
    expect(stickGait(0.3, false, false)).toEqual({ gait: 'walk', share: 0.3 / RUN_ENTER });
    expect(stickGait(RUN_ENTER - 0.01, false, false).gait).toBe('walk');
    expect(stickGait(RUN_ENTER, false, false)).toEqual({ gait: 'run', share: 1 });
    expect(stickGait(1, false, false)).toEqual({ gait: 'run', share: 1 });
  });

  test('the walk reaches the walk\'s full pace at the run\'s threshold, so the gaits meet without a gap in the push', () => {
    const top = stickGait(RUN_ENTER - 1e-9, false, false);
    expect(top.gait).toBe('walk');
    expect(top.share).toBeCloseTo(1, 6);
  });

  test('a thumb on the boundary does not chatter: a run holds down to RUN_LEAVE', () => {
    expect(RUN_LEAVE).toBeLessThan(RUN_ENTER);
    expect(stickGait((RUN_ENTER + RUN_LEAVE) / 2, true, false).gait).toBe('run');
    expect(stickGait((RUN_ENTER + RUN_LEAVE) / 2, false, false).gait).toBe('walk');
    expect(stickGait(RUN_LEAVE - 0.01, true, false).gait).toBe('walk');
  });

  test('the thumb\'s travel: the walk band is about 20 px on the phone\'s ring, the hysteresis a few px', () => {
    const ring = 101; // 0.26 of a 390 px screen
    const px = (length: number) => ring * STICK_DEAD + length * ring * (STICK_FULL - STICK_DEAD);
    expect(px(RUN_ENTER) - px(0)).toBeGreaterThan(18);
    expect(px(RUN_ENTER) - px(RUN_LEAVE)).toBeLessThan(4);
    expect(px(RUN_ENTER) - px(RUN_LEAVE)).toBeGreaterThan(1.5);
    // and the stick is read as that length for a finger there
    expect(Math.hypot(...stickFrom(px(RUN_ENTER), 0, ring))).toBeCloseTo(RUN_ENTER, 9);
  });

  test('a sneak stays a sneak at the push\'s share, Shift is a run at its full pace', () => {
    expect(stickGait(1, false, true)).toEqual({ gait: 'sneak', share: 1 });
    expect(stickGait(0.4, true, true)).toEqual({ gait: 'sneak', share: 0.4 });
    expect(stickGait(0.2, false, false, true)).toEqual({ gait: 'run', share: 1 });
  });

  test('a step is never reported as a walk above the walk pace, nor a run below one it is still rising to', () => {
    const unit = (ART_PX * 1000) / WALK_MS;
    expect(reportedGait('walk', unit * 1.5, unit)).toBe('run');
    expect(reportedGait('walk', unit, unit)).toBe('walk');
    expect(reportedGait('run', unit * 0.2, unit)).toBe('run');
    expect(reportedGait('sneak', unit * 0.2, unit)).toBe('sneak');
  });
});

describe('the speed ramps', () => {
  const WALK = (ART_PX * 1000) / WALK_MS;
  const RUN = (ART_PX * 1000) / RUN_MS;
  const FRAME = 16;

  test('it rises to the walk pace in RAMP_UP_MS and to the run pace in twice that', () => {
    const r = new SpeedRamp();
    let t = 0;
    while (r.speed < WALK) {
      r.step([1, 0], WALK, 1, WALK);
      t += 1;
    }
    expect(t).toBeCloseTo(RAMP_UP_MS, -1);
    const run = new SpeedRamp();
    t = 0;
    while (run.speed < RUN) {
      run.step([1, 0], RUN, 1, WALK);
      t += 1;
    }
    expect(t).toBeCloseTo(2 * RAMP_UP_MS, -1);
  });

  test('it never passes the target and a frame longer than the ramp lands on it', () => {
    const r = new SpeedRamp();
    expect(r.step([1, 0], WALK, 500, WALK)).toBe(WALK);
    expect(r.step([1, 0], WALK * 0.5, FRAME, WALK)).toBeGreaterThanOrEqual(WALK * 0.5);
  });

  test('it stops within RAMP_DOWN_MS of walking and twice that of running, keeping its way until then', () => {
    const r = new SpeedRamp();
    r.step([0, 1], RUN, 1000, WALK);
    expect(r.speed).toBe(RUN);
    let t = 0;
    while (r.speed > 0) {
      r.step([0, 0], 0, 1, WALK);
      t += 1;
      if (r.speed > 0) expect(r.dir).toEqual([0, 1]);
    }
    expect(t).toBeLessThanOrEqual(2 * RAMP_DOWN_MS + 1);
    expect(r.dir).toEqual([0, 0]);
  });

  test('reset stops the body at once', () => {
    const r = new SpeedRamp();
    r.step([1, 0], WALK, 1000, WALK);
    r.reset();
    expect(r.speed).toBe(0);
    expect(r.dir).toEqual([0, 0]);
  });

  /** A held stick of `length` from rest on open ground, walked as the scene does: the tiles a second, once settled, and the glide after the lift. */
  function play(length: number, holdMs: number): { settled: number; glide: number; gaits: string[] } {
    const walker = new Walker();
    walker.place([10, 10]);
    const ramp = new SpeedRamp();
    const unitSpeed = (ART_PX * 1000) / WALK_MS;
    let running = false;
    const gaits: string[] = [];
    let x0 = 0;
    let tAt = 0;
    for (let t = 0; t < holdMs; t += FRAME) {
      const { gait, share } = stickGait(length, running, false);
      running = gait === 'run';
      const paceMs = gait === 'run' ? RUN_MS : WALK_MS;
      const speed = ramp.step([1, 0], share * ((ART_PX * 1000) / paceMs), FRAME, unitSpeed);
      gaits.push(reportedGait(gait, speed, unitSpeed));
      walker.frame(ramp.dir, FRAME, speed > 0 ? (ART_PX * 1000) / speed : paceMs, () => true);
      if (t === 400) {
        x0 = walker.x;
        tAt = t;
      }
    }
    const settled = ((walker.x - x0) / ART_PX) / ((holdMs - FRAME - tAt) / 1000);
    const at = walker.x;
    for (let t = 0; t < 200; t += FRAME) {
      const speed = ramp.step([0, 0], 0, FRAME, unitSpeed);
      walker.frame(ramp.dir, FRAME, speed > 0 ? (ART_PX * 1000) / speed : WALK_MS, () => true);
    }
    return { settled, glide: (walker.x - at) / ART_PX, gaits };
  }

  test('a stick at 0.3 walks and stays a walk (the old rule ran it at 3.5 tiles a second after 400 ms)', () => {
    const r = play(0.3, 1500);
    expect(new Set(r.gaits)).toEqual(new Set(['walk']));
    expect(r.settled).toBeCloseTo((0.3 / RUN_ENTER) * tilesPerS(WALK_MS), 1);
    expect(r.settled).toBeLessThan(3.5);
  });

  test('a stick at 0.6 walks at the share of the walk pace and a full push runs at 11.76 tiles a second from the first moments', () => {
    const mid = play(0.6, 1500);
    expect(new Set(mid.gaits)).toEqual(new Set(['walk']));
    expect(mid.settled).toBeCloseTo((0.6 / RUN_ENTER) * tilesPerS(WALK_MS), 1);
    const full = play(1, 1500);
    expect(full.gaits.at(-1)).toBe('run');
    expect(full.settled).toBeCloseTo(tilesPerS(RUN_MS), 1);
    // no snap: from rest the speed climbs through the walk pace before the run's, so no frame doubles the speed of the one before
    const w = new Walker();
    w.place([10, 10]);
    const ramp = new SpeedRamp();
    let last = 0;
    for (let t = 0; t < 600; t += FRAME) {
      const speed = ramp.step([1, 0], RUN, FRAME, WALK);
      expect(speed - last).toBeLessThanOrEqual((WALK / RAMP_UP_MS) * FRAME + 1e-6);
      last = speed;
    }
  });

  test('the stop glides less than a third of a tile from a run and a tenth of a tile from a walk (the old rule stopped in one frame)', () => {
    expect(play(1, 1500).glide).toBeLessThan(0.33);
    expect(play(0.5, 1500).glide).toBeLessThan(0.1);
  });
});

describe('the edge slide', () => {
  /** A wall along the row below y = 10: the tile (x, 11) is refused, everything else is open. */
  const wall = (x: number, y: number) => y < 11 && y >= 0 && x >= 0;
  const FRAME = 16;

  /** Walks `ms` at the walk's pace (170 ms a tile) with a unit direction; the distance moved along x and y, in tiles. */
  function push(dir: readonly [number, number], ms = 1200): { along: number; into: number; w: Walker } {
    const w = new Walker();
    w.place([4, 10]);
    const x0 = w.x;
    const y0 = w.y;
    for (let t = 0; t < ms; t += FRAME) w.frame(dir, FRAME, WALK_MS, wall);
    return { along: (w.x - x0) / ART_PX, into: (w.y - y0) / ART_PX, w };
  }

  test('a head-on push stops dead against the wall and does not shake', () => {
    const w = new Walker();
    w.place([4, 10]);
    const ys: number[] = [];
    for (let t = 0; t < 800; t += FRAME) {
      w.frame([0, 1], FRAME, WALK_MS, wall);
      ys.push(w.y);
    }
    const rest = ys.at(-1)!;
    expect(ys.slice(-20).every((y) => y === rest)).toBe(true);
    expect(w.x).toBe(4 * ART_PX + ART_PX / 2);
  });

  test.each([15, 45, 75])('a push %i degrees off the wall slides along it at the projected speed, no more, no less', (deg) => {
    const rad = (deg * Math.PI) / 180;
    // the wall is the row below, so the push is along x by cos and into the wall (down) by sin
    const { along, into, w } = push([Math.cos(rad), Math.sin(rad)]);
    // the body ends against the wall
    expect(w.y + 8).toBeLessThanOrEqual(11 * ART_PX + 1e-6);
    expect(into).toBeLessThan(0.51);
    const seconds = 1.2 - FRAME / 1000;
    const wanted = Math.cos(rad) * tilesPerS(WALK_MS) * seconds;
    expect(along).toBeGreaterThan(wanted * 0.97);
    expect(along).toBeLessThan(wanted * 1.04);
  });
});

describe('the old walk (?walk=old)', () => {
  afterEach(() => vi.unstubAllGlobals());

  function sticks(mode: 'old' | 'standard'): { c: Controls; at: (ms: number) => void } {
    let now = 1000;
    vi.stubGlobal('window', { addEventListener: () => undefined });
    vi.stubGlobal('performance', { now: () => now });
    return { c: new Controls(mode), at: (ms) => (now = 1000 + ms) };
  }

  test('it holds the walk for RUN_HOLD_MS and then runs, whatever the push, at the push\'s length of the pace', () => {
    const { c, at } = sticks('old');
    c.setStick([0.3, 0]);
    expect(c.vector()).toEqual([0.3, 0]);
    at(RUN_HOLD_MS - 1);
    expect(c.gait(1000 + RUN_HOLD_MS - 1)).toBe('walk');
    expect(c.gait(1000 + RUN_HOLD_MS)).toBe('run');
    // the measured speeds of the build before: 0.3 of the pace, then the same share of the run's, twice the speed
    const walk = 0.3 * tilesPerS(WALK_MS);
    const run = 0.3 * tilesPerS(RUN_MS);
    expect(walk).toBeCloseTo(1.76, 2);
    expect(run).toBeCloseTo(3.53, 2);
    expect(run / walk).toBeCloseTo(2, 9);
    c.setStick(null);
    expect(c.gait(5000)).toBe('walk');
  });

  test('the standard asks by the push and has no timer', () => {
    const { c } = sticks('standard');
    c.setStick([0.3, 0]);
    expect(c.ask()).toEqual({ dir: [1, 0], share: 0.3 / RUN_ENTER, gait: 'walk' });
    // a long hold of the same push stays a walk
    expect(c.gait(1000 + 10 * RUN_HOLD_MS)).toBe('run'); // the old rule's reading is still there for ?walk=old
    expect(c.ask().gait).toBe('walk');
    c.setStick([0, -1]);
    expect(c.ask()).toEqual({ dir: [0, -1], share: 1, gait: 'run' });
    c.setStick([0, -0.75]);
    expect(c.ask().gait).toBe('run'); // inside the hysteresis a run holds
    c.setStick([0, -0.5]);
    expect(c.ask().gait).toBe('walk');
    c.setStick(null);
    expect(c.ask()).toEqual({ dir: [0, 0], share: 0, gait: 'walk' });
  });

  test('held keys are a full walk, Shift a run, the sneak toggle a sneak', () => {
    const on = new Map<string, (e: unknown) => void>();
    vi.stubGlobal('window', { addEventListener: (type: string, fn: (e: unknown) => void) => on.set(type, fn) });
    const c = new Controls('standard');
    const ev = (code: string) => ({ code, target: null, ctrlKey: false, metaKey: false, altKey: false, repeat: false, preventDefault: () => undefined });
    on.get('keydown')!(ev('ArrowRight'));
    expect(c.ask()).toEqual({ dir: [1, 0], share: 1, gait: 'walk' });
    on.get('keydown')!(ev('ShiftLeft'));
    expect(c.ask().gait).toBe('run');
    on.get('keyup')!(ev('ShiftLeft'));
    c.setSneak(true);
    expect(c.ask().gait).toBe('sneak');
  });
});
