# The story: folds, returners, beliefs

This page is the product owner's, like [GAME_RULES.md](GAME_RULES.md) beside
it: the story of Openfold is told by what this page allows, and a line, a
quest or an extension that breaks it goes to the owner first (GAME_RULES
section 6). A part marked **approved** changes only by the owner's word,
written the same day in [DECISIONS.md](../../DECISIONS.md). A part marked
**proposed** is a recommendation that waits for that word; nothing proposed is
built before it.

Why it exists (2026-10-10): the game has a frame (product spec v4.6, section
7: a forgotten world restored, every extension a restoration) but no plot and
no target. Measured on develop that day: six quests with about 200 words, two
speaking characters with about 380, three riddle notes, six whispers, four
echoes and three opening lines: about 800 words of story in all. Every new
quest, character and extension is written against this page from here on.

## 1. The frame (approved, 2026-10-10)

- **The mist folds ages.** A fold is one age of the valley that the mist
  folded away: its people gone, its knowledge forgotten, some of its things
  left behind (the ruins, the bells, the lanterns).
- **The number of folds is open.** Nobody in the valley knows how many there
  were, and nobody on the team does either. A creator may find one more. No
  fold is the first or the last until the owner says so.
- **Every fold's knowledge can be found again.** The spec's order (foraging,
  hunting, fire, then fishing, pottery, farming, metal) is the order in which
  the present relearns. Under it lie folds that knew other things: a clockwork
  age, an age of machines, something that looks like magic. Which came first
  is not settled, and may never be.
- **The players are returners, not chosen ones.** Each comes back with a
  reason of their own (each character begins its own way, DECISIONS 2026-10-09).
  Others came before and did not stay ("You are like the first ones who came
  back. They did not stay."). Many players in one world are many returners;
  none of them is the one.
- **The valley is the hero.** The story is what happens to the valley: a
  place mended, a bell heard, a fold found. A player's mark is left in the
  valley (a mended place, a board), never in a prophecy.
- **An extension is a fold, or a corner of one.** Creators drawing in
  different styles are restorers of different ages; the unevenness the spec's
  risk table fears is the story itself.

Why this frame: a multiplayer world cannot have one hero who learns their
past, community content needs a reason to look different, and an open
roadmap needs a story with no last page. Each community discovery can open a
fold.

## 2. No single truth (approved, 2026-10-10)

The owner's model: Pokemon and Skyrim. Legends are told differently by
different people, books in the world contradict each other, and the player
decides what they believe. No answer is always right.

- **S1 The narrator never states the past.** The narrator (voice sheet in
  GAME_RULES) says what is there now. "The ancients sealed the mist" is never
  the narrator's line.
- **S2 Every claim about the past has a speaker.** A character, a belief, a
  note, an inscription. The content names the source, and the check can read
  it (section 5).
- **S3 The bones are few and anyone can see them.** These are not argued: the
  mist comes at dusk; the bells ring with nobody to ring them; there are old
  things under the town; the lanterns glow at dusk. What they mean is argued.
- **S4 Every clue fits at least two readings.** A clue that proves one belief
  right is cut, or a second reading is written for it.
- **S5 No belief is evil, and none is a joke.** Each has a person who holds it
  for a reason, and something it gets right.
- **S6 A season answers one question and opens one.** The folds are never
  told in full.

Since nothing is canon behind the curtain, nothing needs a secret file: the
whole story bible lives in this public repository. The only spoiler is what
waits in the next place.

## 3. The beliefs (proposed, waits for the owner)

Three to start, each a different answer to "what is the mist". The names are
working names.

| Belief | The mist is | So you should | Held today by | A bone, read its way |
|---|---|---|---|---|
| The Menders | A forgetting that takes what nobody looks after. | Mend what is left, one thing at a time. | Maru | The bells ring before the mist comes: a warning. |
| The Wakers | A sleep over ages greater than ours. | Wake the old things: light the lanterns, open the ruins. | Nobody yet; a traveller or a player. | The lanterns glow by themselves: something down there is still awake. |
| The Keepers | A mercy that folded away what hurt. | Let sleeping things sleep; take only what you need. | Nobody yet. | The first returners dug deep and did not stay. |

Pell holds none of them and repeats all three as rumours, with a price on
each; her voice sheet already says she has no lore of her own. A player never
picks a belief from a menu: what they do leans one way or another (section 4).

## 4. Karma: the valley remembers (proposed, waits for the owner)

The owner asked whether there should be a good, evil or karma axis. The
recommendation: no single good-evil meter.

- Fallout 3 kept one karma number, and players learned to game it (give water
  to a beggar, then do what you like); good and evil became a colour to pick.
  New Vegas leaned on standing with each faction instead, fame and infamy
  apart. Ultima IV hid eight virtues and showed them only through a seer, and
  the game is won by living them, not by reading a bar.
- **The shape:** a hidden whole-number standing for each belief, kept by the
  kernel and moved by the side a player takes in a `dilemma` quest and by some
  acts (lighting an old lantern leans Waker, leaving a find in the ground
  leans Keeper).
- **No number on screen.** The world shows it: how a character greets you,
  which telling of a rumour Pell gives you first, a line a character says only
  to someone who leaned their way.
- **Kindness to other players is apart, and already counted:** the giving
  board.
- **A world leans too.** The sum of its players' standings tilts which telling
  is heard loudest in that world, never which one is true.
- **G28 and G12 hold.** Nothing fades by the clock, no door closes for good,
  a lean can always be walked back, and both sides of a dilemma lead on.

## 5. How it is built (proposed, waits for the owner)

Games with a lot of reactive story text do not write branching trees. They
write small pieces with conditions:

- **Storylets** (quality-based narrative, Failbetter's Fallen London; Emily
  Short): a piece of content, the conditions under which it may appear, and
  what it changes.
- **Salience** (Valve's dynamic dialogue, GDC 2012; Hades): many lines
  compete for one moment, the most specific match wins, and a line already
  heard steps back. Yarn Spinner 3 added storylets and saliency in 2025, which
  confirms the pattern.

This fits the repository as it is: content is declarative JSON checked by a
schema, so a line with conditions is one more field the check reads. The
schema work, in order, each its own pull request and additive (the format
version stays 1):

1. **Lines with conditions.** `when` on dialogue lines and topics (a quest
   done, an item held, a place mended, a season, a standing) and a
   `priority`. The most specific match is said. G21 needs this now, belief or
   no belief: "a new topic appears when the world changed".
2. **Quest lines on the quest.** `offer` and `done` lines in the quest file,
   in place of the lines hardcoded in `game/src/ui/ui.ts`.
3. **A `belief` content kind.** Its name, what it says of the mist, and its
   readings of the bones. A character names the belief it holds, or none; a
   lore line (whisper, echo, note, inscription) names its source.
4. **Standing in the state**, moved by a `choice` step in a `dilemma` quest.
   Kernel, integers.
5. **Checks in `pnpm check`:** a glossary of the valley's names, with a
   warning for an unknown capitalised name in a line (G22); an error for a
   lore line with no source (S2); a belief needs at least two clues and every
   clue two readings (S4).

The tools:

- **The runtime stays our JSON.** ink and Yarn Spinner were weighed in
  [TOOLKIT.md](TOOLKIT.md) section B: a second content language would split
  the check, and Yarn has no official JavaScript runtime.
- **Drafting:** Twine, or Inky (ink's editor), to play a conversation or a
  dilemma with the owner on a phone before it becomes content. The draft is
  thrown away.
- **The story bible** is this page, and files beside it when it grows: plain
  markdown that Obsidian opens, agents read and the planned MCP server serves.
- **Not adopted:** wiki services such as World Anvil or Kanka (data outside
  the repository is invisible to the check and to agents); NPCs that chat
  through a language model (G20 and G22 need written lines, and players of
  Where Winds Meet talked its AI characters out of their quests within weeks
  of launch).

## 6. Three levels of story (proposed, waits for the owner)

| Level | Told by | Length | Example |
|---|---|---|---|
| A place | Its people, notes and things | One or two sessions | The bridge, the three fruits |
| A season | One arc across the valley | A season | Answers one question, opens one (S6) |
| The folds | Nobody, in full | Open | Each community discovery opens a fold or a corner of one |

## 7. Open, for the owner

1. The beliefs: how many to start, their names, what each says (proposed:
   the three in section 3).
2. Karma: yes or no; if yes, standing per belief or another shape.
3. Which folds the core names first (proposed: none by name yet; the night
   ruins under the bells hint at one).
4. The order of the schema work (proposed: items 1 and 2 of section 5 first,
   since G21 needs them whatever is decided on beliefs).

## Sources

- Emily Short, [Beyond branching: quality-based and salience-based narrative structures](https://emshort.blog/2016/04/12/beyond-branching-quality-based-and-salience-based-narrative-structures/) and [storylets](https://emshort.blog/tag/storylets/)
- Elan Ruskin, [AI-driven Dynamic Dialog through Fuzzy Pattern Matching](https://www.gdcvault.com/play/1015528/AI-driven-Dynamic-Dialog-through), GDC 2012
- Yarn Spinner, [Storylets and saliency, a primer](https://docs.yarnspinner.dev/write-yarn-scripts/advanced-scripting/storylets-and-saliency-a-primer)
- [ink](https://github.com/inkle/ink) and [inkjs](https://github.com/inkle/inkjs), Inkle; [Twine](https://twinery.org)
- [The battle to control what's fact and fiction in Elder Scrolls lore](https://www.pcgamer.com/au/the-battle-to-control-whats-fact-and-fiction-in-the-elder-scrolls-lore), PC Gamer
- [Morality and karma systems](https://popmatters.com/92823-morality-and-karma-systems-2496018990.html), PopMatters
- [Ultima IV's success with narrative through gameplay](https://www.gamedeveloper.com/game-platforms/ultima-iv-s-success-with-narrative-through-gameplay), Game Developer
- [Where Winds Meet AI exploit lets players skip quests](https://respawn.outlookindia.com/gaming/gaming-news/where-winds-meet-ai-exploit-lets-players-skip-quests)
- Ernest Adams on [storylike MMOs](https://www.gamedeveloper.com/design/gdc-europe-speaker-spotlight-ernest-adams-on-storylike-mmos)
