/** Vercel Function: POST /api/feedback. The work is in _feedback.ts. */
import { handle, json } from './_feedback';

export async function POST(request: Request): Promise<Response> {
  return handle(request, process.env);
}

export function GET(): Response {
  return json(405, { error: 'method' });
}
