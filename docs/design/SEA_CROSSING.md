# The sea crossing: the passage across the bay, with a sea event drawn on the way

Written 2026-10-31 as gap M1 of [EXPERIENCE_AUDIT.md](EXPERIENCE_AUDIT.md). A proposal: nothing here is built, and the owner's
three questions in section 6 come before any code.

**Research memo pending.** The sea memo commissioned on 29.10 never came (every outside research tool was down on 31.10). This page is
designed from the first draft of 28.10, the explorer memo's section 5 (used as proposals, not facts), and the hooks already on
`develop`. When the memo lands, its findings are checked against sections 3 and 4 here.

## 1. What the owner asked for, and what is already decided

- **28.10, the owner:** the sailing to the human city is an open-world passage with a random sea quest on it, an opportunity, never a
  loading screen.
- **DECISIONS 2026-10-22 "The human world is a serious city across the river":** the river becomes a bay, and boats cross it.
- **DECISIONS 2026-10-22 "The skeleton and the elf reach the human city another, harder way":** the boat is the human's way; the
  other two races have their own, harder ways, each with its opening quest.
- **DECISIONS 2026-10-22 "The opening pool and the region quests":** every region opens by its own quest. The crossing is part of the
  city's opening quest, never a gate by level.
- **G55 "A far bank is scenery now and a promise later":** on the first map the far bank is scenery and a shut line says only what
  is true.
- **DECISIONS 2026-10-30 "The first map is A2":** the walled city at the river's bend is a city of all races, not the human city.
  Where the human city stands is open for STORY; FIRST_MAP still draws it on the far bank, south-west across the bay.

## 2. The hooks already on develop

| Hook | Where | What it gives |
|---|---|---|
| The region purpose `passage` | `schema/src/index.ts:1979` (`REGION_PURPOSES = ['stop', 'passage']`) | A region can be marked as a way through, not a place to stop |
| An exit with no gate slot, "the jetty where the boat waits" | `schema/src/index.ts:2068` | The last tile a foot stands on before the boat |
| The plan exit `core/ferry` | `content/core/map.json`, `plan.exits` | The map already names the way out by water |
| Pell's ferry route, hours 6 to 19 | `content/core/map.json`, `plan.routes` (`core/pell-ferry`) | A character who already walks to the water by day |
| The smuggler's way, hours 20 to 5 | `plan.routes` (`core/smuggler-way`) | A night crossing that is not the ferry |
| The keyed draw | `kernel/src/rng.ts` (`draw`, `drawBasisPoints`: seed, entity, counter) | A roll that differs per trip and is the same on replay |
| The coast dock, d2 | FIRST_MAP (52, 177), 139 steps from town | Where the boat leaves on the first map |

## 3. The design

### The passage file

A new file type beside `expedition`, `content/<handle>/passages/<id>.json`, under the kernel's rules (pure, integer-only, no
price written by hand):

```json
{
  "id": "core/bay-crossing",
  "from": "core/ferry",
  "to": "core/far-jetty",
  "hours": [6, 19],
  "fare": { "item": "core/ferry-token", "qty": 1 },
  "segments": 8,
  "events": [
    { "event": "core/drifting-crate", "weight": 30 },
    { "event": "core/a-passenger", "weight": 25 },
    { "event": "core/gulls-over-a-shoal", "weight": 20 },
    { "event": "core/squall-warning", "weight": 15 },
    { "event": "core/fog-bell", "weight": 10 }
  ]
}
```

- `from` and `to` are exits of the map plan; the check refuses one that does not exist.
- `fare` is an item (its value comes from the kernel, AGENTS.md: never a price); it may be left out for a free crossing.
- `segments` is the length: the boat moves one segment per player act, never by time alone (G28, QUEST_PATTERNS 4 "A clock you can
  see"). At the memo's proposed pace of one act every 10 to 15 s, 8 segments is 80 to 120 s.
- `events` is a weighted table of integers; the weights need not sum to anything.

### The event record

`content/<handle>/sea-events/<id>.json`: what shows first, what the player can do, what it costs to ignore, what it pays.

- `sign`: what the player sees or hears before it strikes (QUEST_PATTERNS 4 "Warn, then strike"): a dark line on the water, gulls
  leaving, a bell in the fog.
- `window`: how many segments the player has to answer.
- `act`: one existing step kind (`find`, `tend`, `riddle`, `bring`), so the quest grammar does not grow for the sea.
- `miss`: the boat turns back to `from` with what the crossing found (QUEST_PATTERNS 4 "A gauntlet that sends you back, not out"),
  never overboard, never a loss of the bag.
- `reward`: a line on the ladder (G-rules on pay), checked like any quest reward.
- `who` (optional): a passenger met aboard, a different traveller each trip (QUEST_PATTERNS 10, "The traveller on their own errand"):
  the cheapest way to make the event a person.

### The roll

One roll per crossing, on the server (DECISIONS 2026-10-23 "Combat, round 1": the server runs what is drawn):

```text
r     = drawBasisPoints(seed, "passage:" + passage.id, player.crossings)   // 0..9999
total = sum(weights)
pick  = first event whose running sum of weights exceeds floor(r * total / 10000)
```

- Deterministic: the same seed, passage and crossing count give the same event, on the phone and on the server.
- Integer-only: no fraction leaves the kernel.
- `player.crossings` rises by one when the boat leaves, so each trip draws a new event and a replay draws the same one.

### The kernel state

- `aboard?: { passage, segment, event, answered }` in the player's state.
- Aboard, the walk and the danger rules pause: the boat is a safe place (G30), and the event is the only danger on it.
- New actions: `board` (at the `from` exit, in `hours`, paying the fare), `sail` (one act, one segment), `answer` (the event's step),
  `land` (at the last segment).
- A fall cannot happen aboard; a missed event is `miss`, which lands the player back at `from`.
- `KERNEL_VERSION` rises, as with every new state field.

### The far side on the first map

The far bank is scenery on the first map (G55). So the first crossing lands at a small stamped jetty (`core/far-jetty`) at the bay's
far edge: a harbour hand with one line, the city gate in view and shut, with a line that says only what is true (G55),
written with the city's land by the STORY rules. The city's own land comes later and opens from here. The crossing back is the same passage reversed.

## 4. The first content

Five events, each one a different type (G17):

| Event | Sign | Act | Miss | Pays |
|---|---|---|---|---|
| A drifting crate | Something knocks the hull | `find`: hook it before it drifts past (2 segments) | It drifts off; the crossing goes on | A find from the bay's treasure table |
| A passenger | A traveller sits with a bundle | `bring`: they ask for something you carry | They say nothing more | Standing, a line, sometimes a recipe |
| Gulls over a shoal | Gulls circle low ahead | `tend`: hold the line while the boat drifts over the fish | The shoal is passed | Sea fish (the first sea fishing, gap N5) |
| A squall warning | The sky darkens in the west | `tend`: bail and trim through 3 segments | The boat turns back, with what it found | The crossing's normal pay, and the sight of the far bank in rain |
| A bell in the fog | A bell, left then right | `riddle`: steer by the sound | The boat circles and turns back | A rare find on the far jetty |

## 5. Measurables when it is built

1. The same seed and crossing count draw the same event on the phone and the server (a kernel test over 1,000 crossings).
2. Over 10,000 crossings the share of each event is within 1 percentage point of its weight's share.
3. No event can cost a bag item; a missed event always lands the player at `from`.
4. A crossing takes 8 player acts and between 60 and 150 s in the timed run.
5. The check refuses a passage whose exits do not exist, a weight of 0 or less, an event with an unknown step kind, and a reward over
   the ladder.

## 6. What the owner decides

1. **Is the boat the only way for a human to reach the far bank**, or may a human also walk round (G61; the elf and the skeleton
   already have their own harder ways)? Recommended: the only way for a human, so the crossing is the human's opening.
2. **Does the first map's crossing land at a far jetty with the city shut** (section 3, recommended: the passage is playable on the
   first map), or wait for the city's land?
3. **Where does the human city stand now** that the city at the bend is of all races? FIRST_MAP and G55 keep it on the far bank; this
   page assumes that.
