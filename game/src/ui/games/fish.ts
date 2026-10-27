/**
 * The fishing minigame (DECISIONS.md, 2026-10-25: fishing): the float flies out, the fish nose at it, and on the
 * bite the player strikes. One press, timed from the dip; striking too soon frightens the fish off, too late and
 * it lets go. The nibble always comes the same time before the bite, so a player who reads it can strike faster
 * than a reaction: that is the jackpot. Each state is told to the world (`onPhase`), which draws the line.
 */
import type { Grade } from '@game/kernel';
import { h } from '../dom';
import type { Layer } from '../ui';
import { FISH_CAST_MS, type FishPhase, GRADE_NAMES, type Minigame, fishGrade, fishPlan, fishWindow } from './shared';

const NIBBLE_MS = 200;
const REEL_MS = 700;
const LOST_MS = 600;

export const fish: Minigame = (ui, opts) =>
  new Promise((resolve) => {
    const plan = fishPlan(opts.random ?? Math.random);
    const window_ = fishWindow(opts.scalePct);
    const shadow = h('i', { class: 'fish-shadow' });
    const ring = h('i', { class: 'fish-ring' });
    const float = h('b', { class: 'fish-float' });
    const result = h('div', { class: 'minigame-result', 'aria-live': 'polite' }, ' ');
    const game = h(
      'div',
      { class: 'minigame frame', 'data-game': 'fish', 'data-cue': 'wait', 'data-phase': 'cast' },
      h('div', { class: 'minigame-title' }, opts.title),
      h('div', { class: 'minigame-stage fish-stage' }, h('div', { class: 'fish-water' }, shadow, ring, float)),
      result,
      h('div', { class: 'minigame-help' }, 'Wait for the float to go under, then press A or tap. A nibble comes first.'),
    );
    const el = h('div', { class: 'layer minigame-layer' }, game);
    const start = performance.now();
    const landed = start + FISH_CAST_MS;
    let phase: FishPhase = 'cast';
    // every nibble is shown for at least one frame, however slow the frames come
    let told = 0;
    let nibbleAt = 0;
    let raf = 0;
    let done = false;

    const enter = (next: FishPhase) => {
      if (phase === next) return;
      phase = next;
      game.dataset.phase = next;
      game.dataset.cue = next === 'bite' ? 'now' : 'wait';
      opts.onPhase?.(next);
    };

    const frame = (now: number) => {
      if (done) return;
      const t = now - landed;
      if (t < 0) enter('cast');
      else if (t >= plan.bite + window_) return finish(0, 'It let go - Miss', 'lost');
      else if (t >= plan.bite) enter('bite');
      else {
        const due = plan.nibbles.filter((n) => t >= n).length;
        if (due > told) {
          told = due;
          nibbleAt = t;
          enter('nibble');
        } else if (phase !== 'nibble' || t - nibbleAt >= NIBBLE_MS) enter('wait');
      }
      // the shape comes in toward the float as the bite nears
      shadow.style.left = `${18 + 32 * Math.max(0, Math.min(1, t / plan.bite))}%`;
      raf = requestAnimationFrame(frame);
    };

    const finish = (grade: Grade, label: string, end: 'reel' | 'lost') => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      enter(end);
      game.dataset.cue = 'wait';
      result.textContent = label;
      result.className = `minigame-result g${grade}`;
      if (grade === 4) game.classList.add('jackpot');
      opts.onBeat?.(0, grade);
      window.setTimeout(() => {
        ui.pop(layer);
        resolve(grade);
      }, end === 'reel' ? REEL_MS : LOST_MS);
    };

    const press = () => {
      // the press that cast the line is not a strike: nothing counts until the float is down
      if (done || phase === 'cast') return;
      const since = performance.now() - landed - plan.bite;
      if (since < 0) return finish(0, 'Too soon - it swam off', 'lost');
      const grade = fishGrade(since, window_);
      if (grade === 0) return finish(0, 'It let go - Miss', 'lost');
      finish(grade, grade === 4 ? 'Jackpot! ×2 goods · ×3 xp' : GRADE_NAMES[grade], 'reel');
    };

    const cancel = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      opts.onPhase?.('lost');
      ui.pop(layer);
      resolve(null);
    };

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      press();
    });
    const layer: Layer = {
      el,
      onButton: (b) => {
        if (b === 'a') press();
        else if (b === 'b') cancel();
        return true;
      },
    };
    ui.push(layer);
    opts.onPhase?.('cast');
    raf = requestAnimationFrame(frame);
  });
