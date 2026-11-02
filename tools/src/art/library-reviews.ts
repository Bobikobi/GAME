/**
 * The owner's hand sort of the image library (issue #658).
 *
 * A choice made on the page is saved by `tools/art-library/serve.py` as one line of `reviews.jsonl` in the page's folder
 * (`{id, review, note, at}`, append-only, gitignored). This file is the pure reading of that store: the last line per id
 * wins, a torn or foreign line is skipped and counted, and a choice is laid over the index's row, where it beats any
 * agent's state, an amendment that came later included. `library-land.ts` carries the choices into the index.
 */
import { existsSync, readFileSync } from 'node:fs';

import { REVIEW_STATES, type ReviewState } from './drafts.js';
import type { Row } from './library.js';

export const REVIEWS_FILE = 'reviews.jsonl';
/** The ids the page holds, written by the build for the server to check a POST against. */
export const IDS_FILE = 'ids.json';
export const MAX_NOTE = 300;
/** `review_by` values that are the owner's own hand: his choices on the page, and the stamps earlier sessions wrote for him. */
export const OWNER_BY: readonly string[] = ['owner', 'elad'];

export interface Choice { id: string; review: ReviewState; note: string; at: string }

export interface ReadChoices { choices: Map<string, Choice>; lines: number; skipped: number }

/** A row is sorted by hand when the owner gave it a state; his way back to "unreviewed" takes it out again. */
export const isMine = (review: string, by: string | undefined): boolean => review !== 'unreviewed' && OWNER_BY.includes(by ?? '');

/** The last valid line per id. A line that is not JSON, has an unknown state, or names an id the page does not hold is skipped. */
export function parseReviews(text: string, known: ReadonlySet<string> | null): ReadChoices {
  const choices = new Map<string, Choice>();
  let lines = 0;
  let skipped = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    lines += 1;
    let v: unknown;
    try {
      v = JSON.parse(raw);
    } catch {
      skipped += 1;
      continue;
    }
    const o = v as Partial<Record<keyof Choice, unknown>> | null;
    if (o === null || typeof o !== 'object' || typeof o.id !== 'string' || !REVIEW_STATES.includes(o.review as ReviewState)
      || (known !== null && !known.has(o.id)) || (o.note !== undefined && typeof o.note !== 'string')) {
      skipped += 1;
      continue;
    }
    choices.set(o.id, { id: o.id, review: o.review as ReviewState, note: (o.note ?? '').slice(0, MAX_NOTE), at: typeof o.at === 'string' ? o.at : '' });
  }
  return { choices, lines, skipped };
}

export function readReviews(path: string, known: ReadonlySet<string> | null): ReadChoices {
  return parseReviews(existsSync(path) ? readFileSync(path, 'utf8') : '', known);
}

/** The row as the owner's choice leaves it. His note replaces the agent's; his way back to "unreviewed" leaves the row unsorted by hand (`o` false). */
export function applyChoice(row: Row, choice: Choice | undefined): Row {
  if (choice === undefined) return row;
  return { ...row, r: choice.review, note: choice.note, by: 'owner', o: isMine(choice.review, 'owner'), sa: choice.at };
}
