/** `pnpm private`: fail when a tracked file names something that belongs to one machine or one person. */
import { REPO_ROOT } from './load';
import { scanFiles, trackedFiles } from './private-strings';

const files = trackedFiles(REPO_ROOT);
const hits = scanFiles(REPO_ROOT, files);
for (const h of hits) console.log(`::error file=${h.file},line=${h.line}::${h.file}:${h.line} holds ${h.what}. Say it without the path, the script name or the address (a neutral phrase such as "the owner's test address, kept outside the repo").`);
if (hits.length === 0) console.log(`No private machinery in the tree (${files.length} tracked files read).`);
process.exit(hits.length === 0 ? 0 : 1);
