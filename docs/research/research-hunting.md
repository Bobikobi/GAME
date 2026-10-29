**summary**: Raw research for the manager, 2026-10-28. Read in repo: docs/design/FIRST_MAP.md and docs/design/STORY.md only (GAME_RULES.md NOT read, so quests, rewards, timing and the opening are unchecked against it; the manager must check before briefing). Web: about 45 searches and fetches; many wiki pages returned 402/429/403, so some games are thin (gaps listed in pitfalls). Every number is tagged SOURCED (with where) or PROPOSAL (ours, not from any source). Core answer: one loop for all hunting = find by sign -> approach in a readable alert/flee state machine -> strike only when the animal is unaware (clean kill) or use a passive trap -> field-dress and carry a carcass that spoils -> process into goods. Perception is integer (squared distance, a per-step notice roll, tile-based cover and wind), copied in shape from Brogue's stealth range and Minecraft's flee radii. Because the game has no combat yet, a kill is never a fight: unaware = clean take, aware = the animal flees; defenders and hunters are escaped (speed no higher than the player's walk, give-up rule), never fought. Catalogue: 19 archetypes across the six FIRST_MAP regions, danger tier rising with distance (hunters only at d2). Ratings: no rated pixel game that hunts animals was found; Stardew is E10+ with livestock and cartoon monsters, theHunter is T with blood on animal hits; the safe line is no blood, no suffering animation, no pets or babies as prey. Do not state a final rating; the owner runs the official questionnaire.

## patterns
### patterns[0]
**name**: Right tool, one clean shot, quality star (RDR2)

**what**: Each animal has a 1-3 star quality, revealed by studying it from a distance (binoculars or scope). Weapon class must fit animal size (bow or varmint rifle for small, sniper for medium to massive). A one-hit kill to head or heart keeps the pelt perfect; multi-hit kills ruin it. Carcass is sold to a butcher or donated to camp. Wind direction matters: animals catch scent if you are upwind.

**who_does_it**: Red Dead Redemption 2

**fits_us_because**: Gives a reward for patience that needs no combat system: quality is decided by approach and tool, not by damage. Maps to an integer quality 1-3 set at spawn and a tool-vs-size match.

**source**: https://www.rdr2.org/guides/red-dead-redemption-2-hunting-guide/ (fetched); https://primagames.com/tips/red-dead-redemption-2-how-get-perfect-hides (search snippet)

### patterns[1]
**name**: Readable stealth: alert is obvious, wind and schedule are learnable (theHunter)

**what**: Animals have needs (eat, drink, sleep, roam between need zones). Grazing is broken into walk, graze while walking, head lowered for a random time, with idle fillers. Alert had to be obvious: 'animals had to react to something'. Deer herds are led by a leader, others follow when they finish their current activity. Senses differ by species: some see only moving objects, red deer have keen smell; an upwind player makes the animal flee before the player knows it was there. Older high-score males get smaller home ranges in the densest vegetation and keener senses; players crouch at once when one is near. Pitch points (valleys between hills and water) are where animals move between feeding and resting.

**who_does_it**: theHunter: Call of the Wild (Avalanche; Game Developer blog by its animal AI designer)

**fits_us_because**: Gives the fairness rule we need: every flee has a visible cause and a tell, and the player can learn schedule, terrain and wind. The article gives no numbers (no ranges, no flee distances, no herd sizes), so all radii here are ours.

**source**: https://www.gamedeveloper.com/design/thehunter-call-of-the-wild---designing-believable-simulated-animal-ai (fetched)

### patterns[2]
**name**: Integer stealth range with a flat notice chance (Brogue)

**what**: Stealth range: 7 in normal light, 3 in darkness, 14 in well-lit areas. Resting halves it rounded up (minimum 2, or 1 if rested last turn). Monsters inside the range each have a flat 25% chance per turn to notice you, rolled on their own turn. Hunting monsters outside the range lose track 3% of the time per turn and lose track entirely beyond 3x range. Sneak attacks on sleeping, wandering or paralysed monsters do triple damage and always hit. (Brogue has no separate rule for running or fighting on that page; an older wiki snippet implied doubling, unverified.)

**who_does_it**: Brogue (CE 1.15.1 wiki)

**fits_us_because**: The cleanest published tile-scale perception model in integers. Directly reusable: one radius per player action, a flat per-step roll, a give-up chance, and a guaranteed hit on the unaware.

**source**: https://brogue.wiki/wiki/Stealth (fetched); https://brogue.fandom.com/wiki/Stealth?oldid=9248 (search snippet, older rules: 25% per turn, double in light)

### patterns[3]
**name**: Flee radius per species and per threat (Minecraft)

**what**: Rabbits avoid players within 8 blocks, wolves within 10, most hostile mobs within 4; they do not flee foxes or cats unless attacked; faster while panicking; panic when attacked. Foxes flee wolves, polar bears and players unless the player sneaks (sneaking players can approach without triggering a flee); foxes sleep by day in a spot with sky light 14 or less; fox groups 2-4. Wild wolves hunt sheep, rabbits, foxes; an attacked wolf turns every wild wolf in a 33x21x33 cuboid hostile; pack sizes 4 in taiga and forest, 4-8 in savanna and wooded badlands, 1 in grove.

**who_does_it**: Minecraft Java/Bedrock

**fits_us_because**: A tile world with integer radii and a sneak toggle: closest published analogue to our kernel. Shows prey flee radius should depend on who the threat is (player vs predator) and that a pack answers for a hit pack-mate.

**source**: https://minecraft.wiki/w/Rabbit ; https://minecraft.wiki/w/Fox ; https://minecraft.wiki/w/Wolf (all fetched, first 100000 characters only)

### patterns[4]
**name**: Herd alert spreads, bait lowers the guard (Breath of the Wild, Don't Starve, RimWorld)

**what**: BotW Mountain Doe: skittish, perceptive, travels in herds, one that spots Link alerts the others and the group takes flight; they let their guard down while eating apples. Don't Starve: koalefants avoid you until attacked, then chase a distance and every koalefant on screen joins; dropping a carrot lets you strike a rabbit while it eats. RimWorld: when an animal turns manhunter, same-species animals within 25 tiles with a valid path may also turn; a harmed herd may take revenge together; wild animals have a chance to flee erratically from ranged attacks, not from melee or predators.

**who_does_it**: The Legend of Zelda: BotW; Don't Starve; RimWorld

**fits_us_because**: Gives three reusable rules: alert is contagious inside a herd; bait is a fair non-combat way to get a clean strike; groups answer a hit together. The 25-tile figure is the only published herd-spread number found.

**source**: https://www.zeldadungeon.net/wiki/Mountain_Doe (search snippet only; page returned 403 on fetch); https://dontstarve.wiki.gg/wiki/Koalefant (search snippet) and https://dontstarve.wiki.gg/wiki/Rabbit (fetched); https://rimworldwiki.com/wiki/Hunt and https://rimworldwiki.com/wiki/Animals (fetched)

### patterns[5]
**name**: Tracks that lead to the animal (Don't Starve) and burrows that are finite

**what**: Koalefant spawns at the end of Suspicious Dirt Pile tracks; following the tracks is the hunt. Rabbit: health 25, runs to its hole at dusk or when it witnesses a rabbit die, slower than the player so it can be cornered; a trap placed directly above a hole guarantees a catch; digging up a hole evicts the rabbit and holes do not respawn; sleeping rabbits at night are immobile.

**who_does_it**: Don't Starve (Klei)

**fits_us_because**: Two ideas: (1) sign tiles (tracks, droppings, feathers) are the 'find' step and cost nothing in AI; (2) a rabbit that goes to ground at dusk fits the valley, where the mist comes at dusk (STORY.md:64-66, an S3 bone anyone can see). Burrows that do not respawn are the warning against exhausting a shared world.

**source**: https://dontstarve.wiki.gg/wiki/Rabbit (fetched); https://dontstarve.wiki.gg/wiki/Koalefant (search snippet)

### patterns[6]
**name**: Carcass as a ticking resource that others want (The Long Dark, Dwarf Fortress)

**what**: Long Dark (search snippets from old wiki revisions and 2015-2018 forum posts): a deer carcass holds 8-10 kg raw meat, 2 guts, 1 hide; a wolf 3-6 kg meat, 1 pelt, 2 guts; hides and guts must be cured 5 days in a structure; carcasses freeze and take longer to harvest, meat decays fast once exposed; wolves hunt deer and feed on the carcass; guts craft snares; a snare gives free rabbit meat while you wait. Dwarf Fortress: butchering takes significant time and a corpse has a limited window before it rots; butchering yields meat, hide, bones and a skull; hunters will eventually drive local wildlife to extinction unless some escape or are bred.

**who_does_it**: The Long Dark; Dwarf Fortress

**fits_us_because**: The carry-and-spoil step is what makes the loop a decision (take the whole animal, field-dress and take the best part, or leave it). A scavenger that arrives at a carcass left on the ground adds pressure without any combat.

**source**: https://thelongdark.gamepedia.com/Deer?diff=6542 and https://thelongdark.fandom.com/wiki/File:Wolf_attack_-_lunge.jpg (search snippets); https://dwarffortresswiki.org/index.php/23a:Hunting and https://dwarffortresswiki.org/butcher (search snippets; direct fetches returned 429)

### patterns[7]
**name**: Hide to leather as a station gate (Valheim, Long Dark, Medieval Dynasty)

**what**: Valheim: deer 10 health, drops meat 2, hide 1-3 (scales with star level), trophy 50% (physgun table from game version 0.221.12); boars (they fight back in groups) give leather scraps; tanning rack needs 10 wood, 15 flint, 20 leather scraps, 5 deer hide, placed within 2 m of a workbench (search snippets, sources disagree on scrap and flint sources); 2 deer trophies summon the first boss; players hunt deer with a bow while sneaking, in daylight. Medieval Dynasty: spear first (short range, recoverable but fragile, throw only with at least 66% durability, carry 3), then bow, crossbow (slow reload), traps for small game (rabbits, birds); skinning needs a knife; deer passive, boar/wolf/bison attack at once.

**who_does_it**: Valheim; Medieval Dynasty; The Long Dark

**fits_us_because**: Shows the standard progression: small game first with a trap, medium game with a spear or bow, and a processing station that turns raw goods into the next tier of gear. Gating by goods taken from the previous tier closes the loop (bow needs sinew and feathers).

**source**: https://physgun.com/tools/valheim/creatures/deer/ (fetched); https://allthings.how/valheim-how-to-make-a-tanning-rack/ and https://windowscentral.com/valheim-hunting-guide-tips-tricks-and-information-you-need-know (search snippets); https://www.gamepressure.com/medieval-dynasty/hunting/zfdac7 (search snippet)

### patterns[8]
**name**: Territory and ecology: prey flees the predator, predators defend turf (Monster Hunter)

**what**: MH World: ecosystem with turf wars (an invading monster triggers a fight) and a food chain; most small animals are herbivores that graze in herds and do not attack unless provoked; wounded monsters run to another area. Wilds director Tokuda: when a carnivore takes an herbivore from a pack, the survivors may flee to another part of the map, and scarce food changes the carnivore's pattern. (Fan sources; Rathalos feeding claim unverified.)

**who_does_it**: Monster Hunter: World and Wilds

**fits_us_because**: A cheap integer version: predators have a home anchor and a leash radius, herds have a home anchor and move away from a place where a predator was last seen. No full ecology is needed.

**source**: https://twinfinite.net/ps4/monster-hunter-world-beta-impressions/2/ ; https://pcgamer.com/games/action/monster-hunter-wilds-director-says-changes-to-the-ecosystem-are-persistent-even-as-you-return-to-base-the-world-outside-is-moving-on-and-continuing-where-you-left-it-in-the-background (search snippets; pages not fetched)

### patterns[9]
**name**: Spawn by cluster, cap and cooldown, not by pile (Dwarf Fortress, RimWorld, Tibia)

**what**: DF creature raws: FREQUENCY is a comparative number 0-100, CLUSTER_NUMBER sets how many appear at once, POPULATION_NUMBER caps the total (deer example 15:30), biome tokens place them; activity tokens DIURNAL (about 6:00-20:00), CREPUSCULAR (about 4:30-6:00 and 20:00-22:05), ALL_ACTIVE. RimWorld: map has a desired animal density (default biome value 3.5, temperate forest 3.7, ice sheet 0.2, scaled per 10,000 squares), converted to a cap on total spawn weight; a spawn attempt about every 1213 ticks picks a random weighted animal; wild animals appear at map edges. Tibia: creatures respawn only when no player is within 7 squares or 2 squares off screen; spawn rate rises with players online; creatures like rabbits and sheep stay near their spawn and cannot be pushed; run-from-low-health is a per-creature number (runonhealth, 0 = never).

**who_does_it**: Dwarf Fortress; RimWorld; Tibia (and OTServ forks)

**fits_us_because**: All three are integer, deterministic and per-region: a table of weights, a cluster size, a cap, a timer, and a no-spawn-in-view rule. That is exactly what a pure kernel with JSON content needs, and it keeps a shared world from being emptied.

**source**: https://dwarffortresswiki.org/Creature_token and https://dwarffortresswiki.org/index.php/40d:Creature_token (search snippets; fetch returned 429); https://rimworldwiki.com/wiki/Talk:Temperate_forest and https://rimworldwiki.com/wiki/Modding_Tutorials/Biomes (search snippets); https://www.tibiaqa.com/39442/how-does-creature-respawn-actually-scale-semi-abandoned-hunting-areas and https://tibiantis.info/library/trivia (search snippets); https://otland.net/threads/inconsistency-in-runonhealth-behavior.286883/ (search snippet, forum)

### patterns[10]
**name**: Non-lethal renewable goods: eggs, wool, milk (Stardew, Core Keeper, Terraria)

**what**: Stardew Valley has livestock and no hunting; ESRB rates it E10+ (Fantasy Violence, Mild Blood, Mild Language, Simulated Gambling, Use of Alcohol and Tobacco), with cartoony cave monsters and livestock. No developer statement on why there is no hunting was found; an academic article (Springer 10.1007/s40869-018-0055-x) treats Stardew as deliberately avoiding animal violence, which is inference only. Core Keeper: Moolin gives milk (1 per 10 minutes for 2 plants eaten, per a hosting-guide snippet), Bambuck wool, both drop Marbled Meat if killed and do not respawn after death. Terraria bunny: passive critter, 5 life, caught with a bug net, Gold Bunny 1/400.

**who_does_it**: Stardew Valley; Core Keeper; Terraria

**fits_us_because**: The owner wants most animals hunted for what they give. A renewable non-lethal branch (eggs from nests, wool by shearing, milk after taming) gives a gentle rating-safe path to the same goods and a use for the player who does not want to kill. Catching a critter alive (Terraria bug net) is a third option.

**source**: https://www.esrb.org/ratings/34835/stardew-valley/ (fetched); https://link.springer.com/content/pdf/10.1007%2Fs40869-018-0055-x.pdf (search snippet); https://terraria.wiki.gg/wiki/Bunny (fetched); https://www.bisecthosting.com/it-it/blog/core-keeper-cattle-location-how-to-catch-types-feed (search snippet)

### patterns[11]
**name**: Fishing gated by rod tier and price ladder (Stardew Valley)

**what**: Training Rod 25g, Bamboo Pole 500g (no bait or tackle), Fiberglass Rod 1,800g (bait; fishing level 2 per wiki, level 3 per one other site), Iridium Rod 7,500g (bait and tackle; level 6). A bigger catch bar for the cheapest rod makes early fishing forgiving.

**who_does_it**: Stardew Valley

**fits_us_because**: The spec's order is foraging, hunting, fire, then fishing (STORY.md:25-27), so fishing starts after fire. Rod tiers are a simple, readable tool gate. Prices here are only an example: AGENTS.md says never hardcode item prices.

**source**: https://stardewvalleywiki.com/Fiberglass_Rod ; https://stardewvalleywiki.com/Bamboo_Pole ; https://stardewvalleywiki.com/Iridium_Rod (search snippets; pages not fetched)

### patterns[12]
**name**: Graveyard Keeper: meat from corpses, optional butchering

**what**: Forum reports (2018): meat comes from corpses; butchering is optional and lowers the body's quality for burial; a review says selling human flesh as animal meat is a goal. No hunting loop was documented. Cows reportedly are not killed (one forum commenter, unsure).

**who_does_it**: Graveyard Keeper

**fits_us_because**: Evidence only that a dark-humour pixel game gets meat without a hunting loop; it is not a pattern we can copy. Note: our skeleton race and 'dead south' make a corpse-flesh joke a rating and tone risk; avoid.

**source**: https://steamcommunity.com/app/599140/discussions/0/1734336452551999989 ; https://purenintendo.com/review-graveyard-keeper-nintendo-switch/ (search snippets, forum and review)

**recommendation**: RECOMMENDATION (one foundation, in order). Everything below marked PROPOSAL is ours; SOURCED figures are tagged in `numbers`. Check first: GAME_RULES.md was not read, so quests, rewards, timing and the opening are unchecked; the manager must read it before briefing.

A. WORLD FIT (read from the repo)
- FIRST_MAP.md:11 map 192x192 tiles (3x3 chunks). FIRST_MAP.md:17-23 regions and danger. FIRST_MAP.md:43 danger d = steps from town / 64: d0 < 64 steps, d1 the outer floor and passes' feet, d2 beyond the crests (tiles by level in A: d0 4541, d1 6142, d2 994, FIRST_MAP.md:44). Walking distance is 4-way BFS steps (FIRST_MAP.md:11).
- Rule for the catalogue: animal danger tier follows the region's d. ambient and flees at d0; defends from d1; hunts only at d2. A hunter is escaped by construction because no combat exists yet.
- STORY.md:25-27 spec order: foraging, hunting, fire, then fishing, pottery, farming, metal. So hunting comes BEFORE fire: raw meat must be edible but weak (BotW: raw meat heals very little, cooked much more, search snippet), and fishing is a post-fire phase.
- STORY.md:58-60 (S1) narrator never states the past; STORY.md:64-66 (S3) the mist comes at dusk and anyone can see it. Every 'why it fits' line below is present tense and states nothing about the past. Animals going to ground at dusk is a suggestion that needs the owner's yes.

B. UNITS AND DISTANCE (PROPOSAL)
- One metric for all perception: squared distance, compare dx*dx+dy*dy <= r*r (integer, no sqrt, rounder than a square ring). Walking and chase use the 4-way BFS steps already used for the map. Line of sight blocked by solid tiles and dense forest tiles.
- Think step: an animal decides once per 8 game ticks, staggered by id mod 8 (cheap, deterministic). All timers below are in think steps ('t').
- Seeded integer RNG per animal (kernel stays pure). No floats.
- SCREEN CHECK (builder must verify): FIRST_MAP.md:12 names 390 x 844 images and the brief says 64 px tiles; if one tile is 64 CSS px, a phone shows only about 6 x 13 tiles (390/64 = 6.1, 844/64 = 13.2), i.e. 3 tiles each side across. Radii below (sight 3-8) can then exceed what the player sees. Rule: any animal that reacts to something off screen must show a tell on screen (birds lifting, a head-up, a sound icon), or the radii must be scaled to the real viewport.

C. STATE MACHINE (PROPOSAL, shape from Brogue/Minecraft/theHunter)
States: SLEEP, IDLE, GRAZE, WANDER, ALERT, FLEE, DEFEND, STALK, CHASE, RETURN, plus herd-follow and pack flags. Tier decides what ALERT turns into.
1. SLEEP (by the animal's active hours): detection radius = ceil(normal/3). A strike on a sleeping or fully unaware animal is a guaranteed clean kill (Brogue: sneak attacks on sleeping/wandering always hit, x3). Wakes on a noise event within 3 + ear, or player within 2 tiles.
2. IDLE: stand 2-6 t, then GRAZE or WANDER (weighted). Normal perception.
3. GRAZE (herbivores): head down 4-12 t (random), then a 'head-up' beat of 2 t with full perception, then repeat. While head down sight radius -2. This gives the player a learnable rhythm: move while the head is down, freeze when it lifts (theHunter lowers the head for random time; BotW does lower guard while eating).
4. WANDER: pick a point 3-8 tiles away inside a roam circle around the animal's home anchor (herd centre); radius per species 6-14. Herd members follow the leader after finishing their own action (theHunter).
5. Notice test (each think step, all states except SLEEP rules above): the animal senses the player if (a) sight: in line of sight, in front half-plane (dot of facing and offset >= 0) and d <= sight; behind it sight is ceil(sight/2); (b) hearing: a noise event of radius N is heard if d <= N + ear (ear in {-2,0,+2} by species); (c) smell: see wind rule. If sensed: roll 25% per t beyond half range, 50% inside half range, 100% at d <= 2 (Brogue: flat 25%/turn; the 50% and 100% bands are ours). If the animal was hit or the noise was a loud event, skip the roll.
6. Player action sets the radius the animal tests against (stealth range). Walk 5, sneak (hold/crouch) 3 (walk halved, rounded up like Brogue's resting), stand still 2, run 8, chop/dig/butcher 9, sling or thrown stone 6, spear throw 6, bow 4, setting a snare 2, a bell or horn 14. Tall grass or bush tile: sight of every animal -2 for the player standing in it, but noise +2 while moving in it (theHunter: players make more noise in dense vegetation). Rain: sight -2, noise -2 (masks sound; also stops drying racks, Don't Starve). Dusk mist: sight -2 for both sides.
7. Wind rule (PROPOSAL, no tile-game source found): one wind direction W in {N,E,S,W}, changes every ~1200 t (shown by drifting grass/leaf sprites). Smell works only if the vector from player to animal has a positive dot product with W (player upwind of the animal); smell radius = species value (0 for birds, fish; 4-9 for deer, boar, wolf, bear). Not upwind: smell radius 1. Source for the idea: theHunter and RDR2 (scent, stay downwind).
8. ALERT: animal stops, faces the source, shows a head-up pose and a small tell (the 'readable' rule). Lasts 3-6 t. Each t the threat is still sensed adds 1 to a counter; at 3 -> tier transition (flee tier -> FLEE; defend tier -> DEFEND; hunt tier -> STALK). If nothing sensed for 4 t -> back to IDLE. ALERT spreads: every same-herd member within 8 tiles goes to ALERT at once (BotW doe herd; RimWorld spread is 25 tiles - ours is smaller because our map is 192 wide). A hit or a loud noise skips straight to FLEE/DEFEND.
9. FLEE: follow a 'safety map' (breadth-first from the threat, step to the neighbour that maximises distance, avoid dead ends and the player's facing line). Speed: small prey = player run speed (cannot be caught by chase, only by snare, sling, bait or an unaware strike); medium prey = player run speed. Flee ends when d >= sight + 4 or out of line of sight for 8 t; then WANDER away from the danger point and avoid that tile for 60 t. Hit animals flee twice as far (theHunter: flee distance changes with the hit). Birds fly: they cross water and fences and make a flush noise of radius 5 that alerts others (acts as an alarm for the player too).
10. DEFEND (defends tier, d1 and up): holds ground facing the player. If the player stays within 2 tiles for 2 t, or the animal is cornered or hit: CHARGE up to 5 tiles in a straight line, then rest 6 t; it never chases past 6 tiles from the spot. Until combat exists, contact is not damage; OPEN QUESTION for the manager: what is the consequence (suggestion: shoved back 2 tiles and the carried carcass is dropped).
11. STALK/CHASE (hunts tier, d2 only): STALK = approach from cover, hold still when the player faces it, speed = half walk; at distance <= 3 (lynx) or on first notice (wolf) -> CHASE. CHASE speed = player WALK speed, so a player who keeps walking away is never caught (hazard escaped). Give up: outside its sight radius 3% per t to lose track; automatic loss beyond 3x sight radius (Brogue); and never beyond its leash of 16 tiles from the home anchor (Monster Hunter turf idea); then RETURN. Pack: first notice sends a howl (noise radius 20) that alerts the whole pack; pack members share one target (Minecraft: attacked wolf turns the whole pack).
12. RETURN: walk back to the anchor, forget the target after 20 t, go IDLE.
13. Scavenger rule: a carcass on the ground for more than 30 t attracts ambient crows (visible to the player), at 60 t a predator may come to feed (Long Dark wolves feed on carcasses). A carcass has a spoil timer (see E).
14. Day phases: dawn, day, dusk, night. Each species lists active phases. Suggested default: prey herbivores dawn+dusk, small birds day, predators dusk+night, rabbits and hares go to ground at dusk (burrow tiles; Don't Starve; and the valley mist comes at dusk, STORY.md:64-66). DF uses day 6:00-20:00 and crepuscular 4:30-6:00, 20:00-22:05 as a reference. Our clock length is not in the docs read.

D. SPAWN RULES (PROPOSAL, shape from DF/RimWorld/Tibia)
- Content is a JSON table per region (6 regions in FIRST_MAP.md:17-23): species, weight (0-100), cluster size min-max, cap per 1000 habitat tiles, active phases, weather multiplier, habitat tiles (meadow, forest, reeds, water edge, rock). Example caps (individuals per 1000 habitat tiles): d0 12, d1 8, d2 5; the player-facing cap is 24 awake animals simulated within 40 tiles of any player; outside that, herds are stored as an anchor plus a count and are not stepped.
- Spawn attempt every 300 t per chunk (RimWorld ~1213 ticks; ours is proposal); never within 14 tiles of any player or in view (Tibia: 7 squares or 2 off screen; larger here because a phone view is small); never on a path leg inside the valley opening (FIRST_MAP.md:40-41 keeps the opening readable) and never within 12 tiles of the town square.
- Herd/pack anchors, not single animals: one anchor owns 1-N members. A killed member is restored by that anchor after 1 in-game day if the anchor is below min size and no player is within 20 tiles. This is the anti-extinction rule (DF: hunters exterminate local wildlife; Core Keeper livestock never returns; Don't Starve holes never respawn).
- Danger cap: d0 tiles spawn only ambient and flee-tier; defend-tier from d1; hunt-tier only in d2 habitat.
- Weather and time multipliers: rain halves bird flight spawns, doubles frogs and ducks (if added); winter/snow (if seasons exist) makes the highland hares white and tracks last 2x longer. Season and weather are not in the docs read; treat as optional.

E. THE HUNTING LOOP FOR US (steps, tool gates, goods)
1. FIND by signs, not stars: tracks, droppings, feathers, nests and grazed grass tiles appear in a region when an anchor is within 14 tiles; tracks lead to the animal (Don't Starve). A 'look' action at a visible animal within 8 tiles shows its quality 1-3 and its sex/size tell (RDR2 binocular study); no HUD number.
2. TRACK and read the day: the player learns head-up beats, wind, where herds move (pitch points between meadow and water, theHunter) and the dusk burrow time.
3. APPROACH: sneak in cover, stay upwind, move on head-down, freeze on head-up; bait (grain, fruit, raw meat) holds a prey in GRAZE for 6 t and removes the head-up beat (BotW apples, Don't Starve carrot).
4. STRIKE: only two outcomes, no combat. (a) The animal is unaware (SLEEP, GRAZE head-down, or baited) and in tool range -> clean kill, quality stays; (b) otherwise the strike misses or the animal is only scared and flees; wrong tool for the size lowers quality by 1 instead of blocking (RDR2). Hunt-tier and big defend-tier animals (stag, bear, wolves) cannot be struck before a combat system: they are trapped (pit or box trap with bait) or avoided.
5. CARCASS: field-dress with a knife (RDR2 skinning; Medieval Dynasty needs a knife): takes 6 t small, 12 t medium, 24 t large, noise 4; the player chooses 'take it all' (carry, 1 slot small, 2 slots medium, 4 slots large) or 'take the best part'. Spoil: raw meat 3 in-game days; hide 6 days before it must be scraped; cold highland doubles these (Long Dark: cold slows harvest, meat decays fast when exposed). A carcass left on the ground follows rule C13.
6. GOODS and processing (stations in this order, matching STORY.md:25-27): hands/knife -> campfire (cook, fire phase) -> drying rack (jerky; rain stops it) -> tanning rack (hide to leather, cure ~5 days as in Long Dark; bench-upgrade pattern as in Valheim) -> later: pottery, shears, spinning wheel. Goods table: meat, hide, bone, sinew, feather, fur, fat, fish, egg, wool, milk, horn/antler/tusk/fang. Prices and trade values come from the values lock, never per animal (AGENTS.md).
7. TOOL GATES (PROPOSAL; each tool's input comes from the tier before): T0 thrown stone (range 3, stuns small only, noise 6; foraging era). T1 snare (fibre cord, then sinew cord; small game; passive; checked once per in-game day; crows can steal). T2 sling (stone + cord, range 6, small and ground fowl, noise 6). T3 spear (wood + flint; thrust 1, throw 4; medium prey only when unaware; breaks below 66% durability when thrown, Medieval Dynasty). T4 bow (stave + sinew string + feather fletching; range 8, noise 4; medium prey; gate = sinew and feathers from T1-T3 kills). T5 pit/box trap (timber + rope + bait; large and defend-tier prey). Post-fire: bone-hook line (fishing), then rod tiers (Stardew: 25 / 500 / 1,800 / 7,500 gold as an example of a 3-4 step ladder; ours uses goods, not gold), later net and weir (after pottery or fibre work). No tool is race-locked.
8. RENEWABLE BRANCH (rating-safe, no kill): egg raid from ground-fowl nests (3 eggs per nest, nest refills every 2 days), wool by shearing an unaware sheep with a flint or metal blade, feathers dropped on the ground by moulting birds, milk only after taming (later phase). Fish and shellfish are gather/catch spots, not entities.
9. FAIRNESS CHECKLIST (what players love): every animal reaction has a visible tell and a visible cause; the player can learn schedule, wind and cover; a clean kill is rewarded in quality, not just in speed; failure costs time and a lost animal, never health; predators are escapable and announce themselves (howl, tracks, crows); wrong-tool kills still work at lower quality.

F. PHASES (the owner said many animals come later)
- Phase 1 (hunting before fire, d0): field hare, ground fowl, songbirds, roe deer (bow later), sling and snare, raw meat.
- Phase 2 (after fire): marsh duck, hill sheep, highland goat, marmot, ptarmigan, boar, adder, tarn trout, herring shoal, shore crab, crows.
- Phase 3 (after combat or a pit trap): great stag, wolf pack, wildcat, white bear.

G. OPEN QUESTIONS FOR THE OWNER OR MANAGER (not decided here)
1. Speeds: player walk/run speed, and animal speeds, are not in the two docs read; the escape rule depends on 'predator speed <= player walk speed'.
2. What happens on contact with a defender or hunter before combat exists.
3. Do elves eat meat and does their wood have a say on hunting inside it? STORY.md only lists the elf as 'the fold that looks like magic' (STORY.md:35-39); nothing about diet.
4. What does a skeleton get from meat (nothing, a mood effect, a swap for bone)? Not in docs; ask.
5. Are animals allowed to go to ground at dusk because of the mist? (STORY.md:64-66 is an observable bone; this is a suggestion.)
6. Real tile size on a phone (see B).
7. GAME_RULES.md not read; must be checked.

## numbers
### numbers[0]
**name**: Brogue base stealth range

**value**: 7 normal light, 3 dark, 14 lit

**source**: SOURCED https://brogue.wiki/wiki/Stealth (fetched)

### numbers[1]
**name**: Brogue resting effect and notice roll

**value**: range halved rounded up when resting (min 2, or 1 after a rest turn); flat 25% chance per turn to notice inside range

**source**: SOURCED https://brogue.wiki/wiki/Stealth (fetched); older wiki https://brogue.fandom.com/wiki/Stealth?oldid=9248 (search snippet)

### numbers[2]
**name**: Brogue lose-track rule

**value**: 3% per turn to lose track outside range; lose track entirely beyond 3x range

**source**: SOURCED https://brogue.wiki/wiki/Stealth (fetched)

### numbers[3]
**name**: Brogue sneak attack

**value**: sleeping, wandering or paralysed targets: always hit, triple damage (quintuple with a dagger)

**source**: SOURCED https://brogue.wiki/wiki/Stealth (fetched)

### numbers[4]
**name**: Minecraft rabbit flee radii

**value**: avoids players within 8 blocks, wolves within 10, most hostile mobs within 4; groups of 1 adult + 1-2 babies, up to 2-6 in meadows

**source**: SOURCED https://minecraft.wiki/w/Rabbit (fetched)

### numbers[5]
**name**: Minecraft rabbit drops (Java)

**value**: hide 0-1 at 50%, raw rabbit 1, foot 0-1 at 10% (only when a player or tamed wolf kills)

**source**: SOURCED https://minecraft.wiki/w/Rabbit (fetched)

### numbers[6]
**name**: Minecraft fox group and wolf aggro

**value**: foxes spawn in groups of 2-4; wild wolves hostile to foxes within 18 blocks (Java) / 16 (Bedrock); fox sleeps by day in sky light 14 or less

**source**: SOURCED https://minecraft.wiki/w/Fox (fetched)

### numbers[7]
**name**: Minecraft wolf pack

**value**: pack size 4 in taiga/forest, 4-8 in savanna and wooded badlands, 1 in grove; attacking one wild wolf turns every wild wolf in a 33x21x33 cuboid hostile

**source**: SOURCED https://minecraft.wiki/w/Wolf (fetched)

### numbers[8]
**name**: RimWorld herd/manhunter spread

**value**: 25 tiles radius with valid pathfinding to the attacker

**source**: SOURCED https://rimworldwiki.com/wiki/Hunt (fetched)

### numbers[9]
**name**: RimWorld spawn attempt and density

**value**: attempt every about 1213 ticks; default biome animalDensity 3.5, temperate forest 3.7, ice sheet 0.2; scaled per 10,000 map squares

**source**: SOURCED (search snippets, community talk page) https://rimworldwiki.com/wiki/Talk:Temperate_forest ; https://rimworldwiki.com/wiki/Modding_Tutorials/Biomes

### numbers[10]
**name**: Tibia respawn guard

**value**: respawn only when no player within 7 squares or 2 squares off screen

**source**: SOURCED (search snippet) https://www.tibiaqa.com/39442/how-does-creature-respawn-actually-scale-semi-abandoned-hunting-areas

### numbers[11]
**name**: Dwarf Fortress day tokens

**value**: DIURNAL about 6:00-20:00; CREPUSCULAR about 4:30-6:00 and 20:00-22:05; ALL_ACTIVE any time

**source**: SOURCED (search snippet) https://dwarffortresswiki.org/index.php/40d:Creature_token

### numbers[12]
**name**: Dwarf Fortress spawn tokens

**value**: FREQUENCY 0-100 comparative; CLUSTER_NUMBER = how many at once; POPULATION_NUMBER = cap (deer 15:30)

**source**: SOURCED (search snippet) https://dwarffortresswiki.org/Creature_token

### numbers[13]
**name**: Don't Starve rabbit

**value**: health 25; goes to its hole at dusk; holes do not respawn; trap above a hole = guaranteed catch; carrot bait lets you strike while it eats

**source**: SOURCED https://dontstarve.wiki.gg/wiki/Rabbit (fetched)

### numbers[14]
**name**: Don't Starve koalefant

**value**: drops 8 meat + 1 trunk; avoids the player until attacked, then chases and all nearby koalefants aggro

**source**: SOURCED (search snippet) https://dontstarve.wiki.gg/wiki/Koalefant

### numbers[15]
**name**: Valheim deer

**value**: health 10; drops meat 2, hide 1-3 (scales with star), trophy 1 at 50%; biomes Meadows and Black Forest

**source**: SOURCED https://physgun.com/tools/valheim/creatures/deer/ (fetched; game version 0.221.12)

### numbers[16]
**name**: Valheim tanning rack recipe

**value**: 10 wood, 15 flint, 20 leather scraps, 5 deer hide, within 2 m of a workbench

**source**: SOURCED (search snippet, sources disagree on scrap and flint origin) https://allthings.how/valheim-how-to-make-a-tanning-rack/

### numbers[17]
**name**: Long Dark carcass yields

**value**: deer 8-10 kg raw meat + 2 guts + 1 hide; wolf 3-6 kg meat + 1 pelt + 2 guts; cure hides and guts 5 days

**source**: SOURCED (search snippet of old wiki revisions) https://thelongdark.gamepedia.com/Deer?diff=6542

### numbers[18]
**name**: Medieval Dynasty spear

**value**: throw only at 66% durability or more; carry at least 3

**source**: SOURCED (search snippet) https://www.gamepressure.com/medieval-dynasty/hunting/zfdac7

### numbers[19]
**name**: Core Keeper Moolin milk

**value**: 1 milk per 10 minutes for 2 plants eaten; killing it drops Marbled Meat and it does not respawn

**source**: SOURCED (search snippet, hosting guide) https://www.bisecthosting.com/it-it/blog/core-keeper-cattle-location-how-to-catch-types-feed

### numbers[20]
**name**: Terraria bunny

**value**: 5 life, passive, Gold Bunny 1/400, caught with Bug Net

**source**: SOURCED https://terraria.wiki.gg/wiki/Bunny (fetched)

### numbers[21]
**name**: Stardew rod ladder

**value**: 25g / 500g / 1,800g / 7,500g (Training / Bamboo / Fiberglass / Iridium)

**source**: SOURCED (search snippet) https://stardewvalleywiki.com/Fiberglass_Rod

### numbers[22]
**name**: RDR2 quality scale

**value**: 1-3 stars; only 3-star animals give a perfect pelt

**source**: SOURCED https://www.rdr2.org/guides/red-dead-redemption-2-hunting-guide/ (fetched)

### numbers[23]
**name**: Map and view arithmetic

**value**: map 192 x 192 tiles; 390 / 64 = 6.1 and 844 / 64 = 13.2 tiles if a tile is 64 CSS px

**source**: map size from docs/design/FIRST_MAP.md:11; image size from FIRST_MAP.md:12; the division is ours and assumes tile = 64 CSS px (unverified)

### numbers[24]
**name**: Danger tiers by level in plan A

**value**: d0 4541 tiles, d1 6142, d2 994; d0 under 64 steps from town

**source**: docs/design/FIRST_MAP.md:43-44

### numbers[25]
**name**: Think step

**value**: 1 decision per 8 game ticks, staggered by id mod 8

**source**: PROPOSAL (ours)

### numbers[26]
**name**: Player noise radii (tiles)

**value**: still 2, sneak 3, walk 5, run 8, chop/dig/butcher 9, sling or stone 6, spear throw 6, bow 4, snare set 2, horn/bell 14

**source**: PROPOSAL (ours; shape from Brogue's single stealth radius)

### numbers[27]
**name**: Notice chance

**value**: 25% per think step in the outer half of range, 50% in the inner half, 100% at 2 tiles or less

**source**: PROPOSAL (25% is Brogue; the 50% and 100% bands are ours)

### numbers[28]
**name**: Alert timing

**value**: ALERT lasts 3-6 t; 3 consecutive sensed t -> flee/defend/stalk; 4 t quiet -> idle; herd mates within 8 tiles go to ALERT

**source**: PROPOSAL (ours)

### numbers[29]
**name**: Flee end and memory

**value**: flee ends at distance >= sight + 4 or 8 t out of sight; avoid the danger tile for 60 t; hit animal flees 2x as far

**source**: PROPOSAL (ours; 'flee distance changes with the hit' from theHunter)

### numbers[30]
**name**: Defender charge

**value**: charge up to 5 tiles straight, rest 6 t, never chase past 6 tiles from the spot

**source**: PROPOSAL (ours)

### numbers[31]
**name**: Hunter chase

**value**: speed = player walk; give-up 3% per t outside sight; lost beyond 3x sight; leash 16 tiles from home anchor; pack howl noise 20

**source**: PROPOSAL (ours; 3% and 3x from Brogue)

### numbers[32]
**name**: Cover and weather modifiers

**value**: tall grass or bush: animals' sight -2 but own noise +2; rain: sight -2, noise -2; dusk mist: sight -2 both sides

**source**: PROPOSAL (ours)

### numbers[33]
**name**: Wind

**value**: 4 directions, changes every about 1200 t; smell works only when the player is upwind (positive dot product); otherwise smell radius 1

**source**: PROPOSAL (ours; no tile-game source found; theHunter and RDR2 use scent and wind in 3D)

### numbers[34]
**name**: Sight/ear/smell radii by animal

**value**: hare 6/+2/0; songbird 5/0/0; ground fowl 5/+1/0; roe deer 8/+2/6; boar 4/0/8; duck 7/+1/0; crab 3/0/0; sheep 6/+1/3; goat 8/0/3; marmot 8/+2/0; ptarmigan 3/0/0; great stag 8/+2/7; wolf 8/+2/9; lynx 7/+2/3; white bear 5/0/9; adder 2/0/0; crow 7/0/0

**source**: PROPOSAL (ours); ear is added to the noise radius; smell works only upwind

### numbers[35]
**name**: Spawn parameters

**value**: attempt every 300 t per chunk; no spawn within 14 tiles of a player or in view; 12 tiles from the town square; 24 awake animals within 40 tiles of any player; caps per 1000 habitat tiles: d0 12, d1 8, d2 5; anchor refills a lost member after 1 in-game day if no player within 20 tiles

**source**: PROPOSAL (ours; shape from DF, RimWorld and Tibia)

### numbers[36]
**name**: Carcass sizes and times

**value**: field-dress 6 t small, 12 t medium, 24 t large (noise 4); carry 1 / 2 / 4 slots; raw meat spoils in 3 in-game days; hide must be scraped within 6 days; cold highland doubles both; crows at 30 t, predator at 60 t

**source**: PROPOSAL (ours; shape from Long Dark and Dwarf Fortress)

### numbers[37]
**name**: Tool ranges

**value**: thrown stone 3, sling 6, spear thrust 1 / throw 4, bow 8; thrown stone and sling stun small prey only; hide cure about 5 days (Long Dark)

**source**: PROPOSAL (ours); cure time SOURCED from the Long Dark snippet above

### numbers[38]
**name**: Renewables

**value**: 3 eggs per nest, nest refills in 2 days; shear an unaware sheep once per 3 in-game days; milk only after taming

**source**: PROPOSAL (ours)

## catalogue
### catalogue[0]
**name**: Field hare

**detail**: region: valley floor meadows and fields (d0), also east terraces. archetype: skittish ground prey, goes to burrow tiles at dusk. tier: flees. gives: meat 1, small hide scrap, fur. how hunted: snare on a trail sign, sling, thrown stone; a strike on an unaware hare while it feeds on bait. day/night: dawn and dusk active, sleeps in burrow at night. size: small 1. senses sight/ear/smell 6/+2/0. phase 1. why fits: the first thing a new player can catch next to the town, with no risk, so hunting starts before fire and the first sinew and hide come from it.

### catalogue[1]
**name**: Meadow songbirds

**detail**: region: valley floor, all d0 grass and field edges; fewer in the elf wood. archetype: ambient flock that lifts off in a burst when anything enters 4 tiles or a loud noise happens. tier: ambient. gives: nothing when alive; a feather drops from a moulting bird on the ground tile. how hunted: not hunted; the burst is an alarm that also alerts other animals within 8 tiles. day/night: day only, roosts at dusk. size: small 1. senses 5/0/0. phase 1. why fits: gives the player a readable 'something is moving' tell on a small screen and makes noise matter.

### catalogue[2]
**name**: Ground fowl (wild hen)

**detail**: region: valley floor fields and hedges (d0), reed edges. archetype: short-flight bird that runs, then flutters up; nests on the ground. tier: flees. gives: eggs (3 per nest, no kill), feathers, meat 1. how hunted: raid a nest while the hen is away (non-lethal), sling, snare, thrown stone; baited with grain. day/night: day; roosts at dusk. size: small 1. senses 5/+1/0. phase 1. why fits: the first non-lethal renewable goods (eggs, feathers) and the feather gate for arrows, in a safe field near town.

### catalogue[3]
**name**: Roe deer

**detail**: region: meadow edges (d0) up to the elf wood fringe (d1); herd of 3-5 around one anchor. archetype: herd grazer with a leader, alert spreads to the herd, flees along a safety map. tier: flees. gives: venison 3, hide 1-3 by quality, bone, sinew 2, antler (buck). how hunted: bow or spear from cover on a head-down moment, upwind; bait of fruit holds it grazing; pit trap in phase 3. day/night: dawn and dusk, bedded in cover at night. size: medium 1. senses 8/+2/6. phase 1 for snare-only trapping, phase 2 for bow. why fits: the central hunt of the loop - it teaches approach, wind and clean kill, and its goods feed leather, bowstring and food.

### catalogue[4]
**name**: Wild boar

**detail**: region: forest edges and thickets at the outer floor (d1), elf wood (d2); family of 2-4. archetype: defender - holds its ground, charges 5 tiles when cornered or approached to 2 tiles, bad sight, strong smell. tier: defends. gives: meat 3, thick hide, tusk (bone), fat. how hunted: spear from a high ledge or tree, pit trap with bait; not attackable head-on before combat exists. day/night: dawn and night forager, sleeps in a wallow by day. size: medium 1. senses 4/0/8. phase 2. why fits: the first animal that can say no, so the player learns that danger rises with distance from town (Valheim boars fight back in groups, Medieval Dynasty boar attacks at once).

### catalogue[5]
**name**: Marsh duck

**detail**: region: reed marsh at the tangle's wet corner, bay shallows (d2), tarn shore (d1). archetype: flushing waterfowl, flies over water and fences, nests in reeds. tier: flees. gives: meat 1, down feathers, eggs (nest, non-lethal). how hunted: sling or bow at a floating duck, net later, nest raid. day/night: day; roosts in reeds at dusk. size: small 1. senses 7/+1/0. phase 2. why fits: ties the wet regions to food and feather goods, and its flight makes noise that turns other heads.

### catalogue[6]
**name**: Shore crab

**detail**: region: south-west bay shore and dock rocks (d2). archetype: ground scuttler that runs sideways into water when someone is within 3 tiles. tier: flees. gives: meat 1, shell (bone-like). how hunted: hand grab from behind, crab pot after pottery. day/night: all hours, more active at low light. size: small 1. senses 3/0/0. phase 2. why fits: a cheap, safe thing to find on the coast walk, a first sea food and a shell for a hook or cup.

### catalogue[7]
**name**: Tarn trout

**detail**: region: the tarn in the east highland (d1); also the stream. archetype: fishing spot with a bite timer, no movement AI. tier: ambient. gives: fish 1-2, bone, roe. how hunted: bone-hook line, spear in the shallows, weir later; needs fire to cook well. day/night: dawn and dusk bites are faster. size: small 1. phase 2 (fishing follows fire, STORY.md:25-27). why fits: the boathouse keeper's lake (FIRST_MAP.md:5) has a reason to be visited and fed from.

### catalogue[8]
**name**: Herring shoal

**detail**: region: south-west bay (d2), near the dock. archetype: shoal spot that moves between 3 water tiles every few steps; no flee. tier: ambient. gives: fish 2-3, oil, bone meal. how hunted: line with bait, net from a boat later. day/night: dusk and night shoals. size: small 1. phase 2-3. why fits: the bay and dock give the far-bank sailing story a food side and the first food worth trading.

### catalogue[9]
**name**: Hill sheep (feral)

**detail**: region: east terraces and highland slopes (d0-d1), flock of 4-8. archetype: herd grazer that flees together; tameable later. tier: flees. gives: wool by shearing (non-lethal), meat 2, hide, fat; milk after taming. how hunted: shear when unaware with a flint blade, bow for meat, bait of salt or grain; pen later. day/night: day grazing, bunches on a ledge at night. size: medium 1. senses 6/+1/3. phase 2. why fits: the high terraces become the wool and herd region and the bridge to later herding.

### catalogue[10]
**name**: Highland goat

**detail**: region: highland slopes and the passes' feet (d1), cliffs near the mountain edge. archetype: climber that flees up steep or rock tiles where the player cannot follow; sentinel stands on a high tile. tier: flees. gives: meat 2, hide, horn, sinew; milk after taming. how hunted: bow from below on a head-down turn, snare at a ledge path, bait; fails if it reaches rock. day/night: day, sleeps on a ledge. size: medium 1. senses 8/0/3. phase 2. why fits: makes the cold highland a reading of terrain, not a straight chase.

### catalogue[11]
**name**: Mountain marmot

**detail**: region: highland rock and scree (d1), foothill edges. archetype: burrower sentinel that whistles an alarm (noise 10) before fleeing underground; the whistle alerts every animal within 10. tier: flees. gives: meat 1, fat (torch fuel), small fur. how hunted: snare at the burrow mouth, sling, wait for it to feed. day/night: day; sleeps in burrow at night. size: small 1. senses 8/+2/0. phase 2. why fits: a cheap warning animal for the highland, and a source of fat before pottery.

### catalogue[12]
**name**: Ptarmigan (snow grouse)

**detail**: region: snow-line highland and the foot of the snowy mountains (d1-d2). archetype: freeze then flush - stays still until the player is within 2 tiles, then bursts with a noise of radius 5. tier: flees. gives: meat 1, white feathers. how hunted: spot it by its tracks, strike unaware while it freezes, sling from 5 tiles; a flush can ruin a stalk of nearby deer. day/night: day; shelters in snow at night. size: small 1. senses 3/0/0. phase 2. why fits: shows that noise has a cost near the mountains and gives the feather source for the cold side.

### catalogue[13]
**name**: Great stag

**detail**: region: elf wood glades (d2), single or a pair. archetype: large herd leader that flees early with a bark that alerts all deer within 12, defends if cornered. tier: flees (defends when cornered or hit). gives: venison 6, large hide, antler, sinew 4. how hunted: bow from a blind at dusk, pit trap with bait; no melee. day/night: dawn and dusk, in thick cover at night. size: large 2. senses 8/+2/7. phase 3. why fits: the long-term prize of the elf wood and its three wayside stalls, a hunt worth planning around wind and cover.

### catalogue[14]
**name**: Forest wolf pack

**detail**: region: elf wood fringe and the feet of the mountains (d2); pack of 3-5. archetype: pack hunter - howl at first notice (noise 20), shared target, speed = player walk, gives up by 3% per step outside sight, leash 16 tiles. tier: hunts. gives: pelt, fang (bone), poor meat 1. how hunted: not hunted; avoided or scared with fire (fire phase) and trapped with bait; the howl warns first. day/night: dusk and night, dens at day. size: medium 1 each. senses 8/+2/9. phase 3 (after combat or traps). why fits: the clearest 'danger rises with distance' signal on the map and a reason to carry a torch.

### catalogue[15]
**name**: Wildcat (lynx)

**detail**: region: elf wood thickets and rocky cover at the mountain edge (d2). archetype: lone ambusher - stalks from cover, holds still when the player faces it, dashes 3 tiles; if noticed (player faces it within 4 tiles for 2 steps) it gives up. tier: hunts. gives: fine fur, meat 2, claw. how hunted: avoided; baited snare or box trap; carcass bait draws it. day/night: dusk and night. size: medium 1. senses 7/+2/3. phase 3. why fits: a hunter you can see and defeat by looking at it, which teaches the player to scan the dark edge of the wood.

### catalogue[16]
**name**: White bear

**detail**: region: snowy near-impassable mountains and the hidden hard routes (d2). archetype: large lone predator in a den area, strong smell, charge-and-lose pattern, hibernates in cold weather if seasons exist. tier: hunts. gives: thick fur, fat 6, claw, meat 5. how hunted: not hunted before a late trap; avoid its den tile ring of 8; an ice pit with bait is the only planned way. day/night: dusk and dawn; sleeping in the den by day. size: large 2. senses 5/0/9. phase 3. why fits: the snowy mountains are a trial, and this animal is the scale of it (monsters and ice pits are in FIRST_MAP.md:4).

### catalogue[17]
**name**: Dust adder

**detail**: region: undead south, the sunken hall and its dry approaches (d1), beyond (d2). archetype: ambusher defender - strikes only when stepped on or within 1 tile, rattles (noise 4) first. tier: defends. gives: hide, meat 1, venom gland (later craft). how hunted: spear from 2 tiles, snare on a sun-warmed rock. day/night: basks by day, hides in cracks at night. size: small 1. senses 2/0/0. phase 2. why fits: puts a small, readable danger in the dry dark south with a sound cue instead of a number.

### catalogue[18]
**name**: Carrion crow

**detail**: region: everywhere, thickest in the undead south and around any carcass (d1-d2). archetype: scavenger - gathers at carcasses after 30 steps, steals a carcass left on the ground, flies off at 4 tiles. tier: ambient. gives: black feathers when it moults; meat is inedible. how hunted: sling or snare if wanted; mostly a signal. day/night: day; roosts at dusk. size: small 1. senses 7/0/0. phase 1-2. why fits: tells the player where something died and creates carcass pressure without any combat or hazard.

## pitfalls
- GAPS (no usable source found, do not treat as researched): Breath of the Wild animal internals (only wiki and interview fragments on herd alert and baiting; the GDC talk was not found); Tibia deer and wolf entries (fetch returned 402); Terraria and Core Keeper wild-critter drops (Terraria bunny page has no loot table; Core Keeper wild critters not found); what Stardew's designer said about having no hunting (the 'deliberate choice' reading is inference from one academic paper); Graveyard Keeper (2018 forum anecdotes only); Dwarf Fortress Hunter, Hunting, Creature_token pages never loaded, so DF is thin and from search snippets; Valheim fandom and Long Dark fandom pages returned 402; Mountain Doe page returned 403.
- Several figures come only from search snippets of old wiki revisions or 2015-2018 forum posts (Long Dark yields and cure days, Valheim tanning rack, Core Keeper milk, Medieval Dynasty 66%). Valheim drop table is from game version 0.221.12 and sources disagree on trophy rates and leather-scrap origin. Re-check any of them before it goes in a brief.
- AGE RATINGS: no rated pixel game that hunts animals was found; the closest evidence is Stardew Valley E10+ (Fantasy Violence, Mild Blood, cartoony monsters, livestock, https://www.esrb.org/ratings/34835/stardew-valley/), Terraria T (Blood and Gore, Cartoon Violence; animals and creatures described as cartoony, Switch listing notes some enemies emit small drops of blood), theHunter: Call of the Wild T (Blood, Violence; players track and shoot prey; large blood-splatter effects on hits, https://www.esrb.org/ratings/34999/thehunter-call-of-the-wild/), and Red Dead Redemption 2 PEGI 18 / Mature 17+ (retail listing only). Minecraft PEGI 7 and Stardew PEGI 7 are retail-listing claims, unverified. Valheim's PEGI was a prediction, no official rating confirmed.
- PEGI wording (https://www.pegi.info/what-do-the-labels-mean, fetched): 3 'very mild form of violence (in a comical context or a childlike setting)'; 7 'implied, non-detailed, or non-realistic'; 12 more graphic toward 'fantasy characters', non-realistic toward 'human-like characters'; 16 'a stage that looks the same as would be expected in real life'; 18 'gross violence, apparently motiveless killing, or violence towards defenceless characters'. The page does not mention animals. The animal-specific PEGI 12 wording ('non-realistic looking violence towards human-like or animal-like characters', 'recognisable animals') comes only from secondary summaries (MovieLabs, rating-system wiki). The PEGI 18 phrase 'violence towards defenceless characters' is a RISK FLAG, not a finding: killing passive animals could be read that way. ESRB's descriptor page (https://www.esrb.org/ratings-guide/) has no animal or hunting descriptor; Fantasy Violence is defined as 'violent actions of a fantasy nature, involving human or non-human characters'. Do not state any final rating; the owner runs the official questionnaire.
- AVOID LIST (PROPOSAL, for a pixel game aiming at a low rating): no blood on animals (a kill is a puff, a fade or a drop of goods); no suffering or death-throes animation, no crying sounds; baby animals cannot be hunted or harmed; no pets or companion species (dog, cat, horse, mount) as prey; no killing of a tamed animal in front of the player; no 'executing' of a downed animal; no corpse piles; no real-weapon realism (rifle, scope); no animal harm as a score or achievement; keep poison arrows out; no human or skeleton flesh as meat (Graveyard Keeper pattern); keep wolves and bears as 'avoid or trap', not 'kill for fun'. Ambient wildlife and non-lethal goods (eggs, wool, feathers) are the safest. Stardew shows livestock and cartoon enemies at E10+, but it has no animal hunting.
- STORY RULES: STORY.md:58-60 (S1) the narrator never states the past; STORY.md:61-63 (S2) every claim about the past has a speaker. Animal 'why it fits' lines, sign text and the diary of a hunter must be present tense and name no age ('long ago', 'ancient', 'the old ones'). Animals hunted in ruins or 'folds' must not imply who lived there. Races are human, elf, skeleton only; forager/digger/explorer are retired (memory note Speak in Races).
- DIET QUESTIONS NOT IN THE DOCS: whether elves eat meat, whether a skeleton uses meat at all, and whether the elf wood allows hunting. Do not decide silently; ask the owner. Meat for a skeleton may need to be a bone/trade good instead.
- DANGER RULE: a hunts-tier animal is only safe because it is escapable. It needs a speed no higher than the player's walk and a give-up rule; if the manager lets animals be faster than the player, the 'hazard is escaped' rule breaks. Contact consequences are undecided. Do not invent damage or a health bar for the player.
- VIEWPORT: if a tile is really 64 CSS px, a phone screen is only about 6 x 13 tiles; animals with sight 6-8 will notice the player off-screen. Every off-screen reaction needs a visible or audible tell, or the radii must be scaled down. Not verified; the repo docs read do not state the tile size on screen.
- EXTINCTION AND SHARED WORLDS: Dwarf Fortress hunters eventually exterminate local wildlife; Core Keeper livestock does not respawn after killing; Don't Starve rabbit holes do not respawn. A shared multiplayer world must refill by anchor (rule D) or the first players will empty the valley. Pure respawn timers invite farming loops; the anchor rule with 'no refill while a player is within 20 tiles' is the guard.
- SPAWNING IN VIEW: never spawn inside the player's sight or inside the opening's path legs; Tibia's guard (7 squares or 2 off screen) is for a larger view than a phone.
- DANGER CREEP AT D0: ambient and flees only at d0 (< 64 steps). A defender at d0 breaks the owner's 'danger rises with distance'. Boars and adders start at d1.
- NOISE COST: if every player action makes noise, animals are never approachable; if sneak and cover are too strong, hunting is trivial. Tune after a first test, with a measurable criterion (for example 'a player who sneaks and stays upwind gets a clean strike on a grazing roe deer at least 2 of 3 times; a running player gets 0 of 3').
- CARCASS SPOIL AND SLOT PRESSURE: carry slots and spoil times are ours; if inventory is tight, large animals become unusable. Decide the inventory rule before the builder briefs carcass size.
- PRICES: AGENTS.md says never hardcode item prices; goods values come from the values lock. Do not put gold prices in animal content. Stardew's rod prices are an example of tiering only.
- HUNT BEFORE FIRE: STORY.md:25-27 puts hunting before fire. Raw meat must be edible but weak, or the first hunting reward is a trap. BotW treats raw meat as low healing (search snippet).
- MIST AT DUSK: 'animals go to ground at dusk' ties a gameplay rule to the mist (a core story bone, STORY.md:64-66). It is a suggestion; the owner must approve before it is built.
- DO NOT COPY: the Graveyard Keeper corpse-flesh joke (tone and rating risk) and the Valheim/Don't Starve combat reliance (our kernel has no combat yet).
## sources
- docs/design/FIRST_MAP.md:5-9, 11-12, 17-23, 40-41, 43-44 (repo, read)
- docs/design/STORY.md:25-27, 35-39, 58-66 (repo, read)
- https://www.gamedeveloper.com/design/thehunter-call-of-the-wild---designing-believable-simulated-animal-ai (fetched)
- https://brogue.wiki/wiki/Stealth (fetched)
- https://minecraft.wiki/w/Rabbit (fetched)
- https://minecraft.wiki/w/Fox (fetched)
- https://minecraft.wiki/w/Wolf (fetched)
- https://rimworldwiki.com/wiki/Hunt (fetched)
- https://rimworldwiki.com/wiki/Animals (fetched)
- https://dontstarve.wiki.gg/wiki/Rabbit (fetched)
- https://dontstarve.wiki.gg/wiki/Koalefant (search snippet)
- https://www.rdr2.org/guides/red-dead-redemption-2-hunting-guide/ (fetched)
- https://physgun.com/tools/valheim/creatures/deer/ (fetched, game version 0.221.12)
- https://terraria.wiki.gg/wiki/Bunny (fetched)
- https://www.esrb.org/ratings/34835/stardew-valley/ (fetched)
- https://www.esrb.org/ratings/34999/thehunter-call-of-the-wild/ (fetched)
- https://www.esrb.org/ratings-guide/ (fetched)
- https://www.pegi.info/what-do-the-labels-mean (fetched)
- https://en.wikipedia.org/wiki/Animals_in_video_games (fetched)
- https://en.wikipedia.org/wiki/PEGI (search result)
- https://www.movielabs.com/md/ratings/v2.0/html/BE_PEGI_Ratings.html (search snippet)
- https://primagames.com/tips/red-dead-redemption-2-how-get-perfect-hides (search snippet)
- https://thelongdark.gamepedia.com/Deer?diff=6542 (search snippet, old revision)
- https://windowscentral.com/valheim-hunting-guide-tips-tricks-and-information-you-need-know (search snippet)
- https://allthings.how/valheim-how-to-make-a-tanning-rack/ (search snippet)
- https://www.gamepressure.com/medieval-dynasty/hunting/zfdac7 (search snippet)
- https://www.zeldadungeon.net/wiki/Mountain_Doe (search snippet; fetch 403)
- https://twinfinite.net/news/you-can-be-a-vegan-in-the-legend-of-zelda-breath-of-the-wild/ (search snippet)
- https://twinfinite.net/ps4/monster-hunter-world-beta-impressions/2/ (search snippet)
- https://pcgamer.com/games/action/monster-hunter-wilds-director-says-changes-to-the-ecosystem-are-persistent-even-as-you-return-to-base-the-world-outside-is-moving-on-and-continuing-where-you-left-it-in-the-background (search snippet)
- https://dwarffortresswiki.org/Creature_token and https://dwarffortresswiki.org/index.php/40d:Creature_token (search snippets)
- https://dwarffortresswiki.org/index.php/23a:Hunting and https://dwarffortresswiki.org/butcher (search snippets)
- https://rimworldwiki.com/wiki/Talk:Temperate_forest and https://rimworldwiki.com/wiki/Modding_Tutorials/Biomes (search snippets)
- https://www.tibiaqa.com/39442/how-does-creature-respawn-actually-scale-semi-abandoned-hunting-areas (search snippet)
- https://tibiantis.info/library/trivia (search snippet)
- https://otland.net/threads/inconsistency-in-runonhealth-behavior.286883/ (search snippet, forum)
- https://www.bisecthosting.com/it-it/blog/core-keeper-cattle-location-how-to-catch-types-feed (search snippet)
- https://stardewvalleywiki.com/Fiberglass_Rod and https://stardewvalleywiki.com/Bamboo_Pole and https://stardewvalleywiki.com/Iridium_Rod (search snippets)
- https://link.springer.com/content/pdf/10.1007%2Fs40869-018-0055-x.pdf (search snippet)
- https://steamcommunity.com/app/599140/discussions/0/1734336452551999989 (search snippet, forum)
- https://purenintendo.com/review-graveyard-keeper-nintendo-switch/ (search snippet)
