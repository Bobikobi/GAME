import { describe, expect, test } from 'vitest';

import { PREVIEW_QUERY, presenceOf, zoomOf } from '../src/painted-presence.js';

/** the query the page hands the mount: main.ts puts the page's own query first, the preview's after it */
const previewSearch = (own: string): string => `${own}&${PREVIEW_QUERY.slice(1)}`;

describe('see-through in the private preview', () => {
  test('a plain painted scene has it off: the engine default is the owner\'s to rule', () => {
    expect(presenceOf('?debug&painted=river-dawn').seeThrough).toBe(false);
  });

  test('the preview has it on, by the preview\'s own query', () => {
    expect(PREVIEW_QUERY).toContain('seethrough=1');
    expect(presenceOf(previewSearch('?preview')).seeThrough).toBe(true);
    expect(presenceOf(previewSearch('?preview&debug&seed=7&hold=clock')).seeThrough).toBe(true);
  });

  test('the page\'s own query comes first: seethrough=0 turns it off in the preview, for a twin still', () => {
    expect(presenceOf(previewSearch('?preview&seethrough=0')).seeThrough).toBe(false);
  });

  test('the other presence options are as they were', () => {
    const p = presenceOf(previewSearch('?preview'));
    expect(p).toMatchObject({ edge: true, contact: true, link: true, deviceClock: true, figZoom: 0 });
  });
});

describe('the phone camera in the private preview', () => {
  test('a plain painted scene keeps the fixed 3: no auto', () => {
    expect(zoomOf('?debug&painted=river-dawn')).toEqual({ auto: false, value: 0 });
  });

  test('the preview has auto, by the preview\'s own query', () => {
    expect(PREVIEW_QUERY).toContain('zoom=auto');
    expect(zoomOf(previewSearch('?preview&debug&seed=7'))).toEqual({ auto: true, value: 0 });
  });

  test('an explicit number wins over the preview\'s auto, as the page\'s query comes first', () => {
    expect(zoomOf(previewSearch('?preview&zoom=12'))).toEqual({ auto: false, value: 12 });
  });

  test('a bad value is no zoom', () => {
    expect(zoomOf('?zoom=abc')).toEqual({ auto: false, value: 0 });
    expect(zoomOf('?zoom=-4')).toEqual({ auto: false, value: 0 });
  });
});
