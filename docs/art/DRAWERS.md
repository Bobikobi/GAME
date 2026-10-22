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
| `kaggle` | the `local` recipe (SD 1.5, PixelArtRedmond15V at 0.8, the compact prompt, Euler, denoise, steps, size and CFG the same) with `diffusers` in a **private** Kaggle script kernel on its free GPU, image to image from the reference; the whole wave in one kernel run (push, poll `kaggle kernels status`, `kaggle kernels output`) | free within Kaggle's weekly GPU hours. Measured 22.10 on a T4: 3.7-5 s per picture at 512 px and 20 steps, plus about 90 s per wave (25 s kernel start and queue, 64 s loading the weights); a wave of three took 101 s from push to pictures back, so the route pays from a few pictures up | the `kaggle` CLI signed in (`KAGGLE_CLI` if it is not on the PATH; the token stays the CLI's own) and a phone-verified account for the GPU. Kernel: `KAGGLE_KERNEL` (default `kitgen-drawer` under the signed-in user). Tuning: `KAGGLE_DENOISE`, `KAGGLE_STEPS`, `KAGGLE_SIZE`, `KAGGLE_CFG`, `KAGGLE_LORA_STRENGTH`, `KAGGLE_SEED` (default the local values); `KAGGLE_GPU=0` for a CPU run, `KAGGLE_ACCELERATOR` for the GPU type | a wave from our own sprites at GPU speed for nothing, when the laptop's minutes per picture are too slow; terms: the kernel and its inputs are private to our own account and only our own sprites go up, so the free-tier rule below holds; a third-party reference still goes down `codex` |
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
  from `trial-32.json`) came back with the magenta kept and crisp pixels; the oak reads well, the elder
  breaks up as it does on the local route, since the recipe is the same. The Gemini route's wire is proven (21.10: the request reached
  the API and its structured answer landed in the gallery as a readable error); its first picture
  waits for billing on the project.

## What is free, honestly

The `local` route: your own machine, open weights, no key, no terms on the request. Its price is
time (minutes per image on a CPU) and a weaker read of the reference than the two cloud models:
it draws in the style well and keeps the composition at `LOCAL_DENOISE` 0.6, and loses small
features sooner. The first picture (21.10, the oak from `trial-32.json`) came back a richer tree
with the magenta kept and crisp pixels; the importer judged it like any other. The AI Studio
web page also draws for free by hand (paste the prompt `--dry` wrote, attach the reference,
download the PNG, `pnpm kit:import` it): fine for a few objects, not for a wave. The Codex route
costs the subscription already paid.

The `kaggle` route: the same open weights on Kaggle's GPU, a private kernel on our own account, no
key in the repository (the CLI keeps its token). Its price is the weekly GPU hours Kaggle gives a
verified account and a few minutes of kernel start per wave, so it pays from a wave of a few pictures up.
The pictures should match the local ones in style (same weights, prompt and numbers; the noise differs,
so a seed does not give the same picture on both).

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
- **Flux or SDXL locally**: the `local` route with a bigger model (`LOCAL_CHECKPOINT`, `LOCAL_LORA`,
  e.g. `nerijs/pixel-art-xl`); better hands, several times slower on a CPU, so it waits for a GPU.
- **OpenAI images** (`gpt-image-1`, paid): the same shape as the Gemini route with another endpoint.

Adding one: a function in `drawers.ts` returning `Drawn`, its id in `DRAWERS`, a row here, a test
of its request and answer parsing with no network.
