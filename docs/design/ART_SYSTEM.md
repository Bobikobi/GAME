# The art system: the four findings of 20.10, one ladder of stills, and what each stream builds

The owner, 20.10: maximize the graphics, and the agents work by one page. This is that page. The measure is the one decided on 18.10 (DECISIONS "The compass for depth and for characters"): Dimraeth's depth in an open world, Drakantos's characters and animation. The distance to them is in [GAP_DIMRAETH_DRAKANTOS.md](GAP_DIMRAETH_DRAKANTOS.md); the look's rules are in [STYLE.md](STYLE.md). This page does not repeat them. It takes the four findings the agents raised on 20.10, says what each one becomes, gives every new layer its data, its check and its measure, and says who builds it, in what order, and what waits for the owner.

One rule stands over all of it (AGENTS.md): a look is a direction, and a direction is tried as two or three still images at phone size before anything is built. A detail inside a picked direction is polish: iterate, do not ask. Every layer below says which of the two it is.

Already decided, and not reopened here: 64 px per tile and the camera (NEXT 15), the proportions table (STYLE 1b), shadows C, the night at 92% with light pools, lit windows, height T2, the six depth cues (all DECISIONS 2026-10-18), the ground by motif scatter, and the character plan of GAP section 7 (the stills A, B and C of Pell, the animation format, the strip route and its check, the 3D route's trial, one character all the way first).

## 0. The four findings, and what each becomes

| Finding (20.10) | True in | Already decided | What this page adds | Decided by |
|---|---|---|---|---|
| The 32 colours are the ceiling: a reference gives each area its own ramps, and water cannot read as deep in five tones | Materials and regions, yes. 16 to 24 free hues per area, no: the references keep 5 or 6 steps per material and change the ramps between regions | STYLE 2; GAP 7 still C: the 32 stay the core, a character carries its own ramps | Ramps per material and per region, declared in data and checked; the outline in the local colour; the core unchanged (section 3) | Still L1 |
| Scenes are built by code; a reference is composed by hand per screen | For the ground, yes. "Every screen by hand", no: an endless world is not drawn by hand | The valley by hand; stamps and the boathouse (NEXT 19); winding paths (G69); the richness warning per phone window (#204) | Composition rules per window, measured like richness, and hand-composed places at a cadence (section 5) | Polish, plus the first ring's stills already planned |
| A real lighting layer: much of a reference's colour is light, not sprite | Yes | Shadows C, the night and its pools, lit windows, depth cues 1 to 5 | One engine module for both doors: the hour's tint, light sources, shade under cover, with the decided shadows and night inside it (section 2) | Still L2 for the soft pool and the hour's tints; the rest is decided |
| Three or four size grades, and smoke, fire, cloth and dust in motion; today one grade and static | The grades are decided (STYLE 1b, "bigger is open"); motion, yes | Ambient creatures as map data (#205); the reactions' cues | A motion block in the kit, seven kinds the engine runs, creators attach by data (section 4) | Still L3, a one-second loop |

## 1. The ladder of stills: the direction step

One scene, one difference per still, as the sets of 18.10 were made (`frames/2026-10-18-light-and-ground.md`): the square by the elder's house at 19:00, when the last sun, the lamp's pool and the hearth's fire are all in one frame; 390x844 at 3x (1170x2532); the 64 px sprites of the trial where they exist and script-drawn stand-ins where they do not, as 18.10 did.

| Still | Adds | Everything else |
|---|---|---|
| L0 | Nothing: 64 px, the 32 colours, the one outline, shadows C, the night rule, the depth cues | As decided |
| L1 | Colour craft: material ramps of 5 or 6 steps with the hue moving (cooler as it darkens, warmer as it lightens); the outline in the darkest step of the sprite's own ramp; the far bank's meadow in a second region ramp, so the region idea shows | As L0 |
| L2 | The light layer: the hour's tint as a warm wash, light pools in four steps with dither against the decided two, shade at 12% under the canopies | As L1 |
| L3 | Motion, as a one-second loop beside the still: smoke from the chimney, the hearth's flame, the grass swaying, ripples on the water | As L2 |

- The character ladder of GAP section 7 (Pell at 64x96: A as decided, B Drakantos's proportion, C B plus colour craft) is made in the same batch, so the owner sees the world and the character once. L1's ramps are the world's half of C.
- Each pick goes into DECISIONS with its frame. L1 reopens STYLE section 2 (the colours, the outline); L2 reopens section 5 (the pool's steps) and adds the hour table; L3 adds the motion kinds. The rule page changes in the same pull request as the pick, never before it.
- The script that composes the frames goes into the repository this time (`tools/stills/`, proposal), so the next ladder costs a run and not a rewrite, and a still can be re-made when a number changes.
- Who: the art stream (`art` in `streams.json`), which made the 18.10 sets and holds the waves. Waits on: nothing. Wave b of NEXT 15 (the cast) waits for the picks, as GAP section 7 already says; wave a (the ground) goes on in the core ramps (section 3 says why that costs nothing).

## 2. The light layer: one engine module, both doors

Today `game/src/scenes/world.ts` does light by hand in five places: the dusk ramp (`shadeFor`), the warm wash rectangle, the night shade with the lantern's hole, the dapple through the leaves (`buildDapple`), and the colour filter. They become one module both doors call (`game/src/light.ts`, proposal), with the decided shadows (STYLE 4) and night (STYLE 5) inside it, so the sun, the shadows and the pools agree.

- **Inputs:** the hour from the session's clock; the lights (tile, radius in tiles, colour from the fire ramp or paper, flicker); the cover rects (groves and canopies today, roofs when houses return); the day's weather once #215 lands.
- **Outputs, one layer each:** the ambient tint (multiplied), the pools (cut out of the darkness), the shade under cover (multiplied over the cover rects), the cast shadows. Every number is whole art pixels at one alpha, like STYLE section 4, so stills at fixed hours check the build.
- **The hour table lives in data,** not in code: a `light` block in `content/core/params.json` (proposal) with keyed hours and linear steps in whole percent between them: 05:00 a cool wash (`#7cc4ec`, 20%); 08:00 none; 16:30 a warm wash (`#eda83a`, 12%); 19:00 the dusk wash (`#e2533f`, 28%); 20:00 to 05:00 the night as decided (`#172a52`, 92%, the owner's final level in the live game). The pool's steps (2 decided, 4 if L2 is picked), the dither, the cover shade (12%, the strength of cloud shadows, cue 3) and the flicker's rate sit beside them. A pick changes the numbers, not the module.
- **What never dims:** a signal a rule needs stays at least as visible as today: the wolf's eyes, the player's own pool, the fire's stage, the glint, the lantern post. Colour is never the only signal (G29). The module runs behind `RICH.light`; a phone that cannot hold the frame budget drops the layer like the other cosmetics (`?rich=`), and the plain valley still plays.
- **The 3D door** reads the same hour table for its ambient light and the same light list for its point lights, as ratios (STYLE, "Both doors").
- **Tests:** a state test of the table (an hour gives one tint); captures at 08:00, 12:00, 16:30, 19:00 and 22:00 against the table, with the e2e's colour checks fixed in one pass before the proving run (AGENTS.md); frame time at 1440x3120 before and after, in the pull request body.
- **Kind and who:** mechanics inside a decided direction, so it is built now with today's numbers, by one engine session the manager assigns, in the `world.ts` window STYLE already names for the shadows, the night and cues 1 to 5. Its hook in `world.ts` is small; the module is new. Waits on: nothing. L2's pick changes params.

## 3. Palette v2: the rule's new shape

The 32 core colours stay the world's shared colours: the default outline, the UI, skin, fire, the valley's own grounds. What changes is where a sprite may take its other colours from.

- **A ramp** is 5 or 6 steps from dark to light with the hue moving: cooler as it darkens, warmer as it lightens. The core's own ramps (the greens, the water) are the model; a ramp that only changes value is not a ramp and the check says so.
- **Declared, never free.** A kit declares its ramps (`ramps` in the kit file, proposal: id, the steps, what it is for: ground, vegetation, stone, wood, water, cloth, skin, light). A sprite names the ramps it uses; a sprite that names none uses the core only, so every sprite of today is valid unchanged. A creator's kit declares at most four ramps; the review sees them.
- **A region names its ramp set** per ground tag, in the chunk file of NEXT 19 a (a ramp set per chunk, and per region once regions exist). The ground's letters stay canonical and the bake remaps them per region, the way `remapTone` already shifts the meadow's tone, so one drawing of a meadow serves every region and a region's look is a table, not a redraw.
- **The outline** is the darkest step of the sprite's first ramp; `#1b1a2e` where a sprite declares none. This is L1's pick; until it, nothing changes.
- **The check** (`pnpm check`): every pixel of a sprite is in the core or in its declared ramps; a ground tile is in its ramp plus at most two accents (STYLE section 9's proposal becomes real); a ramp's steps rise in value and drift in hue inside a band; a region declares at most six ramps; the bake reports the distinct colours of each phone window and warns above 96 (proposal; the owner makes it an error or not, as with richness).
- **The importer** snaps a generated picture onto the sprite's allowed set, not onto the 32; a `kit:gen` spec names the ramps it draws in.
- **Dyes** are a ramp swap at draw time (GAP section 7): styles and dyes, never gear drawn on the body.
- **Cost:** no redraw. The 64 px waves draw with v2 from their first sprite; wave a's grounds are drawn in the core ramps and remapped per region later; today's 16 px art declares nothing and stays valid.
- **Kind and who:** the schema, the check and the importer are additive mechanics, built now by the art stream as a shared-file pull request first (PARALLEL.md). The outline and the cast's ramps wait for L1.

## 4. Motion: the alive layer

Seven kinds the engine runs once, attached to things by data, like the ambient creatures of #205.

- **The data:** `motion` on a kit sprite, or on a prop placement in the map, as a list of `{kind, at}` with the kind's own few numbers: `smoke` (an emitter at an anchor in art pixels: rate, drift, the grey ramp), `flame` (a strip's frames and a flicker rate), `sway` (amplitude in art pixels and a period, with a phase the wind shares across the screen), `ripple` (dashes drifting on water), `cloth` (a flag or an awning, a three-frame strip), `dust` (on footsteps, with depth cue 4), `leaves` (falling, by region, later).
- **Rules:** behind `RICH.motion`; reduced motion halves every rate and stops sway and ripple (G29); a motion never carries a rule's signal, and a thing that does (the fire's stage, a region's column of smoke) keeps a still form behind `?rich=none`; a cap on live emitters per screen (proposal 12), the farthest paused first.
- **Characters** keep their own half of this: the animation format of GAP section 7 (named clips with a duration per frame, a fixed anchor at the feet, events on frames). One format, `clips` for characters and `motion` for props, so a creator writes both the same way.
- **Measure:** in a one-second capture of the square at least three kinds move; the richness check counts `motion` kinds as movers; frame time holds.
- **Kind and who:** the format is additive mechanics, built now by any builder as a shared-file pull request; the look of each kind waits for L3. The variety stream, which built the ambient life and the stealth cues, hears of it before it is built.

## 5. Composition: by hand where the player stops, by rule in between, measured everywhere

Code draws texture and lays out motifs; it does not compose a screen. The answer is not to draw every screen by hand but to put a hand-composed place at every point where a player stops, to give the generated ground between them the rules a composed screen follows, and to measure every phone window the way richness is measured (`tools/src/richness.ts`, the window of `richness.params.json`, re-measured for the 64 px camera of NEXT 15).

Per window, all proposal, warnings until the owner makes one an error:
- **A focal thing** inside the middle third: a stamp, a prop at least two characters tall, a light, a crossing, or a path bend.
- **A frame:** on at least one edge, two tiles in five are mass (canopy, rock face, water, a building); never on all four, which is a box.
- **A line:** the path inside the window turns at least once (G69 gives it) and its last tile in the window lies within three tiles of the focal thing, or leaves toward it.
- **A rest:** one plain 3x3 of a single ground with no prop and only the ground's base scatter.
- **A rhythm:** a window's prop density differs from both neighbours' by a quarter or more, so dense and sparse alternate.

- **Stamps at a cadence:** from any path tile a stamp or a landmark lies within twelve tiles (proposal). The first ring's boathouse is the first stamp; creators add stamps by pull request (OPEN_WORLD.md D2, NEXT 19's answers).
- **The valley** gets its composition pass inside the reshape of NEXT 19 e, under the one-time exception to G59 (OPEN_WORLD.md, GAME_RULES section 6), judged on the stills of NEXT 19.0; no round of its own.
- **Where it runs:** the check now, beside richness (`tools/src/composition.ts`, proposal), with counts on the valley in its pull request body; the rules enter the ring generator (NEXT 19 b) as constraints when it is built.
- **Kind and who:** the check is mechanics, any builder, now; the generator's side belongs to the open-world stream and waits for 19 a and b.

## 6. Characters

GAP section 7 stands unchanged: the stills A, B and C (made with the ladder, section 1), the animation format and its check, one reference sheet and an eight-pose walk of Pell by the strip route through the consistency check, the 3D route's trial beside it, then one character all the way at a measured budget, then the cast. It is the one place where no amount of drawing by hand reaches the measure without a system.

## 7. What this page does not change

- No number the kernel reads, no rule of GAME_RULES; the kernel never sees any layer here.
- The camera (NEXT 15), the proportions (STYLE 1b), the night's final level (the owner's, in the live game), the 3D door's own look ladder (DECISIONS 2026-10-18, "the environment is the next direction").
- G29: colour is never the only signal and reduced motion is honoured; G22 and G46, the tone line (`TONE.md`, #223).

## 8. The order, who builds what, and the proof

| # | Step | Kind | Builder | Waits on | Proof |
|---|---|---|---|---|---|
| 1 | The ladder L0 to L3, the loop, and Pell A, B, C (section 1) | Direction | The art stream | Nothing | The frames and their note under `docs/design/frames/`; the owner's picks in DECISIONS |
| 2 | The light module with today's numbers, carrying the decided shadows, night and cues 1 to 5 (section 2) | Mechanics inside a decided direction | One engine session, assigned by the manager | Nothing | Captures at five hours against the table; frame time at 1440x3120; `pnpm verify` and the e2e green |
| 3 | Ramps: schema, check, importer (section 3) | Mechanics, shared file first | The art stream | Nothing | Tests; every kit of today passes unchanged |
| 4 | Motion: schema and the seven kinds (section 4) | Mechanics, shared file first | Any builder; the variety stream told | Nothing for the format | Tests; the square's one-second capture |
| 5 | The composition check (section 5) | Mechanics | Any builder | Nothing | Counts on the valley in the body |
| 6 | The picks into STYLE 2 and 5 and params; the ground wave remapped per region (with NEXT 19 i); the cast in L1's craft | Polish after the picks | The art stream | The picks | The waves' stills, one round (STYLE 1b) |
| 7 | The rules in the ring generator and stamps at the cadence | With NEXT 19 b | The open-world stream | 19 a and b | NEXT 19's measures |
| 8 | Characters, GAP section 7 steps 2 to 5 | Mechanics and production | The art stream | The pick of A, B or C | GAP section 7's measures |

Rules for every step: its own pull request off `origin/develop`, never stacked; shared files as PARALLEL.md says (the schema, the check, `assemble.ts`, the `world.ts` window); a look change only after its still is picked; polish inside a pick iterates without asking; the body carries the `pnpm verify` line and the step's measures as PASS or FAIL; a DECISIONS entry "as built" with a `Model:` line closes each step.

## 9. Measurable at the end

- A capture of the square at 19:00 at 1440x3120, laid beside the picked still, differs only in what the pick left as polish (the motifs' layout, the flame's frames).
- A 2K phone holds its frame budget with every layer on; a weaker phone falls back by `RICH` group and still plays.
- `pnpm check` passes every kit under the ramp rule, and reports the composition and richness warnings of the valley and the first ring with counts.
- No signal a rule needs is dimmer than today: the wolf's eyes, the player's pool, the glint, the fire's stage, measured in the e2e.
- Both doors show the same hour, the same lights and the same shadow direction.

## Sources

- The agents' four findings of 20.10, relayed by the owner.
- [STYLE.md](STYLE.md) sections 2 to 7 and 9; [GAP_DIMRAETH_DRAKANTOS.md](GAP_DIMRAETH_DRAKANTOS.md) sections 6, 7 and 9; [OPEN_WORLD.md](OPEN_WORLD.md) section 1.5, G62 and D2.
- DECISIONS 2026-10-18: the compass, shadows C, the night, the six depth cues, 64 px per tile, the ground by motif scatter, the 3D door's cast.
- `docs/team/NEXT.md` sections 15 and 19; `docs/team/PARALLEL.md` (shared files); AGENTS.md (directions as stills).
- `tools/src/richness.ts` and `richness.params.json`; `game/src/config.ts` (`RICH`); `game/src/scenes/world.ts` (`shadeFor`, `buildDapple`, the shade and dusk layers).
