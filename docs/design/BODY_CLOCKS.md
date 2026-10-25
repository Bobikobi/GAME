# Body clocks: what the big games keep, what Openfold keeps, and the call (2026-10-25)

The owner, 25.10, on the progression map's Q8: align the body clocks with the big games; research and cross-check before deciding. This page reads every body clock and need the game has on `origin/develop`, reads the reference games' clocks with their published numbers, crosses the two, and recommends one aligned set. It decides nothing: Q8 is the owner's, at the end (section 8), with options and a recommended default.

Its entry: DECISIONS 2026-10-25 ⏸ "Body clocks: the research for Q8". Its parent: [PROGRESSION.md](PROGRESSION.md) section 4.5 and Q8. Design only: no schema, kernel, content, parameter or screen changes with it. Every number in sections 5 and 6 is **proposed**.

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

## 5. The recommended set for Openfold (Q8 option A, proposed)

### 5.1 The set in one line

Health stays the one bar. One clock is added, **cold**, and it runs only in cold places. Two **bonuses** are added for being well kept, **Fed** and **Rested**; neither has a penalty side. Hunger, thirst, tiredness, sanity and an energy bar are not added. Combat's breath (Guard reads stamina, PROGRESSION 4.2) is COMBAT's to write and is read only in a fight.

### 5.2 Cold: a place clock that settles

```
chill(place, hour, weather)  = climate_chill[climate]     temperate 0, wet 0, dry 0, cold 2
                             + 1 at night (20:00-05:00, the dark the world already keeps)
                             + 1 in rain or snow, + 1 standing in water
                             clamped to 0..chill_max (4); temperate clamped to temperate_chill_max (1)
                             a region of the map plan may declare its own (the south's heights)
target(chill, warmth)        = chill * 250 * (1000 - 850 * min(warmth, warmth_max) / warmth_max) / 1000
cold moves toward target     up   cold_rise_per_hour  150 * (100 - cold_pct) / 100       (Survival's node)
                             down cold_fall_per_hour  300
                             at a burning fire within its safe tiles, an inn, a pitched tent or in a town:
                             down cold_fire_per_hour 1200, and the target is 0
```

Kept lazily, as health is: the kernel brings `cold` up to the step's tick by walking the boundaries in between (dusk, dawn, a day's weather), each a pure function of the tick and the seed, so the server replays it and nothing runs off screen (R1).

| Cold | Word on screen | What it does |
|---|---|---|
| 0-99 | Warm | nothing; the chip shows it by a fire |
| 100-299 | Cool | nothing |
| 300-599 | Cold | work takes 1.25 times as long |
| 600-899 | Freezing | work takes 1.5 times as long, walking 1.25; one warning box when it begins (G31) |
| 900-1000 | Numb | as Freezing, and health falls `numb_harm_permille` 100 of the cap a game hour; zero is a fall (G33) |

What the numbers give, against our short day (a game hour is 50 real seconds). A bare player in the worst place (a cold climate's snowy night, chill 4) is Cold after 2 game hours (1.7 real minutes), Freezing after 4 (3.3 min), Numb after 6 (5 min), and falls about 8 minutes later: some 13 real minutes of neglect, after a warning, which sits between Skyrim (Freezing in about 6 real minutes) and The Long Dark (an empty warmth bar in about 5). The same player on a cold climate's clear night (chill 3) settles at Freezing and is never hurt; by day (chill 2) at Cold. A temperate night never passes Cool, so the valley the game opens in has no cold clock to speak of. A full warm outfit (warmth 100) settles even the snowy night at 150, Cool. A fire takes Numb to Warm inside a game hour.

**Warmth.** A worn piece's `warmth` = the slot's share x the class's factor x the tier's factor. Shares: top 30, legs 20, head 15, feet 15, back 20 (a cloak; the back slot of 23.10), so a full set is `warmth_max` 100. Class: cloth and fur 1.0, leather 0.7, mail 0.3, plate 0.2 (the race answer's "a weakness matched by an advantage" in a thing: plate turns blows and is cold). Tier: 0.4, 0.7, 1.0 for tiers 1-3, the cap. Tailoring's `warmth_pct` and the quality roll move a piece inside its tier, as worn effects move (PROGRESSION 5.2); fur comes from Hunting. A warm piece names Survival in its wear requirement (PROGRESSION 5.6). A **warm meal** (Cooking's `warm_meal`, a hot dish eaten) takes 200 off at once and adds 25 warmth for 3 game hours (Skyrim's hot soup, The Long Dark's Warming Up). Weather never touches a fire (G48): rain chills the player, never the flame. A race wing may carry a step of chill (Skyrim's Nords resist cold, its Argonians chill faster); the race pages decide that, not this one.

### 5.3 Fed: the meal as a bonus

A cooked meal (kind `food`, class `meal`) makes the player **Fed** for `fed_hours` by the meal's tier, proposed 8, 12, 16 game hours (about 7, 10, 13 real minutes; Valheim's meals last 10-50). Fed raises the health cap by `fed_cap_pct` 20 while it lasts, so food and rest fill higher. One meal counts at a time: a better one replaces, the same one refreshes; Survival's `fed_long` and Cooking's `meal_keeps` lengthen it. When Fed ends the cap returns, and health above it stays until something takes it: nothing drains by the clock (G32). Raw food heals and does not feed. Eating is still how the player heals (G32), and `meal_fill_pct` still sizes the heal.

### 5.4 Rested: the night as a bonus

A night slept makes the player **Rested** until the next dusk (20:00): in one's own valley, the sleep of 10.10 (20:00 to 05:00 at a town or a burning camp); in a shared world, the game hour's rest of 10.10 after dusk at an inn's bed, a pitched tent or one's own burning fire; and a return after logging out at any of these (a return is rewarded, G28; World of Warcraft's rested state is the nearest). Rested makes work take `rested_work_pct` 5% less time, a rate under the power cap with everything else (R9). It never touches experience: the group rule's +20% is the one multiplier on experience (PROGRESSION 3.7), and Skyrim's, Fallout's and Valheim's experience bonuses are the one part of their rest this set does not copy. A later house or inn room may add comfort steps (Valheim's comfort), never a penalty for sleeping rough.

### 5.5 Why nothing else

- **Hunger** stays out (G32, 11.10). If it is ever wanted, the form the big games prove is Minecraft's: spent by effort, never by the clock, and never below neutral; that is option B's opt-in shape, not A's.
- **Tiredness** stays out: the night already is the clock that sends a player to a fire, an inn or a tent (G30), and a second clock pulling the same way would be the nag.
- **Thirst** is kept only by Fallout and The Long Dark, the two hardest; **sanity** by Don't Starve, and the dark's menace is already the predators' (G30); an **energy** budget (Stardew) would ration play against "a return is rewarded".

### 5.6 How it avoids nagging

1. No clock runs in a safe place, in the temperate valley past Cool, or while the player is away; every field shifts on `resume`.
2. Cold settles: a player dressed for a place never climbs past where warmth puts them, so the answer is made once, by Tailoring, not repeated by a timer.
3. Fed and Rested lapse to neutral, never below it.
4. One chip, shown only when the body is not neutral (G3's spirit and the "Empty tab" pattern): the cold word, a small meal mark while Fed, a small moon while Rested. Words and marks, never numbers or percentages (decision 39); the frost edge at Freezing has a shape as well as a colour (G29) and holds still under reduced motion.
5. Harm comes only at Numb, only after the Freezing warning (G31), and only in the worst places.
6. Nothing is spent to stay warm but a fire's logs, already the night's price; clothing never wears out (9.10).

## 6. Kernel shape, if A (proposed; additive; integer)

- `Player.cold?`, `Player.coldAt?` (lazy, as health), `Player.fedUntil?`, `Player.fedCap?`, `Player.restedUntil?`, `Player.warmUntil?`; all shifted by `resume`, so "The world's hour is the server's clock" (20.10) grows its list of shifted fields, as its own Retry-when foresaw.
- Items: `warmth` on a worn piece (an integer, beside `effects`), `warm?: true` on a hot meal.
- Regions: `chill?` on a region of the map plan; `climates.json` (NATURE step 3) carries `chill` per climate.
- Actions: the sleep action of 10.10 when it lands sets `restedUntil`; `eat` sets Fed for a meal; no new action for cold.
- Events: `cold` when the word changes; `fed`, `rested` when a bonus begins or ends.
- Params (`body`): `climate_chill`, `chill_max` (4), `temperate_chill_max` (1), `chill_step` (250), `warmth_max` (100), `warmth_relief_permille` (850), `cold_rise_per_hour` (150), `cold_fall_per_hour` (300), `cold_fire_per_hour` (1200), `cold_steps` [100, 300, 600, 900], `cold_work_pct` [0, 0, 25, 50, 50], `numb_harm_permille` (100), `warm_meal_drop` (200), `warm_meal_warmth` (25), `warm_meal_hours` (3), `fed_hours` [8, 12, 16], `fed_cap_pct` (20), `rested_work_pct` (5); each with min, max and step (R12), and each names its clock (the game hour, 10.10).
- Checks: the reference player (9.10) is neither Fed nor Rested nor dressed; a worn piece's warmth never passes its slot's share; a temperate region never declares a chill above `temperate_chill_max`.

## 7. Against the decisions

| Draft rule (option A) | Decision | Verdict | Note |
|---|---|---|---|
| Health stays the one bar; Fed and Rested are bonuses | G32 "Health is the one bar" (8.10, 11.10) | agrees | no second bar; Fed raises the cap and never clips health |
| No bar empties by the clock in the valley | the forbidden pattern "Hunger clock"; G28 | agrees | cold runs only in cold places and settles; option B would conflict and needs the rule rewritten for its mode |
| Nothing runs while away; fields shift on `resume` | G28; "The world's hour is the server's clock" (20.10) | agrees | its Retry-when named "a resumed player's fire or hunger"; the list grows |
| Clothing and a fire answer cold | G34 "the answer is a run, never gear"; the forbidden pattern "Gear answer" | **conflicts** | declared; already bent by "The night ruins are revived" (25.10: readiness is made: a torch, clothing, cooked food, climbing gear); the rules pull request writes G34 as "a hunting hazard is answered by a run; a place's clock by readiness" |
| A warning before cold can harm | G31 "Nobody falls unwarned" | agrees | the Freezing box, once a night |
| Numb's health loss can end in a fall | G33 | agrees | a fall like deep water's; the outing's cost as written |
| Rain chills the player, never the fire; nothing makes a fire burn longer | G48 (19.10: weather never touches a fire) | agrees | |
| Rested speeds work | "The world and its clocks: nothing shortens a wait" (10.10); R9 | agrees | a rate on active time under the power cap; no wait, respawn or night moves |
| Rested rides on the night's sleep and the tent | "The world and its clocks: sleep" (10.10); "The tent comes back as a portable inn" (23.10); "A campfire is the safe way to log out" (23.10) | agrees | |
| A sleeper in the open | "Logging out with no fire, tent or inn leaves the character asleep in the world" (23.10) | agrees | the sleeper's clocks stop with the player's; what harms a sleeper is the combat wave's |
| The valley stays at Cool at worst | NATURE 10.2 (the valley is temperate; snow a rare winter day in the hills) | agrees | `temperate_chill_max` 1 |
| No experience from the body | the group rule's +20% (Q7, 25.10); R6 | agrees | the one multiplier stays one |
| Cold gives Tailoring and Survival their work | "The night ruins are revived" (25.10: "cold and food on the long way"); PROGRESSION 4.2 | agrees | `warmth_pct`, `cold_pct`, `warm_meal`, `fed_long` |
| Every parameter names its clock | "The world and its clocks: three clocks" (10.10) | agrees | all on the game hour; the 10.10 "three clocks" are time bases, not body clocks |
| No percentage on screen | decision 39 (22.10) | agrees | words and marks |

## 8. Q8: the call

Asked as one question: **how should the body clocks work?**

- **A** (**recommended**): cold only, and only in cold places; it settles where worn warmth puts it and a fire resets it. Two bonuses for being well kept, never a penalty for not: Fed after a cooked meal (a higher health cap for a while) and Rested after a night slept (a little faster work until dusk). No hunger, thirst or tiredness bar. Aligned with Skyrim and Fallout outside their opt-in modes and with Valheim inside a cold biome; gives Tailoring, Survival, Cooking and the fire their work on the long way; keeps G32 and needs only G34 rewritten for places.
- **B**: A, plus an opt-in hard mode per character with hunger and tiredness that drain while playing and stage penalties (Skyrim's Survival Mode, Fallout 4's Survival, New Vegas Hardcore). Needs G32 and "Hunger clock" rewritten for that mode, and a second balance of everything food and sleep touch.
- **C**: no clock: cold stays a place's hazard escaped by a fire, as today; clothing's warmth is a look and a small percentage, and Tailoring and Survival lose their reason in the south.

## Sources

- The Elder Scrolls V: Skyrim, Survival Mode (Bethesda, 2017; Creation Club): https://en.uesp.net/wiki/Skyrim:Survival_Mode, https://en.uesp.net/wiki/Skyrim:Hunger, https://en.uesp.net/wiki/Skyrim:Fatigue, https://en.uesp.net/wiki/Skyrim:Cold, https://en.uesp.net/wiki/Skyrim:Sleeping. Flagged: the hours to clear full fatigue (8 by the rate, 11 by the page) and Well Rested's length in Survival.
- Fallout 4 Survival and Fallout: New Vegas Hardcore (Bethesda, Obsidian): https://fallout.fandom.com/wiki/Survival_mode, https://fallout.fandom.com/wiki/Hunger, https://fallout.fandom.com/wiki/Thirst, https://fallout.fandom.com/wiki/Resting, https://fallout.fandom.com/wiki/Well_Rested, https://fallout.fandom.com/wiki/Lover%27s_Embrace, https://fallout.fandom.com/wiki/Hardcore_mode, https://fallout.fandom.com/wiki/Starvation, https://fallout.fandom.com/wiki/Dehydration. Flagged: hourly rates against "days to death".
- The Long Dark (Hinterland): https://thelongdark.fandom.com/wiki/Hunger, https://thelongdark.fandom.com/wiki/Thirst, https://thelongdark.fandom.com/wiki/Fatigue, https://thelongdark.fandom.com/wiki/Condition, https://thelongdark.fandom.com/wiki/Feels_Like, https://thelongdark.fandom.com/wiki/Warmth, https://thelongdark.fandom.com/wiki/Fire, https://thelongdark.fandom.com/wiki/Clothing, https://thelongdark.fandom.com/wiki/Warming_Up. Flagged: the fuels' heat values.
- Valheim (Iron Gate): https://valheim.fandom.com/wiki/Food, https://valheim.fandom.com/wiki/Rested, https://valheim.fandom.com/wiki/Comfort, https://valheim.fandom.com/wiki/Cold, https://valheim.fandom.com/wiki/Freezing, https://valheim.fandom.com/wiki/Wet, https://valheim.fandom.com/wiki/Frost_resistance_mead.
- Red Dead Redemption 2 (Rockstar): https://reddeadredemption.fandom.com/wiki/Core, https://reddeadredemption.fandom.com/wiki/Conditions_in_Redemption_2, https://reddeadredemption.fandom.com/wiki/Weather_in_Redemption_2, https://reddeadredemption.fandom.com/wiki/Sleeping.
- Don't Starve (Klei): https://dontstarve.fandom.com/wiki/Hunger, https://dontstarve.fandom.com/wiki/Sanity, https://dontstarve.fandom.com/wiki/Freezing, https://dontstarve.fandom.com/wiki/Winter_Hat, https://dontstarve.fandom.com/wiki/Puffy_Vest, https://dontstarve.fandom.com/wiki/Day-Night_Cycle.
- Minecraft (Mojang): https://minecraft.wiki/w/Food, https://minecraft.wiki/w/Daylight_cycle.
- Stardew Valley (ConcernedApe): https://stardewvalleywiki.com/Energy, https://stardewvalleywiki.com/Day_Cycle; Old School RuneScape (Jagex): https://oldschool.runescape.wiki/w/Energy.
