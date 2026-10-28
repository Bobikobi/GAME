import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import {
  CLIP_TOKENS, KAGGLE_DEFAULTS, KAGGLE_NEGATIVE, KAGGLE_POST_SCALE, KAGGLE_RECIPES, KAGGLE_RECIPE_NAMES, KAGGLE_WAVE_MARK, LOCAL_DEFAULTS, LOCAL_NEGATIVE, clipTokenEstimate, drawWaveWithKaggle, drawWithGemini, drawWithKaggle, drawWithLocal, geminiAnswer, geminiRequest,
  kaggleCanvas, kaggleCanvasFor, shapeOf, kaggleFileName, kaggleFromPrompt, kaggleSentencePrompt, kaggleInferenceSteps, kagglePrompt, kaggleSubject, pngSize, sdClause, kaggleKernelScript, kaggleManifest, kaggleMetadata, kaggleOwner, kagglePushAnswer, kaggleSettings, kaggleStatus, kaggleWave,
  localHistory, localPrompt, localSettings, localWorkflow, parseDrawer, promptForModel, splitWave,
} from '../src/kit/drawers.js';

const scratch = mkdtempSync(join(tmpdir(), 'kit-drawers-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const AGENT_PROMPT = 'Use your image generation tool. The attached image is a reference: a barrel, 16x16 pixels. Generate a NEW image. Do not process the image with code afterwards; just generate it and save it as barrel.png in the current directory.';

describe('the routes', () => {
  test('codex is the default and an unknown route is refused', () => {
    expect(parseDrawer(undefined)).toBe('codex');
    expect(parseDrawer('')).toBe('codex');
    expect(parseDrawer('gemini')).toBe('gemini');
    expect(parseDrawer('local')).toBe('local');
    expect(parseDrawer('kaggle')).toBe('kaggle');
    expect(() => parseDrawer('midjourney')).toThrow(/codex, gemini, local or kaggle/);
  });

  test('a plain image model gets the drawing instructions without the agent sentences', () => {
    expect(promptForModel(AGENT_PROMPT)).toBe('The attached image is a reference: a barrel, 16x16 pixels. Generate a NEW image.');
    expect(promptForModel('Generate a NEW image.')).toBe('Generate a NEW image.');
  });
});

describe('the Gemini call', () => {
  test('the request carries the prompt, then each image inline as PNG, and asks for an image back', () => {
    const body = JSON.parse(geminiRequest(AGENT_PROMPT, [Buffer.from('ref'), Buffer.from('style')])) as {
      contents: { parts: { text?: string; inline_data?: { mime_type: string; data: string } }[] }[];
      generationConfig: { responseModalities: string[] };
    };
    const parts = body.contents[0]?.parts ?? [];
    expect(parts[0]?.text).toBe(promptForModel(AGENT_PROMPT));
    expect(parts.slice(1).map((p) => p.inline_data?.mime_type)).toEqual(['image/png', 'image/png']);
    expect(Buffer.from(parts[1]?.inline_data?.data ?? '', 'base64').toString()).toBe('ref');
    expect(body.generationConfig.responseModalities).toContain('IMAGE');
  });

  test('the answer gives the PNG part, the tokens and the text', () => {
    const png = Buffer.from('fake png');
    const answer = geminiAnswer(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Here it is.' }, { inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }],
      usageMetadata: { totalTokenCount: 1290 },
    }));
    expect(answer.error).toBeNull();
    expect(answer.png?.toString()).toBe('fake png');
    expect(answer.tokens).toBe(1290);
    expect(answer.text).toBe('Here it is.');
  });

  test('no image, a JPEG, an API error and a non-JSON body each say why', () => {
    expect(geminiAnswer(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'I cannot.' }] }, finishReason: 'SAFETY' }] })).error).toContain('SAFETY');
    expect(geminiAnswer(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: 'AA==' } }] } }] })).error).toContain('image/jpeg');
    expect(geminiAnswer(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } })).error).toBe('RESOURCE_EXHAUSTED: quota');
    expect(geminiAnswer('<html>').error).toContain('not JSON');
  });

  test('without a key the route stops before any call, and the log never holds a key', () => {
    const out = join(scratch, 'run');
    for (const dir of ['work', 'log']) mkdirSync(join(out, dir), { recursive: true });
    const drawn = drawWithGemini({ out, name: 'barrel', stamp: 's1', prompt: AGENT_PROMPT, images: [], expect: 'barrel.png', timeoutSeconds: 5, env: {} });
    expect(drawn.saved).toBeNull();
    expect(drawn.error).toContain('GEMINI_API_KEY');
    expect(drawn.version).toBe('gemini-2.5-flash-image');
    expect(readFileSync(join(out, drawn.log), 'utf8')).not.toContain('secret');
  });
});

describe('the local route', () => {
  test('the compact prompt carries the trigger words, the object, the detail and what the importer needs', () => {
    const prompt = localPrompt({ what: 'round leafy oak tree', detail: 'roots at its foot' });
    expect(prompt.startsWith('Pixel Art, PixArFK, round leafy oak tree')).toBe(true);
    expect(prompt).toContain('roots at its foot');
    expect(prompt).toContain('flat pure magenta background');
    expect(localPrompt({ what: 'axe' })).not.toContain(', ,');
  });

  test('settings come from the environment, else the defaults, and a bad number is refused', () => {
    expect(localSettings({})).toMatchObject({ url: LOCAL_DEFAULTS.url, steps: LOCAL_DEFAULTS.steps, denoise: LOCAL_DEFAULTS.denoise, size: LOCAL_DEFAULTS.size });
    expect(localSettings({ COMFYUI_URL: 'http://10.0.0.2:8188/', LOCAL_STEPS: '20', LOCAL_DENOISE: '0.5', LOCAL_SIZE: '512' })).toMatchObject({ url: 'http://10.0.0.2:8188', steps: 20, denoise: 0.5, size: 512 });
    expect(() => localSettings({ LOCAL_STEPS: 'many' })).toThrow(/LOCAL_STEPS/);
    expect(localSettings({}).seed).toBe(LOCAL_DEFAULTS.seed);
    expect(localSettings({ LOCAL_SEED: '11' }).seed).toBe(11);
  });

  test('the workflow wires reference, LoRA, prompts and sampler the way ComfyUI reads them', () => {
    const wf = localWorkflow('ref.png', 'Pixel Art, a tree', 7, localSettings({})) as Record<string, { class_type: string; inputs: Record<string, unknown> }>;
    expect(wf['5']?.inputs['image']).toBe('ref.png');
    expect(wf['2']?.inputs['lora_name']).toBe(LOCAL_DEFAULTS.lora);
    expect(wf['3']?.inputs['text']).toBe('Pixel Art, a tree');
    expect(wf['8']?.inputs).toMatchObject({ seed: 7, steps: LOCAL_DEFAULTS.steps, denoise: LOCAL_DEFAULTS.denoise, latent_image: ['7', 0] });
    expect(wf['6']?.inputs).toMatchObject({ width: LOCAL_DEFAULTS.size, height: LOCAL_DEFAULTS.size });
  });

  test('the history answer says not yet, failed, or which image', () => {
    expect(localHistory('{}', 'p1')).toEqual({ image: null, done: false, error: null });
    expect(localHistory(JSON.stringify({ p1: { status: { status_str: 'error', messages: ['boom'] } } }), 'p1').error).toContain('boom');
    expect(localHistory(JSON.stringify({ p1: { status: { status_str: 'success' }, outputs: { '10': { images: [{ filename: 'kitgen_00001_.png', subfolder: '', type: 'output' }] } } } }), 'p1').image).toEqual({ filename: 'kitgen_00001_.png', subfolder: '', type: 'output' });
    expect(localHistory('nope', 'p1').error).toContain('not JSON');
  });

  test('with no ComfyUI to answer, the route says so instead of hanging', () => {
    const out = join(scratch, 'local');
    for (const dir of ['work', 'log']) mkdirSync(join(out, dir), { recursive: true });
    const ref = join(out, 'ref.png');
    writeFileSync(ref, Buffer.alloc(8));
    const drawn = drawWithLocal({ out, name: 'tree', stamp: 's1', prompt: 'Pixel Art, a tree', images: [ref], expect: 'tree.png', timeoutSeconds: 5, env: { COMFYUI_URL: 'http://127.0.0.1:9' } });
    expect(drawn.saved).toBeNull();
    expect(drawn.error).toContain('not answering');
    expect(readFileSync(join(out, drawn.log), 'utf8')).toContain('comfyui http://127.0.0.1:9');
  });
});

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

/** A stand-in for the kaggle CLI: answers config, push, status and output from files, records its calls. */
function fakeKaggle(dir: string, answers: { push: string; status: string; output: Record<string, string | Buffer> }): string {
  const files = join(dir, 'answers');
  mkdirSync(files, { recursive: true });
  for (const [name, body] of Object.entries(answers.output)) writeFileSync(join(files, name), body);
  writeFileSync(join(dir, 'push.txt'), answers.push);
  writeFileSync(join(dir, 'status.txt'), answers.status);
  const cli = join(dir, 'kaggle');
  writeFileSync(cli, [
    '#!/bin/sh',
    `D='${dir}'`,
    'echo "$*" >> "$D/calls.txt"',
    'case "$1 $2" in',
    '  "config view") echo "- username: tester"; echo "- path: None" ;;',
    '  "kernels push") cp "$4/kitgen_wave.py" "$D/pushed.py"; cp "$4/kernel-metadata.json" "$D/pushed-metadata.json"; cat "$D/push.txt" ;;',
    '  "kernels status") cat "$D/status.txt" ;;',
    '  "kernels output") cp "$D"/answers/* "$5"/ ;;',
    'esac',
  ].join('\n'));
  chmodSync(cli, 0o755);
  return cli;
}

function runDir(name: string): string {
  const out = join(scratch, name);
  for (const dir of ['work', 'log', 'ref']) mkdirSync(join(out, dir), { recursive: true });
  return out;
}

describe('the kaggle route', () => {
  test('settings default to the local recipe and read the environment', () => {
    expect(kaggleSettings({})).toMatchObject({
      kernel: KAGGLE_DEFAULTS.kernel, gpu: true, accelerator: '', recipe: 'sd15', model: KAGGLE_DEFAULTS.model, vae: '', denoise: LOCAL_DEFAULTS.denoise,
      denoiseCharacter: 0.7, steps: LOCAL_DEFAULTS.steps, size: LOCAL_DEFAULTS.size, cfg: LOCAL_DEFAULTS.cfg, loraStrength: LOCAL_DEFAULTS.loraStrength, seed: 7,
    });
    expect(kaggleSettings({ KAGGLE_GPU: '0', KAGGLE_SIZE: '250', KAGGLE_STEPS: '6', KAGGLE_KERNEL: 'someone/wave' })).toMatchObject({ gpu: false, size: 248, steps: 6, kernel: 'someone/wave' });
    expect(kaggleSettings({ KAGGLE_DENOISE_CHARACTER: '0.3', KAGGLE_DENOISE: '0.7' })).toMatchObject({ denoise: 0.7, denoiseCharacter: 0.3 });
    expect(() => kaggleSettings({ KAGGLE_DENOISE: 'half' })).toThrow(/KAGGLE_DENOISE/);
    expect(() => kaggleSettings({ KAGGLE_MODEL: 'someone/model', KAGGLE_RECIPE: 'dalle' })).toThrow(/KAGGLE_RECIPE takes sd15, sdxl, qwen, flux/);
  });

  test('KAGGLE_MODEL=sdxl switches the whole recipe; a repo id keeps the recipe it is given', () => {
    expect(kaggleSettings({ KAGGLE_MODEL: 'sdxl' })).toMatchObject({
      recipe: 'sdxl', model: KAGGLE_RECIPES.sdxl.model, vae: KAGGLE_RECIPES.sdxl.vae, loraRepo: 'nerijs/pixel-art-xl', loraFile: 'pixel-art-xl.safetensors',
      loraStrength: 1, size: 1024, steps: 25, denoise: 0.6, denoiseCharacter: 0.8,
    });
    expect(kaggleSettings({ KAGGLE_MODEL: 'SDXL', KAGGLE_SIZE: '896', KAGGLE_VAE: '' })).toMatchObject({ recipe: 'sdxl', size: 896, vae: '' });
    expect(kaggleSettings({ KAGGLE_MODEL: 'someone/sd15-tune' })).toMatchObject({ recipe: 'sd15', model: 'someone/sd15-tune', size: 512 });
    expect(kaggleSettings({ KAGGLE_MODEL: 'someone/xl-tune', KAGGLE_RECIPE: 'sdxl' })).toMatchObject({ recipe: 'sdxl', model: 'someone/xl-tune', size: 1024 });
  });

  test('the prompt is written for Stable Diffusion: trigger words first, no pixel counts, inside CLIP\'s window', () => {
    const elder = {
      ref: 'chars/elder', what: 'village elder character (long white beard, brown coat, facing the viewer, full body)',
      detail: 'the face about 10 pixels wide with two eye pixels and eyebrows, the beard in 3 shades, the coat with a belt and a fold line, boots',
    };
    const prompt = kagglePrompt(elder);
    expect(prompt.startsWith('Pixel Art, PixArFK, one single character alone, full body, front view, village elder character, long white beard, brown coat')).toBe(true);
    expect(prompt).not.toMatch(/pixels wide|eye pixels|3 shades|the beard,/u);
    expect(prompt).toContain('the coat with a belt and a fold line, boots');
    expect(prompt.endsWith('flat pure magenta background')).toBe(true);
    expect(prompt.match(/full body/gu)).toHaveLength(1);
    expect(clipTokenEstimate(prompt)).toBeLessThanOrEqual(CLIP_TOKENS);
    expect(kagglePrompt(elder, 'sdxl').startsWith('pixel art, one single character alone')).toBe(true);
    const oak = kagglePrompt({ ref: 'props/tree_oak', what: 'round leafy oak tree with its trunk', detail: 'clusters of leaves in 3 greens with light on the upper left, roots at its foot' });
    expect(oak).toContain('game sprite, top-down three-quarter view, round leafy oak tree with its trunk, clusters of leaves in green with light on the upper left');
    const long = kagglePrompt({ ref: 'props/x', what: 'barrel', detail: Array.from({ length: 30 }, (_, i) => `hoop number ${i} with rivets`).join(', ') });
    expect(clipTokenEstimate(long)).toBeLessThanOrEqual(CLIP_TOKENS - 4);
    expect(long).toContain('hoop number 0 with rivets');
    expect(long.endsWith('flat pure magenta background')).toBe(true);
  });

  test('clauses lose what a text encoder cannot count, and the estimate counts the hard words high', () => {
    expect(sdClause('the face about 10 pixels wide')).toBeNull();
    expect(sdClause('the beard in 3 shades')).toBeNull();
    expect(sdClause('the cloak in three shades of red')).toBe('the cloak of red');
    expect(sdClause('leaves in 3 greens')).toBe('leaves in green');
    expect(sdClause(' a steel head ')).toBe('a steel head');
    expect(clipTokenEstimate('')).toBe(2);
    expect(clipTokenEstimate('a tree, oak')).toBe(6);
    expect(clipTokenEstimate('PixArFK')).toBeGreaterThan(2);
    expect(clipTokenEstimate("woodcutter's")).toBe(5);
  });

  test('a character is told apart by its ref, and the canvas follows the reference', () => {
    expect(kaggleSubject('chars/elder')).toBe('character');
    expect(kaggleSubject('props/tree_oak')).toBe('prop');
    expect(kaggleSubject('items/axe')).toBe('prop');
    expect(kaggleCanvas({ width: 320, height: 448 }, 512)).toEqual({ width: 512, height: 704 });
    expect(kaggleCanvas({ width: 32, height: 48 }, 512)).toEqual({ width: 512, height: 768 });
    expect(kaggleCanvas({ width: 48, height: 32 }, 1024)).toEqual({ width: 1536, height: 1024 });
    expect(kaggleCanvas({ width: 10, height: 100 }, 512)).toEqual({ width: 512, height: 1024 });
    expect(kaggleCanvas({ width: 64, height: 64 }, 500)).toEqual({ width: 512, height: 512 });
    expect(kaggleCanvas(null, 512)).toEqual({ width: 512, height: 512 });
    const header = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header);
    header.writeUInt32BE(320, 16);
    header.writeUInt32BE(448, 20);
    expect(pngSize(header)).toEqual({ width: 320, height: 448 });
    expect(pngSize(Buffer.from('tree'))).toBeNull();
  });

  test('from the prompt alone the canvas takes the asked size, image to image it keeps the reference shape', () => {
    const old = { width: 32, height: 32 };
    // the three entries of the 27.10 proof, each asked tall and each referenced by a small square-ish sprite
    expect(kaggleCanvasFor(old, { width: 192, height: 320 }, 1024, true)).toEqual({ width: 1024, height: 1728 });
    expect(kaggleCanvasFor({ width: 48, height: 48 }, { width: 192, height: 320 }, 1024, true)).toEqual({ width: 1024, height: 1728 });
    expect(kaggleCanvasFor({ width: 16, height: 32 }, { width: 64, height: 160 }, 1024, true)).toEqual({ width: 1024, height: 2048 });
    expect(kaggleCanvasFor(old, { width: 128, height: 128 }, 1024, true)).toEqual({ width: 1024, height: 1024 });
    // a wide ask is drawn wide
    expect(kaggleCanvasFor(old, { width: 256, height: 128 }, 512, true)).toEqual({ width: 1024, height: 512 });
    // image to image: today's behaviour, the reference's shape
    expect(kaggleCanvasFor(old, { width: 192, height: 320 }, 512, false)).toEqual({ width: 512, height: 512 });
    expect(kaggleCanvasFor({ width: 32, height: 48 }, { width: 192, height: 320 }, 512, false)).toEqual(kaggleCanvas({ width: 32, height: 48 }, 512));
    // from the prompt with no asked size falls back to the reference
    expect(kaggleCanvasFor({ width: 32, height: 48 }, null, 512, true)).toEqual({ width: 512, height: 768 });
  });

  test('the wave gives a prompt-only request the asked canvas and an image to image one the reference canvas', () => {
    const png = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
    png.writeUInt32BE(400, 16);
    png.writeUInt32BE(400, 20);
    const request = { name: 'house', prompt: 'a house', png, seed: 7, grid: { width: 192, height: 320 } };
    const canvas = (env: Record<string, string>): [number, number] => {
      const r = (kaggleWave([request], kaggleSettings(env)).requests as { width: number; height: number }[])[0];
      return [r?.width ?? 0, r?.height ?? 0];
    };
    expect(canvas({ KAGGLE_MODEL: 'qwen' })).toEqual([1024, 1728]);
    expect(canvas({ KAGGLE_MODEL: 'sd15' })).toEqual([512, 512]);
    expect(canvas({ KAGGLE_MODEL: 'sd15', KAGGLE_DENOISE: '1' })).toEqual([512, 832]);
  });

  test('the negative prompt names the light the model paints on the background', () => {
    for (const word of ['glow', 'vignette', 'light rays', 'halo']) expect(KAGGLE_NEGATIVE).toContain(word);
  });

  test('the schedule is stretched so image to image runs the local step count', () => {
    expect(kaggleInferenceSteps(20, 0.6)).toBe(34);
    expect(Math.floor(kaggleInferenceSteps(20, 0.6) * 0.6)).toBe(20);
    expect(Math.floor(kaggleInferenceSteps(12, 0.5) * 0.5)).toBe(12);
    expect(kaggleInferenceSteps(20, 1)).toBe(20);
  });

  test('the owner comes from config view, which carries no token', () => {
    expect(kaggleOwner('- username: someone\n- path: None\n- proxy: None')).toBe('someone');
    expect(kaggleOwner('Configuration values from /x\n- path: None')).toBeNull();
  });

  test('the pushed script carries the whole wave and the recipe, and the metadata asks for a private GPU script', () => {
    const settings = kaggleSettings({});
    const wave = kaggleWave([
      { name: 'tree oak', prompt: 'Pixel Art, a tree', png: Buffer.from('tree'), seed: 7 },
      { name: 'barrel', prompt: 'Pixel Art, a barrel', png: Buffer.from('barrel'), seed: 11 },
    ], settings);
    const script = kaggleKernelScript(wave);
    const b64 = new RegExp(`${KAGGLE_WAVE_MARK} = "([A-Za-z0-9+/=]+)"`).exec(script)?.[1] ?? '';
    const back = JSON.parse(Buffer.from(b64, 'base64').toString()) as { settings: Record<string, unknown>; requests: { name: string; file: string; prompt: string; seed: number; png: string }[] };
    expect(back.settings).toMatchObject({ recipe: 'sd15', model: KAGGLE_DEFAULTS.model, lora_file: KAGGLE_DEFAULTS.loraFile, denoise: 0.6, steps: 20, inference_steps: 34, size: 512, cfg: 7, lora_strength: 0.8, negative: KAGGLE_NEGATIVE, clip_tokens: 77 });
    expect(KAGGLE_NEGATIVE).toContain(LOCAL_NEGATIVE.split(', ')[0] ?? '');
    expect(KAGGLE_NEGATIVE).toMatch(/multiple characters.*animal/u);
    expect(clipTokenEstimate(KAGGLE_NEGATIVE)).toBeLessThanOrEqual(CLIP_TOKENS);
    expect(back.requests.map((r) => [r.name, r.file, r.seed])).toEqual([['tree oak', 'tree_oak.png', 7], ['barrel', 'barrel.png', 11]]);
    expect(Buffer.from(back.requests[0]?.png ?? '', 'base64').toString()).toBe('tree');
    expect(script).toContain('StableDiffusionImg2ImgPipeline');
    expect(script).toContain('StableDiffusionXLImg2ImgPipeline');
    expect(script).toContain('kitgen-manifest.json');
    // a prompt past the window is refused by name in the kernel, never cut
    expect(script).toContain('it would be cut silently');
    expect(script).toContain('tokenizer_2');
    expect(kaggleMetadata('someone/kitgen-drawer', 'kitgen_wave.py', settings)).toMatchObject({
      id: 'someone/kitgen-drawer', title: 'kitgen-drawer', kernel_type: 'script', is_private: true, enable_gpu: true, enable_internet: true,
    });
    expect(kaggleMetadata('a/b', 'x.py', kaggleSettings({ KAGGLE_GPU: 'false', KAGGLE_ACCELERATOR: 'NvidiaTeslaT4' }))).toMatchObject({ enable_gpu: false, machine_shape: 'NvidiaTeslaT4' });
    expect(kaggleFileName('a/b c')).toBe('a_b_c.png');
  });

  test('each request carries its own canvas and its subject\'s denoise', () => {
    const png = (w: number, h: number): Buffer => {
      const b = Buffer.alloc(24);
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b);
      b.writeUInt32BE(w, 16);
      b.writeUInt32BE(h, 20);
      return b;
    };
    const wave = kaggleWave([
      { name: 'elder', prompt: 'p', png: png(320, 448), seed: 7, subject: 'character' },
      { name: 'oak', prompt: 'p', png: png(320, 320), seed: 7 },
    ], kaggleSettings({ KAGGLE_MODEL: 'sdxl' })) as { settings: Record<string, unknown>; requests: Record<string, unknown>[] };
    expect(wave.settings).toMatchObject({ recipe: 'sdxl', vae: KAGGLE_RECIPES.sdxl.vae, size: 1024 });
    expect(wave.requests[0]).toMatchObject({ subject: 'character', denoise: 0.8, inference_steps: 32, width: 1024, height: 1408 });
    expect(wave.requests[1]).toMatchObject({ subject: 'prop', denoise: 0.6, inference_steps: 42, width: 1024, height: 1024 });
  });

  test('a wave splits only past the embed limit', () => {
    const r = (n: number): { png: Buffer } => ({ png: Buffer.alloc(n) });
    expect(splitWave([r(100), r(100), r(100)], 10_000).map((c) => c.length)).toEqual([3]);
    expect(splitWave([r(2000), r(2000), r(2000)], 10_000).map((c) => c.length)).toEqual([2, 1]);
    expect(splitWave([r(50_000)], 10_000).map((c) => c.length)).toEqual([1]);
  });

  test('the CLI answers are read: status words, a refused push, the manifest', () => {
    expect(kaggleStatus('someone/kitgen-drawer has status "KernelWorkerStatus.RUNNING"')).toMatchObject({ state: 'running', done: false });
    expect(kaggleStatus('someone/kitgen-drawer has status "COMPLETE"')).toMatchObject({ state: 'complete', done: true, failed: false });
    expect(kaggleStatus('x has status "KernelWorkerStatus.ERROR"\nFailure message: "out of memory"')).toMatchObject({ done: true, failed: true, message: 'out of memory' });
    expect(kaggleStatus('404 not found')).toMatchObject({ state: null, done: false });
    expect(kagglePushAnswer('Kernel version 3 successfully pushed.  Please check progress at https://example/code')).toEqual({ ok: true, error: null });
    expect(kagglePushAnswer('Kernel push error: Phone verification is required to use GPUs').error).toContain('Phone verification');
    const m = kaggleManifest(JSON.stringify({ device: 'Tesla T4', load_seconds: 61.2, seconds: 90, images: [{ name: 'tree', file: 'tree.png', seconds: 4.1, error: null }, { name: 'bad', file: null, seconds: 0.2, error: 'OSError: x' }, { nope: 1 }] }));
    expect(m).toMatchObject({ device: 'Tesla T4', loadSeconds: 61.2, seconds: 90, error: null });
    expect(m.images).toEqual([{ name: 'tree', file: 'tree.png', seconds: 4.1, error: null }, { name: 'bad', file: null, seconds: 0.2, error: 'OSError: x' }]);
    expect(kaggleManifest('<html>').error).toContain('not JSON');
  });

  test('a wave goes up as one kernel, and each picture comes back to its own work file', () => {
    const out = runDir('kaggle-wave');
    const cliDir = join(scratch, 'fake-kaggle-ok');
    const cli = fakeKaggle(cliDir, {
      push: 'Kernel version 1 successfully pushed.',
      status: 'tester/kitgen-drawer has status "KernelWorkerStatus.COMPLETE"',
      output: {
        'kitgen-manifest.json': JSON.stringify({ device: 'Tesla T4', load_seconds: 60, seconds: 70, images: [{ name: 'tree', file: 'tree.png', seconds: 4, error: null }, { name: 'barrel', file: null, seconds: 1, error: 'RuntimeError: boom' }] }),
        'tree.png': PNG_BYTES,
      },
    });
    for (const name of ['tree', 'barrel']) writeFileSync(join(out, 'ref', `${name}.png`), Buffer.from(name));
    const drawn = drawWaveWithKaggle({
      out, stamp: 's1', timeoutSeconds: 60,
      env: { KAGGLE_CLI: cli, KAGGLE_POLL_SECONDS: '0.01' },
      requests: ['tree', 'barrel'].map((name) => ({ name, prompt: `Pixel Art, ${name}`, reference: join(out, 'ref', `${name}.png`), expect: `${name}.png` })),
    });
    const calls = readFileSync(join(cliDir, 'calls.txt'), 'utf8').split('\n').filter((l) => l !== '');
    expect(calls.filter((c) => c.startsWith('kernels push'))).toHaveLength(1);
    expect(calls[0]).toBe('config view');
    expect(JSON.parse(readFileSync(join(cliDir, 'pushed-metadata.json'), 'utf8'))).toMatchObject({ id: 'tester/kitgen-drawer', is_private: true });
    const pushed = new RegExp(`${KAGGLE_WAVE_MARK} = "([A-Za-z0-9+/=]+)"`).exec(readFileSync(join(cliDir, 'pushed.py'), 'utf8'))?.[1] ?? '';
    const pushedWave = JSON.parse(Buffer.from(pushed, 'base64').toString()) as { requests: { png: string }[] };
    expect(pushedWave.requests.map((r) => Buffer.from(r.png, 'base64').toString())).toEqual(['tree', 'barrel']);
    expect(drawn.get('tree')?.saved).toBe(join(out, 'work', 'tree.png'));
    expect(readFileSync(join(out, 'work', 'tree.png')).equals(PNG_BYTES)).toBe(true);
    expect(drawn.get('tree')?.version).toBe(`${KAGGLE_DEFAULTS.model}+${KAGGLE_DEFAULTS.loraFile}`);
    expect(drawn.get('barrel')?.saved).toBeNull();
    expect(drawn.get('barrel')?.error).toBe('RuntimeError: boom');
    expect(readFileSync(join(out, drawn.get('tree')?.log ?? ''), 'utf8')).toContain('device Tesla T4');
  });

  test('a refused push (no GPU without phone verification) reaches every picture as its error', () => {
    const out = runDir('kaggle-refused');
    const cli = fakeKaggle(join(scratch, 'fake-kaggle-refused'), { push: 'Kernel push error: Phone verification required for GPU', status: '', output: {} });
    writeFileSync(join(out, 'ref', 'tree.png'), Buffer.from('tree'));
    const drawn = drawWithKaggle({ out, name: 'tree', stamp: 's1', prompt: 'Pixel Art, a tree', images: [join(out, 'ref', 'tree.png')], expect: 'tree.png', timeoutSeconds: 5, env: { KAGGLE_CLI: cli, KAGGLE_USERNAME: 'tester' } });
    expect(drawn.saved).toBeNull();
    expect(drawn.error).toContain('Phone verification');
    expect(existsSync(join(out, 'work', 'tree.png'))).toBe(false);
  });

  test('a run that ends in error with no manifest says so, and a missing CLI is named', () => {
    const out = runDir('kaggle-error');
    const cli = fakeKaggle(join(scratch, 'fake-kaggle-error'), {
      push: 'Kernel version 2 successfully pushed.', status: 'x has status "KernelWorkerStatus.ERROR"\nFailure message: "Your notebook tried to allocate more memory"',
      output: { 'kitgen-drawer.log': '[{"data": "Traceback: CUDA out of memory"}]' },
    });
    writeFileSync(join(out, 'ref', 'tree.png'), Buffer.from('tree'));
    const call = { out, name: 'tree', stamp: 's1', prompt: 'Pixel Art, a tree', images: [join(out, 'ref', 'tree.png')], expect: 'tree.png', timeoutSeconds: 5 };
    const failed = drawWithKaggle({ ...call, env: { KAGGLE_CLI: cli, KAGGLE_USERNAME: 'tester', KAGGLE_POLL_SECONDS: '0.01' } });
    expect(failed.error).toContain('allocate more memory');
    expect(failed.error).toContain('CUDA out of memory');
    const missing = drawWithKaggle({ ...call, stamp: 's2', env: { KAGGLE_CLI: join(scratch, 'no-such-kaggle') } });
    expect(missing.error).toContain('KAGGLE_CLI');
  });
});

describe('the long-prompt recipes (qwen, flux)', () => {
  test('KAGGLE_MODEL=qwen or flux switches the whole recipe: 4-bit weights, few steps, no CFG, the grid post-process', () => {
    expect(KAGGLE_RECIPE_NAMES).toEqual(['sd15', 'sdxl', 'qwen', 'flux']);
    expect(kaggleSettings({ KAGGLE_MODEL: 'qwen' })).toMatchObject({
      recipe: 'qwen', model: 'unsloth/Qwen-Image-2512-unsloth-bnb-4bit', quant: 'prequantized', scheduler: 'lightning',
      loraRepo: 'lightx2v/Qwen-Image-2512-Lightning', loraFile: 'Qwen-Image-2512-Lightning-4steps-V1.0-bf16.safetensors',
      steps: 4, cfg: 1, size: 1024, denoise: 1, denoiseCharacter: 1, tokenLimit: 512, dtype: 'fp32', post: 'grid',
    });
    expect(kaggleSettings({ KAGGLE_MODEL: 'FLUX' })).toMatchObject({
      recipe: 'flux', model: 'unsloth/FLUX.1-schnell', quant: 'nf4', scheduler: '', loraRepo: '', loraFile: '',
      steps: 4, cfg: 0, size: 1024, denoise: 1, tokenLimit: 256, dtype: 'fp16', post: 'grid',
    });
    expect(kaggleFromPrompt('qwen')).toBe(true);
    expect(kaggleFromPrompt('flux')).toBe(true);
    expect(kaggleFromPrompt('sdxl')).toBe(false);
    expect(kaggleSettings({ KAGGLE_MODEL: 'someone/flux-tune', KAGGLE_RECIPE: 'flux' })).toMatchObject({ recipe: 'flux', model: 'someone/flux-tune', quant: 'nf4' });
  });

  test('they draw from the prompt alone, so a denoise below 1 is refused by name', () => {
    expect(kaggleSettings({ KAGGLE_MODEL: 'qwen', KAGGLE_DENOISE: '1' }).denoise).toBe(1);
    expect(kaggleSettings({ KAGGLE_MODEL: 'flux', KAGGLE_DENOISE: '2' }).denoise).toBe(1);
    expect(() => kaggleSettings({ KAGGLE_MODEL: 'qwen', KAGGLE_DENOISE: '0.6' })).toThrow(/qwen draws from the prompt alone: KAGGLE_DENOISE must be 1/);
    expect(() => kaggleSettings({ KAGGLE_MODEL: 'flux', KAGGLE_DENOISE_CHARACTER: '0.8' })).toThrow(/KAGGLE_DENOISE_CHARACTER/);
  });

  test('the post-process and the precision are settings; Stable Diffusion keeps its pictures unless asked', () => {
    expect(kaggleSettings({}).post).toBe('off');
    expect(kaggleSettings({ KAGGLE_MODEL: 'sdxl' }).post).toBe('off');
    expect(kaggleSettings({ KAGGLE_MODEL: 'sdxl', KAGGLE_POST: 'grid' }).post).toBe('grid');
    expect(kaggleSettings({ KAGGLE_MODEL: 'qwen', KAGGLE_POST: 'OFF' }).post).toBe('off');
    // qwen computes in fp32 (its activations pass fp16's range), the others in a T4's fast fp16
    expect(kaggleSettings({}).dtype).toBe('fp16');
    expect(kaggleSettings({ KAGGLE_MODEL: 'flux' }).dtype).toBe('fp16');
    expect(kaggleSettings({ KAGGLE_MODEL: 'qwen' }).dtype).toBe('fp32');
    expect(kaggleSettings({ KAGGLE_MODEL: 'qwen', KAGGLE_DTYPE: 'BF16' }).dtype).toBe('bf16');
    expect(kaggleSettings({ KAGGLE_MODEL: 'flux', KAGGLE_DTYPE: 'fp32' }).dtype).toBe('fp32');
    expect(() => kaggleSettings({ KAGGLE_POST: 'sharpen' })).toThrow(/KAGGLE_POST takes grid or off/);
    expect(() => kaggleSettings({ KAGGLE_DTYPE: 'fp8' })).toThrow(/KAGGLE_DTYPE takes fp16 or bf16 or fp32/);
  });

  test('the prompt is sentences, the whole spec kept, with no pixel counts and the spec\'s own view', () => {
    const branch = { ref: 'items/branch', what: 'single bare wooden stick', detail: 'one straight dry stick with a small fork, no leaves, brown bark, lying diagonally' };
    const prompt = kaggleSentencePrompt(branch);
    expect(prompt).toBe('Pixel art game sprite: single bare wooden stick. One straight dry stick with a small fork, no leaves, brown bark, lying diagonally. '
      + 'Alone and centred, filling most of the picture, top-down three-quarter view. Crisp square pixels, a thick dark navy outline, a limited palette. '
      + 'Flat pure magenta background, no shadow on the ground, no text, no other objects.');
    expect(kagglePrompt(branch, 'qwen')).toBe(prompt);
    expect(kagglePrompt(branch, 'flux')).toBe(prompt);
    expect(kagglePrompt(branch, 'sd15')).not.toBe(prompt);
    // the spec names its view: no second one is added
    const log = kaggleSentencePrompt({ ref: 'props/log_fallen', what: 'fallen log', detail: 'rough brown bark, side view' });
    expect(log).toContain('Rough brown bark, side view.');
    expect(log).not.toContain('three-quarter');
    const elder = kaggleSentencePrompt({ ref: 'chars/elder', what: 'village elder (long white beard)', detail: 'the face about 10 pixels wide, the beard in 3 shades, boots' });
    expect(elder).toContain('One single character alone, centred, full body, front view.');
    expect(elder).not.toMatch(/pixels wide|3 shades/u);
    // nothing is cut to fit: the kernel counts it against the encoder's real window instead
    const long = kaggleSentencePrompt({ ref: 'props/x', what: 'barrel', detail: Array.from({ length: 30 }, (_, i) => `hoop number ${i} with rivets`).join(', ') });
    expect(long).toContain('hoop number 29 with rivets');
    expect(clipTokenEstimate(long)).toBeGreaterThan(CLIP_TOKENS);
  });

  test('the asked size sets the shape words in both prompt builders (27.10): tall and wide above 1.3, a square says nothing', () => {
    expect(shapeOf({ width: 192, height: 320 })).toBe('tall');
    expect(shapeOf({ width: 128, height: 64 })).toBe('wide');
    expect(shapeOf({ width: 64, height: 64 })).toBeNull();
    // 1.3 itself is not past the line; 5:4 is not told a shape, 4:3 is
    expect(shapeOf({ width: 100, height: 130 })).toBeNull();
    expect(shapeOf({ width: 100, height: 131 })).toBe('tall');
    expect(shapeOf({ width: 120, height: 96 })).toBeNull();
    expect(shapeOf({ width: 128, height: 96 })).toBe('wide');
    expect(shapeOf({})).toBeNull();
    const house = { ref: 'props/house_small', what: 'small village cottage with a red tiled roof', detail: 'a steep roof of red clay tiles, a wooden door' };
    expect(kaggleSentencePrompt({ ...house, width: 192, height: 320 })).toContain('Alone and centred, filling most of the picture, tall and narrow, filling the height of the picture, top-down three-quarter view.');
    expect(kaggleSentencePrompt({ ...house, width: 128, height: 64 })).toContain('wide and low, filling the width of the picture');
    expect(kaggleSentencePrompt({ ...house, width: 64, height: 64 })).toBe(kaggleSentencePrompt(house));
    expect(kagglePrompt({ ...house, width: 192, height: 320 }, 'qwen')).toBe(kaggleSentencePrompt({ ...house, width: 192, height: 320 }));
    const tree = kagglePrompt({ ref: 'props/tree_oak', what: 'oak tree', width: 192, height: 320 }, 'sd15');
    expect(tree).toContain('game sprite, top-down three-quarter view, tall, narrow, oak tree');
    expect(kagglePrompt({ ref: 'props/rubble', what: 'rubble', width: 128, height: 64 }, 'sd15')).toContain('wide, low');
    expect(kagglePrompt({ ref: 'props/x', what: 'barrel', width: 64, height: 64 }, 'sd15')).not.toMatch(/tall|wide/u);
    expect(clipTokenEstimate(tree)).toBeLessThanOrEqual(CLIP_TOKENS);
  });

  test('the wave carries the recipe and each request its art grid; the kernel has both paths and the post-process', () => {
    const qwen = kaggleSettings({ KAGGLE_MODEL: 'qwen' });
    const wave = kaggleWave([
      { name: 'branch', prompt: 'p', png: Buffer.from('x'), seed: 3, grid: { width: 64, height: 64 } },
      { name: 'fence', prompt: 'p', png: Buffer.from('y'), seed: 3 },
    ], qwen) as { settings: Record<string, unknown>; requests: Record<string, unknown>[] };
    expect(wave.settings).toMatchObject({
      recipe: 'qwen', quant: 'prequantized', scheduler: 'lightning', token_limit: 512, dtype: 'fp32', post: 'grid', post_scale: KAGGLE_POST_SCALE,
      steps: 4, inference_steps: 4, cfg: 1, lora_repo: 'lightx2v/Qwen-Image-2512-Lightning',
    });
    expect(wave.requests[0]).toMatchObject({ width: 1024, height: 1024, grid_width: 64, grid_height: 64, denoise: 1, seed: 3 });
    // with no spec grid the post-process falls back to the canvas over 16
    expect(wave.requests[1]).toMatchObject({ grid_width: 64, grid_height: 64 });
    expect((kaggleWave([], kaggleSettings({})) as { settings: Record<string, unknown> }).settings).toMatchObject({ post: 'off', token_limit: CLIP_TOKENS });
    const script = kaggleKernelScript(wave);
    for (const piece of ['QwenImagePipeline', 'FluxPipeline', 'BitsAndBytesConfig', 'LIGHTNING_SCHEDULER', 'def to_grid', 'came back black', 'bitsandbytes', 'StableDiffusionImg2ImgPipeline', 'def compute_in_fp32', 'compute_type_is_set', 'ndimage.label(~back)']) {
      expect(script).toContain(piece);
    }
  });

  test.skipIf(spawnSync('python3', ['--version']).status !== 0)('the kernel script is valid Python for every recipe', () => {
    for (const recipe of KAGGLE_RECIPE_NAMES) {
      const script = kaggleKernelScript(kaggleWave([{ name: 'x', prompt: 'p', png: Buffer.from('x'), seed: 1 }], kaggleSettings({ KAGGLE_MODEL: recipe })));
      const parsed = spawnSync('python3', ['-c', 'import ast, sys; ast.parse(sys.stdin.read())'], { input: script, encoding: 'utf8' });
      expect(parsed.stderr).toBe('');
      expect(parsed.status).toBe(0);
    }
  });

  test('a recipe with no LoRA is named by its model alone, and the log says what ran', () => {
    const out = runDir('kaggle-flux');
    const cliDir = join(scratch, 'fake-kaggle-flux');
    const cli = fakeKaggle(cliDir, {
      push: 'Kernel version 1 successfully pushed.',
      status: 'tester/kitgen-drawer has status "KernelWorkerStatus.COMPLETE"',
      output: {
        'kitgen-manifest.json': JSON.stringify({ device: 'Tesla T4', gpus: 2, encode_seconds: 80, load_seconds: 150, seconds: 200, images: [{ name: 'stone', file: 'stone.png', seconds: 21, error: null, tokens: 70 }] }),
        'stone.png': PNG_BYTES,
      },
    });
    writeFileSync(join(out, 'ref', 'stone.png'), Buffer.from('stone'));
    const drawn = drawWaveWithKaggle({
      out, stamp: 's1', timeoutSeconds: 60, env: { KAGGLE_CLI: cli, KAGGLE_POLL_SECONDS: '0.01', KAGGLE_MODEL: 'flux' },
      requests: [{ name: 'stone', prompt: 'Pixel art game sprite: stone.', reference: join(out, 'ref', 'stone.png'), expect: 'stone.png', grid: { width: 32, height: 32 } }],
    });
    expect(drawn.get('stone')?.version).toBe('unsloth/FLUX.1-schnell');
    const log = readFileSync(join(out, drawn.get('stone')?.log ?? ''), 'utf8');
    expect(log).toContain('recipe flux, model unsloth/FLUX.1-schnell, nf4, fp16');
    expect(log).toContain('no lora');
    expect(log).toContain('post grid');
    expect(log).toContain('prompts encoded at 80 s');
    expect(log).toContain('prompt 70 tokens');
    const pushed = new RegExp(`${KAGGLE_WAVE_MARK} = "([A-Za-z0-9+/=]+)"`).exec(readFileSync(join(cliDir, 'pushed.py'), 'utf8'))?.[1] ?? '';
    expect((JSON.parse(Buffer.from(pushed, 'base64').toString()) as { requests: Record<string, unknown>[] }).requests[0]).toMatchObject({ grid_width: 32, grid_height: 32 });
    expect(kaggleManifest(JSON.stringify({ encode_seconds: 80 })).encodeSeconds).toBe(80);
  });
});
