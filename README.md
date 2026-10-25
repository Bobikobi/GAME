# Openfold

A free pixel-art browser game that its players build and run together. You wake up by a broken bridge in a misty valley, gather and cook, dig in the ruins and bring the valley back to life. Every bush, recipe, quest and ruin in it is a small data file that anyone can add.

**[Play it now](https://theopenfold.vercel.app)** in any browser, on a phone or a computer. No install, no account.

**Stage 1 is a demo.** Progress is saved in your browser only and will not move to an account later; demo players get a title and a cosmetic item instead.

## Where it is going

The valley grows in stages, each opened by a condition, not a date: accounts and a server that keeps the score honest, a community that proposes and votes on what comes next, a market where creators earn in-game gold by how much their content is used, players who see each other, and in the end new mechanics written by the community itself. Power is never sold. The stages, where each one stands and where help is most welcome are in **[ROADMAP.md](ROADMAP.md)**.

## What is in the demo

- Three races, the human, the elf and the skeleton, each waking in a wake pocket the seed draws, with its own first task, and six attributes, seven points each: might (carrying and heavy work), senses (how far you notice hidden things), agility (how forgiving the timing is), luck (rare finds), stamina (how much food you can hold) and spirit (potions, spells and the hidden layer).
- The opening: wake up at noon, strike the bridge's keystone free with the timing minigame, mend the bridge for a purse of gold, fell a tree for the first fire, meet the town, and choose whom to help first: Elder Maru's berries, which he pays for with his old trowel, or Pell's herbs, which she pays for with a recipe and coin. The trowel then digs up Maru's coin under the lantern the stones name, which glows at dusk. After dark, a way opens under the broken arch.
- Foraging, digging and cooking, each with levels and techniques; a camp with three places to build and a fourth waiting for a reason; a day and night clock.
- Empty places in the mist, each waiting for a creator, with a link to the guide below.
- Phones (touch pad and A/B buttons) and keyboards (arrows or WASD, Space).

## Add to the valley

You do not need permission or an invitation. If it fits the valley, you can make it: a fruit or a herb, a recipe, a tool or something to wear, a treasure, a townsperson with their own words, a quest, a ruin to restore, a camp part, your own pixel art, or models for the 3D door. The [rules of play](docs/design/GAME_RULES.md) keep the game fair and fit for every age; inside them the ideas are yours. An idea the content format cannot hold yet goes in a "Request for the valley" issue, and the community votes it into an open call.

Start with **[Add a fruit in 10 minutes](docs/creators/README.md)**, then read [CONTRIBUTING.md](CONTRIBUTING.md). Every pull request gets the same automatic check you can run yourself, and a preview of the game with your change. An AI tool can help: the guide shows how to point it at the rules, and a read-only MCP server (`pnpm mcp`) checks content from a clone.

What you get when it is merged: your name and signature on what you added in the game, a creator page on the site, points on the public board and a line in [CREDITS.md](CREDITS.md) ([ROADMAP.md](ROADMAP.md) has the details and what is planned later).

For custom character art, regular frames are 16x24. Work poses are 32x32 with two frames: tool raised, then tool down.

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

Node 24 and pnpm 10. Design decisions and abandoned approaches are in [DECISIONS.md](DECISIONS.md).

## License

Code: [AGPL-3.0](LICENSE). Content in `content/`: [CC BY-SA 4.0](content/LICENSE). Fonts: Pixelify Sans, Atkinson Hyperlegible Next and Platypi, SIL OFL 1.1. Everyone who made something in the valley is in [CREDITS.md](CREDITS.md).
