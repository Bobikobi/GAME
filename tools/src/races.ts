/**
 * The races (DECISIONS.md, 2026-10-22): a race is a fixed profile, chosen at
 * the title, never a gate. Each race keeps two distinct home attributes at 1
 * or more, grades only worlds the game knows with home strong and the valley
 * neutral, and wears an outfit of up to three tier-1 pieces in distinct
 * places, none a weapon and none a tool a wake pocket lays on its ground. No
 * quest step, requirement, dig spot, restore, shop, recipe, node, camp part or
 * expedition names a race: a race appears only inside a `when`, on a line.
 * (The attribute total, 7, is held by assemble with the other record rules.)
 */
import type { Bundle } from '@game/kernel';
import type { Issue } from './load';

/** The worlds the core names (DECISIONS 2026-10-22, decisions 11, 17 and 24): the valley in the centre, the elf forest north, the undead south, the human city across the bay. */
export const CORE_WORLDS: readonly string[] = ['valley', 'north', 'south', 'city'];
/** The world every race stands in as it is. */
export const NEUTRAL_WORLD = 'valley';
/** An outfit holds at most this many pieces (decision 42: three slot items over the bare body; the skeleton's bones are the third). */
export const OUTFIT_MAX = 3;

export function checkRaces(b: Bundle, origin: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const at = (id: string) => origin[id] ?? 'content';
  const err = (file: string, where: string, message: string) => issues.push({ file, where, message, level: 'error' });

  const mapWorlds = [b.map.world ?? NEUTRAL_WORLD, ...(b.map.regions ?? []).flatMap((r) => (r.world ? [r.world] : []))];
  const known = new Set([...CORE_WORLDS, ...mapWorlds]);
  const graded = new Set(Object.values(b.races).flatMap((r) => Object.keys(r.grades ?? {})));
  const groundKinds = new Set(Object.values(b.pockets).flatMap((p) => p.ground.flatMap((g) => (b.items[g.item]?.tool ? [b.items[g.item]!.tool!.kind] : []))));

  const pairs = new Map<string, string>();
  for (const r of Object.values(b.races)) {
    const file = at(r.id);
    // two home attributes, each at 1 or more, and no two core races share a pair
    r.home.forEach((a, i) => {
      if (r.attributes[a] < 1) err(file, `race.home.${i}`, `the home attribute ${a} is 0: a home attribute starts at 1 or more, or the home world lifts nothing`);
    });
    const pair = [...r.home].sort().join('+');
    const twin = pairs.get(pair);
    if (twin && r.creator === 'core' && b.races[twin]?.creator === 'core') err(file, 'race.home', `"${twin}" has the same home pair (${pair}): every core race is at home in its own two attributes`);
    pairs.set(pair, r.id);

    // the grade: worlds the game knows, home strong, the valley neutral
    const grades = Object.entries(r.grades ?? {});
    for (const [world, grade] of grades) {
      if (!known.has(world)) err(file, `race.grades.${world}`, `no world "${world}": the core names ${CORE_WORLDS.join(', ')}, and a map or a region names its own`);
      if (world === NEUTRAL_WORLD && grade !== 'normal') err(file, `race.grades.${world}`, `the ${NEUTRAL_WORLD} is neutral to every race: leave it out, or "normal"`);
    }
    if (!grades.some(([, g]) => g === 'strong')) err(file, 'race.grades', 'a race is strong at home: name its home world as "strong"');

    // the outfit: up to three tier-1 pieces, one per place, never a weapon, never a pocket's tool
    const outfit = r.outfit ?? [];
    if (outfit.length > OUTFIT_MAX) err(file, 'race.outfit', `${outfit.length} pieces: an outfit holds at most ${OUTFIT_MAX}`);
    const places = new Map<string, number>();
    outfit.forEach((o, i) => {
      const where = `race.outfit.${i}`;
      const it = b.items[o.item];
      if (!it) return; // assemble reports the missing item
      if (o.qty !== 1) err(file, `${where}.qty`, 'an outfit piece is one piece: qty 1');
      if (!it.wear) {
        err(file, `${where}.item`, `${o.item} is not worn: an outfit piece has a "wear" place`);
        return;
      }
      if ((it.tier ?? 1) > 1) err(file, `${where}.item`, `${o.item} is above tier 1: a start gives tier-1 things only (G41)`);
      const slot = it.wear.slot;
      places.set(slot, (places.get(slot) ?? 0) + 1);
      // no weapon kind exists until the combat wave; the hand holds a tool, and never one a wake pocket lays on its ground
      if (it.tool && groundKinds.has(it.tool.kind)) err(file, `${where}.item`, `${o.item} is a ${it.tool.kind}, a tool a wake pocket lays on its ground: the pocket's tool is found, never worn from the start`);
    });
    for (const [slot, n] of places) if (n > 1) err(file, 'race.outfit', `${n} pieces for the ${slot}: one piece per place`);
    if (places.has('outfit') && (places.has('top') || places.has('legs'))) err(file, 'race.outfit', 'an outfit piece takes the top and the legs: no top or legs beside it');
  }

  // every world a map or a region names is one the core names or a race grades
  for (const w of mapWorlds) {
    if (!CORE_WORLDS.includes(w) && !graded.has(w)) err(at(b.map.id), 'map.world', `no race grades the world "${w}" and the core does not name it`);
  }

  // RC-6: no quest step, requirement, spot, restore, shop, recipe, node, camp part or expedition names a race
  const gated: [string, Record<string, unknown>][] = [
    ['quest', b.quests],
    ['treasure', b.treasures],
    ['restore', b.restores],
    ['shop', b.shops],
    ['recipe', b.recipes],
    ['resource', b.resources],
    ['camp', b.camps],
    ['expedition', b.expeditions],
    ['passage', b.passages],
  ];
  for (const [kind, records] of gated) {
    for (const [id, rec] of Object.entries(records)) {
      for (const path of raceKeys(rec, '')) {
        // the one place a quest may name a race: a line of its talk, the steps and the reward unchanged
        if (kind === 'quest' && /^talk\.variants\.\d+\.when\.race$/.test(path)) continue;
        err(at(id), path, `a ${kind} never names a race: no quest is gated by race (decision 10). A line may differ by race with "when.race" on a remark, a topic or a quest's talk.variants`);
      }
    }
  }
  return issues;
}

/** Every dotted path to a key named `race` or `races` inside a record. */
function raceKeys(v: unknown, path: string): string[] {
  if (Array.isArray(v)) return v.flatMap((x, i) => raceKeys(x, path ? `${path}.${i}` : `${i}`));
  if (v === null || typeof v !== 'object') return [];
  return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => {
    const p = path ? `${path}.${k}` : k;
    return [...(k === 'race' || k === 'races' ? [p] : []), ...raceKeys(x, p)];
  });
}
