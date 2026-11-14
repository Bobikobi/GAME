/** Historical fixture recorder. Deliberately refuses to overwrite or record another implementation. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fightTick, hashOf } from '@game/kernel';
import { loadBundle } from '../../tools/test/helpers/world.js';
import { fightArena, fightScripts, scriptInputs, scriptWorld } from '../test/fight-scripts.js';

const source = 'df3270f3b080a35852b13d831f880a2e828fe871';
const target = 'kernel/test/fixtures/fight-golden.json';
const original = execFileSync('git', ['show', `${source}:kernel/src/fight.ts`]);
const digest = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
if (existsSync(target) || digest(readFileSync('kernel/src/fight.ts')) !== digest(original)) {
  throw new Error('Record only the unchanged develop tick, once; never update this fixture to fit a change.');
}
const b = fightArena(loadBundle());
const scripts = fightScripts.map((script) => {
  let w = scriptWorld(b, script);
  const ticks: [string, string][] = [];
  const counts: Record<string, number> = {};
  for (let tick = 0; tick < 1000; tick++) {
    const r = fightTick(b, w, scriptInputs(script, w, tick), tick);
    ticks.push([hashOf(r.world), hashOf(r.events)]);
    for (const e of r.events) counts[e.e] = (counts[e.e] ?? 0) + 1;
    w = r.world;
  }
  process.stdout.write(`${script.name}: ${JSON.stringify(counts)}\n`);
  return { name: script.name, seed: script.seed, counts, ticks };
});
writeFileSync(target, JSON.stringify({ source, fightSourceSha256: digest(original), scripts }, null, 2).replace(/\[\n\s+"([0-9a-f]{16})",\n\s+"([0-9a-f]{16})"\n\s+\]/g, '["$1", "$2"]') + '\n');
