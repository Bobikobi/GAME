/**
 * The carve: the last beat of the bridge's mend (NEXT 16 e). One box in the dialogue's place with a name field;
 * it replaces no input of the walk and never blocks it for long: a tap on "Leave it to the stone" cuts the
 * default word. Resolves with the name to cut, valid for the kernel's `carve` action.
 */
import { sound } from '../audio';
import { STONE_SPEAKER } from '../stone';
import { button, h } from './dom';
import type { Layer, UI } from './ui';

const NAME = /^[A-Za-z0-9 _-]{1,16}$/;

export function carveName(ui: UI, defaultName: string): Promise<string> {
  return new Promise((resolve) => {
    const input = h('input', { class: 'name', maxlength: 16, placeholder: 'Your name', autocomplete: 'off', spellcheck: 'false' });
    const error = h('p', { class: 'dialog-text' });
    let done = false;
    const finish = (name: string) => {
      if (done) return;
      done = true;
      sound.sfx('click', { detune: 0 });
      ui.pop(layer);
      resolve(name);
    };
    const cut = () => {
      const name = input.value.trim();
      if (!NAME.test(name)) {
        error.textContent = 'A name is 1 to 16 letters, digits, spaces, "_" or "-".';
        input.focus();
        return;
      }
      finish(name);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') cut();
    });
    const box = h(
      'div',
      { class: 'dialog', role: 'dialog' },
      h('div', { class: 'dialog-name' }, STONE_SPEAKER),
      h('p', { class: 'dialog-text' }, 'One line is empty under the names.'),
      input,
      error,
      h('div', { class: 'dialog-options' }, button('Cut it', cut, 'option'), button('Leave it to the stone', () => finish(defaultName), 'option')),
    );
    const el = h('div', { class: 'layer dialog-layer' }, box);
    const layer: Layer = {
      el,
      holdsToasts: true,
      // A cuts what is typed (or goes to the field when it is empty); B leaves the line to the stone
      onButton: (b) => {
        if (b === 'a') {
          if (input.value.trim() === '') input.focus();
          else cut();
        }
        else if (b === 'b') finish(defaultName);
        return true;
      },
    };
    ui.push(layer);
    input.focus();
  });
}
