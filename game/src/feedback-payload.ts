/**
 * What an in-game feedback message carries: the player's words and the place
 * in the game they were typed. Pure and DOM-free so it can be tested. It holds
 * no name, address or account: only where the player stood, which quest was
 * open, the valley hour and the build.
 */

export const FEEDBACK_TEXT_MAX = 1200;
export const REVIEW_CHIP_MAX = 12;

export interface FeedbackContext {
  map: string;
  tile: [number, number];
  /** the quest on top of the tracker, if any */
  quest: string | null;
  /** valley time, "h:mm" */
  hour: string;
  /** content tag and kernel version */
  build: string;
}

export interface FeedbackPayload {
  kind: 'feedback' | 'review';
  text: string;
  context: FeedbackContext;
  /** review only: 1 to 5 */
  rating?: number;
  /** review only: chips picked, each from a fixed list */
  liked?: string[];
  confused?: string[];
}

const clean = (s: string, max: number): string =>
  // control characters out; newlines kept
  [...s].filter((c) => c === '\n' || c >= ' ').join('').trim().slice(0, max);

export function buildFeedbackPayload(
  kind: FeedbackPayload['kind'],
  text: string,
  context: FeedbackContext,
  review?: { rating?: number; liked?: readonly string[]; confused?: readonly string[] },
): FeedbackPayload {
  const payload: FeedbackPayload = { kind, text: clean(text, FEEDBACK_TEXT_MAX), context: { ...context, tile: [context.tile[0], context.tile[1]] } };
  if (review) {
    if (review.rating !== undefined && Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5) payload.rating = review.rating;
    if (review.liked?.length) payload.liked = review.liked.slice(0, REVIEW_CHIP_MAX).map((c) => clean(c, 40));
    if (review.confused?.length) payload.confused = review.confused.slice(0, REVIEW_CHIP_MAX).map((c) => clean(c, 40));
  }
  return payload;
}

/** A message with nothing chosen and nothing typed is not worth sending. */
export function isEmptyFeedback(p: FeedbackPayload): boolean {
  return p.text === '' && p.rating === undefined && !p.liked?.length && !p.confused?.length;
}

export type FailReason = 'unavailable' | 'rate' | 'network' | 'rejected';
export type SendResult = { ok: true } | { ok: false; reason: FailReason };

export const FEEDBACK_ENDPOINT = '/api/feedback';

/** Posts the payload to the site's function. Never throws; the caller keeps the text when it fails. */
export async function sendFeedback(payload: FeedbackPayload, doFetch: typeof fetch = fetch, endpoint = FEEDBACK_ENDPOINT): Promise<SendResult> {
  let res: Response;
  try {
    res = await doFetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (res.ok) return { ok: true };
  if (res.status === 503) return { ok: false, reason: 'unavailable' };
  if (res.status === 429) return { ok: false, reason: 'rate' };
  return { ok: false, reason: 'rejected' };
}

export function failureMessage(reason: FailReason): string {
  switch (reason) {
    case 'unavailable':
      return 'Sending is not available yet. Your text is kept; try again later.';
    case 'rate':
      return 'Too many messages just now. Wait a minute and try again.';
    case 'network':
      return 'Could not reach the server. Your text is kept; check the connection.';
    default:
      return 'The message was not accepted. Your text is kept.';
  }
}
