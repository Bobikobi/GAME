/** next-status: every NEXT.md section opens with a Status line in one grammar, and new sections take slug ids. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkNext, nextSections, parseStatus } from '../src/decisions/next';
import { REPO_ROOT } from '../src/load';

const doc = (...sections: string[]): string => ['# What is next', '', '## Rules for every stream', '', '- a rule', '', ...sections].join('\n');
const section = (id: string, status: string | null): string => [`## ${id}. A title`, '', ...(status === null ? [] : [`Status: ${status}`, '']), 'Body.', ''].join('\n');
const STREAMS = ['art', 'accounts'];

describe('next-status', () => {
  it('reads the numbered and slug sections, not the other headings', () => {
    const s = nextSections(doc(section('1', 'open'), section('night-ruins', null)));
    expect(s.map((x) => [x.id, x.status])).toEqual([
      ['1', 'open'],
      ['night-ruins', null],
    ]);
  });

  it('takes every form of the grammar', () => {
    expect(parseStatus('open')).toEqual({ kind: 'open' });
    expect(parseStatus('building - art')).toEqual({ kind: 'building', stream: 'art' });
    expect(parseStatus('built (#12, #30)')).toEqual({ kind: 'built', prs: [12, 30] });
    expect(parseStatus('built - the kernel of 0.10')).toEqual({ kind: 'built-where', where: 'the kernel of 0.10' });
    expect(parseStatus('paused - waits for the races')).toEqual({ kind: 'paused', why: 'waits for the races' });
    expect(parseStatus('dropped - the races replaced it')).toEqual({ kind: 'dropped', why: 'the races replaced it' });
    for (const bad of ['done', 'built', 'built (12)', 'paused', 'building art', 'open - soon']) expect(parseStatus(bad)).toBeNull();
  });

  it('a section with no Status line fails', () => {
    const issues = checkNext(doc(section('1', null)), STREAMS);
    expect(issues.map((i) => i.message)).toEqual([expect.stringMatching(/has no Status line.*\[next-status\]$/)]);
  });

  it('a Status line that breaks the grammar fails', () => {
    expect(checkNext(doc(section('1', 'done')), STREAMS)[0].message).toMatch(/breaks the grammar/);
  });

  it('a building Status that names no stream fails', () => {
    expect(checkNext(doc(section('1', 'building - art')), STREAMS)).toEqual([]);
    expect(checkNext(doc(section('1', 'building - nobody')), STREAMS)[0].message).toMatch(/names no stream of docs\/team\/streams\.json/);
  });

  it('a built Status needs its pull request in the develop history', () => {
    const merged = new Set([77]);
    expect(checkNext(doc(section('1', 'built (#77)')), STREAMS, merged)).toEqual([]);
    expect(checkNext(doc(section('1', 'built (#77, #78)')), STREAMS, merged)[0].message).toMatch(/no commit on develop names #78/);
    expect(checkNext(doc(section('1', 'built (#78)')), STREAMS)).toEqual([]);
  });

  it('a new numbered section fails, and a slug section passes', () => {
    expect(checkNext(doc(section('22', 'open')), STREAMS)).toEqual([]);
    expect(checkNext(doc(section('23', 'open')), STREAMS)[0].message).toMatch(/frozen list.*slug id/);
    expect(checkNext(doc(section('night-ruins', 'open')), STREAMS)).toEqual([]);
    expect(checkNext(doc(section('Night_Ruins', 'open')), STREAMS)[0].message).toMatch(/not a slug id/);
  });

  it('two sections with one id fail and the message says what to do', () => {
    const issues = checkNext(doc(section('5', 'open'), section('5', 'open')), STREAMS);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/two sections take the id 5.*slug id.*git grep -n "NEXT 5"/);
  });

  it("the repository's own NEXT.md passes", () => {
    const text = readFileSync(join(REPO_ROOT, 'docs/team/NEXT.md'), 'utf8');
    const streams = (JSON.parse(readFileSync(join(REPO_ROOT, 'docs/team/streams.json'), 'utf8')) as { streams: { id: string }[] }).streams.map((s) => s.id);
    expect(nextSections(text)).toHaveLength(22);
    expect(checkNext(text, streams)).toEqual([]);
  });
});
