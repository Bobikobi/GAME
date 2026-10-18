# The gap: what `/play3d/` still draws without a model of its own, and the budget to close it

Read on 2026-10-18 from `content/core/map.json`, `game/src/play3d/art.ts`, `scenery.ts` and `world3d.ts`,
and from the four Meshy accounts (Settings, Subscription; nothing generated, no credit spent).
Cost per row is Meshy 6 Lite on a Free account: text or image to 3D 10 + texture 10 = 20 credits, rigging 0,
one download (see `meshy-notes.md`). "Kenney" rows cost nothing: the CC0 Nature Kit is already in the repo's style.

## The budget

| Account | Port | Balance | Monthly bucket | Permanent bucket | Drafts from 13.10 |
|---|---|---|---|---|---|
| 1 | 9341 | 250 | 170 | 80 | Elder Maru |
| 2 | 9342 | 230 | 170 | 60 | Pell |
| 3 | 9343 | 200 | 160 | 40 | market stall, cook (man) |
| 4 | 9333 | 380 | 320 | 60 | old well, cook (woman) |
| | | **1,060** | **820** | **240** | |

- The app shows two buckets only. "Permanent" equals the onboarding rewards (20 each) exactly; the check-in
  credits sit inside "monthly", and the app does not print an expiry date. Plan as if all 820 vanish on 1.11.
- 1,060 credits are 53 textured drafts. The binding limit is downloads: 10 a month per account (the plan card
  says "up to 10 assets"), at most 40 across the four, minus what each account already downloaded this month.
  The app shows the count only inside a model's download dialog, so it is read per account at the first real download.
- Check-in: all four accounts have finished their first five-day cycle (9341-9343 on 13.10, 9333 on 17.10, day 5
  was 100). Loading the workspace today gave nothing, and the rewards panel shows no further day. A new cycle, if
  Meshy opens one, is found by the daily visit. Only "Try Texture Editing" (20 each, needs a paid month) is open.
- Next month: 100 credits per account on 1.11 (400 in all, 20 drafts) and 10 fresh downloads each.

## The table

People (a rigged humanoid, `art.ts` PEOPLE; anything else is a Kenney mini or the flat sprite):

| Thing | Where met | Drawn now | Route | Credits, downloads |
|---|---|---|---|---|
| Elder Maru | the opening, the elder's house | Kenney mini (male-a) | draft exists (9341) | 0 more, 1 |
| Pell | the trader's stall | Kenney mini (female-a) | draft exists (9342) | 0 more, 1 |
| The cook (man, woman) | named in the cast sheet; no slot in the map yet | nothing | drafts exist (9343, 9333) | 0 more, 2 (held until a cook has a place) |
| Two empty NPC slots (`core/town-corner`, `core/grove-clearing`) | town corner, clearing | nothing | wait for content | not now |

The camp and the town (every player meets these after the opening):

| Thing | Where met | Drawn now | Route | Credits, downloads |
|---|---|---|---|---|
| Work stone, workbench, workshop, storage chest | the camp, the stations the quests unlock | flat sprite (the unbuilt ghost is the same sprite at 40%) | sprite to 3D | 4 x 20 = 80, 4 |
| Campfire (unlit) | the camp | flat sprite (lit is Kenney logs and stones, built) | Kenney logs, no flame | 0 |
| House, small (3) and the ruined house (1) | the town | procedural boxes (`house()`) | sprite to 3D, one model reused | 2 x 20 = 40, 2 |
| Old well | the town square | procedural cylinder (`well()`) | draft exists (9333) | 0 more, 1 |
| Market stall | the trader | Kenney tent | draft exists (9343) | 0 more, 1 |
| Lantern post (3) | the town | flat sprite | sprite to 3D | 20, 1 |
| Totem, shelf, chest prop | ruins, the town | totem: Kenney obelisk; shelf and chest: flat | sprite to 3D | 2 x 20 = 40, 2 |
| Fence (3), fence post (3) | the town edge | flat sprite | Kenney `fence_simple`, not yet copied | 0 |

Ground cover and the wild (large counts, small things):

| Thing | Count | Drawn now | Route | Credits |
|---|---|---|---|---|
| Tall grass | 40 | flat sprite | Kenney `grass`, `grass_large` (in the repo) | 0 |
| Mossy rock, pebbles | 21, 11 | flat sprite | Kenney `rock_*` (in the repo) | 0 |
| White and blue flowers | 14, 2 | flat sprite | Kenney `flower_*` (in the repo) | 0 |
| Small mushrooms | 10 | flat sprite | Kenney `mushroom_*` (in the repo) | 0 |
| Reeds, standing stones, dead tree, ruins (pillar, arch, wall, statues, rubble) | 2, 2, 2, ~12 | Kenney, already modelled | none | 0 |
| The two wolves | 2 | the flat sprite | `character-wolf-bright.glb` and `-grim.glb` exist, not wired | 0 |
| The pit | 1 | flat sprite lying on the ground | a dark hole in code | 0 |

Items held or in the bag are icons in the interface, not world models, and are not part of this gap. Content from
other creators arrives as sprites and is drawn flat until someone names a model in `art.ts`.

## What it adds up to

- Needs Meshy credits and downloads: the camp stations (4), the house (1) and the ruined house (1), the lantern
  post, the totem, the shelf and chest prop (3): 9 new models, 180 credits, 9 downloads.
- Drafts already paid for: Maru, Pell, the stall, the well, two cooks: 6 downloads, no credit.
- Free and without Meshy: ground cover, fence, wolves, pit, unlit campfire: code and the Kenney files in the repo.
- So the whole real gap is 15 downloads and 180 credits; the budget holds 1,060 credits and about 40 downloads this
  month. The budget is larger than the gap; what is short is the owner's look, since Meshy's realistic style next to
  Kenney's low poly is a direction (NEXT 8c), and the drafts are one look per character.
