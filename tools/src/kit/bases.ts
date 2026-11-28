/**
 * One base body for each race (DECISIONS.md, 2026-11-28): B, the newer figure the clothes go on, is the picture every
 * clip, key and reference of a race is drawn from. The 30.10 walk sheets (`chars/<race>_{down,left,up}`) are retired as
 * a base. The data is `tools/kit-gen/bases.json`; this file reads it and holds the three guards:
 *
 *  - `kit:gen` refuses a reference taken from a retired sheet or from a clip drawn from one (`refProblem`);
 *  - `tools/anim/prod/packmoves.py` refuses a manifest line with no base or a retired one, and records the base
 *    of each clip it writes under `clips` (the same rules, in Python);
 *  - `pnpm check` refuses a clip whose recorded base is a retired sheet, and a clip of a new verb with no record
 *    (`clipBaseProblems`). The clips already drawn from a retired sheet are listed by name under `waiting`, the way
 *    `rich.ts` lists the 16 px names: a redraw that lands takes its names off, and nothing is added.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export interface BasesData {
  format: 1;
  decision: string;
  /** Race → view → the kit sprite whose frame 0 is the race's base body at that view. */
  bases: Record<string, Record<string, string>>;
  base_frame: number;
  /** Sheets that may no longer be a base, a key or a reference (the old walk sheets). */
  retired: string[];
  /** Verbs whose clips were drawn before bases were recorded: they need no record. Every other verb does. */
  legacy_verbs: string[];
  /** Clips drawn from a retired sheet, waiting for their redraw from B. */
  waiting: string[];
  /** Clip sheet → the base picture (a kit sprite) it was drawn from, written by packmoves.py. */
  clips: Record<string, string>;
}

export function loadBases(root = ROOT): BasesData {
  return JSON.parse(readFileSync(resolve(root, 'tools/kit-gen/bases.json'), 'utf8')) as BasesData;
}

/** The race a character sheet belongs to (`chars/elf_hit_left` is "elf"), or undefined for anything else. */
export function raceOfSheet(name: string): string | undefined {
  return /^chars\/(human|elf|skeleton)_/.exec(name)?.[1];
}

/** A `.png` path read as the kit sprite its file name stands for (`chars/<file stem>`). */
function stem(ref: string): string {
  const file = ref.split('/').pop() ?? ref;
  return `chars/${file.replace(/\.png$/, '')}`;
}

/** Why a sprite may not be the source of a drawing, or undefined. */
export function sourceProblem(sheet: string, data: BasesData): string | undefined {
  const race = raceOfSheet(sheet);
  if (race === undefined) return undefined;
  if (data.retired.includes(sheet)) {
    return `is a retired walk sheet (${sheet}): draw from the base of the ${race}, ${Object.values(data.bases[race] ?? {}).join(', ')} (DECISIONS 2026-11-28)`;
  }
  if (data.waiting.includes(sheet)) return `was drawn from a retired walk sheet and waits for its redraw (${sheet}): draw from the base of the ${race}`;
  const via = data.clips[sheet];
  if (via !== undefined && via !== sheet) {
    const inner = sourceProblem(via, data);
    if (inner !== undefined) return `was drawn from ${via}, which ${inner}`;
  }
  return undefined;
}

/** What is wrong with a kit:gen reference, or undefined: a kit sprite id, or a PNG path read by its file name. */
export function refProblem(ref: string, data: BasesData = loadBases()): string | undefined {
  const sheet = ref.endsWith('.png') ? stem(ref) : ref;
  const why = sourceProblem(sheet, data);
  return why === undefined ? undefined : `ref "${ref}" ${why}`;
}

export interface BaseIssue {
  /** The sprite the problem is about (or the list entry). */
  name: string;
  where: 'sprite' | 'list';
  message: string;
}

/** The clip rows of a kit read against the bases: only the core kit's character clips. */
export function clipBaseProblems(sprites: Readonly<Record<string, { clip?: { race: string; verb: string } }>>, data: BasesData = loadBases()): BaseIssue[] {
  const out: BaseIssue[] = [];
  for (const [name, s] of Object.entries(sprites)) {
    if (!s.clip) continue;
    const race = s.clip.race.replace(/^core\//, '');
    if (raceOfSheet(name) !== race) continue;
    const base = data.clips[name];
    if (base === undefined) {
      if (data.waiting.includes(name) || data.legacy_verbs.includes(s.clip.verb)) continue;
      out.push({ name, where: 'sprite', message: `plays the new verb "${s.clip.verb}" and has no recorded base: packmoves.py writes it under "clips" in tools/kit-gen/bases.json` });
      continue;
    }
    if (data.waiting.includes(name)) out.push({ name, where: 'list', message: `is on the waiting list and also has a recorded base (${base}): take it off "waiting"` });
    if (!(base in sprites)) out.push({ name, where: 'sprite', message: `is recorded as drawn from ${base}, which the kit does not hold` });
    else if (raceOfSheet(base) !== race) out.push({ name, where: 'sprite', message: `is recorded as drawn from ${base}, a picture of another race` });
    const why = sourceProblem(base, data);
    if (why !== undefined) out.push({ name, where: 'sprite', message: `is drawn from ${base}, which ${why}` });
  }
  for (const name of data.waiting) {
    if (!(name in sprites)) out.push({ name, where: 'list', message: `is on the waiting list but the kit does not hold it: take it off "waiting"` });
  }
  for (const name of Object.keys(data.clips)) {
    if (!(name in sprites)) out.push({ name, where: 'list', message: `has a recorded base but the kit does not hold it: take it off "clips"` });
  }
  return out;
}
