import { describe, expect, test } from 'vitest';

import { resendMailer } from '../src/auth/mailer';

const config = { apiKey: 're_not_for_the_log', from: 'Loomvale <play@example.org>' };
const mail = { to: 'player@example.org', subject: 'Your Loomvale sign-in link', text: 'Open this link: https://play.example.org/auth/email/link#token=abc' };

function recorder(status: number, body = '') {
  const calls: { url: string; init: RequestInit }[] = [];
  const send = (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(new Response(body, { status }));
  };
  return { calls, send: send as typeof fetch };
}

describe('the Resend mailer', () => {
  test('posts one plain-text message from the sender to the one address, with the key as a bearer', async () => {
    const { calls, send } = recorder(200, '{"id":"x"}');
    await resendMailer(config, send).send(mail);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.resend.com/emails');
    expect(calls[0]!.init.method).toBe('POST');
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer re_not_for_the_log');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ from: config.from, to: [mail.to], subject: mail.subject, text: mail.text });
  });

  test("a refusal throws with the status and Resend's reason, never the key", async () => {
    const { send } = recorder(403, '{"message":"The example.org domain is not verified."}');
    const error = await resendMailer(config, send).send(mail).then(() => undefined, (e: unknown) => e as Error);
    expect(error?.message).toMatch(/403.*not verified/);
    expect(error?.message).not.toContain('re_not_for_the_log');
  });
});
