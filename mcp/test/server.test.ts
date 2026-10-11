/**
 * The stdio server (docs/team/GRUNT.md, item 15), driven through an in-memory transport pair: the same requests an AI
 * tool sends, answered from this checkout.
 */
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Value } from '@sinclair/typebox/value';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { slug } from '../src/answers/guide';
import { createServer } from '../src/server';
import { TOOLS, TOOL_LIST } from '../src/tools';

const client = new Client({ name: 'test', version: '1.0.0' });

beforeAll(async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer().connect(a);
  await client.connect(b);
});
afterAll(async () => {
  await client.close();
});

const call = async (name: string, args: Record<string, unknown> = {}) => {
  const r = await client.callTool({ name, arguments: args });
  return { error: r.isError === true, text: (r.content as { text: string }[])[0]?.text ?? '', result: r.structuredContent as Record<string, unknown> };
};

const leftovers = (): string[] => readdirSync(tmpdir()).filter((f) => f.startsWith('openfold-value-'));

describe('the MCP server', () => {
  it('lists the nine tools in the order of TOOL_LIST, read-only', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(TOOL_LIST.map((t) => t.name));
    expect(tools).toHaveLength(9);
    for (const t of tools) expect(t.annotations?.readOnlyHint, t.name).toBe(true);
  });

  it('answers rules and schema in their output schemas', async () => {
    const rules = await call('rules');
    expect(rules.error, rules.text).toBe(false);
    expect(Value.Check(TOOLS.rules.output, rules.result)).toBe(true);
    expect(rules.result['lines']).toHaveLength(4);
    const schema = await call('schema', { type: 'resource' });
    expect(schema.error, schema.text).toBe(false);
    expect(Value.Check(TOOLS.schema.output, schema.result)).toBe(true);
    expect((schema.result['schema'] as { $id: string }).$id).toMatch(/resource/);
  });

  it('checks the checkout as CI does: ok', async () => {
    const r = await call('check');
    expect(r.error, r.text).toBe(false);
    expect(r.result['ok']).toBe(true);
    expect(r.result['files']).toBeGreaterThan(0);
  });

  it('refuses an input that does not fit, and an unknown tool', async () => {
    expect((await call('schema', { type: 'nothing' })).error).toBe(true);
    expect((await call('scaffold')).error).toBe(true);
  });

  it('fills a template with the handle and the name', async () => {
    const r = await call('template', { type: 'resource', handle: 'tester', name: 'sloes' });
    expect(r.error, r.text).toBe(false);
    const files = r.result['files'] as { path: string; content: string }[];
    expect(files.map((f) => f.path)).toEqual(['content/extensions/tester/resources/sloes.json']);
    expect(files[0]!.content).toContain('"id": "tester/sloes"');
    expect(files[0]!.content).not.toContain('your-handle');
  });

  it('values a draft: a yield too high is an issue, and no temporary folder is left behind', async () => {
    const before = leftovers().length;
    const file = (await call('template', { type: 'resource', handle: 'tester', name: 'sloes' })).result['files'] as { path: string; content: string }[];
    const data = JSON.parse(file[0]!.content) as { node: { yield: number } };
    data.node.yield = 1000;
    const r = await call('value', { drafts: [{ path: file[0]!.path, data }] });
    expect(r.error, r.text).toBe(false);
    expect(Value.Check(TOOLS.value.output, r.result)).toBe(true);
    const issues = r.result['issues'] as { file: string; level: string }[];
    expect(issues.some((i) => i.level === 'error' && i.file === file[0]!.path), JSON.stringify(issues)).toBe(true);
    expect(leftovers().length).toBe(before);
  });

  it('refuses a draft outside content/', async () => {
    const r = await call('value', { drafts: [{ path: 'content/../package.json', data: {} }] });
    expect((r.result['issues'] as { message: string }[])[0]?.message).toMatch(/under content/);
  });

  it('the generated files are not checked as content', async () => {
    const file = (await call('template', { type: 'resource', handle: 'tester', name: 'sloes' })).result['files'] as { path: string; content: string }[];
    const r = await call('value', { drafts: [{ path: file[0]!.path, data: JSON.parse(file[0]!.content) }] });
    const files = (r.result['issues'] as { file: string }[]).map((i) => i.file);
    expect(files.filter((f) => /board\.json|values\.lock\.json/.test(f))).toEqual([]);
  });

  it('a path-scoped check names a file that does not exist', async () => {
    const r = await call('check', { paths: ['content/core/nope.json'] });
    expect(r.result['ok']).toBe(false);
  });

  it('answers the guide with the anchors the site gives its headings', async () => {
    const r = await call('guide');
    expect(r.error, r.text).toBe(false);
    const sections = r.result['sections'] as { title: string; anchor: string }[];
    expect(sections.length).toBeGreaterThan(5);
    expect(slug('1. Run the game on your machine (2 minutes)', new Map())).toBe('1-run-the-game-on-your-machine-2-minutes');
  });

  it('answers slots, requests and preview from a hub-data document, never a sample', async () => {
    const slots = await call('slots', { free: true });
    expect(slots.error, slots.text).toBe(false);
    expect(Value.Check(TOOLS.slots.output, slots.result)).toBe(true);
    const requests = await call('requests', {});
    expect(requests.error, requests.text).toBe(false);
    const preview = await call('preview', { pr: 1 });
    expect(preview.error, preview.text).toBe(false);
  });
});
