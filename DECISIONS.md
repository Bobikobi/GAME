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

## 2026-10-08 ✅ Name shortlist for the community vote

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
**Retry when:** a pricing model wants to sell below the full value (a sale or a discount curve); then R8, `minChargeFor` and Theorem 3 change together, in one decision. Model: claude-opus-5-5.

## 2026-10-09 (done) The name is Openfold, confirmed by the owner - the shortlist vote is superseded

The 8.10 entry "Name shortlist for the community vote" set up a vote because the working name, Mistvale, is taken as both a `.com` and a `.io` domain. Motty (product) proposed Openfold to replace Mistvale on that ballot rather than skip the vote outright; Elad (owner, who holds the ballot) confirmed it directly - Openfold is the name, no vote needed. No hyphen, so it carries cleanly into the save key, package names and a URL; "the fold" is also the English idiom for belonging to a group, landing both the valley setting and the loop's community governance. The domain itself is still unchecked beyond the informal DNS-record look the 8.10 entry already did for the shortlist - a real registrar check comes with the rename pull request.
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
**Retry when:** the plan's questions are answered, or stage 4 brings a shared world state. Model: claude-opus-5-5.

## 2026-10-09 ✅ In a shared town absence has a price, and a mail comes first

The question (settlement plan S1, 9.10): a plot that lapses while its holder sleeps is the timer G28 forbids, and losing a building's progress meets pillar 5. The recommendation was a lapse only in a shared town, counted between steps, with the full price and every delivered item returned and a finished house never taken. The owner's word (9.10): almost. Yes to the exception for a shared town and to the clock between steps, but absence has a price:

- A player about to lose a place gets an email first. Registration is minimal and comes after the opening (the next entry).
- An owner who has not played for weeks needs a rule too.
- So does a builder who takes a long time between steps.

As rules in `docs/design/SETTLEMENT.md` (3.2 and 3.8): the clock between steps runs whether the builder is away or slow; an owner long away has the house packed; one mail per hold comes before it ends, and no mail asks the player back for anything else. What a lapse and a packing cost is question S1b, asked the same day; the recommendation is the place and a fifth of its price, never what the player made. G28's text in `docs/design/GAME_RULES.md` gains the exception when S1b is answered.

**Closes:** nothing yet.
**Retry when:** the owner answers S1b. Model: claude-opus-5-5.

## 2026-10-09 ✅ An account asks for little, and only after the opening

The owner's word (9.10), given with the answer on absence: registration is minimal, and it comes after the opening.

Read as: an email address and the name the world shows, asked when the opening ends and never before play. Accounts begin at stage 2a; the stage-1 demo keeps none, and the 6.10 decision that nothing carries from the demo stands. The address serves the account and the notices of `docs/design/SETTLEMENT.md` 3.8, nothing else.

**Opens for stage 2a:** a privacy text and the youngest age that may register, both before the first address is collected; a mail service for the notices; how the opening played before registering moves into the new account under server-decided saves.
**Closes:** nothing.
**Retry when:** stage 2a is designed. Model: claude-opus-5-5.

## 2026-10-09 ✅ Absence costs the place and a fifth of its price, never what the player made

The question (settlement plan S1b, 9.10): what a lapse and a packing cost, after the owner's word that absence in a shared town has a price. The owner's word (9.10): yes to the recommendation.

- A building with no finished step for 14 days returns to the town, whether its builder is away or slow. The builder gets back every delivered item and 80% of the plot's price; the other 20% stays burned.
- A house whose owner has not played for 45 days is packed. Its plot returns to the town with the same 80% of its price; the house and everything in it stay the owner's, to raise again on any free plot without redoing a step.
- One mail comes before each: 3 days before for a building, 7 for a house.

Final Fantasy XIV is the nearest precedent: 45 days without the owner's visit, mails before, and 80% of the plot's price back, but there the house is torn down. G28 in `docs/design/GAME_RULES.md` now states the exception, and `docs/design/SETTLEMENT.md` holds the parameters (`build_hold_days` 14, `house_absent_days` 45, `plot_refund_permille` 800, `notice_days` 3 and 7).

**Closes:** S1 of the settlement plan, and the open part of the entry "In a shared town absence has a price, and a mail comes first".
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
**Retry when:** a playtest shows a night's wood too dear or too cheap for an area. Model: claude-opus-5-5.

## 2026-10-09 ✅ Wood comes from felling trees: every tree gives wood by its type and grows back before it is felled again

The owner's word (9.10): wood is not gathered from piles of twigs but by felling trees, so every tree is of use. A tree gives a number of logs by its type, takes a time to fell by its type, and grows back in a time by its type, shown as it grows; only a grown tree can be felled.

As content, a tree is a gathering node much like a plant: `output` its log, `yield` the logs of its type, `active_ms` the felling time, `respawn_ms` the time to grow back, and `level` by type. Growing back is never paid (R6), so a log's value counts the felling only. The client draws the stage from the share of `respawn_ms` gone: a stump, a sapling, a young tree, a grown one. The wood chain of the crafting content starts from a log.

Readings, each open to the owner's word:
- Felling needs an axe, a new tool kind in the kernel's closed list, and it is a profession of its own, woodcutting, as digging is with its trowel.
- A stump blocks its tile as the tree did, so felling never opens or closes a path; only a clearing quest (the settlement plan, 3.3) uproots a tree for good.
- The trees inside a town are the town's and are not felled.
- Small wood, a stick for a skewer or kindling, comes from splitting a log by a recipe.
- In a shared world a tree is shared, and who fells it first joins the question on shared bushes (spec stage 4).

The opening's fallen branches (question W1): answered the same day. None stay, not even in the opening; see the entry on the first fire below.

**Closes:** nothing; GRUNT's open ends carry it as CR-24.
**Retry when:** the wood chain is built. Model: claude-opus-5-5.

## 2026-10-09 ⏸ No bots, no AI that plays for a player, no cheating: the rules wait for accounts and the shared world

The owner's word (9.10): the game needs protection against bots and against AI that plays in a player's place while the player is away, and anti-cheat once players share a world.

What already stands against them: the kernel review recommends perfect execution as the reference player (D2), so a program with perfect timing earns no more per second than a perfect human; rolls come from the server, not from a seed the player holds (K3); a timing grade is the server's, not a claim (K10); boards rank only state the server has checked (7.10); the creator pool counts active seconds with a cap per account-day (R10). Anti-cheat follows the same line: the server decides, and the client only shows and asks.

What a program still gains is hours: it can play all day, and in a shared world it reaches shared things first. What to do about that is question A1, asked in turn.

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
**Retry when:** in a shared world one player or group holds a large share of a town's places, or gold piles up with nothing to spend it on. Model: claude-opus-5-5.

## 2026-10-09 ✅ A plot that work opens is drawn among those who did the work

The question (settlement plan S5, 9.10): first come at the moment a plot opens favours whoever is online then, and a script most of all. The recommendation was three days of first claim for the players of the clearing quest, then a draw. The owner's word (9.10): whoever signed up for the clearing and took part enters the draw. How it weighs may depend on the size of the area and the number of places, and the one who worked hardest may come first; the game does not turn only on buildings now, so the rest can wait.

- A clearing quest names the plots it opens. They are drawn among its participants: a player who signed up and finished at least one of its steps. Signing up without working is not taking part, so a script gains nothing by signing up.
- The draw is the server's, as every roll is (kernel review K3), and gives each participant one plot at most, under the rule of one plot in building and one house per player.
- A plot won is held as a claimed one: the first step pays its price, and with no finished step for 14 days it returns to the town (S1b) and is drawn again, among the participants first. The draw needs no clock of its own.
- Open until the shared town is designed (stage 4): whether every participant has the same chance or the chance grows with the share of the work done, measured in active seconds as levels are, and how the draw follows the size of the area and the number of places. A reading: a chance that grows with the work, so the hardest worker is the most likely winner and never a certain one.

`docs/design/SETTLEMENT.md` 3.3 holds the rule.

**Closes:** S5 of the settlement plan, in part; the rest waits for the shared town's design.
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
- Open, asked next: whether a rule alone decides a block or a person decides after the hold, and whether a player may appeal.

**Closes:** part of A1; GRUNT's CR-43 now carries it.
**Retry when:** a real player is caught by a flag, or a loop runs unflagged. Model: claude-opus-5-5.
