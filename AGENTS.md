# AI contributor guide

Read [docs/creators/README.md](docs/creators/README.md) before changing content. It documents the file layout, schemas, creator profiles, art rules and contribution flow.

- Keep simulation rules pure and integer-only in `kernel/`; put world content in declarative JSON under `content/`.
- Give extension files and ids the creator's lowercase handle prefix, use existing schemas and templates, and never hardcode item prices.
- Do not edit generated bundles, schemas, credits, values or the creators board by hand.
- Run `pnpm check` while creating content. Run `pnpm verify` before handing work back.
- Read [docs/design/GAME_RULES.md](docs/design/GAME_RULES.md) before touching quests, camps, map props, NPC lines, rewards, timing or the opening. A request that breaks a rule is not built and not bent: it goes to the owner first (section 6 there), and `pnpm check` prints a `!` line for each rule it can test.

## How work moves

Learned on the first three days of building, each line from a real cost.

- Every branch starts from `origin/develop` and every pull request targets `develop`; a release is `develop` into `main`. Never stack a pull request on another branch: it lands there, not in `develop`, and CI refuses a different base.
- Several sessions build at once. Read [docs/team/PARALLEL.md](docs/team/PARALLEL.md) before you start and run `pnpm streams` to see the other streams; generated files (`schema/json`, `content/values.lock.json`, `CREDITS.md`, `content/board.json`) are taken from `develop` and regenerated, never merged by hand, and a change to a shared file lands as its own small pull request first.
- Before taking GRUNT item P-n, check that P-(n-1) is closed on `develop`. The P items build on each other.
- A direction is what changes the product visibly everywhere: the art style, the engine, the camera, the look of a character, the frame of the UI. A trial of a direction starts with two or three still images at phone size for the owner, each testing one named difference, before any e2e run, video, board or pull request. The owner picks one; the pick is recorded in `DECISIONS.md` with its frame and becomes the compass the polish loop follows without asking again. A detail inside an agreed direction (a texture, a flame, a shadow, a seam) is polish: iterate, do not ask. The builder does not judge direction; the owner does.
- Before a proving run, grep the tests for every string the change renamed or rewrote and fix all the expectations in one pass. Then run the single test file, then `pnpm verify`, and push: CI runs the opening e2e on the pull request. Run `pnpm e2e` on your machine only to debug a red run.
- CI retries the opening e2e once and keeps the screenshots of the failed attempt (issue #25). When CI flakes, rerun the job.
- Fetching assets from a provider: read its index or API first, check the size before downloading, and keep a cap per model. Raw photoscans run to hundreds of megabytes and a browser cannot carry them.
- One game, two doors: every rule, idea and development decided for the game holds in the classic game and in the 3D game at `/play3d/` alike, unless it is truly 2D (pixels, a sprite sheet). The builder carries it across in the other door's own means, or raises the problem to the owner; it is never dropped quietly. The pixel game gets the effort first and the 3D game follows: a 3D twin never holds back or takes builders from the pixel game's work (DECISIONS 2026-10-18, NEXT 8 e).
- Read [docs/design/STORY.md](docs/design/STORY.md) before writing lore, a line about the past, a new character or an extension's setting. The narrator never states the past, and every claim about it has a speaker (S1-S6 there).
