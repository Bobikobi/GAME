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
- Before taking GRUNT item P-n, check that P-(n-1) is closed on `develop`. The P items build on each other.
- A trial of a direction (a style, an engine, the look of a character) starts with one still image at phone size for the owner, with one line saying what the frame tests, before any e2e run, video, board or pull request. The builder does not judge direction; the owner does.
- Before a proving run, grep the tests for every string the change renamed or rewrote and fix all the expectations in one pass. Then run the single test file, then `pnpm verify`, then `pnpm e2e` last.
- CI retries the opening e2e once and keeps the screenshots of the failed attempt (issue #25). A run that passed on your machine is not proven again when CI flakes; rerun the job.
- Fetching assets from a provider: read its index or API first, check the size before downloading, and keep a cap per model. Raw photoscans run to hundreds of megabytes and a browser cannot carry them.
