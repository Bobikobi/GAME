/**
 * What a pull request must say about the tools that fire on it (.github/workflows/pr-triggers.yml). Two lines of
 * the body, each owed when the diff touches the thing it is about:
 *   `Quest review:` the one-line verdict of the quest-designer skill, owed when a quest file changes (its reward and
 *                   its timing live in the quest file);
 *   `Source:`       where a picture added under content/kit/ came from (docs/art/PROP_FROM_REF.md). Nothing else
 *                   checks that: `pnpm check` tests a sprite's size and palette, not where it came from.
 * The decision is a pure function of the changed paths and the body; the workflow only feeds it.
 */

export interface Change {
  /** git's name-status letter: A added, M modified, D deleted, R renamed */
  status: string;
  path: string;
}

/** The quest files: core's and an extension's (the single place the path list lives). */
export const QUEST_PATHS = /^content\/(?:core|extensions\/[^/]+)\/quests\/.+\.json$/;

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

export interface Verdict {
  /** the plain messages to fail the run with; empty when the pull request is in order */
  problems: string[];
  quests: string[];
  pictures: string[];
}

export function decide(changes: readonly Change[], body: string): Verdict {
  const quests = changes.filter((c) => c.status !== 'D' && QUEST_PATHS.test(c.path)).map((c) => c.path);
  const deletedQuests = changes.filter((c) => c.status === 'D' && QUEST_PATHS.test(c.path)).map((c) => c.path);
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
  return { problems, quests, pictures };
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
