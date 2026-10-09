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

You never set a price. The game works out every item's value from the effort it takes to get, and the trader pays from that. A rarer, slower fruit is worth more on its own. The trader pays a share of the value: 75 percent for a thing someone made, an item whose value comes from a recipe (`k_craft_permille`), and 50 percent for anything else (`k_permille`). The shop charges at least the full value.

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

## Crafting, step by step

Start from the core file that comes closest and copy it into your folder. Set `creator` to your handle and start the file's own ids with it; the items it asks for keep their ids. Run `pnpm check` after each step: it names the field to fix.

### A material

A material you gather comes from a resource, like the fruit above. `content/core/resources/reed-bank.json` is one: a reed of class `fibre` at tier 1, up to two a pick, from three clumps in the meadow.

- `kind` is `material`. Give it a `class`, a `tier` and, if you like, a `family` (see [Classes and tiers](#classes-and-tiers)).
- A first material is tier 1. From tier 3 up, its node asks for the tier's level in `node.level` (6 today) or comes back after `node.respawn_ms` of 300000 (5 minutes) or more.
- You never set its value. The game works it out from the effort, as for the fruit.

### A recipe

`content/core/recipes/stone-blade.json` makes a stone blade from two stone flakes and a branch at the workshop. A recipe file holds the new item in `items` and the recipe in `recipe`:

- `station` - `fire` (cooking) or `workshop` (handcraft). The profession that works the station gates the recipe and is trained by it; name another craft profession in `profession` only if you need one.
- `inputs` (1 to 6) and `outputs` (1 to 4); the outputs' `share_pct` adds up to 100.
- The tier climbs one step at most: the blade may be tier 2 because its flakes are tier 1. A tier 3 output needs a tier 2 input.
- `level` sits in the band of the recipe's tier (`tier_min_level` in the params, `[1, 3, 6]` today): tier 1 at level 1 or 2, tier 2 from 3 to 5, tier 3 from 6. The blade asks for handcraft level 3. The level is where the recipe has its own chance, not a wall: a player below it may still try.
- The station has to reach the tier: a tier 2 recipe needs a camp part that provides its station at tier 2 or higher. At the workshop that is the workbench (see [A camp part and its upgrade](#a-camp-part-and-its-upgrade)).
- `known` - `start` if every player knows it, `found` if a dig or a quest teaches it.
- `active_ms` - how long one try takes, 1000 to 15000 ms.

From tier 2 a try can miss. At its own level a tier 2 recipe succeeds 80 times in 100 and a tier 3 recipe 65 (`craft_chance_bp`), and each level above the recipe's adds 5 percent to the chance (`craft_level_step_bp`). Each level below takes the same step off, down to nothing, so a tier 1 recipe tried below its level can miss too, and a try at nothing still runs and misses. The game never shows a chance, a word for the difficulty or the level a recipe wants: players learn it by trying. A miss makes nothing and keeps half of each input, rounded down; when that would keep nothing, one unit of the most valuable input comes back. `miss.keep_pct` sets another share, up to 90 percent.

The check then asks one thing more: a try never loses value on average. Take the chance at the recipe's own level, before luck. The chance of a success times the value of the outputs, plus the chance of a miss times the value a miss keeps, has to reach the value of the inputs. When a miss keeps half the inputs' value, the recipe's own work has to be worth about 12.5 percent of its inputs at tier 2 and about 27 percent at tier 3. Rounding down keeps less (one unit of an input keeps none of it), and the bar climbs toward 25 and 54 percent: the core's stone trowel, which keeps one branch on a miss, needs its work to be worth about 52 percent of its inputs. If the check refuses, give the recipe more time or fewer inputs.

### A template

`content/core/templates/dye-cord.json` is the core's template: two berries of one kind, tier 1 or higher, and a reed cord make a dyed cord at the workshop. Today it makes two recipes, one with bellberries and one with redberries, and a berry you add makes another. Every recipe it makes follows the rules above. The fields are in [Recipe templates](#recipe-templates).

### A worn item

`content/core/recipes/reed-hat.json` makes a hat you wear while you gather. An item you wear has `wear`:

- `wear.slot` - `head`, `top`, `legs`, `outfit` (the top and the legs at once), `feet`, `jewelry` (two places) or `hand`. A piece of class `garment` goes on the head, top, legs, outfit or feet, a piece of class `jewelry` in a jewelry place, and the hand holds a tool.
- `wear.effects` - one or two small bonuses from a closed list: `gather_speed_pct`, `dig_speed_pct`, `craft_speed_pct`, `craft_chance_pct` and `rare_find_pct`. Each is a percent, each effect once, at most the cap of the item's tier (`wear_effect_max_pct`, `[5, 8, 12]` today: 5 at tier 1, 8 at tier 2, 12 at tier 3). The reed hat is tier 2 and gives 5.
- `wear.set` - optional: an id of your own that two or more of your pieces name, and that fits on the character at once (one piece per place, two jewelry pieces at most). Worn whole, a set's effects grow by `wear_set_bonus_pct` (20 percent today). The reed hat and the reed sandals make the set `core/reed-walker`.
- `wear.look` - a look shows and counts for nothing: no effects and no set.

Worn items are work clothes. They help the work and never protect you from a hazard; no effect on the list does that. A worn item stays in your bag and comes off when it leaves.

### A tool

`content/core/recipes/flint-trowel.json` makes a trowel that wears out, and `stone-trowel.json` one that lasts. A tool is an item of kind `tool` and class `tool`, with `tool`:

- `tool.kind` - `basket` or `trowel`, the kinds the world uses today.
- `tool.tier` - the same as the item's `tier`. Each tier above 1 adds 15 percent to the speed of the work, and the best tool of its kind in your bag does it.
- `tool.uses` - optional: the tool breaks after this many uses. Leave it out and the tool lasts. The core's tier 2 tools wear out and its tier 3 tools last.

The trader buys a made tool for its share of the value. A tool you have been using sells last: only when you sell every unit you hold does it pay just for the share of its uses left. A lasting tool always sells in full. The shop's basket and trowel have no value, and the trader never buys them back.

### A camp part and its upgrade

`content/core/camp/workbench.json` is the workshop's second step. A camp file names:

- `slot` - its place in the camp: `fire`, `storage`, `workshop` or `shelf`. One part stands in a slot at a time.
- `provides` and `tier` - the station it works (`fire` or `workshop`) and at which tier, 1 when left out. A recipe runs at a built part that provides its station at the recipe's tier or higher; when two do, the one you stand next to does the craft.
- `inputs` and `active_ms` - what building it takes; `bag_bonus` - optional extra places in the bag.
- `upgrades` - optional: the part it is built over. That part has to stand first, and the new one replaces it. An upgrade stays in the same slot, provides the same station, and keeps at least the tier and the bag bonus of the part it replaces.

The core's workshop climbs that way: the work stone (tier 1, four stones), the workbench over it (tier 2) and the workshop over the workbench (tier 3).

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

A tool is an item with a `tool` block: its `kind` (`basket`, `trowel`, `axe` or `staff`), a `tier` and the `uses` it has before it wears out. Tools have no value of their own, so a shop prices them: Pell sells all four. A staff asks for no work: it is worn in the hand for what its `wear` block helps.

Each starting character begins its own way and meets the others at the bridge and the first fire:

- `kit`: up to six `{ "item", "qty" }` stacks that go into the bag when the character is chosen, tier 1 only. A piece with a working `wear` slot is worn from the start.
- `wake`: `{ "x", "y" }`, the tile the character wakes on. Left out, it wakes at the map's spawn.
- `intro`: one to four lines the narrator says as the character wakes.
- A quest with `"starter": "<id>"` is offered to that start only: its own first task. A task with no giver is handed to nobody, so what it asked for stays in the bag.
- A dig spot with `"starter": "<id>"` is that start's own spot: only that character sees it and digs it, once, and it always gives its one find. Leave out the spot's `tool` and the find is picked up by hand, with no timing window, and the character's senses lead to it with a trail of glints.

The check keeps the starts fair. Every start holds an axe before the first fire, in its kit or on a spot of its own, because the first fire is built from a felled oak; a shop sells an axe, so a worn-out one can be bought again; and the opening never asks for more logs than the oaks of a new valley give. Every starter's attributes add up to one total. The kits, with each start's own finds, are worth about the same (within 25 percent of the poorest), and every start reaches the bridge with its axe in about the same time (within 50 percent of the fastest). A start's own spot gives one find at 100 percent, needs only a tool its kit holds, and lies within the start's senses on its road to the bridge, on a tile where x + y is even.

## What the check enforces

- Files live in `content/extensions/<your-handle>/` and say `"creator": "<your-handle>"`. Ids start with `<your-handle>/`, and an id is never reused once merged.
- One extension per slot, and the slot must be the right kind: a resource goes in a resource slot.
- Active times stay between 1000 and 15000 ms.
- The rarity you declare is within one step of what the data implies. A fruit that grows anywhere at any hour is common; night-only, high-level or slow-to-regrow fruit is rarer.
- Everything a recipe or quest asks for can be found somewhere in the world.
- Wood comes only from felling a tree: a node that gives an item of class `wood` needs `"tool": "axe"`, and digging never gives wood. A tree stands in the way (`solid`) without cutting any place of the map off from where the player wakes up.
- Every item has a `class` and a `tier`; the tier is open (1 to 3 today); a class of your own sits under a base class; no metal yet. A recipe climbs one tier at most, asks for a level inside its tier's band, has a profession that works its station and a camp part of its tier. From tier 3 up, nothing is sold. A recipe template stays within `template_max_recipes`. Together these make a long recipe a chain of short steps, each one behind its station and surest from its level up. See [Classes and tiers](#classes-and-tiers).
- The rarity bonuses of the whole world stay inside the rarity budget (10% today): a rare node with many copies or a fast respawn uses more of it.
- A garment or jewelry piece names where it is worn (`wear`), with at most two small effects under its tier's cap; a look (`wear.look`) has no effect, and only a look may carry `premium_later`, while staying obtainable in the game. A recipe's `miss` names the share of each input a miss keeps (up to 90 percent, half when left out); a miss makes nothing else and is worth less than a success.
- A try never loses value on average: at the recipe's own level and before luck, the chance of a success times the value of the outputs, plus the chance of a miss times what a miss keeps, reaches the value of the inputs. A recipe that loses value would make crafting worth less than selling its materials. The fix is more time or fewer inputs; see [A recipe](#a-recipe).
- A tool is of class `tool` and has the tier of its `tool`; only a tool is of class `tool`, and a `meal` is always food. A class means the same thing in every recipe that asks for it.
- A worn piece fits its place: a garment on the head, top, legs, outfit or feet, jewelry in a jewelry place, a tool in the hand. It names each effect once. A set belongs to one creator, has two pieces or more and fits on the character at once, because a set that cannot be worn whole promises a bonus nobody gets.
- A camp part's tier is open (1 to 3 today). An upgrade stands in the slot of the part it replaces, provides the same station, keeps at least its tier and its bag bonus, and the upgrades never go round in a circle: building up never takes away what you had.
- A recipe never asks for a level its profession does not reach.
- A `find` step names an item that is found, not farmed: one that only digging gives, or that exactly one timed plant (a resource with `hours`) gives, never made or sold. It carries a clue; the journal shows the clue, not a count. With a giver, the hand-in takes one; with no giver, the step counts once the item has been in the bag, so a later step may use it up. A `riddle` step cites map props by id and names its answer, a dig spot or a place by day or by night; an id that is not on the map is refused. `templates/extension/quests/` has a find.
- A dig spot may leave out `tool`: its find is then picked up by hand, with no minigame and nothing worn. A restore may have no `inputs`: it then never opens by hand, and a quest opens it as its reward (`reward.opens`, a place reward, up to two restores). The check refuses an `opens` that names no restore, and a restore with no inputs that no quest opens.
- No reward repeats a kit. A quest's reward item that a starter's kit already holds names `instead`: an item that kit lacks, which a character of that start gets in its place. The check refuses a reward item a kit holds with no `instead`, and an `instead` that the same kit holds too.
- Your change may not move the value of anything that already exists by more than 10%. If it has to, a core maintainer re-anchors the values.
- Every sprite exists, has the right size and uses the core palette.

## AI tools

Using them is fine, and so is saying so. List every tool you used for the file or its art in `ai_tools`. The game credits them on the sign and in Menu > Credits.

## Your AI tool and the project

The repository carries an MCP server: nine tools your AI tool can ask while you build. They answer from your checkout, write nothing, need no token and never talk to GitHub. Claude Code and Cursor find it on their own through `.mcp.json` and `.cursor/mcp.json` once you open the folder. For a tool that does not read those files, add it once from the checkout:

```sh
claude mcp add openfold -- pnpm -s mcp
```

Codex reads TOML, in `~/.codex/config.toml`; start Codex from the checkout:

```toml
[mcp_servers.openfold]
command = "pnpm"
args = ["-s", "mcp"]
```

What the tools answer:

- `schema`: the JSON schema of one record type, or the list of types.
- `check`: the same check CI runs, on the whole checkout or on your files only.
- `slots`: every slot of the map, filled or waiting for a creator.
- `requests`: what players asked for, with their support and the open calls.
- `template`: a starting file for one record type, with your handle and name filled in. It is returned, not written.
- `value`: the value the game computes for your draft files, against the anchored values and the drift budget.
- `preview`: the state of one proposal: its preview link, the merge checklist, approvals and competitors.
- `guide`: this guide, with its sections.
- `rules`: the numbers the loop and the boards run on, the licence, and the lines the project never crosses.

## License

Content you contribute is published under CC BY-SA 4.0 (see `content/LICENSE`), and code under the AGPL-3.0. Opening a pull request means you agree to that.
