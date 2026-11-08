/**
 * The air of a land (the owner, 8.11): mist only in the valley; everywhere else each world carries its own: the
 * sun's tint by day and at dusk, how deep the night goes, what floats in the air, whether the sun comes down in
 * shafts between the trees. Since the schema of 8.11 (#683) the air is `RegionCard.atmosphere`, and a generated
 * land's card is a region card the owner's map would carry (map.json changes only on his word): the generator
 * writes it beside the chunks, and the light layer draws it (v14, the owner's list of 8.11: warmer light, leaves
 * in the air). The defaults per world live in tools/gen/atmosphere.json.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AMBIENCE_BEDS, type AmbienceBedName, type AtmosphereDef, CLIMATES, PARTICLE_KINDS, type ParticleKind, type RegionCardDef } from '@game/schema';
import { REPO_ROOT } from '../load';
import type { StoryDef, World } from './story';

export { PARTICLE_KINDS, AMBIENCE_BEDS };
export type { AtmosphereDef, ParticleKind };

/** A world's air, as tools/gen/atmosphere.json holds it: the card's fields without the mist, and the tool's own words. */
export interface WorldAir {
  climate: (typeof CLIMATES)[number];
  /** Days of rain, in basis points of the days (the mist is the valley's: `fog` is set by the story, never here). */
  rain: number;
  atmosphere: AtmosphereDef;
  /** The sound bed by day and by night: the beds the client has until the owner's sound pick (#464). */
  ambience: { day: AmbienceBedName; night: AmbienceBedName };
  /** The sounds the owner's pick should bring, in words: not read by the game. */
  sounds?: { day: string; night: string };
  note?: string;
}

/** The valley's mist, as its own card draws it (content/core/map.json, `valley-floor`): a generated valley keeps it. */
export const VALLEY_FOG = { days: 1000, look: 1000 } as const;

const RGB = (v: unknown) => Array.isArray(v) && v.length === 3 && v.every((c) => Number.isInteger(c) && c >= 0 && c <= 255);
const bp = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 5000;

/** Every fault of a world's air, as "field: what is wrong"; empty when it is sound. The schema's own check runs on the card (the test). */
export function atmosphereProblems(a: unknown): string[] {
  if (typeof a !== 'object' || a === null) return ['the air must be one object'];
  const o = a as Record<string, unknown>;
  const out: string[] = [];
  if (!CLIMATES.includes(o.climate as WorldAir['climate'])) out.push(`climate: one of ${CLIMATES.join(', ')}`);
  if (!bp(o.rain)) out.push('rain: days of rain in basis points, 0..5000');
  const at = o.atmosphere as Record<string, unknown> | undefined;
  if (!at || typeof at !== 'object') out.push('atmosphere: the card\'s air');
  else {
    const sun = at.sun as Record<string, unknown> | undefined;
    if (!sun || !RGB(sun.day) || !RGB(sun.dusk)) out.push('atmosphere.sun: needs day and dusk, each three values 0..255');
    if (!Number.isInteger(at.night_depth) || (at.night_depth as number) < 0 || (at.night_depth as number) > 100) out.push('atmosphere.night_depth: an integer 0..100');
    if (!Array.isArray(at.particles) || at.particles.length > 4) out.push('atmosphere.particles: a list of up to 4');
    else {
      const seen = new Set<string>();
      for (const p of at.particles as Record<string, unknown>[]) {
        if (!PARTICLE_KINDS.includes(p.kind as ParticleKind)) out.push(`atmosphere.particles: unknown kind ${String(p.kind)}`);
        if (seen.has(String(p.kind))) out.push(`atmosphere.particles: ${String(p.kind)} twice`);
        seen.add(String(p.kind));
        if (!Number.isInteger(p.density) || (p.density as number) < 1 || (p.density as number) > 10) out.push(`atmosphere.particles: ${String(p.kind)} density must be 1..10`);
      }
    }
    if (at.shafts !== undefined && typeof at.shafts !== 'boolean') out.push('atmosphere.shafts: true or false');
  }
  const amb = o.ambience as Record<string, unknown> | undefined;
  if (!amb || !AMBIENCE_BEDS.includes(amb.day as AmbienceBedName) || !AMBIENCE_BEDS.includes(amb.night as AmbienceBedName)) out.push(`ambience: day and night, each one of ${AMBIENCE_BEDS.join(', ')}`);
  return out;
}

let cards: Record<World, WorldAir> | undefined;

export function atmosphereCards(): Record<World, WorldAir> {
  if (!cards) {
    const data = JSON.parse(readFileSync(join(REPO_ROOT, 'tools', 'gen', 'atmosphere.json'), 'utf8')) as Record<World, WorldAir>;
    for (const [world, card] of Object.entries(data)) {
      const problems = atmosphereProblems(card);
      if (problems.length > 0) throw new Error(`atmosphere.json ${world}: ${problems.join('; ')}`);
    }
    cards = data;
  }
  return cards;
}

/** The world's air a story's land carries. */
export function atmosphereOf(story: StoryDef): AtmosphereDef {
  return atmosphereCards()[story.world].atmosphere;
}

/**
 * The region card a generated land would carry on the owner's map: its world's air and rain, the mist only where
 * the story is the valley's, the beds the client has. The card is named after the story, as its air (`elf-wood-air`),
 * so it never takes the name of a card the owner's map already has (the hand map's `elf-wood`).
 */
export function cardOf(story: StoryDef): RegionCardDef {
  const air = atmosphereCards()[story.world];
  const valley = story.id === 'core/valley';
  return {
    id: `${story.id.split('/')[1]!}-air`,
    title: story.title,
    climate: air.climate,
    weather: { rain: air.rain, fog: valley ? VALLEY_FOG.days : 0 },
    look: { rain: 1000, fog: valley ? VALLEY_FOG.look : 0 },
    ambience: { ...air.ambience },
    atmosphere: structuredClone(air.atmosphere),
  };
}
