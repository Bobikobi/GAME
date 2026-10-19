# The settlement: towns, houses, danger by area and group quests

Status: a plan, nothing built. It turns the owner's words of 9.10 (DECISIONS.md, the entries of that evening on open product direction) into rules a kernel can hold, says where they meet the rules already written, and lists what is still open. Each open point is a question for the owner, asked one at a time; an answer lands in DECISIONS.md and then here.

Paused since 10.10: player houses, plots and their draws (3.2, 3.3, what a house gives in 3.4, the mails of 3.8, and S1, S1b and S5) are paused on the owner's word (DECISIONS.md, the entry on houses and plots paused). They stay here as the record of what was answered, not as a plan: nothing in them is built, and the town serves the player through its buildings, each with one job, until they come back. The town, the street, the camp, the one store, danger by area, the scale, group quests and the areas between players stand.

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
- On the camp (question S2): as recommended, and a camp outside the town is a tent the player buys first; to get through the night safely the player needs enough wood for it. Wood comes from felling trees, never from piles of twigs (DECISIONS.md, the entry on wood). Superseded in part on 19.10: there is no tent, and a fire the player builds anywhere outside the town is the camp (3.4; DECISIONS.md, the entry on a fire anywhere).
- On the internal difficulty scale (question S3): as recommended. One internal scale, each step asking half again as much, and never on screen.
- On cooperation and competition (question S4): as recommended, and later there will be dangerous areas outside the towns where players face each other. Every form of upkeep offered was rejected.
- On a plot that work opens (question S5): whoever signed up for the clearing and took part enters a draw. How it weighs may depend on the size of the area and the number of places, and the one who worked hardest may come first; the game does not turn only on buildings now, so the rest can wait.

## 2. What exists today and stays

- A safe place is the town, any ground at danger level 0 (the opening's camp stands on it) and a camp whose fire burns (3.4; another player's only for a guest with a deal): nothing hunts there and no player harms another. The hazards that hunt act after dark or inside the mist, outside safe places; a night's sleep gives health back; a fall sends the player to the last town and loses the outing's finds (DECISIONS.md 8.10 and 10.10, rules G30 to G35).
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
- Every count of days in this plan (`build_hold_days`, `house_absent_days`, `notice_days`, `plot_signup_days`, `hold_max_days`) runs on the real calendar, by the server's clock, and the time of a building's last finished step is kept as a real date. The valley's own game days never count toward them (DECISIONS.md, the entry on the game read as one line, 10.10).

### 3.2 Plots and houses (paused 10.10)

- A town lists its plots: places in existing buildings that can each hold one house. A plot is `free`, `building` (holder, the time of the last finished step, the steps done) or `built` (owner).
- Claiming: a free plot opens for sign-up for `plot_signup_days` (3), then is drawn among those who signed up, past `new_account_hold`, one entry per account; with no sign-up it goes to the first who signs up (DECISIONS.md, the entry on the shared world, 10.10, like Final Fantasy XIV's housing lottery). The winner's first step pays the plot's price in gold, which is burned, and makes the first delivery; a winner who makes none within `plot_signup_days` loses it to a new draw. An owner of a packed house enters the draw like anyone, and the new plots of a clearing keep their own draw (S5).
- One plot in `building` per player at a time, and one house per player to start (a reading; a later stage may allow more, without upkeep, S4).
- Building is an ordered chain of steps. A step is a delivery to the plot or a quest from the palette (gather, find, riddle, tend and the rest). A finished step changes what stands on the plot: a frame, walls, a roof, a door. The builder leaves between steps, and nothing on the plot decays while it is held.
- Lapse: when no step is finished for `build_hold_days` (14 to start), the plot returns to `free`. The clock runs whether the builder is away or plays without building, so a slow builder and an absent one meet the same rule (S1). This clock and the clock of packing stop only while the account is held for review or blocked (DECISIONS.md, the entry on the shared world, 10.10). The builder gets back every delivered item and `plot_refund_permille` of the price (800, S1b) through the ledger with the reason `refund`; the rest of the price stays burned. The quests of the finished steps keep the rewards they paid.
- A step fits in the hold (a reading): the checker refuses a step whose value is above `step_value_max_ms`, two hours of the reference player's effort to start, so a lapse comes from the builder's pace and never from the chain.
- Packing (S1b): when an owner has not played for `house_absent_days` (45), the house is packed. The plot returns to `free` with `plot_refund_permille` of its price; the house and everything in it stay the owner's, and the owner raises it again on a plot they win (the draw above, or the first sign-up when nobody signs up), as that plot's first step: it pays that plot's price, and no step is redone (10.10).
- A lapse or a packing is announced first, `notice_days` before (3 for a building, 7 for a house; 3.8), and a player who comes back is told on screen what happened while away.

### 3.3 Supply (paused 10.10)

- A town gains plots only by work, never by date (G42): a mended street opens its houses, and a group quest at the edge of town (fell the trees, clear the stones, level the ground) turns its tiles into new plots for good.
- A full town is a signal, not a wall: the clearing quest, or the next town, answers it.
- A plot that work opens is drawn among those who did the work (S5, answered in part 9.10). A clearing quest names the plots it opens, and a participant is a player who signed up and finished at least one of its steps. The draw is the server's and gives each participant one plot at most, under the rule of one plot in `building` and one house per player. A plot won is held as a claimed one: its first step pays its price and comes within `plot_signup_days`, as for a freed plot (3.2), and after it the plot holds `build_hold_days` between steps; a plot that lapses either way is drawn again, among the participants first (10.10). Open until the shared town is designed: whether the chance grows with the share of the work, and how the draw follows the size of the area and the number of places.

### 3.4 A home without a house

- The town is safe at every hour, so a player without a house sleeps on the street: safe, and a night's sleep there gives health back as a night at camp does (question S2). A newcomer without a house is not punished for it.
- What a house gives (a reading, paused with houses since 10.10): storage and a home station inside the safe town, where the camp's chest and workshop stand outside it, and from stage 4 a window for selling to other players.
- One store (10.10): the camp's chest and a house's storage are one store, tied to no plot. It opens at any of its chests: the opening's camp's and one in each town (and a house's, if houses come back); a fire of one's own has none. Returns go there and may run over its size, and nothing is dropped. A player sells offline from the town's market board (DECISIONS.md, the entry on the shared world).
- The camp (S2, answered 9.10): a camp is safe while its fire burns. A night costs `wood_per_night` times the area's danger level `d` in wood, put on the fire before dark or through the night, and none at `d` 0: the opening's camp stands there, keeps its chest and workshop, and plays as today.
- A camp anywhere else outside the town is a fire the player builds (the owner, 19.10; until then a tent the player bought and pitched). It is built from wood on a free tile outside the town, off the slots, and is a safe place while it burns. It is never lit during a chase or inside a predator's round, so a fire is a stay the player plans, never a way out of a hunt (G34). Readings: one fire of one's own stands at a time, and a new one puts the old out; it holds no chest and no bed; nothing bought or made burns less wood (G48), since the owner ruled out gear against hazards.
- The fire matters only while the player is there: by day it burns for nothing and the camp is safe while it burns, at night it eats wood; away, nothing happens to the camp or its chest. Its level shows as a flame that dims, never as a number, and G31's warning comes before it goes out.
- In a shared world each player's camp stays the player's own: it takes no plot, and another player stays at it only as a guest, at the price its owner sets and with its owner's approval. A guest with a deal is safe and rests there while its fire burns; without a deal another player's camp is no safe place. The camp reaches `fire_light_tiles` around its fire (DECISIONS.md, the owner's answers of 10.10 afternoon and the entry on the five holes). Every area outside a town is above level 0 there, except the opening's ground, which stays at level 0 as the town's edge, and the night ruins' entrance, which stays at level 0 too: no wood is burned and no fire of one's own is built on either. So every camp beyond the opening's costs wood, and the street stays free to sleep on (10.10).

### 3.5 Danger by area

- Every area of the map carries a danger level `d`, from 0 in the town upward, set in the content and checked by the checker against the area's distance from town and the levels its nodes ask.
- The hunting hazards keep their hours (after dark, inside the mist, outside safe places). In an area of level `d`, the chance that one shows in a game minute after dark or inside the mist is `hazard_bp * d`, so they are more common the deeper the area and none shows at level 0; the health one takes is `hazard_hp` times `difficulty_ratio` to the power `d` (S3, answered 9.10).
- The screen never shows `d` as a word or a number (the crafting economy entry of 9.10). The world shows it: thicker mist, tracks, bones, a sign at the area's edge.

### 3.6 One internal difficulty scale (S3, answered 9.10)

- One integer scale for areas (`d`), quests (the sum of their steps' difficulty, as the spec computes it) and recipes (their level).
- Each step multiplies effort and the health a hazard takes by one `difficulty_ratio_permille` (1500 to start), about 3.4 times over three steps; how often a hazard shows grows by one `hazard_bp` per step (3.5). The level thresholds already grow about that way. The check holds content to the scale: what an area or a recipe asks grows by the ratio per step, within a band.
- The scale sets effort and danger; it is not a chance curve. A recipe's chance stays as the crafting economy entry of 9.10 set it: each missing level takes `craft_level_step_bp` off, with no wall. A step above is hard because of what the world asks there, dearer inputs, a more dangerous road to them and hazards that hit harder, so one step above is a stretch, two are very hard and three are close to impossible, for reasons the world shows.
- The scale never shows on screen as a word or a number (3.5).

### 3.7 Group quests

- A quest may name a party, `party: { min, max }`. A player may try it alone or short-handed; the chance then falls with each missing member, since the quest is made for a group (for example `base_bp * members / min`).
- Later, the valley's characters may fill a party. A character joins only when its content carries `companion: { level }`; by default none does. A companion below the quest's level falls by the fall rule of 8.10, goes back to where it lives, and is there again the next day.
- Guarding a town or a fort is a quest players choose. Nothing decays and nothing is lost when nobody takes it (G28).
- With combat (stage 8 or a vote): a group may take a quest to hold a place, and a rival group may sign up to contest it. Both sides sign up, and nothing is taken from a player who is away.

### 3.8 Notices and the account

- Registration is minimal and comes after the opening (the owner, 9.10). Read as: an email address and the name the world shows, asked when the opening ends and never before play. The name is the one given in the opening, offered again here; the filter reads it then, and it must be unique in the world joined (10.10). Accounts begin at stage 2a; the stage-1 demo has none.
- The game mails a player only when something the player holds in a shared town is about to return to the town: one mail per hold, `notice_days` before its end (3 for a building and 7 for a house, to start). The mail names what returns, what stays with the player, and the date.
- A mail never asks the player back for anything else, never offers a reward and is never repeated. A player may turn the mails off; the screen then tells alone.

### 3.9 Areas between players (S4, answered 9.10)

- Players compete for places only: plots in a shared town (3.2) and, once combat comes (stage 8 or a vote, G35), areas between players.
- An area between players lies far from the towns and high on the scale (3.6), so a new player does not walk in by chance; a sign at its edge warns before the first step in (G31). Entering is the consent, and whoever does not enter is never hurt there.
- No player harms another in a town, a camp or a house, at any hour, and nothing is taken from a player who is away; from a hazard, a camp is safe while its fire burns (3.4, 10.10).
- Its nodes pay more for the risk: the effort weight counts the area's protection level (kernel review 7.2, item 4).
- Its nodes are shared: what one player takes there, the next does not find. Everywhere else each player gathers their own yield from every node (Q7, answered 9.10).
- A player brought down by another player there falls by G33 and loses only what was gathered on that outing, which goes to the one who brought them down. Tools, worn items and what the player made stay theirs.
- The top of the worth board carries a mark (Q4, answered 9.10). Here the mark is seen from afar and shows on the map of every player in the area, and whoever brings a marked player down also gains honor on the hunters' board. In towns the mark is honor only. Nothing more is taken from a marked player than from anyone: the outing's finds, here, and nothing at home or while away.
- Reserved now, each one field with a default that changes nothing today: a `controller` on every place (default public), a protection level on every area (`safe` at danger level 0 and `wild` above it, read from the level; `contested` only for an area between players, once combat opens; 10.10), and a reason on every movement of gold, from a closed list (`price`, `refund`, and later `spoils`, `tax`, `rent`, `toll`, `royalty`, `forfeit`, `gift`, `donation`, `escrow`, `closed`; the mints carry `pay`, `reward` and `find`, 10.10).
- No upkeep. The settlement's prices are the gold sink, and the brakes on holding everything are written already: one plot in `building` and one house per player to start (3.2), absence returning places (3.2, S1b), plots opened by work (3.3), and in the areas between players, other players.

## 4. Where these meet the rules already written

| Rule already written | What meets it | Proposal |
|---|---|---|
| G28: the valley waits; an absence is never punished | A held plot lapses, and a long-absent owner's house is packed | Answered (S1, S1b): a written exception for scarce shared places only, now in G28's own text. Absence costs the place and a fifth of its price, never what the player made |
| G28: no "last chance"; the drives of loss and avoidance it refuses | A mail before a place returns to the town | Read as: a notice of a real date for a real place, once per hold; it sells nothing and offers nothing |
| Pillar 5: effort is never wasted | A lapse loses the building's progress | Answered (S1b): every delivered item comes back, the finished steps' quests keep their rewards, and a finished house is packed, never destroyed |
| G30 (8.10): the town and the camp are safe at every hour, and a night's sleep at camp gives health back | "Outside the town is more dangerous", and the camp stands outside the town; the street | Answered (S2): the town stays safe and its street heals as the camp does; a camp outside the town is a tent, safe while its fire burns, and since 19.10 a fire the player builds, no tent. G30 and G32 now say so |
| 6.10 (kernel review 7.2, D6): the world stays cooperative until there is a community | First come for plots; rival groups later | Answered (S4): competition only for places, and later in areas between players that a player chooses to enter (3.9) |
| G42: rare is capacity and gates, never a timer | Places open gradually | Read as: by work (mending, clearing quests), never by date |
| The ruins as the community's slots | Houses in the town's existing buildings | Read as: two kinds of place; a slot stays a public place, a plot is a home |
| 9.10: no difficulty word or number on screen | An internal difficulty rating | Answered (S3): consistent; the rating is internal, and the world shows it |
| 9.10: war, theft and robbery stay out | A rival group attacks a fort; areas between players | Answered (S4): they stay out except in areas between players once combat comes, both sides there by choice; a fall there gives the outing's finds to the one who caused it, and nothing is taken from a player who is away (3.9) |
| Spec stage 4: houses and rent | Places bought with gold | Read as: a plot is bought once; letting a house to another player stays a stage-4 item |
| Stages 2a and 3: each player in their own world | Scarce plots in a shared town | Read as: the own valley stays the player's; scarcity starts with the shared world |
| 6.10 (kernel review, D3): nothing carries from the stage-1 demo into an account | Registration after the opening | Consistent: accounts begin at stage 2a and the demo keeps none. How the opening played before registering moves into the new account belongs to stage 2a's design (server-decided saves) |

## 5. Open questions, in the order they are asked

**S1. Absence in a shared town (paused with houses, 10.10).** A held plot that lapses while its holder sleeps is the timer G28 forbids, and a lapse throws away progress (pillar 5). Answered in part (9.10): yes to a hold only in a shared town, as a written exception to G28, counted between steps, with scarcity answered by the plots that work opens (3.3). But absence has a price: a slow builder needs a rule, so does an owner who has not played for weeks, and a mail comes first (3.2, 3.8).

**S1b. What absence costs (paused with houses, 10.10).** Answered 9.10, as recommended: a building with no finished step for 14 days returns to the town with every delivered item and 80% of the plot's price. A house whose owner has not played for 45 days is packed: its plot returns with the same 80%, and the house and its contents stay the owner's, to raise again on any free plot without redoing a step (since 10.10, on a plot the owner wins, 3.2). One mail comes before each, 3 days before for a building and 7 for a house. Absence then costs the place and a fifth of its price, never what the player made. Final Fantasy XIV frees a house plot after 45 days without a visit by its owner and refunds 80% of the plot's price, but it tears the house down.

**S2. The camp and the street.** Answered 9.10, as recommended: the town stays safe at every hour and its street heals as the camp does; outside it a camp is safe while its fire burns, at `wood_per_night` times `d` a night and none at level 0. The owner added that a camp outside the town is a tent the player buys first, and that the player needs wood enough for the night (3.4). Superseded in part on 19.10, by the owner's yes to the recommendation: no tent; a fire built anywhere outside the town is a safe place while it burns, never lit during a chase or inside a predator's round, its wood for the night following the area's danger and never shown as a number (3.4; DECISIONS.md, the entry on a fire anywhere).

**S3. The internal difficulty scale.** Answered 9.10, as recommended: one internal scale for areas, quests and recipes. Each step multiplies effort and a hazard's harm by 1.5, the hazards' frequency grows by one step per level, and it never shows on screen. A recipe's chance keeps the crafting rule of a fixed step per missing level (3.6).

**S4. Cooperative or competitive.** Answered 9.10, as recommended: competition only for places, a safe core where nothing can be taken, and the fields reserved now. The owner added areas between players outside the towns, once combat comes, and rejected every form of upkeep (3.9).

**S5. Who gets a plot that work opens (paused with houses, 10.10).** First come at the moment a plot opens favours whoever is online then, and a script most of all. Answered in part 9.10: the plots a clearing opens are drawn among those who signed up for it and took part; whether the chance follows the work done, and how the draw follows the area and the number of places, wait for the shared town's design (3.3).

## 6. What can come before the shared world

The parts that need no shared world can be built once their question is answered: danger by area and the internal scale (S3, answered), the camp's fire anywhere outside the town (S2), the fields reserved for competition (S4), group quests tried alone, and the town the player mends as the settlement. Houses, plots, the race and the hold are paused (10.10); the street waits for stage 4.
