# Animation production route (lane #716, PixelLab main, GPT second)

Python 3 with numpy and Pillow only. Every tool takes its paths as arguments; nothing here knows a home folder, a token or a browser.
Pictures never enter git. The kept figures (`<kept>/<race>/<motion>-<view>/f0..f3.png`, 128 px frames) are read only: they are the keys of every
job and the measure of identity, size and ground row. Run `python3 tools/anim/prod/selftest.py` to see each gate read synthetic frames.

## The route, end to end

1. **Keys.** Copy kept frames into the job's folder. A motion that returns to its stance uses the kept stance (`idle-<view>/f0`) as first and last
   picture; a motion the kept set already holds (chop, fish-cast, punch, kick, jump) is chained from its own consecutive kept frames
   f0 > f1 > f2 > f3 > f0, one job per pair. The back view has only `idle-back`: those jobs start from the first frame alone.
2. **Spec.** `plspec.py` writes a PixelLab spec (recipe `keyframes`, animate-with-text-v3) from a jobs list: `first`, `last`, `frames`, `seed`, `action`.
   **Cost rule** (read from the ledger's before and after balance of 29 jobs, 14.11): a 128 px job costs `ceil(128*128*frames/65536)`
   generations: 4 frames 1, 6 and 8 frames 2, 12 frames 3, 16 frames 4. The art runner's own estimate (1 a job) undercounts, and its printed
   total is wrong whenever jobs run side by side; the server's balance is the truth. So: chains of four-frame jobs, one spec at a time, balance read
   before and after. A job gives frames+1 pictures; the last equals the last key, so a chain keeps pictures 0 to frames-1 of each job.
3. **Wording.** Pose only. Any tool or effect noun in the text, even in a "no ..." clause, brings the thing back: the trial and the first chains drew axes, rods,
   fishing lines, swooshes and a hit flash. The wording that stayed clean: the figure, the pose, "plain empty fists clasped", "sharp pixel edges, no motion blur,
   no trails, nothing else in the picture".
4. **Process.** `process.py` snaps every opaque pixel to the race's kept palette, re-snaps each frame by whole pixels to the kept ground row, and writes
   the frames, `preview.gif` and `clip.json` (the gate numbers). Declare by eye what is the motion: `--bend` (a crouch, a recoil, a reach, a bend),
   `--air` (airborne: exempt from the feet gate), `--effect` (a drawn flash: left out of gate c, written to the manifest), `--loop`, `--loop-from`,
   `--pingpong N` (a hold that loops: frames N.. then back). The first and last frame are always held to the stance height.
5. **Eye.** `sheet.py` makes a numbered contact sheet beside the kept stance. Three yes or no per clip: the planted foot stays on its spot until it lifts;
   the weight moves with the planted foot; identity holds. `verdict.py` writes them and refuses "PASS (eye)" unless all are yes and no gate failed.
   Snapping to the palette hides a swoosh (white turns bone-coloured), so `clip.json` flags detached components and area spikes: look at those frames.
6. **Manifest and page.** `manifest.py` collects every clip (and the motions parked without a clip) into `manifest.json`; `buildpage.py` builds the one-screen
   moving page. The halo is the page's own layer behind the figure, with a switch: black for the skeleton from the owner GIFs' measured rule, white for the elf with
   the same numbers (borrowed, not judged), none for the human.

## Gates (numbers per clip go into the manifest)

(a) lowest-row spread <= 2 px after the whole-pixel re-snap, bob added <= 3 px, airborne frames exempt. (b) worst frame's mean Lab distance to the race's kept palette
<= 18. (c) height within 3 px of the kept stance on every upright frame, first and last at least; declared bend frames are the motion, lowest and highest height written.
(d) the eye, above. (e) a loop (guard, fell, quarry, fish, pickup): mean absolute difference last > first no larger than the largest step between neighbours.
(f) nothing drawn that the figure does not own: in a work motion such a frame is dropped or made again; in a fight motion a flash is written in the manifest's effects.
A clip gets three tries; then it is parked with its reason.

## Known trap

Pillow 12.1.1 on the lane's machine returns NULL from `Image.resize` with NEAREST. `gates.scale` enlarges by `np.repeat`; use it.
