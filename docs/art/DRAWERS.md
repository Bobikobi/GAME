# Drawers: the routes `kit:gen` can draw down

`pnpm kit:gen` is one pipeline: the reference on magenta, the house-style prompt, the picture,
the importer onto the grid and the palette, the manifest line, the gallery. The picture is the
only step that costs model time, and `tools/src/kit/drawers.ts` is the one place that knows how
a route is called. `--drawer <id>` picks it (else `KIT_DRAWER`, else `codex`). The manifest line
says which route drew each image, so a gallery can mix them.

| route | what it is | cost per image, measured or published | what it needs | when |
|---|---|---|---|---|
| `codex` | the Codex agent on its subscription (`codex exec` with the image tool) | 150-250 s, 30k-60k tokens (21.10); median 159 s and 45k tokens over 149 images at the heaviest setting (to 1.11). Since 1.11 it runs on the lightest model at low effort without the user's config (`codexArgs` in `gen.ts`, `KIT_CODEX_MODEL` to change the model); not measured yet, no credits | the `codex` CLI signed in | route by size (DECISIONS 2026-10-22, decision 1): up to about 64 art px a free route (local, kaggle), larger or thin sprites here; stays the CLI fallback; a text route (grid tile, scatter motif) always |
| `local` | Stable Diffusion 1.5 with a pixel-art LoRA (PixelArtRedmond, free, 27 MB) in a ComfyUI on your own machine, image to image from the reference | free and unlimited; on the laptop's CPU 290 s at 512 px and 20 steps (21.10), 94 s at 384 px and 12 steps but speckled and with torn edges, so the defaults stay 512 and 20; seconds on a GPU | ComfyUI up on `COMFYUI_URL` (default `127.0.0.1:8188`); on the laptop, start the local ComfyUI. Tuning: `LOCAL_DENOISE` (0.6, how far from the reference), `LOCAL_STEPS` (20), `LOCAL_SIZE` (512), `LOCAL_LORA`, `LOCAL_CHECKPOINT` | the free route for a wave from our own sprites; a night of best-of-three costs nothing |
| `kaggle` | Open image models with `diffusers` in a **private** Kaggle script kernel on its free GPU, the whole wave in one kernel run (push, poll `kaggle kernels status`, `kaggle kernels output`). Four recipes (`KAGGLE_MODEL`). Image to image from the reference: `sd15` (the default: SD 1.5 with PixelArtRedmond15V at 0.8, Euler, 20 steps, 512 px short side, CFG 7) and `sdxl` (SDXL base in fp16 with the fp16-safe VAE, tiled, and the `nerijs/pixel-art-xl` LoRA, 25 steps, 1024 px short side); both read their own short prompt (`kagglePrompt`), the negative `KAGGLE_NEGATIVE`, a canvas in the reference's shape (multiples of 64, the elder 512x704) and a denoise by subject (props 0.6; characters, `chars/` refs, 0.7 on sd15 and 0.8 on sdxl). Text to image from a sentence (`kaggleSentencePrompt`; the reference only sets the canvas): `flux` (FLUX.1-schnell in NF4, 4 steps, guidance 0) and `qwen` (Qwen-Image 2512 in NF4 with the 4-step Lightning LoRA, computing in fp32), each picture keyed to flat magenta and downscaled to the spec's grid inside the kernel (`KAGGLE_POST`) | free within Kaggle's weekly GPU hours; two GPU kernels at a time per account. Measured 22.10 on a T4: **sd15** 3.5-3.6 s per prop at 512x512 and 5-7 s for the elder at 512x704, plus 95-110 s per wave (25-40 s kernel start and queue, 65-95 s loading the weights), a wave of three about 110 s from push to pictures back; **sdxl** 26-30 s per prop at 1024x1024 and 38-44 s per character at 1024x1408, a wave of three 217-219 s (80-95 s loading about 7 GB of weights). Measured 23.10, waves of ten at 1024x1024: **flux** 19-25 s a picture, 8.4-9.2 GPU minutes a wave (5.2-5.8 of them loading), 9-10 minutes from push to pictures; **qwen** 93-112 s a picture, 19.4-21.9 GPU minutes a wave (3.0-3.8 loading), 21-23 minutes from push to pictures | the `kaggle` CLI signed in (`KAGGLE_CLI` if it is not on the PATH; the token stays the CLI's own) and a phone-verified account for the GPU. Kernel: `KAGGLE_KERNEL` (default `kitgen-drawer` under the signed-in user; a second wave at the same time needs its own name). Recipe: `KAGGLE_MODEL` (`sd15`, `sdxl`, `flux`, `qwen`, or a Hugging Face repo id with `KAGGLE_RECIPE`), `KAGGLE_VAE`, `KAGGLE_LORA_REPO`, `KAGGLE_LORA_FILE`, `KAGGLE_DTYPE` (the compute precision: `fp16`, `bf16`, `fp32`), `KAGGLE_POST` (`grid` or `off`). Tuning: `KAGGLE_DENOISE` (props), `KAGGLE_DENOISE_CHARACTER`, `KAGGLE_STEPS`, `KAGGLE_SIZE` (short side), `KAGGLE_CFG`, `KAGGLE_LORA_STRENGTH`, `KAGGLE_SEED`; `KAGGLE_GPU=0` for a CPU run, `KAGGLE_ACCELERATOR` for the GPU type | a wave from our own sprites at GPU speed for nothing, when the laptop's minutes per picture are too slow; `sd15` for a wave on the grid, `sdxl` to try a richer character, `qwen` for a wave of props and items from the prompt alone, `flux` for the same at a fifth of the drawing time and with more variety between seeds (both drew the right object on the ten entries the Stable Diffusion recipes misread; next section); terms: the kernel and its inputs are private to our own account and only our own sprites go up, so the free-tier rule below holds; a third-party reference still goes down `codex` |
| `gemini` | Google's image model over the Generative Language API, one HTTP call through curl | 10-20 s; **not on the free tier**: the first live run (21.10, a fresh key) answered `RESOURCE_EXHAUSTED ... limit: 0` for every image-model metric, which means no free allocation for image models at all, not a cap reached. A project with billing (Tier 1) pays per image, in the cents; a new billing account starts with trial credit | `GEMINI_API_KEY` from a project with billing; `GEMINI_IMAGE_MODEL` to change the model (default `gemini-2.5-flash-image`) | volume: a wave of props from themselves, best of three in minutes, once the owner puts billing on the project |
| `gemini-web` | Gemini's image tool in the owner's logged-in browser rig, outside the repo: reference images attached, the full-size picture downloaded from the result card | 30-60 s (30.10 probe: a berry bush on magenta, 1408x768) | the owner's Google login in the rig; `GEMINI_WEB_SCRIPT` to point at the rig's script | volume, no key and no billing: one browser, so one call at a time |
| `pixellab` | PixelLab's API (`api.pixellab.ai/v2`, a Bearer token per account): the owner's choice for the world's pieces, the animals, the creatures and the effects (DECISIONS 2026-11-02): a Pro grid sets the level and the rest is filled from it, a figure is fixed to the camera and moved. **Not a `--drawer`**: it runs by `pnpm art:pixellab <spec.json>`, next section | in generations, measured in the 2.11 trial: grid 10, fill 1, keyframes 1, motion 1 at 64 px and 2 at 128 px (a direction), skeleton 3 at 128 px, effect 1 (lite) or 6 (pro), character 2; rotate, rotations8, faithful and outfit have **no measured price yet** and print `?` | a token file per account in the owner's secrets folder, kept outside the repo (`dir` in the pool file, else `PIXELLAB_SECRETS_DIR`), named in `tools/kit-gen/pixellab/pool.json`, and generations on it (every account stood at 0 on 2.11) | the figures at the game's camera and their motions, the Pro grids, fills from a grid: anything the trial priced, once the owner funds an account |

The production line that runs these routes in bulk (pools of entries with a status each, waves cut by a runner, every draft kept, the owner's pick as a recorded action) is planned in [PRODUCTION_LINE.md](PRODUCTION_LINE.md).

Rules that hold for every route:

- **The key lives in the environment**, never in a spec, a log or the repository. The Gemini route
  passes it to curl in a config read from stdin, so it is not on a command line either.
- **A third-party reference does not go down a free tier** whose terms let the provider train on
  the request. Our own sprites may; a crop of someone else's picture goes down `codex`.
- **The route does not change the rules of the picture.** The prompt, the palette decision,
  `ramps`, the importer and the gallery judged by eye are the same (PROP_FROM_REF.md,
  RICH_STYLE_EXPERIMENT.md). A route that returns a JPEG is refused: the importer keys the
  magenta from a PNG.
- **A batch route draws the wave first.** `kaggle` pays minutes to start a kernel, so `kit:gen` sends every
  picture of the spec (grid and scatter entries stay with Codex) in one kernel run before the loop, and each
  entry then imports its own picture as on any other route. Each picture's `seconds` in the manifest is its
  share of the run's wall time; its log names the kernel start, the model load and the drawing apart. A wave
  whose references pass about 900 KB goes up in several runs (`KAGGLE_EMBED_LIMIT`).
- **Live check before trusting a new route:** one `--dry` run, read the prompt; one real image
  of a kit sprite; open the gallery. The Kaggle route's first wave (22.10: the elder, the oak and the axe
  from `trial-32.json`) came back with the magenta kept and crisp pixels; the oak read well, the elder
  split into an old man and a brown animal-like figure. Fixed the same night (next section): with its own
  prompt, a negative prompt and a 2:3 canvas, `sd15` draws one elder on every seed tried. The Gemini route's wire is proven (21.10: the request reached
  the API and its structured answer landed in the gallery as a readable error); its first picture
  waits: no Gemini billing now (DECISIONS 2026-10-22, decision 7).

## Prompts for a Stable Diffusion route: the 77-token window

A Stable Diffusion text encoder (CLIP) reads 77 tokens, start and end marks included, and **cuts the
rest without an error**; diffusers only logs a warning. The first Kaggle wave lost the end of every prompt
that way (the elder's 59 words were past the window: `, flat pure magenta background` never reached the
model), and the prompts carried agent instructions such as "the face about 10 pixels wide with two eye
pixels", which a diffusion model cannot count anyway. Together with a 2:3 character squeezed into a square
canvas and no word against a second figure, the model read the elder's brown coat as a second creature.
What the `kaggle` route does since:

- **Its own prompt** (`kagglePrompt`): the LoRA's trigger words first, then what the sprite is (a
  character is asked for as "one single character alone, full body, front view"), the subject and its
  colours, the spec's detail without pixel or shade counts ("in 3 greens" keeps "green"), and the
  outline, crisp pixels and flat magenta last. Detail goes from the end while an estimate says the
  prompt is near the window. The three sprites measured 55-64 tokens.
- **Never cut silently:** the kernel counts every prompt (and the negative) with the pipeline's own
  tokenizers, both on SDXL, and a prompt past 77 is not drawn: its error reaches the gallery.
- **A negative prompt** (`KAGGLE_NEGATIVE`): multiple characters, two figures, extra figure, animal,
  duplicate, cropped, plus the local route's list.
- **A canvas in the reference's shape** (`kaggleCanvas`): the short side `KAGGLE_SIZE`, the long side in
  proportion, multiples of 64; the reference is padded with its own magenta to that shape, then scaled
  with nearest neighbour, never stretched.
- **Denoise by subject, measured rather than guessed:** a lower denoise for characters (0.45-0.55 on sd15,
  up to 0.6 on sdxl) only hands back the reference's blob with a smeared or blank face; the split was the
  prompt and the canvas, not the denoise. From 0.65 on sd15 the elder comes back as one elder with a face
  (seeds 7, 8, 9 at 0.7: three single figures), and from 0.75 on sdxl. Props keep 0.6.

The `local` route keeps its compact prompt (`localPrompt`) and its settings unchanged; the same lesson
applies to it and is the next step there.

### `sd15` or `sdxl` (22.10, the elder, the oak and the axe on a T4)

- **elder:** `sd15` draws one elder (white beard, brown coat, a staff) on the grid, simple face; `sdxl`
  draws the best elder of any route so far (a real face, long beard, coat and staff), but at a much finer
  pixel than the 32x48 grid, with a dark halo where the reference's outline was and a magenta that is not
  flat (it drifts to purple), which the importer keeps as a purple fringe.
- **oak:** `sd15` as good as the first wave; `sdxl` richer leaves but painterly, a 111x114 grid for a
  64x64 sprite, and purple at the roots.
- **axe:** at 0.6 every recipe hands back the 16x16 reference almost as it was (the importer reads a 14x17
  grid and asks for more detail).
- **Default stays `sd15`**: on the grid, flat magenta, 4-7 s a picture and under two minutes a wave.
  `sdxl` is worth it for a character once its halo and background are dealt with (a downscale to the
  grid and a magenta key in the kernel), at about 8x the drawing time.

### The rich wave by the owner's eye (23.10, 37 items and small props, five rounds)

- **The 16 px sprite is a poor reference for a 64 px redraw.** At denoise 0.6 the picture stays muddy next
  to it; at 0.9 it drifts off the object (an idol became a robot, a coin a blob). Drawing from the prompt
  alone (`KAGGLE_DENOISE=1`, the old sprite only sets the canvas) gave cleaner pictures than any
  reference strength.
- **`sdxl` won every free pick it was offered.** With rewritten prompts (one object, its view, what it is
  not: "no leaves", "no flames"), the owner chose an `sdxl` draw for all eleven entries of the round that
  offered both recipes, and for six of the next sixteen. Of the two, run a wave of props and items with
  `KAGGLE_MODEL=sdxl KAGGLE_DENOISE=1` (`qwen`, next section, now comes first); the code default stays
  `sd15` until the halo and the magenta are dealt with for characters.
- **What the free models misread goes to Codex.** Some objects come back pretty but wrong on every seed
  and every recipe (a branch drawn as food); `--drawer codex` with the kit sprite as the reference and two
  picked draws as `style_refs` drew the right object for each of them, and so did `qwen` and `flux` from the
  prompt alone (next section).

### `flux` and `qwen`: bigger open models from the prompt alone (23.10, the ten hard entries)

The ten entries of the rich wave that went to Codex in its fifth round (a branch, a stone, a bandage, a
sapling, a dig spot, a hazard pit, a fallen log, pebbles, a mossy rock and a small rock: objects the two
Stable Diffusion recipes drew pretty but wrong on many seeds) were drawn again from the prompt alone by two
bigger open models. Both are under Apache 2.0, the LoRA too: the weights may be used and shared
commercially, and nothing in the licence restricts the pictures:

- **`flux`**: FLUX.1-schnell from an ungated mirror of the published weights (`unsloth/FLUX.1-schnell`; the
  original repository asks for a sign-in), its transformer quantized to NF4 on load, 4 steps at guidance 0.
- **`qwen`**: Qwen-Image 2512, its transformer and its Qwen2.5-VL text encoder pre-quantized to NF4
  (`unsloth/Qwen-Image-2512-unsloth-bnb-4bit`), with the 4-step Lightning LoRA
  (`lightx2v/Qwen-Image-2512-Lightning`) and its scheduler, no CFG.

How they run on a T4 (`kaggleKernelScript`, `draw_from_prompt`):

- **Two phases, so the card never holds both halves.** The text encoders load alone (on the second T4 when
  the session has two), count and encode every prompt of the wave, and are freed; then the transformer loads
  in NF4 and draws from the stored embeddings.
- **The precision is the recipe's (`KAGGLE_DTYPE`).** A T4 has no fast bf16: a matrix product measured 7.3
  TFLOPS in fp16, 3.9 in fp32 and 2.2 in bf16. `flux` computes in fp16. Qwen-Image cannot: its activations
  pass fp16's ceiling of 65504 from the second transformer block on (attention values above 30000 in nearly
  every block, a LoRA input at 74752), and the picture comes back black. So `qwen` keeps its weights in 16
  bits and computes in fp32 (`compute_in_fp32`: the 4-bit layers, the plain layers and the norms; the LoRA in
  bf16, whose range holds where fp16's does not), and its VAE decodes in fp16. A picture that still comes
  back black is an error that names the precision, never a black sprite in the gallery.
- **Prompts are sentences** (`kaggleSentencePrompt`): what the sprite is, the spec's detail whole, one
  object alone and centred in its view, crisp pixels and a dark outline, a flat magenta background with no
  ground shadow. The token check is per pipeline, with its own tokenizer and real window: 512 for Qwen, 256
  for FLUX's T5 (its CLIP encoder only adds a pooled summary and reads the first 77). The ten prompts
  measured 82-100 T5 tokens; none was cut.
- **The post-process** (`KAGGLE_POST=grid`, the default for both): the background is keyed to flat #FF00FF
  (everything joined to the border that is near its median colour, magenta-like, or a darker shade of it
  such as a ground shadow; neither model draws a flat #FF00FF, FLUX's magenta is a deep pink), a small speck
  far from the subject is dropped (a part under a hundredth of the largest, outside the big parts' box), and
  the subject is cropped, fitted to the spec's art grid with a margin of one art pixel in 32 and downscaled
  with nearest neighbour, at 8 screen pixels per art pixel so the importer finds the grid exactly and imports
  at 1:1. The picture before it stays in the kernel's output as `<name>.full.png`. `sd15` and `sdxl` keep
  `KAGGLE_POST=off` so their pictures do not change unasked; `KAGGLE_POST=grid` turns it on for them.

Measured on two T4s, waves of ten pictures at 1024x1024, three seeds each (GPU minutes are the kernel's
run, which Kaggle counts against the weekly hours):

| recipe | a picture | GPU minutes a wave of ten (loading) | push to pictures | memory | right object |
|---|---|---|---|---|---|
| `flux` | 19-25 s | 8.4-9.2 (5.2-5.8) | 9-10 min | 6.9 GB | 30 of 30 draws, all ten entries |
| `qwen` | 93-112 s | 19.4-21.9 (3.0-3.8) | 21-23 min | 12.7 GB, 14.7 at the peak | 29 of 30 draws, all ten entries (nine on every seed) |

The loading is the kernel's start to the first picture: installing bitsandbytes, the text encoders and the
wave's encoding (about two minutes for either), then the transformer. FLUX's is the longer, as it downloads
its transformer in bf16 and quantizes it on load; Qwen's checkpoint is quantized already. Kaggle's 30 GPU
hours a week hold about 200 `flux` waves of ten, or 90 of `qwen`.

By entry, judged by eye on the three seeds (the gallery shows each next to the kit sprite, the Codex draw
and the best `sdxl` draw):

- **branch**: `flux` 3 of 3, one stick, but thin on seed 1 and without the small fork; `qwen` 2 of 3, seed 1
  drew two crossed sticks, seeds 2 and 3 one forked stick.
- **stone**: both 3 of 3, one smooth grey rock (`qwen` draws the chips as small stones at its foot).
- **bandage**: both 3 of 3, a white roll with a loose strip; `flux` seed 1 has lavender rings from the
  magenta.
- **sapling**: both 3 of 3; `flux` a thin young tree, `qwen` a round crown and two leaves on a stem in soil.
- **dig_spot**: both 3 of 3, a low heap of loose earth; `qwen` keeps the dark clods and small stones,
  `flux`'s earth is reddish.
- **hazard_pit**: both 3 of 3, a dark opening with an earth rim; `flux` seed 3 drew the rim in the
  background's pink.
- **log_fallen**: both 3 of 3, a horizontal trunk with a pale cut end; `flux`'s is thin and keeps a purple
  strip of ground shadow on two seeds.
- **pebbles**: both 3 of 3 the right object; `qwen` spreads rounded pebbles apart as asked on every seed,
  `flux` only on seed 1 (then angular stones packed close, and a small heap).
- **rock_mossy**: both 3 of 3; `qwen` puts a thick moss cap on every seed, `flux` only on seed 3.
- **rock_small**: both 3 of 3; `flux` draws it low, `qwen` a rounded cracked stone taller than asked.

**For props and items, `qwen` first.** Both models drew the right object on every entry the Stable
Diffusion recipes misread. `qwen`'s pictures are the closest to the house look and to the Codex picks (a
thick dark outline, the subject filling the grid, the spec's detail kept: the moss cap, the clods, the
chips) and barely change between seeds, so one seed an entry is the wave, about two GPU minutes a picture.
`flux` costs under one GPU minute a picture and varies more between seeds, which suits a best of three, but
draws a thinner outline, keeps a pink cast and some ground shadow (a purple strip under a log or a rock),
and sometimes a thin subject. Run `KAGGLE_MODEL=qwen KAGGLE_DENOISE=1` for a wave of props and items, or
`KAGGLE_MODEL=flux` for a fast first look; the code default stays `sd15`, and the look is the owner's pick
from the gallery.

Left open:

- **`qwen` draws on one T4** while the second only encodes; a copy of the transformer on each card would
  about halve a wave's drawing time.
- **The importer warns "drawn on a coarser grid"** on nearly every picture of these two recipes (58 of 60):
  `gridWarnings` compares the subject's box with the grid on both axes, so a subject that is not square,
  fitted on its long side, reads as coarse. The pictures are on the spec's grid exactly (8 screen pixels to
  the art pixel); the warning is a false alarm there, and a check on the long side only would not raise it.
- **The speck filter came after the measured waves.** Replayed on their 60 full pictures, it changed four
  fits: `flux` seed 3's pebbles grew from a small heap off to one side to the whole grid, and three others
  lost a few stray pixels at the edge. The gallery shows the fits as measured.
- **A shadow in another hue stays.** The shade key takes a darker shade of the background's own colour and
  nothing else; FLUX's purple ground shadows are partly kept, and a wider key ate FLUX's reddish earth in a
  trial, so it stays narrow.
- **From the prompt alone the canvas follows the ASKED size, not the old sprite's (27.10).** `kaggleCanvas`
  read the reference PNG, so a 192x320 tree or cottage with a 32x32 reference was drawn on 1024x1024 and came
  back 180x170 art pixels, and a 64x160 stone drawn on 1024x1856 came back 60x99. `kaggleCanvasFor` takes the
  spec's grid (width x height) when the recipe draws from the prompt (`qwen`, `flux`) or the denoise is 1, and
  keeps the reference's shape for image to image: the cottage and the oak are now drawn on 1024x1728 and the
  stone on 1024x2048 (the long side stays at twice the short one). Same seed, the stone came back 60x108; the
  cottage 180x188, because the model draws it as wide as it is tall, which no canvas changes.
- **The background key drops a glow, and the hue band was measured and left out (27.10).** The model paints a
  soft wedge or halo of warm light on the magenta (`house_small`, `market_stall`); it is nowhere near the
  background's colour, so the key kept it and the importer drew it as a coloured patch (2868 pixels of the
  cottage's 21568, and it widened the box the sprite is fitted to). `clearGlows` in `import.ts` floods from the
  cleared background through pixels that are not the dark outline and a smooth step apart, and clears a region
  only when it is small, holds a block (not a halo ring), a narrow colour range, and is open to the
  background along 0.3 or more of its rim (a glow measured 0.65-0.73, a body entered through a gap in its
  outline 0.01-0.02). Replayed on 45 imports of 39 raws, 41 stayed pixel-identical; the 4 that changed are the two glow
  pictures, each imported with two anchors, which lost their wedge. A hue band of 20 degrees around the background's hue changed all 50 of the first set (it takes
  the blended fringe pixels around every outline), so it was dropped.
- **The negative prompt adds `glow, vignette, light rays, halo`** (`KAGGLE_NEGATIVE`, still inside the 77
  tokens of the Stable Diffusion encoders). On the same seed the cottage still came back with a round halo of
  light above its roof, a smaller one than the wedge, so the words help but the importer's key stays the guard.

## The pick feeds the next round

The owner's pick used to live in the owner's head and in DECISIONS prose, so every round of "best of three" began
from three blind seeds. Two small pieces close the loop, and neither adds a second record of a pick:

- **The picks manifest is the record.** `tools/kit-gen/rich-wave.manifest.jsonl` has one line per picked image
  (`picked`, `drawer`, `seed`, `model_key`, `round`). `kit:gen` reads it (`--picks <manifest.jsonl>`, default that
  file; `--no-picks` ignores it) and draws an entry that has a pick again from the picked draw's **seed** (kaggle and
  local) and, on kaggle, its **recipe** (`model_key`: `sdxl`, `flux`, `qwen`). A recipe set by `KAGGLE_MODEL` or
  `KAGGLE_RECIPE` wins over the picked one; the seed still carries. A seed means something only on the route that
  drew it, so a pick from another route changes nothing. An entry with no pick is drawn as before, and entries
  that pick different recipes go up in separate kernel runs (a kernel loads one model). `--dry` prints a
  `pick of <date>: seed, recipe` line for each entry that carries one. The manifest itself is never written by
  tools: `content/kit/core/kit.json` cites its lines by number.
- **One run with the pick, one with a new seed.** Run the wave once as it is (the picked seed is drawn again, a
  safe baseline), then once with `--no-picks` and a new `KAGGLE_SEED`, and compare the two in the gallery: two
  draws replace three blind seeds. A new winner is recorded in the picks manifest the way the earlier ones were.
- **The rule of two.** `pnpm kit:notes --runs <run manifest.jsonl>... <spec.json>` reads the manifests of earlier
  rounds (`.scratch/kit-gen/<spec>/manifest.jsonl`). A warning that came back on two or more draws of one entry
  (numbers ignored) becomes a clause in that entry's `notes`; a warning seen once is noise and is not copied. The
  importer's two grid warnings become the advice they end in (`more fine detail`, `fewer, bigger details`); any other
  warning is kept as it is. Existing notes stay, nothing is added twice, and a spec with nothing new is not
  rewritten. Read the notes before the next run: a warning that is a known false alarm on a recipe (the coarse-grid
  one on `flux` and `qwen`, above) is not worth a clause, and the spec is yours to edit.
- **Notes ride last.** Every prompt builder (`buildPrompt`, `kagglePrompt`, `kaggleSentencePrompt`, `localPrompt`)
  appends `notes` after the entry's own `detail`, so a prompt cut to the 77-token window loses them first.

## What is free, honestly

The `local` route: your own machine, open weights, no key, no terms on the request. Its price is
time (minutes per image on a CPU) and a weaker read of the reference than the two cloud models:
it draws in the style well and keeps the composition at `LOCAL_DENOISE` 0.6, and loses small
features sooner. The first picture (21.10, the oak from `trial-32.json`) came back a richer tree
with the magenta kept and crisp pixels; the importer judged it like any other. The AI Studio
web page also draws for free by hand (paste the prompt `--dry` wrote, attach the reference,
download the PNG, `pnpm kit:import` it): fine for a few objects, not for a wave. The Codex route
costs the subscription already paid.

The `kaggle` route: open weights on Kaggle's GPU (the local route's SD 1.5 and LoRA, SDXL with a
pixel-art LoRA, FLUX.1-schnell, or Qwen-Image with its Lightning LoRA; the last three under Apache 2.0),
a private kernel on our own account, no key in the repository (the CLI keeps its token).
Its price is the weekly GPU hours Kaggle gives a verified account and a few minutes of kernel start per
wave, so it pays from a wave of a few pictures up. Its pictures differ from the local route's: its own
prompt, negative, canvas and character denoise (above), and the noise differs, so a seed does not give
the same picture on both.

The local install (the laptop, 21.10): ComfyUI cloned under a local tools folder on the laptop, with a
Python 3.12 venv (uv) and CPU torch; `models/checkpoints/v1-5-pruned-emaonly.safetensors` (SD 1.5,
4.3 GB) and `models/loras/PixelArtRedmond15V.safetensors` from Hugging Face, both free downloads;
`comfyui.sh start|stop|status` listens on 127.0.0.1 only. A LoRA trained on our own sprites is
the step that makes this route the best of the three; it needs a GPU for a few hours, rented or
overnight.

## Drafts are kept: the index and the drafts repo

Every picture a draw makes is kept and cited (DECISIONS 2026-10-23; [REUSE.md](REUSE.md); [PRODUCTION_LINE.md](PRODUCTION_LINE.md) section 3). Wave 3 of the plan builds the record. The code is `tools/src/art/drafts.ts`, the command `pnpm art:drafts`.

- **The index is `tools/kit-gen/drafts.jsonl`, in this repo, append-only.** One line per draft. The id is the first 16 hex of the SHA-256 of its raw PNG, so identical bytes are one draft and every run or study that made them is a `sources` entry on it. A line carries: `pool`, `name`, `spec`, `round`, `route`, `recipe` and `model_version`, `seed`, `denoise`, `canvas` (what the model drew on) and `asked` (what the spec wanted), `ramps`, `prompt`, `negative`, `warnings`, `errors`, the kernel `run` (its id and its own total GPU seconds), `files` (hash and size of the three files), `stored`, `review` (`unreviewed` on arrival, then REUSE.md's states) and `looks_like` once someone writes it. A field that is not known is `null`; nothing is invented, and a `provenance` note on the source says what was reconstructed.
- **Nothing in the file is rewritten.** What is learned later (where the files are stored, a review, a `looks_like`, one more source) is a second line for the same id with `"amend": true` and only the changed fields; reading folds the lines by id. `pnpm art:drafts verify --base origin/develop` checks that develop's file is a prefix of the branch's (`indexGrewOnly`); a CI step that runs it is the owner's to add.
- **`kit:gen` appends as it imports.** One call where the run's manifest line is written (`noteDraft`): a line with a picture gets its draft line, a failed draw gets none, a failed import keeps the picture with its error. It never stops a run. `.scratch/kit-gen/<spec>/manifest.jsonl` stays the run's own log, and the kernel's seed, canvas, denoise and total seconds are read from the run folder's `kaggle/<run>/` files, so `drawers.ts` is untouched.
- **The GPU meter is the index.** Each draft repeats its kernel run's total seconds, so a weekly sum counts a run once (`gpuSecondsSince` groups by run id), never the per-picture shares.

**The pictures are in `Bobikobi/GAME-art-drafts`** (private, never deleted), one GitHub release per kernel run, tag `run-<YYYYMMDD>-<6 hex of the run id>`; a draft with no kernel run goes under `run-<YYYYMMDD>-<route>`, and the drafts of before the index under `run-backfill-<source>`. A draft has up to three assets named by its id: `<id>.png` (the raw picture, what the importer read), `<id>.full.png` (the kernel's picture before the grid, when `KAGGLE_POST=grid` kept one) and `<id>.imported.png` (what the importer made). `stored` in the index cites the tag and the asset names and `files` the hashes, so a draft found in the index is found in the repo. GitHub holds at most 1000 assets in a release: a push counts what the release already holds and rolls on to `-2`, `-3` when it is full, a draft's files always in one release.

| Command | What it does |
|---|---|
| `pnpm art:drafts push <run folder> --label <source>` | Indexes the run folder's drafts (if `kit:gen` has not) and uploads the files that are not stored yet, one release per run, then writes `stored` into the index. Never overwrites an asset. A folder of loose pictures (a study) works too: `--route`, `--pool`, `--provenance`; a `<stem>.json` beside a picture may carry `{prompt, tool, date, seed}`. `--no-upload` indexes only, `--dry` counts. |
| `pnpm art:drafts fetch [ids\|--all]` | Fills the local cache `.scratch/art-drafts/` (`<id>.png`, `.full.png`, `.imported.png`), only what is missing. The gallery reads this cache. |
| `pnpm art:drafts verify [ids] [--base <ref>]` | Re-hashes every cached or fetchable draft against the index; exit 0 when all match, else the mismatches and the missing files. A draft not pushed yet is listed and fails only with `--strict`. `--no-fetch` checks the cache alone. |
| `pnpm art:drafts annotate-wrong-draws`, `view wrong-draws [--write]` | The wrong-draws library as a view: each PNG listed in `docs/art/wrong-draws/library.jsonl` is matched by hash to its draft, which gets `looks_like`, review `archive` and the keep note; `view` prints the drafts that have a `looks_like` in the library's shape, `--write` writes the file. The library gains no more PNGs. |
| `pnpm art:drafts stats` | Counts by route, review and source; bytes; releases. |

A draw in `.scratch` is not an archive (REUSE.md): once a run is finished, `push` it, and the folder may go.

## The PixelLab route: `pnpm art:pixellab`

The trial of 2.11 ran in throwaway scripts; this is the route those scripts became (Issue #659, DECISIONS 2026-11-02, [ANIMATION.md](../design/ANIMATION.md) 3.1). Code in `tools/src/art/pixellab/` (`api`, `recipes`, `pool`, `ledger`, `run`, `cut`) and `tools/src/art/pixellab-cli.ts`; tests `tools/test/art-pixellab.test.ts`, which run the whole route against a fake API and fail on any call to the real one.

```bash
pnpm art:pixellab tools/kit-gen/pixellab/wenna-down-1.json --dry-run     # balances only; prints the estimate; writes nothing
pnpm art:pixellab <spec.json> --max-generations 6 --only faithful          # a live run, capped, one job
```

Flags: `--dry-run`, `--max-generations N` (a hard cap for the run), `--only id,id` (a job reads the pictures its inputs already made in the ledger), `--no-push` (pictures stay on disk, nothing goes to the drafts store), `--retry-paid` (run again a job that failed after it was charged: it is charged again).

**A generation is the owner's money.** The route spends subscription generations only; the USD credit on an account is shown and never spent, and a response that reports `usage.usd` over 0 stops the run. The only call a dry run makes is `GET /balance`.

### The spec

```json
{ "name": "wenna-down-1", "out": ".scratch/pixellab/wenna-down-1", "label": "pixellab-wenna-down-1", "provenance": "...",
  "jobs": [ { "id": "camera", "recipe": "rotate", "inputs": { "from_image": "@faithful", "size": 128, "from_view": "side", "to_view": "high top-down" }, "seed": 7, "account": 0, "note": "..." } ] }
```

A job has an `id` (letters, digits, `-`, `_`), a `recipe`, its `inputs`, and optionally a `seed` (else one is derived from the job's key, so the same new job draws the same picture), an `account` (pins the job to a pool index) and `allow_strong_init`. A picture input is a path (relative to the spec) or a reference to another job: `@id` (its first picture), `@id#2`, `@id#*` (all of them), `@id.character` (the stored character a `character` job made). Jobs run in dependency order; a circle is refused before anything runs. Pictures land in `<out>/<id>/<id>[-NN].png` (animations `<id>-<direction>-NN.png`), each with a `<stem>.json` beside it holding `{prompt, tool, date, seed}`, which the drafts store reads. `answer.json` in a job's folder keeps what the server said (picture data elided), written before anything is downloaded.

| recipe | endpoint | generations | notes |
|---|---|---|---|
| `grid` | `generate-image-v2` (Pro) | 10 (measured) | `cell` or `size`; the API returns separate pictures, 64 at 32 px, 16 at 64, 4 at 128, 1 above 170 (its own table, `gridVariants`); a sheet that comes back whole is cut by connected components (`cut.ts`, the trial's `cut.py`) |
| `fill` | `create-image-pixflux`, up to 400 x 400 | 1 (measured) | `view`, `outline`, `shading` and `detail` are always sent (defaults `high top-down`, `lineless`, `detailed shading`, `highly detailed`) |
| `keyframes` | `animate-with-text-v3`, first and last frame | 1 (measured) | the trial's strongest finding; pixel budget `w * h * frames` at most 524288, 4 to 16 frames |
| `motion` | `animate-character` mode `v3` | 1 a direction at 64 px, 2 at 128 (measured) | on a stored character; frames collected by `animation_group_id` |
| `skeleton` | `animate-character` mode `skeleton-v3` | 3 a direction at 128 (measured) | minutes a direction |
| `effect` | `vfx` | lite 1, pro 6 (measured) | the response's `quoted_generations` is compared and a difference is printed |
| `character` | `create-character-v3` | 2 (published formula) | from a reference `ceil(w*h*8/65536)`, from scratch `1 + ceil(s*s*8/65536)`; belongs to the account that made it |
| `rotate` | `rotate` | **unknown** | `from_view` / `to_view` are `side`, `low top-down`, `high top-down`: there is no 50 degree setting, so the result is judged by eye in the scene |
| `rotations8` | `generate-8-rotations-v3` | **unknown** | |
| `faithful` | `image-to-pixelart`, `fixer` true | **unknown** | |
| `outfit` | `transfer-outfit-v2` | **unknown** | frames per call: 15 at 32-64 px, 8 at 65-80, 3 above |

An unknown price is never 0: the dry run prints `?` and says "at least N, no upper limit until the first real call", a live run with an unknown job needs `--max-generations`, and unknown jobs run first and alone. The first live call of a recipe writes what it really cost to the ledger and from then on the estimate is that number (the median of the exact measurements).

Sizes are checked against the API's limits before anything is sent (`pixflux` 400, `rotate` 200, character and outfit 32 to 256, the Pro grid 792 x 688).

**A `fill` from a picture at a strength over 150 is refused**, and so is one with no strength given (the API's own default is 300). A strong init copies the picture and ignores the prompt: two generations were lost that way on creature sheets (2.11). The owner's recipe is the one exception, a Pro grid of the *same* thing as the init at strength 250, which gave quantity for one generation: say so on the job with `"allow_strong_init": true`. Do not remove the guard because that recipe needs the flag.

### Accounts

`tools/kit-gen/pixellab/pool.json` lists the accounts in a fixed order, each with a token file in the owner's secrets folder (outside the repo), a label, a `plan` (`paid` or `free`; an account that does not say is paid) and a number of `slots` (jobs at once: a trial account has one animate slot and answers 429 "Not enough concurrent job slots" past it; tier 2 allows 10). The position in the list is the account's index everywhere (the ledger, `account` in a spec), never the file's position in a sorted listing. A missing token file is an account that is skipped, said once. The token is read inside the code, goes to one header for `api.pixellab.ai`, and is scrubbed from every error text; it is never in the ledger, a log line or a test. `nightly: true` marks an account the nightly job may spend on; only a `free` account can carry it, and `parsePoolConfig` refuses a config that marks a paid one. On 2.11 `trial1` is the paid account (tier 2, 5,000 generations, 10 at once); `current`, `trial2` and `trial3` are free.

The pool reads each balance once, then gives a job to the account with the fewest generations that still covers it, so the small accounts are used up first. A character belongs to the account that made it: a `character` job is placed where the motions that use it fit as well (they would be stranded otherwise), and each motion is pinned to that account and blocked, with the reason, if it has no room. Pictures cross accounts freely (a `keyframes` job reads a picture made anywhere). A 429 waits and tries again with growing pauses (10, 20, 30 s, up to 30 minutes), it does not fail the job.

### The ledger and resuming

`tools/kit-gen/pixellab-ledger.jsonl` is append-only (`merge=union` in `.gitattributes`) and a write-ahead log: a line `started` before a job is posted, `submitted` when the server has taken it (with its ids), `done` when its pictures are on disk, `failed` or `ambiguous` otherwise. A line carries the job's key (`<spec>/<job>#<hash>`, the hash covering the recipe, the inputs with a picture by its bytes, the seed, the pin and what the job reads, so an edited job is a new job), the account's index and label, the balance before and after, generations spent, seconds, files, and the key structure of the first answer of each recipe (`shape`, no picture data). Never a token.

- `done` is skipped; its pictures are read from disk for the jobs that follow.
- `submitted` is never posted again: the run polls the job and collects it. A motion charged and then lost on a download that kept resetting is collected on the next run from `/characters/{id}`, by its animation group, and nothing is paid twice. Any trouble after the server took the job (a timeout, a failed download, an answer that could not be read) leaves it `submitted`; only a job the server itself reports failed ends as `failed`.
- A post that may or may not have been accepted (the network dropped, a 5xx) is checked against the balance: charged means the line is `ambiguous` and the run stops that job; not charged means it is tried again, twice. A later run that finds `started` with no `submitted` and a balance that fell since stops and says so; it never posts blind.
- `spent` is before minus after and exact only when one job was in flight on the account; otherwise it is recorded as shared (`exact: false`, `spent: null`) and not used as a measurement.

### Dry run

`--dry-run` validates the spec fully (sizes, files, dependencies, the fill guard), reads each `/balance`, simulates which account would take which job and prints the estimate per account and in total, with `?` for what no one has measured. It writes no ledger line, no drafts line and no file. It exits 1 when the spec is wrong or no account could pay, which with every account at 0 is the expected state until the owner funds one.

### What is not proven

The 2.11 trial's answer folders are gone, so the response shape of most endpoints is read tolerantly (a picture is found wherever the answer keeps it) and the ledger records the key structure of the first answer of each recipe. The prices above marked unknown, the `from_view`/`to_view` behaviour at the game's camera and whether `faithful` accepts a transparent background are all settled by the first real calls, run one job at a time (`--only`) with `--max-generations`.

### Reducing a draft: `pnpm art:reduce`

`pnpm art:reduce <picture | folder> --height N | --width N [--colours N] [--frame N] [--no-key] --out <file | folder>` is the clean reduction every draft goes through before it is set beside the game's pictures (`tools/src/art/reduce.ts`, a port of the trial's `cut` and `small`): the magenta key (R>150, G<110, B>150) goes clear with one pass of erosion (only when the picture has a key), the crop is to what is opaque, the scale is a box filter on premultiplied alpha, alpha is hard (opaque above 127), and the opaque pixels are cut to at most 48 colours by a median cut with no dither and **no snap to the core palette** (`--colours 0` keeps every colour). `--frame N` stands the result bottom-centred on an N x N transparent square. It is deterministic. Against the Python of the trial on four drafts the sizes match, under 1 % of the alpha pixels differ and the mean colour difference is about 5 of 255 (the two median cuts differ in their ties).

## Routes not built, and what each would take

- **Hugging Face Inference** (free tier, rate limited): image-to-image on an open model such as a
  pixel-art-tuned Stable Diffusion. One `Drawer` posting the PNG and the prompt; quality below the
  two above for this task, and the model choice is a style pick for the owner.
- **Flux, Qwen-Image or SDXL on the laptop**: the `local` route with a bigger model (`LOCAL_CHECKPOINT`,
  `LOCAL_LORA`); several times slower on a CPU, so it waits for a GPU. All three run on Kaggle's GPU now
  (`KAGGLE_MODEL=sdxl`, `flux`, `qwen`).
- **OpenAI images** (`gpt-image-1`, paid): the same shape as the Gemini route with another endpoint.

Adding one: a function in `drawers.ts` returning `Drawn`, its id in `DRAWERS`, a row here, a test
of its request and answer parsing with no network.

## Pools and status

The routes above are meant to run in bulk, and the plan for that line is [PRODUCTION_LINE.md](PRODUCTION_LINE.md) (pools of entries with a status each, waves cut from them, every draft kept, the pick as a recorded action). Its wave 2 is built: the pools and the status.

- **The pools** are `tools/kit-gen/pools/ground.json`, `trees.json`, `props.json`, `items.json` and `cast.json`, seeded from the inventory in `docs/art/PRE_RICH_REDRAW.md` in its rank order, at the sizes of `docs/design/STYLE.md` section 1b. Each is a `kit:gen` spec (`parseSpec` reads it, so a wave can be cut from it) with five pool fields: `kit_id` (the sprite it becomes), `rank` (its row in the inventory), `blocked_by` (an open call of the inventory, or the DECISIONS title that holds it), `new` (the kit does not hold the id yet) and `retired` (the DECISIONS title that retired it). The cast is tracked only: the line never draws a character.
- **The status is never written by hand.** `tools/src/art/status.ts` derives it from files, first rule that holds wins: `retired` (the entry says so), `imported` (the kit holds `kit_id` at density 4 at the asked size and its `source.manifest` cites a picks line of that sprite), `picked` (a picks manifest line names it), `drafted` (the drafts index holds a draft of the entry that is not archived: its name, in its own pool when the draft names one; an archived draw is a wrong object and does not count), `missing`. With no `tools/kit-gen/drafts.jsonl` the report says a draft cannot be known.
- **`pnpm art:status`** prints one line a pool (counts by status), what blocks, the drafts of each pool by review state (archived ones included), the GPU minutes of the last seven days (each kernel run's own seconds counted once, from the drafts index; Kaggle documents no weekly reset day, so the window rolls), and the next missing entries of each pool in rank order (`--next N`, default 5). `--json` gives the same for a tool. It reads and writes nothing.
