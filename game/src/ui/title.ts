/** The title screen and the choice of character. */
import { app } from '../app';
import { GAME_TITLE } from '../config';
import { Session, debugSeed } from '../session';
import { ATTRIBUTE_LABEL, ATTRIBUTE_TEXT } from '../text';
import { say } from './dialog';
import { gameServer, offerSignup } from './signup';
import { button, h, sprite } from './dom';
import type { UI } from './ui';

export function showTitle(ui: UI): Promise<void> {
  return new Promise((resolve) => {
    // a save from before the new opening is dropped once, and said so once (CR-62)
    let dropped = Session.dropOld();
    const el = h('div', { class: 'title-screen' });
    ui.root.append(el);
    const done = () => {
      el.remove();
      resolve();
    };

    const home = () => {
      const canContinue = Session.hasSave();
      el.replaceChildren(
        h(
          'div',
          { class: 'title-box' },
          h('h1', { class: 'logo' }, GAME_TITLE),
          h('p', { class: 'tagline' }, 'A valley the players rebuild together'),
          h(
            'div',
            { class: 'title-actions' },
            canContinue ? button('Continue', () => resume(), 'big') : null,
            button('New game', () => (canContinue ? confirmNew() : choose()), canContinue ? '' : 'big'),
          ),
          dropped ? h('p', { class: 'demo-note', 'data-save-reset': '' }, 'The valley has a new opening, so the game saved in this browser starts over. Thank you for playing the demo early.') : null,
          h('p', { class: 'demo-note' }, gameServer() ? 'Your progress is saved in this browser. Finish the opening to make an account.' : 'Demo: your progress is saved in this browser only, and will not move to an account later.'),
          h('a', { class: 'btn small site-link', href: '../' }, 'Site'),
        ),
      );
      dropped = false;
      (el.querySelector('button') as HTMLElement | null)?.focus();
    };

    const resume = () => {
      const session = Session.restore(app.bundle);
      if (!session) {
        el.querySelector('.demo-note')!.textContent = 'That save could not be read. Start a new game.';
        return;
      }
      done();
      ui.begin(session);
      // back from Google or the email link: the sign-up form waits (NEXT 18 d)
      if (window.location.hash === '#signin=signup') offerSignup(ui);
    };

    const confirmNew = () => {
      el.replaceChildren(
        h(
          'div',
          { class: 'title-box' },
          h('p', null, 'A new game replaces the one saved in this browser.'),
          h('div', { class: 'title-actions' }, button('Start a new game', () => choose(), 'danger'), button('Back', () => home())),
        ),
      );
    };

    const choose = () => {
      const b = app.bundle;
      // the races, in id order; the wake pocket is drawn by the world's seed, never chosen here
      const races = Object.entries(b.races).sort(([x], [y]) => x.localeCompare(y));
      let picked = races[0]?.[0] ?? '';
      let look = 0;
      const nameInput = h('input', { class: 'name', maxlength: 16, placeholder: 'Your name (or carve it later)', autocomplete: 'off', spellcheck: 'false' });
      const error = h('p', { class: 'error' });
      const cards = h('div', { class: 'cards' });
      const lookToggle = h('div', { class: 'tabs look-toggle' });

      // a race with one figure (no second sheet) has no look to pick: the toggle hides
      const drawToggle = () => {
        const one = !b.races[picked]?.sprite_alt;
        lookToggle.hidden = one;
        if (one) look = 0;
        lookToggle.replaceChildren(
          h('span', null, 'Look'),
          button('Male', () => { look = 0; drawCards(); drawToggle(); }, `tab ${look === 0 ? 'on' : ''}`),
          button('Female', () => { look = 1; drawCards(); drawToggle(); }, `tab ${look === 1 ? 'on' : ''}`),
        );
      };

      // as many pips as the highest number any race holds: the skeleton's stamina 4 shows whole (DECISIONS.md, 2026-10-23)
      const pipCount = Math.max(3, ...races.flatMap(([, r]) => Object.values(r.attributes)));
      const drawCards = () =>
        cards.replaceChildren(
          ...races.map(([id, st]) => {
            const spr = look === 1 && st.sprite_alt ? st.sprite_alt : st.sprite;
            return h(
              'button',
              {
                class: `card race ${picked === id ? 'on' : ''}`,
                type: 'button',
                'data-race': id,
                // the body fact on demand: a hover on a desktop, a long press on a phone (DECISIONS.md, 2026-10-23)
                title: st.body ? `${st.body.name}: ${st.body.about}` : undefined,
                onclick: () => ((picked = id), drawToggle(), drawCards()),
              },
              sprite(b, spr, 3, 1),
              h('b', null, st.name),
              h('p', null, st.about),
              h(
                'div',
                { class: 'mini-attrs' },
                Object.entries(st.attributes).map(([a, v]) =>
                  h('div', { title: ATTRIBUTE_TEXT[a] ?? a }, h('span', null, ATTRIBUTE_LABEL[a] ?? a), h('span', { class: 'pips' }, Array.from({ length: pipCount }, (_, i) => h('i', { class: i < v ? 'on' : '' })))),
                ),
              ),
            );
          }),
        );
      drawToggle();
      drawCards();
      const start = () => {
        const name = nameInput.value.trim();
        // a blank name is allowed: it is carved at the bridge's stone
        if (name !== '' && !/^[A-Za-z0-9 _-]{1,16}$/.test(name)) {
          error.textContent = 'A name is 1 to 16 letters, digits, spaces, "_" or "-".';
          nameInput.focus();
          return;
        }
        Session.erase();
        const session = Session.fresh(b, debugSeed());
        const r = session.act({ t: 'start', race: picked, name, look });
        if (!r.ok) {
          error.textContent = r.error;
          return;
        }
        done();
        ui.begin(session);
        // the narrator speaks for the pocket the seed drew
        void intro(ui, b.pockets[session.state.player.pocket]?.intro);
      };
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') start();
      });
      el.replaceChildren(
        h(
          'div',
          { class: 'title-box wide' },
          h('h2', null, 'Who wakes up by the river?'),
          lookToggle,
          cards,
          h('label', { class: 'name-row' }, 'Name ', nameInput),
          error,
          h('div', { class: 'title-actions' }, button('Wake up', start, 'big'), button('Back', () => home())),
        ),
      );
      nameInput.focus();
    };

    home();
  });
}

/** What the narrator says as the character wakes: the wake pocket's own lines, or the game's. */
async function intro(ui: UI, lines: string[] | undefined): Promise<void> {
  const waking = lines ?? [
    'You wake up in the tall grass beside a river. The sun stands high.',
    'Across the water, smoke rises over a town. The old bridge between is broken.',
    'Its keystone lies in the shallows by the bridge. Strike it free, and the bridge can be mended.',
  ];
  // two lines or fewer are one box and one tap (OPENING_REVIEW criterion 7); a longer start keeps paging
  await say(ui, null, waking, [], { page: waking.length <= 2 });
  const touch = matchMedia('(pointer: coarse)').matches;
  ui.toast(touch ? 'Walk with the pad. Press A next to things.' : 'Walk with the arrows or WASD. Press Space next to things.', 'info');
}
