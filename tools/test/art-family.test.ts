import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { PNG } from 'pngjs';
import manifest from '../../docs/art/families/rich-world-oak.json';
import { inspectFamily, measureSprite, parseFamily, familyFile, inspectFamilies } from '../src/art/family';
import { familyHtml } from '../src/art/report';
import { REPO_ROOT } from '../src/load';

const temporary: string[] = [];
afterEach(() => { for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'art-family-')); temporary.push(root);
  const family = parseFamily(structuredClone(manifest));
  family.assets = [family.assets[0]!];
  const asset = family.assets[0]!;
  asset.file = 'oak.png'; asset.frame = [2, 2]; asset.provenance = 'evidence.json'; asset.review.evidence = 'evidence.json';
  const png = new PNG({ width: 2, height: 2 });
  for (let i = 0; i < png.data.length; i += 4) png.data.set([31, 61, 43, 255], i);
  const bytes = PNG.sync.write(png);
  asset.sha256 = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(join(root, asset.file), bytes); writeFileSync(join(root, 'evidence.json'), '{}');
  return { root, family, asset, png };
}

test('existing rejected oak passes palette checks but triggers an aspect review warning', () => {
  const report = inspectFamily(parseFamily(manifest), REPO_ROOT);
  expect(report.findings.filter(f => f.level === 'error')).toEqual([]);
  expect(report.findings).toContainEqual(expect.objectContaining({ asset: 'oak-broad', code: 'compare-aspect', level: 'warning' }));
  const family = parseFamily(structuredClone(manifest));
  family.sceneAssets.push('oak-broad');
  expect(inspectFamily(family, REPO_ROOT).findings).toContainEqual(expect.objectContaining({ code: 'not-approved', asset: 'oak-broad', level: 'error' }));
});

test('changed bytes invalidate review even with the same dimensions and allowed colors', () => {
  const { root, family, png } = fixture();
  expect(inspectFamily(family, root).findings).toEqual([]);
  png.data.set([46, 107, 59, 255], 0);
  writeFileSync(join(root, 'oak.png'), PNG.sync.write(png));
  expect(inspectFamily(family, root).findings.map(f => f.code)).toEqual(['changed-bytes']);
});

test('palette, partial alpha, wrong frame and missing evidence fail independently', () => {
  const { root, family, asset, png } = fixture();
  png.data.set([1, 2, 3, 127], 0);
  const bytes = PNG.sync.write(png);
  asset.sha256 = createHash('sha256').update(bytes).digest('hex');
  asset.frame = [3, 2];
  writeFileSync(join(root, 'oak.png'), bytes);
  expect(inspectFamily(family, root).findings.map(f => f.code)).toEqual(['frame', 'palette', 'alpha']);
  asset.provenance = 'missing.json';
  expect(inspectFamily(family, root).findings[0]?.code).toBe('asset-file');
});

test('empty alpha is rejected, while RGB under fully transparent pixels is ignored', () => {
  const { root, family, asset, png } = fixture();
  png.data.fill(0);
  png.data.set([1, 2, 3, 0], 0);
  const bytes = PNG.sync.write(png); asset.sha256 = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(join(root, 'oak.png'), bytes);
  expect(inspectFamily(family, root).findings.map(f => f.code)).toEqual(['empty']);
  expect(measureSprite(png).edgeDensity).toBe(0);
});

test('malformed contracts, duplicate ids, unknown selections and agent approval are refused', () => {
  for (const change of [
    (f: typeof manifest) => { f.sceneAssets = ['absent']; },
    (f: typeof manifest) => { f.assets.push(f.assets[0]!); },
    (f: typeof manifest) => { f.contract.root.radiusX = -1; },
    (f: typeof manifest) => { f.contract.heights = []; },
    (f: typeof manifest) => { f.assets[0]!.review.by = 'agent'; },
    (f: typeof manifest) => { f.ramps = ['nonexistent']; },
  ]) {
    const copy = structuredClone(manifest); change(copy);
    expect(() => parseFamily(copy)).toThrow();
  }
});

test('missing and escaping paths fail, and malformed JSON is reported without a crash', () => {
  const { root } = fixture();
  expect(() => familyFile(root, '/etc/passwd')).toThrow();
  expect(() => familyFile(root, '../../etc/passwd')).toThrow();
  mkdirSync(join(root, 'docs/art/families'), { recursive: true });
  writeFileSync(join(root, 'docs/art/families/bad.json'), '{');
  expect(inspectFamilies(root)[0]?.report.findings[0]?.code).toBe('manifest');
});

test('report shows rejected candidates without promoting them and escapes record text', () => {
  const family = parseFamily(structuredClone(manifest));
  family.assets[1]!.review.reason = '<script>alert(1)</script>';
  const html = familyHtml(family, inspectFamily(family, REPO_ROOT), REPO_ROOT);
  expect(html).toContain('comparison only');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).toContain('data:image/png;base64,');
});
