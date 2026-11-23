import type { FightOutcome, GameEvent } from '@game/kernel';
import { FIGHT_WORD_MS, fightWordAt, fightWordOffset } from './fightwords';

export interface FightWordPoint { x: number; y: number }
type ProjectHead = (outcome: FightOutcome, point: FightWordPoint) => boolean;

interface Word {
  el: HTMLElement;
  outcome: FightOutcome;
  start: number;
  scale: number;
  stack: number;
  x: number;
  y: number;
}

function sameRecipient(a: FightOutcome, b: FightOutcome): boolean {
  return a.struck.side === b.struck.side && a.struck.id === b.struck.id
    && (a.struck.id !== '' || (a.at[0] === b.at[0] && a.at[1] === b.at[1]));
}

/** The two doors share words and motion. Each projects the recipient's head into its world labels. */
export class FightWordLayer {
  private readonly live: Word[] = [];
  private readonly free: HTMLElement[] = [];
  private readonly point: FightWordPoint = { x: 0, y: 0 };

  constructor(private readonly labels: HTMLElement, private readonly projectHead: ProjectHead) {}

  get active(): boolean {
    return this.live.length !== 0;
  }

  play(events: readonly GameEvent[], now: number): void {
    for (const event of events) {
      if (!('striker' in event)) continue;
      const look = fightWordAt(event, 0)!;
      const el = this.free.pop() ?? this.makeLabel();
      el.textContent = look.text;
      // Keep the newest word nearest the head. Older words never move back down when one expires.
      for (const word of this.live) {
        if (sameRecipient(word.outcome, event)) word.stack++;
      }
      this.live.push({ el, outcome: event, start: now, scale: look.scale, stack: 0, x: NaN, y: NaN });
    }
  }

  update(now: number, reducedMotion: boolean): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const word = this.live[i]!;
      const age = now - word.start;
      if (age >= FIGHT_WORD_MS) {
        this.recycle(word.el);
        this.live.splice(i, 1);
        continue;
      }
      const visible = this.projectHead(word.outcome, this.point);
      if (word.el.hidden === visible) word.el.hidden = !visible;
      if (!visible) continue;
      const progress = reducedMotion ? 0 : age / FIGHT_WORD_MS;
      const x = Math.round(this.point.x);
      const y = Math.round(this.point.y - fightWordOffset(progress, word.stack));
      if (word.x !== x || word.y !== y) {
        word.x = x;
        word.y = y;
        word.el.style.transform = `translate(${x}px, ${y}px) scale(${word.scale})`;
      }
      word.el.style.opacity = String(1 - progress);
    }
  }

  clear(): void {
    for (const word of this.live) this.recycle(word.el);
    this.live.length = 0;
  }

  private makeLabel(): HTMLElement {
    const el = this.labels.ownerDocument.createElement('span');
    el.className = 'fight-word';
    el.hidden = true;
    this.labels.append(el);
    return el;
  }

  private recycle(el: HTMLElement): void {
    el.hidden = true;
    this.free.push(el);
  }
}
