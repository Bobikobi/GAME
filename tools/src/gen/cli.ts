/**
 * pnpm gen <name | story.json | --all> [--out <dir>] [--render <file.png>]
 *
 * Reads a story (by its name under content/core/stories/, or by path), generates the land, writes its chunk files,
 * the measure, the ground as text and the region card into the out folder (default .scratch/gen/<name>/), and draws
 * the phone-size picture. `--all` runs every story the core has, each into its own folder. Prints the measure.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../load';
import { cardOf } from './atmosphere';
import { cut } from './cut';
import { generate } from './land';
import { render, renderBelow } from './render';
import { spawn } from './spawn';
import { type StoryDef, listStories, loadStory } from './story';

const USAGE = 'usage: pnpm gen <name | story.json | --all> [--out <dir>] [--render <file.png>]';

function main(argv: string[]): number {
  const args = [...argv];
  let out: string | undefined;
  let picture: string | undefined;
  let all = false;
  const rest: string[] = [];
  while (args.length > 0) {
    const a = args.shift()!;
    if (a === '--out') out = args.shift();
    else if (a === '--render') picture = args.shift();
    else if (a === '--all') all = true;
    else rest.push(a);
  }
  if (all) {
    if (rest.length > 0 || picture) {
      console.error(`${USAGE}\n--all takes no story and no --render`);
      return 2;
    }
    let code = 0;
    for (const name of listStories()) code = Math.max(code, run(loadStory(name), out ? join(out, name) : undefined));
    return code;
  }
  const storyPath = rest[0];
  if (!storyPath) {
    console.error(USAGE);
    return 2;
  }
  return run(loadStory(storyPath), out, picture);
}

function run(story: StoryDef, out?: string, picture?: string): number {
  const name = story.id.split('/')[1]!;
  const dir = out ?? join(REPO_ROOT, '.scratch', 'gen', name);
  mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  const gen = generate(story);
  const ms = Date.now() - t0;
  const { spawns, measure: sm } = spawn(gen);
  for (const file of cut(gen, spawns)) writeFileSync(join(dir, `${file.id.split('/')[1]}.json`), `${JSON.stringify(file, null, 2)}\n`);
  writeFileSync(join(dir, 'ground.txt'), `${gen.land.ground.join('\n')}\n`);
  writeFileSync(join(dir, 'measure.json'), `${JSON.stringify({ ...gen.measure, marks: gen.land.marks, doors: gen.doors, ms }, null, 2)}\n`);
  // what the owner's map would carry for this land (map.json changes only on his word): its regions and its card
  const card = cardOf(story);
  const regions: Record<string, unknown>[] = [{ id: name, x: gen.land.x0, y: gen.land.y0, w: gen.land.w, h: gen.land.h, world: story.world, card: card.id, title: story.title }];
  if (gen.below) {
    const b = gen.below;
    writeFileSync(join(dir, 'ground-below.txt'), `${b.land.ground.join('\n')}\n`);
    writeFileSync(join(dir, 'measure-below.json'), `${JSON.stringify({ ...b.measure, arrivals: b.arrivals, marks: b.land.marks }, null, 2)}\n`);
    regions.push({ id: `${name}-below`, x: b.land.x0, y: b.land.y0, w: b.land.w, h: b.land.h, world: story.world, card: card.id, title: `${story.title}, below`, underground: true });
    const below = renderBelow(gen);
    if (below) writeFileSync(join(dir, `${name}-below.png`), below);
  }
  writeFileSync(join(dir, 'regions.json'), `${JSON.stringify({ regions, cards: [card] }, null, 2)}\n`);
  writeFileSync(join(dir, 'spawns.json'), `${JSON.stringify({ story: story.id, spawns }, null, 2)}\n`);
  writeFileSync(join(dir, 'spawn-measure.json'), `${JSON.stringify(sm, null, 2)}\n`);
  const png = picture ?? join(dir, `${name}.png`);
  writeFileSync(png, render(gen, spawns));
  const m = gen.measure;
  console.log(`${story.id} seed "${story.seed}" ${gen.land.w}x${gen.land.h} in ${ms} ms -> ${dir}`);
  console.log(`  tiles ${Object.entries(m.tiles).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  console.log(`  walkable ${m.walkable} unreachable ${m.unreachable} farthest ${m.farthestSteps} steps; roads ${m.roads}, longest straight ${m.longestRun} (bridge ${m.longestBridgeRun}), crossings ${m.crossings}`);
  console.log(`  doors ${m.caves}/${m.cavesAsked} (${m.doorForms.join(', ') || '-'}); wood per block ${m.woodSpread[0]}..${m.woodSpread[1]}%; tree kinds ${m.treeKinds}`);
  if (gen.below) {
    const b = gen.below.measure;
    console.log(`  below ${gen.below.land.w}x${gen.below.land.h} at (${gen.below.land.x0}, ${gen.below.land.y0}): floor ${b.floor}, unreachable ${b.unreachable}, chambers ${b.chambers}, tunnel tiles ${b.tunnels}, secrets ${b.secrets} (dead end ${b.deadEnd}), pool ${b.pool ? 'yes' : 'no'}, span ${b.span} steps`);
  }
  console.log(`  creatures: ${sm.spots} spots, ${sm.creatures[0]}-${sm.creatures[1]} alive, ${sm.kinds} kinds (${sm.skipped.length} without a place: ${sm.skipped.join(' ') || '-'})`);
  console.log(`    by danger ${sm.byDanger.join('/')}; ranks ${Object.entries(sm.byRank).map(([k, v]) => `${k} ${v}`).join(', ')}; shapes ${Object.entries(sm.byShape).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`    no picture yet: ${sm.noArt.join(' ') || '-'}`);
  const a = card.atmosphere!;
  console.log(`  air: ${card.climate}, sun ${a.sun.day.join(',')}, night ${a.night_depth}, ${a.particles.map((p) => `${p.kind} ${p.density}`).join(', ') || 'still'}${a.shafts ? ', shafts' : ''}; mist ${card.weather.fog > 0 ? 'yes' : 'no'}`);
  console.log(`  picture ${png}`);
  return m.unreachable === 0 && (gen.below?.measure.unreachable ?? 0) === 0 ? 0 : 1;
}

process.exitCode = main(process.argv.slice(2));
