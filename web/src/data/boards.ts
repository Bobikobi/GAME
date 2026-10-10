/// <reference types="astro/client" />
/**
 * The boards every page draws from (docs/team/GRUNT.md, items 5, 7 and 11). With a built hub-data document they
 * come from it. Without one (`pnpm hub:data`, item 3, does not exist yet) the builders come from the repository
 * itself: content/board.json, written by `pnpm board`, and each builder's profile. The fixture's sample builders
 * never reach a page; the footer's "(fixture)" covers the build line only.
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
      url: repoTree(handle === 'core' ? 'content/core' : `content/extensions/${handle}`),
    };
  });

/** Every builder, most points first; a tie goes to the handle in alphabetical order. */
export const builders: Builder[] = (fromFixture ? fromRepository() : (hub.creators as Builder[])).sort(
  (a, b) => b.points - a.points || a.handle.localeCompare(b.handle),
);

/** Reviewers are counted by the server; until the hub-data document is built there are none to show. */
export const reviewers: Reviewer[] = fromFixture ? [] : [...(hub.reviewers as Reviewer[])].sort((a, b) => b.points - a.points);

/** The weights the boards are computed with: the built document's, else the file it copies them from. */
export const weights = fromFixture ? pointsFile : hub.parameters.points;

/** This week's summary, when there is a real one. */
export const week = fromFixture ? null : hub.summary;
