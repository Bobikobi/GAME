import { writeFileSync } from 'node:fs';

import { leftoversReport } from './leftovers.js';

const out = process.argv.indexOf('--out');
const { text } = leftoversReport();
if (out > 0 && process.argv[out + 1]) writeFileSync(process.argv[out + 1]!, text);
else process.stdout.write(text);
