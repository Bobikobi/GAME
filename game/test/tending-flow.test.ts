/**
 * Maru's hearth (NEXT 13b) of game/e2e/tending.ts, played on the real map without a browser: the Session,
 * the kernel and the client's own pure rules (fires.ts for the journal line, the running-low warning and
 * when a log fits; text.ts for the toast lines). Two passes as in the e2e: the hearth kept from before
 * dusk to dawn and handed in for the bandage recipe, and a second character whose fire survives a reload
 * and then goes out, so the vigil stays unmet. A failure prints every beat so far; TENDING_VIEW=1 prints
 * them on a pass too.
 *
 * What it leaves to the e2e: the dialogue boxes themselves (the quest is accepted and handed in by its
 * kernel action, the warning box is the `fireWarning` the HUD opens), the Feed button on screen and the
 * flame's sprite, the toasts' timing, and everything drawn.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { type Bundle, fireBurns, makeWalkable, satietyCap } from '@game/kernel';
import { s1Use } from '../src/net/s1';
import { fireLow, fireWarning, nextLogClock, woodToFeed } from '../src/fires';
import { Session } from '../src/session';
import { describe as eventText, questSteps, readyToHandIn } from '../src/text';
import { loadBundle } from '../../tools/test/helpers/world';

const HEARTH = 'core/elder-hearth';
const QUEST = 'core/the-long-night';
const LOG = 'core/log';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number {
    return this.values.size;
  }
  clear(): void {
    this.values.clear();
  }
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

/** A player beside the elder hearth and Maru, on the real map, with nothing drawn. */
class Tender {
  readonly s: Session;
  /** the boxes the HUD would open for the running-low warning, as its `warnedFires` keeps them */
  private warned = new Set<string>();
  /** how many running-low boxes opened */
  warnings = 0;
  private readonly moments: string[] = [];

  constructor(
    readonly b: Bundle,
    session?: Session,
  ) {
    this.s = session ?? Session.fresh(b);
  }

  private get now(): string {
    const s = this.s;
    return `hour ${this.hour().toFixed(2)}, ${s.state.player.bag[LOG] ?? 0} logs, fire ${JSON.stringify(s.state.player.fires[HEARTH] ?? null)}, journal: ${this.tracker()}`;
  }

  /** Keep the moment, where the e2e takes a screenshot. */
  snap(label: string): void {
    this.moments.push(`-- ${label}: ${this.now}`);
    if (process.env.TENDING_VIEW) console.log(this.moments[this.moments.length - 1]);
  }

  fail(what: string): never {
    throw new Error([what, ...this.moments, `-- now: ${this.now}`].join('\n'));
  }

  check(ok: boolean, what: string): void {
    if (!ok) this.fail(what);
  }

  /** The e2e's clock jump: the next time the in-game hour reads `h`. */
  setHour(h: number): void {
    const s = this.s;
    const day = this.b.params.day_length_ms;
    let t = s.tick - ((s.tick + Math.floor(day / 2)) % day) + Math.round((h / 24) * day);
    if (t < s.tick) t += day;
    s.tick = t;
    // the jump is not hunger: health stays where the e2e's setup put it
    s.state.player.satietyAt = Math.max(s.state.player.satietyAt, s.state.tick);
  }

  hour(): number {
    const s = this.s;
    const day = this.b.params.day_length_ms;
    return (((s.tick + Math.floor(day / 2)) % day) * 24) / day;
  }

  /** A tile beside the hearth the player can stand on, beside Maru too: where both are in reach. */
  spot(): { at: [number, number]; facing: 'up' | 'down' | 'left' | 'right' } {
    const b = this.b;
    const walkable = makeWalkable(b);
    const p = b.map.props.find((x) => x.id === HEARTH);
    const slot = b.map.slots.find((x) => x.id === b.npcs['core/elder']?.place.slot);
    if (!p || !slot) return this.fail('no hearth or no Maru on the map');
    const m = [slot.x + Math.floor(slot.w / 2), slot.y + Math.floor(slot.h / 2)];
    const near = (a: readonly number[], c: readonly number[]) => Math.max(Math.abs(a[0]! - c[0]!), Math.abs(a[1]! - c[1]!)) <= 1;
    const tiles: [number, number][] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t: [number, number] = [p.x + dx, p.y + dy];
        if ((dx || dy) && walkable(t[0], t[1], this.s.state.player)) tiles.push(t);
      }
    }
    tiles.sort((a, c) => Number(near(c, m)) - Number(near(a, m)) || Math.abs(a[1] - p.y) - Math.abs(c[1] - p.y));
    const at = tiles[0];
    if (!at || !near(at, m)) return this.fail(`no tile beside both the hearth and Maru: ${JSON.stringify(tiles)}`);
    const facing = at[1] === p.y ? (at[0] < p.x ? 'right' : 'left') : at[1] < p.y ? 'down' : 'up';
    return { at, facing };
  }

  place(at: readonly [number, number]): void {
    this.s.pos = [at[0], at[1]];
    this.s.state.player.at = [at[0], at[1]];
  }

  /** A new character with Maru's coin found, beside the hearth, the long night accepted from Maru. */
  begin(logs: number): void {
    const s = this.s;
    expect(s.act({ t: 'start', starter: 'core/forager', name: 'Tess' }).ok).toBe(true);
    const p = s.state.player;
    // the earlier quests are setup: the opening is behind, Maru's coin is found, and Maru is met
    for (const id of Object.keys(p.quests)) if (p.quests[id] === 'active') p.quests[id] = 'done';
    for (const id of ['core/fix-the-bridge', 'core/first-fire', 'core/into-town', 'core/a-coin-for-maru']) p.quests[id] = 'done';
    if (!p.restored.includes('core/old-bridge')) p.restored.push('core/old-bridge');
    p.satiety = 10 * satietyCap(this.b, s.state);
    p.satietyAt = s.tick;
    p.bag[LOG] = logs;
    s.met.add('core/elder');
    this.setHour(17);
    this.place(this.spot().at);
    const r = s.act({ t: 'accept', quest: QUEST, at: s.pos });
    this.check(r.ok, `Maru did not give the long night: ${r.ok ? '' : r.error}`);
    // each action replaces the state: read the player afresh
    const now = s.state.player;
    this.check(now.quests[QUEST] === 'active', 'the long night is not active');
    // quests that open by themselves on the way are setup too: the tracker shows the vigil
    for (const id of Object.keys(now.quests)) if (id !== QUEST && now.quests[id] === 'active') now.quests[id] = 'done';
  }

  fire(): { lit: number; until: number } | null {
    return this.s.state.player.fires[HEARTH] ?? null;
  }

  burns(): boolean {
    return fireBurns(this.s.state, HEARTH, this.s.tick);
  }

  logs(): number {
    return this.s.state.player.bag[LOG] ?? 0;
  }

  /** The journal's line for the vigil, as the HUD's tracker shows it. */
  tracker(): string {
    return questSteps(this.b, this.s.state, QUEST, this.s.tick)
      .map((st) => st.text)
      .join(' | ');
  }

  /** What the journal still asks for: the logs to dawn, 0 once it asks for none. */
  logsNeeded(): number {
    const m = /fed to reach dawn: (\d+) more logs?/.exec(this.tracker());
    return m ? Number(m[1]) : 0;
  }

  /** The Feed button shows only with wood in the bag. */
  feedShown(): boolean {
    return woodToFeed(this.b, this.s.state) !== undefined;
  }

  /** One press of Feed, as ui.feed sends it: one log leaves the bag, or the fire is full and says when one fits. */
  feed(): { fed: true; toast: string } | { fed: false; toast: string } {
    const s = this.s;
    const item = woodToFeed(this.b, s.state);
    if (!item) return { fed: false, toast: 'You have no wood.' };
    const r = s.act({ t: 'feed', fire: HEARTH, item, at: s.pos });
    if (r.ok) {
      const toast = r.events.map((e) => eventText(this.b, s.state, e)?.text ?? '').join(' | ');
      return { fed: true, toast };
    }
    const at = nextLogClock(this.b, s.state, HEARTH, s.tick);
    return { fed: false, toast: at === undefined ? r.error : `${r.error} A log fits at ${at}.` };
  }

  /** Feed while the journal asks for logs, as a player would; `full` when the hearth refused a log that would not burn whole. */
  feedAsAsked(): { fed: number; full: boolean; refusal: string } {
    let fed = 0;
    while (this.logsNeeded() > 0) {
      const r = this.feed();
      if (!r.fed) return { fed, full: true, refusal: r.toast };
      fed++;
    }
    return { fed, full: false, refusal: '' };
  }

  /** The HUD's check for the running-low box, every beat: opens it once per burn. */
  beat(): boolean {
    const w = fireWarning(this.b, this.s.state, this.s.tick, this.warned);
    if (!w) return false;
    this.warned.add(w.key);
    this.warnings++;
    return true;
  }

  /** Maru's options for the long night: handed in when the kernel takes it, asked about while it waits. */
  maruOffers(): 'hand in' | 'about' {
    return readyToHandIn(this.b, this.s.state, QUEST, this.s.tick) ? 'hand in' : 'about';
  }
}

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
  s1Use(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Maru's hearth, played without a browser (game/e2e/tending.ts)", () => {
  test('the hearth kept from before dusk to dawn, and handed in for the bandage recipe', () => {
    const me = new Tender(bundle);
    me.begin(10);
    const s = me.s;

    me.check(me.tracker().includes('Keep the elder hearth burning until dawn - light it before dusk'), 'the journal does not ask to light the hearth');
    me.check(!me.burns(), 'the cold hearth burns');
    // the Feed button shows only with wood in the bag: it goes with the logs and comes back with them
    me.check(me.feedShown(), 'no Feed with ten logs in the bag');
    s.state.player.bag[LOG] = 0;
    me.check(!me.feedShown(), 'Feed shows with no wood');
    s.state.player.bag[LOG] = 10;

    me.setHour(19);
    me.snap('before-dusk-cold');
    const first = me.feed();
    me.check(first.fed, `the cold hearth refused its first log: ${first.toast}`);
    me.check(/The elder hearth burns until \d+:\d\d\./.test(first.toast), `the fire event line is "${first.toast}"`);
    me.check(me.burns(), 'the hearth does not burn after a log');
    const lit = me.fire()!.lit;
    me.check(me.tracker().includes('fed to reach dawn: 4 more logs'), 'the journal does not count four logs to dawn');

    // the cap holds three logs ahead of the clock: two more fit, each takes one log from the bag,
    // and the next press, still asked for by the journal, is refused with the log kept
    const before = JSON.stringify(me.fire());
    const topUp = me.feedAsAsked();
    me.check(topUp.fed === 2, `fed ${topUp.fed} more logs before the cap, not 2`);
    me.check(topUp.full, 'the hearth at its cap was never refused a log');
    me.check(me.logs() === 7, `the bag holds ${me.logs()} logs after three feeds, not 7`);
    me.check(/A log fits at \d+:\d\d\./.test(topUp.refusal), `the full toast does not say when a log fits: "${topUp.refusal}"`);
    const full = me.fire()!;
    expect(me.feed().fed).toBe(false);
    me.check(me.logs() === 7 && me.fire()!.until === full.until, 'a full fire still took a log or changed its burn');
    me.check(before !== JSON.stringify(full), 'the top-up did not lengthen the burn');
    me.check(/fed to reach dawn: 2 more logs, the next at 21:\d\d/.test(me.tracker()), 'the journal does not ask for two more logs and say when the next fits');
    me.snap('lit-before-dusk');

    // the first log of the night burns down: at 00:40 the embers run low and the warning opens once
    me.setHour(2 / 3);
    me.check(me.burns() && fireLow(bundle, s.state, HEARTH, s.tick), 'the embers do not run low at 00:40');
    me.check(me.beat() && me.warnings === 1, 'the running-low warning did not open');
    me.snap('running-low');
    me.check(!me.beat(), 'the warning opened a second time in the same burn');
    const night = me.feedAsAsked();
    me.check(night.fed === 2 && !night.full, `fed ${night.fed} logs to reach dawn after midnight (full: ${night.full}), not 2`);
    me.check(me.fire()!.lit === lit, 'a top-up started a new burn');
    me.check(me.tracker().includes('it has the wood: wait for dawn'), 'the journal does not wait for dawn with wood to reach it');
    me.check(me.maruOffers() === 'about', 'the vigil was met before dawn');
    me.check(!fireLow(bundle, s.state, HEARTH, s.tick), 'the flame stays low after the top-up');

    // running low again before dawn is the same burn: no second box
    me.setHour(4.75);
    me.check(fireLow(bundle, s.state, HEARTH, s.tick), 'the embers do not dim before dawn');
    for (let t = 0; t < 1500; t += 250) {
      s.advance(250);
      me.beat();
    }
    me.check(me.warnings === 1, 'the warning opened twice in one burn');
    me.setHour(5.5);
    me.check(!me.burns(), 'the hearth still burns after dawn');
    me.check(me.maruOffers() === 'hand in', 'the vigil is not met at dawn');
    me.snap('dawn-met');

    expect(s.state.player.recipes).not.toContain('core/bandage');
    const done = s.act({ t: 'turnin', quest: QUEST, at: s.pos });
    me.check(done.ok, `Maru did not take the long night: ${done.ok ? '' : done.error}`);
    me.check(s.state.player.quests[QUEST] === 'done', 'the long night is not done');
    me.check(s.state.player.recipes.includes('core/bandage'), 'the bandage recipe was not given');
    me.check(me.warnings === 1, 'the warning count changed after the vigil');
    me.snap('handed-in');
  });

  test('a lit hearth survives a reload, and a fire that goes out leaves the vigil unmet', () => {
    const first = new Tender(bundle);
    first.begin(3);
    expect(first.s.state.player.recipes).not.toContain('core/bandage');
    first.setHour(19);
    first.check(first.feed().fed, 'the second hearth refused its log');
    const kept = first.fire();

    // the burn lives in the save: a reload finds the hearth still burning
    first.s.save();
    const back = Session.restore(bundle);
    if (!back) throw new Error('the save did not load');
    const me = new Tender(bundle, back);
    const again = me.fire();
    me.check(!!again && again.lit === kept?.lit && again.until === kept?.until, `the fire did not survive the reload: ${JSON.stringify({ kept, again })}`);
    me.check(me.burns(), 'the reloaded hearth does not burn');
    me.place(first.spot().at);

    me.setHour(22);
    me.check(!me.burns(), 'the unfed hearth did not go out');
    me.check(me.tracker().includes('light it before dusk'), 'the journal does not ask for a new fire');
    me.setHour(5.5);
    const dawn = me.hour();
    me.check(dawn >= 5.5 && dawn <= 6, `the clock is not at dawn: ${dawn}`);
    me.check(me.tracker().includes('Keep the elder hearth burning until dawn'), 'the journal is missing at dawn');
    me.check(me.maruOffers() === 'about', 'Maru takes a vigil that went out');
    const refused = me.s.act({ t: 'turnin', quest: QUEST, at: me.s.pos });
    me.check(!refused.ok, 'the kernel took a vigil that went out');
    me.check(me.s.state.player.quests[QUEST] === 'active', 'the unmet vigil left the journal');
  });
});
