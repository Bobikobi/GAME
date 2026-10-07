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

`Pixelify Sans` remains for titles, buttons, numbers, and retro HUD elements. For body text—dialogue, panel bodies, item details, and creator guides—`--font-body` (system sans-serif) with generous line-height is used to prevent mobile reading fatigue on high-DPI screens. Model: antigravity.

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
