# Body clocks: what the big games keep, and the owner's answer: two bars, harsh places, gear and dishes (2026-10-25)

The owner, 25.10, on the progression map's Q8: align the body clocks with the big games; research and cross-check before deciding. Sections 1-4 read every body clock and need the game has on `origin/develop`, read the reference games' clocks with their published numbers and cross the two; they stay as the research record. The owner then answered Q8 the same day with none of the three options the first draft offered (a cold clock, a hard mode, no clock), and answered its two follow-ups: **the body has two bars only, health and experience; a place is harsh, it slows and takes health by its grade, and what the player wears answers it; food heals and cooked dishes give timed effects from a closed list; sleep only saves and passes the night.** Sections 5-9 write that model out; section 10 holds it against the decisions, section 11 is the record of the answers.

Its entries: DECISIONS 2026-10-25 ⏸ "Body clocks: the research for Q8" (now answered) and the ✅ entries "The progression map, Q8", "Q8a" and "Q8b". Its parent: [PROGRESSION.md](PROGRESSION.md) section 4.5 and Q8. Design only: no schema, kernel, content, parameter or screen changes with it. The model is the owner's; every number in sections 5-9 is **proposed** and moves with play.

Facts are read from `origin/develop` @ a6b0bf28: `kernel/src/state.ts` (`satiety`, `satietyCap`, `satietyAt`), `kernel/src/step.ts` (`eat`, `hurt`, the fall, the low-health slow-down, the hunt refill), `content/core/params.json` (`satiety_cap`, `satiety_drain_per_min`, `per_point.stamina`, `hp_low_pct`, `day_length_ms`, `fire`, `hazard`, `light`), `content/core/recipes/` and `resources/` (the foods), `content/core/schools/cooking.json` (`meal_fill_pct`), `schema/src/index.ts` (`CLIMATES`, `WORN_EFFECTS`), GAME_RULES G28-G34 and G48, NATURE.md sections 2 and 4.

## 1. What the game has today

One clock of the body is built, health, and it does not run by the clock. Everything else the big games call a need is either absent or a place's rule.

| Clock or need | State on develop | Rate | Thresholds and effects | Fed by | On screen |
|---|---|---|---|---|---|
| **Health** (the field `satiety`, renamed later) | built, the one bar (G32) | none by the clock: `satiety_drain_per_min` 0 since 11.10 (P-5c); kept lazily per tick | cap `satiety_cap` 100 + `per_point.stamina` 20 a point; at or under `hp_low_pct` 25% work takes 1.5 times as long; at 0 after something hurt, a fall (G33), waking at full health in the last town | food (raw berry 4, mushroom 3; cooked herb tea 10, berry mash 15, mushroom skewer 25, herb stew 40), bandage 20, first-aid kit 50; Cooking's `meal_fill_pct` (+20, +30, +20 on three nodes); a hunt outrun to a safe place gives back up to 75% (`refill_bp` 7500); a night's sleep (decided 10.10, not built) | the health meter; "You are full." |
| **Hunger** | removed: the food bar became health (8.10); the drain stopped (11.10) | 0 (the forbidden pattern "Hunger clock") | none | none | none |
| **Stamina** | an attribute, not a bar | none | +20 to the health cap a point | race profile and pips | the stats panel |
| **Sleep, fatigue** | no fatigue. Sleep decided, not built: in one's own valley, sleeping in a town or at a burning camp after 20:00 moves the clock to 05:00 and restores health; in a shared world nobody skips the night and a game hour's rest by a fire restores health (10.10); the inn's bed and a pitched tent give a full night (23.10) | none | the night itself is the pressure: the hazards hunt from 20:00 to 05:00 outside a safe place (G30) | an inn, a tent, a fire | the countdown to nightfall, the warning box (G31) |
| **Fire** | built (G48) | a log lasts `fire.log_ms` 100,000 ms of game time, two game hours, shortened by `burn_pct_per_d` 50 per danger step; holds `cap` 3 logs; burns only while the player is in the valley; weather never touches it | safe within `safe_tiles` 1 while it burns; warns `warn_min` 30 game minutes before it goes out; the long night's `tend` step is a fire kept dusk to dawn | logs, by hand | four flame stages; the dimming fire |
| **Cold, warmth** | none. The schema lists climates (`temperate`, `dry`, `cold`, `wet`); the valley is temperate (autumn and winter, overcast; snow only a rare winter day in the hills, NATURE 10.2); `climates.json` is not built; the cold climate's winter weather is weighted snow 40 (NATURE 4) | none | none; the south's "cold and food on the long way" (25.10) has no mechanism yet | none | none |
| **Dark** | built (`params.light`) | the hour | dark 20:00-05:00 with dusk and dawn ramps; the lantern is a sign, it keeps nothing off (G31) | a torch (the 25.10 readiness) | the tint, the lantern |
| **Thirst, sanity, energy** | none | | | | |

The day is `day_length_ms` 1,200,000: **twenty real minutes, so a game hour is 50 real seconds**, Minecraft's day. Game ticks stop while the player is away (G28), and in the shared world one `resume` shifts every field that counts the player's own elapsed time (DECISIONS 2026-10-20, PRESENCE option A).

## 2. The reference games, read

Numbers from the games' wikis (sources at the foot; each wiki's own figures, cross-checked where two pages disagree, and flagged where they still do). "Real" converts at each game's own timescale.

**The Elder Scrolls V: Skyrim, Survival Mode** (opt-in; can be turned off, state kept). A game hour is 3 real minutes. *Hunger* 0-1000, +31 a game hour (about 10 a real minute): Well Fed (stamina regen +10%), Satisfied, Peckish (160), Hungry (340), Famished (520), Starving (770); slower attacks and weaker blocks, a lower stamina ceiling; never lethal. *Fatigue* 0-960, +19 a game hour: Refreshed, Drained (160), Tired (340), Weary (560), Debilitated (800); magicka and stamina regen −25% to −100%; sleep removes 120 an hour, outdoors never below Drained. *Cold* 0-1000, a place's ColdLevel (warm 0, cool 3, freezing 6; night +1 to +4, rain +3, snow +6, blizzard +10, freezing water 30); cooling per tick `3.13 × ColdLevel × (1 − 0.85 × warmth / 206)`, so full warmth cuts it by 85%; warming 40 a tick, 75 by a fire; each place has an equilibrium, and only the worst places (a blizzard, a freezing night in snow) can kill. Ladder: Warm (a small bonus), Comfortable, Chilly (120), Very Cold (300), Freezing (500), Numb (800); slower walking, a lower health ceiling. *Warmth* by piece (head, body, hands, feet in three grades, body 17/27/54), a torch +50, hot soup −200 cold and +25 warmth for 300 s; races differ (Nord +25). *Rested* +5% skill experience, Well Rested (own bed) +10%, Lover's Comfort +15%, for 8 game hours.

**Fallout 4, Survival; Fallout: New Vegas, Hardcore** (both opt-in). FO4's game hour is 3 real minutes: hunger and thirst fall 4 points an awake hour, stages from Peckish (about 6 h) to Starving (about 36 h) and Parched to Severely Dehydrated (45 h), each stage cutting S.P.E.C.I.A.L. points; damage stops at 20 health, so never lethal. Sleep: Well Rested, Rested, Tired, Overtired, Weary, Exhausted, Incapacitated, a step every 14 game hours (42 real minutes), action points −5% to −75%; a sleeping bag gives at most 3 hours. Well Rested (7 h in a bed) +2 endurance, +2 agility, +10% experience; Lover's Embrace +15%. New Vegas: a game hour is 2 real minutes; thirst (about 12 a game hour), hunger (about 5) and sleep (about 2.4) on 0-1000 scales with effects at 200/400/600/800 and death at 1000; Well Rested +10% experience for 12 h. (The wikis' hourly rates and their "days to death" disagree; flagged.)

**The Long Dark** (a survival simulation; Pilgrim is its gentle mode). A game hour is about 5 real minutes. *Calories* store 0-2500, burned by what the player does: 75 an hour asleep, 125 standing, 200 walking, 400 sprinting, 250 harvesting. *Thirst* empties in 8 h awake. *Fatigue* by effort. At zero a need drains condition slowly (warmth 18.75% an hour, thirst 2%, hunger and fatigue 1%), and condition comes back only while all four are above zero. *Warmth* follows a "feels like" temperature (air + wind chill + clothing + heat sources): above 0 °C the bar fills, below it empties, from 15 h at −1 °C to 30 min at −30 °C. Clothing per piece in degrees, wind-proofing and water-proofing (a wool toque +2.0 °C, an expedition parka +4.0 °C and +6.0 windproof); wet clothing loses its wind-proofing and then freezes. Fires up to +80 °C heat, fuel from 7.5 min (a stick) to 2 h (a firelog); a bedroll +12 °C asleep. Hot food: "Warming Up" halves warmth loss for 45-60 minutes.

**Valheim** (no hunger penalty: starvation is not possible). A day is 30 real minutes. Food is three slots, each meal adding to maximum health and stamina and to health regeneration for 10-50 real minutes, fading as it ends; nothing hurts when the slots are empty, the player is only weak. *Rested* (by a fire under a roof): health regen +50%, stamina regen +100%, skill experience +50%, lasting 7 minutes plus one a comfort level (about 29 at the top). *Cold* (night outdoors, the mountains) halves health regen and cuts stamina regen; *Freezing* (the mountains) stops health regen and takes 1 health a second; *Wet* (rain, 120 s after) cuts regen and blocks Rested. Frost resistance from one piece (a wolf cape) or a mead removes cold; a fire removes it at once.

**Red Dead Redemption 2.** A day is 48 real minutes. Three cores (health, stamina, Dead Eye) empty in about 90 real minutes, slower at the right weight or mounted, not at all in camp; a fuller core refills its bar faster, an empty one stops natural refill. Food and tonics fill cores; any sleep fills all of them; a fortified core does not drain for 12-48 minutes. Too hot or too cold drains the health core ten times faster. Clothing warmth 1-4 a piece; an outfit's total suits the region (0-2 hot, 3 mild, 4+ cold). Weight 0-20 moves damage taken and stamina drain a little. No death from hunger.

**Don't Starve.** A day is 8 real minutes. Hunger 150 falls 75 a day; at 0 health falls 1.25 a second. Sanity 200 falls at dusk, at night and in caves; below 15% shadow creatures attack. Body temperature: freezing below 0°, overheating above 70°, both 1.25 health a second; insulation slows cooling (winter hat 120, puffy vest 240). A penalty game with no bonus for being kept well.

**Minecraft.** A day is 20 real minutes, as ours. Hunger 0-20 with hidden saturation, spent **only by effort**: 4.0 exhaustion takes a point, sprinting 0.1 a block, a jump 0.05, mining 0.005 a block, healing 6.0 a health point; walking costs nothing. At 18 or more health regenerates (1 a 4 s); at 6 or less no sprinting; starvation stops at 10 health on Easy and 1 on Normal and kills only on Hard; Peaceful has no hunger. Food gives hunger and saturation (a steak 8 and 12.8, bread 5 and 6).

**Stardew Valley; Old School RuneScape.** Stardew's day is about 14 real minutes (a game hour 42 s, time paused in menus): energy 270 is an action budget (a tool swing 2, less with skill; fishing 8), with no drain by the clock; at 0 the farmer is sluggish, at 2:00 they pass out wherever they stand, and late nights refill less. RuneScape's run energy drains only while running (faster with weight, slower with Agility) and refills while walking; nothing runs while logged out.

## 3. The cross table

Our clocks across, the games down the side would not fit a phone; so the rows are the clocks and the columns the games. "Opt" marks a clock that lives only in an opt-in mode.

| Clock | Openfold today | Skyrim (Survival, opt) | Fallout 4 / New Vegas (opt) | The Long Dark | Valheim | RDR2 | Don't Starve | Minecraft | Stardew / RuneScape |
|---|---|---|---|---|---|---|---|---|---|
| Health | the one bar; no drain; food heals | no natural regen | aid heals 10x slower | condition; heals only when all needs are up | regen from food | cores feed bars | 1.25/s at any zero | regen at 18+ hunger | none / none |
| Hunger | none (G32) | 0-1000 by the hour; never lethal | by the hour; FO4 never lethal, FNV lethal | calories by effort; slow drain at 0 | none; food is a buff | cores, 90 min; never lethal | 75 a day; lethal | by effort only; capped by difficulty | none / none |
| Thirst | none | none | by the hour | 8 h | none | none | none | none | none / none |
| Fatigue | none; the night hunts | 0-960; regen cuts | 14 h a step; FNV lethal | by effort | none | sleep fills cores | sanity at night | none | 2:00 pass-out / none |
| Cold | none | place level x (1 − 0.85 warmth); equilibrium; lethal only in the worst places | none | feels-like °C; fast at zero | a biome's state; regen cuts, 1/s freezing | drains health core 10x | 0° and 70°, 1.25/s | none | none / none |
| Clothing | worn effects (work speed); looks count nothing | warmth by slot and grade | none for cold | °C, windproof, wet | one frost-resistant piece | warmth 1-4 a piece | insulation | none | none / weight |
| Fire | the safe place; warns; logs by hand | a heat source, warms 75 a tick | none | heat and fuel | removes cold; Rested | camp | the night's light; warms | none | none / none |
| Food's work | heals | hunger; hot soup warms | hunger, buffs while fed | calories; hot food warms | max health and stamina, regen | cores, weight | hunger, sanity | hunger and saturation | energy / none |
| Well kept | none | Well Fed, Warm, Rested (+5-15% exp) | Well Rested (+10% exp) | soft | Rested (+50% exp, regen) | fortified cores | none | fast regen | none / none |
| Clock | game hour | game hour (3 real min) | game hour (3 or 2 real min) | game hour (5 real min) | real seconds | real minutes | real time (8-min day) | effort | action / effort |
| While away | nothing runs (G28) | paused | paused | paused | Rested lost at logout | paused | paused | paused | paused / nothing |

## 4. What the games agree on

1. **Hard needs are a choice in the big role-playing games.** Skyrim and both Fallouts ship no hunger, thirst, tiredness or cold in their ordinary game; their survival modes are opt-in and can be left. The games that keep needs always on are survival simulations (The Long Dark, Don't Starve) or soften them into bonuses (Valheim, Red Dead Redemption 2, Minecraft).
2. **The kind games turn a need into a bonus.** Valheim's food raises the ceiling and nothing hurts when it lapses; Red Dead's cores only change how fast bars refill; Minecraft's reward for a full bar is fast healing. "Well kept" is felt as a gain, "neglected" as the absence of it.
3. **Hunger by effort, not by the clock,** where it is kept without opt-in: Minecraft spends it only on effort (walking is free), The Long Dark burns calories by what the player does, Stardew's energy is spent per swing. A clock that empties while the player stands still is the hardcore form.
4. **Cold is a place.** Skyrim's ColdLevel, Valheim's biomes, The Long Dark's temperature, Red Dead's regions: the body only cools where the world is cold, and the night and the weather add to it.
5. **Clothing decides where the body settles, not how often to top it up.** Skyrim's warmth cuts cooling by up to 85% and gives each place an equilibrium; Valheim's one frost-resistant piece removes cold; Red Dead's outfit total is matched to the region. Dressing for a place is an answer, once.
6. **The fire resets cold, and a hot meal carries warmth away from it** (Skyrim's hot soup, The Long Dark's Warming Up).
7. **Rest is a bonus.** Skyrim, both Fallouts and Valheim reward a night slept (mostly with experience, Valheim also with regeneration).
8. **Nothing runs while the player is away**, in every one of them; where a buff ends at logout (Valheim's Rested) it is a lost bonus, not a loss.
9. **The scale is real time, not game time.** Skyrim's rates per game hour, copied to a 20-minute day, would run 3.6 times faster in real minutes (its game hour is 3 real minutes, ours 50 s); every rate below is set in real minutes first and written in game hours after.

## 5. Harsh places (Q8, Q8a)

### 5.1 The model in one line

Two bars, health and experience, and nothing else on the body. A place carries **conditions** at a **harsh grade**; an unanswered grade slows walking and work and takes health; a garment's **trait** answers one condition by its tier, and a dish adds one step. Leaving the place, or a safe place, ends it.

### 5.2 The ladder (closed, proposed)

The drain is a **number of points per game hour, counted on the base cap of 100** (balance findings 9 and 10, accepted 26.10), the same for every player: a bigger health cap (100 + 20 a point of stamina, and the health ceiling's raisers) is more points to lose, so health buys time in a place, and what stops the drain is the answer worn and eaten. `sustain` and the dish's `regen` are counted in the same points. Shown per real second, and as the time from full to zero for a new player (cap 100) and a mid one (stamina 5, cap 200); a game hour is 50 real seconds.

| Grade | Name | Walk x | Work x | Drain, points of the base cap a game hour | A second, any player | New (100), bare, full to zero | Mid (200), bare, full to zero |
|---|---|---|---|---|---|---|---|
| 0 | calm | 1.0 | 1.0 | none | none | never | never |
| 1 | rough | 1.15 | 1.15 | 10 | 0.2 (a point every 5 s) | 10 game hours, **8 min 20 s** | 16 min 40 s |
| 2 | severe | 1.3 | 1.3 | 35 | 0.7 | 2.9 game hours, 2 min 23 s | 4 min 46 s |
| 3 | extreme | 1.5 | 1.5 | 60 | 1.2 | 1.7 game hours, 1 min 23 s | 2 min 47 s |
| 4 | deadly | 2.0 | 2.0 | 100 | 2 | 1 game hour, 50 s | 1 min 40 s |

Calm snow is grade 1: a new player in it with nothing on loses a point every five seconds and has a little over eight minutes from full, the owner's "tolerable for a few real minutes" (the first draft's 20 gave four minutes, short for the gentlest grade). Grade 4 is for one or two places at the end of the long way only, and still never a door (P3): a bare player can step in for fifty seconds and back out.

The slow is on the step (`walk_step_ms` x the grade's walk) and on every work time (as `hp_low_pct`'s x1.5 is); the two multiply when both apply. The drain is counted in the kernel per game millisecond in integer basis points with the remainder carried, so it is exact and replayable.

### 5.3 Times with an answer

The strength `s` of the answer lowers the grade: remaining = max(0, grade - s). Fully cancelled when `s` meets the grade, one grade down when it is one short, and so on.

| Grade | Bare | New, tier 1-2 trait (s 1) | Mid, tier 3-4 trait (s 2) | Mid + a matching dish (s 3) | Late, tier 5 trait (s 3) | Late + dish or a master piece (s 4) |
|---|---|---|---|---|---|---|
| 1 rough | 8 min 20 s | none | none | none | none | none |
| 2 severe | 2 min 23 s | 8 min 20 s (as grade 1) | none | none | none | none |
| 3 extreme | 1 min 23 s | 2 min 23 s | 8 min 20 s | none | none | none |
| 4 deadly | 50 s | 1 min 23 s | 2 min 23 s | 8 min 20 s | 8 min 20 s | none |

A dish's "health back over time" (section 7) stretches a time: at tier 3 (4 points a game hour) grade 1 bare goes from 8 min 20 s to 13 min 53 s (a new player). Food eaten heals in points, as today. While a place drains, all health back, food eaten included, comes in at most at the `sustain` ceiling of the wearer's band (PROGRESSION 4.7: 5 to 15 points of the base cap a game hour); outside a draining place a meal heals at once, as built. A `regen` or `mend` dish adds +2 on top of the ceiling while it lasts, inside the room a `sustain` raiser gives (balance finding 11, accepted 26.10), so those dishes still count in a place after carried food has brought `sustain` to the ceiling. So no place is eaten through: below the drain, food only stretches the time.

### 5.4 Conditions and where a grade comes from (closed, proposed)

| Condition | What it is | Where |
|---|---|---|
| `frost` | biting cold | cold climate: the north's heights; +1 at night (20:00-05:00) |
| `deep_snow` | snow above the boot | cold climate on a snow day; +1 from noon (snow deepens over the day) |
| `storm` | wind and driving rain or sleet | wet and cold climates on a storm day (+1); exposed heights |
| `ice` | footing that slides | frozen water, glacier, rime on rock in the cold |
| `heat` | sun and dry heat | dry climate, 11:00-16:00 |

- A region of the map plan declares a base grade per condition (`conditions?: { frost: 1, deep_snow: 2 }`), and `climates.json` (NATURE step 3, not built) carries the night, noon and weather steps per climate. The hour and the day's weather move a grade within the region's own cap.
- A grade is never above the area's danger level `d`, the one integer scale that rates areas (decisions 3.10 and 10.10). Ground at `d` 0 is a safe place (G30) and is never harsh; the valley (temperate, `d` 0 in the opening) stays calm, and its storm and snow are look and sound only.
- Several conditions at once: each is answered on its own, and the **highest remaining grade** gives the slow and the drain. They never add.
- Weather never touches a fire (G48); a fire's safe tiles are a safe place (G30), where the drain stops; the slow stays outside them.

### 5.5 Warned, never by surprise (G31, G29)

A place's card shows its conditions by sign and count (a snowflake, a gust, an icicle, a sun; one to four marks), never by colour alone (G29) and never by a percentage (decision 39). Stepping into a grade that the player's answer does not meet opens one warning box (G14) once an outing, and while health drains a countdown to zero sits at the screen's edge, where the night's countdown sits. At zero the fall of G33 applies as it is: the outing's gatherings are lost, the bag from before is kept.

### 5.6 What it does not do

No meter, no slow fill and empty, no "warm" state carried out of the place: the cost is the place's, at this moment, and ends when the player leaves it or reaches a safe place. Nothing runs while away (G28): the world waits at the hour it was left. No condition is a door (P3), and no node answers a condition (that is the garment's and the dish's). Travel never lowers a grade either: its nodes make the step itself quicker and leave the place's slow to the answer, so Travel and a garment never cancel the same slow twice (PROGRESSION 4.8, the stacking rule).

## 6. Garments and traits (Q8)

### 6.1 The trait list (closed)

| Trait | Answers | Slots it may sit on | Made by (existing schools) | Material |
|---|---|---|---|---|
| `cold_proof` | `frost` | top, back, head | Tailoring (wool, fur), Leatherwork (lined hide) | wool from the farm, fur from Hunting |
| `snow_shod` | `deep_snow` | feet | Woodcraft (snowshoes), Leatherwork (high boots) | ash and gut, hide |
| `storm_proof` | `storm` | back, top | Tailoring (oiled cloth), Leatherwork (waxed hide) | linen and oil, hide and wax |
| `ice_grip` | `ice` | feet, hands (crampons on the feet, claws in the hands) | Handcraft's Stonework (stone studs, tiers 1-2), Smithing (iron cleats, tier 3 and up; city only, decision 51) | stone, iron |
| `heat_ward` | `heat` | head, top | Tailoring (light cloth, a wide hat) | linen, reed |

### 6.2 Strength by tier

- A garment's trait strength: **1 at tiers 1-2, 2 at tiers 3-4, 3 at tier 5** (`trait_strength_by_tier`), +1 for a master piece of Tailoring's `quality_pct` roll (the quality is the lever; there is no warmth number). The strongest piece of one trait counts; two pieces of one trait never add.
- The trait follows the Q5 one-tier-ahead rule (PROGRESSION 5.6): a piece worn below its requirement counts as one tier above the wearer's own, so `s` = strength of min(piece tier, own tier + 1).
- A dish of the same condition adds +1, whatever its tier, and only one dish counts (section 7.6). The garment is the main answer, the dish the last step.
- **The ceiling**: the total, garment + master step + dish, stops at the `place` ceiling of the wearer's band (PROGRESSION 4.7: 2, 2, 3, 3, 4 for bands 1-5, the band read in Survival). There is no rule tying the answer to one grade above the wearer's tier: the end-game's harsh places are walls, proven solvable at their band and not cheesable two bands below (PROGRESSION 4.7).
- **Rarity** (common things are plain, PROGRESSION 5.7): a common garment carries one effect at most, so a common piece with a trait carries nothing else, and its trait is strength 1 at any tier (quality does not lift it); strength 2 and up needs uncommon or better. Calm snow still has an early answer: a common tier-1 wool hood (`cold_proof` 1) and common snowshoes (`snow_shod` 1) take its frost and snow at grade 1 to nothing, and a common dish sharing `cold_proof` does the same for frost.
- Every garment still carries its tree points (attribute bonuses, shown as base + gear in another colour, PROGRESSION 5.6) and its worn effects. A trait is on **some** pieces only: one trait a piece at most, set by its recipe, or added at the bench by Tailoring's `trait_sew`.
- **A trait never adds experience.** Experience stays active work time a second (PROGRESSION 3.2), so a slower step in a harsh place is the same experience a second and fewer things an hour; a harsh place never pays more.
- A look (the look layer) never carries a trait.

## 7. Food and dishes (Q8b)

### 7.1 The model in one line

Food gives health back, as today. A **cooked dish** also gives up to two **timed effects**. The effect list may grow as large as content needs (the screen explains each effect, so nothing has to be remembered); what keeps it safe is that **every effect is a closed numeric definition**, so the whole space is computable (PROGRESSION 4.7: two red lines, rising ceilings, walls proven both ways). The richness lives in the **catalogue**: many ingredients a region, each with one or two effect tags, and dishes that combine them. Finding dishes and ingredients is part of exploring (Skyrim's alchemy: about 55 effects over more than 100 ingredients; Valheim: about 40 foods, three at once).

### 7.2 The effects: each a closed numeric definition (proposed)

Every effect is one row in content with five fields, and nothing else: its **stat** (what the kernel reads), its **kind** (`flat`: adds a number; `mult`: multiplies a time or a rate, in permille; `cancel_grade`: lowers one condition's grade by whole steps), its **strength by tier** (five numbers), its **duration by tier** (the dish's, 7.5), and its **category**, one of the ceiling categories of PROGRESSION 4.7 (`work`, `move`, `health`, `sustain`, `find`, `sense`, `place`): place answers `place`, `work_*` `work`, `hp_max` `health`, `regen` and `mend` `sustain`, `find_sense` `find`, the other senses `sense`, `fleet` `move`. One kernel reader serves each kind, so a new effect is a data row, never new code, and the content check refuses a row with a stat no reader knows.

| Effect | Stat | Kind | Strength, tiers 1-5 |
|---|---|---|---|
| `cold_proof`, `snow_shod`, `storm_proof`, `ice_grip`, `heat_ward` | the grade of `frost`, `deep_snow`, `storm`, `ice`, `heat` | `cancel_grade` | 1, 1, 1, 1, 1 step |
| `work_<school>` (one per working school: Foraging, Woodcutting, Digging, Mining, Fishing, Hunting, Cooking, Handcraft, Woodcraft, Tailoring, Leatherwork, Smithing, Remedies, Tinkering) | that school's work time | `mult` | 950, 920, 880, 840, 800 permille |
| `hp_max` | the health cap | `mult` | 1050, 1100, 1150, 1200, 1250 |
| `regen` | health back a game hour, in points of the base cap | `flat` | 200, 300, 400, 500, 600 bp |
| `mend` | health from food, kits and bandages | `mult` | 1100, 1150, 1200, 1250, 1300 |
| `light_sense` | sight in the dark, tiles (the torch's light stays the item's) | `flat` | 1, 1, 2, 2, 3 |
| `find_sense` | the rare-find roll (`rare_find_pct`) | `flat` | 2, 3, 4, 5, 6 points |
| `weather_sense` | game hours of a place's coming conditions shown on its card | `flat` | 2, 3, 4, 6, 8 |
| `track_sense` | tiles at which a creature's trail shows | `flat` | 2, 3, 4, 5, 6 |
| `fleet` | `walk_step_ms` on open ground | `mult` | 950, 920, 900, 880, 850 |

27 effects today; the combat layer may add `strike`, `aim` and `guard` as `mult` rows, and later regions what their content needs, each a row of the same five fields. No row may name experience (the check refuses the stat), and none touches a hunting hazard (the wolf, the pit, the trap, deep water at night): their answer stays the run (G34).

### 7.3 Ingredients, dishes and the finding

- **An ingredient** carries its raw health (as the berry's 4 today) and **one or two effect tags**. Eaten raw it heals and does nothing more, and shows its first tag (Skyrim's first bite); its second shows the first time a dish uses it.
- **A dish** is two to four ingredients at a cooking place. Its effects are **the tags at least two of its ingredients share**, at most two (Skyrim's rule, cut to two). Each named recipe in content lists its ingredients; its effects are derived, never declared, and the content check refuses a recipe whose ingredients share fewer than one tag or more than two, so the catalogue cannot drift from the rule.
- **The finding**: the pot takes any two to four ingredients. A set that matches a recipe makes the dish and writes it into the player's cookbook; a set that matches none makes a plain stew (health only) and is remembered as tried. A Lore book or a townsperson can give a recipe, as a book gives a node (GROWTH 4.3). Cooking's `taste_read` shows tags sooner; nothing shows all of them at once.
- The dish's tier is its recipe's (the Cooking band that makes it); its health back grows with the tier as the stew's 40 does now.
- **The dish's rarity** (common things are plain, PROGRESSION 5.7): the rarest ingredient among those that carry one of its effects, capped by the cook's Cooking band (band 1 up to uncommon, bands 2-3 up to rare, bands 4-5 up to legendary; a cook below the cap still makes it, at the cap). **A dish of common ingredients only is common** and shows at most one effect, at its stat's smallest step (the tier-1 value of 7.2); an uncommon dish one effect at 50-75% of its tier's value; rare and legendary two. Where the rarity allows fewer effects than the shared tags, the tag carried by the rarer ingredients is kept, ties by the list's order. Ingredients carry the rarity of their source (the rarity budget), so a rich dish is found as its rare ingredients are.

### 7.4 The catalogue, by region (target, proposed)

| Where | Ingredients | Dishes | Tiers |
|---|---|---|---|
| The valley (the opening) | 12 | 16 | 1-2 |
| Each further region | 16-20 | 20-30 | the region's |
| The whole map at the end of the long way | 120 or more | 180 or more | 1-5 |

Spread rules for the content check: every effect sits on at least 4 ingredients in at least 2 regions; every region grows at least one ingredient carrying the place answer its own conditions call for (the answer is found near the problem, as Valheim's mountain gear comes from the mountain); a school's work effect sits mostly in the regions where the school works; no ingredient carries two place answers.

### 7.5 Duration by tier (proposed)

| Dish tier | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Lasts, game hours | 6 | 9 | 12 | 18 | 24 |
| Real time | 5 min | 7 min 30 s | 10 min | 15 min | 20 min (one day) |

Cooking's `long_simmer` lengthens a dish's time; no node adds strength beyond its tier. The card and tooltip say each effect in words and marks, never a percentage (decision 39).

### 7.6 Bounded: two at once

- **Two dish slots.** At most two dishes count at once, so at most four effects. A third dish replaces the one with less time left, and the card says which effect would end before it is eaten.
- The same effect in both slots: the **stronger counts**, never the sum. Only one dish's place answer counts (+1 step). Dish effects add with every other source of their category (nodes, worn effects, traits) and stop at the band's ceiling (PROGRESSION 4.7); no dish raises a ceiling, and no dish raises the strength of a made thing (the no-loop line).
- When `hp_max` ends, health above the cap falls to the cap; nothing else is lost. A lapsed dish is the absence of a bonus, never a penalty (the research's point 2).
- **A dish never adds experience.** Faster work in a school is the same experience a second (PROGRESSION 3.2); the mentor's +20% stays the one multiplier (3.7).
- **Regeneration and mend in a draining place** (balance finding 11): carried food brings `sustain` to the band's ceiling; a `regen` or `mend` dish adds +2 on top while it lasts, inside the room one raiser gives. It is a sum above the clamp for these two effects only, never a raised ceiling.
- What it replaces: the first draft's "Fed" is folded into the dish effects; Cooking's `meal_fill_pct` stays the health a meal gives back.

## 8. Sleep (Q8b)

Sleep saves the game and passes the night: in one's own valley, sleeping in a town or at a burning camp after 20:00 moves the clock to 05:00 (as decided, not built), and health comes back as G32 says. **No Rested bonus**: the owner dropped it. The research's games tie Rested to experience (Skyrim +5% to +15%, Fallout +10%, Valheim +50% to skills), which here would be a second multiplier on experience beside the mentor's (3.7). Sleep is never needed: there is no tiredness.

## 9. Kernel shape (proposed; additive; integer)

- Schema: `CONDITIONS` = `frost | deep_snow | storm | ice | heat`; `TRAITS` = `cold_proof | snow_shod | storm_proof | ice_grip | heat_ward` with `TRAIT_ANSWERS` (trait -> condition); `DISH_EFFECTS` (section 7.2); an item's `trait?: Trait`; a resource's `tags?: DishEffect[]` (one or two); a recipe's effects derived and checked.
- Params, `place`: `grades` = `[ {walk_pct: 100, work_pct: 100, drain_bp_h: 0}, {115, 115, 1000}, {130, 130, 3500}, {150, 150, 6000}, {200, 200, 10000} ]` (`drain_bp_h` is basis points of the base cap of 100 a game hour, the same for every cap; the params file's `grade_drain_pct` holds the same numbers in points), `trait_strength_by_tier` [1, 1, 2, 2, 3], `master_step` 1, `dish_place_step` 1, `deadly_places_max` 2. Params, `dish`: `slots` 2, `effects_max` 2, `ingredients` [2, 4], `dur_gh_by_tier` [6, 9, 12, 18, 24]. Content: `effects/*.json`, one row an effect with `stat`, `kind`, `by_tier`, `category` (7.2).
- A region of the map plan: `conditions?: { [c in Condition]?: grade }`; `climates.json` per climate: `night`, `noon`, `weather` steps per condition.
- Player: `dishes?: { effects: DishEffect[]; tier: number; until: number }[]` (at most two). No body field for places: the grade at a tile is a pure function `harshAt(bundle, tile, time, weather)`, capped by `dangerAt`, and the drain is applied on the step that moves time, as `hurt` is, only while the player is in the world.
- The move check reads the place's walk multiplier with `walk_step_ms`; work times read the work multiplier where `hp_low_pct` is read.

## 10. Against the decisions

| Rule or decision | Reading | How it is kept |
|---|---|---|
| G32 Health is the one bar | **agrees**: two bars, health and experience; no other meter | the drain and the dishes act on health only |
| G32 "Nothing drains it by the clock (G28)" | **bends** (Q8a, the owner) | the drain is the place's, never the body's: it runs only while standing in an unanswered grade, stops in a safe place, never runs while away; outside harsh places nothing drains |
| G28 No dark patterns; nothing runs while away | agrees | the world waits at the hour it was left; a lapsed dish is a missing bonus, not a loss |
| G31 Nobody falls unwarned | agrees | the card's marks, one warning box an outing, the countdown at the edge (5.5) |
| G33 The fall | agrees | at zero, as written |
| G34 "the answer is a run, never gear"; the forbidden pattern "Gear answer"; "A hazard is escaped, never answered by an item" (10.10) | **conflicts**, declared, further than before | gear (and one dish step) answers a place's condition; a hunting hazard is still answered by the run, and no trait or dish effect touches one; the rules pull request writes G34 as "a hunting hazard is answered by a run; a place's condition by what is worn and eaten" |
| G34 "Food ... heal, they do not answer a hazard" | **bends** (Q8b) | a dish answers a place's condition, one step, never a hazard |
| G29 colour is never the only signal; decision 39 no percentages | agrees | marks and words on the card (5.5, 7.5) |
| G30 one safe place; ground at `d` 0 | agrees | a grade never exceeds `d`; the drain stops in a safe place |
| G48 weather never touches a fire | agrees | weather moves a grade, never a flame |
| P3 a band gates nodes, never verbs | agrees | no grade is a door; grade 4 is enterable bare for 50 s |
| R6, 3.7 the one multiplier on experience | agrees | traits, dishes and sleep add none |
| Q5 one tier ahead | agrees | the trait reads min(piece tier, own tier + 1) |
| Common things are plain (PROGRESSION 5.7) | agrees | a common garment or dish carries one effect at most, at its smallest step; a common trait is strength 1 and still answers calm snow |
| G32 "eating is how the player heals" | **bends** (the balance answer) | inside a draining grade, health back is clamped at the `sustain` ceiling; elsewhere a meal heals at once |
| The balance answer: two red lines, rising ceilings, walls proven both ways (PROGRESSION 4.7) | agrees | dish effects never feed a made thing's strength; the `place` and `sustain` ceilings by band and the wall proofs replace the dropped "one grade above the tier" rule |
| The forbidden pattern "Hunger clock" | agrees | food is bonus and healing, never a need |

## 11. The answers (25.10)

- **Q8.** The first draft offered A (a cold clock that settles where worn warmth puts it, plus Fed and Rested as bonuses), B (A plus an opt-in hard mode) and C (no clock). The owner took none of them: **two bars only, health and experience; a place is harsh, gear answers it.** The cold track and its ladder (Warm, Cool, Cold, Freezing, Numb) and the warmth number are dropped; the research's point 4 ("cold is a place") and point 5 ("dressing for a place is an answer, once") are what the model keeps.
- **Q8a.** Harsh places slow **and** take health, graded by how dangerous the place is; the right gear cancels the cost fully or one grade down (section 5).
- **Q8b.** Food heals, and cooked dishes give timed effects from a closed list, with a huge catalogue of ingredients and dishes; one or two effects at once; never experience. Sleep saves and passes the night only: the Rested bonus is dropped, and Fed is folded into the dish effects (sections 7-8).

## Sources

- The Elder Scrolls V: Skyrim, Survival Mode (Bethesda, 2017; Creation Club): https://en.uesp.net/wiki/Skyrim:Survival_Mode, https://en.uesp.net/wiki/Skyrim:Hunger, https://en.uesp.net/wiki/Skyrim:Fatigue, https://en.uesp.net/wiki/Skyrim:Cold, https://en.uesp.net/wiki/Skyrim:Sleeping. Flagged: the hours to clear full fatigue (8 by the rate, 11 by the page) and Well Rested's length in Survival.
- Fallout 4 Survival and Fallout: New Vegas Hardcore (Bethesda, Obsidian): https://fallout.fandom.com/wiki/Survival_mode, https://fallout.fandom.com/wiki/Hunger, https://fallout.fandom.com/wiki/Thirst, https://fallout.fandom.com/wiki/Resting, https://fallout.fandom.com/wiki/Well_Rested, https://fallout.fandom.com/wiki/Lover%27s_Embrace, https://fallout.fandom.com/wiki/Hardcore_mode, https://fallout.fandom.com/wiki/Starvation, https://fallout.fandom.com/wiki/Dehydration. Flagged: hourly rates against "days to death".
- The Long Dark (Hinterland): https://thelongdark.fandom.com/wiki/Hunger, https://thelongdark.fandom.com/wiki/Thirst, https://thelongdark.fandom.com/wiki/Fatigue, https://thelongdark.fandom.com/wiki/Condition, https://thelongdark.fandom.com/wiki/Feels_Like, https://thelongdark.fandom.com/wiki/Warmth, https://thelongdark.fandom.com/wiki/Fire, https://thelongdark.fandom.com/wiki/Clothing, https://thelongdark.fandom.com/wiki/Warming_Up. Flagged: the fuels' heat values.
- The Elder Scrolls V: Skyrim, alchemy: https://en.uesp.net/wiki/Skyrim:Alchemy, https://en.uesp.net/wiki/Skyrim:Ingredients.
- The Skyrim restoration loop: https://en.uesp.net/wiki/Skyrim:Fortify_Restoration. Raised resistance caps: https://www.poewiki.net/wiki/Resistance (Path of Exile, 75% and up to 90%), https://diablo2.diablowiki.net/Resistances (Diablo II, 75% and items that raise the maximum).
- Valheim (Iron Gate): https://valheim.fandom.com/wiki/Food, https://valheim.fandom.com/wiki/Rested, https://valheim.fandom.com/wiki/Comfort, https://valheim.fandom.com/wiki/Cold, https://valheim.fandom.com/wiki/Freezing, https://valheim.fandom.com/wiki/Wet, https://valheim.fandom.com/wiki/Frost_resistance_mead.
- Red Dead Redemption 2 (Rockstar): https://reddeadredemption.fandom.com/wiki/Core, https://reddeadredemption.fandom.com/wiki/Conditions_in_Redemption_2, https://reddeadredemption.fandom.com/wiki/Weather_in_Redemption_2, https://reddeadredemption.fandom.com/wiki/Sleeping.
- Don't Starve (Klei): https://dontstarve.fandom.com/wiki/Hunger, https://dontstarve.fandom.com/wiki/Sanity, https://dontstarve.fandom.com/wiki/Freezing, https://dontstarve.fandom.com/wiki/Winter_Hat, https://dontstarve.fandom.com/wiki/Puffy_Vest, https://dontstarve.fandom.com/wiki/Day-Night_Cycle.
- Minecraft (Mojang): https://minecraft.wiki/w/Food, https://minecraft.wiki/w/Daylight_cycle.
- Stardew Valley (ConcernedApe): https://stardewvalleywiki.com/Energy, https://stardewvalleywiki.com/Day_Cycle; Old School RuneScape (Jagex): https://oldschool.runescape.wiki/w/Energy.
