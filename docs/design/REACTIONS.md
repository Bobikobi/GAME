# World reactions: a world that answers by rules

Status: a design for the owner, written 19.10.2026 by game-1b. Nothing here is built. On 19.10 the owner approved planning "a table of reactions" as the logic step toward a richer world: things carry tags, rows in content connect them, and the kernel judges. Everything below is a proposal until he picks. Section 9 lists the two questions that are his to answer, because each would bend a rule on his page.

Facts are read from `origin/develop` @ 2932f334.

## 1. Why rules, and why now

The world has no end (DECISIONS 2026-10-17). A thing placed by hand makes one screen richer. A rule works on every screen, the generated ones included, and it costs nothing more as the world grows. Openfold has to be rich in a world nobody can fill by hand, so this is the logic step that most closes the distance to Dimraeth's depth.

Three games show the method:
- **Breath of the Wild** calls it a "chemistry engine", in Nintendo's GDC 2017 talk. Elements change materials, elements change each other, and materials do not change each other. A few rules give thousands of situations the designers never placed.
- **Stardew Valley** keys forage, fish and crops to season, weather and hour as data. The next day's weather is decided ahead and shown on the TV, so a player can plan on it.
- **Dwarf Fortress** keeps its reactions in plain-text data files that players mod. The community grows the rules, not only the content.

Openfold takes all three: rules as data, keyed on tags, grown by the community through the loop.

**Why before the first ring (NEXT 19).** The generator writes tile tags. If reactions key on those tags (`meadow`, `riverbank`, `grove`), every generated chunk reacts from the day it exists, with nothing placed. If the ring is built first, its richness has to be placed by hand and later replaced.

## 2. The one design choice: a reaction is read, never run

The kernel has no world loop. R1 says step "touches only the acting player and the entities the action names", and state stores absolute ticks, never countdowns. What looks like time passing is computed when it is asked for:
- a predator stands where the clock puts it (`predatorAt`, kernel/src/danger.ts);
- a fire burns until a stored tick (`fireBurns`);
- health is a stored value minus a drain since a tick (`satietyAt`).

A reaction follows the same pattern. It is a pure function of:
- the content;
- the state of the one entity it hangs on;
- the tick;
- the seed.

Its answer is what is true at that place now. Nothing is written to a neighbour, and nothing runs while nobody looks.

What follows from that choice:
- **R1 holds unchanged.** An action still writes only the player and the entities it names.
- **An endless world costs nothing off screen.** Only what is asked about is computed: what the client shows, and what an action names.
- **The server replays it for free.** The same function gives the same answer for the same tick and seed (#187).
- **G28 holds by construction.** Game ticks advance only while the player plays, so no reaction runs while they are away.

**Where we differ from Breath of the Wild, and the cost.** BotW simulates in real time, inside a radius around the player. A grass fire there spreads by itself, tile after tile. A reaction here cannot set off another reaction that writes, so in the first phases nothing spreads by itself. A spread can still be read later: a front moving at a fixed pace from the tick and the tile where it was lit is a pure function too. Section 8 leaves it for later.

## 3. The vocabulary: tags, conditions and effects

Every list below is closed, in the schema. A creator combines the entries as data. A new condition or effect is code: it comes as a kernel pull request, or at stage 8 as a mechanic in code.

### 3.1 Tags: what a thing is

Most tags exist already:
- **Ground:** the 8 tile tags (grove, meadow, riverbank, ruin, town, water, path, interior; `TILE_TAGS` in schema/src/index.ts).
- **Items:** their class (plant, wood, fibre and the rest), and an extension's classes under them.
- **Nodes:** ready, or empty since a tick (`NodeState.readyAt`).
- **Time:** the hour and night (`hourOf`, `isNight`). Seasons are decided but not built (DECISIONS 2026-10-09), and weather is not built at all.

New tags come only with a phase that needs them (section 8). The names `wet`, `burning` and `chilled` are reserved now for weather and later for combat's status stacks, so the two meet on the same words (gap page, section 3).

### 3.2 Conditions: when a reaction holds

All conditions of a reaction must hold at once.

| Condition | Holds when | Reads |
|---|---|---|
| `hours: [a, b]` | the game hour is in [a, b), as nodes' `hours` already work | the tick |
| `night` | 20:00 to 05:00, as `isNight` | the tick |
| `ready_for_ms: n` | the node it hangs on has been ready, untouched, for at least n game ms | that node's `readyAt` |
| `empty_for_ms: n` | the node has been empty for at least n | that node's state |
| `on_tag: t` | the tile it hangs on carries tile tag t | the map |
| `player_within: r` | the player stands within r tiles, with r at most 8 | the player's tile |
| `unseen` | the hidden thing it hangs on lies beyond the player's sense reach (`senseReach`), so the find does not show yet | the player's senses |
| `player_doing: verb` | the player is busy with that verb | `busyUntil`, plus the verb the player is busy with (a new field in the player's state) |
| `player_has: node` | the player has that skill-tree node, once the tree exists (W3) | the player |

Phase B adds `weather: kind`.

### 3.3 Effects: what a reaction does

| Effect | What it does | Its guard |
|---|---|---|
| `appear` | A node that exists only while the condition holds, at the tile it hangs on or a neighbour. Its id is `<reaction id>@<parent id>`. It is a full resource in its own file, with an activity record, a level and a miss table. | V prices it like any node (R6, R7). It must come back whenever the condition holds again, so it is a gate and never a last chance (G42, G28). |
| `wait` | Scales the respawn of the node it hangs on, in permille, clamped to 500-2000. | Waiting is never paid (R6), so no V moves. |
| `cue` | Sends the client an event at a tile, with no change to the state: birds lift, fish rise, a glint. | Each cue has a shape and a sound, never colour alone, and reduced motion gets a still shape (G29). It never shows a number (CR-17). It never speaks: a cue has no text (STORY S1). |
| `open` / `close` | Makes a tile passable while the condition holds (a felled trunk across a stream), or blocked (a ford under high water). | In every combination of states, the map stays connected and G62 still holds. `close` never touches a path tile or a town tile. Phase C only. |
| `sight` | Changes how far a predator's eyes reach (fog), or the player's sense reach. | Bends G47, so it waits for the owner (section 9, Q1). |

What no effect may do:
- change the yield or the active time of an activity outside R9's one calculator;
- harm the player, since harm stays with the hazards (G35);
- make a fire burn longer or shorter (G48; Q2);
- act as gear against a hazard, which is the owner's 9.10 word "no stronger lantern";
- move a predator off the place its clock sets (G47).

## 4. The file

A reaction is one content file of a new type, `reaction`, under the creator's handle (`content/<handle>/reactions/`). It hangs on one kind of thing: a resource, or a tile tag.

Two examples for phase A:

```json
{
  "type": "reaction",
  "id": "core/windfall-berries",
  "title": "Windfall under a full bush",
  "creator": "core",
  "on": { "resource": "core/berry-bushes" },
  "when": { "ready_for_ms": 240000 },
  "then": { "appear": { "resource": "core/windfall", "at": "below" } }
}
```

A bush left full for four game minutes drops a few berries on the tile below it. Picking them is a quicker, smaller pick, a resource of its own (`core/windfall`) with its own V. When the bush is picked, it is no longer full, so the windfall stops coming until it is full again.

```json
{
  "type": "reaction",
  "id": "core/birds-over-a-find",
  "title": "Birds lift where something lies hidden",
  "creator": "core",
  "on": { "treasure": "*" },
  "when": { "player_within": 8, "unseen": true },
  "then": { "cue": "birds_lift", "spread": 2 }
}
```

When the player steps inside eight tiles of a hidden find they cannot see yet, birds lift from a tile drawn within two of it. This is a hint with no number in it. The birds mark the area, not the tile. Keen eyes (`senseReach`, 4 tiles at senses 1 and 6 at senses 2) still show the find itself first, so the explorer's edge stays.

The `on` field takes a resource id, a treasure id or `*`, or a tile tag (`{ "tag": "riverbank" }`). A tile-tag reaction is the kind that scales to the generated rings with no placement.

## 5. How the kernel and the client read it

- **On a step.** An action that names a derived node, such as `gather` on `core/windfall-berries@core/berry-bushes#2`, is accepted only if the reaction's condition holds at that tick. Otherwise it is refused in words ("Nothing has fallen here"). Once touched, the derived node keeps a `NodeState` like any node, under its own id, which R1 already covers.
- **Cues.** A cue changes no state, so the kernel never emits one. The client runs the shared function each time the player crosses into a tile, through a tile index (radius at most 8). A cue fires on the edge, from outside its radius to inside it, which needs only the player's previous and new tile and no memory.
- **In the client.** The same pure functions, shared as `world.ts` is today, run for the chunks in view. Their answers are cached until the state changes or the game minute turns.
- **Order (R3).** Reactions are walked in sorted id order.
- **When two effects meet**, a fixed rule combines them:
  - two `wait`s multiply, then clamp;
  - `close` wins over `open`, for safety;
  - each `appear` is its own node under its own id.
- **Depth 1.** A condition reads only base state, never another reaction's answer. A chain of two may come later, with a cycle check, if play asks for it.
- **Draws (R4).** A reaction that rolls (do fish rise at this dusk?) draws from `draw(seed, "<reaction id>@<parent id>", day index)`, so the same day gives the same answer on every replay.
- **Cost.** A reaction hangs on one entity, reads only a fixed set of fields, and reaches at most 8 tiles. Measured target: under 0.5 ms a frame for a phone screen of reactions.

## 6. The check in `pnpm check`

The check refuses:
- an unknown condition or effect, a radius above 8, or a condition that reads another reaction's answer;
- an `appear` whose resource fails the resource rules: V, level, miss table (G15), and pays (G62);
- an `appear` whose condition cannot hold again once it has held (G42: a gate, never a last chance);
- an `open` or `close` that disconnects the map in any combination of states, or a `close` on a path or a town tile;
- a cue with no shape or no sound (G29);
- a `sight` effect, until the owner answers Q1.

It also warns: game-ba's richness check (the "something reacts" count, 1 or more a screen) counts reaction tiles, so a creator sees which screens a new reaction makes richer.

## 7. Where it meets the other streams

- **The creatures (game-41, feat/creatures-react).** They are cosmetic now. In phase A, "birds lift over a hidden find" becomes the core `cue` reaction above, and "deer at the forest edge at dawn" can become a cosmetic appear on `grove` tiles by hours. The creature sprites and their animations stay game-41's.
- **The richness check (game-ba).** Its third count reads reaction tiles.
- **Schedules for Maru and Pell (R4, after W5).** Same pattern: where a character stands is a pure function of the hour. A reaction may read it ("the stall is open"), and a schedule never writes the world.
- **The open world (NEXT 19).** The generator writes tile tags, and tag reactions work on every chunk. A region file may add its own reactions as data.
- **The skill tree (W3).** Its major nodes "change a verb". Many of those are reactions gated by `player_has`: ripe plants glow after dark for a forager with that node, and a felled tree falls the way the player faces. The tree and the reactions share one vocabulary.
- **Combat (W2).** `wet`, `burning` and `chilled` are reserved as tags now. Dimraeth's status stacks are reactions of the fight.
- **Free movement (W7).** It gives the player a facing between tiles, which phase C's "the trunk falls the way you face" reads.

## 8. Phases, with their sizes and measures

| Phase | What it builds | Size | Measure that proves it |
|---|---|---|---|
| **A: read reactions** | The `reaction` type in the schema; the conditions `hours`, `night`, `ready_for_ms`, `empty_for_ms`, `on_tag`, `player_within`, `unseen`; the effects `appear`, `wait` and `cue`; the check of section 6; the shared client read with its cache. Core content: windfall berries, birds over a find, and fish rising at dusk on `riverbank` tiles. | Kernel and schema about 400-600 lines, the client about 200, plus tests | A replay of a recorded session gives the same state hash on the client and in a server-style run. The richness check's "reacts" share rises; the number is reported. Under 0.5 ms a frame for the reactions on a phone screen. `pnpm verify` green. |
| **B: weather by day** | `weather(day)` as a pure function of the seed, the region and the day index: clear, rain or fog, decided a day ahead and shown in the morning toast (Stardew's forecast). The condition `weather`. Core content: mushrooms after rain in the grove (`appear`), reeds regrowing faster by water in rain (`wait`). Fog draws as mist the player can see. | About 300 lines, plus art for rain and fog | The same day gives the same weather on every replay. Every rain-only node shares its class with an all-year one (the season rule of 9.10, applied to weather). |
| **C: marks the player leaves** | A felled tree falls the way the player faces, and across a stream it is a bridge until it rots back (`open`, after free movement). Tracks in mud after rain. | About 300 lines | The map stays connected in every combination of states (the check). An e2e crosses on a trunk. |
| **Later, by the owner's word** | Spread as a front (fire through dry grass in the player's own camp area only); predators that answer weather or noise (Q1). | Not sized | - |

Phase A lands after `pnpm streams` shows no other session on `kernel/src/step.ts` and schema/src/index.ts. The schema part goes first, as its own small pull request (PARALLEL.md). Phase A needs no art beyond game-41's birds, plus one fish and one windfall sprite.

## 9. The owner's two questions

Each of these bends a rule on the owner's page, so it is his (GAME_RULES section 6). The morning's proposal to him named both as examples, before they were checked against the rules.

**Q1. May a predator answer the world?** G47 says a predator's place is "set by the clock alone" and that it sees "a cone ahead of it". Two ideas bend it:
- (a) fog shortens its eyes on a foggy night;
- (b) noise, such as felling or running, turns its head toward the sound for a beat.

Recommended: (a) yes, from phase B. Fog is drawn, so the shorter cone is still a rule the eyes can read. (b) no, inside the demo: a head that turns on noise is a rule the player cannot learn by watching, which is what G47 protects. Revisit (b) with combat (W2), where reading a foe's attention is part of the fight.

**Q2. May weather touch a fire?** G48 says a fire is kept by hand and nothing makes it burn longer. Rain putting out an open fire would cut the other way, and would cost a vigil (`tend`) through no act of the player's. Recommended: no. Weather does not touch fires, and a lit fire is the player's one sure thing at night. A rain-out could come later for fires the player did not light, which would need a prop flag.

## Sources

- Hidemaro Fujibayashi, Satoru Takizawa and Takuhiro Dohta, "Breaking Conventions with The Legend of Zelda: Breath of the Wild", GDC 2017: the chemistry engine and its three rules.
- Stardew Valley Wiki, "Weather" and "Foraging": weather decided a day ahead and shown on the TV, and forage and fish by season, weather and hour.
- Dwarf Fortress Wiki, "Reaction" (raw files): reactions as moddable plain-text data.
- In this repository: kernel/src/state.ts, kernel/src/danger.ts, kernel/src/world.ts and kernel/src/values.ts at 2932f334; docs/kernel-review-v1.md (R1-R12); docs/design/GAME_RULES.md (G15, G28, G29, G35, G42, G47, G48, G62); docs/design/OPEN_WORLD.md (G51, G67); docs/design/GAP_DIMRAETH_DRAKANTOS.md (sections 3 and 4).
