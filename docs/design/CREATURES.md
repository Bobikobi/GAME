# The creatures layer: NPCs, enemies and monsters per world (research memo)

**summary**: Raw data and a recommendation for the owner, nothing built (issue #612: "Creatures layer: NPCs, enemies and monsters per world, party-able or foes by nature (research memo first)"). Repo context read in the worktree at develop 7f3635811: STORY.md (S1 to S6, the three beliefs, the three folds), GAME_RULES.md (G17, G20 to G22, G28, G30, G31, G33 to G35, G39, G41, G42, G44 to G47, G64, G70, G78 to G86, G102, sections 6 to 8), COMBAT.md (4.1 the `foe` type, 4.9 the numbers, 5 the rule lines, 6 the order), BESTIARY.md and BESTIARY_LANDS.md (the valley's twelve, the elf wood's ten, the undead south's ten, rule 4 "no dead of the three races walks"), CREATURE_BEHAVIOUR.md (1 and 8), HUNTING.md (8, 9, 11), HUNT_FAMILIES.md (2), HUNT_LADDER.md:134 (the gate's unit), EQUIPMENT.md (2 to 5), PROGRESSION.md (4.2 the combat schools and the Company school), GROWTH.md (the decisions table), SETTLEMENT.md (3.5 to 3.7), FIRST_MAP.md, TONE.md (1 to 4), EMPTY_WORLD.md:48, GAP_DIMRAETH_DRAKANTOS.md (3 and 9), DECISIONS.md (22.10 and 23.10 the races and their bodies, 2026-10-20 the valley's own people on routes, 2026-10-23 the open ends and the bag, 2026-10-30 the creature schema and the wild brain, 2026-11-01 the danger slot), `content/core/races/*.json` (the attribute profiles), `content/core/npcs/*.json` (the two speaking characters), `kernel/src/step.ts:997` (`salePrice`, R8), `content/core/params.json` (`hp_cap`, `open_tiers`, `tier_min_level`, `power_cap_permille`, `rarity_bonus_ms`, `wear_effect_max_pct`, `hazard`, `gait`, `hunt`, `wild`), issue #600 (open: the unit of `pay_per_s_mg`). The owner's words in the issue, translated: evil skeletons in many sizes and levels with a more wicked look in the world of the dead; the core roles may be the same in every world, but never a different look over the same stats; unique combat and matching weapons; their weapons taken from them and recycled or sold.

PROVENANCE: every outside claim carries a tag. [F] fetched and read; [S] a search engine's summary of the page, the page itself not fetched; [D] derived here from the repo's own rules and numbers, a proposal and not a finding; [E] an estimate; [NF] looked for and not found. Repo claims cite the page and section. Nothing below is a decision: the owner's questions stand at the end, each with a recommended answer and a default.

NOT FOUND (explicit gap list): an official Octopath Traveler enemy taxonomy (the wikis list enemies by region and weakness, not by family) [NF]; Dragon Quest XI's sell-price ratio [NF]; Stardew Valley's heart-level thresholds and the full heart-event list in one page (one example found) [NF]; Zelda Breath of the Wild sale prices for weapons (weapons cannot be sold there; only monster parts) [NF]; a Drakantos bestiary count that is not a cut snippet ("150+" is unverified) [S]; a Castlevania or Dark Souls skeleton size ladder with numbers (not searched, so not cited; the size ladder below comes from Zelda's Stal family and from our own tiers) [NF].

HEADLINE FINDINGS:
1. The five roles the issue names (quest giver, ambient folk, dweller of a far place, companion, foe by nature) are one axis the repo does not have yet: today a character is an `npc` with lines, a creature is a kind under `map.creatures.kinds` with `hunt` or `protected`, and a foe is COMBAT 4.1's `foe` type, not built. A `role` written once on a kind or a person, by nature, is the smallest addition that lets the check, the boards and the quests read "who can join and who bites" (STEP 1).
2. "Never a different look over the same stats" is answered by the races' own gaps, which already exist as data: human 1/2/1/1/1/1, elf 0/2/2/1/0/2, skeleton 1/1/0/1/4/0 (might, senses, agility, luck, stamina, spirit; `content/core/races`). Each world's creatures mirror its home race: the human world's are even, the elf wood's are fast, far-sighted and short of breath, the dead world's are slow, hard, hearing-led and long in health, and each world fears a different thing (fire and noise; light and open ground; fire and day). The role tables of STEP 2 carry those gaps as numbers on COMBAT 4.9's own scale (hits to fell, harm per hit, pace, senses, fears, weakness), so three worlds never share a stat line [D].
3. The owner's wicked skeletons collide with BESTIARY 2 rule 4 ("no dead of the three races walks; the skeleton is a player's race"). Zelda's Stal family shows the way out: Stalkoblins are reanimated remains that rise at night in groups of 2 to 3 and reform from scattered bones, Stalmoblins crumble after a few hits, and the Stalnox lies as a pile of bones by day [S]. Read as "bone-things of the fold under the bells that never woke", in three sizes (a crawler, a walker, a warden) on COMBAT's three hit tiers, night-only with a bone heap by day, they are beasts in the kernel like the hound and the fiend, carry no face that speaks, and no returner walks (question 1, with the rule's one-line rewrite).
4. The wicked look at 64 px is three marks and no more: an eye-light in the sockets, the one colour the race never has; a wrong build (hunched, arms too long, a crawl, a mass); and a grave-weapon as the one big item. The race's skeleton stays bare bones with empty sockets and one item of its own, so a player reads friend from foe at a glance (DECISIONS 22.10 and 23.10: one big item, one colour, own build). The stills are a direction decision and not this memo's (AGENTS.md).
5. Weapons taken on a fall need one field, not a system: `drops[].worn_permille`, how much of the weapon's `uses` is already spent when it lands in the bag. The kernel already sells a worn tool for its share of uses left (`salePrice`, R8), EQUIPMENT already mends at a bench and salvages at Tinkering, and the trader's daily cap already holds the gold. Zelda's constant breaking is not copied: its weapons vanish; ours wear and mend. The cost gate of #600 prices a worn weapon at its remaining share, in value units per active second as HUNT_LADDER 134 proposes, and a fresh weapon never comes from a fall (STEP 4).
6. Companions join by standing, not by chance or money: the valley's own people at the friend tier, one skill each (carry, hold, spot, light), never a strike in the first cut (COMBAT 6: companions in a fight are not done there; the checklist's "bare hands win by reading the pattern" holds with a companion beside you). Octopath's capture (Ochette, up to 6 monsters) and Dragon Quest V's recruitment by a fixed percent per breed are the alternative, offered as question 5 and not recommended first.
7. Where the big games agree and we follow: visible, hand-placed foes with no random encounters (Sea of Stars); one weakness per kind that is read, not rolled (Sea of Stars' locks, COMBAT G79); a party cap of three (Sea of Stars) as `party.max`; folk with ranked schedules and friendship tiers (Stardew); a buyer for the spoils (Stardew's Adventurer's Guild, our trader); difficulty that reads the party's size (Drakantos, SETTLEMENT 3.6, BESTIARY_LANDS 4). Where we differ: no monster-only dungeon layer (foes stand in the wild by `d`, G64 and G80), no eradication counters (G28), no weapons that vanish (EQUIPMENT), no colour tiers over one move set (the owner's word), nothing fights in the opening (G35) and the hazard stays a rule (G34, G80).

## patterns
### patterns[0]
**name**: P1 Roles by nature, written once on the kind

**what**: Every creature and person has one nature (folk, giver, dweller, companion, foe) that the world reads everywhere: who speaks, who joins, who bites, who can be taken from. A kind never changes nature at runtime; a person may hold two natures that do not fight (a giver who is also a companion).

**who_does_it**: Stardew Valley keeps villagers (schedules, gifts, hearts) and monsters (the Mines, Skull Cavern, Quarry Mine, Mutant Bug Lair, Volcano Dungeon, Secret Woods, the farm by option) as two layers that never cross [S]. Dragon Quest V marks which breeds may be recruited (a fixed percent per breed, a minimum hero level) and which never [S]. Sea of Stars places every enemy by hand and lets every party member swap freely at no cost, so who fights is the content's hand [S].

**fits_us_because**: The repo already has three kinds of content for these roles (`npc`, `creatures.kinds`, the proposed `foe`), SETTLEMENT 3.7 already gates joining on a `companion` block, and the check can read one word faster than three shapes. G70 (a race changes how, never whether) wants the roles the same in every world and the numbers different.

**source**: https://stardewvalleywiki.com/Monsters ; https://dragon-quest.org/wiki/Monster_recruitment ; https://www.nintendoworldreport.com/preview/59815/sea-of-stars-hands-off-preview-and-interview ; SETTLEMENT.md 3.7; COMBAT.md 4.1

### patterns[1]
**name**: P2 The bestiary as a table of fields per land, and a journal that lists what was seen

**what**: One shape for every kind (size, tier, danger, take, ways, drops, spawn, senses, hours, the tell), one page per land; the player's journal fills with kinds seen, never with counts to grind.

**who_does_it**: Dragon Quest groups every monster into 14 or 15 families (Aquatic, Beast, Bird, Bug, Demon, Dragon, Elemental, Humanoid, Machine, Material, Plant, Slime, Undead, Zombie; Boss in the Monsters series), a concept from DQ III where dragons and undead take extra damage from certain weapons, and gives each game a book (DQ VII's Big Book of Beasts, DQ IX's bestiary by family) [S]. Stardew's wiki lists each monster by location with HP, damage and drop odds (the Serpent: 150 HP, 23 damage, Void Essence 99%, Bomb 15%, Spicy Eel 6%, Prismatic Shard 0.1%) and a "dangerous" variant per monster (Armored Bug 250, Mummy 445, Royal Serpent 675) [S]. Octopath Traveler II's community guides list enemies by region with their weaknesses, and no official family taxonomy was found [NF]. Stardew's Adventurer's Guild pays eradication goals (1000 Slimes for the Slime Charmer Ring, 150 Void Spirits for the Savage Ring; cave insects cut from 125 to 80 in 1.6) [S].

**fits_us_because**: BESTIARY_LANDS already is that table, three lands with the same columns. Our families are the hunt families of HUNT_FAMILIES 2 and the lands themselves; a `role` column is the one missing axis. A counter to 1000 kills is a dark pattern (G28) and a grind the gap page tells us to leave (GAP_DIMRAETH 3: repeated foes); a journal of kinds seen is the `collection` quest type of G17.

**source**: https://dragon-quest.org/wiki/Monster_Families ; https://dragon-quest.org/wiki/Bestiary_of_Dragon_Quest_IX_(Family) ; https://stardewvalleywiki.com/Serpent ; https://wiki.stardewvalley.net/Skeleton_(dangerous) ; https://stardewvalleywiki.com/Modding:Monster_eradication_goals ; BESTIARY_LANDS.md 1

### patterns[2]
**name**: P3 Bone enemies that rise at night, in a size ladder, and lie as a heap by day

**what**: The undead of the world are a family of sizes with the same marks (bones, a light where the eyes were, a weapon of the grave), awake only at night, scattered by day as a prop, each size with its own move set and its own weapon.

**who_does_it**: Zelda Breath of the Wild's Stal family: the Stalkoblin is the reanimated remains of a Bokoblin, rises only at night in groups of 2 to 3, and its bones roll back to reform until the skull is broken; the Stalmoblin wields spears and bows and crumbles after a few hits; the Stalnox is a skeletal Hinox, a pile of bones by day and the boss of the Lockup; the Stalizalfos completes the set [S]. Their weapons are of the body: the Boko Arm (power 5, durability 5) comes from a Stalkoblin, the Moblin Arm (power 15) is a two-handed bone club that is brittle [S], and the Lynel's weapons reach 100 [S].

**fits_us_because**: The south's hours are already flipped (20 to 05, and the hall's roof counts as night at every hour; BESTIARY_LANDS 3.2), COMBAT 4.9 already has three hit tiers (T1 two hits, T2 six to eight, T3 twenty and up with a wind-up of eight ticks) that make a size ladder without a new scale, and the bone heap by day is a prop that cannot be struck, which keeps G46 (no violence against what cannot act) and gives the beliefs a clue with two readings (S4).

**source**: https://zeldadungeon.net/wiki/Breath_of_the_Wild_Enemies ; https://www.zeldadungeon.net/wiki/Stalkoblin ; https://www.zeldadungeon.net/wiki/Stalmoblin ; https://zeldadungeon.net/wiki/Stalnox ; https://www.zeldadungeon.net/wiki/Boko_Arm ; https://zeldawiki.wiki/wiki/Moblin_Arm ; https://zeldawiki.wiki/wiki/Lynel_Crusher ; COMBAT.md 4.9; BESTIARY_LANDS.md 3.2

### patterns[3]
**name**: P4 Weapons come from the fallen, and the body's parts become the weapon's power and look

**what**: An enemy's weapon drops when it falls; a part of its body (a horn, a claw) fused to a weapon gives it power and its look; the economy around it is either break-and-replace or part-and-forge.

**who_does_it**: Breath of the Wild: durability is a fixed use count minus one per hit, a thrown weapon breaks, there is no crafting or upgrade, and weapons come mostly from defeated enemies; GamesRadar called it "boldest, riskiest, most frustrating and yet most shrewd" [S]. Tears of the Kingdom's Fuse: a Bokoblin Horn adds 4 (a sword of 5 becomes a "Boko Reaper" of 9), a Blue Bokoblin Horn 7, a Silver Lynel Saber Horn 55 and Mace Horn 51; Gerudo weapons double the fused power; claws and teeth double on arrows; the horn gives the weapon its look [S]. Stardew's monster loot sells at the Adventurer's Guild or in the shipping bin (Slime 5g, Bat Wing 15g) and Marlon sells weapons, boots and rings; a player reports he buys a 75,000g Galaxy Hammer back for 600 [S, a forum post]. The dangerous Skeleton drops Bone Fragments (50 / 40 / 20%) and a Bone Sword at 4% [S].

**fits_us_because**: EQUIPMENT 4 already wears tools and weapons by `uses` and mends them at a bench; PROGRESSION 4.2 already names Tinkering `salvage` (parts back from a broken made thing); `salePrice` (R8) already pays the share of uses left; the trader's daily cap (DECISIONS.md:1051) already holds the gold. So the part-and-forge way is one field away (`worn_permille` on the drop), and the break-and-replace way would undo three pages. HUNTING 9 refuses the sale of raw hunt goods, so a bone or a horn is forge material and a made weapon is the only thing from a fall the trader buys.

**source**: https://zeldawiki.wiki/wiki/Durability ; https://www.gamesradar.com/zelda-breath-of-the-wild-broke-the-mould-and-me-by-breaking-its-weapons ; https://zeldadungeon.net/wiki/Fuse_Attack_Power ; https://game8.co/games/Zelda-Tears-of-the-Kingdom/archives/414617 ; https://zeldadungeon.net/wiki/Silver_Lynel_Saber_Horn ; https://stardewvalleywiki.com/Monster_Loot ; https://forums.stardewvalley.net/threads/marlon-why.12543/latest ; https://wiki.stardewvalley.net/Skeleton_(dangerous) ; EQUIPMENT.md 4; kernel/src/step.ts:997

### patterns[4]
**name**: P5 Companions by standing, capture by chance, hire by money: three ways to fill a party

**what**: Games fill a party from the world by one of three keys: standing (a person who likes you comes), chance (a beast is captured or recruited at a percent), money (a person is hired for a fee).

**who_does_it**: Octopath Traveler II: Allure (Agnea, by day, a percent chance; Alrond at 2%), Hire (Partitio, by night, money; Alrond 200,000 leaves), Befriend (Ochette, by night, food), Guide (level-gated, 80 for Alrond); a recruited townsperson is summoned in battle [S]. Ochette captures up to 6 monsters, summons them without limit and Prepares them into items [S]; H'aanit in the first game captured with limited uses [S]. Dragon Quest V: recruitment is a fixed percent per breed with a minimum hero level; the king slime takes the names Blubba, Baron, Earl, Viscount, the liquid metal slime has extremely low odds, the metal king slime cannot be recruited in V [S]. Stardew Valley: the player passes out alone; no companion fights (research-animation.md, earlier memo). Drakantos plans about 195 pets, "dozens" on Steam, each with a skill, on a free-to-play account of 21 swappable hero classes [S].

**fits_us_because**: Folk hold no gold and trade nothing (DECISIONS 2026-10-20, A1), so hire is out; G39 sells no power and G102 shows every odd, so a capture at 2% is a slot machine the rules refuse; standing already exists as the four tiers stranger, acquaintance, friend, family (`REP_TIERS`, schema/src/index.ts:87). The Company school of PROGRESSION 4.2 (pet_slot, pet_carry, ally_hold) names the skills a companion brings.

**source**: https://gamerant.com/octopath-traveler-2-every-path-action-ranked/ ; https://progameguides.com/?p=558603 ; https://game8.co/games/Octopath-Traveler-2/archives/403906 ; https://octopathtraveler.fandom.com/wiki/Talents_(Octopath_Traveler_II) ; https://segmentnext.com/capture-monsters-in-octopath-traveler ; https://dragon-quest.org/wiki/List_of_recruitable_monsters_in_Dragon_Quest_V ; https://store.steampowered.com/app/2454980 ; PROGRESSION.md 4.2; SETTLEMENT.md 3.7

### patterns[5]
**name**: P6 Visible foes, one weakness each, read and not rolled, and a party of three

**what**: Enemies stand in the world where the content put them, each with a visible weakness the fight exploits; no random encounters, no grind, a small party.

**who_does_it**: Sea of Stars: enemies are visible, fights are hand-placed, there is no grinding, experience is party-wide with 100 to the next level and a "rubber band", and revisited enemies give little; Locks show a damage type as an icon, breaking one weakens the move, breaking all cancels it, two-hit attacks count twice, swapping party members is free, the party is three, and combos join two members [S]. Drakantos scales enemy difficulty with the player count [S].

**fits_us_because**: COMBAT G79 ("a fight is read, not rolled") and 4.1's `weak.after` are this pattern in one move; `party: { min, max }` (SETTLEMENT 3.7) is the cap; BESTIARY_LANDS 4 already balances by the number of players; GAP_DIMRAETH 9 keeps "one weakness" and leaves "repeated foes" and "i-frame walls".

**source**: https://www.kakuchopurei.com/2023/08/sea-of-stars-dungeon-combat-guide/ ; https://nintendowire.com/reviews/sea-of-stars/ ; https://techraptor.net/gaming/previews/sea-of-stars-is-retro-inspired-rpg-without-dated-mechanics ; https://rpgsite.net/review/14764-sea-of-stars-review ; https://massivelyop.com/2024/11/09/interview-drakantos-discusses-multiplayer-open-world-content-monetization-testing-and-more/ ; COMBAT.md 4.1 and 5

### patterns[6]
**name**: P7 Folk with ranked schedules and standing tiers, and a far place with one dweller

**what**: Town folk move by a schedule ranked by condition (rain, a festival, a place's state), speak by standing, and a far place holds one person who knows it.

**who_does_it**: Stardew Valley: Shane's routine changes with weather, the Community Center's state and festivals; Harvey's schedules are ranked highest to lowest within a season and rain overrides them all; two gifts a week plus a birthday (8x) move friendship; a Six Hearts event fires in Cindersap Forest between 9am and 8pm in rain [S]. Octopath's towns put one or two knowing people at each far place for the path actions (information, possessions, people) [S].

**fits_us_because**: DECISIONS 2026-10-20 already gives a character a `route` (`[{at, hour}]`) read from the tick and the seed, no gold and no stock; the `npc` type already speaks by the four tiers and by `when`; EMPTY_WORLD.md:48 already wants ten to twenty figures for the first ring's town; FIRST_MAP already places three wayside stalls in the elf wood and the night arch in the south, each a far place for one dweller.

**source**: https://stardewvalleywiki.com/Shane ; https://www.bisecthosting.com/blog/stardew-valley-npc-summer-schedule-location-marriage-candidates-events ; https://gamerant.com/octopath-traveler-2-every-path-action-ranked/ ; DECISIONS.md:2034; EMPTY_WORLD.md:48; content/core/npcs/elder.json

**recommendation**: THE CREATURES LAYER, IN THE ORDER TO BUILD IT. Numbers marked [D] are derived from COMBAT 4.9, BESTIARY_LANDS and the races' profiles; nothing here is content until the owner answers the questions at the end, and the opening keeps no foe (G35).

STEP 1 One axis, `role`, by nature. A kind under `map.creatures.kinds` and a person of the `npc` type each carry one `role` from the closed list `folk | giver | dweller | companion | foe` (a person may carry two that do not fight: `giver` and `companion`; a kind carries one). The check reads it: a `foe` has moves and stands at danger 1 and up, never in a town, never on level 0, never at a camp or inside a fire's safe tiles (G80); a `companion` carries SETTLEMENT 3.7's `companion: { level }` and a skill; a `folk` or `giver` or `dweller` has a route or a place and a voice sheet the owner approved (G20); nothing with `role: foe` ever speaks (the demons' rule of BESTIARY_LANDS 3.2 made general), and nothing with a face that speaks is ever a foe, except the road thief, who speaks one line and is a person-foe by CR-40 [D].

STEP 2 The role tables per world, with the race's gaps as the creatures' gaps. The home race's profile (might, senses, agility, luck, stamina, spirit) is the world's signature, and each table's numbers follow it on COMBAT 4.9's scale: health as hits to fell at the kind's tier with the tier's own weapon (T1 two, T2 six to eight, T3 twenty and up), harm as a percent of the player's cap (`hp_cap` 100) per landed move, pace as ms per tile, senses as sight tiles / ear bonus / smell tiles (HUNTING 8), fears from a closed list, and the one weakness (`weak.after`). The grades of the races (elf strong north, normal city, weak south; human strong city; skeleton strong south, weak north) say which world each race finds hard, and the creatures are why [D].

Human world (the valley floor d0, the east highland d0 and d1 with the tarn, the walled city of all races at the river bend). Signature: even in every way, hands that pack well; its creatures are even too: middle health, middle pace, smell-led, afraid of fire and noise.

| Role | Kind (status) | Health (hits) | Harm % per move | Pace ms / tile | Sight / ear / smell | Fears | The fight: pattern, weakness | Weapon it carries, and the class that answers it |
|---|---|---|---|---|---|---|---|---|
| giver | Elder Maru, Pell the trader (built) | - | - | route | - | - | - | - |
| folk | the valley's own people on routes: carters, menders, a well-keeper (DECISIONS 2026-10-20; ten to twenty for the first ring's town, named, no gold) | - | - | route, ranked by rain and hour (P7) | - | - | - | - |
| dweller | the tarn hermit (highland, proposed), the wandering traveller with an ember (the Wakers, DECISIONS 22.10 decision 33) | - | - | place | - | - | - | - |
| companion | the carter (proposed): skill `carry`, joins at friend tier | falls by 8.10 | - | the player's | - | - | never strikes | - |
| foe | bank boar (COMBAT 4.1's example, danger 1, T2) | 6 to 8 | swipe 10, lunge 20 (reach 2) | 240 | 6 / +1 / 8 | fire, noise of two | swipe, swipe, lunge; open after the lunge (recover 900) | none; the spear answers the reach-2 lunge during its 700 ms wind-up |
| foe | wolf (the valley's twelve, danger 2, T2) | 6 to 8 | bite 15 (reach 1), leap 20 (reach 2) | 200 | 7 / +2 / 9 | fire, a lit road (G47) | circle, leap, bite, bite; open after the leap | none; the staff's `sweep` keeps it off, the spear hits the leap |
| foe | road thief (CR-40, a person-foe, T1 to T2 by d) | 4 to 6 | club 12 (reach 1), overhead 18 | 300 | 7 / +1 / 0 | a watched road (G47), two players | step, club, overhead; open after the overhead (recover 1000) | a blunt club or a knife blade, worn 60 to 80 %, drops at weight 25; the blade's tempo answers it |
| hazard, not foe | white bear (the twelve, T3, above the open ladder) | 20 and up | slam 30 | 350 | 6 / +1 / 10 | fire only | stand, slam, sweep; open after the slam | none; a party (`party.min` 2) and blunt `break_guard`, when tier 3 opens; until then a run (G34) |

Elf world (the elf wood, its foot at d1 and its depth at d2, north of the valley; the fold that looks like magic). Signature: a light frame, senses 2, agility 2, stamina 0; its creatures are fast, far-sighted, short of breath, and seen before they are reached (BESTIARY_LANDS 3.1): low health, high pace, long sight, a breath pool that empties after two moves.

| Role | Kind (status) | Health (hits) | Harm % per move | Pace ms / tile | Sight / ear / smell | Fears | The fight: pattern, weakness | Weapon it carries, and the class that answers it |
|---|---|---|---|---|---|---|---|---|
| giver | the three wayside stall keepers (FIRST_MAP; proposed, elf, one Mender among them) | - | - | place | - | - | - | - |
| folk | few, on long quick routes between the stalls, two lines each (proposed) | - | - | route, long | - | - | - | - |
| dweller | the glade warden (proposed): the first voice of the Keepers, "let sleeping things sleep" (STORY 3: held by nobody yet) | - | - | place, a glade at d2 | - | - | - | - |
| companion | the tracker (proposed): skill `spot`, the tell shows one step earlier | falls by 8.10 | - | the player's | - | - | never strikes | - |
| foe | wood lynx (danger 2, T2, the light frame's T2) | 4 to 6 | pounce 15 (reach 2), rake 10 | 160 | 8 / +2 / 6 | fire, open ground (never leaves the rocks) | pounce, rake, pounce; the breath empties after the second pounce and it stands open (recover 1200) | none; the spear's reach, or the bow before it closes |
| foe | great eagle (danger 1, T2, the crest only) | 4 to 6 | stoop 12 (reach 3), never under the canopy | 120 in the air | 10 / +1 / 0 | smoke, the canopy | circle, stoop, circle; open on the ground after a stoop that lands (recover 1400) | none; bow and thrown only (Aim school); a blade never reaches |
| foe | wood poacher (a person-foe, T1 to T2, proposed) | 4 | arrow 10 (reach 4), knife 8 | 220 | 9 / +2 / 0 | being seen, two players | shot, step back, shot, knife when closed; open while it draws (recover 900) | a bow (Woodcraft T1 to T2) and a knife, the bow worn 60 to 80 %, drops at weight 20; close the distance, the blade answers |
| hazard, not foe | the dead-end trails and the pool at night (FIRST_MAP) | - | - | - | - | - | a rule (G34) | - |

World of the dead (the undead south: the night arch, the stair, the sunken hall at d1, the descent at d2; the fold under the bells). Signature: stamina 4, agility 0, spirit 0, mended not fed; its creatures are slow, hard, long in health, hearing-led in the dark, and afraid of fire and day. The hours are flipped (20 to 05, and the hall's roof is night at every hour).

| Role | Kind (status) | Health (hits) | Harm % per move | Pace ms / tile | Sight / ear / smell | Fears | The fight: pattern, weakness | Weapon it carries, and the class that answers it |
|---|---|---|---|---|---|---|---|---|
| giver | the lamp-keeper of the night arch (proposed): a skeleton of the race, the south's one speaker for the bone-things (S2), a Keeper or a Waker by the owner's word | - | - | place | - | - | - | - |
| folk | three to five skeleton folk at the arch, short routes, long standing (stamina 4, agility 0), who ask what they were kept for (proposed) | - | - | route, short | - | - | - | - |
| dweller | a digger at the descent's mouth (proposed), who reads the stones two ways | - | - | place | - | - | - | - |
| companion | the lamp-bearer (proposed): skill `light`, a lantern that keeps a bone-thing a tile off | falls by 8.10 | - | the player's | - | - | never strikes | - |
| foe | bone crawler (small, 40 px box, T1, d1, night and the hall; proposed) | 3 | grab 8 (reach 1) | 500 | 2 / +3 / 4 | light within 2 tiles, day | grab, grab, drag; open while it drags itself (recover 900) | none; drops bone 1; a blade's tempo, or a lantern |
| foe | bone walker (medium, the character's 73 px, T2, d1 and d2; proposed) | 8 | swing 15 (reach 1), shove 10 that pushes a tile | 420 | 3 / +3 / 6 | fire, day | swing, swing, shove; open after the shove (recover 1000) | a grave-weapon: a rust blade or a bone club of tier 1 to 2, worn 60 to 80 %, drops at weight 25 to 30; blunt answers bone (question 4), the spear's tempo answers it otherwise |
| foe | barrow warden (large, about 110 px tall and two tiles wide, T3, d2 and beyond; proposed) | 20 and up | sweep 20 (reach 2), slam 30 (reach 1) | 600 | 3 / +3 / 8 | fire (steps back from a lit brazier), day (a bone heap) | sweep, slam, sweep, grab; wind-up 800 ms (eight ticks); open after the slam (recover 1400) | a two-handed bone club or a broken spear of tier 2 to 3, worn 70 to 90 %, drops at weight 10; blunt `break_guard` and a party of two |
| foe | bone hound, cinder imp, tomb spider (BESTIARY_LANDS 3.2, danger 1) | T2 | by that page | by that page | by that page | fire; the spider the web's breaking | by that page | none; the imp's ember is a hazard until the fight |
| hazard, not foe | barrow fiend (T5), ash drake (T8), both above the open ladder | - | - | - | - | - | escaped by construction (BESTIARY 2 rule 10) | - |

The gaps that keep three worlds from one stat line [D]: the same tier (T2) is 6 to 8 hits in the human world, 4 to 6 in the elf wood and 8 in the south; pace runs 240 / 160 / 420 ms a tile; the leading sense is smell / sight / ear; the breath pool of an elf-wood foe empties after two moves while a south foe never tires but recovers for a second or more after every heavy move; and the fears differ (fire and noise / light and open ground / fire and day). A check row refuses two kinds in different lands with the same health, harm, pace and senses (section 8 of GAME_RULES is where it goes).

STEP 3 The bone-things of the world of the dead: three sizes, three tiers, one family. Proposed names in content `core/bone-crawler`, `core/bone-walker`, `core/barrow-warden` (never the word skeleton, which is the race's id). Levels on the one scale by the area's `d` (SETTLEMENT 3.6, G64): the hall at d1 holds crawlers and walkers, the descent at d2 walkers and wardens, and beyond the first ring the same three at higher levels; more sizes only by the owner's word. Hours 20 to 05 and any hour under the hall's roof; by day each spot shows a bone heap prop that cannot be struck (G46) and is a clue with three readings. Their look at 64 px, three marks and no more: an ember light in the sockets (2 by 2 px, the one colour; the race's sockets are empty), a wrong build (the crawler on all fours, the walker hunched with arms too long, the warden a mass with a broken ring of horn for a crown), and the grave-weapon as the one big item; bone tone ash grey against the race's bone white. The stills are a direction decision (AGENTS.md) and go to the owner as two or three phone-size frames before a sprite is drawn, not in this memo.

What they are, with a speaker for every word (S2, S4): the lamp-keeper calls them "the ones who did not wake" (a Waker's reading: sleepers half-woken by the lanterns); Maru, if asked, "what the mist took and nobody mended" (a Mender's reading); the glade warden, "what was buried on purpose, and should have stayed so" (a Keeper's reading). Pell repeats all three for a price. The narrator says only what is there: bones that move at night, a heap by day (S1, S3). No reading is right.

STEP 4 Weapons taken on a fall: one field, three doors, and the gate. A `foe`'s `drops` list may carry a made weapon with `worn_permille` (how much of its `uses` is already spent when it lands in the bag), which the check holds at 600 or more for a weapon, so a fresh weapon never comes from a fall and the forge keeps its place (EQUIPMENT 5: made by Smithing, Woodcraft, Stonework). The three doors already exist: wield it (it wears by `uses` and mends at a bench: Smithing `edge_hold`, Handcraft `mend`); salvage it (Tinkering `salvage`: parts back, less than the whole, EQUIPMENT 4 and PROGRESSION 4.2); sell it (`salePrice` pays the share of uses left, R8, under `trader_day_cap`, and what the trader buys leaves the world). A bone, a horn or a hide from a fall is a hunt good: no price, never sold raw (HUNTING 9), forge material only, which is Tears of the Kingdom's Fuse without the fuse: the part goes into a recipe and gives the made thing its grade. Tier of a dropped weapon at most the kind's tier (as `checkHunt` holds goods), rarity by the one draw (`grade2_bp`, `grade3_bp`), never legendary below the ladder's end, `bind: none` (no bind on power).

What this does to the cost gate (#600) and the sinks: the gate prices the whole table in value units per active second, as HUNT_LADDER 134 proposes (never above `effort_permille[hard]`, 1000, with the rarity bonus counted), where a weapon counts at its remaining share: at weight 25 of 100 and 30 % of uses left, a walker's blade adds 7.5 % of a fresh blade's value to each fall [E], and the fall's active seconds are the pattern's (crawler about 40 s, walker about 90 s, warden about 240 s like the fiend's `take_s`) [D]. Until the owner names the unit, every weapon drop will print the #600 warning, so the tables wait on that word. The sinks gain nothing new and lose nothing: wear burns the weapon, mending costs the bench's materials, salvage returns less than the whole, a fall leaves the pack (G81), the sale pays its fee; no upkeep, no tax (DECISIONS 2026-10-23, the sinks are the world's prices).

STEP 5 Companions: by standing, one skill each, never a strike at first. A person with `role: companion` carries `companion: { level, skill }`, skill from `carry | hold | spot | light` (the Company school's pet_carry and ally_hold, plus the senses' spot and the lantern's light), joins at its home when the player stands at friend tier or above, counts against `party.max`, falls by the 8.10 rule and is home again the next day. It never strikes in the first cut (COMBAT 6), so the checklist's "bare hands win by reading the pattern" holds beside it; `hold` draws a foe's heading for a moment (round 4's noise), `light` keeps a bone-thing a tile off, `spot` shows the wind-up one step earlier, `carry` adds the bag slots of a human's hands. Three to start, one per world (the carter, the tracker, the lamp-bearer), each with a voice sheet to the owner before a line (G20). Captured beasts and hired folk wait (question 5).

STEP 6 Quest givers, folk and dwellers: the two built, and the count per world. Today two speak (Maru, Pell; `content/core/npcs/`), by four tiers with `when` and `priority` (STORY 5, S-1 built). Folk: ten to twenty for the first ring's town on routes ranked by rain and hour (P7), no gold, no quest; the city of all races draws its vendors among the races (FIRST_MAP A2). Per world the folk keep the race's gaps too: human carters and menders on middle routes; elf folk few, on long quick routes, two lines each; skeleton folk standing long on short routes. Dwellers: one per far place (the tarn, a glade, the night arch, the descent's mouth), each a speaker for its place's past under its belief, each line at most 80 characters and three boxes at a first meeting (G21). The Keepers get their first voice (the glade warden, or the lamp-keeper; question 6 is not asked, the owner picks the sheet under G20).

STEP 7 Where we differ from the big games, and why: no monster-only dungeon layer, since foes stand in the wild by `d` and never in a safe place (G30, G64, G80); no weapons that vanish, since wear and mend are built (EQUIPMENT 4) and GamesRadar's "most frustrating" is the cost we skip; no eradication counters (G28, GAP_DIMRAETH 3); no colour tiers over one move set, since the owner's word is "not a different look over the same stats" and STEP 2's check row holds it; no random encounters (G80); no capture by percent (G102 shows every odd; G39 sells no power); no companion that strikes before the owner sees a fight on screen (COMBAT 6, direction); nothing fights in the opening (G35), and the predator, the pit, the trap and deep water stay hazards (G34, G80).

STEP 8 The order. (1) The owner's questions below, answered in DECISIONS the same day. (2) The `role` word and the `fears` list on the creature schema, additive, format 1, with the check rows of STEP 2 (a `role`, a fear list, the no-shared-stat-line row); no content changes. (3) The `foe` type as COMBAT 6 orders it, after NEXT 18 and 19 and the relay, with `worn_permille` on its drops and the #600 unit named. (4) The three bone-things' stills to the owner (direction), then the content of STEP 3 at d1 and d2 of the south. (5) The three companions' sheets (G20), then `companion.skill`. (6) The folk of the first ring's town, ten to twenty, from EMPTY_WORLD's order (the town as the funnel first).

## numbers
### numbers[0]
**name**: The races' attribute profiles (might, senses, agility, luck, stamina, spirit; total 7 each)

**value**: human 1 / 2 / 1 / 1 / 1 / 1; elf 0 / 2 / 2 / 1 / 0 / 2; skeleton 1 / 1 / 0 / 1 / 4 / 0. Grades: human strong in the city, normal north and south; elf strong north, normal city, weak south; skeleton strong south, normal city, weak north.

**source**: content/core/races/human.json, elf.json, skeleton.json (develop 7f3635811) [F]

### numbers[1]
**name**: COMBAT's hit tiers

**value**: T1 two hits, T2 six to eight, T3 twenty and up with a wind-up of eight ticks (800 ms at `combat.tick_ms` 100); swing 8 / 10 / 12 ticks with a floor of 6; foe wind-up 5, active 2, recovery 8 ticks

**source**: COMBAT.md 4.9 [F]

### numbers[2]
**name**: The boar's example block

**value**: level 2, health 120, breath 80, reach 1, pace 240 ms, hearing 6; swipe windup 300 / harm 10 / recover 400 / cooldown 1200; lunge windup 700 / reach 2 / harm 20 / recover 900 / cooldown 4000; hours 20 to 5; respawn 600,000 ms

**source**: COMBAT.md 4.1 [F]

### numbers[3]
**name**: The player's health cap and the tiers' levels

**value**: `hp_cap` 100 (60 to 200); `open_tiers` 3; `tier_min_level` [1, 3, 6]; `power_cap_permille` 1000 to 3000 over 14 levels; `rarity_bonus_ms` common 0, uncommon 150, rare 400, legendary 1000; `wear_effect_max_pct` [5, 8, 12]

**source**: content/core/params.json [F]

### numbers[4]
**name**: Spawn caps by danger, and the south's hours

**value**: 12 / 8 / 5 per 1000 habitat tiles for danger 0 / 1 / 2; the south awake 20 to 05, the hall's roof night at every hour; the drake 1 per 1000 with a floor of one

**source**: BESTIARY_LANDS.md 1, 3.2, 4 [F]

### numbers[5]
**name**: The undead south's fight kinds today

**value**: bone hound medium T2 danger 1 take 120 s, 8 per 1000, senses 6 / +1 / 9; cinder imp small T3 danger 1 take 90 s, senses 6 / +2 / 0; tomb spider medium T3 danger 1 take 120 s, senses 3 / +3 / 0; barrow fiend large T5 danger 2 take 240 s, 5 per 1000, senses 8 / +2 / 8; ash drake large T8, senses 10 / +2 / 10

**source**: BESTIARY_LANDS.md 3.2 [F]

### numbers[6]
**name**: The elf wood's fight kinds today

**value**: great eagle medium T3 danger 1 take 180 s, 8 per 1000, senses 10 / +1 / 0, hours 06 to 19; wood lynx medium T3 danger 2 take 150 s, 5 per 1000, senses 8 / +2 / 6, hours 19 to 07

**source**: BESTIARY_LANDS.md 3.1 [F]

### numbers[7]
**name**: Folk for the first ring's town, and their gold

**value**: ten to twenty figures, named, with a route `[{at, hour}]`, no gold, no stock, no ledger

**source**: EMPTY_WORLD.md:48; DECISIONS.md:2034 [F]

### numbers[8]
**name**: The trader's daily cap and the sale of a worn tool

**value**: `trader_day_cap` is 8 active hours at the highest pay the kernel allows at the account's level, reset 00:00 UTC; a tool sells for the share of its uses left, the unit in hand last (R8)

**source**: DECISIONS.md:1051; kernel/src/step.ts:997 [F]

### numbers[9]
**name**: The cost gate's unit today

**value**: `combat.pay_per_s_mg` 50 (25 to 100) mg; HUNT_LADDER 134 finds it about 60 times too small (hare cap 2450 mg against a payFor of 147,000 mg) and proposes value per active second, rarity bonus included, never above `effort_permille[hard]` 1000; issue #600 is open, the gate a warning

**source**: COMBAT.md 4.9; HUNT_LADDER.md:134; issue #600 [F]

### numbers[10]
**name**: Stardew Valley's Serpent and its drops

**value**: 150 HP, 23 damage; Void Essence 99 %, Bomb 15 %, Spicy Eel 6 %, Prismatic Shard 0.1 %; dangerous variants Armored Bug 250, Mummy 445, Royal Serpent 675 HP

**source**: https://stardewvalleywiki.com/Serpent ; https://stardewvalleywiki.com/Monsters [S]

### numbers[11]
**name**: Stardew Valley's dangerous Skeleton drops

**value**: Bone Fragment at 50 / 40 / 20 %, Bone Sword 4 %

**source**: https://wiki.stardewvalley.net/Skeleton_(dangerous) [S]

### numbers[12]
**name**: Stardew Valley's monster loot prices and eradication goals

**value**: Slime 5g, Bat Wing 15g (sold at the Adventurer's Guild or the shipping bin); goals 1000 Slimes (Slime Charmer Ring), 150 Void Spirits (Savage Ring), cave insects 125 cut to 80 in 1.6; a player's report: Galaxy Hammer 75,000g to buy, 600g back

**source**: https://stardewvalleywiki.com/Monster_Loot ; https://stardewvalleywiki.com/Modding:Monster_eradication_goals ; https://forums.stardewvalley.net/threads/marlon-why.12543/latest [S]

### numbers[13]
**name**: Zelda Breath of the Wild's bone weapons

**value**: Boko Arm power 5, durability 5 (from a Stalkoblin); Moblin Arm power 15, two-handed, brittle; Savage Lynel Sword up to 100; Stalkoblins in groups of 2 to 3, night only

**source**: https://www.zeldadungeon.net/wiki/Boko_Arm ; https://zeldawiki.wiki/wiki/Moblin_Arm ; https://zeldawiki.wiki/wiki/Lynel_Crusher ; https://www.zeldadungeon.net/wiki/Stalkoblin [S]

### numbers[14]
**name**: Zelda Tears of the Kingdom's Fuse power

**value**: Bokoblin Horn 4 (a sword of 5 becomes 9), Blue Bokoblin Horn 7, Silver Lynel Saber Horn 55, Mace Horn 51; Gerudo weapons double the fused power; claws and teeth double on arrows; 300 rupees for showing Chabi a Lynel-horn weapon

**source**: https://zeldadungeon.net/wiki/Fuse_Attack_Power ; https://game8.co/games/Zelda-Tears-of-the-Kingdom/archives/414617 ; https://zeldadungeon.net/wiki/Silver_Lynel_Saber_Horn [S]

### numbers[15]
**name**: Octopath Traveler II's recruitment keys

**value**: Allure a percent by day (Alrond 2 %); Hire money by night (Alrond 200,000 leaves); Befriend food by night; Guide level-gated (80 for Alrond); Ochette captures up to 6 monsters, summons without limit, Prepares them into items

**source**: https://gamerant.com/octopath-traveler-2-every-path-action-ranked/ ; https://progameguides.com/?p=558603 ; https://octopathtraveler.fandom.com/wiki/Talents_(Octopath_Traveler_II) [S]

### numbers[16]
**name**: Sea of Stars' party and experience

**value**: party of three, swapping free; 100 experience to the next level, party-wide, with a rubber band; two-hit attacks break two locks

**source**: https://www.kakuchopurei.com/2023/08/sea-of-stars-dungeon-combat-guide/ ; https://rpgsite.net/review/14764-sea-of-stars-review [S]

### numbers[17]
**name**: Dragon Quest's families

**value**: 14 or 15 standard families (Aquatic, Beast, Bird, Bug, Demon, Dragon, Elemental, Humanoid, Machine, Material, Plant, Slime, Undead, Zombie; Boss in the Monsters series); recruitment in V a fixed percent per breed with a minimum hero level; the metal king slime not recruitable in V

**source**: https://dragon-quest.org/wiki/Monster_Families ; https://dragon-quest.org/wiki/List_of_recruitable_monsters_in_Dragon_Quest_V [S]

### numbers[18]
**name**: Drakantos' counts

**value**: 21 heroes as swappable classes on one account; "150+" enemy types (a cut snippet, unverified); about 195 pets planned, "dozens" on Steam; enemy difficulty scales with the player count; unreleased, free-to-play, Wingeon (Brazil)

**source**: https://store.steampowered.com/app/2454980 ; https://thegameswiki.com/drakantos/wiki/drakantos-overview ; https://massivelyop.com/2024/11/09/interview-drakantos-discusses-multiplayer-open-world-content-monetization-testing-and-more/ [S]

### numbers[19]
**name**: Sizes at 64 px on our rig

**value**: the character 73 px tall (NATURE, the animals' cut plan); the wolf a 44 px box, never taller than a person on four legs; proposed bone crawler 40 px box, bone walker 73 px, barrow warden about 110 px and two tiles wide [D]

**source**: the animals' cut plan of 31.10 (manager inbox); DECISIONS.md 2026-10-31 "The animals' look" [F]; this memo [D]

## catalogue
### catalogue[0]
**name**: `role` on a kind and on a person (proposed field)

**detail**: closed list `folk | giver | dweller | companion | foe`; a kind carries one, a person one or two that do not fight (`giver` with `companion`); the check reads it as STEP 1 says. Additive, format 1, core-only at first (G45).

### catalogue[1]
**name**: `fears` on a kind (proposed field)

**detail**: closed list `fire | light | noise | water | day`, one to three per kind; the fight reads it as a step back from the thing feared within a small radius (a lit lantern within 2 tiles, a brazier, daylight), never as a roll; the tells of BESTIARY_LANDS already name most of them in words.

### catalogue[2]
**name**: `drops[].worn_permille` on a `foe` (proposed field)

**detail**: how much of a dropped weapon's `uses` is already spent when it lands in the bag; the check holds it at 600 or more for a weapon and refuses it on a good; the kernel writes `state.player.wear[item]` from it at the fall, so `salePrice` (R8) and the bench's mend read it as any worn tool.

### catalogue[3]
**name**: `weak.to` on a `foe` (optional, question 4)

**detail**: beside `weak.after`, a weapon class (`blunt` on bone, as Dragon Quest III's undead take extra from certain weapons) that lands double; not recommended first, since G79 wants the fight read by reach and tempo and one weakness is enough (GAP_DIMRAETH 9).

### catalogue[4]
**name**: `companion: { level, skill }` on a person (proposed extension of SETTLEMENT 3.7)

**detail**: `skill` from `carry | hold | spot | light`; joins at friend tier or above at its home; counts against `party.max`; falls by 8.10 and is home the next day; never strikes in the first cut.

### catalogue[5]
**name**: The bone heap (proposed prop)

**detail**: what a bone-thing's spot shows by day (hours 20 to 05 outside the hall); a prop that cannot be struck or taken (G46; nothing is dressed from it, BESTIARY 2 rule 4), with three readings in the beliefs' words (S4), named by the narrator only as what is there (S1).

### catalogue[6]
**name**: Stardew Valley's bestiary structure

**detail**: monsters by location (the Mines' floors, Skull Cavern, Quarry Mine, Mutant Bug Lair, Volcano Dungeon, Secret Woods, the farm by option), each with HP, damage, drops with odds and a "dangerous" variant; villagers as a separate layer with ranked schedules, gifts and heart events; the Adventurer's Guild buys loot, sells gear and pays eradication goals [S].

### catalogue[7]
**name**: Zelda Breath of the Wild's enemy structure

**detail**: families (Bokoblin, Moblin, Lizalfos, Lynel, Hinox and more) in colour tiers that raise health and the carried weapon over the same moves (the owner's "different look over the same stats", which we refuse), a Stal (bone) variant of each that rises at night and crumbles, and weapons that come from the enemies and break [S].

### catalogue[8]
**name**: Octopath Traveler II's structure

**detail**: enemies by region with weaknesses (shields broken by weapon and element), no official family taxonomy found [NF]; townsfolk recruited by four path actions (chance, money, food, level) and summoned in battle; Ochette's captured monsters as a second party [S].

### catalogue[9]
**name**: Sea of Stars' structure

**detail**: hand-placed visible enemies, each with locks (damage-type icons) that the party breaks to weaken or cancel a move; a party of three with free swapping; party-wide experience with a rubber band; no grinding [S].

### catalogue[10]
**name**: Dragon Quest's structure

**detail**: 14 or 15 families across the series, a bestiary book per game (VII's Big Book of Beasts, IX's by family), weapon-type bonuses against families since III, recruitment by a fixed percent per breed since V [S].

### catalogue[11]
**name**: Drakantos' structure

**detail**: a free-to-play pixel MMO, unreleased: 21 heroes as swappable classes on one account, "150+" enemy types (unverified), about 195 pets planned with a skill each, enemy difficulty scaled by the player count, orbs and artifacts for builds [S]; GAP_DIMRAETH_DRAKANTOS.md 3 and 9 already read its stage-3 pets and its "first step needs no weapon".

### catalogue[12]
**name**: Our structure, as this memo leaves it

**detail**: one table of fields per land (BESTIARY_LANDS 1) plus `role` and `fears`; the `foe` type of COMBAT 4.1 for everything that bites, with `worn_permille` on its weapon drops; the `npc` type with `route` for folk, givers and dwellers; `companion.skill` for the few who join; the journal as `collection` quests of kinds seen (G17), never counts.

## pitfalls
- Rule 4 of BESTIARY 2 ("no dead of the three races walks") and the owner's wicked skeletons are one question, not two readings to pick quietly: question 1 asks it, with the one-line rewrite ("no returner walks dead; the bone-things of the fold under the bells are beasts in shape"). Until the word, no bone-thing is content.
- "Evil" is not a word the content may use of a belief (S5), and the bone-things must never be a creed's word (BESTIARY_LANDS 3.2); they are wicked by nature as a foe is, and each belief reads them its own way (S4).
- A foe id that reads "skeleton" collides with the race's id `core/skeleton` in every list and board; the names of STEP 3 avoid the word.
- A child-shaped or a sleeping foe breaks G46 (no violence against someone who cannot act): the small size is a crawler on all fours, never a child; the bone heap by day cannot be struck.
- Three skins over one stat line is the thing the owner refused; without STEP 2's check row a third land's content will copy a second's numbers under deadline. Write the row with the schema, not after.
- Weapon drops that are vendor trash (GAP_DIMRAETH 9's leave list) come from a fresh weapon that drops often: `worn_permille` at 600 or more, weights of 10 to 30, and the sale at the share of uses left keep the sale from being the loop's pay.
- The cost gate's unit (#600) is open; every weapon drop will warn until the owner names it. The tables of STEP 4 are priced in value units per active second on the assumption HUNT_LADDER 134 is accepted; if mg with a factor wins instead, the same tables are re-priced, not redrawn.
- Zelda's break-and-vanish is the pattern the sources call "most frustrating"; copying it would undo EQUIPMENT 4 (wear and mend) and PROGRESSION's `salvage`. Take the night-and-bones and the weapon-from-the-fallen, leave the breaking.
- Stardew's eradication goals are counters to a thousand kills; a journal of kinds seen (G17 `collection`) gives the same pull without the grind (G28).
- A companion that strikes makes the pattern unreadable for the player and trivialises T1 (the checklist's new question in COMBAT 5); the first cut gives companions carry, hold, spot and light only, and a fight on screen is a direction decision the owner sees first.
- Capture by percent (Octopath, Dragon Quest V) is a slot machine under G102 (the code tells the odds) and G39 (power never sold); if the owner wants beasts in the party, a tending quest (G17) that ends with a named beast is the shape, not a roll.
- Hire by money is out while folk hold no gold (DECISIONS 2026-10-20); standing (the four tiers) is the only key that already exists.
- Nothing fights in the opening (G35): the opening's creatures are folk and the ambient five (BESTIARY 3); the first foes are the boar and a thief at d1 and d2 after NEXT 18 and 19 (COMBAT 6). A memo table is not a licence to place a foe sooner.
- The hazard line holds: the predator, the pit, the trap, deep water, the fiend and the drake above the ladder stay rules (G34, G80, BESTIARY 2 rule 10); a kind whose only way is `fight` is a hazard until the combat stream lands.
- The wicked look is a direction decision: no sprite before two or three phone-size stills and the owner's pick in DECISIONS (AGENTS.md). This memo has no stills by its budget.
- Several outside pages were search summaries only [S]; the Stardew buy-back figure is one player's forum post; the Drakantos bestiary count is a cut snippet. None of these decide anything here.

## sources
- docs/design/STORY.md (S1 to S6, sections 3 and 5), GAME_RULES.md (the rules named in the summary, sections 6 to 8), COMBAT.md (4.1, 4.9, 5, 6), BESTIARY.md (2, 3), BESTIARY_LANDS.md (1, 3.1, 3.2, 4), CREATURE_BEHAVIOUR.md (1, 8), HUNTING.md (8, 9, 11), HUNT_FAMILIES.md (2), HUNT_LADDER.md:134, EQUIPMENT.md (2 to 5), PROGRESSION.md (4.2), GROWTH.md (2), SETTLEMENT.md (3.5 to 3.7), FIRST_MAP.md, TONE.md (1 to 4), EMPTY_WORLD.md:48, GAP_DIMRAETH_DRAKANTOS.md (3, 9), docs/research/research-combat.md (the template and the earlier findings), at develop 7f3635811
- DECISIONS.md: 22.10 and 23.10 (the races, their bodies, the bag), 2026-10-20 (the valley's own people on routes, :2034), 2026-10-23 (the open ends and the sinks, :2869), :783 and :1051 (`trader_day_cap`), :3096 (`respec_mg`), 2026-10-30 (the creature schema; the wild brain, :3882), 2026-10-31 (the animals' look), 2026-11-01 (the danger slot)
- content/core/races/{human,elf,skeleton}.json; content/core/npcs/{elder,trader}.json; content/core/params.json; kernel/src/step.ts:997 (`salePrice`); schema/src/index.ts:87 (`REP_TIERS`)
- Issues #612 (this memo's task) and #600 (the gate's unit, open)
- https://stardewvalleywiki.com/Monsters ; https://stardewvalleywiki.com/Serpent ; https://wiki.stardewvalley.net/Skeleton_(dangerous) ; https://wiki.stardewvalley.net/Adventurer%27s_Guild ; https://stardewvalleywiki.com/Modding:Monster_eradication_goals ; https://stardewvalleywiki.com/Monster_Loot ; https://stardewvalleywiki.com/Shane ; https://www.bisecthosting.com/blog/stardew-valley-npc-summer-schedule-location-marriage-candidates-events ; https://forums.stardewvalley.net/threads/marlon-why.12543/latest
- https://zeldawiki.wiki/wiki/Durability ; https://breezewiki.discard.no/zelda/wiki/Durability ; https://www.zeldadungeon.net/wiki/Boko_Arm ; https://zeldawiki.wiki/wiki/Moblin_Arm ; https://zeldawiki.wiki/wiki/Lynel_Crusher ; https://www.gamesradar.com/zelda-breath-of-the-wild-broke-the-mould-and-me-by-breaking-its-weapons ; https://zeldadungeon.net/wiki/Breath_of_the_Wild_Enemies ; https://www.zeldadungeon.net/wiki/Stalkoblin ; https://www.zeldadungeon.net/wiki/Stalmoblin ; https://zeldadungeon.net/wiki/Stalnox ; https://zeldadungeon.net/wiki/Fuse_Attack_Power ; https://game8.co/games/Zelda-Tears-of-the-Kingdom/archives/414617 ; https://zeldadungeon.net/wiki/Silver_Lynel_Saber_Horn
- https://gamerant.com/octopath-traveler-2-every-path-action-ranked/ ; https://progameguides.com/?p=558603 ; https://game8.co/games/Octopath-Traveler-2/archives/403906 ; https://octopathtraveler.fandom.com/wiki/Talents_(Octopath_Traveler_II) ; https://square-enix-games.com/news/octopath-traveler-ii-ochette-castti ; https://segmentnext.com/capture-monsters-in-octopath-traveler ; https://nightlygamingbinge.com/octopath-traveler-ii-enemies-location-and-vulnerability-guide/
- https://www.kakuchopurei.com/2023/08/sea-of-stars-dungeon-combat-guide/ ; https://nintendowire.com/reviews/sea-of-stars/ ; https://checkpointgaming.net/reviews/2023/08/sea-of-stars-review-over-the-moon/ ; https://www.nintendoworldreport.com/preview/59815/sea-of-stars-hands-off-preview-and-interview ; https://techraptor.net/gaming/previews/sea-of-stars-is-retro-inspired-rpg-without-dated-mechanics ; https://rpgsite.net/review/14764-sea-of-stars-review
- https://dragon-quest.org/wiki/Monster_recruitment ; https://dragon-quest.org/wiki/List_of_recruitable_monsters_in_Dragon_Quest_V ; https://dragon-quest.org/wiki/Monster_Families ; https://dragon-quest.org/wiki/Bestiary_of_Dragon_Quest_IX_(Family) ; https://dragon-quest.org/wiki/Item_shop
- https://store.steampowered.com/app/2454980 ; https://thegameswiki.com/drakantos/wiki/drakantos-overview ; https://www.gematsu.com/games/drakantos ; https://massivelyop.com/2024/11/09/interview-drakantos-discusses-multiplayer-open-world-content-monetization-testing-and-more/

## The owner's questions

Each one sentence, three options, A recommended; the default stands if no word comes.

1. The wicked skeletons of the world of the dead against BESTIARY 2 rule 4: A) they are bone-things of the fold under the bells that never woke, beasts in the kernel with no face that speaks, and the rule becomes "no returner walks dead" (recommended, the default); B) rule 4 stays whole and the south's wicked foes are demon-shaped beasts in bone colours, never a skeleton's build; C) they are fallen returners of the skeleton race.
2. Their sizes and levels: A) three sizes, a crawler of 40 px at T1, a walker of 73 px at T2 and a warden of about 110 px at T3, the hall at d1 holding the first two and the descent at d2 the last two, more levels on the one scale beyond (recommended, the default); B) two sizes, walker and warden; C) five sizes from a hand to a giant.
3. Their weapons on a fall: A) the walker and the warden drop the grave-weapon they carry, worn 60 to 90 percent, to wield and mend, salvage or sell (recommended, the default); B) no weapon drops, only parts (bone, horn) for the forge, the Fuse way; C) weapons drop fresh.
4. Weapon class against bone: A) no class multipliers, the match is reach and tempo only (recommended, the default); B) blunt lands double on bone as a `weak.to` field, the Dragon Quest III way; C) a full wheel of classes against families.
5. The first companions: A) three named persons, one per world, with one skill each (carry, spot, light), joining at friend tier and never striking (recommended, the default); B) captured or tended beasts as well, the Octopath and Dragon Quest V way, by a tending quest and never a roll; C) no companions until the Company school is built.
6. The ambient folk of the first ring's town: A) ten to twenty, named, on routes ranked by rain and hour, no gold and no quest (recommended, the default); B) five to eight; C) folk who also trade.
7. The cost gate's unit for a foe's table (#600): A) value per active second with the rarity bonus counted and a worn weapon at its remaining share, never above `effort_permille[hard]` (recommended, the default); B) milligold with a named factor; C) no gate on weapons, only on goods.
8. Fears as data: A) a closed `fears` list on the kind (fire, light, noise, water, day) that the fight reads as a step back within a small radius (recommended, the default); B) fears in the tells only, no mechanic; C) one fear for every kind of a land, as a rule of the land.
