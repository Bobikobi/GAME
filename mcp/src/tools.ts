/**
 * The creator MCP surface (docs/team/PLATFORM.md, section 4): what an AI tool
 * on a creator's machine may ask the project. Definitions only; the server
 * that serves them lands with docs/team/GRUNT.md.
 *
 * Three rules every tool keeps:
 * - Read-only. A tool reads the checkout it runs in and the published hub-data
 *   document. It never writes a file, never talks to GitHub, never needs a
 *   token. The creator's own agent writes files; the creator opens the pull
 *   request.
 * - Every answer carries `meta`: the content format, the MCP version and the
 *   content tag it was computed from, so an answer can be matched to a schema.
 * - The major version of this package equals the content format version
 *   (mcp/test/tools.test.ts asserts it): a format change is an MCP change.
 */
import { Type, type Static, type TSchema } from '@sinclair/typebox';
import { CREATOR_TYPES, FORMAT_VERSION, Id, SlotKind } from '@game/schema';
import { HubParameters, HubProposal, HubRequest, HubSlot, RECORD_TYPES, RequestKind } from '@game/schema/hub';

/** Bump the major together with FORMAT_VERSION; minor for a new tool or field; patch for a fix. */
export const MCP_VERSION = '1.0.0';

// ---------------------------------------------------------------- shared parts

const Iso = Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,3})?Z$' });
const RepoPath = Type.String({ pattern: '^[A-Za-z0-9_./-]+$', maxLength: 240, description: 'A path relative to the repository root.' });
const Handle = Type.String({ pattern: '^[a-z0-9_-]+$', maxLength: 39, description: 'Your GitHub handle, lowercase: the name of your folder under content/extensions/.' });
const Count = Type.Integer({ minimum: 0 });

export const Meta = Type.Object(
  {
    format: Type.Literal(FORMAT_VERSION, { description: 'The content format the answer speaks.' }),
    mcp: Type.String({ pattern: '^\\d+\\.\\d+\\.\\d+$' }),
    content_tag: Type.String({ minLength: 1, maxLength: 80, description: 'The content bundle the answer was computed from.' }),
    root: Type.String({ minLength: 1, description: 'The checkout the server runs in.' }),
  },
  { additionalProperties: false, description: 'Carried by every answer.' },
);

export const Issue = Type.Object(
  {
    file: RepoPath,
    where: Type.String({ description: 'JSON pointer inside the file, empty for the whole file.' }),
    message: Type.String({ minLength: 1 }),
    level: Type.Union([Type.Literal('error'), Type.Literal('warning')]),
  },
  { additionalProperties: false, description: 'One line of `pnpm check`.' },
);

const DocumentType = Type.Union([...RECORD_TYPES.map((t) => Type.Literal(t)), Type.Literal('hub-data')]);
const CreatorType = Type.Union(CREATOR_TYPES.map((t) => Type.Literal(t)));

export interface ToolDef<I extends TSchema, O extends TSchema> {
  /** snake_case, the name the MCP client shows. */
  name: string;
  /** One sentence, under 160 characters: it rides in the prompt of every request. */
  description: string;
  input: I;
  output: O;
  /** What the tool reads. There is no `writes`: nothing here writes. */
  reads: readonly ('checkout' | 'hub-data')[];
}

const tool = <I extends TSchema, O extends TSchema>(def: ToolDef<I, O>) => def;

// ---------------------------------------------------------------- the tools

export const SchemaTool = tool({
  name: 'schema',
  description: 'The JSON schema of one content type, or the list of types when no type is given.',
  reads: ['checkout'],
  input: Type.Object({ type: Type.Optional(DocumentType) }, { additionalProperties: false }),
  output: Type.Object(
    {
      meta: Meta,
      types: Type.Array(Type.String(), { description: 'Creator types first, then core-only types, then documents.' }),
      schema: Type.Optional(Type.Unknown({ description: 'The JSON schema of the requested type.' })),
      url: Type.Optional(Type.String({ description: 'Where the same schema is published.' })),
    },
    { additionalProperties: false },
  ),
});

export const CheckTool = tool({
  name: 'check',
  description: 'Run the content check (the same one CI runs) on the checkout, or on the given files only.',
  reads: ['checkout'],
  input: Type.Object({ paths: Type.Optional(Type.Array(RepoPath, { maxItems: 50 })) }, { additionalProperties: false }),
  output: Type.Object(
    { meta: Meta, ok: Type.Boolean(), files: Count, issues: Type.Array(Issue) },
    { additionalProperties: false },
  ),
});

export const SlotsTool = tool({
  name: 'slots',
  description: 'The ruins map: every slot of the world, filled or waiting for a creator.',
  reads: ['checkout'],
  input: Type.Object(
    { kind: Type.Optional(SlotKind), free: Type.Optional(Type.Boolean({ description: 'true: only slots that await a creator.' })) },
    { additionalProperties: false },
  ),
  output: Type.Object({ meta: Meta, slots: Type.Array(HubSlot) }, { additionalProperties: false }),
});

export const RequestsTool = tool({
  name: 'requests',
  description: 'What players asked for: requests with their support, open calls and capability calls.',
  reads: ['hub-data'],
  input: Type.Object(
    {
      open_call: Type.Optional(Type.Boolean()),
      kind: Type.Optional(RequestKind),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
    },
    { additionalProperties: false },
  ),
  output: Type.Object(
    {
      meta: Meta,
      fetched_at: Type.Union([Iso, Type.Null()], { description: 'null when the hub-data document was built without GitHub.' }),
      requests: Type.Array(HubRequest),
    },
    { additionalProperties: false },
  ),
});

export const TemplateTool = tool({
  name: 'template',
  description: 'A starting file for one record type, filled with your handle and name. Returned, not written.',
  reads: ['checkout'],
  input: Type.Object(
    {
      type: CreatorType,
      handle: Handle,
      name: Type.String({ pattern: '^[a-z0-9_-]+$', maxLength: 40, description: 'The second half of the id "handle/name".' }),
    },
    { additionalProperties: false },
  ),
  output: Type.Object(
    {
      meta: Meta,
      files: Type.Array(Type.Object({ path: RepoPath, content: Type.String() }, { additionalProperties: false })),
      next: Type.String({ description: 'What to run after writing the files.' }),
    },
    { additionalProperties: false },
  ),
});

export const ValueTool = tool({
  name: 'value',
  description: 'The value the kernel computes for draft records, against the anchored values and the drift budget.',
  reads: ['checkout'],
  input: Type.Object(
    {
      drafts: Type.Array(
        Type.Object({ path: RepoPath, data: Type.Unknown({ description: 'The parsed content of the draft file.' }) }, { additionalProperties: false }),
        { minItems: 1, maxItems: 50 },
      ),
    },
    { additionalProperties: false },
  ),
  output: Type.Object(
    {
      meta: Meta,
      issues: Type.Array(Issue),
      values: Type.Record(
        Id,
        Type.Object(
          {
            value: Count,
            anchor: Type.Union([Count, Type.Null()], { description: 'The committed value, null for a new item.' }),
            drift_permille: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
            within_budget: Type.Boolean(),
          },
          { additionalProperties: false },
        ),
      ),
    },
    { additionalProperties: false },
  ),
});

export const PreviewTool = tool({
  name: 'preview',
  description: 'The state of one proposal: its preview link, merge-rule checklist, approvals and competitors.',
  reads: ['hub-data'],
  input: Type.Object({ pr: Type.Integer({ minimum: 1 }) }, { additionalProperties: false }),
  output: Type.Object({ meta: Meta, proposal: Type.Union([HubProposal, Type.Null()]) }, { additionalProperties: false }),
});

export const GuideTool = tool({
  name: 'guide',
  description: 'The creator guide as markdown, with its section list.',
  reads: ['checkout'],
  input: Type.Object({}, { additionalProperties: false }),
  output: Type.Object(
    {
      meta: Meta,
      markdown: Type.String(),
      sections: Type.Array(Type.Object({ title: Type.String(), anchor: Type.String() }, { additionalProperties: false })),
    },
    { additionalProperties: false },
  ),
});

export const RulesTool = tool({
  name: 'rules',
  description: 'The numbers the loop and the boards run on, the licence, and the lines the project never crosses.',
  reads: ['checkout'],
  input: Type.Object({}, { additionalProperties: false }),
  output: Type.Object(
    {
      meta: Meta,
      loop: HubParameters.properties.loop,
      points: HubParameters.properties.points,
      licence: Type.String(),
      lines: Type.Array(Type.String(), { description: 'One sentence each.' }),
    },
    { additionalProperties: false },
  ),
});

export const TOOLS = {
  schema: SchemaTool,
  check: CheckTool,
  slots: SlotsTool,
  requests: RequestsTool,
  template: TemplateTool,
  value: ValueTool,
  preview: PreviewTool,
  guide: GuideTool,
  rules: RulesTool,
} as const;

export type ToolName = keyof typeof TOOLS;
export type ToolInput<N extends ToolName> = Static<(typeof TOOLS)[N]['input']>;
export type ToolOutput<N extends ToolName> = Static<(typeof TOOLS)[N]['output']>;
export type Meta = Static<typeof Meta>;
export type Issue = Static<typeof Issue>;

/** The list a server registers, in the order a creator meets them. */
export const TOOL_LIST: readonly ToolDef<TSchema, TSchema>[] = Object.values(TOOLS);
