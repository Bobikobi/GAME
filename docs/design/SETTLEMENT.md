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
- Lapse (question S1): when no step is finished for `build_hold_days`, the plot returns to `free`, and the holder gets back `build_refund_pct` of the price and of each delivered item, rounded down as a craft miss is, through the ledger with the reason `refund`.
- A finished house stays with its owner (question S1).

### 3.3 Supply

- A town gains plots only by work, never by date (G42): a mended street opens its houses, and a group quest at the edge of town (fell the trees, clear the stones, level the ground) turns its tiles into new plots for good.
- A full town is a signal, not a wall: the clearing quest, or the next town, answers it.

### 3.4 A home without a house

- The town is safe at every hour, so a player without a house sleeps on the street: safe, with none of what a house gives.
- What a house gives (a reading): storage beyond the bag, a full night's rest where the street gives part of it, a home station, and from stage 4 a window for selling to other players.
- The camp: question S2.

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

## 4. Where these meet the rules already written

| Rule already written | What meets it | Proposal |
|---|---|---|
| G28: the valley waits; no timer runs out while the player sleeps | A held plot lapses while its holder is away | S1: only in a shared town, a long hold between steps, a full refund |
| Pillar 5: effort is never wasted | A lapse loses the building's progress | S1: the price and the materials come back; the quests already paid their rewards |
| 8.10: the camp is safe at every hour | "Outside the town is more dangerous"; the street | S2 |
| 6.10 (kernel review 7.2, D6): the world stays cooperative until there is a community | First come for plots; rival groups later | S4 |
| G42: rare is capacity and gates, never a timer | Places open gradually | Read as: by work (mending, clearing quests), never by date |
| The ruins as the community's slots | Houses in the town's existing buildings | Read as: two kinds of place; a slot stays a public place, a plot is a home |
| 9.10: no difficulty word or number on screen | An internal difficulty rating | Consistent: the rating is internal, and the world shows it |
| 9.10: war, theft and robbery stay out | A rival group attacks a fort | Consistent: only with combat, both sides signed up, nothing taken from a player who is away |
| Spec stage 4: houses and rent | Places bought with gold | Read as: a plot is bought once; letting a house to another player stays a stage-4 item |
| Stages 2a and 3: each player in their own world | Scarce plots in a shared town | Read as: the own valley stays the player's; scarcity starts with the shared world |

## 5. Open questions, in the order they are asked

**S1. Absence in a shared town.** A held plot that lapses while its holder sleeps is the timer G28 forbids, and a lapse throws away progress (pillar 5). Recommended: the lapse exists only in a shared town, as a stated exception to G28 for scarce shared places. The hold counts the days between two finished steps (14 to start). A lapse returns the full price and every delivered item, so only the place is lost. A finished house is never taken for absence, and scarcity is answered by the plots that work opens (3.3).

**S2. The camp and the street.** Today the camp is safe at every hour and holds a chest: it is already the home of a player without a house. Recommended: safety comes from the town or from a burning fire. The town is safe at every hour. Outside it a camp is safe only while its fire burns, and keeping it burning through a night is the task (the owner's campfire idea becomes the rule). Deeper areas eat more wood, and an area of level 0 needs almost none, so the camp of the opening stays as it is today. The street is the free and safe place in town; a house adds storage, a full rest and a window to sell from.

**S3. The internal difficulty scale.** Recommended: yes, one internal scale for areas, quests and recipes. Each step multiplies effort and danger by a fixed ratio (1.5 to start), while the hazards' frequency grows by one step per level. It never shows on screen.

**S4. Cooperative or competitive.** The 6.10 decision kept the world cooperative and put ownership and conquest back on the table only when there is a community; first come for plots and rival groups bring competition in. Recommended: competition only for places, and with combat, contests that both sides sign up for; a safe core where nothing can be taken. Reserve now, while each is one schema field, what the kernel review listed in 7.2: a controller on places, an area's danger and protection level, ledger reasons for price, refund and upkeep, and an upkeep that grows with holdings.

## 6. What can come before the shared world

The parts that need no shared world can be built once their question is answered: danger by area and the internal scale (S3), the camp's fire (S2), group quests tried alone, and the town the player mends as the settlement, with houses that every player can build in their own valley. Plots, the race, the hold and the street wait for stage 4.
