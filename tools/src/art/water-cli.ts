import { writeLayersModule, writeWater } from './water.js';

process.stdout.write(`${[...writeWater(), writeLayersModule()].join('\n')}\n`);
