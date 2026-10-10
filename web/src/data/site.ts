/// <reference types="astro/client" />
/**
 * What every page reads at build time: the hub-data document (or its fixture on a fresh clone), the links of the
 * header and the footer, and the date form people read.
 */
import type { HubData } from '@game/schema/hub';
import fixture from '../../../schema/test/fixtures/hub-data.json';

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

export type Section = 'home' | 'boards' | 'developers';

/** The header's links; `section` marks the page a link leads to, for aria-current. */
export const NAV: readonly { label: string; href: string; section?: Section }[] = [
  { label: 'Play', href: '/play/' },
  { label: 'Leaderboard', href: '/hub/boards/', section: 'boards' },
  { label: 'Developers', href: '/hub/', section: 'developers' },
  { label: 'Guide', href: repoFile('docs/creators/README.md') },
  { label: 'GitHub', href: REPO },
];

export const FOOT: readonly { label: string; href: string }[] = [
  { label: 'Rules', href: repoFile('CONTRIBUTING.md') },
  { label: 'Licence', href: repoFile('LICENSE') },
  { label: 'GitHub', href: REPO },
];
