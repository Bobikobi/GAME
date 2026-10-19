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
| Fence (3), fence post (3) | the town edge | not drawn | `fence_simple` is named in the models README but the file is not in the repo; copy it from Kenney Nature Kit (CC0) | 0 |

Ground cover and the wild (large counts, small things):

| Thing | Count | Drawn now | Route | Credits |
|---|---|---|---|---|
| Tall grass | 40 | not drawn as a prop: the tile scatter of each ground kind puts Kenney grass there | none needed | 0 |
| Mossy rock, pebbles | 21, 11 | not drawn as props; the scatter puts Kenney rocks | none needed | 0 |
| White and blue flowers | 14, 2 | not drawn as props; the scatter puts Kenney flowers | none needed | 0 |
| Small mushrooms | 10 | not drawn as props; the scatter puts Kenney mushrooms | none needed | 0 |
| Reeds, standing stones, dead tree, ruins (pillar, arch, wall, statues, rubble) | 2, 2, 2, ~12 | Kenney, already modelled | none | 0 |
| The two wolves | 2 | the flat sprite | `character-wolf-bright.glb` and `-grim.glb` exist, not wired | 0 |
| The pit | 1 | flat sprite lying on the ground (reads as a pit) | optional dark hole in code | 0 |

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

## Map layers: the ground and what lies around the player

Read from `scenery.ts` (the ground atlas, `initMap`, the water, the light) and `content/core/map.json`
(48 x 49 tiles: 815 forest, 604 meadow, 272 grove, 175 cobble, 167 ruin floor, 147 water, 91 sand, 35 path,
31 flowers, 15 rubble). One tile is one metre, and a 64 px texture covers it. Nothing here is generated or
downloaded; the rows are routes, and the looks wait for stills (below).

| Layer | Drawn now | The fault | Route | Credits, downloads | Direction? |
|---|---|---|---|---|---|
| Ground surfaces | A 256 px atlas of 4 painted 64 px tiles (grass, flowers, sand, path) from the HD trial; water and forest are tinted copies; grove is a lighter tint; cobble, ruin floor and rubble are slabs drawn in code | 64 px per metre reads blurry up close, and a tiled 64 px tile repeats visibly; 70% of the map is forest or meadow | Real material textures, one per kind: grass, forest floor, sand, path earth, cobble, ruin stone, rubble. Free CC0 libraries first (below) | 0 | **Yes.** Photographic PBR next to Kenney low poly is a different look from the painted tiles |
| Seams between kinds | Each tile keeps its own hard edge; a shore is where one texture meets the next | Meadow to forest, sand to water and path to grass show a straight line on a regular grid | Blend by weights on the tile corners (one extra pass in the ground shader, the corner heights already exist), or transition tiles (edge, corner, inner corner) | 0 | Detail inside the ground's direction: polish once it is picked |
| Water surface | One plane at -0.12 m with the sand-tinted tile scrolling slowly, opacity 0.86 | No shore foam or depth colour, the bank drops to -0.55 m under a flat sheet | A tiling water normal map (CC0) and a depth fade in the shader; the shore line comes from the seam work | 0 | Yes, with the ground |
| Heights | Two noise octaves (about 0.45 m) and a dip to -0.55 m under water; built ground is flattened | No levels. The 2D game chose levels with rock faces (DECISIONS 2026-10-18, T2); they arrive with stage 3 as a height layer in the data beside the ground, and `/play3d/` must read the same data | Terrain from the height layer: flat tops, vertical rock faces with a lip, steps cut in the face. A cliff or rock-face module is a model, so it is the one map piece Meshy fits | 20 credits and 1 download per module; likely 3 to 4 modules (straight, corner, inner corner, steps) = 60 to 80, 3 to 4 | The level height and the face look are already the owner's (T2); the 3D look of the face is a direction |
| The world's edge | A solid forest border and nothing beyond; the fog hides the cut | The open world (stage 3) has no end, ground is generated around the valley | Chunks of ground generated from the same data, the fog and tree line carrying the far edge; no extra art | 0 | No, it follows stage 3's data |
| Sky, light, fog | Hemisphere and sun with day and night colours, exponential fog (0.009 by day, 0.03 at night), the background is the fog colour | No sky shape: no horizon, clouds, sun or stars; the clear colour is the fog | A gradient dome, a few cloud cards and stars at night from code or a CC0 sky texture | 0 | Yes, a small one, shown in the same stills |

### Where the ground can come from

- **ambientCG** (CC0, no attribution): the API lists 1K, 2K, 4K and 8K JPG sets. A set's zip is large because it carries every map
  (checked 18.10: Grass001, Grass004 and Grass005 are 10 to 11 MB at 1K and about 39 MB at 2K), so only the colour map would ship
  (a 512 px JPG, about 100 KB). Phone cost of seven kinds at 512 px: roughly 0.7 MB.
- **Poly Haven** (CC0): per-map files on its API. For `aerial_grass_rock` the colour map is 0.67 MB at 1K and 2.6 MB
  at 2K as JPG, the normal map 0.9 and 3.8 MB; sizes are per map, so a ground needs the colour map only, or colour and normal.
- Both are photographic and seamless. Re-saving at 512 px with a lower JPEG quality gives a 50 to 120 KB map per kind. A licence line goes
  in the models README, though neither site asks for one.
- **Meshy cannot make a ground.** Its texturing works on a mesh's own UVs (Texture and Retexture, 10 credits each). I found no seamless
  tiling mode in the docs, tutorials or reviews, and did not test one in the app; the Free plan has no API. A tileable ground would
  have to come from a library, from Material Maker (free, open source, generates tiling materials locally) or from an image model with
  the 2D art pipeline's seam check (DECISIONS 2026-10-18 "Ground tiles from the image model come out on a finer grid than asked").
  The 2D game's own 64 px tiles can also feed the 3D ground, which keeps both doors alike.

### The looks that go to the owner as stills

Three still frames of the same spot (the town square edge, meadow into forest and the river bank), phone size, each testing one named difference:

1. **Painted**: the 2D tiles at higher resolution (the 2D art's kit or an image-model pass), the Kenney low poly on top. Keeps one world for both doors.
2. **Photographic PBR**: ambientCG or Poly Haven colour maps at 512 px with a soft blend of the seams, the same Kenney props.
3. **Flat colour with a light grain**: one colour per kind, a faint noise, soft seams. The look of the Kenney props themselves.

The pick goes into DECISIONS with its frame, and the seams, water and sky then follow it as polish. The stills are made from the
existing scene with the three ground materials swapped, so they cost no Meshy credit and no download.

## The options, with the map layers folded in

1. **People and camp, ground by library.** The four existing drafts (Maru, Pell, stall, well) plus the 4 camp stations and the house,
   100 credits; ground, seams, water and sky from CC0 files (0 credits). Leaves flat: the ruined house, lantern posts, totem, shelf,
   chest prop, and cliff modules. About 700 credits unused.
2. **The whole town and the cliffs (recommended).** Option 1 plus the ruined house, lantern post, totem, shelf, chest prop and 3 to 4
   cliff modules, plus variants of the people for the 8c stills: about 26 drafts, about 520 credits and about 18 downloads over two
   months. Ground, seams, water and sky from CC0 files after the ground stills. About 540 credits unused, to bank by the "next needs" path.
3. **Meshy for ground cover too.** Option 2 plus Meshy grass, rocks, flowers and mushrooms: 22 or more downloads, the most credits, and the
   clash with Kenney low poly described above. Does not help the ground, since Meshy cannot tile one.

What each leaves undone is the same in every option: levels (stage 3 data), the endless edge (stage 3) and every place still empty in the map.

## Community search (NEXT 8 d, 18.10 evening)

Searched meshy.ai/search on the four accounts (read-only; nothing downloaded, nothing published, no cookies or storage read).
Every model page shows its licence, author, triangle count and a texture preview; the filter used was "CC0" or "CC BY" and at most 500,000 triangles.
Of about 40 queries, nearly everything a user posted on Free is **CC0**, which asks for no attribution at all (better than the CC BY 4.0 of our own Free-plan
generations). Condition (3) holds only after a reduction to 50,000 triangles and 1024 px maps in Blender, the same pass as the role models.
Condition (2), the look, is **not decided**: Elad has not picked it (8c), so every find below is a candidate, not a taken model, and none is taken before the stills.
Meshy answered "403 Forbidden" for a few minutes after about 150 page loads from one machine; the sweep is slowed to stay under that, and the ruined-house and well
pages were not read before it blocked, so they are marked "not read".
The CC0 label is the uploader's; a model made from a copyrighted picture can carry it wrongly. Each take gets one look at the preview and the page before download.

| Gap item | Found | Triangles | Author | Licence | Fit and what it saves |
|---|---|---|---|---|---|
| Workbench | [An old oak workbench](https://www.meshy.ai/3d-models/An-old-oak-workbench-0197e698-8f98-7094-9c77-e29f6ab042f7) | 50,384 | corranvh | CC0 | Plain pale oak, reads as a bench in any look, already at the cap. Saves 20 credits |
| Storage chest | [Old weathered wooden chest](https://www.meshy.ai/3d-models/Create-a-high-detailed-resolution-3D-model-of-an-old-weathered-wooden-chest-with-metal-fittings-Rectangular-shape-reinforced-with-metal-bands-and-corner-protectors-Distressed-rustic-texture-with-various-shades-of-brown-and-gray-Supported-by-four-sturdy-legs-High-accuracy-in-texture-and-details-emphasizing-antique-vintage-style-Ultrarealistic-highly-detailed-ChristmasAdventure-0193baff-a960-7116-897c-ff2ab3be38a6) | 163,273 | nathi.mashabane | CC0 | Banded wood, needs a reduction to a third; realistic. Saves 20 |
| Small house (3) | [Medieval Cottage](https://www.meshy.ai/3d-models/Medieval-Cottage-01995cca-1230-7dbd-8792-842d2a79d56b) | 104,290 | Philemo | CC0 | Half-timber, tiled roof; reduce to 50,000; fits a realistic look, not a painted one. Saves 20 |
| Lantern post (3) | [Lamp post](https://www.meshy.ai/3d-models/Lamp-post-019d72b8-3643-707d-85cf-490b46ed480f) | 18,957 | kennethjanoplo1 | CC0 | Iron post, tiny already; the games' lantern is wooden, so a repaint may be wanted. Saves 20 |
| Bookshelf (shelf prop) | [Bookshelf](https://www.meshy.ai/3d-models/Bookshelf-Maze-0198d988-f2f7-731c-9246-b932669c332d) | 10,000 | not read | CC0 | Plain pale shelf; fits only an untextured or flat look. Saves 20 |
| Market stall | none that fits | | | | The two CC0 stalls found are a cartoon "BUY" stall and a red-striped one; our own draft (9343) is closer. Saves 0 |
| Cliff modules | none that fits | | | | Meshy has single rocks and mossy mounds, no modular face with straight top and base edges. Generate, or build the face in code from the height layer. Saves 0 |
| Totem | none that fits | | | | The totems are Native-style poles, toys or animals; the valley's totem is a ruin piece. Generate. Saves 0 |
| Campfire (unlit), stone well, ruined house | none read | | | | Not read before the 403; search again tomorrow |
| Elder Maru | [Elderly Wizard with Monocle](https://www.meshy.ai/3d-models/Elderly-Wizard-with-Monocle-019bdcc7-c190-70ac-9d7f-7e3de3a0ca30) | 99,832 | d_griffiths13 | CC0 | Cartoon wizard, T-pose, unrigged; rig by `rig_transfer.py`. Our own Maru draft is already made (rigged, paid), so this saves nothing now; it is a second look to show Elad |
| Pell | [Tea Merchant](https://www.meshy.ai/3d-models/Tea-Merchant-0198d7c1-fe2c-73e0-b9f1-3f1a607c021c) | 35,800 | gtarcan | CC0 | Realistic, standing, unrigged; same note as Maru. A second look only |
| Cook (woman) | none | | | | Search found a hearth, no cook |

The tally against the plan of option 2: five items could come from the community (workbench, chest, house, lantern, shelf), about 100 credits, and each costs a download that a
generation would have cost anyway. The four people drafts exist. So the community cuts option 2 from about 520 credits to about 420, and leaves the larger saving, the credits, to the
banked path anyway. It changes nothing in the order: the look is picked first.

### Found for later (the month's spare downloads)

Same filter, same caveats. All CC0 unless noted.

| For | Found | Triangles | Author | Note |
|---|---|---|---|---|
| Horse | [Horse](https://www.meshy.ai/3d-models/Horse-019cab6b-b5bc-798e-9de9-d13f86488e64) | 52,507 | see page | Grey, standing, textured. Elad saw a horse; this and [Horse](https://www.meshy.ai/3d-models/Horse-019bda50-cbe9-7c0c-9267-a9a565d8a924) (47,468, brown, mid-stride pose) are the two plain ones. Unrigged |
| Fox | [Fox](https://www.meshy.ai/3d-models/Fox-01942ed4-a3c5-77f3-b022-ce4772340f43) | 10,224 | PICKTURA | Standing, textured |
| Sheep | [Aiko's Sheep](https://www.meshy.ai/3d-models/Aikos-Sheep-01992f17-38e1-7114-9cf6-c8ef455eff06) | 11,186 | ZZproZZ | A round cartoon sheep; [Lone Sheep](https://www.meshy.ai/3d-models/Lone-Sheep-01987a04-7a24-7be3-99b6-613aa4ce5573) (9,802) is more natural |
| Donkey | [donkey](https://www.meshy.ai/3d-models/donkey-019b6c8d-0eda-7c7f-be62-1968da65b85f) | 23,795 | see page | Textured |
| Smithy for the workshop | [Victorian shop](https://www.meshy.ai/3d-models/Victorian-butcher-shop-dark-wooden-frame-gothic-storefront-p) page, not a fit | 99,941 | | A house, not a workshop: shown only as the nearest result |
| Deer, crow, rabbit | none in the filter | | | Deer found nothing; the rabbit and crow results carried no licence badge |

Animals need a four-legged rig; the free auto-rig on these accounts is one per account (see the notes above), so a find is a mesh to rig in Blender (`quad_pass.py`).
