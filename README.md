# Openfold

A free pixel-art browser game that its players build and run together. You wake up by a broken bridge in a misty valley, gather and cook, dig in the ruins and bring the valley back to life. Every bush, recipe, quest and ruin in it is a small data file that anyone can add.

**Stage 1 is a demo.** Progress is saved in your browser only and will not move to an account later; demo players get a title and a cosmetic item instead.

## What is in the demo

- Three starters, the Forager, the Digger and the Explorer, each waking at its own place with its own kit and its own first task, with five attributes: carry (bag size), senses (how far you notice hidden things), agility (how forgiving the timing is), luck (rare finds) and stamina (how much food you can hold).
- The opening: wake up at noon, strike the bridge's keystone free with the timing minigame, mend the bridge for a purse of gold, fell a tree for the first fire, meet the town, and choose whom to help first: Elder Maru's berries, which he pays for with his old trowel, or Pell's herbs, which she pays for with a recipe and coin. The trowel then digs up Maru's coin under the lantern the stones name, which glows at dusk. After dark, a way opens under the broken arch.
- Foraging, digging and cooking, each with levels and techniques; a camp with three places to build and a fourth waiting for a reason; a day and night clock.
- Empty places in the mist, each waiting for a creator, with a link to the guide below.
- Phones (touch pad and A/B buttons) and keyboards (arrows or WASD, Space).

## Add to the valley

Start with **[Add a fruit in 10 minutes](docs/creators/README.md)**, then read [CONTRIBUTING.md](CONTRIBUTING.md). Every pull request gets the same automatic check you can run yourself, and a preview of the game with your change.

For custom character art, regular frames are 16x24. Work poses are 32x32 with two frames: tool raised, then tool down.

## How it is built

| Folder | What it holds |
|---|---|
| `kernel/` | The simulation: one pure step function, integers only, deterministic, replayable. |
| `schema/` | The format of every content file, as TypeBox types and the JSON Schema files in `schema/json/`. |
| `tools/` | `pnpm check` (the checker creators run), the bundler, the value anchor and the art importer. |
| `content/` | The game's data: `core/`, `extensions/<handle>/` and the art kits in `kit/`. |
| `game/` | The browser client: Phaser 4 and Vite, with the page UI in plain TypeScript. |
| `templates/extension/` | A working extension to copy. |
| `docs/` | The creator guide and the product spec. |

```bash
pnpm install
pnpm dev          # play locally
pnpm check        # validate the content, with readable errors (--json for tools)
pnpm test         # kernel and content tests
pnpm build        # game/dist
pnpm e2e          # play the opening in headless Chrome, phone and desktop
pnpm verify       # everything CI runs, except the e2e
```

Node 24 and pnpm 10. Design decisions and abandoned approaches are in [DECISIONS.md](DECISIONS.md).

## License

Code: [AGPL-3.0](LICENSE). Content in `content/`: [CC BY-SA 4.0](content/LICENSE). Font: Pixelify Sans, SIL OFL 1.1. Everyone who made something in the valley is in [CREDITS.md](CREDITS.md).
