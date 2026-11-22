/**
 * The developers' home's feed: the open pull requests of the repository, as they are on GitHub (#727, stage 1).
 * Nothing is invented. A pull request is in the feed when GitHub says it is open, whatever its base, and appears once,
 * with its real GitHub handle; `maker` only says whether that handle is one of the game's own standing tracks, which
 * the page shows as "Development team".
 */
import type { HubFeedItem, HubGap } from '@game/schema/hub';
import type { LoopClient } from '../loop/github';
import type { ChangedFile, PullRequest } from '../loop/types';
import { handle } from './github';

const cut = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The gaps a pull request touches: those whose file it changes, three at most, in the order the rules found them. */
export const gapsOf = (changed: readonly string[], gaps: readonly HubGap[]): HubGap[] => {
  const files = new Set(changed);
  return gaps.filter((g) => files.has(g.file)).slice(0, 3);
};

/**
 * The feed from the pull requests GitHub listed. Open ones only: the list GitHub answers for state=open holds no other,
 * and a list that does (a stale answer, a different query) is cut here as well. Newest change first, then by number.
 */
export function buildFeed(pulls: readonly PullRequest[], changedByNumber: ReadonlyMap<number, readonly string[]>, gaps: readonly HubGap[], team: ReadonlySet<string>): HubFeedItem[] {
  return pulls
    .filter((pr) => pr.state === 'open')
    .map((pr) => {
      const author = handle(pr.user?.login ?? 'ghost');
      return {
        number: pr.number,
        title: cut(pr.title, 200),
        url: pr.html_url,
        author,
        maker: team.has(author) ? ('team' as const) : ('person' as const),
        state: pr.draft ? ('draft' as const) : ('review' as const),
        created_at: pr.created_at,
        updated_at: pr.updated_at ?? pr.created_at,
        missing: gapsOf(changedByNumber.get(pr.number) ?? [], gaps),
      };
    })
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at) || b.number - a.number);
}

/** Read the open pull requests and the files each changes (the gaps are attached by file), then build the feed. */
export async function readFeed(client: LoopClient, repository: string, gaps: readonly HubGap[], team: ReadonlySet<string>): Promise<HubFeedItem[]> {
  const pulls = await client.list<PullRequest>(`/repos/${repository}/pulls?state=open&per_page=100`);
  const changed = new Map<number, string[]>();
  for (const pr of pulls) {
    if (pr.state !== 'open') continue;
    const files = await client.list<ChangedFile>(`/repos/${repository}/pulls/${pr.number}/files?per_page=100`);
    changed.set(pr.number, files.map((f) => f.filename));
  }
  return buildFeed(pulls, changed, gaps, team);
}
