/**
 * The MCP tool definitions are a contract: a creator's AI tool reads them from
 * the prompt of every request, so they stay few, small, read-only and tied to
 * the content format.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Value } from '@sinclair/typebox/value';
import { describe, expect, it } from 'vitest';
import { FORMAT_VERSION } from '@game/schema';
import type { HubData } from '@game/schema/hub';
import { MCP_VERSION, TOOLS, TOOL_LIST, type ToolOutput } from '../src/tools';

const here = dirname(fileURLToPath(import.meta.url));
const hub = JSON.parse(readFileSync(join(here, '..', '..', 'schema', 'test', 'fixtures', 'hub-data.json'), 'utf8')) as HubData;
const meta = { format: FORMAT_VERSION, mcp: MCP_VERSION, content_tag: hub.source.content_tag, root: '/home/creator/GAME' } as const;

describe('mcp tools', () => {
  it('version follows the content format', () => {
    const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as { version: string };
    expect(pkg.version).toBe(MCP_VERSION);
    expect(Number(MCP_VERSION.split('.')[0])).toBe(FORMAT_VERSION);
  });

  it('stays few and small: the definitions ride in every prompt', () => {
    expect(TOOL_LIST.length).toBeLessThanOrEqual(9);
    const names = TOOL_LIST.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of TOOL_LIST) {
      expect(t.name).toMatch(/^[a-z_]+$/);
      expect(t.description.length).toBeLessThanOrEqual(160);
      expect(t.description.endsWith('.')).toBe(true);
      expect(JSON.stringify(t.input).length).toBeLessThan(1500);
    }
  });

  it('is read-only by construction', () => {
    for (const t of TOOL_LIST) {
      expect(t.name).not.toMatch(/^(write|create|push|commit|open|delete|post|send|merge)/);
      expect('writes' in t).toBe(false);
      for (const source of t.reads) expect(['checkout', 'hub-data']).toContain(source);
    }
  });

  it('every input is a closed object and every output carries meta', () => {
    for (const t of TOOL_LIST) {
      const input = JSON.parse(JSON.stringify(t.input)) as { type: string; additionalProperties: boolean };
      expect(input.type).toBe('object');
      expect(input.additionalProperties).toBe(false);
      const output = JSON.parse(JSON.stringify(t.output)) as { required: string[] };
      expect(output.required).toContain('meta');
    }
  });

  it('accepts the inputs a creator sends', () => {
    expect(Value.Check(TOOLS.schema.input, {})).toBe(true);
    expect(Value.Check(TOOLS.schema.input, { type: 'resource' })).toBe(true);
    expect(Value.Check(TOOLS.schema.input, { type: 'hub-data' })).toBe(true);
    expect(Value.Check(TOOLS.schema.input, { type: 'dragon' })).toBe(false);
    expect(Value.Check(TOOLS.check.input, { paths: ['content/extensions/trout-maker/resources/river-trout.json'] })).toBe(true);
    expect(Value.Check(TOOLS.slots.input, { free: true, kind: 'ruin' })).toBe(true);
    expect(Value.Check(TOOLS.requests.input, { open_call: true, limit: 10 })).toBe(true);
    expect(Value.Check(TOOLS.template.input, { type: 'resource', handle: 'trout-maker', name: 'river-trout' })).toBe(true);
    expect(Value.Check(TOOLS.template.input, { type: 'params', handle: 'trout-maker', name: 'x' })).toBe(false);
    expect(Value.Check(TOOLS.value.input, { drafts: [] })).toBe(false);
    expect(Value.Check(TOOLS.preview.input, { pr: 18 })).toBe(true);
    expect(Value.Check(TOOLS.guide.input, {})).toBe(true);
    expect(Value.Check(TOOLS.rules.input, { extra: 1 })).toBe(false);
  });

  it('answers are built from the hub-data document and the check', () => {
    const preview: ToolOutput<'preview'> = { meta, proposal: hub.proposals[1] ?? null };
    expect(Value.Check(TOOLS.preview.output, preview)).toBe(true);
    const requests: ToolOutput<'requests'> = { meta, fetched_at: hub.sources.github?.fetched_at ?? null, requests: hub.requests };
    expect(Value.Check(TOOLS.requests.output, requests)).toBe(true);
    const slots: ToolOutput<'slots'> = { meta, slots: hub.slots.filter((s) => s.filled_by === null) };
    expect(Value.Check(TOOLS.slots.output, slots)).toBe(true);
    const rules: ToolOutput<'rules'> = {
      meta,
      loop: hub.parameters.loop,
      points: hub.parameters.points,
      licence: 'AGPL-3.0-only',
      lines: ['The MCP never writes to GitHub.'],
    };
    expect(Value.Check(TOOLS.rules.output, rules)).toBe(true);
    const check: ToolOutput<'check'> = {
      meta,
      ok: false,
      files: 41,
      issues: [{ file: 'content/extensions/trout-maker/resources/river-trout.json', where: '/node/yield', message: 'must be at most 20', level: 'error' }],
    };
    expect(Value.Check(TOOLS.check.output, check)).toBe(true);
    expect(Value.Check(TOOLS.check.output, { ...check, meta: { ...meta, format: 2 } })).toBe(false);
  });
});
