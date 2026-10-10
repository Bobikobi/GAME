# Welcome Developers and Creators

Everything in Openfold - every bush, recipe, quest, shop, and ruin - is an open JSON file in the game's repository. You build the world the same way the core team does: copy a template, tweak declarative fields, run `pnpm check`, and open a pull request. Once merged, the sign at that spot in the valley carries your name, creator points, and invested hours.

### Quick Start with AI

Copy and paste this prompt into your AI coding tool (Claude, Cursor, ChatGPT, Antigravity):

```text
I want to add a new content extension to Openfold (a community-built 2D RPG).
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
- `items[0].class`, `family` and `tier` - what the fruit is: `plant`, family `plum`, tier 1. See [Classes and tiers](#classes-and-tiers).
- `food.satiety` - how much one fruit fills, 1 to 100. A redberry gives 4, a cooked berry mash 15.
- `node.yield` - fruit per pick with perfect timing, 1 to 20.
- `node.active_ms` - how long one pick takes, from 1000 to 15000 ms.
- `node.respawn_ms` - how long before the same bush gives again. Waiting is never paid.
- `node.count` - how many bushes grow in the slot, 1 to 12.
- `node.hours` - optional. `[18, 6]` makes a fruit that only ripens at night.
- `node.tool` - optional. `basket`, `trowel` or `axe`: the tool the player must carry to gather it. With `axe` the node is a tree: gathering it is felling, which trains Woodcutting (`core/woodcutting`) instead of Foraging, and `node.level` is the Woodcutting level it asks for. Wood comes only this way: the check refuses an item of class `wood` from any other node, and from a dig spot.
- `node.solid` - optional. `true` keeps the tile blocked ready or not, as a tree does: the stump stays in the way until the tree is grown again. Left out, the player walks through it.
- `node.growth` - optional, up to 3 sprites between `sprite_empty` and `sprite`. While the node grows back, the game shows them one after the other by how much of `respawn_ms` has passed, so a felled oak goes stump, sapling, young tree, oak. Needs a `sprite_empty`.
- `node.place.slot` - where it grows. The empty resource slot today: `core/west-glade` (by the meadow where you wake up); the garden in the ruins grows the bell bushes since P-3. One extension per slot.

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

## Classes and tiers

Every item names a `class` and a `tier`, so recipes can ask for a kind of material instead of one item, and the world can grow new materials without rewriting old recipes.

- `class` - one of the base classes: `plant` (leaves, herbs, berries, fruit, roots, mushrooms), `wood`, `fibre` (reeds, grass, thread, cloth), `stone`, `clay` (clay, sand, pottery, brick), `mineral` (crystals, gems, salt, ore), `metal`, `animal` (feathers, wool, hide, bone), `meal` (cooked food), `tool`, `garment`, `jewelry`, `relic` (old things from the ruins). Metal waits for its discovery: until the world finds it, the check refuses metal items.
- A class of your own sits under one base class. Declare it in `classes` at the top level of any of your files, next to `items`: `"classes": [{ "id": "<your-handle>/stone-fruit", "name": "Stone fruit", "base": "plant" }]`. Every rule for the base class holds for it, and a recipe that asks for `plant` takes it too.
- `family` and `tags` - optional open words: `"family": "plum"`, `"tags": ["sweet", "night"]`.
- `tier` - how advanced it is, from 1; a first material is tier 1, and a tool has the tier of its `tool`. The world has opened tiers 1 to 3 (`open_tiers` in the params). The tier is a different ladder from the rarity: the rarity says how often a thing appears, the tier how far up it is.

Recipes climb one tier at a time. A recipe's tier is the highest tier among its outputs, and:

- no output is more than one tier above the highest tier among the inputs;
- its `level` sits inside the tier's band: tier 1 from level 1 to 2, tier 2 from 3 to 5, tier 3 from 6 (`tier_min_level` in the params);
- a camp part provides its station at that tier or higher;
- the profession that gates it is the one named in `profession`, or else the one that works its station (cooking works the fire).

From tier 3 up, a thing comes only from a gated source: a node that needs the tier's level or respawns in 5 minutes or more, a dig spot, a quest reward or a recipe. No shop sells it.

### Recipe templates

A template asks for a class instead of an item. The check turns it into one recipe for every item that fits, so a herb added next month works in this recipe without anyone writing it again:

```json
{
  "format": 1,
  "type": "template",
  "id": "<your-handle>/dried-herbs",
  "title": "Dried herbs",
  "creator": "<your-handle>",
  "template": {
    "station": "fire",
    "active_ms": 4000,
    "level": 1,
    "inputs": [{ "class": "plant", "family": "herb", "min_tier": 1, "qty": 2 }],
    "outputs": [{ "item": "<your-handle>/dried-herbs", "qty": 1, "share_pct": 100 }]
  }
}
```

Each recipe it makes is named after the template and the items it took, for example "Dried herbs (Sunleaf)", with the id `<template id>+<item id>` (one item id per class input), and every player knows it from the start. A template that fits more than `template_max_recipes` combinations (12 today) makes none, and the check says so: name a family, a narrower class or a higher `min_tier`. Because the check runs on the whole world, a new item from another creator can push a broad template over the limit, so keep templates narrow.

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

## Tools and the first morning

A tool is an item with a `tool` block: its `kind` (`basket`, `trowel` or `axe`), a `tier` and the `uses` it has before it wears out. Tools have no value of their own, so a shop prices them: Pell sells all three.

A starting character may carry a `kit`, a list of up to six `{ "item", "qty" }` stacks that go into the bag when the character is chosen. The kit holds the tool of the character's first task, so no start ends at a wall. Today both starters carry an axe, because the first fire is built from a felled oak: the check refuses a start that holds none, an axe that no shop sells (a worn-out axe must be buyable again), and an opening that asks for more logs than the oaks of a new valley give.

## What the check enforces

- Files live in `content/extensions/<your-handle>/` and say `"creator": "<your-handle>"`. Ids start with `<your-handle>/`, and an id is never reused once merged.
- One extension per slot, and the slot must be the right kind: a resource goes in a resource slot.
- Active times stay between 1000 and 15000 ms.
- The rarity you declare is within one step of what the data implies. A fruit that grows anywhere at any hour is common; night-only, high-level or slow-to-regrow fruit is rarer.
- Everything a recipe or quest asks for can be found somewhere in the world.
- Wood comes only from felling a tree: a node that gives an item of class `wood` needs `"tool": "axe"`, and digging never gives wood. A tree stands in the way (`solid`) without cutting any place of the map off from where the player wakes up.
- Every item has a `class` and a `tier`; the tier is open (1 to 3 today); a class of your own sits under a base class; no metal yet. A recipe climbs one tier at most, asks for a level inside its tier's band, has a profession that works its station and a camp part of its tier. From tier 3 up, nothing is sold. A recipe template stays within `template_max_recipes`. See [Classes and tiers](#classes-and-tiers).
- The rarity bonuses of the whole world stay inside the rarity budget (10% today): a rare node with many copies or a fast respawn uses more of it.
- A garment or jewelry piece names where it is worn (`wear`), with at most two small effects under its tier's cap; a look (`wear.look`) has no effect, and only a look may carry `premium_later`, while staying obtainable in the game. A recipe's `miss` names the share of each input a miss keeps (up to 90 percent, half when left out); a miss makes nothing else and is worth less than a success.
- A `find` step names an item that is found, not farmed: one that only digging gives, or that exactly one timed plant (a resource with `hours`) gives, never made or sold. It carries a clue; the journal shows the clue, not a count. A `riddle` step cites map props by id and names its answer, a dig spot or a place by day or by night; an id that is not on the map is refused. `templates/extension/quests/` has a find.
- Your change may not move the value of anything that already exists by more than 10%. If it has to, a core maintainer re-anchors the values.
- Every sprite exists, has the right size and uses the core palette.

## AI tools

Using them is fine, and so is saying so. List every tool you used for the file or its art in `ai_tools`. The game credits them on the sign and in Menu > Credits.

## License

Content you contribute is published under CC BY-SA 4.0 (see `content/LICENSE`), and code under the AGPL-3.0. Opening a pull request means you agree to that.
