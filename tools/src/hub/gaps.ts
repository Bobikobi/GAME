/**
 * The three "still missing" rules of the developers' home (#727, stage 1): a thing with no picture, a figure with no
 * quest, a quest with no place. Each is a pure function over a small view of the content, so a test can build the
 * smallest world that has the gap and the smallest that has not. A line names the record and its file: a newcomer
 * can open that file and act.
 */
import type { Bundle } from '@game/kernel';
import type { HubGap } from '@game/schema/hub';
import { blobUrl } from './content';

/** A thing that is drawn: an item, a figure, a plant or a tree on the map. `sprites` are the kit ids it asks for. */
export interface PictureThing {
  id: string;
  file: string;
  sprites: string[];
}
export interface QuestView {
  id: string;
  file: string;
  giver?: string;
  pocket?: string;
  /** the kind of each step, in order: bring, make, restore, build, visit, tend, find, riddle */
  steps: string[];
}
export interface FigureView {
  id: string;
  file: string;
}
/** What the rules read of the content. `density` 1 is the old 16 px picture, 4 the rich one (kernel SpriteInfo). */
export interface GapView {
  sprites: Record<string, { density: number }>;
  things: PictureThing[];
  figures: FigureView[];
  quests: QuestView[];
}

/** A gap before its link is made: the repository the link points into is the build's. */
export type RawGap = Omit<HubGap, 'url'>;

/** Rule 1. A thing whose picture is not in any kit, or is still the old small one waiting for its redraw. */
export function noPicture(view: GapView): RawGap[] {
  const out: RawGap[] = [];
  for (const thing of view.things) {
    for (const sprite of thing.sprites) {
      const found = view.sprites[sprite];
      if (!found) out.push({ rule: 'no_picture', id: thing.id, file: thing.file, line: `no picture yet: ${sprite} is in no kit` });
      else if (found.density === 1) out.push({ rule: 'no_picture', id: thing.id, file: thing.file, line: `only the old 16 px picture (${sprite}), waiting for its redraw` });
    }
  }
  return out;
}

/** Rule 2. A figure that no quest names as its giver. */
export function figureNoQuest(view: GapView): RawGap[] {
  const givers = new Set(view.quests.map((q) => q.giver).filter((g): g is string => g !== undefined));
  return view.figures
    .filter((f) => !givers.has(f.id))
    .map((f) => ({ rule: 'figure_no_quest' as const, id: f.id, file: f.file, line: 'has no quest: no quest names this figure as its giver' }));
}

/**
 * Rule 3. A quest with no place: it has no giver (a figure always stands somewhere), no pocket, and none of its steps
 * is tied to the map. Visiting a slot, restoring a ruin and a riddle (its props and its answer are placed) are tied to
 * it; building a fire and tending one are where the player is; finding, bringing and making are not tied to anywhere.
 */
export function questNoPlace(view: GapView): RawGap[] {
  const placed = new Set(['visit', 'restore', 'riddle', 'build', 'tend']);
  return view.quests
    .filter((q) => q.giver === undefined && q.pocket === undefined && !q.steps.some((s) => placed.has(s)))
    .map((q) => ({ rule: 'quest_no_place' as const, id: q.id, file: q.file, line: 'has no place: no giver, no pocket and no step that leads anywhere on the map' }));
}

/** Every gap of the three rules, in a fixed order (by rule, then id), each with the link to its file. */
export function findGaps(view: GapView, repository: string): HubGap[] {
  return [...noPicture(view), ...figureNoQuest(view), ...questNoPlace(view)]
    .map((g) => ({ ...g, url: blobUrl(repository, g.file) }))
    .sort((a, b) => a.rule.localeCompare(b.rule) || a.id.localeCompare(b.id) || a.line.localeCompare(b.line));
}

/** The view of a built bundle. A resource is drawn by its node (and the picture it shows when emptied). */
export function viewOf(bundle: Bundle): GapView {
  const things: PictureThing[] = [
    ...Object.values(bundle.items).map((i) => ({ id: i.id, file: i.file, sprites: [i.sprite] })),
    ...Object.values(bundle.npcs).map((n) => ({ id: n.id, file: n.file, sprites: [n.sprite] })),
    ...Object.values(bundle.resources).map((r) => ({ id: r.id, file: r.file, sprites: [r.sprite, ...(r.sprite_empty ? [r.sprite_empty] : [])] })),
  ];
  return {
    sprites: bundle.sprites,
    things,
    figures: Object.values(bundle.npcs).map((n) => ({ id: n.id, file: n.file })),
    quests: Object.values(bundle.quests).map((q) => ({
      id: q.id,
      file: q.file,
      ...(q.giver ? { giver: q.giver } : {}),
      ...(q.pocket ? { pocket: q.pocket } : {}),
      steps: q.steps.map((s) => s.kind),
    })),
  };
}
