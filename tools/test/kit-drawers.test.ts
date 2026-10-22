import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import {
  KAGGLE_DEFAULTS, KAGGLE_WAVE_MARK, LOCAL_DEFAULTS, LOCAL_NEGATIVE, drawWaveWithKaggle, drawWithGemini, drawWithKaggle, drawWithLocal, geminiAnswer, geminiRequest,
  kaggleFileName, kaggleInferenceSteps, kaggleKernelScript, kaggleManifest, kaggleMetadata, kaggleOwner, kagglePushAnswer, kaggleSettings, kaggleStatus, kaggleWave,
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
      kernel: KAGGLE_DEFAULTS.kernel, gpu: true, accelerator: '', denoise: LOCAL_DEFAULTS.denoise, steps: LOCAL_DEFAULTS.steps,
      size: LOCAL_DEFAULTS.size, cfg: LOCAL_DEFAULTS.cfg, loraStrength: LOCAL_DEFAULTS.loraStrength, seed: 7,
    });
    expect(kaggleSettings({ KAGGLE_GPU: '0', KAGGLE_SIZE: '250', KAGGLE_STEPS: '6', KAGGLE_KERNEL: 'someone/wave' })).toMatchObject({ gpu: false, size: 248, steps: 6, kernel: 'someone/wave' });
    expect(() => kaggleSettings({ KAGGLE_DENOISE: 'half' })).toThrow(/KAGGLE_DENOISE/);
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
    expect(back.settings).toMatchObject({ model: KAGGLE_DEFAULTS.model, lora_file: KAGGLE_DEFAULTS.loraFile, denoise: 0.6, steps: 20, inference_steps: 34, size: 512, cfg: 7, lora_strength: 0.8, negative: LOCAL_NEGATIVE });
    expect(back.requests.map((r) => [r.name, r.file, r.seed])).toEqual([['tree oak', 'tree_oak.png', 7], ['barrel', 'barrel.png', 11]]);
    expect(Buffer.from(back.requests[0]?.png ?? '', 'base64').toString()).toBe('tree');
    expect(script).toContain('StableDiffusionImg2ImgPipeline');
    expect(script).toContain('kitgen-manifest.json');
    expect(kaggleMetadata('someone/kitgen-drawer', 'kitgen_wave.py', settings)).toMatchObject({
      id: 'someone/kitgen-drawer', title: 'kitgen-drawer', kernel_type: 'script', is_private: true, enable_gpu: true, enable_internet: true,
    });
    expect(kaggleMetadata('a/b', 'x.py', kaggleSettings({ KAGGLE_GPU: 'false', KAGGLE_ACCELERATOR: 'NvidiaTeslaT4' }))).toMatchObject({ enable_gpu: false, machine_shape: 'NvidiaTeslaT4' });
    expect(kaggleFileName('a/b c')).toBe('a_b_c.png');
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
    expect(readFileSync(join(cliDir, 'pushed.py'), 'utf8')).toContain(Buffer.from('barrel').toString('base64').slice(0, 4));
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
