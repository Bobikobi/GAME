# GRUNT: the mechanical work behind the platform plan

Each item is one handoff in the shape of `docs/team/HANDOFF_TEMPLATE.md`: one
goal, the exact files, the command that proves it, the decision it implements.
A session takes one item, works in its own worktree (`docs/team/WORKFLOW.md`),
opens a pull request into `develop`, and stops. No design questions remain in
these items; where a choice is left, the item says which to take. Anything not
covered is a question for `docs/team/PLATFORM.md`, not a guess.

Rules for every item: plain hyphen, never an em dash; no hour estimates; no
new hex outside `design/tokens.css`; a new page comes with its criteria from
PLATFORM.md section 5.5 as tests; `pnpm verify` green before the pull request;
commit messages end with the `Co-Authored-By` line of the model that ran.

Order: M1 (1-3) and M2 (4-9) can run in parallel in two worktrees. M3 (10-14)
waits for both. M4 (15-16) waits for M1. M5 (17-19) waits for M3 and for
Elad's yes to question 4 of the platform message.

## M1 - data

### 1. Points as parameters, commits in, hours out

Goal: `pnpm board` reads its weights from `.github/points.json`, publishes
commits per creator, and publishes no hours anywhere.

Files:
- `tools/src/board.ts`: replace `POINTS_PER_RECORD` and `POINTS_PER_COMMIT`
  with `readPoints(root)` that parses `.github/points.json` (fields
  `per_record`, `per_commit`, `per_approval`, `weekly_pool`,
  `weekly_pool_active`; refuse a file with other keys). `computeBoard` takes
  the points object. Remove `sessionHours`; add `commits` to each entry.
- `kernel/src/bundle.ts`: `BoardEntry` becomes `{ points, records, commits }`.
- `content/board.json`: regenerate with `pnpm board`; the `note` mentions
  `.github/points.json`.
- `game/src/ui/panels.ts` (`openCreators`): show points, records, commits;
  remove the hours line and the "a guess" text.
- `schema/src/hub.ts`: nothing; `HubCreator` already has `commits`.
- Tests: `tools/test/board.test.ts` (new if absent): a fixture of commits gives
  points equal to `per_record * records + per_commit * commits`; a points file
  with an unknown key is refused.

Proving command:
```
pnpm board && git diff --stat content/board.json && grep -rn "hours" kernel/src tools/src/board.ts game/src/ui/panels.ts content/board.json; pnpm verify
```
The grep prints nothing; verify is green.

Decision: DECISIONS.md 2026-10-07, "Points are parameters, hours are not
published, nothing is called credits".

### 2. The game imports the token sheet

Goal: `game/src/style.css` takes its colour tokens from `design/tokens.css`
instead of its own copy.

Files:
- `game/src/style.css`: first line `@import '../../design/tokens.css';`. Delete
  the 21 colour tokens, `--px` and `--font` from its `:root`; keep
  `--font-body: var(--font);` and `color-scheme`. Everything else unchanged.
- `tools/test/design-tokens.test.ts`: replace the case "keeps every colour
  token of the game, with the same value" with: `game/src/style.css` contains
  the import line and its `:root` block declares no hex.
- `game/vite.config.ts`: nothing, unless the build fails to resolve the import;
  then add `css: { preprocessorOptions: {} }` is not the fix - use the path
  `new URL('../design/tokens.css', import.meta.url)` in an alias and say so in
  the pull request.

Proving command:
```
pnpm build && grep -c "1b1a2e" game/dist/assets/*.css && pnpm test
```
The grep prints 1 or more (the token reached the built CSS); tests green.

Decision: DECISIONS.md 2026-10-07, "One token sheet and the pixel frame tie the
site to the game".

### 3. `pnpm hub:data` builds the document

Goal: one command builds a valid hub-data document from the checkout, GitHub
and the loop's preview comments, and succeeds without a token.

Files:
- `tools/src/hub/build.ts`: `buildHubData(options)` returning `HubData`;
  options `{ root, client: LoopClient | null, now, previews: boolean }`.
- `tools/src/hub/github.ts`: the reads, through `LoopClient` from
  `tools/src/loop/github.ts`: issues labelled `request` (kind from the form
  field, mapped to `REQUEST_KINDS`, `other` when unknown; support counted the
  way `tools/src/loop/requests.ts` counts it - call its function; `open_call`
  and `capability` from the labels); pull requests labelled `proposal` with
  `evaluateMerge` from `tools/src/loop/merge.ts` for `merge_rule` and `checks`
  (one line per rule, `detail` as the loop writes it); the vote issue number
  from the `vote` label link; the preview from the loop's own comment on the
  pull request (the URL plus `/play/`); issues labelled `vote` for `votes`
  (`bar` and `percent` from the loop's display rule in
  `tools/src/loop/votes.ts`; `postponed` when the loop closed it without a
  decision); the newest issue labelled `weekly summary` for `summary`;
  `reviewers` from APPROVED reviews on the merged head of merged proposals by
  anyone but the author, `points = per_approval * approvals`.
- `tools/src/hub/content.ts`: `creators` from `computeBoard` and the creator
  profiles (`name`, `role`, `signature`; `name` falls back to the handle; `url`
  is the GitHub tree link of the folder); `extensions` one row per content file
  of a `RECORD_TYPES` type, `merged_at` from the first commit that added the
  file, `slot` from the instance that places it (`assemble`); `kits` from the
  kit files with their sprite count; `slots` from the core map with `filled_by`
  from the instances; `parameters.game` the bounded objects of
  `content/core/params.json` flattened with `.` (arrays as `.0`, `.1`);
  `parameters.values` from `content/values.lock.json`; `parameters.loop` and
  `parameters.points` the two JSON files verbatim.
- `tools/src/hub/cli.ts`: `pnpm hub:data [--from <url>] [--out <path>]`.
  Default out `web/public/api/hub-data.json`; also copies
  `schema/json/*.schema.json` to `web/public/api/schema/`. `--from` downloads a
  document instead of building, validates it, writes it. Token from
  `HUB_GITHUB_TOKEN`, else `GITHUB_TOKEN`, else no client and
  `sources.github = null`. Exit 1 when `validateHubData` reports anything, with
  the issues printed.
- `package.json`: script `"hub:data": "tsx tools/src/hub/cli.ts"`.
- `.gitignore`: `web/public/api/`.
- `.env.example`: the four names from PLATFORM.md section 9.3, no values.
- `tools/src/index.ts`: export `buildHubData`.
- Tests: `tools/test/hub/build.test.ts` with the fake client the loop tests use
  (`tools/test/loop/`): a build with the fake client validates and its
  `requests`, `proposals`, `votes`, `reviewers` match the fake data; a build
  with `client: null` validates and has `sources.github === null` and empty
  loop sections; the fixture `schema/test/fixtures/hub-data.json` stays the
  reference shape (do not regenerate it from a real build).

Proving command:
```
pnpm hub:data && node -e "const d=require('./web/public/api/hub-data.json');console.log(d.format,d.sources.github,d.creators.length)" && pnpm test
```
Prints `1 null <n>` without a token; with `HUB_GITHUB_TOKEN` set, prints a
fetch time instead of null. Tests green.

Decision: DECISIONS.md 2026-10-07, "One hub-data document, built by a tool,
read by everything".

## M2 - the site

### 4. The `web/` package, one build, the game at `/play/`

Goal: `pnpm build` produces `web/dist` with the site at `/` and the game at
`/play/`, and Vercel deploys that folder.

Files:
- `web/`: `pnpm create astro@latest web -- --template minimal --no-install
  --no-git --typescript strict` from the repository root, then pin the exact
  `astro` version the install resolved (no caret) in `web/package.json`; name
  `@game/web`, `private: true`, licence `AGPL-3.0-only`. No integrations, no
  React, no Tailwind. `astro.config.mjs`: `output: 'static'`, `trailingSlash:
  'always'`, `build: { format: 'directory' }`.
- `pnpm-workspace.yaml`: add `- web`. Run `pnpm install` and commit the
  lockfile.
- `web/src/styles/site.css`: `@import '../../../design/tokens.css';` first, then
  the site's own rules using tokens only. Fonts: self-host Atkinson
  Hyperlegible (regular and bold woff2 from the `@fontsource/atkinson-hyperlegible`
  package, copied once into `web/public/fonts/`, not a runtime dependency) and
  the Pixelify Sans file the game already ships (`game/public/fonts/`, copied
  to `web/public/fonts/`). `font-variant-ligatures: none` on the page, as the
  game does.
- `web/src/layouts/Site.astro`: header (wordmark in the pixel face, links Play,
  Build, Boards, Rules), footer printing `source.kernel_version`,
  `source.content_tag`, `source.sha` and `built_at` as `DD.MM.YY HH:MM`, from
  `web/public/api/hub-data.json` imported at build time. When the file is
  missing (a fresh clone), import `schema/test/fixtures/hub-data.json` instead
  and print "fixture" beside the time.
- `package.json` (root): `"build": "pnpm bundle && pnpm --filter game build &&
  pnpm hub:data && pnpm --filter web build && tsx tools/src/site/copy-play.ts"`;
  `tools/src/site/copy-play.ts` copies `game/dist` into `web/dist/play/`
  (`cpSync`, recursive, after emptying the target). `verify` adds
  `pnpm --filter web build && pnpm --filter web test` after the game build.
- `web/package.json` scripts: `dev`, `build`, `preview`, `test` (vitest run on
  `web/test/**`).
- `vercel.json`: `outputDirectory: "web/dist"`; the immutable cache header for
  `/play/assets/(.*)` and `/_astro/(.*)`; the rest unchanged.
- `game/src/style.css`: the `@font-face` `url('/fonts/pixelify-sans-latin.woff2')`
  must not be root-absolute under `/play/`. Take the first that works: move
  the `@font-face` block into `game/index.html` next to the preload that
  already uses `./fonts/`; or move the woff2 under `game/src/fonts/` and
  import it with `url('./fonts/pixelify-sans-latin.woff2')` so Vite emits it
  as a hashed asset with a relative URL. Say which in the pull request.
- `web/test/tokens.test.ts`: every hex in `web/src/**` and `web/public/**/*.css`
  is one of the nine site colours of `design/tokens.css` by token name, that
  is: no hex at all in `web/src`; the only hex on the site is in
  `design/tokens.css`.
- `web/test/build.test.ts`: after `astro build`, `web/dist/index.html` exists;
  `web/dist/play/index.html` exists after the copy; no `<script` in
  `web/dist/index.html` (criterion 2 of the home page).

Proving command:
```
pnpm build && ls web/dist/index.html web/dist/play/index.html web/dist/api/hub-data.json && grep -c "<script" web/dist/index.html; pnpm --filter web test
```
The `ls` lists three files, the grep prints 0, the tests are green. On the
pull request preview: `/`, `/play/`, `/api/hub-data.json` answer 200 and the
game's font loads at `/play/` (no 404 in the network panel).

Decision: DECISIONS.md 2026-10-07, "The site is an Astro package beside the
game, one Vercel project, the game at /play/".

### 5. The home page

Goal: `/` is the first screen of PLATFORM.md section 6 with the five criteria
of section 5.5, built from the landing branch's content and nothing of its CSS.

Files:
- `web/src/pages/index.astro`: wordmark, one sentence ("A valley the players
  rebuild together", the game's tagline), the buttons Play (`/play/`, primary,
  green) and Build the valley (`/hub/`, secondary, frame only), the hero image
  in the pixel frame, then the loop in four steps (Request, Propose, Review,
  Vote - the four labels of `docs/loop/README.md`, each a sentence and a link
  into GitHub), This week (title and link of `summary`, or the line "No summary
  yet" when `summary` is null), the board teaser (top three creators by points,
  link to `/hub/boards/`).
- `web/public/hero.webp` and `web/public/hero-sm.webp`: `git show
  feat/landing-page:game/public/landing/hero.webp` and `hero-sm.webp` (126KB
  and 43KB). `<picture>` serves `hero-sm.webp` under 640px.
- Copy from `feat/landing-page:game/src/landing.ts` for the pitch and the step
  texts (read with `git show`, do not check the branch out); not its CSS, not
  its class names, not `game/src/style.css` of that branch.
- `web/test/home.test.ts`: the built `index.html` has exactly two links with
  class `btn` above the hero (Play, Build the valley); the sum of
  `index.html`, the CSS it links and `hero-sm.webp` is under 300KB; the
  built HTML has no inline `style=`.
- Criterion 1 (the first screen at 390x844) is checked by a screenshot in the
  pull request, taken with the e2e helper's headless Chrome
  (`game/e2e/opening.ts` shows how) at 390x844, attached to the pull request.

Proving command:
```
pnpm build && pnpm --filter web test && du -b web/dist/index.html web/dist/_astro/*.css web/dist/hero-sm.webp
```
Tests green; the byte sum printed is under 300000.

After this item the lead tags the landing branch:
`git tag attempt/2026-10-landing-splash feat/landing-page && git push origin
attempt/2026-10-landing-splash && git push origin --delete feat/landing-page`
(the lead's hand, not the session's).

Decision: DECISIONS.md 2026-10-07, "The landing splash is not merged; its
content moves to the site".

### 6. A way back from the game

Goal: the game's title screen has one link, "Site", to the page above it.

Files:
- `game/src/ui/title.ts`: a text link `Site` under the demo note, `href="../"`,
  class `btn btn-ghost` or the title screen's existing link style; nothing
  else changes.
- `game/e2e/opening.ts`: no change needed unless it counts links on the title
  screen; then update the count.

Proving command:
```
pnpm build && grep -c 'href="../"' game/dist/index.html web/dist/play/index.html; pnpm e2e
```
Prints 1 for each file (the link is in the static title markup), e2e green.
If the title screen is built at runtime, the grep targets
`game/dist/assets/*.js` and prints 1 or more.

Decision: PLATFORM.md section 6 (`/play/` row).

### 7. The hub page

Goal: `/hub/` is the creator's first screen of PLATFORM.md section 6.

Files:
- `web/src/pages/hub/index.astro`: Start here (links: `/docs/`, the template
  folder on GitHub, the AI prompt in a `<pre>` with the copy button, the line
  `pnpm check`); Tools (the MCP snippet in a `<pre>` from item 16 - until then
  the text "MCP: lands with the next release" -, `/api/`, `/api/schema/`, the
  kit importer command `pnpm kit:import`, the palette as 32 swatches drawn
  from `CORE_PALETTE` at build time); This week (`summary`); Boards teaser;
  Rules (`/hub/rules/`, `CONTRIBUTING.md`, the licence).
- `web/src/components/Copy.astro`: the one island: a `<button>` that copies the
  text of its target `<pre>`; the `<pre>` is rendered without JavaScript.
- `web/src/data/prompt.ts`: the AI prompt text (one paragraph: "You are helping
  me add content to <name>. Read llms.txt at <site>/llms.txt, then the guide.
  Content lives in content/extensions/<handle>/. Run pnpm check before you
  tell me it is done.").
- `web/test/hub.test.ts`: the built `hub/index.html` has exactly one `<button>`
  (the copy button) and no `<form>`; every `href` under the Start here section
  resolves to a page in `web/dist` or to `https://github.com/`.

Proving command:
```
pnpm build && pnpm --filter web test && grep -c "<button" web/dist/hub/index.html
```
Tests green, the grep prints 1.

Decision: DECISIONS.md 2026-10-07, "The hub shows the loop and never casts".

### 8. The API folder and `llms.txt`

Goal: `/api/` lists the published files with their formats, and `/llms.txt`
tells an AI tool where everything is.

Files:
- `web/src/pages/api/index.astro`: a list: `hub-data.json` (format, `built_at`),
  each `schema/<name>.schema.json` with its `$id`, each as a link; one line
  on the stage-2 plan (same paths, served by the server).
- `web/public/llms.txt`: H1 with the product name (use the game's title until
  question 2 is answered), one sentence, then sections `## Guide`,
  `## Schemas`, `## Data`, `## MCP`, `## Rules`, each a list of links with a
  short description, per llmstxt.org.
- `web/test/api.test.ts`: every link in the built `api/index.html` resolves to
  a file in `web/dist`; `llms.txt` starts with `# ` and lists `/api/hub-data.json`.

Proving command:
```
pnpm build && pnpm --filter web test && head -3 web/dist/llms.txt
```

Decision: DECISIONS.md 2026-10-07, "The creator MCP is read-only" (the API
paragraph).

### 9. CI runs the expensive steps only when their paths changed

Goal: a docs-only pull request finishes the one required job in about a minute,
and a game change still plays the opening.

Files:
- `.github/workflows/ci.yml`: keep the job id `verify` and the name
  "Check, test, build and play". Add a first step that computes two outputs
  with `git diff --name-only` against the base (`github.event.pull_request.base.sha`
  on pull requests, `HEAD^` on pushes): `game=true` when any changed path starts
  with `game/`, `kernel/`, `schema/`, `content/`, `tools/`, `design/` or is
  `pnpm-lock.yaml`, `package.json`, `vercel.json`; `web=true` when any starts
  with `web/`, `design/`, `docs/`, `schema/`, `tools/src/hub/`. The steps
  `pnpm --filter game build` and `pnpm e2e e2e-shots` get `if:
  steps.paths.outputs.game == 'true'`; the web build and tests get
  `if: steps.paths.outputs.web == 'true'`. `pnpm schemas --verify`, `pnpm check`,
  `pnpm lint`, `pnpm typecheck`, `pnpm test` always run. On `workflow_dispatch`
  everything runs.
- Do not add `paths:` filters to the workflow trigger, and do not rename the
  job: `.github/loop.json` `required_checks` names it.

Proving command:
```
gh run list --workflow ci.yml --limit 3
```
On a docs-only pull request the run shows the build and play steps skipped and
the job green; on this item's own pull request (it touches `.github/`) every
step ran.

Decision: DECISIONS.md 2026-10-07, "CI keeps one required job and skips the
expensive steps by changed paths inside it".

## M3 - the hub pages

### 10. The loop page

Goal: `/hub/loop/` shows requests, open calls, capabilities, proposals and
votes from hub-data, every one a link into GitHub, with no control.

Files:
- `web/src/pages/hub/loop.astro`: four sections in this order: Open calls
  (requests with `open_call`, capability marked), Requests (the rest, newest
  first, with support as a number), Proposals (open first; each: title, author,
  the slots, the merge-rule checklist as a list with pass / pending / fail in
  words, approvals as `n of approvals_to_merge`, the preview link labelled
  "Try it", competitors), Votes (each: title, closes `DD.MM.YY`, options as bars
  of width `bar`% in the frame, `percent` when not null, "Vote on GitHub" as a
  link).
- `web/src/components/Bar.astro`: a bar is a `<div>` with an inline width in
  percent from `bar` - the only allowed inline style; the test allows
  `style="width:` and nothing else.
- `web/test/loop.test.ts`: built from the fixture, the page has no `<button>`
  and no `<form>`; every number printed (support 6 and 2, approvals 3 and 1,
  bars 100 and 60) appears in the HTML; every `https://github.com/` link of the
  fixture appears in the HTML.

Proving command:
```
pnpm build && pnpm --filter web test && grep -c "<form\|<button" web/dist/hub/loop/index.html
```
Tests green, the grep prints 0.

Decision: DECISIONS.md 2026-10-07, "The hub shows the loop and never casts".

### 11. The boards page

Goal: `/hub/boards/` shows the creators board and the reviewers board with the
parameters they were computed with, and says that player boards open with
accounts.

Files:
- `web/src/pages/hub/boards.astro`: Creators (rank, signature drawn as the game
  draws it - text in the pixel face, style as a class, glyph as a sprite -,
  points, records, commits, links to the folder), Reviewers (rank, handle,
  approvals, points), under both the line "points = per_record x records +
  per_commit x commits; reviewer points = per_approval x approvals" with the
  numbers from `parameters.points` and a link to `.github/points.json` on
  GitHub; Players: one line, "Player boards open with accounts (stage 2a)",
  no number; when `weekly_pool_active` is false, no mention of the pool.
- `web/src/styles/signature.css`: the five styles and seven glyphs, tokens only
  (the game's `panels.ts` shows which colour each style uses).
- `web/test/boards.test.ts`: built from the fixture, the creators table has
  the header cells Points, Records, Commits and no cell "Hours"; 542 and 13 and
  10 appear; the string "opens with accounts" appears.

Proving command:
```
pnpm build && pnpm --filter web test && grep -ci "hours" web/dist/hub/boards/index.html
```
Tests green, the grep prints 0.

Decision: DECISIONS.md 2026-10-07, "Points are parameters, hours are not
published" and "Player and gold boards wait for accounts".

### 12. The rules page

Goal: `/hub/rules/` is the one public page of rules (spec P-1): the loop's
numbers, the points, the value anchors, the licences, conduct.

Files:
- `web/src/pages/hub/rules.astro`: The loop (every field of `parameters.loop`
  as a two-column table with one sentence each, text from
  `docs/loop/README.md` section Parameters), Points (`parameters.points`, the
  same way, plus the sentence "Nothing is called credits until the fund has a
  formula; the fund is 40% of net income; there is no income yet"), Values
  (`parameters.values` as a table id / value, and `drift_budget_permille` from
  `parameters.game` as a sentence), Licences (AGPL-3.0-only for code; the
  content licence from `CONTRIBUTING.md`; the fonts' OFL), Conduct (the Conduct
  section of `CONTRIBUTING.md`, rendered from the file, not copied).
- `web/test/rules.test.ts`: every key of `parameters.loop` and
  `parameters.points` of the fixture appears in the built page; the string
  "credits" appears only in the sentence above.

Proving command:
```
pnpm build && pnpm --filter web test
```

Decision: DECISIONS.md 2026-10-07, "Points are parameters, hours are not
published, nothing is called credits".

### 13. The docs pages

Goal: `/docs/` renders every markdown file of `docs/creators/` from its one
source, with anchors on headings.

Files:
- `web/src/content.config.ts`: a collection `creators` with
  `base: '../docs/creators'` (glob loader), markdown.
- `web/src/pages/docs/[...slug].astro`: one page per file; `README.md` is
  `/docs/`; headings get ids (Astro's markdown does this by default).
- `web/src/pages/docs/index.astro`: not needed when README maps to the index;
  otherwise a list.
- `game/src/ui/panels.ts`: unchanged (`?raw` import of the same file).
- `web/test/docs.test.ts`: the built `docs/index.html` contains the first H1
  of `docs/creators/README.md`; every `##` of the file is an element with an
  id.

Proving command:
```
pnpm build && pnpm --filter web test && grep -c 'id="' web/dist/docs/index.html
```
Tests green; the grep prints at least the number of `##` headings.

Decision: PLATFORM.md section 5.5 (Docs criteria) and section 6.

### 14. The hourly refresh

Goal: within an hour of a change on GitHub, production carries a new hub-data
document, and nothing deploys when nothing changed.

Files:
- `.github/workflows/loop.yml`: after the hourly `loop all` step, a step that
  runs `pnpm hub:data --out /tmp/hub-data.json` with `HUB_GITHUB_TOKEN:
  ${{ secrets.GITHUB_TOKEN }}`, fetches `https://<production host>/api/hub-data.json`,
  compares the two with `tools/src/hub/same.ts` (equal when every section but
  `built_at` and `sources.*.fetched_at` is equal), and when different runs
  `curl -fsS -X POST "$VERCEL_DEPLOY_HOOK"`. The hook URL is the repository
  secret `VERCEL_DEPLOY_HOOK` (the lead creates the hook in the Vercel project
  for `main` and adds the secret; the item's pull request says so and does
  nothing until it exists: the step is skipped when the secret is empty).
- `tools/src/hub/same.ts` with `tools/test/hub/same.test.ts`: two documents
  that differ only in times are the same; a changed support count is not.

Proving command:
```
gh run list --workflow loop.yml --limit 2 && gh run view --log $(gh run list --workflow loop.yml --limit 1 --json databaseId -q '.[0].databaseId') | grep -E "hub-data (same|changed)"
```
The log line says `same` on a quiet hour and `changed` after a merge.

Decision: DECISIONS.md 2026-10-07, "One hub-data document" (section 3.4 of
PLATFORM.md).

## M4 - the MCP server

### 15. The stdio server

Goal: `pnpm mcp` starts a server that answers the nine tools of
`mcp/src/tools.ts` from the checkout, writes nothing, needs no token.

Files:
- `mcp/package.json`: add `@modelcontextprotocol/sdk` (pin the version
  resolved) and `@game/tools` as dependencies; script `"start": "tsx src/server.ts"`.
- `mcp/src/server.ts`: `McpServer` over `StdioServerTransport`; register each
  tool of `TOOL_LIST` with its `input` as the input schema (TypeBox is JSON
  schema; pass it as `inputSchema` directly, or convert with the sdk's helper
  if it insists on zod - say which in the pull request); validate every
  answer against the tool's `output` with `Value.Check` before returning it,
  and return an error with the issues when it fails.
- `mcp/src/answers/`: one file per tool. `schema`: from `SCHEMAS` and
  `DOCUMENT_SCHEMAS`. `check`: `runCheck(root)` filtered to `paths` when given.
  `slots`, `requests`, `preview`: from the hub-data document at
  `web/public/api/hub-data.json`, else `schema/test/fixtures/hub-data.json`
  with `meta.content_tag` from the bundle and a `note` in the first line of
  the text content that the data is the fixture. `template`: the files of
  `templates/extension/` for the type, with `your-handle` replaced by `handle`
  and the id by `handle/name`. `value`: copy the checkout's `content/` to a
  temporary folder, write the drafts into it, `runCheck` there and
  `computeValues` on the assembled bundle; `anchor` from `values.lock.json`,
  `drift_permille`, `within_budget` against `drift_budget_permille`; delete
  the folder. `guide`: `docs/creators/README.md` and its `##` headings as
  `{ title, anchor }` (anchor the way Astro slugs them: lowercase, hyphens).
  `rules`: `.github/loop.json`, `.github/points.json`, the licence from
  `package.json`, `lines` = the four sentences of PLATFORM.md section 4.1's
  last paragraph.
- `mcp/src/meta.ts`: `meta(root)` reads the bundle tag through `assemble`
  (cache per process) and the package version.
- `package.json` (root): script `"mcp": "pnpm --filter @game/mcp start"`.
- `mcp/test/server.test.ts`: `InMemoryTransport` pair; `tools/list` returns
  nine tools in the order of `TOOL_LIST`; `rules` and `schema({type:'resource'})`
  answers validate against their output schemas; `check` on the checkout
  returns `ok: true`; `value` with a draft resource whose yield is too high
  returns an issue and does not leave a temporary folder behind.

Proving command:
```
pnpm test && printf '{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n' | pnpm -s mcp 2>/dev/null | head -c 400
```
Tests green; the output starts a JSON-RPC answer listing `schema` first.

Decision: DECISIONS.md 2026-10-07, "The creator MCP is read-only and runs on
the creator's machine".

### 16. Registration and the snippet

Goal: a clone of the repository has the MCP in Claude Code and Cursor without
a step, and the hub shows the one-line setup.

Files:
- `.mcp.json` (repository root): `{"mcpServers": {"<name>": {"command": "pnpm",
  "args": ["-s", "mcp"]}}}` with the product name from question 2 (until
  answered, `valley`).
- `.cursor/mcp.json`: the same shape.
- `docs/creators/README.md`: a section "Your AI tool and the project" with the
  two lines for a tool that does not read `.mcp.json` (`claude mcp add` and the
  JSON for Codex), and what the nine tools answer, one line each.
- `web/src/pages/hub/index.astro`: the Tools section's MCP `<pre>` now holds
  the `claude mcp add` line; the "lands with the next release" text goes.
- `web/public/llms.txt`: the `## MCP` section links the README section.

Proving command:
```
cat .mcp.json && pnpm build && grep -c "claude mcp add" web/dist/hub/index.html
```
Prints the file and 1.

Decision: DECISIONS.md 2026-10-07, "The creator MCP is read-only and runs on
the creator's machine".

## M5 - the stage-1 service (after Elad's yes to question 4)

### 17. The endpoints

Goal: four endpoints count visits, pickups and stops and keep short reports,
with no identity, in Upstash Redis.

Files:
- `web/astro.config.mjs`: `adapter: vercel()` from `@astrojs/vercel` (pin),
  output stays `static`; the four routes export `prerender = false`.
- `web/src/pages/api/s1/visit.ts`, `pickup.ts`, `stop.ts`, `report.ts`: `POST`
  with a JSON body validated by TypeBox (`schema/src/s1.ts`, new: `{ id: Id }`
  for visit and pickup, `{ step: string }` for stop, `{ id: Id, text: string
  (max 240) }` for report); `405` otherwise. Store: `@upstash/redis` with
  `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`; keys
  `s1:<window>:visits:<id>`, `...:pickups:<id>`, `...:stops:<step>` (INCR),
  `s1:reports:<id>` (LPUSH + LTRIM 50). Rate limit: `INCR` on
  `s1:rl:<sha256 of ip>:<minute>` with `EXPIRE 60`, refuse over 30 with `429`;
  the hash is never stored beyond the minute. `204` on success. CORS: same
  origin only.
- `schema/src/s1.ts` joins `DOCUMENT_SCHEMAS` so its JSON schema is emitted.
- `tools/src/hub/usage.ts`: `pnpm hub:data` reads the window's keys when the
  two env names are set and fills `usage` and `sources.usage`; otherwise both
  stay null.
- `web/test/s1.test.ts`: the handlers with a fake store: a visit increments,
  a report over 240 characters is refused, the 31st call in a minute is 429.

Proving command:
```
pnpm --filter web test && curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "content-type: application/json" -d '{"id":"core/berry"}' https://<preview>/api/s1/visit
```
Tests green; the curl prints 204 on a preview that has the two env names.

Decision: DECISIONS.md 2026-10-07, "The stage-1 service runs as Vercel
Functions with Upstash Redis in the same project".

### 18. The client calls

Goal: the game reports a visit when a player reaches a placed record, a pickup
when they gather from it, a stop on each opening step, and lets a player send
one report per record.

Files:
- `game/src/net/s1.ts`: `post(path, body)` with `navigator.sendBeacon` when
  available, else `fetch` with `keepalive`; swallow every error; do nothing
  when the page is `file:` or `localhost`; the base URL is `../api/s1/`
  (relative to `/play/`).
- `game/src/session.ts` (or where `visit`, `gather` and the opening steps are
  observed): call `s1.visit(id)` once per record per session, `s1.pickup(id)`
  on a successful gather, `s1.stop(step)` when an opening step is reached.
- `game/src/ui/panels.ts`: a "Report" line in the record's panel that sends
  the text once per record per browser (`localStorage` key `s1.reported.<id>`).
- `game/test/s1.test.ts`: with a fake `post`, one visit per record per
  session, a second report for the same record is not sent.

Proving command:
```
pnpm test && pnpm e2e
```

Decision: the same as item 17.

### 19. The creator's data page

Goal: `/hub/creators/<handle>/` shows a creator's records with visits, pickups
and reports from `usage` (spec C-2).

Files:
- `web/src/pages/hub/creators/[handle].astro`: one page per creator in
  hub-data: signature, points, records, commits; a table of their records with
  visits, pickups, reports and the window from `sources.usage`; when `usage`
  is null, the line "Usage opens with the stage-1 service".
- `web/src/pages/hub/boards.astro`: creator rows link to their page.
- `web/test/creators.test.ts`: built from the fixture (usage null), the page
  for `trout-maker` exists and prints the opening line; with a fixture copy
  whose `usage` is filled, 40 and 31 appear.

Proving command:
```
pnpm build && pnpm --filter web test && ls web/dist/hub/creators/
```

Decision: PLATFORM.md section 6 (the last row).
