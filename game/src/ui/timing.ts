/**
 * The timing minigame: a marker sweeps across a bar; stop it in the middle.
 * Agility and the "steady hands" technique widen the zones. The grade can
 * only take output away from perfect play (D2), so it needs no trust.
 */
import type { Grade } from '@game/kernel';
import { h } from './dom';
import type { Layer, UI } from './ui';

const SWEEP_MS = 780;
const SWEEPS = 3;
const NAMES = ['Miss', 'OK', 'Good', 'Perfect!'] as const;

export interface TimingOptions {
  title: string;
  agility: number;
  /** extra width in percent, from techniques */
  widenPct: number;
}

/** Half-widths of the zones, as a share of the bar. */
export function zones(agility: number, widenPct: number): [perfect: number, good: number, ok: number] {
  const k = (100 + widenPct) / 100;
  return [
    Math.min(0.2, (0.05 + 0.01 * agility) * k),
    Math.min(0.32, (0.13 + 0.015 * agility) * k),
    Math.min(0.46, (0.27 + 0.02 * agility) * k),
  ];
}

export function gradeAt(pos: number, center: number, z: readonly [number, number, number]): Grade {
  const d = Math.abs(pos - center);
  if (d <= z[0]) return 3;
  if (d <= z[1]) return 2;
  if (d <= z[2]) return 1;
  return 0;
}

export function timing(ui: UI, opts: TimingOptions): Promise<Grade | null> {
  return new Promise((resolve) => {
    const z = zones(opts.agility, opts.widenPct);
    // the sweet spot moves a little each time, so it is a skill, not a rhythm
    const center = 0.5 + (Math.random() - 0.5) * (0.9 - 2 * z[2]);
    const zone = (half: number, cls: string) =>
      h('i', { class: `zone ${cls}`, style: `left:${(center - half) * 100}%;width:${half * 200}%` });
    const marker = h('b', { class: 'marker' });
    const result = h('div', { class: 'timing-result' }, ' ');
    const bar = h('div', { class: 'timing-bar' }, zone(z[2], 'ok'), zone(z[1], 'good'), zone(z[0], 'perfect'), marker);
    const box = h(
      'div',
      { class: 'timing' },
      h('div', { class: 'timing-title' }, opts.title),
      bar,
      result,
      h('div', { class: 'timing-help' }, 'Press A or tap to stop in the middle'),
    );
    const el = h('div', { class: 'layer timing-layer' }, box);
    const start = performance.now();
    let pos = 0;
    let raf = 0;
    let stopped = false;

    const frame = (now: number) => {
      const t = (now - start) / SWEEP_MS;
      if (t >= SWEEPS) return stop(1, 'Too slow - OK');
      const phase = t % 2;
      pos = phase < 1 ? phase : 2 - phase;
      marker.style.left = `${pos * 100}%`;
      raf = requestAnimationFrame(frame);
    };

    const stop = (forced?: Grade, label?: string) => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      const grade = forced ?? gradeAt(pos, center, z);
      result.textContent = label ?? NAMES[grade];
      result.className = `timing-result g${grade}`;
      window.setTimeout(() => {
        ui.pop(layer);
        resolve(grade);
      }, 420);
    };

    const cancel = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      ui.pop(layer);
      resolve(null);
    };

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      stop();
    });
    const layer: Layer = {
      el,
      onButton: (b) => {
        if (b === 'a') stop();
        else if (b === 'b') cancel();
        return true;
      },
    };
    ui.push(layer);
    raf = requestAnimationFrame(frame);
  });
}
