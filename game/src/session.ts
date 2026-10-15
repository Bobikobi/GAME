/**
 * One player's game in this browser: the kernel state, the clock and the
 * save. The kernel decides everything; this class only feeds it actions with
 * the current tick and remembers the result.
 *
 * The tick is game time in ms. It runs while the world is on screen and
 * stops while a menu or a dialogue is open, so reading never costs satiety.
 */
import {
  type Action,
  type Bundle,
  type GameEvent,
  KERNEL_VERSION,
  type State,
  fitWorn,
  hourOf,
  makeWalkable,
  newState,
  serialize,
  step,
} from '@game/kernel';
import { LEGACY_SAVE_KEY, REVIEW_KEY, SAVE_KEY } from './config';
import { s1 } from './net/s1';
import { slotContent } from './places';

/**
 * The save file's version. 2 came with the new opening (the axe, the three
 * starts and the recut): an older save is dropped once, with one notice on the
 * title screen, and from then on a save always loads (DECISIONS.md, 2026-10-10).
 */
const SAVE_VERSION = 2;
/** The date this browser first played the demo: kept outside the save, so no reset or new game clears it (CR-85). */
export const DEMO_SINCE_KEY = 'openfold.demo-since';

export type Facing = 'down' | 'up' | 'left' | 'right';
export interface LogEntry {
  a: Action;
  tick: number;
}

interface SaveFile {
  v: typeof SAVE_VERSION;
  kernel: string;
  content: string;
  tick: number;
  /** canonical text of the kernel state (rule R3) */
  state: string;
  pos: [number, number];
  facing: Facing;
  /** NPCs whose first conversation has already begun. Optional in old saves. */
  met?: string[];
  /** Remarks said and topics asked: "<npc>#<index>" and "<npc>?<index>" (GRUNT S-1). Optional in old saves. */
  heard?: string[];
  /** the last actions, attached to bug reports */
  tail: LogEntry[];
}

type Listener = (payload: never) => void;
export interface SessionEvents {
  /** an action started that keeps the player busy for `ms` */
  busy: { verb: string; ms: number };
  /** what an action produced, shown once the player is free again */
  events: GameEvent[];
  /** the state changed: redraw what depends on it */
  change: undefined;
}

const TAIL = 40;

export class Session {
  readonly bundle: Bundle;
  state: State;
  tick = 0;
  pos: [number, number];
  facing: Facing = 'down';
  readonly met = new Set<string>();
  readonly heard = new Set<string>();
  tail: LogEntry[] = [];
  /** set when the save was made with other content and had to be adapted */
  adapted = false;
  private pauses = 0;
  private deferred: GameEvent[] = [];
  /** the state and log from before the action that keeps the player busy now, so work walked away from can be taken back */
  private undo: { state: State; tail: LogEntry[] } | null = null;
  /** the record of a gather under way: counted as a pickup when the work lands, dropped when it is walked away from */
  private pickup: string | null = null;
  private listeners = new Map<keyof SessionEvents, Set<Listener>>();
  private sinceSave = 0;
  /** the in-game hour of the last frame: when it turns, what depends on the hour redraws */
  private hour = -1;

  private constructor(bundle: Bundle, state: State) {
    this.bundle = bundle;
    this.state = state;
    this.pos = [state.player.at[0], state.player.at[1]];
  }

  static fresh(bundle: Bundle): Session {
    const seed = new Uint32Array(1);
    crypto.getRandomValues(seed);
    return new Session(bundle, newState(bundle, seed[0] ?? 1));
  }

  static hasSave(): boolean {
    return readSave() !== undefined;
  }

  /**
   * Drop a save of an older version, once: the new opening does not fit it
   * (DECISIONS.md, 2026-10-10: saves reset once). The demo's date is stamped
   * first, so the reset never takes it away. True when a save was dropped.
   */
  static dropOld(): boolean {
    try {
      const text = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem(LEGACY_SAVE_KEY);
      if (!text) return false;
      let v: unknown;
      try {
        v = (JSON.parse(text) as { v?: unknown } | null)?.v;
      } catch {
        v = undefined;
      }
      // only a save that names an older version: an unreadable one is left as it was
      if (typeof v !== 'number' || v >= SAVE_VERSION) return false;
      stampDemo();
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(LEGACY_SAVE_KEY);
      return true;
    } catch {
      // storage may be blocked; there is no save to drop then
      return false;
    }
  }

  /** The date this browser first played the demo (YYYY-MM-DD), if it did. */
  static demoSince(): string | undefined {
    try {
      return localStorage.getItem(DEMO_SINCE_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  }

  static restore(bundle: Bundle): Session | undefined {
    const file = readSave();
    if (!file) return undefined;
    let state: State;
    try {
      state = JSON.parse(file.state) as State;
    } catch {
      return undefined;
    }
    // a save from before the riddle step (P-2, 8.10) has no solved list
    (state.player as { solved?: string[] }).solved ??= [];
    // a save from before kernel 0.3 wears nothing and has tried no craft
    const worn = state.player as Partial<Pick<State['player'], 'worn' | 'looks' | 'tries'>>;
    worn.worn ??= {};
    worn.looks ??= {};
    worn.tries ??= {};
    // a save from before health and hazards (P-5) has no town, outing, chase or fall count
    const danger = state.player as Partial<Pick<State['player'], 'town' | 'outing' | 'chase' | 'falls' | 'movedAt'>>;
    danger.town ??= '';
    danger.outing ??= null;
    danger.chase ??= null;
    danger.falls ??= 0;
    danger.movedAt ??= state.tick;
    // a save from before tending (P-13a) has no fire ledger
    const tending = state.player as Partial<Pick<State['player'], 'fires'>>;
    tending.fires ??= {};
    // a save from before expeditions (P-14a) has no expedition progress
    const expedition = state.player as Partial<Pick<State['player'], 'expeditions'>>;
    expedition.expeditions ??= {};
    const session = new Session(bundle, state);
    stampDemo();
    if (state.content !== bundle.tag) {
      // a new version of the world was published: keep what still exists
      if (!adapt(bundle, state)) return undefined;
      session.adapted = true;
    }
    session.tick = Math.max(file.tick, state.tick, state.player.busyUntil);
    session.facing = file.facing;
    if (Array.isArray(file.met)) {
      for (const npcId of file.met) if (typeof npcId === 'string') session.met.add(npcId);
    }
    if (Array.isArray(file.heard)) {
      for (const key of file.heard) if (typeof key === 'string') session.heard.add(key);
    }
    session.tail = file.tail.slice(-TAIL);
    const walkable = makeWalkable(bundle);
    const [x, y] = file.pos;
    session.pos = walkable(x, y, state.player) ? [x, y] : [state.player.at[0], state.player.at[1]];
    if (!walkable(session.pos[0], session.pos[1], state.player)) session.pos = [bundle.map.spawn.x, bundle.map.spawn.y];
    return session;
  }

  static erase(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(LEGACY_SAVE_KEY);
      localStorage.removeItem(REVIEW_KEY);
    } catch {
      // storage may be blocked; nothing to erase then
    }
  }

  get started(): boolean {
    return this.state.player.starter !== '';
  }

  get busy(): boolean {
    return this.tick < this.state.player.busyUntil;
  }

  get paused(): boolean {
    return this.pauses > 0;
  }

  /** Remember an NPC before dialogue opens. Returns true only the first time. */
  meet(npcId: string): boolean {
    if (this.met.has(npcId)) return false;
    this.met.add(npcId);
    this.save();
    return true;
  }

  /** Remember a remark said or a topic asked, so it steps back next time. */
  hear(key: string): void {
    if (this.heard.has(key)) return;
    this.heard.add(key);
    this.save();
  }

  pause(): void {
    this.pauses++;
  }

  resume(): void {
    this.pauses = Math.max(0, this.pauses - 1);
  }

  on<K extends keyof SessionEvents>(name: K, fn: (payload: SessionEvents[K]) => void): () => void {
    let set = this.listeners.get(name);
    if (!set) {
      set = new Set();
      this.listeners.set(name, set);
    }
    set.add(fn as Listener);
    return () => set.delete(fn as Listener);
  }

  private emit<K extends keyof SessionEvents>(name: K, payload: SessionEvents[K]): void {
    for (const fn of this.listeners.get(name) ?? []) (fn as (p: SessionEvents[K]) => void)(payload);
  }

  /** Called every frame with real elapsed ms. */
  advance(dt: number): void {
    if (!this.started || this.paused) return;
    // a long frame (tab switch, debugger) never fast-forwards the world
    this.tick += Math.max(0, Math.min(250, Math.round(dt)));
    if (this.deferred.length > 0 && !this.busy) {
      const events = this.deferred;
      this.deferred = [];
      this.landPickup();
      this.emit('events', events);
      this.emit('change', undefined);
    }
    // a glint at dusk, a plant that opens: the world redraws once an hour, not only after an action
    const hour = hourOf(this.bundle, this.tick);
    if (hour !== this.hour) {
      if (this.hour >= 0) this.emit('change', undefined);
      this.hour = hour;
    }
    this.sinceSave += dt;
    if (this.sinceSave > 5000) this.save();
  }

  /** Ask the kernel without changing anything: would this action be accepted? */
  check(action: Action): string | undefined {
    const r = step(this.bundle, this.state, action, this.tick);
    return r.ok ? undefined : r.error;
  }

  /**
   * Tell the kernel which tile the player stands on (DECISIONS.md, 2026-10-10:
   * health and hazards). Silent: it goes only when the tile changed, or with
   * `again` while a hunt runs so its bites land on a player standing still; a
   * refusal is dropped and walking goes on. What it brings (a hurt, a fall) is
   * shown like any other event.
   */
  report(at: readonly [number, number], again = false): void {
    // a step that was under way when a menu opened still lands: the kernel hears of every tile
    if (!this.started) return;
    const p = this.state.player;
    if (!again && p.at[0] === at[0] && p.at[1] === at[1]) return;
    const r = step(this.bundle, this.state, { t: 'move', at: [at[0], at[1]] }, this.tick);
    if (!r.ok) return;
    this.state = r.state;
    // a hunt heard during work changes the world under it: that work can no longer be taken back
    this.undo = null;
    if (r.events.length === 0) return;
    this.wake(r.events);
    this.emit('events', r.events);
    this.emit('change', undefined);
    this.save();
  }

  act(action: Action): { ok: true; events: GameEvent[] } | { ok: false; error: string } {
    const r = step(this.bundle, this.state, action, this.tick);
    if (!r.ok) return r;
    const before = { state: this.state, tail: this.tail.slice() };
    this.state = r.state;
    this.undo = null;
    this.wake(r.events);
    // each start wakes at its own place
    if (action.t === 'start') {
      this.pos = [r.state.player.at[0], r.state.player.at[1]];
      stampDemo();
    }
    this.tail.push({ a: action, tick: this.tick });
    if (this.tail.length > TAIL) this.tail.splice(0, this.tail.length - TAIL);
    this.tell(action, r.events);
    const busy = r.events.find((e) => e.e === 'busy');
    if (busy && busy.e === 'busy') {
      this.undo = before;
      this.deferred.push(...r.events.filter((e) => e.e !== 'busy'));
      this.emit('busy', { verb: busy.verb, ms: busy.ms });
    } else {
      this.emit('events', r.events);
      this.emit('change', undefined);
    }
    this.save();
    return { ok: true, events: r.events };
  }

  /** The stage-1 service hears of what the action did (GRUNT 18); it never changes what happens. */
  private tell(action: Action, events: readonly GameEvent[]): void {
    for (const e of events) {
      if (e.e === 'visit') {
        const record = slotContent(this.bundle, e.slot);
        if (record) s1.visit(record.id);
      } else if (e.e === 'quest') {
        s1.stop(e.state === 'done' ? `${e.quest}:done` : e.quest);
      }
    }
    if (action.t === 'gather') {
      const node = this.bundle.instances[action.node];
      this.pickup = node?.kind === 'resource' ? node.source : null;
      if (!events.some((e) => e.e === 'busy')) this.landPickup();
    }
  }

  private landPickup(): void {
    if (this.pickup) s1.pickup(this.pickup);
    this.pickup = null;
  }

  /** A fall moves the player to the town they were last in: the walk goes on from there. */
  private wake(events: readonly GameEvent[]): void {
    const fall = events.find((e) => e.e === 'fall');
    if (fall?.e !== 'fall') return;
    this.pos = [fall.at[0], fall.at[1]];
    // what the work under way would have announced went with the outing
    this.deferred = [];
    this.pickup = null;
    this.undo = null;
  }

  /**
   * The player walked away from work that was still going: the action that started it never
   * happened (no yield, no xp, no wear on the tool, the node still ready). False when nothing
   * is under way. The state is a plain value that `step` copies, so the old one is whole.
   */
  cancelWork(): boolean {
    if (!this.busy || !this.undo) return false;
    this.state = this.undo.state;
    this.tail = this.undo.tail;
    this.deferred = [];
    this.pickup = null;
    this.undo = null;
    this.emit('change', undefined);
    this.save();
    return true;
  }

  save(): void {
    this.sinceSave = 0;
    if (!this.started) return;
    const file: SaveFile = {
      v: SAVE_VERSION,
      kernel: KERNEL_VERSION,
      content: this.bundle.tag,
      tick: this.tick,
      state: serialize(this.state),
      pos: this.pos,
      facing: this.facing,
      met: [...this.met].sort(),
      heard: [...this.heard].sort(),
      tail: this.tail,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(file));
      localStorage.removeItem(LEGACY_SAVE_KEY);
    } catch {
      // private mode or full storage: the game still plays, it just will not resume
    }
  }
}

/** Stamp the demo's first day, once: never cleared, so a later title for its players can read it. */
function stampDemo(): void {
  try {
    if (localStorage.getItem(DEMO_SINCE_KEY) === null) localStorage.setItem(DEMO_SINCE_KEY, new Date().toISOString().slice(0, 10));
  } catch {
    // private mode or full storage: no stamp, and the game still plays
  }
}

function readSave(): SaveFile | undefined {
  try {
    const text = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem(LEGACY_SAVE_KEY);
    if (!text) return undefined;
    const file = JSON.parse(text) as SaveFile;
    return file.v === SAVE_VERSION && typeof file.state === 'string' ? file : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fit a save made with older content to the current bundle: drop what no
 * longer exists and keep the rest. Returns false when the character itself
 * is gone and the save cannot be used.
 */
function adapt(bundle: Bundle, state: State): boolean {
  const p = state.player;
  if (p.starter !== '' && !bundle.starters[p.starter]) return false;
  // saves from kernel 0.1 have no look, and a look can be withdrawn with its sprite
  if (typeof p.look !== 'number' || (p.look === 1 && p.starter !== '' && !bundle.starters[p.starter]?.sprite_alt)) p.look = 0;
  const keepKeys = <T>(record: Record<string, T>, known: Record<string, unknown>): Record<string, T> =>
    Object.fromEntries(Object.entries(record).filter(([k]) => k in known));
  p.bag = keepKeys(p.bag, bundle.items);
  p.wear = keepKeys(p.wear, bundle.items);
  p.made = keepKeys(p.made, bundle.recipes);
  p.quests = keepKeys(p.quests, bundle.quests);
  p.rep = keepKeys(p.rep, bundle.npcs);
  p.xp = keepKeys(p.xp, bundle.professions);
  p.journal = p.journal.filter((id) => id in bundle.items);
  p.recipes = p.recipes.filter((id) => id in bundle.recipes);
  // a recipe everyone starts with that came with this version is known at once
  if (p.starter !== '') {
    const fresh = Object.keys(bundle.recipes).filter((id) => bundle.recipes[id]!.known === 'start' && !p.recipes.includes(id));
    if (fresh.length > 0) p.recipes = [...p.recipes, ...fresh].sort();
  }
  // a start whose kit came with this version: a save that holds none of a kit item gets it once
  if (p.starter !== '') {
    for (const stack of bundle.starters[p.starter]!.kit ?? []) {
      if ((p.bag[stack.item] ?? 0) > 0) continue;
      p.bag[stack.item] = stack.qty;
      if (!p.journal.includes(stack.item)) p.journal = [...p.journal, stack.item].sort();
    }
  }
  p.tries = keepKeys(p.tries, bundle.recipes);
  p.restored = p.restored.filter((id) => id in bundle.restores);
  p.camp = p.camp.filter((id) => id in bundle.camps);
  p.visited = p.visited.filter((id) => bundle.map.slots.some((s) => s.id === id));
  // a world that changed may have moved the hazards and the safe ground: nothing carries over
  p.outing = null;
  p.chase = null;
  state.nodes = keepKeys(state.nodes, bundle.instances);
  // a worn item that is gone, or no longer fits its place, comes off
  fitWorn(bundle, state);
  state.content = bundle.tag;
  state.kernel = KERNEL_VERSION;
  return true;
}
