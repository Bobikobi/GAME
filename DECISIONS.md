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
