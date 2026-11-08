/**
 * A story: what the owner tells the generator about a land, as data (the owner, 8.11: "I give it a story and it
 * makes a beautiful map"). Since the schema of 8.11 (#683) a story is a content file of type `story` under
 * content/core/stories/, checked by the shared schema like every other file and left out of the bundle (the chunks
 * it writes are the content). The generator works with the envelope's id and title beside the body's numbers, as
 * one flat StoryDef. Every number is an integer; the words name sets the generator knows, never a sprite.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SIDES, STORY_WORLDS, type StoryFile, validateFile } from '@game/schema';
import { CONTENT_DIR, pointerToPath } from '../load';

/** The three worlds (DECISIONS 2026-10-22, decision 11): each has its own ground, trees and air. */
export const WORLDS = STORY_WORLDS;
export type World = (typeof STORY_WORLDS)[number];
export { SIDES };
export type Side = (typeof SIDES)[number];

/** The story as the generator reads it: the file's id, title and description beside the body's own fields. */
export type StoryDef = StoryFile['story'] & { id: string; title: string; description?: string };

/** Where the core's stories live; `pnpm gen <name>` finds a story here by its file name. */
export const STORIES_DIR = join(CONTENT_DIR, 'core', 'stories');

/** Every fault of a story file, as "field: what is wrong"; empty when it is sound. The shared schema decides. */
export function storyProblems(data: unknown): string[] {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return ['the story must be one JSON object'];
  const type = (data as { type?: unknown }).type;
  if (type !== 'story') return [`type: must be "story", got ${JSON.stringify(type) ?? 'nothing'}`];
  return validateFile(data).map((i) => `${pointerToPath(i.path) || 'file'}: ${i.message}`);
}

/** The flat story the generator works with. */
export function storyOf(file: StoryFile): StoryDef {
  return { id: file.id, title: file.title, ...(file.description ? { description: file.description } : {}), ...file.story };
}

export function parseStory(text: string, where = 'story'): StoryDef {
  const data: unknown = JSON.parse(text);
  const problems = storyProblems(data);
  if (problems.length > 0) throw new Error(`${where}: not a story: ${problems.slice(0, 5).join('; ')}`);
  return storyOf(data as StoryFile);
}

/** A story by its path, or by its name under content/core/stories/ (`elf-wood`). */
export function loadStory(pathOrName: string): StoryDef {
  const path = /[/\\]|\.json$/.test(pathOrName) ? pathOrName : join(STORIES_DIR, `${pathOrName}.json`);
  return parseStory(readFileSync(path, 'utf8'), path);
}

/** The names of the core's stories, in file order. */
export function listStories(dir = STORIES_DIR): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .sort();
}
