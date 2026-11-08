/**
 * A story: what the owner tells the generator about a land, as data (the owner, 8.11: "I give it a story and it
 * makes a beautiful map"). It is the generator's input, kept beside the tool in tools/gen/stories until the
 * schema pull request makes it game content. Every number is an integer; the look words name sets the generator
 * knows, never a sprite. The check is written by hand here so the tools package needs no new dependency; the
 * schema pull request replaces it with the shared one.
 */
import { readFileSync } from 'node:fs';

/** The three worlds (DECISIONS 2026-10-22, decision 11): each has its own ground, trees and air. */
export const WORLDS = ['human', 'elf', 'undead'] as const;
export type World = (typeof WORLDS)[number];

export const SIDES = ['n', 'e', 's', 'w'] as const;
export type Side = (typeof SIDES)[number];

export interface StoryDef {
  /** creator/name, like every content id. */
  id: string;
  title: string;
  /** The seed word: the same word gives the same land, always. */
  seed: string;
  world: World;
  /** The top-left chunk of the land in the world grid (chunks of 64). */
  origin: { cx: number; cy: number };
  /** The land in chunks. */
  size: { w: number; h: number };
  /** How much of the land is wood: 0 open meadow, 100 a wall of trees with few glades. */
  forest: number;
  /** How much the ground rises: 0 flat, 100 terraces and crags everywhere. */
  relief: number;
  /** Lakes and streams: 0 none, 100 a wet land. */
  water: number;
  /** How many hidden cave mouths the deep wood holds. */
  caves: number;
  /** The sides a road comes in from. */
  entries: Side[];
  /** Small ruins off the roads. Left out: 1. */
  ruins?: number;
  /** How full of creatures the land is, as a share of the caps: 0 empty, 100 at the cap. Left out: 25. */
  life?: number;
  /** The top-left chunk of the land below: the caves the doors lead down to. Left out: no door is placed. */
  below?: { cx: number; cy: number };
}

const ID = /^[a-z0-9_-]+\/[a-z0-9_-]+$/;

type Check = (v: unknown) => string | undefined;
const int = (min: number, max: number): Check => (v) => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? undefined : `must be an integer ${min}..${max}`);
const str = (min: number, max: number, pattern?: RegExp): Check => (v) =>
  typeof v === 'string' && v.length >= min && v.length <= max && (!pattern || pattern.test(v)) ? undefined : `must be text of ${min}..${max} characters${pattern ? ' shaped creator/name' : ''}`;
const oneOf = (list: readonly string[]): Check => (v) => (typeof v === 'string' && list.includes(v) ? undefined : `must be one of ${list.join(', ')}`);
const pair = (a: string, b: string, min: number, max: number): Check => (v) => {
  if (typeof v !== 'object' || v === null) return `must hold ${a} and ${b}`;
  const o = v as Record<string, unknown>;
  for (const k of Object.keys(o)) if (k !== a && k !== b) return `has an unknown field ${k}`;
  return int(min, max)(o[a]) ? `${a} ${int(min, max)(o[a])}` : int(min, max)(o[b]) ? `${b} ${int(min, max)(o[b])}` : undefined;
};
const sides: Check = (v) => {
  if (!Array.isArray(v) || v.length < 1 || v.length > 4) return 'must list 1 to 4 sides';
  if (new Set(v).size !== v.length) return 'lists a side twice';
  for (const s of v) if (!SIDES.includes(s as Side)) return `has an unknown side ${String(s)}`;
  return undefined;
};

const FIELDS: Record<keyof StoryDef, { check: Check; optional?: true }> = {
  id: { check: str(3, 80, ID) },
  title: { check: str(1, 60) },
  seed: { check: str(1, 60) },
  world: { check: oneOf(WORLDS) },
  origin: { check: pair('cx', 'cy', 0, 15) },
  size: { check: pair('w', 'h', 1, 8) },
  forest: { check: int(0, 100) },
  relief: { check: int(0, 100) },
  water: { check: int(0, 100) },
  caves: { check: int(0, 8) },
  entries: { check: sides },
  ruins: { check: int(0, 6), optional: true },
  life: { check: int(0, 100), optional: true },
  below: { check: pair('cx', 'cy', 0, 15), optional: true },
};

/** Every fault in a story, as "field: what is wrong"; empty when the story is sound. */
export function storyProblems(data: unknown): string[] {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return ['the story must be one JSON object'];
  const o = data as Record<string, unknown>;
  const out: string[] = [];
  for (const k of Object.keys(o)) if (!(k in FIELDS)) out.push(`${k}: not a story field`);
  for (const [k, f] of Object.entries(FIELDS)) {
    if (!(k in o)) {
      if (!f.optional) out.push(`${k}: missing`);
      continue;
    }
    const why = f.check(o[k]);
    if (why) out.push(`${k}: ${why}`);
  }
  return out;
}

export function parseStory(text: string, where = 'story'): StoryDef {
  const data: unknown = JSON.parse(text);
  const problems = storyProblems(data);
  if (problems.length > 0) throw new Error(`${where}: not a story: ${problems.slice(0, 5).join('; ')}`);
  return data as StoryDef;
}

export function loadStory(path: string): StoryDef {
  return parseStory(readFileSync(path, 'utf8'), path);
}
