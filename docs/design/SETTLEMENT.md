# The settlement: towns, houses, danger by area and group quests

Status: a plan, nothing built. It turns the owner's words of 9.10 (DECISIONS.md, the entries of that evening on open product direction) into rules a kernel can hold, says where they meet the rules already written, and lists what is still open. Each open point is a question for the owner, asked one at a time; an answer lands in DECISIONS.md and then here.

## 1. What the owner said (9.10)

- The settlement starts as the town the player mends.
- When players share a world, not every player can build the same thing. Players settle the town's existing buildings, and whoever comes first with the resources starts building. A house is a chain of quests and resources; each finished quest moves it on.
- A builder has a time limit. Missing it loses the process, frees the place for another player, and pays a refund by the game's rules. The world keeps room for players to build.
- A town can run short. Its places open for sale gradually, perhaps through group quests too (clearing trees at the edge of town).
- A player without a property lives on the street, since outside the town is more dangerous: danger by area, more common where the area's level is higher. Is an internal difficulty rating needed, and should it be exponential?
- Guarding a settlement is a quest players choose. A group quest is made for a group: alone, the chance is low. Later the valley's characters may join a group, only those fit for it (by default none) and at a fitting level; one below it falls and goes home.
- With combat, later: a group holds a town or a fort, and a rival group signs up to attack it.
- On absence (question S1): yes to a hold only in a shared town and to a clock between steps, but absence has a price. A builder who is slow between steps needs a rule, so does an owner who has not played for weeks, and a player about to lose a place hears of it by mail first. Registration is minimal and comes after the opening.
- On what absence costs (question S1b): as recommended. A building with no finished step for 14 days returns to the town, the house of an owner who has not played for 45 days is packed, and one mail comes first. Absence costs the place and a fifth of its price, never what the player made.
- On the camp (question S2): as recommended, and a camp outside the town is a tent the player buys first; to get through the night safely the player needs enough wood for it. Wood comes from felling trees, never from piles of twigs (DECISIONS.md, the entry on wood).

## 2. What exists today and stays

- The town and the camp are safe at every hour. The hazards that hunt act after dark or inside the mist, outside them; a night's sleep gives health back; a fall sends the player to the last town and loses the outing's finds (DECISIONS.md 8.10, rules G30 to G35).
- The camp is a fixed place on the map with a fire and a chest, and the crafting waves add a workshop. The opening's first fire starts it.
- A place opens when it is mended: the bridge is a restore step.
- The map holds 18 slots for the community: a slot is a ruin until someone restores it (`GAP_WOW_RS.md`, section 2).
- A profession's level comes from active seconds, at thresholds that grow about one and a half to three times per level (foraging: 2, 60, 180, 400, 800, 1500, 2600 and 4000 seconds).
- Every item has a value in milliseconds of a reference player's effort, and the crafting core takes chance off for each level a recipe stands above the player.
- Gold leaves the world through the ledger, and the crafting economy entry of 9.10 names the settlement as its main sink.

## 3. The rules, as a kernel would hold them (draft)

### 3.1 Two kinds of world, one rule set

- In the player's own valley (today, and at stages 2a and 3, where each player has a world of their own), every place is the player's: no race, no hold, no lapse. The town the player mends is the settlement.
- In a shared town (from stage 4, when players share a world state) places are scarce, and 3.2 to 3.4 apply.

### 3.2 Plots and houses

- A town lists its plots: places in existing buildings that can each hold one house. A plot is `free`, `building` (holder, the time of the last finished step, the steps done) or `built` (owner).
- Claiming: the first player whose first step on a free plot the server accepts holds it. The first step pays the plot's price in gold, which is burned, and makes the first delivery.
- One plot in `building` per player at a time, and one house per player to start (a reading; a later stage may allow more, with an upkeep that grows with the number held).
- Building is an ordered chain of steps. A step is a delivery to the plot or a quest from the palette (gather, find, riddle, tend and the rest). A finished step changes what stands on the plot: a frame, walls, a roof, a door. The builder leaves between steps, and nothing on the plot decays while it is held.
- Lapse: when no step is finished for `build_hold_days` (14 to start), the plot returns to `free`. The clock runs whether the builder is away or plays without building, so a slow builder and an absent one meet the same rule (S1). The builder gets back every delivered item and `plot_refund_permille` of the price (800, S1b) through the ledger with the reason `refund`; the rest of the price stays burned. The quests of the finished steps keep the rewards they paid.
- A step fits in the hold (a reading): the checker refuses a step whose value is above `step_value_max_ms`, two hours of the reference player's effort to start, so a lapse comes from the builder's pace and never from the chain.
- Packing (S1b): when an owner has not played for `house_absent_days` (45), the house is packed. The plot returns to `free` with `plot_refund_permille` of its price; the house and everything in it stay the owner's, and the owner raises it again on any free plot by paying that plot's price, with no step to redo.
- A lapse or a packing is announced first, `notice_days` before (3 for a building, 7 for a house; 3.8), and a player who comes back is told on screen what happened while away.

### 3.3 Supply

- A town gains plots only by work, never by date (G42): a mended street opens its houses, and a group quest at the edge of town (fell the trees, clear the stones, level the ground) turns its tiles into new plots for good.
- A full town is a signal, not a wall: the clearing quest, or the next town, answers it.

### 3.4 A home without a house

- The town is safe at every hour, so a player without a house sleeps on the street: safe, and a night's sleep there gives health back as a night at camp does (question S2). A newcomer without a house is not punished for it.
- What a house gives (a reading): storage and a home station inside the safe town, where the camp's chest and workshop stand outside it, and from stage 4 a window for selling to other players.
- The camp (S2, answered 9.10): a camp is safe while its fire burns. A night costs `wood_per_night` times the area's danger level `d` in wood, put on the fire before dark or through the night, and none at `d` 0: the opening's camp stands there, keeps its chest and workshop, and plays as today.
- A camp anywhere else outside the town is a tent. The player buys it at the stall, pitches it on a free tile outside the town and off the paths, and packs it to move it. Readings: one tent stands at a time; it holds a fire and a bed, not the chest; it never wears out; and no tent burns less wood than another, since the owner ruled out gear against hazards.
- The fire matters only while the player is there at night: away, nothing happens to the camp or its chest. Its level shows, and G31's warning comes before it goes out.
- In a shared world each player's camp stays the player's own (a reading): it takes no plot, and no other player enters it. Every area outside a town is above level 0 there, so every camp costs wood and the street stays the free place to sleep.

### 3.5 Danger by area

- Every area of the map carries a danger level `d`, from 0 in the town upward, set in the content and checked by the checker against the area's distance from town and the levels its nodes ask.
- The hunting hazards keep their hours (after dark, inside the mist, outside safe places). In an area of level `d`, the chance that one shows in a minute of night is `hazard_bp * d`, so they are more common the deeper the area; the health one takes is `hazard_hp` times `difficulty_ratio` to the power `d` (question S3).
- The screen never shows `d` as a word or a number (the crafting economy entry of 9.10). The world shows it: thicker mist, tracks, bones, a sign at the area's edge.

### 3.6 One internal difficulty scale (question S3)

- One integer scale for areas (`d`), quests (the sum of their steps' difficulty, as the spec computes it) and recipes (their level). A player's level against the rating sets the chance: one step above is a stretch, two are very hard, three are close to impossible, for reasons the world shows.
- Each step multiplies effort and danger by one `difficulty_ratio_permille` (1500 to start). The level thresholds already grow about that way.

### 3.7 Group quests

- A quest may name a party, `party: { min, max }`. A player may try it alone or short-handed; the chance then falls with each missing member, since the quest is made for a group (for example `base_bp * members / min`).
- Later, the valley's characters may fill a party. A character joins only when its content carries `companion: { level }`; by default none does. A companion below the quest's level falls by the fall rule of 8.10, goes back to where it lives, and is there again the next day.
- Guarding a town or a fort is a quest players choose. Nothing decays and nothing is lost when nobody takes it (G28).
- With combat (stage 8 or a vote): a group may take a quest to hold a place, and a rival group may sign up to contest it. Both sides sign up, and nothing is taken from a player who is away.

### 3.8 Notices and the account

- Registration is minimal and comes after the opening (the owner, 9.10). Read as: an email address and the name the world shows, asked when the opening ends and never before play. Accounts begin at stage 2a; the stage-1 demo has none.
- The game mails a player only when something the player holds in a shared town is about to return to the town: one mail per hold, `notice_days` before its end (3 for a building and 7 for a house, to start). The mail names what returns, what stays with the player, and the date.
- A mail never asks the player back for anything else, never offers a reward and is never repeated. A player may turn the mails off; the screen then tells alone.

## 4. Where these meet the rules already written

| Rule already written | What meets it | Proposal |
|---|---|---|
| G28: the valley waits; an absence is never punished | A held plot lapses, and a long-absent owner's house is packed | Answered (S1, S1b): a written exception for scarce shared places only, now in G28's own text. Absence costs the place and a fifth of its price, never what the player made |
| G28: no "last chance"; the drives of loss and avoidance it refuses | A mail before a place returns to the town | Read as: a notice of a real date for a real place, once per hold; it sells nothing and offers nothing |
| Pillar 5: effort is never wasted | A lapse loses the building's progress | Answered (S1b): every delivered item comes back, the finished steps' quests keep their rewards, and a finished house is packed, never destroyed |
| G30 (8.10): the town and the camp are safe at every hour, and a night's sleep at camp gives health back | "Outside the town is more dangerous", and the camp stands outside the town; the street | Answered (S2): the town stays safe and its street heals as the camp does; a camp outside the town is a tent, safe while its fire burns. G30 and G32 now say so |
| 6.10 (kernel review 7.2, D6): the world stays cooperative until there is a community | First come for plots; rival groups later | S4 |
| G42: rare is capacity and gates, never a timer | Places open gradually | Read as: by work (mending, clearing quests), never by date |
| The ruins as the community's slots | Houses in the town's existing buildings | Read as: two kinds of place; a slot stays a public place, a plot is a home |
| 9.10: no difficulty word or number on screen | An internal difficulty rating | Consistent: the rating is internal, and the world shows it |
| 9.10: war, theft and robbery stay out | A rival group attacks a fort | Consistent: only with combat, both sides signed up, nothing taken from a player who is away |
| Spec stage 4: houses and rent | Places bought with gold | Read as: a plot is bought once; letting a house to another player stays a stage-4 item |
| Stages 2a and 3: each player in their own world | Scarce plots in a shared town | Read as: the own valley stays the player's; scarcity starts with the shared world |
| 6.10 (kernel review, D3): nothing carries from the stage-1 demo into an account | Registration after the opening | Consistent: accounts begin at stage 2a and the demo keeps none. How the opening played before registering moves into the new account belongs to stage 2a's design (server-decided saves) |

## 5. Open questions, in the order they are asked

**S1. Absence in a shared town.** A held plot that lapses while its holder sleeps is the timer G28 forbids, and a lapse throws away progress (pillar 5). Answered in part (9.10): yes to a hold only in a shared town, as a written exception to G28, counted between steps, with scarcity answered by the plots that work opens (3.3). But absence has a price: a slow builder needs a rule, so does an owner who has not played for weeks, and a mail comes first (3.2, 3.8).

**S1b. What absence costs.** Answered 9.10, as recommended: a building with no finished step for 14 days returns to the town with every delivered item and 80% of the plot's price. A house whose owner has not played for 45 days is packed: its plot returns with the same 80%, and the house and its contents stay the owner's, to raise again on any free plot without redoing a step. One mail comes before each, 3 days before for a building and 7 for a house. Absence then costs the place and a fifth of its price, never what the player made. Final Fantasy XIV frees a house plot after 45 days without a visit by its owner and refunds 80% of the plot's price, but it tears the house down.

**S2. The camp and the street.** Answered 9.10, as recommended: the town stays safe at every hour and its street heals as the camp does; outside it a camp is safe while its fire burns, at `wood_per_night` times `d` a night and none at level 0. The owner added that a camp outside the town is a tent the player buys first, and that the player needs wood enough for the night (3.4).

**S3. The internal difficulty scale.** Recommended: yes, one internal scale for areas, quests and recipes. Each step multiplies effort and danger by a fixed ratio (1.5 to start), while the hazards' frequency grows by one step per level. It never shows on screen.

**S4. Cooperative or competitive.** The 6.10 decision kept the world cooperative and put ownership and conquest back on the table only when there is a community; first come for plots and rival groups bring competition in. Recommended: competition only for places, and with combat, contests that both sides sign up for; a safe core where nothing can be taken. Reserve now, while each is one schema field, what the kernel review listed in 7.2: a controller on places, an area's danger and protection level, ledger reasons for price, refund and upkeep, and an upkeep that grows with holdings.

**S5. Who gets a plot that work opens.** First come at the moment a plot opens favours whoever is online then, and a script most of all. Recommended: the players of the clearing quest that opened it claim first, for 3 days; then first come.

## 6. What can come before the shared world

The parts that need no shared world can be built once their question is answered: danger by area and the internal scale (S3), the camp's fire and the tent (S2), group quests tried alone, and the town the player mends as the settlement, with houses that every player can build in their own valley. Plots, the race, the hold and the street wait for stage 4.
