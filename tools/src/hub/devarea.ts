/**
 * The developers' home's own settings: .github/dev-area.json (the shared goal's meter and the accounts of the game's
 * own standing tracks). A file the maintainers keep; the build reads it and a page never types a number.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HubWorld } from '@game/schema/hub';

export interface DevArea {
  world: HubWorld | null;
  /** lowercase GitHub handles whose pull requests read "Development team" */
  team: ReadonlySet<string>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseDevArea(raw: unknown): DevArea {
  if (!isRecord(raw)) throw new Error('.github/dev-area.json: not an object');
  const w = raw['world'];
  let world: HubWorld | null = null;
  if (w !== undefined) {
    if (!isRecord(w) || !Number.isInteger(w['drawn']) || !Number.isInteger(w['whole']) || typeof w['as_of'] !== 'string' || typeof w['next'] !== 'string') {
      throw new Error('.github/dev-area.json: world needs integer drawn and whole, and text as_of and next');
    }
    world = { drawn: w['drawn'] as number, whole: w['whole'] as number, as_of: w['as_of'], next: w['next'] };
  }
  const handles = raw['team_handles'];
  if (!Array.isArray(handles) || !handles.every((h) => typeof h === 'string')) throw new Error('.github/dev-area.json: team_handles is a list of handles');
  return { world, team: new Set(handles.map((h) => (h as string).toLowerCase())) };
}

/** The file of a checkout; a checkout without it has no meter and no team accounts. */
export function readDevArea(root: string): DevArea {
  const path = join(root, '.github', 'dev-area.json');
  if (!existsSync(path)) return { world: null, team: new Set() };
  return parseDevArea(JSON.parse(readFileSync(path, 'utf8')));
}
