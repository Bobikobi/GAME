/**
 * Puts the settings (settings.ts) to work on the running game: the quality preset sets the RICH groups before
 * the first scene draws, and the frame cap goes to Phaser's loop through the public TimeStep.setFPSLimit.
 * Auto learns while the game runs: the refresh is measured at launch and the frame time is watched through
 * the first seconds of play, and the cap is settled once from both. `?stats=1` shows a small overlay with
 * the numbers; without the flag nothing is drawn. `?rich=` in the URL still wins over the preset.
 */
import type * as Phaser from 'phaser';
import { RICH } from './config';
import { FrameTimer, measureRefresh, readDevice, type Device } from './device';
import { SETTLE_FRAMES, motionReduced, phoneAsksReducedMotion, readSettings, resolve, richOf, type Effective, type Settings } from './settings';

/** How often the overlay redraws, in ms. */
const OVERLAY_MS = 250;

export interface Perf {
  settings: Settings;
  device: Device;
  effective: Effective;
  timer: FrameTimer;
}

/** Reads the settings and the device, and sets RICH from the preset unless the URL named the groups. Call before the game is made. */
export function startPerf(query: string, storage: Storage | null): Perf {
  const settings = readSettings(storage);
  const device = readDevice();
  const effective = resolve(settings, device);
  if (!new URLSearchParams(query).has('rich')) Object.assign(RICH, richOf(effective.quality, motionReduced(settings, phoneAsksReducedMotion())));
  return { settings, device, effective, timer: new FrameTimer() };
}

/** Hands the cap to Phaser's loop; 0 removes the limit. */
export function applyCap(game: { loop: Pick<Phaser.Game['loop'], 'fpsLimit' | 'setFPSLimit'> }, perf: Perf): void {
  perf.effective = resolve(perf.settings, perf.device);
  // setFPSLimit restarts a running loop, so it is called only when the limit really changes
  if (game.loop.fpsLimit !== perf.effective.frameCap) game.loop.setFPSLimit(perf.effective.frameCap);
}

/** Measures the refresh, feeds the frame timer, and settles the cap once the world has run for SETTLE_FRAMES frames. */
export function watchPerf(game: Phaser.Game, perf: Perf): void {
  applyCap(game, perf);
  let frames = 0;
  game.events.on('poststep', (_time: number, delta: number) => {
    perf.timer.push(delta);
    if (++frames !== SETTLE_FRAMES) return;
    perf.device.p50 = perf.timer.p50;
    perf.device.p95 = perf.timer.p95;
    applyCap(game, perf);
  });
  void measureRefresh().then((hz) => {
    perf.device.refreshHz = hz;
    applyCap(game, perf);
  });
}

/** The debug overlay of `?stats=1`: fps, frame time, the tier, the preset and the cap, in the HUD's font at 16 px. */
export function showStats(game: Phaser.Game, perf: Perf): void {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:4px;top:4px;z-index:9999;pointer-events:none;white-space:pre;'
    + 'font:16px var(--font);color:#fff;background:rgba(0,0,0,.6);padding:2px 4px';
  document.body.append(box);
  window.setInterval(() => {
    const { device: d, effective: e, timer: t } = perf;
    box.textContent = `fps ${game.loop.actualFps.toFixed(0)}  ms p50 ${t.p50.toFixed(1)} p95 ${t.p95.toFixed(1)}\n`
      + `tier ${d.tier}  screen ${d.refreshHz || '?'} Hz\n`
      + `preset ${e.quality}  cap ${e.frameCap || 'max'}`;
  }, OVERLAY_MS);
}
