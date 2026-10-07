# Decisions

Design choices, and approaches that were tried and abandoned. Read this before proposing an approach. Status: ✅ chosen · ❌ failed · ⏸ superseded or postponed · 🔁 worth retrying.

## 2026-10-07 ✅ Phaser 4 for the client, without the two-engine trial

The spec suggested building M1 in two engines and comparing. Phaser 4.2.1 was chosen directly: tile maps, crisp pixel scaling, WebGL with a Canvas fallback, and the largest community for 2D browser games. Evidence: the opening plays end to end in headless Chrome at 390 px (touch) and 1280 px (keyboard), `pnpm e2e`.
**Retry when:** the frame rate on a low-end phone is poor. Measure on a real device first. Model: claude-opus-5-5.

## 2026-10-07 ✅ Vercel previews for every pull request, not GitHub Pages

M4 needs a playable preview of each pull request; GitHub Pages has none. Vercel builds `main` for production and each pull request for a preview (`vercel.json`). A pull request from a fork waits for a maintainer to approve its preview build.
**Retry when:** the hosting plan or its cost changes. Model: claude-opus-5-5.

## 2026-10-07 🔁 Art from Nano Banana, stopped by the image quota

Nano Banana here is `gemini-3.1-flash-image` through Antigravity; the "2.1" name is unconfirmed. 12 images were generated before every signed-in account hit its weekly image limit (HTTP 429). The kit was completed with text-grid sprites (`tools/src/kit/sketches.ts`, written by Codex) and the importer (`tools/src/kit/import.ts`), which snaps any image to the 16 px grid and the 32-color palette.
**Retry when:** the quota resets (acc3 on 2026-10-13 21:48 UTC, acc4 about 2026-10-14 01:10), or another account is signed in. Model: claude-opus-5-5.

## 2026-10-07 ✅ A save is a state snapshot plus the last actions, not a replay log

A full replay log breaks as soon as content changes. A save holds the kernel and content versions (R5), the state, and the last 40 actions for bug reports. A save from older content is adapted by dropping ids that no longer exist.
**Retry when:** stage 2a verifies play on a server; the log becomes the source of truth then. Model: claude-opus-5-5.

## 2026-10-07 ✅ Item values from a simplified relaxation solver

`kernel/src/values.ts` settles each item's value by repeated relaxation over its sources (gathering, digging, recipes) instead of a full fixed-point solver. It is enough for the 15 core items, and the 10% drift budget against `content/values.lock.json` (R11) flags any surprise.
**Retry when:** content adds recipe cycles that do not settle. Model: claude-opus-5-5.

## 2026-10-07 ✅ Every action names the player's tile; travel time comes later

The kernel refuses an action unless `at` is walkable and within one tile of the target. It does not yet check that the player could have walked there since the last action.
**Retry when:** stage 2a, server validation; add the travel-time check then. Model: claude-opus-5-5.

## 2026-10-07 ⏸ No workshop recipe for tools yet

A workshop recipe that crafts the basket or the trowel gives them a computed value, and rule R8 (a shop never sells below that value) then clashed with the 30-gold price the opening is balanced around. The workshop place exists without a recipe.
**Retry when:** the shop pricing rule or the tool value formula is revisited. Model: claude-opus-5-5.

## 2026-10-07 ✅ Working title "Mistvale"

The product name is undecided. "Mistvale" appears in the game, the page title and the save key `mistvale.save.1`; renaming later needs a new key or a save migration. Model: claude-opus-5-5.

## 2026-10-07 ✅ Grid movement, and the clock stops while a window is open

Tile-by-tile steps (190 ms each) match the handheld look and keep every position an integer tile for the kernel. Game time pauses while any dialogue, menu or minigame is open, and one frame never advances more than 250 ms, so a background tab never fast-forwards the world. Model: claude-opus-5-5.

## 2026-10-07 ✅ Signs are map props that point at a slot

A sign names whoever filled its slot ("Added by ..."), reads "Mended by <player>" at a restored bridge, or says the place awaits restoration and offers the creator guide. `pnpm check` fails a sign that points at a missing slot. Model: claude-opus-5-5.

## 2026-10-07 ✅ The kernel refuses to build under the player's feet

A built camp part blocks its tile, so building where you stand would trap the player. The kernel refuses it, and the game only offers "Build" from a neighbouring tile. Model: claude-opus-5-5.

## 2026-10-07 ❌ idivUp returned -0

Found by Codex's property tests: `idivUp(-1, 3)` returned -0, which serializes differently from 0 and breaks the canonical hash (R3). Fixed with `|| 0`; covered in `kernel/test/num.test.ts`. Model: gpt-5.6-sol (found), claude-opus-5-5 (fixed).

## 2026-10-07 ❌ A on pointerdown let the browser's click close the window it opened

On a phone, A opened the cooking panel on pointerdown; the click the browser sends when the finger lifts then landed on the panel's backdrop and closed it. Found by `pnpm e2e` (phone run). Fixed by cancelling `touchend` on the pad and the A/B buttons.
**Retry when:** never; the e2e in CI guards it. Model: claude-opus-5-5.

## 2026-10-07 ✅ Browser tests over the DevTools protocol, without Puppeteer or Playwright

`game/e2e/` drives headless Chrome over CDP with Node's built-in WebSocket: no extra dependency, and nothing to download in CI, where the runner already has Chrome.
**Retry when:** tests need Firefox or Safari; switch to Playwright then. Model: claude-opus-5-5.

## 2026-10-07 ⏸ System sans body font for mobile dialogue and reading readability

`Pixelify Sans` remains for titles, buttons, numbers, and retro HUD elements. For body text (dialogue, panel bodies, item details, and creator guides) `--font-body` (system sans-serif) with generous line-height is used to prevent mobile reading fatigue on high-DPI screens. Model: antigravity.

## 2026-10-07 ✅ Character select appearance toggle (Male / Female)

Added general appearance toggle in the title screen character selection passing `look: 0` or `look: 1`. Starter sprites reflect `sprite` vs `sprite_alt` (`player_*` vs `woman_*`), and the world scene renders the chosen look. Model: antigravity.

## 2026-10-07 ⏸ Era themes and fine clothes postponed to town progression tiers

Starters begin in patched rough clothes. Fine attire and era-specific visual themes are deferred to future milestones when town expansion tiers are unlocked. Model: antigravity.

## 2026-10-07 🔁 Feedback round 1 continued by Antigravity after the Claude session ran out of credits

Antigravity (desktop app, Gemini 3.8 Flash Medium according to its transcript) finished the open items it could in about 15 minutes of edits and committed everything, including the Claude session's uncommitted work, as efc24ac. Its Gemini quota ran out at 10:25 (reset about 2026-10-14). `pnpm verify` passed; the browser test (`pnpm e2e`) was not run and fails at the first minigame, and the new interface pieces have no CSS. The handoff for the next pass lists both.
**Retry when:** another agent picks up the handoff in `.scratch/handoff/`. Model: claude-opus-5-5 (this entry), gemini-3.8-flash (the pass).

## 2026-10-07 ✅ Harder minigames: a miss keeps 0 or 1, and a jackpot strip

Elad asked for games that are harder but still simple: outside the zones the result is 0 or 1 at random, and a thin strip two marker-widths wide pays several times more. Grades are now 0-4. A miss keeps 1 unit with chance 50% + 10% per luck point (cap 90%). Grade 4 gives the same goods as perfect and 3x experience, so the rule that the grade only lowers goods below perfect still holds. Zones are narrower and widen 25% per agility point. Evidence: kernel/test/grades.test.ts and game/test/games/*.test.ts.
**Retry when:** playtests show the first quarry is too hard on a phone; widen the strike windows first. Model: claude-opus-5-5.

## 2026-10-07 ✅ A gathered node opens the way; a ready one blocks it

Elad: when something is quarried, the way should open. The kernel's walkable() is unchanged. The client adds one rule on top of it: a resource node that is ready blocks its tile, and a gathered one lies flat and faded and can be walked over until it grows back (canWalk in game/src/scenes/world.ts). It stays out of the kernel because actions name the player's tile and the kernel does not path-find.
**Retry when:** the server (stage 2a) validates movement; then the rule moves into the kernel. Model: claude-opus-5-5.

## 2026-10-07 ✅ Skill points with effects you can feel, shown as now -> next

Elad: the gaps between skill points were not meaningful. The per-point values grew to carry +10 places, senses +2 tiles, agility +25% zone width, luck +10% miss-keeps and +0.1 rare-find multiplier, stamina +20 food. The rare-find multiplier is capped by the character level, so early luck cannot buy a big spike. Every choice shows the real numbers, now -> next, from attributeEffects() in game/src/text.ts.
**Retry when:** the gap between a beginner and a veteran leaves the range the spec sets (stage 3). Model: claude-opus-5-5.

## 2026-10-07 ✅ Creator profiles and the creators board live outside the content tag

A creator's profile (name, role, designed signature) is a content file of type `creator`. The board (spec C-1) is content/board.json, written by `pnpm board` from the git history and committed, because a deploy builds from a shallow clone. Neither changes the content tag, so a renamed signature or a new commit does not invalidate saves. Points: 10 per content record plus 1 per commit. Hours: commits less than 2 h apart are one session, plus 30 min per session - an estimate, about 2 h with today's 8 commits, and the sign has to say so.
**Retry when:** accounts exist (stage 2a); then points and hours come from the server. Model: claude-opus-5-5.

## 2026-10-07 ✅ CREDITS.md is written by a bot after merges, not checked on pull requests

`pnpm credits --verify` left `pnpm verify`. The loop's `credits` job regenerates CREDITS.md on each push to main and commits it; Vercel's `ignoreCommand` skips a deploy whose last commit touched only that file (if `HEAD^` is missing the diff fails and the deploy goes ahead). Keeping the check would have made every proposal fail until its author regenerated a file the bot owns.
**Retry when:** credits stop being derived from main's history. Model: gpt-5 codex (wrote), claude-opus-5-5 (reviewed).

## 2026-10-07 ✅ The next-discovery vote starts by hand

The loop first opened a discovery vote hourly whenever none was open, so a closed vote would be followed an hour later by an identical one over the same documents. It now runs only from the Actions page (`discovery`). The weekly summary also got its own concurrency group, because a waiting run in the shared group is replaced by any newer pull request event.
**Retry when:** discovery documents carry a state (proposed, chosen) the loop can read. Model: claude-opus-5-5.

## 2026-10-07 ✅ Pixel font everywhere again, with its ligatures turned off

Supersedes "System sans body font". Elad played the preview and found the system body font too generic next to the pixel art, and saw letters missing. The missing letters were Pixelify Sans's broken "fi" ligature: "Fire" rendered as "Are" and "Campfire" as "CampAre". Fix: `font-variant-ligatures: none` and `font-feature-settings: 'liga' 0, 'clig' 0, 'calt' 0` on the page, `--font-body` points back to the pixel font, and body text is 16px or more on a phone (dialogue 18px). Retry the system font when: players report reading fatigue in long texts, and then only for the creator guide. Model: Claude Opus 5.5.

## 2026-10-07 ✅ The site is an Astro package beside the game, one Vercel project, the game at /play/

`web/` is a static Astro site (home, hub, docs, `/api/`), plain `.astro` and CSS, no React, no Tailwind. One build: bundle, game, site, then `game/dist` copied into `web/dist/play/`; `vercel.json` serves `web/dist`. Every pull request keeps its one preview, which the loop already posts as the trial world. The game's `base: './'` makes it run under `/play/` unchanged; two root-absolute URLs (the font in `style.css`, the landing hero) are fixed in the port. Rejected: plain Vite + TypeScript (layouts, markdown and routing by hand), Next.js (a runtime for pages that need none), a second Vercel project (two previews per pull request, no rewrite to a per-branch preview). Plan: docs/team/PLATFORM.md section 1. Waits for Elad's yes (question 3 of the platform message).
**Retry when:** a hub page needs per-user state beyond an island (stage 2a); then that page becomes an island or moves to the server app. Model: Claude Fable 5.1.

## 2026-10-07 ⏸ A landing splash in front of the game (feat/landing-page)

The branch put a splash with Players and Developers tabs before the title screen: two doors. It also does not compile (`landing.ts` references an undefined `openDev`; its class names do not match its CSS) and uses rgba scrims outside the palette. Its content is kept: the hero art, the pitch, the loop in four steps and the developer links move to the site's home page and hub, ported to tokens (docs/team/GRUNT.md items 5 and 7). After the port the lead tags the branch `attempt/2026-10-landing-splash` and deletes it.
**Retry when:** the game needs its own entry page apart from the site, for example an app-store listing that opens the game directly. Model: Claude Fable 5.1.

## 2026-10-07 ✅ One hub-data document, built by a tool, read by everything

`schema/src/hub.ts` defines `HubData`: the three versions, provenance per source, creators and reviewers boards, the registry of accepted content, the ruins map, requests, proposals, votes, the weekly summary, every ranking parameter, and `players` and `usage` as `null` until their stage. Emitted to `schema/json/hub-data.schema.json`, fixture and tests in `schema/test/`. Rules the tests pin: every number recomputes from the parameters in the document; a missing source leaves its section empty, never guessed; no vote counts or voters, no hours, no identities beyond published handles. `pnpm hub:data` (GRUNT item 3) builds it from the checkout and GitHub and degrades to `sources.github = null` without a token; the hourly loop rebuilds it and fires a Vercel deploy hook only when the content changed. Stage 2 serves the same document from the server and `pnpm hub:data --from <url>` fetches it; no page changes. Rejected: the site reading GitHub at build time page by page (every page a client, no provenance, no stage-2 path).
**Retry when:** the document grows past about 1MB; then split the registry and the loop into two documents behind the same schema. Model: Claude Fable 5.1.

## 2026-10-07 ✅ The stage-1 service runs as Vercel Functions with Upstash Redis in the same project

Spec S-1 needs visits, pickups, where players stop, and short reports before accounts exist. Astro server endpoints under `/api/s1/` in `web/`, deployed as Vercel Functions, with Upstash Redis from the Vercel Marketplace (free tier) as the store: counters per record and step, a capped list of reports, no identity, no cookie, a per-IP rate limit whose key dies with the minute. `pnpm hub:data` reads the counters into `usage`. Stage 2a inherits the endpoint contract and moves the keys. Rejected: the analytics vendor's custom events (reports do not fit, the read side is a paid API), a self-hosted endpoint (a server to run now; the CEOS server is not this project's). Waits for Elad's yes (question 4 of the platform message); nothing is built before it.
**Retry when:** the free tier's command budget is exceeded or stage 2a has its own store; then the four routes proxy to it. Model: Claude Fable 5.1.

## 2026-10-07 ✅ The creator MCP is read-only and runs on the creator's machine

`mcp/` holds nine tool definitions as TypeBox schemas with static types (`mcp/src/tools.ts`): schema, check, slots, requests, template, value, preview, guide, rules. Every answer carries `meta` (content format, MCP version, content tag, root). The package major equals `FORMAT_VERSION`; `mcp/test/tools.test.ts` asserts it, with at most nine tools, closed inputs, descriptions under 160 characters (they ride in every prompt). The line never crossed: the MCP writes nothing, holds no token, never talks to GitHub; the creator's agent writes into the creator's folder and the creator opens the pull request. The server (GRUNT item 15) runs over stdio against the checkout, registered by `.mcp.json`; npm publishing waits for the product name and a public repository. The API at stage 1 is files under `/api/` plus `llms.txt`. Rejected: a hosted MCP (needs auth and a server, and answers about a checkout the creator does not have), write tools that open pull requests (the loop's quota and account-age rules live on GitHub, not in a tool).
**Retry when:** a hosted MCP is wanted for creators without a checkout; it then serves the hub-data tools only. Model: Claude Fable 5.1.

## 2026-10-07 ✅ One token sheet and the pixel frame tie the site to the game

`design/tokens.css` holds the game's 21 colour tokens (all from the 32-colour core palette), the pixel unit, two faces, a type scale (nothing read below 15px), spacing steps and the frame. `tools/test/design-tokens.test.ts` fails on any hex outside the palette, on rgba, gradients or a radius, and when the game's `:root` copy drifts; the game imports the sheet in GRUNT item 2. Display face: Pixelify Sans everywhere, as decided earlier today; the site's reading text is Atkinson Hyperlegible (OFL, self-hosted), chosen over Inter and the system stack (generic) and over a serif (the default of templated sites). The signature element is the 2px frame with a hard 4px offset shadow; one accent per page; icons are core-kit sprites at 2x and 4x. The site uses nine named tokens and no hex of its own. Every page ships with measurable criteria (PLATFORM.md section 5.5).
**Retry when:** players or creators report reading fatigue on the hub's long pages; then test the reading face at 18px before changing it. Model: Claude Fable 5.1.

## 2026-10-07 ✅ The hub shows the loop and never casts

Requests, proposals, votes and the weekly summary are shown from hub-data with a link to their GitHub page each; the hub has no vote button, no request form, no approval control. The loop's rules (account age, quota, approvals on the current head) live on GitHub, and a second place to act would need the same rules twice. Votes show the loop's published display (`bar`, `percent`), never a count. Tests: the loop section has no `<button>` and no `<form>` (GRUNT items 7 and 10). Rejected: a hub that casts through a GitHub app (a token with write scope on a public site, and a second implementation of every rule).
**Retry when:** accounts exist (stage 2a) and the server, not the site, can act with the loop's rules. Model: Claude Fable 5.1.

## 2026-10-07 ✅ Points are parameters, hours are not published, nothing is called credits

Creator points stay 10 per record and 1 per commit, now as `.github/points.json` (`per_record`, `per_commit`, `per_approval` 5, `weekly_pool` 1000, `weekly_pool_active` false); `board.ts` reads it (GRUNT item 1) and hub-data copies it into `parameters.points`, so a weight changes by a visible pull request. Hours leave `board.json`, `BoardEntry` and the game's creators panel: squash merges collapse a creator's work into one commit, so a session estimate is meaningless for everyone but core; `commits` takes the field's place. Reviewer points: `per_approval` for each approving review that counted on a merged proposal, by someone other than the author, computed by `pnpm hub:data` from GitHub. Nothing is called credits until D5 has a formula: `CREDITS.md` stays attribution, the rules page says "fund 40% of net income, formula open, no income yet". The weekly pool stays inactive until usage exists and is then shared by usage, never by seniority.
**Retry when:** D5 is answered; then credits get their own document and the pool its rule. Model: Claude Fable 5.1.

## 2026-10-07 ⏸ Player and gold boards wait for accounts (stage 2a)

A player board needs a verified number, and only the server of stage 2a can verify one; a board from unverified saves is a board of whoever edits local storage. hub-data carries `players: null` with the schema of the three boards (wealth, collection, professions) already in place, and the boards page says "opens with accounts" with no number.
**Retry when:** stage 2a's server computes the boards; then the server fills `players` and the page shows them without a change to its shape. Model: Claude Fable 5.1.

## 2026-10-07 ⏸ The browser playground waits for the MCP and an fs-free tools package

Editing a record in the browser and seeing it in the game needs `tools/` without the file system and a game build that takes a bundle at runtime; the MCP work (`value` tool, temporary roots) touches both first. Until then the pull request preview is the playground and the MCP's `check` and `value` answer before a pull request exists. The idea is entered in the loop as a capability request so demand is measured before the work.
**Retry when:** the capability request reaches the open-call threshold, or the MCP's `value` tool is in use and the fs-free refactor is done. Model: Claude Fable 5.1.

## 2026-10-07 ✅ CI keeps one required job and skips the expensive steps by changed paths inside it

The required check "Check, test, build and play" is named in `.github/loop.json` and in the branch rule; a path-filtered workflow would leave it "Expected" on a docs-only pull request and block the merge. Instead a first step lists the changed paths and the game build, the e2e run and the site build get `if:` conditions on them (GRUNT item 9); lint, types, schemas and unit tests always run. `pnpm verify` gains the site build and tests when `web/` exists.
**Retry when:** GitHub lets a required check pass on a skipped job without a dummy run. Model: Claude Fable 5.1.

## 2026-10-07 ✅ Three versions, one release note format

Code is the kernel package version (tags `v0.<stage>.<n>` on `main`), content is the bundle tag (a hash of the canonical content), the site is the commit and build time; hub-data's `source` carries all three and the hub footer prints them. A release note in `CHANGELOG.md` has three headings in a fixed order: what players notice, what creators notice, what changed underneath (the three versions); a format change adds "Format: n" and moves the MCP major. The environments ladder (local, pull request preview, develop preview, production) needs nothing new.
**Retry when:** the content moves out of the repository (stage 2); then the content tag is the server's and the note links it. Model: Claude Fable 5.1.

## 2026-10-07 ✅ Secrets live in Vercel and GitHub settings; the repository holds names only

`HUB_GITHUB_TOKEN` (read-only) and the Upstash pair in the Vercel project; `VERCEL_DEPLOY_HOOK` as a repository secret; `GITHUB_TOKEN` from Actions. `.env.example` lists the names with no values; `.gitignore` already refuses `.env*`. Every consumer degrades without its secret (a build without the token still succeeds, the refresh step skips without the hook) so a missing secret is a missing section, never a red build.
**Retry when:** a secret has to be shared with a creator's machine; it must not, so the design changes instead. Model: Claude Fable 5.1.

## 2026-10-07 ✅ The rules of play are one page the owner holds, a check that cites it, and a protocol for collisions

Three things in the preview broke the loop (a shelf that is a menu built as a camp, town quests that are counters, inscriptions that pay nothing) and nothing in the repository guarded against them: a developer's idea or an AI with a free hand fills a quest with the easiest thing that validates. Now `docs/design/GAME_RULES.md` holds five pillars, the hook ladder, rules G1-G16, the forbidden patterns and the review checklist; `tools/src/play.ts` in `pnpm check` tests G2, G4, G8 and G10 on core and extensions and prints the rule it cites; `AGENTS.md`, `CONTRIBUTING.md`, `WORKFLOW.md` and the handoff template send every agent, creator and session there. A request that collides with a rule is neither built nor bent: it goes to the owner in five plain Hebrew lines with a recommendation, and his word lands here the same day. The free tools surveyed in `docs/design/TOOLKIT.md` are design-time aids (Puzzlon charts, Twine prototypes, Machinations models); none was adopted into the build.
**Retry when:** a rule proves wrong in a playtest; it changes here first, then on the page. Model: Claude Fable 5.1.

## 2026-10-07 ⏸ The play rules warn until the core content is rewritten

The `play` rules are warnings, not errors, because the shipped core content breaks them: an error would turn `develop` red before the owner has ruled on the fixes (GAME_RULES.md section 5, GRUNT P-1 to P-3). They become errors in the pull request that rewrites the content, by flipping `PLAY_LEVEL` in `tools/src/play.ts`.
**Retry when:** P-3 merges. Model: Claude Fable 5.1.
