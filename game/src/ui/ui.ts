/**
 * Everything drawn as page elements over the canvas: the HUD, toasts, the
 * action prompt, dialogue, menus and the timing minigame. Layers stack; the
 * top one gets the buttons, and while any is open the game clock stops.
 */
import {
  type GameEvent,
  type Grade,
  characterLevel,
  minuteOfDay,
  satietyAt,
  satietyCap,
  skillPoints,
} from '@game/kernel';
import { app } from '../app';
import type { Button } from '../input';
import type { Session } from '../session';
import { activeQuests, clock, describe, digRiddleOpen, gold, itemName, questSteps, readyToHandIn, windowScalePct } from '../text';
import { say, type Option } from './dialog';
import { button, h, sprite } from './dom';
import { feedback } from './feedback';
import { type Minigame, pick, snap, strike, timing } from './games';
import { openLevelUp } from './levelup';
import {
  openBag,
  openCraft,
  openGuide,
  openJournal,
  openMenu,
  openShop,
  openSignCard,
  confirmBuild,
  confirmRestore,
} from './panels';
import { showTitle } from './title';
import { mountTouch } from './touch';

/** What the hands are doing, for the world's animation and sound. */
export type WorkKind = 'timing' | 'strike' | 'pick' | 'snap' | 'dig';

const GAMES: Record<'timing' | 'strike' | 'pick' | 'snap', Minigame> = { timing, strike, pick, snap };

export interface Layer {
  el: HTMLElement;
  /** return true when the layer used the button */
  onButton?: (b: Button) => boolean;
  onClose?: () => void;
}

export class UI {
  readonly root: HTMLElement;
  private hud: HTMLElement;
  private tracker: HTMLElement;
  private toasts: HTMLElement;
  private promptEl: HTMLElement;
  private layers: Layer[] = [];
  private loadingEl: HTMLElement | undefined;
  private titleOpen = false;
  private hudTimer = 0;
  private talkCount = new Map<string, number>();
  private levelUpOpen = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.hud = h('div', { class: 'hud', hidden: true });
    this.tracker = h('div', { class: 'tracker', hidden: true });
    this.toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
    this.promptEl = h('div', { class: 'prompt', hidden: true });
    this.loadingEl = h('div', { class: 'loading' }, h('div', { class: 'loading-title' }, 'Loading the valley'), h('div', { class: 'loading-bar' }, h('i')));
    root.append(h('div', { class: 'top' }, this.hud, this.tracker, this.toasts), this.promptEl, this.loadingEl);
    mountTouch(root);
    this.tracker.addEventListener('click', () => openJournal(this, 'tasks'));
  }

  get blocking(): boolean {
    return this.layers.length > 0 || this.titleOpen;
  }

  // ------------------------------------------------------------ layers

  push(layer: Layer): void {
    this.layers.push(layer);
    this.root.append(layer.el);
    app.session?.pause();
    this.setPrompt('');
  }

  pop(layer: Layer): void {
    const i = this.layers.indexOf(layer);
    if (i < 0) return;
    this.layers.splice(i, 1);
    layer.el.remove();
    app.session?.resume();
    layer.onClose?.();
    this.renderHud();
  }

  closeAll(): void {
    for (const layer of [...this.layers].reverse()) this.pop(layer);
  }

  /** Buttons from keyboard and touch arrive here first. */
  handle(b: Button): boolean {
    const top = this.layers[this.layers.length - 1];
    if (top) {
      if (top.onButton?.(b)) return true;
      if (b === 'b') this.pop(top);
      return true;
    }
    if (this.titleOpen) return true;
    const s = app.session;
    if (!s?.started) return true;
    if (b === 'a') app.world?.interact();
    else if (b === 'bag') openBag(this);
    else if (b === 'journal') openJournal(this);
    else if (b === 'menu') openMenu(this);
    return true;
  }

  // ------------------------------------------------------------ boot

  loading(v: number): void {
    const bar = this.loadingEl?.querySelector('i');
    if (bar) (bar as HTMLElement).style.width = `${Math.round(v * 100)}%`;
  }

  worldReady(): void {
    this.loadingEl?.remove();
    this.loadingEl = undefined;
    this.titleOpen = true;
    document.body.classList.add('at-title');
    void showTitle(this).then(() => {
      this.titleOpen = false;
      document.body.classList.remove('at-title');
    });
  }

  /** A session is ready (new or loaded): show it. */
  begin(session: Session): void {
    app.session = session;
    app.world?.bind(session);
    session.on('events', (events) => {
      for (const e of events) {
        const d = describe(app.bundle, session.state, e);
        if (d) this.toast(d.text, d.tone, d.icon);
      }
      feedback(this.root, events);
      void this.afterEvents(events);
    });
    session.on('change', () => this.renderHud());
    this.hud.hidden = false;
    this.tracker.hidden = false;
    this.renderHud();
    window.clearInterval(this.hudTimer);
    this.hudTimer = window.setInterval(() => this.renderHud(), 500);
    if (session.adapted) this.toast('The valley was updated since your last visit.', 'info');
  }

  // ------------------------------------------------------------ HUD

  renderHud(): void {
    const s = app.session;
    if (!s?.started) return;
    const b = app.bundle;
    const st = s.state;
    const cap = satietyCap(b, st);
    const sat = satietyAt(b, st, s.tick);
    const pct = Math.round((sat / cap) * 100);
    const points = skillPoints(b, st);
    const minute = minuteOfDay(b, s.tick);
    const day = minute >= 6 * 60 && minute < 19 * 60;
    this.hud.replaceChildren(
      h(
        'div',
        { class: 'hud-left' },
        h(
          'div',
          { class: `meter ${sat === 0 ? 'empty' : pct < 25 ? 'low' : ''}`, title: 'Satiety: eat to refill. Empty means slower work.' },
          h('span', { class: 'meter-label' }, 'Food'),
          h('span', { class: 'meter-bar' }, h('i', { style: `width:${pct}%` })),
          h('span', { class: 'meter-num' }, String(Math.ceil(sat / 1000))),
        ),
        h(
          'div',
          { class: 'hud-row' },
          h('span', { class: 'chip gold', title: 'Gold' }, h('i', { class: 'coin' }), gold(st.player.gold)),
          h('span', { class: 'chip', title: day ? 'Day' : 'Night' }, h('i', { class: day ? 'sun' : 'moon' }), clock(minute)),
          h('span', { class: `chip ${points > 0 ? 'glow' : ''}`, title: points > 0 ? 'A skill point to spend: open the journal' : 'Character level' }, `Lv ${characterLevel(b, st)}${points > 0 ? ' +' : ''}`),
          h('button', { class: 'chip demo', type: 'button', onclick: () => this.aboutDemo() }, 'Demo'),
        ),
      ),
      h(
        'div',
        { class: 'hud-right' },
        button('Bag', () => openBag(this), 'small'),
        button('Log', () => openJournal(this), 'small'),
        button('Menu', () => openMenu(this), 'small'),
      ),
    );
    this.renderTracker(s);
  }

  private renderTracker(s: Session): void {
    const b = app.bundle;
    const ids = activeQuests(b, s.state);
    if (ids.length === 0) {
      this.tracker.replaceChildren(h('div', { class: 'tracker-title' }, 'Explore the valley'));
      return;
    }
    const main = ids[0]!;
    const q = b.quests[main]!;
    const steps = questSteps(b, s.state, main);
    const giver = q.giver ? b.npcs[q.giver]?.name : undefined;
    const ready = readyToHandIn(b, s.state, main) && giver;
    this.tracker.replaceChildren(
      h('div', { class: 'tracker-title' }, q.title, ids.length > 1 ? h('span', { class: 'more' }, ` +${ids.length - 1}`) : null),
      ...(ready
        ? [h('div', { class: 'tracker-step' }, `Bring it to ${giver}`)]
        : steps.filter((st) => !st.done).slice(0, 2).map((st) => h('div', { class: 'tracker-step' }, st.short ?? st.text))),
    );
  }

  setPrompt(label: string): void {
    this.promptEl.hidden = label === '';
    this.promptEl.replaceChildren(h('b', null, 'A'), ' ', label);
  }

  toast(text: string, tone: 'good' | 'bad' | 'info' = 'info', icon?: string): void {
    const el = h('div', { class: `toast ${tone}` }, icon ? sprite(app.bundle, icon, 1) : null, h('span', null, text));
    this.toasts.append(el);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
    window.setTimeout(() => el.classList.add('out'), 2800);
    window.setTimeout(() => el.remove(), 3300);
  }

  aboutDemo(): void {
    void say(this, null, [
      'This is a demo of a game the community builds together.',
      'Your progress is saved in this browser only. It will not move to an account when accounts arrive - players of the demo get a title and a cosmetic item instead.',
    ]);
  }

  // ------------------------------------------------------------ the story

  /** The story beats of a batch first, then the level-up choice if a level brought a point. */
  private async afterEvents(events: readonly GameEvent[]): Promise<void> {
    await this.storyBeats(events);
    const level = events.find((e) => e.e === 'level');
    const s = app.session;
    if (level && level.e === 'level' && s && skillPoints(app.bundle, s.state) > 0 && !this.levelUpOpen) {
      this.levelUpOpen = true;
      // let the jingle ring for a moment before the window opens
      await new Promise((r) => window.setTimeout(r, 700));
      await openLevelUp(this, level.profession);
      this.levelUpOpen = false;
    }
  }

  /** A few words at the turning points of the opening, so nobody gets lost. */
  private async storyBeats(events: readonly GameEvent[]): Promise<void> {
    const s = app.session;
    if (!s) return;
    for (const e of events) {
      if (e.e === 'restore' && e.restore === 'core/old-bridge') {
        await say(this, null, [`The bridge holds. You scratch your name into the sign beside it: "Mended by ${s.state.player.name}".`]);
      }
      if (e.e === 'quest' && e.state === 'done' && e.quest === 'core/three-fruits') {
        await say(this, 'Elder Maru', [
          'Thank you. Take these coins - your first.',
          'Pell at the market sells a basket for the grove and a trowel for the ruins. Either one starts a new kind of work, and the other can wait. Choose what you want to do first.',
        ]);
      }
    }
  }

  // ------------------------------------------------------------ actions from the world

  async talk(npcId: string): Promise<void> {
    const s = app.session;
    const b = app.bundle;
    const npc = b.npcs[npcId];
    if (!s || !npc) return;
    const rep = s.state.player.rep[npcId] ?? 0;
    const n = this.talkCount.get(npcId) ?? 0;
    this.talkCount.set(npcId, n + 1);

    // Save this before opening dialogue, so a reload cannot replay the monologue.
    const first = s.meet(npcId);
    const firstLines = first && rep === 0 ? (npc.dialogue.first ?? []) : [];

    const tier = rep >= 60 ? 'family' : rep >= 30 ? 'friend' : rep >= 10 ? 'acquaintance' : 'stranger';
    const tierLines = npc.dialogue[tier] ?? npc.dialogue.stranger;
    const line = firstLines.length ? firstLines[firstLines.length - 1]! : (tierLines[n % tierLines.length] ?? '...');

    const options: Option[] = [];
    if (!first) {
      for (const [index, topic] of (npc.topics ?? []).entries()) {
        options.push({ label: topic.ask, value: `topic:${index}` });
      }
    }
    for (const [id, q] of Object.entries(b.quests).sort(([x], [y]) => x.localeCompare(y))) {
      if (q.giver !== npcId) continue;
      const state = s.state.player.quests[id];
      if (state === 'active') {
        options.push({ label: readyToHandIn(b, s.state, id) ? `Hand in: ${q.title}` : `About: ${q.title}`, value: `quest:${id}` });
      } else if (!state && (q.requires ?? []).every((r) => s.state.player.quests[r] === 'done')) {
        options.push({ label: `Task: ${q.title}`, value: `quest:${id}` });
      }
    }
    if (npc.shop) options.push({ label: 'Trade', value: 'trade' });
    options.push({ label: 'Goodbye', value: 'bye' });

    const choice = await say(this, npc.name, firstLines.length ? firstLines : [line], options);
    if (!choice || choice === 'bye') return;
    if (choice.startsWith('topic:')) {
      const topic = npc.topics?.[Number(choice.slice(6))];
      if (topic) await say(this, npc.name, topic.lines);
      return;
    }
    if (choice === 'trade' && npc.shop) return openShop(this, npcId);
    if (choice.startsWith('quest:')) return this.questTalk(npcId, choice.slice(6));
  }


  private async questTalk(npcId: string, questId: string): Promise<void> {
    const s = app.session!;
    const b = app.bundle;
    const q = b.quests[questId]!;
    const npc = b.npcs[npcId]!;
    const state = s.state.player.quests[questId];
    const rewards = rewardText(questId);
    if (!state) {
      const pick = await say(this, npc.name, [q.summary, `Reward: ${rewards}.`], [
        { label: 'I will do it', value: 'yes' },
        { label: 'Not now', value: 'no' },
      ]);
      if (pick !== 'yes') return;
      const r = s.act({ t: 'accept', quest: questId, at: s.pos });
      if (!r.ok) this.toast(r.error, 'bad');
      return;
    }
    if (readyToHandIn(b, s.state, questId)) {
      const r = s.act({ t: 'turnin', quest: questId, at: s.pos });
      if (!r.ok) this.toast(r.error, 'bad');
      return;
    }
    const left = questSteps(b, s.state, questId).filter((st) => !st.done).map((st) => st.text);
    await say(this, npc.name, [q.summary, `Still needed: ${left.join('; ')}.`]);
  }

  async gather(nodeId: string): Promise<void> {
    const s = app.session;
    const b = app.bundle;
    if (!s) return;
    const inst = b.instances[nodeId]!;
    const r = b.resources[inst.source]!;
    const why = s.check({ t: 'gather', node: nodeId, grade: 3, at: s.pos });
    if (why) return this.toast(why, 'bad');
    const game = r.game ?? 'timing';
    const grade = await this.play(GAMES[game], `Gather ${itemName(b, r.output)}`, nodeId, game, b.items[r.output]?.sprite ?? r.sprite);
    if (grade === null) return;
    const res = s.act({ t: 'gather', node: nodeId, grade, at: s.pos });
    if (!res.ok) this.toast(res.error, 'bad');
  }

  async dig(spotId: string): Promise<void> {
    const s = app.session;
    if (!s) return;
    const why = s.check({ t: 'dig', spot: spotId, grade: 3, at: s.pos });
    if (why) return this.toast(why, 'bad');
    const grade = await this.play(timing, 'Dig', spotId, 'dig');
    if (grade === null) return;
    const res = s.act({ t: 'dig', spot: spotId, grade, at: s.pos });
    if (!res.ok) return this.toast(res.error, 'bad');
    // the catch (G6): while a riddle waits on a dig somewhere else, a dig here says so once the hands stop
    if (!res.events.some((e) => e.e === 'riddle') && digRiddleOpen(app.bundle, s.state, app.bundle.instances[spotId]!.source)) {
      const busy = res.events.find((e) => e.e === 'busy');
      window.setTimeout(() => this.toast('Not here. Read the stones again.', 'info'), busy?.e === 'busy' ? busy.ms : 0);
    }
  }

  /** A minigame for one action; every beat swings the arm and makes its sound in the world. */
  private play(game: Minigame, title: string, nodeId: string, kind: WorkKind, art?: string): Promise<Grade | null> {
    const s = app.session!;
    return game(this, {
      title,
      scalePct: windowScalePct(app.bundle, s.state),
      sprite: art,
      onBeat: (_i, grade) => app.world?.beat(nodeId, kind, grade),
    });
  }

  craft(station: string): void {
    openCraft(this, station);
  }

  campInfo(campId: string): void {
    const c = app.bundle.camps[campId];
    if (!c) return;
    const extra = c.bag_bonus ? ` It gives your bag ${c.bag_bonus} more places.` : '';
    void say(this, null, [`Your ${c.title}.${extra}`]);
  }

  build(campId: string): void {
    confirmBuild(this, campId);
  }

  restore(restoreId: string): void {
    confirmRestore(this, restoreId);
  }

  async sign(slotId: string): Promise<void> {
    const info = app.world?.signText(slotId);
    if (!info) return;
    if (info.creator) return openSignCard(this, info);
    const options: Option[] = info.empty ? [{ label: 'Open the creator guide', value: 'guide' }, { label: 'Close', value: 'close' }] : [];
    const pick = await say(this, info.title, info.lines, options);
    if (pick === 'guide') openGuide(this);
  }

  note(text: string, title?: string): void {
    void say(this, title ?? null, [text]);
  }
}

function rewardText(questId: string): string {
  const b = app.bundle;
  const r = b.quests[questId]!.reward;
  const parts: string[] = [];
  if (r.gold_mg) parts.push(`${gold(r.gold_mg)} gold`);
  for (const it of r.items ?? []) parts.push(`${it.qty} ${itemName(b, it.item)}`);
  for (const rc of r.recipes ?? []) parts.push(`the ${b.recipes[rc]?.title ?? rc} recipe`);
  if (r.rep) parts.push('their trust');
  return parts.join(', ') || 'their thanks';
}
