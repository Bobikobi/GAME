Title: docs(design): combat numbers in one table, HUNTING.md, and the rules cleanup after the owner's answers

Base: develop. Draft.

## What this adds

The second combat docs pull request. Docs only, plus one DECISIONS entry.

**One table for the fight's numbers (COMBAT.md 4.9).** The frame of 20.10 gave numbers in milliseconds. The combat memo recommended numbers in ticks. The table now gives each number once, with its value, range, step and source: the owner, the frame, or the memo's step. Every duration is a whole number of 100 ms ticks. Where the frame and the memo disagreed, the row names the winner and says why in one line. These rows changed from the frame:
- The tick's range went from 33-250 to 50-200 ms (memo 0).
- Order inside a tick is now fixed: arrival tick, then distance, then account id, players before foes (memo 2).
- The hand has one cooldown instead of one per weapon: quick 8, standard 10, heavy 12-15, floor 6 ticks (memo 4).
- A foe's move has an active window: windup 5, active 2, recovery 8 ticks (memo 5).
- A player's strike does integer damage, a band of base div 8 with the hand's bonus counted as bonus + 64, instead of `harm_pct` (memo 6). A foe's harm to a player stays a share of the bar. The bite is `hp_cap div 6`.
- New rows: mercy 8 ticks, a stun of 3, knockback 1 tile (memo 7).
- The dodge keeps its two tiles but loses its miss window: no invulnerability frames (memo 7).
- Leash 7 tiles from the den replaces `break_tiles` 8 from the player. A give-up of 50 ticks replaces `break_ms` 3000 (memo 9).
- Noise uses the gait table already on develop (still 2, sneak 3, walk 5, run 8), quoted as it stands, plus two new rows: a strike 4, felling or digging 5. This replaces the frame's single `hazard.noise_tiles` 6. A noise turns a head for 30 ticks, replacing `noise_ms` 4000.
- New rows: claim lock 48 ticks; bars 31x4 px, no number, linger 50 ticks; tiers T1 2 hits, T2 6-8, T3 20+.

The frame's breath, guard, flank, weakness, credit, zone and pay rows are kept and converted to ticks.

**HUNTING.md (new).** It covers:
- Ten animal states and how an animal moves between them.
- Noticing as a count of think steps on squared distance. There is no roll, so the server needs no seed.
- The noise table quoted from the gait params.
- Tool tiers T0 stone to T5 pit trap.
- Five goods: meat, hide, bone, sinew, feather. The carcass spoils.
- Three stations: the fire, plus a drying rack and a tanning rack, both new and so core-only (G45).
- Archetypes by danger tier: d0 ambient and flee, d1 defend, d2 hunt.
- The rating rules: no blood on animals, no young animals or pets as prey, no suffering, no kill count.
- The pay cap. It goes through a fifth value source, `hunt`, which does not exist yet. No good carries a price.
- Twelve check rows in the check's "x" wording.

**The rules cleanup (GAME_RULES.md).** It rewrites only what the owner already decided:
- G22, G33 and G46, plus checklist question 11, now follow the PEGI 16 / ESRB T line and the death card. The Breadcrumb pattern is narrowed so it allows the pack.
- In G47, noise now turns a head (round 4).
- G35 is restated: no fighting in the demo, and the frame is answered. G44 names the hand as the strike.
- The owner's five answers enter as G78, G81, G83, G84 and G86. These are the numbers COMBAT.md section 5 gave them, which EMPTY_WORLD (G81) and GROWTH (G87 onward) already cite. G79, G80, G82 and G85 stay with the frame's proposals.

**Other pages.**
- NEXT 18 a's batch protocol line now follows round 1: fights ride the live socket, and `/moves` stays move-only.
- TONE's and COMBAT's status lines are updated.

## Open for the owner

Each question shows the default the pages are built on.

1. **Contact with a defender before the fight is built.** Default: no. Defenders enter with the fight. Until then d1 animals only bluff (ALERT, no DEFEND).
2. **Elves and meat, skeletons and meat.** Default: all three races hunt and eat. No bonus or penalty by race until STORY.md speaks.
3. **Animals go to ground at dusk.** Default: yes. Prey sleeps 22:00-05:00 by the valley's hours, predators the reverse. The bank wolf hazard keeps G30's hours.
4. **The first fightable creature.** Default: the wolf of the bank (T1, 2 hits with a starter hand). The frame keeps the predator on its round a hazard that never becomes a foe (G34; COMBAT section 2). So the default reads this as a wolf of the same kind standing as a foe in a d1 area, and the bank wolf on its round stays the hazard.
5. **Blood on a hunted animal** (added). TONE section 3 allows "a trail of blood where a hurt animal went", but the hunting memo's avoid-list says none. Default: none, the stricter line, until a still is shown.
6. **Wind** (added). The memo proposes smell carried downwind. Default: no wind in the first build; smell is G47's one-tile ring.
7. **Rule numbers** (added). Default: the five answers keep COMBAT's provisional numbers (G78, G81, G83, G84, G86) rather than G72 onward. Other pages already cite those numbers, and G72-G77 are held by RULES_REVIEW.
8. **The pull request template** (added, not changed here). The reviewer checklist still says "plain words for every age" for G22. Default: left as it is, for a small pull request of its own on a shared file.

## Checks run

- `pnpm check`: unchanged, 0 errors, 54 warnings, as on develop.
- `pnpm verify`: green, including 13 test files and 82 tests in its last suite.
- `grep -c -E '—|–'` prints 0 on every touched file.
- No machine paths and no prices in the diff.

## Tools that fire on this pull request

Quest review: clear (no quest text).
Story review: clear (design pages and rule lines, no text a player reads; no claim about the past).
Source: none (design pages, no picture).
Tree: none: design pages; nothing a player can grow in changes yet (the creature schema is the next PR).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01PpsERwExhmUgx9s51dBHZF
