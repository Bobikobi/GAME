/**
 * The window that opens when a level brings a skill point: what each
 * attribute would really change, as numbers, and one tap to put the point.
 */
import { type Attribute, characterLevel, professionLevel, skillPoints } from '@game/kernel';
import { app } from '../app';
import { sound } from '../audio';
import { ATTRIBUTE_MAX, attributeEffects } from '../text';
import { banner } from './feedback';
import { button, h } from './dom';
import { withExact } from './exact';
import type { Layer, UI } from './ui';

/** Opens the choice; resolves once the window is closed. */
export function openLevelUp(ui: UI, profession?: string): Promise<void> {
  return new Promise((resolve) => {
    const s = app.session;
    const b = app.bundle;
    if (!s || skillPoints(b, s.state) <= 0) return resolve();
    const body = h('div', { class: 'levelup-body' });
    const box = h('div', { class: 'panel levelup', role: 'dialog', 'aria-label': 'Level up' }, h('i', { class: 'burst' }), body);
    const el = h('div', { class: 'layer panel-layer levelup-layer' }, box);
    let closing = false;

    const close = () => {
      if (closing) return;
      closing = true;
      ui.pop(layer);
      resolve();
    };

    const render = (justSpent?: string) => {
      const st = s.state;
      const points = skillPoints(b, st);
      const prof = profession ? b.professions[profession] : undefined;
      const rows = attributeEffects(b, st).map((fx) => {
        const value = st.player.attrs[fx.attr];
        const full = value >= ATTRIBUTE_MAX;
        const row = h(
          'button',
          {
            class: `choice ${justSpent === fx.attr ? 'spent' : ''}`,
            type: 'button',
            disabled: full || points <= 0,
            'data-attr': fx.attr,
            onclick: () => spend(fx.attr),
          },
          // the change line below carries the plain scale, so the name stands alone
          h('span', { class: 'choice-name' }, fx.name),
          h('span', { class: 'choice-what' }, fx.what),
          withExact(h('span', { class: 'choice-change' }, h('s', null, fx.now), ' -> ', h('b', null, full ? 'at its limit' : fx.next)), fx.exact),
          fx.note ? h('span', { class: 'choice-note' }, fx.note) : null,
          h('span', { class: 'choice-plus' }, '+1'),
        );
        return row;
      });
      body.replaceChildren(
        h('h2', null, points > 0 ? `Level ${characterLevel(b, st)}!` : 'Point placed'),
        h(
          'p',
          { class: 'levelup-sub' },
          prof ? `${prof.name} ${professionLevel(b, st, profession!)} - ` : '',
          `character level ${characterLevel(b, st)}`,
        ),
        h('p', { class: 'muted' }, points > 0 ? `You have ${points} skill point${points > 1 ? 's' : ''}. Pick where ${points > 1 ? 'one' : 'it'} goes:` : 'Your new point is in. Spend later points from the journal (Log).'),
        h('div', { class: 'choices' }, rows),
        h('div', { class: 'levelup-actions' }, button(points > 0 ? 'Decide later' : 'Done', close, points > 0 ? 'small' : 'big')),
      );
      (body.querySelector(points > 0 ? 'button.choice:not(:disabled)' : '.levelup-actions button') as HTMLElement | null)?.focus();
    };

    const spend = async (attr: Attribute) => {
      const r = await s.act({ t: 'spend', attr });
      if (!r.ok) {
        ui.toast(r.error, 'bad');
        sound.sfx('back');
        return;
      }
      banner(ui.root, '+1', 'point');
      render(attr);
      if (skillPoints(b, s.state) <= 0) window.setTimeout(close, 1100);
    };

    const layer: Layer = {
      el,
      onButton: (btn) => {
        if (btn === 'b') close();
        // arrows walk the rows like a menu
        if (btn === 'up' || btn === 'down') {
          const list = [...body.querySelectorAll<HTMLButtonElement>('button')].filter((x) => !x.disabled);
          const i = list.indexOf(document.activeElement as HTMLButtonElement);
          list[(i + (btn === 'down' ? 1 : -1) + list.length) % list.length]?.focus();
        }
        if (btn === 'a') (document.activeElement as HTMLElement | null)?.click();
        return true;
      },
    };
    ui.push(layer);
    render();
  });
}
