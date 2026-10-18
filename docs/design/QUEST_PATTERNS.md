# Quest patterns: what the experts know, cut to the valley

The library the quest designer works from (`.claude/skills/quest-designer`), and any
creator who wants a quest that is more than a counter. Each card is one technique that
designers, game masters or researchers have shipped or measured, restated in our words,
with one example that keeps the rules of this valley. A card never overrides
[GAME_RULES.md](GAME_RULES.md) or [STORY.md](STORY.md): where a card and a rule disagree,
the rule wins and the card says so.

Made on 2026-10-18 from five research passes, each on its own topic: systemic quest
generation, light quests that bring players back and the forums (Codex); the craft of
tabletop game masters and branching narrative at scale (Gemini). Every source below was
opened and its claim found on its page that day; ideas whose source could not be
confirmed cite the game or the book alone, without a link. A forum post is one player's
memory: a card that rests on one is a lead to test, not evidence.

How to use it: a pitch names its card (the skill's pitch format). Pick cards by what the
pitch is missing: a reason for the giver to ask (section 2), a question worth asking
(section 3), tension without a fight (section 4), a turn and a reward (section 5), a
small loop worth coming back to (section 9), an idea players remember (section 10).

## 1. The hand: variety when many quests are open

**The problem.** Pillar 3 promises that the next task is a different kind; G17 checks it
only along a requires link. A player holding several open tasks picks the order, so two
of one type can still come back to back. `pnpm quests` reads every order the content
allows: the requires links, and two orders that items force. A quest with no giver that
finds an item is done the moment the item first comes into the bag, so it is done before
any quest that needs the item, or needs what only that item gathers. A node that opens
after a quest holds back every quest that needs what only that node gives.

On 18.10 only the forager can do it: `core/first-pickings` can be open beside
`core/into-town` and beside `core/the-night-arch`, all three `discovery`, all in the
opening. The digger and the explorer cannot, and items are the reason: the digger's
buried axe is always found before the first fire, whose logs only the axe fells, and the
explorer's glint always comes before the bridge, whose keystone's node opens after it.
A character holds up to five tasks at once, the forager six. The forager's pairs are
new: on 18.10 NEXT 17 turned `core/first-pickings` from `skill` into `discovery` so that the
bridge no longer follows a `skill` (#179). That mended the chain and opened the pairs,
which a check on the chain alone cannot see.

**The logic.** If two open quests share a type and the player may finish either at any
time, only three things stop them coming back to back: the content never lets both be
open at once (a requires link, or an order an item forces: a check can test this, and
`pnpm quests` does), the world does not offer the second until something else is done
(a gate in the kernel), or the beats inside the two differ so much that the type stops
being the feeling (G18). The light-quests pass put the limit plainly: free choice among
many open quests, one type per quest and a hard guarantee of variety cannot all hold once
the pool is large. One of the three gives.

**What the field does**, in the order the research passes ranked it:

| Rank | Technique | Who ships it | Cost | How it fails |
|---|---|---|---|---|
| 1 | **Deal a small hand, one task per type.** Offers wait as rumours; a giver offers a quest only when no open quest has its type. | Fallen London's opportunity deck: a few storylets dealt from a big collection, never all at once ([Emily Short](https://emshort.blog/2017/05/25/mailbag-high-agency-narrative-systems/)); one per type is our addition | A rumour state, and a line for the giver who waits | Few types eligible at once, so a giver falls silent |
| 2 | **The type just finished waits one turn.** A cooldown of one completion. | Skyrim's Story Manager: a quest waits its "hours until reset", and an event timer blocks a whole category, such as all seven reactions to a cast spell ([Beyond Skyrim](https://wiki.beyondskyrim.org/wiki/Arcane_University%3AWorld_Interactions)); Yarn Spinner's "best least recently viewed" ([saliency](https://github.com/YarnSpinnerTool/YSDocs/blob/main/docs/write-yarn-scripts/advanced-scripting/saliency.md)) | One remembered type in the save | The only quest left is of that type: offer it anyway |
| 3 | **Freshness weight over the longer run.** A type seen often weighs less, and recovers. | Wildermyth: an event seen in one campaign is a quarter as likely in the next, and twice as likely again after a campaign without it, up to its default ([wiki](https://wildermyth.com/wiki/Event)) | A short history per player | A small pool suppressed into silence |
| 4 | **Beats inside a quest differ.** A type is the question; the steps are different motions. | The Witcher 3's contracts ([Sasko, GDC](https://www.gdcvault.com/play/1028897/10-Key-Quest-Design-Lessons)); our G18 | Authoring care | Filler beats stapled on to pass a check |
| 5 | **Rhythm after tension.** After a hunt or a night out, the next offer is calm. | Left 4 Dead's director: build-up, peak, relax ([Booth](https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf)); Blades in the Dark's downtime ([rules](https://bladesinthedark.com/downtime)) | A notion of "tense" per type | The player feels managed |
| 6 | **Light what is in front, keep what is held.** A few quests give strong signs in the world; the rest wait where they were found, nothing lost. | The counter-case: World of Warcraft caps the quest log at 25, and players say current, old, profession and achievement quests no longer fit ([r/wow](https://www.reddit.com/r/wow/comments/gctdb0)); our "Christmas tree" pattern (G3: no more than two open quests lit up at once) already limits what is lit | A quiet state for a held quest | Held quests that still cover the map in signs |

**Simulated on our content (18.10).** Ranks 1 and 2 as one gate (a character holds at
most one open quest per type, the type just finished waits until another quest is done,
and when nothing else can be open the world offers it anyway) were run over every order
the core quests allow, item orders included. The digger (955 states) and the explorer
(949) never do two of one type back to back. The forager (2,578 states) still does, at
three dead ends where nothing of another type could be open: after the first fire with
only `core/into-town` left, and near the end with `core/the-night-arch` or
`core/first-pickings` put off until last. On today's content the gate does no better than
fixing the content.

**The recommendation, for the owner.** Now: G17 holds over every order. `pnpm check`
refuses two of one type that a hand lets come back to back, as it refuses them along a
requires link. It lands together with the forager's fix, which is the opening stream's
to make: an order like the explorer's keystone, or another type for one of the three.
Later: the gate in the kernel, ranks 1 and 2, when creators' quests make a varied hand
impossible to keep by writing alone. Until the owner's word is in `DECISIONS.md` this is
a proposal, and G17 as written stands.

**Not taken:** a "fatigue" that slows tools or blurs clues after the same type twice
(it punishes a play style: pillar 5); types locked to an hour of the day (a long wait for
the type you want, G28); a quest board as a menu (G10, pillar 4); a slate of three fixed
"channels" the player fills (a menu in disguise); a lock on finishing a quest of the type
just done (it strands work the player already took on, pillar 5; the light-quests pass
ranked it least suitable of all); a hard cap on open quests (rank 6's counter-case:
discovery turns into keeping a log).

**Later, not now:** a hinge beat, a short scene of another type slipped in where two of
one type are about to finish back to back (the light-quests pass's second answer, after
Left 4 Dead's director). It needs a new step kind and a library of scenes, so it waits
until the pool is large enough to need it, and it is the owner's call.

## 2. Where a quest comes from

### Motivation before objective
Pick what the giver needs before what the player does. Doran and Parberry read 750+
quests from four online RPGs and found nine motivations behind all of them: knowledge,
comfort, reputation, serenity, protection, conquest, wealth, ability, equipment. **Why:**
an action feels meaningful when it repairs a need the player can name. **Types:** any;
the need picks the type. **Here:** at the same ruin Maru wants knowledge (why the mist
never settles on one cold hearth) and Pell wants reputation (a find from the ruin would
bring buyers back to her stall): two different questions. **Fails when:** the need is
flavour text that changes no step.
Conquest needs a fight and is out here. **Source:** [Doran & Parberry 2011](https://ianparberry.com/pubs/pcg2011.pdf).

### The nine motivations, in the valley

| Motivation | What the paper's strategies do | What survives without combat | A first card |
|---|---|---|---|
| Knowledge | deliver an item for study; spy; interview; test in the field | go, look, listen, bring back what was seen | investigation, riddle |
| Comfort | bring a luxury; remove pests | a comfort found, a nuisance led away | fetch_twist, tending |
| Reputation | bring a rare object; visit a dangerous place | the find only digging gives; the night visit | gamble, discovery, stealth |
| Serenity | check on someone; recover property; rescue | the welfare visit; a lost thing returned | investigation, tending |
| Protection | treat; repair; fortify; guard | restore a place; keep a fire | tending, mastery |
| Conquest | attack; steal | none (no combat, no theft from neighbours) | - |
| Wealth | gather raw goods; make for resale | a made good the stall pays well for | errand, mastery |
| Ability | assemble a tool; practise; research | learn a technique and use it on something harder | mastery, skill |
| Equipment | assemble; deliver; trade | a tool made or traded for | errand, fetch_twist |

### Situations, not plots
Prepare a place with people who want things and a problem in motion, not a sequence the
player must walk. **Why:** the player's order becomes the story. **Here:** the bank
wolves keep the south bank at night; Pell wants what grows there; Maru wants nobody on
the bank after dusk. The quests fall out of the situation, in the order the player
picks. **Source:** [The Alexandrian, Don't Prep Plots](https://thealexandrian.net/wordpress/4147/roleplaying-games/dont-prep-plots).

### Two patrons who want different things
Major threads hang on named people whose aims pull apart, so helping one has a cost with
the other. **Why:** relatedness turns errands into commitments. **Here:** Maru mends
what is left, one thing at a time; Pell sells what can be sold. Neither is wrong (S5),
and the side a player takes moves their lean (STORY.md section 4). **Fails when:** a
patron turns petty, or one side is plainly right (G12). **Source:** faction status in
[Blades in the Dark](https://bladesinthedark.com/faction-game), a standing from -3 to +3
with each faction; Fallout: New Vegas's standing per faction (STORY.md section 4).

### A place described by its lack and its quarrel
Give a camp or settlement two tags, what it lacks and what it argues about; the quest
comes from where they meet. **Why:** the need feels local, not random. **Here:** the town
lacks dry timber and argues over the old bridge planks: Maru would mend the bridge with
them, Pell would roof her stall. **Source:** the world tags of Kevin Crawford's *Stars
Without Number*, where every tag on a place brings its own enemies, friends,
complications, things and places; the pair of a lack and a quarrel is the valley's
reading.

### Culture fills the blanks
When quests are generated, a settlement answers "what do you value, who speaks for it"
and the template is filled from that. **Why:** even random combinations read as a
culture. **Here:** for the generated land beyond the valley: a camp that keeps
soot-blackened pots asks for a kiln shard; one that fears open flame asks the same shard
be buried. **Source:** [Grinblat & Bucklew 2020, Caves of Qud](https://ceur-ws.org/Vol-2862/paper5.pdf).

### What the player wants, what the valley needs
A material want on the surface, and underneath a choice about the people around. **Why:**
it lifts gathering into meaning. **Here:** a hot-burning carved lintel would see the
player through the night; Maru says the carving holds names. **Fails when:** it preaches,
or the "right" answer is obvious (G12). **Source:** John Truby, *The Anatomy of Story*.

## 3. Asking a question worth asking

### The dramatic question
Each step is one question with a visible stake, and it ends the moment the question is
answered. **Why:** interest lasts as long as the outcome is in doubt. **Here:** not
"collect the keystone" but "can you free the keystone before the light goes?"; the step
closes on the strike. **Source:** [The Angry GM](https://theangrygm.com/four-things-youve-never-heard-of-that-make-encounters-not-suck/), [... and Scene](https://theangrygm.com/and-scene/).

### Three clues for every conclusion
Every conclusion the player must reach has at least three ways in. **Why:** the designer
knows the answer, so one clue always feels obvious to its author and is missed by
players. It is our G7 in practice: a wrong try teaches. **Here:** where did the bell go?
A chime heard by the river at dusk; a notch on the bridge pillar; a clapper turned up by
a dig at the willow. Any one leads to the mound. **Fails when:** the clues read like a
checklist to tick. **Source:** [The Alexandrian, Three Clue Rule](https://thealexandrian.net/wordpress/1118/roleplaying-games/three-clue-rule).

### Three weak signals, one answer
No single clue gives the answer; three weak ones together do. **Why:** deduction that
closes feels earned, guessing is ruled out. **Here:** whose cairn fell by the birch: a
chisel in the silt, Maru's word that the carver left in an early frost, fire marks on the
birch's north side only. **Fails when:** the leap needs knowledge from outside the
valley. **Source:** *Return of the Obra Dinn* (Lucas Pope, 2018).

### The key is understanding
The way is open from the start; what the player lacks is knowing how the world works.
**Why:** the purest curiosity; the answer makes the player feel clever. **Here:** the arch
by the ruins is only a door at night; nothing is unlocked, the player learns when to
stand there (a `riddle` with a night slot). **Fails when:** clues are so thin that players
brute-force it or leave for a wiki. **Source:** *Outer Wilds* (Mobius Digital, 2019).

### Secrets that go where the player goes
Keep a short pool of one-line secrets and let them turn up wherever the player digs or
looks first, instead of tying each to one spot. **Why:** initiative is always rewarded.
**Here:** carvings and objects, each with a speaker (S2), that a dig in any of three
places may turn up. **Fails when:** the secret has nothing to do with where it was found.
**Source:** [Sly Flourish, Secrets and Clues](https://slyflourish.com/sharing_secrets.html).

### Things stay where they are
Rare plants, dens and secrets keep their place; the world does not move the good thing
onto the player's path. **Why:** scouting and choosing a road mean something. Our map is
hand-made, so this holds already. **Fails when:** the map is so sparse that missing a
fixed point costs an empty walk (G5). **Source:** [Hack & Slash, the "quantum ogre"](http://hackslashmaster.blogspot.com/2011/09/on-how-illusion-can-rob-your-game-of.html).

### Find the way by what you can see
Navigation by landmarks over the mist and cues on the ground, not by a marker. **Why:**
the player builds a map in their head. **Here:** the `maze` type: the beacon's glow on the
left shoulder, the stone ditch underfoot, moss on the trunks. **Fails when:** the mist
leaves nothing to steer by. **Source:** [The Alexandrian, Hexcrawl](https://thealexandrian.net/wordpress/17308/roleplaying-games/hexcrawl).

## 4. Tension without a fight

### Warn, then strike
Every hazard shows itself before it costs anything: a soft move, then a hard one if the
player does not react. **Why:** a loss that was warned feels fair. **Here:** the bank
wolf's eyes, red and steady in the reeds, before the hunt (already decided, DECISIONS
2026-10-16). **Fails when:** the window between warning and cost is too short for a
thumb on a phone. **Source:** [Apocalypse World](http://apocalypse-world.com/), [Dungeon World's GM moves](https://www.dungeonworldsrd.com/gamemastering/).

### A clock you can see
A danger or a long job is a circle of four to eight segments that fill. **Why:** a
visible countdown builds suspense better than a hidden roll. **Here:** a `tending` night
where the fire's ring fills while the player gathers; a `stealth` round where each step
in the open fills a segment. **Fails when:** the clock fills by time alone, with nothing
the player can do (G28). **Source:** [Blades in the Dark, progress clocks](https://bladesinthedark.com/progress-clocks).

### Signs that something is coming
A threat in a region advances in stages the player can see, and each stage changes the
valley a little. **Why:** a loss you can prevent pulls harder than a gain. **Here:** for an
arc: scratches on the bridge timbers, then Pell closing early, then eyes at the fire's
edge. **Fails when:** the stages run faster than the player can answer, and play becomes
putting out fires. Never a stage that punishes being away (G28). **Source:** [Dungeon World, fronts](https://www.dungeonworldsrd.com/gamemastering/fronts/).

### A gauntlet that sends you back, not out
A short, tense run where a mistake means a retreat that teaches, not a loss. **Why:**
pace and stakes without a death. **Here:** the night ruins (G36): a slip sends the player
back to the last light with what the outing found, never further (DECISIONS 2026-10-10).
**Source:** [Ashwell, Standard Patterns in Choice-Based Games](https://heterogenoustasks.wordpress.com/2015/01/26/standard-patterns-in-choice-based-games/).

### The quiet after
After a hunt or a night out, the next beat is calm: tend, hear what changed, choose a
day question. **Why:** contrast; quiet means something after fear. **Here:** a dawn at the
fire after the vigil, with Maru's line and a different kind of task. **Fails when:** the
quiet is bookkeeping, or it interrupts the player at their most curious. **Source:**
[Blades in the Dark, downtime](https://bladesinthedark.com/downtime); [Left 4 Dead's director](https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf).

## 5. The turn and the reward

### Different beats inside one quest
A quest's type is its question; its steps are different motions, and a turn changes what
the player thought the task was. **Why:** a new rhythm resets attention (G18). **Here:**
Pell asks for an old weigh-scale from the flooded kiln (a dig); it comes up tied to a
sealed wax tablet (the turn); Maru wants it kept, Pell wants the wax (the choice).
**Fails when:** the beats are stapled together to pass a check. **Source:** [Sasko, GDC 2022](https://www.gdcvault.com/play/1028897/10-Key-Quest-Design-Lessons).

### A story in four movements, without conflict
Introduction, development, a twist that reframes, and a reconciliation: kishōtenketsu.
**Why:** drama without an enemy, which is what a valley without combat needs. **Here:**
dig peat; learn to dry it by the hearth; a dig at dusk turns up a pocket of marsh gas that
burns blue; build a lamp of it for the camp edge. **Fails when:** the twist has nothing to
do with the first two movements. **Source:** Koichi Hayashida on *Super Mario 3D Land*;
the four-movement form of East Asian poetry.

### The helper who tests you first
A stranger asks something small before giving help: a folk-tale donor. **Why:** the oldest
grammar of stories; the test makes the help earned. **Here:** a hare at the hollow cedar
waits for three dried berries, then leads to the old pitch store. **Fails when:** the test
is arbitrary to a player who reasons the modern way. **Source:** [Propp, Morphology of the Folktale](https://monoskop.org/images/f/f3/Propp_Vladimir_Morphology_of_the_Folktale_2nd_ed.pdf).

### Two rewards, one for the player and one for the character
Every quest pays the player (a recipe, a tool, a place) and the character (a memory, a
line, a standing). **Why:** one without the other is either busywork or a free read.
It is G4 with a second half. **Source:** goals are not motivations, [The Angry GM, How to Motivate a Bunch of Lying Liars](https://theangrygm.com/how-to-motivate-a-bunch-of-lying-liars/).

### Out, pay, come back changed
Leave the fire, adapt in the mist, find what was needed, pay something, return, and the
camp is different. **Why:** the contrast between the cold outside and the hearth is the
heartbeat of a survival game. **Here:** an expedition whose price is a night's sleep and
a scare, never a lost item it did not bring (DECISIONS 2026-10-10). **Source:** Dan
Harmon's story circle, from his story-structure articles for Channel 101.

### The world remembers small things
Small, ordinary deeds are noticed later in a line. **Why:** the player feels the valley
is paying attention. **Here:** the `done_bitten` line already does it: the giver knows
the wolf bit you on the way. More: Maru remarks on a fire let burn low last night.
**Fails when:** a line remembers something that was undone. **Source:** *Baldur's Gate 3*
(Larian, 2023).

### Priority and once-only
Reactions are chosen by what just happened, the most specific first, and each plays
once. **Why:** recognition; the world answers you, and does not repeat itself. **Here:**
after the first hunt outrun, Maru's line about it outranks his fire lore, once. **Fails
when:** reactions pile up faster than talks and play late. **Source:** [Supergiant on Hades' dialogue](https://www.gdcvault.com/play/1026975/Breathing-Life-into-Greek-Myth); [the system explained](https://www.youtube.com/watch?v=bwdYL0KFA_U).

### A loop that grows
The same short round each dusk, and each time it shows a little more. **Why:** a familiar
route makes the player notice change. **Here:** the cairns along the fire's edge: on the
first night only stones, on the third a hollow one, on the seventh the mist thins enough
to show they ring an old cistern. **Fails when:** the round has nothing to do but walk.
**Source:** [Ashwell](https://heterogenoustasks.wordpress.com/2015/01/26/standard-patterns-in-choice-based-games/).

## 6. Arcs: how quests make a saga

An arc is a season's question (S6), told in three to seven quests. These are the shapes
that hold one together.

- **A web of places, not a line.** Each place in the arc holds clues to at least two
  others, so a missed clue never stops the arc and the player picks the order
  ([The Alexandrian, node-based design](https://thealexandrian.net/wordpress/7995/roleplaying-games/node-based-scenario-design-part-1-the-plotted-approach)).
- **Branch and bottleneck.** The arc fans out and comes back to one shared beat at its
  turn, where the world changes for everyone; the bottleneck accepts any three of four
  spokes, so a player stuck on one is not stuck on the arc ([Ashwell](https://heterogenoustasks.wordpress.com/2015/01/26/standard-patterns-in-choice-based-games/)).
- **Spokes of different kinds.** Around the bottleneck, each spoke is a different type,
  so the structure itself keeps the hand varied in every order.
- **Many small ways to one slow step.** Different small tasks raise one shared progress;
  when it is full, a new choice opens to spend it, and each spend moves the arc one step,
  like the minute hand driving the hour hand. The tasks that feed it must be different
  kinds, or the staircase is a counter (G17). Failbetter's Midnight Staircase and
  Grandfather Clock ([New Narrative Structures](https://www.failbettergames.com/news/new-narrative-structures)).
- **The task graph before the map.** Write which task opens which, then place the stream,
  the wheel and the door so the ground explains the logic ([Dormans 2010](https://www.pcgworkshop.com/archive/dormans2010adventures.pdf)).
- **Floating pieces.** Small scenes that wait for a state of the world (a fire low, a
  night, a debt) rather than a place in a chain: storylets ([Failbetter](https://www.failbettergames.com/news/storynexus-developer-diary-2-fewer-spreadsheets-less-swearing), [Emily Short](https://emshort.blog/2019/11/29/storylets-you-want-them/)).
- **Three doors in.** The three starters already sort the player at the start and meet
  at the bridge; an arc may open differently for each and close the same.
- **History makes evidence, not truth.** Let events leave objects and accounts, and let
  each speaker shape them; contradictions are the mystery ([Qud's histories](https://www.freeholdgames.com/papers/Generation_of_Mythic_Biographies_in_CavesofQud.pdf)). This is S2-S4.
- **Canon in three layers, for hundreds of creators.** The things anyone can see (props,
  places, how the world works) are fixed; the people (Maru, Pell, their voices) are held
  by their sheets; beliefs about the past are open, and may contradict each other as long
  as a speaker holds each (STORY.md S2, S3).

## 7. Generating quests at scale (the land beyond the valley)

For the endless generated ground (DECISIONS 2026-10-17). Nothing here is built; it is the
reading list for when generation starts.

- **Roles bound at start.** Write the quest as roles (giver, place, object) with rules,
  and bind them from the live world when it starts ([Nesmith on Skyrim's Radiant Story](https://gamesbeat.com/bethesdas-nesmith-reflects-on-the-difficult-birth-of-skyrims-radiant-story-system/)).
  Fails when the jobs outnumber the stories: Bethesda kept its jobs to the people they
  suit, wrote lines per voice, capped how often an event fires, and ended up writing
  many more pieces by hand.
- **Reserve before you generate.** When the world is made, mark the places and objects a
  future quest needs, so a player who arrives early does not break it ([Qud](https://ceur-ws.org/Vol-2862/paper5.pdf)).
- **A model writes the words, the code owns the quest.** Steps, rewards and completion
  come from a validated skeleton; a language model may only propose the two lines a giver
  says, for a person to review. Measured: about one generated quest description in five
  was judged acceptable ([Värtinen et al., IEEE ToG 2024](https://research.aalto.fi/en/publications/generating-role-playing-game-quests-with-gpt-language-models/);
  [van Stegeren & Myśliwiec 2021](https://ris.utwente.nl/ws/files/276608741/VanStegeren2021fine_tuning.pdf)).
- **Ground the model in a graph of the world.** Pick a path through what exists (Pell
  fears the flooded archive, which holds a lamp lens) and only then write
  ([Ashby et al., CHI 2023](https://doi.org/10.1145/3544548.3581441)).
- **Open-source pieces, MIT or Apache, none adopted:** [Tracery](https://github.com/galaxykate/tracery)
  (text variants), [ink](https://github.com/inkle/ink), [Yarn Spinner](https://github.com/YarnSpinnerTool/YarnSpinner),
  [storylet-framework](https://github.com/wildwinter/storylet-framework),
  [GraphDungeonGenerator](https://github.com/amidos2006/GraphDungeonGenerator) (Dormans'
  mission graphs). A second content language needs a decision first (TOOLKIT.md section E).

## 8. The types the valley never asks, and what each needs

`pnpm quests` on 18.10: nine of the fourteen types are asked. Of the other five, one can
be written today and four need a step kind the kernel does not have. A new step kind is
the owner's call (GAME_RULES section 6).

| Type | Today | What it needs | A first card |
|---|---|---|---|
| `gamble` | Possible: a `find` of an item from a dig spot whose `chance_pct` is low | nothing | Motivation: reputation |
| `dilemma` | No step ends on a choice | a step that gives one of two things to one of two people, each side shown first (G12), and moves the lean (STORY.md section 4) | Two patrons; what the player wants, what the valley needs |
| `persuasion` | Topics exist in talk, but no step completes on asking | a step that completes when the player asks a topic learned in the world; never a list with one right pick (Quiz talk, G19, G23) | Three clues (one is a question asked right) |
| `errand` | A quest cannot repeat | a repeat flag, marked as an errand, only after the main beat (G4) | Wealth; equipment |
| `collection` | The shelf was removed (P-1) | a set shown in one world place that people notice when full | A loop that grows |

## 9. Light quests that bring players back

A light quest takes a few minutes and comes back, or is replaced when it is done. The
field's loops are built to bring players back, and many do it with loss: a streak that
breaks, a chest that expires, a last chance. The valley keeps the half that works without
loss: G28 (the valley waits, nothing is lost for being away, nothing is paid for, a
return is rewarded) and G42 (rare is capacity and gates, never a timer). The line, from
the light-quests pass: surprise the player with what they find, never with what it pays;
keep every past effort; let them rest. Most light quests are `errand` or `collection`,
the two types section 8 says need something new first. A light quest is still a quest
in the hand: one of the type just finished is two of a kind (section 1).

### Whatever they did counts
A small goal for coming back is met by any real play (a find, a mend, a night out), never
by a chore set for it. **Why:** the player never puts aside the game they want to play
for the one they must; the choice stays theirs (autonomy, the "Three needs" card).
**Here:** the small reward for coming back (the ladder's Day 2 rewards a return) pays on
the first thing the player finishes, whatever it is. There is no list of the day's chores
to clear first. **Fails when:** the reward needs one kind of play (then it is a chore
again), or players hold back what they enjoy to save it for the next return. **Source:** Genshin Impact's
Adventure Encounters: from Version 4.8, Encounter Points come from Archon, Character
Story and Hangout quests, World Quests and events, under a daily limit
([HoYoverse](https://genshin.hoyoverse.com/m/en/news/detail/124837)).

### Seven marks, with any gap between
A larger reward waits at the seventh mark, and a day gives one mark at most, for any
task. **Why:** a daily ceiling makes grinding pointless, and counting marks instead of
days in a row means a week away costs nothing. **Here:** Maru cuts a notch in the bridge
post for the first quest the player finishes on a day; at the seventh he shows them where
the ford can be crossed, a new way over (G4). **Fails when:** the player always picks the
easiest task for the mark, or the seventh reward outshines the quests themselves.
**Source:** Pokémon GO's Field Research: "one Stamp per day by completing at least one
Field Research task", and a Research Breakthrough at seven ([Niantic](https://pokemongo.com/news/research)).

### A neighbour's small favour
The `errand`: a named neighbour asks a small thing for a small need, and pays in gold and
standing. **Why:** a person with a reason turns a delivery into a favour (relatedness),
and a favour can come back without pretending to be a story. **Here:** Pell's awning tore
in the night wind. She needs reed that stayed dry, and hints that only the reed under the
bridge arch did; she pays as an errand pays (G4), and the awning is mended the next time
the player passes. **Where we differ:** Stardew Valley's Help Wanted notices are random,
pinned to a board and last two days; the valley's are asked face to face (a board as a
menu is out, section 1) and they wait (G28). **Fails when:** the asks repeat word for
word, or the favour is a count with no question (Click-until-done, G1). **Needs:** a
repeat flag for errands (section 8). **Source:** Stardew Valley's Help Wanted quests,
paid in "money and sometimes increased friendship with the quest giver", two days to
finish ([wiki](https://stardewvalleywiki.com/Quests)).

### A place that heals when its set is full
The `collection`: a set of different things, each placed in one spot in the world, each
part paying a little, and the full set changing the place for everyone who passes.
**Why:** small parts with a visible end turn gathering into care for a place, and the
world itself shows the progress (pillar 4). **Here:** the empty shelves of a ruined
smokehouse each want one kind of thing: a dried herb, a fired pot, a coil of rope. Every
filled shelf shows; with all of them full, the smokehouse is a dry place to spend a night
out. **Fails when:** one rare thing holds up the whole set (G42), or the set is a
tax on the bag. **Needs:** the set shown in one world place (section 8). **Source:**
Stardew Valley's Community Center bundles, where a finished room's reward "sometimes
benefits the entire community" ([wiki](https://stardewvalleywiki.com/Bundles)).

### A total that only grows
Show what the player has done as a total that never goes down, never as a streak.
**Why:** people are "particularly averse to losing" a streak, and Duolingo found that a
little slack motivates more than a rigid rule; a total keeps the pride and drops the
fear. **Here:** a stone set by the hearth for each night the fire was kept by hand (G48);
the row only grows. **Where we differ:** Duolingo keeps its streak and softens the loss
with Streak Freezes; the valley has no streak to lose (G28). **Fails when:** the number
becomes the reason to play. **Source:** [Duolingo on the streak](https://blog.duolingo.com/how-duolingo-streak-builds-habit/).

### Leave the question warm
End a session on a question the player can pick up again, its clue kept where they left
it; never on a threat. **Why:** a 2025 meta-analysis found "no memory advantage for
unfinished tasks" (the popular Zeigarnik claim) "but found a general tendency to resume
tasks": build for picking up, not for nagging. **Here:** the rubbing of half a carving
stays on the stone by the fire until the player finds the carving that finishes it; Maru
asks about it once, the next time they meet. **Fails when:** too many questions are left
open at once (Christmas tree, G3), or the open one fades while the player is away (G28).
**Source:** [Ghibellini & Meier 2025](https://www.nature.com/articles/s41599-025-05000-w).

### Already begun, nearly done
Start a set with real progress someone else already made, and put the last piece close.
**Why:** car-wash customers finished a ten-stamp card that came with two stamps more often
than an eight-stamp card that came with none (endowed progress), and café customers
bought coffee faster as the free one came near (the goal gradient). **Here:** Maru has
already reset two of the five stepping stones at the ford, his own work, and asks for the
other three; the last stone lies a few steps from the fourth (G5). **Fails when:** the head
start is fake (the total was raised to make room for it), or the bar shows a grind. Both
studies are of shoppers, not players: a design bet, not game evidence. **Source:**
[Nunes & Drèze 2006](https://doi.org/10.1086/500480); [Kivetz, Urminsky & Zheng 2006](https://doi.org/10.1509/jmkr.43.1.39).

### Surprise in what is found, never in what it pays
Let what a dig or a search turns up vary (which carving, whose story), and keep what it
pays known and fixed. **Why:** a payout that comes at random after an unknown number of
tries is the schedule that "has long been demonstrated to rapidly produce a frequent level
of gambling that is difficult to suppress"; curiosity about content does not need it.
**Here:** a dig spot always gives the same useful thing; the shard beside it varies, and
each shard has a speaker (S2) and two readings (S4). **Fails when:** the rare find is the
valuable one, with the odds hidden, near misses shown, or a retry that costs (G28, G42).
A `gamble` quest keeps its odds fixed and asks nothing to try again. **Source:**
[James, O'Malley & Tunney 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5516195/);
B. F. Skinner, *Science and Human Behavior* (1953).

### A sign in the world, not a ping
The habit loop of trigger, action, reward and investment, with the trigger inside the
world and the investment kept for good. **Why:** Eyal's Hook model starts a habit with
external triggers "like an email, a link on a web site, or the app icon on a phone"; the
valley keeps the loop and moves the trigger into the world (pillar 4). **Here:** smoke
rising over the ruins is the trigger, walking there is the action, the story of the cold
camp is the reward, and the fire ring the player sets there stays for every later visit.
**Fails when:** a notification makes the player anxious, or the investment can be lost
(G28). The model comes from practice, not from tested research. **Source:**
[Eyal, the Hook model](https://www.nirandfar.com/how-to-manufacture-desire/).

### Three needs, one check
Before a light quest ships, ask three questions: does the player get better at something
(competence), did they choose it (autonomy), does somebody notice (relatedness)? **Why:**
in four studies, the sense of autonomy and competence in a game went with enjoyment, and
in online play the three needs "independently predict enjoyment and future game play".
The palette beside G17 already names the need behind each type. **Here:** Pell's reed:
the player learns where reed stays dry (competence), takes the favour or leaves it
(autonomy), and finds the awning mended when they pass (relatedness). **Fails when:** the
three become boxes ticked on a counter. **Source:** [Ryan, Rigby & Przybylski 2006](https://doi.org/10.1007/s11031-006-9051-8).

### A budget for every loop
Each loop that repeats has a small size and stops there: no chest that grows for coming
back every day, no loss for staying away, no paid rescue, no power that only the loop
gives. **Why:** in a survey of 178 players, engagement rewards read as motivation, but
also as fear of missing out, "or even as an obligation or chore"; a dark pattern is a
design whose purpose works "against a player's best interests". **Here:** the reward for
coming back and the seventh notch are the valley's loops, and both stop there: after
them, play pays only in what it finds. **Fails when:** the "optional" reward is needed to keep
up. **Source:** [Frommel & Mandryk 2022](https://doi.org/10.1145/3549489);
[Zagal, Björk & Lewis 2013](http://web.archive.org/web/20261001031717/http://www.fdg2013.org/program/papers/paper06_zagal_etal.pdf).

## 10. From the forums

What game masters and players remember from their tables and screens: the forums pass
read Giant in the Playground, RPG.net, the interactive fiction forum and Reddit. Every
card was checked on its thread. The Giant in the Playground and RPG.net threads refused
to be read automatically, so ideas that rest only on them are left out, and where a
thread did not hold the pass's claim, the card cites the talk or the game that does. The
stories here keep S1-S6: the past is told by things and speakers, never by the narrator.

### Every witness right once, wrong once
Three sources each give two pointers, one true and one wrong; only one place fits a true
pointer from each. **Why:** the player weighs accounts instead of guessing who lies, and
every pointer can be checked by walking to it. **Here:** where was the lantern buried?
Maru, Pell and a note left by a returner who came before each name two landmarks; one from
each matches the ground by the willow, and a dig there turns up the lantern. The wrong
pointers read as honest mistakes (S5), and the answer is a dig, never a pick from a list
(G6, Quiz talk). **Fails when:** a pointer can only be checked by reading (G9).
**Source:** a device of the puzzle writer R. Wayne Schmittberger's, "multiple NPC's, each
one with one good piece of advice and one bad piece of advice", recalled on
[the IF forum](https://intfiction.org/t/a-list-of-events-advice-but-with-no-two-happening-too-close-together/62840).

### Turn the landmark over
Hide the answer in a landmark that reads right only from an unexpected side: upside down,
in a reflection, from above. **Why:** the insight is seeing the same evidence another
way, a riddle's catch and reveal (G6). **Here:** at night the forked carving on the ruin
wall, seen in the still pool below it, becomes an arrow to a dig spot. **Fails when:** the
trick comes back so often that players try it everywhere. **Source:** a puzzle book whose
required room is reached only by turning the book upside down, from
[the IF forum's favourite puzzle books](https://intfiction.org/t/what-are-your-favorite-puzzle-books/64403).

### Learn the signs by using them
Teach a few signs through places that show what each one means, then ask the player to
read a phrase made of them. **Why:** the knowledge is earned by doing, so the last step is
a use, never a quiz (G9, Quiz talk). **Here:** three waystones near the ruins, each beside
what its sign means: one by a fire, one over a pit, one that shows only at dusk. A fourth
stone carries all three signs and says where to stand at night. **Fails when:** the player
needs notes outside the game, or a wrong reading gets no answer from the world (G7).
**Source:** *Moondrop Isle*, whose shore kiosks "teach you a mysterious language" that
later puzzles use ([IF forum guide](https://intfiction.org/t/moondrop-isle-explorers-guide/80508)).

### A crossing that answers experiments
A place with one hidden rule, where every try leaves a trace to learn from. **Why:** a
failed try is information, so the puzzle is testing, never guessing (G7: a wrong try
teaches). **Here:** a mist path that always leads back to where it began, except that what
the player drops on it stays; the stones they leave show where it bends. **Fails when:**
each try costs something scarce, or the rule is not in what the player can see.
**Source:** a game master's "never ending bridge" puzzle that kept the players "testing
stuff out" ([r/DMAcademy](https://www.reddit.com/r/DMAcademy/comments/10eezul)).

### One mystery, many roads
One question with several honest ways to the answer: evidence, an experiment, a watch, a
word with the right person. **Why:** the road a player picks says who their character
is, and players come back to a quest to try the others. **Here:** why does the fire by the
ruins burn blue on some nights? Dig the ash for what was burned, ask Pell who bought marsh
peat, keep watch at dusk, or try a handful of peat on the player's own fire. **Fails
when:** the roads end in the same scene, or one is plainly the cheapest. **Needs:** a step
met by any one of several actions (every step of a quest is required today) and, for the
word with Pell, the persuasion step (section 8). **Source:** *Fallout: New Vegas*'s Beyond
the Beef, loved for "the amount of different paths and outcomes"
([r/patientgamers](https://www.reddit.com/r/patientgamers/comments/17dztgd/in_your_opinion_whats_the_greatest_sidequest_of/)).

### A room that remembers its owner
Tell who someone was through what they left in a place: what they mended, what they kept
in pairs, marks on a door frame. No note says it. **Why:** the player infers a life, which
turns S1 (the narrator never states the past) into a pleasure. **Here:** a sealed workshop
in the ruins holds a mended toy, two cups and a child's height notched on the frame; Maru
reads it one way, Pell another (S4). **Fails when:** every object carries a text (G9), or
the life is stated later by the narrator (S1). **Source:** [Smith & Worch, What Happened
Here? Environmental Storytelling, GDC 2010](https://www.gdcvault.com/play/1012647/What-Happened-Here-Environmental).

### Glimpse tomorrow's mystery early
Hide an optional look at a later story where a curious player can find it early, and let
the later story notice. **Why:** recognising it later rewards the explorer and makes the
world feel whole. **Here:** under the bridge, a lantern still warm beside a seal nobody
has spoken of; a season later, when the seals open an arc, Maru asks whether anyone has
been under the bridge, and a player who has gets another line (the world remembers small
things, section 5). **Fails when:** the later story ignores it, or the early look gives
the whole answer away (S6). **Source:** *Deus Ex*, where an optional trip into the sewers
meets "the main enemy faction ... hours before they enter the story properly", and "it
even influences some dialogue later on" ([r/patientgamers](https://www.reddit.com/r/patientgamers/comments/17dztgd/in_your_opinion_whats_the_greatest_sidequest_of/)).

### A grove that grows between visits
Something the player planted or mended keeps growing between visits, and the change is
the reward for coming back. **Why:** the size of the change shows the size of the work; a
return is rewarded (G28), and the player's mark stays in the valley (STORY.md section 1).
**Here:** saplings set on a burnt slope are shoots on the next visit and a stand of young
trees a season later. **Fails when:** the growth is a timer in front of something rare
(G42), or what was planted can wither while the player is away (G28). **Source:**
*Chrono Trigger*'s Fiona's Forest, a dead forest that "will take hundreds of years of
labor to regrow" ([r/patientgamers](https://www.reddit.com/r/patientgamers/comments/17dztgd/in_your_opinion_whats_the_greatest_sidequest_of/)).

### A settlement built from people
One place grows a person at a time, each found through a different type of quest, and
each stays with a trade and a habit. **Why:** the place is the visible sum of the player's
play, and its people make it a home; spokes of different types keep the hand varied in
every order (section 6). **Here:** the empty camp by the ford gains a potter (a riddle), a
rope maker (a tending night) and a seed keeper (a discovery); each brings a stall or a
recipe (G4). **Fails when:** a newcomer is a list of materials, or loses their voice once
they arrive. **Source:** *Breath of the Wild*'s Tarrey Town, named among the greatest side
quests on [r/patientgamers](https://www.reddit.com/r/patientgamers/comments/17dztgd/in_your_opinion_whats_the_greatest_sidequest_of/).

### The traveller on their own errand
A traveller met again and again across the map, each time stuck on the way to a promise
of their own, and helped a different way each time. **Why:** the player walks into a
story already moving, and spaced meetings turn a stranger into a friend. **Here:** a
traveller who holds the Waker belief (STORY.md section 3: "Nobody yet; a traveller or a
player"), met at the ruins, then the ford, then the night arch, carrying an ember to a
camp nobody has lit; each meeting is a different type. **Fails when:** missing one meeting
ends the arc without a word (a web, not a line: section 6), or every meeting is the same
rescue. **Source:** *Dark Souls III*'s Siegward, "a character you run into all the time to
help him out of jams as he's trying to reach his destination and fulfill a promise to an
old friend" ([r/patientgamers](https://www.reddit.com/r/patientgamers/comments/17dztgd/in_your_opinion_whats_the_greatest_sidequest_of/)).

### Local cases, one valley question
Several quests each answer their own question, and what they turn up also feeds one
larger question that stays argued. **Why:** each case pays on its own (pillar 1) while the
pattern pulls the player on, and no single case can settle a belief (S4). **Here:** a
missing bell, a buried road stone and a fire that burns blue each have a local answer;
their marks fit Maru's reading and a Waker's alike, and the season asks which (S6).
**Fails when:** a local case feels unfinished without the larger one, or the evidence
points one way only (S4). **Source:** *Masks of Nyarlathotep* (Chaosium, 1984), local
investigations in several cities that add up to one conspiracy; The Witcher 3, whose side
quests "frequently cross paths with main quests" ([GDC Game Narrative Review](https://media.gdcvault.com/gdc2016/GameNarrativeReview/Haque_Game%20Narrative%20Review.pdf)).

### A fair of different verbs
A gathering where every stall is a different short test, so variety is the point of the
visit. **Why:** pillar 3 inside one place: in whatever order the player takes the stalls,
the next is a different kind. **Here:** a gathering at the fire on any night the player
calls it: split a log in three strikes (skill), cross the dark yard by sound alone (maze),
carry an ember over the stepping stones without letting it die (tending); each stall pays
in its own kind (G4). **Fails when:** every stall is the same timing test in other art, or
a prize needs all of them. **Source:** the Stardew Valley Fair, with a slingshot game, a
spinning wheel and a fortune teller among its stalls ([wiki](https://stardewvalleywiki.com/Stardew_Valley_Fair)).

**Not taken from the forums:** a stranger who leads the player to an ambush (*Gothic*, in
the same Reddit thread): a fight and a theft (G35). A reunion that must happen in the last
hour before the end (*Majora's Mask*'s Anju and Kafei, loved in the same thread): a last
chance (G28); the traveller card keeps its heart without the clock.

**What the kernel lacks for these:** a step met by any one of several actions (One
mystery, many roads), and the steps section 8 lists. A new step kind is the owner's call
(GAME_RULES section 6).
