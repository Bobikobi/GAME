/**
 * pnpm gen <story.json> [--out <dir>] [--render <file.png>]
 *
 * Reads a story, generates the land, writes its chunk files, the measure and the ground as text into the out
 * folder (default .scratch/gen/<name>/), and draws the phone-size picture. Prints the measure.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../load';
import { cut } from './cut';
import { generate } from './land';
import { render } from './render';
import { loadStory } from './story';

function main(argv: string[]): number {
  const args = [...argv];
  let out: string | undefined;
  let picture: string | undefined;
  const rest: string[] = [];
  while (args.length > 0) {
    const a = args.shift()!;
    if (a === '--out') out = args.shift();
    else if (a === '--render') picture = args.shift();
    else rest.push(a);
  }
  const storyPath = rest[0];
  if (!storyPath) {
    console.error('usage: pnpm gen <story.json> [--out <dir>] [--render <file.png>]');
    return 2;
  }
  const story = loadStory(storyPath);
  const name = story.id.split('/')[1]!;
  const dir = out ?? join(REPO_ROOT, '.scratch', 'gen', name);
  mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  const gen = generate(story);
  const ms = Date.now() - t0;
  for (const file of cut(gen)) writeFileSync(join(dir, `${file.id.split('/')[1]}.json`), `${JSON.stringify(file, null, 2)}\n`);
  writeFileSync(join(dir, 'ground.txt'), `${gen.land.ground.join('\n')}\n`);
  writeFileSync(join(dir, 'measure.json'), `${JSON.stringify({ ...gen.measure, marks: gen.land.marks, ms }, null, 2)}\n`);
  const png = picture ?? join(dir, `${name}.png`);
  writeFileSync(png, render(gen));
  const m = gen.measure;
  console.log(`${story.id} seed "${story.seed}" ${gen.land.w}x${gen.land.h} in ${ms} ms -> ${dir}`);
  console.log(`  tiles ${Object.entries(m.tiles).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  console.log(`  walkable ${m.walkable} unreachable ${m.unreachable} farthest ${m.farthestSteps} steps; roads ${m.roads}, longest straight ${m.longestRun} (bridge ${m.longestBridgeRun}), crossings ${m.crossings}`);
  console.log(`  caves ${m.caves}/${m.cavesAsked}; wood per block ${m.woodSpread[0]}..${m.woodSpread[1]}%; tree kinds ${m.treeKinds}`);
  console.log(`  picture ${png}`);
  return m.unreachable === 0 ? 0 : 1;
}

process.exitCode = main(process.argv.slice(2));
