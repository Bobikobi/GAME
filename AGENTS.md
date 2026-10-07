# AI contributor guide

Read [docs/creators/README.md](docs/creators/README.md) before changing content. It documents the file layout, schemas, creator profiles, art rules and contribution flow.

- Keep simulation rules pure and integer-only in `kernel/`; put world content in declarative JSON under `content/`.
- Give extension files and ids the creator's lowercase handle prefix, use existing schemas and templates, and never hardcode item prices.
- Do not edit generated bundles, schemas, credits, values or the creators board by hand.
- Run `pnpm check` while creating content. Run `pnpm verify` before handing work back.
