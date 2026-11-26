/**
 * The CI step behind pr-rules.ts: reads `git diff --name-status` on stdin and the pull request body from the
 * PR_BODY environment variable (never interpolated into a script). The PR refs and repository names identify
 * releases. Prints the verdict and exits 1 on a problem.
 *   git diff --name-status "origin/$BASE...HEAD" | PR_BODY="$BODY" tsx tools/src/pr-rules-cli.ts
 */
import { readFileSync } from 'node:fs';
import { decide, parseNameStatus } from './pr-rules';
import { isReleasePullRequest } from './release-pr';

// Drain the workflow's diff pipe even for a release, so git diff can finish under pipefail.
const diff = readFileSync(0, 'utf8');
const { BASE, HEAD_REF, HEAD_REPOSITORY, GITHUB_REPOSITORY, PR_BODY } = process.env;
if (isReleasePullRequest(BASE, HEAD_REF, HEAD_REPOSITORY, GITHUB_REPOSITORY)) {
  console.log('::notice::Release pull request. Each change carried its own lines when it entered develop.');
} else {
  const verdict = decide(parseNameStatus(diff), PR_BODY ?? '');
  console.log(`quest files changed: ${verdict.quests.length}; story files changed: ${verdict.stories.length}; pictures added under content/kit/: ${verdict.pictures.length}; player-eye pictures: ${verdict.playerEye.length}; tree line: ${verdict.tree}`);
  for (const p of verdict.problems) console.log(`::error::${p}`);
  for (const w of verdict.warnings) console.log(`::warning::${w}`);
  if (verdict.problems.length === 0) console.log('The body says what the tools that fire on this pull request ask.');
  process.exit(verdict.problems.length === 0 ? 0 : 1);
}
