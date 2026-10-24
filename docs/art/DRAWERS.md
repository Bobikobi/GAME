# Drawers: the routes `kit:gen` can draw down

`pnpm kit:gen` is one pipeline: the reference on magenta, the house-style prompt, the picture,
the importer onto the grid and the palette, the manifest line, the gallery. The picture is the
only step that costs model time, and `tools/src/kit/drawers.ts` is the one place that knows how
a route is called. `--drawer <id>` picks it (else `KIT_DRAWER`, else `codex`). The manifest line
says which route drew each image, so a gallery can mix them.

| route | what it is | cost per image, measured or published | what it needs | when |
|---|---|---|---|---|
| `codex` | the Codex agent on its subscription (`codex exec` with the image tool) | 150-250 s, 30k-60k tokens (21.10) | the `codex` CLI signed in | the default; a text route (grid tile, scatter motif) always |
| `local` | Stable Diffusion 1.5 with a pixel-art LoRA (PixelArtRedmond, free, 27 MB) in a ComfyUI on your own machine, image to image from the reference | free and unlimited; on the laptop's CPU 290 s at 512 px and 20 steps (21.10), 94 s at 384 px and 12 steps but speckled and with torn edges, so the defaults stay 512 and 20; seconds on a GPU | ComfyUI up on `COMFYUI_URL` (default `127.0.0.1:8188`); on the laptop `~/ceos-server/scripts/comfyui.sh start`. Tuning: `LOCAL_DENOISE` (0.6, how far from the reference), `LOCAL_STEPS` (20), `LOCAL_SIZE` (512), `LOCAL_LORA`, `LOCAL_CHECKPOINT` | the free route for a wave from our own sprites; a night of best-of-three costs nothing |
| `kaggle` | Stable Diffusion with `diffusers` in a **private** Kaggle script kernel on its free GPU, image to image from the reference, the whole wave in one kernel run (push, poll `kaggle kernels status`, `kaggle kernels output`). Two recipes: `sd15` (the default: SD 1.5 with PixelArtRedmond15V at 0.8, Euler, 20 steps, 512 px short side, CFG 7) and `sdxl` (`KAGGLE_MODEL=sdxl`: SDXL base in fp16 with the fp16-safe VAE, tiled, and the `nerijs/pixel-art-xl` LoRA, 25 steps, 1024 px short side). Both read their own short prompt (`kagglePrompt`), the negative `KAGGLE_NEGATIVE`, a canvas in the reference's shape (multiples of 64, the elder 512x704) and a denoise by subject (props 0.6; characters, `chars/` refs, 0.7 on sd15 and 0.8 on sdxl) | free within Kaggle's weekly GPU hours; two GPU kernels at a time per account. Measured 22.10 on a T4: **sd15** 3.5-3.6 s per prop at 512x512 and 5-7 s for the elder at 512x704, plus 95-110 s per wave (25-40 s kernel start and queue, 65-95 s loading the weights), a wave of three about 110 s from push to pictures back; **sdxl** 26-30 s per prop at 1024x1024 and 38-44 s per character at 1024x1408, a wave of three 217-219 s (80-95 s loading about 7 GB of weights) | the `kaggle` CLI signed in (`KAGGLE_CLI` if it is not on the PATH; the token stays the CLI's own) and a phone-verified account for the GPU. Kernel: `KAGGLE_KERNEL` (default `kitgen-drawer` under the signed-in user; a second wave at the same time needs its own name). Recipe: `KAGGLE_MODEL` (`sd15`, `sdxl`, or a Hugging Face repo id with `KAGGLE_RECIPE`), `KAGGLE_VAE`, `KAGGLE_LORA_REPO`, `KAGGLE_LORA_FILE`. Tuning: `KAGGLE_DENOISE` (props), `KAGGLE_DENOISE_CHARACTER`, `KAGGLE_STEPS`, `KAGGLE_SIZE` (short side), `KAGGLE_CFG`, `KAGGLE_LORA_STRENGTH`, `KAGGLE_SEED`; `KAGGLE_GPU=0` for a CPU run, `KAGGLE_ACCELERATOR` for the GPU type | a wave from our own sprites at GPU speed for nothing, when the laptop's minutes per picture are too slow; `sd15` for a wave on the grid, `sdxl` to try a richer character; terms: the kernel and its inputs are private to our own account and only our own sprites go up, so the free-tier rule below holds; a third-party reference still goes down `codex` |
| `gemini` | Google's image model over the Generative Language API, one HTTP call through curl | 10-20 s; **not on the free tier**: the first live run (21.10, a fresh key) answered `RESOURCE_EXHAUSTED ... limit: 0` for every image-model metric, which means no free allocation for image models at all, not a cap reached. A project with billing (Tier 1) pays per image, in the cents; a new billing account starts with trial credit | `GEMINI_API_KEY` from a project with billing; `GEMINI_IMAGE_MODEL` to change the model (default `gemini-2.5-flash-image`) | volume: a wave of props from themselves, best of three in minutes, once the owner puts billing on the project |

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
  waits for billing on the project.

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
  offered both recipes, and for six of the next sixteen. Run a wave of props and items with
  `KAGGLE_MODEL=sdxl KAGGLE_DENOISE=1`; the code default stays `sd15` until the halo and the magenta are
  dealt with for characters.
- **What the free models misread goes to Codex.** Some objects come back pretty but wrong on every seed
  and every recipe (a branch drawn as food); `--drawer codex` with the kit sprite as the reference and two
  picked draws as `style_refs` drew the right object for each of them.

## What is free, honestly

The `local` route: your own machine, open weights, no key, no terms on the request. Its price is
time (minutes per image on a CPU) and a weaker read of the reference than the two cloud models:
it draws in the style well and keeps the composition at `LOCAL_DENOISE` 0.6, and loses small
features sooner. The first picture (21.10, the oak from `trial-32.json`) came back a richer tree
with the magenta kept and crisp pixels; the importer judged it like any other. The AI Studio
web page also draws for free by hand (paste the prompt `--dry` wrote, attach the reference,
download the PNG, `pnpm kit:import` it): fine for a few objects, not for a wave. The Codex route
costs the subscription already paid.

The `kaggle` route: open weights on Kaggle's GPU (the local route's SD 1.5 and LoRA, or SDXL with a
pixel-art LoRA), a private kernel on our own account, no key in the repository (the CLI keeps its token).
Its price is the weekly GPU hours Kaggle gives a verified account and a few minutes of kernel start per
wave, so it pays from a wave of a few pictures up. Its pictures differ from the local route's: its own
prompt, negative, canvas and character denoise (above), and the noise differs, so a seed does not give
the same picture on both.

The local install (the laptop, 21.10): ComfyUI cloned under `~/ceos-server/tools/comfyui` with a
Python 3.12 venv (uv) and CPU torch; `models/checkpoints/v1-5-pruned-emaonly.safetensors` (SD 1.5,
4.3 GB) and `models/loras/PixelArtRedmond15V.safetensors` from Hugging Face, both free downloads;
`comfyui.sh start|stop|status` listens on 127.0.0.1 only. A LoRA trained on our own sprites is
the step that makes this route the best of the three; it needs a GPU for a few hours, rented or
overnight.

## Routes not built, and what each would take

- **Hugging Face Inference** (free tier, rate limited): image-to-image on an open model such as a
  pixel-art-tuned Stable Diffusion. One `Drawer` posting the PNG and the prompt; quality below the
  two above for this task, and the model choice is a style pick for the owner.
- **Flux locally, or SDXL on the laptop**: the `local` route with a bigger model (`LOCAL_CHECKPOINT`,
  `LOCAL_LORA`); several times slower on a CPU, so it waits for a GPU. SDXL with `nerijs/pixel-art-xl`
  runs on Kaggle's GPU now (`KAGGLE_MODEL=sdxl`).
- **OpenAI images** (`gpt-image-1`, paid): the same shape as the Gemini route with another endpoint.

Adding one: a function in `drawers.ts` returning `Drawn`, its id in `DRAWERS`, a row here, a test
of its request and answer parsing with no network.
