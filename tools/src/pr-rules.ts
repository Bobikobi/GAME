/**
 * What a pull request must say about the tools that fire on it (.github/workflows/pr-triggers.yml). Four lines of
 * the body; the first three are owed when the diff touches the thing they are about, the fourth always:
 *   `Quest review:` the one-line verdict of the quest-designer skill, owed when a quest file changes (its reward and
 *                   its timing live in the quest file);
 *   `Story review:` the one-line verdict of the story-keeper skill, owed when a file a player reads as story changes
 *                   (a quest, an NPC's lines, a pocket's waking lines, the stone, a find, a race, the story pages);
 *   `Source:`       where a picture added under content/kit/ came from (docs/art/PROP_FROM_REF.md). Nothing else
 *                   checks that: `pnpm check` tests a sprite's size and palette, not where it came from.
 *   `Tree:`         where the work sits in the skill tree, owed by every pull request (AGENTS.md, "Tree first, both
 *                   ways"): the school and the node ids it builds or serves, or the path of the proposal that extends
 *                   the tree, or `none:` and why nothing a player can grow in changes.
 * The decision is a pure function of the changed paths and the body; the workflow only feeds it.
 */

export interface Change {
  /** git's name-status letter: A added, M modified, D deleted, R renamed */
  status: string;
  path: string;
}

/** The quest files: core's and an extension's (the single place the path list lives). */
export const QUEST_PATHS = /^content\/(?:core|extensions\/[^/]+)\/quests\/.+\.json$/;

/** The files whose text a player reads as the story, core's and an extension's, and the story pages. */
export const STORY_PATHS =
  /^(?:content\/(?:core|extensions\/[^/]+)\/(?:quests|npcs|pockets|restores|reactions|treasures|races)\/.+\.json|docs\/design\/STORY\.md|docs\/design\/story\/.+\.md)$/;

/** A picture under a kit folder. */
export const KIT_PICTURES = /^content\/kit\/.+\.png$/;

/** The text of a labelled line of the body, with comments and the template's untouched placeholder read as missing. */
export function labelled(body: string, label: string): string | undefined {
  const text = body.replace(/<!--[\s\S]*?-->/g, '');
  const m = new RegExp(`^[ \\t]*${label}:[ \\t]*(.*)$`, 'im').exec(text);
  const value = m?.[1]?.trim() ?? '';
  if (value === '' || value.startsWith('<')) return undefined;
  return value;
}

const NONE = /^(no|none|n\/a)\b/i;

/** The three forms of the tree line, read from its start; free words may follow. */
const TREE_NODES = /^[a-z][a-z0-9-]*(?:\/[a-z0-9-]+)+(?=[\s,;(]|$)/i;
const TREE_EXTENDS = /^extends the tree:[ \t]*(\S.*)?$/i;
const TREE_NONE = /^none:[ \t]*(.*)$/i;

/** How the tree line reads: a node list, a proposal, a reasoned none, or a problem. */
export type TreeForm = 'nodes' | 'extends' | 'none' | 'missing' | 'unreadable';

export function treeForm(value: string | undefined): TreeForm {
  if (value === undefined) return 'missing';
  const proposal = TREE_EXTENDS.exec(value);
  if (proposal) return proposal[1] !== undefined && !proposal[1].startsWith('<') ? 'extends' : 'unreadable';
  const none = TREE_NONE.exec(value);
  if (none) {
    const why = none[1]?.trim() ?? '';
    return /[a-z]/i.test(why) && !NONE.test(why) && !why.startsWith('<') ? 'none' : 'unreadable';
  }
  return TREE_NODES.test(value) && !NONE.test(value) ? 'nodes' : 'unreadable';
}

export interface Verdict {
  /** the plain messages to fail the run with; empty when the pull request is in order */
  problems: string[];
  quests: string[];
  stories: string[];
  pictures: string[];
  tree: TreeForm;
}

export function decide(changes: readonly Change[], body: string): Verdict {
  const quests = changes.filter((c) => c.status !== 'D' && QUEST_PATHS.test(c.path)).map((c) => c.path);
  const deletedQuests = changes.filter((c) => c.status === 'D' && QUEST_PATHS.test(c.path)).map((c) => c.path);
  const stories = changes.filter((c) => STORY_PATHS.test(c.path)).map((c) => c.path);
  const pictures = changes.filter((c) => c.status.startsWith('A') && KIT_PICTURES.test(c.path)).map((c) => c.path);
  const problems: string[] = [];

  const review = labelled(body, 'Quest review');
  if (quests.length + deletedQuests.length > 0) {
    const list = [...quests, ...deletedQuests];
    if (review === undefined) {
      problems.push(
        `This pull request changes a quest (${list.slice(0, 3).join(', ')}${list.length > 3 ? ', ...' : ''}). Run the quest-designer skill (.claude/skills/quest-designer) on it and put its verdict in one line in the body, as "Quest review: <verdict>".`,
      );
    } else if (NONE.test(review)) {
      problems.push(`The body says "Quest review: ${review}", but this pull request changes ${list.length} quest file${list.length === 1 ? '' : 's'}. Run the quest-designer skill and give its verdict.`);
    }
  }

  const story = labelled(body, 'Story review');
  if (stories.length > 0) {
    if (story === undefined) {
      problems.push(
        `This pull request changes text a player reads as the story (${stories.slice(0, 3).join(', ')}${stories.length > 3 ? ', ...' : ''}). Run the story-keeper skill (.claude/skills/story-keeper) on it, send what needs an answer to the manager, and put its verdict in one line in the body, as "Story review: <verdict>".`,
      );
    } else if (NONE.test(story)) {
      problems.push(`The body says "Story review: ${story}", but this pull request changes ${stories.length} story file${stories.length === 1 ? '' : 's'}. Run the story-keeper skill and give its verdict.`);
    }
  }

  const source = labelled(body, 'Source');
  if (pictures.length > 0) {
    if (source === undefined) {
      problems.push(
        `This pull request adds a picture under content/kit/ (${pictures.slice(0, 3).join(', ')}${pictures.length > 3 ? ', ...' : ''}). Say where it came from in one line in the body, as "Source: <where the picture came from>"; a picture from outside the game follows docs/art/PROP_FROM_REF.md (prop-from-ref skill).`,
      );
    } else if (NONE.test(source)) {
      problems.push(`The body says "Source: ${source}", but this pull request adds ${pictures.length} picture${pictures.length === 1 ? '' : 's'} under content/kit/. Say where they came from.`);
    }
  }

  const treeLine = labelled(body, 'Tree');
  const tree = treeForm(treeLine);
  const forms = '"Tree: <school>/<node ids>" for the nodes it builds or serves, "Tree: extends the tree: <path of the proposal>" for a new branch or node group, or "Tree: none: <why nothing a player can grow in changes>"';
  if (tree === 'missing') {
    problems.push(`Every pull request says where its work sits in the skill tree (AGENTS.md, "Tree first, both ways"). Put one line in the body: ${forms}.`);
  } else if (tree === 'unreadable') {
    problems.push(`The body says "Tree: ${treeLine}", which is none of the three forms. Write ${forms}.`);
  }
  return { problems, quests, stories, pictures, tree };
}

/** `git diff --name-status` output (tab separated; a rename lists both paths) as changes. */
export function parseNameStatus(text: string): Change[] {
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status = '', ...paths] = line.split('\t');
      return { status, path: paths[paths.length - 1] ?? '' };
    });
}
