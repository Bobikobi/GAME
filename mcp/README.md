# @game/mcp

Tool definitions of the creator MCP server: what an AI tool on a creator's
machine may ask the project. Read-only, against the checkout it runs in and the
published hub-data document; no token, no GitHub, no writes.

- `src/tools.ts` - the nine tools with their input and output schemas and the
  `meta` every answer carries. The TypeScript types come from the same source.
- `test/tools.test.ts` - the contract: at most nine tools, closed inputs, every
  output carries `meta`, the package major equals `FORMAT_VERSION`.

The server that serves these definitions (stdio, registered through the
repository's `.mcp.json`) is built from `docs/team/GRUNT.md`. The decision and
the line it never crosses: `DECISIONS.md`, 2026-10-07, "The creator MCP is
read-only and runs on the creator's machine". The plan: `docs/team/PLATFORM.md`,
section 4.
