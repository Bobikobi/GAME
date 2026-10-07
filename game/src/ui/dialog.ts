/**
 * The dialogue box at the bottom of the screen, typed out letter by letter.
 * A (or a tap) finishes the line, then turns the page; options appear after
 * the last line. Resolves with the picked option's value, or null.
 */
import { button, h } from './dom';
import type { Layer, UI } from './ui';

export interface Option {
  label: string;
  value: string;
}

const CHARS_PER_SECOND = 70;

export function say(ui: UI, speaker: string | null, lines: string[], options: Option[] = []): Promise<string | null> {
  return new Promise((resolve) => {
    const nameEl = speaker ? h('div', { class: 'dialog-name' }, speaker) : null;
    const textEl = h('p', { class: 'dialog-text' });
    const arrow = h('span', { class: 'dialog-arrow', hidden: true }, '▼');
    const optionsEl = h('div', { class: 'dialog-options', hidden: true });
    const box = h('div', { class: 'dialog', role: 'dialog' }, nameEl, textEl, arrow, optionsEl);
    const el = h('div', { class: 'layer dialog-layer' }, box);
    let index = 0;
    let shown = 0;
    let timer = 0;
    let done = false;

    const finish = (value: string | null) => {
      if (done) return;
      done = true;
      window.clearInterval(timer);
      ui.pop(layer);
      resolve(value);
    };

    const showLine = () => {
      const line = lines[index] ?? '';
      shown = 0;
      textEl.textContent = '';
      arrow.hidden = true;
      window.clearInterval(timer);
      timer = window.setInterval(() => {
        shown = Math.min(line.length, shown + 2);
        textEl.textContent = line.slice(0, shown);
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
      if (typing()) return lineEnd();
      if (index < lines.length - 1) {
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
