/** The title screen and the choice of character. */
import { app, joinRemote } from '../app';
import { GAME_TITLE } from '../config';
import { WireGap, WireRefusal, type RemoteSession } from '../remote';
import { Session, debugSeed } from '../session';
import type { GameSession } from '../session-surface';
import { ATTRIBUTE_LABEL, ATTRIBUTE_TEXT } from '../text';
import { say } from './dialog';
import { gameServer, offerSignup } from './signup';
import { standingFrame } from '../work';
import { button, h, sprite } from './dom';
import type { UI } from './ui';
import './race-body.css';

/** What the title knows about the game that exists: in this browser, and on the server when signed in. */
export interface TitleState {
  /** a build with a server URL (VITE_GAME_SERVER), so an account is possible */
  server: boolean;
  /** the demo has a save in this browser */
  hasSave: boolean;
  /** the browser is signed in on the server */
  signedIn: boolean;
  /** the account's game on the server has started */
  started: boolean;
}

/**
 * Which buttons the title shows and what it says under them, from what it knows (NEXT 18 e). A started
 * account cannot start again - the server refuses a second start - so New game hides for it.
 */
export function titleActions(state: TitleState): { canContinue: boolean; newGame: boolean; signIn: boolean; note: string } {
  const canContinue = state.hasSave || (state.signedIn && state.started);
  const newGame = !(state.signedIn && state.started);
  const signIn = state.server && !state.signedIn;
  const note = !state.server
    ? 'Demo: your progress is saved in this browser only, and will not move to an account later.'
    : state.signedIn
      ? 'Your game lives on the server and comes with you.'
      : 'Sign in to keep your valley. Until then your progress is saved in this browser.';
  return { canContinue, newGame, signIn, note };
}

/** The screens of the title. */
export type TitleScreen = 'home' | 'confirm' | 'choose';

/**
 * Whether the probe's late answer may redraw the title: only while the home screen it was asked from still
 * shows. On the choice of character it would throw the player back to the buttons mid-choice; the answer is
 * kept all the same, and the start uses it.
 */
export function probeRedraws(screen: TitleScreen, connected: boolean): boolean {
  return connected && screen === 'home';
}

export function showTitle(ui: UI): Promise<void> {
  return new Promise((resolve) => {
    // a save from before the new opening is dropped once, and said so once (CR-62)
    let dropped = Session.dropOld();
    const server = gameServer();
    const el = h('div', { class: 'title-screen' });
    ui.root.append(el);
    const done = () => {
      el.remove();
      resolve();
    };

    // the save's note, or the line's: the drop note wears a marker so a line note never lands on it
    const note = (text: string) => {
      const box = el.querySelector('.demo-note:not([data-save-reset])');
      if (box) box.textContent = text;
    };

    // the account's game once the probe knows: set by the probe and by a Continue that joined the server
    let remote: RemoteSession | undefined;
    // the probe's answer while it is on its way, so a start that comes first waits for it
    let probe: Promise<RemoteSession | undefined> | undefined;
    // the screen the title shows: a probe that answers late redraws only the home screen it was asked from
    let screen: TitleScreen = 'home';

    const render = (state: TitleState) => {
      screen = 'home';
      const actions = titleActions(state);
      el.replaceChildren(
        h(
          'div',
          { class: 'title-box ui-window' },
          h('h1', { class: 'logo' }, GAME_TITLE),
          h('p', { class: 'tagline' }, 'A valley the players rebuild together'),
          h(
            'div',
            { class: 'title-actions' },
            actions.canContinue ? button('Continue', () => void resume(), 'big') : null,
            actions.newGame ? button('New game', () => (actions.canContinue ? confirmNew() : choose()), actions.canContinue ? '' : 'big') : null,
            actions.signIn ? button('Sign in', () => offerSignup(ui)) : null,
          ),
          dropped ? h('p', { class: 'demo-note', 'data-save-reset': '' }, 'The valley has a new opening, so the game saved in this browser starts over. Thank you for playing the demo early.') : null,
          h('p', { class: 'demo-note' }, actions.note),
          h('a', { class: 'btn small site-link', href: '../' }, 'Site'),
        ),
      );
      dropped = false;
      (el.querySelector('button') as HTMLElement | null)?.focus();
    };

    // the local picture first; where a server is named, a probe replaces it with the account's game
    const home = () => {
      render({ server: server !== undefined, hasSave: Session.hasSave(), signedIn: false, started: false });
      if (server !== undefined) {
        // the line is down: the local picture stands, and the buttons ask again
        const asked = joinRemote(app.bundle, server).catch(() => undefined);
        probe = asked;
        void asked.then((joined) => {
          if (!joined) return;
          remote = joined;
          if (probeRedraws(screen, el.isConnected)) render({ server: true, hasSave: Session.hasSave(), signedIn: true, started: joined.started });
        });
      }
      // back from Google or the email link: the sign-up form waits (NEXT 18 d), without another tap
      if (window.location.hash === '#signin=signup') offerSignup(ui);
    };

    /** Continue: the server's game where the build names a server and the browser is signed in, else the demo's save. */
    const resume = async () => {
      if (server === undefined) {
        resumeLocal();
        return;
      }
      let joined: RemoteSession | undefined;
      try {
        joined = await joinRemote(app.bundle, server);
      } catch (error) {
        note(error instanceof WireGap ? 'Waiting for the connection.' : error instanceof WireRefusal ? error.message : 'The game server could not be reached.');
        return;
      }
      // not signed in (401), or an account with no game yet (404): the demo in this browser is the game
      if (!joined) {
        resumeLocal();
        return;
      }
      remote = joined;
      if (!joined.started) {
        choose();
        return;
      }
      done();
      ui.begin(joined);
      // back from Google or the email link: the sign-up form waits (NEXT 18 d)
      if (window.location.hash === '#signin=signup') offerSignup(ui);
    };

    const resumeLocal = () => {
      const session = Session.restore(app.bundle);
      if (!session) {
        note('That save could not be read. Start a new game.');
        return;
      }
      done();
      ui.begin(session);
      // back from Google or the email link: the sign-up form waits (NEXT 18 d)
      if (window.location.hash === '#signin=signup') offerSignup(ui);
    };

    const confirmNew = () => {
      screen = 'confirm';
      el.replaceChildren(
        h(
          'div',
          { class: 'title-box ui-window' },
          h('p', null, 'A new game replaces the one saved in this browser.'),
          h('div', { class: 'title-actions' }, button('Start a new game', () => choose(), 'danger'), button('Back', () => home())),
        ),
      );
    };

    const choose = () => {
      screen = 'choose';
      const b = app.bundle;
      // the races, in id order; the wake pocket is drawn by the world's seed, never chosen here
      const races = Object.entries(b.races).sort(([x], [y]) => x.localeCompare(y));
      let picked = races[0]?.[0] ?? '';
      let look = 0;
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
                onclick: () => ((picked = id), drawToggle(), drawCards()),
              },
              sprite(b, spr, 3, standingFrame(spr ? b.sprites[spr] : undefined, 1)),
              h('b', null, st.name),
              h('p', null, st.about),
              h(
                'div',
                { class: 'mini-attrs' },
                Object.entries(st.attributes).map(([a, v]) =>
                  h('div', { title: ATTRIBUTE_TEXT[a] ?? a }, h('span', null, ATTRIBUTE_LABEL[a] ?? a), h('span', { class: 'pips' }, Array.from({ length: pipCount }, (_, i) => h('i', { class: i < v ? 'on' : '' })))),
                ),
              ),
              // the race's one body fact, in words on the card (DECISIONS.md, 2026-10-23)
              ...(st.body ? [h('p', { class: 'race-body', 'data-body': st.body.name }, h('b', null, st.body.name), ` - ${st.body.about}`)] : []),
            );
          }),
        );
      drawToggle();
      drawCards();
      let starting = false;
      // no name here: the player cuts it on the stone at the bridge, the only place a name is chosen
      const start = async () => {
        // one start at a time: a second tap or Enter while the first waits starts nothing more
        if (starting) return;
        starting = true;
        // a start that comes before the probe's answer waits for it, so a signed-in account never starts in the browser
        if (!remote && probe) {
          error.textContent = 'Waiting for the connection.';
          remote = await probe;
          error.textContent = '';
        }
        // a signed-in account starts on the server, so the account keeps it; the demo starts in this browser
        let session: GameSession;
        if (remote) {
          const answer = await remote.act({ t: 'start', race: picked, name: '', look });
          if (!answer.ok) {
            error.textContent = answer.error;
            starting = false;
            return;
          }
          session = remote;
        } else {
          Session.erase();
          const fresh = Session.fresh(b, debugSeed());
          const answer = fresh.act({ t: 'start', race: picked, name: '', look });
          if (!answer.ok) {
            error.textContent = answer.error;
            starting = false;
            return;
          }
          session = fresh;
        }
        done();
        ui.begin(session);
        // the narrator speaks for the pocket the seed drew
        void intro(ui, b.pockets[session.state.player.pocket]?.intro);
      };
      el.replaceChildren(
        h(
          'div',
          { class: 'title-box wide ui-window' },
          h('h2', null, 'Who wakes up by the river?'),
          lookToggle,
          cards,
          error,
          h('div', { class: 'title-actions' }, button('Wake up', start, 'big'), button('Back', () => home())),
        ),
      );
      (el.querySelector('.title-actions button') as HTMLElement | null)?.focus();
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
