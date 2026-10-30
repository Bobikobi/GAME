# Hunting: how an animal notices, what a hunt takes, and what it pays (2026-10-29)

**Status:** Proposed 29.10, beside the combat numbers ([COMBAT.md](COMBAT.md) section 4.9). Nothing here is built. The creature schema is the next pull request; the four questions of section 11 go to the owner with the default this page is written on.

A design page. The owner, 28.10: "more agents on research and building the foundations of combat and hunting; research where my knowledge is missing; advance the whole development plan smartly" (DECISIONS 2026-10-29, "Animals, then the foundations of combat and hunting"). The research behind it is [research-hunting.md](../research/research-hunting.md) (cited "memo" with its letter and step, so "memo C5" is its recommendation C, step 5) and, for the numbers a hunt shares with a fight, [research-combat.md](../research/research-combat.md).

What it holds: the states an animal is in and how it moves between them (section 2); how it notices a player, as an integer test with no roll (section 3); the noise table, quoted (section 4); the tools that open each size of prey (section 5); the goods, the carcass that spoils, and the stations that process it (sections 6 and 7); the kinds of animal by danger tier (section 8); what a hunt pays and what caps it (section 9); the rules the rating asks for (section 10); the owner's questions (section 11); the check rows that come with the schema (section 12).

What it does not change: G35 holds, no fighting in the demo; a hunt is not a fight, and nothing on this page is built before the server (NEXT 18) and the creature schema. G34 holds: the predator on its round is a hazard, escaped by a run. G45 holds: a new verb, station or effect is core-only, so `hunt`, the drying rack and the tanning rack come in a core release. Decision 42 holds: the start outfit has no weapon, and the first tool of a hunt is a stone picked up.

## 1. The loop

One loop for every animal (memo, summary): find it by its signs, approach it while it does not know, strike only when it is unaware or let a trap do it, dress the carcass and carry what fits before it spoils, process the goods at a station. An unaware animal struck with a tool that fits its size is a clean take. An aware one flees. A hunt is never a fight: there is no bar over an animal, no exchange of blows, and a failed approach costs time and a lost animal, never health (memo E9).

Where it runs: an animal that reacts to a player lives in a shared world, so it runs on the server's tick as a fight does (round 1), and it thinks once every 8 ticks, staggered by its id modulo 8, so the server pays little for a herd (memo C, step "think step"). An animal with no player within 40 tiles is not stepped: its herd is kept as an anchor and a count (memo D).

## 2. The states

Ten states. The animal's tier (section 8) decides what ALERT turns into.

| State | What the animal does | Leaves it when |
|---|---|---|
| SLEEP | Lies at its anchor in its sleeping hours; senses at a third of its sight (`ceil(sight / 3)`) | Its waking hour; a noise within its ear (section 3); a player within 2 tiles -> ALERT |
| IDLE | Stands 2 to 6 think steps | The steps run out -> GRAZE or WANDER, by the species' weights; it senses a player -> ALERT |
| GRAZE | Head down 4 to 12 steps, sight 2 shorter; then head up 2 steps at full sight; repeat | It senses a player -> ALERT. Bait holds it here 6 steps with no head-up beat (memo E3) |
| WANDER | Walks to a tile 3 to 8 away inside its roam circle around the anchor (6 to 14 tiles by species); herd members follow the leader when their own step ends | It arrives -> IDLE; it senses a player -> ALERT |
| ALERT | Stops, faces the source, shows a head-up pose: the tell a player reads | Sensed again on the next steps up to its count (section 3) -> FLEE, DEFEND or STALK by tier; nothing sensed for 4 steps -> IDLE. A hit or a noise of 8 or more skips straight to the tier's state. Every herd member within 8 tiles goes to ALERT with it |
| FLEE | Runs away along a map of distance from the threat, away from dead ends; birds fly over water and fences | Its distance reaches sight + 4, or it is out of sight 8 steps -> WANDER, away from that tile for 60 steps |
| DEFEND | Holds its ground facing the player; if the player stays within 2 tiles for 2 steps, or it is cornered or hit, it charges up to 5 tiles in a line and rests 6 steps; never more than 6 tiles from its spot | The player is beyond its sight -> RETURN. Until the fight is built a d1 animal bluffs: ALERT and its pose, never DEFEND (section 11, question 1) |
| STALK | Approaches from cover at half the walk's pace and holds still while the player faces it | Within 3 tiles, or on first notice for a pack -> CHASE; the player faces it 2 steps within 4 tiles -> RETURN |
| CHASE | Follows at the player's walk, never faster | Out of sight 50 ticks (`give_up_t`), or past its leash of 7 tiles from its den (`leash_tiles`) -> RETURN |
| RETURN | Walks back to its anchor and forgets the target | At the anchor -> IDLE |

Speeds come from the walk the kernel already has: a step is `walk_step_ms` (190 in the core); a run is that divided by `gait.run_div` (2); a sneak that times `gait.sneak_mul` (2). Small and medium prey flee at the run, so a chase never catches them: a trap, a sling, bait or an unaware strike does. A hunter chases at the walk, so a player who keeps walking away is never caught (memo pitfalls, "danger rule"). The STALK and CHASE states wait for the fight; until then no hunting animal is placed (section 8).

## 3. Noticing: an integer threshold, no roll

One measure for every sense: the squared distance between the animal's tile and the player's, `d2 = dx * dx + dy * dy`, compared with a radius squared. No square root, no float, no draw.

- **Sight.** Sensed when `d2 <= sight * sight`, the line between them crosses no solid or dense tile, and the player stands in the animal's front half (the facing and the offset make a product of 0 or more). Behind it the radius is `ceil(sight / 2)`. A player standing in tall grass or a bush takes 2 off every animal's sight (memo C6).
- **Hearing.** A noise of radius `n` (section 4) is heard when `d2 <= (n + ear) * (n + ear)`, where `ear` is the species' -2, 0 or +2.
- **Smell.** One tile all round, as G47 gives the predator. Wind is not in the first build (section 11, question 6).

Where the memo rolls a chance each step (Brogue's flat quarter), this page counts instead. An animal keeps a counter of the think steps in a row in which it sensed the player. It reaches ALERT when the counter reaches a threshold set by how close the player is:

| Where the player is | Steps in a row to notice |
|---|---|
| Outer half of the radius (`4 * d2 > r * r`) | 3 |
| Inner half | 2 |
| Within 2 tiles (`d2 <= 4`) | 1 |

A step in which nothing is sensed sets the counter back to zero. The same counter, past ALERT, carries it to its tier's state: 3 steps sensed in ALERT, as memo C8 has it. So a player who moves only while the head is down, and freezes when it lifts, is never noticed at the outer half; the rule is one the eyes can learn, and the server needs no seed for it (G34: a hazard is a rule, not a roll).

## 4. Noise: the table is the gait params

Quoted from `content/core/params.json` (the `gait` group, read by the kernel's `noiseRadius`), not restated:

| Act | Radius in tiles | Source |
|---|---|---|
| Standing still | 2 | `gait.noise_still` |
| Sneaking | 3 | `gait.noise_sneak` |
| Walking | 5 | `gait.noise_walk` |
| Running | 8 | `gait.noise_run` |
| A strike that lands | 4 | a new row of the gait group ([COMBAT.md](COMBAT.md) 4.9) |
| Felling or digging | 5 | a new row of the gait group (COMBAT.md 4.9) |

A tool's own noise (a sling's crack, a bow, a snare set) gets its row with the tool, in the creature schema's pull request; until then a tool's strike is the strike row. Field-dressing a carcass is a felling-sized act, 5. A noise turns the heads of every animal and every predator that hears it, toward the sound, for `noise_turn_t` (30 ticks), and the turn is drawn (round 4).

## 5. The tools, by tier

Each tool's inputs come from the tier before it, so the hunt climbs (memo E7). No tool is closed to a race (G70).

| Tier | Tool | Takes | Range | How |
|---|---|---|---|---|
| T0 | A stone, thrown | Small prey, stunned | 3 | Picked up; the first hunt needs no craft |
| T1 | A snare | Small prey on a trail sign | Its tile | Fibre cord first, sinew cord later; passive, checked once a game day; a crow can take what it holds |
| T2 | A sling | Small prey and ground fowl | 6 | Stone and cord |
| T3 | A spear | Medium prey, unaware | Thrust 1, throw 4 | Wood and flint |
| T4 | A bow | Medium prey | 8 | Stave, a sinew string and feather fletching: the goods of T1 to T3 |
| T5 | A pit trap | Large prey and defenders | Its tile | Timber, rope and bait; dug, so it makes the digging noise |

A tool smaller than the animal still works, at one quality lower (memo E4, from Red Dead Redemption 2's star); a hunt is never refused for the wrong tool, only paid less. Quality runs 1 to 3, set when the animal appears and read by a look within 8 tiles, as a pose and never as a number (G77 proposed).

## 6. The goods, and the carcass that spoils

Five goods, one class each under the existing class tree (G45, so a new hide works in an old recipe): **meat**, **hide**, **bone**, **sinew**, **feather**. Fur, fat, horn and eggs come later with their animals; the memo's longer list is there when they do.

A felled animal is a carcass on its tile. Dressing it takes 6 think steps for a small one, 12 for a medium, 24 for a large, and makes the felling noise (memo E5). The player takes it all (1, 2 or 4 bag slots by size) or the best part. Raw meat spoils in 3 game days and a raw hide must be scraped within 6; the cold highland doubles both (memo numbers 36). A carcass left on the ground draws crows after 30 steps and, in d2, a predator after 60 (memo C13): the place a thing died is seen, and a carcass left is a choice with a cost.

Raw meat is food that heals a little, cooked meat heals more (G32: eating is how the player heals). Hunting comes before fire in the spec's order (STORY.md, the spec's sequence), so the first meat is weak until the fire is built.

## 7. The stations

Three, in the order the goods need them. Two are new and so core-only (G45).

| Station | Turns | Into | Note |
|---|---|---|---|
| A fire (exists) | Raw meat | Cooked meat | G48's fire; cooking already has its purpose (G32) |
| A drying rack (new) | Raw meat | Dried meat that does not spoil | Rain stops it while it falls |
| A tanning rack (new) | A scraped hide | Leather | A cure of about 5 game days (memo, The Long Dark); its leather feeds the next tier of worn things |

## 8. The kinds of animal, by danger tier

The tier follows the region's danger `d` (FIRST_MAP.md: `d` is the steps from town divided by 64): ambient and fleeing animals at d0, defenders from d1, hunters only at d2 (memo A). A defender at d0 breaks "danger rises with distance" and the check refuses it (section 12).

| Tier | On ALERT | First at | Examples (memo catalogue) | Senses (sight / ear / smell) | When |
|---|---|---|---|---|---|
| Ambient | Lifts off or scatters; its burst is a noise of 5 that others hear | d0 | Meadow songbirds, carrion crow | 5 / 0 / 0; 7 / 0 / 0 | With the first animals |
| Flee | FLEE | d0 | Field hare, ground fowl, roe deer (d0 to d1); hill sheep, highland goat, marmot (d1) | Hare 6 / +2 / 0; roe deer 8 / +2 / 6 | Hare and fowl first; deer when the bow is built |
| Defend | DEFEND (a bluff until the fight, question 1) | d1 | Wild boar, dust adder | Boar 4 / 0 / 8; adder 2 / 0 / 0 | After the fire |
| Hunt | STALK, then CHASE | d2 | Forest wolf pack, wildcat, white bear | Wolf 8 / +2 / 9 | With the fight, or the pit trap |

Spawning, from memo D: a table per region of species, weight, cluster size and a cap per 1000 habitat tiles (d0 12, d1 8, d2 5); never within 14 tiles of a player or in view, never within 12 tiles of the town square, never on a path leg of the opening; a herd lost a member gets it back from its anchor after a game day, only while no player is within 20 tiles, so the first players never empty the valley.

## 9. What a hunt pays, and its cap

No animal and no good carries a price. A hunted good's value comes from the value solver (`kernel/src/values.ts`), which knows four sources today: gather, dig, craft and a node a reaction makes appear. A hunt needs a fifth, `hunt`, which does not exist yet: it prices a drop by the time its whole loop takes (the find, the approach, the dressing), on the solver's effort tiers, so the value follows the work and never a number written on an animal (AGENTS.md: no hardcoded price).

The cap: what one hunt leaves is worth at most `combat.pay_per_s_mg` for each second of that loop at the trader's price, the same cap a fight has (COMBAT.md 4.9, G85 proposed), inside the area's rarity budget (`rarity_budget_permille`). Behind it: one carcass per animal; the herd anchor refills a game day later; goods join the outing, and a fall loses them (G33); the trader's day cap turns hours into gold whatever the source.

## 10. The rating's rules

The line is PEGI 16 and ESRB T (TONE.md). PEGI 18 names "violence towards defenceless characters"; a passive animal could be read that way (memo pitfalls, "age ratings"). These rules keep a hunt on the right side of it, and each is a rule, not a taste:

- **No blood on an animal.** A take is a fade and a drop of goods. TONE section 3 allows "a trail of blood where a hurt animal went"; this page builds the stricter default and asks (section 11, question 5).
- **No young animal is prey.** A young animal can be seen, never struck, trapped or harmed.
- **No pet is prey.** Dogs, cats, horses and any tamed or companion animal are never hunted, and no tamed animal is killed in front of the player.
- **No suffering.** No death throes, no cry, no finishing a downed animal, no pile of bodies.
- **No score of kills.** Harm to animals is never a count, a board or an achievement.
- **No meat from a person.** Not a human, an elf or a skeleton, and no joke about it.

## 11. Open for the owner

Each with the default this page is written on.

1. **Contact with a defender before the fight is built.** Default: no contact; defenders enter with the fight. Until then a d1 animal only bluffs: ALERT and its pose, never DEFEND.
2. **Elves and meat, skeletons and meat.** Default: all three races hunt and eat; no bonus and no penalty by race until STORY.md speaks.
3. **Animals go to ground at dusk.** Default: yes. Prey sleeps 22:00 to 05:00 by the valley's hours; predators the reverse, active 22:00 to 05:00 and in the den by day. The bank wolf, a hazard, keeps G30's hours.
4. **The first fightable creature.** Default: the wolf of the bank, T1, 2 hits with a starter hand. The frame keeps the predator on its round a hazard that never becomes a foe (COMBAT.md section 2; G34), so the default reads this as a wolf of the same kind standing as a foe in a d1 area, while the bank wolf on its round stays the hazard.
5. **Blood on a hunted animal.** TONE section 3 allows a trail of blood where a hurt animal went; the hunting memo's avoid-list says none. Default: none, the stricter line, until the owner sees a still.
6. **Wind.** The memo proposes a wind that carries smell only downwind. Default: no wind in the first build; smell is G47's one-tile ring.

## 12. The check rows

What `pnpm check` will print once the creature schema exists, one error line each. Field names are the schema's to fix.

- `x creature.<id>: a defender or a hunter placed at d0; d0 holds ambient and fleeing animals only (HUNTING 8)`
- `x creature.<id>: a hunter placed below d2 (HUNTING 8)`
- `x creature.<id>: a chase faster than the player's walk; a hunter is escaped by walking (HUNTING 2)`
- `x creature.<id>: a hunter with no leash, or a leash over leash_tiles (HUNTING 2, COMBAT 4.9)`
- `x creature.<id>: no sleeping hours, or no tell for ALERT (HUNTING 2)`
- `x creature.<id>: a young animal or a pet marked as prey (HUNTING 10)`
- `x creature.<id>.drops: a price on a drop; a hunted good is priced by the hunt source (HUNTING 9)`
- `x creature.<id>.drops: a good that is not meat, hide, bone, sinew or feather, or names no class (HUNTING 6, G45)`
- `x creature.<id>.drops: worth more than combat.pay_per_s_mg times the hunt's seconds (HUNTING 9)`
- `x creature.<id>: no spoil time on its carcass (HUNTING 6)`
- `x spawn.<region>: a spawn within 12 tiles of the town square or on a path leg of the opening (HUNTING 8)`
- `x station.<id>: a drying or tanning rack from an extension; a new station is core-only (G45)`

## Sources

- [research-hunting.md](../research/research-hunting.md): the state machine (C), the spawn rules (D), the loop, tool gates and goods (E), the catalogue and the avoid-list, with its 40 sources.
- [research-combat.md](../research/research-combat.md): the leash, the give-up, the noise turn and the extra noise rows shared with a fight.
- Brogue (the stealth range, made here into a count with no roll); Minecraft (flee radii per species); theHunter: Call of the Wild (the readable alert, the head-down rhythm); Don't Starve (tracks and burrows); The Long Dark (the carcass that spoils, the cure); Red Dead Redemption 2 (quality by the tool and the approach); Valheim and Medieval Dynasty (the tool ladder and the tanning rack).
- In this repository: GAME_RULES.md (G30, G32 to G35, G45, G47, G70); COMBAT.md 4.9; TONE.md sections 3 and 4; FIRST_MAP.md (the danger bands); STORY.md (the spec's order of the first trades).
