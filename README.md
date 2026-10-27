# Loomvale

A free pixel-art browser game that its players build and run together. You wake up by a broken bridge in a misty valley, gather and cook, dig in the ruins and bring the valley back to life. Every bush, recipe, quest and ruin in it is a small data file that anyone can add.

**[Play it now](https://theopenfold.vercel.app)** in any browser, on a phone or a computer. No install, no account.

**Stage 1 is a demo.** Progress is saved in your browser only and will not move to an account later; demo players get a title and a cosmetic item instead.

## Where it is going

The valley grows in stages, each opened by a condition, not a date: accounts and a server that keeps the score honest, a community that proposes and votes on what comes next, a market where creators earn in-game gold by how much their content is used, players who see each other, and in the end new mechanics written by the community itself. Power is never sold. The stages, where each one stands and where help is most welcome are in **[ROADMAP.md](ROADMAP.md)**.

## What is in the demo

- Three races, the human, the elf and the skeleton, each waking in a wake pocket the seed draws, with its own first task, and six attributes, seven points each: might (carrying and heavy work), senses (how far you notice hidden things), agility (how forgiving the timing is), luck (rare finds), stamina (how much food you can hold) and spirit (potions, spells and the hidden layer).
- The opening: wake up at noon, strike the bridge's keystone free with the timing minigame, mend the bridge for a purse of gold, fell a tree for the first fire, meet the town, and choose whom to help first: Elder Maru's berries, which he pays for with his old trowel, or Pell's herbs, which she pays for with a recipe and coin. The trowel then digs up Maru's coin under the lantern the stones name, which glows at dusk. After dark, a way opens under the broken arch.
- Foraging, digging, felling and cooking, each with levels and techniques; a workshop that climbs three tiers; a camp with three places to build and a fourth waiting for a reason; a day and night clock.
- Empty places in the mist, each waiting for a creator, with a link to the guide below.
- Phones (a touch stick to walk in any direction, and A and B buttons) and keyboards (arrows or WASD to walk, in eight directions; Space, E, Z or Enter to act; Esc or X to go back; I for the bag, J for the journal, M for the menu). Menu > Controls lists them in the game.

## Add to the valley

You do not need permission or an invitation. If it fits the valley, you can make it: a fruit or a herb, a recipe, a tool or something to wear, a treasure, a townsperson with their own words, a quest, a ruin to restore, a camp part, your own pixel art, or models for the 3D door. The [rules of play](docs/design/GAME_RULES.md) keep the game fair and fit for every age; inside them the ideas are yours. An idea the content format cannot hold yet goes in a "Request for the valley" issue, and the community votes it into an open call.

Start with **[Add a fruit in 10 minutes](docs/creators/README.md)**, then read [CONTRIBUTING.md](CONTRIBUTING.md). Open your pull request against the `develop` branch, not `main`: `main` is the default branch because it holds releases, and a release is `develop` merged into `main`. The first pull request asks you to sign the [contributor agreement](CLA.md) once, by a comment. Every pull request gets the same automatic check you can run yourself, and a preview of the game with your change. An AI tool can help: the guide shows how to point it at the rules, and a read-only MCP server (`pnpm mcp`) checks content from a clone.

What you get when it is merged: your name and signature on what you added in the game, a creator page on the site, points on the public board and a line in [CREDITS.md](CREDITS.md) ([ROADMAP.md](ROADMAP.md) has the details and what is planned later).

For your own art, a new sprite is drawn at 64 pixels per tile and says `"density": 4` in its kit entry: items and tiles are 64x64, character frames 128x128 (the animation tool's frame, feet at 64,90), work poses 128x128 with two frames (tool raised, then tool down). The old 16 pixel grid is closed to new art: the whole game is drawn at 64, and `pnpm check` refuses a new sprite on the 16 grid. The sizes, the 32 core colours and the look of the world are in [docs/design/STYLE.md](docs/design/STYLE.md) and the art section of the guide.

## How it is built

| Folder | What it holds |
|---|---|
| `kernel/` | The simulation: one pure step function, integers only, deterministic, replayable. |
| `schema/` | The format of every content file, as TypeBox types and the JSON Schema files in `schema/json/`. |
| `tools/` | `pnpm check` (the checker creators run), the bundler, the value anchor and the art importer. |
| `content/` | The game's data: `core/`, `extensions/<handle>/` and the art kits in `kit/`. |
| `game/` | The browser client: Phaser 4 and Vite, with the page UI in plain TypeScript. |
| `web/` | The site (Astro): home, docs, the hub with boards and creator pages, and the small server routes (`/api/feedback`, `/api/s1/`). |
| `mcp/` | The read-only MCP server for AI tools: the rules, the format and the check. |
| `server/` | The game server of stage 2a: the API, the database and its migrations, sign-in and the ledger. Not live yet; the demo plays on the phone's own storage. |
| `design/` | The one token sheet (colours, type, spacing) that the game and the site share. |
| `deploy/` | The server's container, its backup and its runbook. |
| `templates/extension/` | A working extension to copy. |
| `docs/` | The creator guide and the product spec. |

```bash
pnpm install
pnpm dev          # play locally
pnpm check        # validate the content, with readable errors (--json for tools)
pnpm test         # kernel and content tests
pnpm build        # the game and the site, into web/dist
pnpm e2e          # play the opening in headless Chrome, phone and desktop
pnpm verify       # everything CI runs, except the e2e and the postgres tests (they need DATABASE_URL)
```

Node 24 (the version in `.nvmrc`) and pnpm 10. Design decisions and abandoned approaches are in [DECISIONS.md](DECISIONS.md).

## License and name

Code: [AGPL-3.0](LICENSE). Content in `content/`: [CC BY-SA 4.0](content/LICENSE). Fonts: Pixelify Sans, Atkinson Hyperlegible Next and Platypi, SIL OFL 1.1. Everyone who made something in the valley is in [CREDITS.md](CREDITS.md). The licences cover the code and the content, not the game's name or logo: those are covered by [TRADEMARKS.md](TRADEMARKS.md), which says how to say "made for" the game.
