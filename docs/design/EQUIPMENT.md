# The equipment model: categories, slots, tools against weapons, and what separates a weapon from clothing (2026-10-31)

Status: a proposal for the owner. Nothing here is built. The owner's word of 28.10 asked to characterise the equipment (items, weapons, clothing, and whether to separate them). Most of the model already exists as decisions and as a proposal in [PROGRESSION.md](PROGRESSION.md) section 5; this page does not compete with it. It does three things the other pages do not: it names the **categories** as one closed list, it draws the line between a **tool and a weapon**, and it compares the model with five games. Anything new is marked "new"; the questions only the owner can answer are at the end (at most four, each with a default).

## 1. The answer to the owner's question first

**Separate weapons from clothing: yes, and they already are separate. Do not separate them any further.**

- By **slot**, they are apart today: clothing sits in head, top, legs, outfit and feet; the hand holds a tool and, when combat opens, a weapon; jewelry has two places; the back holds a bag or a quiver (`WORN_SLOTS` in the schema; DECISIONS 2026-10-23, "The owner's answers on the bag"; G44).
- By **class**, PROGRESSION.md 5.1 already names them apart: weapons are `blade, blunt, spear, staff, bow, thrown`; armour is `cloth, leather, mail, plate` on head, top, legs and feet.
- By **who makes them**: cloth from Tailoring, leather from Leatherwork, mail and plate from Smithing, bows and staves from Woodcraft (PROGRESSION.md 5.1).

What would be a mistake is a *second* layer on top: a separate "weapon inventory", a separate paper doll for fights, or a "stance set" that swaps clothing and weapon together. The owner's own rule, the one thing in the hand reads in a fight (DECISIONS 2026-10-23, "Combat, round 5"), needs only the hand slot. The one real design question is the hand: a tool and a weapon share it. Section 4 settles that.

## 2. Where we stand (read from the content and the schema on 31.10)

| What | Today | Where |
|---|---|---|
| Items in the content | 64: 35 materials, 12 foods, 11 tools, 5 treasures, 1 fragment | `content/core/items/` |
| Items that can be worn | 14: hand 3, jewelry 3, back 2, top 2, feet 1 (+2 looks), head 1 | the same files |
| Weapons | 0. A weapon waits for combat (G44, G35) | GAME_RULES.md |
| Rarity | four names, declared and checked against the data: common, uncommon, rare, legendary | `RARITIES` in the schema |
| Tools | seven kinds: basket, trowel, axe, staff, hammer, pick, rod; `uses` wears a tool out, left out it lasts | `ToolKind`, `Item.tool` |
| Worn effects | five rates (gather, dig, craft speed, craft chance, rare finds), two per item at most, capped by tier at 5, 8, 12 percent | `WORN_EFFECTS`, `params.wear_effect_max_pct` |
| A look | worn on the same slots on a look layer; it has no effects and no set | `Wear.look` |
| Bound items | a look bought with money is bound to the account; the same look found in the game trades (G39) | DECISIONS 2026-10-09 |

The decisions that frame the rest:

- 2026-10-09, "The upgrade": work clothes with a small capped bonus, and a look layer on the same slots. That entry records that the games it compared kept two layers apart (RuneScape's skilling outfits, Final Fantasy XIV's gathering gear with a glamour).
- 2026-10-22, decisions 41 and 42: every character stands on the same rig and slots; the start outfit is three slot items over the bare body and **no weapon**; a weapon is bought, made or found.
- 2026-10-23, "Combat, round 5": a fight reads the build's active slots, the attributes as small keys, and the thing in the hand, all under one power cap.
- 2026-10-25, "The progression map, Q5": worn gear adds attribute bonuses on top, scaling with tier with no fixed cap, and every item states a soft wear requirement (PROGRESSION.md 5.6).
- 2026-10-25, PROGRESSION.md 5.7: common things are plain; rarity sets how many effects a thing carries.
- 2026-10-30, "The hide carries the coat": a garment cut from a hide wears the hide's colour.

## 3. The model as data (new: the list and the sketch)

### 3.1 The seven categories

One closed list, **derived** from the fields an item already has, not stored as a new field (a stored copy would drift from the fields):

| Category | Derived from | Examples today | Notes |
|---|---|---|---|
| `tool` | an item with a `tool` block and no `weapon` block | basket, trowel, axe, rod | works a node; may wear out (`uses`) |
| `weapon` | an item with a `weapon` block (new) | none yet | reads in a fight; may wear out |
| `wear` | an item with a `wear` block on a work slot, not a look | work clothes, boots, hats, bags | small capped bonus on work; armour classes join here with combat |
| `look` | an item with `wear.look: true` | the two feet looks | no effect, no set; sells or binds by how it was got |
| `consumable` | `kind: food`, and later remedies | berries, bread | used once; its effects are timed (PROGRESSION.md 4.5) |
| `material` | `kind: material` with no `wear`, `tool` or `weapon` | reeds, wood, hides | feeds recipes; has a class and a tier |
| `quest` | `kind: fragment` or `treasure`, or a flag a quest sets | a found scrap, a key | not sold to the trader |

### 3.2 The slots on the one rig

| Slot | Takes | Not |
|---|---|---|
| `head`, `top`, `legs`, `feet` | `wear` (armour classes with combat), `look` | tools, weapons |
| `outfit` | a `look` or a full work outfit; takes `top` and `legs` | a weapon |
| `jewelry` x 2 | `wear` of class `jewelry` | |
| `hand` | one `tool` **or** one `weapon` | clothing |
| `back` | one bag **or** one quiver (`places`, `load_bonus`); a big tool is carried here for show (decision 42) | |
| belt (PROGRESSION.md 5.1) | one base tool, free, outside the slot count | |

A shield: PROGRESSION.md names Guard (shield, brace, the breath) but the slots have only one hand. COMBAT.md decides the guard as a verb (`guard`, held), not as an item, so **no off-hand slot is proposed**. If combat later wants a shield as a thing, it is a question for that page, not for this one.

### 3.3 The blocks (a schema sketch, no code)

```text
Item
  kind, rarity, class, tier, weight, sprite            as built
  tool    { kind, tier, uses? }                        as built
  weapon  { class, reach, windup_ms, cooldown_ms,      new: COMBAT.md 4.3 fixes the numbers;
            harm_pct, uses? }                          this page fixes the block's place
  wear    { slot, look?, effects?, set?, places?,      as built
            load_bonus?,
            attrs?  { might: 2, stamina: 1 },          new: PROGRESSION.md 5.6
            req?    { school, level, attr? },          new: PROGRESSION.md 5.6
            trait?  { cold_proof | snow_shod | ... } } new: PROGRESSION.md 4.5 (garment traits)
  bind    'none' | 'account' | 'character'             new: section 3.6
  quality 'plain' | 'fine' | 'true' | 'master'         new, rolled at the craft (PROGRESSION.md 5.2); storage undecided, see 3.3b
```

The three keys a fight reads from an item are the weapon block (reach, wind-up, cooldown, harm), the wear block's `attrs` (the six attributes as small keys, decision 45) and its `effects` (the five rates, which a fight does not read). Armour adds `guard_pct` and `quiet_wear` from PROGRESSION.md 4.2, as worn effects with a minus allowed inside the cap (CR-21).

### 3.3b Two ladders with the same words (a finding)

The repo holds two "fine / true" ladders that were written apart and do not agree on storage:

| | Grade (`Item.grade` in the schema; MATERIALS.md section 1 in open #432, as HUNT_FAMILIES.md cites it) | Quality (PROGRESSION.md 5.2, proposed here) |
|---|---|---|
| Applies to | a good off a better animal (a hide, a pelt) | a made thing (a tool, a garment, a blade) |
| Steps | 2 is fine, 3 is true; 1 is the plain item | plain, fine, true, master |
| Stored as | **an item of its own**: a stack splits by grade the way it splits by tier | not decided |
| Read by | `min_grade` in a recipe | the worn-effect cap (a fine piece reaches more of the tier's cap) |

Proposal: **quality follows grade's rule** (a stack splits by quality; no hidden number on a stack), so a player can see and trade a "fine" coat as a thing, and the two ladders share one vocabulary: `plain, fine, true` for both, `master` for made things only. This needs the owner's word only if he wants the names to differ; the manager can settle the storage when the hunt-to-gear chain (#432) lands. Not built here.

### 3.4 Durability

PROGRESSION.md 5.4, kept: **tools and weapons wear by use; armour and clothing never wear out.** A tool's `uses` is built (basket 60, trowel 40, axe 50). Mending is a recipe whose input is the worn tool and whose output is the same tool restored (`mend`, Handcraft). Smithing's `edge_hold` slows a blade's wear. Nothing repairs in the field: a mend is a bench.

### 3.5 Rarity: four names, kept

The owner's four (9.10) stay: **common, uncommon, rare, legendary**. They are a *supply* axis, orthogonal to *tier*, which is the strength ladder (PROGRESSION.md 5.2, 5.7). The effects at most per rarity are 1, 1, 2, 2 (common often 0); common carries at most the smallest step. Colour on the name is a help, never the only signal (G29): the rarity is also written in words in the tooltip.

### 3.6 Binding

The owner's rule is already in two places: a bought look is bound to the account (G39), and a holiday's look is bound to the character and never traded (G42). The model **adds one value and no more**:

| `bind` | Meaning | Which items |
|---|---|---|
| `none` | trades inside the market's band (R8) | everything found or made, including power |
| `account` | never traded, never sold to the trader | a look bought with money |
| `character` | never traded | a holiday look of its year; a legendary ceiling raiser (PROGRESSION.md 5.7: "few, late, bound") |

There is **no bind-on-pickup and no bind-on-equip** on power. Power is made and traded in the free market (DECISIONS 2026-10-09, "The crafting economy"); a bound upgrade would stop the made-share and the market from doing their work, and "power is never sold" (G39) already keeps money out.

### 3.7 How each category is made, and what a profession gates

A recipe names the profession that gates it, else the one that works its station (DECISIONS 2026-10-09, "One craft verb"). Today: Handcraft gates 16 recipes (tools, work clothes, the first bag), Cooking gates 6 (`pnpm paths:depth`, see [PATHS.md](PATHS.md)). The target (PROGRESSION.md 5.1 and 4.2):

| Category | Made by | Station | Gate beyond the recipe |
|---|---|---|---|
| `tool` | Handcraft (tiers 1 to 3), Woodcraft (handles, staves), Smithing (metal) | workshop, then the city's forge | tier and station; no node wall (G40) |
| `weapon` | Smithing (blade, blunt), Woodcraft (bow, staff, spear), Handcraft's Stonework (stone blade, tiers 1 to 2) | forge, workshop | the same, and a soft wear requirement on use |
| `wear`, cloth | Tailoring | workshop | traits (`cold_proof`...) at the bench |
| `wear`, leather | Leatherwork, from hunted hides | workshop | hide grade and colour (2026-10-30) |
| `look` | the maker's craft or a shop | | binding by how it was got |
| `consumable` | Cooking, Remedies | fire | the cook's band caps the dish's rarity |

## 4. A tool and a weapon in the one hand (new: the rule)

A **tool** works a node: it is read by the activity (speed, reach, what it can open). A **weapon** is read by the fight tick (reach, wind-up, harm). Two blocks, two readers. The rule:

1. An item with only a `tool` block, held in a fight, **strikes as bare hands**. The axe in your hand against a wolf does what a fist does. It is not a weapon because it is sharp.
2. An item with only a `weapon` block works no node.
3. An item may carry **both blocks only when its recipe is named for it**, the way a hatchet, as an example, would be a different thing from an axe. The check refuses a dual item without a `dual_use` mark and caps them at a small count. This is the rule RuneScape's pickaxe shows from the other side: a pickaxe has one level to use it on rock and another to wield it as a weapon (S6).
4. Swapping the hand never skips the swing in progress (COMBAT.md 4.9: "a swap of the thing in hand never skips it").

**Why this and not "the axe is also the sword":** the first axe is the player's first tool and the pocket of the opening (DECISIONS 2026-10-10, "The axe and the felled tree"). Making it a weapon would make the opening's tree the first fight and would give the hunting loop a free weapon, against G35 and against the decision that a start has **no weapon** (decision 42).

## 5. The comparison, on fixed rows

Each cell has a source in section 7. A cell reading "not read" means I did not read a source for that cell; it is not a claim.

| Row | World of Warcraft | Old School RuneScape | Stardew Valley | Valheim | Diablo IV | Loomvale (proposal) |
|---|---|---|---|---|---|---|
| **Slots** | 18: armour 8, non-armour 6, weapons 2, decorative 2 (S1) | 11 visible: head, cape, neck, ring, body, legs, hands, feet, weapon, shield, ammo (+1 hidden) (S5) | rings, two at a time; boots (S9) | not read | armour 4 (helm, chest, pants, boots), gloves, jewelry 2, weapons: one-handed, two-handed, offhand (S7) | 9 places: head, top, legs, outfit, feet, jewelry x 2, hand, back |
| **Categories** | armour, non-armour, weapons, decorative (S1) | the weapon slot sets the combat style (S5) | tools, weapons and rings are separate things (S9, S10) | weapons, tools and armour all carry durability (S11) | armour, jewelry, gloves, weapons (S7) | the seven of 3.1 |
| **Weapon against tool** | not read | skilling tools can sit in the weapon slot (S5); a pickaxe has a Mining level to use and an Attack level to wield (S6) | a blacksmith upgrades axe, hoe, pickaxe and can, **not** the sword or the rod (S10) | tools and weapons wear from use (S11) | not read | two blocks, two readers; both only by a named recipe (section 4) |
| **Durability** | not read | by charges, which fall by combat, use or time; at zero an item vanishes, reverts, breaks or stays with lost benefits (S8) | tools are upgraded, not worn (S10) | use wears tools and weapons, a hit wears armour; repair at a workbench whose level sets what it can mend; not in the field (S11) | not read | tools and weapons wear by use; clothing and armour never; mended at a bench |
| **Rarity** | eight named qualities, Poor to Heirloom (S2) | not read | four tool tiers, copper, steel, gold, iridium (S10) | not read | common 0 affixes, magic 1-2, rare 3, legendary 4 (S7) | four names; effects at most 1, 1, 2, 2 |
| **Binding** | soulbound on pickup, bound on equip, warband bound (S3) | not read | not read | not read | tradable until masterworked or tempered; mythic uniques account-bound (S7) | none on power; account for a bought look; character for a holiday look and a ceiling raiser |

Three places where Loomvale differs **on purpose**:

1. **No binding on power.** World of Warcraft binds to pick up and to equip (S3); Diablo IV makes a thing untradeable the moment it is worked on (S7). Both make an item an end in itself. Loomvale's loop is craft, trade and the free market (DECISIONS 2026-10-09), so a made thing must be sellable.
2. **Clothing never wears out.** Valheim wears armour when you are hit (S11). Loomvale's clothing helps work a little and answers a place's weather (PROGRESSION.md 4.5); wear-and-repair on a coat would turn weather into a tax, and nothing runs while a player is away (G28).
3. **The tier is not the rarity.** Diablo IV and World of Warcraft use one ladder for how good and how rare. Loomvale keeps two, so a common late coat and a rare early charm can both exist (PROGRESSION.md 5.7).

## 6. The owner's questions

At most four, each with a default. I build the default and go on.

1. **The hand.** One hand slot, a tool **or** a weapon, never both at once; an item may be both only when named for it (section 4). **Default: yes.**
2. **A shield or an off-hand.** Is there a second hand? **Default: no.** The guard is a held verb (COMBAT.md 4.3); revisit when the first foe is written.
3. **Do clothing and armour ever wear out?** **Default: no,** as PROGRESSION.md 5.4 says; a coat is mended only if the owner asks for a repair sink later.
4. **Binding.** Is `none / account / character` enough? **Default: yes.** No bind on pickup or on equip.

## 7. Sources

Outside games (read on 31.10.2026):

- S1: Warcraft wiki, Equipment slot: 18 slots, armour 8, non-armour 6, weapons 2, decorative 2. https://warcraft.wiki.gg/wiki/Equipment_slot
- S2: Warcraft wiki, Quality: Poor, Common, Uncommon, Rare, Epic, Legendary, Artifact, Heirloom. https://warcraft.wiki.gg/wiki/Quality
- S3: Warcraft wiki, Soulbound: bind on pickup, bind on equip, warband bound, no trade of soulbound items. https://warcraft.wiki.gg/wiki/Soulbound
- S4: Warcraft wiki, Profession: two primary professions, gathering and crafting, used in [PATHS.md](PATHS.md). https://warcraft.wiki.gg/wiki/Profession
- S5: Old School RuneScape wiki, Equipment: slots, the weapon slot sets the combat style, skilling tools in the weapon slot, two-handed items. https://oldschool.runescape.wiki/w/Equipment
- S6: Old School RuneScape wiki, Pickaxe: a Mining level to use and an Attack level to wield, per tier. https://oldschool.runescape.wiki/w/Pickaxe
- S7: Maxroll, Diablo IV equipment: slots, rarity and affix counts, tradability. https://maxroll.gg/d4/resources/equipment
- S8: Old School RuneScape wiki, Item degradation: charges by combat, use and time, outcomes at zero. https://oldschool.runescape.wiki/w/Item_degradation
- S9: Stardew Valley developer update 6: rings grant special powers when worn, two at a time. https://stardewvalley.net/mini-dev-update-6/ (as quoted in a search result; the page itself was not opened)
- S10: ScaleCube, how to upgrade your tools in Stardew Valley: the blacksmith upgrades watering can, hoe, pickaxe, axe, pan and trash can; four tiers in order; two days; weapons and rods not upgraded there. https://scalacube.com/blog/stardew-valley/how-to-upgrade-your-tools-in-stardew-valley
- S11: ScaleCube, how to repair weapons, armor and tools in Valheim: durability, repair at a workbench, station level, no repair in the field. https://scalacube.com/blog/valheim/how-to-repair-weapons-armor-and-tools-in-valheim (armour wearing when hit: Prima Games, https://primagames.com/tips/valheim-how-repair-weapons-and-items, from a search result; the page itself was not opened)

Ours: DECISIONS.md entries cited by date and title; [PROGRESSION.md](PROGRESSION.md) sections 4.2, 4.5, 5.1 to 5.7; [COMBAT.md](COMBAT.md) sections 4.3 and 4.9; [GAME_RULES.md](GAME_RULES.md) G29, G30, G35, G39, G40, G42, G44; `schema/src/index.ts` (`WORN_SLOTS`, `Wear`, `ItemDef`); `content/core/params.json` (`wear_effect_max_pct`); the counts in section 2 from `content/core/items/`.
