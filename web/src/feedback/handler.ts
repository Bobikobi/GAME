/**
 * The logic of POST /api/feedback (the route is web/src/pages/api/feedback.ts): a message
 * sent inside the game becomes a GitHub issue in Bobikobi/GAME labelled
 * `feedback`. Needs FEEDBACK_GITHUB_TOKEN, else HUB_GITHUB_TOKEN when the owner
 * gave the hub's token Issues write (a token that may create issues in that
 * repo); without either the answer is 503 and the game keeps the player's
 * text. The token is never logged or echoed. Files starting with an underscore
 * are not routes on Vercel.
 */

export const REPO = 'Bobikobi/GAME';
const MAX_BODY_BYTES = 8_000;
const TEXT_MAX = 1200;
const CHIP_MAX = 40;
const CHIPS_MAX = 12;
/** per client address and instance: 5 messages a minute. Best effort: instances do not share it. */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

const hits = new Map<string, number[]>();

export function resetRateLimit(): void {
  hits.clear();
}

function limited(key: string, now: number): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(k);
  return false;
}

export const json = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length <= max ? v : null);

/** A markdown-table cell: no pipes, no line breaks, no HTML. */
const cell = (s: string): string => s.replace(/[|<>\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

export interface Parsed {
  kind: 'feedback' | 'review';
  text: string;
  rating?: number;
  liked: string[];
  confused: string[];
  rows: [string, string][];
}

export function parse(raw: unknown): Parsed | null {
  if (!isObj(raw)) return null;
  const kind = raw['kind'];
  if (kind !== 'feedback' && kind !== 'review') return null;
  const text = str(raw['text'], TEXT_MAX);
  if (text === null) return null;
  const ctx = raw['context'];
  if (!isObj(ctx)) return null;
  const map = str(ctx['map'], 80);
  const hour = str(ctx['hour'], 10);
  const build = str(ctx['build'], 80);
  const quest = ctx['quest'] === null ? '' : str(ctx['quest'], 80);
  const tile = ctx['tile'];
  if (map === null || hour === null || build === null || quest === null) return null;
  if (!Array.isArray(tile) || tile.length !== 2 || !tile.every((n) => Number.isInteger(n) && Math.abs(n as number) < 100_000)) return null;
  const chips = (v: unknown): string[] | null => {
    if (v === undefined) return [];
    if (!Array.isArray(v) || v.length > CHIPS_MAX) return null;
    const out: string[] = [];
    for (const c of v) {
      const s = str(c, CHIP_MAX);
      if (s === null) return null;
      out.push(s);
    }
    return out;
  };
  const liked = chips(raw['liked']);
  const confused = chips(raw['confused']);
  if (!liked || !confused) return null;
  let rating: number | undefined;
  if (raw['rating'] !== undefined) {
    const r = raw['rating'];
    if (typeof r !== 'number' || !Number.isInteger(r) || r < 1 || r > 5) return null;
    rating = r;
  }
  const trimmed = text.trim();
  if (trimmed === '' && rating === undefined && !liked.length && !confused.length) return null;
  return {
    kind,
    text: trimmed,
    ...(rating === undefined ? {} : { rating }),
    liked,
    confused,
    rows: [
      ['Map', map],
      ['Tile', `${tile[0]}, ${tile[1]}`],
      ['Open quest', quest || 'none'],
      ['Valley hour', hour],
      ['Build', build],
    ],
  };
}

export function issueFrom(p: Parsed): { title: string; body: string; labels: string[] } {
  const first = cell(p.text.split('\n')[0]!).slice(0, 60);
  const title = p.kind === 'review' ? `Review${p.rating ? ` ${p.rating}/5` : ''}${first ? `: ${first}` : ''}` : `Feedback: ${first || '(no text)'}`;
  const rows = [...p.rows];
  if (p.rating !== undefined) rows.push(['Rating', `${p.rating}/5`]);
  if (p.liked.length) rows.push(['Felt best', p.liked.join(', ')]);
  if (p.confused.length) rows.push(['Confused', p.confused.join(', ')]);
  const table = ['| Field | Value |', '| --- | --- |', ...rows.map(([k, v]) => `| ${k} | ${cell(v)} |`)].join('\n');
  // the player's text goes in a quote block, and @ is broken, so nothing in it can ping anyone
  const quoted = p.text ? p.text.split('\n').map((l) => `> ${l.replace(/@/g, '@​')}`).join('\n') : '_(no text)_';
  return { title, body: `${quoted}\n\n${table}\n\n_Sent from inside the game._`, labels: ['feedback'] };
}

export async function handle(request: Request, env: Record<string, string | undefined>, doFetch: typeof fetch = fetch, now = Date.now()): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'method' });
  const token = env['FEEDBACK_GITHUB_TOKEN'] || env['HUB_GITHUB_TOKEN'];
  if (!token) return json(503, { error: 'unavailable' });
  const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0]!.trim();
  if (limited(ip, now)) return json(429, { error: 'rate' });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return json(413, { error: 'too_large' });
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'too_large' });
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return json(400, { error: 'invalid' });
  }
  const parsed = parse(data);
  if (!parsed) return json(400, { error: 'invalid' });
  let res: Response;
  try {
    res = await doFetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'user-agent': 'loomvale-feedback',
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify(issueFrom(parsed)),
    });
  } catch {
    return json(502, { error: 'github' });
  }
  // GitHub's own error text is not passed on, and only the status is logged
  if (!res.ok) {
    console.error(`feedback: GitHub answered ${res.status}`);
    return json(502, { error: 'github' });
  }
  return json(200, { ok: true });
}
