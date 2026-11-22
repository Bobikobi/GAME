/**
 * What the developers' home shows, from the hub-data document: the words and numbers a page prints. Kept apart from the
 * page so a test reads them without building it.
 */
import type { HubFeedItem, HubWorld } from '@game/schema/hub';

/** The standing tracks of the game read this, never an "agent" mark and never a person's name (DECISIONS.md, 2026-11-15). */
export const TEAM_NAME = 'Development team';

const group = new Intl.NumberFormat('en-US');

export function meterView(world: HubWorld): { drawn: string; whole: string; percent: string; asOf: string } {
  const [y, m, d] = world.as_of.split('-');
  return {
    drawn: group.format(world.drawn),
    whole: group.format(world.whole),
    // never less than a sliver, so a goal that has just begun is still seen; capped at the whole
    percent: Math.min(100, (world.drawn * 100) / world.whole).toFixed(3),
    asOf: `${d}.${m}.${y!.slice(2)}`,
  };
}

export function feedView(item: HubFeedItem): Omit<HubFeedItem, 'maker'> & { maker: string; chip: string; stateLabel: string } {
  return {
    ...item,
    maker: item.maker === 'team' ? TEAM_NAME : item.author,
    chip: item.state === 'draft' ? 'work' : 'review',
    stateLabel: item.state === 'draft' ? 'In work' : 'In review',
  };
}
