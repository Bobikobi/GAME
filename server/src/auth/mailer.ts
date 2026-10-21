/** One message the server sends: plain text, one address. */
export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Who sends the sign-in link. The sender is the owner's open choice (NEXT 18 h5), so the only mailer this
 * build has writes the link to the server log; a real one implements this interface and joins `MAILERS`.
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

/** The mailers a MAILER variable may name. */
export const MAILERS = ['log'] as const;
export type MailerName = (typeof MAILERS)[number];
