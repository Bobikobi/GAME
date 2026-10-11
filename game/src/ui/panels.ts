/**
 * The menus: bag, journal, shop, cooking, building, and the help pages.
 * Every change goes through session.act(), so a menu can never do what the
 * kernel would refuse.
 */
import {
  KERNEL_VERSION,
  bagCapacity,
  bagUsed,
  characterLevel,
  minuteOfDay,
  payFor,
  professionLevel,
  skillPoints,
} from '@game/kernel';
import guideText from '../../../docs/creators/README.md?raw';
import { app } from '../app';
import { sound } from '../audio';
import { GAME_TITLE, REPO_URL, REVIEW_KEY } from '../config';
import {
  type FeedbackContext,
  type FeedbackPayload,
  FEEDBACK_TEXT_MAX,
  buildFeedbackPayload,
  failureMessage,
  isEmptyFeedback,
  sendFeedback,
} from '../feedback-payload';
import type { SignInfo } from '../scenes/world';
import { Session } from '../session';
import { ATTRIBUTE_MAX, activeQuests, attributeEffects, clock, gold, itemBenefit, itemName, questSteps, restoreHint, seconds, stacks, toolOpens } from '../text';
import { say } from './dialog';
import { button, h, sprite } from './dom';
import { markdown } from './markdown';
import type { Layer, UI } from './ui';

interface Panel {
  layer: Layer;
  body: HTMLElement;
  close: () => void;
}

function panel(ui: UI, title: string, cls = ''): Panel {
  const body = h('div', { class: 'panel-body' });
  const titleEl = h('h2', null, title);
  const closeBtn = button('Close', () => ui.pop(layer), 'close small');
  const box = h('div', { class: `panel ${cls}`.trim(), role: 'dialog', 'aria-label': title }, h('header', null, titleEl, closeBtn), body);
  const el = h('div', { class: 'layer panel-layer' }, box);
  el.addEventListener('click', (e) => {
    if (e.target === el) ui.pop(layer);
  });
  const layer: Layer = { el };
  ui.push(layer);
  closeBtn.focus();
  return { layer, body, close: () => ui.pop(layer) };
}

function tabs(names: string[], active: string, onPick: (name: string) => void): HTMLElement {
  return h(
    'nav',
    { class: 'tabs' },
    names.map((n) => button(n[0]!.toUpperCase() + n.slice(1), () => onPick(n), n === active ? 'tab on' : 'tab')),
  );
}

function need(have: number, qty: number): HTMLElement {
  return h('span', { class: have >= qty ? 'have' : 'lack' }, `${Math.min(have, qty)}/${qty}`);
}

// ------------------------------------------------------------------ bag

export function openBag(ui: UI): void {
  const s = app.session;
  if (!s) return;
  const b = app.bundle;
  const p = panel(ui, 'Bag', 'bag');
  let selected: string | undefined;

  const render = () => {
    const bag = s.state.player.bag;
    const ids = Object.keys(bag).sort((x, y) => (b.items[x]?.kind ?? '').localeCompare(b.items[y]?.kind ?? '') || itemName(b, x).localeCompare(itemName(b, y)));
    if (selected && !bag[selected]) selected = undefined;
    const grid = h(
      'div',
      { class: 'slots' },
      ids.map((id) =>
        h(
          'button',
          { class: `slot ${selected === id ? 'on' : ''} r-${b.items[id]?.rarity ?? 'common'}`, type: 'button', title: itemName(b, id), onclick: () => ((selected = id), render()) },
          sprite(b, b.items[id]?.sprite, 2),
          h('span', { class: 'count' }, String(bag[id])),
        ),
      ),
    );
    const detail = selected ? itemDetail(selected, render) : h('p', { class: 'muted' }, ids.length ? 'Pick something to look at it.' : 'Your bag is empty. Gather something!');
    p.body.replaceChildren(h('div', { class: 'bag-head' }, `${bagUsed(s.state)} / ${bagCapacity(b, s.state)} places used`), grid, detail);
  };

  const itemDetail = (id: string, after: () => void): HTMLElement => {
    const item = b.items[id]!;
    const value = b.values[id];
    const actions: HTMLElement[] = [];
    if (item.food) {
      actions.push(button(`Eat (+${item.food.satiety})`, () => {
        const r = s.act({ t: 'eat', item: id });
        if (!r.ok) ui.toast(r.error, 'bad');
        after();
      }));
    }
    if (item.fragment) {
      const recipe = b.recipes[item.fragment.unlocks];
      actions.push(button(`Learn ${recipe?.title ?? 'the recipe'}`, () => {
        const r = s.act({ t: 'learn', item: id });
        if (!r.ok) ui.toast(r.error, 'bad');
        after();
      }));
    }
    const facts: string[] = [];
    if (item.tool) {
      const usesLeft = item.tool.uses - (s.state.player.wear[id] ?? 0);
      const speedBonus = item.tool.tier > 1 ? ` (+${15 * (item.tool.tier - 1)}% gathering speed)` : '';
      facts.push(`${item.tool.kind[0]!.toUpperCase()}${item.tool.kind.slice(1)}, tier ${item.tool.tier}${speedBonus}. ${usesLeft} uses left.`);
    }
    if (value !== undefined && item.kind !== 'tool') facts.push(`A trader pays ${gold(payFor(b.params, value))} gold.`);
    return h(
      'div',
      { class: 'detail' },
      h('div', { class: 'detail-head' }, sprite(b, item.sprite, 3), h('div', null, h('b', null, item.name), h('div', { class: `rarity r-${item.rarity}` }, item.rarity))),
      h('p', null, item.description),
      facts.map((f) => h('p', { class: 'muted' }, f)),
      h('p', { class: 'credit' }, item.creator === 'core' ? 'Added by the core team' : `Added by ${item.creator}`),
      actions.length ? h('div', { class: 'actions' }, actions) : null,
    );
  };
  render();
}

// ------------------------------------------------------------------ journal

type JournalTab = 'tasks' | 'items' | 'recipes' | 'skills';

export function openJournal(ui: UI, tab: JournalTab = 'tasks'): void {
  const s = app.session;
  if (!s) return;
  const b = app.bundle;
  const p = panel(ui, 'Journal', 'journal');
  let current: JournalTab = tab;
  const render = () => {
    const content =
      current === 'tasks' ? tasksTab() : current === 'items' ? itemsTab() : current === 'recipes' ? recipesTab() : skillsTab();
    p.body.replaceChildren(tabs(['tasks', 'items', 'recipes', 'skills'], current, (n) => ((current = n as JournalTab), render())), content);
  };

  const tasksTab = (): HTMLElement => {
    const quests = s.state.player.quests;
    const active = Object.keys(quests).filter((id) => quests[id] === 'active').sort();
    const done = Object.keys(quests).filter((id) => quests[id] === 'done').sort();
    return h(
      'div',
      null,
      active.length === 0 ? h('p', { class: 'muted' }, 'No open tasks. Talk to people in town.') : null,
      active.map((id) => {
        const q = b.quests[id]!;
        return h(
          'div',
          { class: 'card' },
          h('b', null, q.title),
          q.giver ? h('div', { class: 'muted' }, `For ${b.npcs[q.giver]?.name ?? q.giver}`) : null,
          h('p', null, q.summary),
          h('ul', { class: 'steps' }, questSteps(b, s.state, id).map((st) => h('li', { class: st.done ? 'done' : '' }, st.text))),
        );
      }),
      done.length ? h('h3', null, 'Done') : null,
      done.map((id) => h('div', { class: 'done-line' }, b.quests[id]?.title ?? id)),
    );
  };

  const itemsTab = (): HTMLElement => {
    const ids = Object.keys(b.items).sort((x, y) => itemName(b, x).localeCompare(itemName(b, y)));
    const known = new Set(s.state.player.journal);
    return h(
      'div',
      null,
      h('p', { class: 'muted' }, `${known.size} of ${ids.length} found. Every entry names who added it.`),
      h(
        'div',
        { class: 'entries' },
        ids.map((id) => {
          const it = b.items[id]!;
          return known.has(id)
            ? h('div', { class: 'entry' }, sprite(b, it.sprite, 2), h('div', null, h('b', null, it.name), h('div', { class: 'credit' }, it.creator === 'core' ? 'core team' : it.creator)))
            : h('div', { class: 'entry unknown' }, h('span', { class: 'sprite qmark' }, '?'), h('div', null, h('b', null, '???')));
        }),
      ),
    );
  };

  const recipesTab = (): HTMLElement => {
    const known = s.state.player.recipes;
    const hidden = Object.keys(b.recipes).filter((id) => !known.includes(id)).length;
    return h(
      'div',
      null,
      known.map((id) => {
        const r = b.recipes[id]!;
        return h(
          'div',
          { class: 'card recipe' },
          sprite(b, b.items[r.outputs[0]?.item ?? '']?.sprite, 2),
          h('div', null, h('b', null, r.title), h('div', { class: 'muted' }, `${stacks(b, r.inputs)} at the ${r.station}, ${seconds(r.active_ms)}${r.level > 1 ? `, cooking level ${r.level}` : ''}`)),
        );
      }),
      hidden ? h('p', { class: 'muted' }, `${hidden} more recipe${hidden > 1 ? 's' : ''} to discover - from tasks and from scraps in the ruins.`) : null,
    );
  };

  const skillsTab = (): HTMLElement => {
    const st = s.state;
    const points = skillPoints(b, st);
    const effects = attributeEffects(b, st);
    return h(
      'div',
      null,
      h('p', null, h('b', null, `${st.player.name}, level ${characterLevel(b, st)}`), points > 0 ? ` - ${points} skill point${points > 1 ? 's' : ''} to spend` : ''),
      h(
        'div',
        { class: 'attrs' },
        effects.map((fx) => {
          const value = st.player.attrs[fx.attr];
          const full = value >= ATTRIBUTE_MAX;
          return h(
            'div',
            { class: 'attr' },
            h('span', { class: 'attr-name' }, `${fx.name} - ${fx.what}`),
            h('span', { class: 'pips' }, Array.from({ length: ATTRIBUTE_MAX }, (_, i) => h('i', { class: i < value ? 'on' : '' }))),
            h('span', { class: 'muted' }, `${fx.now} -> ${full ? 'at its limit' : fx.next}`),
            fx.note ? h('span', { class: 'muted' }, fx.note) : null,
            points > 0 && !full
              ? button('+', () => {
                  const r = s.act({ t: 'spend', attr: fx.attr });
                  if (!r.ok) ui.toast(r.error, 'bad');
                  render();
                }, 'small plus')
              : null,
          );
        }),
      ),
      h('h3', null, 'Professions'),
      Object.entries(b.professions)
        .sort(([x], [y]) => x.localeCompare(y))
        .map(([id, prof]) => {
          const level = professionLevel(b, st, id);
          const xp = st.player.xp[id] ?? 0;
          const prev = level >= 2 ? (prof.xp_levels[level - 2] ?? 0) * 1000 : 0;
          const next = prof.xp_levels[level - 1];
          const pct = next === undefined ? 100 : Math.floor(((xp - prev) / (next * 1000 - prev)) * 100);
          const upcoming = prof.techniques.find((t) => t.level > level);
          return h(
            'div',
            { class: 'card' },
            h('b', null, `${prof.name} ${level}`),
            h('span', { class: 'meter-bar wide' }, h('i', { style: `width:${Math.max(0, Math.min(100, pct))}%` })),
            prof.techniques.filter((t) => t.level <= level).map((t) => h('div', { class: 'tech' }, `${t.name}: ${t.text}`)),
            upcoming ? h('div', { class: 'muted' }, `At level ${upcoming.level}: ${upcoming.name}`) : null,
          );
        }),
    );
  };
  render();
}

// ------------------------------------------------------------------ shop

export function openShop(ui: UI, npcId: string): void {
  const s = app.session;
  const b = app.bundle;
  const npc = b.npcs[npcId];
  const shop = npc?.shop ? b.shops[npc.shop] : undefined;
  if (!s || !npc || !shop) return;
  const p = panel(ui, `${npc.name}'s stall`, 'shop');
  let current: 'buy' | 'sell' = 'buy';

  const deal = (action: () => { ok: boolean; error?: string }) => {
    const r = action();
    if (!r.ok && r.error) ui.toast(r.error, 'bad');
    render();
  };

  const render = () => {
    const st = s.state;
    const room = bagCapacity(b, st) - bagUsed(st);
    const rows =
      current === 'buy'
        ? shop.sells.map((o) => {
            const it = b.items[o.item];
            const opens = it?.tool ? toolOpens(b, st, it.tool.kind) : [];
            return h(
              'div',
              { class: 'row' },
              sprite(b, it?.sprite, 2),
              h(
                'div',
                { class: 'grow' },
                h('b', null, it?.name ?? o.item),
                h('div', { class: 'muted' }, itemBenefit(b, o.item)),
                opens.length ? h('div', { class: 'muted', 'data-opens': '' }, `Opens: ${opens.join(', ')}`) : null,
              ),
              h('span', { class: 'price' }, gold(o.price_mg)),
              button('Buy', () => deal(() => s.act({ t: 'buy', npc: npcId, item: o.item, qty: 1, at: s.pos })), 'small', st.player.gold < o.price_mg || room < 1),
            );
          })
        : Object.keys(st.player.bag)
            .filter((id) => b.items[id]?.kind !== 'tool' && b.values[id] !== undefined)
            .sort((x, y) => itemName(b, x).localeCompare(itemName(b, y)))
            .map((id) => {
              const each = payFor(b.params, b.values[id]!);
              const count = st.player.bag[id] ?? 0;
              return h(
                'div',
                { class: 'row' },
                sprite(b, b.items[id]?.sprite, 2),
                h('div', { class: 'grow' }, h('b', null, `${itemName(b, id)} x${count}`), h('div', { class: 'muted' }, `${gold(each)} gold each`)),
                button('Sell 1', () => deal(() => s.act({ t: 'sell', npc: npcId, item: id, qty: 1, at: s.pos })), 'small', each < 1),
                count > 1 ? button('All', () => deal(() => s.act({ t: 'sell', npc: npcId, item: id, qty: Math.min(99, count), at: s.pos })), 'small', each < 1) : null,
              );
            });
    p.body.replaceChildren(
      tabs(shop.buys ? ['buy', 'sell'] : ['buy'], current, (n) => ((current = n as 'buy' | 'sell'), render())),
      h('div', { class: 'wallet' }, h('i', { class: 'coin' }), `${gold(st.player.gold)} gold`, h('span', { class: 'muted' }, ` - ${room} free places in your bag`)),
      ...(rows.length ? rows : [h('p', { class: 'muted' }, current === 'sell' ? 'Nothing to sell.' : 'Sold out.')]),
    );
  };
  render();
}

// ------------------------------------------------------------------ cooking

export function openCraft(ui: UI, station: string): void {
  const s = app.session;
  if (!s) return;
  const b = app.bundle;
  const p = panel(ui, station === 'fire' ? 'Cook at the fire' : `The ${station}`, 'craft');
  const render = () => {
    const st = s.state;
    const known = st.player.recipes.filter((id) => b.recipes[id]?.station === station);
    p.body.replaceChildren(
      ...known.map((id) => {
        const r = b.recipes[id]!;
        const out = r.outputs[0];
        // a dry run gives the kernel's own reason, e.g. a level not reached yet
        const why = s.check({ t: 'craft', recipe: id, at: s.pos });
        return h(
          'div',
          { class: 'row' },
          sprite(b, b.items[out?.item ?? '']?.sprite, 2),
          h(
            'div',
            { class: 'grow' },
            h('b', null, r.title),
            h('div', { class: 'needs' }, r.inputs.map((i) => h('span', null, `${itemName(b, i.item)} `, need(st.player.bag[i.item] ?? 0, i.qty)))),
            h('div', { class: 'muted' }, `${seconds(r.active_ms)}${r.level > 1 ? ` - cooking level ${r.level}` : ''}`),
            why && r.inputs.every((i) => (st.player.bag[i.item] ?? 0) >= i.qty) ? h('div', { class: 'lack' }, why) : null,
          ),
          button('Cook', () => {
            const res = s.act({ t: 'craft', recipe: id, at: s.pos });
            if (!res.ok) ui.toast(res.error, 'bad');
            else p.close();
          }, 'small', why !== undefined),
        );
      }),
      known.length === 0 ? h('p', { class: 'muted' }, 'You know no recipes for this yet.') : h('p', { class: 'muted' }, 'Cooked food goes to your bag. Eat it from there.'),
    );
  };
  render();
}

// ------------------------------------------------------------------ building and mending

export function confirmBuild(ui: UI, campId: string): void {
  const s = app.session;
  const b = app.bundle;
  const c = b.camps[campId];
  if (!s || !c) return;
  const have = c.inputs.map((i) => `${i.qty} ${itemName(b, i.item)} (you have ${s.state.player.bag[i.item] ?? 0})`).join(', ');
  const ok = c.inputs.every((i) => (s.state.player.bag[i.item] ?? 0) >= i.qty);
  const what = c.provides === 'fire' ? 'Somewhere to cook.' : c.bag_bonus ? `Your bag holds ${c.bag_bonus} more.` : 'A place for what you find.';
  void say(ui, c.title, [`${what} Needs ${have}.`], ok ? [{ label: 'Build it', value: 'yes' }, { label: 'Not now', value: 'no' }] : []).then((pick) => {
    if (pick !== 'yes') return;
    const r = s.act({ t: 'build', camp: campId, at: s.pos });
    if (!r.ok) ui.toast(r.error, 'bad');
  });
}

export function confirmRestore(ui: UI, restoreId: string): void {
  const s = app.session;
  const b = app.bundle;
  const r = b.restores[restoreId];
  if (!s || !r) return;
  if (r.inputs.length === 0) {
    // nothing to bring: it opens only as a quest's reward
    void say(ui, r.title, [restoreHint(b, s.state, restoreId)], []);
    return;
  }
  const have = r.inputs.map((i) => `${i.qty} ${itemName(b, i.item)} (you have ${s.state.player.bag[i.item] ?? 0})`).join(', ');
  const ok = r.inputs.every((i) => (s.state.player.bag[i.item] ?? 0) >= i.qty);
  void say(ui, r.title, [`It is broken. Mending it takes ${have}.`], ok ? [{ label: 'Mend it', value: 'yes' }, { label: 'Not now', value: 'no' }] : []).then((pick) => {
    if (pick !== 'yes') return;
    const res = s.act({ t: 'restore', restore: restoreId, at: s.pos });
    if (!res.ok) ui.toast(res.error, 'bad');
  });
}

// ------------------------------------------------------------------ menu and help

export function openMenu(ui: UI): void {
  const p = panel(ui, 'Menu', 'menu');
  const go = (fn: () => void) => () => {
    p.close();
    fn();
  };
  const render = () => {
    p.body.replaceChildren(
      h(
        'div',
        { class: 'menu-list' },
        button(`Sound: ${sound.muted ? 'Off' : 'On'}`, () => {
          sound.setMuted(!sound.muted);
          render();
        }),
        button('Controls', go(() => openControls(ui))),
        button('Creator guide', go(() => openGuide(ui))),
        button('Creators', go(() => openCreators(ui))),
        button('Credits', go(() => openCredits(ui))),
        button('Send feedback', go(() => openFeedback(ui))),
        button('Report a problem', go(() => openReport(ui))),
        button('About this demo', go(() => ui.aboutDemo())),
        button('Start over', go(() => startOver(ui)), 'danger'),
      ),
      h('p', { class: 'muted version' }, `${GAME_TITLE} demo - content ${app.bundle.tag.slice(0, 8)} - kernel ${KERNEL_VERSION}`),
    );
  };
  render();
}

// ------------------------------------------------------------------ feedback

/** Where the player is, from the game alone: no name, address or account. */
export function feedbackContext(): FeedbackContext {
  const s = app.session;
  const b = app.bundle;
  const at = s?.pos ?? [b.map.spawn.x, b.map.spawn.y];
  return {
    map: b.map.id,
    tile: [Math.round(at[0]), Math.round(at[1])],
    quest: s ? (activeQuests(b, s.state)[0] ?? null) : null,
    hour: s ? clock(minuteOfDay(b, s.tick)) : '0:00',
    build: `content ${b.tag.slice(0, 8)} kernel ${KERNEL_VERSION}`,
  };
}

/** Sends a payload; on failure shows why and returns false so the caller keeps the text. */
async function deliver(payload: FeedbackPayload, note: HTMLElement): Promise<boolean> {
  const r = await sendFeedback(payload);
  if (r.ok) return true;
  note.textContent = failureMessage(r.reason);
  return false;
}

export function openFeedback(ui: UI): void {
  const p = panel(ui, 'Feedback', 'report');
  const text = h('textarea', { rows: 5, maxlength: FEEDBACK_TEXT_MAX, placeholder: 'What do you think? What was good, what was not?' });
  const note = h('p', { class: 'error', role: 'status' });
  let busy = false;
  const send = button('Send', () => {
    if (busy) return;
    const payload = buildFeedbackPayload('feedback', text.value, feedbackContext());
    if (isEmptyFeedback(payload)) {
      note.textContent = 'Write something first.';
      return;
    }
    busy = true;
    send.disabled = true;
    note.textContent = '';
    void deliver(payload, note).then((ok) => {
      busy = false;
      send.disabled = false;
      if (!ok) return;
      p.close();
      ui.toast('Thank you. Your message was sent.', 'good');
    });
  });
  p.body.replaceChildren(
    h('p', null, 'Tell us what you think. Your message carries where you are in the game and the version, nothing about you.'),
    text,
    note,
    h('div', { class: 'actions' }, send),
  );
  text.focus();
}

const LIKED = ['The story', 'The look', 'The music', 'Exploring', 'Gathering and crafting', 'The people'];
const CONFUSED = ['What to do next', 'The controls', 'The menus', 'Where to go', 'How things work'];

/** Has the player already answered, or skipped, the development review in this save? */
export function reviewAsked(): boolean {
  try {
    return localStorage.getItem(REVIEW_KEY) !== null;
  } catch {
    return false;
  }
}

function markReviewAsked(): void {
  try {
    localStorage.setItem(REVIEW_KEY, '1');
  } catch {
    // storage may be blocked; the review may then be offered again
  }
}

/**
 * The one-time development review: 1-5, what felt best, what confused you,
 * one line. Skippable; asked once per save (the flag is cleared by Start over).
 * Resolves when the pop-up closes. Does nothing if it was already asked.
 */
export function openOpeningReview(ui: UI): Promise<void> {
  if (reviewAsked()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const p = panel(ui, 'How is the game so far?', 'report');
    let rating = 0;
    const liked = new Set<string>();
    const confused = new Set<string>();
    const note = h('p', { class: 'error', role: 'status' });
    const text = h('input', { type: 'text', maxlength: 200, placeholder: 'One line, if you like', class: 'review-line' });
    const chips = (title: string, names: string[], into: Set<string>) =>
      h(
        'div',
        null,
        h('h3', null, title),
        h(
          'nav',
          { class: 'tabs' },
          names.map((n) => {
            const b = button(n, () => {
              if (into.has(n)) into.delete(n);
              else into.add(n);
              b.className = into.has(n) ? 'btn tab on' : 'btn tab';
            }, 'tab');
            return b;
          }),
        ),
      );
    const stars = h('nav', { class: 'tabs' });
    const drawStars = () =>
      stars.replaceChildren(
        ...[1, 2, 3, 4, 5].map((n) =>
          button(String(n), () => {
            rating = n;
            drawStars();
          }, n === rating ? 'tab on' : 'tab'),
        ),
      );
    drawStars();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      markReviewAsked();
      resolve();
    };
    const send = button('Send', () => {
      const payload = buildFeedbackPayload('review', text.value, feedbackContext(), {
        ...(rating ? { rating } : {}),
        liked: [...liked],
        confused: [...confused],
      });
      if (isEmptyFeedback(payload)) {
        note.textContent = 'Pick something, or skip.';
        return;
      }
      send.disabled = true;
      void deliver(payload, note).then((ok) => {
        send.disabled = false;
        if (!ok) return; // the choices stay on screen; Skip still closes it
        finish();
        p.close();
        ui.toast('Thank you. Your answer was sent.', 'good');
      });
    });
    const skip = button('Skip', () => {
      finish();
      p.close();
    }, 'small');
    p.body.replaceChildren(
      h('p', null, 'A few quick questions, once. Nothing about you is sent.'),
      h('h3', null, 'How was it?'),
      stars,
      chips('What felt best?', LIKED, liked),
      chips('What confused you?', CONFUSED, confused),
      text,
      note,
      h('div', { class: 'actions' }, send, skip),
    );
    // closing with the Close button or a click outside counts as a skip
    p.layer.el.addEventListener('click', () => {
      if (!p.layer.el.isConnected) finish();
    });
    const closeBtn = p.layer.el.querySelector('.close');
    closeBtn?.addEventListener('click', () => finish());
  });
}

function openControls(ui: UI): void {
  const p = panel(ui, 'Controls');
  p.body.replaceChildren(
    h(
      'table',
      { class: 'keys' },
      [
        ['Walk', 'Arrows or WASD - the pad on a phone'],
        ['Act (A)', 'Space, E, Z or Enter - the A button'],
        ['Back (B)', 'Esc or X - the B button'],
        ['Bag', 'I'],
        ['Journal', 'J'],
        ['Menu', 'M'],
      ].map(([k, v]) => h('tr', null, h('th', null, k), h('td', null, v))),
    ),
    h('p', { class: 'muted' }, 'Stand next to something and press A. The bar shows what A will do.'),
  );
}

const AI_CREATOR_INSTRUCTIONS = `I want to add a new content extension to Openfold (a community-built 2D RPG).
Use the complete creator guide included below as your instructions. Help me choose a small addition, create the required files, and validate it with the commands in the guide.`;

export function openGuide(ui: UI): void {
  const p = panel(ui, 'Creator guide', 'guide wide');
  const article = h('article', { class: 'md' });
  article.innerHTML = markdown(guideText);

  const copyText = async (text: string, copyBtn: HTMLButtonElement, copiedLabel: string) => {
    const original = copyBtn.textContent ?? 'Copy';
    try {
      await navigator.clipboard.writeText(text);
      ui.toast(copiedLabel, 'good');
      copyBtn.textContent = 'Copied!';
      window.setTimeout(() => {
        copyBtn.textContent = original;
      }, 2000);
    } catch {
      ui.toast('Failed to copy to clipboard', 'bad');
    }
  };

  const copyBtn = button('Copy guide for AI', () => {
    void copyText(`${AI_CREATOR_INSTRUCTIONS}\n\n--- COMPLETE CREATOR GUIDE ---\n\n${guideText}`, copyBtn, 'Copied the instructions and full guide!');
  }, 'small');

  for (const code of article.querySelectorAll('pre code')) {
    const copyCode = button('Copy', () => {
      void copyText(code.textContent ?? '', copyCode, 'Copied code block!');
    }, 'small');
    code.parentElement?.before(copyCode);
  }

  const welcome = h(
    'div',
    { class: 'card dev-welcome' },
    h('b', null, 'Welcome, creators & developers!'),
    h(
      'p',
      { class: 'muted' },
      'Openfold is built together by the community. Every bush, recipe, sign, and ruin is a declarative JSON file in the repo. Use this guide to add your own part of the world in 10 minutes - by hand or with your favorite AI tool.',
    ),
    h('div', { class: 'actions' }, copyBtn),
  );

  p.body.replaceChildren(
    welcome,
    article,
    h('p', null, h('a', { href: `${REPO_URL}/blob/main/docs/creators/README.md`, target: '_blank', rel: 'noopener' }, 'Read it on GitHub')),
  );
}

function openCreators(ui: UI): void {
  const b = app.bundle;
  const p = panel(ui, 'Creators', 'wide');
  const creators = Object.entries(b.creators).sort(([a], [z]) => (a === 'core' ? -1 : z === 'core' ? 1 : a.localeCompare(z)));
  p.body.replaceChildren(
    ...creators.map(([handle, profile]) => {
      const entry = b.board[handle];
      return h(
        'div',
        { class: 'card' },
        h('b', null, profile.name),
        profile.role ? h('div', { class: 'muted' }, profile.role) : null,
        h('div', null, `${entry?.points ?? 0} creator points - ${entry?.records ?? 0} records, ${entry?.commits ?? 0} commits`),
      );
    }),
  );
}

function openCredits(ui: UI): void {
  const b = app.bundle;
  const p = panel(ui, 'Credits', 'credits wide');
  const byCreator = new Map<string, typeof b.credits>();
  for (const c of b.credits) byCreator.set(c.creator, [...(byCreator.get(c.creator) ?? []), c]);
  p.body.replaceChildren(
    h('p', null, 'Everything in this world names who made it. Content is CC BY-SA 4.0, code is AGPL-3.0.'),
    ...[...byCreator.entries()].map(([creator, list]) => {
      const tools = [...new Set(list.flatMap((c) => c.ai_tools))];
      return h(
        'div',
        { class: 'card' },
        h('b', null, creator === 'core' ? 'The core team' : creator),
        h('div', { class: 'muted' }, `${list.length} files: ${list.map((c) => c.title).slice(0, 12).join(', ')}${list.length > 12 ? ', ...' : ''}`),
        tools.length ? h('div', { class: 'muted' }, `Made with: ${tools.join(', ')}`) : null,
      );
    }),
    h('div', { class: 'card' }, h('b', null, 'Also'), h('div', { class: 'muted' }, 'Engine: Phaser (MIT). Font: Pixelify Sans by Stefie Justprince (SIL Open Font License).')),
  );
}

function openReport(ui: UI): void {
  const s = app.session;
  const b = app.bundle;
  const p = panel(ui, 'Report a problem', 'report');
  const text = h('textarea', { rows: 5, maxlength: 1200, placeholder: 'What happened, and what did you expect?' });
  const attach = h('input', { type: 'checkbox', checked: true });
  const go = button('Open a GitHub issue', () => {
    const lines = [
      '### What happened',
      text.value.trim() || '(not described)',
      '',
      '### Where',
      `content ${b.tag}, kernel ${KERNEL_VERSION}, ${navigator.userAgent}`,
    ];
    if (attach.checked && s) {
      lines.push('', `position ${s.pos.join(',')}, tick ${s.tick}`, '', '<details><summary>Last actions</summary>', '', '```json');
      let tail = JSON.stringify(s.tail.slice(-15));
      if (tail.length > 4500) tail = JSON.stringify(s.tail.slice(-5));
      lines.push(tail, '```', '</details>');
    }
    const url = `${REPO_URL}/issues/new?labels=bug&title=${encodeURIComponent('Bug: ')}&body=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener');
  });
  p.body.replaceChildren(
    h('p', null, 'This opens a prefilled issue on GitHub. You need a GitHub account.'),
    text,
    h('label', { class: 'check' }, attach, ' Attach the game version and my last actions (no personal data)'),
    h('div', { class: 'actions' }, go),
  );
  text.focus();
}

function startOver(ui: UI): void {
  void say(ui, 'Start over?', ['This erases your progress in this browser. It cannot be undone.'], [
    { label: 'Erase and start over', value: 'yes' },
    { label: 'Keep playing', value: 'no' },
  ]).then((pick) => {
    if (pick !== 'yes') return;
    Session.erase();
    location.reload();
  });
}

/** A filled sign: the creator's signature as it hangs over the sign, who they are and what they gave. */
export function openSignCard(ui: UI, info: SignInfo): void {
  const c = info.creator;
  if (!c) return;
  const p = panel(ui, info.title, 'sign-card');
  const sig = c.signature;
  const mark = h('div', { class: `signature sig-${sig?.style ?? 'ink'}` });
  if (sig?.glyph && sig.glyph !== 'none') mark.append(h('i', { class: `glyph g-${sig.glyph}` }));
  mark.append(sig?.text ?? c.name);
  const stat = (value: string, label: string) => h('div', { class: 'sign-stat' }, h('b', null, value), h('span', null, label));
  const hasBoard = c.points !== undefined || c.commits !== undefined;
  const parts: (HTMLElement | null)[] = [
    mark,
    h('p', { class: 'sign-who' }, `Added by ${c.name}`, c.role ? h('small', null, c.role) : null),
    hasBoard
      ? h('div', { class: 'sign-stats' }, stat(String(c.points ?? 0), 'creator points'), stat(String(c.commits ?? 0), 'commits'))
      : null,
    c.ai.length ? h('div', { class: 'sign-tools' }, h('p', { class: 'sign-note' }, 'Made with'), c.ai.map((t) => h('span', null, t))) : null,
    c.mendedBy ? h('p', { class: 'sign-mended' }, `Mended by ${c.mendedBy}`) : null,
  ];
  p.body.replaceChildren(...parts.filter((x): x is HTMLElement => x !== null));
}
