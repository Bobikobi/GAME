# @game/mcp

The creator MCP server: what an AI tool on a creator's machine may ask the
project. Read-only, against the checkout it runs in and the published hub-data
document; no token, no GitHub, no writes.

- `src/tools.ts` - the nine tools with their input and output schemas and the
  `meta` every answer carries. The TypeScript types come from the same source.
- `src/server.ts` - the stdio server, `pnpm mcp`. It answers `tools/list` and
  `tools/call` with the TypeBox schemas as they are (they are JSON schema), and
  checks every input and every answer against them.
- `src/answers/` - one file per tool. `value` works on a temporary copy of
  `content/` and removes it; nothing writes into the checkout.
- `test/tools.test.ts` - the contract: at most nine tools, closed inputs, every
  output carries `meta`, the package major equals `FORMAT_VERSION`.
- `test/server.test.ts` - the server through an in-memory transport.

A clone registers it through `.mcp.json` (Claude Code) and `.cursor/mcp.json`
(Cursor); other tools: `docs/creators/README.md`, "Your AI tool and the
project". The decision and the line it never crosses: `DECISIONS.md`,
2026-10-07, "The creator MCP is read-only and runs on the creator's machine".
The plan: `docs/team/PLATFORM.md`, section 4.
