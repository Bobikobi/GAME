# The three lands' animals: the valley's twelve, ten for the elf wood, ten for the undead south

**Status:** Proposed 30.10, written for the owner. [BESTIARY.md](BESTIARY.md) names the first twelve animals of the valley and the first ring; this page carries the same table into the two other worlds of the first map ([FIRST_MAP.md](FIRST_MAP.md): the elf wood to the north, the undead south) and writes every kind in the fields the hunt foundations read (DECISIONS 2026-10-30; `schema/src/index.ts`, `CreatureKind.hunt`), so each row can become content without a second design pass. It builds nothing, draws nothing and picks no look: a look is the owner's pick from stills, one kind at a time (BESTIARY 4). Every number is proposed.

What the lands are, from the first map: the valley floor and the east highland are temperate and cold ground at d0 and d1, the human world's ordinary animals; the elf wood is dense temperate forest beyond the north pass at d2, with its foot at d1; the undead south is dry, dark ground from the night arch down a stair to the sunken hall (d1) and the descent beyond it (d2). Danger `d` is steps from the town divided by 64 (G64). The rules of BESTIARY 2 hold in every land: no blood on an animal, no young, no pet, no flesh of a person, no spawn on safe ground, no hunter on d0, the dusk, the noise by gait, a tell for every reaction, a hunter escaped by construction, no world emptied, no lore from the narrator.

## 1. The fields, and how the ladder from easy to hard is built

A kind is written once in `map.creatures.kinds` with `look`, `perch`, `alert_tiles`, `return_s` and `hours` as today, plus the foundations' `hunt` block, or neither, ambient only; `protected: true` only where HUNTING 10 applies, a pet, a young animal or a person, seen, never taken, never dressed, and no kind on this page is one. A kind that is simply not hunted, or stands above the open ladder, carries no `hunt` block and is not `protected`. Of the columns below, Size, Tier, Danger, Take, Ways, Drops and Spawn are the `hunt` block's fields as the schema has them; Senses, a second hours window (the boar's 05-09, 19-23) and "any hour under a roof" are not fields yet, since the schema's `hours` is one [from, to) window, and are proposed here for the creature schema:

- **Size** small / medium / large: 6 / 12 / 24 dressing steps (HUNTING 6) in one, two or four parts of six, one action a part (the foundations' `dress`), the goods with the last; and a small animal never hunts the player (the check).
- **Tier** 1 to 20: what the kind's goods may be at most, and the solver's effort ladder. Tier 1 at d0, 2 at d1, 3 at d2 as MATERIALS proposes; a kind above tier 3 is beyond the open ladder (`open_tiers` 3) and stands in the content without `hunt` until the ladder opens that far.
- **Danger** 0 ambient or flee, 1 defend, 2 hunt (HUNTING 8), which also sets the spawn cap: 12 / 8 / 5 per 1000 habitat tiles.
- **Take** `take_s`: the real seconds a fair take costs, from first sight to the carcass: the active time the value table prices, before the dressing. The stalk to a thrown stone, the walk back to a snare, the fight once it exists; the solver prices the loop from this and the dressing.
- **Ways** from the closed list `stalk`, `snare`, `lure`, `fish`, `fight`: a stalk is a strike on an unaware animal with a tool of its size (HUNTING 5, T0 to T4); a snare is set and visited later; a lure holds the animal at bait; a fish is the rod; a fight is the combat stream's (G35: nothing fights in the demo, and a kind whose only way is `fight` is a hazard until then).
- **Drops** one to five goods with shares that sum to 100: the share is the solver's weighting of the loop's output, not a roll. Every drop is a plain good of class meat, hide, bone, sinew or feather; a finer grade is drawn for the carcass, never named as a drop.
- **Spawn** `cap_per_1000` and `refill_d`: the standing count per 1000 habitat tiles and the game days a lost member takes to return (section 4).
- **Senses** sight / ear / smell as HUNTING 8 (proposed, not a field yet), and **hours** awake, the schema's one window; outside them the kind is gone to ground. A second window and the roof rule are proposed with the senses.

The ladder from easy to hard is four things at once, never a hit-point number: the take gets longer, the way climbs from a stone to a snare to a bow to a trap, the danger rises from a thing that flees to a thing that bluffs to a thing that hunts, and the spawn thins from 12 to 5 per 1000 tiles. A hare is 40 seconds and a stone; a drake is never, in the first ring. Every kind appears at a grade from the one draw in `params.hunt` (grade 3 at `grade3_bp`, grade 2 at `grade2_bp`, plain otherwise), the same in every land; a land's finer animals are a matter of its tiers, not of a kinder draw.

## 2. The valley and the highland: the owner's twelve, in the fields

The rows are BESTIARY 1's and change nothing there; only the foundations' fields are added. Goods and their counts are BESTIARY's, with a range (the roe's hide 1-3, the trout's meat 1-2) written at one count, since `qty` is one number and the grade draw carries the finer animal; the shares weight them for the solver.

| Kind | Size | Tier | Danger | Take s | Ways | Drops (qty, share) | Spawn cap / refill d | Hours |
|---|---|---|---|---|---|---|---|---|
| Sparrow | small | - | - | - | no `hunt`, ambient only; a moult under the perch is a resource node | - | - | 05-20 |
| Carrion crow | small | 1 | 0 | 30 | snare, stalk (a sling) | feather 1 (100); the meat is not eaten | 12 / 1 | 05-20 |
| Trout | small | 1 | 0 | 60 | fish | meat 2 (70), bone 1 (30) | 12 / 1 | 05-22 |
| Hare | small | 1 | 0 | 40 | stalk, snare | meat 1 (50), hide 1 (40), bone 1 (10) | 12 / 1 | 05-20 |
| Roe deer | medium | 1 | 0 | 90 | snare, stalk (bow or spear) | meat 3 (45), hide 1 (30), bone 1 (10), sinew 2 (15) | 12 / 1 | 05-22 |
| Ground fowl | small | 1 | 0 | 30 | snare, stalk (a sling) | meat 1 (60), feather 2 (40) | 12 / 1 | 05-20 |
| Highland goat | medium | 2 | 0 | 90 | stalk (bow from below), snare | meat 2 (40), hide 1 (30), bone 1 (15), sinew 1 (15) | 12 / 1 | 05-22 |
| Wild boar | medium | 2 | 1 | 120 | fight, lure (a pit with bait) | meat 3 (55), hide 1 (30), bone 1 (15, the tusk) | 8 / 2 | 05-09, 19-23 |
| Dust adder | small | 2 | 1 | 45 | stalk (spear from 2 tiles), snare | hide 1 (70, the scale), meat 1 (30) | 8 / 2 | 06-20 |
| Wolf | medium | 3 | 2 | 150 | fight, lure (bait after the fight) | hide 1 (50), bone 1 (30, the fang), meat 1 (20) | 5 / 3 | 20-05 |
| Wildcat | small | 3 | 1 | 120 | lure (a baited snare), fight | hide 1 (55, fine fur), meat 2 (25), bone 1 (20, the claw) | 8 / 3 | 20-05 |
| White bear | large | 3 | 2 | 240 | fight, lure (the ice pit) | meat 5 (45), hide 1 (30, thick fur), bone 1 (25, the claw) | 5 / 3 | 20-07 |

Two readings this table makes that BESTIARY leaves open: the wildcat is written at danger 1, because a small animal does not hunt the player (the check) and BESTIARY's "avoided" is a defender's bluff; the sparrow carries no `hunt` block and stays ambient only, because BESTIARY's tool gate for it is "none, not hunted"; it is not `protected`, a word the schema keeps for a pet, a young animal or a person (HUNTING 10).

## 3. The two other lands

### 3.1 The elf wood: ten kinds that are quick, quiet and seen before they are reached

Dense forest at d2 with its foot at d1 (FIRST_MAP: three wayside stalls, branching trails with dead ends). The wood's animals are the valley's made finer and shyer: longer sight, keener ears, higher tiers, and the hard end is a cat and an eagle, not a bear. Habitat: forest floor, the wood's streams and a pool, the canopy for the perchers, the bare crest above the trees for the eagle.

| Kind | Size | Tier | Danger | Take s | Ways | Drops (qty, share) | Spawn cap / refill d | Sight / ear / smell | Hours | Where, and the tell |
|---|---|---|---|---|---|---|---|---|---|---|
| Wood dove | small | 1 | 0 | 30 | snare, stalk (a sling) | meat 1 (50), feather 2 (50) | 12 / 1 | 6 / +1 / 0 | 05-20 | The canopy and the trail's edge; a clatter of wings is a noise of 5 |
| Grey heron | small | 1 | 0 | 45 | stalk (a thrown stone while it wades) | feather 3 (100) | 12 / 1 | 8 / +1 / 0 | 05-20 | The stream's shallows, still on one leg; it lifts slowly, a tell of two steps |
| Wild goose | medium | 1 | 0 | 45 | snare, stalk (a sling) | meat 2 (55), feather 3 (45) | 12 / 1 | 7 / +2 / 0 | 05-20 | A pool and the wet meadow in a skein; one goose watches while the rest feed |
| River otter | small | 1 | 0 | 60 | snare (at the slide), lure (a fish) | hide 1 (55), meat 1 (45) | 12 / 1 | 5 / +1 / 2 | 05-22 | The stream's banks; it slides into the water and is gone, a ring on the surface |
| Tree marten | small | 2 | 0 | 60 | snare (on a branch), stalk | hide 1 (60, fine fur), meat 1 (20), bone 1 (20) | 12 / 1 | 6 / +2 / 4 | 18-06 | The trunks at dusk; a scold from the branch above is its alarm |
| Silver fox | small | 2 | 0 | 75 | snare, lure (a fowl's leavings) | hide 1 (70, the pelt), bone 1 (30); the meat is not eaten | 12 / 2 | 7 / +2 / 8 | 19-07 | The trail's dead ends; it sits and looks at the player before it goes |
| Moon moth | small | - | - | - | no `hunt`, ambient only; nothing is taken from it | - | - | - | 20-05 | A pale cloud at the wayside stalls' lamps; it lifts in a cloud, a noise of 5 |
| White hart | large | 3 | 0 | 150 | stalk (the bow, T4), snare (on a trail) | meat 4 (40), hide 1 (25), bone 1 (20, the antler), sinew 1 (15) | 12 / 2 | 9 / +2 / 7 | 05-22 | Glades and the wood's deep trails; head up for two steps before it goes, and the whole glade lifts with it |
| Great eagle | medium | 3 | 1 | 180 | fight, lure (a pit with bait, T5, after the fight) | feather 4 (65), bone 1 (35) | 8 / 3 | 10 / +1 / 0 | 06-19 | The bare crest above the wood; it bluffs with a stoop that stops a tile short (HUNTING 11), never under the canopy |
| Wood lynx | medium | 3 | 2 | 150 | fight, lure (a baited snare after the fight) | hide 1 (55, the pelt), bone 1 (25, the claw), meat 1 (20) | 5 / 3 | 8 / +2 / 6 | 19-07 | The wood's rocks and fallen trunks at d2; it holds still and watches, tufted ears, and chases only when the player is already close |

### 3.2 The undead south: ten kinds for the dark, dry ground

From the night arch down the stair to the sunken hall (d1) and the descent beyond (d2). The hours are flipped: most of the south is awake from 20:00 to 05:00, and the hall's roof counts as night at every hour. Nothing here is a person: no dead of the three races walks, the skeleton is a player's race and its flesh is never meat (BESTIARY 2, rule 4), and every creature below is a beast in shape, three of them demon-shaped (proposed; question 4), with a body that reads as an animal and no face that speaks. Meat from the south is not eaten by default (question 1).

| Kind | Size | Tier | Danger | Take s | Ways | Drops (qty, share) | Spawn cap / refill d | Sight / ear / smell | Hours | Where, and the tell |
|---|---|---|---|---|---|---|---|---|---|---|
| Carrion crow | small | 1 | 0 | 30 | snare, stalk (a sling) | feather 1 (100) | 12 / 1 | 7 / 0 / 0 | 05-20 and 20-05 in the south | The core crow, its spots thick here: on the arch, the stair's rail, the hall's broken beams; the land is crows before anything else |
| Barrow rat | small | 1 | 0 | 30 | snare, stalk | hide 1 (60, a scrap), bone 1 (40) | 12 / 1 | 3 / +1 / 5 | 20-05, any hour under a roof | The stair's cracks and the hall's floor; a scatter of rats is the hall's first tell |
| Ash bat | small | 1 | 0 | 45 | snare (a net at the roost), lure (a lantern) | hide 1 (70, the wing), bone 1 (30) | 12 / 1 | 2 / +3 / 0 | 20-05 | The arch's vault and the hall's roof; it hears every gait two tiles further than anything else, and once it lifts the hall knows |
| Grave moth | small | - | - | - | no `hunt`, ambient only; nothing is taken from it | - | - | - | 20-05 | A grey cloud round the night arch's lamps; it lifts in a cloud, a noise of 5 |
| Shade fox | small | 2 | 0 | 75 | snare, lure (a bone) | hide 1 (80, the black pelt), bone 1 (20); the meat is not eaten | 12 / 2 | 7 / +2 / 8 | 20-05 | The dry ground between the arch and the hall; it looks back from the edge of the lamp's light |
| Bone hound | medium | 2 | 1 | 120 | fight, lure (a pit, after the fight) | bone 2 (60), hide 1 (40, dry hide); no meat | 8 / 2 | 6 / +1 / 9 | 20-05, any hour in the hall | A hound-shaped beast at the hall's doors, wild, with no keeper: it bluffs with a rush that stops a tile short (HUNTING 11), a growl that is a noise of 9 |
| Cinder imp | small | 3 | 1 | 90 | fight, lure (a coin in a snare, after the fight) | bone 1 (50, the horn), hide 1 (50, the ember hide) | 8 / 2 | 6 / +2 / 0 | 20-05 | The hall's braziers; it throws an ember that lands a tile short, a hazard that hurts nothing until the fight; it never speaks |
| Tomb spider | medium | 3 | 1 | 120 | fight, lure (a moth at the web, after the fight) | hide 1 (60, the chitin), sinew 2 (40, its silk) | 8 / 3 | 3 / +3 / 0 | any hour under a roof | The hall's corners; it feels the web, so a player who steps on a strand is noticed at any gait; it holds the web and bluffs |
| Barrow fiend | large | 5 | 2 | 240 | fight, lure (a pit with bait, T5, after the fight) | bone 2 (50, the horns), hide 1 (40), sinew 1 (10) | 5 / 5 | 8 / +2 / 8 | 20-05 | The descent at d2: horns, a hunch, a hide like old bark; escaped by construction (BESTIARY 2, rule 10); above the open ladder, so it stands without `hunt` until tier 5 opens, a hazard and not prey |
| Ash drake | large | 8 | 2 | - | fight, lure (a pit with bait, T5), both only at the ladder's end | hide 1 (40, the scale), bone 2 (30), sinew 1 (30) | 1 / 30 | 10 / +2 / 10 | 20-05 | The descent's end: seen from the stair long before it is reached, asleep on its ledge by day; the dragon of the south, a landmark in the first ring and not prey; without `hunt` until tier 8 opens; its cap of 1 per 1000 with the floor of one (section 4) is one drake in the descent |

The demons are three: the hound, the imp and the fiend. They are beasts in the kernel like every other kind: the same fields, the same caps, the same tells, and nothing in the content calls them by a word from a creed. A dragon larger than the drake, the one that a whole party fights, is the combat stream's and not an entry on this page.

## 4. Balance by the number of players

Nothing in the kernel counts players today: the world is one player's, and a carcass lies in that player's state. When the server lands (NEXT 18) the herd and the carcasses move to the world's state, and the fields do not change. What the fields give the server is a standing count and a refill, so the balance by player count is arithmetic over them, proposed here and provable by a tool once the spawner exists:

- **The standing count** of a kind in a region is `cap_per_1000` times the region's habitat tiles over 1000, rounded down, and one at least where the kind has any habitat at all. A d0 kind on 2000 tiles of its habitat stands at 24; a d2 kind on 400 tiles at 2 (the whole first map holds 994 tiles at d2, FIRST_MAP); the drake, at a cap of 1 per 1000, stands at one in the descent by the floor.
- **The refill** is one lost member back after `refill_d` game days when no player is within 20 tiles (BESTIARY 2, rule 11), so a region yields at most the standing count over `refill_d` takes of that kind a game day: 24 a day for the d0 kind above, under one a day for the d2 kind.
- **The share per player** is that yield over the players in the region. The targets this page proposes: a d0 flee kind feeds one take per player per day until the region holds as many players as its standing count (24 for the example); past that the kind thins, and the solver's capacity rule, which already sees the spots and the refill (`capacity` on the hunt activity), prices its goods up. A d2 kind is scarce by design at any count: at most one take a day for a region, whoever gets it.
- **The lever that is not a knob:** a creator cannot raise a cap past 12 / 8 / 5 (the check), so a crowded region is answered by more habitat, more kinds or a shorter refill, never by a richer animal.
- **The prover** (not built): a `pnpm balance` row per region and kind that prints the standing count, the takes a day, and the number of players at which the kind empties in one day; the row goes red when a d0 kind empties under 8 players in a region, the threshold this page proposes.

Small and easy against big and hard, in these terms: the hare is capped at 12 per 1000 and is back in a day, so eight players on the valley floor never run it out; the lynx is capped at 5 per 1000 on the wood's rocks and fallen trunks, a few hundred tiles at most (the whole map holds 994 tiles at d2), so it stands at one or two and is back in three days, and a party that takes both in a night has emptied the wood's rocks until the week turns.

## 5. What this page does not decide

- **The look of any kind.** The owner picks from stills, one kind at a time; the first two bodies that move (the hare and the crow) are a separate pull request with pick pages, and the four-poses-a-loop budget of DECISIONS 2026-10-29 bounds every animal's sheet.
- **The take.** Which tool fells which size, the unaware check, the thrown stone and the snare are HUNTING 5's and come with the creature schema; this page only names the ways.
- **The fight.** Every `fight` way waits for G35 and the combat stream; until then a defender bluffs and a hunter is a hazard escaped by construction.
- **The goods' items and their drawings.** The item files (`core/dove-feather`, `core/lynx-hide`, ...) are written when their icons exist; MATERIALS 2 and 6 count the valley's; the two lands add to that count.
- **The spawner.** Habitat tiles, anchors and clusters are the creature schema's; the fields here are what it will read.

## 6. Open points for the owner

Each one sentence, three options, A the recommendation, and the default this page is written on.

1. **Is meat from the south eaten?** A (recommended): no, the south's kinds drop hide and bone only, and the skeleton's "mended, not fed" stays whole. B: eaten by humans and elves, refused by the skeleton. C: eaten by all, as any meat. Default: A.
2. **The ash drake in the first ring.** A (recommended): a landmark without a `hunt` block, seen from the stair and never reached, until the ladder opens to tier 8. B: prey at the ladder's end, a party's trap. C: not in the first ring at all. Default: A.
3. **The south's hours.** A (recommended): flipped, 20:00 to 05:00, with the hall's roof counting as night at every hour. B: the valley's hours. C: every hour, everywhere in the south. Default: A.
4. **The demons' shape.** A (recommended): beasts in shape, horns and hide, no face that reads and no speech. B: horned walkers on two legs. C: no demons, animals only. Default: A.

## Sources

- [BESTIARY.md](BESTIARY.md) sections 1, 2, 4 and 5 (the twelve, the rules, the open questions); [FIRST_MAP.md](FIRST_MAP.md) (the regions, their climate and danger, the passes and the descent); [TONE.md](TONE.md) (the rating line, the gore line); [GAME_RULES.md](GAME_RULES.md) G30, G34, G35, G45, G46, G64; [MATERIALS.md](MATERIALS.md) sections 1, 2 and 6; [GAP_RDR2.md](GAP_RDR2.md) sections 2 and 8.
- [HUNTING.md](HUNTING.md) sections 5, 6, 8, 9, 10 and 11 (the tools, the goods and the carcass, the kinds by danger tier, the pay and its cap, the rating's rules, the open questions).
- DECISIONS.md: 2026-10-25 (the ambient creatures wait for the redraw), 2026-10-29 (movement: four poses a loop), 2026-10-30 (the hunt foundations: the fields this page is written in).
- Code: `schema/src/index.ts` (`CreatureKind`, `Hunt`, `HUNT_WAYS`, `GOODS`); `content/core/map.json` (`creatures`); `content/core/params.json` (`hunt`, `open_tiers`); `kernel/src/hunt.ts`; `tools/src/check.ts` (`checkHunt`).
