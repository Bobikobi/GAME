# Weapons: the thing in the hand that reads in a fight (2026-10-31)

Status: Proposed 31.10 by an outside developer; revised 01.11 (no wear on a hand, ammunition with a tier, a head and a matrix, bonuses and traits on found weapons, signature techniques on a few named weapons, the matrix as a report, predators as foes once combat lands), each a proposal with its default and an owner question (section 17, questions 7 to 12). Nothing here is built; the build list in the appendix is what the wave's pull requests build, each on the owner's merge.

**What it does not change.** No weapon content lands before combat: G35 (no fight in the demo, and "nothing of a fight is built before the server and the presence relay", docs/design/GAME_RULES.md:405-406), G44 ("A weapon waits for combat (G35); then the thing in the hand slot is the strike, under the same power cap (G86)") and decision 42 (DECISIONS 2026-10-22 "Start outfit: three slot items over the bare body, no weapon"; "A weapon - the elf's bow included - is bought, made or found") stand as written. COMBAT 4.9's group "enters `params.json` with the fight's first kernel pull request" (docs/design/COMBAT.md:238), so no `combat` param and no fight function lands here. The experience audit ranks the first foe and the fight loop as next, not a must before an open-world launch (docs/design/EXPERIENCE_AUDIT.md:50, :124), and this page does not move it. The hunt's take tools wait for the take verb: "nothing on this page is built before the server (NEXT 18) and the creature schema" (docs/design/HUNTING.md:9), and no kernel step takes an animal yet (kernel/src/hunt.ts:2-3). What this wave builds is the grammar and three guards: the `weapon` block in the schema with a check row that refuses it, the derived category, a shop row and a found-recipe row (appendix). No item bought or made answers a hazard (G34; DECISIONS 2026-10-10 "A hazard is escaped, never answered by an item; road thieves wait for weapons"). Power is never sold (G39). The hand rule is EQUIPMENT section 4, taken as it is: this page gives it numbers, never a second rule. COMBAT 4.9's tempo, reach, breath and noise rows are quoted, not moved; the rows this page asks to amend are named in section 15. Tools keep working from the bag (`bestTool`, kernel/src/step.ts:1737-1746). Metal waits for its discovery (G45; DECISIONS 2026-10-09 "Metal: the grammar is ready, the content waits for its discovery"), and the world stays at `open_tiers` 3 (content/core/params.json:88). HUNTING section 10's rating rules hold for every take a weapon makes.

## 1. The hand: two blocks, two readers

EQUIPMENT section 4, restated so a builder does not need to open it:

1. An item with only a `tool` block, held in a fight, strikes as bare hands.
2. An item with only a `weapon` block works no node.
3. An item carries both blocks only when its recipe is named for it, and then it carries the `dual_use` mark; the check caps such items at a small count.
4. A swap of the hand never skips the swing in progress (COMBAT 4.9, "one cooldown for the hand").

What the code holds today, and what the rule adds on top of it:

| Fact | Where | What this page does with it |
|---|---|---|
| A tool is read from the bag, the best tier of its kind, never from `worn.hand` | kernel/src/step.ts:1737-1746 (`bestTool`), :1748-1752 (`requireTool`) | Kept for every tool. A weapon is the first block read from the hand (with combat): a weapon in the bag does nothing in a fight, while a tool in the bag still works its node. |
| The hand holds only an item of kind `tool`; a look is refused in the hand | tools/src/check.ts:499-500; :514 ("the hand holds a working tool, not a look"); GAME_RULES section 8, G44 row ("the hand for anything but a tool") | Unchanged. The hand row reads only the item's kind (:500), never its blocks. Every weapon class is a content class under the base class `tool` (section 2), so a weapon is an item of kind `tool` and passes :500 as built, and :514 already keeps looks out. No amendment to the hand row. One built row reads the block, not the kind: an item of kind `tool` with no `tool` block is refused (tools/src/assemble.ts:534), so the schema field's pull request lets a `weapon` block stand in its place there, and the "weapon waits for combat" row refuses that item instead (appendix). |
| Held today: the walking staff, the work hammer, the rust pick, each with one worn effect | content/core/items/tools.json:59-80 (walking staff); content/core/items/outfits.json:31-53 (work hammer), :125-147 (rust pick) | Unchanged. Each is a `tool`; in a fight each strikes as bare hands (owner question 3). |
| The axe has no `wear` block, so it cannot be held at all | content/core/items/tools.json:43; kernel/src/step.ts:1366-1390 (`wear` refuses an item with no `wear`) | Unchanged. DECISIONS 2026-10-23 "The owner's answers on the bag" recorded for the combat wave "an axe fights, but weakly". How weakly is asked, not read: owner question 3. |
| No belt slot: the "belt" is a place rebate, one tool with no place | kernel/src/state.ts:51 (`WEAR_SLOTS`, 9, no belt), :399-428 (`placesWith`) | Nothing swaps "from the belt"; a swap takes the weapon from the bag. |
| "in a fight the tools swap by themselves" | DECISIONS 2026-10-23 "The owner's answers on the bag" | Read (proposed, waits for combat): on `engage`, if the hand holds a tool, the kernel puts the last weapon held back in the hand from the bag; the swap waits for the swing in progress and costs the one cooldown. With none, the fight is bare hands. |

**Which items are dual (proposed).** The hunt's take tools that also strike: the sling, the spear and the bow (section 5.4). Never dual: the thrown stone (it is `core/stone`, a material; "the first tool of a hunt is a stone picked up", docs/design/HUNTING.md:9; HUNTING section 5, T0), the snare (a trap, never held), and every tool of the opening (basket, trowel, axe, rod), so the opening's tree never becomes the first fight (EQUIPMENT section 4, "Why"). `dual_use_max` 4 (proposed; range 0 to 8, step 1): three take tools and one place left for a later named recipe. Owner question 2. The take tools land first with a `tool` block only; the `weapon` block and the mark come with combat (Waits). A dual item carries no wear on either reader, so its `tool` block states no `uses` from the day it lands (section 7, owner question 7).

**Why a weapon reads from the hand and a tool from the bag.** A fight is a few seconds of tempo (COMBAT 4.9, `tick_ms` 100); a choice the player makes before the fight (which hand to hold) is the build's part, as the active slots are (G86). Work is minutes of repeated presses, where choosing the best tool by hand would be a chore the kernel already does.

## 2. The classes

Seven weapon classes (PROGRESSION 5.1 names six; the sling is the seventh, proposed, owner question 2). A class is a content class under the base class `tool` (ClassDef, schema/src/index.ts:273; BASE_CLASSES includes `tool`, :95-109; up to 10 classes per file, :2350), so a weapon is an item of kind `tool` and passes the kind-to-class row as built (tools/src/check.ts:359-360). The class is the item's own `class`; the weapon block does not repeat it (EQUIPMENT 3.1: categories are derived, never stored, because a stored copy drifts).

| Class (proposed id) | School | Tempo | Wind-up, ticks | Reach or range, tiles | First tier | Made by now / later | Hunt grade (HUNTING 5) |
|---|---|---|---|---|---|---|---|
| `core/blade` | Strike (PROGRESSION 4.2, "blades") | quick | 3 | reach 1 | 1 | Handcraft now (flint, slate and fang knives) / Smithing from tier 4 (EQUIPMENT 3.7) | none |
| `core/blunt` | Strike (4.2, "blunt") | heavy | 6 | reach 1 | 1 | Handcraft now (club, stone maul, greenstone mace) / Smithing from tier 4 | none |
| `core/spear` | Strike (4.2, "spear") | standard | 4 | reach 2 in a fight (the take's thrust 1 and throw 4 are HUNTING 5's, section 15) | 2 | Handcraft now / Woodcraft when it lands (EQUIPMENT 3.7) | T3 |
| `core/staff` | Strike (this page's proposal, section 15) | standard | 4 | reach 2 | 1 | Handcraft now / Woodcraft (`shaft_true`) when it lands (EQUIPMENT 3.7; PROGRESSION 5.1) | none |
| `core/bow` | Aim (4.2, "bow") | heavy | 8 (the draw) | range 8 | 3 | Handcraft now / Woodcraft (`bow_draw`) when it lands | T4 |
| `core/thrown` | Aim (4.2, "thrown") | heavy | 10 (its own number) | range 3 | 1 | Handcraft | T0 is the plain stone, not this class |
| `core/sling` | Aim (this page's proposal, section 15) | standard | 8 (the whirl) | range 6; 7 with shaped stones | 1 | Handcraft | T2 |

All tempo and wind-up values, and the school of the staff and the sling, are proposed. The cited rows hold reach 1 and 2 (COMBAT 4.9) and the ranges 3, 4, 6, 7 and 8 (HUNTING section 5; HUNT_LADDER section 1; HUNT_FAMILIES 3a :256). The thrown hand's wind-up of 10 is its own field, not a reading of `wild.throw_ms` (section 3).

**Hunt grade against item tier.** HUNTING's T0 to T5 is the take's grade: what size of prey a tool takes. The item tier is the craft ladder. They are two numbers and they differ: the sling is hunt grade T2 at item tier 1 (craft level 2), the spear T3 at tier 2 (level 3), the bow T4 at tier 3 (level 6) (HUNT_LADDER section 1, "Craft tier (level)"). A smaller tool still takes, one quality lower, and a hunt is never refused for the wrong tool (HUNTING section 5).

**No class is closed to a race** (G70; HUNTING section 5: "No tool is closed to a race"). Decision 46 ("the fighting style follows the race") reads through techniques and the grade's attribute shift, never a lock on a class.

## 3. The weapon block and its numbers

The block's place is EQUIPMENT 3.3 (beside `tool`). Its fields, with the numbers anchored to COMBAT 4.9 (all new fields proposed; the schema field lands now and every content weapon is refused until combat, appendix):

```text
weapon {
  tempo     'quick' | 'standard' | 'heavy'   the swing: combat.swing_quick_t 8, swing_standard_t 10, swing_heavy_t 12 ticks
  windup_t  Int 2..10                         ticks from the press to the landing; at least bare_windup_t 3, below the swing
  reach     Int 1..2                          tiles, no diagonal; 2 a long hand (spear, staff)
  harm      Int 0..1000                       the hand's bonus in points, counted as harm + hand_offset (128)
  range?    Int 2..12                         tiles, only a hand that throws or shoots
  ammo?     a class id                        the ammunition class a launcher spends (bow, sling)
  noise?    Int 0..12                         tiles a landed strike is heard; left out, wild.strike_noise 4
}
```

The block has no `class` field: the class is the item's own (section 2). It is closed, no other key, as the `tool` block is (schema/src/index.ts:243). These seven fields and their bounds are the appendix's first row, the same in both places.

**No `uses` (proposed, owner question 7, default A).** A hand never wears (section 7), so the block carries no use counter. Adding an optional field later is additive; removing one after content exists is not, so the block starts without it, and answer B would add it back. The weapon trait of section 8.1 is the same kind of later, additive field: it lands with combat, so the block of this wave keeps its seven.

| Field | Anchor | Rule (proposed unless cited) |
|---|---|---|
| `tempo` | COMBAT 4.9: `swing_quick_t` 8 (6 to 10), `swing_standard_t` 10 (8 to 12), `swing_heavy_t` 12 (12 to 15), `swing_floor_t` 6 (4 to 8) | The swing is the hand's one cooldown, from press to the next press. Three named steps instead of a free number, so a hand reads as quick, standard or heavy at a glance and no hand swings under the floor. Bare hands are quick. |
| `windup_t` | COMBAT 4.9: `bare_windup_t` 3 (2 to 5); a foe's `windup_t` 5 (2 to 10) | Inside the swing, at least `bare_windup_t`. A thrown hand stores its own `windup_t` 10 (proposed), inside the block's bounds whatever the hunt's `wild.throw_ms` is tuned to. `wild.throw_ms` (1000, range 500 to 4000, step 250; content/core/params.json:562-567; its description at schema/src/index.ts:1607) stays the take's reading; the two are separate numbers on purpose, so tuning the hunt never moves a fight. |
| `reach` | COMBAT 4.9: "1 tile, no diagonal; 2 for a long hand" | 2 only for `core/spear` and `core/staff`. A spear's thrust 1 and throw 4 (docs/design/HUNTING.md:78) are the take's fields, not this block's (section 15); a spear is never thrown in a fight (proposed). |
| `harm` | COMBAT 4.9: damage in points; the hand's bonus counted with an offset (docs/design/COMBAT.md:258) | A hit is `strike_base * (eff_harm + hand_offset) div hand_offset` (section 4). |
| `range` | HUNTING 5; HUNT_LADDER section 1 | A ranged hand's attack is its shot, at 1 to `range` tiles; it has no close strike of its own. |
| `ammo` | HUNTING 5 (the sling: "stone and cord"; the bow's arrows) | Only `core/bow` and `core/sling` name one: the bow names `core/arrow`, the sling `core/sling-stone` (section 6). |
| `noise` | `wild.strike_noise` 4, range 2 to 6 (content/core/params.json:568-573); COMBAT 4.9 "noise, a strike that lands"; HUNTING section 4: "A tool's own noise ... gets its row with the tool" | The schema bounds it 0 to 12 (proposed), the bound a creature's `alarm` has on the same noise table (schema/src/index.ts:1926), so the schema does not move while `strike_noise`'s range stays inside it. The check with combat holds it inside `strike_noise`'s range, 2 to 6 today (section 16). HUNT_LADDER gives every take tool 4 and the snare 3. |

A weapon also carries a `wear` block on slot `hand` (it is held, and the kernel's `wear` reads `wear.slot`, kernel/src/step.ts:1366-1390). The `wear` block may carry `attrs` and `req` like any worn piece (EQUIPMENT 3.3; PROGRESSION 5.6), inside its rarity's effect count (PROGRESSION 5.7: common things are plain); which weapons carry `attrs`, and the one trait, is section 8.1.

**Units.** Every duration in the block is in ticks, never ms (COMBAT 4.9: "every duration below is a count of ticks"). The block reads no ms param. `wild.throw_ms` is converted by `wild.tick_ms` (content/core/params.json:484) only where the take reads it. Strike timing windows in the client are ms (game/src/ui/games/shared.ts:39-48) and are a work feel, not a fight number.

**Flight.** A shot or throw lands `1 + D div flight_tiles_t` ticks after release, D its distance in tiles, `flight_tiles_t` 4 (proposed; range 2 to 8, step 1; waits for combat). The research memo's shape (docs/research/research-combat.md:176) with our own number. A guard on the side it arrives from stops it, as it stops a strike.

## 4. Harm: fixed per hand, and the band draw (G79)

Everything in this section is design for the fight; its params and its function wait for the fight's first kernel pull request (docs/design/COMBAT.md:238; Waits).

**The collision.** COMBAT 4.9's damage row draws every hit from the kernel's stream in `base - f` to `base + f - 1` with `f = base div 8` (docs/design/COMBAT.md:257). G79, on the same page, says "A fight is read, not rolled ... The only draws are the pattern at appear and the drops at the fall" (docs/design/COMBAT.md:305), and G102 puts both on the server's seed ("What must stay unknown is drawn from the server's seed", docs/design/GAME_RULES.md:303-308). A per-hit draw is a third draw. Both are proposals of the same frame, so one of them must move.

**The resolution (proposed, owner question 1, default A): harm is fixed per hand.** The damage row keeps "at least 1 after defence" and drops the draw. A foe's tier is then counted in exact hits ("T1 felled in 2 hits of a starter hand", COMBAT 4.9), the player reads a fight entirely from the pattern, and the server replays a fight from its inputs alone: the player's actions and its own seed, since a client sends actions, never state (G102). A fixed hit can be read in the open repository, which G102 allows (a reading gains knowledge, never gold); what stays unknown in a fight is the pattern drawn when the foe appears. A foe's harm to a player is already a fixed share of the bar (docs/design/COMBAT.md:259), so the question is about the player's strike only.

**The hit (proposed).**

```text
hit        = strike_base * (eff_harm + hand_offset) div hand_offset        at least 1 after defence
rate(h,t)  = (h + hand_offset) * 1000 * swing_quick_t div (hand_offset * swing_t)   permille of bare hands
harmAt(r,t) = r * hand_offset * swing_t div (1000 * swing_quick_t) - hand_offset    the harm whose rate is r, floor 0
share(r)   = r                                     a close hand
           = r * range_rate_permille div 1000      a hand with `range`
eff_harm   = min(harm,
                 harmAt(share(hand_rate_max_permille[own_tier + 1]), t)    the soft wear requirement, section 8
                 harmAt(share(powerCap), t))                               R9, the one clamp (kernel/src/state.ts:536-540)
```

- `strike_base` 16 (proposed; range 8 to 32, step 1): a bare hand's hit before the attribute keys, which COMBAT round 5's note redoes with the combat wave (DECISIONS 2026-10-23 "Combat, round 5"; G86).
- `hand_offset` 128 (proposed; range 96 to 256, step 32). Our own number, chosen by its job: at a hand's cap the offset cancels out of the hit (`hit` is about `strike_base * rate * swing_t div (1000 * swing_quick_t)`), so the offset only sets the unit of `harm`. A larger offset makes a harm point a finer step, so each table cell rounds by half as much as at half the offset; 128 keeps tier 9's heaviest cell (448) well inside `harm`'s 1000. COMBAT 4.9's 64 (docs/design/COMBAT.md:258) came from research memo 6 (docs/research/research-combat.md:180), which took an outside game's maximum-hit constant (:39). This page compares an outside game and never copies its numbers (section 14, "The hit"), so our own offset replaces it (section 15).
- `hand_rate_max_permille` [1100, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000] for tiers 1 to 9 (proposed; each 1000 to 3000, step 50; a table like `power_cap_permille`, content/core/params.json:66). An index past the end reads the last entry, so `own_tier + 1` is defined at every tier. It is the most a hand of that tier may add to the strike rate, whatever its tempo, and it is read as the Strike and Aim ceilings by band (section 15).
- `range_rate_permille` 750 (proposed; range 500 to 1000, step 50): a hand with `range` gets this share of its tier's rate, the price of striking from afar. It applies in both clamp terms, so the soft requirement and the power cap soften a ranged hand as they soften a close one.
- **A launcher's harm is its own plus the shot's** (proposed): for a bow or a sling, `harm` in the lines above is the launcher's `harm` plus the loaded shot's `harm_add` (section 6), so `eff_harm` clamps the sum, and the check holds every sum the matching rule allows at most the launcher tier's cell of the table below (section 16).

**Why a rate and not a harm cap.** Bare hands swing quick. A heavy hand with the same harm as a quick one would strike less often and lose; a heavy hand with free harm would win by its size alone. Capping the rate (harm per tick against bare hands) makes tempo a trade of hit size against openings, never of output. A heavy hand needs fewer recovery windows to fell a foe; a quick hand fits into short ones.

**The table (proposed), harm at each tier's cap, from the formula at `hand_offset` 128:**

| Tier | Rate cap | Quick (8) | Standard (10) | Heavy (12) | Ranged standard | Ranged heavy |
|---|---|---|---|---|---|---|
| 1 | 1100 | 12 | 48 | 83 | 4 | 30 |
| 2 | 1250 | 32 | 72 | 112 | 21 | 51 |
| 3 | 1500 | 64 | 112 | 160 | 52 | 88 |
| 4 (waits for metal) | 1750 | 96 | 152 | 208 | 81 | 123 |
| 5 (waits for metal) | 2000 | 128 | 192 | 256 | 112 | 160 |

**Counted in hits, at `strike_base` 16 and full harm** (the hits do not depend on the offset): bare hands 16 a hit; a tier-1 standard hand 22; a tier-1 heavy hand 26; a tier-2 standard hand 25; a tier-3 standard hand 30; a tier-3 bow 27. A T1 foe of 44 health (proposed) falls in 2 hits of the tier-1 standard hand (the "starter hand", proposed reading, since a start carries no weapon: decision 42) and in 3 of bare hands, so bare hands still win by reading the pattern (docs/design/COMBAT.md:294). T2's 6 to 8 hits put a foe at 132 to 176 (proposed).

**The power cap bites first.** At character level 1 the cap is 1000 (content/core/params.json:66; kernel/src/step.ts:1713-1714), so no hand adds to the rate: a standard hand's harm counts as 32 (a hit of 20), a heavy hand's as 64 (a hit of 24), a quick hand's as 0, a ranged heavy hand's as 16 and a ranged standard hand's as 0. The cap reaches 1100 at character level 2 and stops rising at character level 14 (3000), while character level runs higher (kernel/src/state.ts:524-528, one level for each profession level gained). A T1 foe may therefore take a third hit from a very new character; the check counts hits at full harm, and the first ring's foes are tuned at the character level its quests bring.

## 5. The material ladder

Tiers 1 to 3 are open and this wave's (`open_tiers` 3). Tiers 4 and 5 are metal and wait. Every step is a recipe of at most `max_action_ms` 15000 (content/core/params.json:34; G43), an output climbs at most one tier above its highest input (G41; tools/src/check.ts:407-412), its level lies in its tier's band (tools/src/check.ts:413-414; `tier_min_level` [1, 3, 6], content/core/params.json:94: tier 1 is levels 1 to 2, tier 2 levels 3 to 5, tier 3 from 6), a tier-2 or tier-3 recipe is dug up (`known: found`, DECISIONS 2026-10-10 "First-tier recipes are known from the start; higher tiers are dug up"; a template is start-known by construction, tools/src/assemble.ts:501), and from tier 3 a thing comes only from a gated source (G41; `GATED_TIER` 3, tools/src/check.ts:297).

### 5.1 The materials by tier

| Tier | Materials (status, owner) |
|---|---|
| 1 | River stone `core/stone` (built, mined, DECISIONS 2026-10-25 "Stone is mined"); stone flakes (built); the branch from a split log (built); reed cord (built); hare and roe bone, roe sinew, hare and roe hide (built, content/core/items/goods.json); `core/flint` (proposed, QUARRYING 3: the flint of HUNTING 5's "wood and flint", one meaning across the wave); the bone handle (MATERIALS 3.3, #432, proposed: workshop tier 1); sinew thread (`core/sinew-thread`, owned by CLOTHING, its appendix); sinew cord (this page, section 5.4) |
| 2 | Slate (proposed, QUARRYING 2.1); the bow stave worked from an oak log (this page; `core/log` is oak, DECISIONS 2026-10-10 "The axe and the felled tree"); the bow string (this page). The built `core/stone-blade` (tier 2, a material) stays a material and no hand needs it |
| 3 | Gated: wolf fang (built, tier 3, class `core/bone`) and wolf hide (built, tier 3); greenstone (proposed, QUARRYING 2.1: a seam at level 6, respawn 300000); antler, the white hart's one bone good (BESTIARY_LANDS #432 :58; docs/design/HUNT_FAMILIES.md:26, :312), which passes the hunt's drop rows (one good each, tools/src/check.ts:598; a drop at most the animal's tier, :601, tier 3 against the hart's 3) and waits for the hart's content |
| 4 | Metal: copper and bronze (proposed words; QUARRYING writes the chain). Waits for metal, the city's forge (decision 51, DECISIONS 2026-10-22 "Making in the neutral valley") and Smithing ("city only", PROGRESSION 4.2) |
| 5 | Metal: iron (proposed word). Waits for metal |

Flint, slate and greenstone are the stone hand and head materials at tiers 1 to 3; QUARRYING owns them and lands each with its first consumer (QUARRYING 3). EQUIPMENT 3.7's "stone blade, tiers 1 to 2" are the flint and slate knives below.

### 5.2 The hands, class by tier (design; every row waits for combat or the take verb)

Each is a plain recipe making one fixed item, Handcraft, at the workshop of the output's tier (the work stone, the workbench, the workshop). Rarity is declared within one rank of the computed one (V-2) when the row lands. All names, inputs and levels proposed.

| Class | Tier | Hand (proposed id) | Inputs | Level | Known | Waits for |
|---|---|---|---|---|---|---|
| blade | 1 | flint knife `core/flint-knife` | 1 flint, 1 branch, 1 reed cord | 2 | start | combat |
| blade | 2 | slate knife `core/slate-knife` | 1 slate, 1 branch, 1 sinew cord | 4 | found | combat |
| blade | 3 | fang knife `core/fang-knife` | 1 wolf fang, 1 branch, 1 sinew cord | 7 | found | combat |
| blunt | 1 | club `core/club` | 1 log | 1 | start | combat |
| blunt | 2 | stone maul `core/stone-maul` | 2 stone, 1 branch, 1 sinew cord | 4 | found | combat |
| blunt | 3 | greenstone mace `core/greenstone-mace` | 1 greenstone, 2 branch, 1 sinew cord | 6 | found | combat |
| spear | 2 | spear `core/spear` | 2 branch, 2 flint, 1 roe sinew | 3 | found | the take verb (section 5.4) |
| spear | 3 | fang-tipped spear `core/fang-spear` | 1 wolf fang, 1 bow stave, 1 sinew cord | 7 | found | combat |
| staff | 1 | quarterstaff `core/quarterstaff` | 1 log, 1 reed cord | 2 | start | combat |
| staff | 2 | bound staff `core/bound-staff` | 1 bow stave, 1 roe hide | 4 | found | combat |
| staff | 3 | greenstone-capped staff `core/capped-staff` | 1 bow stave, 1 greenstone, 1 sinew cord | 6 | found | combat |
| bow | 3 | bow `core/bow` | 1 bow stave, 1 bow string | 6 | found | the take verb (section 5.4) |
| thrown | 1 | throwing stones `core/throwing-stones` | 3 stone | 1 | start | combat |
| thrown | 2 | flint darts `core/flint-darts` | 2 flint, 1 branch | 3 | found | combat |
| thrown | 3 | greenstone throwing axe `core/throwing-axe` | 1 greenstone, 1 branch, 1 sinew cord | 6 | found | combat |
| sling | 1 | sling `core/sling` | 1 reed cord, 1 hare hide | 2 | start | the take verb (section 5.4) |
| sling | 2 | sinew sling `core/sinew-sling` | 2 sinew cord, 1 roe hide | 4 | found | combat |
| sling | 3 | wolf-hide sling `core/wolf-sling` | 2 sinew cord, 1 wolf hide | 7 | found | combat |

Every row climbs at most one tier (a tier-2 hand has a tier-1 or tier-2 input at most; each tier-3 hand has a tier-2 or tier-3 input) and sits in its band. The three parts (bow stave, sinew cord, bow string) are in section 5.4.

**Tiers 4 and 5 (waits for metal).** Blade, blunt, spear heads, the thrown axe and arrow heads take metal and move to Smithing (EQUIPMENT 3.7); a metal-shod staff joins Smithing's ring to Woodcraft's shaft. The bow climbs without metal (a sinew-backed bow at tier 4, a horn bow at tier 5, proposed), and still waits for the tier to open and for horn (BESTIARY_LANDS #432). The sling's tier 4 waits for the next land's fibre.

**Past tier 5.** The tier has no fixed top (DECISIONS 2026-10-09 "Two ladders: an open-ended tier for how advanced, the four rarities for how often"; schema tier 1 to 20, schema/src/index.ts:216). `hand_rate_max_permille` grows +250 a tier to tier 9, where it meets the power cap table's top, 3000; past that the last entry holds. No hand wears at any tier (section 7). Past tier 5 a tier adds quality and attribute bonuses (PROGRESSION 5.6: `attr_bonus_max` +2 a tier past 5), never rate, unless the power cap table grows, which is a core param (content/core/params.json:66; G45). A dual hand past tier 5 needs `tool.tier` above 5 (`tool.tier` is 1 to 5, schema/src/index.ts:238), a core schema change named in Waits.

### 5.3 Depth, counted

18 hands and 3 parts are 21 recipes at tiers 1 to 3, the top at level 7, plus the snare and the nine ammunition recipes of section 6.2 (which wait for the take verb, a feather item or combat). About eight of them are Woodcraft's when it lands (the two spears, three staves, the bow, the stave and the club; EQUIPMENT 3.7), against PATHS section 4's floor of 16 recipes with the top at level 7 for a crafting path; the rest are Handcraft's until Smithing takes blade and blunt at tier 4. The floor's three quests that start from a node come for Strike and Aim with the first foe (DECISIONS 2026-10-25 "The progression map, Q2: the combat schools are reserved now and written with the first foe"). The measure against an outside game's depth reference is GAP_RS_GEAR's, not restated here.

**Scale (the direction of 01.11): hundreds of weapons along the tier ladder.** The 18 hands above are the stone tiers' first slice, not the size of the armoury. The direction asks for hundreds, spread along the ladder rather than packed into the stone tiers: a matrix of form, material and tier, where every new material brings a whole set, as the outside game's smithing ladder does (GAP_RS_GEAR). Proposed counts: about 70 to 80 makeable hands, parts and ammunition at tiers 1 to 3, and about 300 to 350 once metal and the next lands open tiers 4 to 10 (section 5.2, "Past tier 5"). Proposed rules for that size: a form is taught once and is then made in every material its station and level can work, so hundreds of recipes do not need hundreds of found scraps against the rarity budget (section 5.4); two hands of one tier never share one block of numbers, so no hand is another's recolour; and one data table writes the recipe and item files, with a check that the files equal the table, as `pnpm schemas --verify` does for the schemas. The matrix page and its generator are the stream's next pull request; this section's rows stand as its first slice, and the matrix may rename them.

### 5.4 The take tools (HUNTING 5; HUNT_LADDER section 1), as items

| Hunt grade | Tool | Item tier (level) | Station | Inputs | Today's check |
|---|---|---|---|---|---|
| T0 | thrown stone | the stone itself | none | `core/stone` 1, spent | no item, nothing to check |
| T1 | snare | 1 (1) | workshop tier 1 (the work stone) | `core/reed-cord` 2, `core/branch` 1 | passes |
| T2 | sling | 1 (2) | workshop tier 1 | `core/reed-cord` 1, `core/hare-hide` 1 (HUNT_LADDER: "hide 1") | passes |
| T3 | spear | 2 (3) | workshop tier 2 (the workbench) | `core/branch` 2, `core/flint` 2, `core/roe-sinew` 1 | passes as a plain recipe with `known: found`, once QUARRYING's flint has landed |
| T4 | bow | 3 (6) | workshop tier 3 | HUNT_LADDER: `core/branch` 2, sinew 2, `core/reed-cord` 1 | **fails**: three tier-1 inputs for a tier-3 output (tools/src/check.ts:407-412). This page: bow stave 1 (tier 2) and bow string 1 (tier 2), as HUNTING 5 names it ("Stave, a sinew string") |
| T5 | pit trap | a camp build | camp build, trowel | `core/branch` 6 | not a hand; HUNTING's |

All of them wait for the take verb (section 15; Waits): no kernel step reads a snare, sling, spear or bow, and their animal inputs (hare hide, roe sinew, through the thread and cord) come only from a take. The fletching HUNTING 5 lists for the bow belongs to the arrow, not the bow (HUNT_LADDER: arrows carry the feather). The bow also waits for its first arrow: a launcher tier with nothing to fire is refused (section 16), and every arrow waits for a feather item (section 6.2). Of the four take tools only the snare, never a hand, wears (`uses` 20, section 7); the sling, the spear and the bow are dual (owner question 2) and state no `uses`.

**The parts.** CLOTHING owns `core/sinew-thread` (its appendix) and this page cites it. This page owns the cord and the string, which only the bow and the hands use; MATERIALS 3.4 (#432) gives the chain and the times only:

- `core/sinew-cord`: class `core/sinew`, tier 1, common, weight 0; 2 sinew thread -> 1 cord; workshop tier 1; 3000 ms; level 1; `known: start`.
- `core/bow-string`: class `core/sinew`, tier 2, uncommon (computed 0 + 1 for found), weight 0; 2 sinew cord -> 1 string; workshop tier 2; 5000 ms; level 3; `known: found`, taught by the string scrap.
- `core/bow-stave`: class `wood`, tier 2, uncommon, weight 1; 1 log -> 1 stave; workshop tier 2; 8000 ms; level 4; `known: found`, taught by the stave scrap.

**Where the scraps are found.** The four scraps (spear, stave, string, bow) get their own dig spot, `core/hunters-cache` (proposed), on a new ruin slot by the south ruins passage (`core/ruins-south`, tags ruin and meadow, opens by wake; content/core/map.json:581), so no shared find table moves and no page's row count is touched (the deep ruins hold 3 finds of 8 allowed, schema/src/index.ts:391, and CLOTHING appends 3). The cache returns in 300000 ms with count 2 (proposed), so its rare bonus, capped at 300 by its effort and time (kernel/src/values.ts:70-74), takes 2000 ppm of the rarity budget and the world stands at 99531 of 100000 (QUARRYING 2.4); at 120000 it would take 5000, more than the 2469 left (GAP_RS_GEAR question 1, default A). The wave's placement rule (proposed): CLOTHING's split (tier-2 scraps at the gate rubble, tier-3 at the deep ruins; CLOTHING 6) governs rows that join an existing table; a page's own spot may hold both tiers, as QUARRYING's yard does (QUARRYING 6).

### 5.5 The matrix as a report (proposed, owner question 12, default A; waits for the first weapon content)

Today the matrix is this page: the block's numbers (section 3), the harm formula and its table (section 4), class by tier with inputs and levels (section 5.2), and the ammunition matrix (section 6.1). Once the first weapon is content, a report prints it from content and the params, so a reader and a reviewer see one table and never a sum done by hand:

- `pnpm weapons` (proposed name), in tools/src/balance/weapons.ts with its own CLI, built as the hunt ladder is (tools/src/balance/hunt-ladder.ts, tools/src/balance/hunt-ladder-cli.ts, and the page it writes, regenerated, never edited). It prints class by tier: harm and the cell's cap (`handHarmMax`, section 4), tempo, wind-up, reach, range, the requirement level (section 8), the recipe's inputs, the solver's value, the declared and the computed rarity, and whether the item is dual; and the ammunition matrix: each launcher class and tier against the ammunition tiers and heads it fires, with the harm and the range of each pair (section 6.1).
- A test pins it, as tools/test/hunt-ladder.test.ts pins the hunt ladder's page against what its calculators print: the committed table equals the print, every harm sits under its cell, and every launcher tier has a shot.

**What is code on develop already.** The value solver prices every item from its sources (`computeValues`, kernel/src/values.ts:239), with a rarity bonus capped by effort and time (`rarityBonus`, :70-74) and the world's rarity budget (`rarityBudget`, :206; its check row, tools/src/check.ts:461-471; its test, kernel/test/crafting-values.test.ts:51-56). The computed rarity, V-2 (`computedRarity`, tools/src/check.ts:200; the row, :278-291). The tier bands (:315-324, :413-414), the one-tier climb (:407-412) and the gated tier (`GATED_TIER` 3, :296-297; the node and shop rows, :445-459). CR-16, the average try (:429-442), and the G40 miss row (:423-428). R11, the drift against the value lock (`checkDrift`, :650-673). The balance prover in tools/src/balance: `pnpm balance` (cli.ts over catalogue.ts, prove.ts and curve.ts; four of its rows run in `pnpm check` through `checkBalance`, tools/src/check.ts:80 (defined at tools/src/balance/check.ts:15), and `WIRED_ROWS`, tools/src/balance/prove.ts:590), `pnpm map:playtest` and `pnpm map:difficulty` (playtest-cli.ts, reckon-cli.ts), and the hunt ladder. **What this page adds** is the rows of section 16 (shape, dual, no wear, ammunition, the harm sum, traits, signatures) and this report; none is built before its content (Waits).

## 6. Ammunition and the quiver

All of this waits for the take verb or combat, whichever spends a shot first; every arrow also waits for a feather item (section 6.2). With no wear on a hand (section 7), ammunition is what a player keeps stocked.

**The block (proposed, owner question 10, default A).** An ammunition item carries an `ammo` block, closed as the `weapon` block is:

```text
ammo {
  for        a class id                        the launcher class that fires it: core/bow or core/sling
  shots      Int 1..100                        shots in one unit; each shot spends one, and at `shots` the unit is gone
  harm_add   Int 0..1000                       points added to the launcher's harm in a fight; the sum never past the launcher tier's cell (section 4)
  head       a word of its class's list        arrows: blunt | broad | barbed; sling stones: plain | shaped
  range_add? Int 0..2                          tiles added to the launcher's range; left out, 0
}
```

The block has no `tier`: an ammunition's tier is the item's own `tier` (schema/src/index.ts:216-218, 1 to 20, which the check asks of every item, tools/src/check.ts:350-351), as a weapon's class is the item's own (section 3). A recipe's tier is its highest output's (tools/src/check.ts:408), so an ammunition recipe sits in its tier's band and climbs one tier at most like every recipe (section 5). A tool repeats its tier in `tool.tier` and the check holds the two equal (tools/src/check.ts:355); the `ammo` block stores none, so nothing can drift. The first draft's `size?` is gone: the head says which prey sizes a shot suits (section 6.1). The count of shots spent is kept as the kernel keeps a tool's wear (`wearTool`, kernel/src/step.ts:1754-1767: a count per item id, the unit removed at the limit, an event), so a shot reads `ammo.shots` where a tool reads `tool.uses`.

- **The matching rule (proposed).** A launcher fires only ammunition whose `for` is its own class and whose tier is at most its own tier: a tier-3 bow fires arrows of tiers 1 to 3, a tier-1 sling only tier-1 stones. A range of combinations, never every one (section 6.1). In a fight a shot's harm is the launcher's `harm` plus the shot's `harm_add`, clamped as every hand's is (section 4); its range is the launcher's `range` plus its `range_add`, at most 12, the block's bound.
- **The head and the prey's size (proposed).** On a take, a head that does not suit the prey's size takes one quality lower, in either direction (HUNT_FAMILIES 3a :257: "The wrong arrow takes at one quality lower in either direction"). The head's step and the smaller tool's step (HUNTING 5, "a tool smaller than the animal still works, at one quality lower", docs/design/HUNTING.md:82) are one step together, never two, floor 1 (section 15). In a fight a head reads only its `harm_add`; no head carries an effect over time (section 11).
- **The sling also throws plain stones.** HUNTING 5's "stone and cord": with no ammunition in the quiver or the bag, a sling spends one `core/stone` from the bag a shot, as the T0 throw does, read as a tier-1 shot with head `plain`, `harm_add` 0 and no `range_add`; `core/stone` itself stays a material with no `ammo` block. Shaped stones (HUNT_FAMILIES 3a :256) are ammunition with head `shaped` and `range_add` 1 (range 7, HUNT_LADDER section 1). So every sling tier has a shot from the day it lands.
- **Arrows.** Every arrow is a shaft, a head and fletching (section 6.2), and fletching needs a feather: no feather item exists (content/core/items/goods.json declares the class `core/feather` only), so arrows wait for one, and the bow waits with them (section 5.4).
- **The thrown hand is its own ammunition.** A `core/thrown` weapon names no `ammo`; it comes back to the hand when its flight back ends (as many ticks as its flight out, section 3), as HUNT_FAMILIES 3a's throw net and bola are "picked up again" (:248, :255). It returns with no wear (section 7).
- **No recovery draw.** A spent shot is gone; nothing comes back on a roll (G79's two draws). Owner question 4 offers a counted or a picked-up return instead.
- **Ammunition's category.** EQUIPMENT 3.1's list is closed. An item with an `ammo` block derives as `tool` (proposed amendment of the `tool` row: "a `tool` or `ammo` block and no `weapon` block"); no eighth category. Its class is one of two content classes under the base class `tool`, `core/arrow` (every arrow) and `core/sling-stone` (every sling stone; the loose `core/stone` keeps its class `stone`). So an ammunition item is of kind `tool` and passes the kind-to-class row as built (tools/src/check.ts:359-360), as a weapon does (section 2). An item of kind `tool` with no `tool` block is refused (tools/src/assemble.ts:534). The `ammo` block's pull request therefore lets an `ammo` block stand in the `tool` block's place there (`&& !it.weapon && !it.ammo`), as the `weapon` block does. An item with both blocks stays refused (section 16).
- **The quiver on the back.** The back takes one bag or one quiver (DECISIONS 2026-10-23 "Bags on the back: 12, a satchel 24, a frame pack 36"; schema/src/index.ts:150-157; kernel/src/state.ts:50). Proposed: a quiver is a back piece whose `places` take only ammunition bundles (`holds: 'ammo'`), and a launcher draws from the quiver first, then the bag. Wearing it means no bag on the back, so Aim's quiver (PROGRESSION 4.2, "the quiver on the back") is paid in places. Decision 42's elf "pouch or quiver as jewellery" is a jewelry piece that holds nothing (section 15).
- **Value (proposed).** A bundle is priced by the value solver from its recipe like any made item (kernel/src/values.ts); a sale pays the share of shots left, as a tool sells for the share of its uses left (kernel/src/step.ts:992-997).

### 6.1 Which launcher fires which ammunition (proposed)

The heads, a closed list per class:

| Class | Head | Suits on a take (prey size) | In a fight (`harm_add`) | Source |
|---|---|---|---|---|
| arrow (`core/arrow`, `for: core/bow`) | `blunt` | small prey and birds | 0 | HUNT_FAMILIES 3a :257; HUNT_LADDER section 1 ("bow, blunt arrow": small) |
| arrow | `broad` | medium and large | half its tier's top, rounded down | HUNT_FAMILIES 3a :257; HUNT_LADDER section 1 ("bow, broad arrow": medium, large) |
| arrow | `barbed` | none: a take with it is always one quality lower | its tier's top | this page: the fight's head, so a hunter's quiver and a fighter's differ |
| sling stone (`core/sling-stone`, `for: core/sling`) | `plain` | small | 0 | HUNTING 5 ("stone and cord"); HUNT_LADDER section 1 (the sling: small) |
| sling stone | `shaped` | small | its tier's top; `range_add` 1 | HUNT_FAMILIES 3a :256; HUNT_LADDER section 1 (shaped stone: small, range 7) |

**The tier's top.** A launcher's own `harm` is half its tier's cell of section 4, rounded down; a shot's top `harm_add` is the rest of its own tier's cell. So a launcher with a top shot of its own tier reaches its cell exactly, a lower-tier shot falls short (a tier-3 bow with a tier-1 barbed arrow counts 59 of its 88), and no pair the matching rule allows passes the cell, since the cells rise with the tier.

| Ammunition, tier | Cell (section 4) | Top: `barbed`, `shaped` | `broad` | `blunt`, `plain` |
|---|---|---|---|---|
| arrow, 1 | 30 (ranged heavy) | 15 | 7 | 0 |
| arrow, 2 | 51 | 26 | 13 | 0 |
| arrow, 3 | 88 | 44 | 22 | 0 |
| sling stone, 1 | 4 (ranged standard) | 2 | - | 0 |
| sling stone, 2 | 21 | 11 | - | 0 |
| sling stone, 3 | 52 | 26 | - | 0 |

**The compatibility matrix.** Launcher class and tier against the ammunition it fires:

| Launcher, tier | Cell | Launcher `harm` | Fires | Best pair's harm | Range | Lands with |
|---|---|---|---|---|---|---|
| sling, 1 | 4 | 2 | sling stones of tier 1: plain (the loose stone), shaped | 2 + 2 = 4 | 6; 7 shaped | the take verb |
| sling, 2 | 21 | 10 | sling stones of tiers 1 and 2 | 10 + 11 = 21 | 6; 7 shaped | combat |
| sling, 3 | 52 | 26 | sling stones of tiers 1 to 3 | 26 + 26 = 52 | 6; 7 shaped | combat |
| bow, 3 | 88 | 44 | arrows of tiers 1 to 3: blunt, broad, barbed | 44 + 44 = 88 | 8 | the take verb, with its first arrow (a feather item) |
| bow, 4 and 5 | 123, 160 | 61, 80 | arrows of tiers 1 to 4, 1 to 5 | 123, 160 | 8 | tiers 4 and 5 opening (section 5.2) |
| thrown, blade, blunt, spear, staff | - | - | nothing: a close hand, or a thrown hand that is its own shot | - | - | - |

Every launcher tier that exists fires at least one shot (the sling by its loose stone, the bow by its first arrow), no ammunition stands above every launcher of its class, and every allowed pair stays under its cell: the three are check rows (section 16), and the report of section 5.5 prints this table from content.

### 6.2 The materials map

Each is a plain recipe making one fixed item, Handcraft. An arrow is a shaft (the branch as it is, as the snare takes it), a head and fletching (one feather); a sling stone is a shaped stone. Every arrow is of class `core/arrow` and every sling stone of class `core/sling-stone`, kind `tool` (section 6). A tier-2 or tier-3 recipe is dug up (section 5), and its scrap is placed when it lands, on a spot of its own, so no landed find table moves (R11; section 5.4's wave rule). Rarity is declared within one rank of the computed one (V-2) when the row lands. All names, inputs, counts and levels proposed.

| Ammunition (proposed id) | Tier | Head | Inputs | Output | Station | Level | Known | Waits for |
|---|---|---|---|---|---|---|---|---|
| shaped stones `core/shaped-stones` | 1 | shaped | 2 `core/stone` | 1 unit, `shots` 5 | workbench (workshop tier 2), as HUNT_FAMILIES 3a :256 has it | 2 | start | the take verb |
| blunt arrows `core/blunt-arrows` | 1 | blunt | 1 `core/branch`, 1 `core/hare-bone` (the bone knob), 1 feather | 1 unit, `shots` 10 | workshop tier 1 | 2 | start | a feather item |
| flint arrows `core/flint-arrows` | 1 | broad | 1 `core/branch`, 1 `core/flint`, 1 feather | 1 unit, `shots` 10 | workshop tier 1 | 2 | start | a feather item; QUARRYING's flint |
| barbed bone arrows `core/barbed-arrows` | 1 | barbed | 1 `core/branch`, 1 `core/roe-bone`, 1 feather | 1 unit, `shots` 10 | workshop tier 1 | 2 | start | a feather item; combat (its head is read in a fight) |
| slate arrows `core/slate-arrows` | 2 | broad | 1 `core/branch`, 1 `core/slate`, 1 feather | 1 unit, `shots` 10 | workshop tier 2 | 4 | found | a feather item; QUARRYING's slate |
| greenstone arrows `core/greenstone-arrows` | 3 | broad | 1 `core/branch`, 1 `core/greenstone`, 1 feather | 1 unit, `shots` 10 | workshop tier 3 | 7 | found | a feather item; QUARRYING's greenstone |
| barbed greenstone arrows `core/barbed-greenstone-arrows` | 3 | barbed | 1 `core/branch`, 1 `core/greenstone`, 1 feather | 1 unit, `shots` 10 | workshop tier 3 | 7 | found | a feather item; combat |
| slate shot `core/slate-shot` | 2 | shaped | 1 `core/slate` | 1 unit, `shots` 5 | workshop tier 2 | 4 | found | combat (the tier-2 sling) |
| greenstone shot `core/greenstone-shot` | 3 | shaped | 1 `core/greenstone` | 1 unit, `shots` 5 | workshop tier 3 | 7 | found | combat (the tier-3 sling) |

What exists on develop: `core/stone`, `core/branch`, `core/hare-bone` and `core/roe-bone` (content/core/resources/river-stones.json; content/core/recipes/split-log.json; content/core/items/goods.json). Flint (tier 1), slate (tier 2) and greenstone (tier 3) are QUARRYING's (QUARRYING 2.1 and its appendix), and each lands with its first consumer there. No feather item exists: the class `core/feather` is declared with no item (content/core/items/goods.json), and a feather is a proposed good of the crow and the fowl in HUNT_LADDER's source only (tools/src/balance/hunt-ladder.json:322, :378). Every recipe climbs one tier at most from its highest input and sits in its tier's band (section 5). HUNT_LADDER's source gives both arrows the bow's craft tier 3, level 6 and no station (tools/src/balance/hunt-ladder.json:268, :275) and names `core/stone-flakes` as the broad arrow's head (:276). With the arrows, they move to this table's tier 1, level 2 and workshop tier 1, and the head to `core/flint` (section 15).

## 7. Wear and mending: tools only

- **A hand never wears (proposed, owner question 7, default A).** An item with a `weapon` block keeps no use counter, whichever reader uses it: a strike, a shot, a throw or a thrust spends nothing of the hand, and no hand is mended. A player plays with a weapon as long as he likes; what he keeps stocked is ammunition (section 6). A dual item (a take tool that is also a hand, section 1, owner question 2) carries no wear on either reader, so its `tool` block states no `uses`, and a check row refuses `tool.uses` on an item with a `weapon` block (section 16). The take's reader needs no change for it: `wearTool` already lets a tool with no `uses` last (kernel/src/step.ts:1754-1767, "a tool with no uses lasts"). If owner question 2 is answered C, the sling and the bow stay tools only and may take the wear of the next bullet.
- **Tools that are not hands keep the built wear.** The snare (`uses` 20, section 5.4; never held, never a hand), QUARRYING's picks, the trowels and the axe wear by `tool.uses` through `wearTool` (kernel/src/step.ts:1754-1767) and break with the built `tool_broke` event (kernel/src/step.ts:148), as today.
- **The sink for weapons is ammunition and the tier ladder.** Every shot spends a share of a unit of ammunition, and a better hand is the next tier's recipe and its materials (section 5.2), the "buying and improving weapons" the crafting economy names among what gold is for (DECISIONS 2026-10-09 "The crafting economy: a miss keeps only inputs, a free market, no level wall"). A close hand has no ammunition; its sink is the ladder and the trader, whose sale removes it (kernel/src/step.ts:984).
- **Armour and clothing never wear** (EQUIPMENT 3.4; PROGRESSION 5.4; DECISIONS 2026-10-09 "The crafting economy: a miss keeps only inputs, a free market, no level wall").
- **Mending, for tools only (EQUIPMENT 3.4; PROGRESSION 5.4).** A mend is a recipe whose input is the worn tool and whose output is the same tool restored, at a bench, never in the field. What it spends: the whetstone for a stone or metal edge (picks, trowels, the axe; `core/whetstone` is QUARRYING's item, 1 slate, and waits with the first mend, QUARRYING 6), and cord for a bound tool (the snare, with reed cord). The mend recipes for picks, trowels and the axe are QUARRYING's (its Waits); this page owns the `mend` mark and the snare's mend. Two things today's code needs before a mend works (proposed, built after this wave, see Waits):
  1. Wear is a counter per item id in the save (`s.player.wear`), not a property of the item, so consuming and making the same item changes nothing. A recipe marked `mend: true` (proposed) clears the counter on success. On a miss the tool comes back still worn, its counter unchanged, and only the whetstone or the cord is lost, as the upgrade recipe keeps its item on a miss (PROGRESSION 5.4, CR-20).
  2. Two built check rows refuse a recipe from a tool to the same tool. CR-16 refuses a recipe whose average try loses value (tools/src/check.ts:429-442), and G40's row refuses a miss that keeps as much as a success (`left >= success`, "a miss keeps a part (G40)", tools/src/check.ts:423-428). The check prices a `mend` recipe as follows (proposed): the worn tool, as an input and as the part a miss keeps, at `mend_below_permille` of its value; the restored output at its full value. So a miss keeps half and a success gives the whole (`left < success`), and an average try gains while the chance times half the value is more than the spent material. `mend_below_permille` {500, 250 to 750, step 50} (proposed); the kernel offers a mend only when that much of the uses is gone. A recipe with the `mend` mark whose tool is a hand cannot exist: a hand has no uses to restore.
- **Mending is the tools' sink.** A mend spends a whetstone or cord and the bench's time; a tool never loses value to a timer, and no trader repairs it for gold. Smithing's `edge_hold` (PROGRESSION 4.2) slows the wear of a metal tool's edge (a pick, an axe) and waits for the city; a blade has no wear for it to slow (section 15).

## 8. The soft wear requirement

The owner's word (DECISIONS 2026-10-25 "The progression map, Q5: pips bought to 5, and worn gear adds attribute bonuses on top, with a soft wear requirement"; PROGRESSION 5.6) holds for weapons through the `wear` block's `req: { school, level, attr? }`:

- The school is `strike` for blade, blunt and spear and `aim` for bow and thrown (PROGRESSION 4.2, docs/design/PROGRESSION.md:175-176); the staff under `strike` and the sling under `aim` are this page's proposal (section 15). Both schools are reserved by name and written with the first foe (DECISIONS 2026-10-25 "The progression map, Q2: the combat schools are reserved now and written with the first foe"), so no weapon's requirement can be read before combat, and none needs to be.
- The level follows the tier: tier 1 none, tier 2 level 6, tier 3 level 11, tier 4 level 16, tier 5 level 21 (PROGRESSION 5.6, proposed there).
- Below the requirement a weapon still strikes, gently. `own_tier` is the highest tier whose requirement the wearer meets, so it is at least 1 (tier 1 asks nothing), and the hand's harm counts up to `harmAt(share(hand_rate_max_permille[own_tier + 1]), tempo)` (section 4). A newcomer who bought a tier-3 spear in the market strikes like a tier-2 spear until Strike reaches 6, the level that gives own tier 2 (PROGRESSION 5.6; CLOTHING 7.4 reads it the same way). A newcomer with a tier-3 bow counts 51 of its 88, a tier-2 ranged heavy hand's harm, because the ranged share applies to the requirement's clamp too. Reach, tempo and range are never reduced: the requirement softens power, never the hand's shape.
- The requirement reads base attributes only (PROGRESSION 5.6), and the tooltip shows the full harm as a size word, the active part and what unlocks the rest, in counts, never a percentage (decision 39, DECISIONS 2026-10-22 "No percentages on screen").
- Making a weapon has no level wall (G40; DECISIONS 2026-10-09 "The crafting economy"): a recipe above the level runs at a lower chance.

### 8.1 Bonuses and traits on found weapons (proposed, owner question 11, default A)

CLOTHING 7.1 to 7.6, read for the hand. What a weapon gives in a fight is its harm, its tempo and its shape (sections 3 and 4). A found weapon of tier 2 or more may add, by its rarity band, an attribute bonus and one weapon trait, all under the same power cap.

- **No worn effect** (CLOTHING 7.1). A weapon's `wear` block names none of the five work rates of `WORN_EFFECTS` (schema/src/index.ts:160): the hand is the strike, not a work bonus.
- **Who carries one, by rarity band** (CLOTHING 7.2; PROGRESSION 5.7, `rarity_effects_max` [1, 1, 2, 2]). A common weapon, a bought one and a made one carry none: every made hand of this wave is plain (as CLOTHING 9's pieces are), a made weapon's power is its harm alone, and what quality may add to a made weapon is asked when the quality roll lands (CLOTHING 9). Only a found weapon (a dig spot's find, or a foe's drop with combat) of tier 2 or more carries one. Each such weapon is an item of its own whose bonus is written in its record, never rolled when it is found, so G79's two draws stay two (COMBAT section 5) and a found weapon splits from the made one as a stack splits by grade (EQUIPMENT 3.3b).

| Tier, rarity | Attribute bonus (`wear.attrs`) | Weapon trait |
|---|---|---|
| tier 1 at any rarity; common at any tier; made, bought or sold | none | none |
| 2, uncommon | one attribute, +1 | none |
| 2, rare | one attribute, +1 | one |
| 2, legendary | one attribute, +2 | one |
| 3, uncommon | one attribute, +2 | none |
| 3, rare | one attribute, +2 | one |
| 3, legendary | one attribute, +3 | one |

- **Attribute bonuses** (CLOTHING 7.5). The equipment foundations' field `wear.attrs`, at most `attr_bonus_max` [1, 2, 3, 4, 6] of the weapon's tier (`attr_bonus_step` {2, 1..4, 1} past tier 5), sized as CLOTHING 7.5 sizes a garment's: the rarity's band of the tier's maximum, at least the tier below's maximum (the table above). Its gate refuses any `attrs` in content until a reader and the stats panel land (CLOTHING 7.5), and the "weapon waits for combat" row refuses the weapon itself before that (section 16).
- **The power cap and the soft requirement** (CLOTHING 7.3, 7.4). An attribute bonus counts through `attrTotal` under R9's one clamp, with everything else worn and learned. Below its requirement a weapon's bonus counts at most `attr_bonus_max[own + 1]`, as its harm does (section 8; PROGRESSION 5.6, "one rule for all of an item's power"), and its trait is read when the weapon's tier is at most `own + 1`.
- **Weapon traits** (CLOTHING 7.6, the shape: a closed list, one a piece, a word on screen). One trait a weapon, from its class's list. Each moves one fight number a step inside the range COMBAT 4.9 gives it, or gives a foe what a hit already gives a player (memo 7's stun and knockback); none adds harm or rate, so the rate cap of section 4 and the power cap (R9) hold unchanged, and none answers a hazard, opens a door or skips a swing (section 13). Proposed words:

| Class | Trait | What it does |
|---|---|---|
| blade | `keen` | a strike costs 3 less breath (`attack_breath` 15 to 12): the blade fights longer, never harder |
| blunt | `stunning` | a landed hit stuns a foe for `stun_t` (3), as a hit stuns a player; never twice inside one of the foe's swings |
| spear | `long-reach` | a landed hit pushes a foe one tile back, as a hit pushes a player (`knockback_tiles` 1, never into a solid tile or across a level change, G68), so a foe of reach 1 must close again |
| staff | `guarding` | a hit taken on a raised guard costs 2 less breath (`guard_hit_breath` 8 to 6) |
| bow | `steady` | a draw cut by a hit's stun resumes after it at the tick it stood, instead of starting again |
| sling | `quick-load` | the whirl is one tick shorter (`windup_t` 8 to 7), never under `bare_windup_t`; the swing does not move |
| thrown | `returning` | back in the hand on its landing tick instead of after its flight back (section 6); the swing still holds the next throw |

- **Priced by the value solver.** The solver prices a found weapon from its source, the find's effort and time and the rarity bonus of its rarest find (kernel/src/values.ts:70-74, :98-118), so a bonus is paid for by how rarely the weapon is found, the declared rarity stays within one rank of the computed one (V-2), and the world's rarity budget bounds how much of it the world holds (tools/src/check.ts:461-471).
- **Gated like the garment traits** (CLOTHING 7.6). The trait is a field of the `weapon` block, `trait?`, added with combat beside its reader (an additive field, section 3); until then the "weapon waits for combat" row refuses every weapon, so no trait reaches content before a fight reads it. The check refuses a word outside the class's list (section 16). On screen a trait is a word ("holds the draw"), never a number (decision 39).

## 9. Special moves live in the build

The build's techniques stay the base: the techniques a fight offers are the build's active slots (G86; COMBAT 4.3 `tech`; the format is GROWTH section 4), from the reserved effect list `strike, sweep, break_guard, step_through, mark, brace, second_wind, bleed` (PROGRESSION 4.2). A named rare tier-3 weapon may add one signature technique that names that item and takes a build slot like any technique (section 9.1, owner question 8); no other weapon carries a move of its own. A technique may name the weapon classes it needs (proposed), and only a signature technique names an item, so every hand of a class serves the rest:

| Effect | Classes it reads (proposed) |
|---|---|
| `strike` | any hand, bare hands included |
| `sweep` | blunt, staff |
| `break_guard` | blunt |
| `step_through` | spear |
| `brace` | spear, staff |
| `mark` | bow, sling, thrown |
| `second_wind` | any hand |
| `bleed` | blade, on a person only (section 11; owner question 5) |

"A bow shoots for anyone; Aim's first node is what puts a technique on it" (PROGRESSION 5.3). Combining two techniques is GROWTH's `after` rule, untouched.

### 9.1 Signature techniques on a few named weapons (proposed, owner question 8, default B)

- **Which weapons.** A found weapon of tier 3 or above and of rarity rare or above, with a name of its own (section 8.1), may grant one signature technique; at most one such weapon a class at a tier (proposed), so seven at most at tier 3. A made, bought or common weapon grants none.
- **What it is.** A technique in GROWTH's format (section 4 there) whose record names that one item where other techniques name classes, with its effect from the reserved list (PROGRESSION 4.2), never a new effect, and its own cost, wind-up and cooldown, under the swing floor and the power cap like every technique. Its name goes with the item's (a named greenstone mace's "ringing blow", say), so it reads as the weapon's.
- **What it costs.** It takes an active slot like any technique, so the build stays the limit (G86), and it is offered for a slot only once the wearer has the school's first node, as every technique of the hand is (PROGRESSION 5.3). It works only while that item is in the hand; swap the hand and the slot holds a technique that does nothing until the item is back.
- **Where it lives.** In the technique's record, not in the `weapon` block, so the block keeps its seven fields (section 3). It lands with combat and GROWTH's technique format as section 15 amends it (GROWTH 3.5, 4.2 `item?` and `classes?`, 4.3 `equip`, 4.5); the check holds the rule (section 16).

## 10. The staff with no spell

The staff is a long Strike hand: reach 2, standard tempo, made by Handcraft until Woodcraft's `shaft_true` lands (PROGRESSION 4.2; EQUIPMENT 3.7). It carries no spell, no charge and no element. Magic is paused, and if it comes, scrolls and books carry it (DECISIONS 2026-10-09 "If magic comes: scrolls and books carry it, and an ancient language is learned slowly"), never a staff. Decision 46's "the elf fast with spells" (DECISIONS 2026-10-22 "What a grade does") reads through techniques and that later page.

The walking staff (`tool.kind` `staff`, tier 1, 100 uses, `rare_find_pct` 5; content/core/items/tools.json:59-80) stays a tool: the word is shared by a tool kind (schema/src/index.ts:53) and a weapon class, and the derived category keeps them apart. Held in a fight it strikes as bare hands. Owner question 6 asks whether it becomes a named dual instead; as a dual it would drop its 100 uses (section 7).

## 11. Tone

The line is PEGI 16 and ESRB T (DECISIONS 2026-10-23 "The line is PEGI 16 and ESRB T: brutal in taste, never for show"):

- **A take shows no blood.** A weapon used on a hunted animal leaves a fade and a drop of goods; no suffering, no finishing a downed animal, no young animal and no pet is ever prey (HUNTING section 10).
- **No kill count.** No item, title, board or tooltip counts what a weapon felled; harm to animals is never a count (HUNTING 10). A quest's `defeat { foe, count }` (COMBAT 4.7) counts foes, never animals taken in a hunt, and never shows on the weapon.
- **`bleed` never on an animal** (proposed default, owner question 5): the effect over time applies to a person (the thief of COMBAT section 6), never to a creature of the bestiary, hunted or fought. A hit on a fought animal still shows where it landed at the sprite's size, as G83 says; only the effect over time is withheld.
- **No strike on someone who cannot act** (the line entry: "no violence against someone who cannot act"): a sleeping figure is never engaged until it wakes (proposed), and `behind_permille` (COMBAT 4.9) reads an unwatched side, never a sleeper.
- **Words.** A weapon's name and description are plain words (G22 as the line entry reads it); no gore word, no slur.

## 12. The held weapon's art

- **When.** Worn items are icons until stage 6 (DECISIONS 2026-10-09 "The upgrade: work clothes with a small capped bonus, and a look layer on the same slots", retry line; MATERIALS 6, #432). Nothing of a weapon is drawn on the body before then; the take tools are bag icons, reusing a base-kit placeholder sprite as the walking staff does (`core/base-kit:items/branch`, content/core/items/tools.json:66). A bag icon lives under a kit's `items/`, which the scale rule leaves out, so it declares no `scale` (NATURE 1: every world sprite of a kit, not `tiles/`, not `items/`, declares one; tools/src/kit/scale.ts:65).
- **Scale.** A prop drawn in the hand (stage 6) is seen in the world, so it is a world sprite outside `items/` (proposed) and declares `scale`, its drawn height in characters against the adult, which `pnpm check` reads and `pnpm art:scale` measures (docs/design/NATURE.md:55). No row of NATURE 1 or STYLE 1b gives a weapon a floor, so the audit lists it and judges nothing (tools/src/art/scale.ts:219); its length is judged by eye with the fight's stills. A sheet's drawn height is its tallest frame (tools/src/art/scale.ts:8-9), so the prop stays a sprite of its own, as the swap by class below already asks (proposed), and a long hand raised over the head never counts as the figure's height.
- **Outline.** The figure and its prop keep the dark ink outline of every sprite (DECISIONS 2026-10-23 "Every sprite has the dark ink outline"); only the kit's `creatures/` group leaves that rule (DECISIONS 2026-10-31 "Animals wear no outline: the creatures group leaves the ink rule"). The animal a hand meets keeps its own look, three-tone shading with no outline at the 3/4 camera (DECISIONS 2026-10-31 "The animals' look: three-tone shading, no outline, at the 3/4 camera"), and a hit on a fought animal shows where it landed at the sprite's size (G83; section 11).
- **The poses.** A human's attack is 6 poses, 18 frames at three views, inside the human's whole budget of 37 poses and 111 frames (129 with a second attack) (docs/design/ANIMATION.md:86). The budget counts one attack (two at 129), so the classes share the human's attack with the prop swapped by class (proposed), never a set per item; a class's own set (the bow's draw first) takes the second attack's place, and more than that is a budget change for ANIMATION, asked with the fight's stills. Tier shows by material colour on the same silhouette. Until the attack frames are drawn, the rig's work swing stands in, as mining falls back to the axe swing (DECISIONS 2026-10-25 "Stone is mined").
- **The wind-up is the telegraph.** ANIMATION's anticipation is 100 to 250 ms (docs/design/ANIMATION.md:57); a weapon's wind-up is 300 to 1000 ms. The anticipation's last pose is held for the rest of `windup_t`, so the timing table stays the work feel's and the wind-up stays readable (G31).
- **Asymmetry.** A weapon in one hand makes the figure asymmetric, and "A hero or a body with asymmetric gear is checked before it is mirrored" (docs/design/ANIMATION.md:91): the right facing either draws the hand or swaps the prop to the far hand by rule (proposed: swap, so the frame budget holds).
- **What waits with fights.** Hurt and death poses (docs/design/ANIMATION.md:30-31); the hit flash stays off (G29, docs/design/ANIMATION.md:58); the frame of a fight on screen is a direction decision that goes to the owner as phone-size stills first (docs/design/COMBAT.md:298).

## 13. What a weapon may never do

| Never | Rule | How it is held |
|---|---|---|
| Answer a hazard | G34; DECISIONS 2026-10-10 "A hazard is escaped, never answered by an item; road thieves wait for weapons"; G80 (proposed: the predator, the pit, the trap and deep water stay hazards and never foes), read as the demo stage's rule (section 15; owner question 9) | No schema field can name an item as a hazard's answer (GAME_RULES section 8, G34 row). The pit, the trap and deep water stay rules, escaped or avoided, and no item is ever their answer. A predator is a hazard until combat lands: the start is weaponless and safe (decision 42; G35). With combat the wolf and the other predators are foes that can be fought, and the run stays one answer, never the only one (owner question 9, default A). A creature is a foe or a hazard by its record, never by what the player holds. |
| Open a door | PROGRESSION 5.5 ("it never opens a door that was shut"); EQUIPMENT 4 rule 2 (a weapon works no node) | A check row with combat: no restore, gate, node `tool` or quest step asks for an item of category `weapon` or a weapon class. A weapon block names no tool kind, so `bestTool` never finds it. |
| Be sold for money | G39 ("No crafted ability, recipe, material or tool is sold or gated for money or premium currency") | The premium marker stays on looks only (GAME_RULES section 8, G39 row). Gold is not money: a weapon trades for gold in the free market (R8). No shop sells a made tool, weapon or ammunition of tier 2 or more (DECISIONS 2026-10-09 "The workshop makes better tools that no shop sells; the 30-gold tools stay"); the check row lands now (section 16) and covers the tier-2 spear, which is a `tool` by category until combat gives it a weapon block, and every pick QUARRYING makes from tier 2 (QUARRYING 6, "No shop sells a pick"). A tier-1 hand only at the floor, and only if no workshop recipe for it is priced above that (R8; the 30-gold decision's last line). |
| Be bound for power | EQUIPMENT 3.6 | `bind` stays `none` on every weapon. |
| Be a start item | decision 42; the race outfit's "Never a weapon" (schema/src/index.ts:917); tools/src/races.ts:51 ("never a weapon, never a pocket's tool"), :67 ("no weapon kind exists until the combat wave") | A row with combat in tools/src/races.ts refuses a weapon in a race outfit or as a wake pocket's find. The same row keeps one from reaching a stored save: a content release hands a race's outfit piece to an old save once (kernel/src/adapt.ts:40-49), and only from that outfit. No starter kit exists: the races replaced it (tools/src/check.ts:558). |
| Skip a swing | COMBAT 4.9 | One cooldown for the hand; a swap waits for it. |
| Strike in a town, a camp or a house | SETTLEMENT 3.9 as COMBAT 4.5 reads it (docs/design/COMBAT.md:209) | No foe stands there (G80); no player harms another there. |

## 14. Beyond RuneScape, on purpose

| Row | RuneScape (Old School) | Loomvale | When |
|---|---|---|---|
| Tools by the animal they take | Hunter is built on method-specific tools: a separate tool for each way of catching and each kind of creature ([Hunter](https://oldschool.runescape.wiki/w/Hunter)) | One ladder by prey size, not by creature: a smaller tool still takes, one quality lower, and a hunt is never refused for the wrong tool (HUNTING 5); the same sling, spear or bow later becomes the first fight hand (section 1). | waits (the take verb, then combat) |
| Wield requirement | A level requirement to wield, per weapon ([Rune scimitar](https://oldschool.runescape.wiki/w/Rune_scimitar)) | The soft wear requirement: held at any level, its harm active up to one tier above the wearer's own (section 8). | waits (combat) |
| Making | Smithing levels gate which items can be made ([Smithing](https://oldschool.runescape.wiki/w/Smithing)) | No level wall on making (G40); a recipe above the level runs at a lower chance. | built (G40) |
| Wear and repair | Some items lose a charge per hitsplat and are repaired at a cost ([Item degradation](https://oldschool.runescape.wiki/w/Item_degradation)) | No hand wears: a player keeps a weapon as long as he likes and keeps ammunition stocked instead; tools wear and are mended at a bench with a whetstone or cord; no repair for gold (sections 6, 7). | waits (the first shot; the first mend, for tools) |
| Special moves | Special attacks belong to specific weapons and spend the player's special energy ([Special attacks](https://oldschool.runescape.wiki/w/Special_attacks)) | Moves live in the build's active slots and read a class; a few named rare tier-3 weapons add one signature technique that takes a slot like any other, so the build stays the limit and no energy bar is added (section 9). | waits (combat) |
| The hit | A maximum hit from strength and the bonus offset by a constant, then a roll ([Maximum melee hit](https://oldschool.runescape.wiki/w/Maximum_melee_hit)) | A fixed hit per hand, no roll; an offset of our own that only sets the unit of harm (section 4). | waits (combat) |
| Tempo | Attack speed in game ticks per weapon ([Attack speed](https://oldschool.runescape.wiki/w/Attack_speed)) | Three named tempos on one cooldown, and a rate cap so tempo trades size for openings, never output (sections 3 and 4). | waits (combat) |
| Ammunition | Worn in its own slot; a share of fired ammunition comes back with a device, the rest breaks or drops ([Ammunition](https://oldschool.runescape.wiki/w/Ammunition); [Ava's device](https://oldschool.runescape.wiki/w/Ava%27s_device)) | Ammunition with a tier and a head: a launcher fires only its class at its own tier or below, and a head suits a prey size; carried in a quiver that takes the bag's place; no recovery roll (section 6). | waits (the first shot) |
| Tool and weapon | A pickaxe has one level to use and another to wield ([Pickaxe](https://oldschool.runescape.wiki/w/Pickaxe)) | Two blocks, two readers; both only by a named recipe with a cap (section 1). | this wave: the block and its refusing row; the mark waits (combat) |

## 15. New against existing rules

| Rule | The clash | The resolution |
|---|---|---|
| G35 (docs/design/GAME_RULES.md:405-406: "nothing of a fight is built before the server and the presence relay") and COMBAT 4.9 (docs/design/COMBAT.md:238: the group "enters `params.json` with the fight's first kernel pull request") | A weapon grammar landing now | Kept. Only the schema block, the row that refuses every weapon block, the derived category and two guard rows land; the `combat` params, `handHarmMax`, the shape and dual rows and every weapon item wait for that pull request. The precedent is the hunt foundations, which landed grammar ahead of G35 while felling nothing (DECISIONS 2026-10-30 "The hunt foundations: a `dress` verb, drops and grades on the creature kinds, `hunt` as the fifth value source (kernel 0.22.0)"), and metal's grammar before its content (DECISIONS 2026-10-09). |
| HUNTING (docs/design/HUNTING.md:9: nothing built before the server and the creature schema) and QUARRYING 3 ("A mineral lands with its first consumer") | The take tools as craftable items with no take verb to read them (kernel/src/hunt.ts:2-3: nothing takes an animal) | Kept. The take tools, their parts, scraps, classes, tool kinds and dig spot wait for the take verb's kernel pull request, which builds those rows (Waits, first table). |
| G79 (COMBAT section 5, proposed) against COMBAT 4.9's damage row (docs/design/COMBAT.md:257) | The damage row draws every hit; G79 allows only two draws | Default: harm fixed per hand; the damage row is amended (drop the draw, keep "at least 1 after defence"). Alternatives: G79 names a third draw, or the band is drawn once per foe inside the first draw; any draw that stands is the server's, on its seed (G102). Owner question 1. |
| COMBAT 4.9, hand compression: "the hand's bonus counts as `bonus + 64` \| 64 \| none" (docs/design/COMBAT.md:258), and DECISIONS 2026-10-29 "Animals, then the foundations of combat and hunting, then the movement set, beside the first map", which records it: "with the hand's bonus counted as bonus + 64" (DECISIONS.md:3758) | R12 (every number a param with a range and a step); this page compares an outside game and never copies its numbers (section 14): 64 is an outside game's maximum-hit constant, carried in through research memo 6 (docs/research/research-combat.md:39, :180) | Amend the row: `hand_offset` {128, 96 to 256, 32} (proposed), our own number by its job (section 4); the 2026-10-29 entry takes an "Amended (01.11)" line. |
| DECISIONS 2026-10-25 "The progression map, balance: two red lines, rising ceilings, walls proven both ways" and "The progression map: who owns each ceiling" (`strike`, `aim`, `guard` owned by their schools, reserved, with combat) | `hand_rate_max_permille` written as a fixed table per tier | Read as the Strike and Aim ceilings by band: rising, owned by those schools, reserved until combat. A ceiling raiser of the school may lift a step; the table is the base, not a fixed cap. |
| EQUIPMENT 3.3 sketch: `weapon { class, reach, windup_ms, cooldown_ms, harm_pct, uses? }` | COMBAT 4.9 counts every duration in ticks, keeps one cooldown for the hand, and puts a player's strike in points over `harm_pct`; EQUIPMENT 3.1 derives, never stores | Amend the sketch to section 3's block, seven fields: `tempo`, `windup_t`, `reach`, `harm`, `range?`, `ammo?`, `noise?`; no `uses?` (a hand never wears, section 7, owner question 7); the class is the item's own. EQUIPMENT 3.3 already defers its numbers to COMBAT. |
| COMBAT 4.3 `attack` row ("`windup_ms` of the weapon", "the weapon's `cooldown_ms`", "`harm_pct`") | The same as above, inside COMBAT itself; 4.9 already says "Memo 4 over the frame's cooldown per weapon" and "Memo 6 over the frame's `harm_pct`" | Amend the 4.3 row to read the block in ticks and points, as 4.9 decided. |
| PROGRESSION 7 (docs/design/PROGRESSION.md:550): `weapon?: {reach, harm_band, school}` with combat | A third older shape: a harm band against section 4's fixed harm, and the school inside the block | Amend the line to section 3's block, the school in the `wear` block's `req` (section 8); its content still waits for combat. |
| HUNTING 5: the spear "Thrust 1, throw 4" (docs/design/HUNTING.md:78) | The weapon block gives the spear reach 2 and no throw | Kept both, read apart: thrust 1 and throw 4 are the take's fields and land with the take verb, from HUNT_LADDER's range column; the fight reads the block's reach 2 (COMBAT 4.9, a long hand). A spear is never thrown in a fight (proposed). |
| PROGRESSION 5.1, six weapon classes | The sling is a seventh | Amend 5.1. Owner question 2. |
| PROGRESSION 4.2: Strike "(blades, blunt, spear ...)" and Aim "(bow, thrown; the quiver on the back)" (docs/design/PROGRESSION.md:175-176) | This page puts the staff under Strike and the sling under Aim | Amend both lines: Strike adds the staff, Aim the sling (proposed). Owner questions 2 and 6; both lines stay as written until they are answered. |
| EQUIPMENT 3.1, the closed category list | Ammunition has neither block | Amend the `tool` row: "a `tool` or `ammo` block and no `weapon` block"; the `material` row's list of blocks it has none of names `ammo` too. No eighth category. |
| EQUIPMENT 3.7 (blade and blunt by Smithing; bow, staff and spear by Woodcraft) and PROGRESSION 5.1 ("bows and staves from Woodcraft") | Smithing is city only and metal waits; Woodcraft is a foundation with no recipe yet | Before Woodcraft and metal, Handcraft makes every hand of tiers 1 to 3 (section 5.2), the recipe naming Handcraft as its profession; Woodcraft takes the spears, staves, bow, stave and club when it lands, and Smithing blade and blunt from tier 4. EQUIPMENT 3.7's stone blades of tiers 1 to 2 are the flint and slate knives; the built `core/stone-blade` stays a material. |
| HUNT_LADDER's source (tools/src/balance/hunt-ladder.json:75-102): the bow's three tier-1 inputs; HUNTING's "wood and flint" read as the stone blade | G41's one-tier climb (tools/src/check.ts:407-412); QUARRYING 3 lands `core/flint` | The source row is corrected (the bow: stave and string; the spear's head: `core/flint`) and HUNT_LADDER is regenerated, never edited, with the take verb (Waits). |
| HUNT_LADDER, spear (tier 2) and bow (tier 3) as made tools | DECISIONS 2026-10-10 "First-tier recipes are known from the start; higher tiers are dug up"; templates are start-known (tools/src/assemble.ts:501) | Plain recipes with `known: found`, each taught by a scrap found in the hunters' cache (section 5.4). |
| CLOTHING 6: tier-2 scraps at the gate rubble, tier-3 at the deep ruins | This page's scraps hold tiers 2 and 3 in one spot | Kept, made a wave rule (proposed): the split governs rows that join an existing table; a page's own spot may hold both tiers, as QUARRYING's yard does. |
| Schema `tool.tier` 1 to 5 (schema/src/index.ts:238) | A dual hand past tier 5 | A dual hand past tier 5 needs `tool.tier` raised, a core schema change (G45), named in Waits. A hand states no `uses`, so `uses`' bound (:240) never meets a hand. |
| Decision 42: the elf's "pouch or quiver as jewellery" | The back holds one bag or one quiver (DECISIONS 2026-10-23 "Bags on the back: 12, a satchel 24, a frame pack 36"; schema/src/index.ts:150-157) | Kept, named apart: decision 42's piece is jewelry that holds nothing; only the back's quiver holds ammunition. |
| DECISIONS 2026-10-23 "The owner's answers on the bag": "an axe fights, but weakly" | EQUIPMENT 4 rule 1: a tool strikes as bare hands | Asked: owner question 3 (default A, as bare hands). |
| EQUIPMENT 3.4 and PROGRESSION 5.4, the mend recipe | Wear is a counter per item id (kernel/src/step.ts:1754-1767), so a recipe from the tool to the tool restores nothing; CR-16 (tools/src/check.ts:429-442) and G40's miss row (`left >= success`, :423-428) both refuse it | A `mend` mark that clears the counter; the check prices the worn tool, as input and as what a miss keeps, at `mend_below_permille`, and the output at full value, so the miss keeps less than a success (section 7). The mark serves tools only. |
| EQUIPMENT 3.1's `weapon` row (docs/design/EQUIPMENT.md:46: "reads in a fight; may wear out"); EQUIPMENT 3.4 (docs/design/EQUIPMENT.md:100: "tools and weapons wear by use; armour and clothing never wear out"; "Smithing's `edge_hold` slows a blade's wear"); EQUIPMENT 5's durability row, its proposal cell (docs/design/EQUIPMENT.md:151: "tools and weapons wear by use; clothing and armour never; mended at a bench"); PROGRESSION 5.4 (docs/design/PROGRESSION.md:471: "Tools and weapons wear by uses"; :472, `edge_hold` moves uses), its row of the rules table (:632: "a weapon is a hand-slot thing with uses, as a tool") and its outside reference (:705: "tools and weapons wear by uses"); PROGRESSION 4.2's Smithing row (:167: `edge_hold`, "a blade loses uses slower") | A hand never wears (section 7) | Amend each line, held by owner question 7 (default A): "tools wear by use; a weapon never wears; armour and clothing never wear out"; 3.1's `weapon` row (docs/design/EQUIPMENT.md:46) reads "reads in a fight; never wears (WEAPONS 7)"; the durability row's cell (docs/design/EQUIPMENT.md:151) reads "tools wear by use; weapons, clothing and armour never; a tool is mended at a bench"; docs/design/PROGRESSION.md:632 reads "a weapon is a hand-slot thing with no uses; ammunition is spent"; `edge_hold` reads "a metal tool's edge loses uses slower". On answer B the lines stay as written. |
| G34's predator line (docs/design/GAME_RULES.md:387-392: "A hunting hazard (the wolf, the hidden pit, the trap, deep water at night) is escaped by running back to a safe place"); G80 (proposed, docs/design/COMBAT.md:306: "The predator, the pit, the trap and deep water are hazards (G34) and never foes"), held by the frame's owner questions (docs/design/GAME_RULES.md:546-548); COMBAT 2 (docs/design/COMBAT.md:27: "no hazard ever becomes a foe; the predator stays a hazard, its answer the run"); COMBAT 4.1 (docs/design/COMBAT.md:162: "The predator (`hazard` prop) is untouched except for round 4: ... never moves, never joins a fight, and the chase stays as P-5 built it"); HUNTING (docs/design/HUNTING.md:9: "G34 holds: the predator on its round is a hazard, escaped by a run"; :139, question 4: "The frame keeps the predator on its round a hazard that never becomes a foe ... while the bank wolf on its round stays the hazard"); BESTIARY (docs/design/BESTIARY.md:5: "a hunter here is a hazard that is escaped (G34), never a foe"; :45: "G30 and G34 keep it a hazard"; :65: "the bank wolf stays the hazard on its round (question f)"; :84, question (f): "a hazard with a den, tracks and a round (G34)"); DECISIONS 2026-10-25 "The progression map, Q8: two bars only; places are harsh, gear answers them (the owner, 25.10)" (DECISIONS.md:3139: "a hunting hazard is still answered by the run"); the message in tools/src/wild.ts:185 ("no spot until the fight lands; the bank wolf stays the hazard on its round") | With combat the wolf and the other predators are foes that can be fought (section 13) | Read as the demo stage's rule, as G35 already is (docs/design/GAME_RULES.md:400-401: "In the demo (stage 1) predators are hazards, not enemies"; DECISIONS 2026-10-19 "G35 is the demo's rule: combat is a core part of the game, after the foundation"; DECISIONS 2026-10-10 "A hazard is escaped, never answered by an item; road thieves wait for weapons" names its retry as "combat opens"). Each line takes "until combat lands": G34's predator stays a hazard, its answer the run, until combat lands, and after it the run stays one answer, never the only one; G80 and COMBAT 2 keep the pit, the trap and deep water as hazards and never foes, and the predator until combat lands; HUNTING :9 and :139 likewise. COMBAT 4.1 reads: a predator kept as a hazard prop is untouched in the fight's kernel except round 4, never moves and never joins a fight, and its chase stays as P-5 built it; a predator laid as a foe (the combat pull request) stands in the map's `foes` block (docs/design/COMBAT.md:161) and is fought as any foe, the run still one answer. BESTIARY :5, :45, :65 and question (f) at :84 take "until combat lands": a hunter there is a hazard that is escaped (G34) until combat lands, then a foe that can be fought. The 2026-10-25 entry's "a hunting hazard is still answered by the run" (DECISIONS.md:3139) reads "a hunting hazard is still answered by the run, and once combat lands a predator also by a fight": the place conditions that entry opened to gear stay as decided, and the pit, the trap and deep water are still answered by the run. The start stays weaponless and safe (decision 42). The pit, the trap and deep water stay rules, and no item is ever their answer. The words are amended with owner question 9's answer (default A); the wild.ts message changes in the combat pull request, which lays the first predator as a foe. |
| HUNT_FAMILIES 3a "Arrows by size" (docs/design/HUNT_FAMILIES.md:257: the blunt arrow for small prey, the broad for medium and large, "the wrong arrow takes at one quality lower in either direction") and HUNTING 5's smaller tool (docs/design/HUNTING.md:82); HUNT_LADDER's source (tools/src/balance/hunt-ladder.json:268-269, :275-276: both arrows at craft tier 3, level 6 and no station, the bow's tier carried on its variant rows; their inputs, the broad head of `core/stone-flakes`; docs/design/HUNT_LADDER.md:49-50, :119) | The `ammo` block's `head` replaces the first draft's `size?`, adds a third arrow head, `barbed`, and asks whether the head's step and the tool's step add; section 6.2 makes each arrow its own tier-1 recipe (tier 1, level 2, workshop tier 1), not the bow's tier 3 | Kept, and extended: blunt and broad suit what 3a says; `barbed` suits no prey size, so a take with it is always one quality lower (section 6.1). The two steps are one step together, never two, floor 1 (proposed). The source's broad head becomes `core/flint`, and both arrow rows move to `craftTier` 1, `level` 2, `station` "work-stone" (workshop tier 1), as section 6.2 has them. Their inputs (the branch, a bone or `core/flint`, the feather of the tier-1 crow, tools/src/balance/hunt-ladder.json:320) are all tier 1, so a tier-3 arrow would fail G41's one-tier climb (tools/src/check.ts:407-412), as the bow's row does. The ladder's 3 (6) stays the bow's, and the tier-3 bow fires tier-1 arrows by the matching rule (section 6.1). The arrows' rows land with the feather, the page regenerated, never edited, and its tier table then counts both arrows among the tier-1 rows. |
| G86 (docs/design/GAME_RULES.md:577-578: "The techniques a fight offers are the build's active slots") and PROGRESSION 5.3 (docs/design/PROGRESSION.md:460: "a bow shoots for anyone; Aim's first node is what puts a technique on it") | A signature technique names one item (section 9.1) | Kept: it takes an active slot like every technique and waits for the school's first node, so the build stays the limit. Owner question 8. |
| GROWTH 3.5 (docs/design/GROWTH.md:62: a technique is "The thing a major or corner node teaches, and the thing a slot holds"); 4.2 (:102-116: the technique record has no class or item field); 4.3 (:125: `equip` needs "the technique learned"; built so: a technique is a school node with `slot: true`, schema/src/index.ts:1162, :1181-1185, and kernel/src/step.ts:1432 refuses an unlearned one with "You have not learned that."); 4.5 (:146: `slot_slack` counts the techniques a player could have learned) | A technique names the weapon classes it reads (section 9). A signature technique is granted by carrying its item and is never taught by a node or a book (section 9.1) | Amend, with combat's schools. 3.5 reads "the thing a major or corner node teaches, or that a signature weapon grants while it is carried (WEAPONS 9.1), and the thing a slot holds". 4.2's combat record gains two optional fields: `classes?` (the weapon classes it reads, section 9's table; none means any hand) and `item?` (a signature technique only, never with `classes`). 4.3's `equip` accepts a signature technique while its item is in the bag or the hand and the first node of the hand's school (its `wear.req.school`, section 8) is learned; that costs no point and adds no Player field. The technique works only while the item is in the hand, and unlearning that first node drops it from the build. 4.5's `slot_slack` row counts at most one signature technique at a level (one hand holds one item); the school-value row leaves it out, since it belongs to no school and the solver prices it with its found item (section 8.1). `classes?` is this page's proposal and lands with combat's first nodes (GROWTH 5.1). `item?`, the grant and the 3.5, 4.3 and 4.5 words are held by owner question 8 (default B); on A they drop and those lines stay as written. |
| DECISIONS 2026-10-27 "An attribute bonus counts as a common piece's one effect (owner's pick)" and PROGRESSION 9's 27.10 calls (docs/design/PROGRESSION.md:603: "a common piece carries one thing"), landing in 5.7 | A common, bought or made weapon carries no bonus at all (section 8.1) | Kept: stricter on the hand, whose one thing is its harm. |
| PROGRESSION 4.2: `bleed` in the reserved effect list | HUNTING 10: no blood on an animal, no suffering | `bleed` only on a person. Owner question 5. |
| COMBAT 4.9: T1 "felled in 2 hits of a starter hand" | Decision 42: no start weapon; at character level 1 the power cap is 1000 (content/core/params.json:66) | The starter hand is the first tier-1 standard hand a player can make; hits are counted at full harm; bare hands still win in 3 (section 4). |
| ANIMATION: anticipation 100 to 250 ms | A weapon's wind-up is 300 to 1000 ms | Kept both: the anticipation's last pose is held for the wind-up (section 12). |
| TOOL_KINDS `staff` (schema/src/index.ts:53) | The weapon class `staff` | Kept: one word, two readers; the derived category separates them (section 10). |
| G59 and its world lock (DECISIONS 2026-11-01 "The world lock"; `content/world.lock.json`, tools/src/lock.ts:1-9; #606): a change that lengthens a leg of the opening, moves where it runs or changes a pay is refused | `core/hunters-cache` takes a new ruin slot by the south ruins passage, which opens by wake (section 5.4) | Kept, as QUARRYING 15 keeps its five slots: the cache changes no pay and means to move no leg; its pull request's `pnpm check` reads the lock, and a slot that lengthens or moves a leg moves to other open tiles of its region, never to a re-anchor. |

## 16. Check rows

Build now (appendix):

- x tools/src/check.ts: a weapon waits for combat: no weapon block yet (G35, G44) (WEAPONS 3)
- x tools/src/check.ts: a shop that sells a tool, a weapon or ammunition of tier 2 or more, by derived category (WEAPONS 13)
- x tools/src/check.ts: a `known: found` recipe that no fragment's `unlocks` and no quest reward's `recipes` teaches (WEAPONS 5)

With combat, in the pull request that lifts the first row (Waits):

- x tools/src/check.ts: a weapon names one of the seven weapon classes: `core/blade`, `core/blunt`, `core/spear`, `core/staff`, `core/bow`, `core/thrown`, `core/sling` (WEAPONS 2)
- x tools/src/check.ts: a weapon's reach is 1, or 2 for a spear or a staff (WEAPONS 3)
- x tools/src/check.ts: a weapon's wind-up is at least `bare_windup_t` and below its tempo's swing (WEAPONS 3)
- x tools/src/check.ts: a hand's strike rate is over its tier's `hand_rate_max_permille` (times `range_rate_permille` for a ranged hand) (WEAPONS 4)
- x tools/src/check.ts: only a bow or a sling names `ammo`, and a bow or a sling must; only a bow, a sling or a thrown hand has `range`, and each of them must (WEAPONS 3, 6)
- x tools/src/check.ts: a weapon's noise lies outside `wild.strike_noise`'s range (WEAPONS 3)
- x tools/src/check.ts: a weapon with no `wear` block on slot `hand` (WEAPONS 3)
- x tools/src/check.ts: an item with both a `tool` and a `weapon` block carries no `dual_use` mark (WEAPONS 1)
- x tools/src/check.ts: a `dual_use` mark on an item with no `tool` block (WEAPONS 1)
- x tools/src/check.ts: more `dual_use` items than `dual_use_max` (WEAPONS 1)
- x tools/src/check.ts: an item with a `weapon` block whose `tool` block states `uses`: a hand never wears (WEAPONS 7; owner question 7, default A)
- x tools/src/check.ts: a recipe with the `mend` mark whose tool has a `weapon` block (WEAPONS 7; it reads the `mend` mark, so it lands with combat or the first mend recipe, whichever lands later)
- x tools/src/check.ts: a restore, gate, node or quest step that asks for a weapon or a weapon class (WEAPONS 13)
- x tools/src/races.ts: a weapon in a race outfit or as a wake pocket's find (WEAPONS 13)
- x tools/src/check.ts: a weapon's `wear.req.school` that is not `strike` or `aim` (WEAPONS 8)
- x tools/src/check.ts: a `bleed` technique that can reach a creature of the bestiary (WEAPONS 11)
- x tools/src/check.ts: a launcher whose `weapon.ammo` class holds an ammunition whose `for` is not that launcher's class (WEAPONS 3, 6)
- x tools/src/check.ts: an ammunition's `harm_add` above its head's share of its tier's top (blunt and plain 0, broad half, barbed and shaped the top), or a launcher's `harm` plus the `harm_add` of any ammunition it may fire over `handHarmMax` of the launcher's tier (WEAPONS 4, 6.1)
- x tools/src/check.ts: a launcher's `range` plus any `range_add` it may fire over 12 (WEAPONS 6)
- x tools/src/check.ts: a weapon's `wear` block that names a worn effect of `WORN_EFFECTS` (WEAPONS 8.1)
- x tools/src/check.ts: a weapon with `wear.attrs` or a `weapon.trait` that is common, of tier 1, made by a recipe, sold by a shop, or beyond its rarity band's row (WEAPONS 8.1)
- x tools/src/check.ts: a `weapon.trait` word outside its class's list (WEAPONS 8.1)
- x tools/src/check.ts: a signature technique that names an item which is not a found weapon of tier 3 or more and rarity rare or more; two signature techniques on one item; two signature weapons of one class at one tier (WEAPONS 9.1; owner question 8, default B; also waits for GROWTH's technique format, amended in section 15)

With the first shot (Waits):

- x tools/src/check.ts: an `ammo` block whose `for` is not a launcher class (`core/bow`, `core/sling`), or an item with both `ammo` and `tool` (WEAPONS 6)
- x tools/src/check.ts: an `ammo` block whose `head` is outside its class's list: `blunt`, `broad`, `barbed` for `core/bow`; `plain`, `shaped` for `core/sling` (WEAPONS 6.1)
- x tools/src/check.ts: an ammunition whose tier is above every launcher of its `for` class (WEAPONS 6.1)
- x tools/src/check.ts: a launcher tier that exists with no ammunition it may fire; the loose `core/stone` counts as the sling's tier-1 shot (WEAPONS 6.1; it holds the bow until a feather item and its first arrow land)

With the first weapon content (Waits):

- x tools/test/weapons.test.ts: the committed matrix page equals what `pnpm weapons` prints (WEAPONS 5.5)

## 17. Owner questions

1. **Harm: fixed or drawn?** A: fixed per hand, COMBAT 4.9's damage row loses its draw (G79 as written). B: the band draw stays per hit, and G79 names it as a third draw. C: the band is drawn once when a foe appears, with its pattern (inside G79's first draw), so every hit on that foe is fixed and the fight is still read. **Default: A.**
2. **Which take tools also fight, and the sling's class?** A: the sling, the spear and the bow as named duals under `dual_use_max` 4, the sling its own seventh class under Aim. B: the same three, with the sling folded into `thrown`. C: only the spear; the sling and the bow stay take tools and fight hands are separate items. **Default: A.**
3. **A tool in a fight ("an axe fights, but weakly", DECISIONS 2026-10-23).** A: every tool-only hand strikes as bare hands (EQUIPMENT 4 rule 1). B: every tool-only hand strikes a small fixed step above bare hands (a param, proposed `tool_strike_permille` 1050). C: only the axe gets that step. **Default: A.**
4. **Ammunition after a shot.** A: spent, nothing comes back. B: a counted return, every second shot whole, no draw. C: the shot lies on its tile as a ground item to pick up (`player.ground`, DECISIONS 2026-10-23). **Default: A.**
5. **`bleed`.** A: on a person only, never on any animal, hunted or fought. B: dropped from the list. C: on any foe, never on a hunted animal. **Default: A.**
6. **The staff.** A: a long Strike hand with no spell. B: no staff weapon until magic. C: the walking staff becomes a named dual instead of a new item. **Default: A.**
7. **Weapon wear.** A: no wear: a hand never wears and is never mended; the `weapon` block has seven fields and no `uses`, a dual item's `tool` block states none, and the tools that are not hands (the snare, the picks, the trowels, the axe) keep the built wear and the mend (sections 3 and 7). B: one use per landed hit, as first proposed: `weapon.uses` 1..1000 back in the block (an additive field), 60, 120, 240 for tiers 1 to 3, 480 and 960 for tiers 4 and 5, 960 past tier 5; the sling 60, the spear 120, the bow 240 on one counter with their `tool.uses`; a hand mended with the whetstone or cord; and the wear lines of EQUIPMENT 3.1, 3.4 and 5 and PROGRESSION 4.2 and 5.4 kept as written (section 15). **Default: A.**
8. **Signature techniques.** A: weapon bonuses and traits only (section 8.1): section 9.1 drops out and no weapon carries a move of its own. B: also a signature technique on a few named weapons: found, tier 3 or more, rare or more, one a class a tier, in GROWTH's format, taking a build slot (section 9.1); GROWTH 3.5, 4.2, 4.3 and 4.5 amended so (section 15). C: neither bonuses nor signatures: a found weapon is its harm and shape only. **Default: B.**
9. **Predators once combat lands.** A: G34's predator line, G80, COMBAT 2 and 4.1's predator line ("never joins a fight"), HUNTING's and BESTIARY's predator rows and the 2026-10-25 entry "The progression map, Q8"'s "a hunting hazard is still answered by the run" (DECISIONS.md:3139) are the demo stage's rule: with combat the wolf and the other predators are foes that can be fought, the run stays one answer, the weaponless start stays safe (decision 42), and the pit, the trap and deep water stay hazards (sections 13 and 15). B: the predator on its round stays a hazard for good, its answer the run, and a fight's foe is a creature standing as a foe apart from it, as HUNTING question 4's default reads the first wolf (docs/design/HUNTING.md:139). **Default: A.**
10. **Ammunition's grades.** A: the `ammo` block carries `for`, `shots`, `harm_add`, `head` and `range_add?`, the item's own tier is the grade, and a launcher fires only its own class at a tier at most its own (sections 6 to 6.2). B: one plain ammunition a class (`for`, `shots`, `range_add?` only), every launcher tier firing it, no head and no `harm_add`; the head's prey-size step of HUNT_FAMILIES 3a moves to the arrow's item, as first drafted with `size?`. **Default: A.**
11. **Bonuses and traits on found weapons.** A: a found weapon of tier 2 or more carries an attribute bonus and, from rare up, one weapon trait from its class's list, by the table of section 8.1, under the one power cap; a common, made, bought or sold weapon carries none. B: attribute bonuses only, no weapon traits. C: none: a weapon's power is its harm alone. **Default: A.**
12. **The matrix as a report.** A: once the first weapon is content, `pnpm weapons` prints class by tier and the ammunition matrix from content and the params, and a test pins the page to the print (section 5.5). B: the matrix stays this page's tables, checked by the rows of section 16 only. **Default: A.**

## 18. Not here

The foes, their patterns and tiers' content (COMBAT section 6); the techniques' format and nodes (GROWTH; the schools with the first foe); armour, `guard_pct`, `quiet_wear` and defence (CLOTHING.md); the metal chain, ore, smelting and the forge, flint, slate, greenstone and the whetstone (QUARRYING.md); the take verbs, their thrust and throw, noticing and the hunt's pay (HUNTING, HUNT_LADDER); the feather item the arrows wait for (the hunt's goods, HUNT_LADDER); the first predator laid as a foe and its pattern (the combat pull request, COMBAT section 6); the fight's wire, bars and zone (COMBAT 4.4 to 4.6); a shield or an off hand (EQUIPMENT 3.2: none, the guard is a verb); quality's storage (EQUIPMENT 3.3b); the depth measure against an outside game (GAP_RS_GEAR); the stills of a fight on screen.

## Sources

Outside games (comparison rows only):

- Old School RuneScape wiki, Hunter: method-specific tools, a separate tool for each way of catching and each kind of creature. https://oldschool.runescape.wiki/w/Hunter
- Old School RuneScape wiki, Attack speed: hit intervals in game ticks of 0.6 s. https://oldschool.runescape.wiki/w/Attack_speed
- Old School RuneScape wiki, Maximum melee hit: base damage from effective strength times the bonus plus a constant offset, over a divisor. https://oldschool.runescape.wiki/w/Maximum_melee_hit
- Old School RuneScape wiki, Special attacks: unique abilities of specific weapons, paid from the player's special attack energy. https://oldschool.runescape.wiki/w/Special_attacks
- Old School RuneScape wiki, Rune scimitar: a level requirement to wield. https://oldschool.runescape.wiki/w/Rune_scimitar
- Old School RuneScape wiki, Smithing: different levels are required to make different items. https://oldschool.runescape.wiki/w/Smithing
- Old School RuneScape wiki, Item degradation: a charge lost per hitsplat, repaired at a cost. https://oldschool.runescape.wiki/w/Item_degradation
- Old School RuneScape wiki, Ammunition: worn in the ammunition slot, the quiver; consumed by ranged weapons. https://oldschool.runescape.wiki/w/Ammunition
- Old School RuneScape wiki, Ava's device: a share of fired ammunition retrieved, the rest broken or dropped. https://oldschool.runescape.wiki/w/Ava%27s_device
- Old School RuneScape wiki, Pickaxe: one level to use, another to wield (EQUIPMENT S6). https://oldschool.runescape.wiki/w/Pickaxe

Ours:

- GAME_RULES: G22, G29, G31, G34 (docs/design/GAME_RULES.md:387-392), G35 (docs/design/GAME_RULES.md:400-407), G39, G40, G41, G43, G44, G45, G70, G83, G86 (docs/design/GAME_RULES.md:577-582), G102 (docs/design/GAME_RULES.md:303-308); the frame's held rules (:546-548); section 8 rows G34, G39, G41, G44, G45.
- EXPERIENCE_AUDIT row 14 and N4 (docs/design/EXPERIENCE_AUDIT.md:50, :124). NATURE section 1, the scale rule (docs/design/NATURE.md:55).
- COMBAT (proposed): section 2 (docs/design/COMBAT.md:27), 4.1 (docs/design/COMBAT.md:161-162), 4.3, 4.5, 4.7, 4.9 (docs/design/COMBAT.md:238, :257-259), section 5 (G79, G80 at :306), section 6.
- EQUIPMENT sections 3.1 (docs/design/EQUIPMENT.md:46), 3.2, 3.3, 3.3b, 3.4 (docs/design/EQUIPMENT.md:100), 3.6, 3.7, 4, 5 (the durability row, docs/design/EQUIPMENT.md:151). PATHS section 4 (the floor per path).
- PROGRESSION 4.2 (docs/design/PROGRESSION.md:167, :175-176), 5.1 to 5.7 (5.3 at :460; 5.4 at :471-472; 5.7's table at :501-506), 7 (:550), 9's 27.10 calls (:603), its rules table (:632) and outside references (:705).
- HUNTING (docs/design/HUNTING.md:9, :78, :82, :139) sections 4, 5, 10; HUNT_LADDER section 1 (docs/design/HUNT_LADDER.md:49-50, :119), its source tools/src/balance/hunt-ladder.json (:268, :269, :275, :276, :320, :322, :378), its calculators tools/src/balance/hunt-ladder.ts and hunt-ladder-cli.ts and its test tools/test/hunt-ladder.test.ts; the wild spots' check, tools/src/wild.ts:185; HUNT_FAMILIES 3a (:256, :257) and :26, :312; MATERIALS 2, 3.3, 3.4, 6 and BESTIARY_LANDS :58 (#432, landed 01.11; proposed); BESTIARY (docs/design/BESTIARY.md:5, :45, :65, :84).
- GROWTH 3.5, 4.2, 4.3 and 4.5 (docs/design/GROWTH.md:62, :102-116, :125, :146) and 5.1; the built technique node (schema/src/index.ts:1162, :1181-1185) and its `equip` (kernel/src/step.ts:1429-1432).
- This wave's pages: QUARRYING 2.1, 3, 6 (flint, slate, greenstone, the yard, the whetstone, no shop sells a pick); CLOTHING 6 (the scrap split), 7.1 to 7.6 (the bonuses and traits section 8.1 mirrors), 9 (made pieces are plain), appendix (`core/sinew-thread`); GAP_RS_GEAR.
- ANIMATION section 1 and the frame budget (docs/design/ANIMATION.md:86).
- DECISIONS: 2026-10-09 "Metal: the grammar is ready, the content waits for its discovery"; 2026-10-09 "The workshop makes better tools that no shop sells; the 30-gold tools stay"; 2026-10-09 "Two ladders: an open-ended tier for how advanced, the four rarities for how often"; 2026-10-09 "The upgrade: work clothes with a small capped bonus, and a look layer on the same slots"; 2026-10-09 "The crafting economy: a miss keeps only inputs, a free market, no level wall"; 2026-10-09 "If magic comes: scrolls and books carry it, and an ancient language is learned slowly"; 2026-10-10 "A hazard is escaped, never answered by an item; road thieves wait for weapons"; 2026-10-10 "First-tier recipes are known from the start; higher tiers are dug up"; 2026-10-10 "The axe and the felled tree"; 2026-10-19 "G35 is the demo's rule: combat is a core part of the game, after the foundation"; 2026-10-22 decisions 39, 42, 46, 51; 2026-10-23 "Bags on the back: 12, a satchel 24, a frame pack 36"; 2026-10-23 "The owner's answers on the bag"; 2026-10-23 "The line is PEGI 16 and ESRB T: brutal in taste, never for show"; 2026-10-23 "Every sprite has the dark ink outline"; 2026-10-23 "Combat, round 5"; 2026-10-25 "Stone is mined"; 2026-10-25 "The progression map, Q2" and "Q5"; 2026-10-25 "The progression map, balance: two red lines, rising ceilings, walls proven both ways"; 2026-10-25 "The progression map: who owns each ceiling"; 2026-10-25 "The progression map, Q8: two bars only; places are harsh, gear answers them (the owner, 25.10)"; 2026-10-27 "An attribute bonus counts as a common piece's one effect (owner's pick)"; 2026-10-30 "The hunt foundations: a `dress` verb, drops and grades on the creature kinds, `hunt` as the fifth value source (kernel 0.22.0)"; 2026-10-31 "The animals' look: three-tone shading, no outline, at the 3/4 camera"; 2026-10-31 "Animals wear no outline: the creatures group leaves the ink rule".
- Research: docs/research/research-combat.md memos 4 and 6 (:39, :176, :180).
- The value solver and the balance code: kernel/src/values.ts (:70-74, :98-118, :206, :239), kernel/test/crafting-values.test.ts:51-56, tools/src/check.ts (:78, :198, :276-289, :294-295, :313-322, :348-349, :353, :357-358, :405-412, :421-469, :648-671), tools/src/balance/check.ts:15, tools/src/balance/prove.ts:590, tools/src/assemble.ts:534, package.json scripts `map:difficulty`, `map:playtest` and `balance` (:52-54).
- Kernel rules R8 (a shop never charges less than the value), R9 (the one clamp on every rate) and R12 (parameters are bounded data): docs/kernel-review-v1.md (R12 at :121); GAME_RULES section 8 (what the check enforces).

## Appendix: the build list

What the wave builds now, with no weapon content, no take tool and no `combat` param: the `weapon` block exists in the schema and every content weapon is refused until combat; the derived category lands with its first reader, the widened shop row; and a row makes sure every dug-up recipe can be learned. A new schema field and a new check row are core (G45).

| Kind | Id | Class | Tier | Rarity | Inputs or fields | Station and profession | Source or placement | Test that proves it |
|---|---|---|---|---|---|---|---|---|
| schema field | `Item.weapon` | - | - | - | `tempo` 'quick' \| 'standard' \| 'heavy', `windup_t` 2..10, `reach` 1..2, `harm` 0..1000, `range?` 2..12, `ammo?` a class id, `noise?` 0..12; seven fields, no `uses` (a hand never wears, section 7; owner question 7); no `class` field (the class is the item's own); no other key | - | schema/src/index.ts beside `tool` (:234-245); tools/src/assemble.ts:534 takes a `weapon` block in place of the `tool` block on an item of kind `tool` | new schema/test/weapon.test.ts: a fixture at each bound validates; one past each bound, an unknown tempo, a `class` key and a `uses` key each fail |
| check row | weapon waits for combat | - | - | - | refuses any `weapon` block (G35, G44) | - | tools/src/check.ts beside the metal row (:356) | today's content passes; a fixture bundle with one weapon fails with exactly this error; a fixture item of kind `tool` with only a `weapon` block gets this error and not assemble's "a tool item needs" |
| kernel function | `itemCategory(item)` | - | - | - | look, then weapon, then tool (a `tool` or `ammo` block), then wear, then consumable (food), quest (fragment, treasure), material (EQUIPMENT 3.1) | - | kernel/src/equipment.ts (new, exported; read by the check), the name the equipment foundations plan uses | kernel test: every core item maps to exactly one category; walking staff, rust pick and work hammer are `tool`, the satchel `wear`, the two feet looks `look` |
| check row | shop by derived category | - | - | - | a shop that sells a `tool`, `weapon` or ammunition of tier 2 or more; widens the built tier-3 shop row (tools/src/check.ts:454-459) for those categories | - | tools/src/check.ts | today's content passes (the trader's basket, trowel, axe and walking staff are tier 1, the satchel is `wear`, the rest food or a tier-1 material); a fixture shop selling a tier-2 tool fails |
| check row | a found recipe has a teacher | - | - | - | a `known: found` recipe must be named by some fragment's `unlocks` (kernel/src/step.ts:1350-1358) or some quest reward's `recipes` (:1146) | - | tools/src/check.ts | today's content passes (bandage and herb tea by quest rewards, herb stew by its scrap); a fixture found recipe with no teacher fails |

Size: 5 rows: 1 schema field (with the assemble row it needs), 1 kernel function, 3 check rows. No content, no param, no kernel change to a step.

### Waits

**For the take verb (docs/design/HUNTING.md:9; its kernel pull request builds these rows, not before).** Their animal inputs (hare hide; roe sinew, through CLOTHING's `core/sinew-thread`) come only from a take; the spear also needs QUARRYING's `core/flint`. Item numbers proposed. Only the snare states `uses`; the sling, the spear and the bow are hands with combat (owner question 2) and state none from the day they land (section 7). The bow also needs its first arrow (section 5.4): proposed default, the take verb's pull request lays a feather item (a bird's good, HUNT_LADDER) and the blunt and flint arrows of section 6.2 (the barbed bone arrows also wait for combat) with the bow, so the cache below lands whole; if the feather cannot come with it, the hunters' cache, its four scraps and the bow's rows wait for the feather together, so the cache's table is laid once (R11) and counted once in the rarity budget, and the spear, taught only by the cache's scrap, waits with them; the snare and the sling do not wait.

| Kind | Id | Class | Tier | Rarity | Inputs or fields | Station and profession | Source or placement | Test that proves it |
|---|---|---|---|---|---|---|---|---|
| schema field | `TOOL_KINDS` + `snare`, `sling`, `spear`, `bow` | - | - | - | four new kinds | - | schema/src/index.ts:53 | schema test: each kind parses in a `tool` block |
| class | `core/sling`, `core/spear`, `core/bow` | under `tool` | - | - | - | - | content/core/items/hunt-tools.json (new) | `pnpm check` passes; the class row (G45) holds |
| item | `core/snare` | `tool` | 1 | common | `tool { snare, 1, uses 20 }`, weight 1, no `wear` | - | hunt-tools.json | `pnpm check`; a kernel test crafts it and finds it in the bag |
| recipe | `core/snare` | - | 1 | - | `core/reed-cord` 2, `core/branch` 1 -> 1; 4000 ms; level 1; `known: start` | workshop tier 1 (work stone); Handcraft | content/core/recipes/snare.json | `pnpm check`: R11 holds, no locked value moves; a new id passes without a lock entry (tools/src/check.ts:661) |
| item | `core/sling` | `core/sling` | 1 | common | `tool { sling, 1 }`, no `uses`, weight 1 | - | hunt-tools.json | `pnpm check` |
| recipe | `core/sling` | - | 1 | - | `core/reed-cord` 1, `core/hare-hide` 1 -> 1; 4000 ms; level 2; `known: start` | workshop tier 1; Handcraft | content/core/recipes/sling.json | `pnpm check`: band 1..2, CR-16. A template over class `core/hide` would also fit the tier-3 wolf hide and risk CR-16, so the recipe names the hare's |
| item | `core/spear` | `core/spear` | 2 | uncommon | `tool { spear, 2 }`, no `uses`, weight 2 | - | hunt-tools.json | V-2: computed rare (flint computes uncommon, QUARRYING appendix; +1 found), declared uncommon, within one rank |
| recipe | `core/spear` | - | 2 | - | `core/branch` 2, `core/flint` 2, `core/roe-sinew` 1 -> 1; 6000 ms; level 3; `known: found` | workshop tier 2 (workbench); Handcraft, Woodcraft when it lands (schema/src/index.ts:429-432) | content/core/recipes/spear.json | `pnpm check`: one-tier climb, band 3..5, station tier 2, CR-16, the teacher row |
| item | `core/bow-stave` | `wood` | 2 | uncommon | material, weight 1 | - | hunt-tools.json | `pnpm check`; V-2: log 0, +1 found |
| recipe | `core/bow-stave` | - | 2 | - | `core/log` 1 -> 1; 8000 ms; level 4; `known: found` | workshop tier 2; Handcraft (Woodcraft later) | content/core/recipes/bow-stave.json | `pnpm check`: one-tier climb from the tier-1 log, CR-16 |
| item | `core/sinew-cord` | `core/sinew` | 1 | common | material, weight 0 | - | hunt-tools.json | `pnpm check` |
| recipe | `core/sinew-cord` | - | 1 | - | `core/sinew-thread` 2 -> 1; 3000 ms; level 1; `known: start` | workshop tier 1; Handcraft | content/core/recipes/sinew-cord.json | `pnpm check`: lands after CLOTHING's thread |
| item | `core/bow-string` | `core/sinew` | 2 | uncommon | material, weight 0 | - | hunt-tools.json | `pnpm check`; V-2: cord 0, +1 found |
| recipe | `core/bow-string` | - | 2 | - | `core/sinew-cord` 2 -> 1; 5000 ms; level 3; `known: found` | workshop tier 2; Handcraft | content/core/recipes/bow-string.json | `pnpm check`: CR-16, the teacher row |
| item | `core/bow` | `core/bow` | 3 | rare | `tool { bow, 3 }`, no `uses`, weight 2 | - | hunt-tools.json | V-2: computed rare (uncommon inputs, +1 found) |
| recipe | `core/bow` | - | 3 | - | `core/bow-stave` 1, `core/bow-string` 1 -> 1; 10000 ms; level 6; `known: found` | workshop tier 3; Handcraft (Woodcraft later) | content/core/recipes/bow.json | `pnpm check`: one-tier climb (tier-2 inputs), band from 6, gated by band (G41), no shop |
| item | `core/spear-scrap`, `core/stave-scrap`, `core/string-scrap`, `core/bow-scrap` | relic (kind `fragment`, family `scrap`, as `core/stew-scrap`, content/core/treasures/ruins-gate.json:34-46) | 1 | rare | `fragment { unlocks }`: the spear, the bow stave, the bow string, the bow | - | content/core/treasures/hunters-cache.json (new), its `items` | `pnpm check`: V-2 by chance (6 and 3 both rank rare), the teacher row passes for all four recipes |
| dig spot | `core/hunters-cache` | - | 1 | - | trowel; level 2; `active_ms` 5000; `respawn_ms` 300000; count 2; finds spear scrap 6/25, stave scrap 6/25, string scrap 6/25, bow scrap 3/25 (chance/share, shares 100); hint "Old cut staves lie under the brush." | Digging | the same file; a new ruin slot `core/hunters-cache` in content/core/map.json by the south ruins passage (`core/ruins-south`, opens by wake) | kernel dig test: finds by the keyed stream; `pnpm check`: R11 holds (a new spot moves no locked value), and the budget test (kernel/test/crafting-values.test.ts:51-56) passes with the world at 99531 of 100000 ppm |
| balance source | the bow and spear rows | - | - | - | the bow: stave 1, string 1; the spear's head: `core/flint`; statuses move to built as each row lands; source points at the content | - | tools/src/balance/hunt-ladder.json:75-102, then HUNT_LADDER.md regenerated | the regenerated page matches its source with no hand edit |

**For combat (G35; the fight's first kernel pull request, docs/design/COMBAT.md:238).**

- Params, group `combat` in content/core/params.json with the schema params block, kernel/src/bundle.ts and tools/src/assemble.ts (as the `wild` rows, :202-203): `swing_quick_t` 8, `swing_standard_t` 10, `swing_heavy_t` 12, `swing_floor_t` 6, `bare_windup_t` 3 with COMBAT 4.9's ranges; `hand_offset` {128, 96..256, 32}; `hand_rate_max_permille` (9 entries, each 1000..3000, step 50; the check refuses a falling table); `range_rate_permille` {750, 500..1000, 50}; `dual_use_max` {4, 0..8, 1}; `strike_base` {16, 8..32, 1}; `flight_tiles_t` {4, 2..8, 1}. Test: the bundle carries every value.
- `handHarmMax(params, tier, tempo, ranged)` in kernel/src/values.ts: `harmAt(share(rate), swing_t)` of section 4, integer. Kernel test: the section 4 table, all 25 cells; the tiers past 5 (index 6 to 9, and past 9 reading the last); a ranged hand below its requirement (a newcomer's tier-3 bow counts 51).
- `Item.dual_use` (optional boolean, schema test) and the `weapon` and `wear` blocks on the sling, spear and bow with the mark.
- The shape, dual, no-wear, door, start-item, school, `bleed`, launcher-and-ammunition, harm-sum, range, worn-effect, bonus and trait rows of section 16. They land in the pull request that lifts the "weapon waits for combat" row, so each fixture fails only its own row. Section 16's mend row reads the `mend` mark, so it lands here only if the first mend recipe has landed; otherwise it lands with it.
- `weapon.trait?` (an additive schema field, a word of its class's list, section 8.1) and the `wear.attrs` of found weapons under CLOTHING 7.5's gate; the found weapons themselves, each on a spot of its own or as a foe's drop (owner question 11).
- Signature techniques and their check row, with GROWTH's technique format as section 15 amends it (section 9.1; owner question 8).
- The first predator laid as a foe, and the words of section 15's predator row: G34, G80, COMBAT 2 and 4.1 (:162), HUNTING :9 and :139, BESTIARY :5, :45, :65 and :84, the 2026-10-25 entry "The progression map, Q8" (DECISIONS.md:3139), and the message of tools/src/wild.ts:185 (owner question 9).
- The tier-2 and tier-3 slings' shots and the barbed arrows (section 6.2).
- Every weapon item and recipe of section 5.2 that is marked "combat"; the fight's reading of the hand and the engage swap (section 1); the rate clamp at fight time; the soft requirement's active harm (section 8); techniques by class (section 9); the held weapon's poses (section 12); owner question 3's answer for tools.

**For the first shot (the take verb or combat, whichever spends a shot first).** The `ammo` block of section 6 (`for`, `shots` 1..100, `harm_add` 0..1000, `head`, `range_add?` 0..2; schema test: a fixture at each bound validates, one past each bound, an unknown head and a `tier` key each fail), its four first-shot rows of section 16, and its kernel read beside `wearTool` (the shots spent); the classes `core/arrow` and `core/sling-stone` under `tool` (declared with the first ammunition item, as `core/feather` is declared with no item); tools/src/assemble.ts:534 gains `&& !it.ammo` (test: an item of kind `tool` with only an `ammo` block passes assemble; one with neither block still gets "a tool item needs"); the sling's loose `core/stone` read as its tier-1 shot; `core/shaped-stones` (section 6.2); the quiver's `holds: 'ammo'` places (owner question 10).

**For a feather item (the fowl of BESTIARY_LANDS, #432).** The arrows of section 6.2 (blunt, flint, slate and greenstone; the barbed ones also wait for combat), fletching, and with them the bow (section 5.4); HUNT_LADDER's source moves both arrows from craft tier 3, level 6 and no station to tier 1, level 2 and workshop tier 1 (`station` "work-stone"; tools/src/balance/hunt-ladder.json:268, :275), and the broad head from `core/stone-flakes` to `core/flint` (:276), its page regenerated (docs/design/HUNT_LADDER.md:49-50 and the tier table, :119).

**For the hart's content (BESTIARY_LANDS #432).** Antler as the hart's bone good, and any antler head.

**For the first mend recipe (after this wave, owner's merge).** The `mend` recipe mark, the counter clear, `mend_below_permille` {500, 250..750, 50}, the check's pricing for CR-16 and G40's miss row, QUARRYING's `core/whetstone`, and the snare's mend with reed cord; section 16's mend row if combat has landed first (otherwise it lands with combat); no hand is mended (section 7).

**For Woodcraft (PROGRESSION 4.2, foundation).** The recipe `profession` of the spears, staves, bow, stave and club moves from Handcraft; `shaft_true`, `bow_draw`.

**For metal (G45; DECISIONS 2026-10-09 "Metal: the grammar is ready, the content waits for its discovery") and the city (decision 51).** Tiers 4 and 5, Smithing's blade and blunt, `edge_hold`, metal heads; the bows of tiers 4 and 5 wait for the tier to open. Past tier 5, a dual hand needs `tool.tier` above 5 (schema/src/index.ts:238), a core schema change (G45).

**For the first weapon content.** `pnpm weapons` (tools/src/balance/weapons.ts and its CLI, a `weapons` script in package.json) and its test (section 5.5; owner question 12).

**For the owner's answer.** The damage row of COMBAT 4.9 (question 1), the dual list, its cap and the sling's class (2), a tool in a fight (3), ammunition return (4), `bleed` (5), the staff (6), weapon wear and the wear lines of EQUIPMENT 3.1, 3.4 and 5 and PROGRESSION 4.2 and 5.4 (7), signature techniques and GROWTH's words for them (8), predators as foes and the words of G34, G80, COMBAT 2 and 4.1, HUNTING, BESTIARY and the 2026-10-25 Q8 line (9), ammunition's grades (10), bonuses and traits on found weapons (11), the matrix report (12).
