/**
 * Everything drawn as page elements over the canvas: the HUD, toasts, the
 * action prompt, dialogue, menus and the timing minigame. Layers stack; the
 * top one gets the buttons, and while any is open the game clock stops.
 */
import { offerSignup } from './signup';
import {
  OWN_FIRE,
  type GameEvent,
  type Grade,
  characterLevel,
  doneLines,
  findSlot,
  holds,
  isNight,
  minuteOfDay,
  pickRemark,
  resourceOf,
  rewardItem,
  satietyAt,
  satietyCap,
  skillPoints,
  talkLines,
} from '@game/kernel';
import { app } from '../app';
import type { Button } from '../input';
import { fireWarning, nextLogClock, woodToFeed } from '../fires';
import type { GameSession } from '../session-surface';
import {
  activeQuests,
  clock,
  digRiddleOpen,
  gold,
  hudUnlocks,
  itemName,
  lanternNight,
  nightCountdown,
  nodeAction,
  questSteps,
  readyToHandIn,
  windowScalePct,
} from '../text';
import { type Toast, type Tone, ToastBand, eventToasts, readTime, urgent } from '../toasts';
import { localMapState } from '../places';
import { resourceKind, treasureKind } from '../work';
import { say, type Option } from './dialog';
import { STONE_RESTORE, STONE_SPEAKER } from '../stone';
import { carveName } from './carve';
import { button, h, sprite } from './dom';
import { miniMapSvg } from './map';
import { feedback } from './feedback';
import { type Minigame, pick, snap, strike, timing } from './games';
import { BEAT, buzz } from './haptics';
import { openLevelUp } from './levelup';
import { FULL_BAG, HEAVY_LINE, flashFull, loadChip, loadView, paintLoad, turnedHeavy } from './load';
import {
  openBag,
  openCraft,
  openJournal,
  openMap,
  openMenu,
  openShop,
  openSignCard,
  confirmBuild,
  confirmRestore,
  openFeedback,
  openOpeningReview,
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
  /** a dialogue box: where it covers the toasts (a phone's low band) they wait while it is open */
  holdsToasts?: boolean;
}

/** The HUD's live elements, built once; renderHud() patches their values. */
interface HudParts {
  meter: HTMLElement;
  bar: HTMLElement;
  num: HTMLElement;
  goldText: Text;
  clockChip: HTMLElement;
  clockIcon: HTMLElement;
  clockText: Text;
  /** the countdown to dark (G31), shown only outside a safe place in a world with hazards */
  dark: HTMLElement;
  darkText: Text;
  level: HTMLElement;
  bag: HTMLButtonElement;
  /** the load on the bag button: "14 / 24" and one coloured word (DECISIONS.md, 2026-10-23) */
  load: HTMLElement;
  log: HTMLButtonElement;
}

export class UI {
  readonly root: HTMLElement;
  private hud: HTMLElement;
  private tracker: HTMLElement;
  private toasts: HTMLElement;
  /** the toasts up and in line (two at most up); its one timer brings it to its next change */
  private band = new ToastBand<HTMLElement>();
  private bandTimer = 0;
  private promptEl: HTMLElement;
  private layers: Layer[] = [];
  private loadingEl: HTMLElement | undefined;
  private titleOpen = false;
  private hudTimer = 0;
  private hudParts: HudParts | undefined;
  private hudMap: HTMLButtonElement;
  private hudMapChart: HTMLElement;
  private hudMapNote: HTMLElement;
  private hudMapKey = '';
  private trackerKey = '';
  private talkCount = new Map<string, number>();
  private levelUpOpen = false;
  private stoneOpen = false;
  /** the night (its end tick) whose lantern warning was shown, so it opens once per night */
  private warnedNight: number | undefined;
  /** the burns (fire and lit tick) whose running-low warning was shown, so it opens once per burn */
  private warnedFires = new Set<string>();
  /** the pace at the last look, so turning heavy is said once */
  private loadSeen: { band?: 'light' | 'steady' | 'heavy' } = {};

  constructor(root: HTMLElement) {
    this.root = root;
    this.hud = h('div', { class: 'hud', hidden: true });
    this.tracker = h('div', { class: 'tracker', hidden: true });
    this.toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
    this.promptEl = h('div', { class: 'prompt', hidden: true });
    this.hudMapChart = h('span', { class: 'hud-map-chart' });
    this.hudMapNote = h('span', { class: 'hud-map-note' }, 'No stall placed');
    this.hudMap = h(
      'button',
      { class: 'hud-map', type: 'button', title: 'The valley - open the map', hidden: true, onclick: () => this.panel(() => openMap(this)) },
      h('span', { class: 'hud-map-head' }, h('span', null, 'THE VALLEY'), h('span', null, 'Map')),
      this.hudMapChart,
      this.hudMapNote,
    );
    this.loadingEl = h('div', { class: 'loading' }, h('div', { class: 'loading-title' }, 'Loading the valley'), h('div', { class: 'loading-bar' }, h('i')));
    root.append(h('div', { class: 'top' }, this.hud, this.tracker, this.toasts), this.promptEl, this.loadingEl, this.hudMap);
    mountTouch(root);
    this.tracker.addEventListener('click', () => this.panel(() => openJournal(this, 'tasks')));
  }

  get blocking(): boolean {
    return this.layers.length > 0 || this.titleOpen;
  }

  /** Opens a panel that reads the state: work under way is taken back first, so it never shows what will not stay. */
  private panel(open: () => void): void {
    app.world?.dropWork();
    open();
  }

  // ------------------------------------------------------------ layers

  push(layer: Layer): void {
    this.layers.push(layer);
    this.root.append(layer.el);
    this.hudMap.hidden = true;
    app.session?.pause();
    this.setPrompt('');
    // the hold starts as the box opens: a toast already up keeps the rest of its time for after it
    if (layer.holdsToasts) this.runBand();
  }

  pop(layer: Layer): void {
    const i = this.layers.indexOf(layer);
    if (i < 0) return;
    this.layers.splice(i, 1);
    layer.el.remove();
    if (this.layers.length === 0 && app.session?.started) this.hudMap.hidden = false;
    app.session?.resume();
    layer.onClose?.();
    this.renderHud();
    // toasts held by a box go up once it closes, unless the next box of the same beat opens at once
    this.runBandSoon();
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
    else if (b === 'bag') this.panel(() => openBag(this));
    else if (b === 'journal') this.panel(() => openJournal(this));
    else if (b === 'menu') this.panel(() => openMenu(this));
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
  begin(session: GameSession): void {
    app.session = session;
    app.world?.bind(session);
    session.on('events', (events) => {
      // a fall says it all in its one box: the calls to run from a hunt that has ended come down
      if (events.some((e) => e.e === 'fall')) this.clearToasts();
      for (const t of eventToasts(app.bundle, session.state, events)) this.queueToast(t);
      feedback(this.root, events);
      void this.afterEvents(events);
      // after the story beats begin: on a phone a box they opened holds this batch's toasts until it closes
      this.runBand();
    });
    session.on('change', () => this.renderHud());
    this.hud.hidden = false;
    this.tracker.hidden = false;
    this.hudMap.hidden = false;
    this.renderHud();
    window.clearInterval(this.hudTimer);
    this.hudTimer = window.setInterval(() => this.renderHud(), 500);
    if (session.adapted) this.toast('The valley was updated since your last visit.', 'info');
    // a bridge mended with no name cut (the page closed before the carve): the stone asks again
    const p = session.state.player;
    if (p.race !== '' && p.name === '' && p.restored.includes(STONE_RESTORE)) {
      window.setTimeout(() => void this.stoneBeat(STONE_RESTORE, false), 800);
    }
  }

  // ------------------------------------------------------------ HUD

  renderHud(): void {
    const s = app.session;
    if (!s?.started) return;
    const b = app.bundle;
    const st = s.state;
    const p = this.hudParts ?? (this.hudParts = this.buildHud());
    const cap = satietyCap(b, st);
    const sat = satietyAt(b, st, s.tick);
    const pct = Math.round((sat / cap) * 100);
    const points = skillPoints(b, st);
    const night = isNight(b, s.tick);
    const unlocked = hudUnlocks(st, points);
    setClass(p.meter, sat === 0 ? 'meter empty' : pct < 25 ? 'meter low' : 'meter');
    p.bar.style.width = `${pct}%`;
    setText(p.num, String(Math.ceil(sat / 1000)));
    setText(p.goldText, gold(st.player.gold));
    setTitle(p.clockChip, night ? 'Night' : 'Day');
    setClass(p.clockIcon, night ? 'moon' : 'sun');
    setText(p.clockText, clock(minuteOfDay(b, s.tick)));
    const dark = nightCountdown(b, st, s.pos, s.tick);
    p.dark.hidden = !dark;
    if (dark) {
      setClass(p.dark, dark.soon ? 'chip dark soon' : 'chip dark');
      setText(p.darkText, dark.text);
    }
    this.warnAtNight(s);
    this.warnFireLow(s);
    setClass(p.level, points > 0 ? 'chip glow' : 'chip');
    setTitle(p.level, points > 0 ? 'A skill point to spend: open the journal' : 'Character level');
    setText(p.level, `Lv ${characterLevel(b, st)}${points > 0 ? ' +' : ''}`);
    p.bag.hidden = !unlocked.bag;
    const load = loadView(b, st);
    paintLoad(p.load, load);
    if (turnedHeavy(this.loadSeen, load.band)) this.toast(HEAVY_LINE, 'info');
    p.log.hidden = !unlocked.log;
    this.renderTracker(s);
    this.renderHudMap(s);
    this.placeToasts(s);
  }

  /** The desktop's pocket chart: redrawn only when the walk, the map or the stall changed. */
  private renderHudMap(s: GameSession): void {
    const local = localMapState(s);
    if (!local) {
      this.hudMap.hidden = true;
      return;
    }
    const key = `${s.pos[0]},${s.pos[1]}|${local.seen.size}|${local.seenChunks.size}|${local.stall ?? ''}`;
    if (key === this.hudMapKey) return;
    this.hudMapKey = key;
    this.hudMapChart.innerHTML = miniMapSvg(app.bundle, { seen: local.seen, chunks: local.seenChunks, at: s.pos, stall: local.stall });
    this.hudMapNote.textContent = local.stall ? 'Your stall · the empty corner' : 'No stall placed';
  }

  /**
   * On a phone the toasts sit low, above the action prompt (style.css). Where the camera stops
   * at the foot of the map the player can stand that low too, and there they go up under the tracker.
   */
  private placeToasts(s: GameSession): void {
    const feet = app.world?.screenOf(s.pos[0], s.pos[1] + 1).y;
    // up past 60% of the height, back down above 55%: a step to and fro on one row does not toss them
    const up = this.toasts.classList.contains('up');
    this.toasts.classList.toggle('up', feet !== undefined && feet > window.innerHeight * (up ? 0.55 : 0.6));
  }

  /** The HUD's elements, once; after that renderHud() patches what changed. */
  private buildHud(): HudParts {
    const bar = h('i');
    const num = h('span', { class: 'meter-num' });
    const meter = h(
      'div',
      { class: 'meter', title: 'Health: hazards and bad food take it, food gives it back. Empty means slower work.' },
      h('span', { class: 'meter-label' }, 'Health'),
      h('span', { class: 'meter-bar' }, bar),
      num,
    );
    const goldText = document.createTextNode('');
    const clockIcon = h('i', { class: 'sun' });
    const clockText = document.createTextNode('');
    const clockChip = h('span', { class: 'chip', title: 'Day' }, clockIcon, clockText);
    const darkText = document.createTextNode('');
    const dark = h('span', { class: 'chip dark', title: 'Dark falls: be in town or by a burning camp', hidden: true }, h('i', { class: 'moon' }), darkText);
    const level = h('span', { class: 'chip', title: 'Character level' });
    const load = loadChip();
    const bag = button([h('span', { class: 'load-label' }, 'Bag'), load], () => this.panel(() => openBag(this)), 'small');
    const log = button('Journal', () => this.panel(() => openJournal(this)), 'small');
    const feedbackBtn = button('Feedback', () => openFeedback(this), 'small');
    this.hud.replaceChildren(
      h(
        'div',
        { class: 'hud-left' },
        meter,
        h(
          'div',
          { class: 'hud-row' },
          h('span', { class: 'chip gold', title: 'Gold' }, h('i', { class: 'coin' }), goldText),
          clockChip,
          dark,
          level,
          h('button', { class: 'chip demo', type: 'button', onclick: () => this.aboutDemo() }, 'Demo'),
        ),
      ),
      h('div', { class: 'hud-right' }, feedbackBtn, bag, log, button('Menu', () => this.panel(() => openMenu(this)), 'small')),
    );
    return { meter, bar, num, goldText, clockChip, clockIcon, clockText, dark, darkText, level, bag, load, log };
  }

  /**
   * Dark outside a safe place lights the lantern and opens one warning box,
   * once a night (G31): the player left safety after dark, or dark came while
   * they were out. The lantern is a sign that the night began, not a shield.
   */
  private warnAtNight(s: GameSession): void {
    const night = lanternNight(app.bundle, s.state, s.pos, s.tick);
    if (night === undefined || night === this.warnedNight || this.blocking || s.paused) return;
    this.warnedNight = night;
    app.world?.lightLantern();
    void say(this, null, [
      'Dark. Your lantern is lit - but its light keeps nothing away.',
      'Out here the night hunts. The town and a burning camp are safe; go back to one, or keep your eyes open.',
    ]);
  }

  /**
   * A fire a tend step keeps warns before it goes out (G31): one box, once per burn, in
   * its last `fire.warn_min` game minutes, wherever the player stands (the night is theirs to
   * keep, on screen or not) while no box is open, and only while it still needs wood for the
   * night it keeps (`wantsWood`).
   */
  private warnFireLow(s: GameSession): void {
    if (this.blocking || s.paused) return;
    const w = fireWarning(app.bundle, s.state, s.tick, this.warnedFires);
    if (!w) return;
    this.warnedFires.add(w.key);
    void say(this, null, [`The ${w.name} is burning low.`, 'Wood keeps it: feed it before it goes out.']);
  }

  private renderTracker(s: GameSession): void {
    const b = app.bundle;
    const ids = activeQuests(b, s.state);
    let title = 'Explore the valley';
    let more = 0;
    let lines: string[] = [];
    const main = ids[0];
    if (main) {
      const q = b.quests[main]!;
      const giver = q.giver ? b.npcs[q.giver]?.name : undefined;
      title = q.title;
      more = ids.length - 1;
      lines =
        readyToHandIn(b, s.state, main, s.tick) && giver
          ? [`Bring it to ${giver}`]
          : questSteps(b, s.state, main, s.tick)
              .filter((st) => !st.done)
              .slice(0, 2)
              .map((st) => st.short ?? st.text);
    }
    // rebuilt only when its words change, not on every tick
    const key = JSON.stringify([title, more, lines]);
    if (key === this.trackerKey) return;
    this.trackerKey = key;
    this.tracker.replaceChildren(
      h('div', { class: 'tracker-title' }, title, more > 0 ? h('span', { class: 'more' }, ` +${more}`) : null),
      ...lines.map((text) => h('div', { class: 'tracker-step' }, text)),
    );
  }

  setPrompt(label: string): void {
    this.promptEl.hidden = label === '';
    this.promptEl.replaceChildren(h('b', null, 'A'), ' ', label);
  }

  toast(text: string, tone: Tone = 'info', icon?: string): void {
    this.queueToast({ lines: [text], tone, ...(icon ? { icon } : {}) });
    this.runBand();
  }

  /** A toast joins the line (toasts.ts): two at most stand at once, a bad one goes ahead, and none is dropped. */
  private queueToast(t: Toast): void {
    if (t.lines.some((l) => FULL_BAG.test(l))) flashFull(this.hud);
    const el = h('div', { class: `toast ${t.tone}` }, t.icon ? sprite(app.bundle, t.icon, 1) : null, h('span', { class: 'toast-text' }, t.lines.join('\n')));
    this.band.add(el, { urgent: urgent(t), read: readTime(t) });
  }

  /** Puts toasts up, fades them and takes them down as the band says, then waits for its next change. */
  private runBand(): void {
    window.clearTimeout(this.bandTimer);
    const now = performance.now();
    const step = this.band.run(now, this.held());
    for (const el of step.remove) el.remove();
    for (const el of step.show) this.toasts.append(el);
    for (const el of step.fade) el.classList.add('out');
    if (step.next !== undefined) this.bandTimer = window.setTimeout(() => this.runBand(), step.next - now);
  }

  /** The band at the end of this turn, once every box this turn opens is open. */
  private runBandSoon(): void {
    window.clearTimeout(this.bandTimer);
    this.bandTimer = window.setTimeout(() => this.runBand(), 0);
  }

  /** A dialogue box covers the toasts where they sit low (a phone, style.css): while one is open there, they wait. */
  private held(): boolean {
    return this.layers.some((l) => l.holdsToasts) && getComputedStyle(this.toasts).position === 'fixed';
  }

  private clearToasts(): void {
    this.band.clear();
    this.toasts.replaceChildren();
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

  /** The content's words when a place is mended or a quest handed in (GRUNT S-2): the narrator, then the giver. */
  private async storyBeats(events: readonly GameEvent[]): Promise<void> {
    const s = app.session;
    const b = app.bundle;
    if (!s) return;
    for (const e of events) {
      if (e.e === 'restore') {
        const done = b.restores[e.restore]?.done;
        if (done) await say(this, null, named(done));
        if (e.restore === STONE_RESTORE) await this.stoneBeat(e.restore);
      }
      if (e.e === 'quest' && e.state === 'done') {
        const q = b.quests[e.quest];
        const giver = q?.giver ? b.npcs[q.giver] : undefined;
        // a quest a predator bit the player on has the giver's other line, when the content wrote one
        const done = doneLines(b, s.state, e.quest);
        if (done) await say(this, giver?.name ?? null, named(done));
      }
      // a fall is one plain box (G33): what happened and what it cost, never where it was
      if (e.e === 'fall') await say(this, null, fallLines(b, s.state.player.town, e.lost));
      // the threshold of the night ruins is a place, not a mend or a task: the opening's last words
      if (e.e === 'visit' && e.slot === 'core/night-threshold') {
        await say(this, null, [
          'Past the arch the ruins go on, darker and deeper than by day. Far below, a bell rings once.',
          'Not tonight. The way stays open.',
        ]);
        void openOpeningReview(this).then(() => offerSignup(this));
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
    // a remark the world has earned is said once, in place of the standing line (GRUNT S-1)
    const remark = first ? undefined : pickRemark(b, s.state, npcId, s.heard, s.tick);
    if (remark) s.hear(remark.key);
    const lines = firstLines.length
      ? firstLines
      : remark
        ? named(remark.say)
        : [tierLines[n % tierLines.length] ?? '...'];

    const options: Option[] = [];
    if (!first) {
      // the topics the world has opened, the ones not yet asked first, four at most
      const open = (npc.topics ?? [])
        .map((topic, index) => ({ topic, index, asked: s.heard.has(`${npcId}?${index}`) }))
        .filter(({ topic }) => !topic.when || holds(b, s.state, topic.when, s.tick));
      open.sort((x, y) => Number(x.asked) - Number(y.asked) || x.index - y.index);
      for (const { topic, index } of open.slice(0, 4)) options.push({ label: topic.ask, value: `topic:${index}` });
    }
    for (const [id, q] of Object.entries(b.quests).sort(([x], [y]) => x.localeCompare(y))) {
      if (q.giver !== npcId) continue;
      const state = s.state.player.quests[id];
      if (state === 'active') {
        options.push({ label: q.title, value: `quest:${id}` });
      } else if (!state && (q.requires ?? []).every((r) => s.state.player.quests[r] === 'done')) {
        options.push({ label: q.title, value: `quest:${id}` });
      }
    }
    if (npc.shop) options.push({ label: 'Trade', value: 'trade' });
    options.push({ label: 'Goodbye', value: 'bye' });

    const choice = await say(this, npc.name, lines, options);
    if (!choice || choice === 'bye') return;
    if (choice.startsWith('topic:')) {
      const index = Number(choice.slice(6));
      const topic = npc.topics?.[index];
      if (topic) {
        s.hear(`${npcId}?${index}`);
        await say(this, npc.name, named(topic.lines));
      }
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
      const pick = await say(this, npc.name, [...named(talkLines(b, s.state, questId, 'offer', s.tick) ?? [q.summary]), `Reward: ${rewards}.`], [
        { label: 'I will do it', value: 'yes' },
        { label: 'Not now', value: 'no' },
      ]);
      if (pick !== 'yes') return;
      const r = await s.act({ t: 'accept', quest: questId, at: s.pos });
      if (!r.ok) this.toast(r.error, 'bad');
      return;
    }
    if (readyToHandIn(b, s.state, questId, s.tick)) {
      const r = await s.act({ t: 'turnin', quest: questId, at: s.pos });
      if (!r.ok) this.toast(r.error, 'bad');
      return;
    }
    const left = questSteps(b, s.state, questId, s.tick).filter((st) => !st.done).map((st) => st.text);
    await say(this, npc.name, [...named(talkLines(b, s.state, questId, 'waiting', s.tick) ?? [q.summary]), `Still needed: ${left.join('; ')}.`]);
  }

  async gather(nodeId: string): Promise<void> {
    const s = app.session;
    const b = app.bundle;
    if (!s) return;
    const r = resourceOf(b, nodeId)!;
    const why = s.check({ t: 'gather', node: nodeId, grade: 3, at: s.pos });
    if (why) return this.toast(why, 'bad');
    // a node worked with a tool runs by itself after this one press: no pop-up, no bar
    if (resourceKind(r)) return app.world?.startWork(nodeId);
    const game = r.game ?? 'timing';
    const grade = await this.play(GAMES[game], nodeAction(b, r), nodeId, game, b.items[r.output]?.sprite ?? r.sprite);
    if (grade === null) return;
    const res = await s.act({ t: 'gather', node: nodeId, grade, at: s.pos });
    if (!res.ok) this.toast(res.error, 'bad');
  }

  /** Pick a thing put down back up, from the tile the player stands on. */
  async pickUp(itemId: string): Promise<void> {
    const s = app.session;
    if (!s) return;
    const r = await s.act({ t: 'pickup', item: itemId, at: s.pos });
    if (!r.ok) this.toast(r.error, 'bad');
  }

  async dig(spotId: string): Promise<void> {
    const s = app.session;
    if (!s) return;
    const why = s.check({ t: 'dig', spot: spotId, grade: 3, at: s.pos });
    if (why) return this.toast(why, 'bad');
    // a find picked up by hand has no timing window
    const treasure = app.bundle.treasures[app.bundle.instances[spotId]?.source ?? ''];
    const byHand = !treasure?.tool;
    if (treasure && treasureKind(treasure)) {
      // the trowel digs by itself; the catch (G6) is said once the hands stop
      app.world?.startWork(spotId, () => this.digCatch(spotId));
      return;
    }
    const grade = byHand ? 3 : await this.play(timing, 'Dig', spotId, 'dig');
    if (grade === null) return;
    const res = await s.act({ t: 'dig', spot: spotId, grade, at: s.pos });
    if (!res.ok) return this.toast(res.error, 'bad');
    if (!res.events.some((e) => e.e === 'riddle')) this.digCatch(spotId, res.events.find((e) => e.e === 'busy'));
  }

  /** The catch (G6): while a riddle waits on a dig somewhere else, a dig here says so once the hands stop. */
  private digCatch(spotId: string, busy?: GameEvent): void {
    const s = app.session;
    if (!s || !digRiddleOpen(app.bundle, s.state, app.bundle.instances[spotId]!.source)) return;
    window.setTimeout(() => this.toast('Not here. Read the stones again.', 'info'), busy?.e === 'busy' ? busy.ms : 0);
  }

  /** A minigame for one action; every beat swings the arm and makes its sound in the world. */
  private play(game: Minigame, title: string, nodeId: string, kind: WorkKind, art?: string): Promise<Grade | null> {
    const s = app.session!;
    return game(this, {
      title,
      scalePct: windowScalePct(app.bundle, s.state),
      sprite: art,
      onBeat: (_i, grade) => {
        buzz(BEAT[grade]);
        app.world?.beat(nodeId, kind, grade);
      },
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

  /** Feed a fire one piece of wood: a log first when the bag holds one; a refusal shows like any other. */
  async feed(fireId: string): Promise<void> {
    const s = app.session;
    if (!s) return;
    const item = woodToFeed(app.bundle, s.state);
    if (!item) return this.toast('You have no wood.', 'bad');
    const r = await s.act({ t: 'feed', fire: fireId, item, at: s.pos });
    if (r.ok) return;
    // a fire too full for a whole log refuses it: say when one fits, as the journal does.
    // The player's own fire tells no clock (NEXT 21b): its log is shorter on deeper ground.
    const at = fireId === OWN_FIRE ? undefined : nextLogClock(app.bundle, s.state, fireId, s.tick);
    this.toast(at === undefined ? r.error : `${r.error} A log fits at ${at}.`, 'bad');
  }

  /**
   * Build the player's own fire on `at`, the free tile the Build a fire button points at (NEXT 21b). The kernel
   * decides every refusal and keeps the logs itself: this sends the action and shows the kernel's words as a toast.
   */
  async kindle(at: readonly [number, number]): Promise<void> {
    const s = app.session;
    if (!s) return;
    const r = await s.act({ t: 'kindle', fire: [at[0], at[1]], at: s.pos });
    if (!r.ok) this.toast(r.error, 'bad');
  }

  /**
   * The bridge's stone after the mend (NEXT 16 e): the camera comes down to it while the stone speaks of the purse,
   * then the name is cut, last. A player who typed a name at the start has it cut; one who did not is asked, and may
   * leave it to the stone's default. The camera is always let go.
   */
  private async stoneBeat(restoreId: string, pay = true): Promise<void> {
    const s = app.session;
    const def = app.bundle.restores[restoreId];
    const slot = def?.place.slot;
    if (!s || !slot || !def.stone || this.stoneOpen) return;
    this.stoneOpen = true;
    const glide = app.world?.stoneStop?.(slot);
    try {
      if (pay) await say(this, STONE_SPEAKER, def.stone.purse);
      await glide;
      if (s.state.player.name === '') {
        const r = await s.act({ t: 'carve', name: await carveName(this, def.stone.default_name) });
        if (!r.ok) this.toast(r.error, 'bad');
      }
      await say(this, null, [`You cut ${s.state.player.name} into the last line.`]);
    } finally {
      this.stoneOpen = false;
      app.world?.stoneRelease?.();
    }
  }

  async sign(slotId: string): Promise<void> {
    const info = app.world?.signText(slotId);
    if (!info) return;
    if (info.creator) return openSignCard(this, info);
    await say(this, info.title, info.lines);
  }

  note(text: string, title?: string): void {
    void say(this, title ?? null, [text]);
  }
}

/** A content line with the player's name where it says "{name}". */
function named(lines: readonly string[]): string[] {
  const name = app.session?.state.player.name ?? '';
  return lines.map((line) => line.replaceAll('{name}', name));
}

function rewardText(questId: string): string {
  const b = app.bundle;
  const r = b.quests[questId]!.reward;
  const pocket = app.session?.state.player.pocket ?? '';
  const parts: string[] = [];
  if (r.gold_mg) parts.push(`${gold(r.gold_mg)} gold`);
  // what this wake gets: a reward its pocket's ground already laid is swapped for one it lacks
  for (const it of r.items ?? []) parts.push(`${it.qty} ${itemName(b, rewardItem(b, pocket, it))}`);
  for (const rc of r.recipes ?? []) parts.push(`the ${b.recipes[rc]?.title ?? rc} recipe`);
  for (const o of r.opens ?? []) parts.push(`a way through the ${b.restores[o]?.title ?? o}`);
  if (r.rep) parts.push('their trust');
  return parts.join(', ') || 'their thanks';
}

/** The box after a fall (G33): the dark, where the player woke, and what the outing's basket held. */
export function fallLines(b: typeof app.bundle, town: string, lost: readonly { item: string; qty: number }[]): string[] {
  const label = findSlot(b.map, town)?.label;
  const lines = ['Everything went dark.', `You wake ${label ? `in the ${label.toLowerCase()}` : 'where you started'}, whole again.`];
  lines.push(
    lost.length > 0
      ? `What you gathered out there is gone: ${lost.map((l) => `${l.qty} ${itemName(b, l.item)}`).join(', ')}.`
      : 'You had gathered nothing out there, so nothing is lost.',
  );
  return lines;
}

function setText(node: Text | HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

function setClass(el: HTMLElement, cls: string): void {
  if (el.className !== cls) el.className = cls;
}

function setTitle(el: HTMLElement, title: string): void {
  if (el.title !== title) el.title = title;
}
