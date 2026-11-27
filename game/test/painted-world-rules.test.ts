import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import lightTables from '../src/painted-light.json';
import { litAt, lightRowsOf } from '../src/painted-table.js';

/**
 * Round 5, item 5 of the 21.11 brief: every rule of the figure's presence (her shadow, the cover's depth, the sun on the ground, the halo's night) runs on a generated map and reads its numbers from
 * the light table of the map's world, never from the land. A generated map is a scene whose id no table names; it takes its world's rows as they are.
 */
const worlds = lightTables.worlds as unknown as Record<string, { rows: { minute: number }[] }>;
const generated = (hourset: string) => ({ id: `generated-${hourset}-0001`, hourset });

describe('a generated map reads the table of its world', () => {
  for (const w of Object.keys(worlds)) {
    test(`world ${w}: a scene no table names gets the rows of its world, row for row`, () => {
      expect(lightRowsOf(generated(w))).toEqual(worlds[w]!.rows);
    });
  }
  test('a scene that names no world takes the river, and an alias takes its target', () => {
    expect(lightRowsOf({ id: 'generated-none-0001' })).toEqual(worlds['river']!.rows);
    for (const [alias, target] of Object.entries(lightTables.aliases as Record<string, string>)) expect(lightRowsOf(generated(alias))).toEqual(worlds[target]!.rows);
  });
  test('no land is named in the overrides of the table today, so no land differs from its world', () => {
    const named = Object.keys(lightTables.overrides).filter((k) => k !== 'note');
    expect(named).toEqual([]);
  });
});

describe('the day is one line in every world (a sweep of the clock, 24 hours, every minute)', () => {
  for (const w of Object.keys(worlds)) {
    test(`world ${w}: no field of the light jumps from one minute to the next by more than twice the steepest line of the table`, () => {
      const rows = lightRowsOf(generated(w));
      const fields = (m: number): Record<string, number> => {
        const l = litAt(rows, m);
        const f: Record<string, number> = { elev: l.elev, sl: l.sl, sq: l.sq, al: l.al, wall: l.wall, spec: l.spec, fill: l.fill, shift: l.shift };
        l.amb.forEach((v, i) => (f[`amb${i}`] = v));
        l.sun.forEach((v, i) => (f[`sun${i}`] = v));
        if (l.fog) { f['fogB'] = l.fog.bottom; f['fogT'] = l.fog.top; }
        return f;
      };
      // the table's own steepest line per minute, field by field, between neighbouring rows (the minutes at the rows themselves)
      const steepest: Record<string, number> = {};
      for (let i = 0; i < rows.length; i++) {
        const a = fields(rows[i]!.minute);
        const b = fields(rows[(i + 1) % rows.length]!.minute);
        const span = (rows[(i + 1) % rows.length]!.minute - rows[i]!.minute + 1440) % 1440 || 1440;
        for (const k of Object.keys(a)) if (k in b) steepest[k] = Math.max(steepest[k] ?? 0, Math.abs(b[k]! - a[k]!) / span);
      }
      let worst = 0;
      for (let m = 0; m < 1440; m++) {
        const a = fields(m);
        const b = fields((m + 1) % 1440);
        for (const k of Object.keys(a)) {
          if (!(k in b)) continue;
          expect(Number.isFinite(a[k]!), `${w} ${k} at ${m}`).toBe(true);
          expect(Math.abs(b[k]! - a[k]!), `${w} ${k} at ${m}`).toBeLessThanOrEqual(2 * (steepest[k] ?? 0) + 1e-9);
          worst = Math.max(worst, Math.abs(b[k]! - a[k]!));
        }
      }
      expect(worst).toBeLessThan(0.05);
    });
    test(`world ${w}: the direction of the sun turns by less than 3 degrees a minute while it is up`, () => {
      const rows = lightRowsOf(generated(w));
      const ang = (m: number): number => { const l = litAt(rows, m); return (Math.atan2(l.L3[1], l.L3[0]) * 180) / Math.PI; };
      for (const r of rows.filter((q) => (q as { sunUp?: boolean }).sunUp)) {
        const m = r.minute;
        let d = Math.abs(ang((m + 1) % 1440) - ang(m));
        d = Math.min(d, 360 - d);
        expect(d, `${w} at ${m}`).toBeLessThan(3);
      }
    });
  }
});

describe('no rule of her presence names a land', () => {
  const src = readdirSync(new URL('../src/', import.meta.url)).filter((f) => /^painted.*\.ts$/.test(f));
  // code only: a comment may say which land taught the rule, a branch may not
  const code = (f: string): string => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const LAND = /['"`](pond|ash|river-dawn|place-[a-z0-9-]+|strip-[a-z0-9-]+|block-[a-z0-9-]+|elf-wood[a-z0-9-]*|old-wood|high-rock|drowned-bay)['"`]/;
  for (const f of src) {
    test(`${f}: no quoted land id in the code`, () => {
      expect(LAND.exec(code(f))?.[0]).toBeUndefined();
    });
  }
  test('the noon the water is tinted against is the NOON of the engine, not a literal', () => {
    expect(code('painted.ts')).not.toMatch(/litAt\(this\.rows,\s*\d+/);
  });
});
