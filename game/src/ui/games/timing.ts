/**
 * The timing minigame: a marker sweeps across a bar; stop it in the middle.
 * Agility and the "steady hands" technique widen the zones, never the thin
 * jackpot strip in the centre. The grade can only take output away from
 * perfect play (D2), so it needs no trust.
 */
import type { Grade } from '@game/kernel';
import { h } from '../dom';
import type { Layer } from '../ui';
import { GRADE_NAMES, JACKPOT_W, MARKER_W, type Minigame, timingGrade, timingZones } from './shared';

const SWEEP_MS = 780;
const SWEEPS = 3;
const RESULT_MS = 520;

export const timing: Minigame = (ui, opts) =>
  new Promise((resolve) => {
    const z = timingZones(opts.scalePct);
    const random = opts.random ?? Math.random;
    // the sweet spot moves a little each time, so it is a skill, not a rhythm
    const center = 0.5 + (random() - 0.5) * (0.9 - 2 * z[2]);
    const zone = (half: number, cls: string) =>
      h('i', { class: `zone ${cls}`, style: `left:${(center - half) * 100}%;width:${half * 200}%` });
    const marker = h('b', { class: 'marker', style: `width:${MARKER_W * 100}%;margin-left:${-MARKER_W * 50}%` });
    const result = h('div', { class: 'minigame-result', 'aria-live': 'polite' }, ' ');
    const bar = h('div', { class: 'timing-bar' }, zone(z[2], 'ok'), zone(z[1], 'good'), zone(z[0], 'perfect'), zone(JACKPOT_W / 2, 'jackpot'), marker);
    const game = h(
      'div',
      { class: 'minigame frame', 'data-game': 'timing', 'data-cue': 'wait' },
      h('div', { class: 'minigame-title' }, opts.title),
      h('div', { class: 'timing-stage' }, bar),
      result,
      h('div', { class: 'minigame-help' }, 'Press A or tap in the green. The thin gold line is a jackpot.'),
    );
    const el = h('div', { class: 'layer minigame-layer' }, game);
    const start = performance.now();
    let raf = 0;
    let stopped = false;

    const posAt = (now: number) => {
      const phase = ((now - start) / SWEEP_MS) % 2;
      return phase < 1 ? phase : 2 - phase;
    };

    const frame = (now: number) => {
      if (now - start >= SWEEPS * SWEEP_MS) return stop(0, 'Too slow - Miss');
      const pos = posAt(now);
      marker.style.left = `${pos * 100}%`;
      game.dataset.cue = Math.abs(pos - center) <= z[0] * 0.6 ? 'now' : 'wait';
      raf = requestAnimationFrame(frame);
    };

    const stop = (forced?: Grade, label?: string) => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      // graded at the moment of the press, and the marker shows that moment
      const pos = posAt(performance.now());
      marker.style.left = `${pos * 100}%`;
      const grade = forced ?? timingGrade(pos, center, z, random);
      game.dataset.cue = 'wait';
      result.textContent = label ?? (grade === 4 ? 'Jackpot! ×2 goods · ×3 xp' : GRADE_NAMES[grade]);
      result.className = `minigame-result g${grade}`;
      if (grade === 4) game.classList.add('jackpot');
      opts.onBeat?.(0, grade);
      window.setTimeout(() => {
        ui.pop(layer);
        resolve(grade);
      }, RESULT_MS);
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
