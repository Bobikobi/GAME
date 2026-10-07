# AI contributor guide

Read [docs/creators/README.md](docs/creators/README.md) before changing content. It documents the file layout, schemas, creator profiles, art rules and contribution flow.

- Keep simulation rules pure and integer-only in `kernel/`; put world content in declarative JSON under `content/`.
- Give extension files and ids the creator's lowercase handle prefix, use existing schemas and templates, and never hardcode item prices.
- Do not edit generated bundles, schemas, credits, values or the creators board by hand.
- Run `pnpm check` while creating content. Run `pnpm verify` before handing work back.
- Read [docs/design/GAME_RULES.md](docs/design/GAME_RULES.md) before touching quests, camps, map props, NPC lines, rewards, timing or the opening. A request that breaks a rule is not built and not bent: it goes to the owner first (section 6 there), and `pnpm check` prints a `!` line for each rule it can test.
