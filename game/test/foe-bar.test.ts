import { describe, expect, it } from 'vitest';
import type { GameEvent } from '@game/kernel';
import {
  FOE_BAR_FADE_MS,
  FOE_BAR_GAP,
  FOE_BAR_HEIGHT,
  foeBarAlpha,
  foeBarAnchorY,
  foeBarFill,
  foeBarNumber,
  foeBarPlay,
  foeBarRefresh,
  type FoeBar,
} from '../src/foe-bar';
import { fightWordOffset } from '../src/fightwords';

const NOW = 1000;
const bar = (health: number, whole: number): FoeBar => ({ health, whole, last: NOW, dead: false });

const hit = (id: string, left: number, whole: number): GameEvent => ({
  e: 'hit',
  player: 'p',
  by: 'player',
  harm: whole - left,
  kind: 'attack',
  number: whole - left,
  at: [4, 5],
  move: 'attack',
  striker: { side: 'player', id: 'p' },
  struck: { side: 'foe', id },
  foe: { left, whole },
});

const engage = (id: string): GameEvent => ({ e: 'engage', player: 'p', foe: id });
const fall = (id: string): GameEvent => ({ e: 'foe_fall', foe: id, at: [4, 5], drops: [] });

describe('foe bar', () => {
  it('fills by the share of the kind\'s hp, for full, half and one health', () => {
    expect(foeBarFill(bar(20, 20))).toBe(1);
    expect(foeBarFill(bar(10, 20))).toBe(0.5);
    expect(foeBarFill(bar(1, 20))).toBe(0.05);
    expect(foeBarFill(bar(0, 20))).toBe(0);
    expect(foeBarNumber(bar(20, 20))).toBe('20');
    expect(foeBarNumber(bar(1, 20))).toBe('1');
  });

  it('appears whole when a creature starts a fight, before the first hit', () => {
    const bars = new Map<string, FoeBar>();
    foeBarPlay(bars, [engage('wolf')], NOW);
    const wolf = bars.get('wolf')!;
    expect(wolf.dead).toBe(false);
    expect(foeBarFill(wolf)).toBe(1);
    expect(foeBarNumber(wolf)).toBe('');
    expect(foeBarAlpha(wolf, NOW)).toBe(1);
  });

  it('shows on a hit, keeps two creatures two bars, and leaves an untouched one hidden', () => {
    const bars = new Map<string, FoeBar>();
    foeBarPlay(bars, [hit('wolf', 6, 10), hit('stag', 3, 4)], NOW);
    expect(bars.size).toBe(2);
    expect(bars.get('wolf')).toMatchObject({ health: 6, whole: 10, dead: false });
    expect(bars.get('stag')).toMatchObject({ health: 3, whole: 4, dead: false });
    expect(foeBarAlpha(bars.get('wolf')!, NOW)).toBe(1);
    expect(bars.has('untouched')).toBe(false);
  });

  it('is gone at once when the creature dies', () => {
    const bars = new Map<string, FoeBar>();
    foeBarPlay(bars, [hit('wolf', 1, 10)], NOW);
    foeBarPlay(bars, [fall('wolf')], NOW + 100);
    expect(foeBarAlpha(bars.get('wolf')!, NOW + 100)).toBe(0);

    const killed = new Map<string, FoeBar>();
    foeBarPlay(killed, [hit('wolf', 0, 10)], NOW);
    expect(killed.get('wolf')!.dead).toBe(true);
    expect(foeBarAlpha(killed.get('wolf')!, NOW)).toBe(0);
  });

  it('stays while it fights and fades a couple of seconds after the fight ends', () => {
    const bars = new Map<string, FoeBar>();
    foeBarPlay(bars, [hit('wolf', 6, 10)], NOW);
    // Still the current foe far later: the fight keeps the bar whole.
    foeBarRefresh(bars, NOW + 10_000, 'wolf');
    expect(foeBarAlpha(bars.get('wolf')!, NOW + 10_000)).toBe(1);
    // The fight ended: the bar fades over FOE_BAR_FADE_MS.
    expect(foeBarAlpha(bars.get('wolf')!, NOW + 10_000)).toBe(1);
    expect(foeBarAlpha(bars.get('wolf')!, NOW + 10_000 + FOE_BAR_FADE_MS / 2)).toBeCloseTo(0.5);
    expect(foeBarAlpha(bars.get('wolf')!, NOW + 10_000 + FOE_BAR_FADE_MS)).toBe(0);
  });

  it('holds its fade under reduced motion until it is gone', () => {
    const b = bar(6, 10);
    expect(foeBarAlpha(b, NOW + FOE_BAR_FADE_MS - 1, true)).toBe(1);
    expect(foeBarAlpha(b, NOW + FOE_BAR_FADE_MS, true)).toBe(0);
  });

  it('sits under the feet and clear of the fight words', () => {
    const feetY = 100;
    const headY = 40; // the figure's head, above its feet
    const barTop = foeBarAnchorY(feetY) - FOE_BAR_HEIGHT;
    expect(barTop).toBe(feetY + FOE_BAR_GAP); // the bar's top is under the feet line
    expect(barTop).toBeGreaterThan(feetY);
    // the lowest word rises from the head; the bar stays well below it
    const wordBottom = headY - fightWordOffset(0, 0);
    expect(barTop).toBeGreaterThan(wordBottom);
  });
});
