# The hunt families: one body, one way of hunting, one ladder of goods per family (2026-10-30)

**Status:** Proposed 30.10, written for the owner. Nothing here is built but the coat format, which is in #433. It builds on [HUNTING.md](HUNTING.md) (cited "HUNTING n"), [BESTIARY.md](BESTIARY.md) ("BESTIARY n"), and two pages of #432 that are not merged yet, BESTIARY_LANDS.md ("LANDS n") and MATERIALS.md ("MATERIALS n"), and on [CREATURE_BEHAVIOUR.md](CREATURE_BEHAVIOUR.md) ("BEHAVIOUR n"), proposed beside it. Every number below is quoted from those pages with its section; a number or a kind this page adds is marked proposed.

The ask behind it, 30.10: many more creatures over time, organised in families, each family with a hunting style of its own, a difficulty fitted to it, and goods to gather from it.

**Why families.** A family is one body and one rig, so a new member is a look, a scale and a row of numbers, not a new model: the clip tool renders a body's own actions through its native target (ANIMATION 5.4), and a family's members share that body under another ramp, as MATERIALS 6 already does for the goods ("the family changes the coat ramp on one drawing, not the drawing"). A family is one hunting style, so a player who learns the family learns its members: the stalk that takes a roe deer takes a white hart, at a longer sight. And the difficulty climbs inside the family, across the lands and the distance from the town (d0, d1, d2; G64: `d` is the steps from the town divided by 64), with the four levers LANDS 1 names and never a hit-point number: a longer take, a higher way on the tool ladder, a higher danger, a thinner spawn.

What it does not reopen: the ten states, the noticing count and the noise table (HUNTING 2 to 4); the tools by tier (HUNTING 5); the five goods and the carcass (HUNTING 6); the caps (HUNTING 8 and 9); the rating's rules (HUNTING 10); G34 (a predator on its round is a hazard escaped by a run) and G35 (no fighting in the demo), so every `fight` way below waits for the combat stream and a defender only bluffs until then (HUNTING 11, question 1).

## 1. The words

- **Family:** a set of kinds that share one body, one hunting style and one shape of drops. A kind belongs to exactly one family.
- **Style:** the family's own combination of a tool, a way, a place and a temperament, which no other family shares whole (single tools such as the snare, the pit and the sling recur across families), built only from what exists or is designed: the tools T0 to T5 (HUNTING 5), the ways `stalk`, `snare`, `lure`, `fish`, `fight` (LANDS 1), the noticing count (HUNTING 3), and the temperament fields `flight`, `sleeps`, `alarm`, `looks_back`, `drinks`, `carrion` and the fire and water codes (BEHAVIOUR 1 and 5).
- **Tell:** what the player reads on screen before the animal acts (BESTIARY 2, rule 9).
- **Mark:** the one good only that family gives, where the sources name one (section 5).
- Senses are sight / ear / smell. The ear is written as LANDS and BESTIARY write it (keen +2, normal +1, dull 0); HUNTING 3 writes the ear as -2, 0 or +2, a disagreement section 9 lists.

## 2. The families

Eighteen families hold the thirty-one kinds of LANDS 2 and 3 (the carrion crow is one kind in two lands, as BEHAVIOUR 5 counts it). Land: V the valley and the east highland, E the elf wood, S the undead south. Tier and danger are LANDS'.

| # | Family | Members (land, tier, danger) | Shared body | How the members differ |
|---|---|---|---|---|
| 1 | Burrowers | hare (V, 1, 0); barrow rat (S, 1, 0) | a small quadruped that sits up and bolts; `flight` B, home is the anchor (BEHAVIOUR 5) | look: sandy and long-eared against grey and long-tailed; senses 6 / +2 / 0 against 3 / +1 / 5; hours 05-20 against 20-05 and any hour under a roof |
| 2 | Deer | roe deer (V, 1, 0); white hart (E, 3, 0) | a slender grazer that lifts its head, drinks and looks back | scale: medium against large (LANDS 2, 3.1); sight 8 against 9; alarm 4 against 8, so the hart lifts the glade (BEHAVIOUR 5) |
| 3 | Wild goats | highland goat (V, 2, 0) | a sure-footed climber that stands on a high tile; `flight` C, `sleeps` rock | one member; open slots in section 6 |
| 4 | Pigs | wild boar (V, 2, 1) | a low, heavy defender with tusks | one member; open slots in section 6 |
| 5 | Canids | wolf (V, 3, 2); silver fox (E, 2, 0); shade fox (S, 2, 0); bone hound (S, 2, 1) | a long-legged quadruped; every member is `carrion` yes (BEHAVIOUR 5) | scale: fox small, wolf and hound medium; look: grey, silver, black, a dry-hided hound; danger 0, 1, 2 across the members |
| 6 | Cats | wildcat (V, 3, 1); wood lynx (E, 3, 2) | a crouched climber that holds still and watches; alarm 0, `carrion` no | scale: small against medium; sight 7 against 8; danger 1 against 2 |
| 7 | Bears | white bear (V, 3, 2) | a large, heavy sleeper in a den ring | one member; a den sleeper whose ring is its hazard: alarm 8, `carrion` yes, water W, a wall, as to every hunter (BEHAVIOUR 5) |
| 8 | Game birds | ground fowl (V, 1, 0); wood dove (E, 1, 0) | a plump bird in a flock of 5 to 12 that bursts as one (alarm 5) | look: speckled hen against grey dove; the fowl runs then flutters (`flight` G), the dove flies (F); sight 5 against 6 |
| 9 | Perching birds | carrion crow (V and S, 1, 0); sparrow (V, no `hunt`) | a small perching bird that lifts and returns | the crow is the valley's sentinel and comes to carrion; the sparrow gives only a moult (LANDS 2) |
| 10 | Waterfowl and waders | grey heron (E, 1, 0); wild goose (E, 1, 0) | a long-necked bird of the water's edge, `sleeps` reeds | the heron stands alone (weights 60/30/10), the goose feeds in a skein with a watcher; small against medium |
| 11 | Raptors | great eagle (E, 3, 1) | a large bird of the bare crest | one member; open slots in section 6 |
| 12 | Mustelids | river otter (E, 1, 0); tree marten (E, 2, 0) | a long, low body that keeps to one run | the otter swims (S), the marten climbs (C); hours 05-22 against 18-06 |
| 13 | Fish | trout (V, 1, 0) | a fish under the water, a ripple ring | one member; open slots in section 6 |
| 14 | Reptiles | dust adder (V, 2, 1) | a coil on a warm rock | one member; open slots in section 6 |
| 15 | Night fliers | ash bat (S, 1, 0); moon moth (E, no `hunt`); grave moth (S, no `hunt`) | the bat's wing body; the moths are state kinds with no drawn body, drawn as a cloud (BEHAVIOUR 5) | only the bat is hunted; all three are drawn to a lamp (fire code D, BEHAVIOUR 5) |
| 16 | Horned beasts | cinder imp (S, 3, 1); barrow fiend (S, 5, 2, no `hunt` until tier 5 opens) | a horned beast in shape, no face that speaks (LANDS 6, question 4) | scale: small against large; the imp throws an ember, the fiend is a hazard |
| 17 | Spiders | tomb spider (S, 3, 1) | an eight-legged web holder | one member |
| 18 | Drakes | ash drake (S, 8, 2, no `hunt` until tier 8 opens) | a large winged landmark | one member, not prey in the first ring (LANDS 6, question 2) |

Counted: 2 + 2 + 1 + 1 + 4 + 2 + 1 + 2 + 2 + 2 + 1 + 2 + 1 + 1 + 3 + 2 + 1 + 1 = 31.

Two placements are choices, asked in section 10: the bone hound sits with the canids, on the wolf's body, though LANDS 3.2 counts it among the south's three demons; the moths sit with the bat for their habits, though they have no drawn body and no `hunt`.

## 3. The hunting styles

One style a family. Each names the tell, the act, what fails, and the source rows.

### 3.1 Burrowers: the snare on the line home

- **Style.** A burrower's flight ends at its own anchor and it is gone into it for 8 steps, then WANDER (`flight` B, BEHAVIOUR 1), so its run is the one predictable run in the game: from where it grazes back to its form. The snare (T1) sits on that line, on the trail sign between the form and the meadow (HUNTING 5: "small prey on a trail sign"), and the hare finds it on its way back. Putting the hare up on purpose so it runs into the snare is proposed: it needs a snare that catches a fleeing kind crossing its tile, a new rule for HUNTING 5. The unaware one can also be stoned (T0, range 3) while its head is down.
- **Tell.** The sit-up, the hare's only one: it has no alarm and no voice (BEHAVIOUR 5, "the hare has no voice and no water"). The rat's tell is the scatter, "the hall's first tell" (LANDS 3.2).
- **Fails.** A snare off the line catches nothing; a hare that reaches its form is gone into it for 8 steps, then WANDER (BEHAVIOUR 1). A crow can take what the snare holds (HUNTING 5), so a snare left past a day may be empty.
- **Sources.** HUNTING 3 and 5; LANDS 2 (hare: stalk, snare) and 3.2 (rat: snare, stalk); BEHAVIOUR 1 (`flight` B) and 5.

### 3.2 Deer: the stalk at the water at dawn

- **Style.** Deer drink (`drinks` yes) and walk to water at dawn and at dusk (BEHAVIOUR 4, proposed), so the hunt is laid at the bank at first light. The player moves only while the head is down and freezes when it lifts: "a player who moves only while the head is down, and freezes when it lifts, is never noticed at the outer half" (HUNTING 3). The shot is the bow (T4, range 8) on an unaware animal, or the spear (T3, throw 4) closer; a snare on a trail is the patient way (LANDS 2 and 3.1). The numbers make the head-down beat the moment: the roe's sight is 8, 6 while it grazes (GRAZE is "sight 2 shorter", HUNTING 2), so the bow's 8 reaches it only head-down or from tall grass (2 off every sight, HUNTING 3); the hart's 9 becomes 7 the same way.
- **Tell.** The head up for two steps of GRAZE at full sight (HUNTING 2); for the hart, "head up for two steps before it goes, and the whole glade lifts with it" (LANDS 3.1).
- **The look-back.** At the end of FLEE a deer takes two steps of ALERT at sight + 2, facing the player (BEHAVIOUR 1). For those two steps the roe notices at 10 tiles, so any player within the bow's 8 is already seen: the look-back is no second shot, it shows the player where the deer settles, and the stalk starts again from there after the 60 steps it keeps away from the tile it fled (HUNTING 2, FLEE).
- **Fails.** A move during the head-up; a walk inside its ear (walk 5 + 2 = 7 tiles); the herd: every member within 8 tiles goes to ALERT with the one that saw (HUNTING 2).
- **Sources.** HUNTING 2, 3, 5; BESTIARY 1 (roe: "snare; bow or spear on an unaware animal"); LANDS 2 and 3.1; BEHAVIOUR 1, 4, 5.

### 3.3 Wild goats: the bow from below the ledge

- **Style.** The goat stands on a high tile, hears little (dull, 0) and sees far (8) (BESTIARY 1). So the approach is the opposite of the deer's: the player may walk (noise 5, heard at 5 tiles) but must stay out of the line from the ledge, coming from below, and shoots the bow from there (BESTIARY 1: "bow from below; snare at a ledge path"). The goat flees upward (`flight` C), so the snare waits on the ledge path it climbs.
- **Tell.** The goat turns on its high tile to face the source (ALERT, HUNTING 2); a herd of 5 to 12 lifts together (BEHAVIOUR 5, alarm 3).
- **Fails.** Standing in its line of sight on open slope; a snare below the ledge rather than on the climb.
- **Sources.** BESTIARY 1; LANDS 2 (stalk, bow from below, snare); BEHAVIOUR 5.

### 3.4 Pigs: the pit and the charge in a line

- **Style.** The boar is a defender (danger 1): it "holds its ground facing the player; if the player stays within 2 tiles for 2 steps, or it is cornered or hit, it charges up to 5 tiles in a line and rests 6 steps" (HUNTING 2, DEFEND). Its ways are `fight` and `lure`, a pit with bait (LANDS 2); its gate is "spear from a ledge; pit trap with bait; never head on" (BESTIARY 1). So the boar is hunted by its hours and its charge: the pit (T5) is dug and baited while the boar sleeps in its den (09-19, BEHAVIOUR 4) and found after its evening or morning window (19-23, 05-09), and once the fight exists the charge is read and side-stepped, because it runs in a line and then rests.
- **Tell.** The low head held toward the player; until the fight it only bluffs, ALERT and its pose (HUNTING 2 and 11, question 1).
- **Fails.** Standing head-on within 2 tiles; digging in its waking hours (the dig is a noise of 5, HUNTING 4); before the fight there is no contact and no take but the pit.
- **Sources.** HUNTING 2, 4, 5, 11; BESTIARY 1; LANDS 2.

### 3.5 Canids: the laid bait at a dead end

- **Style.** Every canid comes to carrion (`carrion` yes for all four, BEHAVIOUR 5), and every canid's lure is a laid bait: a fowl's leavings for the silver fox, a bone for the shade fox, bait after the fight for the wolf, a pit after the fight for the hound (LANDS 2, 3.1, 3.2). The bait goes where the fox already goes, "the trail's dead ends" (LANDS 3.1), with a snare at it for a fox; the wolf's bait and the hound's pit wait for the fight. The player leaves the bait and returns, as with any snare (HUNTING 5).
- **Tell.** The look-back: the fox "sits and looks at the player before it goes" (LANDS 3.1), the shade fox "looks back from the edge of the lamp's light" (LANDS 3.2); the wolf holds at a fire's edge facing in (BEHAVIOUR 2, fire).
- **Fails.** A bait in the open meadow, where no canid ranges; a wolf baited before the fight, which LANDS 2 puts after it (HUNTING 8 reads "with the fight, or the pit trap", section 9); a hound pitted before the fight, since a defender only bluffs until then (HUNTING 11, question 1; LANDS 3.2).
- **Sources.** HUNTING 5, 8 and 11; LANDS 2, 3.1, 3.2; BEHAVIOUR 2 and 5.

### 3.6 Cats: the baited snare set while it sleeps

- **Style.** A cat never comes to a carcass (`carrion` no) and has no voice (alarm 0); it climbs and holds still (BEHAVIOUR 5). Its way is a baited snare (LANDS 2: wildcat "lure (a baited snare)"; LANDS 3.1: lynx, the same after the fight), set on its own trail through cover, the wood's rocks and fallen trunks or the grove, by day while it sleeps (hours 20-05 and 19-07), and checked once a game day (HUNTING 5).
- **Tell.** A silent kind, so the tell is a pose only: proposed, the crouch flattening, ears back, for two steps before it goes (BESTIARY 2, rule 9, asks a drawn tell of a silent kind); otherwise the cat is read by the still shape in cover; the lynx "holds still and watches, tufted ears, and chases only when the player is already close" (LANDS 3.1).
- **Fails.** Setting the snare at night, when it is awake; baiting with a carcass, which draws the canids and the crows instead.
- **Sources.** BESTIARY 1 (wildcat: "baited snare or box trap"); LANDS 2 and 3.1; BEHAVIOUR 5.

### 3.7 Bears: the ice pit at the edge of the den ring

- **Style.** The white bear sleeps in its den ring by day (hours 20-07) and its gate is "avoid its ring of 8 tiles; late ice pit with bait" (BESTIARY 1). The pit (T5) is dug by day just outside the ring, so the digging noise (5) never reaches a bear with a dull ear (0) at 8 tiles, baited, and found at dawn. The river is a wall to the bear as to every hunter (water W, BEHAVIOUR 5), so the bank is no refuge from it on its round; the answer is to stay out of its ring (G34). The pit is taken before the fight, as LANDS 2 and BESTIARY 1 give it and HUNTING 8's "or the pit trap" allows (section 9).
- **Tell.** The den ring itself, seen by day; its alarm of 8 (BEHAVIOUR 5) when it wakes.
- **Fails.** Entering the ring; digging inside it, where the dig's noise of 5 reaches the den.
- **Sources.** BESTIARY 1; LANDS 2 (fight, lure: the ice pit); HUNTING 4 and 5; BEHAVIOUR 5.

### 3.8 Game birds: the sling from beyond its sight

- **Style.** The sling (T2) reaches 6 tiles (HUNTING 5) and the ground fowl sees 5 (BESTIARY 1), so the fowl is the one bird slung from outside its own sight, with a sneak (3 + 1 = 4 tiles heard) that never reaches it. The dove sees 6 (LANDS 3.1), the sling's own reach, so it needs tall grass (2 off its sight) or its head down. The snare under the roost is the second way (LANDS 2, 3.1).
- **Tell.** The flock's burst: a clatter that is itself a noise of 5 others hear (LANDS 3.1, BEHAVIOUR 5, alarm 5).
- **Fails.** One shot that misses lifts the whole flock of 5 to 12 (BEHAVIOUR 5, herd).
- **Sources.** HUNTING 3 and 5; BESTIARY 1; LANDS 2 and 3.1; BEHAVIOUR 5.

### 3.9 Perching birds: snared at a carcass

- **Style.** The crow comes to a carcass 30 steps after it is left (HUNTING 6; BEHAVIOUR 2, carcass), so the crow is taken with a snare at what the player left first; a sling stalk is possible (LANDS 2) but rarely pays: it is the valley's sentinel, with the sparrow and the fowl at alarm 5 (BEHAVIOUR 5), and lifts on the player's noise. The sparrow is not hunted; its moult under the perch is a resource node (LANDS 2).
- **Tell.** The caw, an alarm of 5 that puts the hare and the deer up too (BEHAVIOUR 1, `alarm`; proposed, BEHAVIOUR 8, question 5, default A).
- **Fails.** A stalk in the open: the crow sees 7 and its burst is a noise of 5 others hear (HUNTING 8).
- **Sources.** HUNTING 6 and 8; LANDS 2 (crow: snare, stalk with a sling); BEHAVIOUR 1, 2, 5.

### 3.10 Waterfowl and waders: from the reeds, past the watcher

- **Style.** The heron is taken with a thrown stone while it wades (LANDS 3.1) and it stands far more than it moves (weights 60/30/10, BEHAVIOUR 1). Its sight is 8 in front and 4 behind (`ceil(sight / 2)`, HUNTING 3); from the reeds' cover (2 off every sight) the rear radius is 2 if the 2 comes off after the halving (`ceil(8 / 2) - 2`), and the stone's 3 is thrown from outside it; if it comes off before (`ceil(6 / 2)`), the radius is 3, the stone's full reach, and the heron senses the thrower. HUNTING 3 does not give the order (section 9). The goose feeds in a skein where "one goose watches while the rest feed" (LANDS 3.1): the watcher is the one to beat, sight 7, 5 from tall grass, and the sling's 6 reaches past it.
- **Tell.** The heron "lifts slowly, a tell of two steps"; the goose's honk is an alarm of 6 (LANDS 3.1, BEHAVIOUR 5).
- **Fails.** An approach in the open along the bank; a shot while the watcher faces the player.
- **Sources.** HUNTING 3 and 5; LANDS 3.1; BEHAVIOUR 1, 3 (the riverbank), 5.

### 3.11 Raptors: the bait on the open crest

- **Style.** The eagle lives on the bare crest and is "never under the canopy" (LANDS 3.1); its ways are `fight` and a pit with bait (T5) after the fight. So the bait lies on the open crest and the player waits under the last trees, where it does not come.
- **Tell.** "A stoop that stops a tile short" (LANDS 3.1), its bluff.
- **Fails.** Before the fight there is no take (G35).
- **Sources.** LANDS 3.1; HUNTING 5 and 11.

### 3.12 Mustelids: the snare on the run off the ground

- **Style.** Each keeps one run: the otter its slide into the stream, the marten its branch (LANDS 3.1: otter "snare (at the slide)", marten "snare (on a branch)"). With the bat's net at its roost, these are the only snares set off the ground, and the only ones on a moving animal's run; the otter is also lured with a fish.
- **Tell.** The otter "slides into the water and is gone, a ring on the surface"; the marten's "scold from the branch above is its alarm" (LANDS 3.1).
- **Fails.** A ground snare; chasing an otter that has reached the water, where it is under for 8 steps (BEHAVIOUR 1, `flight` S).
- **Sources.** LANDS 3.1; BEHAVIOUR 1 and 5.

### 3.13 Fish: the line at the rise

- **Style.** The `fish` way, the rod (LANDS 1); the bone hook is the trout line's (MATERIALS 3.3, "bone hook (the trout line, BESTIARY)"), and BESTIARY 1 adds "spear in the shallows". Trout rise at dusk (the reaction `core/fish-at-dusk`, its cue `fish_rise`, BEHAVIOUR 3) and, proposed, at dawn (BEHAVIOUR 4).
- **Tell.** The ripple ring (BESTIARY 1).
- **Fails.** Midday under the bank, when the fish are still.
- **Sources.** BESTIARY 1; LANDS 1 and 2; MATERIALS 3.3; BEHAVIOUR 3 and 4.

### 3.14 Reptiles: the throw from the edge of its sight

- **Style.** The adder sees 2 (HUNTING 8), the shortest sight of any hunted kind, with the trout and the bat, and its way is "stalk (spear from 2 tiles), snare" (LANDS 2; BESTIARY 1: "snare on a rock"). The spear's 2 is the edge of its sight, so, as for the dove, the throw comes from cover (2 off) or while it basks with its head down, as the noticing count allows (HUNTING 3). It basks on a warm rock 06-20 and stays in when it rains (BEHAVIOUR 5, weather U). It is a defender, so until the fight it bluffs (HUNTING 11, question 1).
- **Tell.** The coil on the warm stone (BESTIARY 1).
- **Fails.** A step within its 2 tiles; a rainy day, when it is not out.
- **Sources.** HUNTING 8 and 11; BESTIARY 1; LANDS 2; BEHAVIOUR 5.

### 3.15 Night fliers: the net at the roost by day

- **Style.** The bat hears every gait one tile further than any keen-eared kind (+3, LANDS 3.2; only the tomb spider matches it) and roosts under a roof (BEHAVIOUR 5), where it is night at every hour and the south's kinds run the night column by day (BEHAVIOUR 3 and 4). So the net goes up at the roost while the bat is out at the lamps, and is found when it comes back to its beam (LANDS 3.2: "snare (a net at the roost)"). Its second way, "lure (a lantern)", is read here as a lamp prop with the proposed `light` flag (BEHAVIOUR 2), placed by the map, not by the player: BEHAVIOUR 2 has bats drawn to a lamp within 8 at night and the carried lantern read by no animal (section 9). No player-placed lamp is designed.
- **Tell.** "Once it lifts the hall knows" (LANDS 3.2).
- **Fails.** Any approach at a walk under the roof while it is at its beam; a carried lantern, which no animal reads.
- **Sources.** LANDS 3.2; BEHAVIOUR 2 and 5.

### 3.16 Horned beasts: after the fight, a coin by the brazier

- **Style.** Both members are `fight` first (LANDS 3.2); the imp's lure is "a coin in a snare, after the fight", the one bait that is neither food nor a light, laid by its brazier. The fiend has no `hunt` until tier 5 opens: a hazard escaped by construction.
- **Tell.** The imp's ember "that lands a tile short"; the fiend's horns at the descent (LANDS 3.2).
- **Fails.** Anything before the fight (G35).
- **Sources.** LANDS 3.2 and 6.

### 3.17 Spiders: never touch the web

- **Style.** The spider "feels the web, so a player who steps on a strand is noticed at any gait" (LANDS 3.2): its sense that matters is the strands, beyond its sight 3 and ear +3. The player reads the web and keeps off it; after the fight its lure is "a moth at the web", read here as a lamp prop near the web, with the proposed `light` flag and placed by the map, that draws the moths (BEHAVIOUR 2), state kinds with no `hunt` drawn as a cloud (BEHAVIOUR 5), since a moth is never taken (section 9).
- **Tell.** The strands across the hall's corner.
- **Fails.** One step on a strand.
- **Sources.** LANDS 3.2; BEHAVIOUR 2.

### 3.18 Drakes: seen, not hunted

- **Style.** None in the first ring: a landmark seen from the stair, asleep on its ledge by day, with no `hunt` until tier 8 (LANDS 3.2; LANDS 6, question 2, default A).
- **Sources.** LANDS 3.2 and 6.

## 4. Difficulty: the ladder inside each family

From LANDS 2, 3.1 and 3.2 (tier, danger, take, cap and refill), HUNTING 8 and BESTIARY 1 (the valley's senses), LANDS 3 (the lands' senses). A dash means the source gives no number. What makes a member harder is always one of LANDS 1's levers or a sharper sense, never a richer drop: the caps of 12 / 8 / 5 per 1000 tiles by danger hold for every hunted member (LANDS 1; HUNTING 8 keys the same caps to the ground's d instead, section 9); the drake, not prey in the first ring, is a landmark at cap 1 (LANDS 3.2).

| Family | Member (land, d) | Tier | Danger | Senses | Take s | Cap / refill d | Harder because |
|---|---|---|---|---|---|---|---|
| Burrowers | barrow rat (S, d1) | 1 | 0 | 3 / +1 / 5 | 30 | 12 / 1 | the place: the south's roof and its hours |
| | hare (V, d0) | 1 | 0 | 6 / +2 / 0 | 40 | 12 / 1 | sight 6 and a keen ear; open meadow |
| Deer | roe deer (V, d0 to d1) | 1 | 0 | 8 / +2 / 6 | 90 | 12 / 1 | the base of the stalk |
| | white hart (E, d2) | 3 | 0 | 9 / +2 / 7 | 150 | 12 / 2 | sight 9 is past the bow's 8; alarm 8 lifts the glade; a d2 wood; large, four dressing parts |
| Wild goats | highland goat (V, d1) | 2 | 0 | 8 / 0 / - | 90 | 12 / 1 | a d1 slope; the bow from below |
| Pigs | wild boar (V, d1) | 2 | 1 | 4 / 0 / 8 | 120 | 8 / 2 | a defender; the pit; two short windows |
| Canids | silver fox (E, d1) | 2 | 0 | 7 / +2 / 8 | 75 | 12 / 2 | night hours, the dead end |
| | shade fox (S, d1) | 2 | 0 | 7 / +2 / 8 | 75 | 12 / 2 | the same numbers in the dark south |
| | bone hound (S, d1) | 2 | 1 | 6 / +1 / 9 | 120 | 8 / 2 | a defender, after the fight |
| | wolf (V, d2) | 3 | 2 | 8 / +2 / 9 | 150 | 5 / 3 | a hunter at d2, after the fight |
| Cats | wildcat (V, d2) | 3 | 1 | 7 / +2 / - | 120 | 8 / 3 | d2 ground; a silent kind, the tell is a pose only |
| | wood lynx (E, d2) | 3 | 2 | 8 / +2 / 6 | 150 | 5 / 3 | a hunter; sight 8; cap 5 |
| Bears | white bear (V, d2) | 3 | 2 | 5 / 0 / - | 240 | 5 / 3 | large, the pit, 240 s |
| Game birds | ground fowl (V, d0) | 1 | 0 | 5 / +1 / - | 30 | 12 / 1 | slung from beyond its sight |
| | wood dove (E, d1) | 1 | 0 | 6 / +1 / 0 | 30 | 12 / 1 | sight 6 equals the sling's reach: cover needed |
| Perching birds | carrion crow (V, d0; S) | 1 | 0 | 7 / 0 / 0 | 30 | 12 / 1 | never stalked |
| Waterfowl | grey heron (E, d1) | 1 | 0 | 8 / +1 / 0 | 45 | 12 / 1 | the stone's 3 against sight 8 |
| | wild goose (E, d1) | 1 | 0 | 7 / +2 / 0 | 45 | 12 / 1 | the watcher; medium, two parts |
| Raptors | great eagle (E, d2) | 3 | 1 | 10 / +1 / 0 | 180 | 8 / 3 | sight 10; after the fight |
| Mustelids | river otter (E, d1) | 1 | 0 | 5 / +1 / 2 | 60 | 12 / 1 | the water as its refuge |
| | tree marten (E, d1) | 2 | 0 | 6 / +2 / 4 | 60 | 12 / 1 | the branch, dusk hours |
| Fish | trout (V, d0) | 1 | 0 | 2 / 0 / - | 60 | 12 / 1 | the rise's two windows |
| Reptiles | dust adder (V, d1) | 2 | 1 | 2 / 0 / 0 | 45 | 8 / 2 | a defender; 2 tiles |
| Night fliers | ash bat (S, d1) | 1 | 0 | 2 / +3 / 0 | 45 | 12 / 1 | an ear of +3 |
| Horned beasts | cinder imp (S, d1) | 3 | 1 | 6 / +2 / 0 | 90 | 8 / 2 | after the fight |
| | barrow fiend (S, d2) | 5 | 2 | 8 / +2 / 8 | 240 | 5 / 5 | above the open ladder (`open_tiers` 3) |
| Spiders | tomb spider (S, d1) | 3 | 1 | 3 / +3 / 0 | 120 | 8 / 3 | the web feels any gait |
| Drakes | ash drake (S, d2) | 8 | 2 | 10 / +2 / 10 | - | 1 / 30 | not prey in the first ring |

The ladder each family climbs, read from the table: the deer from 90 s at d0 to 150 s at d2 with one more tile of sight; the canids from a fox that flees (danger 0) through a hound that bluffs (1) to a wolf that hunts (2); the cats from a defender to a hunter at the same tier. Eight families have one member; section 6 gives six of them a second (not spiders or drakes) and adds to five families that already have two or more.

## 5. Goods per family

Drops are LANDS' (qty, share); grades are MATERIALS 1's: every carcass draws plain, fine or true from the one draw in `params.hunt`, the same in every land (LANDS 1), and the grade is the item, never a drop. A good's tier is 1 at d0, 2 at d1, 3 at d2 (MATERIALS 2). No good carries a price (HUNTING 9).

| Family | Members and drops | The mark (only this family gives it) |
|---|---|---|
| Burrowers | hare: meat 1, hide 1, bone 1 (BESTIARY 1: "hide scrap 1"); rat: hide 1 (a scrap), bone 1 | none in the sources; proposed, open point 4 |
| Deer | roe: meat 3, hide 1, bone 1, sinew 2; hart: meat 4, hide 1, bone 1 (the antler), sinew 1 | the antler (LANDS 3.1, the hart's bone); the deer are also the sinew family, the roe's 2 tying the spider's silk for the most of any kind and the bow string's source (MATERIALS 3.4) |
| Wild goats | goat: meat 2, hide 1, bone 1, sinew 1 | none in the sources; HUNTING 6 names horn as later, open point 4 |
| Pigs | boar: meat 3, hide 1, bone 1 (the tusk) | the tusk (LANDS 2; MATERIALS 2.1: "the boar's tusk ... count as bone") |
| Canids | silver fox: hide 1 (the pelt), bone 1; shade fox: hide 1 (the black pelt), bone 1; hound: bone 2, hide 1 (dry hide); wolf: hide 1, bone 1 (the fang), meat 1 | the fang (LANDS 2, the wolf's bone); the foxes' meat is not eaten |
| Cats | wildcat: hide 1 (fine fur), meat 2, bone 1 (the claw); lynx: hide 1 (the pelt), bone 1 (the claw), meat 1 | none unique: the claw is also the bear's (LANDS 2), fine fur also the marten's (LANDS 3.1); open point 4 |
| Bears | bear: meat 5, hide 1 (thick fur), bone 1 (the claw) | thick fur (LANDS 2); the most meat of any kind |
| Game birds | fowl: meat 1, feather 2; dove: meat 1, feather 2 | the fowl's down, a feather-class item tagged `down` (MATERIALS 2.1), the lining's input (MATERIALS 3.5) |
| Perching birds | crow: feather 1; sparrow: a moult from the ground, not dressed | none: feathers only |
| Waterfowl | heron: feather 3; goose: meat 2, feather 3 | none in the sources; open point 4 |
| Raptors | eagle: feather 4, bone 1 | none named; the most feathers of any kind (LANDS 3.1) |
| Mustelids | otter: hide 1, meat 1; marten: hide 1 (fine fur), meat 1, bone 1 | none unique (fine fur is also the wildcat's) |
| Fish | trout: meat 2, bone 1 | none: fish counts as meat (BESTIARY 1, notes) |
| Reptiles | adder: hide 1 (the scale), meat 1 | none unique: the scale is also the drake's hide (LANDS 3.2), though the drake is not prey in the first ring; open point 4 |
| Night fliers | bat: hide 1 (the wing), bone 1 | the wing (LANDS 3.2) |
| Horned beasts | imp: bone 1 (the horn), hide 1 (the ember hide); fiend: bone 2 (the horns), hide 1, sinew 1 | the horn and the ember hide (LANDS 3.2) |
| Spiders | spider: hide 1 (the chitin), sinew 2 (its silk) | the silk, a sinew-class good, and the chitin (LANDS 3.2) |
| Drakes | drake: hide 1 (the scale), bone 2, sinew 1 | not taken in the first ring |

A mark is a named item of one of the five classes, as the fowl's down already is (MATERIALS 2.1: class `core/feather`, tag `down`); no family adds a sixth class, because the check refuses a drop that is not meat, hide, bone, sinew or feather (HUNTING 12). Families with no sourced mark: burrowers, wild goats, cats, perching birds, waterfowl, raptors, mustelids, fish, reptiles (open point 4).

## 6. New members: the families' open slots

Fourteen proposed kinds, **proposed, not in BESTIARY_LANDS**. Each takes its family's style unchanged and follows LANDS 1: tier 1 at d0, 2 at d1, 3 at d2; the cap by danger (12 / 8 / 5); drops of the five classes only. Six come from the memo's archetypes that BESTIARY 4 defers ("marsh duck, shore crab, herring shoal, hill sheep, marmot, ptarmigan, great stag"), the great stag written here as the red stag; the hill sheep's and the marmot's goods are MATERIALS 2.1's own proposals. Take seconds and refills are proposed; where one falls outside its family's existing rows, the cell says so with its reason (a higher tier, d2 ground, a lower rung). Senses are left to the schema's pass. None is young, a pet or a person (HUNTING 10).

| Kind (proposed) | Family | Land, d | Size | Tier | Danger | Take s | Style used | Goods (proposed) | Cap / refill d |
|---|---|---|---|---|---|---|---|---|---|
| Marmot | Burrowers | V highland, d1 | small | 2 | 0 | 45 (above the family's 30-40: tier 2) | the snare on the line home; its whistle is an alarm (research-hunting catalogue, cited in BEHAVIOUR Sources), proposed at 5, the valley's first burrower with a voice (the rat's is 2, in the south, BEHAVIOUR 5) | meat 1, hide 1, bone 1 (MATERIALS 2.1) | 12 / 1 |
| Red stag | Deer | V highland, d1 | large | 2 | 0 | 120 | the stalk at the water at dawn; the stag's bark as its alarm (research-hunting catalogue, cited in BEHAVIOUR Sources), proposed at 6, below the hart's 8 | meat 4, hide 1, bone 1 (the antler), sinew 2 | 12 / 1 |
| Hill sheep | Wild goats | V highland, d1 | medium | 2 | 0 | 90 | the bow from below the ledge; snare on the ledge path | meat 2, hide 1 (fleece on, tag `fur`), bone 1, sinew 1 (MATERIALS 2.1) | 12 / 1 |
| Crag ibex | Wild goats | E crest, d2 | medium | 3 | 0 | 120 (above the goat's 90: tier 3 at d2) | the bow from below the ledge, on the crest the eagle holds | meat 2, hide 1, bone 1, sinew 1 | 12 / 2 (above the goat's 1: d2) |
| Wood hog | Pigs | E foot, d1 | medium | 2 | 1 | 120 | the pit and the charge in a line | meat 3, hide 1, bone 1 (the tusk) | 8 / 2 |
| Snow fox | Canids | V highland, d1 | small | 2 | 0 | 75 | the laid bait at a dead end; white in winter if the winter coat lands (BEHAVIOUR 2, `winter_look`; BEHAVIOUR 8, question 4) | hide 1 (the pelt), bone 1; the meat is not eaten | 12 / 2 |
| Brown bear | Bears | E wood, d2 | large | 3 | 2 | 240 | the pit at the edge of the den ring | meat 5, hide 1, bone 1 (the claw) | 5 / 3 |
| Ptarmigan | Game birds | V highland, d1 | small | 2 | 0 | 40 (above the family's 30: tier 2) | the sling from beyond its sight; white in winter, as the memo's highland hare | meat 1, feather 2 | 12 / 1 |
| Marsh duck | Waterfowl | V bay's wet edge, d0 | small | 1 | 0 | 30 (below the family's 45: d0, the first rung) | from the reeds, past the watcher (the wet edge's reed marsh, BEHAVIOUR 3) | meat 1, feather 2 | 12 / 1 |
| Crag falcon | Raptors | V highland, d1 | small | 2 | 1 | 120 (below the eagle's 180: tier 2, a rung below) | the bait on the open crest, after the fight | feather 3, bone 1 | 8 / 2 (below the eagle's 3: tier 2) |
| Badger | Burrowers | V valley edge, d1 | small | 2 | 0 | 60 (above the family's 30-40: tier 2, a heavier body) | the snare on the line home, here the path to its sett, its anchor (`flight` B); on the burrowers' body scaled up, moved to a family of its own if the owner's still reads wrong (section 7) | hide 1, meat 1, bone 1 | 12 / 1 |
| Herring shoal | Fish | V bay, d0 | small | 1 | 0 | 60 | the line at the rise | meat 2, bone 1 | 12 / 1 |
| Wood pike | Fish | E pool, d1 | small | 2 | 0 | 90 (above the trout's 60: tier 2) | the line at the rise, in the wood's pool | meat 2, bone 1 | 12 / 1 |
| Stair viper | Reptiles | S stair, d1 | small | 2 | 1 | 45 | the throw from the edge of its sight, under the roof's night | hide 1 (the scale), meat 1, unless the south's meat is not eaten (LANDS 6, question 1, default A: then hide 1 only) | 8 / 2 |

What stays open after them: cats, perching birds, mustelids, night fliers, horned beasts, spiders and drakes get no new member here; the shore crab is left out because its shell fits none of the five goods classes.

## 7. Art per family

One body per family, rendered through the clip tool's native target (ANIMATION 5.4), every loop at least four poses (DECISIONS 2026-10-29, "Movement", answer C). A member is the body under another ramp and scale; where a member's shape differs enough that the owner's still reads wrong, it moves to a family of its own and the check of section 8 follows.

| Family | Body | Where it stands |
|---|---|---|
| Canids | the wolf | on `develop` (ANIMATION 5.4: rigged with Idle, Walk and Run; four-pose clips in #412) |
| Burrowers | the hare | #433, with a pick page |
| Perching birds | the crow | #433, with a pick page |
| Deer | the deer | being built in the pull request beside this page |
| Wild goats, pigs, cats, bears, mustelids | a quadruped each | needed |
| Game birds, waterfowl, raptors | a bird each | needed |
| Fish, reptiles, night fliers (the bat), spiders | their own | needed; the adder's budget is MATERIALS 7's proposal |
| Horned beasts | a horned beast | needed, after LANDS 6, question 4 |
| Drakes | a large flier | needed, last; not prey in the first ring |
| Night fliers (the moths) | none | state kinds (BEHAVIOUR 5) with no drawn body, drawn by the client as a cloud, as REACTIONS 3.3 has a cue |

Four families have a body or one in flight; fourteen need one.

**The clip set.** HUNTING 2's states need six things drawn: idle (IDLE), walk (WANDER, RETURN), run (FLEE), alert (the head-up tell), graze (head down; a hunter's rest is the same state by another look, BEHAVIOUR 1) and lying (SLEEP). ANIMATION 5.2's quadruped budget is idle 4, walk 4, run 4, hurt 2, death 4 (attack 4 when it bites), 54 frames at three views, 66 with the bite, inside the cap of 69. Proposed sheet for a hunted quadruped: idle 4, walk 4, run 4, graze 4, alert 1 (a held pose), lying 1 (a held pose): 18 poses, 54 frames. The death poses are not spent on prey, because a take is a fade and a drop of goods (HUNTING 10) and the fade is the client's; hurt and the bite are kept only for a family the fight brings in (pigs, canids, cats, bears, raptors, horned beasts, spiders), and to stay inside the cap such a family's graze drops to 2: 18 - 2 + 2 + 4 = 22 poses, 66 frames. A bird: flap 4, idle 4 (ANIMATION 5.2 gives idle 2, section 9), walk 4 for the ground walkers (fowl, heron, goose), alert 1, perched or lying 1. A fish: ANIMATION 5.2's swim 5 and idle 2, the idle raised to 4 by the same decision. Four facings, three rendered and right mirrored (ANIMATION 5.2).

**Coats.** Every individual draws in one of its kind's coats, picked by weight from the creature's id and the world's seed through a stable hash, so every client draws the same animal; a coat is look only, never the goods, the value or a count (HUNTING 10). A plain coat is a step-to-step map from the body's ramps to other shared ramps (every colour written stays a palette colour); a patterned coat (spots, a pied flank) needs the pattern on the body, so it names a second body made by the same pass, because a pattern drawn after the render would swim between frames. The format and the first coats (the hare and the crow) are in #433; proposed coats per family, the commonest first, a rare one last:

| Family | Coats proposed |
|---|---|
| Burrowers | agouti brown, grey brown, dark brown, ash grey, black, brown pied, black pied, white (rare); the rat: brown, grey, black |
| Deer | red brown (summer), grey brown (winter look, with `winter_look`), dark; the hart has one coat, its silver, since it is the rare one |
| Wild goats | grey, cream, black and white pied, brown |
| Pigs | dark grey, brown, black (the striped young are not prey, HUNTING 10) |
| Canids | the wolf: grey, dark grey, pale; the foxes: red, cross (dark legs), the silver fox's silver; the bone hound: one coat |
| Cats | grey tabby, brown tabby, pale; the lynx: spotted tawny, grey |
| Bears | the white bear: white, cream |
| Game birds | brown barred, grey, pale |
| Perching birds | the crow: black, sooty brown black, grey washed, pale (rare); the sparrow: brown, grey |
| Waterfowl and waders | the heron: grey, pale; the goose: grey, brown, white |
| Raptors | dark brown, golden brown, pale |
| Mustelids | brown, dark brown; the marten: brown with a cream throat |
| Fish | olive, silver, spotted dark |
| Reptiles | sand, grey, banded |
| Night fliers | dark brown, grey |
| Horned beasts, spiders, drakes | one coat each: a coat of the south's ramps; variety here is size, not colour |

**Life between the states.** An animal standing in IDLE or GRAZE plays its base loop and, after a random delay, one short fidget picked by weight, never the same twice in a row and never one in its cooldown; a stimulus that raises it toward ALERT cuts the fidget at the next pose. This is how the reference games make prey read as alive: Stardew Valley's barn animals fidget about every 1.6 s on one or two frames; theHunter: Call of the Wild's deer graze head down for a random time, lift the head and chew, look to the sides, shake the head and scratch, with an alert per sense; Breath of the Wild's prey move from notice to attention to escape and one fleeing animal moves the herd. The scheduler needs no art and comes first; the fidgets are short clips of two or three poses. Proposed fidgets, in the order they pay at a phone's tile size:

| Family | Fidgets (poses) | Delay between |
|---|---|---|
| Burrowers | ear twitch (2), look to the side (1, mirrored), sit up tall (1, then the alert pose), face wash (3) | 2.5 to 6 s |
| Deer | the head-up beat of the graze cycle (head down 3 to 8 s, head up and chewing 1.5 to 4 s; 2), ear flick (2), look to the side (1, mirrored), alarm stamp (2, at suspicion); later head shake (2), lick a flank (2). Drinking is the graze at the water's edge with a ripple, no new poses | only while the head is up, at most two a beat |
| Perching birds | head turn and tilt (2), caw with its sound (2), wing ruffle (2), preen (2) | 1.5 to 4 s |
| Every other family | two to four of the same kinds (an ear or a head turn, a look to the side, a scratch or a shake, a call), chosen when its body is made | by class: prey 2.5 to 6 s, hunters 4 to 8 s, birds 1.5 to 4 s |

Cooldowns: grooming 20 s, sitting up 8 s, a call 6 s. Suspicion (BEHAVIOUR's alarm below ALERT) turns grooming off and makes the look and the ear more likely, the deer stamps, the crow calls, the hare sits up. After a flight, the first fidget back in IDLE is a look to the side.

**The budget this asks.** ANIMATION 5.2's cap of 69 frames a quadruped and 27 a bird was set for drawn frames; rendered frames cost a render, not a drawing, and what remains is the texture: a 128 px frame is 64 KiB uncompressed, so the hare with its fidgets (87 frames) is about 5.4 MiB, the roe deer (90) about 5.6 MiB, the crow (49) about 3.1 MiB, and a scene with all three about 14 MiB against about 10 today, before packing trimmed frames into an atlas (estimated to cut it by half or more). Proposed: a hunted animal's cap is its base sheet plus up to 12 fidget poses (36 frames at three views), measured on the device tier's memory before a family's second member is added (open question 8).

## 8. The check rows

What `pnpm check` would print once a family field exists, in HUNTING 12's form; the field names are the schema's to fix.

- `x creature.<id>: no family, or a family the content does not declare (HUNT_FAMILIES 2)`
- `x creature.<id>: a body that is not its family's body (HUNT_FAMILIES 7)`
- `x creature.<id>.hunt.ways: a way its family's style does not use (HUNT_FAMILIES 3)`
- `x family.<id>: a member at a higher tier with a shorter take than a lower member (HUNT_FAMILIES 4, LANDS 1)`
- `x family.<id>: a member that is harder only by its drops; a harder member has a longer take, a higher way, a higher danger or a thinner cap (HUNT_FAMILIES 4, LANDS 1)`
- `x creature.<id>.hunt.drops: a family's mark dropped by a kind of another family (HUNT_FAMILIES 5)`
- `x creature.<id>: a looping clip under four poses (DECISIONS 2026-10-29, HUNT_FAMILIES 7)`

## 9. Where the sources disagree

- **The ear's scale.** HUNTING 3: "`ear` is the species' -2, 0 or +2"; BESTIARY 1: "keen +2, normal +1, dull 0"; LANDS 3 uses +1, +2 and +3 (the bat, the spider). This page writes LANDS' numbers.
- **The bat's lantern.** LANDS 3.2 gives the ash bat "lure (a lantern)"; BEHAVIOUR 2 says a carried light has no effect on any animal (G31). Open point 7.
- **The spider's moth.** LANDS 3.2's "a moth at the web" needs a moth, which has no `hunt` and gives nothing (LANDS 3.1, 3.2). Read in 3.17 as a lamp prop near the web (the proposed `light` flag, placed by the map) that draws the moths, state kinds in BEHAVIOUR 5. Open point 3.
- **The tier by ground in the two lands.** LANDS 1 has tier 1 at d0, 2 at d1 and 3 at d2; but the elf wood is d1 at its foot and d2 beyond (LANDS 3.1) and the south runs from the night arch to the d1 hall (LANDS 3.2), and both lands carry tier-1 kinds (dove, heron, goose, otter; rat, bat, crow). Either those kinds stand on d0 ground the pages do not name, or their tier is the land's floor and not the ground's.
- **The wildcat.** BESTIARY 1 has it a d2 hunter; LANDS 2 and MATERIALS 2.2 write it at danger 1, a defender on d2 ground. This page follows LANDS.
- **The goat's size.** BESTIARY 1 gives size 1; LANDS 2 and MATERIALS 2.1 write it medium.
- **The crow.** BESTIARY 1 makes it ambient with a sling or snare "if wanted", and BESTIARY 3 keeps the opening's five unhuntable in the first hour; LANDS 2 gives it a full `hunt` block (snare, sling). This page follows LANDS.
- **Smell.** HUNTING 3 has smell as a one-tile ring for every animal; HUNTING 8 and LANDS list smell numbers up to 10, which are proposed fields, not read today.
- **A bird's idle.** ANIMATION 5.2 gives a bird idle 2 and a fish idle 2; DECISIONS 2026-10-29 asks four poses a loop of every creature. Open point 5.
- **The deer's look-back.** For two steps it notices at sight + 2 (BEHAVIOUR 1), 10 tiles for the roe, so any player within the bow's 8 is already seen and it is not a second shot; 3.2 reads it as where the stalk starts again.
- **The cap by danger or by ground.** LANDS 1 sets the spawn cap by danger (12 / 8 / 5); HUNTING 8 sets the same numbers by the ground's d (d0 12, d1 8, d2 5). On d2 ground several members sit above 5 by LANDS: the white hart (12), the wildcat (8), the great eagle (8), and the proposed crag ibex (12). This page follows LANDS.
- **A hunter's pit before the fight.** HUNTING 8 takes a hunter "with the fight, or the pit trap", which allows a pit before the fight; LANDS puts the wolf's bait and the eagle's pit after the fight, but not the bear's ice pit (LANDS 2; BESTIARY 1: "late ice pit with bait"). The boar, a defender, is pitted before the fight in both. This page follows each kind's LANDS row.
- **Cover and the rear radius.** HUNTING 3 halves the sight behind the animal and takes 2 off every sight for a player in cover, but does not say which comes first: for the heron (sight 8) the rear radius from the reeds is 2 one way and 3 the other, which decides whether the stone's 3 is thrown unseen (3.10).

## 10. Open for the owner

Each one sentence, three options, A the recommendation, and the default this page is written on.

1. **How a family is written.** A (recommended): one `family` word on the kind, naming a family entry that holds the body and the ways. B: the word only, the body per kind. C: no field, families live in this page only. Default: A.
2. **The bone hound's family.** A (recommended): the canids, on the wolf's body under a dry-hide ramp. B: the horned beasts, with the imp and the fiend, as LANDS 3.2 counts the demons. C: a family of its own. Default: A.
3. **The moths.** A (recommended): listed with the bat for their habits, state kinds as BEHAVIOUR 5 has them, with no drawn body (a cloud) and no `hunt`, so the spider's lure stays a server read. B: cues only, drawn by the client: then the spider's moth lure goes and the moth rows leave BEHAVIOUR 5. C: a family of their own with a body. Default: A.
4. **A mark for the families that have none.** A (recommended): one named item each in the five classes, as the fowl's down, proposed one at a time with the family's next member. B: no marks; the family word in the good's name is enough (MATERIALS M4). C: new goods classes (horn, fur, fat), which HUNTING 6 leaves for later. Default: A.
5. **A bird's idle.** A (recommended): four poses, as DECISIONS 2026-10-29 answer C asks of every creature. B: two, as ANIMATION 5.2's bird budget. C: two plus the code layer. Default: A.
6. **The order new members enter.** A (recommended): one member a family, as each family's body lands, the marmot and the red stag first. B: by land, the highland's five first. C: none until the creature schema and the take are built. Default: A.
7. **The bat's lantern lure.** A (recommended): a lamp prop with the proposed `light` flag, placed by the map, never the carried lantern, as BEHAVIOUR 2 reads G31. B: the carried lantern draws bats, which needs the lantern to become a state item and amends G31 and BEHAVIOUR 2's carried-light row. C: drop the lure; the net only. Default: A.

8. **A hunted animal's frame budget.** A (recommended): the base sheet plus up to 12 fidget poses (36 frames at three views), measured on the device tier's memory before a family's second member. B: ANIMATION 5.2's caps as they stand, fidgets only by the code layer. C: no cap for rendered bodies, memory measured per scene. Default: A.

## Sources

- [HUNTING.md](HUNTING.md) sections 1 to 6, 8 to 12 (the states, the noticing count, the noise table, the tools, the goods, the kinds by tier, the pay and the caps, the rating's rules, the open questions, the check rows).
- [BESTIARY.md](BESTIARY.md) sections 1 (the twelve, their senses and tool gates), 2 (the rules) and 4 (the deferred archetypes).
- BESTIARY_LANDS.md (#432) sections 1 (the fields and the ladder), 2, 3.1, 3.2 (the thirty-one kinds), 4 (balance) and 6 (open points).
- MATERIALS.md (#432) sections 1 (classes and grades), 2 (the atlas, the down, the hill sheep and marmot), 3.3 to 3.5 (bone, sinew, feather), 4 (M4), 6 (one drawing, another ramp) and 7 (the sheets).
- [CREATURE_BEHAVIOUR.md](CREATURE_BEHAVIOUR.md) (proposed beside this page) sections 1 (the temperament fields), 2 (fire, light, water, the carcass), 3 (the ground), 4 (the shape of a day) and 5 (every kind in the fields).
- [ANIMATION.md](ANIMATION.md) sections 5.2 (frame budgets) and 5.4 (the quadruped target, the wolf's body).
- [GAME_RULES.md](GAME_RULES.md) G31, G34, G35; [OPEN_WORLD.md](OPEN_WORLD.md) G64 (quoted in [FIRST_MAP.md](FIRST_MAP.md), "Danger (G64)").
- DECISIONS.md: 2026-10-29 "Movement" (four poses a loop at least, real poses under the code layer); 2026-10-29 "Animals, then the foundations of combat and hunting"; 2026-10-30 "The hunt foundations" (the fields; in #432, the foundations pull request, not yet in DECISIONS.md, cited here through LANDS 1).
- Pull requests: #412 (the wolf's four-pose clips), #432 (LANDS, MATERIALS), #433 (the hare and the crow).
- Reference games for the fidgets and the awareness ladder: Stardew Valley's animal data (https://stardewvalleywiki.com/Modding:Animal_data); "theHunter: Call of the Wild: designing believable simulated animal AI" (https://www.gamedeveloper.com/design/thehunter-call-of-the-wild-designing-believable-simulated-animal-ai); Breath of the Wild's prey AI as datamined (https://zeldamods.org/wiki/AIDef:AI/PreyNormal). The atlas saving in section 7 is an estimate, not a measure.
