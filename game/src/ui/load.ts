/**
 * The load on screen (DECISIONS.md, 2026-10-23: races, weight and bags): places as a count and the
 * pace as one coloured word, "14 / 24 Light", on the bag button and at the head of the bag. The walk
 * itself slows; the weight is a number only on demand (a hover on a desktop), never a bar to
 * manage. Turning heavy says one line once. Both doors read this file.
 */
import { bagCapacity, bagUsed, loadBand, loadLimit, loadWeight, type Bundle, type LoadBand, type PublicState } from '@game/kernel';
import { h } from './dom';
import './load.css';

export const LOAD_WORD: Readonly<Record<LoadBand, string>> = { light: 'Light', steady: 'Steady', heavy: 'Heavy' };

/** What the pace means, for the title a hover shows. */
const LOAD_MEANS: Readonly<Record<LoadBand, string>> = {
  light: 'you walk quick',
  steady: 'you walk at an even pace',
  heavy: 'you walk slowly, and in a fight your breath comes back at half speed',
};

/** The line that says once that the load turned heavy. */
export const HEAVY_LINE = 'Heavy going.';

export interface LoadView {
  used: number;
  places: number;
  band: LoadBand;
  weight: number;
  limit: number;
}

export function loadView(b: Bundle, s: PublicState): LoadView {
  return { used: bagUsed(b, s), places: bagCapacity(b, s), band: loadBand(b, s), weight: loadWeight(b, s), limit: loadLimit(b, s) };
}

/** The number on demand: the weight against the limit, and what the pace means. */
export function loadTitle(v: LoadView): string {
  return `${v.used} of ${v.places} places. Load ${v.weight} of ${v.limit}: ${LOAD_WORD[v.band].toLowerCase()}, ${LOAD_MEANS[v.band]}.`;
}

/** The count and the word, built once; `paintLoad` patches them. `data-load` is the hook the e2e reads. */
export function loadChip(): HTMLElement {
  return h('span', { class: 'load-chip', 'data-load': '' }, h('span', { class: 'load-count' }), h('b', { class: 'load-word' }));
}

/** Writes a view into a chip from `loadChip`, touching the page only where something changed. */
export function paintLoad(chip: HTMLElement, v: LoadView): void {
  const count = chip.querySelector<HTMLElement>('.load-count');
  const word = chip.querySelector<HTMLElement>('.load-word');
  const text = `${v.used} / ${v.places}`;
  if (count && count.textContent !== text) count.textContent = text;
  if (word && word.textContent !== LOAD_WORD[v.band]) word.textContent = LOAD_WORD[v.band];
  if (chip.dataset.band !== v.band) chip.dataset.band = v.band;
  const title = loadTitle(v);
  if (chip.title !== title) chip.title = title;
}

/** A chip already painted, for a panel drawn whole each time. */
export function loadChipFor(b: Bundle, s: PublicState): HTMLElement {
  const chip = loadChip();
  paintLoad(chip, loadView(b, s));
  return chip;
}

/**
 * Whether the load has just turned heavy, for the one line that says so: true once per turn, at the first
 * look after it changed. The first look of a session only remembers, so a game loaded heavy says nothing.
 */
export function turnedHeavy(memory: { band?: LoadBand }, band: LoadBand): boolean {
  const was = memory.band;
  memory.band = band;
  return was !== undefined && was !== 'heavy' && band === 'heavy';
}
