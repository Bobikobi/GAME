import type { GameEvent } from '@game/kernel';
import { foeBarAlpha, foeBarAnchorY, foeBarFill, foeBarNumber, foeBarPlay, foeBarRefresh, type FoeBar } from './foe-bar';

export interface FoeBarPoint { x: number; y: number }
type ProjectFeet = (id: string, point: FoeBarPoint) => boolean;

interface El {
  root: HTMLElement;
  fill: HTMLElement;
  number: HTMLElement;
  x: number;
  y: number;
  pct: number;
  num: string;
}

/**
 * The health bars over the world labels: one small bar per fighting creature, drawn under its feet and
 * following it. The two doors share the bars and their numbers; the classic door projects each creature's
 * feet into the world labels. The records live in pure `foeBarPlay`/`foeBarRefresh`; this layer is the DOM.
 */
export class FoeBarLayer {
  private readonly bars = new Map<string, FoeBar>();
  private readonly els = new Map<string, El>();
  private readonly free: El[] = [];
  private readonly point: FoeBarPoint = { x: 0, y: 0 };

  constructor(private readonly labels: HTMLElement, private readonly projectFeet: ProjectFeet) {}

  get active(): boolean {
    return this.bars.size !== 0;
  }

  play(events: readonly GameEvent[], now: number): void {
    foeBarPlay(this.bars, events, now);
  }

  update(now: number, currentFoe: string | undefined, reducedMotion: boolean): void {
    foeBarRefresh(this.bars, now, currentFoe);
    for (const [id, bar] of this.bars) {
      const alpha = foeBarAlpha(bar, now, reducedMotion);
      if (alpha <= 0) {
        this.recycle(id);
        continue;
      }
      const el = this.els.get(id) ?? this.make(id);
      const visible = this.projectFeet(id, this.point);
      if (el.root.hidden === visible) el.root.hidden = !visible;
      if (!visible) continue;
      const x = Math.round(this.point.x);
      const y = Math.round(foeBarAnchorY(this.point.y));
      if (el.x !== x || el.y !== y) {
        el.x = x;
        el.y = y;
        el.root.style.transform = `translate(${x}px, ${y}px)`;
      }
      const pct = Math.round(foeBarFill(bar) * 100);
      if (el.pct !== pct) {
        el.pct = pct;
        el.fill.style.width = `${pct}%`;
      }
      const num = foeBarNumber(bar);
      if (el.num !== num) {
        el.num = num;
        el.number.textContent = num;
      }
      el.root.style.opacity = String(alpha);
    }
  }

  clear(): void {
    for (const id of this.bars.keys()) this.recycle(id);
  }

  private make(id: string): El {
    const el = this.free.pop() ?? this.build();
    this.els.set(id, el);
    el.root.hidden = false;
    return el;
  }

  private build(): El {
    const doc = this.labels.ownerDocument;
    const root = doc.createElement('span');
    root.className = 'foe-bar';
    const fill = doc.createElement('span');
    fill.className = 'foe-bar-fill';
    const number = doc.createElement('span');
    number.className = 'foe-bar-num';
    root.append(fill, number);
    this.labels.append(root);
    return { root, fill, number, x: NaN, y: NaN, pct: -1, num: '' };
  }

  private recycle(id: string): void {
    const el = this.els.get(id);
    if (el) {
      el.root.hidden = true;
      el.root.style.opacity = '0';
      this.els.delete(id);
      this.free.push(el);
    }
    this.bars.delete(id);
  }
}
