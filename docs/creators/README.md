# Welcome Developers and Creators

Everything in Mistvale - every bush, recipe, quest, shop, and ruin - is an open JSON file in the game's repository. You build the world the same way the core team does: copy a template, tweak declarative fields, run `pnpm check`, and open a pull request. Once merged, the sign at that spot in the valley carries your name, creator points, and invested hours.

### Quick Start with AI

Copy and paste this prompt into your AI coding tool (Claude, Cursor, ChatGPT, Antigravity):

```text
I want to add a new content extension to Mistvale (a community-built 2D RPG).
Repository guidelines:
- Read docs/creators/README.md and templates/extension/.
- Place files in content/extensions/<my-handle>/ (resources, recipes, items, npcs, or quests).
- Validate all IDs start with <my-handle>/ and conform to schema/json/*.
- Values and prices are calculated automatically via relaxation solver (no hardcoded prices).
- Run `pnpm check` and ensure 0 errors.

Please help me create a new extension.
```

---

# Add a fruit in 10 minutes

This guide walks through adding the smallest useful thing: a fruit bush in an empty slot of the map.

## What you need

- A GitHub account.
- Node 24 (the current LTS) and pnpm 10 (`npm install -g pnpm@10`).
- No drawing skills. You start with the core art and can swap in your own later.

## 1. Run the game on your machine (2 minutes)

Fork the repository on GitHub, then:

```bash
git clone https://github.com/<you>/GAME
cd GAME
pnpm install
pnpm dev
```

Open the address it prints. You are playing your own copy.

## 2. Copy the template (1 minute)

Your handle is your GitHub name in lowercase. Copy the template into a folder with that name:

```bash
cp -r templates/extension content/extensions/<your-handle>
```

In every file of the new folder, replace `your-handle` with your handle. Everything you add has an id that starts with it, so two creators can never clash.

## 3. Make it yours (4 minutes)

Open `content/extensions/<your-handle>/resources/wild-plums.json`. Rename the file and the ids if you grow something else. The fields worth changing:

- `items[0].name` and `description` - what the player reads.
- `food.satiety` - how much one fruit fills, 1 to 100. A redberry gives 4, a cooked berry mash 15.
- `node.yield` - fruit per pick with perfect timing, 1 to 20.
- `node.active_ms` - how long one pick takes, from 1000 to 15000 ms.
- `node.respawn_ms` - how long before the same bush gives again. Waiting is never paid.
- `node.count` - how many bushes grow in the slot, 1 to 12.
- `node.hours` - optional. `[18, 6]` makes a fruit that only ripens at night.
- `node.place.slot` - where it grows. Empty resource slots today: `core/west-glade` (by the meadow where you wake up) and `core/ruins-garden` (in the ruins). One extension per slot.

You never set a price. The game works out every item's value from the effort it takes to get, and the trader pays from that. A rarer, slower fruit is worth more on its own.

## 4. Check it (1 minute)

```bash
pnpm check
```

Each problem names the file, the field and what to do about it. Fix them until it prints no errors. `pnpm check --json` prints the same report for an AI tool to read.

## 5. See it in the game (1 minute)

Run `pnpm dev` again and continue your game, or start a new one. Walk west from where you wake up: the bushes grow in the glade, and its sign now reads "Added by <your-handle>".

## 6. Open a pull request (1 minute)

Commit only your own folder, push it to your fork, and open a pull request. The same check runs on it automatically, and the pull request template lists what reviewers look at. A preview of the game with your change is built for the pull request; for a first pull request from a fork, a maintainer approves that build first.

## Your creator profile

Add `content/extensions/<your-handle>/profile.json` so signs and the Creators menu can introduce you. The profile has:

- `name` - how the game names you.
- `role` - optional short text under your name, such as "World builder".
- `signature.text` - the words shown above your signs, up to 24 characters.
- `signature.style` - `carved`, `painted`, `ink`, `gold` or `moss`.
- `signature.glyph` - optional: `none`, `leaf`, `star`, `sun`, `flower`, `key` or `wave`.

```json
{
  "$schema": "../../../schema/json/creator.schema.json",
  "format": 1,
  "type": "creator",
  "id": "<your-handle>/profile",
  "title": "Your name",
  "creator": "<your-handle>",
  "profile": {
    "name": "Your name",
    "role": "World builder",
    "signature": { "text": "Your mark", "style": "painted", "glyph": "leaf" }
  }
}
```

## Creator points and hours

The Creators menu shows points for accepted content and an estimate of invested hours based on commit sessions. `pnpm board` rebuilds `content/board.json` from the repository's Git history:

```bash
pnpm board
```

Run it from a full Git clone after commits exist. The generated board is committed by maintainers; do not edit it by hand.

## Your own art (optional)

Sprites live in a kit: `content/kit/<your-handle>/kit.json` plus PNG files next to it.

- Items and tiles are 16x16, character frames 16x24, props up to 64x64.
- Character work poses are 32x32 with two frames: tool raised, then tool down.
- Only the 32 colors of the core palette, and every pixel fully clear or fully solid.
- AI images are welcome. Run any image through the importer and it snaps to the grid and the palette: `pnpm kit:import my-plum.png content/kit/<your-handle>/items/plum.png 16 16`.
- Frames, sheets and a prompt-to-sprite path: the `um` tool of universal-modder (free sprite commands; the drawing recipes on your own fal.ai key). The recipe and its limits: [docs/design/ASSET_PATH.md](../design/ASSET_PATH.md) section 2. List it in `ai_tools` like any other tool.

A kit file looks like this:

```json
{
  "format": 1,
  "type": "kit",
  "id": "<your-handle>/kit",
  "title": "Plum art",
  "creator": "<your-handle>",
  "ai_tools": ["Nano Banana (Gemini)"],
  "kit": { "sprites": { "items/plum": { "file": "items/plum.png", "w": 16, "h": 16 } } }
}
```

Then point your item at it: `"sprite": "<your-handle>/kit:items/plum"`.

## What the check enforces

- Files live in `content/extensions/<your-handle>/` and say `"creator": "<your-handle>"`. Ids start with `<your-handle>/`, and an id is never reused once merged.
- One extension per slot, and the slot must be the right kind: a resource goes in a resource slot.
- Active times stay between 1000 and 15000 ms.
- The rarity you declare is within one step of what the data implies. A fruit that grows anywhere at any hour is common; night-only, high-level or slow-to-regrow fruit is rarer.
- Everything a recipe or quest asks for can be found somewhere in the world.
- A `find` step names an item that only digging gives (never gathered, made or sold) and carries a clue; the journal shows the clue, not a count. A `riddle` step cites map props by id and names its answer, a dig spot or a place by day or by night; an id that is not on the map is refused. `templates/extension/quests/` has a find.
- Your change may not move the value of anything that already exists by more than 10%. If it has to, a core maintainer re-anchors the values.
- Every sprite exists, has the right size and uses the core palette.

## AI tools

Using them is fine, and so is saying so. List every tool you used for the file or its art in `ai_tools`. The game credits them on the sign and in Menu > Credits.

## License

Content you contribute is published under CC BY-SA 4.0 (see `content/LICENSE`), and code under the AGPL-3.0. Opening a pull request means you agree to that.
