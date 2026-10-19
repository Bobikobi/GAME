# The binder: seed plus land in, quests out

Status: the design page of [QUEST_FORGE.md](QUEST_FORGE.md) phase 5, written 19.10.2026 from the frame in its section 4. Nothing here is built. It needs phase 3 (the land graph) and phase 4 (the library) in the content and [QUEST_GRAMMAR.md](QUEST_GRAMMAR.md) in the kernel; the gates of phase 6 are named here where the binder calls them and designed there. QUEST_FORGE.md is in pull request #220; until it lands, its section 2 table names the links this page fills.

Read with it: QUEST_FORGE sections 2, 3 and 4 (phases 3 to 6), `kernel/src/rng.ts` (`draw`, `drawBasisPoints`), `tools/src/assemble.ts` and `tools/src/load.ts` (how content loads), `tools/src/quests/hand.ts`, `tools/src/check.ts`, [NEXT.md](../team/NEXT.md) 19 g (the ring's checks), [QUEST_PATTERNS.md](QUEST_PATTERNS.md) section 1 (ranks 3 and 5).

## 1. In and out

In: a land id; the world seed; the library (`content/core/storylets/*.json`) minus `retired.json`, weighted by `weights.json` when present (phase 9); the land's graph (the land file, its NPCs with wants, its places with roles, its items); the land's gold quests, hand-made under the land's own folder.
Out, under `content/generated/<land>/`: `quests/<storylet>-<n>.json`, one quest file per bound storylet with the id `gen/<land>/<storylet>-<n>`; `CHART.md`, the dependency chart; `bind.lock.json` (section 8); and one line per hole in the command's output.

## 2. One stream, no clock

Every choice the binder makes is one draw of the kernel's own function, `draw(seed, 'forge/<land>/<purpose>', counter)` (`kernel/src/rng.ts`), the purpose one of `order`, `tie`, `role/<role>` and `link`, the counter that purpose's own count. No `Math.random`, no wall clock, no map iteration order: candidates are sorted by id before a draw picks among them, keys are written sorted, every file ends with one newline, and the write order is the sorted quest id. So a bind is byte-identical on two machines, in two orders of lands, and after an unrelated storylet is added: a draw keyed on the land and the purpose never moves when the library grows (the kernel review's K2).

## 3. The budget (`params.json`, under `forge`; none is a time)

| Parameter | Start | What |
|---|---|---|
| `forge.quests_min` | 12 | fewer is a hole line, not a failure |
| `forge.quests_max` | 20 | the pick stops here |
| `forge.types_min` | 8 | fewer is a hole line |
| `forge.errands_max` | 3 | errands, bound last |
| `forge.party_max` | 2 | party quests per land, only at danger 1 and up |
| `forge.attempts_max` | 200 | binds tried, failed ones included |
| `forge.pair_distance` | 2 | a giver-and-place pair may not repeat within this many lands of the chart (the uniqueness gate) |

## 4. The pick

1. The type order: the palette (`QUEST_TYPES` minus the combat types until phase 1b, `errand` last), shuffled by draws (`order`).
2. Rounds: while the land holds fewer than `quests_max` and the attempts are under `attempts_max`, walk the types in that order; for each type the candidates are the library's storylets of that type, not retired, whose land constraints the land meets (its `lacks`, `argues` and `values` tags), sorted by id.
3. The weight of a candidate is `freshness * play`, where `freshness = 1 / (1 + n)` for a storylet already bound in `n` lands (`bindings.json`, section 7) and `play` is the weights file's value, or 1 without it. The highest weight is tried first; a tie breaks by a draw (`tie`).
4. A candidate is bound (section 5) and the per-quest gates run on it (section 6); on failure the next candidate is tried and the attempt is counted; a type with no candidate left leaves one `!` hole line, and the round goes on.
5. The requires links: a storylet's `requires_role` names a type; the binder links it to the earliest bound quest of that type in this land; when none is bound yet, the storylet waits for a later round; when none is bound at the end, the link is dropped and the hole line says so. Tense and calm alternate along the links (QUEST_PATTERNS rank 5): a `tense` storylet may require only a calm quest and a calm one only a tense one; a candidate that breaks the rhythm is skipped, not failed.
6. Errands: after the rounds, up to `errands_max` storylets with `repeat`, each linked to a bound non-errand of the type it names.
7. Party quests: up to `party_max`, only when the land's danger floor is 1 or more and the place bound is outside every opening area; otherwise the candidates are skipped before the pick.

## 5. The bind

For each role of the storylet, in the storylet's role order:
- `giver`: an NPC of the land with the want the role asks for, not already a giver twice in this land; `second`: an NPC other than the giver, by its constraint.
- `place`: a prop or slot with the role asked for (`hearth`, `store`, `ruin`, `water`, `high`, `hidden`, `crossing`, `grave`, `workshop`, `wild`), on foot from the land's town within the pay gap of G62 (the ring's BFS, NEXT 19 g).
- `object`: an item of the class or kind asked for that the land gives (a node, a dig spot, a recipe its NPCs teach, a shop), never an opening item.
- `topic` (for `ask`): a prop with `teaches` in the land and an NPC that answers it; the binder may write the `teaches` into a bound prop's note from the storylet's fallback note line, so a persuasion storylet binds in a land with no topics yet.
- `pieces` (for `set`): items of the class, each obtainable in the land.
- The candidates of a role are sorted by id and one is picked by a draw (`role/<role>`); a role with no candidate fails the bind.
- Refused: a giver-and-place pair already used in this land; an identical binding (storylet, giver, place) in any land of `bindings.json`; a bound place inside the opening's area; a role bound to the same NPC twice in one storylet.
The quest's lines are the storylet's fallbacks with `{giver}`, `{place}`, `{object}`, `{second}` and `{speaker}` filled from the bindings (a `{speaker}` hole is filled by the NPC or the prop with a sheet, S2); the `summary` is the storylet's question; `talk.offer`, `waiting` and `done` and one `remark` on the giver, each under two lines.

## 6. The gates, when they run

Per quest, at bind time (cheap, in `tools/src/forge/gates.ts`): the schema; the G rules as `pnpm check` runs them (called, never copied); uniqueness (section 5); the opening untouchable; the reward changes what the player can do unless the quest is an errand (G4); the words filter on every line. A failed quest is unbound and its storylet moves on.
Per land, after the rounds: the hand (one open per type, the kernel gate, the bounded enumeration of `hand.ts`); reach (every bound place on foot within the pay gap); pillar 1 along every quest's legs (NEXT 19 g's walk check); speakers (every past claim has a `{speaker}` filled). A failed land gate names one quest; that quest is unbound, its type is re-picked for one more attempt, and the land gates run again; at `attempts_max` the bind stops with what passed and one hole line per type under its floor.

## 7. The write and the chart

- A quest file: the `QuestBody` of the grammar plus a `bound` block, `{ storylet, shape, land, roles: { giver, place, object, second?, topic?, pieces? }, voiced?: true }`. The block is content the gates and the digest read; the kernel ignores it (the schema allows it, additive).
- `CHART.md`: the requires chart of the land as a list, each quest with its type, storylet, giver, place and the quests it requires; tense quests marked; the hole lines at the end.
- `content/generated/bindings.json`: one row per bound quest across lands (`land`, `storylet`, `giver`, `place`, `hash`), sorted, rewritten on every bind; the freshness and the uniqueness read it.
- A voiced line (phase 7) is kept on a rebind when the quest's binding hash is unchanged; a changed binding drops the voiced line to the fallback.

## 8. Determinism held by CI

`bind.lock.json` per land holds the digests of the inputs (the library's files, the land's graph, the `forge` params, `retired.json`, `weights.json`) and of the output. `pnpm forge bind --all --verify` rebinds every land into a temporary folder and compares byte for byte with the committed files; a difference fails CI with the land, the first file that differs and which input digest changed, so the message is "the library changed: rebind and commit", never a mystery. Nobody edits a bound quest by hand; the fix goes into the storylet or the graph, and the land is bound again (QUEST_FORGE section 3).

## 9. The command

- `pnpm forge bind <land>` binds one land and writes it; `--all` every land with a land file; `--verify` compares and writes nothing; `--dry` prints the chart and the holes and writes nothing.
- `pnpm forge why <quest id>` prints the draws, the candidates of each role and the gates' answers that led to that binding, from the lock's digests and a rebind in memory, so a strange quest is explained in one command.
- `pnpm forge chart <land>` prints `CHART.md` to the terminal.
- `pnpm forge digest` is phase 8's; `pnpm forge voice` is phase 7's.

## 10. Tests (`tools/test/forge.test.ts`, a fixture land and a fixture library)

- Two runs give identical bytes; two orders of `--all` give identical bytes; adding an unrelated storylet of a type the land does not use changes nothing.
- The budgets: a library of one type binds one quest and prints the types hole; a land with eleven storylets of eight types binds between the floors.
- The refusals: a repeated pair, a cross-land identical binding, a place inside the opening, a party storylet in a land at danger 0.
- The freshness order: a storylet bound in two lands loses to a fresh one of the same type.
- A gate failure (a fixture gate that refuses a quest) unbinds it, and the type is re-picked.
- `why` prints the draws that a second rebind reproduces.
- `--verify` fails on a hand-edited bound file with the right message.

## 11. Numbers before the plan is trusted (QUEST_FORGE section 6)

A library of 42 binds the valley plus the first ring without a hole; a second land shows repeats within three lands; a bind runs under 10 seconds at 200 attempts on the builder's machine. Each is a target the first run answers with yes or no.

## 12. What is not done here

No model in the bind; no run-time binding; no hand edit of a bound file; no per-land approval; no storylet text from another game; no party quest in the opening or at danger 0.
