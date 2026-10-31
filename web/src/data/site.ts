/// <reference types="astro/client" />
/**
 * What every page reads at build time: the hub-data document (or its fixture on a fresh clone), the links of the
 * header and the footer, and the date form people read.
 */
import type { HubData } from '@game/schema/hub';
import fixture from '../../../schema/test/fixtures/hub-data.json';
import { playDoor } from '../../../tools/src/site/door';

/** The repository on GitHub; the game's own copy is REPO_URL in game/src/config.ts. */
export const REPO = 'https://github.com/Bobikobi/GAME';
export const repoFile = (path: string): string => `${REPO}/blob/develop/${path}`;
export const repoTree = (path: string): string => `${REPO}/tree/develop/${path}`;

// `pnpm hub:data` (GRUNT item 3) writes web/public/api/hub-data.json; without it the pages use the fixture
const built = import.meta.glob<{ default: HubData }>('../../public/api/hub-data.json', { eager: true });
const found = Object.values(built)[0];

export const hub: HubData = found ? found.default : (fixture as HubData);
/** True when the pages were built from the fixture; the footer says so beside the time. */
export const fromFixture = !found;

/** DD.MM.YY HH:MM, in UTC, the form every date a person reads takes on the site. */
export function dateTime(iso: string): string {
  const d = new Date(iso);
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${two(d.getUTCDate())}.${two(d.getUTCMonth() + 1)}.${two(d.getUTCFullYear() % 100)} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

export type Section = 'home' | 'boards' | 'developers' | 'docs';

/** Where every Play door leads: the demo at /play/, or the game with an account when the build names it (tools/src/site/door.ts). */
export const PLAY = playDoor();

/** The header's links; `section` marks the page a link leads to, for aria-current. */
export const NAV: readonly { label: string; href: string; section?: Section }[] = [
  { label: 'Play', href: PLAY },
  { label: 'Leaderboard', href: '/hub/boards/', section: 'boards' },
  { label: 'Developers', href: '/hub/', section: 'developers' },
  { label: 'Guide', href: '/docs/', section: 'docs' },
  { label: 'GitHub', href: REPO },
];

/** The footer's columns: where to play, how to build, where the community meets. */
export const FOOT_COLS: readonly { title: string; links: readonly { label: string; href: string }[] }[] = [
  { title: 'Play', links: [ { label: 'Classic, in your browser', href: PLAY }, { label: 'Leaderboard', href: '/hub/boards/' }, { label: 'Guide', href: '/docs/' } ] },
  { title: 'Build', links: [ { label: 'Developer area', href: '/hub/' }, { label: 'API and schemas', href: '/api/' }, { label: 'llms.txt', href: '/llms.txt' } ] },
  { title: 'Community', links: [ { label: 'GitHub', href: REPO }, { label: 'Rules', href: '/hub/rules/' }, { label: 'Licence', href: repoFile('LICENSE') } ] },
];

export const FOOT: readonly { label: string; href: string }[] = [
  { label: 'Rules', href: '/hub/rules/' },
  { label: 'Licence', href: repoFile('LICENSE') },
  { label: 'GitHub', href: REPO },
];

/** The page's structured data (docs/team/SEO_GEO.md section 5): only what the site holds today. */
export const GAME_LD = {
  '@context': 'https://schema.org',
  '@type': 'VideoGame',
  name: 'Loomvale',
  description: 'A free pixel-art game in the browser: wake by the river, mend the old bridge and bring the valley back. Every place and quest in it was added by a builder.',
  url: '/',
  genre: ['Role-playing', 'Pixel art', 'Community-built'],
  applicationCategory: 'Game',
  operatingSystem: 'Any (web browser)',
  playMode: 'SinglePlayer',
  gamePlatform: 'Web browser',
  inLanguage: 'en',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  license: repoFile('content/LICENSE'),
  codeRepository: REPO,
};

export const CODE_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareSourceCode',
  name: 'Loomvale',
  description: 'The Loomvale game: a deterministic TypeScript simulation, a JSON Schema format for game content, and the tools that check it.',
  codeRepository: REPO,
  programmingLanguage: 'TypeScript',
  runtimePlatform: 'Node.js',
  license: repoFile('LICENSE'),
};
