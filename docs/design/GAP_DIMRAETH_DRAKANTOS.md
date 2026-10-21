# Openfold against Dimraeth and Drakantos: the depth target, the character target, and the distance to each

Written 2026-10-18 for the owner, and revised on 19.10 after his answers. He set two targets on 18.10: **Dimraeth for depth and complexity, in an open world** (he named its skills, its bag, its monsters, and free movement in place of a fixed feel), and **Drakantos for character design and animation**. He asked how far Openfold is from each in concept, in what is built, and in the tasks ahead.

His answers on 19.10, which this revision writes in:
- "G35 holds only for the demo." Combat is "a part no less important, after the general foundation" (section 3).
- The work on colour, frames and animation looks large. So the answer is rules, mechanics, tools and working methods built for the long run, more than recommendations by stage (section 7).
- Look at the details, and watch a video if needed. Dimraeth's skill tree is more interesting than ours. He did not like ours anyway: "it is generic, and it is not clear what the differences are" (section 4).
- Widening the gap between the characters through races (a goblin, an elf, a human or the like) is a step back, so it waits. It touches the characters' nature and lines of growth, and it may be left to other developers (section 8).

Facts about Openfold come from `origin/develop` @ 7e1babf4, plus the stage-3 spec in PR #187 (not merged). Facts about the two games come from:
- their Steam pages, the fan wiki dimraeth.org and two written guides to Dimraeth's tree;
- one hands-on preview, Steam reviews and discussion threads;
- the transcript of one Dimraeth build guide (18 min);
- their Steam screenshots, measured where a number is given;
- Drakantos's official 1080p60 teaser of the hero Yuki, measured frame by frame.

Sources are at the end. Neither game was played here, so a feel is quoted from players and never claimed.

## 1. The two games in one paragraph each

**Dimraeth** (Mudtek). A 1-8 player fantasy action RPG in a handcrafted pixel open world, seen top-down. It entered Steam Early Access on 15.09.2026 at $21.99, is about 80% positive over 2,000+ reviews, and peaked near 11,000 players at once. Early Access holds three chapters, about 15-20 hours plus an endgame, and a level cap of 25. Its engine is "Souls-lite" real-time combat. Around it sit a skill tree shaped by race and class, a five-spell loadout drawn from 300+ spells, set gear, a stronghold with farms and quarries, companions with personal quests and romance, nine pets, and drop-in co-op. A reviewer calls it "a marriage between Path of Exile and Stardew Valley". Its weak point, by the reviews, is writing: of 87 negative reviews in a 523-review sample, 49 name the dialogue and 49 name AI.

**Drakantos** (Wingeon Game Studios, Brazil). A free-to-play top-down pixel MMORPG with action co-op combat, still "coming soon" on Steam after public beta tests. Its inspirations are Chrono Trigger and Stardew Valley. It has 21+ heroes in place of classes, each with its own mechanics, story, stance, combos, victory pose, death animation and 30+ voiced emotes. Skins and, since 2025, at least six unlockable styles per hero (finished for 10) plus tradable dyes stand in for character creation. It also has dynamic dungeons, ranked PvP, guilds, a market, housing, day and night, and pets.

## 2. Dimraeth's depth, system by system

Concept: **same** means the direction is already ours, **apart** means we chose a different form, and **opposite** meant one of our rules forbade it on 18.10.

| System | Dimraeth | Openfold today | Concept | Built: the distance | Where it sits in our plan |
|---|---|---|---|---|---|
| **Movement** | Free movement with keyboard, mouse or gamepad. A dodge roll covers "quite a bit of distance" with many i-frames. Stamina pays for swings, dodges and movement. | 4 directions only (`game/src/input.ts` DIRS), steps of one tile in 190 ms (`walk_step_ms`). The phone pad picks one of four sectors (`ui/touch.ts`). This is DECISIONS 2026-10-07 "Grid movement". | Opposite until 18.10; the owner's word turns it (section 5) | The walk, the pad, collision and every e2e that walks by tiles | Its own stream right after the 64 px engine step (#191) and the hook (section 9) |
| **Combat and monsters** | Real-time. Stamina doubles as a stance for both sides, so a stagger is easy to land and easy to suffer. Concentration pays for spells and refills when a basic attack lands. The third hit of a string is a Final Attack. A swing cannot be cancelled. There is a block (a perfect block is rewarded), a parry and a dodge. Blunt hits fill a stun bar, and status stacks are Burning, Chill, Poison and Bleeding. Foes: slimes, goblins, goblin brutes, wolves. Bosses: Gloop (fire alone hurts it), Monstrous Droop, Corrupted Treant, a wolf boss (three attacks, then tired), the Goblin King. | None, by G35 ("Predators are hazards, not enemies: the answer is to run back to a safe place, never gear"). Three hazards on the map: two wolves (`core/bank-wolf`, `core/ruins-wolf`, one sprite) and a pit. A wolf is a map prop that walks a closed round at one pace (G47), with eyes 5 tiles long, reach 4, a catch in 2.5 s and a bite every 2 s for 25%. On screen: red eyes in the dark. | Opposite until 19.10; now G35 holds only for the demo (section 3) | Everything: enemies as entities, their behaviour, hit and hurt, health on both sides, a weapon, balance | Designed now, built after the foundation (section 3) |
| **Skills (active)** | Five spell slots. Spells come from race, class, crafted spellbooks (each with attribute requirements) and gear rune sets, 300+ in all. Unlocked skills have no cooldown. Players find five slots too few, and say they run out of new skills by the end of act 1. | No active ability and no hotbar. Work is a timing minigame per profession (`ui/games/`). | Apart | An ability bar, a verb per ability | With the tree (section 4) |
| **Progression (passive)** | A tree shaped by race and class, in the manner of Path of Exile (section 4). | Five attributes and fixed techniques. The owner, 19.10: "generic, and it is not clear what the differences are". | Same in name, far in kind | A real tree, its screen, its content | Section 4: designed now, built in stage 3 |
| **The bag and gear** | Seen in its screenshot: one panel holds 8 gear slots and accessories above a 6-column bag of stacks, a capacity count, a quick bar of 4 consumables and gold. The tooltip names the kind, a line of flavour and each effect with its duration ("Health Up: 5% for 1800 s"). Crafting at a campfire opens beside the bag, with a queue of 4. Gear has 8 slots, 6 quality tiers and 23 named sets with bonuses at T3, T5 and T6, mixable (three pieces of one set and three of another). Unwanted gear is salvaged into runes that upgrade a piece and open new stat lines. One offensive consumable at a time, refilled by resting. Pets carry part of the load and can take it to town to sell or to the base's chests. A survival-lite hunger. | A DOM panel: category headings, a grid each, "N / M places used" (the room grows with carry), and the detail below. Tools wear out or last. Hunger exists (the hunger clock). No gear slots and no quick bar. The world's clock stops while the bag is open (DECISIONS 2026-10-07, until stage 7). By rule the screen never shows a level or a chance (CR-17). | Same in shape, apart in numbers | Gear slots, a quick bar, crafting beside the bag, salvage | Gear comes with combat (CR-12). A quick bar of food and the crafting-beside-bag view are stage-1 polish. Keep CR-17: effects in words, not percentages |
| **Crafting** | Cooking 8, alchemy 10 and workbench 48 recipes in the demo. Recipes for spellbooks are found by exploring. Players say food is the only craft that matters and that most gear drops are vendor trash. | 17 recipes; a workshop of three tiers; a craft can miss and luck tilts it; a made good sells for more. | Same | Mostly content | The community loop (recipes are data files) |
| **Stronghold** | Farms, quarries and other buildings. Materials put into an ally's facility widen its shop, add crafting services or open farming plots. A training dummy to test a build. A sleeping system. | One camp of five parts; the town mended by restores; houses and plots paused (DECISIONS 2026-10-10). | Same | Buildings that produce; investing in a character's facility | Stage 3 (the camp with four places) and SETTLEMENT.md; investing in a character's facility is new, a stage-3 candidate |
| **Companions and pets** | Allies recruited on the road. A deeper bond opens conversations, a personal quest and possibly a romance. Nine pets, each with a skill of its own (a parrot that dives on a bleeding foe, a cat that refills Concentration). | Two characters (Maru, Pell) with lines by standing (stranger to family) and topics. No pets. | Same | Characters, voice sheets, quests per bond, pets | The pool of quests (9.10) and the voice sheets; a romance would need the owner's word; pets are a stage-3 candidate |
| **Open world** | Mirkea, handcrafted: the Lost Caverns, Earlwood Village, Wildwood Forest and the Goblin Caves. A reviewer calls it "sizable and interconnected". Weather and seasons; deeds and bounties gate the way into Wildwood. Waypoints are frequent, and the preview says that kills the wish to explore. | One hand-made valley of 48 x 49 tiles. Day and night. "The world has no end" is decided (17.10): generated ground in rings around the valley, danger rising with distance (G64). | Same, and larger in ambition | All of it: the generator, chunks, rings, the content | Stage 3, NEXT 19 in #187 |
| **Quests and events** | Main missions, side tasks, deeds, bounties, timed area quests and random limited-time events. Players praise the tracker and call the text far too long (3 to 4 pages per step). | 13 quests across the palette of types, one expedition (the night ruins), a maze, a tracker. | Same | Content | The loop and the pool of quests |
| **Co-op** | 1-8 players, drop-in and drop-out, peer to peer. The hero (level, gear, bag, spells) travels between worlds; story, allies and buildings stay with each world. | Single-player. | Same, in our order | A server, presence, then live play | The order of 17.10: accounts and a server, then presence without chat, then chat |
| **Writing** | The most-cited complaint. | STORY.md S1-S6 (the narrator never states the past; every claim about it has a speaker), voice sheets. | Ours is the stronger rule | - | Keep. This is where Openfold can beat it |

**The short answer.** In concept, Openfold points where Dimraeth stands on most rows: the bag, crafting, the stronghold, companions, the open world, quests and co-op. Since 19.10 nothing is opposite any more: combat is the plan after the demo, and the walk becomes free. The far rows are the skill tree (the name is the same, the depth is not), active skills and combat. In what is built, the distance is large on every row but writing. Dimraeth ships about 15-20 hours over four areas, with about ten named kinds of foe and boss and 66 demo recipes. Openfold ships a ten-minute opening on one valley, with three hazards and 17 recipes. Most of that gap is content, which the community loop is built to fill. Movement, combat, the tree and the art pipeline are not content: they are systems, and sections 3 to 7 treat them as systems.

## 3. Combat: G35 is the demo's rule

The owner, 19.10: "G35 holds only for the demo", and combat is "a part no less important, after the general foundation". This reverses the 9.10 word ("No combat now") for everything after stage 1. Dimraeth's monsters exist to be fought, and its depth lives in the fight: stamina as a stance, reading a telegraph, the third hit, a perfect block, status stacks, a boss that only fire hurts. That is now a target.

What follows from it:
- **The demo keeps G35.** The opening, the night ruins and the bank wolf stay hazards that are escaped (GAME_RULES G35 now names the demo).
- **"After the foundation"** means after the order of 17.10's third step: accounts and the server (NEXT 18) beside the open world's first ring (NEXT 19). Recommended: combat comes before live presence (step 4). Whether players fight side by side shapes how presence is built, and every game named here built its single-player fight first.
- **Designed now, so the foundation does not have to be rebuilt for it.** The protocol in #187 makes every action except `move` wait for the server's reply, and a swing cannot wait a round trip. One paragraph there now (an encounter is played on the client at a fixed tick and checked on the server as a batch, as `move` reports are, with caps on what it can pay) saves a rewrite of 18 a later. The kernel stays pure and integer: an encounter is a fixed-tick simulation inside it, which the server replays.
- **Free movement first** (section 5). A dodge, a lunge read by its telegraph, and spacing all need a body that moves between tiles.
- **Where it is fought, recommended:** in the wild (danger level d of 1 and up, G64) and in expeditions, never in a town or on level-0 ground. Big games keep their towns safe and put the fight in places the player chooses to enter: Stardew's mines, RuneScape's Wilderness, Zelda's overworld against its villages. This waits for the owner's word when the combat frame is written.
- **The first step needs no weapon.** A dodge paid with stamina against the wolf's lunge, and the threat telegraph (NEXT 12 c), teach the reading of a telegraph inside the demo's rule.

What to take from Dimraeth's fight, by its players, and what not to:
- Take: stamina as a stance for both sides, so a stagger cuts both ways; foes that chain moves (a lunge, then a claw swipe; a tackle, then a slam), which players found the most alive; bosses with one weakness.
- Leave: telegraphs so slow that Hard is easy; foes that repeat ("slime after slime"); a dodge with so many i-frames that fights turn easy.

## 4. The skill tree, in detail

**Ours, and why it reads generic.** The "Skills" tab of the journal (`game/src/ui/panels.ts`, `skillsTab`) shows five attributes, each up to 10 pips, bought with skill points from the character level:
- Bag space: the bag holds N things.
- Keen eyes: hidden finds show from N steps.
- Steady hands: the minigame's good zone is N% wide.
- Luck: a miss still gives 1 in N%.
- Stamina: health or minutes of work.

Below them sit the five professions, each with two fixed techniques at levels 2 and 4 ("Cooking is 25% faster", "The timing window is 20% wider"). The three starters differ by 0 to 2 pips of the same five (the explorer has senses 2 and luck 2; the forager carry 2 and agility 2; the digger luck 2 and stamina 2).

That is why it is generic:
- (1) every player buys the same five numbers;
- (2) every point is a percentage, and none opens a new thing to do;
- (3) no choice shuts another, so there is no build to name;
- (4) a technique arrives by level, not by choice;
- (5) the starters differ by two pips, which the player cannot feel.

**Dimraeth's, as its players describe it:**
- **The shape is the character.** The tree has four wings around a centre. On the vertical axis lie the race's skills, on the horizontal the class's. The corner nodes where they meet are unique to that exact pair (an elf shadow, a minotaur brawler). So a human mage becomes an elemental ranger (fire or ice with sword and bow), while a minotaur mage becomes an earthshaker (magic while swinging an axe, tremors from a stomp). The names follow from the tree, not from flavour text.
- **Three sizes of node.**
  - Small nodes along the paths: a little pierce damage, a little stamina regeneration.
  - About three major nodes per wing, each either a big change to a starting skill or a new skill. After each major node comes a sub-branch of modifiers for that one skill: more base damage, several targets, a shorter cooldown.
  - Medium nodes scattered between the wings: strong passives that "can push the play style further or change it completely".
- **Each race-and-class pair scales from a different stat.** A human mage gains magic damage from Adventure, an elf mage from Agility. That pushes players toward hybrids.
- **Points come from training.** Experience is a currency, spent at a campfire or a trainer to raise an attribute (Strength, Agility, Intelligence, Physique, Adventure, Charisma, Memory, Energy and more). Each level bought gives two tree points.
- **Attributes are keys, not only numbers.** Spellbooks are recipes found in the world and crafted. Each asks for attribute thresholds before its skill can be learnt: Flaming Strike needs Memory 7, Adventure 8 and Energy 7. A player who never trained Adventure finds a strong book and cannot use it yet. A book also teaches a skill outside the class, which is how hybrids are made.
- **The tree can be redone, the attributes cannot.** Respec is free for the first few points, then costs a little gold. Attributes never reset.
- **A search box** lights the nodes that match a word ("bleed") and dims the rest.
- **What its players fault:** most of the strong nodes sit in one quadrant, so builds converge; the key pieces of a build arrive by level 13 of 25; five active slots run out.

**A frame for ours.** This is a direction to show the owner as a still of the tree screen, and the screen is a UI frame. It is not designed here.
- **The axes are who you are and what you do.** The vertical axis is the starter's nature (the forager, the digger, the explorer, and later a race if one comes, section 8). The horizontal axis is the trades (the five professions). A corner node exists only for one starter and one trade, so a forager who digs grows differently from a digger who digs.
- **Major nodes change a verb, they do not add a percentage.** Examples of the kind, for the still only:
  - digging: the dig game shows how deep the find lies;
  - woodcutting: a tree falls the way you face, and across a stream it is a bridge;
  - foraging: ripe plants glow after dark;
  - senses: a predator's eyes show their cone for a beat when it turns;
  - cooking: a meal cooked at the camp keeps through a night.
  Each major node has its own short sub-branch. Small nodes carry today's percentages.
- **Attributes become keys.** A technique, a recipe or a path asks for an attribute threshold, so a pip opens a door. The five attributes stay, and the numbers they move stay small.
- **Points are trained at the camp's fire or by Maru**, so the camp is a place to come back to.
- **Books found in the world teach a node outside your wings.** A `find` or `riddle` step can give one, and a creator can add one as data.
- **Combat later gets its own wings.** The tree's format leaves room for them now, so the tree is not redrawn when combat lands (section 3).
- **Against Dimraeth's faults:**
  - a check in `pnpm values` that no wing holds most of the tree's value;
  - the best nodes spread over the whole climb, not by a third of it;
  - enough active slots for what a player earns.
- **The kernel stays the judge.** Each node's effect is a typed effect the kernel already knows or gains, integer-only and priced by V, as techniques are today.

Size: the tree's schema and kernel effects are M; its screen is M; its content is the loop's. It replaces the Skills tab and folds the techniques into the tree.

## 5. Free movement in place of the fixed feel

Today the walk is Pokemon's: four directions, one tile per 190 ms press, and nothing between tiles. Dimraeth and Drakantos move freely, and so does Stardew Valley, the industry's model for a tile world with free movement. The player moves at pixel precision in 8 directions (analog on the phone's stick), while the world, its collisions and every action stay on tiles: a tool works on the tile the player faces.

That model fits Openfold's kernel without bending it:
- **The kernel stays integer and on tiles.** The client already reports the tile it stands on (P-5b, `game/src/walking.ts` `landStep`). With free movement it reports a tile whenever the feet cross into a new one. Predators' eyes, the bites, the danger level, the server's batch check of moves (G56 in #187) and its BFS keep the tile as their unit.
- **What changes:**
  - the walk in both doors (`walking.ts`, the walk in `scenes/world.ts` and `play3d/world3d.ts`);
  - the phone pad becomes an analog stick, and the A and B buttons stay;
  - collision against tile boxes through a small body box;
  - "the faced tile" for actions;
  - the e2e helpers that walk by tile: a walk-to-tile helper in place of counted presses.
  DECISIONS 2026-10-07 "Grid movement" is superseded in its first half.
- **Size:** M, a few hundred lines in the client, plus the e2e rework. It is the change with the biggest feel per line on this page.
- **Order:** after #191 (the 64 px engine step, which rewrites the camera in the same `world.ts` window) and the hook's last two parts (e, f). Before NEXT 19 c (the ring's walk rules) and NEXT 18 c (the client over the wire). Both of those are built on the walk, and building them on the grid first would mean writing them twice.
- **The owner judges the feel** (speed, acceleration, the stick's dead zone) on a preview, as polish inside the direction. The walk speed starts at today's: one tile per 190 ms.

## 6. Drakantos: character design and animation

**What it is, measured on a 1920x1080 Steam screenshot** (a town scene, the armoured hero zoomed 4x):
- A hero is about **48 art px tall** and about 33 wide across the shoulders, drawn at 3 screen px per art px.
- The head is about 19 art px tall, about **40% of the height**, so about two and a half heads in all. Hands, weapons and hair are oversized, and the silhouette reads at a glance.
- Eyes are 2 to 3 px with a white and a dark pupil, and the face is about 12 px across.
- The outline is a **dark tone of the local colour** (dark red-brown around the armour), not one black for everything. Each material has 3 to 4 tones that shift in hue as they darken.
- Attacks draw **smear arcs**. Big monsters dwarf the heroes: a griffin about two to three times a hero's height.

**What it does in motion, measured on the official Yuki teaser** (1080p at 60 frames a second, 6 s of a fight on ice, the hero cropped):
- A pose holds for 5 to 7 frames, about 100 ms, so the animation runs at **about 10 poses a second** on a 60 frame screen.
- A cast takes about 8 distinct poses over 0.8 s, and the ice it calls rises in its own frames.
- A dash is one stretched pose that slides with a shadow trail. One drawing does the work of many.
- The nine tails move in every pose: the secondary motion of hair, tails and cloth is what reads as "alive".
- Per hero there are also a stance (idle), walking, an attack combo, skills, a victory pose, a death, and 30+ voiced emotes. Looks come as skins, styles and dyes, never as gear drawn on the body.

**Why Drakantos has heroes instead of character creation**, in its developer's words: in 2D "we need to draw every frame, from every angle, for every accessory, hair, armor". Heroes allow "custom animations for every attack, each hero have its own stance, combos, victory poses, death animations, emotes". Some players left over the missing character creation. The studio answered with styles and dyes, not with layered gear.

**Openfold against it:**

| | Drakantos | Openfold today | Openfold planned (STYLE.md, NEXT 15) |
|---|---|---|---|
| Frame | about 48 art px tall | 16 x 24 | 64 x 96, the body about 80 px tall |
| Head against height | about 40% (2.5 heads) | about half (10 of 21 rows on the forager) | head 24-28 px wide on a body about 80 px tall, face about 20 (the frame `density-64`) |
| Outline | a dark tone of the local colour | one px of `#1b1a2e` on everything | the same |
| Colours | wide, hue-shifted ramps | the 32 core colours | the same 32 |
| Pace | about 10 poses a second | walk 3 frames, idle 2 | strips per direction; frame count not set |
| Actions | combo with smears, skills, a dash, victory, death, 30+ emotes | work pose 2 frames (32 x 32) | work pose 128 x 128, 2 frames |
| Directions | as the game needs | 3 drawn, the right mirrored | the same |
| Other characters | full sets | Maru and Pell: one frame and a blink | 2 images each in wave b |
| Looks | heroes, skins, styles, dyes | three starters, each in two builds (`_w`) | stage 6: "clothes and looks drawn on the character" |

So the distance is not resolution: from wave b on, Openfold's frame holds more pixels than a Drakantos hero. The distance is in four things:
- proportion (the head and hands);
- colour craft (local-colour outlines and hue-shifted ramps, which the 32 colours and the one outline colour rule out today);
- the number of poses per action, and secondary motion;
- the number of animations per character.

Openfold's starters are already heroes in Drakantos's sense. Stage 6's "clothes drawn on the character" is the road Drakantos refused. Taking its road (styles and dyes per starter, with dyes as palette swaps, which a palette-bound kit makes cheap) keeps the animation budget for motion.

## 7. The art as a production system: rules, a format, tools and methods

The owner, 19.10: the work on colour, frames and animation is large, so the answer is long-term development of rules, mechanics, tools and working methods. Today the pipeline is "ask an image model for a strip, snap it to the palette" (NEXT 15, "The waves' tools"). It measured well for single items and poorly for strips: Codex draws about half the grid asked, and no tool has yet held one character's face from frame to frame. At Drakantos's grain, one starter build needs about 120 poses (idle 6, walk 8, a work action 4-6, a dodge 5, hurt 3, a fall 6, a cheer 6, in 3 directions), against 21 today. Ten builds make about 1,200, before combat adds its own. No amount of drawing by hand or by prompt carries that without a system.

**Rules, in STYLE.md.** Each is decided by a still, since a look is a direction (AGENTS.md):
- **Proportion and colour craft.** Three stills of Pell at 64 x 96, phone size, each testing one named difference:
  - **A:** the standard as decided (the frame `density-64`).
  - **B:** Drakantos's proportion: the head at about 40% of the height and larger hands, still in the 32 colours with the one outline.
  - **C:** B plus Drakantos's colour craft: a local-colour outline and hue-shifted ramps. C reopens STYLE.md section 2 (the 32 colours, the one outline), so it is a rule change on the owner's yes. The likely form keeps the 32 as the world's core and lets each character carry its own ramps, declared in its kit.
- **The pace of animation:** a base of about 10 poses a second (Drakantos's measure), each action's pose count and timing written in STYLE.md, and secondary motion (hair, cloth, a tail, a tool) named as part of a pose, not an extra.
- **Looks as styles and dyes, not gear drawn on the body,** for stage 6 (Drakantos's road), with a dye as a swap of a character's own ramps.

**Mechanics, in the schema and the engine.** These are new, additive data, so a creator can add an animation as a pull request like any other content:
- **An animation format in the kit:** named clips (idle, walk, run, work, dodge, hurt, fall, cheer, emote, and later attack), each with its frames and a duration per frame, a fixed anchor at the feet, and events on frames (a footstep for the sound, the frame a tool strikes, later the frame a blow lands). Today a strip's cycle and timing live in the client.
- **Palette swap in the renderer:** a character drawn once in its ramps, shown in any dye.
- **Smear and afterimage as engine effects,** not drawn frames: Drakantos's dash is one pose plus a trail.

**Tools, in `tools/src/kit`:**
- **A reference sheet per character**: a front, side and back turnaround with its ramps and proportions, approved once. Every frame is drawn against it, by a person or a model.
- **The strip route, made strict:** one approved key pose in, a whole strip out in one pass (models drift less on a whole strip than frame by frame), normalised to the frame size with the feet anchored. Then a **consistency check** in the importer: the palette, the silhouette's area from frame to frame, the anchor, and the face's pixels against the reference sheet. A strip that fails is refused with the frame named.
- **The 3D route, for scale (Dead Cells' method, Motion Twin):** a rigged, animated 3D model is rendered at the frame size without smoothing, snapped to the ramps, and given its outline by a script. New actions and directions then cost a render, not a drawing. The 3D door's models are a source. It needs Blender run headless (an install, audited first) and a rig with animations (Meshy's or Mixamo's, to be checked). It is a direction of its own, because it changes the look, so it is shown as a still and a one-second loop beside the strip route before it is chosen.
- **A preview harness:** `pnpm kit:preview` or a hub page that plays every clip of a character at phone size, on the game's ground, at the game's pace. The owner judges motion there, not in a still.
- **Checks in `pnpm check`:** each clip's frame count and durations within STYLE.md's ranges, the anchor, and the clip names a starter must have.

**Methods:**
- **One character all the way first** (a vertical slice, as studios do): Pell or one starter with every clip, by the chosen route, in the game. Only then the cast.
- **Keys first, in-betweens after:** the contact and passing poses of a walk, the wind-up and strike of a swing, approved before the frames between them.
- **A budget per character, measured on the first one,** then a schedule for the cast and the creatures.
- **Animators from the community.** With the format and the checks, an animation is content, and the loop's points and credits reward it. Openfold can open that door; Drakantos's studio cannot.

**First steps, in order, with their measures:**
1. The three stills A, B and C. The owner picks, and the pick goes into DECISIONS with its frame. Wave b (the cast, 52 images) waits for the pick; wave a (the ground) goes on.
2. The animation format and its check (schema, bundle, client playback with durations and events), with today's strips converted to it. Measure: every existing strip plays as today, the opening e2e is green.
3. One reference sheet and one 8-pose walk of Pell at 64 x 96 by the strip route, through the consistency check. Measure: the face's pixels hold within the check across the 8 poses, and the importer keeps the grid. If it fails, the 3D route's trial (step 4) comes before the cast; if it holds, the 3D route waits for scale.
4. The 3D route's trial: the same walk from a rigged model, as a still and a loop beside step 3's, for the owner.
5. The vertical slice of one character, then the cast at the measured budget.

## 8. Races to widen the starters: later

The owner, 19.10: a gap between the characters as wide as Dimraeth's races (a goblin, an elf, a human) would be a step back now, so it waits. It is the characters' nature and their lines of growth, and other developers may be the ones to think it through. In Dimraeth the race is half the tree (section 4), so if races come, they come as the vertical axis of the tree's frame, with corner nodes per race and trade. It also touches the story: a race's past needs its speakers (STORY.md S1-S6). Recorded as postponed in DECISIONS, and a candidate for an open call to creators when stage 3's tree is in place.

## 9. The order: each part filed under its stage

| What | Stage, and when | What it waits on |
|---|---|---|
| The combat paragraph in #187's protocol (an encounter checked as a batch, the fixed tick in the kernel) | Now, before NEXT 18 a is built | Nothing |
| The combat frame: where it is fought, the verbs (strike, dodge, block), foes as entities, the encounter tick, what a fall costs | Designed now, for the owner; built after NEXT 18 and NEXT 19, before live presence (recommended) | The owner's word on the frame |
| Free movement, both doors | Its own stream, after #191 and hook e and f, before NEXT 19 c and NEXT 18 c | Nothing more (the owner's word, 18.10) |
| The skill tree: its frame as a still of the screen, then its schema, kernel effects and screen | Designed now; built in stage 3 (the spec's "skill tree"), replacing the Skills tab | The owner's pick of the still |
| The art system: stills A, B and C; the animation format and its check; the strip route's measure; the 3D route's trial; one character all the way | Starts now, in the art stream, beside #191; wave b waits for the pick | The owner's pick of A, B or C |
| Monsters as hazards, deeper, inside the demo's G35: the threat telegraph (NEXT 12 c), chained moves (a lunge, then a swipe), more kinds of predator in the ring's danger levels, packs | The variety stream (stage-1 polish), then the first ring | Nothing for the telegraph |
| The bag: a quick bar of food, crafting beside the bag, effects in words | Stage-1 polish, any free builder | Nothing |
| Gear slots, salvage, sets | With combat (CR-12) | Combat |
| Pets with a skill each | Stage-3 candidate | The tree's format |
| Styles and dyes per starter in place of clothes drawn on the body | Stage 6, with the palette swap built in step 2 of section 7 | The owner, with stage 6 |
| Races | Later, perhaps an open call | The tree in place |
| Co-op | The 17.10 order: presence, then chat | Stages 2a and 3, and combat if it goes first |
| The forest as a layered mass: a canopy that closes over the ground, an edge of trunks where wood meets meadow, a floor of its own (undergrowth, litter, shade); today a grove is single trees on grass (the owner, 21.10) | Direction in the art stream, ART_SYSTEM step 10: two or three phone stills of one wood, each testing one named difference, then the build inside the picked look; the valley's grove by hand, the ring's woods by the generator (NEXT 19 b) | The ladder pick (#240) and the GK2 method pick, which decide how a tree is drawn; free movement (NEXT 22) for walking under a canopy |
| Music played by people: a composer or real instruments in place of the synthesizer (today every note is code, and the game ships no audio file) (the owner, 21.10) | Direction, its own step: three one-minute samples of the town's theme for the owner, each testing one named difference; then recorded beds behind today's sound-by-place logic (three beds by distance, the hunt's song), both doors | The art picks now open, so the owner judges one direction at a time; the source (a commissioned composer, as most studios do, or a licensed library) and its cost are his question |
| An illustrated map and UI: the map and the windows drawn as made things, not code-drawn panels (the owner, 21.10) | Polish inside Field Kit (DECISIONS 2026-10-20: paper and ink for the map); the map's function is #257, its drawn landmarks, icons and frame art come with the 64 px art waves | #257 landing; the ladder pick for the drawing's look |

What not to copy from Dimraeth, by its own players:
- verbose dialogue (STORY.md already forbids its kind);
- foes that repeat ("slime after slime");
- telegraphs so slow that Hard is easy;
- waypoints so frequent that nobody explores;
- a gear set system that turns most drops into vendor trash;
- too few ability slots for the abilities a player earns;
- strong nodes clustered in one corner of the tree.

## Sources

- Dimraeth on Steam: https://store.steampowered.com/app/2402680/Dimraeth/ (and its screenshots: the campfire and bag, the skill tree, the forest boss)
- Dimraeth fan wiki: https://www.dimraeth.org/ (combat systems, equipment and sets)
- Whisper of the House, the skill tree: https://www.whisperofthehouse.com/dimraeth/skill-tree
- Tpose Gaming, the tree's layout and attributes: https://tposegaming.com/?p=17720
- Sun, "You will theorycraft your character, and you WILL like it!" (build guide, transcript): https://www.youtube.com/watch?v=sOG0NDuK58g
- The Wand Report, early access impressions: https://report.wand.com/previews/dimraeth-early-access-impressions
- Steam discussion, "My day 1 impressions after about 7 hours": https://steamcommunity.com/app/2402680/discussions/0/571549467877073923/
- Dimraeth reviews summary (523-review sample): https://dimraeth.pro/review
- Game Rant on the launch: https://gamerant.com/new-open-world-co-op-games-steam-dimraeth-reviews/
- Drakantos on Steam: https://store.steampowered.com/app/2454980/Drakantos/ (and its screenshots: the town, the field fight, the griffin)
- Drakantos, "Yuki Gameplay Teaser" (official, measured frame by frame): https://www.youtube.com/watch?v=yVuI_IJM8eQ
- Drakantos developers on heroes and customisation: https://steamcommunity.com/app/2454980/discussions/0/5374541530385831652/
- Drakantos on converting 2D art to pixel art: https://x.com/PlayDrakantos/status/1907885819177669095
