/**
 * The sign-up box (NEXT 18 d, with the neutral age screen of the owner's answer of 21.10): offered once the
 * opening is over, and only in a build that names a server (`VITE_GAME_SERVER`); without one the game is the
 * demo and nothing here shows.
 *
 * The box asks a day, a month and a year with no default and says nothing about an age before the answer
 * (the FTC's neutral age screen). It sends the date to the server and keeps none of it. A player the server
 * refuses for their age is pointed to the demo, which stays open.
 */
import type { OpeningUpload } from '@game/kernel';
import { app } from '../app';
import { button, h } from './dom';
import type { Layer, UI } from './ui';

/**
 * The server this build signs in to; undefined only in the demo build. An empty value names the game's
 * own origin (the build is served next to the server), so '' is a server, not an absence: the wire calls
 * go to the same origin the page came from.
 */
export function gameServer(): string | undefined {
  const base = (import.meta.env.VITE_GAME_SERVER as string | undefined)?.trim();
  if (base === undefined) return undefined;
  return base.replace(/\/+$/, '');
}

export interface SignupForm {
  name: string;
  day: string;
  month: string;
  year: string;
  oneAccount: boolean;
}

/** The date as the server reads it, or undefined while any part is missing or not a number. */
export function birthDateOf(form: Pick<SignupForm, 'day' | 'month' | 'year'>): string | undefined {
  const [day, month, year] = [form.day, form.month, form.year].map((part) => (/^\d{1,4}$/.test(part) ? Number(part) : NaN));
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year) || day! < 1 || month! < 1 || year! < 1000) return undefined;
  const pad = (n: number, width: number) => String(n).padStart(width, '0');
  return `${pad(year!, 4)}-${pad(month!, 2)}-${pad(day!, 2)}`;
}

/** What the sign-up posts: the name, the date, the agreement, and the opening when the phone has one to hand over. */
export function signupBody(form: SignupForm, opening: OpeningUpload | undefined): Record<string, unknown> | undefined {
  const birthDate = birthDateOf(form);
  if (birthDate === undefined) return undefined;
  return { name: form.name, birthDate, oneAccount: form.oneAccount, ...(opening ? { opening } : {}) };
}

/** The one line the box says when the server did not keep the opening. */
export const FRESH_NOTICE = 'Your account starts fresh: the server could not confirm the opening you played.';
export const KEPT_NOTICE = 'Your account is made, and the opening you played comes with it.';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface Reply {
  status: number;
  body: { name?: string; opening?: 'kept' | 'fresh'; error?: string; reason?: string; demo?: string };
}

async function post(server: string, path: string, json: unknown): Promise<Reply> {
  const response = await fetch(`${server}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(json),
  });
  return { status: response.status, body: (await response.json().catch(() => ({}))) as Reply['body'] };
}

/** Offer the sign-up to a player who has finished the opening: a no-op in the demo build. */
export function offerSignup(ui: UI): void {
  const server = gameServer();
  if (server === undefined) return;
  const layer: Layer = { el: h('div', { class: 'layer panel-layer' }) };
  const box = h('div', { class: 'panel signup', role: 'dialog', 'aria-label': 'Make an account' });
  layer.el.append(box);
  ui.push(layer);
  const close = () => ui.pop(layer);
  const say = (...children: (Node | string)[]) => box.replaceChildren(...children);
  const note = h('p', { class: 'error', role: 'status' });

  const providers = () => {
    const email = h('input', { type: 'email', placeholder: 'Your email', autocomplete: 'email', class: 'name' });
    say(
      h('h2', null, 'Keep this game with an account'),
      h('p', null, 'Make an account and your valley comes with you.'),
      button('Continue with Google', () => (window.location.href = `${server}/auth/google/start`), 'big'),
      h('label', { class: 'name-row' }, 'Or by email ', email),
      button('Send me a link', () => {
        void post(server, '/auth/email/start', { email: email.value.trim() }).then(() => (note.textContent = 'If that address can sign in, a link is on its way.'));
      }),
      note,
      button('Not now', close, 'small'),
    );
  };

  const form = () => {
    const name = h('input', { class: 'name', maxlength: 16, placeholder: 'Your name', autocomplete: 'off', value: app.session?.state.player.name ?? '' });
    // no option is selected: the first entry is an empty prompt, so nothing hints an age
    const day = h('select', { 'aria-label': 'Day' }, h('option', { value: '' }, 'Day'), ...Array.from({ length: 31 }, (_, i) => h('option', { value: String(i + 1) }, String(i + 1))));
    const month = h('select', { 'aria-label': 'Month' }, h('option', { value: '' }, 'Month'), ...MONTHS.map((m, i) => h('option', { value: String(i + 1) }, m)));
    const year = h('input', { type: 'text', inputmode: 'numeric', maxlength: 4, placeholder: 'Year', 'aria-label': 'Year', autocomplete: 'off' });
    const agree = h('input', { type: 'checkbox' });
    const go = button('Make my account', () => {
      const opening = app.session && 'openingUpload' in app.session ? (app.session as { openingUpload(): OpeningUpload | undefined }).openingUpload() : undefined;
      const body = signupBody({ name: name.value.trim(), day: day.value, month: month.value, year: year.value.trim(), oneAccount: agree.checked }, opening);
      if (!body) {
        note.textContent = 'Fill in the day, the month and the year.';
        return;
      }
      go.disabled = true;
      void post(server, '/auth/signup', body)
        .then((reply) => {
          if (reply.status === 201) {
            say(h('h2', null, `Welcome, ${reply.body.name ?? ''}`), h('p', { role: 'status' }, reply.body.opening === 'kept' ? KEPT_NOTICE : FRESH_NOTICE), button('Continue', () => window.location.assign('/'), 'big'));
            return;
          }
          if (reply.body.reason === 'under-age') {
            // the demo stays open: the one place this box sends a player
            say(h('p', null, reply.body.error ?? 'You cannot make an Loomvale account.'), h('a', { class: 'btn big', href: reply.body.demo ?? '/' }, 'Back to the demo'));
            return;
          }
          note.textContent = reply.body.error ?? 'The account could not be made.';
          go.disabled = false;
        })
        .catch(() => {
          note.textContent = 'Waiting for the connection.';
          go.disabled = false;
        });
    });
    say(
      h('h2', null, 'One more step'),
      h('label', { class: 'name-row' }, 'Name ', name),
      h('fieldset', null, h('legend', null, 'Date of birth'), day, month, year),
      h('label', null, agree, ' One person, one account in a world.'),
      note,
      go,
    );
  };

  if (window.location.hash === '#signin=signup') form();
  else providers();
}
