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

## 2026-10-07 ⏸ Working title "Mistvale"

The product name is undecided. "Mistvale" appears in the game, the page title and the save key `mistvale.save.1`; renaming later needs a new key or a save migration. Model: claude-opus-5-5.

## 2026-10-07 ✅ Grid movement, and the clock stops while a window is open

Tile-by-tile steps (190 ms each) match the handheld look and keep every position an integer tile for the kernel. Game time pauses while any dialogue, menu or minigame is open, and one frame never advances more than 250 ms, so a background tab never fast-forwards the world. Model: claude-opus-5-5.
**Superseded in part (10.10):** from stage 7 a world's hour stops for no window, and a minigame only keeps the hazards from striking (the entries on the shared world and on the game read as one line).

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
**Superseded in part (10.10):** a miss no longer keeps 0 or 1 of the node's item; it turns up something from the node's miss table (the entry on a missed gather). The jackpot strip stays.
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

Spec S-1 needs visits, pickups, where players stop, and short reports before accounts exist. Astro server endpoints under `/api/s1/` in `web/`, deployed as Vercel Functions, with Upstash Redis from the Vercel Marketplace (free tier) as the store: counters per record and step, a capped list of reports, no identity, no cookie, a per-IP rate limit whose key dies with the minute. `pnpm hub:data` reads the counters into `usage`. Stage 2a inherits the endpoint contract and moves the keys. Rejected: the analytics vendor's custom events (reports do not fit, the read side is a paid API), a self-hosted endpoint (a server to run now; this project has none). Answered yes on 2026-10-08 (that day's first entry); items 17-19 wait for M3 only.
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
**Retry when:** P-3 merges. Closed 8.10 by the pull request `feat/p3-content`; the 2026-10-08 entry "The core content passes the play rules" says what changed. Model: Claude Fable 5.1.

## 2026-10-07 ✅ The owner ruled on the five breaches, and added the variety rule

The owner, the same evening, said yes to all five rows of GAME_RULES.md section 5: the collection shelf stops being a build (P-1); three-fruits and herbs-for-pell become finds with a clue; a-coin-for-maru gets its catch; one riddle over the three ruin stones, and the other four inscriptions are cut until an arc names them; rewards that change play. His addition, in his words: collecting in the game must not be one style; like Skyrim, The Witcher and Fallout, different quests and their actions answer different player psychology. That became rules G17 and G18 and the palette of twelve quest types in GAME_RULES.md section 3, `quest.type` in P-2, and a G17 line in the check once the field exists.
**Retry when:** a palette type has no quest after P-3; then the palette shrinks, not the rule. Model: Claude Fable 5.1.

## 2026-10-07 ✅ Dialogue has rules of its own: every line does one job, one voice per character, the player pulls

The owner asked whether language and talk were covered; they were only by the two-line box rule. Now GAME_RULES.md section 3 has G19-G23 (one job per line, a voice sheet per character, the player pulls with a first meeting of three boxes at most, plain words for all ages with the valley's own names, real talk choices), four proposed voice sheets (Maru, Pell, the narrator, signs) waiting for his word, and `pnpm check` counts boxes over the limits per character. Maru's eight-box first meeting is a known breach, fixed with P-3. English stays the only language until the owner decides on a language field.
**Retry when:** the owner edits a voice sheet; the lines follow the sheet, never the other way round. Model: Claude Fable 5.1.

## 2026-10-07 ✅ Sound, fairness and access have rules, and the page says what it does not cover

The owner asked about sound and what else was missing. GAME_RULES.md section 3 gains G24-G27 for sound (every beat has a sound and every sound a beat, the rare find is heard, music is the clock, nothing important lives only in sound), G28 against dark patterns (the valley waits; no punishment for absence, nothing to pay for) and G29 for access (the basic tier of the Game Accessibility Guidelines), and a coverage table naming what lives elsewhere (FTUE, kernel rules, art rules, community loop) and what is not written yet (difficulty curve, a performance budget, a second language). These rules live in code, so the checklist and the e2e audio line cover them, not the content check.
**Retry when:** the first play data arrives from the hub; the difficulty row then gets its page. Model: Claude Fable 5.1.

## 2026-10-08 ✅ The four platform questions are answered: public, a name by vote, Astro, the stage-1 service

The four questions of PLATFORM.md section 11 (asked 7.10) got their answers on 8.10; the owner's merge of the pull request that carries this entry is his word on them. (1) The repository goes public, with care: no key or secret anywhere in the tree or the history, and no private name, host, address or path of anyone's machine. The checklist before the switch: a secret scan of the whole history with a real scanner (a grep over every commit on 8.10 found no key, no private key, no env file); a grep for private names and hosts (8.10: two stray mentions of a private server name in two docs, reworded in this pull request; the words remain in those files' history, and the owner decides whether to rewrite it before the switch - recommended no, a name is not a secret); `SECURITY.md` with a private report address; the P-1 rules page live; branch protection on `develop` and `main`. (2) The name is not decided; the first community votes on it, from the shortlist in the next entry. Until then the save key and the package names keep `mistvale`; the rename lands before the first public link. (3) Astro for `web/`: yes; GRUNT item 4 starts. (4) The stage-1 service on Vercel Functions with Upstash Redis: yes; items 17-19 wait for M3 only.
**Retry when:** the vote picks a name; then the rename is one pull request (save key, package names, site URL). Model: Claude Fable 5.1.

## 2026-10-08 ⏸ Name shortlist for the community vote

Short, one word, easy to say, and made of the valley's own things (the mist, the bells, the hollows, the lanterns). Checked on 8.10 for an existing DNS record only: "free" means no record, not a registrar check, so the registrar has the last word. Free as `.com` and `.io`: Mistwend, Hollowbell, Lanternfog, Thistlefog, Ringvale, Mistlings. Free as `.io` only: Bellhollow, Foghollow, Mistbell, Hushvale, Greyvale, Bellmere, Fogbound, Mendvale, Hollowmist, Mistfolk. Taken as both: Mistvale, the working name. Recommended ballot: Mistwend, Hollowbell, Lanternfog, Ringvale, and Mistvale as "keep the name" with a `.game` or `.io` domain.
**Retry when:** the community adds names; the ballot is the owner's. Model: Claude Fable 5.1.

## 2026-10-08 ✅ The voice sheets stand, the first meetings shrink, English is the only language

The three open rows of GAME_RULES.md (asked 7.10) got their answers on 8.10, by the same merge: the four voice sheets (Maru, Pell, the narrator, signs) are approved as written; Maru's first meeting goes to three boxes and Pell's standing lines to two, with P-3; and there is no second language: the game and every file in the repository are English, so G22's open question closes and a language field stays a format decision for a day that may not come. The Hebrew template in GAME_RULES.md section 6 and the Hebrew summary of `docs/kernel-review-v1.md` are English from this pull request. `docs/team/INTRO_HE.md` stays Hebrew on purpose (an intro for a Hebrew-speaking team), and the two spec HTML files keep the language they were written in, as the archive of the original spec.
**Retry when:** a creator community in another language forms; then the language field, never a copied folder. Model: Claude Fable 5.1.

## 2026-10-08 ✅ universal-modder is the asset sidecar: the sprite commands and the fal recipes, in a venv, never as a plugin

The art had no tool for a new sprite or a walk cycle; a creator drew by hand or pasted an AI picture into the importer one frame at a time. universal-modder (MIT, Python; a toolkit for agents that mod PC games) carries three parts that fit: `um sprite` (an idle from one frame, sheets, a nearest-neighbour fit, a palette snap, pixelation), `um fal` (a sprite from a prompt with a transparent background, the same character in a new pose for walk frames, sound effects, music, voice; a fal.ai key on the creator's own account) and the 3D route (`model3d`, `rig`, `render3d`: one model rendered to consistent headings and animations with Blender). Adopted as a sidecar in its own virtual environment, upstream of `pnpm kit:import`, which stays the last word on size and palette. Not adopted: the Claude Code plugin (every skill and the fal tools in every prompt), the modding parts (recon, reverse engineering, Windows automation, mashups, publishing), its knowledge base (ours has its own shape), local ComfyUI (needs a GPU). Proven 8.10 on Python 3.14 without a GPU: `um sprite frames` on the elder sprite kept 16x24, hard alpha and the eleven colours. The direction for the art's growth (pixel now; 3D sources rendered to sprites as the cast grows; a 3D valley of the World of Warcraft kind on a browser engine as the aspiration, decided with data) and five recommendations for the owner are `docs/design/ASSET_PATH.md`.
**Retry when:** the first creators' kits show what the recipe misses, or fal's catalogue changes the default models (it changes weekly; `um fal search`). Model: Claude Fable 5.1.

## 2026-10-08 ✅ The valley has a dangerous hour: health replaces the food bar, the night and the mist hunt, a fall is clear and costs the outing

The comparison with World of Warcraft and RuneScape (`docs/design/GAP_WOW_RS.md`) found no dangerous place in the valley: nothing happens in the ruins at night that cannot happen at noon, and no player can name "the thing I am doing" the way a dungeon names it. The owner's word (8.10): danger comes in, without combat. Falls, deep water, a hunter's trap, a bad herb and predators (a wolf) are hazards that act by rules, not enemies; a lit lantern, thrown food and the road are the answers to a predator, and combat stays at stage 8 or a vote. The hazards that hunt act only after dark or inside the mist, outside the town and the player's camp, which are safe at every hour, and by day they show and can be walked around; what the player picks or eats (a bad fruit) hurts at any hour, so a fall at noon is possible. The food bar becomes the health bar: hazards take health; food, a first-aid kit from the stall and a night's sleep give it back; nothing drains it by the clock (the hunger timer is gone; G28). Nobody falls unwarned: a countdown to nightfall at the screen's edge while outside a safe area (with a banner in the first levels), and one warning box with the lantern lit when the player leaves a safe area after dark or dark arrives outside one. At zero health the player falls: crosses for eyes, the body sinks into the ground, one plain box, no gravestone and nothing left in the world; the player reappears in the town they were last in, on a random tile inside its bounds; what was gathered on that outing is lost, a quest in progress starts again from its first step, and nothing says where the fall was (the owner's correction the same evening, replacing a softer first draft that left the finds at the spot with a pin: the cost is the lesson); the bag from before the outing, the camp, the gold, the levels and the finished quests are untouched. The concept gains a row at the stall: every hazard has one thing to buy (a first-aid kit, lantern oil, an antidote, a rope, dried meat) and one thing to make (a bandage from herbs, a torch from wood). Rules G30-G35; the work is GRUNT P-5, after P-2.
**Superseded in part (10.10):** a hazard is escaped, never answered by an item (the entry on a hazard escaped), and the hunger timer stays until P-5 (the entry on the hunger clock). After a fall each item keeps the smaller of its counts at the outing's start and at the fall, and a quest goes back to the step it stood at when the outing began, not to its first step (the entry on the world and its clocks). A safe place is the town, any ground at danger level 0 and a camp whose fire burns, an outing runs from leaving one to reaching one again, and the lantern lit with the warning is a sign that keeps nothing off (the entry on the game read as one line).
**Retry when:** the first expedition's play data shows the fall rate (a fall more than once a night for most players means the hazards are too dense; none in a week means they are decoration). Model: Claude Fable 5.1.

## 2026-10-08 ✅ The expedition is the valley's dungeon; the night ruins first

What the two reference games call a dungeon (enter, a chain of problems, a climax, loot, a way to fail) had no container here. The owner's word (8.10): yes to the expedition form, the night ruins first, after P-2 and P-3. A place entered under a clock (the bells), three to five problems of different types inside (G17) with hazards among them (P-5), a climax at the last bell, a reward that opens a place by day, and a soft failure: what was not found waits for the next night, what was carried out stays, and a fall inside it follows the falling entry. An expedition is never the only road; the valley by day goes on without it (G37). Rules G36-G37; the work is GRUNT P-6, after P-3 and P-5.
**Retry when:** the first expedition has been played by people outside the team and the journal shows where they stopped. Model: Claude Fable 5.1.

## 2026-10-08 ✅ Stage 2a after the stage-1 service, on functions; the site, the hub, then the MCP server, each in its own pull request

The owner's word (8.10) on the two remaining questions of `docs/design/GAP_WOW_RS.md`. Stage 2a (accounts and the server) is designed only when the stage-1 service (M5) is live and has numbers, and runs the same way: functions on the site's host with a managed database, no machine to operate; the spec's dedicated server (its section 15) waits for stage 7, the first stage with a live connection per player. The developer surface and its site are built next, in this order and each in its own pull request into `develop`: M2 the site, M3 the hub pages, M4 the MCP server once the repository is public. The owner keeps item 2 (the token sheet) and the content, and merges.
**Retry when:** M5's numbers are in (the design of 2a), or the name vote closes (the first public link). Model: Claude Fable 5.1.

## 2026-10-08 ✅ Two step kinds, no format bump: `find` and `riddle` enter the quest schema, props get ids, quests get a type

GRUNT P-2, the schema every row of GAME_RULES.md section 5 waits on. `find` is a bring of one item that only digging gives, with a clue the journal shows instead of a count (the check refuses a find of anything gathered, made or sold: a find must be found). `riddle` carries a clue, the ids of the map props it reads, and its answer: a dig at a named spot, or standing in a named slot by day or by night (night is 20:00 to 05:00, the hours the client darkens fully); the kernel completes it on that event and on nothing else, keeps the solved steps in the save (`player.solved`), and a save from before this day gets an empty list on load. Map props may carry an `id`, unique on the map; `quest.type` is one of the twelve palette keys, optional until P-3 declares it on the core content, then required. `FORMAT_VERSION` stays 1: an old file reads the same. The check counts both kinds as beats (G2), reports each note prop with an id that no riddle cites by its id and the unnamed ones in one count line (G8), and names two quests of one type in a row and fewer than five types among the first ten (G17). The client shows the clue in the journal and its first sentence in the tracker, never the answer, and tries a slot an open riddle names on every entry, by day or by night, and again when night falls or lifts. The template gains a quest with a find. No content changed; the warnings are the same until P-3.
**Retry when:** P-3 writes the first riddle and the first finds; if a creator's riddle needs an answer that is neither a dig nor a place (a craft, a talk), the answer union grows then. Model: Claude Fable 5.1.

## 2026-10-08 ✅ The core content passes the play rules: two timed finds, one riddle, three boxes for Maru, errors from here on

GRUNT P-1 and P-3 in one pull request (`feat/p3-content`, stacked on P-2), closing the six rows of GAME_RULES.md section 5. The shelf is gone (P-1): the camp file and the branch that opened the journal from it; the `shelf` slot stays empty. "Where the bells rang" (three-fruits) is a `find` of a bellberry from two bell bushes in the garden behind the ruins, open 05:00 to 20:00; "Herbs for Pell" is a `find` of a sunleaf from the sun bank up the river, open 11:00 to 14:00 with a basket, and it teaches herb stew. Both are new plants with items of their own, because the P-2 rule holds: a find of what the stall sells or what grows in three places is a counter with a clue on it. The rule widened by one case: an item that exactly one timed plant gives, and nothing makes or sells, is findable (`findableItems` in `tools/src/play.ts`), so a creator can build a find around a plant that opens at an hour. "The coin under the lantern" (a-coin-for-maru) is the first `riddle`: the marked stone by the river, the town lantern and the hill lantern carry ids and two-line clues; the answer is a dig at a new one-spot treasure under the hill lantern that always gives Maru's coin; a dig anywhere else while the riddle is open gives what that spot gives and the line "Not here. Read the stones again." The four notes no riddle cites are cut (the stone head, the scratched names, the cold arch, the totem); the props stay, and the notes return with the arc that names them. The coin's reward is Maru's basket: the schema has no place reward, and the quest needs a trowel, so the basket opens the grove to a player who chose the ruins first; the elder's house opening waits for a place reward. Every core quest names its type (skill, mastery, investigation, fetch_twist, discovery, riddle), and a quest without one is a G17 line. Maru's first meeting is three boxes with the rest behind his three topics, Pell's standings are two boxes, every box is within 80 characters. `PLAY_LEVEL` is `'error'`; the tests that pinned the warnings now prove a clean core and a fixture that breaks each rule. Three new value anchors (bellberry, sunleaf, Maru's coin); none of the thirteen moved.
**Retry when:** a place reward enters the schema (then the coin opens the elder's house, as the owner ruled), or the asset sidecar draws a dark berry and a sunleaf of their own (today both reuse the berry and herb sprites). Model: Claude Fable 5.1.

## 2026-10-09 ✅ Crafting and money: power is never sold; a look may carry a marker for a later premium sale

The brief for the crafting core (9.10) said that some advanced craftables may later give something obtainable only with paid credits. The question (crafting audit Q1): what may money ever buy around crafting? The owner's word (9.10), the audit's recommendation: no crafted ability, recipe or material is ever sold or gated for money. The fixed commitment stands: power is not sold, and an advantage in the game is obtained only inside the game (spec sections 5 and 17); an item with an advantage is found, made in the workshop or bought with gold, never sold for premium currency or money (spec section 8); nothing to pay for (G28). The hook for later is a marker that only a look item with no effect may carry, meaning it may be sold for premium currency once stage 6 brings that currency (spec section 8: a look item can be found in the game as a treasure and later bought with premium currency; section 16). The check refuses the marker on any other item, and a marked look keeps a way to get it in the game.
**Closes:** crafting audit question Q1 (`docs/design/CRAFTING_AUDIT.md`, section 5).
**Retry when:** stage 6 (cosmetics and payments) designs the premium currency. Power stays unsold: a fixed commitment. Model: claude-opus-5-5.

## 2026-10-09 ✅ Crafting is optional: a player who never crafts progresses by the roads already written

The question (crafting audit Q2): the brief makes crafting optional and named war, theft and robbery among the other roads. The owner's word (9.10): yes to the audit's recommendation. A player who never crafts progresses by the roads the rules already carry: hard quests, treasure and digging, riddles and investigation, mastery of the minigames, the expedition (G36-G37, GRUNT P-6) and reputation, fenced by profession or character level where a road needs it. War, theft and robbery stay out: combat waits for stage 8 or a community vote (G35, spec section 16), and taking from a player who is away would punish absence (G28). The owner added two things: further roads that fit the rules are welcome as proposals, and the community should be able to make roads too. An extension can already add quests (riddles and finds among their steps), treasures, resources and characters on the existing verbs (`CREATOR_TYPES` in `schema/src/index.ts`; spec section 10); a road that needs a new verb goes through the requested-capabilities list (spec section 11).
**Closes:** crafting audit question Q2.
**Retry when:** stage 8 or a vote opens combat, or a new road is proposed. Model: claude-opus-5-5.

## 2026-10-09 ✅ One craft verb; a recipe names the profession that gates it

The question (crafting audit Q3): one crafting skill, or several? Today the craft verb belongs to cooking alone: one profession trains each verb (`tools/src/assemble.ts`), and a recipe's level is documented as "Cooking level required" (`schema/src/index.ts`). The owner's word (9.10): the audit's recommendation. A recipe may name its profession, and without one it takes the profession of its station. There is one profession per verb and station family (cooking at the fire; a workshop craft such as carpentry, or later smithing, gates its own recipes), and the craft verb stays one verb. For now a profession arrives in a core release (`profession` is a core-only type); the spec places a profession that uses the existing verbs at authority level 1, a data file a creator can submit (spec sections 5 and 11), which is where the extension reach of Q12 leads.
**Closes:** crafting audit question Q3.
**Retry when:** a second craft profession is designed, or the extension reach opens professions (Q12). Model: claude-opus-5-5.

## 2026-10-09 ✅ A craft can miss: skill decides, luck tilts, a miss keeps something

The question (crafting audit Q4): what happens when a craft fails? Today a craft that passes its gates always gives its full output and draws nothing (`kernel/src/step.ts`). The owner's word (9.10): luck plays a part in crafting too. A craft has a chance of success, and the player raises it with luck stones and with the character's luck. The rules already written bound it: skill decides and luck only tilts the chance (spec section 5: luck tilts chances and does not replace skill); a miss keeps something, never nothing (G15, pillar 5); a draw is f(seed, entity id, counter), so a craft stays replayable (R4), and the luck draws move to the server with stage 2a (spec section 16); a luck stone gives an advantage, so it is found, made or bought with gold, never sold for premium currency or money (spec sections 8 and 17). The value table keeps pricing a recipe at perfect execution (R6), so luck and luck stones only close the gap to that output and never pass it: nothing lifts the output of an activity with inputs (R9), and the combined multiplier stays under the level's power cap.
**Closes:** crafting audit question Q4.
**Retry when:** playtests show a miss that feels like a punishment (G15), or a luck stone that every craft needs. Model: claude-opus-5-5.

## 2026-10-09 ✅ Crafting wave 2 as built: a sure first tier, half kept on a miss, worn items stay in the bag

The kernel wave (crafting audit section 6, wave 2) needed readings beyond the owner's words on Q1, Q3, Q4, Q6 and Q9. Each number is a core parameter or a schema field, so a vote can move it.

- The profession: a recipe is gated and trained by `recipe.profession`, else by the craft profession that works its station (the bundle's `stations`). Several craft professions may exist, one per station; the craft verb's own is the one at the fire. A technique's craft effect (`craft_speed_pct`, `craft_chance_pct`) helps its own profession's recipes only.
- The station: a recipe's tier is the highest tier among its outputs, and it runs at a built camp part that provides its station at that tier or above. A camp part may name `upgrades`: it is built over that part, in the same slot, replaces it, and gives at least what it gave; the check holds that.
- The chance: `craft_chance_bp` by recipe tier (10000, 8000, 6500 at launch; tier 1 is a sure craft, so the opening teaches the verb without a miss), plus `craft_level_step_bp` (500) for each profession level above the recipe's, up to a sure craft. Luck then closes part of the gap that is left: the character's luck and `craft_chance_pct` from techniques and worn pieces (a luck stone is a jewelry piece that carries it), never more than `craft_luck_max_permille` of the gap (half at launch), and only inside the level's power cap, so luck does not tilt at character level 1. One R4 draw per try: entity `craft:<recipe>`, counter the character's tries of that recipe.
- The miss: a recipe may name `miss`, the share of each input to keep (0 to 90 percent), and a miss makes nothing else (see "The crafting economy" below). Left out, a miss keeps `craft_miss_keep_pct` (half) of each input, rounded down; when that leaves nothing, one unit of the most valuable input comes back. A miss trains the profession as much as a success (pillar 5) and does not count as made. The check refuses a miss worth as much as a success, and a craft chance that rises with the tier.
- Worn items: an item with `wear` names its slot (head, top, legs, outfit, feet, jewelry, hand), up to two effects from the worn list (gathering, digging and crafting speed, the craft chance, rare finds), each at most `wear_effect_max_pct` of its tier (5, 8, 12 percent), and a set of its own creator. A full set adds `wear_set_bonus_pct` (20 percent) of its pieces' sum. A worn item stays in the bag and comes off when its last unit leaves. The hand carries a tool's worn effects, while gathering still uses the best tool in the bag. Garment and jewelry pieces are always worn; a tool may be held.
- The look layer: `wear.look` puts an item on the look layer of the same slots, with no effects and no set. `premium_later` is allowed only there, and such a look stays obtainable in the game: a node, a dig spot, a recipe, a shop for gold or a quest.
- Two fixes from the review of wave 1: a template's recipe ids join the template id and the items' ids with "+", which no written id holds, so two ids never meet; and a new version of the world teaches a saved character its new start recipes.

**Closes:** CR-9 and CR-15 (crafting audit, Appendix D).
**Retry when:** playtests show tier-2 misses that feel like a punishment, a set bonus that every crafter needs, or stage 6 draws the look layer. Model: claude-opus-5-5.

## 2026-10-09 ✅ The material grammar: base classes from the core, more classes from extensions

The question (crafting audit Q5): how is a material described, so that the combinations can grow without end? Today an item has a kind and a rarity and nothing that groups materials (`schema/src/index.ts`). The owner's word (9.10): a base list of classes, and a way to extend the classes. So every item a recipe can use names a class; the core owns a short list of base classes (the audit proposes it); an extension may add a class of its own, declared under one of the base classes, so that every rule written for a base class holds for it too. A family and tags are open to extensions, and each item has a tier (the ladder is crafting audit question Q6). Recipes name items; a recipe template names a class and a lowest tier, and the assembler expands it into a bounded set of concrete recipes, so the kernel and the value table still see only concrete recipes (R6, R7).
**Closes:** crafting audit question Q5.
**Retry when:** an extension needs a class that fits under no base class. Model: claude-opus-5-5.

## 2026-10-09 ✅ Rare value comes from capacity and gates, paid by work and chance

The question (crafting audit Q7): the brief wants advanced materials that appear once in a long while, and waiting is never paid (R6: waits and respawns are capacity and never count as time). The owner's word (9.10): the audit's recommendation. Rarity is made of capacity and gates: how many nodes there are, how slowly they return, the hours they are open, the level and the tool they need, and the find tables of treasures. The value certificate pays for the work and the chance (R7). The rarity bonus stays inside its budget (`rarity_budget_permille`, 10% of the base cost; `docs/kernel-review-v1.md` section 8.2), and a change to that budget is a parameter decision within its bounds (R12; spec section 13 puts the rarity budget among the parameters the community votes on). No event timer and no "last chance" makes anything rare (G28).
**Closes:** crafting audit question Q7.
**Retry when:** play data shows a rare material that is not rare inside the budget. Model: claude-opus-5-5.

## 2026-10-09 ✅ A long recipe is a chain of short steps

The question (crafting audit Q8): the brief wants advanced recipes to be long, while every action is bounded (`max_action_ms`, 15 s today) and waiting is never paid (R6). The owner's word (9.10): the audit's recommendation. A long recipe is a chain: intermediate items made at stations, one tier per station step, each step a short action inside the cap, with no single long timer anywhere. The journal shows the question, not the whole chain (G3: at most three steps visible at once).
**Closes:** crafting audit question Q8.
**Retry when:** players read a chain as a chore (pillar 3), or a chain needs a step that no station can give. Model: claude-opus-5-5.

## 2026-10-09 ✅ Metal: the grammar is ready, the content waits for its discovery

The question (crafting audit Q11): the brief named iron among the materials, and the launch is the period before metal (spec section 8). Metal is one of the next discoveries, chosen by the community (spec section 8), or proposed as a profession on the existing verbs (spec section 11). The owner's word (9.10): the audit's recommendation. The grammar carries mineral and metal classes from the first wave; iron and every other metal content wait for that discovery. The first chains use wood, stone, fibre and clay-class materials. The owner added: the next town may bring further minerals.
**Closes:** crafting audit question Q11.
**Retry when:** metal is discovered (a vote or an accepted proposal), or the next town is designed. Model: claude-opus-5-5.

## 2026-10-09 ✅ Extension reach: as far as it can be made safe, opened stage by stage

The question (crafting audit Q12): what may an extension add to crafting? The owner's word (9.10): as far as we can. The first stages stay focused; the aim is that the community and outside developers create almost without end, and the team only verifies and approves, helped by automation. Now an extension may add items (with class, family, tags and tier), classes under a base class (Q5), recipes and recipe templates, resources, treasures, camps that provide an existing station, and quests. It may not yet add a verb, a station, a profession, an effect or a parameter. Each later opening comes with the checks that make it safe, and the reserved roadmap in the audit names the next ones (a furnace, a pickaxe, a smelt or mine verb, a fourth profession). This follows the spec's authority levels (section 11: content and professions on the existing frame pass an automatic check and testers, new mechanisms in code are approved by human reviewers, the core is checked and merged by the core team), its rule that a new verb enters in a core release (section 5), and the path for core code from outside developers (`docs/kernel-review-v1.md` section 8.4).
**Closes:** crafting audit question Q12.
**Retry when:** a stage opens a new path: 2b (the requested-capabilities list), 8 (creators' code). Model: claude-opus-5-5.

## 2026-10-09 ✅ The workshop makes better tools that no shop sells; the 30-gold tools stay

The question (crafting audit Q10), asked again in plain words: the workshop recipe for tools has waited since 7.10 ("No workshop recipe for tools yet", above), because a recipe gives a tool a computed value, and R8 (a shop never charges less than that value) then clashed with the 30-gold price the opening is balanced around. The owner's word (9.10), the recommendation: the workshop makes tools of a higher tier that no shop sells, so R8 has no shop price to clash with; the basket and the trowel stay in the trader's shop at 30 gold, and the opening does not change. The workshop's part is the upgrade (spec section 8 names it the camp slot for making tools instead of buying them). A workshop recipe for a tool a shop sells stays out until such a recipe fits under the shop's price, which the check already enforces (R8).
**Closes:** crafting audit question Q10, and the parked entry of 2026-10-07 in this narrower form.
**Retry when:** the opening's tool price changes for another reason. Model: claude-opus-5-5.

## 2026-10-09 ✅ Two ladders: an open-ended tier for how advanced, the four rarities for how often

The question (crafting audit Q6): the owner asked for a ladder wider than the four rarities, measured against other games and opened stage by stage. Most of the games compared keep two ladders apart. One is a progression tier: Minecraft's six tool materials, Stardew Valley's five tool levels, Old School RuneScape's metals from level 1 to level 85, Albion Online's tiers 2 to 8 with five enchantment steps each, and Valheim's eight biomes, each bringing a new material. The other is a rarity or quality: World of Warcraft's six qualities and two special ones, Guild Wars 2's seven, New World's five. Most of them added steps on top over the years. The owner's word (9.10), the recommendation: two ladders. The tier is a number with no fixed top: the launch opens tiers 1 to 3, and each stage or new town opens more by raising one core parameter. The rarity stays the four that exist (how often a thing appears), with room for more names later. Whatever the width, the check enforces: an output's tier is at most one above the highest tier among its inputs; a recipe's required level sits inside its tier's level band; a station's tier is at least its output's tier; a material of tier 3 and above comes only from a gated source (a level gate, a slow respawn, a find table or a quest reward); the world's rarity budget (`docs/kernel-review-v1.md` section 8.2) and the derived effort tier (section 8.1) are coded; a recipe template never expands past its bound.
**Closes:** crafting audit question Q6.
**Retry when:** a stage or a town opens the next tiers, or four rarity names prove too few. Model: claude-opus-5-5.

## 2026-10-09 ✅ The upgrade: work clothes with a small capped bonus, and a look layer on the same slots

The question (crafting audit Q9): what does a crafted upgrade give, and where does the character wear it? The owner asked for a comparison with other games, and named the pieces a clothing screen would need (shirt, trousers, suit, set, jewelry, hat, shoes, weapon) and categories in the bag. Most of the games compared keep two layers apart: work clothes that help gathering and crafting, and a look worn over them (RuneScape's skilling outfits with a bonus for the full set, Final Fantasy XIV's crafting and gathering gear with a separate glamour, Black Desert's life-skill clothes). In Stardew Valley the clothes are only a look, and boots and two rings carry the effects; World of Warcraft has a full paper doll with weapons. The spec already holds the frame: two separate places on the character, equipment that gives an advantage and a look; equipment and clothing give a small, focused advantage, capped by rarity and inside the level's power cap; an item with an advantage is found, made in the workshop or bought with gold, never sold for premium currency or money; worn items are icons on the character screen until stage 6 brings visible looks (spec sections 8 and 16). The owner's word (9.10), the recommendation: the character has slots for a hat, a top, trousers or one full outfit that takes both, shoes, two pieces of jewelry, and the tool in hand. Each worn item gives a small bonus to gathering or crafting from the closed list of effects, and a full set gives a little more. Every number goes through the one calculator (spec section 15) and the rate clamp: a bonus may shorten the active time of any activity and raise the output of an activity with no inputs, never the output of a craft (R9), and the whole build stays under the level's power cap. A separate look layer uses the same slots, and only a look item may carry the premium marker (Q1). A weapon waits for combat (stage 8 or a vote, G35). When worn items become visible on the character, each one is drawn for every body build of the player roles. The bag gets categories by kind, a client change outside the craft panel.
**Closes:** crafting audit question Q9.
**Retry when:** stage 6 draws worn items on the character, stage 8 or a vote opens combat and a weapon slot, or a set bonus proves to be the only reason to craft. Model: claude-opus-5-5.

## 2026-10-09 ✅ Each player role reads at a glance: one big item, one colour, its own build

The player roles differed only in their attributes. They now differ in look too, in the pixel sprites and the 3D models alike. Each role carries one big item and one colour that read at phone size, and has its own body build. The patched base clothes stay the same for every role; fine attire is still earned. First round: the Explorer (tall and lean; a wide-brimmed hat and a tall backpack with a blanket roll), the Forager (short and slight; a large wicker basket on the back, the rust red on a neckerchief and the basket lining, and no head wrap, which the owner found looked bad) and the Digger (broad and heavy-set; a spade strapped across the back and a cap). Every role has a man as its base look plus a woman option in the same kit; the first round drew the Forager as a woman, and the base is now a man. Ethnicity is drawn at random for each figure, not one default look, and the skin tone follows the draw. The colours (moss green, rust red, indigo blue) and the exact builds stay a proposal until the owner picks from the 3D stills. The cook, Elder Maru and Pell come later.
**Retry when:** a role cannot be told apart at phone size, or a clothing system needs one shared body. Model: claude-opus-5-5.

## 2026-10-09 ✅ The owner added maze and stealth to the palette, and set the order of the variety work

The owner's word (9.10), after approving the richer valley's gallery: the play itself is not yet good - no choice, no risk, no variety; pressing one button until the stick breaks is a chore, not the diverse play the research described (mazes, riddles, stealth, talk, kinds that open no window). Two kinds the research named and the palette lacked enter GAME_RULES.md section 3: `maze` (a place whose shape is the question; the answer is the route) and `stealth` (a hazard passed unseen, by timing and route, over G30-G35). The rules around them do not change: a type is the kind of question a quest asks, two of one kind never follow each other (G17), and getting an item is never one motion (G18). The order of the work, set by the owner: first a one-page recut of the opening, so the first ten minutes ask five kinds of question with different hands (one taught strike, one find by the senses, one real choice, one riddle, one maze or a night discovery; the minigame window once or twice), for the owner's pick, no build; then the maze (map content and a `visit` step, nothing new in the kernel); then stealth over the hazards (it needs the hazard system, P-5); then tending, a persuasion gate and a collection. The strike animation is polish of the `skill` kind alone and comes after. `quest.type` gains each name with its first quest; the schema's "twelve" reads fourteen then.

**Retry when:** the recut is picked and the first maze is built; if a maze needs more than map and a visit (a door that opens, a path that changes), the kernel question is asked then. Model: Claude Fable 5.1.

## 2026-10-09 ✅ The shop charges at least the full value: R8's text follows the code

The question (register CR-1, crafting audit finding C14): R8 in `docs/kernel-review-v1.md` put the lowest price a shop may charge at k * r * V, while the code has charged at least r * V from the start (`minChargeFor` in `kernel/src/values.ts`, which `pnpm check` applies to every line a shop sells in `tools/src/check.ts`) and pays at most k * r * V, rounded down (`payFor`); the toy economy sells at r * V too (`docs/kernel-toy/toy_econ.py`). One of the two was wrong. The owner's word (9.10): R8's text follows the code. A shop pays at most k * r * V and charges at least r * V. The spread between the two is what keeps the shop from being a value pump: a round trip through the shop loses at least (1 - k) of the value, so a stock curve, a discount or a rounding slip added later has that margin to absorb before the shop could ever pay out, while at a floor of k * r * V a round trip breaks exactly even and any such slip pays. The review's own shop-curve result says the same (section 4, appendix A9): one price curve is safe only when k * m_max <= m_min, two curves need no condition. With k bounded at 700 permille (`content/core/params.json`), the floor stays above the buy price at every k a vote can reach, and Theorem 3 needs only a charge of at least k * r * V, so the full-value floor keeps it with room to spare. In plain play terms, buying a thing costs 1/k times the work of making it at the reference income, so the shop is a convenience and never the better road. No price in play changes: the check already enforces this floor, every core shop passes it, and the 30-gold tools stay (Q10 above). The crafting audit (`docs/design/CRAFTING_AUDIT.md`) keeps its wording: it is a dated snapshot at `4ee9433`.
**Closes:** register CR-1 (`docs/team/GRUNT.md`, Open ends).
**Superseded in part (10.10):** the paying side is called the trader and the charging side the shop (the entry on the game read as one line): the trader pays at most k * r * V, and the shop charges at least r * V.
**Retry when:** a pricing model wants to sell below the full value (a sale or a discount curve); then R8, `minChargeFor` and Theorem 3 change together, in one decision. Model: claude-opus-5-5.

## 2026-10-09 (done) The name is Openfold, confirmed by the owner - the shortlist vote is superseded

The 8.10 entry "Name shortlist for the community vote" set up a vote because the working name, Mistvale, is taken as both a `.com` and a `.io` domain. The product owner proposed Openfold to replace Mistvale on that ballot rather than skip the vote outright; the owner, who holds the ballot, confirmed it directly - Openfold is the name, no vote needed. No hyphen, so it carries cleanly into the save key, package names and a URL; "the fold" is also the English idiom for belonging to a group, landing both the valley setting and the loop's community governance. The domain itself is still unchecked beyond the informal DNS-record look the 8.10 entry already did for the shortlist - a real registrar check comes with the rename pull request.
**Retry when:** the rename lands (save key, package names, site URL, README) - one pull request, per the 8.10 entry.
Model: Claude Sonnet 5.

## 2026-10-09 ✅ The HUD earns its buttons, and its night is the kernel's night

The Bag button appears after the first pickup and the Log button after the first journal entry or finished task, and both as soon as a skill point waits to be spent; read from the state, so a reload shows the same buttons, and the keys work from the start (progressive disclosure, FTUE principle 3). The HUD is built once and patched in place, and the clock's moon follows the kernel's `isNight` (20:00 to 05:00) instead of a second formula of its own. Phones get a tick under A and B and a pattern per grade at every minigame beat through the vibration API where it exists (G27). Every CSS animation stops under `prefers-reduced-motion`, and what an animation would have revealed stands still for its moment instead (G29). The title screen links back to the site above the game (GRUNT 6). Particle glints on the active quest targets wait for the rich-valley client to land, since both draw in the world scene.
**Retry when:** players look for the Log before the bridge (the tracker opens it meanwhile), or a device needs the haptics off (then a switch next to the mute). Model: Claude Fable 5.1.

## 2026-10-09 ✅ The enrichment of the valley lives behind ?rich=, in three groups, and the plain valley stays one query away

Everything cosmetic the client draws on top of the plain valley sits behind `RICH` (`game/src/config.ts`), in three groups the kernel never sees: `detail` (tile variants, grass tone patches, canopies over the forest, edge strips, soft shadows), `motion` (extra frames, swaying props, ambient life, footstep dust, idles) and `light` (the dusk ramp, glows, dappled light, the mist breathing, fades). `?rich=` absent or `all` turns every group on, `none` turns every group off, a comma list names the groups; a reader who asked the browser for reduced motion gets no motion unless the query names `motion` itself. `?rich=none` is the valley as it was, object for object, so a capture of the two looks compares the groups and a bug in the enrichment is one query away from ruled out. A faint warm wash over the day was tried and dropped after a noon comparison of the bridge: it dulled the greens and the water without adding depth. The style law held throughout: 16 px, the 32-colour core palette, alpha 0 or 255, whole-pixel motion, the kernel untouched. The flag is a read of the page URL at load, not a setting: the game draws the richest look it has and a player never sees a switch.
The owner saw the 9.10 gallery (sixteen panels and three short videos of the opening, at phone size) and approved it. That gallery is the style compass for the look of the valley from here: the work that follows on the look iterates inside it (sharper detail, more motion where it reads, light that stays on the palette) and opens no new direction; a change of direction is the owner's call again, from stills at phone size, before anything is built.

**Retry when:** a device cannot hold the full-map ground canvases at four frames (then the groups become a quality level the client picks by measurement), or the owner wants the plain valley as a player choice. Model: Claude Fable 5.1.

## 2026-10-09 ✅ The crafting economy: a miss keeps only inputs, a free market, no level wall

The question: is crafting tied to the economy by its numbers, and what is still missing? A review of wave 2 found what already holds - every worn effect under the power cap (R9), luck bounded, a miss worth less than a success, an even ledger - and these loose ends: the value table prices only a success, so a tier-2 or tier-3 recipe can lose value on the average try; a miss could make an item nobody prices; garments and jewelry never leave the game; the trader buys no tool; a made good sells for the same share as a raw one; the trader pays one price whatever the supply; and gold has nothing to buy beyond the shop. The owner answered them one at a time (9.10, evening). Each number is a reading and a parameter that a vote can move.

- The average try pays its way. At its own level a tier-2 recipe (80 percent, half kept) uses 112.5 percent of its inputs for each success, a tier-3 recipe (65 percent) about 127 percent. The check refuses a recipe whose average try at its own level loses value: p * V(out) + (1 - p) * V(kept) >= V(in), with p the chance at that level before luck. So a recipe's own work is worth at least about 12.5 percent of its inputs at tier 2 and 27 percent at tier 3 (CR-16).
- A miss keeps part of the inputs and makes nothing else. The optional lesser `output` of a miss is gone before wave 2 merges; `keep_pct` stays (0 to 90, half when left out), and so does the one unit that comes back when the share keeps nothing.
- Worn pieces never wear out. A set grows old because a higher tier opens, and because it fits one task and not another: a heavy coat may dig well and gather slowly. There is no gear wall: a weak or wrong set fails a hard task, and a fitting set lets the same player succeed. Reading: a worn effect may carry a minus as well as a plus, each inside its tier's cap (CR-21).
- No level wall, and no hint on screen. A recipe above the profession's level is no longer refused: each missing level takes `craft_level_step_bp` off the chance, down to nothing, and a try at nothing still runs and misses. Gear that fits the task adds to the chance on the side of skill, as a level does; luck stones and the character's luck stay on the side of luck (the morning's entry, "A craft can miss"). The world teaches by outcome: the screen shows an item's class and tier and the station a recipe needs, never a chance, a word for the difficulty or the level a recipe wants. Only the station still refuses, since it is a thing in the world and the refusal names it (CR-17).
- Tools. A tool may leave out `uses`: it then lasts, like a garment, and grows old by tier. The trader buys a tool for its share of the value times the part of its uses that is left; a broken tool has already left the bag (CR-8).
- Making pays more than selling raw. The trader pays `k_craft_permille` of r * V for an item whose value comes from a recipe (750 at launch; a vote moves it between 500 and 900) and `k_permille` (500) for the rest. As in Stardew Valley or Animal Crossing a made thing sells for a multiple of its materials; here the multiple comes from the recipe's work, so a long recipe is never a loss. The trader never pays as much as the shop charges for the same item, so buying in the shop to sell to the trader never pays. R8 and Theorem 3 of the kernel review, as restated by the shop-floor entry of the same day, change in the same build (CR-18).
- A free market. A player may work for their gold and make a thousand stools, and the world feels it: supply beyond demand lowers the price step by step; the player sees it and decides alone whether to go on. Reading: a stock per item in the world's market; what players sell adds to it, and the world's demand drains it with game time; the trader's pay falls one step per unit in stock, down to a floor, and the shop's price rises while the stock is empty. Both stay inside R8's band - the trader at most its share, the shop at least r * V - so no loop pays. One market per world; players who share a world share its market. The trader shows today's price, never a forecast (CR-19).
- Improving gear. An upgrade recipe takes an item and more materials and gives the next tier of the same item: the road to the higher tools that no shop sells. A miss on it never takes the item; it keeps the usual share of the added materials (CR-20).
- The tier is the price, for now. A worn effect does not change an item's value: the tier bounds the effect, and the inputs and the work give the value.
- Gold is measured before it is braked. The values report gains gold per hour of making, per tier, so the market's steps are tuned from numbers (CR-22).
- What gold is for. The owner's word: trade serves building a town and a company - group quests, and in multiplayer a settlement that players found together, guard and feed, each giving to it; buying and improving weapons; improving built gear with more materials. The settlement is meant as the main sink of gold and goods and needs its own plan (CR-23); weapons wait for G35 (CR-12); improving gear is the upgrade recipe above.

**Closes:** nothing yet; the rows CR-16 to CR-23 and the decided CR-8 in GRUNT's open ends carry the work.
**Retry when:** playtests show the market price falling so fast that making stops paying, one set that every task needs, or a try at nothing that players read as a bug; or the settlement plan changes what gold is for. Model: claude-fable-5-1 and claude-opus-5-5.

## 2026-10-09 ✅ Openfold in the game, the docs and the saves; the addresses wait for the owner

The rename that the entry "The name is Openfold" asked for, in one pull request. The page title, the title screen and the version line (`GAME_TITLE`), the README, the creator guide with the text it copies for an AI helper, the team intro and its PDF, and the design docs say Openfold. The save moves from `mistvale.save.1` to `openfold.save.1` and the sound setting from `mistvale.sound.1` to `openfold.sound.1`: the game reads the old key while the new one is empty and removes it at the next write, so a returning player keeps the valley and the mute. Kept on purpose: the package names (`game-monorepo`, `@game/*`) never carried the name; the repository name and the site address (`mistvale-lac.vercel.app`) are the owner's settings, so `REPO_URL` and the two links in the team intro follow when they change; the end-to-end harness keeps its temporary profile prefix (`mistvale-e2e-`), which no player sees and which other open work matches; the entries above keep the name they were written with. The registrar check that entry left for this pull request (RDAP, and WHOIS where a registry has no RDAP, 9.10): `openfold.com` (registered 2012), `openfold.org` (2017) and `openfold.net` (2023) are taken, and `openfold.io` (2021) belongs to the Open Molecular Software Foundation, the home of OpenFold, an open-source AI consortium for protein structure prediction; `openfold.gg`, `openfold.dev`, `openfold.app`, `openfold.game`, `openfold.games`, `playopenfold.com` and `openfoldgame.com` have no registration.
**Superseded in part (10.10):** the site's project moved, and the old address answers 404: the team intro's two links now go to the play page at `theopenfold.vercel.app` and its PDF is printed again, in one pull request. `REPO_URL` is the repository's address, which did not change, so it stays.
**Retry when:** the owner renames the repository or the site's project (then `REPO_URL`, the team intro's links and its PDF change in one commit), a domain is bought, or the name is reopened. Model: Claude Opus 5.5.

## 2026-10-09 ✅ Openfold goes in everywhere: the product owner accepts the OpenFold clash

The registrar check in the entry above found that OpenFold is also the name of an open-source AI for protein structure prediction, at home with the Open Molecular Software Foundation (`openfold.io`), and that `openfold.com`, `openfold.org` and `openfold.net` are taken; the rename's pull request waited as a draft while the product owner weighed it. The product owner settled it on 9.10: Openfold goes in everywhere a player or a contributor reads the name, and the clash with the protein-structure AI at `openfold.io` is known and accepted. The addresses stay the owner's settings: the repository name, the Vercel project and the site address, and a domain. The free domains are the ones the registrar check listed: `openfold.gg`, `openfold.dev`, `openfold.app`, `openfold.game`, `openfold.games`, `playopenfold.com` and `openfoldgame.com`. The rename's pull request leaves draft and carries the name into what `develop` added since it was written.
**Retry when:** the owner renames the repository or the site's project, or buys a domain (then `REPO_URL`, the team intro's links and its PDF change in one commit, as the entry above says), or the shared name with the other OpenFold confuses players or contributors. Model: Claude Opus 5.5.

## 2026-10-10 ✅ The story is told in folds: ages the mist folded, returners not heroes, beliefs not one truth

The question (owner, 10.10): is there a plot, and how is a story told in a game meant for many players at once? Measured on develop: six quests with about 200 words, two speaking characters with about 380, about 800 words of story in all, a frame in the spec (a forgotten world restored) and no plot. A survey of Pokemon, Skyrim, Fallout and The Witcher 3 found one hero learning their past in each, which a shared world cannot have; Skyrim's books that contradict each other, Pokemon's legends told differently in each region and Fallout's world told through its places can carry over. The owner approved the frame of folds with three changes: no limit on the number of folds, since nobody knows where the game will go; several beliefs and no answer that is always right, as in Pokemon and Skyrim; and perhaps a good, evil or karma axis. The same evening the owner approved the rest as proposed: three beliefs to start (the Menders, Maru's; the Wakers; the Keepers), Pell holding none and selling all three as rumours; karma yes, as a hidden lean toward each belief that the world shows and no screen counts, in place of one good-evil meter (Fallout 3's single number was gamed; New Vegas's factions and Ultima IV's hidden virtues were not); no fold named by the core yet; and the work in GRUNT section S, starting with lines with conditions (storylets and salience) and lines on the quest. Written as [docs/design/STORY.md](docs/design/STORY.md), rules S1-S6. Because there is no hidden canon, the whole story bible lives in the public repository. The runtime stays the project's JSON; Twine or Inky only for drafts; no wiki service and no NPC that chats through a language model.
**Retry when:** players read the beliefs as a menu to pick from rather than something their acts lean toward, a hidden lean reads as a bug ("why does Maru greet me like that?"), or a season needs a fact the bones (S3) cannot carry. Model: claude-opus-5-5.

## 2026-10-09 ✅ Crafting wave 3 as built: a workshop that climbs three tiers, two chains, tools that last

The content wave (crafting audit section 6, wave 3) seeds crafting inside the period before metal, and builds what "The crafting economy" above decided for tools (CR-8) and asked of the check and the values report (CR-16, CR-22). Each number is content or a core parameter, so a later pull request or a vote can move it.

- The workshop is one camp slot that climbs by upgrades: the work stone (tier 1, four stones), the workbench built over it (tier 2) and the workshop over that (tier 3). A new craft profession, handcraft, works it: Steady hands (25 percent faster) at level 2, Sure hands (`craft_chance_pct` 10) at level 4. Of the built parts that provide a recipe's station at its tier, the one the player stands at does the craft, else the first.
- The material and the chains: a reed bank in the meadow gives reed (fibre, tier 1). A stone chain (flakes, then a blade and a flint trowel, then a stone trowel) and a reed chain (cord, then a woven mat, a reed basket and sandals, then a fine basket) climb tier 1 to 3. The template `core/dye-cord` makes dyed cord from two berries of one kind and a reed cord (two recipes today), for the reed hat and the lucky charm. Eleven recipes and the template, all known from the start, each at a level of its tier's band.
- Tools: the tier-2 tools wear out (the flint trowel after 80 uses, the reed basket after 120); the tier-3 tools leave out `uses` and last. The trader buys a made tool for its share of the value (the kernel's `salePrice`, which the client shows and the sale pays); the unit in use goes last, so only a sale of every unit pays for the share of its uses left, and a lasting tool sells in full. The uses spent leave with the last unit. The shop's basket and trowel have no value and are still never bought back.
- Worn items: the reed hat (head) and the reed sandals (feet), `gather_speed_pct` 5 each and the set `core/reed-walker`, and the lucky charm (jewelry, `craft_chance_pct` 5). They are work clothes, never protection against a hazard.
- The check refuses a recipe or a template whose average try at its own level, before luck, loses value: the chance times V(outputs) plus the rest times V(kept on a miss) below V(inputs), the chance from `craft_chance_bp` (CR-16). `pnpm values` prints gold an hour of making per tier beside gathering (CR-22). The first reading: gathering 7200.0 to 7920.0, tier 1 14400.0, tier 2 7480.8 to 11520.0 (median 10320.0), tier 3 1410.0 to 2040.0 (median 1725.0). The low tier 3 is the miss risk and the long times the average try asks for; it goes to the economy pull request with CR-18 (CR-31).
- Kernel 0.4.0; `tool.uses` is optional, an additive schema change. `values.lock.json` gains thirteen values and no old one moves. The new items reuse kit icons until the asset sidecar draws them (CR-30); `content/kit` is unchanged. The map scene was protected in this wave, so the ghosts of unbuilt upgrades, "Cook at" on every station and the missing "Build:" for an upgrade wait (CR-27 to CR-29).

**Closes:** CR-8, CR-16 and CR-22 (crafting audit, Appendix D).
**Retry when:** the market (CR-19) or the made-goods share (CR-18) moves the report, a lasting tool ends the demand for tools, or the asset sidecar draws the new items. Model: claude-opus-5-5.
## 2026-10-09 ✅ No combat yet: a predator is escaped, and a group quest is made for a group

The question (a review of open product direction, 9.10): the owner spoke of buying and improving weapons, of a monster too strong for a player, and of guarding a settlement, while fighting stays out (G35) and the hazards entry of 8.10 answers a predator with a lit lantern, thrown food and the road. Does fighting come earlier, and if not, what do those words mean in a valley without combat? The owner's word (9.10):

- No combat now. A stage in between, without fighting, is right, but not gear against a hazard: no "stronger lantern". A player escapes a predator by running back to town, and that run is hard and possible.
- The night carries the danger through its work. An example to develop: a night by a campfire that must be kept burning with branches, with more layers on top so it stays interesting. It fits the tending beat of the night expedition (8.10).
- Guarding a settlement is a quest that players choose to take together, never a duty that decays while nobody plays (G28).
- Quests come from a large pool matched to the player's character and levels, each started by talking to a character in the world, as in Pokemon or Skyrim. Next to them stand fixed quests like the seasons of current games; how a season keeps clear of a "last chance" (G28, G42) was answered the same day: what a season adds stays (the entry on seasons below).
- A group quest can be played alone or together, as Grand Theft Auto offers solo and co-op. Alone, the chance is low, since the quest is made for a group. Later the valley's characters may fill a group: only a character the content marks for it (by default none), at a level that fits the quest. A partner below that level falls and goes back to where it lives.
- Later, when combat comes: a group may take a quest to guard a town or a fort, and a rival group may sign up together to attack it. Both sides choose to play it, and nothing is taken from a player who is away, so the morning's entry on war, theft and robbery ("Crafting is optional") holds until then.

How far "later" is: the spec sets no dates and moves from stage to stage on conditions. By its own estimate, stages 2a to 8 come to about 39 to 63 thousand lines, against about 20 thousand lines of TypeScript in the repository today, with a paid server from 2a, a payments provider at 6, a real-time server at 7 and a sandbox for creators' code at 8. A community vote may still open combat earlier (G35).

**Closes:** nothing; weapons still wait for combat (CR-12).
**Retry when:** the first night quest shows whether the run back to town is hard and possible, or a vote or stage 8 opens combat. Model: claude-opus-5-5.

## 2026-10-09 ✅ The settlement starts as the town the player mends; in a shared town, houses are built step by step on scarce plots

The question (a review of open product direction, 9.10): the crafting economy entry of the same day names the settlement as the main sink of gold and goods, yet no stage of the roadmap holds it, and the spec postpones ownership, conquest and cities until there is a community. The owner's word (9.10):

- In principle yes: in the player's own valley the settlement is the town the player mends.
- When players share a world, not every player can build the same thing. Players settle the town's existing buildings, and whoever comes first with the resources starts building. A house is a chain of quests and resources: the builder stops, goes to do a quest, and each finished quest moves the house on.
- A builder has a time limit. Missing it loses the process: the builder starts over, the place goes free for another player, and the builder gets a refund by the game's rules. The world must therefore keep room for players to build.
- A town can run short. Its places open for sale gradually, perhaps through group quests too (clearing trees at the edge of town to prepare the ground).
- A player without a property lives on the street, since outside the town is more dangerous: danger by area of the map, more common where the area's level is higher. The owner asks whether an internal difficulty rating is needed and whether it should be exponential.

How these become rules, and where they meet rules already written (G28's "the valley waits", pillar 5, the safe camp of 8.10, the cooperative world of 6.10, G42), is `docs/design/SETTLEMENT.md`. Its open questions go to the owner one at a time, and their answers land here.

**Closes:** CR-23 in GRUNT's open ends: the settlement has its own plan, and decisions follow below.
**Superseded in part (10.10):** player houses and plots are paused (the entry on houses and plots paused); the town the player mends, the street, the camp and danger by area stand.
**Retry when:** the plan's questions are answered, or stage 4 brings a shared world state. Model: claude-opus-5-5.

## 2026-10-09 ✅ In a shared town absence has a price, and a mail comes first

The question (settlement plan S1, 9.10): a plot that lapses while its holder sleeps is the timer G28 forbids, and losing a building's progress meets pillar 5. The recommendation was a lapse only in a shared town, counted between steps, with the full price and every delivered item returned and a finished house never taken. The owner's word (9.10): almost. Yes to the exception for a shared town and to the clock between steps, but absence has a price:

- A player about to lose a place gets an email first. Registration is minimal and comes after the opening (the next entry).
- An owner who has not played for weeks needs a rule too.
- So does a builder who takes a long time between steps.

As rules in `docs/design/SETTLEMENT.md` (3.2 and 3.8): the clock between steps runs whether the builder is away or slow; an owner long away has the house packed; one mail per hold comes before it ends, and no mail asks the player back for anything else. What a lapse and a packing cost is question S1b, asked the same day; the recommendation is the place and a fifth of its price, never what the player made. G28's text in `docs/design/GAME_RULES.md` gains the exception when S1b is answered.

**Closes:** nothing yet.
**Superseded in part (10.10):** paused with player houses and plots (the entry on houses and plots paused).
**Retry when:** the owner answers S1b. Model: claude-opus-5-5.

## 2026-10-09 ✅ An account asks for little, and only after the opening

The owner's word (9.10), given with the answer on absence: registration is minimal, and it comes after the opening.

Read as: an email address and the name the world shows, asked when the opening ends and never before play. Accounts begin at stage 2a; the stage-1 demo keeps none, and the 6.10 decision that nothing carries from the demo stands. The address serves the account and the notices of `docs/design/SETTLEMENT.md` 3.8, nothing else.

**Opens for stage 2a:** a privacy text and the youngest age that may register, both before the first address is collected; a mail service for the notices; how the opening played before registering moves into the new account under server-decided saves.
**Closes:** nothing.
**Superseded in part (10.10):** the name the world shows is the one given in the opening, offered again at sign-up, read by the filter then and unique in the world joined (the entry on the game read as one line).
**Retry when:** stage 2a is designed. Model: claude-opus-5-5.

## 2026-10-09 ✅ Absence costs the place and a fifth of its price, never what the player made

The question (settlement plan S1b, 9.10): what a lapse and a packing cost, after the owner's word that absence in a shared town has a price. The owner's word (9.10): yes to the recommendation.

- A building with no finished step for 14 days returns to the town, whether its builder is away or slow. The builder gets back every delivered item and 80% of the plot's price; the other 20% stays burned.
- A house whose owner has not played for 45 days is packed. Its plot returns to the town with the same 80% of its price; the house and everything in it stay the owner's, to raise again on any free plot without redoing a step.
- One mail comes before each: 3 days before for a building, 7 for a house.

Final Fantasy XIV is the nearest precedent: 45 days without the owner's visit, mails before, and 80% of the plot's price back, but there the house is torn down. G28 in `docs/design/GAME_RULES.md` now states the exception, and `docs/design/SETTLEMENT.md` holds the parameters (`build_hold_days` 14, `house_absent_days` 45, `plot_refund_permille` 800, `notice_days` 3 and 7).

**Closes:** S1 of the settlement plan, and the open part of the entry "In a shared town absence has a price, and a mail comes first".
**Superseded in part (10.10):** a freed plot is now drawn (the entry on the shared world), so a packed house is raised only on a plot its owner wins, as that plot's first step, with no step redone (the entry on the game read as one line).
**Superseded in part (10.10):** paused with player houses and plots (the entry on houses and plots paused).
**Retry when:** the shared world of stage 4 is designed, or real absences show the numbers are wrong. Model: claude-opus-5-5.

## 2026-10-09 ✅ A camp outside the town is a tent the player buys, safe while its fire burns

The question (settlement plan S2, 9.10): G30 keeps the town and the camp safe at every hour, and the owner's word that outside the town is more dangerous meets it, since the camp stands outside the town. The owner's word (9.10): yes to the recommendation, and a camp outside the town is a tent the player buys first; to get through the night safely the player needs enough wood for it.

- The town is safe at every hour. A player without a house sleeps on the street, safe, and the night gives health back as at camp.
- A camp is safe while its fire burns. A night costs `wood_per_night` times the area's danger level `d` in wood, so the opening's camp, at level 0, costs none and plays as today.
- A camp anywhere else outside the town is a tent, bought at the stall and pitched on a free tile off the paths. Readings: one tent stands at a time, it never wears out, and no tent burns less wood than another, since the owner ruled out gear against hazards.
- The fire matters only while the player is there at night: away, nothing happens to the camp or its chest. The fire's level shows, and G31's warning comes before it goes out.
- In a shared world every area outside a town is above level 0 (a reading), so every camp there costs wood and the street stays the free place to sleep.

G30 and G32 in `docs/design/GAME_RULES.md` now say so, and `docs/design/SETTLEMENT.md` 3.4 holds the rule.

**Closes:** S2 of the settlement plan; GRUNT's open ends carry the building as CR-25.
**Superseded in part (10.10):** in a shared world the opening's ground stays at level 0, as the town's edge, and so does the night ruins' entrance, where no wood is burned and no tent is pitched; by day a camp's fire burns for nothing; and from stage 7 a fire keeps the hunting hazards off anyone in its light (the entry on the game read as one line).
**Superseded in part (10.10):** another player stays at a camp only as a guest, at the price its owner sets and with its owner's approval, and is safe and rests there while its fire burns; without a deal another's camp is no safe place (the owner's answers of 10.10 afternoon, and the entry on the five holes of the one line).
**Retry when:** a playtest shows a night's wood too dear or too cheap for an area. Model: claude-opus-5-5.

## 2026-10-09 ✅ Wood comes from felling trees: every tree gives wood by its type and grows back before it is felled again

The owner's word (9.10): wood is not gathered from piles of twigs but by felling trees, so every tree is of use. A tree gives a number of logs by its type, takes a time to fell by its type, and grows back in a time by its type, shown as it grows; only a grown tree can be felled.

As content, a tree is a gathering node much like a plant: `output` its log, `yield` the logs of its type, `active_ms` the felling time, `respawn_ms` the time to grow back, and `level` by type. Growing back is never paid (R6), so a log's value counts the felling only. The client draws the stage from the share of `respawn_ms` gone: a stump, a sapling, a young tree, a grown one. The wood chain of the crafting content starts from a log.

Readings, each open to the owner's word:
- Felling needs an axe, a new tool kind in the kernel's closed list, and it is a profession of its own, woodcutting, as digging is with its trowel.
- A stump blocks its tile as the tree did, so felling never opens or closes a path; only a clearing quest (the settlement plan, 3.3) uproots a tree for good.
- The trees inside a town are the town's and are not felled.
- Small wood, a stick for a skewer or kindling, comes from splitting a log by a recipe.
- In a shared world a tree is shared, and who fells it first joins the question on shared bushes (spec stage 4). Answered 9.10: each player fells their own (the entry on each player's own yield). In the areas between players a tree stands on one chop timer that every swing there spends, and each swing's wood goes to its swinger (the entry on the shared world, 10.10).

The opening's fallen branches (question W1): answered the same day. None stay, not even in the opening; see the entry on the first fire below.

**Closes:** nothing; GRUNT's open ends carry it as CR-24.
**Retry when:** the wood chain is built. Model: claude-opus-5-5.

## 2026-10-09 ⏸ No bots, no AI that plays for a player, no cheating: the rules wait for accounts and the shared world

The owner's word (9.10): the game needs protection against bots and against AI that plays in a player's place while the player is away, and anti-cheat once players share a world.

What already stands against them: the kernel review recommends perfect execution as the reference player (D2), so a program with perfect timing earns no more per second than a perfect human; rolls come from the server, not from a seed the player holds (K3); a timing grade is the server's, not a claim (K10); boards rank only state the server has checked (7.10); the creator pool counts active seconds with a cap per account-day (R10). Anti-cheat follows the same line: the server decides, and the client only shows and asks.

What a program still gains is hours: it can play all day, and in a shared world it reaches shared things first. What to do about that is question A1, answered the same day: see the entries on exploit loops and on programs that play.

**Closes:** nothing; GRUNT's open ends carry it as CR-26.
**Retry when:** the owner answers A1, or stage 2a is designed. Model: claude-opus-5-5.

## 2026-10-09 ✅ No fallen branches, not even in the opening: the first fire is built from a felled tree

The question (W1): the wood entry above left the opening open, because its first fire comes before any axe. The recommendation was one storm-fallen tree by the river whose branches last until the first fire. The owner's word (9.10): no. Felling replaces the branches in the opening too, the start of the game changes to fit, and each character may begin in a different way.

The rules:
- No node gives wood without felling. `core/fallen-branches` leaves the world. The campfire, the storage chest and every recipe that asks for a dry branch ask for a log, or for what a log splits into (the wood entry's reading on small wood). The dry branch stays an item, split from a log, so a saved bag stays valid.
- The player can fell before the first fire, so the axe comes first. The opening's camp stands by grown trees of the first tree type: woodcutting level 1, a felling time as short as the opening's other steps, and logs enough for the first fire. Every tree of a new valley starts grown.
- The road of the opening stays: wake by the river, mend the bridge, cross, fell a tree, build the fire, cook, follow the smoke to town. Fire stays among the first things the world relearns, as the spec orders them.
- No start ends at a wall. The check walks the opening from every starter's start, and refuses content where the axe comes after the first step that needs it, or where the opening asks for more wood than the trees grown at the start give within reach.
- A saved character that began before the change and holds no axe gets one when the new version of the world loads, the way it learns new start recipes (the entry on crafting wave 2 as built). Without this, a player saved between the bridge and the fire could not go on.
- The opening chain becomes content. Today it is a fixed list in `tools/src/play.ts`; a character's own first quest joins it, and G2 and G4 apply after it.

A character's own start, as the frame for the open question:
- A starter is creator content: the spec names a starting character among the expansions. A start is a starter's fields: a kit in the bag, a place to wake, and a first quest of its own that joins the shared road before the first fire.
- A start changes how a character begins, never what it can become. No profession is closed to any starter, and the spec's line holds: expansions add choice, not a stronger character.
- The check keeps the starts fair: every starter's attribute points add up to one total (6 today, true in the content and not yet checked), every kit's value sits in one band, and every start reaches the first fire within one band of effort.

How far each character's start differs (question C1): answered the same day; see the next entry. Either way the axe comes before the first fire.

**Closes:** W1; GRUNT's open ends carry the building in CR-24.
**Superseded in part (10.10):** the catch-up of an axe for a saved character is dropped, since demo saves reset once (the entry on saves).
**Retry when:** a playtest shows the first fire too slow to reach. Model: claude-opus-5-5.

## 2026-10-09 ✅ Each character begins its own way: a place to wake, a kit and a first task, meeting at the bridge and the first fire

The question (C1): how far each character's start differs, now that the first fire is built from a felled tree (the entry above). The owner's word (9.10): yes to the recommendation, as each race in World of Warcraft starts in a zone of its own and meets the others later.

- A starter carries its own start: a place to wake, a small kit in the bag, and a short first task that fits its strength. For the two starters of today, for example: the forager wakes with a basket and an axe and picks first; the explorer wakes with a trowel, and its first find is its own axe, dug from the ground.
- Every start holds an axe before the first fire, and every start meets the shared road at the bridge and the first fire.
- The check keeps the starts fair: every kit's value sits in one band, every starter's attribute points add up to one total, and every start reaches the first fire within one band of effort. No profession is closed to any starter.
- A starter that a creator adds later brings its own start under the same checks; the spec names a starting character among the expansions.
- As content: optional fields on the starter for the place to wake and the kit, and a quest that names the starter it opens for. All are additive, so the format stays 1. The opening chain names each starter's first task, and G2 and G4 apply after it.

Readings, each open to the owner's word:
- The kit is given once, at the start. A saved character keeps its bag and gets only the axe (the entry above).
- A kit holds tier-1 things only, so no start hands out what G41 keeps behind a gate.
- Each start has its own waking lines, in place of the one opening narration of today.

**Closes:** C1; GRUNT's open ends carry the building as CR-37.
**Superseded in part (10.10):** three starters, not two, and the digger digs its axe where the explorer did (the entry on three starters).
**Retry when:** a playtest shows one start slower or richer than another. Model: claude-opus-5-5.

## 2026-10-09 ✅ One internal difficulty scale: each step asks half again as much, and the screen never shows it

The question (settlement plan S3, 9.10): the owner asked whether an internal difficulty rating is needed, and whether it should grow exponentially. The owner's word (9.10): yes to the recommendation.

- One integer scale rates areas (their danger level `d`), quests (the sum of their steps' difficulty, as the spec computes it) and recipes (their level).
- Each step multiplies effort and the health a hazard takes by `difficulty_ratio_permille`, 1500 to start: about 3.4 times over three steps. How often a hazard shows grows by one `hazard_bp` per step. The check holds content to the scale: what an area or a recipe asks grows by the ratio per step, within a band.
- The scale is not a chance curve. A recipe's chance stays as the crafting economy entry set it: each missing level takes `craft_level_step_bp` off, with no wall. A step above is hard because of what the world asks there: dearer inputs, a more dangerous road to them, and hazards that hit harder.
- The screen never shows the scale as a word or a number (the crafting economy entry). The world shows it: thicker mist, tracks, bones, a sign at an area's edge.
- Nothing here needs the shared world, so it can be built with danger by area in the player's own valley.

`docs/design/SETTLEMENT.md` 3.5 and 3.6 hold the rule.

**Closes:** S3 of the settlement plan; GRUNT's open ends carry the building as CR-38.
**Retry when:** a playtest shows a step too steep or too flat. Model: claude-opus-5-5.

## 2026-10-09 ✅ Players compete only for places, and later in areas between players that a player chooses to enter; no upkeep

The question (settlement plan S4, 9.10): the 6.10 decision kept the world cooperative and put ownership and conquest back on the table only when there is a community, and first come for plots and rival groups bring competition in. The owner's word (9.10): yes to the recommendation, and later there will also be dangerous areas outside the towns where players face each other. Of the ways to charge upkeep, the owner took none.

- Players compete for places only: plots in a shared town and, once combat comes (stage 8 or a vote, G35), areas between players.
- An area between players lies far from the towns and high on the difficulty scale, so a new player does not walk in by chance, and a sign at its edge warns first (G31). Entering is the consent; whoever does not enter is never hurt there. Towns, camps and houses are always safe, and nothing is taken from a player who is away. The area's nodes pay more for the risk (kernel review 7.2, item 4).
- A player brought down by another player there falls by G33 and loses only what was gathered on that outing, which goes to the one who brought them down. Tools, worn items and what the player made stay theirs.
- This narrows the morning's entry ("Crafting is optional"): war, theft and robbery stay out everywhere except those areas, and there only once combat comes. G38 now says so.
- Reserved now, each one schema field with a default that changes nothing today (kernel review 7.2): a controller on every place, a protection level on every area (safe, wild, or between players, the last only once combat opens), and a reason from a closed list on every movement of gold (price, refund, and later spoils, tax, rent, toll).
- No upkeep. The review proposed it as a gold sink and as a brake on one holder taking everything. The settlement's prices are the sink (the crafting economy entry), and the brakes are written already: one plot in building and one house per player to start, absence returning places (S1b), plots opened by work, and in the areas between players, other players. A charge by the clock would also be the timer G28 forbids.

`docs/design/SETTLEMENT.md` 3.9 holds the rule.

**Closes:** S4 of the settlement plan; GRUNT's open ends carry the reserved fields as CR-39.
**Superseded in part (10.10):** "always safe" means that no player harms another there; from a hazard, a camp is safe while its fire burns. The protection level is `safe` at danger level 0, `wild` above it, and `contested` only for an area between players once combat opens (the entry on the game read as one line).
**Superseded in part (10.10):** the plots of a shared town are paused with houses (the entry on houses and plots paused); the areas between players stand.
**Retry when:** in a shared world one player or group holds a large share of a town's places, or gold piles up with nothing to spend it on. Model: claude-opus-5-5.

## 2026-10-09 ✅ A plot that work opens is drawn among those who did the work

The question (settlement plan S5, 9.10): first come at the moment a plot opens favours whoever is online then, and a script most of all. The recommendation was three days of first claim for the players of the clearing quest, then a draw. The owner's word (9.10): whoever signed up for the clearing and took part enters the draw. How it weighs may depend on the size of the area and the number of places, and the one who worked hardest may come first; the game does not turn only on buildings now, so the rest can wait.

- A clearing quest names the plots it opens. They are drawn among its participants: a player who signed up and finished at least one of its steps. Signing up without working is not taking part, so a script gains nothing by signing up.
- The draw is the server's, as every roll is (kernel review K3), and gives each participant one plot at most, under the rule of one plot in building and one house per player.
- A plot won is held as a claimed one: the first step pays its price, and with no finished step for 14 days it returns to the town (S1b) and is drawn again, among the participants first. The draw needs no clock of its own.
- Open until the shared town is designed (stage 4): whether every participant has the same chance or the chance grows with the share of the work done, measured in active seconds as levels are, and how the draw follows the size of the area and the number of places. A reading: a chance that grows with the work, so the hardest worker is the most likely winner and never a certain one.

`docs/design/SETTLEMENT.md` 3.3 holds the rule.

**Closes:** S5 of the settlement plan, in part; the rest waits for the shared town's design.
**Superseded in part (10.10):** a won plot's first step comes within `plot_signup_days`, as for a freed plot, and the plot then holds `build_hold_days` between steps (the entry on the game read as one line).
**Superseded in part (10.10):** paused with player houses and plots (the entry on houses and plots paused).
**Retry when:** the shared town is designed. Model: claude-opus-5-5.

## 2026-10-09 ✅ The free market comes right after crafting wave 4, one per world, and the demo tunes it

The question (9.10): the crafting economy entry of the same day set a free market (CR-19), and the spec puts the market at stage 4, with prices fixed until then (the spec's economy section). When does it come? The recommendation was a market per world right after crafting wave 4, before stage 4. The owner's word (9.10): yes.

- The market is the build right after crafting wave 4: a stock per item in each world, as the crafting economy entry reads it. It needs no server. In a player's own world that player alone moves the stock, and the world's demand drains it with game time, so a thousand stools lower the price for the one who made them, who sees it and decides whether to go on.
- The demo tunes it. The spec already gives the demo period to tuning the economy's rules, since gold there lives in the browser and nothing from it passes to an account. The market's steps and floor are tuned there from the values report's gold per hour (CR-22), before anything is held on the server.
- At stage 4 nothing new is invented: players who share a world share its market and its stock, and the character shops act as the market maker inside R8's band, as the spec has it.
- This changes the spec's order: prices are no longer fixed until stage 4, they move by stock from the build after crafting wave 4. The spec's economy section follows in its next version.

**Closes:** the timing of CR-19; GRUNT's row and the crafting audit's row now carry it.
**Retry when:** the demo shows the price falling so fast that making stops paying, or a world's stock that never drains. Model: claude-opus-5-5.

## 2026-10-09 ✅ The boards rank worth, levels, quests, collection, exploration and giving; the top is honored and hunted

The question (9.10): the spec opens verified boards at stage 2a (wealth, collection and profession levels, counted on the server only), and the kernel review leaves room for becoming the richest player. If the wealth board counts the gold a player holds, every coin given to the town or spent on a tool lowers the player on it, so the board would reward hoarding, against the owner's word that the settlement is where gold mainly goes. The recommendation was to count gold earned and add a board for what was given to the town. The owner's word (9.10): the boards can carry filters, levels and quest points among them; the count is the player's worth, so an asset whose price rose or a good deal raises it; and first place should bring honor and also a risk that grows with the rank, from other players and from the world. Asked whether that risk stays on the outing and in the places the player chose to enter, or reaches the house and the store too: the first. A top player who stops playing needs no rule; the others pass them.

What other games do, as read for this answer: RuneScape ranks each skill and the total level, with boards for activities and filters by mode, and no wealth board; World of Warcraft has no official wealth board and ranks by season, with filters by realm, region and class; Albion Online ranks fame by field, weekly and monthly; Path of Exile and Diablo open a board per season, filtered by class. Few large games show an official wealth board, since one draws bots and trading for real money. For risk at the top: Sea of Thieves marks a top-grade ship on every map, Warzone and The Division mark a player who took a contract for a while, EVE Online lets players put a bounty on another; the risk always follows something the player chose to carry or a place they chose to enter. Ultima Online let the rich be hunted everywhere, players left, and in 2000 it opened a world without fights between players.

- Boards: worth, character level, each profession, quest points, collection, exploration, and what was given to the town. All are counted on the server only (spec, verified boards; kernel review: boards from server state only), so none exists in the demo.
- Filters: this season or all time, world, the starter a player began with, and friends. A season's board counts what grew in that season; how seasons work is the next question (Q5).
- Worth is the gold a player holds, plus their goods and places at what the trader pays for them today, plus what they gave to the town at its value that day. An asset whose price rose raises it, a good deal raises it, and giving to the town never lowers it. A place no one can sell yet counts at the price paid for it.
- The price comes from the trader, never from the last deal between players: two friends trading at a puffed-up price would raise both. Raising the trader's pay means draining the stock, and that costs more than it adds (the free market of the crafting economy entry).
- If gifts between players come, a gift counts to the one who gave it, never to the one who got it, so a group cannot pile its wealth on one name to put it first.
- Quest points are the sum of the difficulty of the quests a player finished, each quest counted once, as the spec already computes a quest's difficulty. Exploration counts the places, areas and secrets a player found, each once per world.
- The top places of the worth board among a world's players carry a mark (`marked_top`, 10 to start). In towns it is honor only. In the areas between players it is seen from afar and shows on the map of every player there, and whoever brings a marked player down takes the outing's finds, as for anyone, and gains honor on a hunters board (`docs/design/SETTLEMENT.md` 3.9).
- The world hunts the top too: outside the towns, road thieves come to a marked player more often the higher the rank. A thief is a hazard, not an enemy (G35): it acts by a rule the player can learn and has one thing to buy and one to make that answer it (G34), and it takes health like any hazard (G32), so the worst is the outing (G33).
- The house, the camp, the store and what the player made stay safe, and nothing is taken from a player who is away (G28).

**Closes:** the boards' count and their risk at the top; GRUNT's open ends carry the building as CR-40.
**Superseded in part (10.10):** road thieves wait for weapons, and no item answers a hazard (the entry on a hazard escaped). The hunters' board's rules for when combat comes are in the entry on the shared world.
**Superseded in part (10.10):** worth counts no places while player houses and plots are paused (the entry on houses and plots paused).
**Retry when:** the top of a board is held by bots or by one group's funnel, or marked players stop leaving the towns. Model: claude-opus-5-5.

## 2026-10-09 ✅ The players' common task is to explore the world

The owner's word (9.10, with the answer on boards): the general task of the players is to explore the world. With the evening's word that the game does not turn only on buildings now, this orders what comes next.

- Crafting, the market and the settlement serve exploring: roads and means, not the goal (G38 already says crafting is a road, not the road).
- Exploring pays: the best pay sits far out and high on the difficulty scale (`docs/design/SETTLEMENT.md` 3.6, kernel review 7.2 item 4), and the top of the worth board stays on top by going out (the boards entry above).
- The exploration board ranks the places, areas and secrets a player found.
- The world must not run out: a new area comes as an expansion, as the spec already has it. A season's discovery that vanished at the season's end would be the "last chance" G28 forbids, so how seasons add to the world is the next question (Q5).

**Closes:** no row; it sets what the next questions serve.
**Retry when:** playtests show players settling in town and no longer going out. Model: claude-opus-5-5.

## 2026-10-09 ✅ A season adds to the world, and what it adds stays

The question (9.10): the spec makes a season a few weeks with a seasonal discovery, a seasonal collection challenge and a title that stays on the character, and opens the first one at stage 4. A discovery that vanished at the season's end would be the "last chance" G28 and G42 forbid, which the entry on combat and group quests left open the same day. The recommendation: a season opens a chapter that stays, and only the season's board closes. The owner's word (9.10): yes, and a season is not only an area: it may add quests, characters, quests in the world that already exists, even another cellar in a house, or the seasons of the year, holidays and the like.

- A season adds content of any kind: an area, quests, characters, quests for the places and characters already in the world, a new part for a house such as a cellar, recipes, finds. What it adds stays in the world for good, and a player who comes later plays all of it.
- Only the season's board closes at its end. Those who stood out in it keep a title with the season's name: honor with no use, and the one thing that cannot be had after the season, as a board's rank cannot. The spec's sponsor prizes ride on that board.
- A season's content names the season that brought it, for the board's season filter and the journal, and never carries an end date. A new part for a house follows the house's own rules (`docs/design/SETTLEMENT.md`): built in steps, by choice, and never a duty.
- The seasons of the year and the holidays are a question of their own (asked next): whether they follow the real calendar or the valley's own.
- Seasons serve exploring, the players' common task (the entry above): each one leaves more of the world to find.

**Closes:** the open line on seasons in the entry on combat and group quests; GRUNT's open ends carry the guard as CR-41.
**Superseded in part (10.10):** a new part for a house waits with houses, paused since 10.10 (the entry on houses and plots paused).
**Retry when:** the first season shows players who missed it feeling locked out, or a season adds nothing to explore. Model: claude-opus-5-5.

## 2026-10-09 ✅ The valley's year is the real year, its days stay short, and each season gives the expansions a theme

The question (9.10): do the seasons of the year and the holidays follow the real calendar or the valley's own? The recommendation was the valley's own, for three reasons: the game is for the whole world and the south has summer when the north has winter; a real holiday belongs to one culture, while G22 asks for the valley's own names; and a real holiday comes back only after a year, the wait G28 forbids. The owner's word (9.10): a real year, and the days can be half a real day or less. Besides the holidays, each season gives the expansions general themes, and the aim is a world that deepens all the time, maybe several times a week, as far as the community of creators allows.

What other games do, as read for this answer. A day: Stardew Valley about 14 minutes, Minecraft 20, Terraria 24, Breath of the Wild 24, Valheim about 30, GTA V and Red Dead Redemption 2 48; Animal Crossing and World of Warcraft run on the real clock. A year: Stardew Valley keeps its own short year with its own festivals; Animal Crossing and Pokemon GO follow the real year and the player's half of the globe; World of Warcraft holds its festivals on real dates under its own names (Winter Veil, Hallow's End); Minecraft and Terraria, with short days, dress the world for Halloween and Christmas on the real dates, and Terraria also sells an item that calls a holiday night at any time. Content: Fortnite, Destiny, Sea of Thieves and Pokemon GO run themed seasons of about three months, Path of Exile a league every three to four months, and Old School RuneScape ships an update almost every week, after a players' poll for the big ones.

- The valley's year is the real year: its seasons of the year turn with the real months, and its holidays fall on real dates.
- The days stay short, as the owner allows: a day and its night are half a real day or less. Today `day_length_ms` is 20 minutes of play, inside the bounds of 10 to 40.
- A holiday carries the valley's own name, as World of Warcraft does, so G22 holds and no player's holiday is left out. It comes back every year on its dates. What only a holiday gives is a look or a title, bound to the character and never traded, so no holiday makes a thing rare on the market. G42 carries this as its one written exception.
- The date comes from the server once accounts exist. In the demo it comes from the device, where turning the clock gains nothing that lasts, since nothing from the demo passes to an account. The date enters the kernel as an input recorded with the actions, so a replay gives the same result.
- Each season gives the expansions a general theme. The theme invites and never gates: an expansion off the theme still lands by the same rule, as the spec has it for open calls, where nobody is bound and nobody blocks.
- The world deepens all the time: expansions land as often as the creators make them and they pass the check, several times a week as an aim. What lands stays (the entry on seasons above), and every change to the schema stays additive, so a saved game always loads.
- Open, asked one at a time: whether a thing may exist in one season of the year only (answered the same day, the entry below), which half of the globe the seasons follow (answered the same day, the entry on the halves of the globe), and how long a content season runs (the spec says a few weeks; most games run about three months; answered the same day, the entry on a season's length).

**Closes:** the calendar, in part; GRUNT's open ends carry the building as CR-42.
**Superseded in part (10.10):** a holiday's reward is that year's only (the entry on a content season), and a holiday lasts at least 14 days and is earned in one session (the entry on the world and its clocks). Demo saves reset once when the new opening lands, and from then on a save always loads (the entry on saves, among the ten answers; the entry on the game read as one line).
**Retry when:** players in the south or of another culture find the year strange, or creators cannot keep up with a season's theme. Model: claude-opus-5-5.

## 2026-10-09 ✅ Some things come only in their season of the year, and the rest change in amount

The question (9.10): with the real year, may a thing exist in one season of the year only, a fish found only in summer? Whoever missed the summer would wait nine months, and G42 bars rarity by a timer. The recommendation was that a season of the year changes how much, where and the look, and everything is found all year somewhere. The owner's word (9.10): a mix of the two. Some things change with the season, and of others there is simply less or more.

- Two kinds of seasonal content. A thing of its season is found only in its season of the year and comes back every year. Of everything else a season changes the amount, the place or the look: more berries in summer, the fish in deeper water in winter.
- A thing of its season always shares its class with a thing found all year (G45), so every recipe, quest step and tool that needs it takes the other too. A quest step asks for the class, never for the thing of a season. Missing a season costs a wait, never a use or a way forward.
- What a thing of its season gives is variety, a journal and collection entry, and trade: its stock in the market drains out of season, so its price rises inside R8's band and a player who kept some can sell them then. The band bounds it, so no season makes a fortune.
- Its rarity counts in the world's one rarity budget (G42), as any rare thing does.
- G42 carries this as its second written exception, beside the holidays: both on the real calendar, both back every year.
- How much of the world turns with the seasons is a matter for content: each season of the year should bring some things of its own, and most of the world only changes in amount.

**Closes:** the first of the calendar's open questions; GRUNT's CR-42 now carries it.
**Retry when:** players read a thing of its season as locked away, or a recipe or quest is found waiting for a season. Model: claude-opus-5-5.

## 2026-10-09 ✅ The half of the globe follows the audience

The question (9.10): with the real year, the south has summer while the north has winter, and in a shared world everyone must see one season, or two players at one lake would see different fish. The recommendation was one northern calendar for all, as World of Warcraft and most games do, and a world for the south once there are many worlds. The owner's word (9.10): as fits the audience that joins.

- A player's own valley follows the player. Its half of the globe comes from the device's time zone when the account opens and then stays, as Animal Crossing sets a hemisphere once when an island is made. No location is asked for or kept: a time zone is enough to tell the half.
- A shared world holds one calendar, set when it opens, by the half where most of the players it opens for live, counted from time zones in aggregate and never kept per player. When enough players from the other half join, a world opens for them.
- A holiday tied to a season of the year, a winter festival, falls in that season of the world's own calendar, so under a southern calendar it comes six months later. A holiday tied to no season keeps its date everywhere.
- If things from a valley reach a shared world's market, a thing of its season from a valley of the other half sells like any thing out of season, inside R8's band. A false time zone when the account opens gains no more than a player of the other half has anyway.

**Closes:** the second of the calendar's open questions; GRUNT's CR-42 now carries it.
**Retry when:** a shared world's players split between the halves, or players find their valley's seasons wrong. Model: claude-opus-5-5.

## 2026-10-09 ✅ A content season runs a quarter of the year under its theme's name

The question (9.10): the spec makes a season a few weeks; Fortnite, Destiny, Sea of Thieves and Pokemon GO run about three months. The recommendation: three months, a quarter of the real year, named by its theme, the theme announced a month ahead, the season's board reset each quarter, and expansions landing every week inside it. The owner's word (9.10): yes.

- A content season runs a quarter of the real year. Its name is its theme, never winter or summer, since the halves of the globe see opposite seasons (the entry on the halves of the globe).
- Its theme is announced a month before it opens, so creators have time to build to it. This is the fixed date the spec gives creators to build around.
- The season's board resets each quarter (the boards entry); what the season added stays (the entry on seasons).
- Expansions keep landing every week inside a season, as often as creators finish them and they pass the check.
- This changes the spec's "a few weeks". The spec's sponsor model rides on the season, now four a year.

**Closes:** the last of the calendar's open questions; GRUNT's CR-41 now carries it.
**Retry when:** creators run out of a theme before its quarter ends, or players tire of one theme. Model: claude-opus-5-5.

## 2026-10-09 ✅ The reference player executes perfectly, with nothing worn, no points spent and full health

The question (kernel review D2, open since 6.10): who is the player the value table prices an hour of work for? The recommendation: perfect execution, no build, fed, so everyone else earns less than the reference for execution and never more, and a bot with perfect timing gains nothing over a skilled human. The owner's word (9.10): yes, but the food bar was replaced by health (G32).

- The reference player hits every minigame perfectly, wears nothing, has spent no points, and is at full health. Low health slows work (G32), so a hurt player earns less, as a hungry one did.
- Nothing drains health by the clock (G32), so the reference eats nothing per hour and food is no running cost of work. The review's V10, a food whose value depends on itself through the cost of an hour, does not arise.
- For execution nobody earns more than the reference. Worn items and points add on top, inside the power cap (R9) and the ceiling of the effort weights (kernel review 7.1).
- The kernel already works this way: a timing grade can only lower the goods below perfect play (`kernel/src/step.ts`).

`docs/kernel-review-v1.md` section 5 marks D2 decided.

**Closes:** D2 of the kernel review.
**Superseded in part (10.10):** until P-5 the kernel still drains satiety (the entry on the hunger clock), so until then the reference player is fed and food stays outside V; from P-5 the reference is at full health, as above.
**Retry when:** a playtest shows a player out-earning the reference on execution alone, which would be a fault in the value table. Model: claude-opus-5-5.

## 2026-10-09 ✅ Gold entering a world with many accounts: a fixed base, one ledger, a daily cap, a small automatic step, and a server that keeps the books as a bank does

The question (kernel review D4, to be decided before stage 4 by the review's 8.3): the ceiling on gold holds per account, so a thousand accounts, or one program playing around the clock, mint far more, and from stage 4 gold can move between accounts. The recommendation: r fixed for good, one ledger, a daily cap per account on what the trader pays, set above a long human day, and a small automatic step down of the trader's share when more gold enters than leaves two weeks running. The owner's word (9.10): yes, and the mechanisms need real enforcement, as money is protected in the real world; with a server that is possible.

- r, the base of every price, is fixed for good, so prices never shift under the players.
- One ledger records every coin that enters, leaves or moves, each with a reason from the closed list (CR-39). Only activity code mints (R6), and only the server writes the ledger.
- A daily cap per account on what the trader pays: `trader_day_cap`, to start the reference player's pay for 8 active hours. A person does not reach it in a long day; a program playing around the clock does. It resets each day and never takes back what was earned, so it punishes no absence (G28).
- When gold minted exceeds gold burned two weeks running, the trader's shares (`k_permille`, `k_craft_permille`) step down one small step, only inside the bounds the community voted (R12), and step back up the same way when the balance turns.
- The free market brakes many sellers too: in a shared world, a thousand accounts selling one thing lower its price for all (the crafting economy entry).
- The server enforces it as a bank keeps money. It alone changes gold. Every movement is written twice, who paid and who got, so the books always balance. Each day the sum of all balances is checked against all gold minted less all gold burned, and a gap holds trade between players until it is found. Patterns a bank would flag are flagged here: an account at the cap every day, gold flowing from many new accounts to one, trades again and again at the edge of R8's band. What happens to a flagged account, and how a player appeals, is the policy of A1, asked in turn.
- In the demo none of this applies: gold lives in the browser, and nothing passes to an account.

`docs/kernel-review-v1.md` section 5 marks D4 decided.

**Closes:** D4 of the kernel review; GRUNT's open ends carry the building as CR-43.
**Superseded in part (10.10):** the daily cap is 8 active hours at the kernel's ceiling for the account's level, not at the reference player's pay, and it resets at 00:00 UTC. The step is counted per shared world from stage 4, on burns net of refunds, and never climbs above where it started. The range of r in `content/core/params.json` closes to its value (the entry on prices and gold).
**Retry when:** the books show gold growing faster than the sinks for a month, or real players reach the daily cap. Model: claude-opus-5-5.

## 2026-10-09 ⏸ If magic comes: scrolls and books carry it, and an ancient language is learned slowly

The owner's word (9.10, raised unasked): if there is magic, scrolls and books should be its items, and maybe an ancient language that has to be translated little by little; how to make that fun is to be thought through together.

What it meets already:
- No magic exists in the game or the spec today, and no combat (G35). Magic would come as its own system with its own plan, as weapons will (CR-12).
- A scroll fits the tool with uses, spent as it is read; a book fits the tool without uses, which lasts (the crafting economy entry). Whatever a spell does stays inside the power cap (R9) and never mints gold or items outside an activity (R6).
- The ancient language is a puzzle inside the world, in an invented script, never a second language of the game: every line a player reads stays plain English (G22), and the script is drawn, not spoken.
- It serves exploring, the players' common task: words are found on stones, in ruins and in books, and each word found lets a player read a little more, as the journal grows.

A reading for the fun, from games that made it work: Heaven's Vault and Chants of Sennaar make deciphering the game itself, where a player guesses a word from where it stands and what is drawn beside it, and the guess holds when it fits again elsewhere; Tunic hides its own manual in a script the player slowly learns to read; Skyrim teaches its dragon words one wall at a time. A word known counts on the character, so a guide on the internet can tell a player what a scroll says, but only a character who found the words can use it.

Open, for the owner when magic is planned: whether and when magic comes; what a spell may do without combat (light, growth, mending, finding); whether one language serves the whole world.

**Closes:** nothing; it waits for a plan for magic.
**Retry when:** magic or the ancient language is planned. Model: claude-opus-5-5.

## 2026-10-09 ✅ The creators' pool comes from gold already spent and is split by active play

The question (kernel review D5): what exactly does the creators' pool pay for, and where does its gold come from? The spec gives creators a weekly share by use from stage 4. The recommendation: the pool is never minted but taken from gold that left the world, split by active seconds with a cap per account-day, 60, 20 and 20 to the activity, the place and the quest, gear paid from its sale, and no gold for votes. The owner's word (9.10): yes.

- The pool is never minted. Each week it is a fixed share (`creator_pool_permille`, a bounded parameter, R12) of the gold that left the world that week: prices paid to the settlement and the shop, and fees. A week with little spending pays little, and the pool adds no gold to the world.
- The gold the pool takes no longer leaves the world, it moves to creators: the daily balance and the step of the trader's shares (the entry on gold entering a world) count it as moved, with the reason `royalty`, and count only the rest as burned.
- It is split by active seconds in each creator's content, taken from the server's validated action logs (R10), at most 2 hours per account-day. An idle account plays no active seconds; many accounts meet the cap and the flags of the entry below.
- Of what a piece of content earns, 60% goes to the creator of the activity, 20% to the creator of the place, and 20% to the creator of the quest that led there (R10's attribution table, bounded parameters).
- A creator of gear is paid from its sale, not from the pool, since gear touches every action of its wearer (C3).
- No gold for a poll vote (A19).
- Creator points stay as they are. The points entry of 7.10 waited for D5: this entry is the pool's rule, and creators' rewards get their own document when stage 4 is planned.

`docs/kernel-review-v1.md` section 5 marks D5 decided.

**Closes:** D5 of the kernel review, and the wait of the points entry of 7.10; GRUNT's open ends carry the building as CR-44.
**Retry when:** creators find the pool too small to matter, or one creator's accounts take a large share of it. Model: claude-opus-5-5.

## 2026-10-09 ✅ An exploit loop costs its accounts and the gold it made

The owner's word (9.10, with the answer on the creators' pool): every movement is in the system, so if a new account at once passes its starting capital on, or certain accounts show a fixed pattern and identical or too regular times, that is the sign of a loop exploiting the system: the accounts are blocked and lose the gold that was made. This answers part of A1 (the entry on bots).

- The server's books hold every movement of gold and goods (the entry on gold entering a world), so a loop leaves a trail.
- The signs of a loop: a new account that passes its starting gold or its first earnings on at once; the same run of actions again and again; times identical across accounts, or too regular for a person, since a person's timing varies and the server keeps every action's time and timing grade (K10); gold going round between the same accounts.
- As a bank holds a new account, the starting gold and kit are bound to the account and cannot be passed on, and an account's first trades with other players open after it has played a while (`new_account_hold`, counted in active play, never in days, so no absence is punished, G28). The plainest loop is closed before it starts.
- On suspicion the accounts are held: no trade and no transfer until it is decided.
- A loop found: every account in it is blocked, and the gold and goods the loop made leave the world, written in the ledger with the reason `forfeit`. Forfeited gold is burned and never handed to anyone, so nobody gains by flagging another.
- Who decides (asked the same day; the owner's word, 9.10: yes to the recommendation): the rule holds the accounts at once, and a person reads the trail and decides the block. The player is told why in plain words and may appeal once, to another person. Until it is decided nothing is taken. Banks freeze by rule and review by hand; RuneScape finds bots by rule, bans them in waves, and hears appeals.

**Closes:** part of A1, with who decides a block; GRUNT's CR-43 now carries it.
**Retry when:** a real player is caught by a flag, a loop runs unflagged, or the appeals outgrow the people who hear them. Model: claude-opus-5-5.

## 2026-10-09 ✅ A program may advise a player, never play for one; a first offense costs what it made and two weeks, a second the account

The question (A1, the rest after the entry on exploit loops): what happens to one account caught letting a program play for it, with no loop and no other accounts? The rule proposed with it, from the owner's word on AI that plays in a player's place: a program may advise, never act. The recommendation: the first time, what the program made is burned and the account is blocked for two weeks; the second time, for good; a farm of many accounts is a loop and is blocked for good at once. The owner's word (9.10): yes.

- Every action in the game comes from a person's input. A player may ask an AI or a guide where to go or what to make, as one reads a guide on the internet; a program that presses, walks or plays the minigames in a player's place is forbidden, whether the player is there or away.
- The first time an account is found letting a program play: what the program made is burned with the reason `forfeit`, and the account is blocked for two weeks. The second time, it is blocked for good. RuneScape gives a first offense a temporary ban and bans farms for good.
- A farm of many accounts is an exploit loop and is blocked for good the first time (the entry on exploit loops).
- Finding it follows the same path: the signs (a timing too regular for a person, the same run of actions again and again, a session no person plays), the rule holds, a person decides, and the player may appeal once to another person.
- What a program could still gain is hours, and the hours are capped where they turn into gold: the trader's pay per day (`trader_day_cap`), the creators' pool per account-day, and plots drawn among the workers rather than taken first.

**Closes:** A1; GRUNT's CR-26 now carries the rules.
**Retry when:** programs are found playing faster than people can hear the cases, or real players are caught by the signs. Model: claude-opus-5-5.

## 2026-10-09 ✅ In a shared world each player gathers their own yield, except in the areas between players

The question (9.10): the spec limits resources at the world level once the market comes: a bush gives a fixed amount an hour however many players stand by it, and whoever comes first takes. The recommendation: each player gathers their own yield from every bush and tree in the towns and the wild, as Guild Wars 2 does, and nodes are shared only in the areas between players. The owner's word (9.10): yes.

- Outside the areas between players, a node's state is kept per player: what one player gathers or fells, the next player still finds. A tree one player fells stands for the others, and grows back in its stages for the one who felled it (the entry on wood). Others still see the player at work.
- Why: the entry on competition says players compete for places only, never for resources; first come would let a program playing around the clock strip the valley before anyone (the entry on programs that play), and a new player by the town would find nothing.
- The brake on a flood stays the market: when everyone gathers fruit, the price of fruit falls (the free market of the crafting economy entry), the signal to turn to something else, as the spec wants. Capacity stays per account, as the kernel review's ceiling always was (R6, review 7.1).
- In the areas between players nodes are shared and whoever comes first takes: part of the risk and the reward of an area a player chooses to enter (`docs/design/SETTLEMENT.md` 3.9).
- This changes the spec's world-level limit on resources; the spec's market section follows in its next version.

**Closes:** the question of shared nodes; GRUNT's open ends carry the building as CR-45.
**Retry when:** a shared world feels empty because players never meet at the same bush, or the market fails to move players off a crowded activity. Model: claude-opus-5-5.

## 2026-10-09 ✅ A look bought with money is bound to the account; the same look found in the game trades

The question (9.10): G39 lets only a look with no effect carry the premium marker, and the spec sells premium currency one way only, money to currency and never back. May a look bought that way be traded? The recommendation: no, it is bound to the account, and the same look found in the game trades like any item. The owner's word (9.10): yes.

- A look bought with money or premium currency is bound to the account: it is never traded between players and never sold to the trader.
- The same look found in the game, as treasure or a reward, trades like any item, inside R8's band.
- Why: a bought look that trades is a road from money to gold. A player buys it with money, sells it to another for gold, and gold buys tools, so money would buy power by a side door, which G39 forbids. Path of Exile keeps bought looks off its trade for the same reason; Guild Wars 2 and the World of Warcraft token open that road on purpose.
- A bound look counts nothing toward worth on the boards, since the trader does not buy it (the boards entry). A holiday's look is bound to the character in the same way (G42).
- G39 now says so.

**Closes:** the question of bought looks; GRUNT's open ends carry the building as CR-46.
**Retry when:** stage 6 opens payments, or players ask for a way to give a bought look to a friend. Model: claude-opus-5-5.

## 2026-10-09 ✅ Players' words: notes in free text behind a good filter, and later chat in bubbles over the head, never private

The question (9.10): the spec brings light presence with the market stage: the camps of others, tracks and notes. The recommendation was notes built from a fixed kit of phrases, as Dark Souls does, with no free text. The owner's word (9.10): notes in free text with good filtering; later maybe chat between players, but never private: bubbles floating over the head.

- A note is free text a player leaves at a place in the world. A filter reads every note before anyone else sees it and refuses rude words, links and addresses, phone numbers, e-mail addresses and other personal details, and offers to trade for money. The same filter reads every line of chat.
- Players mark a note as helpful, which keeps it up. A note reported by several players hides until a person reads it, as a person decides a block (the entry on exploit loops). A player may hide another player's notes and words from their own screen.
- A player keeps a few notes standing at once (`notes_max`), and a note fades after a while unless players keep finding it helpful, so the world is not littered.
- Chat, if it comes (the spec's live presence, stage 7), is words in a bubble over the speaker's head, seen by the players nearby for a few seconds: public and local. There are no private messages and no whispers; whatever a player says, others near could see. The game's own text stays for all ages (G22), and the players' words keep to the same.
- A note or a line of chat is kept on the server only as long as a report may need it; the privacy text of stage 2a says how long.
- The languages of notes were answered next (see the entry on the languages of notes). The group's channel was closed by the sweep of 10.10 (the entry on the shared world): a closed set of signals seen by the group alone, never free text.

**Closes:** notes and chat; GRUNT's open ends carry the building as CR-47.
**Retry when:** the filter lets through what it should stop, or stops what players need to say. Model: claude-opus-5-5.

## 2026-10-09 ✅ An account follows the age of similar games: 13, or the country's higher age

The question (stage 2a, the account entry): the minimum age for an account. The owner's word (9.10): the standard of similar games.

- An account needs the player to be 13 or older, as RuneScape and most online games with open chat ask, or the higher age of digital consent that the player's country sets, up to 16 in parts of the European Union.
- A younger player plays the demo, which keeps nothing and asks for nothing.
- The game's own text stays readable by a child of eight (G22): the content is for all ages, and the account has an age.

**Closes:** the minimum age; GRUNT's open ends carry it into the stage 2a design as CR-49. The privacy text and the mail service stay for the stage 2a design.
**Superseded in part (10.10):** "the content is for all ages" now holds for the words (G22). The look aims at ESRB E10+ and PEGI 12, and the younger player of the demo is one between the rating's age and the account's (the entry on menace with a limit).
**Retry when:** parents ask for a child's account; Minecraft and Roblox offer one under a parent's control with limited chat. Model: claude-opus-5-5.

## 2026-10-09 ✅ A player's shop: a sign over the player, and the shop stays open while they are away

The owner's word (9.10, with the answer on notes): a shop to sell from. One walks up to a player, a shop sign shows, and one buys what the player put up for sale, even when the player is not connected. The spec already brings personal shops with the market (stage 4).

- A player puts goods up for sale at a price each. The server holds them while they are listed, so nothing sells twice, and the player sees what sold when back.
- Online, a sign over the player says the shop is open, and anyone may walk up and buy. Offline, the shop stays at the player's house, or on the town's market board for a player with no house (the entry on the shared world), so the towns do not fill with sleeping players.
- Prices stay inside R8's band, as every trade between players does, and gold reaches the seller through the ledger with the reason `price`.
- Nothing bound is listed: a bought look, a holiday's look, the starting gold and kit (the entries on bought looks, on the calendar and on exploit loops). A new account's first sales wait for `new_account_hold`.
- A shop that sells while its owner is away is the valley waiting for the player, never a punishment (G28). A house that goes back to the town after 45 days away returns its listed goods to the owner's store with the rest.
- Listed goods count toward worth at the trader's pay, as all goods do (the boards entry).
- The sale fee (asked next; the owner's word, 10.10: yes): see the entry on the sale fee.

**Closes:** the rule of player shops; GRUNT's open ends carry the building as CR-48.
**Superseded in part (10.10):** until stage 7, where players see each other, a player's shop has only the forms it has while its owner is away, at the house or on the market board, whether or not its owner plays; the sign over the player comes with stage 7 (the entry on the game read as one line).
**Superseded in part (10.10):** while houses are paused, a player's shop sells on the town's market board (the entry on houses and plots paused).
**Retry when:** towns crowd with shops, or buyers cannot find what is for sale. Model: claude-opus-5-5.

## 2026-10-10 ✅ Ten owner answers that close the contradictions between the 9.10 sessions

The question (10.10): several sessions wrote decisions on 9.10 in parallel, and a read of all branches found twelve contradictions between them (the opening recut against W1 and C1, saves, the hunger clock, the night ruins, the miss, the hazards, starting recipes, the starters, the seasons). The owner answered one question at a time, three options each, on 10.10. Each answer below is final and supersedes what it names.

**Closes:** the contradictions of 9.10; the entries below hold each answer.
**Retry when:** a playtest contradicts one of them. Model: claude-opus-5-5.

## 2026-10-10 ✅ The opening's real choice is whom to help first

Under C1 every character wakes with its own tool, so the choice at Pell's stall between the basket and the trowel no longer chooses anything. The owner's word (10.10): the real choice at minutes 4-6 is whom to help first. Two neighbours ask for help: Maru (the bellberry behind the ruins) and Pell (the herbs on the bank). Each says before the choice what it gives, the two rewards differ in kind, and the other one waits for later. Both quests exist today (`three-fruits`, a `fetch_twist`, and `herbs-for-pell`, a `discovery`), so G17 holds whichever comes first. This replaces the stall beat of the opening recut (option B) and G12's model. A reward a starter already holds in its kit (the basket of `a-coin-for-maru` for the forager) is swapped for one it lacks; how is the recut's to write. The recut's build is its own pull request, after CR-24 and CR-37.

**Retry when:** a playtest shows players do not read the two offers as different. Model: claude-opus-5-5.

## 2026-10-10 ✅ Saves reset once when the new opening lands, and from then on a save always loads

The opening recut (option B) said saves need no care until the server keeps them; the entry on the real year said every schema change stays additive so a saved game always loads; W1 gave an axe to an old save. The owner's word (10.10): one reset. When the new opening lands (CR-24, CR-37, the recut), demo saves are dropped once, with one short notice on the title screen. From then on every change only adds, and a save always loads. Demo saves live in the browser only and never pass to an account, so the reset costs a few minutes of play. The recut's noon start may move `hourOf` at that reset. W1's catch-up (an axe for a saved character with none) is no longer needed.

**Supersedes:** "Saves need no care until the server keeps them" (the opening recut branch) and W1's line on saved characters. GRUNT's CR-62 and CR-2 carry the building.
**Retry when:** the demo holds players with long saves before the reset ships. Model: claude-opus-5-5.

## 2026-10-10 ✅ The axe and the starts come first; the crafting economy is tuned once, after them

The crafting work (waves 3 and 4, the economy) tunes prices on a world where a branch lies on the ground for free; W1 removes that node. The owner's word (10.10): the axe, felling (CR-24) and the starters' kits (CR-37) are built first. The crafting work keeps what it made and waits; its numbers (CR-31's gold per hour, the market's steps) are tuned once, on the world with felling.

**Retry when:** CR-24 and CR-37 are on `develop`. Model: claude-opus-5-5.

## 2026-10-10 ✅ The hunger clock stays until P-5, and P-5 comes right after the axe

G32 and the forbidden patterns bar a bar that drains by the clock, while the kernel still drains satiety (`satiety_drain_per_min`, full to empty in about fifteen minutes, then work at 1.5 times the time). The owner's word (10.10): the drain stays for now, G32 says it waits for P-5, and P-5 (health, hazards, the fall) is built right after the axe and the starts. Turning the drain off first would leave food with no purpose until then.

**Retry when:** P-5 lands. Model: claude-opus-5-5.

## 2026-10-10 ✅ The opening ends at the entrance of the night ruins, and the entrance is safe

The recut (option B) closes minute ten at the threshold of the night ruins; P-5's test walks into them at night and falls; P-6 opens the first expedition with the same arch and riddle the opening uses. The owner's word (10.10): the opening ends at the entrance and the player only looks in. The entrance is a safe area (danger 0) and the danger starts one step inside. P-6's first expedition gets a new opening of its own, and the arch and the three-stones riddle stay the opening's.

**Retry when:** a playtest shows players step inside on the first night anyway and fall. Model: claude-opus-5-5.

## 2026-10-10 ✅ A missed gather turns up something else, never nothing

G15 said a miss keeps something; the kernel and "Harder minigames" (7.10) keep 0 or 1 at random, so half the misses leave nothing. The owner found the options "keep 1" and "0 or 1" predictable; other games read for the answer: RuneScape makes a miss cost time only, Stardew Valley raises quality with precision and drops a treasure chest now and then, Animal Crossing's shaken tree drops furniture or a wasps' nest. The owner's word (10.10): a surprise. A miss turns up something other than the node's item, from the node's own miss table in its content file: a bruised fruit good for a mash, grit for a path, now and then a rare find, now and then only a thorn. Never an empty hand. The jackpot strip stays the reward for precision. A creator adds surprises by adding rows, with no code. Rare things on a miss table count in the world's one rarity budget (G42), and every item on it has a value from the solver.

**Supersedes:** the miss half of "Harder minigames: a miss keeps 0 or 1" (7.10); the jackpot strip stays. GRUNT's open ends carry the building as CR-60.
**Retry when:** players start missing on purpose for the miss table. Model: claude-opus-5-5.

## 2026-10-10 ✅ A hazard is escaped, never answered by an item; road thieves wait for weapons

The owner said on 9.10 that no gear answers a hazard and a predator is escaped by running back to town; G34 and P-5 still listed lantern oil, a torch, a rope and an antidote as answers and the road as the chase's end; the boards entry added road thieves answered by an item. The owner's word (10.10): only escape. A hunting hazard is escaped by running back to a safe place (the town, or a camp whose fire burns, G30); a waiting hazard is avoided by knowing its rule (the trap shows by day, the pit is where the floor is broken, the bad herb is safe cooked, the river has no bridge at night). No item bought or made answers a hazard. Healing is not an answer: food, a first-aid kit and a night's sleep still give health back (G32). Road thieves come later in the game, when there are weapons (CR-12), so "the top is hunted" in the boards entry waits with them.

**Superseded in part (10.10):** a safe place is G30's one safe place: the town, all ground at danger level 0 and a camp whose fire burns, another player's only for a guest with a deal (the entries on the game read as one line and on the five holes of the one line).
**Retry when:** combat opens (stage 8 or a vote). Model: claude-opus-5-5.

## 2026-10-10 ✅ First-tier recipes are known from the start; higher tiers are dug up

Crafting wave 3 gave all eleven of its recipes `known: start`, while the spec makes a recipe lost knowledge that someone digs up. The owner's word (10.10): a tier-1 recipe is known from the start so there is always something to make, and a tier-2 or tier-3 recipe is found by digging in the ruins, which gives digging a strong reason and each new recipe a moment of discovery. GRUNT's open ends carry it as CR-61.

**Retry when:** a playtest shows the forager or the explorer stuck at tier 1 for want of digging. Model: claude-opus-5-5.

## 2026-10-10 ✅ Three starters now: the forager, the digger and the explorer, who finds

The art entry names three roles (explorer, forager, digger) and the 3D trial rigged the digger, while the content and C1 knew two. The owner's word (10.10): three now. Each wakes with its own kit and gets its axe its own way before the first fire (C1):

- The forager wakes with a basket and an axe, and picks first.
- The digger wakes with a trowel, and its first find is its own axe, dug from the ground (C1's explorer start moves here).
- The explorer wakes with a walking staff and sharp senses: it sees hidden places from further away, and finds its axe hidden by the bridge. The find by the senses at minutes 2-4 of the opening is its beat. It uses the hint the game already draws for a dig site, widened by senses.
- The explorer's senses get an animation of their own, fitted to the explorer, in place of the generic hint circle (the owner's word, 10.10). The owner judges it on the preview.

All three keep C1's checks: one attribute total (6), one band of kit value, one band of effort to the first fire. GRUNT's CR-37 carries the building.

**Retry when:** a playtest shows one start slower or richer than the others. Model: claude-opus-5-5.

## 2026-10-10 ✅ A content season runs on the quarter of a season of the year; a holiday's reward is that year's only

"Season" meant two things: a content season of a quarter with its board and titles, and a season of the real year. The owner's word (10.10): one season. A content season runs on exactly the months of a season of the year (March to May, June to August, September to November, December to February), and keeps its theme's name, since the halves of the globe see opposite seasons (the entry on a season's length holds). For holidays the owner chose "one time" (the option that breaks the rule of no last chance) and said to fix the rule to fit: a holiday still falls on its real dates every year, but what it gives is that year's only, a look or a title marked with the year, bound to the character and never traded. Whoever misses it does not get it later; the next year's holiday gives its own. This is the game's one "last chance", and it costs a look or a title, never a use, a recipe, a tool or a way forward. G28 now carries it as its second written exception, and G42 names it. G30's hours also follow the kernel's (dark from 20:00 to 05:00), a correction with no owner question, since the code is what the player sees.

**Supersedes:** "It comes back every year on its dates" for what a holiday gives, and the "no last chance" of G28 for holidays only (the entry on the real year); GRUNT's CR-41 and CR-42 carry the building.
**Superseded in part (10.10):** the exception for plots and houses is paused with them (the entry on houses and plots paused), so the holidays are G28's one written exception while it lasts.
**Retry when:** players who missed a holiday feel locked out or pressed to log in on its dates. Model: claude-opus-5-5.

## 2026-10-10 ✅ A sale between players burns a small fee, paid by the seller

The question (10.10, after the entry on a player's shop): should a sale in a player's shop pay a small fee that leaves the world? The recommendation: yes, about 2 percent of each sale, burned, as RuneScape's Grand Exchange takes a tax on each sale, kept as a bounded parameter that the demo tunes. The owner's word (10.10): yes.

- Every sale between players pays `sale_fee_permille` of its price (20 to start, bounded 10 to 50, R12). The buyer pays the listed price, and the fee comes out of what reaches the seller. The seller sees both numbers when listing.
- The fee is burned. The ledger writes it with the reason `tax` (`docs/design/SETTLEMENT.md` 3.9), so it counts among the gold that left the world, from which the creators' pool takes its share (the D5 entry).
- It is counted on each sale in milli-gold and rounded up, as R8 rounds every charge, so a cheap sale pays a little and selling one unit at a time does not escape it (amended 10.10 by the sweep; the first text rounded down to whole gold).
- Listing, changing a price and taking goods back are free, and goods never sold pay nothing. Goods that go back to the store with a returned house pay nothing (G28).
- The fee follows the gold, whatever the deal is called. Today a shop is the only way gold passes between players. If trades or gifts of gold between players come, they pay the same fee, so a sale cannot pass as two gifts. If gifts of goods come, a gift pays the fee on what the trader pays for the goods that day (amended 10.10 by the sweep; the first text let goods given for no gold pay nothing).
- Selling to the trader pays no fee, since the trader already pays less than the shop asks for the same item.
- Why: the fee takes gold out where it gathers, so more trade means more gold leaving. It also costs something on every round of gold moved in circles between accounts, beside the signs of a loop (the entry on exploit loops).

**Closes:** the sale fee; GRUNT's open ends carry the building as CR-50.
**Retry when:** sellers leave the shops because the fee eats their margin, or gold still piles up with the fee at its top bound. Model: claude-opus-5-5.

## 2026-10-10 ✅ Notes and chat are written only in the languages the game is offered in

The question (10.10, after the entry on players' words): in which languages may a note be written, since the filter must read every one? The recommendation: only in the languages the game itself is offered in, English today, and each player sees the notes in their own language. The owner's word (10.10): yes.

- A note or a line of chat is accepted only in a language the game is offered in. Today that is English.
- A new language of the game brings its filter with it, and only then may players write in it.
- Each player sees the notes and words written in the language they play in, so the world does not fill with text they cannot read.
- Why: a note in a language the filter cannot read is a way around it, for rude words and personal details alike. A filtering service for every language costs money and reads small languages poorly.

**Closes:** the languages of notes; GRUNT's CR-47 now carries it.
**Retry when:** the game is offered in a second language, or players ask to write in one it is not offered in. Model: claude-opus-5-5.

## 2026-10-10 ✅ A sweep for holes in the design, closed by default from the games already read

The question (10.10, after the answer on the languages of notes): the owner asked not to be asked the small questions one at a time any more. The owner's word (10.10): look for every hole in the design and the idea, close each one by the games already discussed, write a report of every hole closed, and the owner writes back where a change is wanted. Four reads ran over the rules, the decisions, the settlement plan, the kernel review, the open ends and the open pull requests: the economy, the shared world and its people, the world and its time, and the documents against each other. Each hole is closed by default with the game it follows, in the four entries below. A change from the owner comes as an entry of its own and supersedes the line it names.

- The economy: the entry on prices and gold.
- The shared world, accounts and safety: the entry on the shared world.
- The world, the fall and time: the entry on the world and its clocks.
- The documents against each other: the entry on which text wins.

**Closes:** the holes listed in the four entries below; GRUNT's open ends carry the building as CR-51 to CR-59 and CR-70 to CR-87, and CR-10 and CR-14 are decided.
**Retry when:** the owner changes one of them, or a playtest shows one closed the wrong way. Model: claude-opus-5-5.

## 2026-10-10 ✅ Prices and gold: a band between players, two funds that never meet, and every mint and burn bounded

The question (10.10, the sweep): where could gold pass between accounts, appear from nothing, or escape a fee? The owner's word (10.10): close each hole by default from the games already read.

- **A band on prices between players.** A listing's price sits between what the trader pays for the item today and `trade_max_permille` (1500, bounded 1200 to 2000, R12) of `r*V`; a worn tool's band shrinks with its uses left, as the trader's pay does. A trade outside the band is refused, so gold cannot pass between accounts as an inflated or a giveaway price. An item with no V cannot be listed. Like RuneScape's Grand Exchange of 2007 to 2011, which held each trade inside a band around a guide price. The kernel review's R8 and its verdict 3c change with it.
- **Two funds that never meet.** The spec's creators' fund, 40% of net income, pays money; the pool of D5 pays gold. Both split by active seconds, and neither ever turns into the other. A royalty, for an extension, a rent or gear, is cut from gold already leaving a player (a price, a fee, a rent) with the reason `royalty`, and is never minted; only the rest reaches the pool. Gold never becomes money and money never becomes gold (G39). Roblox's exchange of its currency for money is the road refused: it makes play a job and invites trade for money.
- **The premium currency.** Bought with money only. It is never bought with gold, never traded, given, listed or turned into gold, everything it buys is bound to the account, and it counts on no board (G39). Like the points of Path of Exile.
- **One person, one account in a world.** One account per person in each shared world, said at sign-up. One person's accounts never trade, give or pool with each other; a pair found doing so is an exploit loop (the entry on exploit loops). Selling gold, goods, places or an account for money is a loop for both sides. Input sent to two accounts at once is a program playing (the entry on programs that play). Two accounts played by hand in different worlds are allowed. Accounts found to be one person's count as one for every limit. Like RuneScape's rules on real-world trading, and World of Warcraft's ban on sending one input to several characters.
- **The trader's daily cap.** `trader_day_cap` is 8 active hours at the highest pay the kernel allows at the account's level (Theorem 3 of the kernel review, with the most that worn things and points can add), so no person reaches it by play, however well geared, while a program playing around the clock does. It resets at 00:00 UTC on the server's clock. Like RuneScape's daily reset. This changes the entry on gold entering a world, which pinned it to the reference player.
- **The refund is the one mint that is not activity.** The plot refund (`plot_refund_permille`) is the one written mint outside R6, tied to the burn it returns and never above it. The pool and the step of the trader's shares count burns net of refunds; a week whose net burn is not above zero pays no pool. R6 gains this one exception.
- **The pool and the trader's share bound each other.** The check keeps the top bound of `creator_pool_permille` plus the top bound of `k_craft_permille` below 1000, so buying from the shop and selling back to the trader never pays a creator more than the round trip lost. The active seconds of an account under `new_account_hold` count for no creator.
- **The sale fee is counted in milli-gold and rounded up**, as R8 rounds every charge, so a cheap sale pays a little and selling one unit at a time does not escape it. This amends the entry on the sale fee, which rounded down to whole gold.
- **A gift of goods pays the fee too, when gifts come.** It pays on what the trader pays for the goods that day, from the giver. Gifts open only once both accounts are past `new_account_hold`, a bound item is never given, and the ledger writes a gift with the reason `gift`. Like RuneScape's trade limits of 2007 to 2011. This amends the entry on the sale fee, where goods given for nothing paid nothing.
- **Starting gold and the kit are bound.** The starting gold is a bound balance beside the purse, spent first and only at the shop, the trainers and the settlement, never paid to a player or listed. The kit's items are bound to the character, never listed, sold or counted in worth. The kit's band is measured at the shop's price, or at V where no shop sells the item. So a new account is never a source of gold or goods for another. Like World of Warcraft's Starter Edition, whose accounts could not trade.
- **A miss table has a ceiling.** The check refuses a miss table whose expected value per miss reaches `miss_value_max_permille` (500) of the hit's output value, so missing on purpose never pays (the entry on a missed gather).
- **The market's stock has edges.** The stock starts where both prices sit at base. The shop's price rises at most to `shop_max_permille` (1500) of `r*V`. In a shared world the stock drains on the server's hour while anyone in that world plays. An item with no V keeps a fixed price outside the market and is never listed.
- **The step of the trader's shares.** It is counted per shared world, from stage 4 only, on burns net of refunds. It steps back up one step when burns exceed mints two weeks running, and never climbs above where it started.
- **The ledger's reasons.** Mints carry `pay` (the trader's), `reward` (a quest's) and `find`; movements add `gift`, `donation` (a gift to the town), `escrow` and `closed` (an account closed) to the closed list of SETTLEMENT 3.9. A gift to the town counts in worth at that day's trader pay, fixed when given.
- **r is fixed.** The entry on gold entering a world fixed r for good, but `content/core/params.json` still gives `r_mg_per_value_ms` a range for a vote. The range closes to its value, and the check refuses a range on r.

**Closes:** the economy's holes of the sweep; GRUNT's CR-51 to CR-59 carry the building, and CR-50 is amended.
**Superseded in part (10.10):** the plot refund is paused with plots (the entry on houses and plots paused).
**Retry when:** the values tool or the books show gold piling up or draining faster than the step can follow, or an honest trade is refused by the band. Model: claude-opus-5-5.

## 2026-10-10 ✅ The shared world: whose progress, one world per character, one hour for all, and people kept safe

The question (10.10, the sweep): where did two players, a closed account or a word between players meet no rule? The owner's word (10.10): close each hole by default from the games already read.

- **Progress is each player's own.** In a shared world the opening, restores, riddles and quests stand per player, as nodes do (the entry on each player's own yield). Shared are only plots, houses, stalls and listings, notes, tents, the market and the nodes of the areas between players. A street whose restoring opens plots is a group restore, once per town, and its sign names everyone who helped. Like World of Warcraft's phasing.
- **One shared world at a time per character.** One bag and one purse per character. A character is in at most one shared world, and once it joins, its own valley trades through that world's market. A move between worlds is free once a content season, and the house is packed on the terms of 45 days (S1b). One house and one entry in a draw count per character across worlds, and so does a holiday's reward. Like World of Warcraft's realm transfer, and RuneScape's one Grand Exchange.
- **One hour for all.** Through stage 4 each player's valley keeps its own clock, paused by a window as it is today, and the shared market drains on the server's hour. From stage 7, where players see each other, a world has one hour for everyone that no window pauses, and a player's own nodes and camp fire count that hour too. A player who quits outside a safe area stays for a short countdown (`logout_countdown_s`, bounded), then leaves, and comes back at the same spot; in a safe area they leave at once. No hazard strikes during a minigame. Like World of Warcraft's twenty seconds outside an inn, and Dark Souls, which never pauses.
- **A tree between players.** In the areas between players, where nodes are shared, a tree stands on one chop timer that every swing there spends, and each swing's wood goes to its swinger, so two players at one tree both gain and the tree falls once. Like RuneScape's Forestry of 2023.
- **Closing an account.** Inside the game, with 30 days to change one's mind; signing in undoes it. The places return to the town; listings, goods and gold are burned with the reason `closed`, counted for no pool and no step; notes vanish; the name becomes "a traveller"; the ledger keeps its rows under a number. An account found to be under age is closed at once. Sign-up asks the birth date on a neutral screen and keeps only whether the age passed, and the country. Notes and chat are kept 30 days after they fade unless a report holds them, action logs 90 days and then as daily totals, and the ledger for good without a name. Like the app stores' rules, Apple's from 2022 and Google Play's from 2024, which ask for deletion inside the app.
- **Words have a ladder.** A word the filter missed and a person caught is hidden, with a warning that quotes it; the next costs a week without notes or chat; the next turns words off for good. Threats, sexual words or personal details are blocked by a person at once. One appeal, to another person. Moderation starts with the first stage where one player's words reach another, with two named people on the team. A report counts once per account past `new_account_hold`, and a reporter often overruled loses the power to hide by report. Like RuneScape's mutes.
- **The filter reads every name.** It reads every text a player sets that others see: the name, a world's name, a shop's and a house's words, a listing's note. It refuses the names of the valley's characters and of the team, and words like admin, moderator or the game's name. A name is unique in its world, and a person may replace a bad one. The demo shows no player's text. Like World of Warcraft's forced rename.
- **A block.** It hides that player's words and tracks and refuses their invites and friendship; from stage 7 the two are drawn faint and nameless to each other. A shop still sells to both. Nobody sees whether another is online or when they last played, except mutual friends, and a shop's sign may be off while its owner plays. Like World of Warcraft's ignore list.
- **Friends and groups.** Friendship is mutual and a refusal is silent. A friend online shows their town and may be invited to a group; there are no messages. A group talks in a closed set of signals (here, come, wait, help, found it, done) seen by the group alone, never free text, beside the bubbles everyone sees. Each member meets the quest's gates, the chance counts the members who acted in the current step, each member who finished a step gets its full reward once and never a split, and one who leaves keeps the steps paid. A house's building step is never a group quest. Like Journey's chime and the signals of Apex Legends.
- **A hold has an end.** A hold for review lasts at most `hold_max_days` (7), then lifts while the case stays open. While an account is held or blocked, its settlement clocks stop, its shop shows closed and no notice mail goes. "Played", for the 45 days, means one accepted action. What a loop forfeits comes only from the loop's own accounts, never from an honest buyer. A block for good returns its places at once, burns what it held with the reason `forfeit`, counted for no pool, and takes its listings down.
- **A freed plot is drawn.** A plot freed by a lapse or a packing opens for sign-up for `plot_signup_days` (3), then is drawn among those who signed up, past `new_account_hold`, one entry per account. With no sign-up it goes to the first who signs up. The winner's first step pays the price as before, and a winner who makes none within `plot_signup_days` loses it to a new draw. An owner of a packed house enters the draw like anyone, and the new plots of a clearing keep their own draw (S5). Like Final Fantasy XIV's housing lottery of 2022. SETTLEMENT 3.2 changes with it, where the first to step on a free plot held it.
- **Nobody blocks a way.** Players pass through each other. A placed thing, a tent, a note or a stall, never stands within `place_clear_tiles` of a path, a door, a bridge, a plot, a sign, a riddle, a dig, a node or another tent, and another's tent is walked through. A crowd beyond a handful is drawn faint. Like RuneScape and World of Warcraft, where players pass through each other.
- **The hunters' board, for when combat comes.** A hunter gets honor for a marked player once a day; never between friends, a group or one person's accounts, and only when the fall dropped finds. Finds pass by a fall only between accounts past `new_account_hold`, and falls traded back and forth are a loop's sign. Like World of Warcraft's diminishing honor.
- **One store.** The camp's storage chest and what a house adds are one store, reached from every town and tied to no plot. A packed house's contents and returned listings go there and may run over its size; nothing is ever dropped, and a store over its size takes in nothing new until there is room. A packed house waits as a deed. A player with no house sells offline from the town's market board, one list of such players' goods in each town: free, with no tile, no hold and no lapse. Like RuneScape's bank and Albion Online's market in each city.
- **Trade is safe by its shape.** A listing shows the item as the bag does. A buy carries the price the buyer saw and is refused if it changed. The game never asks for a password, and the filter refuses words that ask for one. An account is never shared or sold. A theft shown within 14 days is taken back through the ledger from the accounts on its trail, while a buyer who paid a listed price keeps what was bought. Like RuneScape, which never asks for a password.

**Closes:** the shared world's holes of the sweep, and the open line of the entry on players' words (the group's channel); GRUNT's CR-70 to CR-76 carry the building.
**Superseded in part (10.10):** "through stage 4" reads "until stage 7": every valley keeps its own hour until players see each other, the shared worlds of stages 4 to 6 included; and "stalls" and "a stall" are no thing a player places: a player's shop sells at the house or on the market board, and the stall is Pell's (the entry on the game read as one line).
**Superseded in part (10.10):** the draw for freed plots, a house's words and the places a closing returns are paused with houses and plots (the entry on houses and plots paused).
**Retry when:** a shared world's first season shows crowding, a draw that new players never win, or a word the ladder handled too hard or too soft. Model: claude-opus-5-5.

## 2026-10-10 ✅ The world and its clocks: what a fall keeps, three clocks, sleep, scraps and menace without gore

The question (10.10, the sweep): where did the world, the fall and time leave a road open or a player stuck? The owner's word (10.10): close each hole by default from the games already read.

- **A fall gains nothing.** After a fall each item keeps the smaller of its count when the outing began and its count at the fall, and a tool keeps the fewer uses. Nothing found on the outing stays, and nothing spent or given on it comes back, so falling and repeating never pays. Like Dark Souls.
- **A fall takes back only the outing's steps.** Each quest goes back to the step it stood at when the outing began, as P-5 already records; a quest begun on the lost outing starts again from its first step; in a group quest only the fallen player's steps of this outing go back. The worst is the outing (G33). Like World of Warcraft, which keeps a quest's objectives. This reads the hazards entry's "a quest in progress starts again from its first step" for the outing's own quests only.
- **Places count when brought home.** A place found counts once the player reaches a safe area with it; until then it is pencilled in, and a fall erases it. Like Elite Dangerous, where findings not yet sold die with the ship.
- **Health after a fall.** The player reappears with `fall_health_permille` of full health (bounded), never zero.
- **Sleep.** In a player's own valley, sleeping in a town or at a burning camp after 20:00 moves the clock to 05:00, restores health and burns the night's wood at once. It pays no active time (R6), and the rarity budget counts a day as its waking hours only. In a shared world nobody skips the night, and resting by a fire restores health over one game hour. Like Minecraft's beds, which skip the night only when nobody else is awake.
- **No way back is ever closed.** The axe, the basket and the trowel are always for sale at the stall. The check walks a character with no tools, no gold and an empty bag in a town back to each tool, through an activity that needs no tool. A find that comes once, lost to a fall, goes back to its spot. Like Stardew Valley, whose shop always sells the basic tools.
- **A full bag.** A gather or a craft starts only when its output has room. A quest's reward that does not fit waits with its giver. What comes back to a player (a lapse, a packed house, a listing taken down) goes to the store (the entry on the shared world). Like World of Warcraft, which refuses a turn-in to full bags and returns mail to the sender.
- **Recipe scraps.** A scrap dug up is a bag item until read; reading teaches the recipe and uses the scrap up. A dig draws only among recipes neither known nor carried, and with none left it gives an ordinary find. An unread scrap is lost on a fall like any find, and may be sold or given at its dig's value; a read recipe stays for good. Like Stardew Valley's lost books.
- **Nothing shortens a wait.** No skill node, worn effect, camp part or spell shortens a respawn, a growth or any wait, and the check refuses one. The spec's skill effect "shortening wait time" is dropped, and a magic of growth, when it comes, is held to this. Waits are capacity and never paid for (R6), and the rarity budget counts on them (G42).
- **Three clocks.** The game hour runs night, the windows of hours, respawns, the wood burned per night, the market's drain, a companion's next day and the morning toast. The real calendar runs seasons, holidays, content seasons, the holds of 14 and 45 days, notices, the fading of notes, "two weeks running" and the daily caps, which reset at 00:00 UTC. Active play runs `new_account_hold`, the pool's seconds and levels. Every parameter of time names its clock. Like RuneScape's daily reset at 00:00 UTC.
- **A holiday's bounds.** A holiday lasts at least 14 real days. Its look or title can be earned within one ordinary session inside them, and nothing asks a return on several days. Its dates follow the world's calendar at 00:00 UTC. In the demo a holiday only dresses the valley, since a demo save is not an account. Like World of Warcraft's Hallow's End, about two weeks long. This fits the answer that a holiday's reward is that year's only.
- **Quest points.** Only quests with a fixed id count, once per player across worlds. Errands drawn from a pool and repeatable quests count nothing. Points weigh the work part of a quest's difficulty only and are never shown before the quest is finished. Exploration counts once per player across worlds on a board across worlds, and per world on a world's board. Like RuneScape's quest points.
- **Menace without gore.** Menace comes from shape, sound and the dark only: no blood, no wound and no body, and a predator is never drawn biting. The text says the player fell, never that they died or were killed. The fall keeps its look from the hazards entry, crosses for eyes and a sinking into the ground. The aim is PEGI 7 and ESRB E10+. Like Stardew Valley, where the player passes out and wakes at the clinic. G46 carries it, and the spec's open line on the content limit is answered.
- **The digger's six points.** The third starter takes stamina 2, luck 2, carry 1, senses 1 and agility 0. The forager leans to carry and agility and the explorer to senses and luck, so the digger leans to the long work of digging and to its finds, and the total stays 6 (C1). Like Path of Exile, whose classes start at different points of one tree. CR-37 carries it with the digger's file.
- **A quest names a level for matching only.** A quest may carry a level band, used only to offer it to players near it. Outside the band it can still be taken and is harder, and the game never says a level is too low, as it shows no difficulty (the entry on difficulty, 9.10). Like Skyrim's radiant quests. CR-10 is decided.
- **A template's family is declared.** A recipe template fits core items, its own creator's items, and items whose file names the template's family on purpose. The merge check refuses the pull request that joins an item to a family it did not name, never the old template. Like Minecraft's tags. CR-14 is decided.
- **The demo's stamp outlives the reset.** "Played the demo since" and its date live outside the save, so the reset of saves (the entry on saves) does not take the demo's title away (D3).
- **The opening is walked on the clock.** The opening check walks every order of helping, with each starter's kit, on the game's clock from the starting hour, and refuses a road that waits on an hour window the start misses.

**Closes:** the holes of the world and time of the sweep, and GRUNT's CR-10 and CR-14; CR-77 to CR-86 carry the building.
**Superseded in part (10.10):** blood, a wound and a fallen body may show within a limit, visual only, and the aim is ESRB E10+ and PEGI 12 (the entry on menace with a limit). Sleep still skips the night in a shared world until stage 7, and from stage 7 nobody skips it (the entry on the game read as one line).
**Superseded in part (10.10):** the market's drain runs on the valley's hour in a player's own world and on the server's hour in a shared world until stage 7 (the entry on the game read as one line); a packed house waits with houses (the entry on houses and plots paused).
**Retry when:** players fall and repeat for gain, or players who played in a holiday's days miss its look. Model: claude-opus-5-5.

## 2026-10-10 ✅ Which text wins, and the lines that lagged brought in line

The question (10.10, the sweep): the documents disagreed in places, so a builder could follow a line the owner has since changed. The owner's word (10.10): close it by default.

- **Which text wins.** Where they differ, this file, `docs/design/GAME_RULES.md` and the kernel review win over the spec (`docs/spec/product-spec-v4.6.html`). The spec stays as it is until its next version, v4.7, which comes with a list of what changed. Its lines that lag, numbered as of 10.10: no clock while away (158); satiety (78, 325, 389); every recipe dug (261); two starters (310, 385, 703); a season of a few weeks (286, 376); the average player (540); a limit on resources for the whole world (576, 704); a dedicated server at stage 2 (674, 701); the open content limit (838); gold for poll votes (845); D2, D4 and D5 open (849); a skill effect that shortens a wait; a bonus never lost (116).
- **Brought in line in this change.** `docs/design/GAME_RULES.md`: the kernel rules are R1-R12; the skill row's miss and the stealth row's way out; the row on the difficulty curve; question 9 of the checklist and a new question 11; G39; G46. The kernel review: R6, R8 and verdict 3c; D6, decided in part on 9.10 by S4; the protection levels `safe`, `wild` and `contested`, as SETTLEMENT 3.9 names them; D2's line until P-5. `docs/design/SETTLEMENT.md`: 3.2 and 3.9. `docs/design/CRAFTING_AUDIT.md`: row 20, answered by `content/core/params.json` and S3. `docs/team/PLATFORM.md`: D5 has its formula, and the money fund stays apart. In this file: the supersede lines of the entries on hazards, on boards, on the real year, on the reference player and on gold entering a world, and the answer to the wood entry's shared tree.
- **For the branch of the ten answers of 10.10, on its merge.** GRUNT's CR-40 still names road thieves under the hazard system (P-5), and P-5 still writes `hurt` with the answer used; both follow the entry on a hazard escaped.

**Closes:** the drift between the documents found by the sweep; GRUNT's CR-87 carries the spec's next version.
**Retry when:** a builder follows a lagging line again. Model: claude-opus-5-5.

## 2026-10-10 ✅ Menace with a limit: blood, a wound and a fallen body may show, never for display, and the aim moves to PEGI 12

The question (10.10, after the sweep): the sweep closed the spec's open content limit as menace without gore (the entry on the world and its clocks): no blood, no wound and no body, aimed at PEGI 7 and ESRB E10+. The owner's word (10.10): blood, wounds and bodies may show, with a limit. It is not censorship, only no abuse put on display, and it is visual: it does not touch the system or the game itself.

- **What may show.** Blood, a wound and a fallen body, as part of how the world shows danger without a word or a number (the entry on difficulty, 9.10): a trail of blood where a hurt animal went, what a predator left at the edge of its woods, bones by a ruin, a predator drawn as it strikes.
- **The limit.** Nothing lingers, nothing is shown close up, no gore is there for its own sake, and no suffering is played for show: no screen, camera or sound dwells on pain. Blood and a wound show small and brief, at the sprite's own size.
- **A person never bleeds at the moment of harm.** A hazard that hits the player or a character of the valley shows the hit and the health it takes, never blood or a wound. A wound on a person shows only afterwards, as a bandage or a torn sleeve. A fallen person keeps the fall's look (crosses for eyes, a sinking into the ground), and nothing stays where they fell (G33). This is where PEGI puts the line between 12 and 16: at 12 there is no sight of blood or injuries during violence towards people, while an injury or a dead body may be seen if it is not too gory. Like Stardew Valley, whose ESRB rating counts small splashes of blood from defeated creatures and none from people.
- **Visual only.** It changes no rule, number or state. What a hazard takes, the fall and its cost (G33), the warnings (G31) and the run back to a safe place (G34) stay as they are. The text still says the player fell, never that they died or were killed, because the player wakes again in town: "fell" is the true word for what happens, not a softer one.
- **The aim moves to ESRB E10+ and PEGI 12.** Mild blood fits ESRB E10+. PEGI 7 allows only unrealistic violence that does no apparent harm, so blood moves the PEGI aim from 7 to 12. Checked against the account (the entry on the account's age, 9.10): 13, or a country's higher age of up to 16, sits above both ratings, so every account holder is inside the aim. Checked against the demo: the demo is the same valley with the same look, so the younger player it is for is one between the rating's age and the account's, 10 to 12 by the ESRB, 12 by PEGI, and up to 15 where a country asks 16. The words stay readable by a child of eight (G22), since plain words serve every reader. Like Stardew Valley, rated E10+ by the ESRB, with mild blood among its reasons, and 12 by PEGI: the label tells a parent the age, and the game does not ask for it.

**Supersedes:** "Menace without gore" in the entry on the world and its clocks, and "the content is for all ages" in the entry on the account's age, which now holds for the words. G46, the review checklist's question 11, the pull request template's "for all ages" and the conduct line of `CONTRIBUTING.md` change with it; GRUNT's CR-83 carries the building.
**Retry when:** a store's rating comes back above ESRB E10+ or PEGI 12, or players read a mark of blood as a promise of combat. Model: claude-opus-5-5.

## 2026-10-10 ✅ The game read as one line: one safe place, one outing, one mist, a name for each thing and a clock for each time

The question (10.10, after the sweep and the ten answers): the holes were closed one area at a time, so does the game now read as one clear line of human logic? The owner's word (10.10): walk it as a player, close the small holes by default, each from a game already discussed, and bring to the owner only a question of direction. The walk followed the player's road: the first ten minutes with each of the three starters, the first night and a fall, crafting and the trader, the market and the shop, a house and a plot, the shared world from stage 4, and the world players see at stage 7. At each step it asked four questions: can the player read the rule from the world, with no word or number for difficulty (the entry on difficulty, 9.10); do two rules meet as a bug or a contradiction; is each thing called by one name everywhere; and does each time say which clock it runs on. What the first ten minutes showed went to the opening's own branch. The rest is closed below, and no direction the owner set changes.

- **One safe place.** A safe place is the town, any ground at danger level 0, and a camp whose fire burns; by day a camp's fire burns for nothing, and only the night costs wood (S2). "Safe place" and "safe area" name this one thing, and every rule that asks for one reads it: G31's countdown and warning, the end of an outing, the run of G34, sleep (in a town or at a burning camp), leaving the game at once (the entry on the shared world) and a place counted once brought home. Level 0 holds the opening's ground and the night ruins' entrance (the entry on that entrance, among the ten answers), so both are safe at every hour. In a safe place nothing hunts and no player harms another; what the player eats can still hurt (G30). P-5's `safe` flag is read from the level and the fire, never set by hand. An area's protection level is read from the level alone: `safe` at level 0, `wild` above it, and `contested` only for an area between players once combat opens; a camp's fire makes the camp safe and changes no area's level. "Towns, camps and houses are always safe" (S4) means that no player harms another there; from a hazard, a camp is safe while its fire burns. Like World of Warcraft, whose inns and capital cities let a player leave at once and whose zones are marked sanctuary or contested.
- **One outing.** An outing runs from leaving a safe place to reaching one again, or to a fall. A fall takes that outing's finds, the quest steps taken on it and the places found on it, and nothing spent on it comes back (G33; the entry on the world and its clocks). Like Elite Dangerous, where a trip runs from station to station and what is not yet sold dies with the ship.
- **One mist.** The kernel keeps the mist, area by area and hour by hour as the content sets it. The client draws what the kernel keeps, in the plain look and the rich one alike (the rich look only makes it breathe), and the hazards' `mist` window reads the same mist. It thickens with the danger level, and where the story draws it back as places are restored, it draws back for the hazards too. Inside it the hunting hazards act by day at the area's own rate (SETTLEMENT 3.5), so at level 0 the mist is only a look. At an expedition's last bell it walks the player out (P-6). Like Minecraft, where the light level the player sees is the rule that spawns monsters.
- **Dusk, dark and dawn.** On the game hour, dusk is 19:00 to 20:00, when the valley's old lanterns glow (STORY.md S3); dark is 20:00 to 05:00, the kernel's night; dawn is 05:00. "Nightfall" is 20:00, "at night", "after dark" and "after 20:00" mean from 20:00 to 05:00, and "until dark" means until 20:00. Like Minecraft, whose night falls at the same tick every day.
- **The ladder's clocks.** The ladder's minutes are minutes at the screen. Its Day 2 and its "overnight" are the valley's: the morning after the first night, slept or played through, opened by the morning toast (P-4). Away, the valley waits at the hour it was left (G28), so a return opens there, at night if it was left at night; only the real calendar moves meanwhile. The day summary (G16) is the natural place to stop. Like Stardew Valley, whose second day is the morning after the first night, however long the player was away.
- **Sleep, stage by stage.** Until stage 7 every valley keeps its own hour, in the shared worlds of stages 4 to 6 too, while the shared market drains on the server's hour; sleeping in a town or at a burning camp at night moves that valley to 05:00. From stage 7, where players see each other, nobody skips the night: resting by a fire restores health over one game hour, leaving the game outside a safe place waits `logout_countdown_s`, and no hazard strikes during a minigame. Like Minecraft's beds, which skip the night only when every player in the world sleeps.
- **Every time names its clock.** On the real calendar, by the server's clock: `build_hold_days`, `house_absent_days`, `notice_days`, `plot_signup_days` and `hold_max_days`; the 30 days of a closing; the 14 days in which a theft can be shown; a week without words; how long notes and logs are kept; a move between worlds once a content season; and the time of a building's last finished step, kept as a real date. In real seconds while connected: `logout_countdown_s`. In active play: `new_account_hold`. On the server's hour, a game hour of the same length that the server counts for a shared world while anyone in it plays: the shared market's drain until stage 7, where it becomes the world's one hour (the entries on prices and gold and on the shared world). On the game hour: the windows of hours, "once per night", a companion's next day, and the rest that the entry on the world and its clocks lists. Like Old School RuneScape, whose farming grows in real minutes, whose daily reset is at 00:00 UTC, and whose actions run in game ticks.
- **One name for each side of trade.** Pell's stall has two sides, as its two tabs show: the shop sells at the shop's price (`shop_*`), and the trader buys at the trader's pay (`trader_*`, `k_*`). A player's shop is always called a player's shop. The market is a world's stock, which moves both prices; the market board is a town's list of the goods of players with no house. Like World of Warcraft, whose vendors buy and sell at their own prices while the auction house holds the players' listings.
- **A player's shop before stage 7.** Until players see each other, a player's shop has only the forms it has while its owner is away, at the house or on the market board, whether or not its owner plays; the sign over the player comes with stage 7. Like Final Fantasy XIV, whose market board sells for players who are not there.
- **One store, opened at a chest.** The one store (the entry on the shared world) opens at any of its chests: the opening's camp's, one in each town, and a house's. A tent has none. Like RuneScape's bank, one bank opened at any booth.
- **One unit for limits.** In a shared world an account plays one character, so a limit written per player, per account or per character counts one and the same unit there. The limits on a person stay as written: one account per person in each world, and accounts found to be one person's count as one. Like Old School RuneScape, where an account is one character.
- **One name for the player.** The name given in the opening is the name the world shows: sign-up offers it again, the filter reads it then, and it must be unique in the world joined, or the player picks another. In the demo it stays the player's own, seen by nobody else. Like Pokemon, where the name given at the start is the one the whole game uses.
- **The opening's ground in a shared world.** It stays at level 0, as the town's edge, and so does the night ruins' entrance: no wood is burned and no tent is pitched on either, and every camp beyond them costs wood. This reads the camp entry's "every area outside a town is above level 0" (S2). Like Stardew Valley, where the town is safe and danger starts in the mines.
- **Won plots and packed houses.** Every plot won, whether freed or opened by a clearing, takes its first step within `plot_signup_days` and then holds `build_hold_days` between steps, so a won plot has one rule whichever way it opened. A packed house is raised only on a plot its owner wins, as that plot's first step, and no step is redone. Like Final Fantasy XIV, whose lottery winner has a few days to claim the plot before it goes back to the next lottery.
- **The world seen at stage 7.** A burning fire keeps the hunting hazards off anyone in its light, while the camp's bed, its workshop and the store open for its owner alone: another player may stand in a camp's light but never uses the camp (SETTLEMENT 3.4). Seeing a player shows that they are there; no list or sign tells anyone who is online, except between mutual friends (the entry on the shared world). Like Minecraft, where light stops monsters from spawning for every player near it.
- **The lantern is a sign, not a shield.** Leaving a safe place after dark, or dark arriving outside one, lights the player's lantern with the one warning box (G31). The lantern says the night has begun around the player; its light keeps nothing off, and only a safe place does (G34 as the ten answers write it: no gear answers a hazard). The night ruins' "lantern kept lit" (P-6) is light to see by, never a shield. Like Terraria, where a torch in the hand lights the way and keeps nothing off, while a town with its people keeps the spawns down.
- **Open with the owner.** Whether the first tier known from the start (CR-61, among the ten answers) covers the recipes the first quests give, the herb stew among them, is asked through the opening's branch; no default is taken here.
- **Brought in line in this change.** `docs/design/GAME_RULES.md`: the ladder's clocks and its Day 2 row; G30's safe places; G31's lantern; G33's outing. `docs/design/SETTLEMENT.md`: section 2 (what is safe); 3.1 (the clock of every count of days); 3.2 (packing); 3.3 (a won plot's first step); 3.4 (the store's chests, the opening's ground and the night ruins' entrance); 3.5 (the hazards' minute); 3.8 (the name); 3.9 (safe from players, the hunters' board, the protection levels); S1b's answer. The kernel review: 7.2's items 2 and 4, and D6 (no upkeep). GRUNT: P-4's goal, CR-48 (a player's shop) and CR-59 (the clocks). In this file: the supersede lines of the entries on hazards, on the account, on absence, on the camp, on the competition for places, on drawn plots, on the real year, on a player's shop, on the shared world and on the world and its clocks.
- **For the branch of the ten answers of 10.10, on its merge.** P-5's `safe` flag reads the level and the fire (the town and all ground at level 0, the night ruins' entrance with it, and a camp while its fire burns), not "every camp". P-5's "every quest then in progress goes back to its first step", its test's "restarts the quests in progress" and its e2e's "the quest at step one" follow the entry on the world and its clocks: each quest goes back to the step it stood at when the outing began. P-6's "the lantern kept lit" is light to see by (above). P-5's "bag goes back to the outing's bag" follows the same entry: each item keeps the smaller of its count when the outing began and at the fall, so a fall gains nothing. The branch's G34 names the safe places as the town or a camp whose fire burns; it reads a safe place (G30). The two lines named in the entry on which text wins still stand.

**Closes:** the holes of the walk, with "safe place" and "safe area" as one thing; GRUNT's CR-88 to CR-93 carry the building.
**Superseded in part (10.10):** by the entry on the five holes of the one line. G31's countdown runs to nightfall or the mist's coming, and the lantern lights for the mist too. From stage 7 another player's fire keeps the hunting hazards off only a guest with a deal, and its light marks how far the camp reaches. Won plots and packed houses are paused, the store opens at the opening camp's chest and one in each town, and a player's shop sells on the market board. CR-61 is answered: a recipe a quest gives stays that quest's reward. The precedents read more exactly: Minecraft's light stops most monsters from spawning; its beds skip the night, by default, only when every player sleeps; Old School RuneScape keeps each character's progress and limits on its own; and Stardew Valley's town is safe while, on the standard farm, danger starts in the mines.
**Retry when:** a player reads a rule the other way from what the world shows, or a builder finds two lines that still disagree. Model: claude-opus-5-5.

## 2026-10-10 ✅ Parallel work is anchored by rules, a stream map and a computed picture, not by a status page

Five sessions, three of them in another app, built at once with no single view: nothing recorded which branch belongs to which stream, five branches changed the same kernel, schema and values files, `feat/three-starts` sat inside another branch with no live owner, and the team page "the lead decides the order" had nothing to decide from. A hand-written status page was rejected: it is stale at the next merge and is itself a file every session touches. Anchored instead, all rebuildable from the repository: [docs/team/PARALLEL.md](docs/team/PARALLEL.md) (shared-file rules, merge order, the stacked-branch rule, the conflict recipe), `docs/team/streams.json` (hand-held, edited only when a stream starts or ends, owner `null` until the owner names it), `pnpm streams` (computed from refs and GitHub, never committed; conflicts found with `git merge-tree`, stacks collapsed), `DECISIONS.md merge=union` in `.gitattributes` (tested on a scratch repository: both entries kept, `git merge-tree` honours it, GitHub's merge button does not), and the repo skill `/integrator` for the session the owner talks to. Merging stays with the owner; delegating it is a decision to write here.
**Retry when:** the report names a collision nobody settles for a week, or two sessions still change a shared file without a small first pull request; the next step is a CI check that compares a pull request's files with the other open streams. Model: claude-sonnet-5-5.

## 2026-10-10 ✅ The axe and the felled tree: wood comes only from felling, and a start may carry a kit

- What. A tree is a gathering node worked with a new tool kind, the axe. Gathering it is felling: a new verb `fell` and a profession of its own, `core/woodcutting` (xp ladder 20, 80, 200, 420, 820, 1500, 2600, 4000; no techniques, since techniques are summed across professions and a Woodcutting bonus would reach every other work). A node may be `solid`, so a tree blocks its tile grown or as a stump (a gathered rock still opens the way), and may carry up to three `growth` sprites that show while it grows back (`growthSprite` in `game/src/growth.ts`, a pure function of the share of the respawn that has passed). A starter gets an optional `kit` that goes into the bag when the character is chosen; the field is additive, so no save format moves.
- Numbers. Four oaks stand in the renamed slot `core/camp-oaks`: 3 logs a tree, 3000 ms a fell, 120000 ms to regrow, level 1. The log is worth 400 and the branch stays at 600 (`pnpm values` drift 0, only `core/log` added to the lock). The campfire asks for 2 logs, the chest for 3 logs and 4 stones; a log splits into 2 branches at the fire (`core/split-log`), so every saved recipe that asks for a branch stays valid. Pell sells the axe for 30000 mg, and it lasts 50 uses. `core/fallen-branches` is gone. The opening asks for 2 logs of the 12 the trees give.
- Why. The owner's answer 3 of 10.10: build the axe and felling and the starter kits first, tune the crafting economy once afterwards. Wood on the ground made the first fire a chore with no tool; a tree makes the first task a place and a tool, and the kit means no start ends at a wall (both starters carry an axe until CR-37 gives each start its own first task). The checks that keep it so: wood only from an axe node and never dug; an axe sold by a shop; every kit holds an axe; the opening never asks for more logs than the trees of a new valley give; and a grove must not wall a place off (`tools/src/reach.ts`, from the spawn with every passable restoration mended).
- Wart, left on purpose. Splitting a log trains Cooking, because a recipe's gate must be a craft profession and the fire's Cooking is the only one that exists; it moves to a woodworking profession when there is one. The kit also fires the pickup cues at the first step ("+1 Axe", "New in your journal"); accepted until the three starts of CR-37.
- Not done here. Sprites for the tree stages, the stump and the felling feel are the owner's call on the preview. Nothing is deployed.
**Retry when:** a playtest shows that the snap minigame does not read as chopping, that 120000 ms leaves the camp bare during a slow opening, or when a craft profession other than Cooking exists (move the split to it). Model: claude-sonnet-5-5 (the design settled with the advisor). Branch `feat/axe-and-starts`, GRUNT CR-24.

## 2026-10-10 ✅ Three starts: the forager picks, the digger digs up its axe, the explorer's senses find one

- What. Three starters, each with a place to wake, a kit, its own waking lines and a first task of its own, as the entries on C1 and on three starters ask. The forager wakes at the map's spawn with a basket and an axe and picks two herbs on the west bank (`core/first-pickings`; a new patch, `core/bank-herbs`, with the wild herbs' numbers, so no value moves). The digger is new, with the six points the sweep of 10.10 gave it (stamina 2, luck 2, carry 1, senses 1, agility 0; CR-84): it wakes south of the bridge with a trowel and digs its axe out of the slid bank (`core/buried-axe`, `core/slid-bank`). The explorer wakes on the north meadow with a walking staff and finds its axe in the grass by the bridge, picked up by hand (`core/glint-by-the-bridge`, `core/bridge-glint`). The staff is a new tool kind, `staff`: no work asks for one, it is worn in the hand for 5 percent rare finds, and Pell sells it for 30000 mg.
- Schema, all optional, so the format stays 1: a starter's `wake` and `intro`; a quest's `starter`; a dig spot's `starter`; a dig spot whose `tool` is left out (a find picked up by hand: no timing window, no tool worn).
- Kernel. A start's own spot shows to that start only, gives its one find every time whatever the timing, and only once (`spotOpen`); it is no source in the value table, so the lock does not move. A start's own task is offered to it alone. A kit piece with a working wear slot is worn from the first morning. A task with no giver is handed to nobody, so what its bring or find asked for stays in the bag (the forager's herbs, the found axe); a given task's hand-in takes it as before.
- Check (`tools/src/starts.ts`). Every start holds an axe before the first fire, in its kit or on its own spot (this replaces "every kit holds an axe" of the axe entry above). A start's own spot gives one find at 100 percent, count 1, tier 1, needs only a tool the start's kit holds, has a tile on the map, and lies within the start's senses (`senseReach`) somewhere on its shortest walk from its wake to the bridge. A wake is a tile one can stand on. One attribute total (6). The kits, with each start's own finds, within 25 percent of the poorest (60000 mg each today). Every start reaches the bridge with its axe within 50 percent of the fastest, counting the work of its own task and the walk at the client's step time; the effort is measured to the bridge because the roads meet there, and the road from the bridge to the first fire is the same for every start. Reach is checked from every wake. The headless opening walk runs once per starter.
- Client. The game puts the character where its start wakes; the title screen shows the three cards in one row on a desktop and reads each start's own lines. The explorer's senses (`game/src/senses.ts`): a find picked up by hand lies half-buried in a soft glow, and while it shows, a drifting line of glints runs from the character's feet to it, in place of the generic dig mark; the prompt says "Pick up". The direction, a trail, was chosen from three phone-size stills (a trail, a ripple of rings from the character, a mark over its head); the preview is the owner's to judge, as the entry on three starters says. A start's own spot and its hint show to that start only. The world scene changed in those places only. The opening's walk in the browser: the phone's forager picks the bank herbs first, the desktop's explorer picks up the axe by the bridge before the bridge is mended.
- Wart, left on purpose. The walking staff borrows the branch's sprite and the digger the forager's sprites until the art lands.
**Retry when:** players walk past the glint, read the slid bank as a ruin with more to dig, or a starter needs more than one spot of its own. Model: claude-opus-5-5. Branch `feat/three-starts`, GRUNT CR-37.

## 2026-10-09 ✅ The opening recut: option B, toward the first dusk, closing on a night discovery

The product owner picked option B of `docs/design/OPENING_RECUT.md` on 9.10; the doc had recommended A. The first ten minutes keep the beats both options share: the strike taught once on the bridge's keystone, the dry log found by the senses, the real choice at Pell's stall, and the riddle. The riddle comes at dusk, when the hill lantern glows and lights the tile to dig, and the opening closes after dark at the arch in the mist, whose path leads to the threshold of the night ruins: the first sight of the expedition (G36), with nothing to fight and nothing that hunts yet. For that, the first day starts at noon, which changes the kernel's clock (`hourOf`) and moves every save; the next entry says why that is fine for now. What the night visit opens, a path that both clients draw only at night or a place reward, is chosen in the build's pull request, which says why. The maze stays the next item of the variety work, now on its own. When the hazards land (P-5), the opening's first night stays at the town's safe edge.
**Retry when:** the build lands, or play shows that the first dark comes too early or too late in the first session. Model: Claude Opus 5.5.

## 2026-10-09 ✅ Saves need no care until the server keeps them

The product owner's word (9.10): for now a change may move or reset a save without a conversion. Saves live in the player's browser, and no player's progress has to survive yet. They matter again when the server comes in and keeps them (roadmap stage 2a, accounts and server saves). The save-key carry-over in the rename's pull request (#43) stays, because it is small and done.
**Retry when:** the server keeps saves (stage 2a), or the product owner reopens it. Model: Claude Opus 5.5.

## 2026-10-10 ✅ The opening recut B, as built: the arch opens as a place reward

Option B is built. The first day starts at noon (tick 0 is 12:00; one game hour is 50 seconds of play, and the clock stops while a menu or a dialogue is open), so dusk comes near minute six and the dark near minute seven. The beats:

- **The taught strike.** The bridge waits on one keystone in the shallows. One strike, with the minigame window, gives the first level and mends the bridge. The keystone regrows in ten seconds, so a miss gets a second try at once. Under the sign hangs a purse: 30 gold, the price of one tool in town, and the mushroom skewer recipe, so the reward is not coins alone (G4).
- **The find by the senses.** One dry log lies in the wet reeds below the bridge. It is a dig spot with no tool: it is picked up by hand, with no window and nothing worn. A find with no giver counts once the item has been in the bag, so the same quest can burn the log in the fire it builds.
- **The real choice.** Pell's stall says what each tool opens: the basket, Maru's bells in the garden; the trowel, his coin under the lantern. Whichever road comes first pays for the other tool: the bells pay 30 gold, and the coin comes with a basket.
- **The riddle at dusk.** From 19:00 to dawn, a prop that a riddle cites and that stands next to its answer lights it: the hill lantern glints over the tile to dig. By day the stones must be read.
- **The night discovery.** Handing in the coin, Maru says the broken arch shows a way after dark. A new quest with no giver asks for a visit to the arch's mouth at night; the stone beside it reads "By day the rubble, by night the way". Done, it opens the way under the arch, and the way leads to the threshold of the night ruins, where a bell rings once far below and nothing more happens yet.

**Why a place reward, not a path drawn only at night.** The decision of 9.10 left the choice to this build. A path that both clients draw only at night needs the 2D world scene and the 3D valley to draw a tile by the hour; both are outside this build, and the 3D client asked to leave the night path out for now. A path that the rules open and close by the hour also traps a player who stands on it at dawn, unless more rules move them. A place reward is one rule: a restore with no inputs, which never opens by hand, and a quest that opens it when it is done (`reward.opens`, schema-additive). Both clients already draw a restore before and after, and an open place stays open, like a mended bridge. The cost: after the first night the way stays open by day. The first visit still has to be made at night, and the threshold says so ("Not tonight. The way stays open.").

Along the way: the skewer recipe is declared uncommon, since a found recipe is one step rarer than its inputs (V-2); the kernel's version is 0.4.0, because the clock and the rules of a find changed.

**Waits for:** the axe and felling (CR-24) and the starters' kits (CR-37). The owner's answers of 10.10, written in parallel with this build, put the recut after them and change three of its beats: the first fire comes from a felled tree, and the explorer's find by the senses is its own axe hidden by the bridge, in place of the dry log; the real choice at minutes 4-6 is whom to help first, Maru or Pell, in place of the stall; and a first-tier recipe is known from the start (CR-61), so the purse under the sign holds something else that is new to do. The recut then lands with the one-time save reset (CR-62), which also carries the noon start. The rules built here stay: the noon start, a dig spot with no tool, a find with no giver counted once found, and the place reward that opens the arch. The threshold is the entrance of the night ruins, which is safe: the player only looks in.
**Closes:** the build of the 2026-10-09 entry on option B, once it lands.
**Retry when:** CR-24 and CR-37 are on `develop`; the 3D client draws the arch and the night ruins; or play shows the first dark too early or too late. Model: Claude Opus 5.5.

## 2026-10-10 ✅ The recut B on the axe and the starts: a fire from a felled tree, whom to help first, and one save reset

The question (10.10): the owner's answers of 10.10 put the recut after the axe (CR-24) and the three starts (CR-37), and changed three of its beats. The recut is reworked on top of both:

- **A fire from a felled tree.** The dry log, its spot in the wet reeds and the `core/wet-reeds` slot are gone. `core/first-fire`, now "A fire before dark", asks only for a campfire, built of 2 logs from an oak, with no meal, as option B has it. Every start holds an axe by then: the forager's kit, the digger's slid bank, and the explorer's glint by the bridge, which is now the find by the senses.
- **The purse holds gold only.** 30 gold under the sign, the price of one tool in town, and nothing else (the owner's word, 10.10). The mushroom skewer goes back to common and known from the start, so the previous entry's note on its rarity no longer applies.
- **Whom to help first, in place of the stall.** Arriving in town says it in two lines: Maru by his house and Pell at her stall could use a hand, and whom to help first is the player's. Both are open as soon as the town is reached. Maru's bells (`core/three-fruits`) pay with his old trowel. Pell's herbs (`core/herbs-for-pell`, which no longer wait for the bells) pay 30 gold and the herb stew recipe, the reward approved on 7.10. Both plants are picked with a basket, so a start that woke without one spends the purse on it at the stall, which still says what each tool opens. Maru's coin follows by the trowel's road and pays 20 gold and the herb tea recipe; then comes the night arch, as before.
- **One save reset (CR-62).** The save file is version 2. A save of an older version is dropped once, and the title screen says so once; a save that cannot be read is left as it was. The date a browser first played the demo is kept outside the save (`openfold.demo-since`, CR-85), written at the reset or the first new game and never cleared, so a later title for the demo's players can read it.
- **Schema, additive, format 1.** A reward item may name `instead`: what a start whose kit holds the item gets in its place (`rewardItem` in the kernel). The check refuses a reward item that a kit holds with no `instead`, and an `instead` that the same kit holds too. The kernel stays at 0.4.0, which this recut already brings.

Holes closed by default (the owner's word of 10.10 on small questions), each with the game it follows:

- **Each neighbour pays in what they have, and the first help is worth one tool either way.** Maru gives his old trowel; Pell gives a recipe and 30 gold, the price of a tool at her stall (was 15 gold). Like Willy in Stardew Valley, who hands the player his old bamboo pole.
- **No reward repeats a kit.** The digger, whose kit holds a trowel, gets a walking staff for Maru's bells. Like World of Warcraft's quest rewards, which since Legion fit the item to the character's class and specialization. The swap reads the kit, not the bag, so the check can prove it before anyone plays; a start that bought a tool may still get a second one, and keeps it, since no trader buys tools.
- **Neither help waits on a window.** The sunleaf opens from noon until dark (12:00 to 20:00, was 11:00 to 14:00), so Pell's herbs are open whichever help comes first, and so are Maru's bells (5:00 to 20:00). Like A Short Hike, where the island's helpers can be helped in any order. The headless walk proves it for every start and both orders (CR-86): each help's plant is open when the player gets there, with two game hours to spare for the walk.
- **Pell's herbs are an investigation.** They now follow the walk into town, which is a discovery, so they can no longer be one (G17): Pell's clue names the place, and the player reads the river to find the bank where the mist is thin. Like the contracts of The Witcher 3, the palette's example.
- **Maru's coin gives no basket.** Both helps are picked with a basket, so by the coin every start holds one and a basket would only repeat. The herb tea recipe moves from the bells to the coin, so neither of Maru's rewards is coins alone (G4).

The tier-1 recipes that the helps give, Pell's stew and Maru's tea, stay those quests' rewards: the owner answered CR-61 on 10.10 in the afternoon, and a recipe a quest gives is not among the tier-1 recipes known from the start.

The tests: the headless walk runs each start with each first help, from noon to the threshold of the night ruins. The browser walk: the phone's forager helps Maru first, gets his trowel, digs his coin at dusk, and is paid gold and the herb tea, with no second basket; the desktop's explorer helps Pell first, buys a basket with the purse and hands in the sunleaf.
**Closes:** the "Waits for" of the entry above, and GRUNT CR-62 with this recut.
**Retry when:** play shows that players do not see the choice in town, that one help is always taken first, or that the reset notice confuses. Model: claude-opus-5-5. Branch `feat/opening-recut-b`.

## 2026-10-10 ✅ The site leaves the pixel face and the shadow frame: a living window from the game is its one signature

Supersedes the site half of "One token sheet and the pixel frame tie the site to the game" (7.10); the game keeps Pixelify Sans inside its canvas and HUD. The product owner rejected the round-1 home page look (the structure and the builders board stayed approved): a pixel face scaled across a whole site reads as a costume, and the 2px frame with a hard 4px shadow on every card, button, chip and image is a stock kit where nothing stands out. Round 2 was judged on three phone stills that differed only in the type pair, plus one desktop still each and a clip of the motion.

- **Type:** display face Platypi for what is signed or counted (wordmark, headings, door names, builder handles, points); reading face Atkinson Hyperlegible Next for everything that explains or is pressed (body, nav, buttons, tabs, tags, ranks). Both OFL, self-hosted as pinned latin files with their OFL.txt beside them in `web/public/fonts/<family>/`. Rejected: a pixel face for the site (costume), a geometric grotesk (the template default), a serif body (editorial template).
- **One signature:** the classic door is a window into the valley, drawn from the core kit as CSS sprites at a whole-number scale (2 under 600px of window, 3 above), not a screenshot. On load it plays the opening's first quest once: the player walks to the broken bridge, mends it in four hammer beats, and a timber plate rises on the bridge-head post with the handle of the bridge record's author, the same handle the builders board lists beside it. Then only the valley idles (water, fire, the elder's blink, the oak, the lantern); the oak and the lantern rise one tile above the window's edge. No plate when the record has no author. The plate appears once more, unsigned, in the developers band. Nothing else on the page wears a frame except the two doors and outlined buttons; the hard offset shadow is retired (`--frame-shadow` goes from `design/tokens.css`).
- **Colour:** the nine-token subset stands; one accent, green, means go (Play, the developer area, the current nav item, the selected tab). Wood joins for the plate only, because a builder's timber sign is part of the art. Cream and gold stay out of the page chrome.
- **Motion, zero JavaScript:** every animation sits in `prefers-reduced-motion: no-preference`; the bare stylesheet is the finished frame (bridge mended, plate up, final numbers). Pixel motion steps one art pixel or one sheet frame at a time, never eased; text never moves. A 44px pause control (a checkbox and its label) stops the window and swaps the 3D loop for its still image (WCAG 2.2.2). The 3D door plays a 5.8s loop recorded frame-exact from the 3D trial (H.264 320x180, about 140KB), with `<source media>` so a reduced-motion reader downloads only the poster.
- **Animated counters, reversing PLATFORM 5.4:** the board's five totals count up once, tabular, no overshoot, the true number in the DOM for screen readers. Below 1024px, where the board is under the fold, each row tallies as it scrolls into view (a scroll-driven animation; without support the timed run applies); scrolling back above it re-runs the tally, accepted because a one-time latch needs a script.
- **Home criteria, restating PLATFORM 5.5:** criterion 1 becomes "at 390x844 the first screen shows the wordmark, the headline and lead, the classic door with Play, the 3D door with Enter, and the board's title and tabs"; criterion 4 becomes "under 300KB including the fonts, the scene sprites, the 3D loop and its poster" (measured 125KB without the 3D door and 281KB with it); criteria 2, 3 and 5 stand.
- **No sample numbers on a page:** until `pnpm hub:data` (GRUNT item 3) is part of the build, the boards on every page come from `content/board.json` and the creator profiles; the hub-data fixture reaches only the footer's build line, marked "(fixture)", and reviewers and this week show an empty state. Hub criterion 4 of PLATFORM 5.5 reads accordingly: the numbers rendered equal `content/board.json`'s.
- **Signatures keep the game's colours:** the boards page draws each builder's signature as the game does, in the pixel face (borrowed from `/play/fonts/`) with its own red, yellow, light moss and gold; those colours live in `web/src/styles/signature.css` only, not in the page chrome.

**Retry when:** players or the owner read the serif as a magazine rather than a game (then the one-family Recursive pair from the same round), or the bridge beat of the opening changes (the window follows the game's beat). Model: Claude Opus 5.5.
## 2026-10-10 ✅ A remark is said once, a topic waits for the world, and what was heard lives in the save

GRUNT S-1 and S-2 as built. A character's `remarks` wait for a `when` (quests done, on or not done, places mended, camp parts built, items held, slots visited, day or night); of those that hold and were not said, the highest `priority` wins, then the condition that names the most, then the first in the file, and it is said once in place of the standing line (salience, as in Valve's dynamic dialogue and Hades). A topic may wait for a `when` too; the menu shows four at most, the ones not yet asked first, so a character can hold eight topics and the check still refuses more than four that are always open (G21). The choosing is pure and lives in the kernel (`kernel/src/story.ts`) so the MCP server and the check can read it; what the player heard is presentation and lives in the save next to `met`, keyed by the remark's place in the file, so an edit that reorders remarks may let one be said twice, and never stops one being said. The two lines `storyBeats` held moved into the content (`talk.done` on the three fruits, `done` on the old bridge) and were cut to boxes of 80 characters, counted with a 16-letter name in place of `{name}` (G14); one box of the thanks had been 171 characters, out of the check's sight. The first remarks and the lanterns topic follow Maru's and Pell's voice sheets.
**Retry when:** creators reorder remarks often enough that repeats show (then a remark gets an `id`), or a player misses a remark that was said while they skipped the box (then a heard remark comes back once in a topic). Model: claude-opus-5-5.
## 2026-10-10 ✅ The hook is the receding mist: a pocket for each starter, the bridge pushes it back, the name is carved at the bridge

The question (owner, 10.10): is the story strong enough to hold a new player, next to the big games and mobile games? Measured on develop: the first minutes are work (stones, a fire), the mystery of the bells is heard only at night, quietly and far off, and the player has no reason of their own to be there. Stardew Valley opens on a letter, Breath of the Wild on a view of the whole world, mobile games on a reward in the first minute; the story holds the player later. The owner approved four parts on 10.10:
1. **A mist pocket for each starter.** The three starters wake in three places (entry C1); each wakes in a small clear pocket inside the mist, and its first task (the basket, the dig, the senses) pushes the mist back a little.
2. **The bridge pushes the mist back.** When the bridge is mended, the mist visibly draws back from that part of the valley, the three pockets join into one valley, and a bell rings once, far off. Each place restored after it pushes the mist back further. Every belief reads it its own way (the Menders: what is tended remembers; the Wakers: something under it is waking; the Keepers: we are waking what should sleep).
3. **The name is carved at the bridge, not typed at character select.** The "Mended by" sign becomes the returners' stone: the camera glides down the names of those who came back before to the last empty line, and the player carves their own. Until then the player is "you". In stage 1 the names above are written content (the first ones who came back); with accounts in stage 2 they are the real players who came first, so a word filter is needed before then. Rejected: finding your own name already on a stone (the owner: strange); a character asking who you are (nobody stands at the waking place, and it would be a long first meeting).
4. **A waking line for each starter.** The idea is approved; the first examples were rejected as too indirect ("needs to be more direct"). The plain set (one object, one fact) waits for the owner.

The look, chosen from phone stills ([frame](docs/design/frames/2026-10-10-receding-mist.png), the waking pocket and the bridge after the mend): **B2**. The mist is clear in a circle of 5 tiles around the character and grows denser over the next 6 tiles to almost solid, 96% of the pixels at the edge of the map. It is near-black, not white: `#3a3554`, with `#5d6177` for the lighter patches and `#1b1a2e` for the shade. The gradient is made of dots (an ordered 4x4 dither on game pixels), because the style law allows only fully clear or fully solid pixels. The direction pad is the same dark colour and sinks into B2, so it gets a light outline. Not chosen: a circle of 3 tiles (A: the world too closed), a cloud-shaped grain (C: noisy on a phone), and white or light grey mist (the owner: grey-black). The criteria for the build: no mist inside the circle; at least 90% mist at the map border; from the character outward the mist only thickens; when the bridge is mended, the clear area reaches at least 7 tiles around it within 3 seconds and stays. The shade on a real phone is the owner's to judge on the preview.

The build touches the three starters (CR-37) and the opening recut (pull request #50); both are told before anyone builds. Today `start` takes and checks the name (1-16 letters, digits, spaces, `_` or `-`, in `kernel/src/step.ts`) and the title screen asks for it; carving the name at the bridge means `start` accepts an empty name and a later action sets it.
**Retry when:** players on a phone cannot find their way inside the pocket (then the circle grows before the colour lightens), the dither shimmers while walking (then the pattern is anchored to the world, not the screen), or the name stone needs a filter that is not ready when accounts arrive. Model: claude-opus-5-5.

## 2026-10-10 ✅ Health and hazards (P-5a): a position report (`move`), the outing, and a fall that takes back what the outing brought

What was built, kernel only, no client and no content: a new action `move {at}` through which the client reports where the player stands. It is the only action that checks travel: the tile must be walkable and within 2 + floor(elapsed / `walk_step_ms`) tiles (Chebyshev) of the last report; every other action first runs the same arrival at the tile it names. This partly reverses "travel time comes later" (2026-10-07): the kernel still does not time a walk, it only refuses a report that could not have been walked. The health bar is still `player.satiety` (milli-points, lazy drain unchanged); the rename to hp waits until the crafting branches that inherit the old names have landed.
- **Outing.** The ledger begins on the first step onto unsafe ground and is cleared on a safe tile (a town tile, a slot with `safe: true`, or the first camp slot once any camp part is built). Kept gathers and digs are recorded in it; spending takes from the outing's gains first, so gains never exceed the bag.
- **Fall.** Only when something hurt in this step and health is at 0 (hunger alone never falls): the outing's gains are subtracted (no bag snapshot, so what was learned stays and nothing bought is lost), the quests solved and places visited on the outing are undone, and the player wakes in the last town square at full health. Event `fall` names what was lost.
- **Hazards** are map props with an id and a `hazard {kind, window, reach?}`: predator (a chase by the clock: first bite after `catch_ms`, then each `bite_ms`), pit, trap and deep water (once on entering). Only the `night` window exists; the mist waits for P-6. A hazard is escaped, never answered with an item (owner, 10.10). `pnpm check` refuses a hazard on safe ground (G30) and a predator whose worst run to safety costs a whole fall (G34).
- Evidence: 29 kernel tests (play unchanged on the shipped valley, bites independent of how often the client reports, replay determinism, fuzz) and 7 check tests. Measured: shipped content has no hazard, so a merge changes no play.
- Known wart (Codex review): a fall undoes the outing's riddle and visit markers but not a quest that finished by itself on the outing; its reward stays. Revisit if a giverless quest ever ends that way.
**Retry when:** a real phone shows walking blocked by a report refused for lag (then the allowance grows before the rule goes), or hazards need a second window before P-6. P-5a changes no play and can land when green; what must not ship without hazards is the later drain change. Model: claude-sonnet-5-5. PR #59.
## 2026-10-10 ✅ The owner's answers of 10.10 afternoon: lasting starter identities, phased progress, camp deals, weighted plot draws

The owner answered nine open questions on 10.10 in the afternoon, one at a time, after the integration pass found them unanswered in the docs or in sessions that stopped mid-question.
1. **The three starters differ for the whole game, not only the first minutes.** Each keeps a lasting edge (the forager finds more when gathering, the digger more in the ground, the explorer more rare finds) and abilities the others cannot reach; when weapons come, each plays a different style. CR-37 builds only the opening part; the lasting edge and the abilities need a design entry before any build.
2. **Multiplayer progress is phased, and the mist hides the gap.** A player who has not mended the bridge sees it broken and the far bank in mist; a friend who crossed walks into the mist and is gone from view. They meet once both have mended it. Shared building starts at stage 7.
3. **Warnings (G31):** count down to nightfall or to the mist's coming, whichever comes first; entering the mist, or the mist arriving, lights the lantern with one warning box, once per night; a burning camp warns before its fire goes out.
4. **A valley's day ends** when the player sleeps, or at 05:00 when the night is played through; the day summary waits until the player is in a safe place (like Stardew Valley).
5. **Any lit camp is safe, but a guest pays.** A camp's owner sets the price of a stay, even a simple one, and a stay is a deal the owner approves. This reverses the default proposed on 10.10 (a camp safe for its owner alone).
6. **Plot draws favour newcomers by odds, not tickets.** Everyone may sign up; the draw computes each player's chance in advance (higher for a player with no house or plot), and the sign-up shows that percentage.
7. **A recipe given by a quest stays that quest's reward** (CR-61): tier-1 recipes known from the start do not include it.
8. **The hub shows "Your card", levels and badges as "coming soon" boxes** until accounts exist, with no sample numbers.
9. **The 3D trial ships to production as a parallel version** behind its own button on the home page, on the same data, built alongside the 2D game; if the community prefers it, it gets the investment. The 64 px painted trial and the rich-pixel trial are archived with a tag.

Also noted by the owner: the skill descriptions at the start are not as simple as in other games, and raising a skill or a level does not weigh as much as it should. This goes to the opening's stream as a finding.
**Retry when:** players read the camp price as a toll that blocks play (then a free first night), the plot odds read as unfair, or the 3D version's cost outruns the community's interest. Model: claude-opus-5-5.

## 2026-10-10 ✅ No dead props: a sprite that looks workable must be workable, and `pnpm check` lists the ones that lie

The owner played the demo and found trees that look choppable but cannot be chopped, and a lying log that cannot be taken. Measured on develop: 8 `tree_oak` props, 2 `stump` props and 4 `log_fallen` props were scenery wearing the look of a node.
- Rule, in `pnpm check` (`tools/src/deadprops.ts`): a map prop may not wear a sprite that a resource node (grown, empty or young), a restoration or a camp part wears.
- Built: the 8 oaks are now nodes of `core/oak-trees` (new `place.scatter`: extra single-node slots, `core/lone-oak-1..8`), the 4 lying logs are nodes of the new `core/fallen-logs` (1 log, axe, 2000 ms, 180000 ms to regrow, so wood still comes only from an axe node), the 2 stumps are gone, the mossy logs became mossy rocks. `dead_tree` stays scenery: it reads as dead.
- Evidence: check 0 errors, 3 new tests, verify green. The opening's log floor now counts 13 (12 from the camp oaks, 1 from the log).
**Retry when:** the owner wants logs taken by hand (then the wood rule in `tools/src/starts.ts` changes first). Model: claude-sonnet-5-5.
## 2026-10-10 ⏸ Player houses and plots are paused; the town serves the player through shops you walk into
The owner stopped the planning of player houses and plot draws: the design spread out and did not feel right. The game goes on without a house, as many games do, and nothing about a house or a plot is bought for now. The town is the safe place, and its buildings each do one job: the workshop (crafting) and several shops, how many is still open (food and medicine, tools and weapons, clothing are the first ideas). A shop is entered as in Pokemon: the player walks through the door into an interior scene with a counter and a shopkeeper behind it, and the trade happens by talking to the shopkeeper. Each interior is dressed in the theme of what it sells, so a player reads the shop at a glance. The owner rejected a pop-up menu at the door. The first interior is a direction: two or three stills at phone size go to the owner before it is built. Answer 6 of the entry above (the weighted plot draw) is paused with this entry; the camp deals (answer 5) stand, since a camp is not a house. Open quests or text that promise a house or a plot are cut or reworded in their own pull request.
**Retry when:** players ask for a place of their own after the town shops ship, or multiplayer needs a personal store the town cannot give. Model: claude-opus-5-5.

## 2026-10-10 ✅ Feedback from inside the game: a button for every player, and a short review after the opening
The owner wants feedback all the time, from the field. Every build of the game, not only a developer mode, carries a feedback button; pressing it opens a pop-up with a text box and Send. The send carries the context on its own (where the player stands, the open quest, the hour of the valley, the build) so one sentence is enough. After the opening (the first dusk of the recut), a pop-up asks once for a short development review: a few quick choices and one free line, skippable, never asked again in that save. A send reaches the team as a GitHub issue with the label `feedback`, through a small function on the site with a token that can only open issues; no name, address or account is collected. A developer who plays can turn the same text into a request for their own AI helper later; that is phase 2 and waits for phase 1 to prove useful.
**Retry when:** the issue list fills with noise (then a triage label and a daily digest), or accounts arrive (then a send may carry the player's handle by choice). Model: claude-opus-5-5.
## 2026-10-10 ✅ The five holes of the one line closed by the owner's answers, houses paused, and the check finished

The question (10.10): the entry on the game read as one line left five small holes open, and its check stopped after one of its three readers. The owner answered the holes in the afternoon (the owner's answers of 10.10 afternoon, pull request #57), settled one more point of the camp in the evening, and paused player houses and plots (the entry on houses and plots paused, pull request #61). This entry writes the answers into the rules, finishes the check, and brings the text in line. It closes the holes as the owner answered them; no default is taken where an answer exists.

- **Warnings (the owner's answer 3).** The countdown at the screen's edge runs to nightfall or to the mist's coming into the player's area, whichever is first, as the kernel keeps the mist (one mist). Entering the mist, the mist arriving, leaving a safe place after dark, or dark arriving outside one lights the lantern with the one warning box, at most once per night. A burning camp warns its owner and its guests before its fire goes out (SETTLEMENT 3.4). G31 says so; GRUNT's CR-94 carries the building.
- **When a valley's day ends (the owner's answer 4).** When the player sleeps, or at 05:00 of the game hour when the night is played through. The day-ended event and the day summary (G16, P-4) come then, before the morning toast, and the summary waits until the player stands in a safe place. From stage 7, where nobody skips the night, every day ends at 05:00 of the world's hour. Like Stardew Valley, whose day ends in bed or by passing out at 2 AM. G16 and P-4 say so; CR-96 carries it.
- **Another player's lit camp (the owner's answer 5, and the evening's word).** Any lit camp is safe, and a guest pays: the camp's owner sets the price of a stay, even a simple one, and a stay is a deal the owner approves. Asked in the evening whether a fire's light keeps the hunting hazards off anyone in it, the owner chose: the safety itself is what a guest buys. Without a deal another player's camp is no safe place, at any stage, and the fire's light only marks how far the camp reaches. A camp burns only while its owner keeps the fire (SETTLEMENT 3.4), so the one who approves is there. A price in gold moves through the ledger with the reason `rent`, already reserved (a reading). This reverses "the world seen at stage 7" in the entry on the game read as one line, and SETTLEMENT 3.4's reading that no other player uses a camp.
- **Rest (follows from the answer 5).** Rest restores health in a town, at one's own burning camp, and at another's as a guest with a deal, and nowhere else: before stage 7 by a night's sleep (G32), from stage 7 over one game hour. How far a camp reaches is a parameter, `fire_light_tiles`, set with the tent (CR-25). G32 and SETTLEMENT 3.4 say so; CR-95 carries the deal, the rest and the reach.
- **Plot draws (the owner's answer 6, then paused).** The draw weighted toward newcomers is paused with houses and plots the same day (pull request #61). Asked what happens when a player who holds a house wins a plot, the owner answered that houses stay a question mark until the shared world is in the field, and the core does not need them. So who may sign up and what a won plot is before its first step close as paused, and the answer 6 is the starting point if houses come back.
- **Houses and plots paused, in this branch's text.** SETTLEMENT carries a paused note at its head and on 3.2, 3.3, S1, S1b and S5; what a house gives (3.4) is paused; the one store opens at the opening camp's chest and one in each town; a player's shop sells on the town's market board; the kernel review's plot refund is paused with plots. GRUNT's CR-71 and CR-92 keep their rows with the plots marked paused, and CR-48, CR-58 and CR-91 lose the house. G28's written exception for plots and houses changes on the branch of the ten answers, which edits G28. The town's buildings with one job each are #61's to write.
- **CR-61 answered (the owner's answer 7).** A recipe a quest gives stays that quest's reward: the tier-1 recipes known from the start do not include it, the herb stew and the herb tea of the first helps among them. The open question in the entry on the game read as one line is closed.
- **Every count of days or weeks names its clock.** The ones the check found unnamed run on the real calendar by the server's clock: the creators' pool's account-day and week, the two weeks of a first block, the hunters' honor once a day, and the daily balance of the books. A day starts at 00:00 UTC, as the daily caps do, and a week at 00:00 UTC on Wednesday. Like RuneScape, whose daily reset is at 00:00 UTC and whose weekly reset is on Wednesday.
- **The check, finished.** Two readers walked the entry again: one for every definition against the living text, one for its precedents, the house rules and the references. Fixed here: the camp's fire matters by day too, since a burning camp is safe from the mist (SETTLEMENT 3.4); R8 in the kernel review calls the paying side the trader, as the one line names it; the world's hour stops for a window only until stage 7; the shared market drains on the server's hour until stage 7, while a player's own market drains on its valley's hour; four precedents read more exactly. Refuted on reading: the supersede lines placed after "**Closes:**" (that is the house order), a game named without a discussion elsewhere (every one is discussed), and CR-61's missing row (it lands with the ten answers). Routed, with nothing edited in another lane's files: G34's and P-5's gear and lantern, and CRAFTING_AUDIT's summary of G34, follow the ten answers' G34 on that branch; chapter 1's mist drawn by the client alone, and the receding mist's circle always clear around the character, against one mist (the story lane); STORY.md's "shared worlds (stage 2)", which are stage 4.

**Closes:** the five holes left open by the entry on the game read as one line, and its check; GRUNT's CR-94 to CR-96 carry the building.
**Retry when:** a guest's price reads as a toll that blocks a run to safety, a warning comes so often that players stop reading it, or houses come back. Model: claude-opus-5-5.

## 2026-10-11 ✅ Felling and digging run by themselves after one press, and the work is shown on the body and the tree
The owner asked that one press on a tree starts the felling: the character swings on its own and stops when the tree falls, with no pop-up and no bar. This is how RuneScape and phone farming games (Hay Day) do it, where Stardew Valley and Animal Crossing take one press per swing; one press suits a phone. Each swing plays an axe animation on the character, throws chips and a sound, and the tree shakes and cracks so the progress is read on the tree itself; moving away cancels the work, and the tree falls with its own animation. Digging and mining follow the same pattern with their own tool. The swing, dig and walk cycles are drawn with the character in the agreed pixel style and land with the walk animation.
**Retry when:** players lose track of how long a fell takes (then a small crack count on the tree), or a press by mistake starts work too often (then a hold to start). Model: claude-opus-5-5.

## 2026-10-11 ✅ The shop interior: warm planks, a runner to the counter, the trade shown on the back wall
Three phone-size stills of the food and medicine shop went to the owner (`docs/design/frames/2026-10-11-shop-interior-compare.png`): A, flagstone and timber with the counter centred; B, a checkered floor and wallpaper with the counter at the side and tables to walk between; C, worn planks, a woven runner from the door to the counter, and a brick chimney around a lit stove. The owner approved them with C as the pick (`docs/design/frames/2026-10-11-shop-interior.png`), after asking in round 1 for floors and walls that differ by shop. The compass for every shop: one room, the door at the bottom, a runner that leads the eye to the counter and the shopkeeper behind it, and the back wall that shows the trade (the stove for food; an anvil, a loom and so on for the others), each shop with its own floor and wall materials, window light, shadows and small life (a cat, a scale, hanging herbs). Known polish: C's stove is too large for its wall, the light patches are faint, the sacks and crates are quick props. The stills reuse kit sprites and props drawn in the kit palette; nothing is in the game yet.
**Retry when:** a shop's goods do not read at phone size, or the walk-in costs too much loading on a phone (then a lighter interior). Model: claude-opus-5-5.

## 2026-10-11 ✅ The 3D version is a second door on the home page, at its own pace, on the same game data

The owner's word (11.10), answering the open question of the 3D trial's entry of 9.10 ("a second door at /play3d/", on `trial/3d`, #24) and NEXT section 3b: yes. The home page carries a second entry button that starts the 3D game at `/play3d/`, next to the classic game's Play. It is the same game in a 3D trial of development, not a second product: the same kernel, the same content bundle and the same save format, so a character made at one door plays at the other, and when stage 2a moves saves to the server both doors use that one store. It moves at its own pace, behind the classic game, and is open to outside developers who want to push it; the classic game never waits for it. Until `/play3d/` is in the build the button hides, so the home page never links to a missing page. The look of any new 3D character is a direction: two or three phone-size stills first (the Meshy drafts cost credits, never downloads, until the owner picks).
**Retry when:** the 3D door draws more players than the classic one (then it gets the investment, as the entry of 10.10 item 9 says), or keeping one save format slows the classic game. Model: claude-opus-5-5.
## 2026-10-11 ✅ The first maze is the tangle south of the ruins: map and one visit, nothing new in the kernel

Built as the recut asked (entry of 9.10, "maze and stealth"): the map grows 13 rows south of the ruins into a forest knot with one gap (tile 39,34), a route of at least 60 tiles to the clearing and at least 10 dead ends, mossy rocks as the landmarks, and a dead tree at the heart. The quest `core/the-tangle` has type `maze` and one `visit` step on the area `core/tangle-heart`. `QUEST_TYPES` gains `maze` (additive, `FORMAT_VERSION` stays 1). `pnpm check` accepts a visit-only quest when it is a maze (the walk is the beat, G2) and refuses a maze whose visit is not an area. Proof: `tools/test/maze.test.ts` (route, dead ends, one gap, G17 order), `pnpm verify` exit 0. Whether the maze is fun to walk is the owner's to judge on the preview. Stealth over the hazards stays after P-5c.
**Retry when:** the maze needs a door that opens or a path that changes: then the kernel question is asked. Model: claude-sonnet-5-5.

## 2026-10-11 ✅ Maze difficulty is a ladder of four tiers, and the peek is the first help

The owner's word (11.10, relayed by the manager session): before entering a maze the player gets a 3-second peek at the whole maze from above. The tiers: **Tier 1** (the tangle): the peek, a very faint line of the route, and the mossy rocks. **Tier 2**: the peek, and only the mossy landmarks glow for a moment, no line. **Tier 3**: the peek of the shape only, no hints. **Tier 4**: no peek, no hints, plus a hazard that is escaped, never fought (after P-5c and stealth; compare "a hazard is escaped, never answered by an item", 10.10). Later mazes climb the ladder. The peek and the faint line are `game/` client features built in a later stream (spec in NEXT.md); this pull request builds none of them, so the tangle as merged has the mossy-rock landmarks only. Content needs no change for the ladder yet; if a tier must be declared in a file, that is a schema question asked then.
**Retry when:** a maze past the tangle is designed, or the peek is built and the owner finds three seconds too long or too short. Model: claude-sonnet-5-5.

## 2026-10-09 ✅ The crafting economy as built: no level wall, and a made good sells for more

The economy pull request builds two lines of "The crafting economy" above: the level wall goes (CR-17), and a made good sells for the made share (CR-18). It is stacked on wave 3, before that merges. Each number is a parameter that a vote can move.

- No level wall. The craft refuses only a missing station or one below the recipe's tier. Each level of the recipe's profession above the recipe's adds `craft_level_step_bp` (500) to the chance, and each missing level takes the same off, down to nothing and never below. At nothing, luck adds nothing: the try runs, misses, keeps the usual share of its inputs, counts as a try and trains the profession as much as any other. A tier-1 recipe is still sure at its own level and above. The journal and the craft panel no longer show the level a recipe wants, and they never showed a chance.
- Gear that fits the task, on the side of skill, is not built: no worn effect names a task yet, and `craft_chance_pct` stays on the side of luck. It waits as CR-32, next to the worn minus of CR-21.
- The made share. `k_craft_permille` is 750 (a vote moves it between 500 and 900, step 50). An item is a made good when its value comes from a recipe, that is, when the value table's cheapest source for it is a recipe; the bundle carries the sorted list. A recipe that makes a gathered item at a higher cost does not make it a made good. The trader pays `k_craft_permille` of r * V for a made good and `k_permille` (500) for the rest, rounded down. A tool still sells by the share of its uses left. The check refuses a made share below `k_permille`, and either share with a bound at 1000 or more, so no vote lets the trader pay what the shop charges.
- R8 and Theorem 3. R8 bounds each item's pay by its own share. Theorem 3 holds with the larger share, k_hi = max(k, k_craft), in place of k: wealth counts held items at k_hi, so making adds no more than the recipe's work, and selling a raw good at k only lowers it. The ceiling on gold per active hour rises from 3600 * k * r * P to 3600 * k_hi * r * P, by half at launch: the price of making pay more than selling raw (kernel review, section 8.6). The rules page's G40 and G41 say that a recipe's level is no wall.
- The values report prices each item at the trader's share for it. The new reading: gathering 7200.0 to 7920.0 gold an hour, tier 1 23850.0 to 27600.0 (median 25807.5), tier 2 11221.2 to 18360.0 (median 16848.0), tier 3 2115.0 to 3802.5 (median 2958.8). The share lifted tier 1 most, because its inputs are raw and the report counts what goes in at the trader's price for it. A whole chain from gathering to a made good stays under the ceiling above. Tier 3 at its own level and before luck still pays less than gathering. The made share does not answer CR-31; the levers are content and parameters, so CR-31 stays open with this reading.
- Kernel 0.5.0. The schema change is additive and FORMAT_VERSION stays 1. No value moves, and `values.lock.json` is unchanged.

**Closes:** CR-17 and CR-18 (crafting audit, Appendix D).
**Retry when:** players read a try at nothing as a bug, the market (CR-19) moves the trader's price inside R8's band, or a decision on CR-31 changes the tier-3 numbers. Model: claude-opus-5-5.
