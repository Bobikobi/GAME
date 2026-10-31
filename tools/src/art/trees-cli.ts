import { writeTrees } from './trees.js';

const only = process.argv.slice(2);
for (const line of writeTrees(only.length > 0 ? only : undefined)) process.stdout.write(`${line}\n`);
