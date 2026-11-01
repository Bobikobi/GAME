# Loomvale against Red Dead Redemption 2: the hunt-to-gear chain, system by system

Written 2026-10-30 for the owner. His ask: "equipment that climbs by material, materials
harvested from animals, materials combined, what gear gives, and the drawing and the movement
that go with it, at Red Dead Redemption 2's level or past it". This page walks that chain from
the first track to the coat on the body and measures each link three ways: the concept, what is
built, and what is drafted.

Facts about Loomvale are read from `develop` @ 71ba090 (30.10; [HUNTING.md](HUNTING.md) and
the combat numbers of COMBAT.md 4.9 are on it) and from four open pull requests, named by
number where a fact lives only there: #333 (PROGRESSION.md, gear and the kernel shape), #424
(the gaits), #375 (the races' walk), #402 (a creator's worn cap). Facts about Red Dead Redemption 2 (Rockstar Games, 2018)
come from the pages under Sources; the game was not played here, so a feel is quoted and never
claimed. Every number this page proposes is marked "proposed".

One caveat stands over every row. Red Dead Redemption 2 is a PEGI 18 and ESRB M single-player
3D game ([TONE.md](TONE.md), the line "not chosen"); Loomvale is a PEGI 16 and ESRB T browser
pixel game at 64 px a tile. The comparison is of systems: what a link in the chain does, what it
reads, what it pays. It is never a comparison of gore or of realism, and section 8 says what is
left behind on purpose.

## 1. The two games in one paragraph each

**Red Dead Redemption 2** (Rockstar Games). A single-player 3D open world of the American West,
with an online mode beside it. Hunting is one of its main systems: about 178 animal kinds, each
spawned at a quality of one to three stars. A pelt's grade follows the animal's stars and the
kill, so a weapon matched to the animal's size and one shot to the head or neck keep a
three-star animal "perfect", and a wrong weapon or several shots lower it. The hunter skins the
carcass with a knife, loads carcasses on the horse (up to three), and sells or spends them
before they decay. The Trapper makes outfits from named perfect and legendary pelts for a few
dollars; Pearson at camp makes satchels from three named perfect skins; the Fence makes trinkets
from the parts of legendary animals, one-of-a-kind beasts, each trinket a small passive effect.
Post-office hunting requests ask for perfect carcasses of nineteen small animals for cash.
Around the hunter sit three cores (health, stamina, dead eye) that drain in about 90 real
minutes, faster when dressed wrong for the weather; a body weight in three states moved by
eating; weapons that degrade with use and are cleaned with gun oil. The rating is M (blood and
gore, intense violence) and PEGI 18.

**Loomvale.** A browser pixel game, single-player today, with a pure integer kernel that the
server will replay (`kernel/src/step.ts`). Every item names a class, a tier, a rarity and a
weight (`schema/src/index.ts`, `ItemDef`); a recipe asks for items or for a class at a lowest
tier, so a new material joins an old recipe (G45). Eight worn slots carry work clothes whose
effects are five work rates capped by tier, plus a look layer that counts for nothing
(`WORN_SLOTS`, `WORN_EFFECTS`, `Wear`). No weapon exists and no fight (G35). Animals today are
five cosmetic kinds on 17 spots that step away when the player comes near
([BESTIARY.md](BESTIARY.md) section 3; `content/core/map.json`, `creatures`), one wolf hazard on
a round (G47), and one animal-class item, a river fish from a rod
(`content/core/resources/river-fish.json`). No animal has a body that moves
([ANIMATION.md](ANIMATION.md) section 1). The hunt is designed in [HUNTING.md](HUNTING.md), on
`develop`, and the gear ladder is drafted in #333; neither is built. The take's aftermath alone
is code in the hunt foundations pull request (DECISIONS 2026-10-30), dormant until something
fells an animal: the carcass on its tile; a `dress` action per part of it, six steps a part, so
a small animal is one action, a medium two, a large four, the goods at the carcass's grade
coming with the last part and what the bag cannot hold lying on the tile the player stands on;
the five goods classes; the grades as items; the `hunt` value source and its check rows. A raw
good has no price anywhere: `salePrice` returns nothing for it, and the sale refuses with
"Nobody buys that raw: make something of it."

## 2. The chain, system by system

Concept: **same** means the direction is already ours, **apart** means we chose another form,
**opposite** means a rule of ours forbids it.

| System | Red Dead Redemption 2 | Loomvale today (built) | Loomvale decided or drafted | Concept | Built: the distance |
|---|---|---|---|---|---|
| Finding animals | Habitats by region; scent carries downwind, so the hunter keeps downwind; bait by type | Five cosmetic kinds that step away at 2 to 5 tiles; the wolf's cone (G47); noise by gait (#424) | Ten states, a think step every 8 ticks, spawn tables by danger `d`, bait holds GRAZE (HUNTING 2, 8) | Same | The creature schema, the states, the spawns: all of it |
| Reading quality | One to three stars per animal: poor, good, perfect; the compendium names the weapon | Nothing; no creature in the kernel | A grade 1 to 3 set at spawn, read within 8 tiles as a pose, never a number (HUNTING 5) | Same, shown apart: a pose, not stars | The grade and its tell |
| The take | A weapon matched to the size; one shot to head or neck; a wrong weapon or extra shots downgrade | No weapon and no strike (G35); the start outfit has none (DECISIONS 22.10, decision 42) | Tools T0 to T5, stone to pit trap; a tool too small pays one grade lower, never refused (HUNTING 5) | Same in the rule, opposite in frame: stealth, not a fight | The hunt verb, the six tools, the unaware check |
| Harvesting | Skinning at the carcass with a knife; pelt, meat, feathers, antlers, claws, teeth | `animal` is a base class, "feathers, wool, hide, bone" (`schema/src/index.ts`); one animal item, the river fish | Five goods as classes under `animal`; dressing 6, 12 or 24 steps at the felling noise (HUNTING 6), in parts of six, one `dress` action a part (one, two or four), the goods with the last part (the foundations) | Same | The carcass, the dressing in parts and the goods are code in the foundations pull request, not yet merged; the take itself is not written |
| Carrying | Up to three carcasses on the horse; a satchel for small things, widened by Pearson | Weight 0 to 20 an item; limit 30 plus 10 a might point; three paces; 12 to 36 places (23.10) | A carcass takes 1, 2 or 4 bag slots by size (HUNTING 6); no mount is decided | Apart: the bag and the paces carry, not a horse | In the foundations the carcass lies on its tile and its goods enter the bag with the last part, the surplus on the ground; the rest exists |
| Spoilage | Carcasses and pelts decay with time left out and the weather; deliver fast | Nothing spoils; the bag is item id to count (`kernel/src/state.ts`) | Raw meat 3 game days, a raw hide 6; crows after 30 steps, a predator after 60 (HUNTING 6) | Same | A clock on the carcass; a clock inside the bag has nowhere to live |
| Processing | The player tans nothing; pelts go raw to the Trapper or Pearson, who do the making | A fire that cooks (G32, G48); a workshop of three tiers (DECISIONS 9.10); a new station is core-only (G45) | A drying rack and a tanning rack, a cure of about 5 game days (HUNTING 7) | Past it: the player tans | Two stations, two chains |
| Crafting | The Trapper's outfits from named perfect pelts plus cash; Pearson's satchels from three perfect skins; the Fence's trinkets | Recipes name items or a class at a lowest tier (G45); a craft can miss and keeps half (G40) | Classes cloth, leather, mail, plate; a quality rolled at the craft; rare material, rare thing (PROGRESSION 5, #333) | Apart: classes, not named pelts | Leather chains as content; the quality roll in the kernel |
| Gear stats | Cores drain in 90 real minutes, faster when dressed wrong for the weather; small passive trinkets; body weight from eating | Five work rates, capped 5, 8, 12% by tier (`wear_effect_max_pct`); a set adds 20%; health is the one bar (G32) | Attribute bonuses by tier, a soft wear requirement, garment traits at a grade, a capped minus (PROGRESSION 5.4 to 5.7) | Same in kind, small passives; apart in frame: no cores, no body weight | The attrs, the traits, the requirement: a kernel read and a check |
| Gear on the body | Every outfit, hat, coat and boot the Trapper makes shows on the body | Icons until stage 6 (ROADMAP); the races walk from one 128 px frame (#375); a creator's cap, a look (#402) | Layered wear from the 3D body (decisions 6, 41, 42 of 22.10) against ART_SYSTEM's "never gear drawn on the body" | Same by decision 6; one line of ART_SYSTEM contradicts it (section 5) | Every worn thing in every pose and view; the render line exists (`tools/anim`), the layers do not |
| Weapons wear and care | Weapons degrade with use; gun oil or a gunsmith cleans them; a trinket slows the wear | Tools wear by uses only (`tool.uses`, `wearTool` in `kernel/src/step.ts`); nothing wears by time | Tools and weapons wear by uses, armour and clothing never; `mend` is a recipe (PROGRESSION 5.4, #333) | Apart: a count, never a chore | Nothing new: the count exists |
| The economy | Pelts sell to the Trapper for cash at his price; perfect pelts are worth more spent on his crafting | Every price from its source, gather, dig, craft or a reaction (`kernel/src/values.ts`); the check refuses an item nothing gives | A fifth source, `hunt`, priced by the loop's time (HUNTING 9; COMBAT 4.9); the foundations pull request prices a hunted kind at the solver's medium effort tier and adds no `pay_per_s_mg` knob; HUNTING 9 names `combat.pay_per_s_mg` and its check row waits for that param (G85, proposed), which comes with the fight's wave (DECISIONS 2026-10-30) | Opposite: no price is written on an animal | The hunt source is in the foundations; a cap of the hunt's own waits for the combat param |
| Tone and rating | ESRB M (blood and gore, intense violence), PEGI 18; skinning shown; cruelty to town animals is a crime | PEGI 16 and ESRB T (TONE.md; G46 "Menace at the line", rewritten to it); no animal is harmed anywhere yet | No blood on an animal, no young, no pet, no suffering, no score, no meat from a person (HUNTING 10) | Opposite, by choice | Nothing to draw; one check row a rule |

Notes on the table.

- Today's five kinds are the sparrow, the crow, the trout, the hare and the roe deer, 17 spots,
  no behaviour and no goods (BESTIARY 3). The wolf is a prop under G30, not a creature.
- The Trapper's recipes, one example: a legendary bear coat is one legendary bear pelt, one
  perfect bison pelt and $28. Pearson's valuables satchel: one perfect beaver skin, one perfect
  rabbit skin, one perfect deer skin.
- Fence trinkets, two examples: the beaver tooth, weapon wear -10%; the owl feather, all cores
  +15%. The guides read disagree whether talismans give an effect or only a look.
- Red Dead Redemption 2's body weight has three states moved by eating; the guides read disagree
  on what each state does, so nothing more is claimed here.
- Spoilage detail: the cold highland doubles both spoil times; a predator comes to a carcass only
  in d2 (HUNTING 6). Spoilage is on the carcass; the bag has no per-unit data (section 5).
- #333 keeps the four rarities orthogonal to tier: a common thing carries at most one effect at
  the smallest step (PROGRESSION 5.7), so a first hide coat is plain.
- COMBAT 4.9 says it itself: "a hunted drop needs the solver's fifth source, `hunt`, which
  does not exist yet" (on `develop`; the foundations pull request adds it). The check refuses an
  item nothing gives (`tools/src/check.ts`).

## 3. The short answer

In concept the chain is already Red Dead Redemption 2's on most links: an animal with a grade
the hunter reads before the take, a tool that must fit the size, a carcass dressed into parts,
parts that spoil, gear made from them that gives a small passive help and shows on the body.
Where Loomvale is deliberately apart it is apart for a reason it wrote down: no horse (the bag
and the three paces carry, DECISIONS 23.10), no price written on an animal (the value solver
prices the loop, HUNTING 9), classes instead of named pelts (G45), a count of uses instead of a
cleaning chore, a stealth loop instead of a fight (HUNTING 1), and the rating's rules (HUNTING
10). Where it goes past it is the player's own tanning and drying, a material grammar the
community extends, a free market, and a quality rolled at the craft instead of taken from the
animal alone. In what is built the distance is the whole hunt: the kernel has classes, tiers,
rarities, weight, eight slots, five work-rate effects, a craft that misses and tools that wear,
and not one creature, carcass, good, rack, grade, trait or weapon (the carcass, the dressing in
parts, the goods and the grades are code in the hunt foundations pull request, waiting to merge).
The designed part (HUNTING.md on `develop`, #333) covers every link but the drawing; the drawing of gear on the body and of an animal that moves
is decided (22.10, 29.10) and not started.

## 4. Where Loomvale goes past it

- **A material grammar the community extends.** A recipe asks for a class at a lowest tier, so a
  creator's new hide works in an old leather recipe without a new recipe (G45;
  `schema/src/index.ts`, the template inputs). Red Dead Redemption 2's recipes name one pelt
  each and end where its list ends.
- **Two ladders plus a quality.** The tier says how advanced, the rarity how often (G41), and
  #333 adds a quality rolled at the craft. A grade from the animal and a quality from the hands
  are two things a player can get better at.
- **Sets a creator owns.** A full set of one creator grows its effects by `wear_set_bonus_pct`
  (`Wear.set`), so a hide set is a creator's signature, not a studio's.
- **A free market between players.** Decided 9.10 ("The free market comes right after crafting
  wave 4"); a made hide coat sells inside the value's band (PROGRESSION 5.5). Red Dead
  Redemption 2 sells to a fixed shopkeeper only.
- **No price written on an animal.** The hunt source prices a drop by the time its loop takes
  (HUNTING 9), so a creator cannot make a rich animal. The foundations pull request prices a
  hunted kind at the solver's medium effort tier and adds no `pay_per_s_mg` knob; HUNTING 9
  names `combat.pay_per_s_mg` and its check row waits for that param (G85, proposed), so whether
  a hunt needs a cap of its own is settled with the fight's wave, which brings the param
  (DECISIONS 2026-10-30).
- **The hunt as a stealth loop first.** The first take needs no weapon: a thrown stone, then a
  snare (HUNTING 5). The approach, the head-down rhythm and the freeze are the skill; the weapon
  comes with combat and adds reach, not the loop.
- **No paid power.** G39: no pelt, recipe, trinket or coat for money; a look may be bought and
  counts for nothing. A trinket bound to a purchase has no equivalent here (whether the Fence
  sells one is not checked here).

## 5. Rule conflicts this chain meets

| Rule or decision (quoted, dated) | What the chain wants | The reading |
|---|---|---|
| G35 "No fighting in the demo" (8.10; holds for the demo, 19.10) | A take that fells an animal | A hunt is not a fight: no bar, no exchange of blows, a strike only on unaware prey (HUNTING 1) |
| G34 "the answer is a run, never gear" (9.10, 10.10) | A coat with `cold_proof` against the highland's frost (PROGRESSION 5.7, Q8, #333) | G34 names hazards that hunt; cold is a condition; #333 bends it for conditions only, never for a predator |
| G45 "a new verb, station, profession, effect or parameter comes in a core release" (9.10) | The dressing verb, two racks, a protection effect | All core releases (HUNTING 7, 12); extensions add goods as items in the five core goods classes and recipes over them; a class of their own under `animal` is content, not a good of the hunt (the check admits a drop only from the five), and a hunted kind is core, on the map |
| The bag is item id to count (`kernel/src/state.ts`; a stack of ten, 23.10) | A grade per good (HUNTING 5); a quality per made thing (PROGRESSION 7, #333) | No per-unit data exists; a grade or quality is its own item id, or the bag reshapes (question 1) |
| TONE 3 "a trail of blood where a hurt animal went" (19.10) | HUNTING 10 "No blood on an animal" | TONE allows, HUNTING chooses the stricter line until a still is seen (question 8) |
| HUNTING 1 "no bar over an animal" (29.10) | Round 3 "a bar over every head in a fight" (20.10); 25.10 "hunted and fought" | Prey is never in a fight; a defender or hunter carries a bar from the tick it engages, never grazing |
| ART_SYSTEM 3 "never gear drawn on the body" (20.10) | Decisions 6, 41, 42 of 22.10: layered wear from the 3D body; ROADMAP stage 6 | The 22.10 decisions are the owner's and later; ART_SYSTEM's line gets a one-line fix; dyes colour a layer |
| PROGRESSION 5.4 "armour and clothing never wear out" (#333) | Red Dead Redemption 2's degradation of what is carried | Keep: a hide coat never frays; tools and weapons wear by uses; a mend is a recipe, never a timer |
| G32 "Health is the one bar" (8.10) | Cores, warmth and body weight that gear fills | No core, no body weight; gear moves attributes and rates (PROGRESSION 5.6); food heals (G32) |
| G39 "Power is never sold" (9.10) | A Fence trinket for money (whether the reference game sells one is not checked here) | Keep: a trinket is a jewelry piece from a rare find, traded for gold, never for money |
| G46 "Menace at the line" (rewritten 29.10: PEGI 16 and ESRB T, the tighter one holds; blood where a hit lands, small and brief; a wound that stays as a bandage or a scar; a predator drawn biting; a body that lies) | The hunt's images: a take as a fade, no blood on an animal (HUNTING 10) | Resolved: the hunt's images are measured against the rewritten G46, which allows more than HUNTING 10 takes; HUNTING 10 keeps the stricter line for animals until a still is seen (question 8) |
| HUNTING 10 "No young animal is prey", no pet, no suffering, no score (29.10) | Nothing; they cost no mechanic | Keep as check rows (HUNTING 12) |

Notes on the table.

- G35: the hunt loop is built after the server (NEXT 18) and the creature schema; the demo keeps
  G35 whatever lands first.
- G34: the bend is written into G34's text when #333 lands, so the rule is read from one place
  and never inferred from a design page.
- Round 3: the 25.10 entry's "fought" is the d1 and d2 tiers (BESTIARY 1); prey at d0 is hunted
  and never fought, so it never shows a bar.
- ART_SYSTEM: decision 6 says why the layers are cheap: "the unclothed base plus layered
  equipment, each layer in every pose and direction, is far cheaper from a 3D model".
- G32: a place's conditions act on the clock, "a pure function of the region, the hour and the
  day's weather" (PROGRESSION 7), never on a second bar.

## 6. The owner's questions

Each in one sentence, three options, A the recommendation, and the default if unanswered.

1. **How is a good's grade held in the bag?**
   A (recommended): an item per grade, the finer ones naming the plain good
   (`grade: { of, step }`, as the foundations pull request writes it); a stack per grade; the
   screen shows a word (plain, "fine", "true": the schema's three), never the number.
   B: one item per good and the grade folded into the quantity (a true hare gives 2 meat, a
   plain one 1).
   C: per-unit instances in the bag, a reshape of `bag` and every save.
   Default if unanswered: A.

2. **Are the five goods classes, families or tags?**
   A (recommended): five core class files declared under `animal` (`meat`, `hide`, `bone`,
   `sinew`, `feather`), so a template asks for `hide` at tier 1 and a creator's boar hide fits.
   B: families inside `animal` (`family: hide`), no new class files.
   C: tags on the item.
   Default if unanswered: A.

3. **What is the dressing on screen?**
   A (recommended, and what the foundations build): one `dress` action per part of the
   carcass, six steps a part (HUNTING 6's 6, 12 or 24 steps by size: a small animal one action,
   a medium two, a large four, each inside `max_action_ms`); the goods come with the last part
   and the whole carcass is taken; what the bag cannot hold lies on the tile. A raw good has no
   price anywhere (`salePrice` returns nothing for it, the sale refuses).
   B: one action per good with a choice, "take it all" or "the best part" (HUNTING 6's
   wording); the "best part" choice would change what the foundations build.
   C: an instant take, the carcass a container that is emptied at once.
   Default if unanswered: A.

4. **Where does spoilage live?**
   A (recommended): on the carcass only; what is in the bag does not spoil, and the clock is
   the time a carcass lies.
   B: on the raw goods in the bag, which needs a per-unit clock (question 1 C).
   C: no spoilage.
   Default if unanswered: A.

5. **Which station processes a hide and dries meat?**
   A (recommended): the drying rack and the tanning rack as two new core stations in one pull
   request (HUNTING 7).
   B: the workshop stands in for both until the racks are drawn.
   C: the fire for both.
   Default if unanswered: A.

6. **What does gear give first?**
   A (recommended): garment traits in words plus attribute bonuses by tier with the soft wear
   requirement, as #333 proposes (5.6, 5.7).
   B: a protection number only, with combat.
   C: looks only until combat lands.
   Default if unanswered: A.

7. **How is gear drawn on the body?**
   A (recommended): layered slots rendered from the 3D body at the 50 degree camera
   (`tools/anim/README.md`), as decisions 6 and 41 say, one layer per slot in every pose and
   view.
   B: baked outfit sheets per set, the whole body re-rendered per outfit.
   C: icons only until stage 6.
   Default if unanswered: A.

8. **Blood on a hunted animal?**
   A (recommended): none; a take is a fade and a drop of goods (HUNTING 10).
   B: a trail of a few pixels where a hurt animal went (TONE 3), shown as a still first.
   C: none now, revisit with the first still of a defender.
   Default if unanswered: A.

## 7. The order

| What | Stage, and when | What it waits on |
|---|---|---|
| This page, and the one-line fix to ART_SYSTEM 3 | Now | Nothing |
| The materials atlas: HUNTING 8's thirteen animals' goods as class, tier, weight and source; the found goods below them | Now, docs | Nothing |
| Creator content of found goods: a shed antler, dropped feathers, fish bone, as `animal` items from nodes and digs | Now, extensions; the check prices and admits them | Nothing |
| The hunt foundations: the carcass, the `dress` action in parts, the goods grammar, the grades, the `hunt` source and its check rows; additive and dormant until something fells an animal (DECISIONS 2026-10-30); the take itself is not in it | Now, the hunt foundations pull request | Questions 1 to 4 (written on their defaults) |
| The creature schema (HUNTING.md, its status line: "the creature schema is the next pull request"): states, senses, spawns, the check rows | Next, core | Nothing: HUNTING.md is on `develop`; the foundations' `hunt` block moves under the schema when it lands (DECISIONS 2026-10-30) |
| The hunt loop: T0 and T1, the hare and the fowl, the dressing, cooked meat at the fire | After the server (NEXT 18) and the schema; the demo keeps G35 | The schema; the `hunt` source in `values.ts` |
| The racks: drying and tanning, two core stations, the first leather chain | With the hunt loop or right after | Question 5 |
| The G34 text with #333's bend (G46 is already rewritten to TONE's line, 29.10) | With #333 | The owner's yes on #333 |
| Gear traits and attributes (#333, 5.6 and 5.7) and the quality roll | The stage-3 tree wave, as #333 orders it | #333 merged; question 6 |
| Weapons: the spear, the bow, the defenders (DEFEND) | The combat wave (G35; COMBAT 4.9) | The presence relay (round 1); the technique format |
| Gear drawn on the body: one layer per slot from the 3D body | Stage 6, once the cast's own sheets land (DECISIONS 25.10) | Question 7; the trial-3 contact sheet |
| Animals that move: the quadruped target, four poses a loop (DECISIONS 29.10) | The art stream, after the roe deer's look pick (BESTIARY 5 b) | The pick; the native target in `tools/anim` |
| The crafting gestures: new props for the clip tool, a knife, a hide, a needle; the dressing and tanning poses | With the racks' art | The prop targets in `tools/anim` |

Sizes, by code and not by hours: the goods grammar and the hunt source are small and additive;
the creature schema and the states are the one large piece; the racks are two camp parts and
two chains; the layers on the body cost a render per layer per pose, which is why decision 6
chose the 3D route.

## 8. What not to copy

- **Gore and the skinning close-up.** The take is a fade and a drop of goods (HUNTING 10). No
  camera on a carcass.
- **Animal suffering.** No death throes, no cry, no finishing a downed animal (HUNTING 10;
  BESTIARY 2).
- **The weapon-cleaning chore.** Tools and weapons wear by uses; a mend is a recipe (PROGRESSION
  5.4, #333). No oil, no red bar to tend.
- **Real-money anything.** No pelt, recipe, trinket or coat for money, and no part bound to a
  purchase (G39; whether the reference game sells such parts is not checked here).
- **The horse as a cargo system.** No mount is decided; the bag, the back slot and the three
  paces carry (DECISIONS 23.10).
- **A kill count or a hunting log as a score.** Harm to animals is never a count, a board or an
  achievement (HUNTING 10). The journal may keep the collection of goods, never of kills.
- **Weight of the player's body from food.** Health is the one bar (G32); might sets the load
  (DECISIONS 23.10).
- **Legendary-animal exclusives sold for money or bound to a purchase** (not checked here for
  the reference game). A rare animal's part is a rare find priced by the solver and traded on
  the market, nothing more.

## Sources

In this repository, read at `develop` @ 71ba090 and in the open pull requests:

- [GAP_DIMRAETH_DRAKANTOS.md](GAP_DIMRAETH_DRAKANTOS.md) and [GAP_WOW_RS.md](GAP_WOW_RS.md):
  the format of this page.
- [TONE.md](TONE.md): the rating line, section 3 on blood. [GAME_RULES.md](GAME_RULES.md):
  G32 to G35, G38 to G47.
- [BESTIARY.md](BESTIARY.md), [ANIMATION.md](ANIMATION.md), [ART_SYSTEM.md](ART_SYSTEM.md)
  section 3, [CRAFTING_AUDIT.md](CRAFTING_AUDIT.md) sections 5 and 6.
- [HUNTING.md](HUNTING.md) (all of it) and [COMBAT.md](COMBAT.md) section 4.9, on `develop`.
  #333: `docs/design/PROGRESSION.md` sections 5 and 7. #424: the gaits decision. #375: the races'
  walk by distance. #402: the traveller's cap, a look item.
- DECISIONS.md: 2026-10-09 (the crafting audit answers Q5 to Q9, Q11, Q12; crafting wave 2 as
  built; the free market); 2026-10-22 (decisions 6, 41, 42); 2026-10-23 (combat rounds 1 to 5;
  words on screen; weight and the three paces; bags on the back); 2026-10-25 (the ambient
  creatures wait; characters are made industrially); 2026-10-29 (movement).
- Code: `schema/src/index.ts` (`BASE_CLASSES`, `WORN_SLOTS`, `WORN_EFFECTS`, `Wear`, `ItemDef`); `kernel/src/state.ts` (`bag`); `kernel/src/step.ts` (`craftChanceBp`, `missOutcome`, `wearTool`); `kernel/src/values.ts`; `tools/src/check.ts`.
- Content and tools: `content/core/params.json` (`wear_effect_max_pct`, `wear_set_bonus_pct`, `gait`); `content/core/items/outfits.json`; `content/core/resources/river-fish.json`; `content/core/map.json` (`creatures`); `tools/anim/README.md`; `docs/art/DRAWERS.md`; `ROADMAP.md` stage 6.

Red Dead Redemption 2, the pages read (no videos):

- RDR2.org, "How to Get a Perfect Pelt": https://www.rdr2.org/guides/how-to-get-a-perfect-pelt/ (stars, weapon by size, clean kill, cover scent, the Buck Antler trinket)
- RDR2.org, the guides index: https://www.rdr2.org/guides/ (the count of 178 animals, from the index's own line; the locations guide itself was not opened)
- Gameranx, "How To Get Perfect Pelts": https://gameranx.com/features/id/164449/article/red-dead-redemption-2-how-to-get-perfect-pelts-hunting-guide (the five size classes and their weapons)
- Accelerated Ideas, "How to Get Perfect (3 Star) Pelt": https://www.accelerated-ideas.com/news/red-dead-redemption-2-how-to-get-perfect-3-star-pelt.aspx (animal quality and kill quality)
- SegmentNext, "Hunting Guide": https://segmentnext.com/red-dead-redemption-2-hunting (three carcasses on a horse, decay with time and weather, bait, Pearson)
- RDR2.org, "Potent Predator Bait Guide": https://www.rdr2.org/guides/potent-predator-bait-guide/ (bait crafted from berries and fish, staying downwind)
- Shacknews, "Trapper guide: crafting, clothing, and prices": https://www.shacknews.com/article/108171/trapper-guide-crafting-clothing-and-prices-red-dead-redemption-2 (the outfit recipes and prices)
- RDR2.org, "Pearson Crafting Guide": https://www.rdr2.org/guides/story-mode/pearson-crafting-guide/ (the three satchels)
- PowerPyx, "How to Get Trinkets": https://www.powerpyx.com/red-dead-redemption-2-how-to-get-trinkets/ (fifteen trinkets at the Fence and their effects)
- RDR2.org, "Cores Guide": https://www.rdr2.org/guides/red-dead-redemption-2-cores-guide/ (cores against bars, the 90 minutes, clothing and weather)
- RDR2.org, "Hunting Request Guide": https://www.rdr2.org/guides/hunting-request-guide/ (five posters, nineteen perfect small carcasses)
- PowerPyx, "How to Repair Weapons": https://powerpyx.com/red-dead-redemption-2-how-to-repair-weapons (gun oil and degradation, from the search summary)
- ESRB, "Red Dead Redemption 2": https://www.esrb.org/ratings/35888/Red+Dead+Redemption+2/ (M, the descriptors)
- Red Dead Wiki, "Animal Cruelty": https://reddead.fandom.com/wiki/Animal_Cruelty (the in-game crime; from the search summary, the page itself did not open here)
- Body weight in three states moved by eating: search summaries only (Steam discussions, cyberpost.co); the guides disagree on what each state does, so this page states the states and nothing more.
