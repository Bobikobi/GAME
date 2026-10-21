import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import { drawWithGemini, geminiAnswer, geminiRequest, parseDrawer, promptForModel } from '../src/kit/drawers.js';

const scratch = mkdtempSync(join(tmpdir(), 'kit-drawers-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const AGENT_PROMPT = 'Use your image generation tool. The attached image is a reference: a barrel, 16x16 pixels. Generate a NEW image. Do not process the image with code afterwards; just generate it and save it as barrel.png in the current directory.';

describe('the routes', () => {
  test('codex is the default and an unknown route is refused', () => {
    expect(parseDrawer(undefined)).toBe('codex');
    expect(parseDrawer('')).toBe('codex');
    expect(parseDrawer('gemini')).toBe('gemini');
    expect(() => parseDrawer('midjourney')).toThrow(/codex or gemini/);
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
