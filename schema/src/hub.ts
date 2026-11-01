/**
 * The hub-data document: the one JSON file behind the developer hub, the
 * boards and the `/api/` surface (docs/team/PLATFORM.md, section 3).
 *
 * Stage 1 builds it from sources that already exist: the git history (the
 * creators board), the content files (extensions, kits, slots, parameters),
 * GitHub (requests, proposals, votes, the weekly summary) and Vercel (preview
 * links). Stage 2a serves the same shape from the server and fills `players`
 * and `usage`. The site reads this document and nothing else, so the move to
 * the server changes one URL and no page.
 *
 * Rules the document keeps:
 * - Every number is computed by a tool from a source named in `sources`, and
 *   the parameters it was computed with are in `parameters`. Nothing is
 *   declared by hand.
 * - Nothing personal: GitHub handles that people publish by opening an issue
 *   or a pull request, and the name a player typed into the game. Vote counts
 *   never appear, only the display the loop already publishes.
 * - A section whose source is missing is empty or null, never guessed.
 */
import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import {
  CORE_ONLY_TYPES,
  CREATOR_TYPES,
  FORMAT_VERSION,
  Id,
  SIGNATURE_GLYPHS,
  SIGNATURE_STYLES,
  SlotKind,
  type SchemaIssue,
} from './index';
import { S1_SCHEMAS } from './s1';

/** Bumped when a document written for the old format would be read differently. */
export const HUB_FORMAT = 1;

// ---------------------------------------------------------------- shared parts

const Iso = Type.String({
  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,3})?Z$',
  description: 'UTC time, ISO 8601, for example 2026-10-07T15:00:00Z.',
});
const Handle = Type.String({ pattern: '^[a-z0-9_-]+$', maxLength: 39, description: 'GitHub handle, lowercase. "core" is the core team.' });
const Url = Type.String({ pattern: '^https://', maxLength: 400 });
const Count = Type.Integer({ minimum: 0 });
const GitHubNumber = Type.Integer({ minimum: 1, description: 'GitHub issue or pull request number.' });
const Title = Type.String({ minLength: 1, maxLength: 200 });
const Text = Type.String({ minLength: 1, maxLength: 240 });
const RepoPath = Type.String({ pattern: '^[A-Za-z0-9_./-]+$', maxLength: 240, description: 'A path relative to the repository root.' });

export const RECORD_TYPES = [...CREATOR_TYPES, ...CORE_ONLY_TYPES] as const;
const RecordType = Type.Union(RECORD_TYPES.map((t) => Type.Literal(t)));

export const MERGE_STATES = ['pass', 'pending', 'fail'] as const;
export const MergeState = Type.Union(MERGE_STATES.map((s) => Type.Literal(s)), {
  description: 'The loop\'s merge-rule status: "pass" (ready), "pending" (checks or approvals still due) or "fail" (a blocker).',
});

export const PROPOSAL_STATES = ['open', 'merged', 'closed'] as const;
export const ProposalState = Type.Union(PROPOSAL_STATES.map((s) => Type.Literal(s)));

export const REQUEST_KINDS = ['resource', 'recipe', 'treasure', 'character', 'place', 'other'] as const;
export const RequestKind = Type.Union(REQUEST_KINDS.map((k) => Type.Literal(k)), {
  description: 'The kind picked in the request form, mapped to one word.',
});

export const VOTE_KINDS = ['proposal', 'discovery'] as const;
export const VOTE_STATES = ['open', 'decided', 'postponed'] as const;

// ---------------------------------------------------------------- sections

export const HubSource = Type.Object(
  {
    repository: Type.String({ pattern: '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$', description: '"owner/name" on GitHub.' }),
    ref: Type.String({ minLength: 1, maxLength: 120, description: 'The branch or tag the document was built from.' }),
    sha: Type.String({ pattern: '^[0-9a-f]{7,40}$' }),
    content_tag: Type.String({ minLength: 1, maxLength: 80, description: 'The tag of the content bundle (kernel rule R5).' }),
    kernel_version: Type.String({ pattern: '^\\d+\\.\\d+\\.\\d+$', description: 'The version of @game/kernel.' }),
    schema_format: Type.Literal(FORMAT_VERSION, { description: 'The format of the content files this was built from.' }),
  },
  { additionalProperties: false, description: 'What the document was built from. The three things that move separately: code, content, site.' },
);

const Fetched = Type.Object({ fetched_at: Iso }, { additionalProperties: false });

export const HubSources = Type.Object(
  {
    git: Type.Object({ commits: Count, newest_at: Iso }, { additionalProperties: false, description: 'The history the creators board was computed from.' }),
    github: Type.Union([Fetched, Type.Null()], {
      description: 'null when the document was built without GitHub access; requests, proposals, votes, reviewers and the summary are then empty.',
    }),
    vercel: Type.Union([Fetched, Type.Null()], { description: 'null when preview links could not be read; proposals then carry no preview.' }),
    usage: Type.Union(
      [Type.Object({ fetched_at: Iso, window_days: Type.Integer({ minimum: 1, maximum: 90 }) }, { additionalProperties: false }), Type.Null()],
      { description: 'null until the stage-1 service (spec S-1) exists.' },
    ),
    accounts: Type.Optional(
      Type.Union([Fetched, Type.Null()], {
        description: "null when the game server's counter could not be read (not named, unreachable, an error or too slow); accounts is then null. Absent in documents built before the counter.",
      }),
    ),
  },
  { additionalProperties: false, description: 'Provenance. A section with a null source is empty, never guessed.' },
);

export const HubCreator = Type.Object(
  {
    handle: Handle,
    name: Type.String({ minLength: 1, maxLength: 40, description: 'From the creator profile, or the handle when there is none.' }),
    role: Type.Optional(Type.String({ minLength: 1, maxLength: 40 })),
    signature: Type.Optional(
      Type.Object(
        {
          text: Type.String({ minLength: 1, maxLength: 24 }),
          style: Type.Union(SIGNATURE_STYLES.map((k) => Type.Literal(k))),
          glyph: Type.Optional(Type.Union(SIGNATURE_GLYPHS.map((k) => Type.Literal(k)))),
        },
        { additionalProperties: false },
      ),
    ),
    points: Count,
    records: Count,
    commits: Count,
    extensions: Type.Array(Id, { description: 'Ids of the records the creator has in the game now.' }),
    url: Url,
  },
  {
    additionalProperties: false,
    description:
      'One row of the creators board (spec C-1): points = per_record * records + per_commit * commits, from the git history. Hours are not published (DECISIONS.md, 2026-10-07).',
  },
);

export const HubReviewer = Type.Object(
  {
    handle: Handle,
    approvals: Count,
    points: Count,
    url: Url,
  },
  {
    additionalProperties: false,
    description: 'One row of the reviewers board (spec C-1): approvals that counted on merged proposals, from GitHub; points = per_approval * approvals.',
  },
);

export const HubExtension = Type.Object(
  {
    id: Id,
    type: RecordType,
    title: Type.String({ minLength: 1, maxLength: 40 }),
    creator: Handle,
    file: RepoPath,
    url: Url,
    slot: Type.Optional(Id),
    ai_tools: Type.Array(Type.String({ minLength: 1, maxLength: 60 })),
    merged_at: Type.Optional(Iso),
  },
  { additionalProperties: false, description: 'One accepted record: content that is in the game now.' },
);

export const HubKit = Type.Object(
  {
    id: Id,
    title: Type.String({ minLength: 1, maxLength: 40 }),
    creator: Handle,
    sprites: Count,
    url: Url,
  },
  { additionalProperties: false },
);

export const HubSlot = Type.Object(
  {
    id: Id,
    kind: SlotKind,
    label: Type.Optional(Type.String({ minLength: 1, maxLength: 40 })),
    x: Type.Integer({ minimum: 0, maximum: 1023 }),
    y: Type.Integer({ minimum: 0, maximum: 1023 }),
    w: Type.Integer({ minimum: 1, maximum: 64 }),
    h: Type.Integer({ minimum: 1, maximum: 64 }),
    filled_by: Type.Union([Id, Type.Null()], { description: 'The record in this slot, or null when it awaits a creator.' }),
  },
  { additionalProperties: false, description: 'One slot of the ruins map (spec L-2).' },
);

export const HubRequest = Type.Object(
  {
    number: GitHubNumber,
    title: Title,
    url: Url,
    author: Handle,
    kind: RequestKind,
    support: Count,
    open_call: Type.Boolean({ description: 'Support reached parameters.loop.open_call_votes. Never goes back to false.' }),
    capability: Type.Boolean({ description: 'An open call that needs core code, not content alone.' }),
    created_at: Iso,
    proposals: Type.Array(GitHubNumber, { description: 'Pull requests that answer this request.' }),
  },
  { additionalProperties: false },
);

export const HubProposal = Type.Object(
  {
    number: GitHubNumber,
    title: Title,
    url: Url,
    author: Handle,
    state: ProposalState,
    slots: Type.Array(Id),
    answers: Type.Optional(GitHubNumber),
    merge_rule: MergeState,
    checks: Type.Array(
      Type.Object({ rule: Text, state: MergeState, detail: Type.Optional(Text) }, { additionalProperties: false }),
      { description: 'The checklist the loop keeps on the pull request, one line per rule.' },
    ),
    approvals: Count,
    reviewers: Type.Array(Handle, { description: 'Whose approvals counted on the current head.' }),
    competing: Type.Array(GitHubNumber),
    vote: Type.Optional(GitHubNumber),
    preview: Type.Optional(Url),
    created_at: Iso,
    updated_at: Iso,
    merged_at: Type.Optional(Iso),
  },
  { additionalProperties: false, description: 'One content proposal. The preview is the trial world of this proposal: the game at /play/ of its deployment.' },
);

export const HubVote = Type.Object(
  {
    number: GitHubNumber,
    title: Title,
    url: Url,
    kind: Type.Union(VOTE_KINDS.map((k) => Type.Literal(k))),
    state: Type.Union(VOTE_STATES.map((k) => Type.Literal(k))),
    opened_at: Iso,
    closes_at: Iso,
    options: Type.Array(
      Type.Object(
        {
          key: Type.String({ minLength: 1, maxLength: 80 }),
          title: Title,
          url: Type.Optional(Url),
          bar: Type.Integer({ minimum: 0, maximum: 100, description: 'Relative to the leading option, 0-100. Never a count.' }),
          percent: Type.Union([Type.Integer({ minimum: 0, maximum: 100 }), Type.Null()], {
            description: 'Exact share once min_votes_for_percent is reached, null before.',
          }),
        },
        { additionalProperties: false },
      ),
      { minItems: 1 },
    ),
    winner: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
  },
  { additionalProperties: false, description: 'A vote is cast on GitHub. The hub shows it and never counts voters.' },
);

export const HubSummary = Type.Object(
  {
    week: Type.String({ pattern: '^\\d{4}-W\\d{2}$' }),
    number: GitHubNumber,
    url: Url,
    posted_at: Iso,
  },
  { additionalProperties: false, description: 'The current weekly summary issue.' },
);

const Bounded = Type.Object(
  { value: Type.Integer(), min: Type.Integer(), max: Type.Integer(), step: Type.Integer({ minimum: 0 }) },
  { additionalProperties: false },
);

export const HubParameters = Type.Object(
  {
    loop: Type.Object(
      {
        open_call_votes: Count,
        approvals_to_merge: Count,
        required_checks: Type.Array(Type.String({ minLength: 1 })),
        approvals_must_match_head: Type.Boolean(),
        quota: Type.Object({ new_creator: Count, per_accepted: Count, cap: Count }, { additionalProperties: false }),
        vote_days: Count,
        min_votes_to_decide: Count,
        min_votes_for_percent: Count,
        min_account_age_days: Count,
      },
      { additionalProperties: false, description: 'A copy of .github/loop.json.' },
    ),
    points: Type.Object(
      {
        per_record: Count,
        per_commit: Count,
        per_approval: Count,
        weekly_pool: Count,
        weekly_pool_active: Type.Boolean({ description: 'false: this points pool is an inactive placeholder; the creators\' pool is gold already spent (DECISIONS 2026-10-09).' }),
      },
      { additionalProperties: false, description: 'A copy of .github/points.json: every number a ranking is computed with.' },
    ),
    game: Type.Record(Type.String({ pattern: '^[a-z0-9_]+(\\.[a-z0-9_]+)*$' }), Bounded, {
      description: 'Every bounded number of content/core/params.json, flattened ("effort_permille.easy", "power_cap_permille.0").',
    }),
    values: Type.Record(Id, Type.Integer({ minimum: 0 }), { description: 'content/values.lock.json: the anchored value of every item (rule R11).' }),
  },
  { additionalProperties: false },
);

const Rank = Type.Integer({ minimum: 1 });
const PlayerName = Type.String({ minLength: 1, maxLength: 16, description: 'The name the player chose in the game, never an account id.' });

export const HubPlayers = Type.Object(
  {
    verified_at: Iso,
    wealth: Type.Array(Type.Object({ rank: Rank, player: PlayerName, gold_mg: Count }, { additionalProperties: false })),
    collection: Type.Array(Type.Object({ rank: Rank, player: PlayerName, entries: Count }, { additionalProperties: false })),
    professions: Type.Array(
      Type.Object({ rank: Rank, player: PlayerName, profession: Id, level: Type.Integer({ minimum: 1, maximum: 20 }) }, { additionalProperties: false }),
    ),
  },
  { additionalProperties: false, description: 'Verified player boards (spec A-3), computed by the server only. null until stage 2a.' },
);

export const HubAccounts = Type.Object(
  {
    open: Count,
    new_7d: Count,
  },
  {
    additionalProperties: false,
    description:
      "The players counter (DECISIONS.md, 2026-10-31): open accounts on the game server, and how many of them were opened in the last 7 days, as its GET /stats counts them. Two counts and nothing about any account.",
  },
);

export const HubUsage = Type.Object(
  {
    since: Iso,
    until: Iso,
    extensions: Type.Record(Id, Type.Object({ visits: Count, pickups: Count, reports: Count }, { additionalProperties: false }), {
      description: 'Per accepted record (spec C-2), from the stage-1 service.',
    }),
    stops: Type.Array(Type.Object({ step: Type.String({ minLength: 1, maxLength: 80 }), players: Count }, { additionalProperties: false }), {
      description: 'Where players stop: the last opening step reached, counted per step.',
    }),
  },
  { additionalProperties: false },
);

// ---------------------------------------------------------------- the document

export const HubData = Type.Object(
  {
    $schema: Type.Optional(Type.String()),
    format: Type.Literal(HUB_FORMAT, { description: 'Format version of this document.' }),
    built_at: Iso,
    source: HubSource,
    sources: HubSources,
    creators: Type.Array(HubCreator),
    reviewers: Type.Array(HubReviewer),
    extensions: Type.Array(HubExtension),
    kits: Type.Array(HubKit),
    slots: Type.Array(HubSlot),
    requests: Type.Array(HubRequest),
    proposals: Type.Array(HubProposal),
    votes: Type.Array(HubVote),
    summary: Type.Union([HubSummary, Type.Null()]),
    parameters: HubParameters,
    players: Type.Union([HubPlayers, Type.Null()]),
    accounts: Type.Optional(Type.Union([HubAccounts, Type.Null()], { description: 'null when the count is unknown, never a guessed 0.' })),
    usage: Type.Union([HubUsage, Type.Null()]),
  },
  { additionalProperties: false },
);

export type HubData = Static<typeof HubData>;
export type HubSource = Static<typeof HubSource>;
export type HubSources = Static<typeof HubSources>;
export type HubCreator = Static<typeof HubCreator>;
export type HubReviewer = Static<typeof HubReviewer>;
export type HubExtension = Static<typeof HubExtension>;
export type HubKit = Static<typeof HubKit>;
export type HubSlot = Static<typeof HubSlot>;
export type HubRequest = Static<typeof HubRequest>;
export type HubProposal = Static<typeof HubProposal>;
export type HubVote = Static<typeof HubVote>;
export type HubSummary = Static<typeof HubSummary>;
export type HubParameters = Static<typeof HubParameters>;
export type HubPlayers = Static<typeof HubPlayers>;
export type HubAccounts = Static<typeof HubAccounts>;
export type HubUsage = Static<typeof HubUsage>;
export type MergeStateName = (typeof MERGE_STATES)[number];
export type ProposalStateName = (typeof PROPOSAL_STATES)[number];
export type RequestKindName = (typeof REQUEST_KINDS)[number];

/** Documents that are not extension files but are published with the same discipline (emitted to schema/json/, validated before they are served). */
export const DOCUMENT_SCHEMAS = {
  'hub-data': HubData,
  ...S1_SCHEMAS,
} as const;

/**
 * The rules a well-formed document must also keep: every published number is
 * computed from the parameters it carries, and a section whose source is
 * missing is empty. The schema cannot say these; this function does.
 */
export function hubInvariants(doc: HubData): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  const p = doc.parameters.points;
  doc.creators.forEach((c, i) => {
    const expected = p.per_record * c.records + p.per_commit * c.commits;
    if (c.points !== expected) {
      issues.push({ path: `/creators/${i}/points`, message: `must be per_record * records + per_commit * commits = ${expected}` });
    }
  });
  doc.reviewers.forEach((r, i) => {
    const expected = p.per_approval * r.approvals;
    if (r.points !== expected) issues.push({ path: `/reviewers/${i}/points`, message: `must be per_approval * approvals = ${expected}` });
  });
  const creators = new Set(doc.creators.map((c) => c.handle));
  doc.extensions.forEach((e, i) => {
    if (!creators.has(e.creator)) issues.push({ path: `/extensions/${i}/creator`, message: `"${e.creator}" has records but no row on the creators board` });
  });
  const extensions = new Set(doc.extensions.map((e) => e.id));
  doc.slots.forEach((s, i) => {
    if (s.filled_by !== null && !extensions.has(s.filled_by)) {
      issues.push({ path: `/slots/${i}/filled_by`, message: `"${s.filled_by}" is not an accepted record` });
    }
  });
  const openCall = doc.parameters.loop.open_call_votes;
  doc.requests.forEach((r, i) => {
    if (r.support >= openCall && !r.open_call) issues.push({ path: `/requests/${i}/open_call`, message: `support reached ${openCall}, so this is an open call` });
    if (r.capability && !r.open_call) issues.push({ path: `/requests/${i}/capability`, message: 'only an open call can be a capability' });
  });
  doc.votes.forEach((v, i) => {
    if (v.state !== 'postponed' && !v.options.some((o) => o.bar === 100)) {
      issues.push({ path: `/votes/${i}/options`, message: 'the leading option has bar 100' });
    }
  });
  if (doc.sources.github === null) {
    const empty = doc.requests.length === 0 && doc.proposals.length === 0 && doc.votes.length === 0 && doc.reviewers.length === 0 && doc.summary === null;
    if (!empty) issues.push({ path: '/sources/github', message: 'built without GitHub: requests, proposals, votes, reviewers and summary must be empty' });
  }
  if (doc.sources.vercel === null && doc.proposals.some((pr) => pr.preview !== undefined)) {
    issues.push({ path: '/sources/vercel', message: 'built without Vercel: no proposal may carry a preview' });
  }
  if (doc.sources.usage === null && doc.usage !== null) issues.push({ path: '/usage', message: 'no usage source, so usage must be null' });
  if ((doc.sources.accounts ?? null) === null && (doc.accounts ?? null) !== null) issues.push({ path: '/accounts', message: 'no accounts source, so accounts must be null' });
  if (doc.accounts && doc.accounts.new_7d > doc.accounts.open) issues.push({ path: '/accounts/new_7d', message: 'cannot be more than open' });
  if (doc.players !== null && doc.players.verified_at > doc.built_at) {
    issues.push({ path: '/players/verified_at', message: 'cannot be later than built_at' });
  }
  return issues;
}

/** Validate a parsed hub-data document: the schema first, then the invariants. Same report shape as validateFile. */
export function validateHubData(data: unknown): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  const seen = new Set<string>();
  for (const error of Value.Errors(HubData, data)) {
    const key = `${error.path}|${error.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push({ path: error.path, message: error.message });
    if (issues.length >= 20) break;
  }
  if (issues.length > 0) return issues;
  return hubInvariants(data as HubData);
}
