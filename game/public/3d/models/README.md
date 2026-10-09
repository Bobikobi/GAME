# Models of the 3D trial

Every file here is CC0 (public domain) from [Kenney](https://kenney.nl):

- `tree_*`, `rock_*`, `stone_*`, `plant_*`, `flower_*`, `grass*`, `mushroom_*`, `lily_*`, `sign`,
  `campfire_*`, `tent_*`, `statue_*`, `log*`, `stump_*`, `bridge_wood`, `fence_simple`, `pot_large`:
  Nature Kit 2.1.
- `character-*`: Mini Characters 1.0.

Kenney asks for no attribution; the credit is here because the valley names everything it uses.
The tiles in `../tiles` are the painted textures of the HD trial, made for this repository.

## The cell trial (`game/cell.html`)

Its models, ground textures and skies come from [Poly Haven](https://polyhaven.com) (CC0). They
are fetched into `../cell/` by `game/tools/fetch-cell-assets.mjs`, which also thins the
photoscanned meshes to a size a browser can carry; git ignores that folder. The characters
`character-wizard.glb` and `character-matt.glb` are by [Quaternius](https://quaternius.com),
taken from Poly Pizza, and they carry two different licences. `character-wizard.glb` is
byte-identical to "Animated Wizard" (https://poly.pizza/m/kttbFvCl2C), licensed "Creative Commons
Attribution" ([CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)), so attribution is
required: "Animated Wizard by Quaternius, CC BY 3.0". `character-matt.glb` is "Characters Matt"
(https://poly.pizza/m/66kQ4dBBC7), licensed "Public Domain (CC0)", so no attribution is required.

## Character experiments (`docs/3d/character-experiments.md`)

These files are neither from Kenney nor CC0, so the opening line of this README does not cover them or the two Poly Pizza characters above (its `character-*` entry means the two Mini Characters,
`character-female-a.glb` and `character-male-a.glb`). Each loads in the cell trial by the part of
its name after `character-`, for example `?look=meshy-warrior` or `?look=wolf-grim`; the two wolves
walk on four legs.

- `character-meshy-warrior.glb`: "Warrior", rigged with Idle, Walk and Run, generated with Meshy (Meshy 6 Lite, free plan), https://www.meshy.ai, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) under section 3.2 of the [Meshy Terms of Use](https://www.meshy.ai/terms-of-use); attribution: "Warrior, generated with Meshy (meshy.ai), CC BY 4.0, https://creativecommons.org/licenses/by/4.0/; modified: reduced from 191,496 to 60,000 triangles, clips renamed to Idle, Walk and Run, a 0.08 s extra clip removed".
- `character-meshy-mage.glb`: "Mage", rigged with Idle, Walk and Run (skeleton and clips transferred from the warrior in Blender), generated with Meshy (Meshy 6 Lite, free plan), https://www.meshy.ai, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) under section 3.2 of the [Meshy Terms of Use](https://www.meshy.ai/terms-of-use); attribution: "Mage, generated with Meshy (meshy.ai), CC BY 4.0, https://creativecommons.org/licenses/by/4.0/; modified: reduced from 322,614 to 59,988 triangles; skeleton and skin weights added in Blender by transferring the warrior's Mixamo-named rig (game/tools/blender/rig_transfer.py); clips Idle, Walk and Run shared from the warrior".
- `character-wolf-bright.glb`: "Wolf", a grey wolf with Idle, Walk and Run, generated with Meshy (Meshy 6 Lite, free plan), https://www.meshy.ai, and rigged there as a four-legged character, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) under section 3.2 of the [Meshy Terms of Use](https://www.meshy.ai/terms-of-use); attribution: "Wolf, generated with Meshy (meshy.ai), CC BY 4.0, https://creativecommons.org/licenses/by/4.0/; modified: the colour, roughness and normal maps of the unrigged model put back on the rigged mesh (the same UV layout) and cut from 2048 to 1024 px; scaled to 0.9 m at the ears; Meshy's walk renamed Walk; Run made from the walk and Idle made from the standing pose in Blender (game/tools/blender/quad_pass.py)".
- `character-wolf-grim.glb`: "Wolf", a dark grey wolf with Idle, Walk and Run, generated with Meshy (Meshy 6 Lite, free plan), https://www.meshy.ai, and rigged there as a four-legged character, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) under section 3.2 of the [Meshy Terms of Use](https://www.meshy.ai/terms-of-use); attribution: "Wolf, generated with Meshy (meshy.ai), CC BY 4.0, https://creativecommons.org/licenses/by/4.0/; modified: the emission input removed (it repeated the colour map) and the colour map cut from 2048 to 1024 px; scaled to 0.9 m at the ears; Meshy's walk renamed Walk; Run made from the walk and Idle made from the standing pose in Blender (game/tools/blender/quad_pass.py)".
