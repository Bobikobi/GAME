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
 *
 * `--drawer <id>` picks the route, else `KIT_DRAWER`, else codex. A text route (a grid tile, a scatter
 * motif) stays with Codex: those are letters, not pictures. Adding a route is one `Drawer` here and
 * one line in `docs/art/DRAWERS.md`; the key is read from the environment and never written to a log.
 *
 * The HTTP call goes through `curl` so the pipeline stays synchronous and the key travels in a
 * config read from stdin, not on the command line.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const DRAWERS = ['codex', 'gemini', 'local'] as const;
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
export function localSettings(env: NodeJS.ProcessEnv = process.env): LocalSettings {
  const num = (name: string, fallback: number): number => {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} takes a positive number, not ${JSON.stringify(raw)}`);
    return value;
  };
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
