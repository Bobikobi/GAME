# Creature behaviour: temperament, the stimuli beyond the player, and the ground under the animal (2026-10-30)

**Status:** Proposed 30.10, written for the creature schema pull request that [HUNTING.md](HUNTING.md)'s status line names as the owner's next. Nothing here is built. HUNTING 2 to 4 (the ten states, the noticing count, the noise table) stay as written; this page adds what they leave to "the species": the numbers that make two animals in the same state move differently (section 1), what an animal reads besides a player, which is fire and light, water, the weather and the climate, the town, other animals and a crowd of players (section 2), the ground it lives on and sleeps in (section 3), the shape of its day (section 4), a row for every kind of the three lands (section 5), groups whose shape and size change and how a group moves, flees and comes back together (section 5.1), the cost on the server (section 6), the check rows (section 7) and the owner's questions (section 8).

The ask behind it, 30.10: each animal with a character of its own; how it moves, where and when; how it answers the world around it, fires included, and the ground it stands on: water, desert, snow, a town.

What the page does not reopen: an animal that reacts to a player runs on the server's tick, thinks every 8 ticks staggered by its id, and is not stepped with no player within 40 tiles (HUNTING 1); at most 24 awake animals are simulated within 40 tiles of any player ([BESTIARY.md](BESTIARY.md) 1). Every stimulus below is a read at that think step of state that already exists or is already decided: the tick, the tile's tag, the region's weather of the day, a fire's stored burn-until tick, the players' tiles and gaits, the carcasses' tiles. No animal writes to another animal, the herd leader alone writes its herd's anchor and the spawner alone its count at a group period (section 6), and nothing runs while nobody looks ([REACTIONS.md](REACTIONS.md) 2).

## 1. Temperament: the fields that are the character

HUNTING 2 says "by the species' weights", "6 to 14 tiles by species" and "herd members follow the leader". These are the fields, so a kind's character is content and never a branch in the code:

| Field | Values | What it does | In HUNTING |
|---|---|---|---|
| `weights` | three shares of 100: IDLE, GRAZE, WANDER | Where the animal goes when a quiet state ends. A heron stands (60/30/10); a fox ranges (10/20/70). For a hunter, GRAZE is the den's rest: head down, sight 2 shorter, the same state by another look | 2, "by the species' weights" |
| `roam` | 6 to 14 tiles | The circle round the anchor WANDER picks in, and how far RETURN walks | 2, WANDER |
| `group` | a class (`solitary`, `herd`, `flock`, `pack`) and four weights that sum to 100, over the bands **solo** 1, **pair** 2, **small** 3 to 4, **large** 5 to 12; an optional season row (5.1.4) | The class says how the group moves and flees (5.1.3); the weights say how many stand at one anchor, drawn once a group period (5.1.2). Today's three `herd` values are the bands at their heaviest weight: 1 is solo, 2 to 4 is pair and small, 5 to 12 is large | 2, WANDER and ALERT; 8, "cluster size" |
| `sentinel` | yes or no; only on a `herd` or `flock` kind | The leader never GRAZEs while the others do: it stands at IDLE at full sight on the highest tile within 2 of the group, and its ALERT is its `alarm` noise, which the others hear by section 1's `alarm` row (section 8, question 5; FAMILIES 6.1, the sentinel) | 2, IDLE and ALERT |
| `flight` | `ground`, `fly`, `swim`, `climb`, `burrow` | How FLEE runs and where it ends (section 2, water): a ground kind runs the distance map and water is a wall to it; a flier crosses water and fences and lands sight + 4 away; a swimmer ends in water and is under it 8 steps; a climber ends on a grove tile within roam, or on a ruin tile within roam (a rock, a solid ruin, a roof) when its `sleeps` is `rock` or `roof`, and is up it 8 steps; a burrower ends at its anchor and is gone into it 8 steps, then WANDER, as the swimmer and the climber do, but for a burrower flushed out of its den, whose FLEE runs away from the den and RETURNs after the 60 steps (FAMILIES 3.1 and 9a) | 2, FLEE ("birds fly over water and fences") |
| `sleeps` | `ground`, `tree`, `water`, `rock`, `reeds`, `den`, `roof` | What the anchor stands on and where the kind goes to ground out of its hours: a form in tall grass, a perch, the river's bed, a warm rock, the reed bed, a den under rock or ruin, a roof's beam. A day kind leaves the map there at night rather than sleeping in view, a few stragglers at most (DECISIONS 2026-10-30, the wild animals' brain); sections 4 and 5.1 still show the night as a visible sleep until the pull request that steps animals rewrites them. Today's `perch` (ground, tree, water) grows to this list | 2, SLEEP; the schema's `perch` |
| `alarm` | 0 to 12 tiles | The noise its ALERT tell makes, in the table of HUNTING 4, so other animals hear it: a crow's caw, a goose's honk, a hart's bark. 0 is a silent kind. Every kind that hears it turns its head toward the sound for `noise_turn_t` (HUNTING 4, G84). That a hearer within its ear goes on to ALERT facing the sound, or straight to its tier's state when the alarm is 8 or more as HUNTING 2 has it for any noise, is this page's proposal (section 8, question 5): the sentinel, a crow lifting that puts the hare up before the player is in the hare's sight | 2, ALERT; 4, the noise table |
| `looks_back` | yes or no | At FLEE's end a kind that looks back takes two steps of ALERT at sight + 2, facing the player, before WANDER: the deer's stop and turn, the fox that "sits and looks at the player before it goes". Not a new state: ALERT entered from FLEE's end | 2, ALERT |
| `drinks` | yes or no | The water beat of section 4: twice a day its WANDER target is the nearest water or riverbank tile within roam | new |
| `water` | wall, crosses, swims, lives in, its edge | What a water tile is to the kind; `flight` says how FLEE ends, this says whether water is in the way | new |
| `fire` | keeps away, holds at the edge, drawn to a lamp, ignores | The kind's answer to a fire on the ground (section 2); the default by class is prey keeps away, hunter holds at the edge | new |
| `weather` | cover in rain, roosts in a storm, stays in when it rains, none | The kind's answer to rain and storm (section 2); the default by class is prey and defenders cover, hunter none, percher and flier roosts | new |
| `carrion` | yes or no | Comes to a carcass after 30 steps (section 2) | 6, the crows |
| `habitat` | a list of tile tags | Where the spawner lays it and WANDER picks, and the count its cap is read over (section 3; BESTIARY_LANDS 4) | 8 |

These fields, the senses of HUNTING 8 (sight, ear, smell), the hours of BESTIARY and the two winter marks of section 2 (`winter_look`, and a den season for the bear) are the whole of a kind's character. Everything in section 2 is the same ten states fed by one more stimulus; nothing adds an eleventh.

## 2. The stimuli beyond the player

HUNTING 3 counts one stimulus: the player, by sight, hearing and smell. Each row below is a second source for the same counter or the same state, with a radius and an effect by class (prey, defender, hunter, scavenger, and the perchers and fliers that are ambient). The last column says what exists today, from the code and the pages.

| Stimulus | Reads | Radius | Prey and defenders | Hunters | Scavengers, perchers | Today |
|---|---|---|---|---|---|---|
| **A fire on the ground** (the player's own fire while it burns, a hearth, the south's braziers) | `fireBurns` and the fire's tile | `fire_keep` 4 tiles by day, 6 by night | Keep outside the radius: a WANDER target inside it is dropped, a RETURN whose anchor is inside waits at the edge. By day a fire is a place animals go round; by night a lit circle nothing grazes in | STALK and CHASE never enter a fire's `safe_tiles` (the chase ends on safe ground already, G30). At night a hunter that has a target it may not reach holds at the edge of the fire's `safe_tiles` for `give_up_t` (50 ticks, COMBAT 4.9), facing in: the wolf's eyes at the edge of the light, then RETURN | Moths and bats are drawn to a lamp within 8 at night (the moon moth at the stalls' lamps, the ash bat's lure, BESTIARY_LANDS); a lamp needs a prop flag the schema does not have yet (`light: true`, with its hours). A crow comes to a cold fire's ash in the morning, 30 steps after it goes out, as it comes to a carcass | The player's own fire with `safe_tiles` 1 exists (kernel `step.ts` `kindle`, `state.ts` `fireBurns`, `danger.ts` the safe ring); one hearth prop in the content; the braziers and the lamps' flag are to come |
| **A light carried** (the lantern of G31) | nothing | none | No effect | No effect | No effect | The lantern is a client light with no item and no state. G31: "its light keeps nothing off", G34: never gear against a hazard. A carried fire that scared a wolf would be a shield, which the rules refuse; a fire on the ground is a place, which is already the rule (G30). REACTIONS 10 lists a torch among the fires a player may light, a fire that burns only what it was lit in; if one is built, it is a light like the lantern and no animal reads it |
| **A wildfire front** (REACTIONS 10: a world event lit by the seed in the wild, fought together; "It runs as a front from its tick and its tile, so every client draws the same burn with no messages") | the front's tiles, the reserved tag `burning` | 8 tiles from any burning tile | FLEE from the nearest burning tile, hunters and defenders too; the burning tiles are solid in every flee map; the herd leader moves the herd's anchor out of the burned ground when the front reaches it, to the nearest habitat tile outside it | The same FLEE, and no STALK while a burning tile is within 8 | Crows to the burned ground the morning after; grazers back when the tag goes | Not built, and not asked for here: the day the `burning` tag exists, this row is the animals' answer to it |
| **Water** (tile tag `water`; the river, the tarn, the pool, the bay) | the tag | the kind's `flight` | A wall to a ground kind: the flee map never crosses it, so a hare chased to the bank turns along it, and the bank is where a sling finds it. A swimmer ends FLEE in it. A drinker's target twice a day (section 4) | A wall, as to prey; a hunter never swims after a swimmer | A flier crosses it; the heron and the otter live at its edge; the trout lives in it | `water` is solid for every walker today. The `deep_water` hazard kind exists in the schema and the kernel (`hazard.deep_water`), but no prop of it is placed in the valley; OPEN_WORLD 1.2 keeps it off a border. The kind's `water` field decides, so nothing changes when deep water is placed |
| **Rain and storm** (the region's weather of the day; storm from NATURE 4) | `weatherOf` | the region | Hearing 1 shorter in rain and 2 in a storm (the memo's rain row gives both sight and noise 2 less; this page takes hearing only, since the sight cut is fog's). The rest follows the kind's `weather` code (section 1), whatever its class. C, cover in rain: GRAZE's share is halved and the difference added to IDLE (the sum stays 100), and IDLE picks a grove tile within roam when one is there: the herd under the trees. R, roosts in a storm: a flier does not lift in a storm, so FLEE runs on the ground or on the perch. U, stays in when it rains: the kind stays at SLEEP in its sleeping place (section 3) while it rains, its senses at a third, and comes out when the rain stops. N, none: no change beyond hearing. Class defaults: prey and defenders C, hunters N, perchers and fliers R | Default N: rain is the hunter's hour. A hunter with another code follows it, as the wood lynx (C) does | Default R: perchers sit, and nothing bursts up in a storm | The kernel keeps two reads of weather (NATURE 4): the reaction condition and fog on a predator's sight. `weatherOf` draws clear, rain or fog today; storm is NATURE 4's new kind. This row is a third read of the same `weatherOf`, an amendment of NATURE 4 (5.1.7, the weather row; section 8, question 13) |
| **Fog** | `weatherOf` | the region | Sight 2 shorter for every kind, so a stalk in fog starts closer and the tell comes later | Sight 2 shorter: the owner's decided rule for a predator (G47, "Fog shortens the cone"), here for every kind | The same | Decided for a predator's sight (DECISIONS 2026-10-19), landing with weather's phase B under G47, not built; one rule for all kinds is this page's proposal (section 8, question 2) |
| **Cold ground and snow** (the cold climate, NATURE 2; winter, NATURE 3; the mountains round the valley, FIRST_MAP) | the region's `climate` and the real year's season | the region | Hours shrink to the season's sun (NATURE 3: winter 07:30 to 16:30); a kind with a `winter_look` wears it in the cold climate's winter (the highland hare turns white, the memo's own line); the grade draw does not change, since BESTIARY_LANDS 1 keeps one draw "the same in every land" (section 8, question 4) | Unchanged hours (the night is theirs); the bear's den months are a SLEEP that lasts the season (the memo: hibernates if seasons exist) | Unchanged | Climate is a schema field with no table behind it, seasons are decided and unbuilt; the valley gets no snow but "a rare winter day in the hills" (NATURE 10). The rows are written so the cold highland and the passes work the day they have a climate |
| **Heat and dry ground** (the dry climate, NATURE 2; on the first map the undead south, whose kinds keep the night instead) | `climate` | the region | For diurnal kinds in a dry region with a sun (the desert village, NATURE 2): hours split round the heat, awake 05 to 09 and 17 to 22, at IDLE in cover (a grove tile, a rock's shade) between; water tiles are the drinkers' target twice a day, which in such a region is an oasis or a well, so the water is the hunt. In the undead south no kind drinks and the hours are the night's (BESTIARY_LANDS 3.2) | The dry climate's hunters keep the night, as the south's kinds already do (BESTIARY_LANDS 3.2) | Unchanged | The first map's one dry region is the undead south (FIRST_MAP: dry, dark), whose kinds already keep the night, so the split day applies only to a dry region with a sun and diurnal kinds; the desert village is NATURE 2's example |
| **The town** (tile tag `town`; the square, the lamps) | the tag, the hour | `town_keep` 2 by day, 4 at night | A wall to every wild kind: WANDER never picks a town tile, FLEE never crosses one, the spawner's 12-tile ring from the square holds (HUNTING 8). At night the lamps push the wall out to 4 | A wall, and no STALK target inside the town's bounds (COMBAT 4.9's check refuses a foe in a town already) | A town kind lives on town, path, ruin and interior tiles as on its own ground: the sparrow and the crow today, the south's rat under a roof; a pet, when one exists, is a town kind and `protected` (BESTIARY_LANDS 1, the field for HUNTING 10's pets) | `town` is a tag with 175 tiles in the valley; the exclusion is BESTIARY 2 rule 5 and HUNTING 8. The night push and the town kinds are new |
| **A carcass** (HUNTING 6) | the carcasses' tiles and ticks | sight + 4 | A prey kind keeps 2 tiles from a carcass (a tell for the player: the grass empty round it) | After 60 steps in d2 a hunter takes the carcass as its WANDER target and GRAZEs on it (HUNTING 6) | After 30 steps every kind marked `carrion` within sight + 4 comes to it and GRAZEs: crows first, the rat and the foxes, the hound in the south. The carcass does not change: nothing is eaten from it in the state (its spoil clock is its own); the animals are the sign that something died there | HUNTING 6 has the crows and the d2 predator as prose; the field and the radius are new |
| **Another animal** | the hunters within sight | the prey's sight | A hunter kind in a prey's sight is a threat like a player: the same counter, the same ALERT, the same FLEE. So a wolf pack moves a herd, and a herd that bolts with no player near it is the player's first sign of a wolf (the memo: herds move away from where a predator was last seen) | A hunter reads no other animal: it never chases one. What a wolf eats is not simulated, and no animal fells another in the state (the rating's line: nothing suffers for show; and the cost) | The sentinel rows of section 1 (`alarm`) | New. Cheap: hunters are 5 per 1000 tiles, so the read is over a few entities |
| **A crowd of players** | the players within 20 tiles of the anchor | 20 tiles | Three or more players within 20 tiles of a herd's anchor for 8 think steps in a row move the anchor 8 tiles away from their centre, to the nearest habitat tile, and the herd RETURNs to it; the anchor comes back when the circle has been empty 60 steps. Six or more: the kind is gone to ground in that circle until it empties (SLEEP at the anchor, senses at a third). HUNTING 8's spawn rule already keeps 14 tiles from a player | A hunter's den does not move; its leash holds (COMBAT 4.9) | A percher lifts and does not return while 3 or more stand within its `alert_tiles` + 4 | New; with the wildfire row, one of the two rules of this page that write, and they write only the herd's anchor (the herd leader's own entity, at its think step). The read is the one HUNTING 1 already makes for the 40-tile step gate. It is the spatial half of the balance by player count (BESTIARY_LANDS 4, #432): the caps keep the count right, this keeps the crowd's own screen empty and the next screen full |
| **A sleeper** (a character left asleep in the world, DECISIONS 2026-10-23) | the sleeper's tile | none | Not a player's tile for the counter: no ALERT from a sleeper | Not a target by default: no STALK, no CHASE, no bite, until the combat and presence waves answer what may harm a sleeper (DECISIONS 2026-10-23); this page does not decide it (section 8, question 7) | Nothing | New, and one line in the counter's loop |

Three corrections the table makes to the pages before it:

- **BESTIARY 2 rule 8 and HUNTING 4 disagree on the loud acts**: BESTIARY has "chopping, digging and butchering are 9" (the memo's), while HUNTING 4 and COMBAT 4.9 propose felling or digging at 5, a new row of the gait group that params.json does not have yet. This page follows the later pages' 5, and BESTIARY's line is the one to align when the row enters params.json.
- **BESTIARY 1 and BESTIARY_LANDS 2 disagree on the wildcat**: BESTIARY has it at d2, a hunter; BESTIARY_LANDS writes it at danger 1, a defender. This page follows BESTIARY_LANDS, the later page.
- **The memo's "wolf avoided or scared with fire"** and "a reason to carry a torch" (research-hunting, the catalogue) do not survive G31 and G34: a carried light that kept a hunter off would be gear against a hazard. The fire on the ground already does what the memo wanted, through G30's ring.

## 3. The ground under the animal

A kind's `habitat` is a list of tile tags, and its standing count is `cap_per_1000` over its habitat tiles (BESTIARY_LANDS 4). The eight tags exist; the four climates are a field with no table yet; so the table says what each ground is to an animal today and in each climate.

| Tag | Today in the valley (tiles) | Who lives on it | What it does to an animal |
|---|---|---|---|
| `meadow` | 1010 | hare (its burrow at the meadow's edge), roe deer, ground fowl, goose, hart, boar at its edges | The grazing ground; tall grass props with `cover` hide the player from the cone (HUNTING 3: 2 off every animal's sight) |
| `grove` | 984 | dove, marten, fox, lynx, wildcat, the crow's perches; the climbers' refuge | Cover for the animal too: a prey kind on a grove tile is seen at `ceil(sight / 2)` from outside the grove, the forest floor is shaded (NATURE 5) and IDLE's shelter in rain |
| `riverbank` | 90 | heron, otter, goose, the drinkers' target | The edge every ground kind turns along; the shore the sling works from |
| `water` | 579 | trout; the otter's refuge | A wall to walkers, a road to fliers, the swimmer's hiding place; fish rise at dusk (the reaction `core/fish-at-dusk`, its cue `fish_rise`) |
| `ruin` | 1135 | adder on a warm stone, rat, bat, shade fox, hound, spider under a roof | Warm rock for the basker; a den for the south's kinds; a roof counts as night at every hour (BESTIARY_LANDS 3.2) |
| `town` | 175 | sparrow, crow, a pet | A wall to the wild (section 2); the town kinds' own ground |
| `path` | 123 | crossed by everything, lived on by nothing | A track is a sign here (HUNTING 1: "find it by its signs"); no spawn on the opening's path legs (HUNTING 8) |
| `interior` | 0 | rat, bat, spider | The roof rule; nothing else |

By climate (NATURE 2), the same tags with another weight on the animal: in the **cold** highland and on the passes, snow is a look on the tile (NATURE 3) and a track in it lasts twice as long (the memo; REACTIONS phase C's tracks), small kinds move at the sneak's pace through it in winter, and the hare wears its winter look (section 2); in the **wet** edge of the bay, the reed marsh is riverbank for the heron, the goose and the duck the memo defers, and fog is most mornings; in the **dry** south, the ground is ruin and bare ground, water is scarce, and the hours are the night's; the **temperate** valley is the table as written. None of this is a second map: a climate changes the weights and the hours, never a tile's walkability (NATURE 3).

## 4. The shape of a day

The route is a weighting of WANDER's target and of the quiet states by the hour, read at the think step. Four parts of the day, five classes; the hours are the valley's and the sun table moves them by season (NATURE 3). The south's roof counts as night at every hour and its kinds run the night column by day.

| Class | 05 to 08 (dawn) | 08 to 17 (day) | 17 to 20 (dusk) | 20 to 05 (night) |
|---|---|---|---|---|
| Prey that drinks (deer, goat, hart, goose) | WANDER to water, GRAZE at its edge | GRAZE and IDLE in the meadow; the herd under the trees in rain and at the day's heat | WANDER to water again, then GRAZE toward the anchor | SLEEP at the anchor from 22; the two hours before are the dusk ramp, awake and jumpy (BESTIARY 2, rule 7) |
| The boar | Awake from 05, WANDER to water and GRAZE | SLEEP in its den from 09 | SLEEP until 19 | Awake 19 to 23, WANDER and GRAZE, then the den (BESTIARY 1, hours 05:00-09:00 and 19:00-23:00; BESTIARY 2 rule 7: the boar keeps the predators' hours) |
| Small prey (hare, fowl, dove, rat by night) | GRAZE close to the anchor | GRAZE and IDLE; the hare sits up (IDLE) between bouts | GRAZE | SLEEP in the burrow or the roost; the marten is the other way round, awake from 18, the rat from 20 and at any hour under a roof |
| Hunters (wolf, lynx, bear, the south's fiend) | RETURN to the den, GRAZE there (the rest) | SLEEP at the den; the bank wolf keeps G30's clock | SLEEP until its waking hour; at it, IDLE at the den's mouth two steps, then WANDER | WANDER the roam circle; a carcass after 60 steps; STALK on a target |
| Scavengers and perchers (crow, sparrow, foxes, bat, moths) | The crow and the sparrow to the town's edge and the path (the day's leavings) | Perch, lift, return (`return_s`); the fox asleep | The crow to its roost tree; the fox out; the moths at the lamps from dusk | The fox ranges; the bat and the moths at the lamps; the valley's crow sleeps, the south's crow keeps the night as well (BESTIARY_LANDS 3.2) |
| Fish (trout) | Rise at dawn, IDLE under the bank by day | Under the bank | Rise at dusk (the reaction `core/fish-at-dusk`) | Still |

The player reads the route as a hunting rule nobody states: water at dawn and dusk is where the deer are, the meadow at noon is where the hare is, a fox is at the trail's dead end after dark, and the crows at the town's edge in the morning mean nothing died in the night.

## 5. Every kind of the three lands, in the fields

The thirty-one kinds of BESTIARY 1 and BESTIARY_LANDS 2 and 3 (#432), the carrion crow in one row for both its lands, in section 1's fields. The twelve of the valley and the highland carry the land BESTIARY 1 gives them as one group. Codes: **flight** G ground, F fly, S swim, C climb, B burrow; **sleeps** as the list of section 1; **fire** K keeps away, E holds at the edge, D drawn to a lamp, I ignores; **water** W wall, X crosses, S swims, L lives in, E its edge; **weather** C takes cover in rain, R roosts in a storm, U stays in when it rains, N none; **town** A avoids, T town kind, N none. Senses and hours are BESTIARY's and BESTIARY_LANDS' and are not repeated.

| Kind | Land | Weights I/G/W | Roam | Group (heaviest band) | Flight | Sleeps | Drinks | Alarm | Fire | Water | Weather | Town | Carrion | Looks back |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Sparrow | valley, highland | 30/40/30 | 6 | 5 to 12 | F | tree | no | 5 | I | X | R | T | no | no |
| Carrion crow | valley, highland, south | 40/20/40 | 10 | 2 to 4 | F | tree | no | 5 | I | X | R | T | yes | yes |
| Trout | valley, highland | 50/30/20 | 6 | 2 to 4 | S | water | no | 0 | I | L | N | N | no | no |
| Hare | valley, highland | 30/50/20 | 8 | 1 | B | den | no | 0 | K | W | C | A | no | no |
| Roe deer | valley, highland | 20/50/30 | 12 | 2 to 4 | G | ground | yes | 4 | K | W | C | A | no | yes |
| Ground fowl | valley, highland | 30/50/20 | 6 | 5 to 12 | G | ground | no | 5 | K | W | C | A | no | no |
| Highland goat | valley, highland | 30/50/20 | 10 | 5 to 12 | C | rock | yes | 3 | K | W | C | A | no | yes |
| Wild boar | valley, highland | 20/50/30 | 10 | 2 to 4 | G | den | yes | 4 | K | W | N | A | no | no |
| Dust adder | valley, highland | 70/0/30 | 6 | 1 | B | rock | no | 4 | K | W | U | A | no | no |
| Wolf | valley, highland | 10/20/70 | 14 | 2 to 4 | G | den | yes | 12 | E | W | N | A | yes | yes |
| Wildcat | valley, highland | 40/10/50 | 10 | 1 | C | den | no | 0 | K | W | N | A | no | yes |
| White bear | valley, highland | 30/30/40 | 12 | 1 | G | den | yes | 8 | E | W | N | A | yes | no |
| Wood dove | elf wood | 30/40/30 | 8 | 5 to 12 | F | tree | no | 5 | I | X | R | A | no | no |
| Grey heron | elf wood | 60/30/10 | 8 | 1 | F | reeds | no | 3 | K | E | R | A | no | no |
| Wild goose | elf wood | 20/50/30 | 10 | 5 to 12 | F | reeds | yes | 6 | K | S | R | A | no | no |
| River otter | elf wood | 20/30/50 | 8 | 1 | S | reeds | no | 0 | K | S | N | A | no | no |
| Tree marten | elf wood | 20/20/60 | 10 | 1 | C | tree | no | 3 | K | W | C | A | no | yes |
| Silver fox | elf wood | 10/20/70 | 14 | 1 | G | den | yes | 0 | K | W | N | A | yes | yes |
| Moon moth | elf wood | 50/0/50 | 6 | 5 to 12 | F | tree | no | 0 | D | X | U | A | no | no |
| White hart | elf wood | 20/50/30 | 14 | 2 to 4 | G | ground | yes | 8 | K | W | C | A | no | yes |
| Great eagle | elf wood crest | 60/10/30 | 14 | 1 | F | rock | no | 6 | I | X | R | A | no | no |
| Wood lynx | elf wood, d2 | 40/10/50 | 12 | 1 | C | den | no | 0 | E | W | C | A | no | yes |
| Barrow rat | south | 20/40/40 | 6 | 5 to 12 | B | roof | no | 2 | K | W | N | T | yes | no |
| Ash bat | south | 30/0/70 | 10 | 5 to 12 | F | roof | no | 5 | D | X | U | A | no | no |
| Grave moth | south | 50/0/50 | 6 | 5 to 12 | F | roof | no | 0 | D | X | U | A | no | no |
| Shade fox | south | 10/20/70 | 14 | 1 | G | den | no | 0 | K | W | N | A | yes | yes |
| Bone hound | south | 30/20/50 | 10 | 2 to 4 | G | den | no | 9 | K | W | N | A | yes | no |
| Cinder imp | south | 40/20/40 | 8 | 1 | C | rock | no | 4 | I | W | N | A | no | yes |
| Tomb spider | south | 80/0/20 | 6 | 1 | C | roof | no | 0 | I | W | N | A | no | no |
| Barrow fiend | south, d2 | 30/30/40 | 12 | 1 | G | den | no | 9 | E | W | N | A | yes | no |
| Ash drake | south, the descent | 90/10/0 | 6 | 1 | F | rock | no | 12 | I | X | N | A | no | no |

Readings the table makes:

- **The hare has no voice and no water:** it is turned against the bank or snared between its burrow and the meadow, and its only tell is the sit-up. The crow, with the sparrow and the fowl at 5, is the valley's sentinel for it.
- **The deer looks back and drinks:** the two habits that make it the first real hunt, at the bank at dawn, after a stalk that freezes when the head lifts.
- **Every hunter holds at the fire's edge (E)**, and the fire is already the rules' own answer (G30, G34). No hunter crosses water; the river is a wall to the player too, so it is this page's reading of the kernel's solid water, not an answer the rules name.
- **The south's small kinds seek the lamps** (the bat and the moths) and the imp and the drake ignore the fire; its fiend holds at the edge as hunters do everywhere; none drinks: a dry land's day runs on roofs and lamps, not on water and sun.
- **The ash drake is a landmark, not a roamer:** asleep on its ledge by day and seen from the stair, a cap of one, no STALK until tier 8 opens (BESTIARY_LANDS 3.2), so its roam is 6 and its weights all but still.
- **Carrion is the south's economy:** the crow, the rat, the fox, the hound and the fiend all come to a carcass, so a kill in the south is a crowd within 30 steps, and the player who leaves one has told the hall.

### 5.1 Groups: who goes with whom

BEHAVIOUR 1's `herd` field (5.1.7, the group field row) gave each kind one cluster size (1, 2 to 4, or 5 to 12), laid by the spawner and fixed; section 1 now carries `group` and `sentinel` in its place. This subsection makes the group a field of the kind with a shape and a size that change, slowly and out of sight, and says how a group moves, flees and comes back together. It adds no state to the ten (HUNTING 2) and no write beyond those that exist: each animal its own state and the leader its herd's anchor (section 6), and the spawner's own write that already adds a member at a refill (HUNTING 8).

#### 5.1.1 The fields

| Field | Values | What it does | In HUNTING |
|---|---|---|---|
| `group` | a class (`solitary`, `herd`, `flock`, `pack`) and four weights that sum to 100, over the bands **solo** 1, **pair** 2, **small** 3 to 4, **large** 5 to 12; an optional season row (5.1.4) | The class says how the group moves and flees (5.1.3); the weights say how many stand at one anchor, drawn once a group period (5.1.2). Today's three `herd` values are the bands at their heaviest weight: 1 is solo, 2 to 4 is pair and small, 5 to 12 is large | 2, WANDER and ALERT; 8, "cluster size" |
| `sentinel` | yes or no; only on a `herd` or `flock` kind | The leader never GRAZEs while the others do: it stands at IDLE at full sight on the highest tile within 2 of the group, and its ALERT is its `alarm` noise, which the others hear by section 1's `alarm` row (section 8, question 5; FAMILIES 6.1, the sentinel) | 2, IDLE and ALERT |

The bands stay inside the sizes HUNTING 8 and section 5 already use; nothing goes above 12. The four classes, **proposed**:

- **solitary:** one animal at its anchor; a pair at most in its season row (5.1.4). The class of every kind section 5 gives a group of 1.
- **herd:** ground prey and the defenders that live together (deer, goats, the boar's sounder, the rat's swarm, the trout's few under one bank). Scatters on FLEE, regroups at the anchor (5.1.3).
- **flock:** fliers, and the ground fowl, whose burst is one noise (alarm 5, section 5). A flock of fliers lifts as one and lands as one; a flock of the ground fowl scatters and regroups by a call (5.1.3).
- **pack:** hunters and defenders at danger 1 or more that move together (the wolf, the bone hound). Keeps together on every move (5.1.3, 5.1.5).

#### 5.1.2 The size: one step a group period, only while nobody can see the group

1. **When: the group period.** **proposed.** A group's size moves on a clock of its own, separate from the refill of a lost member (HUNTING 8, which stays as written). The group period of an anchor is its kind's `refill_d` of BESTIARY_LANDS 1; the period number is `floor(game day / refill_d)`. Each anchor has at most one size step a period, and the anchor stores the last period it stepped. The step is applied lazily, when the spawner next touches the anchor (its own pass, or the moment a player comes within 40 tiles, before the members become entities), and it catches up at most one period: an anchor left alone for ten periods takes one step, not ten, so a long absence never empties or floods a place (G28 is not touched). The step runs only while the group is collapsed to an anchor and a count, with no player within 40 tiles (HUNTING 1: "its herd is kept as an anchor and a count"), so its members are not entities and nobody can see one appear or leave. A group nobody hunts still changes, once a period.
2. **What is drawn.** A target size: first the band, by the kind's weights, then the count inside the band. Both use the kernel's existing keyed draw, `draw(seed, entity, counter)` in `kernel/src/rng.ts`, a pure function of the three, so each use takes its own entity string: the band is `draw(seed, "group:<anchor id>", 2p)` and the count `draw(seed, "group:<anchor id>", 2p + 1)`, with p the period number. Two draws never share an entity and a counter, so the band and the count are independent, and no other system (the quality at appearance, keyed on the bare anchor id; the coats of FAMILIES 7, `coat:<id>` as FAMILIES 9a proposes) collides with them. The draw is fixed by the world, the anchor and the period, and replays the same on the server every time. **proposed.**
3. **Who agrees, and how.** The world's seed is the server's alone: `publicState` drops it before any screen sees the state (`kernel/src/patch.ts`; `PublicState` is `Omit<State, 'seed'>`, kernel review R4). So no client recomputes a draw; every client agrees because the members are entities in the shared state and each client draws what the server sends. "Deterministic from the anchor's id and the seed" holds on the server, where the replay is checked; "every client agrees" holds because there is one state. The coats of FAMILIES 7 take the same answer: drawn on the server under `coat:<id>` and sent with the entity (FAMILIES 7 and 9a, the seed row).
4. **How fast it moves, and what it keeps.** A target only steers the step; a step never adds or removes more than one animal. Below its target, the anchor gains one member; above it, one member leaves, removed from the count as if it had moved on. So a group of 4 drawn down to a pair takes two periods to get there. The region's population does not drift with the bands: at each period the spawner's pass compares the region's members of a kind with its standing count (BESTIARY_LANDS 4), and when they fall short by at least the lower bound of the kind's smallest band with weight, it lays a new anchor under HUNTING 8's laying rules (14 tiles from a player, out of view, 12 from the town square, never on the opening's path legs). The weights decide how a fixed population is split into groups, not how many animals there are, so the yield of BESTIARY_LANDS 4 does not change and the world is not emptied (BESTIARY 2 rule 11). **proposed.**
5. **A lone animal joins, a group splits.** At a period step, a solitary animal of a `herd`, `flock` or `pack` kind whose anchor lies within its kind's `roam` of another anchor of the same kind that is below its target joins that group, only while no player is within 40 tiles of either anchor. The join is the spawner's, not the animal's: one write moves the count from the retired anchor to the receiving one, and the joiner is re-anchored while out of view, not walked. A group drawn to `solo` with two or more members does not split into two anchors; it sheds one member a period until it is one. An anchor is born only by the spawner's laying rules (HUNTING 8), now also run by rule 4's pass, never by a split. **proposed.**
6. **The cap is the ceiling.** A drawn size is cut at the step to what the region's standing count still allows (`cap_per_1000` over its habitat tiles, BESTIARY_LANDS 4); a large band on a kind whose region cannot hold 5 more is drawn as the largest band it can hold. The check does not refuse such a kind; it warns (section 7).

#### 5.1.3 How a group moves, flees and comes back

The leader rule as it stands: one leader, the rest follow when their own step ends, and ALERT spreads to members within 8 (HUNTING 2, WANDER and ALERT); the leader alone writes the anchor (section 6). Added here, **proposed**:

| Class | WANDER | On FLEE | After FLEE |
|---|---|---|---|
| solitary | its own (HUNTING 2) | its own, by its `flight` (section 1) | its own |
| herd | members pick their tile within 3 of the leader's target | **Scatter:** each member runs its own distance map from the threat, from where it stood, so a herd fans out by its own geometry, with no extra rule | **Regroup:** each member's WANDER target is a tile within 3 of the anchor instead of HUNTING 2's free pick; it still keeps 60 steps away from the tile it fled (HUNTING 2, FLEE), and when the anchor lies inside that ring it waits at the ring's edge until the 60 steps run out. The herd stands together again at the anchor, which is the player's next stalk |
| flock of fliers (`flight` F) | members pick their tile within 2 of the leader's target | **As one:** the leader's FLEE picks the landing tile, sight + 4 away (section 1, `flight` F); each member lands on a free tile within 2 of it (a goose's skein draws the nearest members in a V inside those 2 tiles, FAMILIES 6.1) | The flock is already together; IDLE at the landing, then RETURN as one |
| flock of the ground fowl (`flight` G) | members pick their tile within 2 of the leader's target | **Scatter:** each member runs then flutters on its own map from the threat, as `flight` G, the herd's scatter | **The call:** each member regroups at the leader's landing tile by a call (FAMILIES 6.1, the covey's call) |
| pack | members keep within 2 tiles of the leader on every move | **Together:** members path to a tile within 2 of the leader, which runs the map; no member runs its own | Together, RETURN to the den |

- **The leader.** The member with the lowest id. When the leader is taken, the next lowest leads from its next think step. A herd or sounder whose leader is taken scatters (each member FLEE on its own map, whatever its class) and regroups at the anchor under the new leader after the 60 steps. **proposed.**
- **One fleeing moves all.** HUNTING 2 spreads ALERT to members within 8 and sends a hit or a noise of 8 or more straight to the tier's state. Proposed here, one step further, as a read and not a write: a member that sees a member of its own group in FLEE within 8 at its own think step enters FLEE, not ALERT, so a bolting herd bolts whole within one think round (the reference: Breath of the Wild's prey, where one fleeing animal moves the herd, cited in FAMILIES 7). No member writes another's state. Question 10 asks it; the default is A.
- **At night.** A group at SLEEP lies within 2 of its anchor, members in one huddle; nothing new, the anchor and the state as they are.

#### 5.1.4 The season

What NATURE has: the valley's year is the real year, northern months (NATURE 3, question 1 answered); four seasons with a sun table each (spring 06:00 to 19:00, winter 07:30 to 16:30); "a season never gates content" (NATURE 3, DECISIONS 2026-10-09). Seasons are decided and not built. NATURE's opening line says the kernel reads none of it but the weather condition; this page already proposes three season reads for animals (the hours by the sun table, `winter_look`, the bear's den months, sections 1 and 2), and a season row on `group` would be a fourth, read by the spawner at the period step only.

Proposed: a kind may carry a season row that replaces its weights in one season: **pairs in spring** (the weight moves to `pair`), **larger groups in winter** (the weight moves to `large`). The row changes only the weights; the cap, the refill and the yield do not move (5.1.2, rules 4 and 6), and no kind is absent in any season, so nothing is gated. A season row on a kind whose land keeps the roof's night (the undead south, BESTIARY_LANDS 3.2) has no effect: that land has no season the pages use. Until seasons are built, every kind runs its plain weights. Question 9 asks it.

Pairs in spring bring no young: none exist in the state and none are drawn (BESTIARY 2 rule 2: "A herd shows adults only"; HUNTING 10). A pair is two adults at one anchor, nothing more.

#### 5.1.5 The pack and its danger

A pack is a group of hunters (the wolf, d2) or defenders (the bone hound, danger 1), and so it waits for the fight like each of its members: the pack and trapping "wait for the combat stream" (BESTIARY, question f, default). The bank wolf of today (`props/hazard_wolf`, map.json's two wolves) stays a single hazard on its round under G30 and G34 while question 12 stands at its default; the owner may instead let a night round run two wolves on one learnable loop (question 12, B). What a pack adds when it comes, **proposed** unless cited:

1. **Shared hearing.** Every member hears with its own ear (HUNTING 3); the first member to notice puts the others within 8 into ALERT (HUNTING 2), so a pack notices at the best of its members' distances, never at a sum.
2. **First notice, then the chase.** A pack's STALK turns to CHASE "on first notice" (HUNTING 2, STALK), as written.
3. **The walk holds.** Each member chases at the player's walk, never faster (HUNTING 2, CHASE), with the leash of 7 tiles from the den (`leash_tiles`) and the give-up of 50 ticks (`give_up_t`, COMBAT 4.9). A player who keeps walking away is never caught by a pack, as by one wolf.
4. **The road stays open.** No pack member takes a tile on the player's road to the nearest safe place (G34's road, the distance map the check of G34 already walks). A pack follows; it never cuts off. Question 11 asks it.
5. **What a pack does to a herd.** A hunter in a prey's sight is a threat like a player (section 2, "Another animal"); a pack of three is three readers' worth of the same threat and moves a herd once, not three times, since the herd's FLEE is one state.
6. **How many bites.** What a pack's members land in a fight, together, is COMBAT's to say with the fight; this subsection gives a pack no harm of its own.

#### 5.1.6 Every kind of section 5, its group

Weights are solo / pair / small / large and sum to 100; every row is **proposed**. "Spring" and "winter" are the season rows of 5.1.4. Section 5's group column is the source of each row's heaviest band.

| Kind | Land | Group today (section 5) | Class | Sentinel | Weights S/P/Sm/L | Season row | Note |
|---|---|---|---|---|---|---|---|
| Sparrow | valley, highland | 5 to 12 | flock | no | 0/0/20/80 | winter 0/0/10/90 | lifts as one at the town's edge |
| Carrion crow | valley, highland, south | 2 to 4 | flock | no | 10/50/40/0 | winter 0/20/40/40 (the roost) | the valley's alarm (section 5 readings), not a `sentinel` leader; mobs a raptor (FAMILIES 6.1, the crows) |
| Trout | valley, highland | 2 to 4 | herd | no | 20/40/40/0 | none | scatters under the bank |
| Hare | valley, highland | 1 | solitary | no | 100/0/0/0 | spring 70/30/0/0 | its den is FAMILIES 3.1, the line home |
| Roe deer | valley, highland | 2 to 4 | herd | no | 0/40/60/0 | winter 0/10/50/40 | regroups at the water or the anchor |
| Ground fowl | valley, highland | 5 to 12 | flock | no | 0/0/20/80 | spring 0/50/30/20 | the covey's call (FAMILIES 6.1) |
| Highland goat | valley, highland | 5 to 12 | herd | yes | 0/0/20/80 | none | the sentinel (FAMILIES 6.1) |
| Wild boar | valley, highland | 2 to 4 | herd | no | 20/30/50/0 | none | the sounder (FAMILIES 6.1) |
| Dust adder | valley, highland | 1 | solitary | no | 100/0/0/0 | none | |
| Wolf | valley, highland | 2 to 4 | pack | no | 30/60/10/0 | winter 10/60/30/0 | 5.1.5; the weight sits on the pair, which a d2 region can hold (BESTIARY_LANDS 4: a d2 kind on 400 tiles stands at 2) |
| Wildcat | valley, highland | 1 | solitary | no | 100/0/0/0 | none | |
| White bear | valley, highland | 1 | solitary | no | 100/0/0/0 | none | its ring is its own |
| Wood dove | elf wood | 5 to 12 | flock | no | 0/0/20/80 | spring 0/40/40/20 | |
| Grey heron | elf wood | 1 | solitary | no | 100/0/0/0 | none | |
| Wild goose | elf wood | 5 to 12 | flock | yes | 0/0/20/80 | winter 0/0/0/100 | the watcher (BESTIARY_LANDS 3.1) is the sentinel; the skein (FAMILIES 6.1) |
| River otter | elf wood | 1 | solitary | no | 100/0/0/0 | none | |
| Tree marten | elf wood | 1 | solitary | no | 100/0/0/0 | none | |
| Silver fox | elf wood | 1 | solitary | no | 100/0/0/0 | none | |
| Moon moth | elf wood | 5 to 12 | flock | no | 0/0/0/100 | none | a cloud at a lamp, no flee of its own beyond its `fire` D |
| White hart | elf wood | 2 to 4 | herd | no | 0/40/60/0 | none | its alarm 8 lifts the glade (section 5) |
| Great eagle | elf wood crest | 1 | solitary | no | 100/0/0/0 | none | |
| Wood lynx | elf wood | 1 | solitary | no | 100/0/0/0 | none | |
| Barrow rat | south | 5 to 12 | herd | no | 0/0/20/80 | none (the south) | scatters to the roof |
| Ash bat | south | 5 to 12 | flock | no | 0/0/10/90 | none (the south) | once it lifts the hall knows (BESTIARY_LANDS 3.2) |
| Grave moth | south | 5 to 12 | flock | no | 0/0/0/100 | none (the south) | as the moon moth |
| Shade fox | south | 1 | solitary | no | 100/0/0/0 | none | |
| Bone hound | south | 2 to 4 | pack | no | 0/40/60/0 | none (the south) | danger 1, bluffs until the fight (HUNTING 11, question 1); where its region cannot hold 3 the step draws a pair (5.1.2 rule 6) and the check warns |
| Cinder imp | south | 1 | solitary | no | 100/0/0/0 | none | |
| Tomb spider | south | 1 | solitary | no | 100/0/0/0 | none | |
| Barrow fiend | south, d2 | 1 | solitary | no | 100/0/0/0 | none | |
| Ash drake | south, the descent | 1 | solitary | no | 100/0/0/0 | none | a landmark at cap 1 (BESTIARY_LANDS 3.2) |

Counted: 31 rows, the kinds of section 5. Readings: every row's heaviest band lies inside section 5's group value, so the table moves nothing on day one but the bands next to it; the only kinds that change shape with the season are those whose real counterparts are known for it (spring pairs among the hare, the fowl and the dove; winter gatherings of the crow's roost, the roe, the sparrow, the goose and the wolf); the south has no season row at all; two kinds carry `sentinel`, the goose and the goat.

#### 5.1.7 Where groups meet an existing rule

The rules this subsection meets, each with the change it proposes, and the one rule the page's weather, climate and season rows meet (sections 2 and 4). The rows that meet a rule of HUNT_FAMILIES (the line home, the flush, the gull) are in that page's section 9a.

| Where | The existing rule or decision | How the proposal resolves it |
|---|---|---|
| A group's size "deterministic from the anchor's id and the seed so every client agrees" | The seed is the server's alone: `publicState` drops it (`kernel/src/patch.ts`; `PublicState`, kernel review R4) | The server draws with `draw(seed, "group:<anchor id>", 2p)` and `2p + 1` and replays it; clients agree because they receive the members (BEHAVIOUR 5.1.2 rules 2 and 3). FAMILIES 7's coats take the same answer: drawn on the server under `coat:<id>` and sent with the entity (FAMILIES 7 and 9a, the seed row) |
| One keyed draw, many uses | `draw(seed, entity, counter)` is a pure function of the three (`kernel/src/rng.ts`) | Every use has its own entity prefix (`group:`, `bolt:`, `coat:`, `route:`, `trap:`, `wind@`), and a kernel test refuses two rules sharing one (BEHAVIOUR 5.1.2 rule 2; section 7) |
| Sizes that change | HUNTING 8 and BESTIARY 2 rule 11: one lost member back after a game day, no player within 20; BESTIARY_LANDS 4: the refill is "one lost member back" | The loss refill stays; a separate group period steps the size once a `refill_d`, lazily, caught up at most one period, only while the group is collapsed with no player within 40 (BEHAVIOUR 5.1.2 rule 1), so groups nobody hunts change too |
| The yield and the empty world | BESTIARY_LANDS 4: the yield is the standing count over `refill_d`; BESTIARY 2 rule 11: no world emptied | The spawner's pass lays a new anchor when a region's members fall short of its standing count by a band; the weights split the population, they do not shrink it (BEHAVIOUR 5.1.2 rule 4) |
| The group field | BEHAVIOUR 1's `herd` (1, 2 to 4, 5 to 12); BEHAVIOUR 5's Herd column; FAMILIES 3.8's "(BEHAVIOUR 5, herd)" | Replaced by `group`, whose bands contain the three values; section 5's column renamed "Group (heaviest band)"; FAMILIES 3.8's citation updated in the same pull request (sections 1 and 5 of this page) |
| A sentinel | BEHAVIOUR 1: its fields "are the whole of a kind's character"; BEHAVIOUR 6: "the sentinel is a noise in the table, not a message" | `sentinel` is a field of BEHAVIOUR 1 (5.1.1) with a column in 5.1.6; its ALERT reaches the others only as its alarm noise (FAMILIES 6.1, item 4) |
| A lone animal joins, a group splits | HUNTING 8's laying rules are the only birth of an anchor; BEHAVIOUR 6: no animal writes another, the leader alone writes its anchor | A join is the spawner's write, moving a count from one anchor to another while no player is within 40 of either; a split sheds members and never makes an anchor (BEHAVIOUR 5.1.2 rule 5) |
| The cap and a large band | BESTIARY_LANDS 4: a d2 kind on 400 tiles stands at 2; the whole first map holds 994 tiles at d2 | The step cuts a band to what the region holds and the check warns, never refuses; the wolf's weight sits on the pair (BEHAVIOUR 5.1.2 rule 6, 5.1.6) |
| The season in the group | NATURE: "The kernel never reads any of this" but weather; NATURE 3 and DECISIONS 2026-10-09: "a season never gates content" | A spawner read at the period step, like BEHAVIOUR's hours and winter look; weights only, no kind absent, cap and yield fixed (BEHAVIOUR 5.1.4); section 8, question 9 |
| Pairs in spring | BESTIARY 2 rule 2: "A herd shows adults only"; HUNTING 10 | A pair is two adults; no young in the state, ever (BEHAVIOUR 5.1.4) |
| One fleeing moves all | HUNTING 2: ALERT spreads to members within 8; BEHAVIOUR 6: no animal writes another | A member that sees a group member in FLEE within 8 at its own think step enters FLEE: a read, proposed one step past HUNTING 2; section 8, question 10 |
| Regroup at the anchor | HUNTING 2, FLEE: then WANDER "away from that tile for 60 steps" | The regroup target keeps the 60-step ring and waits at its edge when the anchor is inside it (BEHAVIOUR 5.1.3) |
| A wolf pack | BESTIARY question (f): the pack waits for the combat stream; G34, G35; the bank wolf is a prop under G30 | The pack is written for d2 creature wolves with the fight; it chases at the walk, holds the leash, never takes the road to safety (BEHAVIOUR 5.1.5); whether the night round may run two wolves before it is the owner's, section 8, question 12 |
| The word "pack" | COMBAT 4.6 (the pack) and 4.7 (its event `{ e: 'pack' }`): the finds left where a player fell | The group class value `pack` lives in the creature schema only; prose says "a wolf pack" and "the pack where it lay" as the pages do; no shared field or code path |
| Weather, climate and season for animals (sections 2 and 4, not groups) | NATURE: "The kernel never reads any of this except the one `weather` condition ... never what a rule answers"; NATURE 4: "Weather is a look and a sound. Nothing in the table changes a rule"; the one decided exception is fog on a predator's sight (G47) | The kernel also reads weather, climate and season for animals (hearing in rain and storm, the GRAZE and IDLE weights of the `weather` codes, the hours by the sun table and in the dry climate, `winter_look`, the bear's den season), and never for a player's walk, gather or craft; NATURE's opening line and NATURE 4 are amended to say so in the same pull request; section 8, question 13 |

## 6. What it costs the server

Every stimulus is a read at the think step of state the step already holds: the hour (one read), the target tile's tag (a map lookup), the region's weather (one draw a day, cached), the fires within 8 (a list per chunk; a player's own fire is one entity), the players within 40 (the gate HUNTING 1 already pays), the carcasses within sight + 4 (a list per chunk), the hunters within sight (5 per 1000 tiles). Three kinds of write exist: each animal writes its own state, the herd leader writes its herd's anchor (the crowd and the wildfire rows), and the spawner writes an anchor's count at a group period (5.1.2 rules 4 and 5). No animal writes to another animal; the sentinel is a noise in the table, not a message.

Groups add no write of an animal's. Each member thinks on its own staggered tick (HUNTING 1); a herd or flock member's WANDER reads the leader's target (one read), a member's flee spread is one read of the group members within 8, a pack member paths to a tile within 2 of the leader instead of running a map of its own (cheaper than the flee map it replaces), and a regroup's target is the anchor, already held. The size step runs once a group period per anchor, lazily, only while the group is collapsed with no player within 40 tiles (HUNTING 1), so no stepped animal pays for it: two draws (the band, then the count) and the spawner's write to the anchor's count. A join is the same spawner write touching two anchors: one count down, one up. A gull's fish read (FAMILIES 6, an ambient member) is a read of a nearby player's `busyUntil`, a field the state already holds. Nothing about a group runs while nobody looks (REACTIONS 2).

The budget: BESTIARY 1's 24 awake animals within 40 tiles of a player, HUNTING 1's think every 8 ticks, so at most 3 animals think a tick near one player and 60 near twenty players who stand apart. The measure this page proposes for the schema pull request: 200 animals and 20 players in one region at under 2 ms a 100 ms tick (COMBAT 4.2's tick), with the crowd rule on, measured in the simulated-player harness of NEXT 18 g. The crowd rule pays for itself: where players gather, the animals leave, and fewer animals stand within 40 tiles of the crowd.

Nothing here changes the client's cost: a cue (a lift, a ring on the water) is a cue as REACTIONS 3.3 has it, drawn by each client, never state.

## 7. The check rows

What `pnpm check` prints once the fields exist, in HUNTING 12's form; the names are the schema's to fix.

- `x creature.<id>: weights that do not sum to 100 (BEHAVIOUR 1)`
- `x creature.<id>: a roam under 6 or over 14 (HUNTING 2, BEHAVIOUR 1)`
- `x creature.<id>: no flight class, or a flier whose sleeps is water or den (BEHAVIOUR 1)`
- `x creature.<id>: an alarm over 12, or a silent kind with no drawn tell (BEHAVIOUR 1, BESTIARY 2 rule 9)`
- `x creature.<id>: a habitat tag the map does not have, or a wild kind whose habitat names town (BEHAVIOUR 3)`
- `x creature.<id>: a drinker with no water or riverbank tile within roam of any of its anchors (BEHAVIOUR 4; the spawner's row)`
- `x creature.<id>: a carrion kind at danger 0 whose sleeps is not tree, roof, rock or den (a ground scavenger with no safe sleep is a defender's size or stands at d1; BEHAVIOUR 5)`
- `x params.creature: fire_keep_night under fire.safe_tiles + 1, or town_keep_night under town_keep_day (BEHAVIOUR 2)`
- `x kernel: a hunter whose STALK or CHASE target is a sleeper (BEHAVIOUR 2, while question 7 stands at A)` as a kernel test, not a content row
- `x kernel: an animal that writes to another animal's state, or anything but the herd leader, or the spawner at a group period step, writing a herd's anchor (REACTIONS 2; BEHAVIOUR 5.1.2 rules 4 and 5)` as a kernel test
- `x creature.<id>: group weights that do not sum to 100, or a season row that does not (BEHAVIOUR 5.1.1)`
- `x creature.<id>: a group class of pack on a kind at danger 0 (BEHAVIOUR 5.1.1)`
- `x creature.<id>: a group class of flock on a kind whose flight is not F, but for a kind whose alarm is 5 or more (the ground fowl) (BEHAVIOUR 5.1.1)`
- `x creature.<id>: a solitary kind with weight on small or large (BEHAVIOUR 5.1.1)`
- `x creature.<id>: sentinel yes on a kind whose class is not herd or flock (BEHAVIOUR 5.1.1)`
- `! spawn.<region>: a kind with weight on a band that no region of its habitat can hold at its cap; the step will cut it (BEHAVIOUR 5.1.2 rule 6; BESTIARY_LANDS 4)`, a warning and not a refusal, **proposed** as the check's first warning form
- `x kernel: a group's size or membership that changes while any of its members is stepped, or while a player is within 40 tiles of its anchor (BEHAVIOUR 5.1.2 rule 1; HUNTING 1)` as a kernel test
- `x kernel: a group step that adds or removes more than one member, or more than one step for an anchor in one period (BEHAVIOUR 5.1.2 rules 1 and 4)` as a kernel test
- `x kernel: two rules whose keyed draws share an entity prefix (group:, bolt:, coat:, route:, trap:, wind@ and every other) (BEHAVIOUR 5.1.2 rule 2)` as a kernel test
- `x kernel: a pack member on a tile of the player's road to the nearest safe place (BEHAVIOUR 5.1.5 rule 4; G34)` as a kernel test, while question 11 stands at A
- `x kernel: a group draw read anywhere but the server's spawner, or a client that reads the seed (BEHAVIOUR 5.1.2 rule 3; kernel review R4)` as a kernel test

## 8. Open for the owner

Each one sentence, three options, A the recommendation, and the default this page is written on.

1. **Prey flees a hunter it sees.** A (recommended): yes, with the same counter as for a player, so a bolting herd is the sign of a wolf. B: only the herd's leader reads hunters, the rest follow. C: no; animals read players only. Default: A.
2. **Fog shortens every kind's sight by 2,** not the wolf's alone. A (recommended): every kind, one rule. B: the wolf as decided, prey unchanged, so fog is the hunter's weather for the player too. C: per kind, a field. Default: A.
3. **The crowd rule.** A (recommended): the anchor moves at 3 players within 20 tiles and the kind goes to ground at 6. B: the spawner's 14-tile rule only, no anchor move. C: the anchor moves at 2. Default: A.
4. **The winter coat.** A (recommended): the white look only, no finer grade, since BESTIARY_LANDS 1 keeps one grade draw in every land. B: one band finer in the cold climate's winter as well, amending BESTIARY_LANDS 1 with a param of its own. C: neither until seasons are built. Default: A.
5. **The alarm as a shared noise.** A (recommended): every kind within its ear hears another kind's alarm and goes to ALERT, or to its tier's state at 8 or more. B: the herd only, as HUNTING 2 has it. C: prey hears prey; nothing hears a crow. Default: A.
6. **A hunter at a carcass.** A (recommended): after 60 steps in d2, as HUNTING 6 has it, and the player who left it is not followed. B: never; a carcass draws carrion kinds only. C: after 60 steps in d1 and d2. Default: A.
7. **A sleeper and the animals,** until the combat and presence waves decide. A (recommended): no animal targets a sleeper. B: hunters at d2 only. C: a sleeper is a player like any other. Default: A.
8. **When a group's size changes.** A (recommended): once a group period at the anchor, only while the group is collapsed with no player within 40 tiles, one member gained or shed a step, caught up at most one period, the region's population kept at its standing count. B: drawn once when the anchor is laid and fixed for good. C: groups merge and split live when two meet. Default: A.
9. **The season in the group.** A (recommended): a season row moves the weights only (pairs in spring, larger groups in winter), read by the spawner, the cap and the yield unchanged. B: no season row until seasons are built and NATURE's "the kernel never reads any of this" line is amended for animals. C: the season moves the cap as well. Default: A.
10. **One fleeing moves all.** A (recommended): a member that sees a member of its group in FLEE within 8 at its think step enters FLEE. B: ALERT only, as HUNTING 2 has it. C: only the leader's FLEE moves the rest. Default: A.
11. **A pack and the road to safety.** A (recommended): no pack member takes a tile on the player's road to the nearest safe place. B: no extra rule, the walk-speed chase and the leash are enough. C: the pack may flank the player but never stands on the safe tile itself. Default: A.
12. **Wolves in packs before the fight.** A (recommended): no; the bank wolf stays single until the fight (BESTIARY question f). B: the night round sometimes runs two wolves on one learnable loop, the same walk speed, the same run home (G34). C: packs only with the fight and the d2 creature wolf, with no change to the night round ever. Default: A.
13. **Weather, climate and season for animals.** A (recommended): the kernel reads them for animals only (hearing in rain and storm, the `weather` codes' weights, the hours by the sun table, `winter_look`, the den season), never for a player's walk, gather or craft, with NATURE's opening line and NATURE 4 amended. B: fog only, as decided (G47), the rain, storm, cold and heat rows held until the owner opens them. C: the season's hours only, no weather read beyond fog. Default: A.

## 9. Not here

- A wildfire itself (REACTIONS 10's world event): the one row above is the animals' answer to it, nothing more.
- Wind (HUNTING 11, question 6): smell stays the one-tile ring.
- An animal felling another, a predator fed, an ecology with numbers: nothing suffers in the state and nothing is counted (HUNTING 10).
- Taming, a hunting dog, a mount: a pet is `protected` and nothing else is decided.
- Tracks and signs as a system (HUNTING 1, the memo's E1): proposed in HUNT_FAMILIES 3a, the tracking row, with no owner question in front of it; this page says only that snow keeps them longer.
- The poses: ALERT's head-up, GRAZE's head-down, the lying body, SLEEP's pose and the lift are each a direction for the owner from stills (ANIMATION 5.2; BESTIARY 4), and the hare and the crow have their first clips (#433).

## Sources

- [HUNTING.md](HUNTING.md) sections 1 to 4, 6, 8, 10 to 12; [BESTIARY.md](BESTIARY.md) sections 1, 2 (rules 5, 7, 8, 9, 11) and 3; BESTIARY_LANDS.md (#432) sections 1 to 4; [REACTIONS.md](REACTIONS.md) sections 2, 3 and 10; [NATURE.md](NATURE.md) sections 2 to 5 and 10; [FIRST_MAP.md](FIRST_MAP.md) (the regions and their climates); [COMBAT.md](COMBAT.md) sections 4.2, 4.5 and 4.9; [GAME_RULES.md](GAME_RULES.md) G30, G31, G34, G47, G84; [ANIMATION.md](ANIMATION.md) section 5.2 (the clip budgets); [OPEN_WORLD.md](OPEN_WORLD.md) 1.2.
- For the groups of section 5.1: HUNTING 8 (the laying rules, the refill); BESTIARY 2 rules 2 and 11 and question (f); BESTIARY_LANDS 1 (`refill_d`), 3.1, 3.2 and 4; NATURE 3 and DECISIONS 2026-10-09 (seasons, the real year); COMBAT 4.6 (the pack), 4.7 (its event `pack`) and 4.9; GAME_RULES G28, G30, G34, G35; [HUNT_FAMILIES.md](HUNT_FAMILIES.md) 3.1, 6 and 6.1 (the line home, the gull, the group behaviours) and 7 (the coats; Breath of the Wild's prey, cited in its sources); code, as read on `develop`: `kernel/src/rng.ts` (`draw`), `kernel/src/patch.ts` (`publicState`, kernel review R4), `kernel/src/state.ts` (`PublicState`, `busyUntil`).
- `docs/research/research-hunting.md`: the catalogue (the hours, the alarms: the marmot's whistle, the stag's bark, the songbirds' burst), numbers 32 (rain) and 36 (the cold's spoil), patterns 8 (herds move away from a predator's last place) and the catalogue's fire lines.
- DECISIONS.md: 2026-10-19 (world reactions are read, never run; the owner's answers: a wildfire is fought together), 2026-10-20 (weather by day as built), 2026-10-21 (nature's schema fields), 2026-10-23 (combat round 4, noise turns every head; the campfire as the safe log-out; a character left asleep in the world), 2026-10-25 (the ambient creatures wait for the redraw), 2026-10-29 (animals, then the foundations).
- Code, as read on `develop`: `schema/src/index.ts` (`TILE_TAGS`, `CLIMATES`, `WEATHERS`, `HAZARD_KINDS`, `CreatureKind`, the `fire` params); `kernel/src/state.ts` (`fireBurns`); `kernel/src/danger.ts` (`fireArea`, `isSafe`, `predatorAt`, the cone and the cover); `kernel/src/step.ts` (`kindle`, `feed`); `kernel/src/reactions.ts` (`weatherOf`, `regionOf`); `content/core/map.json` (the tags' counts, the 17 ambient spots, the two wolves); `content/core/params.json` (`gait`, `fire`, `hazard.predator`, `hazard.deep_water`).
