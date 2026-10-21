import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import {
  LOCAL_DEFAULTS, drawWithGemini, drawWithLocal, geminiAnswer, geminiRequest, localHistory, localPrompt, localSettings, localWorkflow, parseDrawer, promptForModel,
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
    expect(() => parseDrawer('midjourney')).toThrow(/codex, gemini or local/);
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
