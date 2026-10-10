import { describe, expect, test, vi } from 'vitest';

import { FEEDBACK_TEXT_MAX, buildFeedbackPayload, failureMessage, isEmptyFeedback, sendFeedback } from '../src/feedback-payload';

const ctx = { map: 'core/world', tile: [12, 7] as [number, number], quest: 'core/first', hour: '18:30', build: 'content abcd1234 kernel 1.0.0' };

describe('the feedback payload', () => {
  test('carries the text and the game context, and nothing else', () => {
    const p = buildFeedbackPayload('feedback', '  nice valley \u0007 ', ctx);
    expect(p).toEqual({ kind: 'feedback', text: 'nice valley', context: ctx });
    expect(Object.keys(p).sort()).toEqual(['context', 'kind', 'text']);
  });

  test('caps the text', () => {
    expect(buildFeedbackPayload('feedback', 'x'.repeat(5000), ctx).text).toHaveLength(FEEDBACK_TEXT_MAX);
  });

  test('keeps a review rating only when it is 1 to 5, and the chips', () => {
    const ok = buildFeedbackPayload('review', '', ctx, { rating: 4, liked: ['The look'], confused: [] });
    expect(ok.rating).toBe(4);
    expect(ok.liked).toEqual(['The look']);
    expect(ok.confused).toBeUndefined();
    expect(buildFeedbackPayload('review', '', ctx, { rating: 9 }).rating).toBeUndefined();
  });

  test('an empty message is detected', () => {
    expect(isEmptyFeedback(buildFeedbackPayload('feedback', '   ', ctx))).toBe(true);
    expect(isEmptyFeedback(buildFeedbackPayload('review', '', ctx, { rating: 3 }))).toBe(false);
  });
});

describe('sending', () => {
  const payload = buildFeedbackPayload('feedback', 'hi', ctx);
  const reply = (status: number) => vi.fn(async () => new Response('{}', { status })) as unknown as typeof fetch;

  test('posts the payload as JSON', async () => {
    const f = reply(200);
    expect(await sendFeedback(payload, f, '/x')).toEqual({ ok: true });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('/x');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  test('maps failures to a reason, never throws', async () => {
    expect(await sendFeedback(payload, reply(503))).toEqual({ ok: false, reason: 'unavailable' });
    expect(await sendFeedback(payload, reply(429))).toEqual({ ok: false, reason: 'rate' });
    expect(await sendFeedback(payload, reply(400))).toEqual({ ok: false, reason: 'rejected' });
    const down = vi.fn(async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    expect(await sendFeedback(payload, down)).toEqual({ ok: false, reason: 'network' });
  });

  test('the unavailable message says so and promises the text is kept', () => {
    expect(failureMessage('unavailable')).toMatch(/^Sending is not available yet/);
    expect(failureMessage('unavailable')).toMatch(/kept/);
  });
});
