/** The foraging minigame: choose ripe finds and leave the unripe ones alone. */
import type { Grade } from '@game/kernel';
import { app } from '../../app';
import { h, sprite } from '../dom';
import type { Layer } from '../ui';
import { GRADE_NAMES, type Minigame, pickGrade, pickSequence, pickWindow } from './shared';

export { pickGrade, pickSequence, pickWindow } from './shared';

const GAP_MS = 220;
const RESULT_MS = 450;
const PRESS_GUARD_MS = 40;

export const pick: Minigame = (ui, opts) =>
  new Promise((resolve) => {
    const sequence = pickSequence(opts.random);
    const windowMs = pickWindow(opts.agility, opts.widenPct);
    const result = h('div', { class: 'minigame-result', 'aria-live': 'polite' }, ' ');
    const item = h('div', { class: 'pick-item' });
    const stage = h('div', { class: 'minigame-stage pick-stage' }, item);
    const game = h(
      'div',
      { class: 'minigame frame', 'data-game': 'pick', 'data-cue': 'wait' },
      h('div', { class: 'minigame-title' }, opts.title),
      stage,
      result,
      h('div', { class: 'minigame-help' }, 'Press A or tap only when it is ripe'),
    );
    const el = h('div', { class: 'layer minigame-layer' }, game);

    let raf = 0;
    let ended = false;
    let index = 0;
    let correct = 0;
    let mistakes = 0;
    let pressed = false;
    let state: 'active' | 'gap' | 'final' = 'active';
    let stateStart = performance.now();
    let stateUntil = 0;
    let lastPress = -Infinity;

    const setResult = (grade: Grade, text: string = GRADE_NAMES[grade]) => {
      result.textContent = text;
      result.className = `minigame-result g${grade}`;
    };

    const showItem = () => {
      const ripe = sequence[index]!;
      const art = opts.sprite
        ? sprite(app.bundle, opts.sprite, 4, 0, 'pick-sprite')
        : h('i', { class: 'pick-berry' });
      item.className = `pick-item ${ripe ? 'ripe' : 'unripe'}`;
      item.replaceChildren(art, ...(ripe ? [] : [h('i', { class: 'pick-leaf' })]));
      stage.classList.remove('gap');
      pressed = false;
      stateStart = performance.now();
      game.dataset.cue = ripe ? 'now' : 'wait';
    };

    const exit = (grade: Grade | null) => {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(raf);
      ui.pop(layer);
      resolve(grade);
    };

    const finish = (now: number) => {
      const grade = pickGrade(correct, mistakes);
      state = 'final';
      stateUntil = now + RESULT_MS;
      game.dataset.cue = 'wait';
      stage.classList.add('gap');
      setResult(grade, `Final: ${GRADE_NAMES[grade]}`);
    };

    const press = () => {
      const now = performance.now();
      if (now - lastPress < PRESS_GUARD_MS) return;
      lastPress = now;
      if (state !== 'active' || pressed || now - stateStart > windowMs) return;
      pressed = true;
      game.dataset.cue = 'wait';
      if (sequence[index]) {
        correct += 1;
        item.classList.add('picked');
        setResult(3);
        opts.onBeat?.(index, 3);
      } else {
        mistakes += 1;
        item.classList.add('mistake');
        setResult(0);
        opts.onBeat?.(index, 0);
      }
    };

    const frame = (now: number) => {
      if (ended) return;
      if (state === 'active') {
        game.dataset.cue = sequence[index] && !pressed ? 'now' : 'wait';
        if (now - stateStart > windowMs) {
          game.dataset.cue = 'wait';
          if (index === sequence.length - 1) finish(now);
          else {
            state = 'gap';
            stateUntil = now + GAP_MS;
            stage.classList.add('gap');
          }
        }
      } else if (state === 'gap' && now >= stateUntil) {
        index += 1;
        state = 'active';
        showItem();
      } else if (state === 'final' && now >= stateUntil) {
        exit(pickGrade(correct, mistakes));
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
    showItem();
    ui.push(layer);
    raf = requestAnimationFrame(frame);
  });
