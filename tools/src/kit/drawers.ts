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
 *           the environment (`COMFYUI_URL`, `LOCAL_DENOISE`, `LOCAL_STEPS` 20, `LOCAL_SIZE` 512; 384/12 is 94 s but speckled); the prompt
 *           is the compact one, since the model reads about 75 tokens.
 *   kaggle  the local recipe (the same checkpoint, LoRA, prompt, denoise, steps and size) with `diffusers` in a
 *           private Kaggle kernel on its free GPU, driven by the `kaggle` CLI. A kernel takes minutes to start,
 *           so `kit:gen` sends the whole wave in one run (`drawWaveWithKaggle`): push, poll, fetch the output.
 *           On a T4 (22.10) 4-5 s per picture plus about 90 s per wave (kernel start and the weights).
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
}

/** The local route's settings from the environment (`COMFYUI_URL`, `LOCAL_DENOISE`, `LOCAL_STEPS`, `LOCAL_SIZE`, `LOCAL_LORA`, `LOCAL_CHECKPOINT`), else the defaults. */
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
 * One image through the local ComfyUI (`~/ceos-server/scripts/comfyui.sh start` on the laptop that
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
  const seed = call.seed ?? 7;
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

/**
 * The local recipe on Kaggle's free GPU. The weights are the same open files the `local` route loads into
 * ComfyUI (SD 1.5 and PixelArtRedmond15V, here from Hugging Face), the prompt is `localPrompt`, and denoise,
 * steps, size, CFG and LoRA strength default to the local ones, so a picture from either route can sit in
 * one gallery. The kernel is a private script on the account the `kaggle` CLI is signed in to; the token
 * is the CLI's own (`~/.kaggle`), never read here.
 */
export const KAGGLE_DEFAULTS = {
  kernel: 'kitgen-drawer',
  cli: 'kaggle',
  model: 'stable-diffusion-v1-5/stable-diffusion-v1-5',
  loraRepo: 'artificialguybr/pixelartredmond-1-5v-pixel-art-loras-for-sd-1-5',
  loraFile: 'PixelArtRedmond15V-PixelArt-PIXARFK.safetensors',
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
  model: string;
  loraRepo: string;
  loraFile: string;
  loraStrength: number;
  denoise: number;
  steps: number;
  size: number;
  cfg: number;
  seed: number;
  setupSeconds: number;
  pollSeconds: number;
  embedLimit: number;
}

/**
 * The kaggle route's settings: `KAGGLE_KERNEL`, `KAGGLE_CLI`, `KAGGLE_GPU` (0 for a CPU run), `KAGGLE_ACCELERATOR`,
 * `KAGGLE_MODEL`, `KAGGLE_LORA_REPO`, `KAGGLE_LORA_FILE`, `KAGGLE_LORA_STRENGTH`, `KAGGLE_DENOISE`, `KAGGLE_STEPS`,
 * `KAGGLE_SIZE`, `KAGGLE_CFG`, `KAGGLE_SEED`, `KAGGLE_SETUP_SECONDS`, `KAGGLE_POLL_SECONDS`; the picture's
 * numbers default to the local route's.
 */
export function kaggleSettings(env: NodeJS.ProcessEnv = process.env): KaggleSettings {
  const num = (name: string, fallback: number): number => envNumber(env, name, fallback);
  const text = (name: string, fallback: string): string => {
    const raw = env[name];
    return raw === undefined || raw.trim() === '' ? fallback : raw.trim();
  };
  const gpu = text('KAGGLE_GPU', '1').toLowerCase();
  return {
    cli: text('KAGGLE_CLI', KAGGLE_DEFAULTS.cli),
    kernel: text('KAGGLE_KERNEL', KAGGLE_DEFAULTS.kernel),
    gpu: !['0', 'false', 'no', 'off'].includes(gpu),
    accelerator: text('KAGGLE_ACCELERATOR', ''),
    model: text('KAGGLE_MODEL', KAGGLE_DEFAULTS.model),
    loraRepo: text('KAGGLE_LORA_REPO', KAGGLE_DEFAULTS.loraRepo),
    loraFile: text('KAGGLE_LORA_FILE', KAGGLE_DEFAULTS.loraFile),
    loraStrength: num('KAGGLE_LORA_STRENGTH', LOCAL_DEFAULTS.loraStrength),
    denoise: Math.min(1, num('KAGGLE_DENOISE', LOCAL_DEFAULTS.denoise)),
    steps: Math.round(num('KAGGLE_STEPS', LOCAL_DEFAULTS.steps)),
    size: Math.round(num('KAGGLE_SIZE', LOCAL_DEFAULTS.size) / 8) * 8,
    cfg: num('KAGGLE_CFG', LOCAL_DEFAULTS.cfg),
    seed: Math.round(num('KAGGLE_SEED', KAGGLE_DEFAULTS.seed)),
    setupSeconds: num('KAGGLE_SETUP_SECONDS', KAGGLE_DEFAULTS.setupSeconds),
    pollSeconds: num('KAGGLE_POLL_SECONDS', KAGGLE_DEFAULTS.pollSeconds),
    embedLimit: num('KAGGLE_EMBED_LIMIT', KAGGLE_DEFAULTS.embedLimit),
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

export interface KaggleRequest {
  name: string;
  prompt: string;
  png: Buffer;
  seed: number;
}

/** What the kernel reads: the settings of the recipe and each request with its reference inline. */
export function kaggleWave(requests: readonly KaggleRequest[], s: KaggleSettings): Record<string, unknown> {
  return {
    settings: {
      model: s.model, lora_repo: s.loraRepo, lora_file: s.loraFile, lora_strength: s.loraStrength,
      denoise: s.denoise, steps: s.steps, inference_steps: kaggleInferenceSteps(s.steps, s.denoise),
      size: s.size, cfg: s.cfg, negative: LOCAL_NEGATIVE,
    },
    requests: requests.map((r) => ({ name: r.name, file: kaggleFileName(r.name), prompt: r.prompt, seed: r.seed, png: r.png.toString('base64') })),
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
 * The kernel: a Python script with the wave inline. It loads SD 1.5 image-to-image with the Euler sampler and
 * the LoRA at the local strength (on the UNet and the text encoder, as ComfyUI's LoraLoader does), draws each
 * reference scaled to the working size with nearest neighbour, and writes `<name>.png` plus
 * `kitgen-manifest.json` (device, load time, per image seconds or error) to the kernel's output.
 */
export function kaggleKernelScript(wave: Record<string, unknown>): string {
  const b64 = Buffer.from(JSON.stringify(wave)).toString('base64');
  return `# kit:gen wave for the kaggle drawer, written by tools/src/kit/drawers.ts; pushed as a private script kernel.
import base64, io, json, math, os, subprocess, sys, time, traceback

${KAGGLE_WAVE_MARK} = "${b64}"
WAVE = json.loads(base64.b64decode(${KAGGLE_WAVE_MARK}).decode("utf-8"))
OUT = "/kaggle/working" if os.path.isdir("/kaggle/working") else os.getcwd()
START = time.time()
MANIFEST = {"device": None, "load_seconds": None, "seconds": None, "error": None, "settings": WAVE["settings"], "images": []}


def save():
    with open(os.path.join(OUT, "kitgen-manifest.json"), "w") as f:
        json.dump(MANIFEST, f, indent=1)


def say(text):
    print(f"[kitgen {time.time() - START:7.1f}s] {text}", flush=True)


try:
    from importlib import metadata
    try:
        torchao = tuple(int(x) for x in metadata.version("torchao").split(".")[:2])
    except Exception:
        torchao = None
    if torchao is not None and torchao < (0, 16):
        # peft refuses an old torchao when it wraps the LoRA layers; nothing here quantizes, so it goes
        say(f"removing torchao {torchao}, too old for peft")
        subprocess.run([sys.executable, "-m", "pip", "uninstall", "-y", "-q", "torchao"], check=True)
    try:
        import diffusers, peft  # noqa: F401
    except ImportError:
        say("installing diffusers and peft")
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "diffusers", "peft"], check=True)
    import torch
    from PIL import Image
    from diffusers import EulerDiscreteScheduler, StableDiffusionImg2ImgPipeline

    s = WAVE["settings"]
    cuda = torch.cuda.is_available()
    device = "cuda" if cuda else "cpu"
    MANIFEST["device"] = torch.cuda.get_device_name(0) if cuda else "cpu"
    say(f"device {MANIFEST['device']}, {len(WAVE['requests'])} requests")
    pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
        s["model"], torch_dtype=torch.float16 if cuda else torch.float32, safety_checker=None, requires_safety_checker=False)
    pipe.scheduler = EulerDiscreteScheduler.from_config(pipe.scheduler.config)
    pipe.load_lora_weights(s["lora_repo"], weight_name=s["lora_file"], adapter_name="pixel")
    pipe.set_adapters(["pixel"], adapter_weights=[s["lora_strength"]])
    pipe = pipe.to(device)
    pipe.set_progress_bar_config(disable=True)
    MANIFEST["load_seconds"] = round(time.time() - START, 1)
    save()
    say("model loaded")
    for r in WAVE["requests"]:
        began = time.time()
        item = {"name": r["name"], "file": None, "seconds": None, "error": None}
        try:
            ref = Image.open(io.BytesIO(base64.b64decode(r["png"]))).convert("RGB").resize((s["size"], s["size"]), Image.NEAREST)
            image = pipe(
                prompt=r["prompt"], negative_prompt=s["negative"], image=ref, strength=s["denoise"],
                num_inference_steps=s["inference_steps"], guidance_scale=s["cfg"],
                generator=torch.Generator(device="cpu").manual_seed(r["seed"]),
            ).images[0]
            image.save(os.path.join(OUT, r["file"]), format="PNG")
            item["file"] = r["file"]
        except Exception as error:  # one bad request does not lose the wave
            item["error"] = f"{type(error).__name__}: {error}"[:400]
        item["seconds"] = round(time.time() - began, 1)
        MANIFEST["images"].append(item)
        save()
        say(f"{r['name']} {item['seconds']}s {item['error'] or 'ok'}")
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

export interface KaggleManifestImage { name: string; file: string | null; seconds: number | null; error: string | null }

/** The kernel's `kitgen-manifest.json`, read defensively. */
export function kaggleManifest(body: string): { device: string | null; loadSeconds: number | null; seconds: number | null; error: string | null; images: KaggleManifestImage[] } {
  let json: { device?: unknown; load_seconds?: unknown; seconds?: unknown; error?: unknown; images?: unknown };
  try {
    json = JSON.parse(body) as typeof json;
  } catch {
    return { device: null, loadSeconds: null, seconds: null, error: `the kernel manifest is not JSON: ${body.slice(0, 120)}`, images: [] };
  }
  const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
  const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const images = (Array.isArray(json.images) ? json.images : []).flatMap((raw: unknown) => {
    const item = raw as Record<string, unknown>;
    const name = str(item['name']);
    return name === null ? [] : [{ name, file: str(item['file']), seconds: n(item['seconds']), error: str(item['error']) }];
  });
  return { device: str(json.device), loadSeconds: n(json.load_seconds), seconds: n(json.seconds), error: str(json.error), images };
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
  requests: readonly { name: string; prompt: string; reference: string; expect: string; seed?: number }[];
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
  const version = `${s.model}+${s.loraFile}`;
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
    writeFileSync(join(src, codeFile), kaggleKernelScript(kaggleWave(chunk.map((r) => ({ name: r.name, prompt: r.prompt, png: r.png, seed: r.seed ?? s.seed })), s)));
    writeFileSync(join(src, 'kernel-metadata.json'), JSON.stringify(kaggleMetadata(kernel.id ?? '', codeFile, s), null, 1));
    const limit = Math.round(s.setupSeconds + call.timeoutSeconds * chunk.length);
    const lines = [
      `kaggle kernel ${(kernel.id ?? '').split('/')[1] ?? ''} run ${index + 1}, ${chunk.length} pictures, ${s.gpu ? `gpu ${s.accelerator || 'any'}` : 'cpu'}`,
      `model ${s.model}`, `lora ${s.loraRepo}/${s.loraFile} x${s.loraStrength}`,
      `denoise ${s.denoise} steps ${s.steps} (schedule ${kaggleInferenceSteps(s.steps, s.denoise)}) size ${s.size} cfg ${s.cfg}`,
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
    lines.push(`device ${manifest.device ?? '?'}, start and queue ${manifest.seconds === null ? '?' : Math.round(elapsed() - manifest.seconds)} s, model load ${manifest.loadSeconds ?? '?'} s, kernel ${manifest.seconds ?? '?'} s, wall ${elapsed()} s`);
    const share = Math.round(elapsed() / chunk.length);
    for (const request of chunk) {
      const logPath = join(call.out, 'log', `${request.name}-${call.stamp}.txt`);
      const image = manifest.images.find((i) => i.name === request.name);
      const own = [...lines, image === undefined ? 'not drawn' : `drawn in ${image.seconds ?? '?'} s`];
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
export function drawWithKaggle(call: DrawCall & { seed?: number }): Drawn {
  const reference = call.images[0];
  const logPath = join(call.out, 'log', `${call.name}-${call.stamp}.txt`);
  if (reference === undefined) {
    writeFileSync(logPath, 'no reference');
    return { version: 'kaggle', exit: null, seconds: 0, tokens: null, log: logPath.replace(`${call.out}/`, ''), saved: null, error: 'the kaggle route needs the reference image' };
  }
  const wave = drawWaveWithKaggle({
    out: call.out, stamp: call.stamp, timeoutSeconds: call.timeoutSeconds, ...(call.env === undefined ? {} : { env: call.env }),
    requests: [{ name: call.name, prompt: call.prompt, reference, expect: call.expect, ...(call.seed === undefined ? {} : { seed: call.seed }) }],
  });
  return wave.get(call.name) ?? { version: 'kaggle', exit: null, seconds: 0, tokens: null, log: logPath.replace(`${call.out}/`, ''), saved: null, error: 'the kaggle route returned nothing' };
}
