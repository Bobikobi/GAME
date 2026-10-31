import { writeWave3d } from './wave3d.js';

const only = process.argv.slice(2);
for (const line of writeWave3d(only.length > 0 ? only : undefined)) process.stdout.write(`${line}\n`);
