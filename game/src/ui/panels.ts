/**
 * The menus: bag, journal, shop, cooking and making, building, and the help pages.
 * Every change goes through session.act(), so a menu can never do what the
 * kernel would refuse.
 */
import {
  KERNEL_VERSION,
  WEAR_SLOTS,
  bagCapacity,
  bagUsed,
  placeRoom,
  attrAt,
  characterLevel,
  minuteOfDay,
  professionLevel,
  rareFindPermille,
  recipeTier,
  salePrice,
  setComplete,
  setPieces,
  skillPoints,
  wornValue,
  type WearSlot,
} from '@game/kernel';
import { app } from '../app';
import { loadChipFor } from './load';
import { SettingsApplier } from '../settings-apply';
import { settingsBody } from './settings-window';
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
import type { StoneView } from '../stone';
import { Session, STALL_SLOTS, stallDraftOf, type StallDraft } from '../session';
import type { GameSession } from '../session-surface';
import type { ActResult } from '../session-surface';
import { SEARCH_EMPTY, SEARCH_LUCK_LINE, searchRows, ATTRIBUTE_MAX, activeQuests, attributeEffects, bagGroups, classLine, clock, eatLabel, gold, itemBenefit, itemName, journalGroups, questSteps, restoreHint, seconds, sellable, stacks, stationGate, stationText, stationUpgrades, toolOpens, wornAt } from '../text';
import { s1, s1Available } from '../net/s1';
import { shopGroups } from '../shopstock';
import { STALL_SLOT, canPlaceStall, directionOf, localMapState, mapPlaces } from '../places';
import { say } from './dialog';
import { button, h, sprite } from './dom';
import { treeScreen, type TreeMemo } from './tree';
import { mapSvg, placeKind } from './map';
import type { Layer, UI } from './ui';

interface Panel {
  layer: Layer;
  body: HTMLElement;
  close: () => void;
}

function panel(ui: UI, title: string, cls = '', subtitle?: string): Panel {
  const body = h('div', { class: 'panel-body' });
  const titleEl = h('div', { class: 'panel-head' }, h('h2', { class: 'ui-plaque' }, title), subtitle ? h('p', { class: 'panel-sub' }, subtitle) : null);
  const closeBtn = button('Close', () => ui.pop(layer), 'close small');
  const box = h('div', { class: `panel ui-window ${cls}`.trim(), role: 'dialog', 'aria-label': title }, h('header', null, titleEl, closeBtn), body);
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

/** An item's name in its rarity's colour (theme.css), so a rare thing reads as rare wherever it is named. */
function itemTitle(rarity: string | undefined, text: string): HTMLElement {
  return h('b', { class: `item-name rarity-${rarity ?? 'common'}` }, text);
}

function need(have: number, qty: number): HTMLElement {
  return h('span', { class: have >= qty ? 'have' : 'lack' }, `${Math.min(have, qty)}/${qty}`);
}

// ------------------------------------------------------------------ kit

/** The effects the kit summarizes, in the order the card shows them. */
type KitTab = 'bag' | 'outfit' | 'skills' | 'shop';

const KIT_EFFECTS: readonly [string, string][] = [
  ['gather_speed_pct', 'Gathering'],
  ['craft_chance_pct', 'Craft'],
  ['rare_find_pct', 'Rare finds'],
];

const SLOT_LABEL: Record<WearSlot, string> = {
  head: 'Head',
  top: 'Top',
  legs: 'Legs',
  outfit: 'Outfit',
  feet: 'Feet',
  jewelry1: 'Jewel 1',
  jewelry2: 'Jewel 2',
  hand: 'Hand',
  back: 'Back',
};

/** A set id is its creator's path and a name; the card reads the name alone. */
function setLabel(id: string): string {
  const name = id.split('/').pop() ?? id;
  return name.replaceAll('-', ' ').replace(/^./, (c) => c.toUpperCase());
}

function kitEffects(s: GameSession): { label: string; value: number }[] {
  return KIT_EFFECTS.map(([effect, label]) => ({ label, value: wornValue(app.bundle, s.state, effect) }));
}

/** The first set the work clothes touch, with how many of its pieces are on. */
function kitSet(s: GameSession): { name: string; held: number; total: number; full: boolean } | undefined {
  const b = app.bundle;
  const worn = Object.values(s.state.player.worn);
  for (const [set, ids] of Object.entries(setPieces(b))) {
    const held = ids.filter((id) => worn.includes(id)).length;
    if (held > 0) return { name: setLabel(set), held, total: ids.length, full: setComplete(b, s.state, set) };
  }
  return undefined;
}

/** The attributes, their real before-to-after numbers, the professions and the techniques known at each level. */
function skillsBody(ui: UI, after: () => void): HTMLElement {
  const s = app.session;
  const b = app.bundle;
  if (!s) return h('p', { class: 'muted' }, 'No character yet.');
  const st = s.state;
  const points = skillPoints(b, st);
  return h(
    'div',
    null,
    h('p', null, h('b', null, `${st.player.name ? `${st.player.name}, level` : 'Level'} ${characterLevel(b, st)}`), points > 0 ? ` - ${points} skill point${points > 1 ? 's' : ''} to spend` : ''),
    h(
      'div',
      { class: 'attrs' },
      attributeEffects(b, st).map((fx) => {
        // the pips show what the attribute counts for here (race base, spent points, the world's grade); the limit is on the base
        const value = attrAt(b, st, fx.attr);
        const full = st.player.attrs[fx.attr] >= ATTRIBUTE_MAX;
        return h(
          'div',
          { class: 'attr' },
          h('span', { class: 'attr-name' }, `${fx.name} - ${fx.what}`),
          h('span', { class: 'pips' }, Array.from({ length: ATTRIBUTE_MAX }, (_, i) => h('i', { class: i < value ? 'on' : '' }))),
          h('span', { class: 'muted' }, `${fx.now} -> ${full ? 'at its limit' : fx.next}`),
          fx.note ? h('span', { class: 'muted' }, fx.note) : null,
          points > 0 && !full
            ? button('+', async () => {
                const r = await s.act({ t: 'spend', attr: fx.attr });
                if (!r.ok) ui.toast(r.error, 'bad');
                after();
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
}

export function openBag(ui: UI): void {
  const s = app.session;
  if (!s || s.waiting) return;
  const b = app.bundle;
  const p = panel(ui, 'Your kit', 'bag');
  let selected: string | undefined;
  let tab: KitTab = 'bag';
  let filter = 'All';
  let look = false;
  let shopPick: string | undefined;
  let priceFor: { item: string; slot: number } | undefined;
  // the skill tree keeps where it looks and the node chosen while the kit stays open
  const treeMemo: TreeMemo = {};
  // the draft is kept in the save; a session that keeps none (the server door) keeps it in this panel
  const stall: (StallDraft | null)[] = stallDraftOf(s) ?? Array.from({ length: STALL_SLOTS }, () => null);

  const layer = () => (look ? s.state.player.looks : s.state.player.worn);
  const figure = () => {
    const race = b.races[s.state.player.race] ?? Object.entries(b.races).sort(([x], [y]) => x.localeCompare(y))[0]?.[1];
    const ref = (s.state.player.look === 1 && race?.sprite_alt) || race?.sprite;
    return sprite(b, ref, 3, 1);
  };
  const pick = (id: string) => {
    selected = id;
    tab = 'bag';
    render();
  };

  const slotButton = (slot: WearSlot, big = false): HTMLElement => {
    const id = layer()[slot];
    const item = id ? b.items[id] : undefined;
    const label = SLOT_LABEL[slot];
    if (!item) return h('div', { class: `kit-slot empty ${big ? 'big' : ''}`.trim(), title: `${label}: empty` }, h('span', { class: 'lab' }, label));
    return h(
      'button',
      {
        class: `kit-slot ${big ? 'big' : ''}`.trim(),
        type: 'button',
        title: `${label}: ${item.name}`,
        'aria-label': `${label}: ${item.name}`,
        onclick: () => pick(id!),
      },
      sprite(b, item.sprite, big ? 3 : 2),
      h('span', { class: 'lab' }, label),
    );
  };

  const toggle = (): HTMLElement =>
    h(
      'div',
      { class: 'kit-toggle' },
      h('button', { class: look ? '' : 'on', type: 'button', 'aria-pressed': String(!look), onclick: () => ((look = false), render()) }, 'Work'),
      h('button', { class: look ? 'on' : '', type: 'button', 'aria-pressed': String(look), onclick: () => ((look = true), render()) }, 'Look'),
    );

  const bagView = (): HTMLElement => {
    const ids = Object.keys(s.state.player.bag).sort((x, y) => itemName(b, x).localeCompare(itemName(b, y)));
    const groups = bagGroups(b, ids);
    const labels = ['All', ...groups.map((g) => g.label)];
    if (filter !== 'All' && !labels.includes(filter)) filter = 'All';
    const shown = filter === 'All' ? ids : (groups.find((g) => g.label === filter)?.ids ?? []);
    const cap = bagCapacity(b, s.state);
    const count = filter === 'All' ? Math.max(cap, shown.length) : shown.length;
    const cells = Array.from({ length: count }, (_, i) => {
      const id = shown[i];
      if (!id) return h('div', { class: 'kit-cell empty' });
      const item = b.items[id]!;
      const n = s.state.player.bag[id] ?? 0;
      return h(
        'button',
        {
          class: `kit-cell r-${item.rarity} ${selected === id ? 'on' : ''}`.trim(),
          type: 'button',
          title: `${itemName(b, id)} x${n}`,
          'aria-label': `${itemName(b, id)}, ${n}`,
          onclick: () => pick(id),
        },
        sprite(b, item.sprite, 2),
        h('span', { class: 'count' }, String(n)),
      );
    });
    const used = bagUsed(b, s.state);
    return h(
      'section',
      { class: 'kit-bag' },
      h(
        'div',
        { class: 'kit-bag-head' },
        h(
          'div',
          { class: 'kit-filters' },
          labels.map((label) =>
            h('button', { class: `kit-filter ${filter === label ? 'on' : ''}`.trim(), type: 'button', onclick: () => ((filter = label), render()) }, label),
          ),
        ),
        h('span', { class: 'kit-cap' }, loadChipFor(b, s.state)),
      ),
      ids.length === 0
        ? h('p', { class: 'kit-hint' }, 'Your bag is empty. Gather something!')
        : h('div', { class: 'kit-grid' }, cells, shown.length === 0 ? h('p', { class: 'kit-hint' }, 'Nothing here yet.') : null),
      h(
        'div',
        { class: 'kit-foot' },
        h('span', null, `${used} of ${cap}`),
        h('span', { class: 'kit-bar' }, h('i', { style: `width:${Math.round((used / Math.max(1, cap)) * 100)}%` })),
        h('span', null, `${Math.max(0, cap - used)} free`),
      ),
    );
  };

  const detailView = (): HTMLElement =>
    h(
      'section',
      { class: 'kit-detail', 'aria-live': 'polite' },
      selected
        ? itemDetail(selected, render)
        : h('div', { class: 'detail kit-card empty' }, h('p', { class: 'kit-hint' }, Object.keys(s.state.player.bag).length ? 'Pick an item to read it.' : 'Your bag is empty. Gather something!')),
    );

  const wornView = (): HTMLElement => {
    const fx = kitEffects(s);
    const set = kitSet(s);
    const slots = WEAR_SLOTS;
    const rows = slots.map((slot) => {
      const id = layer()[slot];
      const item = id ? b.items[id] : undefined;
      return h(
        'button',
        { class: 'worn-row', type: 'button', disabled: !item, onclick: () => item && id && pick(id) },
        h('span', { class: 'worn-slot' }, SLOT_LABEL[slot]),
        h('span', { class: 'worn-name' }, item?.name ?? 'Empty'),
      );
    });
    return h(
      'section',
      { class: 'kit-worn' },
      h(
        'div',
        { class: 'worn-stage' },
        h('div', { class: 'worn-slots' }, slots.slice(0, 4).map((slot) => slotButton(slot, true))),
        h('div', { class: 'worn-figure' }, figure()),
        h('div', { class: 'worn-slots' }, slots.slice(4).map((slot) => slotButton(slot, true))),
        toggle(),
      ),
      h(
        'div',
        { class: 'worn-side' },
        h('div', { class: 'kit-effects' }, fx.map((e) => h('span', null, `${e.label} `, h('b', null, `+${e.value}%`)))),
        set ? h('div', { class: 'kit-set' }, `${set.name} set ${set.held}/${set.total}${set.full ? ' · full' : ''}`) : null,
        h('div', { class: 'worn-list' }, rows),
      ),
    );
  };

  const shopView = (): HTMLElement => {
    const ids = Object.keys(s.state.player.bag).sort((x, y) => itemName(b, x).localeCompare(itemName(b, y)));
    const rows = ids.map((id) => {
      const item = b.items[id]!;
      const n = s.state.player.bag[id] ?? 0;
      return h(
        'button',
        {
          class: `shop-item ${shopPick === id ? 'on' : ''}`.trim(),
          type: 'button',
          draggable: 'true',
          title: `Drag ${item.name} to a stall slot`,
          onclick: () => {
            shopPick = id;
            render();
          },
          ondragstart: (e: Event) => {
            const de = e as DragEvent;
            de.dataTransfer?.setData('text/plain', id);
            if (de.dataTransfer) de.dataTransfer.effectAllowed = 'move';
          },
        },
        sprite(b, item.sprite, 2),
        h('span', { class: 'shop-name' }, item.name),
        h('span', { class: 'shop-count' }, `x${n}`),
      );
    });
    const slots = stall.map((d, i) => {
      const item = d ? b.items[d.item] : undefined;
      return h(
        'div',
        {
          class: `shop-slot ${d ? 'filled' : ''} ${priceFor?.slot === i ? 'pricing' : ''}`.trim(),
          role: 'button',
          tabindex: '0',
          'aria-label': d ? `${item?.name ?? d.item}, ${d.qty > 1 ? `${d.qty} at ` : ''}${d.price} gold${d.qty > 1 ? ' each' : ''}` : `Stall slot ${i + 1}, empty`,
          title: d ? 'Change the price, or take it off' : 'Drop an item here',
          ondragover: (e: Event) => e.preventDefault(),
          ondrop: (e: Event) => {
            e.preventDefault();
            const id = (e as DragEvent).dataTransfer?.getData('text/plain');
            if (id && b.items[id]) openPrice(id, i);
          },
          onclick: () => {
            if (shopPick) openPrice(shopPick, i);
            else if (d) openPrice(d.item, i);
          },
          onkeydown: (e: Event) => {
            const k = (e as KeyboardEvent).key;
            const held = d && !shopPick ? d.item : shopPick;
            if (held && (k === 'Enter' || k === ' ')) {
              e.preventDefault();
              openPrice(held, i);
            }
          },
        },
        d && item
          ? [
              sprite(b, item.sprite, 2),
              h('span', { class: 'shop-name' }, d.qty > 1 ? `${item.name} ×${d.qty}` : item.name),
              h('span', { class: 'price' }, String(d.price)),
            ]
          : [h('span', { class: 'shop-slot-num' }, `Stall ${i + 1}`), h('span', { class: 'shop-slot-hint' }, 'drop here')],
      );
    });
    const at = priceFor;
    const held = at ? stall[at.slot] : null;
    const dialog = at
      ? (() => {
          const item = b.items[at.item]!;
          const heldQty = held?.item === at.item ? held.qty : 1;
          const suggested = held?.item === at.item ? held.price : Math.max(1, salePrice(b, s.state, at.item, 1) ?? 1);
          const can = Math.max(1, s.state.player.bag[at.item] ?? 0);
          const input = h('input', { class: 'shop-price-input', type: 'number', min: 1, max: 9999, value: String(suggested), 'aria-label': `Price for one ${item.name}, in gold` });
          const many = h('input', { class: 'shop-qty-input', type: 'number', min: 1, max: can, value: String(Math.min(heldQty, can)), 'aria-label': `How many ${item.name}` });
          window.setTimeout(() => input.select(), 0);
          return h(
            'div',
            { class: 'shop-price-layer' },
            h(
              'div',
              { class: 'shop-price', role: 'dialog', 'aria-label': `Set a price for ${item.name}` },
              h('b', null, item.name),
              h('p', null, `You carry ${can}. The shared market will keep the price inside the trade band.`),
              h('label', null, 'How many ', many, ` of ${can}`),
              h('label', null, 'Price for one ', input, ' g'),
              h(
                'div',
                { class: 'actions' },
                button('Set price', () => {
                  const n = Math.max(1, Math.min(9999, Math.round(Number(input.value) || suggested)));
                  const qty = Math.max(1, Math.min(can, Math.round(Number(many.value) || 1)));
                  stall[at.slot] = { item: at.item, qty, price: n };
                  s.save();
                  priceFor = undefined;
                  render();
                }, 'small'),
                held
                  ? button('Take it off', () => {
                      stall[at.slot] = null;
                      s.save();
                      priceFor = undefined;
                      render();
                    }, 'small')
                  : null,
                button('Cancel', () => {
                  priceFor = undefined;
                  render();
                }, 'small'),
              ),
              h('p', { class: 'shop-note' }, 'A draft, kept in your save: nothing is listed until the shared market opens.'),
            ),
          );
        })()
      : null;
    return h(
      'section',
      { class: 'shop' },
      h(
        'section',
        { class: 'shop-bag' },
        h('h3', null, 'IN YOUR BAG'),
        h('p', { class: 'shop-note' }, 'Drag an item to a stall slot, or tap it and then a slot.'),
        rows.length ? rows : h('p', { class: 'kit-hint' }, 'Your bag is empty.'),
      ),
      h(
        'section',
        { class: 'shop-stall' },
        h('h3', null, 'YOUR STALL'),
        h('div', { class: 'shop-slots' }, slots),
        h(
          'p',
          { class: 'shop-note' },
          localMapState(s)?.stall
            ? 'Your stall stands at the empty corner, its places kept in your save. Other players and sales while you are away come with the shared world (SETTLEMENT 3.4).'
            : 'A draft, kept in your save. Place your stall at the empty corner on the map; other players and sales while you are away come with the shared world (SETTLEMENT 3.4).',
        ),
      ),
      dialog,
    );
  };

  const TABS: readonly [KitTab, string, string][] = [
    ['bag', 'Bag', 'What you carry. Pick an item to read it.'],
    ['outfit', 'Outfit', 'What you wear. Work clothes on one layer, a look on the other.'],
    ['skills', 'Skills', 'Your tree: the trunk is your race, each wing a school. Learn at a fire, a camp or in town.'],
    ['shop', 'Shop', 'Your stall. Drag an item to a slot, or tap an item then a slot.'],
  ];

  const openPrice = (item: string, slot: number) => {
    priceFor = { item, slot };
    render();
  };

  const tabBar = (): HTMLElement =>
    h(
      'nav',
      { class: 'tabs kit-tabs' },
      TABS.map(([name, label]) => button(label, () => ((tab = name), render()), `tab ${tab === name ? 'on' : ''}`)),
      button('Journal', () => {
        p.close();
        openJournal(ui, 'tasks');
      }, 'tab'),
    );

  const caption = (): HTMLElement => h('p', { class: 'kit-caption' }, TABS.find(([name]) => name === tab)?.[2] ?? '');

  const render = () => {
    // the tree takes the wide screen; the other pages keep the kit's size
    p.body.parentElement?.classList.toggle('tree-open', tab === 'skills');
    const ids = Object.keys(s.state.player.bag).sort((x, y) => itemName(b, x).localeCompare(itemName(b, y)));
    if (selected && !ids.includes(selected)) selected = undefined;
    selected ??= ids[0];
    if (tab === 'outfit') {
      p.body.replaceChildren(tabBar(), caption(), wornView());
      return;
    }
    if (tab === 'skills') {
      p.body.replaceChildren(tabBar(), caption(), h('div', { class: 'kit-body tree-only' }, treeScreen(ui, treeMemo, render)));
      return;
    }
    if (tab === 'shop') {
      p.body.replaceChildren(tabBar(), caption(), shopView());
      return;
    }
    p.body.replaceChildren(tabBar(), caption(), h('div', { class: 'kit-body bag-only' }, bagView(), detailView()));
  };

  const itemDetail = (id: string, after: () => void): HTMLElement => {
    const item = b.items[id]!;
    const price = salePrice(b, s.state, id, 1);
    const actions: HTMLElement[] = [];
    if (item.food) {
      actions.push(button(eatLabel(b, id), async () => {
        const r = await s.act({ t: 'eat', item: id });
        if (!r.ok) ui.toast(r.error, 'bad');
        after();
      }));
    }
    if (item.fragment) {
      const recipe = b.recipes[item.fragment.unlocks];
      actions.push(button(`Learn ${recipe?.title ?? 'the recipe'}`, async () => {
        const r = await s.act({ t: 'learn', item: id });
        if (!r.ok) ui.toast(r.error, 'bad');
        after();
      }));
    }
    const facts: string[] = [];
    if (item.wear) {
      for (const e of item.wear.effects ?? []) {
        const label = KIT_EFFECTS.find(([effect]) => effect === e.effect)?.[1] ?? e.effect.replaceAll('_', ' ');
        facts.push(`${label} +${e.value}%.`);
      }
      // the kernel picks the place; a second ring can still go on while one is worn
      const at = wornAt(b, s.state, id);
      if (at) {
        facts.push(at.look ? 'You wear it as your look.' : 'You are wearing it.');
        actions.push(button('Take off', async () => {
          const r = await s.act({ t: 'unwear', slot: at.slot, look: at.look });
          if (!r.ok) ui.toast(r.error, 'bad');
          after();
        }));
      }
      if (!at || s.check({ t: 'wear', item: id }) === undefined) {
        actions.push(button('Wear', async () => {
          const r = await s.act({ t: 'wear', item: id });
          if (!r.ok) ui.toast(r.error, 'bad');
          after();
        }));
      }
    }
    if (item.tool) {
      const uses = item.tool.uses;
      const left = uses === undefined ? 'It lasts.' : `${uses - (s.state.player.wear[id] ?? 0)} uses left.`;
      const speedBonus = item.tool.tier > 1 ? ` (+${15 * (item.tool.tier - 1)}% gathering speed)` : '';
      // the tier is in the head with the class; the check keeps a tool's tier the tier of its "tool"
      facts.push(`${item.tool.kind[0]!.toUpperCase()}${item.tool.kind.slice(1)}${speedBonus}. ${left}`);
    }
    // put one down where the player stands; it stays on that tile (DECISIONS.md, 2026-10-23)
    if (s.check({ t: 'drop', item: id, qty: 1, at: s.pos }) === undefined) {
      const put = button('Put down', async () => {
        const r = await s.act({ t: 'drop', item: id, qty: 1, at: s.pos });
        if (!r.ok) ui.toast(r.error, 'bad');
        after();
      });
      put.dataset.drop = id;
      actions.push(put);
    }
    if (price !== undefined) facts.push(`A trader pays ${gold(price)} gold.`);
    const set = item.wear?.set
      ? (() => {
          const pieces = setPieces(b)[item.wear!.set!] ?? [];
          const worn = Object.values(s.state.player.worn);
          return {
            name: setLabel(item.wear!.set!),
            held: pieces.filter((piece) => worn.includes(piece)).length,
            total: pieces.length,
            full: setComplete(b, s.state, item.wear!.set!),
          };
        })()
      : undefined;
    return h(
      'div',
      { class: 'detail kit-card' },
      h(
        'div',
        { class: 'kit-card-body' },
        h(
          'div',
          { class: 'detail-head' },
          sprite(b, item.sprite, 3),
          h('div', null, itemTitle(item.rarity, item.name), h('div', { class: `rarity r-${item.rarity}` }, item.rarity), h('div', { class: 'muted' }, classLine(b, id))),
        ),
        h('p', { class: 'kit-desc' }, item.description),
        facts.map((f) => h('p', { class: 'muted' }, f)),
        set ? h('p', { class: 'kit-set-line' }, `${set.name} set ${set.held}/${set.total}${set.full ? ' · full' : ''}`) : null,
        h('p', { class: 'credit' }, item.creator === 'core' ? 'Added by the core team' : `Added by ${item.creator}`),
      ),
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
          h('ul', { class: 'steps' }, questSteps(b, s.state, id, s.tick).map((st) => h('li', { class: st.done ? 'done' : '' }, st.text))),
        );
      }),
      done.length ? h('h3', null, 'Done') : null,
      done.map((id) => h('div', { class: 'done-line' }, b.quests[id]?.title ?? id)),
    );
  };

  const itemsTab = (): HTMLElement => {
    const known = new Set(s.state.player.journal);
    const entry = (id: string) => {
      const it = b.items[id]!;
      return known.has(id)
        ? h('div', { class: 'entry' }, sprite(b, it.sprite, 2), h('div', null, itemTitle(it.rarity, it.name), h('div', { class: 'credit' }, it.creator === 'core' ? 'core team' : it.creator)))
        : h('div', { class: 'entry unknown' }, h('span', { class: 'sprite qmark' }, '?'), h('div', null, h('b', null, '???')));
    };
    // by class, and inside a class a row per family (C12)
    return h(
      'div',
      null,
      h('p', { class: 'muted' }, `${known.size} of ${Object.keys(b.items).length} found. Every entry names who added it.`),
      journalGroups(b).flatMap((g) => [
        h('h3', null, g.label),
        ...g.rows.flatMap((row) => [
          row.family ? h('p', { class: 'muted' }, `${row.family[0]!.toUpperCase()}${row.family.slice(1)} family`) : null,
          h('div', { class: 'entries' }, row.ids.map(entry)),
        ]),
      ]),
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
          h(
            'div',
            null,
            h('b', null, r.title),
            // the class and tier of what it makes, and the station it needs; never a level or a chance (CR-17)
            h('div', { class: 'muted' }, classLine(b, r.outputs[0]?.item ?? '')),
            h('div', { class: 'muted' }, `${stacks(b, r.inputs)} at ${stationText(b, r)}, ${seconds(r.active_ms)}`),
          ),
        );
      }),
      hidden ? h('p', { class: 'muted' }, `${hidden} more recipe${hidden > 1 ? 's' : ''} to discover - from tasks and from scraps in the ruins.`) : null,
    );
  };

  const skillsTab = (): HTMLElement => skillsBody(ui, render);
  render();
}

// ------------------------------------------------------------------ shop

export function openShop(ui: UI, npcId: string): void {
  const s = app.session;
  const b = app.bundle;
  const npc = b.npcs[npcId];
  const shop = npc?.shop ? b.shops[npc.shop] : undefined;
  if (!s || !npc || !shop) return;
  // the shop file names its counter ("Pell's stall", "The inn"), so a keeper added later needs no code
  const p = panel(ui, shop.title || `${npc.name}'s stall`, 'shop');
  let current: 'buy' | 'sell' = 'buy';

  const deal = async (action: () => ActResult | Promise<ActResult>) => {
    const r = await action();
    if (!r.ok && r.error) ui.toast(r.error, 'bad');
    render();
  };

  const render = () => {
    const st = s.state;
    const room = bagCapacity(b, st) - bagUsed(b, st);
    const buyRow = (o: { item: string; price_mg: number }): HTMLElement => {
      const it = b.items[o.item];
      const opens = it?.tool ? toolOpens(b, st, it.tool.kind) : [];
      // a recipe the player already knows is not sold twice
      const known = !!it?.fragment && st.player.recipes.includes(it.fragment.unlocks);
      return h(
        'div',
        { class: 'row', 'data-item': o.item },
        sprite(b, it?.sprite, 2),
        h(
          'div',
          { class: 'grow' },
          itemTitle(it?.rarity, it?.name ?? o.item),
          h('div', { class: 'muted' }, itemBenefit(b, o.item)),
          opens.length ? h('div', { class: 'muted', 'data-opens': '' }, `Opens: ${opens.join(', ')}`) : null,
          known ? h('div', { class: 'muted', 'data-known': '' }, 'You know this recipe.') : null,
        ),
        h('span', { class: 'price' }, gold(o.price_mg)),
        button('Buy', () => deal(() => s.act({ t: 'buy', npc: npcId, item: o.item, qty: 1, at: s.pos })), 'small', known || st.player.gold + st.player.boundGold < o.price_mg || placeRoom(b, st, o.item) < 1),
      );
    };
    const sellRow = ({ item: id, each }: { item: string; each: number }): HTMLElement => {
      // the kernel's price: a worn tool that is the last unit sells for the uses it has left
      const count = st.player.bag[id] ?? 0;
      return h(
        'div',
        { class: 'row', 'data-item': id },
        sprite(b, b.items[id]?.sprite, 2),
        h('div', { class: 'grow' }, itemTitle(b.items[id]?.rarity, `${itemName(b, id)} x${count}`), h('div', { class: 'muted' }, `${gold(each)} gold each`)),
        button('Sell 1', () => deal(() => s.act({ t: 'sell', npc: npcId, item: id, qty: 1, at: s.pos })), 'small'),
        count > 1 ? button('All', () => deal(() => s.act({ t: 'sell', npc: npcId, item: id, qty: Math.min(99, count), at: s.pos })), 'small') : null,
      );
    };
    // the counter in named groups (decision 51): a strip of the group names jumps to each one
    const groups =
      current === 'buy'
        ? shopGroups(b, shop.sells, (o) => o.item).map((g) => ({ ...g, rows: g.entries.map(buyRow) }))
        : shopGroups(b, sellable(b, st), (o) => o.item).map((g) => ({ ...g, rows: g.entries.map(sellRow) }));
    const sections = groups.map((g) =>
      h('section', { class: 'shop-group', 'data-group': g.key, 'aria-label': g.label }, h('h3', { class: 'shop-group-name' }, g.label), g.rows),
    );
    const jump =
      groups.length > 1
        ? h(
            'nav',
            { class: 'shop-jump', 'aria-label': 'Groups' },
            groups.map((g, i) => button(`${g.label} ${g.rows.length}`, () => sections[i]?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 'tab')),
          )
        : null;
    p.body.replaceChildren(
      tabs(shop.buys ? ['buy', 'sell'] : ['buy'], current, (n) => ((current = n as 'buy' | 'sell'), render())),
      h('div', { class: 'wallet' }, h('i', { class: 'coin' }), `${gold(st.player.gold)} gold`, st.player.boundGold > 0 ? h('span', null, ` + ${gold(st.player.boundGold)} starter gold`) : null, h('span', { class: 'muted' }, ` - ${room} free places in your bag`)),
      ...(jump ? [jump] : []),
      ...(sections.length ? sections : [h('p', { class: 'muted' }, current === 'sell' ? 'Nothing to sell.' : 'Sold out.')]),
    );
  };
  render();
}

// ------------------------------------------------------------------ cooking and making

export function openCraft(ui: UI, station: string): void {
  const s = app.session;
  if (!s) return;
  const b = app.bundle;
  const fire = station === 'fire';
  const p = panel(ui, fire ? 'Cook at the fire' : `The ${station}`, 'craft');
  const render = () => {
    const st = s.state;
    // up the ladder: what this station's tier makes first, then each tier above it
    const known = st.player.recipes
      .filter((id) => b.recipes[id]?.station === station)
      .sort((x, y) => recipeTier(b, b.recipes[x]!) - recipeTier(b, b.recipes[y]!) || b.recipes[x]!.title.localeCompare(b.recipes[y]!.title));
    const needs = (inputs: readonly { item: string; qty: number }[]) =>
      h('div', { class: 'needs' }, inputs.map((i) => h('span', null, `${itemName(b, i.item)} `, need(st.player.bag[i.item] ?? 0, i.qty))));
    const haveAll = (inputs: readonly { item: string; qty: number }[]) => inputs.every((i) => (st.player.bag[i.item] ?? 0) >= i.qty);
    // the next part for this station, built over the one standing here (the fire has none)
    const upgrades = fire ? [] : stationUpgrades(b, st, station);
    p.body.replaceChildren(
      ...known.map((id) => {
        const r = b.recipes[id]!;
        const out = r.outputs[0];
        // a dry run gives the kernel's own reason; never a level (CR-17)
        const why = s.check({ t: 'craft', recipe: id, at: s.pos });
        // the station's tier is the one gate: it shows before the inputs are in the bag, naming the part that fits,
        // and turns red only when it is all that stands in the way
        const gate = stationGate(b, st, r);
        return h(
          'div',
          { class: 'row' },
          sprite(b, b.items[out?.item ?? '']?.sprite, 2),
          h(
            'div',
            { class: 'grow' },
            h('b', null, r.title),
            needs(r.inputs),
            h('div', { class: 'muted' }, `${classLine(b, out?.item ?? '')} - ${seconds(r.active_ms)}`),
            gate ? h('div', { class: haveAll(r.inputs) ? 'lack' : 'muted' }, gate) : why && haveAll(r.inputs) ? h('div', { class: 'lack' }, why) : null,
          ),
          button(fire ? 'Cook' : 'Make', async () => {
            const res = await s.act({ t: 'craft', recipe: id, at: s.pos });
            if (!res.ok) ui.toast(res.error, 'bad');
            else p.close();
          }, 'small', why !== undefined),
        );
      }),
      ...upgrades.map((id) => {
        const c = b.camps[id]!;
        const why = s.check({ t: 'build', camp: id, at: s.pos });
        return h(
          'div',
          { class: 'card recipe upgrade' },
          sprite(b, c.sprite, 2),
          h(
            'div',
            null,
            h('b', null, `Upgrade to ${c.title}`),
            needs(c.inputs),
            h('div', { class: 'muted' }, `${seconds(c.active_ms)} - a ${station} of tier ${c.tier ?? 1}`),
            why && haveAll(c.inputs) ? h('div', { class: 'lack' }, why) : null,
            h(
              'div',
              { class: 'actions' },
              button('Build', async () => {
                const res = await s.act({ t: 'build', camp: id, at: s.pos });
                if (!res.ok) ui.toast(res.error, 'bad');
                else p.close();
              }, 'small', why !== undefined),
            ),
          ),
        );
      }),
      known.length === 0
        ? h('p', { class: 'muted' }, 'You know no recipes for this yet.')
        : h('p', { class: 'muted' }, fire ? 'Cooked food goes to your bag. Eat it from there.' : 'What you make goes to your bag.'),
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
  const what = c.provides === 'fire' ? 'Somewhere to cook.' : c.provides ? 'Somewhere to make things.' : c.bag_bonus ? `Your bag holds ${c.bag_bonus} more.` : 'A place for what you find.';
  void say(ui, c.title, [`${what} Needs ${have}.`], ok ? [{ label: 'Build it', value: 'yes' }, { label: 'Not now', value: 'no' }] : []).then(async (pick) => {
    if (pick !== 'yes') return;
    const r = await s.act({ t: 'build', camp: campId, at: s.pos });
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
    void say(ui, r.title, [restoreHint(b, s.state, restoreId, s.tick)], []);
    return;
  }
  const have = r.inputs.map((i) => `${i.qty} ${itemName(b, i.item)} (you have ${s.state.player.bag[i.item] ?? 0})`).join(', ');
  const ok = r.inputs.every((i) => (s.state.player.bag[i.item] ?? 0) >= i.qty);
  void say(ui, r.title, [`It is broken. Mending it takes ${have}.`], ok ? [{ label: 'Mend it', value: 'yes' }, { label: 'Not now', value: 'no' }] : []).then(async (pick) => {
    if (pick !== 'yes') return;
    const res = await s.act({ t: 'restore', restore: restoreId, at: s.pos });
    if (!res.ok) ui.toast(res.error, 'bad');
  });
}

// ------------------------------------------------------------------ search

/**
 * A searchable's window (docs/design/SEARCH.md): what it holds today, a tap on a row takes it, "Take all" takes the
 * lot, and an empty one says "Nothing here." in one line. It reads the state each time, so it never shows what the
 * kernel has not kept; what does not fit the bag stays inside and the kernel's words come up as a toast.
 */
export function openSearch(ui: UI, spotId: string): void {
  const s = app.session;
  const b = app.bundle;
  const def = b.searchables[spotId];
  if (!s || !def) return;
  const p = panel(ui, def.title, 'search');
  const take = async (row?: number) => {
    const r = await s.act(row === undefined ? { t: 'take', spot: spotId, at: s.pos } : { t: 'take', spot: spotId, row, at: s.pos });
    if (!r.ok) ui.toast(r.error, 'bad');
    render();
  };
  const render = () => {
    const rows = searchRows(b, s.state, s.tick, spotId);
    const lucky = rareFindPermille(b, s.state) > 1000;
    p.body.replaceChildren(
      ...(rows.length === 0
        ? [h('p', { class: 'search-empty' }, SEARCH_EMPTY)]
        : [
            ...rows.map((row) =>
              h(
                'button',
                { class: `search-row r-${b.items[row.item]?.rarity ?? 'common'}`, type: 'button', 'aria-label': `Take ${row.name}`, onclick: () => void take(row.index) },
                sprite(b, row.sprite, 3),
                h('span', { class: 'grow' }, row.name),
                h('span', { class: 'search-take' }, 'Take'),
              ),
            ),
            button('Take all', () => void take(), 'search-all'),
          ]),
      ...(lucky ? [h('p', { class: 'search-luck muted' }, SEARCH_LUCK_LINE)] : []),
    );
  };
  render();
}

// ------------------------------------------------------------------ menu and help

/**
 * The valley as the player has walked it (CR-104): their ground, the places
 * they have stood in, and the stall at the town's free corner. A marker is
 * local; buyers and sales while away wait for the shared world.
 */
export function openMap(ui: UI): void {
  const s = app.session;
  if (!s) return;
  const b = app.bundle;
  const p = panel(ui, 'Map', 'map', 'The valley, as you have walked it');
  let selected: string | undefined;

  const render = () => {
    const local = localMapState(s);
    const seen = local?.seen ?? new Set<string>();
    const chunks = local?.seenChunks ?? new Set<string>();
    const stall = local?.stall;
    const places = mapPlaces(b, seen, s.pos, stall)
      .filter((place) => place.label !== undefined)
      .sort((a, c) => Number(c.current) - Number(a.current) || Number(c.stall) - Number(a.stall) || (a.label ?? '').localeCompare(c.label ?? ''));
    const current = places.find((place) => place.current);
    selected = places.some((place) => place.id === selected) ? selected : (current?.id ?? places[0]?.id);
    const corner = places.find((place) => place.id === STALL_SLOT);
    const atCorner = local !== undefined && canPlaceStall(b, s.pos);
    const day = Math.floor(s.tick / b.params.day_length_ms) + 1;

    const chart = h('div', { class: 'map-chart' });
    chart.innerHTML = mapSvg(b, { seen, chunks, at: s.pos, stall, selected });

    const rows = places.map((place) => {
      const name = place.stall ? 'Your stall' : place.id === STALL_SLOT ? 'The empty corner' : place.label!;
      const atStall = place.stall || place.id === STALL_SLOT;
      const sub = place.current
        ? atStall
          ? place.stall
            ? 'You are here · your stall'
            : 'You are here · a stall can stand here'
          : 'You are here'
        : place.stall
          ? 'The empty corner'
          : place.id === STALL_SLOT
            ? 'A stall can stand here'
            : `${placeKind(place)} · ${directionOf(s.pos, [place.x, place.y])}`;
      return h(
        'button',
        {
          class: `map-row ${selected === place.id ? 'on' : ''} ${place.stall ? 'stall' : ''} ${place.id === STALL_SLOT ? 'corner' : ''}`.trim(),
          type: 'button',
          'aria-current': place.current ? 'true' : undefined,
          onclick: () => {
            selected = place.id;
            render();
          },
        },
        h('span', { class: `map-ico kind-${place.kind}` }, place.stall ? '▣' : place.kind === 'camp' ? '⌂' : place.kind === 'ruin' ? '⌘' : place.kind === 'restore' ? '⌁' : place.kind === 'npc' ? '●' : '◎'),
        h('span', { class: 'map-txt' }, h('span', { class: 'map-nm' }, name), h('span', { class: 'map-sub' }, sub)),
      );
    });

    let note: string;
    let action: HTMLElement | undefined;
    if (stall) {
      note = atCorner
        ? 'Your stall stands at the empty corner. Buyers and sales while you are away come with the shared world.'
        : 'Your stall stands at the empty corner. Walk there to lift it; buyers come with the shared world.';
      if (atCorner) {
        action = button('Lift your stall', () => {
          const lift = (s as { liftStall?: () => boolean }).liftStall;
          if (!lift?.call(s)) return ui.toast('Walk to the empty corner first.', 'bad');
          ui.toast('The empty corner is free again.', 'info');
          render();
        });
      }
    } else if (corner) {
      note = atCorner
        ? 'The empty corner is free. Your stall would stand here, and stay when you log off; buyers come with the shared world.'
        : 'The empty corner is free. Walk there to place your stall.';
      action = button(
        'Place your stall',
        () => {
          const place = (s as { placeStall?: () => boolean }).placeStall;
          if (!place?.call(s)) return ui.toast('Walk to the empty corner first.', 'bad');
          ui.toast('Your stall stands at the empty corner.', 'good');
          render();
        },
        'gold',
        !atCorner,
      );
    } else if (!local) {
      note = 'The map is drawn from the local save. This door does not carry the walked ground or the stall yet.';
    } else {
      note = 'The empty corner is not on your map yet. Walk into town to find it.';
    }

    p.body.replaceChildren(
      h(
        'div',
        { class: 'map-strip' },
        h('span', null, `Day ${day} · ${clock(minuteOfDay(b, s.tick))}`),
        h('span', null, stall ? 'Your stall · the empty corner' : 'No stall placed'),
      ),
      chart,
      h(
        'div',
        { class: 'map-key' },
        h('span', null, h('i', { class: 'map-key-you' }), 'You'),
        h('span', null, h('i', { class: 'map-key-stall' }), 'Stall'),
        h('span', null, h('i', { class: 'map-key-walked' }), 'Walked'),
        h('span', null, h('i', { class: 'map-key-blank' }), 'Not yet'),
      ),
      rows.length ? h('div', { class: 'map-list' }, rows) : h('p', { class: 'map-empty' }, 'Nothing walked yet. The map draws only what you have walked; go and look.'),
      h('div', { class: 'map-foot' }, h('p', { class: 'map-status', 'aria-live': 'polite' }, note), action),
    );
  };

  render();
}

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
        button('Map', go(() => openMap(ui))),
        button(`Sound: ${sound.muted ? 'Off' : 'On'}`, () => {
          sound.setMuted(!sound.muted);
          render();
        }),
        // the 3D door has no settings host yet (it is paused): no row there rather than a dead one
        ...(app.perf && app.game ? [button('Settings', go(() => openSettings(ui)))] : []),
        button('Controls', go(() => openControls(ui))),
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
    const p = panel(ui, 'How is the game so far?', 'report review');
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

/** The Settings window: quality, frame rate, sound, reduced motion and text size, applied at once and kept (settings-apply.ts). */
export function openSettings(ui: UI): void {
  const perf = app.perf;
  const game = app.game;
  if (!perf || !game) return;
  const p = panel(ui, 'Settings', 'settings');
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    // the settings still apply for this visit
  }
  const apply = new SettingsApplier({ perf, game, storage, root: document.documentElement, richFromUrl: new URLSearchParams(location.search).has('rich') });
  p.body.replaceChildren(settingsBody(apply, app.sound, p.close));
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
    h(
      'div',
      { class: 'card' },
      h('b', null, 'Also'),
      h(
        'div',
        { class: 'muted' },
        'Engine: Phaser (MIT). Font: Pixelify Sans by Stefie Justprince (SIL Open Font License). The age limit of an account uses the country file ',
        h('a', { href: 'https://db-ip.com', target: '_blank', rel: 'noopener' }, 'IP Geolocation by DB-IP'),
        ' (CC BY 4.0).',
      ),
    ),
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
    c.stone ? stoneList(c.stone) : null,
    info.record && s1Available() ? reportLine(info.record) : null,
  ];
  p.body.replaceChildren(...parts.filter((x): x is HTMLElement => x !== null));
}

/** The returners' stone: the written names, then the line the player cut, or an empty one. */
function stoneList(v: StoneView): HTMLElement {
  return h(
    'ul',
    { class: 'stone' },
    ...v.names.map((n) => h('li', null, n)),
    h('li', { class: v.carved ? 'carved' : 'blank' }, v.carved || ' '),
  );
}

/** One short note per record per browser, sent to the stage-1 service (GRUNT 18); nothing about the player goes with it. */
function reportLine(id: string): HTMLElement {
  const box = h('div', { class: 'sign-report' });
  const done = () => box.replaceChildren(h('p', { class: 'sign-note' }, 'Thanks, your note was sent.'));
  if (s1.reported(id)) {
    box.replaceChildren(h('p', { class: 'sign-note' }, 'You sent a note about this.'));
    return box;
  }
  const open = () => {
    const text = h('textarea', { rows: 3, maxlength: 240, placeholder: 'What is wrong or could be better here?' });
    box.replaceChildren(
      text,
      h('div', { class: 'actions' }, button('Send', () => (s1.report(id, text.value) ? done() : text.focus()))),
    );
    text.focus();
  };
  box.replaceChildren(h('div', { class: 'actions' }, button('Report', open)));
  return box;
}
