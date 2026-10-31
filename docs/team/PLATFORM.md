# The platform: site, hub, data, tools

The plan for everything around the game: the public site, the developer hub, the
one data document behind them, the creator tool surface, the design bridge, and
the structure that keeps it all running. Written 2026-10-07 on the branch
`docs/platform-plan`; every decision here has an entry in `DECISIONS.md` dated
the same day. The mechanical work it implies is listed in `docs/team/GRUNT.md`,
one item per goal, each with a proving command.

Sizes are by complexity and risk (S, M, L), never by hours.

## 0. The shape in one paragraph

One repository, one Vercel project, one build. `web/` is a static Astro site:
the home page, the developer hub, the docs and the `/api/` folder. The game
stays in `game/` and is copied into the site's output at `/play/`. Everything
the hub shows comes from one JSON document, `hub-data`, built by a tool from
sources that already exist (git history, content files, GitHub, Vercel) and
validated against a schema in `schema/`. Creators' AI tools talk to the project
through a read-only MCP package, `mcp/`, whose tools are typed against the same
schema. The site and the game share one token sheet, `design/tokens.css`, and
one signature element, the pixel frame. The hub shows the community loop and
never runs it: requests, proposals and votes live on GitHub. Nothing is called
credits until the fund has a formula, and no player board exists until accounts
do.

## 1. Surfaces and packages

| Surface | Package | Built with | Served at |
|---|---|---|---|
| Home, hub, docs, API folder | `web/` (new, `@game/web`) | Astro, static output, plain `.astro` + CSS | `/`, `/hub/`, `/docs/`, `/api/` |
| The game | `game/` (exists) | Vite + Phaser | `/play/` |
| Hub data builder | `tools/src/hub/` (new) | tsx, reuses `tools/src/loop/github.ts`, `board.ts`, `load.ts` | writes `web/public/api/hub-data.json` |
| Document schema | `schema/src/hub.ts` (this branch) | TypeBox, emitted to `schema/json/hub-data.schema.json` | `/api/schema/` |
| Creator tools | `mcp/` (this branch: definitions; GRUNT: the server) | TypeBox types, later `@modelcontextprotocol/sdk`, stdio | the creator's machine |
| Stage-1 service (spec S-1) | `web/src/pages/api/s1/` | Astro server endpoints on Vercel Functions + Upstash Redis | `/api/s1/*` |
| Tokens | `design/tokens.css` (this branch) | CSS custom properties | imported by both apps |

### Why Astro for `web/`

The site is pages of text with a few numbers: a home page, a hub, a guide
rendered from markdown, a rules page. Astro renders them to static HTML with no
JavaScript unless a component asks for it, has content collections for the
markdown already in `docs/creators/`, and runs on the Vite the repository uses.
Plain Vite + TypeScript would mean writing layouts, markdown rendering and
routing by hand; Next.js ships a React runtime for pages that need none. No
React, no Tailwind: tokens and one stylesheet.

Reverse when: a hub page needs per-user interactive state beyond an island
(stage 2a accounts). Then the hub pages that need it become islands or move to
the server app; the static pages stay.

### Why one Vercel project and `/play/`

Every pull request already gets one preview deployment, and the loop posts that
link as the proposal's trial world. A second project would mean two previews
per pull request and a rewrite that cannot target a per-branch preview. The
game's Vite config has `base: './'`, so its built URLs are relative and it runs
under `/play/` as it runs at `/`. Two root-absolute URLs stand in the way and
are fixed in GRUNT item 4: the font in `game/src/style.css` and the landing's
`/landing/hero.webp`.

The build becomes: bundle, build the game, build the site, copy `game/dist`
into `web/dist/play/`. `vercel.json` points `outputDirectory` at `web/dist`.
The `/assets/` cache header moves to `/play/assets/` and `/_astro/`.

### What happens to `feat/landing-page`

Not merged as a splash in front of the game. The game keeps its title screen;
a splash before a title screen is two doors. The hero art, the pitch, the loop
in four steps and the developer links move to the site's home page and hub,
ported to tokens (GRUNT items 5 and 7). The branch does not compile today
(`landing.ts` references an undefined `openDev`, and its class names do not
match the CSS), so nothing is lost by not merging it. After the port, the lead
tags it `attempt/2026-10-landing-splash` and deletes the branch, as
`docs/team/WORKFLOW.md` says for abandoned work.

## 2. Environments, versions, releases

### The ladder

| Rung | What | Data | Who looks |
|---|---|---|---|
| Local | `pnpm dev` (game) and `pnpm --filter web dev` (site), `pnpm hub:data` against the checkout | hub-data from the checkout; GitHub sections empty without a token | the person building |
| Pull request preview | Vercel preview of the branch, the game at `/play/` | hub-data built in the Vercel build; GitHub sections filled when `HUB_GITHUB_TOKEN` is set in the project | reviewers, the loop (trial world), voters |
| `develop` preview | the same, for the integration branch | same | Elad: "the latest version" |
| Production | `main`, tagged | hub-data rebuilt hourly by the loop (section 3.4) | players, creators |

Nothing new is needed for the ladder: the branches, previews and the loop
already exist. What changes is that every rung now carries the site and the
game together.

### Three versions, written in every hub-data document

| What moves | Where it is | Shown as |
|---|---|---|
| Code | `kernel/package.json` version, bumped on a release of `main` (`v0.<stage>.<n>` tags, WORKFLOW.md) | `source.kernel_version` |
| Content | the bundle tag: a hash of the canonical content (`tools/src/assemble.ts`) | `source.content_tag` |
| Site | the commit the site was built from and the build time | `source.sha`, `built_at` |

A save file names the content tag it was made with; a creator's MCP answer
names the tag it was computed from; the hub footer prints all three. That is
how "which version is this" is answered without asking.

### Release notes

One note per tag on `main`, in `CHANGELOG.md`, three headings in this order,
each a short list, any heading may be empty but is still written:

```
## v0.1.4 - 2026-10-14

What players notice
- ...

What creators notice
- ...

What changed underneath
- kernel 0.1.4, content tag 6e051288, site e8f2775
```

The weekly summary issue links the latest note. A release that changes the
content format gets a fourth line, "Format: 2", and the MCP major moves with it
(section 4).

## 3. The hub-data contract

### 3.1 One document

`schema/src/hub.ts` defines `HubData`: the one JSON document the site, the
boards, the `/api/` folder and two MCP tools read. It is emitted to
`schema/json/hub-data.schema.json` beside the content schemas, with a fixture
in `schema/test/fixtures/hub-data.json` and tests that pin its rules. The
document has these sections:

| Section | What | Source at stage 1 | Stage 2 |
|---|---|---|---|
| `source`, `built_at` | the three versions (section 2) | git, package.json, the bundle | same |
| `sources` | provenance per source: `git`, `github`, `vercel`, `usage`, each with a fetch time or `null` | the builder | same |
| `creators` | the creators board (spec C-1): handle, name, signature, points, records, commits, extensions | git history (`tools/src/board.ts`) + creator profiles | same |
| `reviewers` | reviewer points (spec C-1): approvals that counted on merged proposals | GitHub reviews | same |
| `extensions`, `kits` | the registry of accepted content, with links into the repository | content files | same |
| `slots` | the ruins map (spec L-2): every slot, filled or waiting | the core map | same |
| `requests`, `proposals`, `votes`, `summary` | the loop as the hub shows it | GitHub through the loop's client | same |
| `parameters` | every number a ranking or a rule runs on: `.github/loop.json`, `.github/points.json`, the game's bounded params, the value anchors | the files | same |
| `players` | verified player boards (spec A-3) | `null` | the server (stage 2a) |
| `usage` | visits, pickups, reports per extension; where players stop (spec C-2, S-1) | `null` until S-1 | the server |

Rules the document keeps, enforced by `hubInvariants` in `schema/src/hub.ts`
and the tests:

- Every number is computed from a source named in `sources` with the parameters
  in `parameters`. The test recomputes creator and reviewer points from the
  document's own parameters.
- A section whose source is missing is empty or `null`, never guessed. Built
  without a GitHub token, the loop sections are empty and `sources.github` is
  `null`.
- Nothing personal: GitHub handles people published themselves, and the name a
  player typed into the game. Votes carry a display (`bar`, `percent`) and never
  a count or a voter.
- No hours. The creators board publishes points, records and commits.
- `additionalProperties: false` everywhere: a new field is a schema change and a
  format bump when it changes meaning.

### 3.2 Built for stage 2 without a rewrite

The document is the contract, not the builder. At stage 1, `pnpm hub:data`
builds it from the checkout and GitHub and writes
`web/public/api/hub-data.json` (gitignored). The site imports the local file at
build time. At stage 2, the server produces the same document, and
`pnpm hub:data --from <url>` downloads it instead of building it; the site is
unchanged. The sections the server adds (`players`, `usage`) are already in the
schema as `null`, so no page is touched when they fill.

### 3.3 The builder

`tools/src/hub/build.ts` (GRUNT item 3):

1. Git and content: reuse `computeBoard` and `readCommits` from `board.ts`,
   `loadAll` and `assemble` for extensions, kits, slots, values and params.
2. GitHub: reuse `GitHubClient` from `tools/src/loop/github.ts` with
   `HUB_GITHUB_TOKEN` (read-only, `public_repo` scope once the repository is
   public). No token: `sources.github = null`, the build still succeeds.
3. Vercel: the preview link per proposal from the loop's own comment on the pull
   request (the loop already posts it), so no Vercel API call is needed. No
   comment: no `preview`.
4. Validate with `validateHubData`; refuse to write an invalid document.
5. Write the document and copy `schema/json/*.schema.json` to
   `web/public/api/schema/`.

### 3.4 How it stays fresh

- Every Vercel build runs `pnpm hub:data` first, so a preview shows the data of
  its moment.
- The hourly loop run (`.github/workflows/loop.yml`) builds the document after
  its own steps, compares it with the deployed `/api/hub-data.json`
  (`pnpm hub:same`: equal when everything but the times of reading is equal),
  and fires the Vercel deploy hook only when they differ. The run reads the
  usage counters with Redis's read-only token, so it builds the same `usage`
  production has. Three repository secrets: `VERCEL_DEPLOY_HOOK`,
  `KV_REST_API_URL`, `KV_REST_API_READ_ONLY_TOKEN`; without the hook the step
  is skipped, without the other two it warns and compares nothing. It runs as
  its own job (concurrency group `hub-refresh`), and does not fire the hook
  while `main`'s newest commit changes only `CREDITS.md` (Vercel's ignored
  build step would cancel it). Between runs
  the hub is at most an hour behind GitHub and the counters, which the footer
  says with `built_at`.

### 3.5 The stage-1 service (spec S-1)

What S-1 needs: counts of visits and pickups per extension, where players stop
in the opening, and short reports, so the creator data page (C-2) has something
to show before accounts exist.

Decision (yes, 2026-10-08): Astro server
endpoints in the same `web/` package, deployed as Vercel Functions, with
Upstash Redis from the Vercel Marketplace (free tier) as the store.

- `POST /api/s1/visit`, `/pickup`, `/stop`, `/report`: a record id or an
  opening step, no identity, no cookie. The client sends one report per
  extension per browser (a flag in local storage); the function keeps a small
  per-IP rate limit and a capped list of reports per extension.
- `pnpm hub:data` reads the counters hourly into `usage`; `sources.usage` says
  the window.
- Stage 2a inherits the endpoint contract and moves the keys into its own store;
  the client does not change.
- Stage 2a is designed only when this service is live and has numbers, and runs
  the same way: the API and the database run as containers on the owner's box
  (owner, 18.10; DECISIONS 2026-10-18, "Accounts and a server: the owner's answers"). The spec's dedicated server waits for
  stage 7, the first stage with a live connection per player.

Rejected: the analytics vendor's custom events (reports do not fit, and the
read side is a paid API), a self-hosted endpoint (a server to run now, and this
project has none).

## 4. The creator tool surface

### 4.1 MCP

`mcp/` is a workspace package, `@game/mcp`, whose major version equals
`FORMAT_VERSION` (the test asserts it). This branch holds the tool definitions
as TypeBox schemas with static types (`mcp/src/tools.ts`); the stdio server
that serves them is GRUNT item 15. Nine tools, in the order a creator meets
them:

| Tool | Reads | Answers |
|---|---|---|
| `schema` | checkout | the JSON schema of one type, or the list of types |
| `check` | checkout | the content check CI runs, on the checkout or given files |
| `slots` | checkout | the ruins map: slots filled or waiting |
| `requests` | hub-data | what players asked for, open calls, capabilities |
| `template` | checkout | a starting file for one type, returned, not written |
| `value` | checkout | the kernel's value for drafts against the anchors and the drift budget |
| `preview` | hub-data | one proposal: preview link, merge-rule checklist, approvals, competitors |
| `guide` | checkout | the creator guide as markdown |
| `rules` | checkout | the loop and points parameters, the licence, the lines never crossed |

Every answer carries `meta`: `format`, `mcp`, `content_tag`, `root`. The line
never crossed: the MCP writes nothing, holds no token and never talks to
GitHub. The creator's agent writes files into the creator's own folder; the
creator opens the pull request. A later `scaffold` tool may write inside
`content/extensions/<handle>/` and nowhere else.

The server runs on the creator's machine against the checkout, registered by a
`.mcp.json` at the repository root (and `.cursor/mcp.json`), so a clone has it
without installing anything. Publishing to npm waits for a public repository;
the product name, Openfold, is settled (`DECISIONS.md`, 2026-10-09).

### 4.2 API

At stage 1 the API is files: `/api/hub-data.json`, `/api/schema/<type>.schema.json`
and an `/api/` index page that lists them with their `format`. At stage 2 the
server serves the same paths. The MCP's two hub-data tools read the published
document, so a creator sees the same numbers as the hub.

### 4.3 `llms.txt`

`web/public/llms.txt`, per llmstxt.org: an H1 with the product name, one
sentence, then sections linking the guide, the schemas, the hub-data document,
the MCP snippet and the rules. It is what an AI tool reads first when a creator
pastes the site URL.

## 5. The design bridge

### 5.1 The token sheet

`design/tokens.css` holds the game's 21 colour tokens (same names, same values,
all from the 32-colour core palette), the pixel unit, three faces (the game's
pixel face, the site's display and reading faces), a type scale, spacing steps
and the frame. `tools/test/design-tokens.test.ts` fails on any
hex outside the palette, on rgba, gradients or a radius, and when the game's
own `:root` copy drifts from the sheet. GRUNT item 2 makes `game/src/style.css`
import the sheet; until then the test keeps the copies equal.

### 5.2 Type

The game sets titles and numbers in Pixelify Sans and its body, buttons, item facts and
dialogue in Atkinson Hyperlegible Next (DECISIONS 2026-10-20, Field Kit); the site does not wear it (DECISIONS.md 2026-10-10, "The site
leaves the pixel face and the shadow frame"). Platypi is the site's display
face, for what is signed or counted: the wordmark, headings, door names,
builder handles, points. Atkinson Hyperlegible Next is its reading face, for
everything that explains or is pressed: body, nav, buttons, tabs, tags, ranks.
Both OFL, self-hosted woff2 in `web/public/fonts/`. The pixel face appears on
the site only where the game's own marks do: the builders' signatures on the
boards page. Rejected: a pixel face across the site (a costume), Inter and the
system stack (generic), a serif body (the editorial template). Body 17px,
nothing read below 15px, measure 64ch.

### 5.3 The signature element

A living window into the valley (DECISIONS.md 2026-10-10): the home page's
classic door draws the core kit as CSS sprites at a whole-number scale, plays
the opening's first quest once (the bridge mended, the builder's plate rising
on its post) and then only idles. The 2px ink frame, no radius, stays on the
two doors and outlined buttons only; the hard offset shadow is retired and
`--frame-shadow` is gone from the sheet. One accent, green, means go. Sprites
are drawn at whole-number scales, `image-rendering: pixelated`; the art is the
game's own.

### 5.4 The site uses a named subset

`paper`, `paper2`, `ink`, `ink2`, `grey`, `green`, `green3`, `gold`, `cream`,
and no hex of its own: a `web/` test scans `web/src` for hex and fails on any
(GRUNT item 4). Two more tokens, each kept to one stylesheet: wood for the
builder's plate in the window, and the signature colours (`red`, `yellow`,
`green4`, `gold` on `wood` or `ink`) in `web/src/styles/signature.css`.
Rejected on purpose: a second accent, rgba scrims, gradients, rounded cards, an
icon font. Animated counters are allowed since 2026-10-10: they count up once,
with the true number in the DOM.

### 5.5 Measurable criteria per page

Each page ships with these; a page that misses one is not done.

Home `/`:
1. At 390x844 the first screen shows the wordmark, the headline and lead, the
   classic door with Play, the 3D door with Enter when it ships, and the
   board's title and tabs (restated 2026-10-10).
2. No script but Vercel Web Analytics: `grep -c "<script" web/dist/index.html`
   prints 2, the analytics loader and its queue stub (2026-10-15, DECISIONS.md).
3. Every colour in the page's CSS is a palette hex (the subset test).
4. Transfer under 300KB including the fonts, the scene sprites, the 3D loop
   and its poster, measured in the build output (`web/test/home.test.ts`;
   125KB without the 3D door, 281KB with it, on 2026-10-10).
5. Body text contrast at least 4.5:1 against `--paper` (ink on paper is 15:1).

Hub `/hub/` and `/hub/loop/`:
1. Every request, proposal and vote on the page links to its GitHub page.
2. The loop section contains no `<button>` and no `<form>`: the hub shows, GitHub
   casts.
3. `built_at` is visible in the footer in the DD.MM.YY HH:MM form.
4. The numbers rendered equal `content/board.json`'s while the site is built
   without the hub-data document, and the document's once it is (a `web/`
   test). The fixture's sample numbers never reach a page (2026-10-10).
5. The one island is the copy button for the AI prompt; the prompt is readable
   without JavaScript.

Boards `/hub/boards/`:
1. A creator row shows points, records, commits and the signature; never hours.
2. The parameters the points were computed with are printed under the table,
   with a link to `.github/points.json`.
3. The player section says "opens with accounts" and shows no number.

Docs `/docs/`:
1. The guide is rendered from `docs/creators/README.md`; the game's menu shows
   the same file (its `?raw` import), one source.
2. Every heading has an anchor; the MCP `guide` tool returns the same list.

## 6. Hub information architecture

| Path | Audience | First screen | Sections |
|---|---|---|---|
| `/` | players first, creators second | the valley, one sentence, Play, Build the valley | the loop in four steps; this week (from `summary`); board teaser |
| `/play/` | players | the game's title screen | a "Site" link back |
| `/hub/` | creators | Start here: guide, template, the AI prompt with a copy button, `pnpm check` | Tools (MCP snippet, API, schemas, kit importer, palette); This week; Boards teaser; Rules links |
| `/hub/loop/` | creators and voters | open calls | requests with support; capabilities; proposals with preview and merge-rule status; votes shown, cast on GitHub |
| `/hub/boards/` | everyone | the creators board | reviewers; the parameters; players "opens with accounts" |
| `/hub/rules/` | everyone | the one-page public rules (spec P-1) | `loop.json`, `points.json`, `values.lock.json` as tables; licences; conduct |
| `/docs/` | creators | the guide | one page per markdown file in `docs/creators/` |
| `/api/` | tools | the file list with formats | `hub-data.json`, `schema/` |
| `/hub/creators/<handle>/` | creators | the creator's data page (spec C-2) | after S-1 |

Pages versus sections versus links: a page when it has its own audience or is
linked from outside (the five above); a section when it is read in passing;
a link into GitHub for anything that has state there (an issue, a pull request,
a vote, a file).

## 7. Points, credits, gold

- Creator points stay what `pnpm board` computes, `10` per record and `1` per
  commit, but as parameters in `.github/points.json` (this branch), read by
  `board.ts` (GRUNT item 1) and copied into `parameters.points`. Changing a
  weight is a pull request to a JSON file, visible to everyone.
- Hours are not published. Squash merges collapse a creator's work into one
  commit, so a session estimate from commit times is meaningless for everyone
  but core. The field leaves `board.json`, `BoardEntry` and the game's creators
  panel in GRUNT item 1; `commits` takes its place.
- Reviewer points: `per_approval` (5) for each approving review that counted on
  a merged proposal, by someone other than the author, computed by the builder
  from GitHub into `reviewers`. A review that did not count (stale head, author)
  earns nothing.
- D5 has its formula (decided 2026-10-09): a pool of gold taken from gold
  already spent and split by active seconds (GRUNT's CR-44). The money fund,
  40% of net income, is a separate split paid in money, and the two never
  convert. Nothing is called credits until stage 4's creators' document;
  `CREDITS.md` stays attribution, and the hub's rules page says there is no
  income yet.
- Gold and player boards only from stage 2a, when the server verifies them. The
  boards page says so in one line and shows no number.
- `weekly_pool` (1000) is present and `weekly_pool_active: false` until `usage`
  exists; when active it is shared by usage, never by seniority.

## 8. Previews and the playground

The pull request preview is the playground for now: a proposal's trial world
is its deployment's `/play/`, and the MCP's `check` and `value` tools answer
"will it pass" and "what is it worth" before a pull request exists.

A browser playground (edit a record, see it in the game) waits until after the
MCP: it needs `tools/` refactored to be free of the file system and a game
build that takes a bundle at runtime, both of which the MCP work touches first.
It is entered in the loop as a capability request so the demand is measured
before the work.

## 9. Structure behind the scenes

### 9.1 Ownership

New rows in `docs/team/WORKFLOW.md` and lines in `.github/CODEOWNERS`
(this branch):

| Area | Paths | Rule |
|---|---|---|
| Site | `web/` | Static by default; every page ships with its criteria (section 5.5). No hex outside `design/tokens.css`. |
| Creator tools | `mcp/` | Read-only, no token, no GitHub. The major version equals the content format. |
| Hub data | `tools/src/hub/`, `schema/src/hub.ts` | Every number computed from a named source; a missing source leaves its section empty. |
| Design | `design/` | Palette colours only; the frame is the signature; changes come with criteria. |
| Team docs | `docs/team/` | Decisions in `DECISIONS.md` the same day. |

### 9.2 CI

The required check keeps its name, "Check, test, build and play", so the
loop's `required_checks`, the branch rule and the landing scripts stay valid.
Since 26.10 it is a gate job: the checks (`pnpm verify` and the database steps)
and the browser tests run beside it as jobs of their own, one per group in
`game/e2e/run.ts`, and the gate goes green only when every one of them passed;
a failed, skipped or cancelled job fails it. A run lasts as long as its
longest group, the phone opening. A script that fails is played once more
alone, and the screenshots of its first attempt are kept as an artifact.
Every pull request starts the workflow, docs-only included: a path-filtered
workflow would leave the required check "Expected" and block the merge. A
docs-only pull request skips the browser jobs from the inside instead: the job
"The browser test groups" lists the changed files (`tools/src/docs-only.ts`: all
of them under `docs/`, Markdown outside `game/`, `DECISIONS.md`,
`.github/prompts/` or `tools/kit-gen/*.json`) and the groups are skipped; the
checks job still runs, and the gate accepts exactly that skip and no other, so
"Check, test, build and play" still reports on every pull request. A diff that
cannot be read counts as code.

`pnpm verify` gains `pnpm --filter web build` and the `web/` tests once the
package exists (GRUNT item 4).

### 9.3 Secrets

| Secret | Where | Used by |
|---|---|---|
| `GITHUB_TOKEN` | provided by Actions | the loop |
| `HUB_GITHUB_TOKEN` | Vercel project env (read-only token) | `pnpm hub:data` in Vercel builds |
| `VERCEL_DEPLOY_HOOK` | repository secret: the address from the Vercel project's Settings > Git > Deploy Hooks (it starts with `https://api.vercel.com/`; the refresh refuses anything else), set with `gh secret set VERCEL_DEPLOY_HOOK --repo Bobikobi/GAME`, pasting the value at the prompt | the hourly refresh |
| `KV_REST_API_URL`, `KV_REST_API_READ_ONLY_TOKEN` | repository secrets (read-only: nothing can be written with the token) | the hourly refresh reads the usage counters |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) | Vercel project env, set by the Marketplace integration (the `KV_` names) | the S-1 functions |

The repository holds `.env.example` with names only. Nothing else, ever.

### 9.4 Connected services

What is wired to the live site today, and where to look. Values never go in
the repository; this list is names and places only.

| Service | Where | What it does | Set up |
|---|---|---|---|
| Vercel project `mistvale` | the Vercel team that owns this repository | builds and serves the site, `/play/` and the `/api/s1/*` functions | Git integration on this repository |
| Upstash Redis `upstash-kv-amber-zebra` | Vercel project > Storage (Vercel Marketplace, Upstash, Free plan: 500K commands a month, region `iad1`) | the S-1 store: counters, stops and reports | linked to the Production and Preview environments; the integration sets `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, `REDIS_URL` (the code reads the first two, or the URL and the read-only token) |
| Vercel Web Analytics | Vercel project > Analytics | page views, visitors, referrers, countries and devices for the site and the game | enabled in the project; the snippet loading `/_vercel/insights/script.js` sits in `web/src/layouts/Site.astro` (every page, the home page included, section 5.5) and `game/index.html` |
| Stage-1 usage | `hub-data.json` > `usage`, the creator pages `/hub/creators/<handle>/` | per-record visits, pickups and reports, where players stop in the opening | `pnpm hub:data` reads Redis when the `KV_` pair is in the environment; without it `usage` stays `null` |
| Players counter | `hub-data.json` > `accounts`, the boards page `/hub/boards/` | open accounts and the ones opened in the last 7 days, from the game server's `GET /stats` | `pnpm hub:data` reads it when `GAME_SERVER_ORIGIN` names the server (a repository variable for the hourly refresh); unset, unreachable, an error or over 5 s, `accounts` stays `null` and the page says unknown |

Rename the database or move the region in the Upstash console; the env names
do not change. A database linked by hand (outside the Marketplace) exposes
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`; the code accepts those
too.

### 9.5 Handoffs

`docs/team/HANDOFF_TEMPLATE.md` (this branch): one goal in a sentence, the
exact files, the proving command, the decision it implements, the model and
effort to run it. `docs/team/GRUNT.md` is a list of handoffs in that shape.

### 9.6 What is secret and where it lives

The owner asked (31.10, GRUNT CR-115) whether a developer can be kept from
learning the game's shortcuts by reading the open code or asking an AI. They
cannot, and the game does not try: open games (Minecraft servers, Veloren,
Wesnoth, 0 A.D.) hide nothing in their repositories and put what must stay
unknown on the server and in its dice. Here, the same:

- **The repository is wiki knowledge.** Nothing in it is secret: the rules,
  the content, the odds and the prices are what a wiki would print anyway. The
  only secrets are the service keys of 9.3, and they never enter it.
- **The server owns the state and every roll.** Gold, the bag, the position
  and the clock are the server's copy (NEXT 18; DECISIONS 2026-10-10 "The
  shared world"; 2026-10-20 "The world's hour is the server's clock"). Every
  roll (a find, a drop, a predator's sight) is drawn from a seed only the
  server holds (kernel review R4), so the code gives the odds and never the
  result. A changed client changes nothing another player sees: the server
  refuses what the kernel would refuse (NEXT 18, the refusal list).
- **No solution is static where it matters.** The hunt's window is learned by
  watching the eyes and never told (G47); the chart shows only the ground the
  player walked (DECISIONS 2026-10-20 "The map: its own window, the ground you
  walked"). The tangle is hand-made today and a riddle has one answer, so a
  wiki can print both. **Retry when** mazes and riddles are content enough to
  matter: a maze generated per attempt from the server's seed, and riddles
  with variants drawn the same way.
- **The economy is public by design.** Values live in
  `content/values.lock.json` and no price is hardcoded, so "what pays most" is
  a table anyone can read. It is bounded by the rarity budget (G42) and the
  clocks that no skill shortens (DECISIONS 2026-10-10 "The world and its
  clocks"), not by being hidden.
- **A contributor's edge is accepted.** Knowing the content early is the edge
  every game gives its wiki writers and speedrunners. A spoiler is the
  player's own loss; a cheat on shared state is the server's to refuse.

## 10. Order of work, by milestone

| Milestone | Items (GRUNT) | Size | Proven by |
|---|---|---|---|
| M0 contracts (this branch) | hub-data schema, fixture, tests; MCP definitions; tokens; points.json | S | `pnpm verify` green on the pull request |
| M1 data | 1 points parameters, commits in, hours out; 2 tokens import; 3 builder | M | `pnpm hub:data && pnpm test`; `web/public/api/hub-data.json` validates; a token-less build succeeds |
| M2 site | 4 scaffold, build and `/play/`; 5 home; 6 title link; 7 hub; 8 api + llms.txt; 9 CI conditions | M | `pnpm verify` incl. the web build; the preview serves `/`, `/play/`, `/hub/`, `/api/hub-data.json`; the criteria of section 5.5 |
| M3 hub pages | 10 loop; 11 boards; 12 rules; 13 docs; 14 hourly refresh | M | the preview's `/hub/loop/` numbers equal the fixture under the test; the hourly run fires the hook once on a change |
| M4 MCP server | 15 server; 16 registration and snippet | M | `pnpm mcp` answers `rules` and `check` from a clone; the in-memory transport test |
| M5 service | 17 S-1 endpoints; 18 client calls; 19 creator page | L | a visit counted on the preview appears in `usage` on the next build |

M1 and M2 can run in parallel in two worktrees; M3 waits for both; M4 waits
for M1; M5 waits for M3 (question 4 was answered yes on 8.10).

## 11. Questions for Elad

Asked in the platform message, recommendation first, at most four:

1. Make the repository public now. The loop's forks, fork previews, the MCP
   over npx and branch protection all need it. Before the switch: a secret scan
   of the history, `SECURITY.md`, the P-1 rules page.
2. The product name and the domain. The save key, the package names and the
   site URL carry it; a rename is free before accounts exist and costly after.
3. Astro for `web/` (section 1).
4. S-1 on Vercel Functions with Upstash Redis in the same project (section 3.5).

Answered 2026-10-08, recorded in `DECISIONS.md` under that date: 1 yes, with the
checklist before the switch; 2 the first community votes on the name, from the
shortlist there; 3 yes; 4 yes. Question 2 then closed without the vote: the owner
confirmed Openfold on 2026-10-09, and the product owner kept it after the
registrar check (`DECISIONS.md`, both under that date).

## 12. What this plan does not do

- No page, no CSS, no server is built here: the contracts are code, the rest is
  GRUNT.
- No accounts, no player boards, no gold boards, no credits formula: all wait on
  stage 2a and D5.
- No second Vercel project, no GitHub Pages, no CMS, no third-party analytics
  vendor (Vercel Web Analytics is the host's own, section 9.4).
- No hour estimates anywhere.
