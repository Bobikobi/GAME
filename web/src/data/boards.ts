/// <reference types="astro/client" />
/**
 * The boards every page draws from (docs/team/GRUNT.md, items 5, 7 and 11). The site build writes the hub-data
 * document first (`pnpm hub:data`, item 3), and the boards come from it. A page built without it (`astro dev` on a
 * fresh clone) takes the builders from the repository itself: content/board.json, written by `pnpm board`, and each
 * builder's profile. The fixture's sample builders never reach a page; the footer's "(fixture)" covers the build
 * line only.
 */
import board from '../../../content/board.json';
import pointsFile from '../../../.github/points.json';
import { fromFixture, hub, repoTree } from './site';

export interface Signature {
  text: string;
  style: string;
  glyph?: string;
}

export interface Builder {
  handle: string;
  name: string;
  role?: string;
  signature?: Signature;
  points: number;
  records: number;
  commits: number;
  /** ids of the records the creator has in the game now (GRUNT item 19); empty in the fixture fallback below */
  extensions: string[];
  /** the builder's folder on GitHub */
  url: string;
}

export interface Reviewer {
  handle: string;
  approvals: number;
  points: number;
  url: string;
}

interface Profile {
  creator: string;
  profile: { name: string; role?: string; signature?: Signature };
}

const profiles = import.meta.glob<Profile>('../../../content/**/profile.json', { eager: true, import: 'default' });
const profileOf = new Map(Object.values(profiles).map((p) => [p.creator, p.profile]));

type Counts = Pick<Builder, 'points' | 'records' | 'commits'>;

const fromRepository = (): Builder[] =>
  Object.entries(board.board as Record<string, Counts>).map(([handle, counts]) => {
    const profile = profileOf.get(handle);
    return {
      handle,
      name: profile?.name ?? handle,
      ...(profile?.role ? { role: profile.role } : {}),
      ...(profile?.signature ? { signature: profile.signature } : {}),
      ...counts,
      extensions: [],
      url: repoTree(handle === 'core' ? 'content/core' : `content/extensions/${handle}`),
    };
  });

/** Every builder, most points first; a tie goes to the handle in alphabetical order. */
export const builders: Builder[] = (fromFixture ? fromRepository() : (hub.creators as Builder[])).sort(
  (a, b) => b.points - a.points || a.handle.localeCompare(b.handle),
);

/** True when the document read GitHub: the reviewers and this week are real, even when they are empty. */
export const githubRead = !fromFixture && hub.sources.github !== null;

/** Reviewers are counted from GitHub by the data build; without it there are none to show. */
export const reviewers: Reviewer[] = githubRead ? [...(hub.reviewers as Reviewer[])].sort((a, b) => b.points - a.points) : [];

/** The weights the boards are computed with: the built document's, else the file it copies them from. */
export const weights = fromFixture ? pointsFile : hub.parameters.points;

/** The players counter (DECISIONS.md, 2026-10-31): the game server's two counts, or null when they are unknown. */
export const accounts = fromFixture ? null : (hub.accounts ?? null);

/** This week's summary, when there is a real one. */
export const week = githubRead ? hub.summary : null;
