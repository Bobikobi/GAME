/**
 * Drawers: the routes `pnpm kit:gen` can send an image prompt down. The rest of the pipeline (the
 * reference on magenta, the prompt, the importer, the manifest, the gallery) is the same whichever
 * route drew the picture; only this file knows how a route is called.
 *
 *   codex   the Codex agent on its subscription (`codex exec`), the route since 18.10. Three to four
 *           minutes and 30k to 60k tokens per image, measured 21.10. The agent reads the prompt,
 *           calls its own image tool and saves the file.
 *   gemini  Google's image model over the Generative Language API, one HTTP call, ten to twenty
 *           seconds per image. The key is `GEMINI_API_KEY` in the environment, from a project with
 *           billing: the free tier has no quota for image models (21.10: `limit: 0` on a fresh key), so a
 *           free key answers RESOURCE_EXHAUSTED before drawing. Paid per image, in the cents. Where the
 *           terms let Google train on the request, a third-party reference does not go down this route.
 *           The model is `GEMINI_IMAGE_MODEL`, default `gemini-2.5-flash-image`.
 *   local   Stable Diffusion 1.5 with a pixel-art LoRA in a ComfyUI on your own machine, free and
 *           unlimited, image to image from the reference. On the laptop's CPU about 90-300 s per
 *           image by size and steps (21.10: 512 px, 20 steps, 290 s); seconds on a GPU. Settings in
 *           the environment (`COMFYUI_URL`, `LOCAL_DENOISE`, `LOCAL_STEPS` 20, `LOCAL_SIZE` 512; 384/12 is 94 s but speckled; `LOCAL_SEED` 7); the prompt
 *           is the compact one, since the model reads about 75 tokens.
 *   kaggle  open image models with `diffusers` in a private Kaggle kernel on its free GPU, driven by the `kaggle`
 *           CLI: SD 1.5 with the local route's LoRA (`KAGGLE_MODEL` sd15, the default), SDXL with a pixel-art
 *           LoRA (`KAGGLE_MODEL=sdxl`), or text to image with a long-prompt model in 4-bit (`qwen`, Qwen-Image;
 *           `flux`, FLUX.1-schnell). Its own prompt (`kagglePrompt`, checked in the kernel against the encoder's
 *           real window: CLIP's 77 tokens on Stable Diffusion, never cut), a negative prompt, a canvas in the
 *           reference's shape and a denoise of its own for characters. A kernel takes minutes to start, so `kit:gen` sends the whole wave in one run
 *           (`drawWaveWithKaggle`): push, poll, fetch the output.
 *
 * `--drawer <id>` picks the route, else `KIT_DRAWER`, else codex. A text route (a grid tile, a scatter
 * motif) stays with Codex: those are letters, not pictures. Adding a route is one `Drawer` here and
 * one line in `docs/art/DRAWERS.md`; the key is read from the environment and never written to a log.
 *
 * The HTTP call goes through `curl` so the pipeline stays synchronous and the key travels in a
 * config read from stdin, not on the command line.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const DRAWERS = ['codex', 'gemini', 'local', 'kaggle'] as const;
export type DrawerId = (typeof DRAWERS)[number];

export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash-image';
export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** What a route reports back: the same shape for every drawer, so the manifest line does not care. */
export interface Drawn {
  /** The route's own version: the Codex CLI version, or the Gemini model name. */
  version: string;
  exit: number | null;
  seconds: number;
  tokens: number | null;
  /** The log file, relative to the run folder. */
  log: string;
  /** The PNG the route produced, or null with `error` saying why. */
  saved: string | null;
  error: string;
}

export function parseDrawer(value: string | undefined): DrawerId {
  if (value === undefined || value === '') return 'codex';
  if ((DRAWERS as readonly string[]).includes(value)) return value as DrawerId;
  throw new Error(`--drawer takes ${DRAWERS.slice(0, -1).join(', ')} or ${DRAWERS[DRAWERS.length - 1]}, not ${JSON.stringify(value)}`);
}

/**
 * The prompt as a plain image model reads it: the sentences that address an agent (its tool, the
 * file to save) go; the drawing instructions stay word for word.
 */
export function promptForModel(prompt: string): string {
  return prompt
    .replace(/^Use your image generation tool\.\s*/u, '')
    .replace(/\s*Do not process the image with code afterwards; just generate it and save it as \S+ in the current directory\.\s*$/u, '')
    .trim();
}

/** The request body of one Gemini image call: the prompt, then each image inline, asking for an image back. */
export function geminiRequest(prompt: string, images: readonly Buffer[]): string {
  return JSON.stringify({
    contents: [{
      role: 'user',
      parts: [
        { text: promptForModel(prompt) },
        ...images.map((png) => ({ inline_data: { mime_type: 'image/png', data: png.toString('base64') } })),
      ],
    }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  });
}

/** What a Gemini answer holds: the first PNG part, the text parts, the token count, or the API's error. */
export function geminiAnswer(body: string): { png: Buffer | null; mime: string | null; text: string; tokens: number | null; error: string | null } {
  let json: {
    error?: { message?: string; status?: string };
    candidates?: { content?: { parts?: { text?: string; inlineData?: { mimeType?: string; data?: string } }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
    usageMetadata?: { totalTokenCount?: number };
  };
  try {
    json = JSON.parse(body) as typeof json;
  } catch {
    return { png: null, mime: null, text: '', tokens: null, error: `not JSON: ${body.slice(0, 200)}` };
  }
  if (json.error !== undefined) {
    return { png: null, mime: null, text: '', tokens: null, error: `${json.error.status ?? 'error'}: ${json.error.message ?? ''}`.trim() };
  }
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? '').filter((t) => t !== '').join('\n');
  const image = parts.find((p) => p.inlineData?.data !== undefined)?.inlineData;
  const tokens = json.usageMetadata?.totalTokenCount ?? null;
  if (image === undefined || image.data === undefined) {
    const why = json.promptFeedback?.blockReason ?? json.candidates?.[0]?.finishReason ?? 'no image part';
    return { png: null, mime: null, text, tokens, error: `Gemini returned no image (${why})${text === '' ? '' : `: ${text.slice(0, 200)}`}` };
  }
  const mime = image.mimeType ?? 'image/png';
  if (mime !== 'image/png') {
    return { png: null, mime, text, tokens, error: `Gemini returned ${mime}, not a PNG; the importer reads PNG only` };
  }
  return { png: Buffer.from(image.data, 'base64'), mime, text, tokens, error: null };
}

export interface DrawCall {
  /** The run folder: `work/` and `log/` are under it. */
  out: string;
  name: string;
  stamp: string;
  prompt: string;
  /** Reference first, then style examples, as PNG paths. */
  images: readonly string[];
  /** The file the route saves, under `work/`. */
  expect: string;
  timeoutSeconds: number;
  env?: NodeJS.ProcessEnv;
}

/** One Gemini image call through curl; the key never appears on a command line or in the log. */
export function drawWithGemini(call: DrawCall): Drawn {
  const env = call.env ?? process.env;
  const model = env['GEMINI_IMAGE_MODEL'] ?? GEMINI_DEFAULT_MODEL;
  const logPath = join(call.out, 'log', `${call.name}-${call.stamp}.txt`);
  const key = env['GEMINI_API_KEY'];
  const since = Date.now();
  const done = (exit: number | null, log: string, saved: string | null, error: string, tokens: number | null): Drawn => {
    writeFileSync(logPath, log);
    return { version: model, exit, seconds: Math.round((Date.now() - since) / 1000), tokens, log: logPath.replace(`${call.out}/`, ''), saved, error };
  };
  if (key === undefined || key === '') {
    return done(null, 'GEMINI_API_KEY is not set', null, 'GEMINI_API_KEY is not set: get one in AI Studio and export it in this shell', null);
  }
  const bodyPath = join(call.out, 'work', `${call.name}-${call.stamp}.request.json`);
  writeFileSync(bodyPath, geminiRequest(call.prompt, call.images.map((p) => readFileSync(p))));
  const config = [
    `url = "${GEMINI_ENDPOINT}/${model}:generateContent"`,
    'header = "Content-Type: application/json"',
    `header = "x-goog-api-key: ${key}"`,
    `data-binary = "@${bodyPath}"`,
    `max-time = ${call.timeoutSeconds}`,
    'silent', 'show-error',
  ].join('\n');
  const run = spawnSync('curl', ['--config', '-'], {
    input: config, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    timeout: (call.timeoutSeconds + 10) * 1000, maxBuffer: 64 * 1024 * 1024,
  });
  if (run.error !== undefined) return done(run.status, run.stderr ?? '', null, `curl did not run: ${run.error.message}`, null);
  if (run.status !== 0) return done(run.status, run.stderr ?? '', null, `curl exited ${run.status}: ${(run.stderr ?? '').trim().slice(0, 200)}`, null);
  const answer = geminiAnswer(run.stdout ?? '');
  const log = [
    `model ${model}`,
    `request ${bodyPath.replace(`${call.out}/`, '')}`,
    answer.tokens === null ? '' : `tokens used\n${answer.tokens}`,
    answer.text,
    answer.error ?? '',
  ].filter((l) => l !== '').join('\n');
  if (answer.png === null) return done(0, log, null, answer.error ?? 'Gemini returned no image', answer.tokens);
  const saved = join(call.out, 'work', call.expect);
  writeFileSync(saved, answer.png);
  return done(0, log, existsSync(saved) ? saved : null, 'Gemini saved no image', answer.tokens);
}

/* ---------------------------------------------------------------- the local route */

export const LOCAL_DEFAULTS = {
  url: 'http://127.0.0.1:8188',
  checkpoint: 'v1-5-pruned-emaonly.safetensors',
  lora: 'PixelArtRedmond15V.safetensors',
  loraStrength: 0.8,
  denoise: 0.6,
  steps: 20,
  size: 512,
  cfg: 7,
  seed: 7,
} as const;

/** The negative prompt of the local route: what Stable Diffusion drifts to and a sprite never is. */
export const LOCAL_NEGATIVE = 'blurry, photo, realistic, 3d render, smooth gradient, text, watermark, extra objects, shadow on the ground';

/**
 * The compact prompt a Stable Diffusion model reads (its text encoder keeps about 75 tokens, so
 * the agent's prose would be cut mid-sentence): the LoRA's trigger words, the object, the view, the
 * detail, and the three things the importer needs (outline, crisp pixels, flat magenta).
 */
export function localPrompt(entry: { what: string; detail?: string }): string {
  const detail = entry.detail === undefined || entry.detail.trim() === '' ? '' : `, ${entry.detail.trim()}`;
  return `Pixel Art, PixArFK, ${entry.what}, top-down three-quarter view game sprite${detail}, thick dark navy outline, crisp square pixels, flat pure magenta background`;
}

export interface LocalSettings {
  url: string;
  checkpoint: string;
  lora: string;
  loraStrength: number;
  denoise: number;
  steps: number;
  size: number;
  cfg: number;
  seed: number;
}

/** The local route's settings from the environment (`COMFYUI_URL`, `LOCAL_DENOISE`, `LOCAL_STEPS`, `LOCAL_SIZE`, `LOCAL_SEED`, `LOCAL_LORA`, `LOCAL_CHECKPOINT`), else the defaults. */
/** A positive number from the environment, else the fallback; anything else is refused by name. */
function envNumber(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} takes a positive number, not ${JSON.stringify(raw)}`);
  return value;
}
export function localSettings(env: NodeJS.ProcessEnv = process.env): LocalSettings {
  const num = (name: string, fallback: number): number => envNumber(env, name, fallback);
  return {
    url: (env['COMFYUI_URL'] ?? LOCAL_DEFAULTS.url).replace(/\/$/u, ''),
    checkpoint: env['LOCAL_CHECKPOINT'] ?? LOCAL_DEFAULTS.checkpoint,
    lora: env['LOCAL_LORA'] ?? LOCAL_DEFAULTS.lora,
    loraStrength: num('LOCAL_LORA_STRENGTH', LOCAL_DEFAULTS.loraStrength),
    denoise: num('LOCAL_DENOISE', LOCAL_DEFAULTS.denoise),
    steps: Math.round(num('LOCAL_STEPS', LOCAL_DEFAULTS.steps)),
    size: Math.round(num('LOCAL_SIZE', LOCAL_DEFAULTS.size)),
    cfg: num('LOCAL_CFG', LOCAL_DEFAULTS.cfg),
    seed: Math.round(num('LOCAL_SEED', LOCAL_DEFAULTS.seed)),
  };
}

/**
 * The ComfyUI workflow of one image-to-image pass, in the API's node form: checkpoint, LoRA, the
 * two prompts, the uploaded reference scaled to the working size, encode, sample at `denoise`
 * (how far the picture may leave the reference), decode, save.
 */
export function localWorkflow(uploaded: string, prompt: string, seed: number, s: LocalSettings): Record<string, unknown> {
  return {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: s.checkpoint } },
    '2': { class_type: 'LoraLoader', inputs: { model: ['1', 0], clip: ['1', 1], lora_name: s.lora, strength_model: s.loraStrength, strength_clip: s.loraStrength } },
    '3': { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 1], text: prompt } },
    '4': { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 1], text: LOCAL_NEGATIVE } },
    '5': { class_type: 'LoadImage', inputs: { image: uploaded } },
    '6': { class_type: 'ImageScale', inputs: { image: ['5', 0], upscale_method: 'nearest-exact', width: s.size, height: s.size, crop: 'disabled' } },
    '7': { class_type: 'VAEEncode', inputs: { pixels: ['6', 0], vae: ['1', 2] } },
    '8': { class_type: 'KSampler', inputs: { model: ['2', 0], positive: ['3', 0], negative: ['4', 0], latent_image: ['7', 0], seed, steps: s.steps, cfg: s.cfg, sampler_name: 'euler', scheduler: 'normal', denoise: s.denoise } },
    '9': { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['1', 2] } },
    '10': { class_type: 'SaveImage', inputs: { images: ['9', 0], filename_prefix: 'kitgen' } },
  };
}

/** The first saved image of a finished ComfyUI history entry, or why there is none yet / at all. */
export function localHistory(body: string, promptId: string): { image: { filename: string; subfolder: string; type: string } | null; done: boolean; error: string | null } {
  let json: Record<string, { status?: { status_str?: string; messages?: unknown[] }; outputs?: Record<string, { images?: { filename: string; subfolder?: string; type: string }[] }> }>;
  try {
    json = JSON.parse(body) as typeof json;
  } catch {
    return { image: null, done: false, error: `history is not JSON: ${body.slice(0, 120)}` };
  }
  const entry = json[promptId];
  if (entry === undefined) return { image: null, done: false, error: null };
  if (entry.status?.status_str === 'error') return { image: null, done: true, error: `ComfyUI failed: ${JSON.stringify(entry.status.messages ?? []).slice(0, 300)}` };
  const image = Object.values(entry.outputs ?? {}).flatMap((o) => o.images ?? [])[0];
  if (image === undefined) return { image: null, done: entry.status?.status_str === 'success', error: entry.status?.status_str === 'success' ? 'ComfyUI finished with no image' : null };
  return { image: { filename: image.filename, subfolder: image.subfolder ?? '', type: image.type }, done: true, error: null };
}

function curl(args: readonly string[], timeoutSeconds: number): { status: number | null; stdout: string; stderr: string; error?: Error } {
  const run = spawnSync('curl', ['--silent', '--show-error', '--max-time', String(timeoutSeconds), ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: (timeoutSeconds + 5) * 1000, maxBuffer: 64 * 1024 * 1024,
  });
  return { status: run.status, stdout: run.stdout ?? '', stderr: run.stderr ?? '', ...(run.error === undefined ? {} : { error: run.error }) };
}

/**
 * One image through the local ComfyUI (start the local ComfyUI on the laptop that
 * holds it; any machine with ComfyUI on `COMFYUI_URL`): upload the reference, queue the workflow,
 * poll its history, fetch the picture. The prompt is the compact one (`localPrompt`), not the agent's.
 */
export function drawWithLocal(call: DrawCall & { seed?: number }): Drawn {
  const env = call.env ?? process.env;
  const settings = localSettings(env);
  const logPath = join(call.out, 'log', `${call.name}-${call.stamp}.txt`);
  const since = Date.now();
  const lines: string[] = [`comfyui ${settings.url}`, `checkpoint ${settings.checkpoint}`, `lora ${settings.lora} x${settings.loraStrength}`, `denoise ${settings.denoise} steps ${settings.steps} size ${settings.size} cfg ${settings.cfg}`];
  const version = `${settings.checkpoint}+${settings.lora}`;
  const done = (exit: number | null, saved: string | null, error: string): Drawn => {
    writeFileSync(logPath, lines.join('\n'));
    return { version, exit, seconds: Math.round((Date.now() - since) / 1000), tokens: null, log: logPath.replace(`${call.out}/`, ''), saved, error };
  };
  const reference = call.images[0];
  if (reference === undefined) return done(null, null, 'the local route needs the reference image');
  const up = curl(['-F', `image=@${reference};type=image/png;filename=${call.name}-${call.stamp}.png`, `${settings.url}/upload/image`], 60);
  if (up.error !== undefined || up.status !== 0) {
    lines.push(up.stderr);
    return done(up.status, null, `ComfyUI is not answering at ${settings.url} (start it: comfyui.sh start): ${(up.error?.message ?? up.stderr).trim().slice(0, 160)}`);
  }
  let uploaded: string;
  try {
    uploaded = (JSON.parse(up.stdout) as { name: string }).name;
  } catch {
    return done(0, null, `upload answered: ${up.stdout.slice(0, 160)}`);
  }
  const seed = call.seed ?? settings.seed;
  const bodyPath = join(call.out, 'work', `${call.name}-${call.stamp}.workflow.json`);
  writeFileSync(bodyPath, JSON.stringify({ prompt: localWorkflow(uploaded, call.prompt, seed, settings), client_id: `kitgen-${call.stamp}` }));
  lines.push(`workflow ${bodyPath.replace(`${call.out}/`, '')}`, `seed ${seed}`);
  const queued = curl(['-H', 'Content-Type: application/json', '--data-binary', `@${bodyPath}`, `${settings.url}/prompt`], 60);
  let promptId: string;
  try {
    const answer = JSON.parse(queued.stdout) as { prompt_id?: string; error?: unknown; node_errors?: unknown };
    if (answer.prompt_id === undefined) return done(queued.status, null, `ComfyUI refused the workflow: ${JSON.stringify(answer.error ?? answer.node_errors ?? answer).slice(0, 300)}`);
    promptId = answer.prompt_id;
  } catch {
    return done(queued.status, null, `queue answered: ${(queued.stdout || queued.stderr).slice(0, 160)}`);
  }
  lines.push(`prompt_id ${promptId}`);
  const deadline = since + call.timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    spawnSync('sleep', ['2']);
    const history = localHistory(curl([`${settings.url}/history/${promptId}`], 30).stdout, promptId);
    if (history.error !== null && history.done) return done(0, null, history.error);
    if (history.image === null) continue;
    const saved = join(call.out, 'work', call.expect);
    const { filename, subfolder, type } = history.image;
    const view = curl(['-o', saved, `${settings.url}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`], 60);
    if (view.status !== 0 || !existsSync(saved)) return done(view.status, null, `could not fetch ${filename}: ${view.stderr.slice(0, 160)}`);
    lines.push(`image ${filename}`);
    return done(0, saved, 'the local route saved no image');
  }
  curl(['-X', 'POST', `${settings.url}/interrupt`], 10);
  return done(null, null, `the local route did not finish in ${call.timeoutSeconds} s (interrupted); a CPU draws a ${settings.size} px picture in about ${settings.steps * 14} s`);
}

/* ---------------------------------------------------------------- the kaggle route */

/** CLIP's window: 77 tokens with the start and end marks, so 75 for the words. Past it the encoder cuts silently. */
export const CLIP_TOKENS = 77;

/**
 * Open image models on Kaggle's free GPU, in four recipes. `sd15` is the local route's weights (SD 1.5 and
 * PixelArtRedmond15V, here from Hugging Face) with its steps, size, CFG and LoRA strength; `sdxl` is SDXL base
 * with the fp16-safe VAE and the pixel-art-xl LoRA, in half precision with the VAE tiled so a T4's 16 GB
 * holds it. Both read `kagglePrompt` (not the local route's), the negative `KAGGLE_NEGATIVE`, a canvas in the
 * reference's shape (`kaggleCanvas`) and a denoise by subject (`kaggleSubject`), each recipe with its own.
 *
 * `qwen` (Qwen-Image 2512, Apache 2.0) and `flux` (FLUX.1-schnell, Apache 2.0) are bigger models with long-prompt
 * text encoders (Qwen2.5-VL, T5), which read what a sentence says rather than a bag of 75 tokens. Neither fits a
 * T4 in full precision, so each loads its transformer in 4-bit NF4 (bitsandbytes; Qwen pre-quantized, FLUX
 * quantized on load), and the kernel runs the text encoders first, alone, for the whole wave, frees them, then
 * loads the transformer: the two never share the card. FLUX computes in fp16, a T4 having no fast bf16; Qwen's
 * activations pass fp16's range, so it computes in fp32 from 16-bit storage (`dtype`, `KAGGLE_DTYPE`). They draw
 * text to image from the prompt (the reference only sets the canvas shape), so their denoise is 1. Qwen runs the
 * 4-step Lightning LoRA (Apache 2.0) with its scheduler and no CFG; FLUX schnell 4 steps at guidance 0.
 *
 * `post` (`KAGGLE_POST`): `grid` keys the background to flat magenta and downscales each picture with nearest
 * neighbour to the spec's art grid inside the kernel (`kaggleKernelScript`); the default for `qwen` and `flux`,
 * off for `sd15` and `sdxl` so their pictures do not change unasked.
 *
 * The kernel is a private script on the account the `kaggle` CLI is signed in to; the token is the CLI's
 * own (`~/.kaggle`), never read here.
 */
export const KAGGLE_RECIPES = {
  sd15: {
    model: 'stable-diffusion-v1-5/stable-diffusion-v1-5',
    vae: '',
    loraRepo: 'artificialguybr/pixelartredmond-1-5v-pixel-art-loras-for-sd-1-5',
    loraFile: 'PixelArtRedmond15V-PixelArt-PIXARFK.safetensors',
    loraStrength: LOCAL_DEFAULTS.loraStrength,
    steps: LOCAL_DEFAULTS.steps,
    size: LOCAL_DEFAULTS.size,
    cfg: LOCAL_DEFAULTS.cfg,
    /**
     * How far a picture may leave its reference: a prop as on the local route; a character further, since at
     * 0.45-0.55 the model hands back the reference's blob with a smeared face, and from 0.65 it draws one
     * elder with a face (22.10, three seeds each). What split the elder in two was the prompt and the square
     * canvas, not the denoise.
     */
    denoise: LOCAL_DEFAULTS.denoise,
    denoiseCharacter: 0.7,
    /** The LoRA's trigger words, first in the prompt. */
    trigger: 'Pixel Art, PixArFK',
    /** How the transformer or UNet is loaded: as published (`''`), pre-quantized on the hub, or quantized to NF4 on load. */
    quant: '',
    /** A scheduler other than the pipeline's: `euler` (Stable Diffusion's Euler), `lightning` (the Lightning LoRA's). */
    scheduler: 'euler',
    /** The text encoder's real window, in tokens of the pipeline's own tokenizer; a longer prompt is refused, never cut. */
    tokenLimit: CLIP_TOKENS,
    /** The compute precision on a GPU: `fp16` (a T4's fast one), `bf16` or `fp32`. */
    dtype: 'fp16',
    post: 'off',
  },
  sdxl: {
    model: 'stabilityai/stable-diffusion-xl-base-1.0',
    /** SDXL's own VAE turns to NaN (a black picture) in fp16; this one is retrained not to. */
    vae: 'madebyollin/sdxl-vae-fp16-fix',
    loraRepo: 'nerijs/pixel-art-xl',
    loraFile: 'pixel-art-xl.safetensors',
    loraStrength: 1,
    steps: 25,
    size: 1024,
    cfg: 7,
    /** SDXL holds the reference harder: a character below 0.75 comes back as the blob, or with a blank face (22.10). */
    denoise: 0.6,
    denoiseCharacter: 0.8,
    trigger: 'pixel art',
    quant: '',
    scheduler: 'euler',
    tokenLimit: CLIP_TOKENS,
    dtype: 'fp16',
    post: 'off',
  },
  qwen: {
    /** Qwen-Image 2512 (the current Qwen-Image weights) with its transformer and text encoder in NF4, published by its quantizer. */
    model: 'unsloth/Qwen-Image-2512-unsloth-bnb-4bit',
    vae: '',
    loraRepo: 'lightx2v/Qwen-Image-2512-Lightning',
    /** The 4-step file: in fp32 a step costs about 25 s on a T4, and 4 steps already draw clean pixels (23.10). */
    loraFile: 'Qwen-Image-2512-Lightning-4steps-V1.0-bf16.safetensors',
    loraStrength: 1,
    steps: 4,
    size: 1024,
    /** Qwen's true CFG; 1 is off, as the Lightning LoRA is distilled for. */
    cfg: 1,
    denoise: 1,
    denoiseCharacter: 1,
    trigger: '',
    quant: 'prequantized',
    scheduler: 'lightning',
    /** The pipeline's `max_sequence_length` for the prompt (its encoder reads far more; 512 is past any spec). */
    tokenLimit: 512,
    /**
     * Qwen-Image's activations pass fp16's ceiling (65504) from its second block on, and the picture comes back
     * NaN, black; bf16 runs slower than fp32 on a T4 (no bf16 units). So fp32 compute, from 16-bit storage.
     */
    dtype: 'fp32',
    post: 'grid',
  },
  flux: {
    /** FLUX.1-schnell as published, from a mirror that needs no sign-in (the original asks for a Hugging Face login). */
    model: 'unsloth/FLUX.1-schnell',
    vae: '',
    loraRepo: '',
    loraFile: '',
    loraStrength: 1,
    steps: 4,
    size: 1024,
    /** schnell is guidance-distilled: guidance 0. */
    cfg: 0,
    denoise: 1,
    denoiseCharacter: 1,
    trigger: '',
    quant: 'nf4',
    scheduler: '',
    /** T5's window as schnell allows it (`max_sequence_length` 256); its CLIP encoder only adds a pooled summary. */
    tokenLimit: 256,
    dtype: 'fp16',
    post: 'grid',
  },
} as const;
export type KaggleRecipe = keyof typeof KAGGLE_RECIPES;
export const KAGGLE_RECIPE_NAMES = Object.keys(KAGGLE_RECIPES) as KaggleRecipe[];

/** A recipe that draws text to image with a long-prompt encoder (the reference sets the canvas only). */
export function kaggleFromPrompt(recipe: KaggleRecipe): boolean {
  return recipe === 'qwen' || recipe === 'flux';
}

/** What the kernel does to a picture before it comes back: `grid` keys the background and downscales to the art grid. */
export type KagglePost = 'grid' | 'off';

/** The compute precisions `KAGGLE_DTYPE` takes. */
export type KaggleDtype = 'fp16' | 'bf16' | 'fp32';

/** The pixels per art pixel of a `grid` picture as it comes back: the importer finds a grid from 4 up. */
export const KAGGLE_POST_SCALE = 8;

export const KAGGLE_DEFAULTS = {
  kernel: 'kitgen-drawer',
  cli: 'kaggle',
  model: KAGGLE_RECIPES.sd15.model,
  loraRepo: KAGGLE_RECIPES.sd15.loraRepo,
  loraFile: KAGGLE_RECIPES.sd15.loraFile,
  seed: 7,
  /** A kernel's start, the pip check and the model download, before the first picture. */
  setupSeconds: 1200,
  pollSeconds: 20,
  /** The references travel inside the pushed script; a wave bigger than this goes up in several runs. */
  embedLimit: 900_000,
} as const;

export interface KaggleSettings {
  cli: string;
  /** `owner/slug`, or a bare slug the owner is added to from the signed-in CLI. */
  kernel: string;
  gpu: boolean;
  /** Kaggle's `machine_shape` (`NvidiaTeslaT4`, ...); empty lets Kaggle pick. */
  accelerator: string;
  recipe: KaggleRecipe;
  model: string;
  /** A VAE to load in place of the model's own (SDXL in fp16), or empty. */
  vae: string;
  loraRepo: string;
  loraFile: string;
  loraStrength: number;
  /** A prop's denoise; a character's is `denoiseCharacter`. */
  denoise: number;
  denoiseCharacter: number;
  steps: number;
  /** The canvas's short side; the long side follows the reference, or the asked size when drawing from the prompt (`kaggleCanvasFor`). */
  size: number;
  cfg: number;
  seed: number;
  setupSeconds: number;
  pollSeconds: number;
  embedLimit: number;
  /** How the weights load (`''`, `prequantized`, `nf4`) and which scheduler runs, from the recipe. */
  quant: string;
  scheduler: string;
  /** The prompt's limit in the pipeline's own tokens. */
  tokenLimit: number;
  /** The compute precision on the GPU, from the recipe: `fp16` (a T4's fast one), `bf16`, or `fp32` (qwen). */
  dtype: KaggleDtype;
  post: KagglePost;
}

/**
 * The kaggle route's settings: `KAGGLE_KERNEL`, `KAGGLE_CLI`, `KAGGLE_GPU` (0 for a CPU run), `KAGGLE_ACCELERATOR`,
 * `KAGGLE_MODEL` (`sd15`, the default, `sdxl`, `qwen` or `flux`; any other value is a Hugging Face repo id drawn
 * with the recipe in `KAGGLE_RECIPE`, default sd15), `KAGGLE_VAE`, `KAGGLE_LORA_REPO`, `KAGGLE_LORA_FILE`, `KAGGLE_LORA_STRENGTH`,
 * `KAGGLE_DENOISE` (props, 0.6), `KAGGLE_DENOISE_CHARACTER` (0.7 on sd15, 0.8 on sdxl), `KAGGLE_STEPS`, `KAGGLE_SIZE` (the short side),
 * `KAGGLE_CFG`, `KAGGLE_SEED`, `KAGGLE_SETUP_SECONDS`, `KAGGLE_POLL_SECONDS`, `KAGGLE_POST` (`grid` or `off`), `KAGGLE_DTYPE`
 * (`fp16`, `bf16` or `fp32`); the rest default to the recipe's. `qwen` and `flux` draw from the prompt, so a denoise below 1 is refused.
 */
export function kaggleSettings(env: NodeJS.ProcessEnv = process.env): KaggleSettings {
  const num = (name: string, fallback: number): number => envNumber(env, name, fallback);
  const text = (name: string, fallback: string): string => {
    const raw = env[name];
    return raw === undefined || raw.trim() === '' ? fallback : raw.trim();
  };
  const choice = <T extends string>(name: string, allowed: readonly T[], fallback: T): T => {
    const value = text(name, fallback).toLowerCase();
    if (!(allowed as readonly string[]).includes(value)) throw new Error(`${name} takes ${allowed.join(' or ')}, not ${JSON.stringify(value)}`);
    return value as T;
  };
  const gpu = text('KAGGLE_GPU', '1').toLowerCase();
  const model = text('KAGGLE_MODEL', 'sd15');
  const named = model.toLowerCase();
  const recipeName = (KAGGLE_RECIPE_NAMES as readonly string[]).includes(named) ? named as KaggleRecipe : text('KAGGLE_RECIPE', 'sd15').toLowerCase();
  if (!(KAGGLE_RECIPE_NAMES as readonly string[]).includes(recipeName)) throw new Error(`KAGGLE_RECIPE takes ${KAGGLE_RECIPE_NAMES.join(', ')}, not ${JSON.stringify(recipeName)}`);
  const recipe = KAGGLE_RECIPES[recipeName as KaggleRecipe];
  if (kaggleFromPrompt(recipeName as KaggleRecipe)) {
    for (const name of ['KAGGLE_DENOISE', 'KAGGLE_DENOISE_CHARACTER']) {
      if (num(name, 1) < 1) throw new Error(`${recipeName} draws from the prompt alone: ${name} must be 1 or unset, not ${env[name] ?? ''}`);
    }
  }
  return {
    cli: text('KAGGLE_CLI', KAGGLE_DEFAULTS.cli),
    kernel: text('KAGGLE_KERNEL', KAGGLE_DEFAULTS.kernel),
    gpu: !['0', 'false', 'no', 'off'].includes(gpu),
    accelerator: text('KAGGLE_ACCELERATOR', ''),
    recipe: recipeName as KaggleRecipe,
    model: named === recipeName ? recipe.model : model,
    vae: env['KAGGLE_VAE'] === undefined ? recipe.vae : env['KAGGLE_VAE'].trim(),
    loraRepo: text('KAGGLE_LORA_REPO', recipe.loraRepo),
    loraFile: text('KAGGLE_LORA_FILE', recipe.loraFile),
    loraStrength: num('KAGGLE_LORA_STRENGTH', recipe.loraStrength),
    denoise: Math.min(1, num('KAGGLE_DENOISE', recipe.denoise)),
    denoiseCharacter: Math.min(1, num('KAGGLE_DENOISE_CHARACTER', recipe.denoiseCharacter)),
    steps: Math.round(num('KAGGLE_STEPS', recipe.steps)),
    size: Math.round(num('KAGGLE_SIZE', recipe.size) / 8) * 8,
    cfg: num('KAGGLE_CFG', recipe.cfg),
    seed: Math.round(num('KAGGLE_SEED', KAGGLE_DEFAULTS.seed)),
    setupSeconds: num('KAGGLE_SETUP_SECONDS', KAGGLE_DEFAULTS.setupSeconds),
    pollSeconds: num('KAGGLE_POLL_SECONDS', KAGGLE_DEFAULTS.pollSeconds),
    embedLimit: num('KAGGLE_EMBED_LIMIT', KAGGLE_DEFAULTS.embedLimit),
    quant: recipe.quant,
    scheduler: recipe.scheduler,
    tokenLimit: recipe.tokenLimit,
    dtype: choice('KAGGLE_DTYPE', ['fp16', 'bf16', 'fp32'] as const, recipe.dtype),
    post: choice('KAGGLE_POST', ['grid', 'off'] as const, recipe.post),
  };
}

/**
 * The scheduler length that gives the local route's step count. ComfyUI's KSampler at denoise d and n steps
 * samples n steps over the last part of a longer schedule; diffusers' image-to-image runs
 * `floor(total * strength)` of `total`, so `total = ceil(n / d)` lands on the same n.
 */
export function kaggleInferenceSteps(steps: number, denoise: number): number {
  return Math.max(1, Math.ceil(steps / denoise - 1e-9));
}

/** The username in `kaggle config view` (the token is never part of it). */
export function kaggleOwner(configView: string): string | null {
  return /^\s*-\s*username:\s*(\S+)\s*$/mu.exec(configView)?.[1] ?? null;
}

/** A name as a file on the kernel's side: letters, digits, dash and underscore only. */
export function kaggleFileName(name: string): string {
  return `${name.replace(/[^A-Za-z0-9_-]/gu, '_')}.png`;
}

/** What a sprite is to the kaggle route: a character (a `chars/` sprite) keeps its silhouette harder than a prop. */
export type KaggleSubject = 'character' | 'prop';

export function kaggleSubject(ref: string): KaggleSubject {
  return ref.startsWith('chars/') ? 'character' : 'prop';
}

/**
 * An upper estimate of the CLIP tokens a prompt takes (start and end marks included), with no vocabulary at
 * hand: a common short word is one token, a long or made-up word several, every punctuation mark one. The
 * kernel counts with the real tokenizer and refuses a prompt over the window; this keeps `kagglePrompt` well
 * inside it.
 */
export function clipTokenEstimate(text: string): number {
  let count = 2;
  for (const piece of text.match(/'s\b|[A-Za-z]+|\d|[^\sA-Za-z\d]/gu) ?? []) {
    if (/^[A-Za-z]+$/u.test(piece)) {
      const camel = /[a-z][A-Z]/u.test(piece);
      count += camel ? Math.ceil(piece.length / 2) : piece.length <= 8 ? 1 : Math.ceil(piece.length / 5);
    } else {
      count += 1;
    }
  }
  return count;
}

/**
 * The negative prompt of the kaggle route: the local one, plus what split the elder into two figures (22.10), plus
 * the light the model paints on the background (a wedge, a halo) that the importer then keeps as part of the sprite (27.10).
 */
export const KAGGLE_NEGATIVE = 'multiple characters, two figures, extra figure, animal, duplicate, cropped, blurry, photo, realistic, 3d render, text, watermark, gradient background, shadow on the ground, glow, vignette, light rays, halo';

const NUMBER_WORD = '(?:\\d+|two|three|four|five|six)';

/**
 * A spec clause as a diffusion model can use it, or null to drop it. A Stable Diffusion text encoder cannot
 * count pixels or shades, so a clause about pixels goes, `in 3 shades` goes, and `in 3 greens` keeps the colour.
 */
export function sdClause(clause: string): string | null {
  let c = clause.trim();
  if (c === '' || /\bpixels?\b/iu.test(c)) return null;
  c = c.replace(new RegExp(`\\s+in ${NUMBER_WORD} (?:shades|tones|colou?rs|steps)\\b`, 'giu'), '');
  c = c.replace(new RegExp(`\\bin ${NUMBER_WORD} (\\w+?)s\\b`, 'giu'), 'in $1');
  c = c.replace(/\s+/gu, ' ').trim();
  // what is left of "the beard in 3 shades" is just "the beard": the subject already says it
  if (c === '' || /^(?:the|a|an) \w+$/iu.test(c)) return null;
  return c;
}

function clauses(text: string | undefined): string[] {
  return (text ?? '').split(/[,;()]/u).map((c) => c.trim()).filter((c) => c !== '');
}

/**
 * The kaggle route's prompt, written for Stable Diffusion rather than for an agent: the LoRA's trigger words
 * first, then what the sprite is (a character is asked for as one figure), the subject and its colours, the
 * spec's detail without pixel counts, and the three things the importer needs (outline, crisp pixels, flat
 * magenta). Detail clauses go from the end while the estimate is past the window, so the words that matter
 * most are never the ones cut. The local route keeps `localPrompt`.
 */
export function kagglePrompt(entry: { what: string; detail?: string; ref: string }, recipe: KaggleRecipe = 'sd15'): string {
  if (kaggleFromPrompt(recipe)) return kaggleSentencePrompt(entry);
  const head = [KAGGLE_RECIPES[recipe].trigger, ...(kaggleSubject(entry.ref) === 'character' ? ['one single character alone', 'full body', 'front view'] : ['game sprite', 'top-down three-quarter view'])];
  const tail = ['thick dark navy outline', 'crisp square pixels', 'flat pure magenta background'];
  const subject = clauses(entry.what).map(sdClause).filter((c): c is string => c !== null);
  const detail = clauses(entry.detail).map(sdClause).filter((c): c is string => c !== null);
  const build = (): string => [...new Map([...head, ...subject, ...detail, ...tail].map((c) => [c.toLowerCase(), c])).values()].join(', ');
  while (detail.length > 0 && clipTokenEstimate(build()) > CLIP_TOKENS - 4) detail.pop();
  return build();
}

/**
 * The prompt of a long-prompt recipe (`qwen`, `flux`): sentences rather than a tag list, since its encoder reads
 * the whole spec and what a clause says (one object, "no leaves"). The subject, the spec's detail without pixel
 * or shade counts, alone and centred (a character as one figure, full body), the spec's own view where it names
 * one, and the three things the importer needs. Nothing is dropped: the kernel counts it against the encoder's
 * real window.
 */
export function kaggleSentencePrompt(entry: { what: string; detail?: string; ref: string }): string {
  const subject = clauses(entry.what).map(sdClause).filter((c): c is string => c !== null).join(', ');
  const detail = clauses(entry.detail).map(sdClause).filter((c): c is string => c !== null);
  const character = kaggleSubject(entry.ref) === 'character';
  const view = detail.some((c) => /\bview\b/iu.test(c)) ? [] : [character ? 'full body, front view' : 'top-down three-quarter view'];
  const sentence = (parts: readonly string[]): string => {
    const text = parts.filter((p) => p !== '').join(', ');
    return text === '' ? '' : `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
  };
  return [
    `Pixel art game sprite: ${subject}.`,
    sentence(detail),
    sentence([character ? 'one single character alone, centred' : 'alone and centred, filling most of the picture', ...view]),
    'Crisp square pixels, a thick dark navy outline, a limited palette.',
    'Flat pure magenta background, no shadow on the ground, no text, no other objects.',
  ].filter((s) => s !== '').join(' ');
}

/** A PNG's width and height from its header, or null when the bytes are not a PNG. */
export function pngSize(png: Buffer): { width: number; height: number } | null {
  if (png.length < 24 || !png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return null;
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/**
 * The canvas a reference is drawn on: the short side `size`, the long side in the reference's proportion (at
 * most twice the short one), both in multiples of 64, so a 2:3 character is not squeezed into a square. The
 * kernel pads the reference with its background to this shape before scaling it, never stretches it.
 */
export function kaggleCanvas(ref: { width: number; height: number } | null, size: number): { width: number; height: number } {
  const short = Math.max(64, Math.round(size / 64) * 64);
  if (ref === null || ref.width <= 0 || ref.height <= 0) return { width: short, height: short };
  const ratio = Math.min(2, Math.max(ref.width, ref.height) / Math.min(ref.width, ref.height));
  const long = Math.max(short, Math.round((short * ratio) / 64) * 64);
  return ref.width >= ref.height ? { width: long, height: short } : { width: short, height: long };
}

/**
 * The canvas of one request. Drawing from the prompt alone (a long-prompt recipe, or denoise 1) the picture has no
 * shape to follow, so the canvas takes the ASKED size's proportion (`asked`, the spec's art grid): a 192x320 tree
 * is drawn on a tall canvas, not on the 32x32 square of the sprite it replaces. Drawing image to image the
 * reference's shape is kept, since the model redraws what the reference holds.
 */
export function kaggleCanvasFor(
  ref: { width: number; height: number } | null,
  asked: { width: number; height: number } | null,
  size: number,
  fromPrompt: boolean,
): { width: number; height: number } {
  return kaggleCanvas(fromPrompt && asked !== null ? asked : ref, size);
}

export interface KaggleRequest {
  name: string;
  prompt: string;
  png: Buffer;
  seed: number;
  subject?: KaggleSubject;
  /** The spec's art grid (its width x height), which a `grid` post-process downscales to; else the canvas over 16. */
  grid?: { width: number; height: number };
}

/** What the kernel reads: the settings of the recipe and each request with its reference, canvas and denoise. */
export function kaggleWave(requests: readonly KaggleRequest[], s: KaggleSettings): Record<string, unknown> {
  return {
    settings: {
      recipe: s.recipe, model: s.model, vae: s.vae, lora_repo: s.loraRepo, lora_file: s.loraFile, lora_strength: s.loraStrength,
      denoise: s.denoise, steps: s.steps, inference_steps: kaggleInferenceSteps(s.steps, s.denoise),
      size: s.size, cfg: s.cfg, negative: KAGGLE_NEGATIVE, clip_tokens: CLIP_TOKENS,
      quant: s.quant, scheduler: s.scheduler, token_limit: s.tokenLimit, dtype: s.dtype, post: s.post, post_scale: KAGGLE_POST_SCALE,
    },
    requests: requests.map((r) => {
      const denoise = r.subject === 'character' ? s.denoiseCharacter : s.denoise;
      const canvas = kaggleCanvasFor(pngSize(r.png), r.grid ?? null, s.size, kaggleFromPrompt(s.recipe) || denoise >= 1);
      const grid = r.grid ?? { width: Math.max(1, Math.round(canvas.width / 16)), height: Math.max(1, Math.round(canvas.height / 16)) };
      return {
        name: r.name, file: kaggleFileName(r.name), prompt: r.prompt, seed: r.seed, subject: r.subject ?? 'prop',
        denoise, inference_steps: kaggleInferenceSteps(s.steps, denoise), width: canvas.width, height: canvas.height,
        grid_width: grid.width, grid_height: grid.height,
        png: r.png.toString('base64'),
      };
    }),
  };
}

/** Split a wave so each pushed script stays under the embed limit (a single big reference still goes alone). */
export function splitWave<T extends { png: Buffer }>(requests: readonly T[], limit: number): T[][] {
  const chunks: T[][] = [];
  let size = 0;
  for (const request of requests) {
    const cost = Math.ceil(request.png.length * 4 / 3) + 1024;
    const last = chunks[chunks.length - 1];
    if (last === undefined || size + cost > limit) {
      chunks.push([request]);
      size = cost;
    } else {
      last.push(request);
      size += cost;
    }
  }
  return chunks;
}

/** The marker the wave sits between in the pushed script, so a test can read it back. */
export const KAGGLE_WAVE_MARK = 'WAVE_B64';

/**
 * The kernel: a Python script with the wave inline, one of two paths by recipe.
 *
 * `sd15` and `sdxl` load the recipe's image-to-image pipeline (SD 1.5, or SDXL in fp16 with its VAE swapped and
 * tiled) with the Euler sampler and the LoRA at the recipe's strength, count each prompt with the pipeline's own
 * tokenizers and refuse one past CLIP's window rather than let it be cut, pad each reference to its canvas's shape
 * and scale it up with nearest neighbour, and draw it at its subject's denoise.
 *
 * `qwen` and `flux` draw text to image in two phases so a T4 holds them: the text encoders alone first (on the
 * second GPU when there is one), every prompt counted with the pipeline's own tokenizer against its real window
 * and encoded, then freed; then the transformer in NF4 (Qwen's Lightning LoRA and scheduler), computing in the
 * recipe's precision (fp32 widens each 16-bit layer per call, `compute_in_fp32`), drawing from the stored
 * embeddings at the canvas's size. A non-finite encoding or a black picture (a NaN) is an error, not a draw.
 *
 * With `post` `grid`, every recipe keys the picture's background (what touches the border and is near its colour,
 * magenta-like, or a darker shade of it such as a ground shadow) to flat #FF00FF, drops a small speck far from the
 * subject so it does not widen the box, and downscales the subject's box with nearest neighbour onto the spec's
 * art grid (a cell that is mostly background stays magenta), then scales it up by `post_scale` so the importer
 * reads a clean grid; the full-size picture is kept as `<name>.full.png`. Each run writes `<name>.png` plus
 * `kitgen-manifest.json` (device, GPUs, load and encode times, per image seconds, tokens, canvas, or error).
 */
export function kaggleKernelScript(wave: Record<string, unknown>): string {
  const b64 = Buffer.from(JSON.stringify(wave)).toString('base64');
  return `# kit:gen wave for the kaggle drawer, written by tools/src/kit/drawers.ts; pushed as a private script kernel.
import base64, gc, io, json, math, os, subprocess, sys, time, traceback

${KAGGLE_WAVE_MARK} = "${b64}"
WAVE = json.loads(base64.b64decode(${KAGGLE_WAVE_MARK}).decode("utf-8"))
OUT = "/kaggle/working" if os.path.isdir("/kaggle/working") else os.getcwd()
START = time.time()
MANIFEST = {"device": None, "gpus": None, "load_seconds": None, "encode_seconds": None, "seconds": None, "error": None, "settings": WAVE["settings"], "images": []}


def save():
    with open(os.path.join(OUT, "kitgen-manifest.json"), "w") as f:
        json.dump(MANIFEST, f, indent=1)


def say(text):
    print(f"[kitgen {time.time() - START:7.1f}s] {text}", flush=True)


def pip_install(*names):
    say("installing " + " ".join(names))
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", *names], check=True)


def to_grid(image, grid_width, grid_height, scale):
    # key the background to flat magenta and downscale the subject onto the art grid with nearest neighbour
    import numpy as np
    from PIL import Image
    from scipy import ndimage
    a = np.asarray(image.convert("RGB")).astype(np.int32)
    border = np.concatenate([a[:2].reshape(-1, 3), a[-2:].reshape(-1, 3), a[:, :2].reshape(-1, 3), a[:, -2:].reshape(-1, 3)])
    background = np.median(border, axis=0)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    near = np.sqrt(((a - background) ** 2).sum(-1)) < 64
    magentaish = (r > 90) & (b > 90) & (g < 0.6 * np.minimum(r, b))
    # a shadow on the ground, or an edge blended into the background, is a darker shade of it: the same
    # colour direction, no brighter (near-black pixels have no direction to speak of and stay)
    length = np.sqrt((a ** 2).sum(-1))
    toward = (a * background).sum(-1) / np.maximum(length * float(np.sqrt((background ** 2).sum())), 1.0)
    shade = (toward > 0.99) & (length > 40) & (a.max(-1) <= background.max() + 16)
    labels, _ = ndimage.label(near | magentaish | shade)
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    back = np.isin(labels, edge[edge != 0]) | (np.sqrt(((a - np.array([255, 0, 255])) ** 2).sum(-1)) < 60)
    # a speck far from the subject (a stray pebble in a corner, a crumb of shadow) would widen the box the
    # subject is fitted to: a part under a hundredth of the largest that reaches outside the big parts' box,
    # widened by a twentieth of the picture, goes to the background
    parts, count = ndimage.label(~back)
    if count > 1:
        sizes = ndimage.sum(np.ones(parts.shape), parts, np.arange(1, count + 1))
        big = np.isin(parts, 1 + np.nonzero(sizes >= sizes.max() / 100)[0])
        bys, bxs = np.nonzero(big)
        m = max(a.shape[:2]) // 20
        inside = np.zeros(parts.shape, bool)
        inside[max(0, bys.min() - m):bys.max() + 1 + m, max(0, bxs.min() - m):bxs.max() + 1 + m] = True
        back |= np.isin(parts, np.unique(parts[~big & ~inside & (parts > 0)]))
    ys, xs = np.nonzero(~back)
    if len(xs) == 0:
        raise ValueError("the picture is all background after the magenta key")
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    pad = max(1, round(min(grid_width, grid_height) / 32))
    bw, bh = x1 - x0, y1 - y0
    k = min((grid_width - 2 * pad) / bw, (grid_height - 2 * pad) / bh)
    aw, ah = max(1, min(grid_width, round(bw * k))), max(1, min(grid_height, round(bh * k)))
    out = np.zeros((grid_height, grid_width, 3), np.uint8)
    out[...] = (255, 0, 255)
    ox, oy = (grid_width - aw) // 2, (grid_height - ah) // 2
    for j in range(ah):
        sy0 = y0 + (j * bh) // ah
        sy1 = max(sy0 + 1, y0 + ((j + 1) * bh) // ah)
        for i in range(aw):
            sx0 = x0 + (i * bw) // aw
            sx1 = max(sx0 + 1, x0 + ((i + 1) * bw) // aw)
            cell = back[sy0:sy1, sx0:sx1]
            if cell.mean() > 0.5:
                continue
            cy, cx = (sy0 + sy1) // 2, (sx0 + sx1) // 2
            colour = a[cy, cx] if not back[cy, cx] else np.median(a[sy0:sy1, sx0:sx1][~cell], axis=0)
            out[oy + j, ox + i] = colour
    return Image.fromarray(out).resize((grid_width * scale, grid_height * scale), Image.NEAREST)


def finish(r, item, image):
    # the post-process, then the PNG the importer reads
    s = WAVE["settings"]
    if s["post"] == "grid":
        image.save(os.path.join(OUT, r["file"][:-4] + ".full.png"), format="PNG")
        image = to_grid(image, r["grid_width"], r["grid_height"], s["post_scale"])
    image.save(os.path.join(OUT, r["file"]), format="PNG")
    item["file"] = r["file"]


def new_item(r):
    return {"name": r["name"], "file": None, "seconds": None, "error": None, "tokens": None,
            "width": r["width"], "height": r["height"], "denoise": r["denoise"]}


def log_item(r, item):
    MANIFEST["images"].append(item)
    save()
    say(f"{r['name']} {r['width']}x{r['height']} denoise {r['denoise']} {item['tokens']} tokens {item['seconds']}s {item['error'] or 'ok'}")


def draw_sd(s):
    import torch
    from PIL import Image
    from diffusers import AutoencoderKL, EulerDiscreteScheduler, StableDiffusionImg2ImgPipeline, StableDiffusionXLImg2ImgPipeline

    cuda = torch.cuda.is_available()
    device = "cuda" if cuda else "cpu"
    dtype = torch.float16 if cuda else torch.float32
    extra = {}
    if s["vae"]:
        extra["vae"] = AutoencoderKL.from_pretrained(s["vae"], torch_dtype=dtype)
    if s["recipe"] == "sdxl":
        pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(
            s["model"], torch_dtype=dtype, use_safetensors=True, **({"variant": "fp16"} if cuda else {}), **extra)
    else:
        pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
            s["model"], torch_dtype=dtype, safety_checker=None, requires_safety_checker=False, **extra)
    pipe.scheduler = EulerDiscreteScheduler.from_config(pipe.scheduler.config)
    pipe.load_lora_weights(s["lora_repo"], weight_name=s["lora_file"], adapter_name="pixel")
    pipe.set_adapters(["pixel"], adapter_weights=[s["lora_strength"]])
    pipe = pipe.to(device)
    if s["recipe"] == "sdxl":
        # a 1024 px canvas decodes in tiles, so the VAE's peak stays well inside a T4's 16 GB
        pipe.vae.enable_tiling()
    pipe.set_progress_bar_config(disable=True)
    MANIFEST["load_seconds"] = round(time.time() - START, 1)
    save()
    say("model loaded")

    def clip_tokens(text):
        # every text encoder the pipeline has; CLIP cuts past its window without an error, so it is counted here
        counts = [len(t(text).input_ids) for t in (getattr(pipe, "tokenizer", None), getattr(pipe, "tokenizer_2", None)) if t is not None]
        return max(counts) if counts else 0

    def too_long(what, text):
        n = clip_tokens(text)
        if n > s["clip_tokens"]:
            return f"the {what} is {n} CLIP tokens, past the encoder's {s['clip_tokens']}: it would be cut silently, so it is not drawn; shorten it"
        return None

    def on_canvas(png, width, height):
        # pad with the reference's own background to the canvas's shape, then scale up with nearest neighbour
        ref = Image.open(io.BytesIO(base64.b64decode(png))).convert("RGB")
        rw, rh = ref.size
        if rw * height > rh * width:
            pw, ph = rw, max(rh, round(rw * height / width))
        else:
            pw, ph = max(rw, round(rh * width / height)), rh
        if (pw, ph) != (rw, rh):
            padded = Image.new("RGB", (pw, ph), ref.getpixel((0, 0)))
            padded.paste(ref, ((pw - rw) // 2, (ph - rh) // 2))
            ref = padded
        return ref.resize((width, height), Image.NEAREST)

    negative_error = too_long("negative prompt", s["negative"])
    if negative_error is not None:
        raise ValueError(negative_error)
    for r in WAVE["requests"]:
        began = time.time()
        item = new_item(r)
        try:
            item["tokens"] = clip_tokens(r["prompt"])
            item["error"] = too_long("prompt", r["prompt"])
            if item["error"] is None:
                image = pipe(
                    prompt=r["prompt"], negative_prompt=s["negative"], image=on_canvas(r["png"], r["width"], r["height"]),
                    strength=r["denoise"], num_inference_steps=r["inference_steps"], guidance_scale=s["cfg"],
                    generator=torch.Generator(device="cpu").manual_seed(r["seed"]),
                ).images[0]
                finish(r, item, image)
        except Exception as error:  # one bad request does not lose the wave
            item["error"] = f"{type(error).__name__}: {error}"[:400]
        item["seconds"] = round(time.time() - began, 1)
        log_item(r, item)


def compute_in(model, dtype):
    # a pre-quantized checkpoint names bf16 compute and keeps its unquantized layers in bf16; a T4 runs bf16 about
    # three times slower than fp16, and a mix of the two fails in the first matmul, so the 4-bit layers compute in
    # dtype and every other weight is cast to it (buffers such as rotary frequencies stay as they are); the compute
    # type is pinned, or bitsandbytes switches a layer to its input's dtype on the first call
    for module in model.modules():
        if type(module).__name__ == "Linear4bit":
            module.compute_dtype = dtype
            module.compute_type_is_set = True
    for param in model.parameters():
        if type(param).__name__ != "Params4bit" and param.dtype.is_floating_point and param.dtype != dtype:
            param.data = param.data.to(dtype)


def compute_in_fp32(model):
    # fp32 compute from 16-bit storage, for a transformer whose activations pass fp16's range: the 4-bit layers
    # dequantize to fp32, the unquantized linear layers keep their 16-bit weights and multiply from an fp32 copy
    # per call (holding them all in fp32 leaves a T4 no room to draw), norms and biases are cast (they are small),
    # and the LoRA runs in bf16, which has fp32's range at half the memory
    import torch
    import torch.nn.functional as F

    def wide(module):
        return lambda x: F.linear(x.float(), module.weight.float(), None if module.bias is None else module.bias.float())

    for name, module in model.named_modules():
        if type(module).__name__ == "Linear4bit":
            module.compute_dtype = torch.float32
            module.compute_type_is_set = True
        elif type(module) is torch.nn.Linear and "lora_" not in name:
            module.forward = wide(module)
    for name, param in model.named_parameters():
        if "lora_" in name:
            param.data = param.data.to(torch.bfloat16)
        elif type(param).__name__ != "Params4bit" and param.dtype.is_floating_point and param.dim() == 1:
            param.data = param.data.float()


LIGHTNING_SCHEDULER = {
    "base_image_seq_len": 256, "base_shift": math.log(3), "invert_sigmas": False, "max_image_seq_len": 8192,
    "max_shift": math.log(3), "num_train_timesteps": 1000, "shift": 1.0, "shift_terminal": None,
    "stochastic_sampling": False, "time_shift_type": "exponential", "use_beta_sigmas": False,
    "use_dynamic_shifting": True, "use_exponential_sigmas": False, "use_karras_sigmas": False,
}


def draw_from_prompt(s):
    import numpy as np
    import torch
    import diffusers
    from diffusers import BitsAndBytesConfig, FlowMatchEulerDiscreteScheduler

    if not torch.cuda.is_available():
        raise RuntimeError(f"{s['recipe']} needs a GPU: set KAGGLE_GPU=1")
    dtype = {"fp16": torch.float16, "bf16": torch.bfloat16, "fp32": torch.float32}[s["dtype"]]
    # the transformer and FLUX's T5 (19 GB in fp32) load in 16 bits whatever the compute; fp32 compute widens the
    # transformer's layers per call (compute_in_fp32), and Qwen's 4-bit encoder fits a card in fp32 as it is
    stored = torch.float16 if dtype == torch.float32 else dtype
    qwen = s["recipe"] == "qwen"
    gpus = torch.cuda.device_count()
    MANIFEST["gpus"] = gpus
    encode_on = "cuda:1" if gpus > 1 else "cuda:0"
    Pipe = diffusers.QwenImagePipeline if qwen else diffusers.FluxPipeline
    Model = diffusers.QwenImageTransformer2DModel if qwen else diffusers.FluxTransformer2DModel

    # phase one: the text encoders alone, every prompt of the wave counted and encoded, then freed
    if qwen:
        from transformers import Qwen2_5_VLForConditionalGeneration
        encoder = Qwen2_5_VLForConditionalGeneration.from_pretrained(s["model"], subfolder="text_encoder", dtype=dtype, device_map={"": encode_on})
        compute_in(encoder, dtype)
        enc = Pipe.from_pretrained(s["model"], text_encoder=encoder, transformer=None, vae=None, torch_dtype=dtype)
    else:
        enc = Pipe.from_pretrained(s["model"], transformer=None, vae=None, torch_dtype=stored)
        enc.text_encoder.to(encode_on)
        enc.text_encoder_2.to(encode_on)
    say(f"text encoders loaded on {encode_on}")
    embeds, items = {}, {}
    with torch.no_grad():
        for r in WAVE["requests"]:
            item = new_item(r)
            items[r["name"]] = item
            try:
                main = enc.tokenizer if qwen else enc.tokenizer_2
                item["tokens"] = len(main(r["prompt"]).input_ids)
                if not qwen:
                    item["clip_tokens"] = len(enc.tokenizer(r["prompt"]).input_ids)
                if item["tokens"] > s["token_limit"]:
                    item["error"] = f"the prompt is {item['tokens']} tokens, past the encoder's {s['token_limit']}: it would be cut silently, so it is not drawn; shorten it"
                    continue
                if qwen:
                    pe, mask = enc.encode_prompt(prompt=r["prompt"], device=encode_on, max_sequence_length=s["token_limit"])
                    given = {"prompt_embeds": pe.cpu(), "prompt_embeds_mask": None if mask is None else mask.cpu()}
                else:
                    pe, pooled, _ = enc.encode_prompt(prompt=r["prompt"], prompt_2=None, device=encode_on, max_sequence_length=s["token_limit"])
                    given = {"prompt_embeds": pe.cpu(), "pooled_prompt_embeds": pooled.cpu()}
                if not all(torch.isfinite(v).all() for k, v in given.items() if v is not None and v.is_floating_point()):
                    item["error"] = f"the prompt's encoding overflowed in {s['dtype']}: try KAGGLE_DTYPE=fp32"
                    continue
                embeds[r["name"]] = given
            except Exception as error:
                item["error"] = f"{type(error).__name__}: {error}"[:400]
    del enc
    if qwen:
        del encoder
    gc.collect()
    torch.cuda.empty_cache()
    MANIFEST["encode_seconds"] = round(time.time() - START, 1)
    say(f"{len(embeds)} prompts encoded, encoders freed")

    # phase two: the transformer in 4-bit, drawing from the stored embeddings
    load = {}
    if s["quant"] == "nf4":
        load["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=stored)
    transformer = Model.from_pretrained(s["model"], subfolder="transformer", torch_dtype=stored, **load)
    if dtype != torch.float32:
        compute_in(transformer, dtype)
    blank = {"text_encoder": None} if qwen else {"text_encoder": None, "text_encoder_2": None}
    pipe = Pipe.from_pretrained(s["model"], transformer=transformer, torch_dtype=stored, **blank)
    pipe.vae.to("cuda:0")
    pipe.vae.enable_tiling()
    if s["scheduler"] == "lightning":
        pipe.scheduler = FlowMatchEulerDiscreteScheduler.from_config(LIGHTNING_SCHEDULER)
    if s["lora_repo"]:
        pipe.load_lora_weights(s["lora_repo"], weight_name=s["lora_file"], adapter_name="speed")
        pipe.set_adapters(["speed"], adapter_weights=[s["lora_strength"]])
    if dtype == torch.float32:
        compute_in_fp32(transformer)
        gc.collect()
        torch.cuda.empty_cache()
    pipe.set_progress_bar_config(disable=True)
    MANIFEST["load_seconds"] = round(time.time() - START, 1)
    MANIFEST["vram_gb"] = round(torch.cuda.memory_allocated(0) / 1e9, 2)
    save()
    say(f"transformer loaded, {MANIFEST['vram_gb']} GB on cuda:0")
    for r in WAVE["requests"]:
        began = time.time()
        item = items[r["name"]]
        try:
            if r["name"] in embeds:
                # float embeddings in the compute dtype: the pipeline draws its latents in theirs
                given = {k: (None if v is None else v.to("cuda:0", dtype) if v.is_floating_point() else v.to("cuda:0")) for k, v in embeds[r["name"]].items()}
                guide = {"true_cfg_scale": s["cfg"]} if qwen else {"guidance_scale": s["cfg"], "max_sequence_length": s["token_limit"]}
                with torch.no_grad():
                    image = pipe(**given, width=r["width"], height=r["height"], num_inference_steps=s["steps"],
                                 generator=torch.Generator(device="cpu").manual_seed(r["seed"]), **guide).images[0]
                if np.asarray(image).max() < 8:
                    item["error"] = f"the picture came back black (a NaN in {s['dtype']})" + ("" if s["dtype"] == "fp32" else ": try KAGGLE_DTYPE=fp32")
                else:
                    finish(r, item, image)
        except Exception as error:  # one bad request does not lose the wave
            item["error"] = f"{type(error).__name__}: {error}"[:400]
        item["seconds"] = round(time.time() - began, 1)
        log_item(r, item)


try:
    from importlib import metadata
    try:
        torchao = tuple(int(x) for x in metadata.version("torchao").split(".")[:2])
    except Exception:
        torchao = None
    if torchao is not None and torchao < (0, 16):
        # peft refuses an old torchao when it wraps the LoRA layers; nothing here quantizes with it, so it goes
        say(f"removing torchao {torchao}, too old for peft")
        subprocess.run([sys.executable, "-m", "pip", "uninstall", "-y", "-q", "torchao"], check=True)
    s = WAVE["settings"]
    from importlib.util import find_spec
    if s["recipe"] in ("qwen", "flux") and find_spec("bitsandbytes") is None:
        # before diffusers is imported: it looks for bitsandbytes once, at import
        pip_install("bitsandbytes")
    try:
        import diffusers, peft  # noqa: F401
    except ImportError:
        pip_install("diffusers", "peft")
    import torch
    MANIFEST["device"] = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu"
    say(f"device {MANIFEST['device']} x{torch.cuda.device_count()}, recipe {s['recipe']}, {len(WAVE['requests'])} requests")
    if s["recipe"] in ("qwen", "flux"):
        draw_from_prompt(s)
    else:
        draw_sd(s)
except Exception as error:
    MANIFEST["error"] = f"{type(error).__name__}: {error}"[:600]
    traceback.print_exc()
MANIFEST["seconds"] = round(time.time() - START, 1)
save()
say("done")
`;
}

/** The kernel's `kernel-metadata.json`: a private script with internet (the weights) and, unless turned off, a GPU. */
export function kaggleMetadata(kernelId: string, codeFile: string, s: KaggleSettings): Record<string, unknown> {
  const slug = kernelId.split('/')[1] ?? kernelId;
  return {
    id: kernelId,
    title: slug,
    code_file: codeFile,
    language: 'python',
    kernel_type: 'script',
    is_private: true,
    enable_gpu: s.gpu,
    enable_internet: true,
    ...(s.accelerator === '' ? {} : { machine_shape: s.accelerator }),
    dataset_sources: [],
    competition_sources: [],
    kernel_sources: [],
    model_sources: [],
  };
}

/** `kaggle kernels status`: the state word (`complete`, `running`, `error`, ...), whether it is over, and a failure message. */
export function kaggleStatus(text: string): { state: string | null; done: boolean; failed: boolean; message: string } {
  const state = /status\s+"?(?:KernelWorkerStatus\.)?([A-Za-z_]+)"?/u.exec(text)?.[1]?.toLowerCase() ?? null;
  const message = /failure message:?\s*"?([^"\n]*)"?/iu.exec(text)?.[1]?.trim() ?? '';
  const failed = state === 'error' || state === 'cancelacknowledged' || state === 'cancelrequested' || state === 'cancel_acknowledged' || state === 'cancel_requested';
  return { state, done: state === 'complete' || failed, failed, message };
}

/** `kaggle kernels push`: did the version go up, else the CLI's words (a refused GPU says so here). */
export function kagglePushAnswer(text: string): { ok: boolean; error: string | null } {
  if (/successfully pushed/iu.test(text) && !/error/iu.test(text)) return { ok: true, error: null };
  const said = text.trim().replace(/\s+/gu, ' ');
  return { ok: false, error: said === '' ? 'the push said nothing' : said.slice(0, 400) };
}

export interface KaggleManifestImage { name: string; file: string | null; seconds: number | null; error: string | null; tokens?: number }

/** The kernel's `kitgen-manifest.json`, read defensively. */
export function kaggleManifest(body: string): { device: string | null; loadSeconds: number | null; encodeSeconds: number | null; seconds: number | null; error: string | null; images: KaggleManifestImage[] } {
  let json: { device?: unknown; load_seconds?: unknown; encode_seconds?: unknown; seconds?: unknown; error?: unknown; images?: unknown };
  try {
    json = JSON.parse(body) as typeof json;
  } catch {
    return { device: null, loadSeconds: null, encodeSeconds: null, seconds: null, error: `the kernel manifest is not JSON: ${body.slice(0, 120)}`, images: [] };
  }
  const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
  const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const images = (Array.isArray(json.images) ? json.images : []).flatMap((raw: unknown) => {
    const item = raw as Record<string, unknown>;
    const name = str(item['name']);
    const tokens = n(item['tokens']);
    return name === null ? [] : [{ name, file: str(item['file']), seconds: n(item['seconds']), error: str(item['error']), ...(tokens === null ? {} : { tokens }) }];
  });
  return { device: str(json.device), loadSeconds: n(json.load_seconds), encodeSeconds: n(json.encode_seconds), seconds: n(json.seconds), error: str(json.error), images };
}

function runCli(cli: string, args: readonly string[], timeoutSeconds: number): { status: number | null; text: string; error?: Error } {
  const run = spawnSync(cli, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: timeoutSeconds * 1000, maxBuffer: 64 * 1024 * 1024 });
  return { status: run.status, text: `${run.stdout ?? ''}${run.stderr ?? ''}`, ...(run.error === undefined ? {} : { error: run.error }) };
}

/** The kernel's `owner/slug`: `KAGGLE_KERNEL` as given, else the slug under the signed-in user. */
export function kaggleKernelId(s: KaggleSettings, env: NodeJS.ProcessEnv): { id: string | null; error: string | null } {
  if (s.kernel.includes('/')) return { id: s.kernel, error: null };
  const user = env['KAGGLE_USERNAME'];
  if (user !== undefined && user !== '') return { id: `${user}/${s.kernel}`, error: null };
  const view = runCli(s.cli, ['config', 'view'], 60);
  if (view.error !== undefined) return { id: null, error: `the kaggle CLI did not run (${s.cli}; set KAGGLE_CLI): ${view.error.message}` };
  const owner = kaggleOwner(view.text);
  return owner === null ? { id: null, error: 'the kaggle CLI is not signed in (kaggle config view shows no username)' } : { id: `${owner}/${s.kernel}`, error: null };
}

export interface KaggleWaveCall {
  /** The run folder: `work/`, `log/` and `kaggle/` are under it. */
  out: string;
  stamp: string;
  requests: readonly { name: string; prompt: string; reference: string; expect: string; seed?: number; subject?: KaggleSubject; grid?: { width: number; height: number } }[];
  /** Per picture; the wave waits the setup time plus this for each picture. */
  timeoutSeconds: number;
  env?: NodeJS.ProcessEnv;
}

/**
 * A whole wave in one kernel run (or a few, past the embed limit): write the script and its metadata, push,
 * poll the status, fetch the output, and hand each request its own `Drawn`. A request's `seconds` is its
 * share of the run's wall time (start, model load and drawing), the honest price of a picture on this route;
 * its log names the drawing time alone too.
 */
export function drawWaveWithKaggle(call: KaggleWaveCall): Map<string, Drawn> {
  const env = call.env ?? process.env;
  const s = kaggleSettings(env);
  const version = s.loraFile === '' ? s.model : `${s.model}+${s.loraFile}`;
  const result = new Map<string, Drawn>();
  const fail = (names: readonly string[], lines: readonly string[], error: string, seconds: number, exit: number | null): void => {
    for (const name of names) {
      const logPath = join(call.out, 'log', `${name}-${call.stamp}.txt`);
      writeFileSync(logPath, [...lines, error].join('\n'));
      result.set(name, { version, exit, seconds, tokens: null, log: logPath.replace(`${call.out}/`, ''), saved: null, error });
    }
  };
  const kernel = kaggleKernelId(s, env);
  if (kernel.id === null) {
    fail(call.requests.map((r) => r.name), [], kernel.error ?? 'no kernel id', 0, null);
    return result;
  }
  const requests = call.requests.map((r) => ({ ...r, png: readFileSync(r.reference) }));
  splitWave(requests, s.embedLimit).forEach((chunk, index) => {
    const since = Date.now();
    const names = chunk.map((r) => r.name);
    const dir = join(call.out, 'kaggle', `${call.stamp}-${index + 1}`);
    const src = join(dir, 'kernel');
    const got = join(dir, 'output');
    mkdirSync(src, { recursive: true });
    mkdirSync(got, { recursive: true });
    const codeFile = 'kitgen_wave.py';
    writeFileSync(join(src, codeFile), kaggleKernelScript(kaggleWave(chunk.map((r) => ({ name: r.name, prompt: r.prompt, png: r.png, seed: r.seed ?? s.seed, ...(r.subject === undefined ? {} : { subject: r.subject }), ...(r.grid === undefined ? {} : { grid: r.grid }) })), s)));
    writeFileSync(join(src, 'kernel-metadata.json'), JSON.stringify(kaggleMetadata(kernel.id ?? '', codeFile, s), null, 1));
    const limit = Math.round(s.setupSeconds + call.timeoutSeconds * chunk.length);
    const lines = [
      `kaggle kernel ${(kernel.id ?? '').split('/')[1] ?? ''} run ${index + 1}, ${chunk.length} pictures, ${s.gpu ? `gpu ${s.accelerator || 'any'}` : 'cpu'}`,
      `recipe ${s.recipe}, model ${s.model}${s.vae === '' ? '' : `, vae ${s.vae}`}${s.quant === '' ? '' : `, ${s.quant}`}, ${s.dtype}`, s.loraRepo === '' ? 'no lora' : `lora ${s.loraRepo}/${s.loraFile} x${s.loraStrength}`,
      `denoise ${s.denoise} (characters ${s.denoiseCharacter}) steps ${s.steps} short side ${s.size} cfg ${s.cfg} post ${s.post}`,
      `kernel ${src.replace(`${call.out}/`, '')}`,
    ];
    const elapsed = (): number => Math.round((Date.now() - since) / 1000);
    const push = runCli(s.cli, ['kernels', 'push', '-p', src, '-t', String(limit)], 300);
    const pushed = push.error === undefined ? kagglePushAnswer(push.text) : { ok: false, error: `the kaggle CLI did not run (${s.cli}; set KAGGLE_CLI): ${push.error.message}` };
    if (!pushed.ok) {
      fail(names, lines, `Kaggle refused the kernel: ${pushed.error ?? ''}`, elapsed(), push.status);
      return;
    }
    lines.push('pushed');
    let status = kaggleStatus('');
    const deadline = since + (limit + 300) * 1000;
    while (Date.now() < deadline) {
      spawnSync('sleep', [String(s.pollSeconds)]);
      const asked = runCli(s.cli, ['kernels', 'status', kernel.id ?? ''], 120);
      status = kaggleStatus(asked.text);
      if (status.done) break;
    }
    lines.push(`status ${status.state ?? 'unknown'} after ${elapsed()} s${status.message === '' ? '' : `: ${status.message}`}`);
    if (!status.done) {
      fail(names, lines, `the kaggle run did not finish in ${limit + 300} s (Kaggle stops it at ${limit} s)`, elapsed(), null);
      return;
    }
    const fetched = runCli(s.cli, ['kernels', 'output', kernel.id ?? '', '-p', got, '-o', '-q'], 600);
    const manifestPath = join(got, 'kitgen-manifest.json');
    if (!existsSync(manifestPath)) {
      const logFile = readdirSync(got).find((f) => f.endsWith('.log'));
      const tail = logFile === undefined ? fetched.text : readFileSync(join(got, logFile), 'utf8');
      fail(names, lines, `the kaggle run ended ${status.state ?? ''} with no manifest${status.message === '' ? '' : `: ${status.message}`}; log tail: ${tail.trim().slice(-300)}`, elapsed(), fetched.status);
      return;
    }
    const manifest = kaggleManifest(readFileSync(manifestPath, 'utf8'));
    lines.push(`device ${manifest.device ?? '?'}, start and queue ${manifest.seconds === null ? '?' : Math.round(elapsed() - manifest.seconds)} s, ${manifest.encodeSeconds === null ? '' : `prompts encoded at ${manifest.encodeSeconds} s, `}model load ${manifest.loadSeconds ?? '?'} s, kernel ${manifest.seconds ?? '?'} s, wall ${elapsed()} s`);
    const share = Math.round(elapsed() / chunk.length);
    for (const request of chunk) {
      const logPath = join(call.out, 'log', `${request.name}-${call.stamp}.txt`);
      const image = manifest.images.find((i) => i.name === request.name);
      const own = [...lines, image === undefined ? 'not drawn' : `drawn in ${image.seconds ?? '?'} s${image.tokens === undefined ? '' : `, prompt ${image.tokens} ${s.tokenLimit === CLIP_TOKENS ? 'CLIP ' : ''}tokens`}`];
      const drawn = (saved: string | null, error: string): Drawn => {
        writeFileSync(logPath, [...own, saved === null ? error : ''].filter((l) => l !== '').join('\n'));
        return { version, exit: 0, seconds: share, tokens: null, log: logPath.replace(`${call.out}/`, ''), saved, error };
      };
      const from = image?.file === null || image?.file === undefined ? null : join(got, image.file);
      if (from === null || !existsSync(from)) {
        result.set(request.name, drawn(null, image?.error ?? manifest.error ?? 'the kaggle run returned no picture for it'));
        continue;
      }
      if (!readFileSync(from).subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        result.set(request.name, drawn(null, 'the kaggle run returned a file that is not a PNG; the importer reads PNG only'));
        continue;
      }
      const saved = join(call.out, 'work', request.expect);
      copyFileSync(from, saved);
      result.set(request.name, drawn(saved, ''));
    }
  });
  return result;
}

/** One picture down the kaggle route: a wave of one. `kit:gen` sends a whole wave at once instead. */
export function drawWithKaggle(call: DrawCall & { seed?: number; subject?: KaggleSubject; grid?: { width: number; height: number } }): Drawn {
  const reference = call.images[0];
  const logPath = join(call.out, 'log', `${call.name}-${call.stamp}.txt`);
  if (reference === undefined) {
    writeFileSync(logPath, 'no reference');
    return { version: 'kaggle', exit: null, seconds: 0, tokens: null, log: logPath.replace(`${call.out}/`, ''), saved: null, error: 'the kaggle route needs the reference image' };
  }
  const wave = drawWaveWithKaggle({
    out: call.out, stamp: call.stamp, timeoutSeconds: call.timeoutSeconds, ...(call.env === undefined ? {} : { env: call.env }),
    requests: [{
      name: call.name, prompt: call.prompt, reference, expect: call.expect,
      ...(call.seed === undefined ? {} : { seed: call.seed }), ...(call.subject === undefined ? {} : { subject: call.subject }),
      ...(call.grid === undefined ? {} : { grid: call.grid }),
    }],
  });
  return wave.get(call.name) ?? { version: 'kaggle', exit: null, seconds: 0, tokens: null, log: logPath.replace(`${call.out}/`, ''), saved: null, error: 'the kaggle route returned nothing' };
}
