# The sea crossing as a passage: how games make a crossing an event

Status: Research memo, 2026-10-29, for the sea crossing design; not a decision.

The question: the boat from the landing in the starting valley to the human city on the far bank takes a few game minutes. The owner wants "an open world passage with a random sea quest on it: an opportunity, not a loading screen". The design must be deterministic and integer-only: a server rolls once from a weighted table, no physics. What is the smallest system that gives a crossing variety, risk and reward? Where a number is not published, this memo says so. Most figures come from fan wikis and search snippets: leads to check, not facts.

## 1. What the best games do on a passage

- **The Wind Waker (Nintendo, 2002).** The Great Sea is a grid of 49 sectors. The sail is a long, mostly empty stretch where the player only steers and changes the wind. Critics (Kamiya among them) blame the pacing: islands far apart, a slow boat, a wind song that is slow to play. The HD remake added a faster sail. An eventless passage is the failure to avoid. Costs and pay: none per trip; rewards sit at the islands.
- **Sea of Thieves (Rare, 2018).** World events (Skeleton Fleet, Skeleton Fort, Ghost Fleet, Fort of Fortune) are announced by a sky marker, run one at a time per server, and a Skeleton Fleet cloud expires in about 30 minutes if ignored. The Kraken arrives only when no event or encounter is active, so the sea is never quiet and never crowded. The player chooses to engage or sail away. Spawn weights: not published.
- **Assassin's Creed IV Black Flag (Ubisoft, 2013).** Ubisoft said about 40 percent of the game is naval. Open-sea sightings: a raft with a survivor (a rescue pays crew and a little money), pirates under attack, battles between factions that can be joined, timed convoys with a rare Gold Fleet jackpot, whales to harpoon, storms and rogue waves. The player picks, by sailing toward it, which sighting to take. Rolled by region, not per trip; rates not published.
- **Valheim (Iron Gate, 2021).** Wind direction is the whole skill of the boat (a headwind leaves the sail dead). Serpents live in the open ocean; wiki and players disagree on when they appear (night and storms by the wiki, daytime sightings by players). A faster boat can outrun one.
- **Sunless Sea (Failbetter, 2015).** Fuel and supplies are the clock; terror runs 0 to 100, rises in the dark and far from lit ports, and resets to 50 at home. Ports and sightings are written storylets chosen by quality prerequisites, a model Failbetter credits to King of Dragon Pass. Cost of a trip is paid in fuel, supplies and nerve.
- **FTL (Subset Games, 2012).** Each beacon is an event drawn from a per-sector list. One forum count claims a non-race sector has only 6 events; this is a single player's claim. A sector fills spare beacons from a "filler" list, and nebula beacons skip a second event on purpose: the developers removed it after "odd events" showed up, a simplification for safety. Choices are 2 to 3 buttons, some gated by crew or items.
- **Oregon Trail (MECC, 1971/1985).** A river asks one question: ford, caulk and float, or ferry for a fee. The 1975 BASIC listing draws one of 16 events a turn. Success depends on depth and weather, but a review says the odds are unreadable, so both buttons feel like blind dice.
- **Slay the Spire (Mega Crit, 2019).** The map is chosen, not rolled in play: a seeded graph of rooms, 17 floors per act with up to six per row on the wiki, so the player picks risk against reward before the fight. A fan guide says elite rooms rise from 8 to 16 percent after act 1; treat as unverified.
- **King of Dragon Pass (A Sharp, 1999).** One event a turn from a pool of hundreds, each a picture, a short block of text and a list of choices; advisors disagree, so advice is a second layer of choice. Selection depends on past choices, resources and some randomness.
- **80 Days (inkle, 2014).** Routes trade time against money and health; each stop is a self-contained story not needing strict order. Reported script: over half a million words, a fraction seen per run.
- **Star Traders: Frontiers (Trese Brothers, 2018).** Trade and piracy share the lanes; encounters may or may not end in combat. Event counts and rates: not published.
- **Dredge (Black Salt, 2023).** Night is both dangerous and richer: a flat 3 percent aberration bonus at night, green-glow spots add 35 percent, and a hidden counter rises 0.5 percent per ordinary catch to a 35 percent cap and resets on an aberration. That is a pity counter pacing a rare event.

## 2. Event tables

- **Size.** Published sizes run from 6 (one FTL sector, unverified) to 16 (Oregon Trail's BASIC listing) to hundreds (King of Dragon Pass). For a single route of a few beats, 12 to 20 kinds is enough; a player making the crossing twenty times sees most of them.
- **Weights.** Not published for any game above. The common shape is a heavy base of mild events, a middle band of choices, and one or two rare jackpots.
- **No repeat.** Two cheap devices: a no-repeat window (do not draw an event seen in the last N passages) and a seen flag (a one-time event is struck out after it resolves). Sea of Thieves uses a server rule (one world event at a time) rather than a window.
- **Difficulty by distance.** FTL and Slay the Spire both raise danger by depth (later sectors, later acts). One route has one distance, so scale by the player's preparation instead: boat tier, crew, cargo value, night.
- **Rare pacing.** A pity counter (Dredge) or a quiet-slot rule (the Kraken fills a gap) keeps rare events from clumping and from going missing.

## 3. Choice during a passage

- The format that lasts is 2 to 3 buttons: take it, leave it, or a third that costs something else (FTL, King of Dragon Pass, 80 Days).
- Timing pressure is rare in these games; the pressure is in the cost. A phone passage should not time out into a punishment: no input means the safe default.
- Reading without a wall of text: one picture or sighting on the horizon, one line, 2 or 3 short verb labels, each with its cost shown as an icon and a number. The player should know the price before pressing.
- Advisors (King of Dragon Pass) show that a second voice can carry the odds: a boatman's remark can hint the risk in a phrase.

## 4. Cargo and fare

- Oregon Trail's ferry is the model fare: pay to remove a risk. Fare is a choice about risk, not a toll.
- Carried goods give the passage a stake. In Sunless Sea fuel and supplies are the stake, in Black Flag convoys the cargo. A loss at sea must be partial (a share of the cargo, one item) and shown before it is accepted.
- Insurance: none of these games sells it by name; the ferry acts as it. "A sturdier boat, a higher fare" would be the same device.
- What makes risk feel fair (see section 8): a visible clue before the choice, a cost shown on the button, losses capped, and a safe default that always exists.

## 5. The visual passage

- A 2D crossing draws: a scrolling water layer in two or three speeds (parallax), the boat bobbing in place, a far-bank silhouette that grows, weather as a tint and a particle layer, and one sighting sprite sliding in from the horizon.
- Length: no study publishes a safe number. Wind Waker's long sails are the cautionary tale. A phone play session is short, so the guess to test is 40 to 60 seconds of real time in 4 beats, one event at the second beat and an optional second at the fourth, the rest being scenery and a clear arrival.
- A beat is a screen of travel with a fixed duration, so the roll can say "beat 2: event 7" and the client only plays it. That keeps it deterministic and cheap.

## 6. The sea as a place, and quest hooks

| Sea feature | Seen in | Quest hook |
|---|---|---|
| Fishing spot | Dredge, Valheim | a catch for a market order on the far bank |
| Flotsam and rafts | Black Flag | a cargo crate or a stranded traveller to return |
| Island | Wind Waker, Sunless Sea | a one-time stop with a find |
| Lighthouse | Sunless Sea (lit ports) | a keeper's errand; light lowers night risk |
| Wreck | Sea of Thieves, Black Flag | salvage, an item that names its owner |
| Monster sighting (no fight) | Valheim, Sea of Thieves | a warning, a shadow passing, an NPC who wants a sketch |
| Weather window | Valheim, Black Flag | a storm day with a higher fare and richer pay |
| Night crossing | Dredge, Sunless Sea | cheaper fare, more risk, rarer finds |

Each hook is one event or a flag that opens a later quest on land.

## 7. A minimal spec (a proposal, not a decision)

```
passage: valley_landing -> far_bank_city
fare:    value anchor "short_ferry" (never a hardcoded price)
beats:   4, about 12 seconds each
events:  1 at beat 2, 1 more at beat 4 with chance 30 percent
roll:    once at departure, from a seed, integer weights
seen:    once-events struck after resolve; no-repeat window of 3 passages;
         pity: rare weight +2 per passage without a rare, reset on one
default: no input in 6 seconds picks the first (safe) choice
```

| # | Event (weight) | Choices | Cost / reward | Seen |
|---|---|---|---|---|
| 1 | Calm water (30) | none | none | repeat |
| 2 | Gulls over a shoal (12) | cast a line / sail on | fish, a little time | repeat |
| 3 | Flotsam crate (10) | haul / leave | 1 salvage item / none | window |
| 4 | Fog bank (8) | slow through / steer wide | fare time up / small cargo risk | window |
| 5 | Squall (8) | ride out / pay for a sea anchor | cargo share lost / item spent | window |
| 6 | Boatman's song (6) | listen / hum along | small mood boost | window |
| 7 | Stranded traveller on a raft (6) | take aboard / pass | a favour flag / none | window |
| 8 | Trader's skiff (6) | trade / wave off | swap goods | repeat |
| 9 | Smuggler's lantern (5) | follow / ignore | a hidden cove find / fare time | window |
| 10 | Customs cutter (5) | show papers / drop a crate | pass free / lose 1 crate | window |
| 11 | Floating wreck (4) | salvage / mark it | 1 find / a map note | once |
| 12 | Lighthouse signal (4) | answer / ignore | keeper errand flag / none | once |
| 13 | Dolphins at the bow (3) | none | a luck flag | window |
| 14 | Shadow under the boat (3) | hold still / throw a lure | a sighting / lose a lure | once |
| 15 | Night lights on the far bank (3, night only) | none | a hook for the city | window |
| 16 | Drifting bottle (2, rare) | open / throw back | a map piece / none | once |
| 17 | Merchant's gift chest (1, rare) | open / report | a large find / reputation | once |
| 18 | Old sea shrine on a rock (1, rare) | leave an offering / pass | blessing flag / none | once |

Totals 117 weight; the roll is an integer in 0 to 116 against the cumulative table. Day and weather add or remove rows by flag.

Three example random sea quests (no blood on animals, no babies, PEGI 16 tone, the three races):

1. **The Lantern Signal.** A keeper on a rock light needs oil for the night. Human: pays in coin. Elf: reads the tide marks and gets a shortcut flag. Skeleton: can stand the cold deck at night and gets the harder offer. Pays a find at the far bank.
2. **A Ledger in the Bottle.** A bottle holds half a trade ledger. Return it at the city counting house for a reward, or keep it and sell the names (a reputation cost). Two buttons, one side effect, no text wall.
3. **The Silent Shadow.** A great shape follows the boat without attacking. The player can throw a lure, stay still, or ask the boatman. Whatever they choose, nothing is killed; the result is a sighting entry, a lore note with a named speaker, and a later fisher's tale on land.

## 8. Failure modes

- **Players skip the passage.** The Wind Waker answer was the faster sail and warps. Fix: make the first beat already worth watching, and let a repeat crossing shorten to a summary with the event kept, not removed.
- **Events feel random, not fair.** Oregon Trail's river is blind dice. Fixes seen: a visible clue (a sky marker, a depth reading, a hint from a crew line), a cost shown on the button, a capped loss, and a safe default.
- **Repetition.** A few runs reveal the table. Fixes: seen flags, no-repeat windows, a pity counter for rare events, flag-gated rows.
- **Too many choices or a punishing timeout.** Keep to 2 or 3 buttons; no input must never be a loss.

## Recommendations (three strongest)

1. Roll once at departure into a fixed per-beat plan (4 beats, 1 or 2 events), so the crossing is deterministic and replayable and the client only plays it.
2. Keep every event to 2 or 3 buttons with the cost on the button, a safe default on no input, and capped losses; add a visible clue before any risky choice.
3. Keep the table small (12 to 18 events) and pace it with seen flags, a no-repeat window of about 3 passages and a pity counter on rare events; use night and weather as flags that swap rows.

## Sources

1. Map Generation, Slay the Spire Wiki, community wiki, https://slaythespire.wiki.gg/wiki/Map_Generation
2. Slay the Spire: Map Generation Guide, Kosgames, fan guide, https://kosgames.com/slay-the-spire-map-generation-guide-26769/
3. World Events, Sea of Thieves Wiki, community wiki, https://seaofthieves.wiki.gg/wiki/World_Events
4. Encounters, Sea of Thieves Fandom wiki, community wiki, https://seaofthieves.fandom.com/wiki/Encounter
5. Assassin's Creed 4 Black Flag: Random events, Gamepressure, 2013, https://www.gamepressure.com/assassinscreediv/random-events/z45951
6. Ubisoft: 40 percent of Assassin's Creed IV is naval missions, GamesBeat, 2013, https://gamesbeat.com/?p=43425
7. Naval convoys and rewards guide, ConsolePulse, 2026, https://consolepulse.com/multiplatform/assassins-creed/guides/naval-convoys-rewards-spawn-guide-ac-black-flag-resynced
8. Valheim sailing guide, Windows Central, 2021, https://www.windowscentral.com/valheim-sailing-guide-how-build-and-sail-every-ship
9. Valheim sailing, Mobalytics, guide, https://mobalytics.gg/gamebase/guides/valheim-sailing
10. Sea serpent spawn discussion, Steam Community, forum, https://steamcommunity.com/app/892970/discussions/0/3102389184736156553
11. Terror, Sunless Sea Wiki, community wiki, https://sunlesssea.fandom.com/wiki/Terror?oldid=3992
12. How will Sunless Sea look, Failbetter Games, 2013, https://www.failbettergames.com/news/how-will-sunless-sea-look
13. Partially Unused Events, FTL, The Cutting Room Floor, https://tcrf.net/FTL:_Faster_Than_Light/Partially_Unused_Events
14. Category: Filler Events, FTL Wiki, community wiki, https://ftl.fandom.com/wiki/Category:Filler_Events
15. The Oregon Trail (1985 video game), Wikipedia, https://wikipedia.com/wiki/The_Oregon_Trail_(1985_video_game)
16. Crossing Rivers, Died of Dysentery, https://died-of-dysentery.com/stories/crossing-rivers.html
17. The Oregon Trail won, Data Driven Gamer, 2024, https://datadrivengamer.blogspot.com/2024/05/the-oregon-trail-won.html
18. King of Dragon Pass, Wikipedia, https://en.wikipedia.org/wiki/King_of_Dragon_Pass
19. King of Dragon Pass overview, A Sharp, https://a-sharp.com/kodp/overview.html
20. 80 Days: Meg Jayanth and inkle, Emily Short's Interactive Storytelling, 2014, https://emshort.blog/2014/08/05/80-days-meg-jayanth-inkle/
21. Road to the IGF: inkle's 80 Days, Game Developer, 2015, https://www.gamedeveloper.com/design/road-to-the-igf-inkle-s-i-80-days-i-
22. Aberrations, Dredge Wiki, community wiki, https://dredge.wiki.gg/wiki/Aberrations
23. Why the sail in Wind Waker wasn't always swift, Zelda Universe, 2019, https://zeldauniverse.net/2019/01/29/princess-zeldas-study-why-the-sail-in-wind-waker-wasnt-always-swift/
24. Defending the Great Sea, Zelda Dungeon, https://www.zeldadungeon.net/defending-the-great-sea/
25. Quality-Based Narrative (2010), Failbetter Games, via a mirror, https://videlais.github.io/simple-qbn/qbn
