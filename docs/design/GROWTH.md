# The growth frame: schools, nodes, slots, keys and a build, and the two screens (2026-10-20)

**Status:** Frame and skill screen answered 20.10, superseded in part since: six attributes, might for carry and spirit new (decision 45 of 22.10); the race as the trunk with its wings (decision 38 of 22.10); the tree as data and its screen (DECISIONS 23.10 and 25.10). Where this page and those entries differ, the entries hold.

A frame and a format page, not a content page. The owner's direction of 19.10 (DECISIONS 2026-10-19 "Six open ends", answer 5) is "something more like The Witcher or Drakantos": schools or branches, a limited number of active slots, a build a player equips and changes, techniques that combine; and "I do not know what will actually be in it, the world is still too thin", so the content waits for the combat frame and the first ring. This page writes what a school, a node, a slot, a key, a technique, a book and a build are, how they are stored and checked, and what combat, travel, the work verbs and the story read from them, so that the content can be written when the world is thick enough and the screen can be built after the owner picks its frame. The combat frame fixed one thing first (DECISIONS 2026-10-20 "Combat, round 5"): a fight reads the build's active slots, the five attributes as small keys and the thing in hand, so the technique's format is settled here before any foe is written.

Design only. Nothing here is built: no schema, kernel, content, parameter or screen changes with it. Everything marked **proposed** is a builder's shape or a reading of the owner's word, not his word. Two screens are in it: the skill screen, which goes to him as a ladder of three stills in this pull request (section 6), and the crafting workshop screen, whose ladder is specified and not made (section 7).

## 1. The frame in one paragraph

A character grows in **schools**: each trade is a school (foraging, woodcraft, digging, cooking, handcraft), the starter's nature is the trunk they grow from, and combat schools are reserved for when the frame of COMBAT.md is built. A school is a few **nodes** on short paths: a small node moves a number, a major node changes a verb or teaches a **technique**, and a corner node belongs to one starter and one school, so a forager who digs grows differently from a digger who digs. A node is bought with a skill point by choice, never handed out by level; a **key** is an attribute threshold on a node, so the five attributes stay and stay small. A technique works only in an **active slot**, of which a player has a few, more by level; the techniques in the slots are the **build**, equipped and changed freely at any safe place and nowhere else. Two techniques combine when one opens the other's window. A **book** found in the world teaches one node outside the player's schools, never sold. Nothing reads the character level but the caps, and the check refuses a tree whose value sits in one school.

## 2. What was decided before this page

| Decided | Where | What it fixes here |
|---|---|---|
| The direction: schools or branches, a limited number of active slots, a build a player equips and changes, techniques that combine; not the five attributes as built and not skills to 99 by doing; content after the combat frame and the first ring; the screen as stills first | DECISIONS 2026-10-19 "Six open ends", answer 5 | Sections 1, 3, 4, 6 |
| The skill screen as built is generic: five attributes of ten pips and two fixed techniques per profession make no tree; the five attributes may stay as keys | DECISIONS 2026-10-19 ❌ "The skill screen as built is generic" | Keys (section 3.4); the screen is replaced, not patched |
| A fight reads the build's active slots as its techniques, the five attributes as small keys (stamina the breath, agility the dodge and the stagger, senses how early a wind-up shows, luck the drop's draw, carry nothing) and the thing in hand; the technique's format comes first | DECISIONS 2026-10-20 "Combat, round 5"; COMBAT.md 4.3 | Section 3.5, the technique's format; section 5.1 |
| Walking is the base; every faster way is earned by level, "a branch of a skill" among them, none bought, none free of the world's danger by distance; a proposal names its level and its cost | W9 (WORLD_STRUCTURE section 9) | Section 5.2 |
| Rate and reach are capped by level, never by payment; the power cap holds every rate | F13; kernel-review R9; `power_cap_permille` | Every node's value is priced and capped (section 4.4) |
| Power is never sold; a look with no effect is the only premium thing | G39 | No node, technique or book in a shop |
| Worn things help work a little; the tool in hand | G44; CR-12 | The hand slot is the weapon's place (COMBAT 4.3), not a node |
| A choice is real; felt within a minute; a build changes play | G12, G11, G10 | A node that only adds a percentage is small and cheap; a major node is felt the first time its verb runs |
| Crafting is a road, not the road; a recipe's level is no wall; the screen never shows a chance or a level a recipe wants | G38, G40, CR-17 | The workshop screen keeps the kernel's own refusal line (section 7) |
| The world shows its values; the player's own things keep their counts | G77 proposed; F29 | The skill screen may show the player's level, points, pips and slots; never a chance or a rate as a world number |
| The lean opens doors, never closes them: past a threshold a belief's own people, places and quests open; `lean {belief, min}` in a `requires` | DECISIONS 2026-10-19 "Six open ends", answer 4; STORY section 4 | A school's door may be a lean (section 5.3) |
| A tree on two axes, the starter's nature against the trades, corner nodes per pair; major nodes change a verb; small nodes carry the percentages; attributes become keys; books teach nodes outside one's wings; points trained at the camp's fire or by Maru; combat wings reserved; checks against convergence; the kernel stays the judge | GAP_DIMRAETH_DRAKANTOS section 4, proposed on 19.10 | Taken as the frame, with the owner's direction on top (slots, a build, combining) |
| Races later, perhaps by other developers, as the vertical axis of the tree | DECISIONS 2026-10-19 ⏸ "Races to widen the starters" | The trunk is the starter's nature today; a race would be a second trunk later (section 3.1) |
| Pets with a skill each: a stage-3 candidate that waits on the tree's format; gear slots, salvage and sets with combat | GAP section 9 | Out of this page; the format leaves them a place (section 8) |
| The threat telegraph and senses: a predator's cone shown for a beat when it turns | NEXT 12 c; GAP section 4 | The example of a senses key opening a major node |
| The techniques as built: `{level, name, effect, value, text}` per profession, effect from a closed list the kernel applies, at most ten | `ProfessionBody.techniques` and `EFFECTS` in `schema/src/index.ts`; `effectValue` in the kernel | The small node keeps this shape; the technique gains the combat fields (section 4.2) |
| Skill points: one per character level, spent on attributes; the character level is the sum of the profession levels | `skillPoints`, `characterLevel` in `kernel/src/state.ts`; the `spend` action | The same point buys a node or a key (section 3.6) |

## 3. The pieces

### 3.1 A school

A school is a named wing of growth with a short list of nodes on paths. The five trades are five schools, each tied to its profession (the profession keeps its levels and its experience; the school is what the points buy). The **trunk** is the starter's nature: the forager, the digger, the explorer, each with its own few nodes, and its corner node in each school. Combat schools are reserved by name and shape, not written (COMBAT.md section 6: the first foes come after the technique format). A school is core content (`CORE_ONLY_TYPES`), as professions are, until the creators' reach opens it (CRAFTING_AUDIT D-CRAFT-4); a creator may propose a book that teaches an existing node, and later a node, never a school.

A school may have a **door**: a lean threshold (section 5.3) or a quest. A door opens the school's nodes to a player and never shuts on what is learned.

### 3.2 A node

Three sizes, as the gap study read them in Dimraeth:
- **Small:** moves one number of a closed list (today's effects: gather, dig or craft speed, the timing window, the rare find, the meal's fill, a second hint). Cheap, one point, always on once learned, no slot. Several in a school.
- **Major:** changes a verb or teaches a technique. The examples of 19.10 are the kind, for the stills only: digging shows how deep the find lies; a tree falls the way you face, and across a stream it is a bridge; ripe plants glow after dark; a predator's eyes show their cone for a beat when it turns; a meal cooked at the camp keeps through a night. Two points. A major node that teaches a technique needs a slot for the technique to work (3.3); a major node that changes a verb is always on.
- **Corner:** the node where the trunk meets a school, one per starter and school, three points, a technique of its own (the forager who digs reads roots; the digger who forages finds the buried stem). It is the reason two players of the same school differ.

A node has prerequisites (`needs`: the nodes before it on the path), keys (3.4), a cost in points, and a size. A node is learned at a safe place (a fire, a camp or a town) by a `learn_node` action; a learned node can be **unlearned** at the same places (section 3.6) and its points come back. Dimraeth's rule holds: the tree can be redone, the attributes cannot.

### 3.3 A slot and a build

A player has `growth.slots_by_level` active slots (proposed: 2 at level 1, 3 at 5, 4 at 10, 5 at 15). A technique works only while it sits in a slot; the techniques in the slots are the build. The build is changed by `equip` and `unequip` at any safe place, free and at once, and nowhere else: never inside a fight, never while busy, never in the wild. The slots are what makes a build a choice (G12): a player who has learned eight techniques carries four, and the two that combine are worth carrying together. The check keeps the slots enough for what a player earns (section 4.5), against Dimraeth's fault.

### 3.4 A key

The five attributes stay: carry, senses, agility, luck, stamina. They stay small: `growth.key_max` pips each (proposed 5, down from 10), bought with the same points, never unlearned. They keep their small numbers (`per_point`: carry 10 places, senses 2 tiles, agility 25% of the window, luck 100 permille of the miss kept, stamina 20 food), and they gain their combat readings (COMBAT 4.3: stamina the breath, agility the dodge and the stagger, senses the wind-up's lead, luck the drop, carry nothing). What is new is that a node may ask for a threshold: "Depth sense needs senses 3". So a pip opens a door and a player who never trained senses finds a strong book and cannot read it yet (Dimraeth's rule, kept). A key never asks for more than a player of the node's level could have (section 4.5).

### 3.5 A technique

The thing a major or corner node teaches, and the thing a slot holds. One format for work and for combat, so that a fight reads the slots without a second list (combat round 5):

- Work technique: an effect from the closed list and a value (as `ProfessionBody.techniques` has today), or a verb change named as an effect the kernel knows (`see_ripe` exists; `fell_facing`, `dig_depth`, `meal_keeps`, `cone_beat`, `walk_step_pct` would join it, core-only).
- Combat technique: the same record with the fight's fields, from COMBAT.md 4.3: a breath cost, a wind-up in ms, a cooldown in ms, a reach, an effect from a closed combat list (reserved names, not written: `strike`, `sweep`, `break_guard`, `step_through`, `mark`, `brace`, `second_wind`, `bleed`), a value, and `after`.
- **`after`:** the id of a technique that opens this one's window: for `window_ms` after that technique lands, this one costs less breath or lands harder (its `value` applies only inside the window). That is "techniques that combine" in one field, readable by the check and by the screen (the slot shows which neighbour it follows). A chain is at most two long; the check refuses a cycle.

A technique is priced by its value like a worn thing (R9) and sits under the power cap of the player's level with everything else the player wears and has learned; the cap is the one place the character level is read.

### 3.6 Points, learning, unlearning

One currency, as today: a skill point per character level (`skillPoints`), the character level the sum of the profession levels. A point buys a small node (1), a major node (2), a corner node (3) or an attribute pip (1). The professions keep their twenty levels and their experience by doing (`xp_levels`); there are no skills to 99, by the owner's word. A node is unlearned at a safe place for free the first `growth.respec_free` times (proposed 3) and for `growth.respec_mg` gold after (proposed 20,000 mg, a sink in the table of open end 6); a pip is never unlearned. A character at level 20 in two trades has about forty points: enough for one school whole and a second half, never the tree.

### 3.7 A book

An item with `book: { node }`: reading it (`learn`, the action fragments already use) teaches that one node at once, outside the player's schools and off any path, without its prerequisites but with its keys and for no points. Books come from `find` and `riddle` steps, treasure tables and quest rewards, never a shop (G39, G41); a creator may add one as data. A book is how a hybrid is made, and a second book for the same node is read as nothing (the kernel refuses with "You know this already."). The rarity budget prices a book like any find.

## 4. The format, so a builder can build

Every name is proposed. Additive; `FORMAT_VERSION` unchanged; integer math (R1).

### 4.1 Content: `school`

```json
{
  "type": "school", "id": "core/digging", "title": "Digging",
  "profession": "core/digging",
  "door": null,
  "nodes": [
    { "id": "steady", "size": "small", "cost": 1, "needs": [], "key": {},
      "effect": "timing_window_pct", "value": 10, "text": "The dig game's good zone is a little wider." },
    { "id": "depth-sense", "size": "major", "cost": 2, "needs": ["steady"], "key": { "senses": 3 },
      "technique": "core/depth-sense" },
    { "id": "roots", "size": "corner", "cost": 3, "needs": ["depth-sense"], "key": {}, "starter": "forager",
      "technique": "core/root-reader" }
  ]
}
```

The trunk is a school with `"trunk": "forager"` in place of `profession`. `door` is `{ "lean": { "belief", "min" } }` or `{ "quest" }` or `null`. At most `growth.nodes_max` nodes per school (proposed 12) and `growth.majors_min` majors (proposed 3).

### 4.2 Content: `technique`

```text
{
  "type": "technique", "id": "core/depth-sense", "name": "Depth sense", "kind": "work",
  "effect": "dig_depth", "value": 1, "text": "The dig game shows how deep the find lies."
}
{
  "type": "technique", "id": "core/break-guard", "name": "Shoulder", "kind": "combat",
  "effect": "break_guard", "value": 50, "breath": 20, "windup_ms": 500, "cooldown_ms": 3000, "reach": 1,
  "after": "core/feint", "window_ms": 800, "text": "After a feint, a shoulder opens a guard."
}
```

`kind: work` takes `effect` from `EFFECTS` (today's list, grown core-only by the verb changes above); `kind: combat` takes it from the reserved combat list and must carry `breath`, `windup_ms` (200 to 1000, the telegraph rule of COMBAT 4.9), `cooldown_ms` and `reach`. `after` and `window_ms` are optional on both kinds (a work pair: a meal cooked right after felling fills more). The `techniques` array on `ProfessionBody` is retired when the schools land: its two fixed techniques per profession become nodes.

### 4.3 State and actions

On `Player`, additive and `null` or empty in saves from before:
- `nodes: Id[]` the learned nodes (as `school/node`); `books: Id[]` the nodes taught by a book (so a respec never refunds a book);
- `build: Id[]` the techniques in the slots, in slot order; `respecs: number`.
- `attrs` stays; `spent` stays and counts nodes too.

Actions: `{ kind: 'learn_node', node, at }` (a safe place; the point cost; `needs` learned or the node taught by a book; every key met), `{ kind: 'unlearn', node, at }` (a safe place; nothing learned depends on it; free or the gold; the build drops the technique), `{ kind: 'equip', technique, slot, at }` and `{ kind: 'unequip', slot, at }` (a safe place; the technique learned; the slot open at the level; not engaged, not busy), `spend` as today for a pip up to `key_max`, `learn` extended to books. Events: `node`, `unlearn`, `equip`, `unequip`, `book`. `effectValue` reads the build's techniques and the learned small nodes in place of the profession's `techniques`.

### 4.4 Parameters

A `growth` group in `content/core/params.json`, each with a range and a step:

| Name | Value | Holds |
|---|---|---|
| `slots_by_level` | [1: 2, 5: 3, 10: 4, 15: 5] | the active slots |
| `key_max` | 5 (3 to 10) | pips per attribute |
| `cost` | small 1, major 2, corner 3 | points per node |
| `respec_free`, `respec_mg` | 3, 20000 | unlearning |
| `nodes_max`, `majors_min` | 12, 3 | a school's size |
| `school_value_max_permille` | 400 | the share of the tree's priced value one school may hold |
| `slot_slack` | 2 | techniques learnable at a level, at most this many times the slots at that level |
| `combo_max` | 2 | the longest `after` chain |

`per_point` stays as it is; `wear_effect_max_pct` and `power_cap_permille` cap the technique's value as they cap a worn piece.

### 4.5 What the check enforces

`pnpm check` gains rows: every node's effect is in the closed list and its value in range; every `needs` names a node of the same school and makes no cycle; every key is at most `key_max` and at most the pips a player at the node's band could have bought (the band from the school's profession levels of the nodes before it); a corner node names a starter and each starter has one in each school; a technique's `after` names a technique and chains no longer than `combo_max`; a combat technique carries the fight's fields in range; a school has at most `nodes_max` nodes and at least `majors_min` majors, spread over the climb (at least one major in each third of the school's path, against "the key pieces arrive by level 13 of 25"); a book's node exists and no shop sells a book. `pnpm values` gains two: the priced value of each school is at most `school_value_max_permille` of the whole (against "most of the strong nodes sit in one quadrant"), and at every level the techniques a player could have learned are at most `slot_slack` times the slots open at that level (against "five active slots run out"). The review checklist (GAME_RULES section 7) gains one question: "Does this node open something to do, or only move a number, and is it priced as the smaller of the two?"

## 5. What the other systems read from the frame

### 5.1 Combat

The owner's word of 20.10 (round 5): the build's active slots are the fight's techniques, with the technique format of 3.5; the five attributes read as small keys (stamina the breath cap, agility the dodge window and the stagger, senses the wind-up's lead, luck the drop's draw, carry nothing); the thing in the hand slot sets the strike's reach and harm (G44), under the one power cap. Nothing in a fight reads the character level. The combat schools are the wings the gap study reserved; their first nodes are written with the first foes (COMBAT section 6), not before.

### 5.2 Travel

W9 names "a branch of a skill" among the legitimate faster ways. In this format a faster way is a major node whose effect is `walk_step_pct` (a shorter step on a kind of ground: a forager's trail through grass, a digger's footing on scree) or a technique with a place (a woodcraft node that makes a felled tree a bridge across a stream, already in the 19.10 examples). Each names the level it is earned at through its school's band and what it costs to use (breath, a tool's wear); none is bought (G39); the check holds that no node lets a level-one character cross the far rings (W9, G64): a `walk_step_pct` node sits past the first third of its school. A mount or a teleport is content under W10, not a node of a trade.

### 5.3 The story: the lean as a door

The lean opens doors and never closes them (open end 4). A school, or a node in one, may carry `door: { lean: { belief, min } }`: past the threshold, a belief's own craft opens to the one who leaned its way (the Wakers' lantern-craft, the Keepers' way of leaving a find in the ground that pays back later), with the worn mark and the title the 19.10 answer gives. A lean walked back shuts the door to further nodes and unlearns nothing; the other beliefs' schools stay open. No school is closed by a lean; the door only opens.

### 5.4 The work verbs and the economy

A major node changes what a verb does, inside the kernel's closed effects, so a creator's content never reads a node: the kernel applies `fell_facing` when a tree falls, `dig_depth` when the dig game is drawn, `see_ripe` when the plant is lit. A node never changes a recipe's output (R9: rates of work, never the output of a craft) and never a price; the sinks it adds are the respec's gold and nothing else. Every rate a node moves stays under the power cap with the worn things, so the trader's day cap and Theorem 3 of the kernel review hold as they do.

### 5.5 The starters

The ❌ of 19.10 faulted starters that differ by two pips. Here the trunk and the corner nodes carry the difference: the forager's trunk, the forager's corner in each school, and the forager's start of senses 2 and luck 2 as keys already met. The explorer, the forager and the digger of today keep their kits and their first tasks; what grows from them is different by construction.

## 6. The skill screen: a ladder of three stills

The screen is a UI frame, so it is a direction decision: two or three phone-size stills, each testing one named difference, the owner picks, the pick is recorded in DECISIONS with its frame (AGENTS.md). The three stills are in `docs/design/frames/` with their note, [2026-10-20-skill-screen.md](frames/2026-10-20-skill-screen.md); each is 390x844 at 3x (1170x2532), the phone frame of the 20.10 art ladder. They are mockups in the game's UI font and the 32 core colours, not the game: no screen code changed. The content is the same in all three (one forager at level 7 with two points to spend, the five schools and the trunk, the same learned nodes, three open slots of five, the same keys) so that the difference is the frame alone:

| Still | Tests | What the eye should find |
|---|---|---|
| `2026-10-20-skill-S1-wings.png` | **The picture:** the whole growth as one picture, the trunk in the centre and five wings around it, the corner nodes where a wing meets the trunk; the build as a strip at the foot | Where I am, where I could go, and what I am that another forager is not, in one look; Dimraeth's "the shape is the character" |
| `2026-10-20-skill-S2-schools.png` | **The list:** the schools as cards, one open at a time with its path in a row, the next node and its key named; the build as a strip at the foot | One school at a time, nothing cramped, a phone's own shape; the whole is read by scrolling, never seen |
| `2026-10-20-skill-S3-board.png` | **The build:** the slots first as a board with the equipped techniques and which one follows which; the learned techniques as a shelf under it, the keys as tokens; the schools behind one button | The build is the thing a player changes most, so it comes first; The Witcher's character panel; the tree is a second screen |

Recommended: S1, the wings, with the strip at the foot, because it answers the owner's fault of 19.10 ("it is not clear what the differences are") in one look, and a build is still one tap away; S3 if he wants the build to be the first thing seen. **The owner picked S1, the wings (20.10; DECISIONS 2026-10-20 "The skill screen is a tree of wings")**: the whole growth as one picture, the trunk in the centre, the wings around it, the touched node's card under the picture and the build as a strip at the foot. The frame is `2026-10-20-skill-S1-wings.png`; what is inside it (the node shapes, the colours, the card's wording, the strip's layout) is polish, iterated without asking. The pick replaces the journal's Skills tab (`skillsTab` in `game/src/ui/panels.ts`) when the screen is built in stage 3 (GAP section 9), after the format of section 4 lands, never before.

## 7. The crafting workshop screen: the owner's word, and its own ladder

The owner's word of 19.10, recorded in this pull request (DECISIONS 2026-10-20 ❌ "The crafting workshop screen as built is a hosted list"): the workshop screen is "a hosted list", uncomfortable and ugly, and it is rebuilt only after a stills ladder of its own. What is built is the station panel (`game/src/ui/panels.ts`, the station function): a row per known recipe with the output's sprite, the title, the needs as item names with counts, a class-and-seconds line, the gate line (the kernel's own refusal, never a level, CR-17) and a Make button; the upgrades as cards under the rows; one muted line at the end. A list that hosts rows, which is what he saw.

The ladder, specified here and made before any rebuild, the same way as section 6 (three stills, 390x844 at 3x, one difference each, the same content in all three: the workbench at tier 2, the handcraft recipes of the stone and reed chains, the same bag, the same gate on one recipe):

| Still | Tests | What the eye should find |
|---|---|---|
| `W1 the bench` | **The thing:** the recipes drawn as things lying on the drawn bench (a hat, sandals, a cord, a stone), the bench itself showing its tier; a tap lifts a thing and its needs show in the hand; the gate is the thing greyed on the bench | A workshop, not a form; what can be made is seen before it is read |
| `W2 the chain` | **The chain:** the station's recipes as a ladder of tiers left to right, each output drawn where it feeds the next recipe (G43: a long recipe is a chain of short steps), the gate a locked rung | What I am making this for; the climb is the screen |
| `W3 the card` | **The card:** the rows kept as cards with the output drawn large and grouped by class, the needs as sprites with counts, the gate as one line in words, the whole card the button | The least change; a list that no longer reads as one |

Common to all three, by the rules: no chance and no level shown (G40, CR-17); the kernel's refusal line as the only gate text; the upgrade (the next bench) as one more thing on the bench, rung or card; text at 16 px or more (G29); the 32 colours and the outline (STYLE.md). Nothing is built from this section; the stills are a later pull request, after the first ring's recipes exist, and the pick goes to DECISIONS with its frame.

## 8. Rule lines proposed, in the form GAME_RULES uses

Numbers provisional (G87 onward, after G86 of COMBAT.md); the rules pull request assigns them.

- **G87 Growth is a build, not a sum.** A character grows in schools of nodes bought by choice with the points of the character level, never handed out by level; a technique works only in an active slot, of which a player has a few, more by level; the techniques in the slots are the build, changed freely at any safe place and nowhere else. The professions keep their twenty levels by doing; nothing climbs to 99 (the owner, 19.10).
- **G88 A major node changes a verb; a small node moves a number.** A small node moves one number of the closed list and is always on; a major node changes what a verb does or teaches a technique; a corner node belongs to one starter and one school. Every effect is one the kernel applies; no node changes a recipe's output or a price (R9).
- **G89 Keys open doors; the level only caps.** The five attributes stay small and are keys: a node may ask for a threshold, a pip is never unlearned, and nothing but the power cap reads the character level. A key never asks for more than a player of the node's band could have.
- **G90 A book teaches one node across the schools, and no shop sells one.** A book is found, dug, riddled or earned; it teaches its node without the path and for no points, with its keys; a second copy teaches nothing.
- **G91 Techniques combine by a window, two long.** A technique may follow one other: inside the window after that one lands, it costs less or lands harder. A chain is at most two; the check refuses a cycle.
- **G92 No school holds the tree.** The check refuses a tree where one school holds more than its share of the priced value, a school whose majors sit in one third of its climb, or a level at which a player could have learned more techniques than the slots allow by more than the slack (the faults Dimraeth's players name).

## 9. The order, and what this page does not do

- Now: this page; the owner's pick of the skill screen's still (section 6), recorded in DECISIONS.
- Stage 3 (GAP section 9, "the skill tree"): the format of section 4 (schema and kernel, M), then the screen in the picked frame (M), replacing the Skills tab; the five attributes become keys in the same step; the two fixed techniques per profession become nodes.
- After the combat frame's first foes and the first ring: the content (the five schools' nodes, the trunks, the books); the combat schools with the foes; the workshop screen's ladder once the first ring's recipes exist (section 7).
- Not done here: any node, school, technique or book beyond the examples for the stills; the slot count and every number (ranges set, tuning in play); pets with a skill each and gear sets (GAP section 9; the format leaves them a slot kind and a worn kind); races as a second trunk; the search box of Dimraeth's tree (a phone screen with twelve nodes a school needs none).
- Pages this frame touches when its rules pull request lands: GAME_RULES G44 (the hand as the strike), the GAP study's section 4 (pointed here), FOUNDATIONS F26 (the tree's frame, answered by the pick), W9's line on "a branch of a skill" (pointed at 5.2), COMBAT.md 4.3's `tech` verb (the format of 3.5), CRAFTING_AUDIT's techniques rows (retired into nodes).

## Sources

- The Witcher 3 (CD Projekt Red, 2015): four skill groups, ability slots that grow with level, mutagens that make neighbours combine; the build is the character panel.
- Dimraeth (2025): the tree of wings, three node sizes, attributes as keys, books that teach across the class, free respec at first (GAP_DIMRAETH_DRAKANTOS section 4 and its sources).
- Drakantos (2025): heroes with a few active abilities each, swapped in town.
- Path of Exile (Grinding Gear Games, 2013): the passive tree as one picture, and its cost on a small screen (the reason the ladder tests a list and a board too).
- Old School RuneScape: skills to 99 by doing, the model the owner set aside for the tree while the professions keep it.
