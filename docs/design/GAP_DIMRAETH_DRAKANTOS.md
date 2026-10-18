# Openfold against Dimraeth and Drakantos: the depth target, the character target, and the distance to each

Written 2026-10-18 for the owner. He set two targets on 18.10: **Dimraeth for depth and complexity, in an open world** (he named its skills, its bag, its monsters, and free movement in place of a fixed feel), and **Drakantos for character design and animation**. He asked how far Openfold is from each in concept, in what is built, and in the tasks ahead.

Facts about Openfold come from `origin/develop` @ 7e1babf4, plus the stage-3 spec in PR #187 (not merged). Facts about the two games come from their Steam pages, the fan wiki dimraeth.org, one hands-on preview, Steam reviews and discussion threads, and their Steam screenshots, measured where a number is given. Sources are at the end. Neither game was played here, so a feel is quoted from players and never claimed.

## 1. The two games in one paragraph each

**Dimraeth** (Mudtek). A 1-8 player fantasy action RPG in a handcrafted pixel open world, seen top-down. It entered Steam Early Access on 15.09.2026 at $21.99, is about 80% positive over 2,000+ reviews, and peaked near 11,000 players at once. Early Access holds three chapters, about 15-20 hours plus an endgame, and a level cap of 25. Its engine is "Souls-lite" real-time combat, and around it sit a node skill tree, a five-spell loadout drawn from 300+ spells, set gear, a stronghold with farms and quarries, companions with personal quests and romance, nine pets, and drop-in co-op. Its weak point, by the reviews, is writing: of 87 negative reviews in a 523-review sample, 49 name the dialogue and 49 name AI.

**Drakantos** (Wingeon Game Studios, Brazil). A free-to-play top-down pixel MMORPG with action co-op combat, still "coming soon" on Steam after public beta tests. Its inspirations are Chrono Trigger and Stardew Valley. It has 21+ heroes in place of classes, each with its own mechanics, story, stance, combos, victory pose, death animation and 30+ voiced emotes. Skins and, since 2025, at least six unlockable styles per hero (finished for 10) plus tradable dyes stand in for character creation. It also has dynamic dungeons, ranked PvP, guilds, a market, housing, day and night, and pets.

## 2. Dimraeth's depth, system by system

Concept: **same** means the direction is already ours, **apart** means we chose a different form, and **opposite** means one of our rules forbids it.

| System | Dimraeth | Openfold today | Concept | Built: the distance | Where it sits in our plan |
|---|---|---|---|---|---|
| **Movement** | Free movement with keyboard, mouse or gamepad. A dodge roll covers "quite a bit of distance" with many i-frames. Stamina pays for swings, dodges and movement. | 4 directions only (`game/src/input.ts` DIRS), steps of one tile in 190 ms (`walk_step_ms`). The phone pad picks one of four sectors (`ui/touch.ts`). This is DECISIONS 2026-10-07 "Grid movement". | Opposite (DECISIONS 2026-10-07); the owner's word of 18.10 turns it (section 4) | The walk, the pad, collision and every e2e that walks by tiles | Proposed: its own stream right after the 64 px engine step (#191) and the hook, before the open world's ring (section 6) |
| **Combat and monsters** | Real-time. Stamina doubles as a stance for both sides, so a stagger is easy to land and easy to suffer. Concentration pays for spells and refills when a basic attack lands. The third hit of a string is a Final Attack. A swing cannot be cancelled. There is a block (a perfect block is rewarded), a parry and a dodge. Blunt hits fill a stun bar, and status stacks are Burning, Chill, Poison and Bleeding. Foes: slimes, goblins, goblin brutes, wolves. Bosses: Gloop (fire alone hurts it), Monstrous Droop, Corrupted Treant, a wolf boss (three attacks, then tired), the Goblin King. | None, by G35 ("Predators are hazards, not enemies: the answer is to run back to a safe place, never gear") and the owner's word of 9.10 ("No combat now"). Three hazards on the map: two wolves (`core/bank-wolf`, `core/ruins-wolf`, one sprite) and a pit. A wolf is a map prop that walks a closed round at one pace (G47), with eyes 5 tiles long, reach 4, a catch in 2.5 s and a bite every 2 s for 25%. On screen: red eyes in the dark. | **Opposite** (G35) | Everything: enemies as entities, their behaviour, hit and hurt, health on both sides, a weapon, balance | The owner's call (section 3). Until then: stealth, the threat telegraph (NEXT 12 c), more hazards |
| **Skills (active)** | Five spell slots. Spells come from race, class, crafted spellbooks (each with attribute requirements) and gear rune sets, 300+ in all. Players find five slots too few, and say they run out of new skills by the end of act 1. | No active ability and no hotbar. Work is a timing minigame per profession (`ui/games/`). | Apart | An ability bar, cooldowns, a verb per ability | Stage 3 candidates, without combat: abilities that are walking and senses verbs (section 6) |
| **Progression (passive)** | A node tree in the manner of Path of Exile, with Respec. Experience is spent on stats at a camp or a trainer, and each stat bought gives one tree point. Early nodes are small buffs. The cap is reported at 60 points. Players say builds converge: most good nodes sit in one quadrant. | Five attributes (carry, senses, agility, luck, stamina), up to 10 pips each, bought with skill points from the character level. Five professions (cooking, digging, foraging, handcraft, woodcutting) with levels and techniques. | Same | A tree with branches and a screen for it | Stage 3 in the spec ("the skill tree"). Take Dimraeth's lesson: no quadrant that every build takes |
| **The bag and gear** | Seen in its screenshot: one panel holds 8 gear slots and accessories above a 6-column bag of stacks, a capacity count, a quick bar of 4 consumables and gold. The tooltip names the kind, a line of flavour and each effect with its duration ("Health Up: 5% for 1800 s"). Crafting at a campfire opens beside the bag, with a queue of 4. Gear has 8 slots, 6 quality tiers and 23 named sets with bonuses at T3, T5 and T6. One offensive consumable at a time, refilled by resting. A survival-lite hunger. | A DOM panel: category headings, a grid each, "N / M places used" (the room grows with carry), and the detail below. Tools wear out or last. Hunger exists (the hunger clock). No gear slots and no quick bar. The world's clock stops while the bag is open (DECISIONS 2026-10-07, until stage 7). By rule the screen never shows a level or a chance (CR-17). | Same in shape, apart in numbers | Gear slots, a quick bar, crafting beside the bag | Gear waits for combat (CR-12). A quick bar of food and the crafting-beside-bag view are stage-1 polish. Keep CR-17: effects in words, not percentages |
| **Crafting** | Cooking 8, alchemy 10 and workbench 48 recipes in the demo. Players say food is the only craft that matters and that most gear drops are vendor trash. | 17 recipes; a workshop of three tiers; a craft can miss and luck tilts it; a made good sells for more. | Same | Mostly content | The community loop (recipes are data files) |
| **Stronghold** | Farms, quarries and other buildings. Materials put into an ally's facility widen its shop, add crafting services or open farming plots. A sleeping system. | One camp of five parts; the town mended by restores; houses and plots paused (DECISIONS 2026-10-10). | Same | Buildings that produce; investing in a character's facility | Stage 3 (the camp with four places) and SETTLEMENT.md; investing in a character's facility is new, a stage-3 candidate |
| **Companions** | Allies recruited on the road. A deeper bond opens conversations, a personal quest and possibly a romance. | Two characters (Maru, Pell) with lines by standing (stranger to family) and topics. | Same | Characters, voice sheets, quests per bond | The pool of quests (9.10) and the voice sheets; a romance would need the owner's word |
| **Open world** | Mirkea, handcrafted: the Lost Caverns, Earlwood Village, Wildwood Forest and the Goblin Caves. A reviewer calls it "sizable and interconnected". Weather and seasons; deeds and bounties gate the way into Wildwood. Waypoints are frequent, and the preview says that kills the wish to explore. | One hand-made valley of 48 x 49 tiles. Day and night. "The world has no end" is decided (17.10): generated ground in rings around the valley, danger rising with distance (G64). | Same, and larger in ambition | All of it: the generator, chunks, rings, the content | Stage 3, NEXT 19 in #187 |
| **Quests and events** | Main missions, side tasks, deeds, bounties, timed area quests and random limited-time events. Players praise the tracker and call the text far too long (3 to 4 pages per step). | 13 quests across the palette of types, one expedition (the night ruins), a maze, a tracker. | Same | Content | The loop and the pool of quests |
| **Co-op** | 1-8 players, drop-in and drop-out, peer to peer. The hero (level, gear, bag, spells) travels between worlds; story, allies and buildings stay with each world. | Single-player. | Same, in our order | A server, presence, then live play | The order of 17.10: accounts and a server, then presence without chat, then chat |
| **Writing** | The most-cited complaint. | STORY.md S1-S6 (the narrator never states the past; every claim about it has a speaker), voice sheets. | Ours is the stronger rule | - | Keep. This is where Openfold can beat it |

**The short answer.** In concept, Openfold already points where Dimraeth stands on eight of the twelve rows (progression, bag, crafting, stronghold, companions, open world, quests, co-op). It is apart on active skills and opposite on two: combat with its monsters, and movement. In what is built, the distance is large on every row but writing. Dimraeth ships about 15-20 hours over four areas, with about ten named kinds of foe and boss and 66 demo recipes. Openfold ships a ten-minute opening on one valley, with three hazards and 17 recipes. Most of that gap is content, which the community loop is built to fill. Movement and combat are not content: they are code, and only the owner's word moves them.

## 3. The one pillar that is opposite: monsters you fight

Dimraeth's monsters exist to be fought. Its depth lives in the fight: stamina as a stance, reading a telegraph, the third hit, a perfect block, status stacks, a boss that only fire hurts. Without combat, Openfold can reach Dimraeth's depth in skills, the bag, crafting, the stronghold and the world, but never its monsters. G35 and the owner's word of 9.10 keep combat out. Under GAME_RULES section 6, the owner decides.

What the big games do. Every game of this kind that has monsters has combat: Dimraeth, Drakantos, Stardew Valley, RuneScape, World of Warcraft, Zelda. The games without combat (Animal Crossing, Spiritfarer) have no monsters to speak of. Many keep their town without fighting and put the fight in places the player chooses to enter: Stardew's mines, RuneScape's Wilderness, Zelda's overworld against its villages.

1. **Recommended:** combat opens as a direction, but only in the wild and in expeditions. That means danger level d of 1 and up (G64), the first ring outward and places like the night ruins. The town, the opening and level-0 ground stay without fighting, as G35 reads today. Order: design it before #187's protocol is built, then build it after free movement (section 4) and after the server. The protocol in #187 makes every action except `move` wait for the server's reply, and a swing cannot wait a round trip. Its line for combat is one paragraph now (the client plays an encounter and the server checks it as a batch, as `move` reports already are), and saves a rewrite later. The first step needs no weapon: a dodge paid with stamina against the wolf's lunge. That keeps the 9.10 word ("not gear against a hazard") while players learn to read a telegraph.
2. Keep G35. Monsters stay hazards, met by stealth, telegraphs and the run home, and the depth comes from every other row. Then Openfold is a different kind of game from Dimraeth (exploring and surviving, cosy), and its monsters stay a target it does not reach.
3. Combat everywhere, now. Not recommended: it reorders the plan of 17.10 and undoes the opening, which is built on the run home.

## 4. Free movement in place of the fixed feel

Today the walk is Pokemon's: four directions, one tile per 190 ms press, and nothing between tiles. Dimraeth and Drakantos move freely, and so does Stardew Valley, the industry's model for a tile world with free movement. The player moves at pixel precision in 8 directions (analog on the phone's stick), while the world, its collisions and every action stay on tiles: a tool works on the tile the player faces.

That model fits Openfold's kernel without bending it:
- **The kernel stays integer and on tiles.** The client already reports the tile it stands on (P-5b, `game/src/walking.ts` `landStep`). With free movement it reports a tile whenever the feet cross into a new one. Predators' eyes, the bites, the danger level, the server's batch check of moves (G56 in #187) and its BFS keep the tile as their unit.
- **What changes:** the walk in both doors (`walking.ts`, the walk in `scenes/world.ts` and `play3d/world3d.ts`), the phone pad (an analog stick, the A and B buttons kept), collision against tile boxes plus a small body box, "the faced tile" for actions, and the e2e helpers that walk by tile (a walk-to-tile helper in place of counted presses). DECISIONS 2026-10-07 "Grid movement" is superseded in its first half.
- **Size:** M, a few hundred lines in the client, plus the e2e rework. It is the change with the biggest feel per line on this page.
- **Order:** after #191 (the 64 px engine step, which rewrites the camera in the same `world.ts` window) and the hook's last two parts (e, f), and before NEXT 19 c (the ring's walk rules) and NEXT 18 c (the client over the wire). Both of those are built on the walk, and building them on the grid first would mean writing them twice.
- **The owner judges the feel** (speed, acceleration, the stick's dead zone) on a preview, as polish inside the direction. The walk speed starts at today's: one tile per 190 ms.

## 5. Drakantos: character design and animation

**What it is, measured on a 1920x1080 Steam screenshot** (a town scene, the armoured hero zoomed 4x):
- A hero is about **48 art px tall** and about 33 wide across the shoulders, drawn at 3 screen px per art px.
- The head is about 19 art px tall, about **40% of the height**, so about two and a half heads in all. Hands, weapons and hair are oversized, and the silhouette reads at a glance.
- Eyes are 2 to 3 px with a white and a dark pupil, and the face is about 12 px across.
- The outline is a **dark tone of the local colour** (dark red-brown around the armour), not one black for everything. Each material has 3 to 4 tones that shift in hue as they darken.
- Attacks draw **smear arcs**. Big monsters dwarf the heroes: a griffin about two to three times a hero's height.
- Per hero: a stance (idle), walking, an attack combo, skills, a victory pose, a death, and 30+ voiced emotes. Looks come as skins, styles and dyes, never as gear drawn on the body.

**Why Drakantos has heroes instead of character creation**, in its developer's words: in 2D "we need to draw every frame, from every angle, for every accessory, hair, armor". Heroes allow "custom animations for every attack, each hero have its own stance, combos, victory poses, death animations, emotes". Some players left over the missing character creation. The studio answered with styles and dyes, not with layered gear.

**Openfold against it:**

| | Drakantos | Openfold today | Openfold planned (STYLE.md, NEXT 15) |
|---|---|---|---|
| Frame | about 48 art px tall | 16 x 24 | 64 x 96, the body about 80 px tall |
| Head against height | about 40% (2.5 heads) | about half (10 of 21 rows on the forager) | head 24-28 px wide on a body about 80 px tall, face about 20 (the frame `density-64`) |
| Outline | a dark tone of the local colour | one px of `#1b1a2e` on everything | the same |
| Colours | wide, hue-shifted ramps | the 32 core colours | the same 32 |
| Walk / idle | smooth cycles, own stance per hero | walk 3 frames, idle 2 | strips per direction; frame count not set |
| Actions | combo with smears, skills, victory, death, 30+ emotes | work pose 2 frames (32 x 32) | work pose 128 x 128, 2 frames |
| Directions | as the game needs | 3 drawn, the right mirrored | the same |
| Other characters | full sets | Maru and Pell: one frame and a blink | 2 images each in wave b |
| Looks | heroes, skins, styles, dyes | three starters, each in two builds (`_w`) | stage 6: "clothes and looks drawn on the character" |

So the distance is not resolution: from wave b on, Openfold's frame holds more pixels than a Drakantos hero. The distance is in four things:
- proportion (the head and hands);
- colour craft (local-colour outlines and hue-shifted ramps, which the 32 colours and the one outline colour rule out today);
- the number of frames per cycle;
- the number of animations per character.

Openfold's starters are already heroes in Drakantos's sense. Stage 6's "clothes drawn on the character" is the road Drakantos refused. Taking its road (styles and dyes per starter, with dyes as palette swaps, which the 32-colour kit makes cheap) keeps the animation budget for motion.

**Recommendation: three stills before wave b**, the cast of NEXT 15 (52 images). A look is a direction (AGENTS.md), and once wave b is drawn, a change of look redraws it. Pell at 64 x 96, phone size, each still testing one named difference:
- **A:** the standard as decided (the frame `density-64`).
- **B:** Drakantos's proportion: the head at about 40% of the height and larger hands, still in the 32 colours with the one outline.
- **C:** B plus Drakantos's colour craft: a local-colour outline and hue-shifted ramps. This reopens STYLE.md section 2, so it needs the owner's yes to more colours.

The pick goes into DECISIONS with its frame and becomes the compass of the waves.

**Animation is a budget question, and it is not proven.** One animation set at Drakantos's grain could be idle 6, walk 8, a work action 4-6, a dodge 5, hurt 3, a fall 6 and a celebration 6 frames, in 3 directions. That is about 120 frames per starter build, against 21 today. The tools measured on 18.10 (NEXT 15, "The waves' tools"):
- Codex draws about half the grid asked, at a cap of 20 images a day.
- Gemini draws finer pixels, but its cap is not counted.
- No tool has yet drawn an animation strip that holds one character from frame to frame.

What the industry does at this grain with a small team is Dead Cells' method (Motion Twin): animate a 3D model and render each frame down to pixel art. The 3D door's models could feed it. That is a second direction for the owner, and it comes only if one measured strip from the image tools fails. **First measure:** one 8-frame walk strip of Pell at 64 x 96 from the best tool, judged on two things: does the face hold across the frames, and does the importer keep the grid. Then set the frame counts in STYLE.md.

## 6. The order: each part filed under its stage

| What | Stage, and when | What it waits on |
|---|---|---|
| This page; the owner's two calls (combat in section 3, the three stills in section 5) | Now, no build | The owner |
| Free movement, both doors | Its own stream, after #191 and hook e and f, before NEXT 19 c and NEXT 18 c | The owner's word (given 18.10, DECISIONS) |
| The three character stills, then wave b at the picked look; one measured animation strip | The art stream, before wave b; wave a (the ground) goes on | The owner's pick |
| Monsters as hazards, deeper: the threat telegraph (NEXT 12 c), chained moves (a lunge, then a swipe: the moves players found most alive in Dimraeth), more kinds of predator in the ring's danger levels, packs | The variety stream (stage-1 polish), then the first ring (NEXT 19), within G35 | Nothing for the telegraphs; the ring for the kinds |
| The skill tree, and an ability bar of walking and senses verbs (a sprint paid with stamina; the dodge; a sense that shows a find) | Stage 3 (the spec's "skill tree") | Free movement for the sprint and the dodge |
| The bag: a quick bar of food, crafting beside the bag, effects in words | Stage-1 polish, any free builder | Nothing |
| Combat in the wild and in expeditions | After the server (NEXT 18) and free movement, if the owner picks section 3 option 1; one paragraph in #187's protocol now | The owner |
| Styles and dyes per starter in place of clothes drawn on the body | Stage 6, recorded now so wave b leaves room for it | The owner, with stage 6 |
| Co-op | The 17.10 order: presence, then chat | Stages 2a and 3 |

What not to copy from Dimraeth, by its own players:
- verbose dialogue (STORY.md already forbids its kind);
- foes that repeat ("slime after slime");
- telegraphs so slow that Hard is easy;
- waypoints so frequent that nobody explores;
- a gear set system that turns most drops into vendor trash;
- too few ability slots for the abilities a player earns.

## Sources

- Dimraeth on Steam: https://store.steampowered.com/app/2402680/Dimraeth/ (and its screenshots: the campfire and bag, the skill tree, the forest boss)
- Dimraeth fan wiki: https://www.dimraeth.org/ (combat systems, equipment and sets)
- The Wand Report, early access impressions: https://report.wand.com/previews/dimraeth-early-access-impressions
- Steam discussion, "My day 1 impressions after about 7 hours": https://steamcommunity.com/app/2402680/discussions/0/571549467877073923/
- Dimraeth reviews summary (523-review sample): https://dimraeth.pro/review
- Game Rant on the launch: https://gamerant.com/new-open-world-co-op-games-steam-dimraeth-reviews/
- Drakantos on Steam: https://store.steampowered.com/app/2454980/Drakantos/ (and its screenshots: the town, the field fight, the griffin)
- Drakantos developers on heroes and customisation: https://steamcommunity.com/app/2454980/discussions/0/5374541530385831652/
- Drakantos on converting 2D art to pixel art: https://x.com/PlayDrakantos/status/1907885819177669095
