// What the four route files share: build the call from the request and answer through handleS1.
import type { APIContext } from 'astro';
import type { S1Endpoint } from '@game/schema/s1';
import { handleS1, MAX_BODY } from './handler';
import { upstashStore } from './store';

export const s1Route =
  (endpoint: S1Endpoint) =>
  async (context: APIContext): Promise<Response> => {
    const { request } = context;
    let address: string | undefined;
    try {
      address = context.clientAddress;
    } catch {
      /* the host gave none */
    }
    const text = request.method === 'POST' ? (await request.text()).slice(0, MAX_BODY + 1) : '';
    return handleS1(upstashStore(), {
      endpoint,
      method: request.method,
      body: text,
      ip: request.headers.get('x-real-ip') ?? address ?? 'unknown',
      origin: request.headers.get('origin'),
      self: new URL(request.url).origin,
      now: new Date(),
    });
  };
