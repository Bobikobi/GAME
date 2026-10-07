/** A small GitHub REST client with pagination and safe dry-run writes. */
export interface LoopClient {
  readonly dryRun?: boolean;
  get<T>(path: string): Promise<T>;
  list<T>(path: string): Promise<T[]>;
  write<T>(method: 'POST' | 'PATCH' | 'PUT', path: string, body: unknown): Promise<T | undefined>;
}

export class GitHubClient implements LoopClient {
  constructor(
    private readonly token: string,
    readonly dryRun = false,
    private readonly log: (line: string) => void = console.log,
    private readonly base = 'https://api.github.com',
  ) {}

  async get<T>(path: string): Promise<T> {
    const response = await this.fetch('GET', path);
    return await response.json() as T;
  }

  async list<T>(path: string): Promise<T[]> {
    const all: T[] = [];
    let next: string | undefined = path;
    while (next) {
      const response = await this.fetch('GET', next);
      const page = await response.json() as T[];
      all.push(...page);
      next = nextLink(response.headers.get('link'));
    }
    return all;
  }

  async write<T>(method: 'POST' | 'PATCH' | 'PUT', path: string, body: unknown): Promise<T | undefined> {
    if (this.dryRun) {
      this.log(`[dry-run] ${method} ${path} ${JSON.stringify(body)}`);
      return undefined;
    }
    const response = await this.fetch(method, path, body, true);
    if (response.status === 403) {
      this.log(`::warning::GitHub denied ${method} ${path} with 403; continuing with read-only access.`);
      return undefined;
    }
    return await response.json() as T;
  }

  private async fetch(method: string, path: string, body?: unknown, allow403 = false): Promise<Response> {
    const url = path.startsWith('http') ? path : `${this.base}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok && !(allow403 && response.status === 403)) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`GitHub ${method} ${path} failed with ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    return response;
  }
}

function nextLink(header: string | null): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match?.[2] === 'next') return match[1];
  }
  return undefined;
}
