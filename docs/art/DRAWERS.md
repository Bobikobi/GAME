# Drawers: the routes `kit:gen` can draw down

`pnpm kit:gen` is one pipeline: the reference on magenta, the house-style prompt, the picture,
the importer onto the grid and the palette, the manifest line, the gallery. The picture is the
only step that costs model time, and `tools/src/kit/drawers.ts` is the one place that knows how
a route is called. `--drawer <id>` picks it (else `KIT_DRAWER`, else `codex`). The manifest line
says which route drew each image, so a gallery can mix them.

| route | what it is | cost per image, measured or published | what it needs | when |
|---|---|---|---|---|
| `codex` | the Codex agent on its subscription (`codex exec` with the image tool) | 150-250 s, 30k-60k tokens (21.10) | the `codex` CLI signed in | the default; a text route (grid tile, scatter motif) always |
| `gemini` | Google's image model over the Generative Language API, one HTTP call through curl | 10-20 s; the free AI Studio tier has a daily cap, enough for dozens a day | `GEMINI_API_KEY` in the shell; `GEMINI_IMAGE_MODEL` to change the model (default `gemini-2.5-flash-image`) | volume: a wave of props from themselves, best of three in minutes |

Rules that hold for every route:

- **The key lives in the environment**, never in a spec, a log or the repository. The Gemini route
  passes it to curl in a config read from stdin, so it is not on a command line either.
- **A third-party reference does not go down a free tier** whose terms let the provider train on
  the request. Our own sprites may; a crop of someone else's picture goes down `codex`.
- **The route does not change the rules of the picture.** The prompt, the palette decision,
  `ramps`, the importer and the gallery judged by eye are the same (PROP_FROM_REF.md,
  RICH_STYLE_EXPERIMENT.md). A route that returns a JPEG is refused: the importer keys the
  magenta from a PNG.
- **Live check before trusting a new route:** one `--dry` run, read the prompt; one real image
  of a kit sprite; open the gallery. The Gemini route was built from the API's published shape
  and its live run waits for a key (the test holds the request and the answer parsing, not the
  wire).

## Routes not built, and what each would take

- **Hugging Face Inference** (free tier, rate limited): image-to-image on an open model such as a
  pixel-art-tuned Stable Diffusion. One `Drawer` posting the PNG and the prompt; quality below the
  two above for this task, and the model choice is a style pick for the owner.
- **A local Stable Diffusion or Flux server** (free, your own machine): a `Drawer` that posts to
  its HTTP API (AUTOMATIC1111 `/sdapi/v1/img2img`, ComfyUI's queue). On a laptop CPU, minutes per
  image at 512 px; seconds on a rented GPU. Worth it the day a LoRA on our own sprites exists.
- **OpenAI images** (`gpt-image-1`, paid): the same shape as the Gemini route with another endpoint.

Adding one: a function in `drawers.ts` returning `Drawn`, its id in `DRAWERS`, a row here, a test
of its request and answer parsing with no network.
