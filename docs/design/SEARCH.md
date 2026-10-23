# Search: press A on things to look inside

Status: a design note written 23.10.2026 for the owner's rule of 23.10 ("Search: press A on things to look inside", DECISIONS, recorded in #305). The first slice is built in the same pull request as this note (section 7). Facts are read from `origin/develop` @ 6ce5ec0b.

## 1. The owner's rule

Many things in the world can be searched: a drawer, a cupboard, a book, a shelf, even a stone. Pressing A on one opens a small window showing what is inside. Sometimes it holds something, often nothing. Out in the open, things can hide easter eggs and rare, valuable gifts, and the higher the player's luck, the better the odds. Every building gets a random number of furniture pieces, so it looks lived in, and sometimes an extra one: a statue, or a picture that opens to show its painting. A player cannot put gear into them; the one place that stores gear is Maru's house.

## 2. What other games do

- **Stardew Valley's garbage cans** are the closest match. A can is searched once a day, most days it gives nothing, sometimes trash, now and then something good, and the day's luck raises the odds. Players check them on their route without being told to.
- **Fallout and Skyrim** fill every desk, cupboard and crate with a small loot list, shown in a window with "take all". Containers in the open refill after some in-game days; containers the player owns never refill and keep what is put in them.
- **Animal Crossing** hides furniture and the odd wasps' nest in trees: a shake is free, the result a small surprise.

Openfold takes Stardew's daily refill and luck, Fallout's window, and Animal Crossing's surprise. It differs from Fallout in one way: nothing is stored in a searchable (the owner's word); storage stays the camp's chest and Maru's house.

## 3. The rules

1. **A searchable is content.** A prop names a search table in a content file: rows of an item and a chance. No code per thing, so a creator adds a searchable by adding a prop and a table.
2. **A search draws once and keeps the result.** Pressing A draws each row once, with the kernel's seeded draw (`f(seed, entity, counter)`, R4), and the window shows what came out. What the player does not take stays inside until the next refill. Opening it again shows the same contents; there is nothing to gain by pressing twice.
3. **Often nothing, and the empty window says so.** Most rows are unlikely, so an empty search is common. The window then reads "Nothing here." in one line (G14). This is not a miss of a strike, so G15 (a miss turns up something) does not apply: no skill was tried and lost.
4. **Luck raises only the rare rows.** Rare and legendary rows are tilted by the same multiplier as a dig's rare finds (`rareFindPermille` in `kernel/src/step.ts`): the character's luck, techniques and worn items, inside the power cap. Common rows are not tilted. On screen this reads in words (decision 39): "You have a feel for hidden things."
5. **A searchable refills at dawn, once a day.** Its contents are drawn fresh after each dawn. An absence costs nothing: a searchable does not pile up while the player is away, and it does not empty (G28). This is capacity, not waiting (R6), like a dig's respawn.
6. **What search gives is counted.** Every row is a thing with a value. Search is a faucet: its expected value per day joins the value solver's capacity like a dig's, rare rows count in the world's one rarity budget (G42), and a rare find from search is a gift, never the only source of a thing a recipe, quest step or tool needs.
7. **One way only.** Nothing is put into a searchable. Gear is stored in the camp's storage chest and, once it is built, Maru's house.
8. **A picture pays.** A picture or a book that opens to show something follows G8: a clue to a riddle, a key to a place, a line of character or a laugh. A painting that pays nothing is cut.
9. **The opening stays clear.** No searchable stands on the opening's path in the first fifteen minutes, so a player who never presses A loses nothing (the hook ladder, GAME_RULES section 2), and a player who does is not pulled off it.

## 4. Furniture in buildings

Buildings have no insides yet; the first inside is Maru's house, after the sleep places of #296. When insides come:

- each building kind lists its furniture pieces; a building draws how many from a seeded range (seed and building id, so every player sees the same room);
- now and then one extra piece: a statue, or a picture (rule 8);
- each searchable piece names its table like an outdoor one.

This section is the plan only; nothing of it is built in the first slice.

## 5. Easter eggs and rare gifts

An easter egg is a rare row on an outdoor table: a curiosity with a value and a line of description that makes a player smile. A rare gift is a rare row whose item is worth more than the day's work around it. Both need their own items and art, so they come with a content wave; the first slice uses items that already exist.

## 6. What the owner may want to change

These follow from his rule and from the games above; each is a default he can turn:

- the refill: once a day at dawn (Stardew), rather than every few days (Skyrim);
- the empty line: "Nothing here." rather than silence;
- the first slice's three outdoor searchables, all off the opening's path.

## 7. The first slice (this pull request)

- Schema: a treasure file may carry `search` in place of `dig`: a table of rows (`item`, `chance_pct`), the place it hangs on (`place.slot` or a prop id), no tool and no timing window.
- Kernel: two actions. `search` draws the contents of a searchable once per day (rules 2, 4, 5) and returns them in an event; `take` moves one row or all rows into the bag, with the bag-full answer the dig already has. The contents live in state as drawn rows and the dawn they were drawn for.
- Check: every search row is an item with a value; a searchable's place exists; no searchable sits within the opening's first-path area (rule 9, as the map plan marks it).
- Client: A beside a searchable opens a small window of its contents with "Take all" and a tap per cell; an empty window shows "Nothing here." Text at 16 px or more (G29).
- Content: three outdoor searchables in the valley, off the opening's path, with tables of existing items (shards, an old coin, a berry, grit) and one rare row each.
- Not in this slice: furniture, insides, pictures, new items or art.
