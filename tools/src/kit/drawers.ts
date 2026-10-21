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

export const DRAWERS = ['codex', 'gemini'] as const;
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
  throw new Error(`--drawer takes ${DRAWERS.join(' or ')}, not ${JSON.stringify(value)}`);
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
