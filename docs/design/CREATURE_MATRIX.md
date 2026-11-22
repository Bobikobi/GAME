# The creature matrix

Stage 2 of #789. The tree is Hunting for tracks and goods, Strike and Aim for openings and reach, and Guard for a readable recovery after a heavy move. Hunting's goods feed Handcraft's `wear` branch. See `docs/design/PROGRESSION.md:171–181` and `docs/design/CLOTHING.md:120–139`.

## 1. How the large games do it

The Diablo II Resurrected data has 661 enabled monster rows after town NPCs are removed. They use 159 animation codes, about 4.2 kinds per code overall. The 91 codes that are shared have a median of six kinds. About 60 of 66 super uniques reuse a regular monster's body. The five act bosses each have their own. [D2R monster table](https://github.com/blizzhackers/d2data/blob/master/json/monstats.json), [D2R super-unique table](https://github.com/blizzhackers/d2data/blob/master/json/superuniques.json).

An animation code is evidence of reuse. The table does not say what the player can see or what changes the fight. Here every regular kind needs both a visible tell and a different opening, path or response. A title can share a body too. Its fight and death still have to read as its own. Diablo II's usual monster walk has eight directions against the player's sixteen. Count here by drawn movement, before views and frames, so a change in viewing direction cannot fill the movement target. [D2R direction table](https://github.com/blizzhackers/d2data/blob/master/json/monstats2.json), [D2 player animation modes](https://d2mods.info/forum/kb/viewarticle?a=171).

## 2. What the rows mean

A family names one moving body. A kind names a playable encounter with that body. A region limits places where it can appear. A spot supplies area danger, group placement and rank. Folk, giver, dweller and companion have their own roles. This tally uses foe, boss and ambient/prey/defender/hunter animal roles. A person-foe routes and can count among the 700. A named kind with both a hunt and a fight has one identity. Its planned encounter decides which ledger it enters. Fight-first kinds go in the 700 or the 100. A prey animal that can defend itself stays in the 90. White bear, barrow fiend and ash drake only count when they have the planned fight. See `docs/design/CREATURES.md:130–181,189–210`, `docs/design/BESTIARY_LANDS.md:9–20,62–79`.

| Field | Rule |
|---|---|
| Area danger | Take `d` from the placement area (0–9); no fight or predator crosses onto d0, the town or a lit camp. A region can contain several values. |
| Animal danger | 0 ambient/flee, 1 defend, 2 hunt. For hunted kinds the cap is 12/8/5 per 1,000 habitat tiles respectively. Defenders begin at d1, hunters at d2. A small body never hunts. |
| Hunt tier | Applies only to a take route and its goods. On ordinary first-ring placements, d0/d1/d2 propose T1/T2/T3. At d1 settle tomb spider at hunt T2 for its T2 silk. A species using more than one d needs one designated harvest habitat. Other placements can be sight-only. Keep the printed low-tier BESTIARY_LANDS seeds, including T1 north and south prey on d1, as explicit hunt-tier overrides. The named above-ladder fiend and drake keep hunt T5 and T8 when their takes open. |
| Fight tier | Own field. First placements take the tiers in section 3. The dormant wolf record has hunt T3 and fight T1. Propose fight T2 for the first live wolf after the first-foe calibration, with its d2 hunt at T3. Bank boar fight T2/hunt T2; lynx and eagle fight T2/hunt T3; hound and imp fight T2 with hunt T2 and T3 respectively; spider fight T2/hunt T2. |

See `docs/design/OPEN_WORLD.md:256–272`, `docs/design/BESTIARY_LANDS.md:9–18,26–39,49–77`, `docs/design/CREATURES.md:151–183`, `docs/design/WEAPON_MATRIX.md:538–542`, `content/core/map.json:4329–4367` and `schema/src/index.ts:2325–2342`. A hunt block uses the take ways stalk, snare, lure, fish or fight where the species allows them. It carries size, hours, dressing time, habitat, senses, danger, refill, and one to five plain goods with shares summing to 100. Creature grade stays separate. A protected animal, a person or a bone-thing supplies no carcass goods. See `docs/design/HUNTING.md:69–90,102–130`, `docs/design/BESTIARY.md:48–61`.

## 3. Foe families

These are the proposed regional lines for the full game. The first row group in each region covers first-ring candidates. Later ground is a land slot in that world's climate, with its own card and sourced materials. Tags in the group give the habitat and base fight tier. Each body supplies five kinds. Read the four letters left to right to go with the base kind. The body name is the base name. Each letter adds its printed word before that name. The printed cue is applied to the listed body part, attack and habitat. The base and every changed kind need their own ordered pattern and the opening that pattern creates. If a letter cannot be told apart on this body or its change fails to alter the fight, the row fails and leaves a gap.

| Letter and name word | Visible cue before commitment | Change to the body's encounter |
|---|---|---|
| B Braced | listed part planted low, pauses square | starts with a hold and waits for the player to commit; opening moves to the end of the held attack |
| C Crooked | listed part drawn to one side | moves one tile sideways before attacking; open on the side it just left |
| L Long | part fully extended before the stroke | attacks one tile farther along the same line, with one extra wind-up beat; left open at its inner edge |
| P Paired | part taps or flexes twice | repeats the first strike after one beat; useful opening follows the second strike |
| R Reeling | part dragged low as body steps away | pulls back before the attack; steps in again and then gives a longer recovery |
| S Screened | part shows above a low cover line | approaches from the printed habitat's cover edge; attacks at its lip, open when out of cover |

Bodies below give the base kind's read and opening. A mouth, limb, jaw, horn, wing or implement is a natural or held weapon in the row. The three region signatures are a starting point from `docs/design/CREATURES.md:143–183`, `docs/design/BESTIARY_LANDS.md:22–79` and `docs/design/CREATURE_BEHAVIOUR.md:9–30,58–92,272–296`. The source shapes include the animal families in `docs/design/HUNT_FAMILIES.md:19–46,332–361`. New bodies and encounter changes below are proposals.

| Region line | Move and sense defaults (proposal) |
|---|---|
| Human valley and highland | Smell leads. Medium pace and breath. Valley covers banks, roads and yards. Highland covers ledges, scree, tarns and snow. Fire and watched roads give readable boundaries. |
| Elf wood | Sight leads. Quick pace, short breath and openings after a quick pair. Roots, canopy, stream and gaps take different attacks. |
| Undead south | Hearing leads. Slow pace, heavy recovery, no living breath refresh on bone and shade. Night or roof tags and a fire boundary. |

For a later group at tier t, base/B/C/L/P/R/S use t/t/t/min(10,t+1)/t/min(10,t+1)/t. In group 1 all letters use their body's printed tier. A group marked ★ supplies one reused-body boss per listed family. d1 or d2 in group 1 is a minimum wild-ground placement. A defender can also use its designated higher harvest habitat. Later groups need d2 or higher. Give the family one standing and refill allowance per habitat. Split it among its kinds so a new kind cannot multiply the habitat's output by taking another minimum spawn.

| Valley body | Ground and tier group | Base tell → attack and opening | Letters |
|---|---|---|---|
| Bank boar | 1 ★, bank d1, T2 | tusks plough → two swipes, straight lunge; open on skid | BCLP |
| Wolf | 1 ★, scrub d2, T2 | teeth over shoulder → circle, leap, two bites; open after leap | CLRS |
| Road thief | 1 ★, unwatched path d1, T1 | club held overhead → short club, high blow; open as it descends, then routes | BCLR |
| Ditch crab | 1 ★, ditch d1, T1 | broad claw opens flat → sideways pinch; cross its small-claw side | BPRS |
| Mud jaw | 1 ★, ford d1, T3 | crocodile snout lifts → forward snap, underwater turn; open at tail | CLPS |
| Sedge ram | 2 ★, reed edge, T4 | spiral horns shake → hook uphill; open below its shoulder | BCRS |
| Pile leech | 2 ★, wet pilings, T4 | ring mouth puckers → cling to one bank tile; open when it stretches | CLPR |
| Bank kite | 2 ★, treeless bank, T4 | forked tail fans → shallow talon pass; open on uphill turn | BLRS |
| Reed mantis | 2 ★, reed screens, T4 | blade arms cross → double front cut; open between elbows | BCPS |
| Mud hopper | 2 ★, flood silt, T4 | pouch throat swells → low kick across silt; open at landing | CLPR |
| Mill centipede | 3 ★, mill deck, T5 | raised front segments → run the plank line; open at segment turn | BCLS |
| Weir tortoise | 3 ★, weir, T5 | rim shell tilts → turn and ram the rail; open behind lifted rim | BCRS |
| Silt eel | 3 ★, silt pool, T5 | ribbon fin folds → side-snap across shallows; open at bend | CLPS |
| Grate skink | 3 ★, culvert, T5 | bright tail ridge stiffens → tail sweep from grate; step inside the arc | BCPS |
| Sack beetle | 3 ★, mill yard, T5 | split shell lifts → shell-bump loose sacks; open with wings raised | BPLR |
| Long bank heron | 4 ★, drainage pools, T6 | spear beak draws back → jab down bank; open after foot plant | BCLS |
| Clay head | 4 ★, clay bank, T6 | clay face tips → butt out of wall; open under pulled neck | BCRP |
| Pier lobster | 4 ★, flooded posts, T6 | left and right claws spread → snip across two banks; open at middle | CLPS |
| Mill wheel beast | 4 ★, sluice yard, T6 | spokes turn once → wheel rolls down chute; open on rim stop | BLPR |
| Reed tube worm | 4 ★, wet channels, T6 | fluted crown rises → whip over lip of tube; open at exposed stalk | BCLR |
| Ford bull | 5, pasture ford, T7 | wide forehead drops → shove bench-deep water; open at crossing edge | BCLP |
| Sluice newt | 5, flooded steps, T7 | paddle tail cocks → lateral tail slap; open from dry tread | BPRS |
| Silt crawler | 5, deep silt, T7 | shovel hands meet → fan of mud from below; open on fresh mound | CLPS |
| Thread wasp | 5, dry eaves, T7 | hanging stinger curls → angled dive from eave; open on climb | BLRS |
| Crossbeam thing | 5, high joists, T7 | two beam arms spread → swing from pivot post; open at pivot's back | BCRP |
| Gravel slug | 6, cobble channel, T8 | broad sole bunches → slow push over cobbles; open at turned lip | BCLP |
| Bank crocodile | 6, deep reed bend, T8 | ridged tail rises → pivot lash before bite; cross behind its planted feet | BPRS |
| Weir lantern | 6, wet vault, T8 | floating cage rocks → swings chain along step; open with chain across cage | BLPS |
| Spike millipede | 6, rubble yard, T8 | continuous spine arches → rolls through a choked lane; open uncoiling | CLRS |
| Gravel sturgeon | 6, ford channel, T8 | bony snout breaks surface → runs upstream and breaks bank; open downstream | BCLP |
| Longspan stilt | 7, open dike, T9 | four thin legs bunch → drops over a path fork; open inside planted legs | BCRS |
| Ford mussel | 7, deep crossing, T9 | two flat shells part → clap across stepping stone; leave gap before it shuts | BCLP |
| Bent pike | 7, water lane, T9 | pointed jaws break surface sideways → dart across channel; open at bend | CLRS |
| Canal claw | 7, towpath, T9 | hooked arm scratches stone → rakes the towpath from the side; open across channel | BCPS |
| Wheel spider | 7, bridge frame, T9 | radial legs spread → wheels down a rail; open where it rehangs | BLPR |

| Highland body | Ground and tier group | Base tell → attack and opening | Letters |
|---|---|---|---|
| White bear | 1 ★, cold rock d2, T3 | heavy forepaw rises → slam then sweep; open after slam | BCLP |
| Dust adder | 1 ★, dry path edge d1, T2 | triangular head flattens → short strike; step to tail during recoil | BPRS |
| Scree goat | 1 ★, steep bank d1, T2 | backswept horns tip → kick loose scree; approach uphill beside the line | CLRS |
| Fell jackal | 1 ★, bare crest d1, T2 | long ears pin → quick bite from upslope; open after backing downhill | BCRS |
| Tarn pincer | 1 ★, tarn rim d1, T1 | thin pair of claws tick → fast grab at ankles; open when tips meet | BCPS |
| Frost hog | 2 ★, snow shelf, T4 | shovel tusks dip → sideways snow shove; open along clear edge | BCLS |
| Slate ram | 2 ★, dry ridge, T4 | square horns align → charge along seam; open where cliff stops it | BCLP |
| Stone midge | 2 ★, chalk pockets, T4 | two-wing clatter and long nose → dart from pocket; open when perched | CLPS |
| Scree hedgehog | 2 ★, scree hollows, T4 | spined back hunches → downhill rolling jab; open once it unrolls | BLPR |
| Cliff raven | 2 ★, wind notch, T4 | blunt beak has pale base → hop and peck over edge; open after hop | BCRS |
| Tarn lamprey | 3 ★, stony water, T5 | round mouth shows rings → clings across slick rock; open on release | BCLP |
| Snow gnat cloud | 3 ★, windblown hollow, T5 | a column of wings leans → gust across gap; open upwind while column reforms | CLRS |
| Scree crab | 3 ★, slate fall, T5 | plated flat claw upends → flips slate; open as it looks for footing | BPRS |
| Ice crawler | 3 ★, glazed stone, T5 | hooked toes click → long scratch across ice; open at slide end | BLRS |
| Ridge grouse | 3 ★, heather ledge, T5 | booming neck sac lifts → wing rush across slope; open as it settles | BCLR |
| Cliff seal | 4 ★, shelf pools, T6 | flippers spread wide → heavy belly slide; open before reverse | BLPR |
| Cairn roller | 4 ★, scree shoulder, T6 | limbs draw into stone body → rolls downhill; open on climb back | BCLS |
| Ridge tusker | 4 ★, exposed shelves, T6 | paired tusks scrape stone → first shove cracks edge; open on windward face | BCLP |
| Flake viper | 4 ★, layered cliffs, T6 | hood plates fan → two low strikes along stable ledge; open above head | CLPS |
| Tarn skater | 4 ★, high pools, T6 | four legs spread like oars → skates across pool; open when it changes edge | BCRS |
| Frost ape | 5, cold gorge, T7 | broad knuckles beat once → long-armed downswing; open on knuckle plant | BCLP |
| Slate shell | 5, dark cliff seam, T7 | narrow layered shell lifts → sideways wedge; open beyond point | BPRS |
| Rope-tailed marmot | 5, crevice slope, T7 | looped tail unfurls → tug across a crack; open when tail falls slack | BLRS |
| Drift mole | 5, snow banks, T7 | fanned paws show on drift → heaves a ridge; open in cleared trench | BCPS |
| Wedge bat | 5, high overhang, T7 | thick wedge ears fold → drops below player then rises; open at roof | CLRS |
| Wind hoist | 6, open ledge, T8 | membrane between walking limbs unfurls → slides sideways in a gust; open downwind | BCLS |
| Shale hornworm | 6, loose rock, T8 | single forked horn lifts → head hook out of rock; open along flank | BCRP |
| Glass ant | 6, ice shelf, T8 | long hinged jaw glints → seesaw bite over crack; open beyond hinge | CLPS |
| Crag grazer | 6, high talus, T8 | flat skull turns uphill → moving shoulder block; open on opposite shoulder | BCRS |
| Rock scallop | 6, tarn rock, T8 | fan shell rocks on edge → spins out along shallows; open in sway | BLPR |
| Scree centaur beetle | 7, shelf, T9 | forebody rises above six planted feet → downhill spear jab; open under raised chest | BCLP |
| Cold fan snake | 7, narrow snow run, T9 | broad fan tail opens → drives snow sideways; cross behind the fan | BPRS |
| Tarn oarfin | 7, mountain water, T9 | two fins slap out of phase → washes the nearest lip; open from the other bank | CLPS |
| Split ledge crawler | 7, overhung rock, T9 | opposable claws stretch across a crack → shuts both footholds; open along middle | BCRS |
| Scree sail | 7, cold wind, T9 | tall rigid sail leans → charge follows gust, then stalls; open upwind | BLRS |

| Elf wood body | Ground and tier group | Base tell → attack and opening | Letters |
|---|---|---|---|
| Wood lynx | 1 ★, rocks d2, T2 | tufted ears press flat → pounce from rock, rake, pounce; open out of breath | BCLP |
| Great eagle | 1 ★, bare crest d2, T2 | wing shadow crosses crest → circle, stoop; open on ground | CLRS |
| Wood poacher | 1 ★, unwatched path d1, T1 | bow tilts → shoot, step back, shoot, close knife; open on draw, then routes | BCLR |
| Bark stick insect | 1 ★, trunks d1, T1 | twig arms separate → scissor at trunk; open between raised arms | BCPS |
| Brook snapper | 1 ★, stream d1, T2 | hooked beak breaks stream → tongue-flick, then snap; open when it swallows | BLPR |
| Root vole | 2 ★, root banks, T4 | chisel teeth show → breaks cover under a root; open at new hole | BCRS |
| Canopy lizard | 2 ★, high trunks, T4 | climbing claws drum → spiral dash then claw; open at trunk's back | CLRS |
| Needle spider | 2 ★, spindle thicket, T4 | front needle legs lift → thread drops from above; open when cut loose from post | BCPS |
| Moss scorpion | 2 ★, moss banks, T4 | curled tail parts the moss → overhead sting; open beneath tail arc | BCLS |
| Reed dragonfly | 2 ★, wooded pool, T4 | two wing pairs cross → reach across pond edge; open on return to perch | BLPR |
| Root laceworm | 3 ★, exposed roots, T5 | loops of body hang down → snags by a loop; open outside root arch | BCRS |
| Briar cat | 3 ★, hedges, T5 | fur cuffs lift → short side pounce out of hedge; open inside its turn | CLPS |
| Winged stag beetle | 3 ★, sap glade, T5 | branched jaws flare → lift and pitch from log; open at soft hinge | BCLP |
| Bracket snail | 3 ★, wet trunks, T5 | shelf shell tilts → downward smash along bark; open as shell lifts | BPRS |
| Needle stoat | 3 ★, fern margins, T5 | narrow back curves → zigzag through ferns; open on third step | BLRS |
| Fan moth beast | 4 ★, light gaps, T6 | fan wings beat forward → blows across bright gap; open behind a trunk | BCLS |
| Canopy ape | 4 ★, high branches, T6 | long forearms stretch down → pendulum kick from bough; open at swing top | CLRS |
| Leaf-back toad | 4 ★, pool roots, T6 | leaf-shaped back swells → skips across wet roots; open on dry root | BCRP |
| Thorn crab | 4 ★, bramble fork, T6 | unequal claws part → catches a bramble and sweeps; open at smaller claw | BLPS |
| Glass cicada | 4 ★, leafy bark, T6 | clear wings buzz on trunk → lunges over trunk base; open on perch return | BPRS |
| Loop-tailed gecko | 5, trunk rings, T7 | tail closes a circle → pulls along root line; open when loop drops | BCRS |
| Bough snake | 5, long branches, T7 | neck hangs over path → swings from a wrapped tail; open behind bough | BCLP |
| Glade ibis | 5, fen glade, T7 | curved beak draws round → wide low hook; open on changing feet | CLRS |
| Silk hammock spider | 5, broad canopy, T7 | front legs draw taut net → pitches over net lip; open at slack span | BCPS |
| Clover buck | 5, bright glade, T7 | broad antler palm lifts → fan sweep at glade edge; cross at back of palm | BLPR |
| Fan clamshell | 6, tree pool, T8 | frilled shell opens → shoves water onto stones; open as waves pass | BCLP |
| Bark kite | 6, wood gap, T8 | hooked wrists open membrane → glides down gap; open at landing post | CLRS |
| Briar sow | 6, thorn lanes, T8 | brush of bristles stands up → runs under thorn arch; open at fork | BCRS |
| Pill millipede | 6, loose leaves, T8 | plate seams tighten → rolls around trunk; open while it unlocks | BLPR |
| Pool railbird | 6, wet reed edge, T8 | lobed toes drum → kick across floating leaves; open on bare bank | BCPS |
| Lantern beetle | 7, hollow trunks, T9 | raised light chamber turns → rushing head butt from hollow; open at hinge | BCLS |
| Glade crown worm | 7, loam, T9 | comb hood fans up → rakes surface along root; open after body breach | BCRP |
| Rootback elk | 7, deep glades, T9 | broad uneven antlers tilt → lifts with one tine, drives with other; open beneath the tilt | CLPS |
| Curtain bat | 7, shaded boughs, T9 | wide folded wings hang → drops a curtain then grips forward; open when folded | BLRS |
| Crooked bloom insect | 7, shaded blooms, T9 | petal arms fold backward → spring snap from stalk; open at foot of stalk | BCPS |

| Undead south body | Ground and tier group | Base tell → attack and opening | Letters |
|---|---|---|---|
| Bone crawler | 1 ★, night stair or roof d1, T1 | ribs low, long fingers drag → grab twice, drag one tile; open on drag | BCRS |
| Bone walker | 1 ★, hall d1, T2 | ember sockets above crooked blade → swing twice, shove; open after shove | BCLP |
| Barrow warden | 1 ★, descent d2, T3 | broken horn ring tips with club → sweep, slam, sweep, grab; open after slam | BCLR |
| Bone hound | 1 ★, hall doors d1, T2 | bare teeth show under bent ribs → rush, then bite; open on short stop | CLPS |
| Tomb spider | 1 ★, roof d1, T2 | tapped strand moves first → front leg hook; open on slack web | BCPS |
| Cinder imp | 2 ★, roof brazier, T2 | ember pools in knuckles → throws and ducks; open on empty hand | BCLR |
| Barrow fiend | 2 ★, descent horns, T5 | bark hide hunches → hook followed by shoulder check; open on lowered horn | BCLP |
| Rib beetle | 2 ★, bone piles, T4 | hinged rib shields gape → wedges and snaps; open between plates | BCPS |
| Arch wisp | 2 ★, windy arch, T4 | floating ring of light narrows → sweeps around pier; open on tether side | CLRS |
| Hollow urn | 2 ★, dry vaults, T4 | stone lid walks up lip → rolled strike along wall; open under upturned lid | BPRS |
| Spine adder | 3 ★, bone seam, T5 | vertebra fan rises → whip follows a floor seam; open off seam | BCLS |
| Skull kite | 3 ★, worn vaults, T5 | rib wings spread → hooks down from side; open as it passes overhead | BLRS |
| Shade knot | 3 ★, lamp ring, T5 | double knot unravels → reaches from darkest edge; open at loose end | BCRP |
| Dry hand mound | 3 ★, crumbly earth, T5 | wall of bare palms opens → lifts ground before folding in; open along cracked edge | BCPS |
| Bell shade | 3 ★, bell footing, T5 | hanging bell shape sways → strike follows first swing; open on dead swing | CLRS |
| Rib spider | 4 ★, lower vault, T6 | loose rib legs pat rock → stitches a low path of jabs; open above path | BCLP |
| Ash drake | 4 ★, descent end, T8 | ash scale throat opens → sweeping breath; side opening after exhale | BCLR |
| Grave coil | 4 ★, stone rings, T6 | linked bone rings move uphill → unfold into sudden long strike; open in coil centre | BLPS |
| Cinder wheel | 4 ★, dry ramp, T6 | bright spoke shows through shaded edge → roll down ramp; open on rim crack | BCPS |
| Hooded shade | 4 ★, empty hall, T6 | empty tall hood bows → short reach then long glide; open at hood's lift | BCRS |
| Barrow jaw | 5, lower shelves, T7 | wide hinge descends → clamps a shelf at its foot; open beside hinge | BPRS |
| Flint rib crab | 5, stone seams, T7 | sharp ribs open side-on → scythe across seam; open at other side | BCLP |
| Ash moth bank | 5, cold braziers, T7 | moth eyes resolve as a band → gust along embers; open in still patch | CLRS |
| Hanging shard | 5, low arches, T7 | long point swings from dust → pierces below its pivot; open outside swing | BCLS |
| Split cowl | 5, sharp corners, T7 | two cloth tips part → alternate feints along corner edges; open at middle | BCPS |
| Tomb spindle | 6, webbed hall, T8 | spindle rises on fine legs → reels line straight; open when thread comes loose | BCRS |
| Ash fan | 6, deep brazier, T8 | folding ribs flare out → wing-like ash wave; open at hinge | BLPR |
| Crook shade | 6, blind turns, T8 | crooked tip points along wall → hooks around corner; open after tip sticks | BCLS |
| Vault rib walker | 6, high ceiling, T8 | rib band spreads across ceiling → drops in a long line; open on floor turn | CLPS |
| Hollow spine wheel | 6, long vault, T8 | alternating empty joints align → rolling gate through arch; open at a loose joint | BCRP |
| Barrow mast | 7, deep descent, T9 | long bone mast leans → falls across path, then lifts; open behind base | BCLS |
| Bone ring drake | 7, pillar ring, T9 | empty wing rings knock together → wing rake around pillar; open on far landing | BLRS |
| Stoop shade | 7, steep night stair, T9 | an inverted shoulder shape gathers → falls above steps; open on rebound | CLPS |
| Ribbed floorback | 7, cracked hall, T9 | low ridge of vertebrae turns → rolls over cracked tiles; open between ridges | BCRP |
| Vault teeth cloud | 7, enclosed descent, T9 | scattered teeth align in a floating jaw → snap across lane; open as teeth scatter | BCPS |

Cinder imp and ash drake hold their printed fight tiers for all five kinds. Keep the base imp as a d2 night-hall candidate at combat opening and the base drake as a first-ring landmark. Keep their first encounters as a visible hazard or landmark while the fight and take wait. Dust adder goes to the fight-first ledger under this proposal, keeping its small defender role and hunt goods. No T4+ fight record can emit through the first three hit-tier fields. Weapon or hit scaling, moves, senses and G85 pay need their readers and checks first. See `schema/src/index.ts:2314–2342` and `docs/design/CREATURES.md:191–210`.

## 4. Animal families

A semicolon separates kinds. Each kind names its tell before the arrow and the thing the player does differently after it. The printed family has one body across those kinds, including its visible attachments. Region codes V/H/E/S mean valley, highland, elf wood and undead south. A is ambient only, P is prey without a fight, D is prey that can defend. Each row uses its stated role throughout. The hunt block of a fight-first species belongs to its identity in section 3. The coats in a single kind's own list stay out of the tally. Give proposed P rows a designated d0 harvest in V and d1 in H/E/S unless their seed has a narrower habitat; D starts at d1. Start hunt goods one rung above that d, with the printed seed exceptions in section 2. A has no hunt tier. Seeds and expansions come from `docs/design/BESTIARY.md:9–43`, `docs/design/BESTIARY_LANDS.md:22–79`, `docs/design/HUNT_FAMILIES.md:19–46,332–361` and `docs/design/CREATURE_BEHAVIOUR.md:85–92`. The additional kinds below are proposals.

| Region, role | Body | Kinds (name and cue → encounter) |
|---|---|---|
| V, A | Sparrow | Eave Sparrow, flits in a short upstroke → find moult at eaves; Reed Sparrow, flicks tail on reeds → find moult on bank; Post Sparrow, holds upright on a post → watch which post it returns to |
| V, P | Crow | Carrion Crow, tilts head on a rail → wait for return to snare; Beam Crow (S), hops up beside the hall rails → stalk from below its roof perch |
| V, P | Trout | Brown Trout, breaks surface at slack water → fish in the bank eddy; Speckled Trout, darts under ripples → fish at the riffle lip; Fork-tail Trout, tail marks the deep run → cast from downstream |
| V, P | Hare | Field Hare, stops with ears upright → stalk from short grass; Bank Hare, ears trail as it ducks → set snare at the bank hole; Marsh Hare, feet flash on narrow dry paths → place snare beside reeds |
| V, P | Roe | Roe Deer, head comes up for two steps → wait at the feeding trail; Ridge Roe (H), short horns show over brow → watch narrow hillside trail |
| V, P | Ground fowl | Ground Fowl, scratches the open yard → stalk from its blind side; Reed Fowl, round chest rocks as it whistles → snare near wet nests |
| V, P | Tench | Still Tench, bubbles move along bottom → fish in still shallows; Root Tench, whiskers show beneath snags → fish from open side of the root |
| V, A | Swallow | Eave Swallow, wings brush low → look up under the eave when it circles; Bank Swallow, turns at a hole → follow the flight to a bank nest |
| V, P | Pond frog | Pond Frog, pouch pulses on a pad → stand still by pond's shallow lip; Ditch Frog, taps before jumping → put lure at its return stone |
| V, A | Minnow | Pool Minnow, flashes upstream in a short group → watch the still pool's shallow run; Ford Minnow, schools in long lines → follow the strung-out group to a ford |
| H, P | Goat | Highland Goat, bunches feet on ledge → stalk from below; Tarn Goat, straight horns dip into water → watch its drink path; Shelf Goat, broad hoof steps onto edge → snare on the stable path behind it |
| H, P | Grouse | Heather Grouse, the tail fans in heather → stalk from downhill; Stone Grouse, wing flash beside boulder → time the path between rocks; Ruffed Grouse, neck lifts against wind → follow the boom to a perch |
| H, P | Pika | Rock Pika, bolts into a crack → snare its run; Tarn Pika, carries stems in mouth → watch the harvest trail |
| H, P | Marmot | Whistle Marmot, stands at den whistle → wait for sentry to turn; Moss Marmot, low belly scrapes turf → watch the moss path to the den |
| H, P | Ptarmigan | Snow Ptarmigan, feathered feet mark drifts → stalk by tracks; Fell Ptarmigan, crouches among stones then fans wings → stalk at its dry perch |
| H, A | Crag swift | Shelf Swift, loops under the ledge → follow its return to the shelter; Cloud Swift, narrows wings at crest → watch the gap where the wind turns |
| H, D | Wildcat | Wildcat, arched shoulders stop short → leave its bluff line and lure by rock; Scree Cat, tail jerks above snow → wait for its return to a scree den |
| H, P | Char | Tarn Char, rises head first → fish at cold inlet; Shelf Char, flicks along submerged rocks → cast from the ledge's end |
| H, A | Snow vole | Drift Vole, snout lifts loose snow → follow the run before it closes; Grass Vole, holds a long blade sideways → find the snow-free feeding patch |
| H, P | Hill sheep | Hill Sheep, long fleece hangs in strips → approach the outer trail; Ledge Sheep, short horns touch on a salt rock → watch the path to salt |
| E, P | Dove | Wood Dove, clatters wings in canopy → give the alarm a wide berth; Pool Dove, pumps wings beside water → wait on the dry side; Hollow Dove, calls from a rounded hole → watch its exit before stalking |
| E, P | Heron | Grey Heron, stands on one leg → stalk while it wades; Reed Heron, beak rises out of reed tops → approach from the behind-bank path |
| E, P | Goose | Wild Goose, one upright watcher → take the approach the watcher leaves; Pool Goose, long neck appears in pool → wait at water's far lip |
| E, P | Otter | River Otter, slides and leaves a ring → lure with fish near slide; Root Otter, back arches at a root gap → snare its return gap; Shelf Otter, paws turn a stone → wait near feeding shelf |
| E, P | Marten | Tree Marten, scolds from a branch → choose branch snare; Stone Marten, keeps belly low at roots → choose stone run |
| E, P | Fox | Silver Fox, sits at a trail bend → lure with fowl; Shade Fox (S), looks back at lamp edge → lure with bone; Fork-tail Fox, two tails open at a trail fork → wait at the branch it takes |
| E, P | Hart | White Hart, lifts heavy antlers → wait through the glade's alarm; Brook Hart, rubs tines at ford → stalk from downstream |
| E, A | Moth cloud | Moon Moth, pale cloud hugs stall lamps → watch it clear when the light moves; Grave Moth (S), low cloud at night arch → see it lift at that night's roof line |
| E, P | Stream dace | Leaf Dace, darts under leaves → fish at the clear slot; White-fin Dace, tips a white fin at the edge → cast from the shade |
| E, A | Pool skimmer | Long Skimmer, walks a long surface line → watch it turn with the current; Ring Skimmer, circles a floating leaf → watch for a still pool opening |
| S, P | Rat | Barrow Rat, scatters into floor cracks → choose a snare at the hall floor; Vault Rat, rears by wall slit → use a wall-run snare; Long-tail Rat, tail trails over stair → watch the roof stair crossing |
| S, P | Bat | Ash Bat, swings out of the roost → choose net or lantern lure; Vault Bat, clicks three times before a low pass → wait in the roof's quiet pocket; Slot Bat, folds wings almost shut → net the narrow return gap |
| S, A | Wall gecko | Arch Gecko, wide feet spread on stones → watch by day at the warm arch; Roof Gecko, curled toes spread under roof → watch where a lamp meets dark |
| S, A | Wick firefly | Wick Firefly, single light circles a lamp → follow the circle at dusk; Beam Firefly, twin lights leave a beam → watch the high roost |
| S, A | Lizard beetle | Dry Beetle, lifted split shell on stone → watch its short sunny crossing; Mud Beetle, hooked paws dig near run-off → watch by the damp wall |
| S, P | Blind loach | Hall Loach, whiskers break the surface → fish in quiet runoff; Crag Loach, bent tail flicks in water slot → fish above ledge |
| S, P | Sand jerboa | Sand Jerboa, stands on long rear feet → wait at the hollow's lip; Arch Jerboa, leaps out of a roof shadow → snare the flat return path |
| S, A | Dry snail | Chalk Snail, high whorl crosses at dusk → watch near dry arch; Soot Snail, flattened rim slides under roof → find it above the blackened shelf |
| S, P | Salt lizard | Salt Lizard, toes splay on grit → stalk from firm tread; Vault Lizard, back ridge lifts at lamp light → lure at the lamp's edge |
| S, A | Shelf gull | Stair Gull, long wings plane past stair mouth → watch from the dry opening; Ledge Gull, hooked wing turns low → follow its arc to a shelf |

## 5. Boss identities and movements

Every ★ family supplies one boss named **The Crowned [body]**, with a visible band or ridge around its named attack part and size 1250‰ of that body. For a person the band is a worn piece of gear and the end is a rout. For the boss's own move, the crest marks a second lane during the first wind-up. In group 1 mark the player's first lateral step; in group 2 mark the cover edge the body came from; in group 3 mark the opposite side of the first strike; in group 4 mark the approach to its anchor. With no player step in group 1, keep the first lane. Give a full warning beat, then deliver the family's printed attack along the marked lane. The opening follows the second attack, across from the mark. If lateral room, range or the cue fails, leave the boss unplaced. The move borrows the family's draw and adds timing and a cue. Each boss gets a distinct death (a named rout for people).

| Region | Own-body bosses, in T7 / T8 / T9 / T10 / T10 order. Each entry gives its shape, signature and end. |
|---|---|
| Valley | **Split Tusk** (two-trunk boar, hooks both lanes, falls crosswise); **Sluice Grip** (four-armed crab, shuts successive gates of claw reach, claws fold); **Mill Beam** (beam-jawed ox, swings a crossbar, comes to rest astride it); **Reed Jaw** (upright long-jaw fish, snaps down the reed row, slips nose first); **Ford Ring** (wide ring-backed turtle, rolls around the ford, settles rim first). |
| Highland | **Crag Brow** (stepped-horn ram, sweeps a shelf, drops to its forelegs); **Tarn Step** (long-legged rock swimmer, steps successive water gaps, sinks between strides); **Ridge Hide** (six-limbed fur crawler, charges then braces downhill, folds against the ridge); **Slate Back** (triangular slate shell, sheds a fan of fallen slabs, shell drops in leaf layers); **Scree Knuckle** (four long knuckle arms, jabs a crossing in sequence, settles each fist). |
| Elf wood | **Canopy Eye** (double-canopy flier, shadows the gap then stoops, wings cup and lower); **Root Step** (root-legged beetle, bridges a creek to strike, roots settle into banks); **Glade Fan** (fan-backed insect, opens a radial gust, fan closes); **Briar Fold** (four jointed vine arches, steps across its own snare arc, folds at the knee); **Pool Wing** (two long oar wings, sweeps opposite pool edges, settles on one bent wing). |
| Undead south | **Bell Socket** (deep skull on a bell-shaped frame, swings a slow double arc, skull lands inside frame); **Vault Step** (four tall bone stilts, stamps across a vault in beats, legs crumble in order); **Rib Latch** (two rib cages joined at hinge, snaps a marked lane shut, unhooks and crumbles); **Ash Wing** (broad ash-shade wings, sends two sweeping wakes, breaks into dust); **Hollow Grip** (many-fingered bell shade, closes a ring around the marked path then opens an exit, palms fade in sequence). |

Boss identity lives on a named encounter row with its title, body, arena, move, opening and reward references. A regular, elite, rare or boss rank, affix, pack and repeat spot never makes an identity. Keep the published one-boss-per-map limit. Propose one boss anchor in a boss map and none in ordinary chunks. If a map has streamed chunks, share the single anchor limit across its whole logical map. Hold additional bosses in separate expedition or landmark maps as they become available. See `schema/src/index.ts:2373–2404`, `docs/design/COMBAT.md:320–329`, `docs/design/CONTENT_MATRIX_AUDIT.md:74–78`. This is the placement and identity proposal for audit question 3.

| Body group | Planned drawn movements per body |
|---|---|
| Foe | Idle, move, first attack, hit, main tell or second attack, death. Every kind on the body shares all six. Bone bodies crumble, shade bodies fade, beasts fall and fade, people rout. Effects at the point of the fall may differ without a new drawn movement. |
| Huntable animal | Idle, move, feed, alarm, flee, end. An animal's end is brief and clean. Fish move by swim, birds by flight or perch departure. The chosen family gait reads in the take. |
| Ambient animal | Idle, move, feed, alarm. An ambient kind leaves by its movement. |
| Own-body boss | Idle, move, attack, hit, tell, signature, its own death. |
| Reused-body boss | Family idle, move, attack, hit and tell. Draw the boss's own death or rout. The crown and signature timing take no extra drawn movement in this proposal. |

The family death replaces CREATURES' earlier per-kind ending under the 21.11 counting decision (#794, `DECISIONS.md:4598–4606` on develop). A boss always gets its own ending. Directions, poses, size, wraps, part swaps and colour do not add movements. Use the established shape and palette checks and keep the few approved first-ring looks where they fit. See `docs/design/CREATURES.md:185–210`, `docs/design/HUNT_FAMILIES.md:373–395`, `docs/design/ART_SYSTEM.md:46–57`, `docs/art/PLACE_LOOK.md:40–49`, `docs/art/REUSE.md:7–30`. The cost of a clip is in #793.

| Region | Monsters / bodies | Bosses, reused / own | Animals, by place / bodies based there |
|---|---:|---:|---:|
| Valley | 175 / 35 | 20 / 5 | 21 / 10 |
| Highland | 175 / 35 | 20 / 5 | 23 / 10 |
| Elf wood | 175 / 35 | 20 / 5 | 21 / 10 |
| Undead south | 175 / 35 | 20 / 5 | 25 / 10 |
| Total | 700 / 140 | 80 / 20 | 90 / 40 |

The table allocates 890 kinds to 200 bodies. Thirty animal bodies hold two kinds and ten hold three. The animal tally is 25 ambient, 63 prey and two defenders. Four kinds live away from their base body's region. The 700 include ten person-foes on two bodies. Excluding them would leave 690. Count each huntable foe once, even when both hunt and fight fields are present.

Estimated drawn movements: 840 regular foe, 216 animal (28 huntable bodies at six, 12 ambient at four), 140 own-body boss and 80 shared-body boss endings, **1,276 before any race moves**. The 140 foe bodies sit at the low end of the manager's 140–170 estimate because the table assigns five kinds to every body. The boss split and animal body count match the estimate. The total is at the low end of the 200–230 body range. Ambient bodies supply four moves, own-body bosses seven, and shared-body bosses add a death each, so six per body alone understates this catalogue by 76. The result sits inside the 1,200–1,400 estimate. About 2,424 movements of the old 3,700 headline are outside this table. The headline used per-kind assignments plus race moves; it needs rebaselining against the wider game's distinct movements. See `DECISIONS.md:4362–4371`, `docs/design/CONTENT_MATRIX_AUDIT.md:80–85`.

## 6. Waves and row contract

For audit question 4, show the cue before the change takes effect and playtest the response at game size on both doors. Compare normalized stat, move order, opening, senses and equipment blocks across lands. Refuse copies, unreadable variants and inaccessible openings. A signature weapon appears as a separate named hand on an approved boss or quest, usually one per boss. A person-foe who leaves their hand leaves its character-specific look and slightly different traits, per the owner's weapon-drop answer. Learning a pattern from it stays open. Proposed first drop rule: the existing weapon's own condition contract applies, with no additional wear if that weapon has no wear. A drop is at most its foe's tier. Before adding an authored worn weapon, reconcile the 600‰ condition proposal with the owner and the field's readers. Record boss clothing by exact ID as in [ARMOUR_MATRIX.md](ARMOUR_MATRIX.md). Sum exact expected value over all goods, equipment and currency, including repeat kills and capacity. Establish the G85 pay unit and check against the same-tier work loop before emission. See `docs/design/CREATURES.md:208–210`, `docs/design/WEAPON_MATRIX.md:575–592`, `docs/design/HUNTING.md:115–120`, `tools/src/fight.ts:85–94`.

For audit question 6, test the base road thief at T1 and the bank boar at T2, with one readable weakness and safe exit each, following the first-foe order in `docs/design/COMBAT.md:334–338`. Open the hare and roe takes with the first hide chain and its T1 workshop. Then try the T1 bone crawler in the hall, wolf at T2, north crest and rubble-to-leather wave once their area and source tests pass. Keep the dormant wolf fixture (`content/core/map.json:4329–4367`) until its live replacement is measured. Add T3 descent after guard, action pay and place checks. Later land and boss rows wait for tier, arena, route, materials and named reward proof. Armour effect and parity work for audit question 2 is on [ARMOUR_MATRIX.md](ARMOUR_MATRIX.md).

Stage 4 reads `family { bodyId, rig, moveSet, endType, regionLine, habitat, t, baseTell, basePattern, opening, attackPart, letters }`. Expand into `kind { id, displayName, familyId, variant, role, ledger, cue, encounterDelta, look, senses, hours, roam, group, hunt?, fight?, waits[] }`. Hunt carries `tier, danger, size, takeWays[], takeS, dressSteps, goods[{ id, qty, share }], spawnCap, refillD`. Fight carries `tier, hp, breath, paceMs, moves[], patterns[], opening, weapon?, rewards[]`; every move gives tell, reach, wind-up and recovery. Resolve the base Fight numbers from the combat tier cells and regional defaults, and report a wait if a cell or move reader is absent. A boss row adds `bossId, title, bodyId, scalePermille, signature, endClip, arenaSlot, rewards[]`. A placement adds `kindId, mapId, chunkId?, areaId, d, habitat, rank, shape, count, affix?, anchor`. Keep the existing kind ID for an adopted base where it has one (`content/core/map.json:3955–4367`). Score catalogues by kind ID before laying placements. Print missing moves, source/area waits and separate body and clip counts. Reuse ordered row and report helpers from the weapons work. See `docs/design/CONTENT_MATRIX_AUDIT.md:50–61`, `tools/src/balance/weapons.ts:398–402,895–928,1293–1323`.

| Rule | Row proof |
|---|---|
| G35 | Report and art spec now. Emit only once combat opens, with above-ladder hazards holding their take. |
| G41 | Separate open fight and hunt tiers from rarity and area danger. Goods belong at or below hunt tier. Gear rewards use an eligible tier and a lawful source. |
| G44 | Worn reward effects and sets follow their equipment slots and one cap. |
| G45 | Drops name declared classes and real materials. A new class or metal waits for its gate and a legal first use. |
| G28, G29, G30 | No punishment in absence. Cues read beyond colour. Safe ground gives a way to stop the encounter. |
| G31, G34, G47, G64 | Visible warning before harm. Walkable retreat for every predator anchor. Watched roads read clearly; danger comes from the area. |
| G46, HUNTING 10 | No blood or suffering on animals. Protect pets, young and sleepers. Person-foes rout and give no flesh or carcass. |
| G36, G37 | Boss expeditions have safe exits, and progress outside them stays open. |
| G42 | Sum spawn, refill and reward capacity across maps and sources. |
| G78, G102 | The server owns combat outcomes and draws. Publish odds where required. |
| G79, G80 (proposed) | Show wind-up, weakness and retreat route. Use a fixed pattern drawn once on appear and prove its openings. |
| G81, G83, G84 | Respect first-come rights on fall packs. Show tells, bars and the turn toward noise. |
| G85 (proposed), G86 | Check the pay per unit of work. Clamp hand and build power together. |
| R1–R7, R9, R11–R12 | Event time and integers. Stable IDs and seeded draws, forward saves, exact activity shares and value, one clamp and drift checks. |
| S1–S6 | S1 names and neutral lines describe present signs. S2 a past claim needs a speaker. S3 shared facts stay observable and few. S4 each clue has two readings. S5 no belief is evil or a joke. S6 a season ends with a question open. |

See `docs/design/GAME_RULES.md:291–312,340–369,403–441,468–480,512–545,554–605`, `docs/design/OPEN_WORLD.md:256–272`, `docs/design/HUNTING.md:121–130`, `docs/kernel-review-v1.md:88–122`, `docs/design/STORY.md:58–72`. A new spoken line waits for the voice review and the player's initiative (G20 and G21, `docs/design/GAME_RULES.md:228–236`).

## 7. Owner questions (open, to go to the owner as cards)

1. Should foes who drop their weapon and flee count among the 700? **Proposed: yes** because they still give a fight the player can learn.
2. Should each kind count once even if you can both hunt and fight it? **Proposed: yes** because the primary encounter can assign the kind to a single ledger.
3. Should a map hold at most one boss across all its chunks? **Proposed: yes** because each boss needs a place where the whole encounter fits.
4. Should the first live wolf fight be tier 2 while its hunt goods stay tier 3? **Proposed: yes** because the leap and opening set the fight tier, while the hunting ground sets the goods tier.

`DECISIONS.md:4603` records the first two questions as open: “Still with stage 2: whether person-foes count among the 700, and whether a kind that is both an animal and a foe counts once.”
