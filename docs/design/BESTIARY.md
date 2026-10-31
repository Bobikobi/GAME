# The bestiary: the first twelve animals of the valley and the first ring

Status: drafted 2026-10-29 from docs/research/research-hunting.md; the numbers follow HUNTING.md once it lands.

A design page. It names the first twelve animals, where each sits on the danger map, what it does, what it gives and what stops the world from being emptied. It builds nothing. Combat stays the combat stream's (COMBAT.md): a hunter here is a hazard that is escaped (G34), never a foe.

## 1. The twelve animals

Words used in the table.

- **Tier** follows the region's danger level: d0 ambient and flee, d1 defend, d2 hunt.
- **Size** is the longest side in tiles at 64 art pixels per tile (STYLE.md 1 and 1b). Roe deer and wolf are 2 there.
- **Hours** are the hours awake. Outside them the animal is gone to ground (rules, section 2).
- **Hearing** is the memo's ear: keen +2, normal +1, dull 0.
- **Notice** is how far the animal hears the player, by the player's gait: still / sneak / walk / run. It is the gait's noise (2 / 3 / 5 / 8) plus the ear. Sight is the second number and works only in line of sight and in front of the animal. Smell works only upwind and is left to HUNTING.md.
- **Pays** lists goods by count, a kill's whole yield. Every price and trade value comes through the hunt value source, never per animal. **Cap** is the spawn cap per 1000 habitat tiles for its tier (d0 12, d1 8, d2 5), under 24 awake animals simulated within 40 tiles of any player.

| Animal | Tier | Behavior | Size | Look (64 px, top-down) | Goods | Hours | Hearing | Notice (sight) | Tool gate | Pays and cap |
|---|---|---|---|---|---|---|---|---|---|---|
| Sparrow (the five, ambient set) | d0 | ambient | 1 | Brown speck with a pale breast, hops on the ground, lifts in a burst | feather (moult only) | 05:00-20:00 | dull | 2/3/5/8 (5) | none, not hunted | feather 1 from the ground; d0 cap |
| Carrion crow (the five, ambient set) | d0 | ambient | 1 | Black body, heavy beak, perches on a tree or a fence post | feather (moult only) | 05:00-20:00 | dull | 2/3/5/8 (7) | none; sling or snare if wanted, meat is not eaten | feather 1; d0 cap |
| Trout (the five, ambient set) | d0 | ambient | 1 | Silver-green shape under the water, a ripple ring | meat, bone | 05:00-22:00 | dull | 2/3/5/8 (2) | bone-hook line after fire; spear in the shallows | meat 1-2, bone 1; d0 cap |
| Hare (the five, ambient set) | d0 | flee | 1 | Sandy body, long ears, sits up and bolts | meat, hide, bone | 05:00-20:00 | keen | 4/5/7/10 (6) | thrown stone, snare, sling | meat 1, hide scrap 1, bone 1; d0 cap |
| Roe deer (the five, ambient set) | d0 | flee | 2 | Red-brown deer, white rump, head down to graze then up | meat, hide, bone, sinew | 05:00-22:00 | keen | 4/5/7/10 (8) | snare; bow or spear on an unaware animal | meat 3, hide 1-3, bone 1, sinew 2; d0 cap |
| Ground fowl | d0 | flee | 1 | Speckled hen, runs, then flutters up | meat, feather | 05:00-20:00 | normal | 3/4/6/9 (5) | sling, snare; eggs by nest raid, none | meat 1, feather 2; d0 cap |
| Highland goat | d1 | flee | 1 | Grey-white body, curved horns, stands on a high tile | meat, hide, bone, sinew | 05:00-22:00 | dull | 2/3/5/8 (8) | bow from below; snare at a ledge path | meat 2, hide 1, bone 1, sinew 1; d1 cap |
| Wild boar | d1 | defend | 1 | Dark bristled body, low head, pale tusks | meat, hide, bone | 05:00-09:00 and 19:00-23:00 | dull | 2/3/5/8 (4) | spear from a ledge; pit trap with bait; never head on | meat 3, hide 1, bone 1 (tusk); d1 cap |
| Dust adder | d1 | defend | 1 | Tan coil on a warm rock, dark zigzag back | hide, meat | 06:00-20:00 | dull | 2/3/5/8 (2) | spear from 2 tiles; snare on a rock | hide 1, meat 1; d1 cap |
| Wolf | d2 | hunt | 2 | Grey, long legs, pale eyes, low to the ground | hide, bone | 20:00-05:00 | keen | 4/5/7/10 (8) | none: escaped, or trapped with bait after combat lands | hide 1, bone 1 (fang), meat 1; d2 cap |
| Wildcat | d2 | hunt | 1 | Tawny, tufted ears, crouched in cover, holds still | hide, meat, bone | 20:00-05:00 | keen | 4/5/7/10 (7) | none: avoided; baited snare or box trap | hide 1 (fine fur), meat 2, bone 1 (claw); d2 cap |
| White bear | d2 | hunt | 2 | Heavy cream body, dark nose, asleep in its den ring by day | meat, hide, bone | 20:00-07:00 | dull | 2/3/5/8 (5) | none: avoid its ring of 8 tiles; late ice pit with bait | meat 5, hide 1 (thick fur), bone 1 (claw); d2 cap |

By tier.

- **d0, ambient and flee:** sparrow, carrion crow, trout, hare, roe deer, ground fowl.
- **d1, defend:** wild boar, dust adder. Highland goat flees here.
- **d2, hunt:** wolf, wildcat, white bear.

Notes on the table.

- **Where the numbers come from.** Sight, ear, tier, goods, hours and tool gates are the memo's catalogue and tool ladder (a proposal, not a source). The notice cells are the memo's rule: the animal tests the gait's noise plus its ear. Trout has no senses in the memo; the sight 2 is the alert distance of the placed spot today, ours.
- **Pay and cap are the memo's figures, not final.** HUNTING.md will hold them. COMBAT.md section 4.9 is being revised and is not copied.
- **Goods count for everyone.** The memo asks whether elves eat meat and what a skeleton gets from it (question 3 below). The table lists what an animal gives, not who uses it.
- **Fish counts as meat.** The memo lists fish as its own good. This page folds it into meat until HUNTING.md says otherwise.
- **The wolf is a hazard.** G30 and G34 keep it a hazard: away by day, out after dark, its den and tracks marking where it hunts, escaped by running to a safe place. A pack, its howl and trapping are the memo's later phase.
- **Tier d2 for the wolf is the memo's.** It puts the pack at the elf wood fringe and the mountain feet. The one wolf in the kit today (props/hazard_wolf) is a prop under G30, not a creature, and this page does not move it.

## 2. Rules for every animal

1. **No blood on an animal.** A kill is a puff, a fade or a drop of goods. No suffering animation, no crying sound, no executing a downed animal, no corpse piles.
2. **No baby animals.** None is hunted, harmed or drawn as prey. A herd shows adults only.
3. **A pet is never prey.** No dog, cat or horse as a target. A tamed animal is never harmed in front of the player.
4. **No human or skeleton flesh as meat.** Ever.
5. **No spawn on safe ground.** No animal spawns on a town tile, on a camp's safe tiles or inside a burning fire's safe tiles (G30). None spawns within 14 tiles of a player, in view, within 12 tiles of the town square or on a path leg of the valley opening. The memo's numbers; HUNTING.md will hold them.
6. **A hunter never stands on d0.** Ground at danger level 0 is safe at every hour (G30). Defenders start at d1, hunters at d2.
7. **Animals go to ground at dusk.** Prey is awake from 05:00 to 22:00 and no later: the owner's default (question a). Predators and the boar keep the other hours. Dark runs 20:00 to 05:00 (G30), so the last two prey hours are the dusk ramp. Small animals go to ground when the dark starts. At dusk the burrow, the roost or the cover tile shows; the animal does not vanish.
8. **Noise by gait.** Still 2, sneak 3, walk 5, run 8 tiles. An animal hears a gait at that radius plus its ear. Chopping, digging and butchering are 9; a bell or horn 14. These are the memo's proposals.
9. **Every reaction has a tell.** A phone shows about 6 by 13 tiles (STYLE.md 1), so a notice radius of 8 or 10 reaches off screen. Any animal that reacts to something unseen shows it on screen first: a head up, a lift of birds, a sound icon.
10. **A hunter is escaped by construction.** Its speed is no higher than the player's walk and it gives up. Contact before combat exists has no damage (question c).
11. **No world emptied.** Spawn is by anchor with a count; a lost member returns after one game day if no player is within 20 tiles.
12. **No lore from the narrator.** Any line about an animal is present tense and states nothing about the past (STORY.md S1 and S2). A line about the past needs a named speaker, or it is left out.

## 3. The opening's ambient five

Sparrow, crow, trout, hare and roe deer are in the map today: 17 spots, five kinds, with the looks bird, fish, rabbit and deer. The wolf is declared beside them with no spot (look `canid`), so the bank wolf stays the hazard on its round (question f). Since the creature schema the crow, the hare and the roe carry their character as data (`behaviour`: senses, roam, flight, group), and the hare and the roe carry their goods (`hunt`, priced by the hunt value source). Nothing steps, takes or draws an animal yet, so in play the five are still cosmetic, and they stay unhuntable in the first hour. A sparrow sits on the ground, a crow perches in a tree, a trout rests in the water, the hare and the roe stand on the grass. Once drawn, each lifts, dives or steps away a few tiles when the player comes near (each carries an `alert_tiles` for it: 3, 3, 2, 4 and 5) and returns after a pause. The five make the first hour feel lived in and teach one thing: the valley notices the player. When behavior lands, the sparrow and crow lift on the player's noise radius and the hare and roe flee on it, with the tell of rule 9. The hours of section 1 are built for all five: the sparrow, the crow and the hare are out from 05:00 to 20:00, the trout and the roe from 05:00 to 22:00 (rule 7). One roe spot moved from 44,11 to 10,11, by the river: the roe drinks, and no water lay within its roam at the old spot. So the opening's timing changes in two ways. The sparrow, the crow, the trout and the hare had no hours, which the schema read as all day and never at night and the wild brain reads as every hour; now each names its own and goes to ground at 20:00, the trout at 22:00. The roe, out from 05:00 to 08:00 before, is out to 22:00, through the dusk ramp (question d). A player sees both once the five are drawn and stepped. The quests are unchanged. Question (g) asks whether the opening keeps these hours.

## 4. What this page does not decide

- **The look of each animal.** The owner picks from stills at phone size, the roe deer first. The table's look line is a brief, not a design (AGENTS.md, a direction is the owner's).
- **The behavior code.** The state machine, flee map, think steps and wind are the combat stream's.
- **The content JSON.** The creature schema holds it (`map.creatures.kinds` in `content/core/map.json`): the hare, the crow, the roe deer and the wolf, with the numbers of this page and HUNTING.md 8, the ear in HUNTING 3's steps: this page's dull 0 and keen +2 are the same numbers there (HUNTING 3 names the 0 normal), so the notice column stands. A number changed here is changed there too.
- **The hunt value source.** What a good is worth and how a kill pays comes from HUNTING.md and the values lock.
- **The other seven archetypes** of the memo's nineteen: marsh duck, shore crab, herring shoal, hill sheep, marmot, ptarmigan, great stag. They follow later.

## 5. Open questions for the owner

Each has the default this page was built with.

- **(a) Do animals go to ground at dusk?** The memo suggests it because the mist comes at dusk (a bone anyone can see, STORY.md S3). Answered by the owner, 30.10 (DECISIONS, the wild animals' brain): yes; at night the day kinds leave the map, a few stragglers at most, and the night brings its own kinds. The default's window, prey awake 05:00 to 22:00 at the most, stands.
- **(b) Which animal gets the look pick first?** Default: the roe deer, the central hunt and the biggest of the five.
- **(c) What does contact with a defender or hunter do before combat exists?** The memo suggests a shove back 2 tiles and a dropped carcass. Default: no damage; the memo's shove only.
- **(d) May the hours run past the dark?** G30 starts the dark at 20:00, but the prey window ends at 22:00. Default: yes, the two hours are the dusk ramp, and the mist's rules are unchanged.
- **(e) Who eats what?** The memo asks whether elves eat meat and what a skeleton gets. Default: goods exist for all three races and content does not say who eats; a skeleton may swap meat for bone later.
- **(f) Is the wolf a creature or a hazard?** Default: a hazard with a den, tracks and a round (G34); the pack and trapping wait for the combat stream.
- **(g) Does the opening keep the bestiary's hours?** Section 3 held the opening's roe at 05:00 to 08:00 until this page's hours were built, and the sparrow, the crow, the trout and the hare carried none. The creature schema builds them: the roe is out from 05:00 to 22:00 like every roe, one of its two spots by the river, and the other four go to ground at 20:00, the trout at 22:00. Default: yes, rule 7 and questions (a) and (d) hold in the opening too.
