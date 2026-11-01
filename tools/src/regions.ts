/**
 * The region cards (issue 581, EXPERIENCE_AUDIT gap M7): each region of the first map weathers and sounds
 * like itself. docs/design/FIRST_MAP.md holds the regions in one table; every row has a card on the map
 * (`map.cards`, its `title` the row's name word for word), every card a region or the map names exists, and
 * a card's days of rain and fog leave room for clear ones.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Bundle } from '@game/kernel';
import { REPO_ROOT, type Issue } from './load';

export const FIRST_MAP_FILE = 'docs/design/FIRST_MAP.md';

/** The region names of FIRST_MAP's table, the first cell of each row under the "| Region |" header. */
export function firstMapRegions(text: string): string[] {
  const lines = text.split('\n');
  const head = lines.findIndex((l) => /^\|\s*Region\s*\|/.test(l));
  if (head < 0) return [];
  const names: string[] = [];
  for (const line of lines.slice(head + 2)) {
    if (!line.startsWith('|')) break;
    const name = line.split('|')[1]?.trim();
    if (name) names.push(name);
  }
  return names;
}

export function checkRegions(b: Bundle, origin: Record<string, string>, regions: readonly string[] = firstMapRegions(readFileSync(join(REPO_ROOT, FIRST_MAP_FILE), 'utf8'))): Issue[] {
  const issues: Issue[] = [];
  const file = origin[b.map.id] ?? 'content';
  const err = (where: string, message: string) => issues.push({ file, where, message, level: 'error' });
  const cards = b.map.cards ?? [];
  const ids = new Set<string>();
  const titles = new Set<string>();
  cards.forEach((c, i) => {
    const where = `map.cards.${i}`;
    if (ids.has(c.id)) err(`${where}.id`, `the card "${c.id}" is declared twice`);
    if (titles.has(c.title)) err(`${where}.title`, `two cards are titled "${c.title}"`);
    ids.add(c.id);
    titles.add(c.title);
    if (c.weather.rain + c.weather.fog > 10_000) err(`${where}.weather`, `rain ${c.weather.rain} and fog ${c.weather.fog} pass the 10000 basis points of the days`);
  });
  for (const name of regions) {
    if (!titles.has(name)) err('map.cards', `the region "${name}" of ${FIRST_MAP_FILE} has no card: give it one weather look and one sound bed (issue 581)`);
  }
  for (const c of cards) {
    if (!regions.includes(c.title)) err('map.cards', `the card "${c.id}" is titled "${c.title}", which names no region of ${FIRST_MAP_FILE}`);
  }
  if (b.map.card !== undefined && !ids.has(b.map.card)) err('map.card', `names the card "${b.map.card}", which the map does not declare`);
  b.map.regions?.forEach((r, i) => {
    if (r.card !== undefined && !ids.has(r.card)) err(`map.regions.${i}.card`, `the region "${r.id}" names the card "${r.card}", which the map does not declare`);
  });
  return issues;
}
