/**
 * The hub-data document (docs/team/PLATFORM.md, section 3) is the one file the
 * site, the boards and the API read. The fixture is what a stage-1 build
 * produces with GitHub and Vercel access; the tests pin the rules the schema
 * cannot say on its own.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FORMAT_VERSION, SCHEMAS } from '../src/index';
import { DOCUMENT_SCHEMAS, HUB_FORMAT, hubInvariants, validateHubData, type HubData } from '../src/hub';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (): HubData => JSON.parse(readFileSync(join(here, 'fixtures', 'hub-data.json'), 'utf8')) as HubData;

describe('hub-data', () => {
  it('accepts the fixture', () => {
    expect(validateHubData(fixture())).toEqual([]);
  });

  it('is emitted with the other schemas and committed', () => {
    const file = join(here, '..', 'json', 'hub-data.schema.json');
    const emitted = JSON.parse(readFileSync(file, 'utf8')) as { $id: string; properties: Record<string, unknown> };
    expect(emitted.$id).toBe('https://github.com/Bobikobi/GAME/schema/json/hub-data.schema.json');
    expect(Object.keys(emitted.properties)).toEqual(Object.keys(DOCUMENT_SCHEMAS['hub-data'].properties));
  });

  it('is a document, not an extension file type', () => {
    expect('hub-data' in SCHEMAS).toBe(false);
    expect(fixture().source.schema_format).toBe(FORMAT_VERSION);
    expect(fixture().format).toBe(HUB_FORMAT);
  });

  it('refuses hours and other extra fields', () => {
    const doc = fixture() as unknown as { creators: Record<string, unknown>[] };
    doc.creators[0]!.hours = 2;
    const issues = validateHubData(doc);
    expect(issues.map((i) => i.path)).toContain('/creators/0/hours');
  });

  it('refuses a document of another format', () => {
    const doc = fixture() as unknown as { format: number };
    doc.format = 2;
    expect(validateHubData(doc).map((i) => i.path)).toContain('/format');
  });

  it('every board number is computed from the parameters it carries', () => {
    const doc = fixture();
    doc.creators[0]!.points += 1;
    expect(hubInvariants(doc).map((i) => i.path)).toEqual(['/creators/0/points']);
    const again = fixture();
    again.reviewers[0]!.points = 11;
    expect(hubInvariants(again).map((i) => i.path)).toEqual(['/reviewers/0/points']);
  });

  it('a filled slot names an accepted record', () => {
    const doc = fixture();
    doc.slots[0]!.filled_by = 'core/nothing';
    expect(hubInvariants(doc).map((i) => i.path)).toEqual(['/slots/0/filled_by']);
  });

  it('support at the threshold is an open call', () => {
    const doc = fixture();
    doc.requests[1]!.support = doc.parameters.loop.open_call_votes;
    expect(hubInvariants(doc).map((i) => i.path)).toEqual(['/requests/1/open_call']);
  });

  it('a missing source leaves its section empty', () => {
    const doc = fixture();
    doc.sources.github = null;
    expect(hubInvariants(doc).map((i) => i.path)).toEqual(['/sources/github']);
    const bare = fixture();
    bare.sources.github = null;
    bare.requests = [];
    bare.proposals = [];
    bare.votes = [];
    bare.reviewers = [];
    bare.summary = null;
    expect(validateHubData(bare)).toEqual([]);
  });

  it('players and usage stay null until their stage', () => {
    const doc = fixture();
    expect(doc.players).toBeNull();
    expect(doc.usage).toBeNull();
    doc.sources.usage = { fetched_at: '2026-10-07T15:00:00Z', window_days: 7 };
    doc.usage = {
      since: '2026-09-30T15:00:00Z',
      until: '2026-10-07T15:00:00Z',
      extensions: { 'trout-maker/river-trout': { visits: 40, pickups: 31, reports: 0 } },
      stops: [{ step: 'first-gather', players: 12 }],
    };
    expect(validateHubData(doc)).toEqual([]);
  });

  it('carries the ranking parameters as the committed JSON files say them', () => {
    const root = join(here, '..', '..');
    const loop = JSON.parse(readFileSync(join(root, '.github', 'loop.json'), 'utf8')) as unknown;
    const points = JSON.parse(readFileSync(join(root, '.github', 'points.json'), 'utf8')) as unknown;
    expect(fixture().parameters.loop).toEqual(loop);
    expect(fixture().parameters.points).toEqual(points);
  });

  it('never carries vote counts, only the published display', () => {
    const vote = DOCUMENT_SCHEMAS['hub-data'].properties.votes.items.properties;
    const option = vote.options.items.properties;
    expect(Object.keys(option).sort()).toEqual(['bar', 'key', 'percent', 'title', 'url']);
    expect('voters' in vote).toBe(false);
    expect('votes' in vote).toBe(false);
  });
});
