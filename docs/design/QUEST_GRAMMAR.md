# The quest grammar: the step kinds of an open world

Status: the design page of [QUEST_FORGE.md](QUEST_FORGE.md) phase 1a (the grammar without combat), with the combat kinds of 1b named and the shared steps of [SETTLEMENT.md](SETTLEMENT.md) 3.7 added, written 19.10.2026. Nothing here is built. It is the page the builder of `feat/quest-grammar-schema` and `feat/quest-grammar` codes from: the design judgement is spent here once, and the pull requests carry the measurable lines of section 10. The owner's word is not needed for a field; every rule a kind serves is his already (G1-G4, G12, G17, G19, G23, and the group lines of 10.10). QUEST_FORGE.md is in pull request #220; until it lands, read this page with [QUEST_PATTERNS.md](QUEST_PATTERNS.md) section 8.

Read with it: `schema/src/index.ts` (`QuestStep`, `QuestBody`, `NpcBody.topics`, the props' `note`), `kernel/src/step.ts` (`questSatisfied`, `accept`, `turnin`, `riddleKey`, `offeredTo`), `kernel/src/state.ts` (`Player`), `tools/src/quests/hand.ts`, QUEST_PATTERNS sections 1, 3 and 8 and the cards "Two patrons who want different things", "Three clues for every conclusion", "A place that heals when its set is full" and "One mystery, many roads", [GAME_RULES.md](GAME_RULES.md) G1-G4, G12, G17, G19 and G23, [STORY.md](STORY.md) section 4 (the lean), [DECISIONS.md](../../DECISIONS.md) 2026-10-10 "The shared world" (friends and groups) and "The world and its clocks" (quest points), 2026-10-18 "The quest designer".

## 1. What the kernel has today

- Eight step kinds (`bring`, `make`, `restore`, `build`, `visit`, `tend`, `find`, `riddle`) and fourteen types; five types cannot be written (QUEST_PATTERNS section 8): `dilemma`, `persuasion`, `errand`, `collection`, and `investigation` as "one mystery, many roads".
- A quest's steps have no order inside the kernel: `questSatisfied` reads all of them at the hand-in, and the journal reveals them three at a time (G3) on the client. A step's record lives in a per-kind list on the player (`solved` for riddles, `visited`, `restored`, `made`, `journal` for finds) and in the bag for `bring`.
- The player's quest record is `quests: Record<id, 'active' | 'done'>`; nothing per step, no choice, no count, no repeat.
- Topics are an NPC's `topics[]` (`ask`, `lines`, `when`), known to the client only: the session remembers `"<npc>?<index>"` and the kernel never hears a topic. A prop has a `note` the player reads on the client.
- `accept` refuses a quest whose `requires` are not all done, and one already taken; `turnin` refuses an unsatisfied quest; a giver-less quest closes itself when satisfied ("found once is found").

## 2. The rules the grammar keeps

- Additive only: `FORMAT_VERSION` stays 1, every new field is optional, every old file stays valid, and an old save reads the new player fields as empty (as `own: null` and `fires` are read today).
- The kernel stays pure and integer: a kind completes on an action or on a fact of the state, never on time alone (`tend` reads the hour from the tick, as today).
- One record per quest, not per kind: the new per-step facts live in one `progress` map, so the binder, the journal and the hand gate read one place.
- The journal shows the question (G1, G3): a kind that holds a list (`any`, `set`, `choose`) carries its own one-line `question` in the content, and the client never prints the list.
- No kind completes on a quiz (G19, G23): `ask` asks a topic the player learned in the world, `choose` shows both gives before the pick (G12), `riddle` stays as it is.
- A repeat is an errand's and nothing else's (G4; the quest points line of 10.10: a repeat counts nothing).

## 3. The kinds

For each: the fields (TypeBox, in `QuestStep` or `QuestBody`), what completes it, what the record keeps, the event, the journal, the check, the type it serves.

### 3.1 `choose` (a dilemma)

- Fields: `{ kind: 'choose', question: Text, options: [Option, Option] }`, exactly two; `Option = { to: Id, give?: { item: Id, qty: Int(1, 99) }, lean?: 'mender' | 'waker', label: Text }`, `to` an NPC. An option with no `give` gives nothing: the thing is kept, or given to nobody.
- Completes on the action `{ t: 'choose', quest: Id, option: 0 | 1, at: Tile }` near the option's NPC (`checkAt`); the give leaves the bag, refused with "You do not have that to give." when it is not there; the kernel writes `progress[quest].choice` and adds one to `lean[option.lean]`.
- Record: `progress[quest].choice: 0 | 1`; `lean: { mender: number, waker: number }` on the player (STORY section 4: the valley reads the lean from the count; nothing else reads it yet).
- Event: `{ e: 'choose', quest, option, to, item?, qty? }`.
- Journal: before the pick, `question`; after it, the option's `label` as the done line. The client's box shows the two labels with their gives (G12: both shown before the pick); the labels are the option lines, and nothing is a default.
- Check: both options name NPCs that exist and differ; when both give, the two gives are within `quest.choose_spread_pct` (50) of each other by the value table (G12: neither side strictly better); the two leans differ or both are absent; `question` is under two lines (G14).
- Type: `dilemma`. Card: "Two patrons who want different things".

### 3.2 `ask` (persuasion)

- Fields: `{ kind: 'ask', npc: Id, topic: Id }`. A topic id is new content: an NPC's topic entry gains `id?: Id` (handle-prefixed, as every id), and a prop's `note` and an NPC's topic entry gain `teaches?: Id`, the topic the player learns by reading or hearing it.
- Learning: the action `{ t: 'read', prop: Id, at: Tile }` near a prop with `teaches` adds the topic to `player.topics` (sorted, once) and emits `{ e: 'topic', topic, from: prop }`; the action `{ t: 'ask', npc, topic, at }` on an NPC entry with `teaches` does the same with `from: npc`. The client sends `read` when the player looks at a prop with a note (today's look, now also an action) and `ask` when a topic is picked from the menu.
- Completes on `{ t: 'ask', npc, topic, at }` where `topic` is in `player.topics` and the NPC has an entry with that `id` whose `when` holds; refused otherwise with "You have nothing to ask about that yet." The NPC's menu shows its own open topics as today and, below them, the learned topics the NPC answers (an entry with that `id`), so a learned question is a choice of what to learn and never a quiz (G23).
- Record: `progress[quest].asked: string[]` of `"<npc>#<topic>"`, so a quest with two `ask` steps keeps both.
- Event: `{ e: 'ask', quest, npc, topic }`.
- Journal: the step's line names the NPC, never the topic ("Pell knows more than he says."); the client never lists a quest's topics.
- Check: the topic is taught by at least one prop or NPC entry the player can reach before the quest (the reach check of `pnpm quests` extended by one edge: a `teaches` before an `ask`); the NPC answers it (an entry with the `id`); no `ask` topic is in the same NPC's open menu (that would be a quiz).
- Type: `persuasion`. Card: "Three clues for every conclusion" (one clue is a question asked right).

### 3.3 `set` (a collection in one place)

- Fields: `{ kind: 'set', question: Text, place: Id, pieces: [{ item: Id, qty: Int(1, 9) }], full?: Id }`, `place` a map prop, 2 to 6 pieces, `full` a restore applied when the set is full.
- Completes when every piece is placed. The action `{ t: 'place', quest: Id, item: Id, at: Tile }` near the place moves one unit of the item from the bag to `progress[quest].placed[item]` and emits `{ e: 'piece', quest, item, placed, of }`; a placed piece stays placed (a fall takes nothing placed, as a restore stays restored); when the last piece lands, `full` is applied through the restore machinery (`restored`, the `restore` event), so the place changes as a restore does.
- Record: `progress[quest].placed: Record<item, qty>`.
- Journal: `question` until full, then the done line. The client draws the placed pieces on the prop from the record, one sprite per piece from the prop's `pieces[]`, a schema addition on the prop: `pieces?: [{ item: Id, sprite: SpriteRef, dx: Int, dy: Int }]`.
- Check: the place prop exists and has a `pieces` entry per piece item; every piece is obtainable before the quest (the reach check); `full`, when given, is a restore on the same prop.
- Type: `collection`. Card: "A place that heals when its set is full".

### 3.4 `any` (one mystery, many roads)

- Fields: `{ kind: 'any', question: Text, of: [QuestStep] }`, 2 to 4 inner steps, all of different kinds, never an `any` inside an `any`, never a `tend` inside (a vigil is a night, not a road).
- Completes when any inner step is satisfied, by the per-kind rule read on the inner step with the same quest id and the inner index `"<i>.<j>"` for `riddleKey`, so a riddle inside an `any` keeps its own key.
- Record: nothing of its own; the inner kinds keep theirs.
- Journal: `question`, never the list (G3); the done line is the inner step's that was met, so the player sees the road they took.
- Check: the inner kinds differ; at least two inner steps are reachable (the reach check per inner step; one road may be rare, G6's reveal); a `bring` inside is not the only road (G2).
- Type: `investigation`, and any type whose card has many roads. Card: "One mystery, many roads".

### 3.5 `repeat` (an errand, on the quest body)

- Fields on `QuestBody`: `repeat?: { after: 'done', cooldown_days: Int(1, 30) }`, on the game hour: a game day is `day_length_ms` (CR-93, named in the schema's description).
- Offered again when `tick >= progress[quest].doneAt + cooldown_days * day_length_ms`: `offeredTo` gains the clause, `accept` sets `quests[id]` back to `active` and adds one to `progress[quest].times`; the lines are the same every time (G4, and QUEST_FORGE's rule: an errand pays gold and standing alone and never pretends to be new).
- Record: `progress[quest].times: number`, `progress[quest].doneAt: number` (a tick).
- Check: allowed only on type `errand`; the reward holds `rep` and `gold_mg` and nothing else (no item, no recipe, no `opens`: G4); `gold_mg` at most `quest.errand_gold_max_mg` (20,000); the quest requires at least one non-errand quest (an errand exists only after its main beat); a repeat counts no quest point (10.10).
- Type: `errand`. Motivations: wealth, equipment.

### 3.6 Shared steps (a party)

From SETTLEMENT 3.7 and the group lines of 10.10: a quest may name a party; each member meets the quest's gates; the chance counts the members who acted in the current step; each member who finished a step gets its full reward once and never a split; one who leaves keeps the steps paid; a house's building step is never a group quest.
- Fields on `QuestBody`: `party?: { min: Int(2, 6), max: Int(2, 8) }`. On a step: `shared?: true`, allowed on `bring`, `set`, `restore` and, with combat, `hold`.
- What `shared` means in the kernel: the step is still met by the player's own record (their own pieces placed, their own restore, their own bag), so a member can always finish alone, slower and at a lower chance, and no step ever waits on another player's act: no deadlock, no hostage. The party changes one thing, the chance. The action carries `party?: Int(1, 8)`, the number of members who acted in the current step, supplied by the server as an input the client cannot claim (like a draw, R4), 1 in the demo and in a player's own valley; the kernel reads the chance of a shared step's work as `base_bp * min(party, min) / min` (3.7's rule), never above `base_bp`.
- A shared `restore` is the group restore of 10.10: once per town, and the sign names everyone who helped. The world's side (the town's restored list, the names on the sign) is the server's state, not the player's; the kernel marks the player's own `restored` as today, and the server joins the names. Nothing of it is in the kernel but the chance input.
- Where: a party quest binds only outside the opening's area and only on ground of danger level 1 and up (the gate in [QUEST_BINDER.md](QUEST_BINDER.md)); the valley's opening never names a party.
- Check: `party.min <= party.max`; a quest with `party` has at least one `shared` step; a `shared` step is one of the allowed kinds; no `build` step in a party quest; a party quest's places are outside the opening and at danger 1 and up (`pnpm check` reads the map's levels as the hazards do).
- Journal: the question; "with others" only on the offer, never a count of members (F29).

### 3.7 The combat kinds (phase 1b, names reserved)

`defeat { foe: Id, count: Int(1, 20) }` (counted from the foes' `fall` events of an encounter batch), `hold { place: Id, bells: [...] }` (a place kept through a window against waves, the tending shape with foes; `shared` allowed), `escort { npc: Id, from: Id, to: Id }` (an NPC walked between two slots, the stealth shape with a companion). Their fields follow the combat frame's tick (DECISIONS 2026-10-19, G35 is the demo's rule); only the names and `progress[quest].count: Record<string, number>` are reserved here, so the record needs no second shape when they come.

## 4. The player record (additive)

```
progress: Record<QuestId, {
  choice?: 0 | 1;
  asked?: string[];               // "<npc>#<topic>", sorted
  placed?: Record<ItemId, number>;
  times?: number;                 // repeats done
  doneAt?: number;                // the tick of the last hand-in, for the cooldown
  count?: Record<string, number>; // reserved for the combat kinds
}>;
topics: string[];                 // topics learned, sorted
lean: { mender: number; waker: number };
```

`quests` stays as it is; `solved`, `visited`, `restored`, `made` and `journal` stay as they are. A save from before reads the three fields as empty (`{}`, `[]`, `{ mender: 0, waker: 0 }`), the way `own` and `fires` are read today. A fall takes back a quest's outing steps (10.10): for the new kinds, `placed` pieces stay (a placed piece is a world fact, like a restore), `choice` stays (a choice is never undone, G12), and the outing's `asked` entries go back, as the outing's `solved` entries do.

## 5. The actions and events added

Actions: `choose { quest, option, at }`, `ask { npc, topic, at }`, `read { prop, at }`, `place { quest, item, at }`. Every one names the player's tile and is checked by `checkAt` near its NPC or prop; every one is refused in plain words when its facts are missing, and a refusal changes nothing.
Events: `choose`, `ask`, `topic`, `piece`; `quest` and `restore` as today. The client's journal lines per kind go into `game/src/text.ts` beside the eight that exist; a kind with a `question` prints it.

## 6. `questSatisfied` after the grammar

Per step, in order, as today; `bring` sums stay pooled. The new cases: `choose` reads `progress[q].choice !== undefined`; `ask` reads `"<npc>#<topic>"` in `progress[q].asked`; `set` reads every piece at its `qty` in `progress[q].placed`; `any` is true when one inner step's own rule is true (one level, `riddleKey(q, "<i>.<j>")`); `shared` changes nothing here. `offeredTo` gains the repeat clause. On a repeat, `accept` resets nothing of `progress` but `placed` (a set is emptied by its own `full`), so an errand's pieces do not carry over.

## 7. The hand gate and the quest designer

The hand gate (QUEST_FORGE phase 2) reads the quest's `type` only: an `any` with three inner kinds is one quest of one type, a party quest is its type, an errand on cooldown is not open. `tools/src/quests/hand.ts` learns the new kinds' orders in one place: a `set` needs its pieces as a `bring` does, an `ask` needs its topic's teacher, a `choose` needs its gives, an `any` needs the earliest of its roads. The quest designer's three pitches (DECISIONS 2026-10-18) may use every kind here from the day the schema lands.

## 8. The checks (`pnpm check`), one line per rule

In `tools/src/check.ts`, each printing `! <quest id>: <what> (<rule>)`:
1. a `choose` has two options, two NPCs, gives within the spread, leans that differ (G12);
2. an `ask` topic is taught before the quest and answered by the NPC, and is not in the NPC's open menu (G19, G23);
3. a `set` has a place with a `pieces` entry per item, pieces obtainable before the quest, and `full` on the same prop;
4. an `any` has 2 to 4 inner steps of different kinds, no `any` and no `tend` inside, and two reachable roads (G2, G6);
5. a `repeat` sits only on an `errand` with gold and rep alone, under the gold cap, requiring a non-errand (G4);
6. a `party` quest has a `shared` step of an allowed kind, no `build`, outside the opening, at danger 1 and up;
7. the type palette is served: a `dilemma` has a `choose`, a `persuasion` an `ask`, a `collection` a `set`, an `errand` a `repeat`; the reverse is not required (a `choose` may sit in an `investigation`).

## 9. The content of phase 1a

One quest per new kind in the valley, each from a card: a `dilemma` from "Two patrons" (Maru and Pell want the same found thing), a `persuasion` from "Three clues" (a topic read on the arch and asked of Pell), a `collection` from "A place that heals when its set is full" (a shrine by the bridge), an `investigation` with an `any` from "One mystery, many roads". Each with `talk` boxes in the giver's voice under STORY S1-S6, every past claim with a speaker, every line under two lines. The party kind ships no content in 1a (no land at danger 1 exists until the ring); its schema and checks land, and its first quest is the ring's.

## 10. Order and the measurable lines

1. `feat/quest-grammar-schema`: the schema alone (the four kinds, `repeat`, `party`, `shared`, the topic `id` and `teaches`, the prop's `pieces`), `pnpm schemas`, the schema tests, nothing in the kernel. Measurable: `pnpm verify` green, every existing file valid and unchanged, `FORMAT_VERSION` 1.
2. `feat/quest-grammar`: the kernel (`step.ts`, `state.ts`, `KERNEL_VERSION` up one minor), the checks, the hand, the client's boxes and journal lines, the four quests, the tests in `kernel/test/grammar.test.ts` (each kind completes on its event and on nothing else; a replay agrees; `choose` writes the lean and refuses a missing give; `ask` refuses a topic not learned and accepts it after `read`; `set` emits a `piece` per placement and applies `full` on the last; `any` closes on the first road and keeps a riddle's key; a repeat is offered again only after the cooldown and counts no point; a `shared` step's chance follows `party`), and `game/e2e/grammar.ts` (the four quests complete). Measurable: `pnpm quests` "Never asked" lists only `errand` and the combat types; `pnpm verify` and the opening e2e green; the opening's quests untouched byte for byte.
3. Phase 1b when the combat frame is decided.

## 11. What the binder needs from the grammar

The holes a storylet leaves and the field each fills: `giver` (the body); `to` in `choose` (two NPCs with different wants); `npc` and `topic` in `ask` (an NPC that answers and a prop that teaches, both in the land); `place` and `pieces` in `set` (a prop with the role and items of a class the land has); `item` in `bring` and `find`; `recipe` in `make`; `restore` in `restore` and in `full`; `slot` in `visit`; `fire` in `tend`; `of` in `any` (the inner holes); `party` (only in a land at danger 1 and up). A storylet names the kind and the constraints, the binder fills the ids, and the checks above run on the result as on any quest. Nothing in the grammar knows whether a quest was written by hand or bound.

## 12. What is not done here

No model writes a step; no kind completes on time alone; no kind reads another player's state; no combat field beyond a name; no third shape of a quest record.
