/** The branch-breaking minigame: mash the action quickly enough to snap it. */
import type { Grade } from '@game/kernel';
import { h } from '../dom';
import type { Layer } from '../ui';
import { GRADE_NAMES, type Minigame, snapGrade, snapLimits } from './shared';

export { snapGrade, snapLimits } from './shared';

const PRESSES = 10;
const IDLE_MS = 6000;
const RESULT_MS = 450;
const PRESS_GUARD_MS = 40;

export const snap: Minigame = (ui, opts) =>
  new Promise((resolve) => {
    const limits = snapLimits(opts.scalePct);
    const result = h('div', { class: 'minigame-result', 'aria-live': 'polite' }, ' ');
    const fill = h('i');
    const bar = h('div', { class: 'snap-bar' }, fill);
    const branch = h('div', { class: 'snap-branch' }, h('i', { class: 'snap-half left' }), h('i', { class: 'snap-half right' }));
    const game = h(
      'div',
      { class: 'minigame frame', 'data-game': 'snap', 'data-cue': 'now' },
      h('div', { class: 'minigame-title' }, opts.title),
      h('div', { class: 'minigame-stage snap-stage' }, branch, bar),
      result,
      h('div', { class: 'minigame-help' }, 'Press A or tap fast to snap it. Very fast: jackpot.'),
    );
    const el = h('div', { class: 'layer minigame-layer' }, game);

    let raf = 0;
    let ended = false;
    let state: 'ready' | 'running' | 'final' = 'ready';
    let presses = 0;
    let startedAt = 0;
    let stateUntil = 0;
    let finalGrade: Grade = 0;
    let lastPress = -Infinity;
    const openedAt = performance.now();

    const setResult = (grade: Grade, text: string = GRADE_NAMES[grade]) => {
      result.textContent = text;
      result.className = `minigame-result g${grade}`;
    };

    const exit = (grade: Grade | null) => {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(raf);
      ui.pop(layer);
      resolve(grade);
    };

    const finish = (grade: Grade, now: number, snapped = false) => {
      finalGrade = grade;
      state = 'final';
      stateUntil = now + RESULT_MS;
      game.dataset.cue = 'wait';
      setResult(grade, `${snapped ? 'Snap! · ' : ''}Final: ${GRADE_NAMES[grade]}`);
      if (grade === 4) game.classList.add('jackpot');
    };

    const press = () => {
      const now = performance.now();
      if (now - lastPress < PRESS_GUARD_MS) return;
      lastPress = now;
      if (state === 'final') return;
      if (state === 'ready' && now - openedAt > IDLE_MS) {
        finish(0, now);
        return;
      }
      if (state === 'running' && now - startedAt > limits[3]) {
        finish(0, now);
        return;
      }
      if (state === 'ready') {
        state = 'running';
        startedAt = now;
      }
      const beat = presses;
      presses += 1;
      fill.style.width = `${presses * 10}%`;
      branch.style.setProperty('--bend', `${presses * 1.4}deg`);
      branch.style.setProperty('--bend-back', `${presses * -1.4}deg`);
      branch.classList.add('pressed');
      opts.onBeat?.(beat, 3);
      setResult(3);
      if (presses === PRESSES) {
        const elapsed = now - startedAt;
        branch.classList.add('snapped');
        finish(snapGrade(elapsed, limits, true), now, true);
      }
    };

    const frame = (now: number) => {
      if (ended) return;
      branch.classList.remove('pressed');
      if (state === 'ready') {
        game.dataset.cue = 'now';
        if (now - openedAt > IDLE_MS) finish(0, now);
      } else if (state === 'running') {
        game.dataset.cue = 'now';
        if (now - startedAt > limits[3]) finish(0, now);
      } else if (now >= stateUntil) {
        exit(finalGrade);
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      press();
    });
    const layer: Layer = {
      el,
      onButton: (button) => {
        if (button === 'a') press();
        else if (button === 'b') exit(null);
        return true;
      },
    };
    ui.push(layer);
    raf = requestAnimationFrame(frame);
  });
