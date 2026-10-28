/** One message the server sends: plain text, one address. */
export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Who sends the sign-in link: `log` on a laptop or a staging box, `resend` where real players sign in
 * (the owner's choice of sender, NEXT 18 h5, 28.10).
 */
export interface Mailer {
  readonly name: string;
  send(mail: Mail): Promise<void>;
}

/** The development mailer: the message goes to the log, and no mail leaves the machine. */
export function logMailer(log: (line: string) => void = console.log): Mailer {
  return {
    name: 'log',
    send(mail) {
      log(`[mail to ${mail.to}] ${mail.subject}\n${mail.text}`);
      return Promise.resolve();
    },
  };
}

/** What the Resend mailer needs; the key is a secret and never reaches a log line or an error. */
export interface ResendConfig {
  apiKey: string;
  /** the sender, `Name <address>` on a domain verified in Resend */
  from: string;
}

const RESEND_URL = 'https://api.resend.com/emails';

/**
 * The real mailer: one POST to Resend's API per message, plain text only. Its click tracking stays off for
 * the sending domain, since a rewritten link would lose the token that rides after `#`.
 */
export function resendMailer(config: ResendConfig, send: typeof fetch = fetch): Mailer {
  return {
    name: 'resend',
    async send(mail) {
      const response = await send(RESEND_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: config.from, to: [mail.to], subject: mail.subject, text: mail.text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        // Resend's own message names the cause (an unverified domain, a bad address); it never echoes the key
        const detail = await response.text().catch(() => '');
        throw new Error(`resend refused the message (${response.status}): ${detail.slice(0, 200)}`);
      }
    },
  };
}

/** The mailers a MAILER variable may name. */
export const MAILERS = ['log', 'resend'] as const;
export type MailerName = (typeof MAILERS)[number];
