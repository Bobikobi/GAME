/** The quarrying minigame: land three hammer blows as the ring meets its target. */
import type { Grade } from '@game/kernel';
import { app } from '../../app';
import { h, sprite } from '../dom';
import type { Layer } from '../ui';
import {
  GRADE_NAMES,
  type Minigame,
  strikeGrade,
  strikeTotal,
  strikeWindows,
} from './shared';

export { strikeGrade, strikeTotal, strikeWindows } from './shared';

const APPROACH_MS = 900;
const BETWEEN_BEATS_MS = 350;
const RESULT_MS = 450;
const PRESS_GUARD_MS = 40;
const BEATS = 3;

export const strike: Minigame = (ui, opts) =>
  new Promise((resolve) => {
    const windows = strikeWindows(opts.agility, opts.widenPct);
    const grades: Grade[] = [];
    const result = h('div', { class: 'minigame-result', 'aria-live': 'polite' }, ' ');
    const ring = h('i', { class: 'strike-ring' });
    const cracks = Array.from({ length: BEATS }, (_, i) => h('i', { class: `strike-crack c${i}` }));
    const puff = h('i', { class: 'strike-puff' });
    const stoneArt = opts.sprite
      ? sprite(app.bundle, opts.sprite, 4, 0, 'strike-sprite')
      : h('i', { class: 'strike-stone-shape' });
    const stone = h('div', { class: 'strike-stone' }, stoneArt, h('i', { class: 'strike-target' }), ring, cracks, puff);
    const game = h(
      'div',
      { class: 'minigame frame', 'data-game': 'strike', 'data-cue': 'wait' },
      h('div', { class: 'minigame-title' }, opts.title),
      h('div', { class: 'minigame-stage strike-stage' }, stone),
      result,
      h('div', { class: 'minigame-help' }, 'Press A or tap when the ring meets the circle'),
    );
    const el = h('div', { class: 'layer minigame-layer' }, game);

    let raf = 0;
    let ended = false;
    let beat = 0;
    let state: 'active' | 'pause' | 'final' = 'active';
    let beatStart = performance.now();
    let stateUntil = 0;
    let lastPress = -Infinity;
    let shakeUntil = 0;
    let puffUntil = 0;

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

    const finishBeat = (grade: Grade, now: number) => {
      if (state !== 'active') return;
      grades.push(grade);
      cracks[beat]!.classList.add('visible');
      stone.classList.add('hit');
      shakeUntil = now + 180;
      if (grade === 0) {
        puff.classList.add('visible');
        puffUntil = now + 240;
      }
      opts.onBeat?.(beat, grade);
      beat += 1;
      game.dataset.cue = 'wait';
      if (beat === BEATS) {
        const total = strikeTotal(grades);
        setResult(total, `${GRADE_NAMES[grade]} · Final: ${GRADE_NAMES[total]}`);
        state = 'final';
        stateUntil = now + RESULT_MS;
      } else {
        setResult(grade);
        state = 'pause';
        stateUntil = now + BETWEEN_BEATS_MS;
      }
    };

    const press = () => {
      const now = performance.now();
      if (now - lastPress < PRESS_GUARD_MS) return;
      lastPress = now;
      if (state !== 'active') return;
      finishBeat(strikeGrade(Math.abs(now - beatStart - APPROACH_MS), windows), now);
    };

    const frame = (now: number) => {
      if (ended) return;
      if (now >= shakeUntil) stone.classList.remove('hit');
      if (now >= puffUntil) puff.classList.remove('visible');

      if (state === 'active') {
        const elapsed = now - beatStart;
        const scale = elapsed <= APPROACH_MS
          ? 3 - 2 * Math.max(0, elapsed) / APPROACH_MS
          : 1 - 0.4 * Math.min(1, (elapsed - APPROACH_MS) / windows[2]);
        ring.style.transform = `scale(${scale})`;
        game.dataset.cue = Math.abs(elapsed - APPROACH_MS) <= windows[0] / 2 ? 'now' : 'wait';
        if (elapsed > APPROACH_MS + windows[2]) finishBeat(0, now);
      } else if (state === 'pause' && now >= stateUntil) {
        state = 'active';
        beatStart = now;
        result.textContent = ' ';
        result.className = 'minigame-result';
        ring.style.transform = 'scale(3)';
      } else if (state === 'final' && now >= stateUntil) {
        exit(strikeTotal(grades));
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
