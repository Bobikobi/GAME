/**
 * The CI step behind pr-rules.ts: reads `git diff --name-status` on stdin and the pull request body from the
 * PR_BODY environment variable (never interpolated into a script), prints the verdict and exits 1 on a problem.
 *   git diff --name-status "origin/$BASE...HEAD" | PR_BODY="$BODY" tsx tools/src/pr-rules-cli.ts
 */
import { readFileSync } from 'node:fs';
import { decide, parseNameStatus } from './pr-rules';

const verdict = decide(parseNameStatus(readFileSync(0, 'utf8')), process.env.PR_BODY ?? '');
console.log(`quest files changed: ${verdict.quests.length}; story files changed: ${verdict.stories.length}; pictures added under content/kit/: ${verdict.pictures.length}; tree line: ${verdict.tree}`);
for (const p of verdict.problems) console.log(`::error::${p}`);
if (verdict.problems.length === 0) console.log('The body says what the tools that fire on this pull request ask.');
process.exit(verdict.problems.length === 0 ? 0 : 1);
