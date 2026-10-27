/**
 * `pnpm balance [--fixture] [--json]`: the balance prover (PROGRESSION 4.7).
 * Without a flag it proves content as it stands and fails on a red row that
 * `pnpm check` also holds (WIRED_ROWS); the other rows report. With
 * `--fixture` it proves the stand-in catalogue of fixture.ts instead and
 * always exits 0: it tests the numbers of the design pages, not content.
 */
import { performance } from 'node:perf_hooks';
import { realCatalogue } from './catalogue';
import { fmtMs, fmtTenths } from './curve';
import { fixtureCatalogue } from './fixture';
import { WIRED_ROWS, prove } from './prove';
import { calmSnow, timeToZero, windows } from './tables';
import { loadWorld } from './world';

const fixture = process.argv.includes('--fixture');
const json = process.argv.includes('--json');
const t0 = performance.now();
const { bundle, rules } = loadWorld();
const cat = fixture ? fixtureCatalogue(rules) : realCatalogue(bundle, rules);
const t1 = performance.now();
const proof = prove(rules, cat, fixture ? undefined : bundle);
const t2 = performance.now();
const extra = fixture ? { windows: windows(rules, cat), timeToZero: timeToZero(rules), calmSnow: calmSnow(rules, cat) } : { timeToZero: timeToZero(rules) };
const t3 = performance.now();
const runtime = { loadMs: Math.round(t1 - t0), proveMs: Math.round(t2 - t1), tablesMs: Math.round(t3 - t2) };
const wired = new Set<string>(WIRED_ROWS);
const red = proof.rows.filter((r) => r.status === 'fail' && wired.has(r.id.split(':')[0]!));

if (json) {
  console.log(JSON.stringify({ ...proof, ...extra, runtime, things: { pieces: cat.pieces.length, dishes: cat.dishes.length, walls: cat.walls.length, schools: cat.schools.length } }, null, 2));
} else {
  console.log(`The balance prover over ${fixture ? 'the stand-in catalogue (fixture-rules.json, never content)' : 'content as it stands'}: ${cat.pieces.length} worn things, ${cat.dishes.length} foods, ${cat.walls.length} walls, ${cat.schools.length} schools.`);
  console.log('');
  const mark = { pass: 'ok  ', fail: 'RED ', warn: 'warn', info: 'info' } as const;
  for (const r of proof.rows) console.log(`${mark[r.status]}  ${r.id}${!fixture && wired.has(r.id.split(':')[0]!) ? ' (in pnpm check)' : ''}: ${r.detail}`);
  console.log('');
  console.log('Hours to master, by school:');
  console.log(proof.hours.map((h) => `${h.school} ${fmtTenths(h.tenths)} h${h.first ? '' : ' (later)'}`).join(', '));
  if (proof.counts.length > 0) {
    console.log('');
    console.log('Combinations: the full space, and what the proof walked after dominance pruning:');
    for (const c of proof.counts) console.log(`  ${c.what}: ${c.full} in full, ${c.walked} walked`);
  }
  console.log('');
  console.log(`Runtime: load ${runtime.loadMs} ms, proofs ${runtime.proveMs} ms, tables ${runtime.tablesMs} ms. A game hour is ${fmtMs(rules.gameHourMs)}.`);
}
process.exitCode = !fixture && red.length > 0 ? 1 : 0;
