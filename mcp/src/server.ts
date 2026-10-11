/**
 * The creator MCP server (docs/team/GRUNT.md, item 15): the nine tools of TOOL_LIST over stdio, answered from the
 * checkout it runs in. It writes nothing, needs no token and never talks to GitHub (DECISIONS.md 2026-10-07, "The
 * creator MCP is read-only and runs on the creator's machine").
 *
 * The tool schemas are TypeBox, which is JSON schema already, so the server answers `tools/list` and `tools/call` on
 * the sdk's protocol layer with them as they are, rather than through `registerTool`, which wants zod. Every input is
 * checked against the tool's input schema and every answer against its output schema; an answer that does not fit
 * is an error with the issues, never a guess.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Value } from '@sinclair/typebox/value';
import { REPO_ROOT } from '@game/tools';
import { ANSWERS, type Context } from './answers';
import { packageVersion } from './meta';
import { TOOL_LIST, type ToolName } from './tools';

const issuesOf = (schema: Parameters<typeof Value.Errors>[0], value: unknown): string =>
  [...Value.Errors(schema, value)]
    .slice(0, 10)
    .map((e) => `${e.path || '/'} ${e.message}`)
    .join('; ');

const failure = (text: string): CallToolResult => ({ isError: true, content: [{ type: 'text', text }] });

/** A server for the checkout at `root`, not yet connected to a transport. */
export function createServer(root: string = REPO_ROOT): McpServer {
  const ctx: Context = { root };
  const server = new McpServer({ name: 'openfold', version: packageVersion() }, { capabilities: { tools: {} } });

  server.server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: TOOL_LIST.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.input as unknown as { type: 'object' },
      outputSchema: t.output as unknown as { type: 'object' },
      annotations: { readOnlyHint: true, openWorldHint: false },
    })),
  }));

  server.server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const def = TOOL_LIST.find((t) => t.name === request.params.name);
    if (!def) return failure(`no tool "${request.params.name}"; the tools are ${TOOL_LIST.map((t) => t.name).join(', ')}`);
    const input: unknown = request.params.arguments ?? {};
    if (!Value.Check(def.input, input)) return failure(`the input does not fit ${def.name}: ${issuesOf(def.input, input)}`);
    try {
      const answer = await ANSWERS[def.name as ToolName](ctx, input as never);
      if (!Value.Check(def.output, answer.result)) return failure(`the answer of ${def.name} does not fit its schema: ${issuesOf(def.output, answer.result)}`);
      const text = `${answer.note ? `${answer.note}\n` : ''}${JSON.stringify(answer.result)}`;
      return { content: [{ type: 'text', text }], structuredContent: answer.result as Record<string, unknown> };
    } catch (error) {
      return failure(`${def.name} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  return server;
}

// `pnpm mcp`: serve on stdin and stdout; anything else goes to stderr, so the protocol stream stays clean
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  console.log = (...args: unknown[]) => console.error(...args);
  await createServer().connect(new StdioServerTransport());
}
