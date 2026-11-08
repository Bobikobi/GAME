/**
 * The atmosphere card of a land (the owner, 8.11): mist only in the valley; everywhere else each world carries
 * its own air: the sun's tint by day and at dusk, how deep the night goes, what floats in the air, whether the
 * sun comes down in shafts between the trees, and what is heard. The cards live in tools/gen/atmosphere.json
 * until the schema pull request puts the fields on the region card; the lighting session draws them.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../load';
import type { StoryDef, World } from './story';

export const PARTICLES = ['fireflies', 'pollen', 'ash', 'embers', 'leaves', 'birds', 'snow', 'rain'] as const;
export type Particle = (typeof PARTICLES)[number];

export interface Atmosphere {
  sun: { day: [number, number, number]; dusk: [number, number, number] };
  /** How dark the night goes, 0 (as day) to 100 (black). */
  night_depth: number;
  /** Mist, in permille; 0 everywhere but the valley. */
  fog_permille: number;
  particles: { kind: Particle; density: number }[];
  /** Sun shafts between the trees. */
  shafts: boolean;
  ambience: { day: string; night: string };
  note?: string;
}

const RGB = (v: unknown) => Array.isArray(v) && v.length === 3 && v.every((c) => Number.isInteger(c) && c >= 0 && c <= 255);

/** Every fault of a card, as "field: what is wrong"; empty when it is sound. */
export function atmosphereProblems(a: unknown): string[] {
  if (typeof a !== 'object' || a === null) return ['the card must be one object'];
  const o = a as Record<string, unknown>;
  const out: string[] = [];
  const sun = o.sun as Record<string, unknown> | undefined;
  if (!sun || !RGB(sun.day) || !RGB(sun.dusk)) out.push('sun: needs day and dusk, each three values 0..255');
  if (!Number.isInteger(o.night_depth) || (o.night_depth as number) < 0 || (o.night_depth as number) > 100) out.push('night_depth: an integer 0..100');
  if (!Number.isInteger(o.fog_permille) || (o.fog_permille as number) < 0 || (o.fog_permille as number) > 1000) out.push('fog_permille: an integer 0..1000');
  if (!Array.isArray(o.particles)) out.push('particles: a list');
  else {
    for (const p of o.particles as Record<string, unknown>[]) {
      if (!PARTICLES.includes(p.kind as Particle)) out.push(`particles: unknown kind ${String(p.kind)}`);
      if (!Number.isInteger(p.density) || (p.density as number) < 1 || (p.density as number) > 10) out.push(`particles: ${String(p.kind)} density must be 1..10`);
    }
  }
  if (typeof o.shafts !== 'boolean') out.push('shafts: true or false');
  const amb = o.ambience as Record<string, unknown> | undefined;
  if (!amb || typeof amb.day !== 'string' || typeof amb.night !== 'string') out.push('ambience: day and night, each a name');
  return out;
}

let cards: Record<World, Atmosphere> | undefined;

export function atmosphereCards(): Record<World, Atmosphere> {
  if (!cards) {
    const data = JSON.parse(readFileSync(join(REPO_ROOT, 'tools', 'gen', 'atmosphere.json'), 'utf8')) as Record<World, Atmosphere>;
    for (const [world, card] of Object.entries(data)) {
      const problems = atmosphereProblems(card);
      if (problems.length > 0) throw new Error(`atmosphere.json ${world}: ${problems.join('; ')}`);
    }
    cards = data;
  }
  return cards;
}

/** The card a story's land carries: its world's, with the mist only where the story is the valley's. */
export function atmosphereOf(story: StoryDef): Atmosphere {
  const card = atmosphereCards()[story.world];
  return { ...card, fog_permille: story.id === 'core/valley' ? 400 : 0 };
}
