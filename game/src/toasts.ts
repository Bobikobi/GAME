/**
 * The rules of the toasts, kept apart from the page so they can be tested.
 *
 * The task lines of one action read as one toast. At most two toasts stand on
 * the screen; a third waits its turn. A line that waits is never dropped: a
 * toast is often the only word for what a press did (a refusal says when a log
 * fits, a pickup what came into the bag), so the player must get to read it.
 * A bad line (a bite, a refusal, a miss) is a call to act or the answer to a
 * press: it goes ahead of the calm ones, and the oldest calm toast on screen
 * makes way for it at once. While a calm line waits, the oldest toast on screen
 * leaves early, once it has stood long enough to be read for its length.
 * A dialogue box that covers the toasts (on a phone, where they sit low) holds
 * them: while it is open nothing new goes up and the ones up stand still.
 */
import type { Bundle, GameEvent, PublicState } from '@game/kernel';
import { describe } from './text';

export type Tone = 'good' | 'bad' | 'info';

/** One toast as the player reads it: one line, or the task lines of one action. */
export interface Toast {
  lines: string[];
  tone: Tone;
  icon?: string;
}

/** A described event; `task` marks a task line: a task done, or a new one. */
export interface Line {
  text: string;
  tone?: Tone;
  icon?: string;
  task?: 'done' | 'active';
}

/**
 * How the toasts keep time, in ms: at most `max` stand at once, a fading one
 * too; each stands for `life` and takes `fade` to go. One that another waits
 * for leaves once it has been read: `perChar` for each letter, `least` at the least.
 */
export const TOASTS = { max: 2, life: 2800, fade: 500, least: 1200, perChar: 40 } as const;

/** How long a toast stands before a waiting one may take its place: long enough to read it, never longer than its life. */
export function readTime(t: Toast): number {
  const letters = t.lines.reduce((n, line) => n + line.length, 0);
  return Math.min(TOASTS.life, Math.max(TOASTS.least, letters * TOASTS.perChar));
}

/** A bad line goes ahead of the calm ones: a call to run, a refusal, a miss. */
export function urgent(t: Toast): boolean {
  return t.tone === 'bad';
}

/**
 * The toasts of one batch of events. A fall says it all in its one box: the calls to run from
 * the hunt that ended stay down. A task that opens and closes in the same step is told once, as done.
 */
export function eventToasts(b: Bundle, s: PublicState, events: readonly GameEvent[]): Toast[] {
  const fell = events.some((e) => e.e === 'fall');
  const lines: Line[] = [];
  events.forEach((e, i) => {
    if (fell && e.e === 'hurt') return;
    if (e.e === 'quest' && e.state === 'active' && events.slice(i + 1).some((x) => x.e === 'quest' && x.quest === e.quest && x.state === 'done')) return;
    const d = describe(b, s, e);
    if (d) lines.push(e.e === 'quest' ? { ...d, task: e.state } : d);
  });
  return mergeTasks(lines);
}

/**
 * Two task lines or more from one action ("Task done" and "New task" from one
 * build or hand-in) become one toast where the first of them stood: the done
 * lines first, then the new ones, green when a task was done.
 */
export function mergeTasks(lines: readonly Line[]): Toast[] {
  const one = (l: Line): Toast => ({ lines: [l.text], tone: l.tone ?? 'info', ...(l.icon ? { icon: l.icon } : {}) });
  const tasks = lines.filter((l) => l.task);
  if (tasks.length < 2) return lines.map(one);
  const merged: Toast = {
    lines: [...tasks.filter((l) => l.task === 'done'), ...tasks.filter((l) => l.task === 'active')].map((l) => l.text),
    tone: tasks.some((l) => l.task === 'done') ? 'good' : 'info',
  };
  return lines.flatMap((l) => (!l.task ? [one(l)] : l === tasks[0] ? [merged] : []));
}

/** What the page does at one moment: toasts to put up, to start fading and to take down, and when to look again. */
export interface BandStep<T> {
  show: T[];
  fade: T[];
  remove: T[];
  /** the time of the next change; none while nothing is up or the band is held */
  next?: number;
}

/** A toast in line, with what the band needs to know of it. */
interface Waiting<T> {
  item: T;
  /** a bad line: it goes ahead of the calm ones */
  urgent: boolean;
  /** how long it stands before a waiting one may take its place (readTime) */
  read: number;
}

interface Up<T> extends Waiting<T> {
  /** when it went up */
  at: number;
  /** when it began to fade */
  out?: number;
}

/** The toasts on screen and in line, by a clock the page passes in. */
export class ToastBand<T> {
  private line: Waiting<T>[] = [];
  private up: Up<T>[] = [];
  /** when a box began to hold the band */
  private heldAt: number | undefined;

  /** A toast joins the line, an urgent one ahead of every calm one; run() puts it up once a place is free. */
  add(item: T, how: { urgent?: boolean; read?: number } = {}): void {
    const waiting: Waiting<T> = { item, urgent: how.urgent ?? false, read: how.read ?? TOASTS.least };
    const calm = waiting.urgent ? this.line.findIndex((w) => !w.urgent) : -1;
    if (calm < 0) this.line.push(waiting);
    else this.line.splice(calm, 0, waiting);
  }

  /** Takes everything down at once, the line too; returns what was on screen. */
  clear(): T[] {
    const items = this.up.map((u) => u.item);
    this.up = [];
    this.line = [];
    this.heldAt = undefined;
    return items;
  }

  /** Brings the band to `now`. While `held`, nothing changes and the clocks of the toasts up stand still from the first held run. */
  run(now: number, held: boolean): BandStep<T> {
    const step: BandStep<T> = { show: [], fade: [], remove: [] };
    if (held) {
      this.heldAt ??= now;
      return step;
    }
    if (this.heldAt !== undefined) {
      const stood = now - this.heldAt;
      for (const u of this.up) {
        u.at += stood;
        if (u.out !== undefined) u.out += stood;
      }
      this.heldAt = undefined;
    }
    this.up = this.up.filter((u) => {
      const gone = u.out !== undefined && now >= u.out + TOASTS.fade;
      if (gone) step.remove.push(u.item);
      return !gone;
    });
    while (this.line.length > 0 && this.up.length < TOASTS.max) {
      const waiting = this.line.shift()!;
      this.up.push({ ...waiting, at: now });
      step.show.push(waiting.item);
    }
    const hurried = this.hurried();
    for (const u of this.up) {
      if (u.out === undefined && now >= this.due(u, hurried)) {
        u.out = now;
        step.fade.push(u.item);
      }
    }
    const after = this.hurried();
    const times = this.up.map((u) => (u.out !== undefined ? u.out + TOASTS.fade : this.due(u, after)));
    if (times.length > 0) step.next = Math.max(now, Math.min(...times));
    return step;
  }

  /**
   * The one that leaves early while another waits, one fade at a time: for an urgent line
   * the oldest calm toast up, at once; for a calm one the oldest up, once it has been read.
   */
  private hurried(): { up: Up<T>; at: number } | undefined {
    const next = this.line[0];
    if (next === undefined || this.up.some((u) => u.out !== undefined)) return undefined;
    const calm = next.urgent ? this.up.find((u) => !u.urgent) : undefined;
    if (calm) return { up: calm, at: calm.at };
    const oldest = this.up[0];
    return oldest && { up: oldest, at: oldest.at + oldest.read };
  }

  private due(u: Up<T>, hurried: { up: Up<T>; at: number } | undefined): number {
    const life = u.at + TOASTS.life;
    return hurried?.up === u ? Math.min(hurried.at, life) : life;
  }
}
