/**
 * The dialogue box at the bottom of the screen, typed out letter by letter.
 * A (or a tap) finishes the line, then turns the page; options appear after
 * the last line. Resolves with the picked option's value, or null.
 */
import { app } from '../app';
import { sound } from '../audio';
import { voicePitch } from '../audio/spatial';
import { button, h } from './dom';
import type { Layer, UI } from './ui';

export interface SayOptions {
  /** The lines are one page: all of them at once in one box, one tap to close it (the wake pocket's waking box, NEXT 16 f). */
  page?: boolean;
}

export interface Option {
  label: string;
  value: string;
}

const CHARS_PER_SECOND = 70;
/** one gibberish syllable per this many typed characters */
const VOICE_EVERY = 4;

export function say(ui: UI, speaker: string | null, pages: string[], options: Option[] = [], opts: SayOptions = {}): Promise<string | null> {
  const lines = opts.page ? [pages.join('\n')] : pages;
  return new Promise((resolve) => {
    const nameEl = speaker ? h('div', { class: 'dialog-name' }, speaker) : null;
    const textEl = h('p', { class: opts.page ? 'dialog-text page' : 'dialog-text' });
    const arrow = h('span', { class: 'dialog-arrow', hidden: true }, '▼');
    const optionsEl = h('div', { class: 'dialog-options', hidden: true });
    const box = h('div', { class: 'dialog', role: 'dialog' }, nameEl, textEl, arrow, optionsEl);
    const el = h('div', { class: 'layer dialog-layer' }, box);
    let index = 0;
    let shown = 0;
    let timer = 0;
    let done = false;
    // only a named person of the valley has a voice; a sign, a place or the narrator is silent
    const voiced = speaker !== null && Object.values(app.bundle.npcs).some((n) => n.name === speaker);
    const pitch = voiced ? voicePitch(speaker ?? '') : 0;

    const finish = (value: string | null) => {
      if (done) return;
      done = true;
      sound.sfx('click', { detune: 0 });
      window.clearInterval(timer);
      ui.pop(layer);
      resolve(value);
    };

    const showLine = () => {
      const line = lines[index] ?? '';
      if (opts.page) {
        shown = line.length;
        return lineEnd();
      }
      shown = 0;
      textEl.textContent = '';
      arrow.hidden = true;
      window.clearInterval(timer);
      timer = window.setInterval(() => {
        const before = shown;
        shown = Math.min(line.length, shown + 2);
        textEl.textContent = line.slice(0, shown);
        if (voiced && Math.floor(shown / VOICE_EVERY) > Math.floor(before / VOICE_EVERY) && /\S/.test(line[shown - 1] ?? ' ')) {
          sound.sfx('voice', { detune: pitch + ((shown * 37) % 5) * 20 - 40, gain: 0.8 });
        }
        if (shown >= line.length) lineEnd();
      }, 2000 / CHARS_PER_SECOND);
    };

    const typing = () => shown < (lines[index] ?? '').length;

    const lineEnd = () => {
      window.clearInterval(timer);
      textEl.textContent = lines[index] ?? '';
      shown = textEl.textContent.length;
      const last = index >= lines.length - 1;
      if (last && options.length > 0) {
        optionsEl.hidden = false;
        if (optionsEl.childElementCount === 0) {
          for (const o of options) optionsEl.append(button(o.label, () => finish(o.value), 'option'));
        }
        (optionsEl.firstElementChild as HTMLElement | null)?.focus();
      } else {
        arrow.hidden = false;
      }
    };

    const next = () => {
      if (typing()) {
        sound.sfx('click', { detune: 0 });
        return lineEnd();
      }
      if (index < lines.length - 1) {
        sound.sfx('click', { detune: 0 });
        index++;
        return showLine();
      }
      if (options.length === 0) return finish(null);
      const focused = document.activeElement as HTMLElement | null;
      if (focused && optionsEl.contains(focused)) focused.click();
    };

    const moveFocus = (step: number) => {
      const buttons = [...optionsEl.querySelectorAll('button')];
      if (buttons.length === 0) return;
      const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[(at + step + buttons.length) % buttons.length]?.focus();
    };

    box.addEventListener('click', () => {
      if (optionsEl.hidden) next();
    });
    const layer: Layer = {
      el,
      holdsToasts: true,
      onButton: (b) => {
        if (b === 'a') next();
        else if (b === 'up') moveFocus(-1);
        else if (b === 'down') moveFocus(1);
        else if (b === 'b') {
          if (optionsEl.hidden) next();
          else finish(null);
        }
        return true;
      },
    };
    ui.push(layer);
    showLine();
  });
}
